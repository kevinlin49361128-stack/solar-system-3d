import {
  AdditiveBlending,
  BackSide,
  Mesh,
  ShaderMaterial,
  SphereGeometry,
  Vector3,
} from 'three';

/**
 * Additive sky-overlay sphere drawn around the observer. Layers two
 * twilight-only visual effects on top of the base AtmosphereSky:
 *
 *  - Belt of Venus / anti-solar arch (#5): a pink band 0–10° above the
 *    anti-solar horizon when the sun is between −1° and −9° altitude.
 *  - Airglow + light-pollution dome (#10): a faint green wash within ~5° of
 *    the local horizon at full astronomical night, plus a yellow-orange
 *    glow tied to the Bortle level (modeling unresolved city lights).
 *
 * The geometry sits inside the sky dome and is drawn additively so its
 * effects layer cleanly over Preetham scattering without re-tinting it.
 */
export class AtmosphereOverlay {
  readonly mesh: Mesh;
  private mat: ShaderMaterial;

  constructor() {
    const geom = new SphereGeometry(7900, 48, 32);
    this.mat = new ShaderMaterial({
      uniforms: {
        uSunDir:        { value: new Vector3(0, 1, 0) },
        uZenith:        { value: new Vector3(0, 1, 0) },
        uBeltEnabled:   { value: 0.0 },
        uAirglowEnabled:{ value: 0.0 },
        uBortle:        { value: 4.0 },
        // Moon-induced ambient sky brightening: a soft blue-grey glow
        // centred on the moon's direction, rising from the lower hemisphere.
        // Intensity is the same "moon dim mag" used elsewhere (full moon at
        // zenith ≈ 2.2). Always-on once the moonGlow toggle is active so
        // the night sky brightens whenever the moon is up.
        uMoonIntensity: { value: 0.0 },
        uMoonDir:       { value: new Vector3(0, 1, 0) },
      },
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      side: BackSide,
      vertexShader: `
        varying vec3 vLocalDir;
        void main() {
          // Mesh is centered at the observer (setCenter(cameraPos)), so the
          // local position attribute is the direction from observer to vertex.
          vLocalDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uSunDir;
        uniform vec3 uZenith;
        uniform vec3 uMoonDir;
        uniform float uMoonIntensity;
        uniform float uBeltEnabled;
        uniform float uAirglowEnabled;
        uniform float uBortle;
        varying vec3 vLocalDir;

        void main() {
          vec3 viewDir = vLocalDir;
          float altSin = dot(viewDir, uZenith);          // -1 nadir, +1 zenith
          float altDeg = degrees(asin(clamp(altSin, -1.0, 1.0)));
          float sunAltSin = dot(uSunDir, uZenith);
          float sunAltDeg = degrees(asin(clamp(sunAltSin, -1.0, 1.0)));

          vec3 col = vec3(0.0);

          // -- Belt of Venus --------------------------------------------------
          // Anti-solar arch: pink ~3°–10° above horizon, opposite the sun.
          // Visible roughly when sun is -1° to -9° (civil/early-nautical twilight).
          if (uBeltEnabled > 0.5) {
            float twilight = smoothstep(-9.0, -1.0, sunAltDeg)
                           * (1.0 - smoothstep(-1.0, 4.0, sunAltDeg));
            // Anti-solar horizontal direction: project -uSunDir onto horizon plane.
            vec3 antiSun = normalize(-uSunDir + uZenith * dot(uSunDir, uZenith));
            float antiSunDot = dot(viewDir, antiSun);
            // Belt only visible looking *toward* anti-solar half (dot > 0)
            float dirMask = smoothstep(0.0, 0.6, antiSunDot);
            // Vertical band: peak around alt ≈ 4°, fades to 0 at -2° / 12°
            float bandPink = exp(-pow((altDeg - 4.0) / 4.5, 2.0));
            // Earth shadow band: dark blue-grey 0°–2° just below the pink
            float bandDark = exp(-pow((altDeg + 1.0) / 3.0, 2.0));
            vec3 pink = vec3(0.55, 0.30, 0.40) * bandPink * 0.35;
            vec3 dark = vec3(0.03, 0.04, 0.10) * bandDark * 0.30;
            col += (pink + dark) * dirMask * twilight;
          }

          // -- Airglow + light-pollution dome ---------------------------------
          // Faint green airglow at horizon when sun is well below (< -12°).
          // Bortle-driven warm orange dome adds a city-light glow that grows
          // from horizon up; intensity ∝ (Bortle - 1)/8.
          if (uAirglowEnabled > 0.5) {
            float nightFrac = smoothstep(-12.0, -18.0, sunAltDeg);
            float horizonBand = exp(-pow(altDeg / 5.0, 2.0));
            float aboveHorizon = step(0.0, altDeg);
            vec3 airglow = vec3(0.05, 0.13, 0.07) * horizonBand * nightFrac * aboveHorizon;
            float lpFactor = clamp((uBortle - 1.0) / 8.0, 0.0, 1.0);
            float lpBand = exp(-pow(altDeg / 25.0, 2.0));
            vec3 lp = vec3(0.16, 0.10, 0.04) * lpBand * lpFactor * aboveHorizon;
            col += airglow + lp;
          }

          // -- Moonlight scatter -----------------------------------------------
          // When the moon is up, Rayleigh scatter brightens the night sky.
          // Modelled as a soft glow around the moon direction, plus a uniform
          // sky tint proportional to moon intensity. Only acts at night
          // (sun < -6°) so it doesn't double-count daylight scatter.
          if (uMoonIntensity > 0.001) {
            float nightFrac = smoothstep(-2.0, -10.0, sunAltDeg);
            float aboveHorizon = step(0.0, altDeg);
            float moonAngle = acos(clamp(dot(viewDir, uMoonDir), -1.0, 1.0));
            // Closer to moon = brighter; rolls off over ~50°
            float moonProx = exp(-pow(moonAngle / 0.9, 2.0));
            // Uniform tint plus halo near the moon
            vec3 moonBlue = vec3(0.06, 0.08, 0.13);
            col += moonBlue * uMoonIntensity * 0.18 * aboveHorizon * nightFrac;
            col += moonBlue * uMoonIntensity * moonProx * 0.45 * aboveHorizon * nightFrac;
          }

          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
    this.mesh = new Mesh(geom, this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -50; // before stars but after sky
    this.mesh.visible = false;
  }

  setSunDirection(sunDir: Vector3): void {
    this.mat.uniforms.uSunDir.value.copy(sunDir).normalize();
  }
  setZenith(zenith: Vector3): void {
    this.mat.uniforms.uZenith.value.copy(zenith).normalize();
  }
  setCenter(p: Vector3): void {
    this.mesh.position.copy(p);
  }
  setVisible(v: boolean): void {
    this.mesh.visible = v;
  }
  setBeltEnabled(v: boolean): void {
    this.mat.uniforms.uBeltEnabled.value = v ? 1.0 : 0.0;
    this.refreshVisibility();
  }
  setAirglowEnabled(v: boolean): void {
    this.mat.uniforms.uAirglowEnabled.value = v ? 1.0 : 0.0;
    this.refreshVisibility();
  }
  setBortle(b: number): void {
    this.mat.uniforms.uBortle.value = Math.max(1, Math.min(9, b));
  }
  setMoonGlow(intensity: number, moonDirLocal: Vector3 | null): void {
    this.mat.uniforms.uMoonIntensity.value = Math.max(0, intensity);
    if (moonDirLocal) {
      this.mat.uniforms.uMoonDir.value.copy(moonDirLocal).normalize();
    }
    this.refreshVisibility();
  }
  private refreshVisibility(): void {
    const hasAny = this.mat.uniforms.uBeltEnabled.value > 0
                || this.mat.uniforms.uAirglowEnabled.value > 0
                || this.mat.uniforms.uMoonIntensity.value > 0.001;
    this.mesh.visible = hasAny;
  }
}
