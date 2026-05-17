import {
  AdditiveBlending,
  Mesh,
  PointLight,
  ShaderMaterial,
  SphereGeometry,
} from 'three';

/**
 * Solar limb darkening — V-band Pierce & Slaughter (1977) two-term fit:
 *
 *   I(μ) / I(1) = 1 − u₁·(1−μ) − u₂·(1−μ)²
 *
 * where μ = cos(angle from disc centre as seen by observer). At disc
 * centre μ=1 → I=1; at the limb μ=0 → I = 1 − u₁ − u₂ ≈ 0.30 (the
 * Sun's edge is ~30 % of centre brightness — visibly darker in any
 * decent photo of the photosphere). Limb also gets slightly redder
 * because we see through more cool chromosphere; modelled as a small
 * blue-channel reduction near the limb.
 *
 * Reference: Pierce & Slaughter 1977 Sol. Phys. 51:25 (canonical
 * V-band visible-light coefficients).
 */
export const SOLAR_LIMB_U1 = 0.93;
export const SOLAR_LIMB_U2 = -0.23;
export function solarLimbBrightness(mu: number): number {
  const cm = 1 - Math.max(0, Math.min(1, mu));
  return 1 - SOLAR_LIMB_U1 * cm - SOLAR_LIMB_U2 * cm * cm;
}

/**
 * Sun rendering: shader-based core with V-band limb darkening + a
 * fresnel-glow outer shell. Includes a PointLight at origin so other
 * bodies are lit.
 */
export function createSunGroup(coreRadius: number): { core: Mesh; glow: Mesh; light: PointLight } {
  const coreGeom = new SphereGeometry(coreRadius, 64, 32);
  // Replace the flat-colour core with a custom shader implementing the
  // Pierce-Slaughter limb-darkening law + slight limb reddening. We use
  // a ShaderMaterial (not extending MeshBasicMaterial) because limb
  // darkening operates on view-space angles and doesn't compose with
  // Three's standard lighting chain.
  const coreMat = new ShaderMaterial({
    uniforms: {
      uCentreColor: { value: { r: 1.0, g: 0.95, b: 0.80 } },  // 5780 K blackbody-ish, slight warm bias
      uU1: { value: SOLAR_LIMB_U1 },
      uU2: { value: SOLAR_LIMB_U2 },
    },
    vertexShader: `
      varying vec3 vViewNormal;
      varying vec3 vViewPos;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vViewPos = mv.xyz;
        vViewNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      uniform vec3 uCentreColor;
      uniform float uU1;
      uniform float uU2;
      varying vec3 vViewNormal;
      varying vec3 vViewPos;
      void main() {
        // In view space the camera is at origin looking down -Z; view
        // direction at this fragment points from fragment back to camera.
        vec3 V = normalize(-vViewPos);
        // μ = cosine of angle between surface normal and viewer.
        // For a sphere viewed externally this maps 1 at disc centre → 0
        // at the limb; matches Pierce-Slaughter convention exactly.
        float mu = max(0.0, dot(normalize(vViewNormal), V));
        float oneMinusMu = 1.0 - mu;
        float bright = 1.0 - uU1 * oneMinusMu - uU2 * oneMinusMu * oneMinusMu;
        // Limb reddening — pull the blue channel down faster than RG
        // near the limb so the edge looks ~K3500 rather than K5780.
        // Empirical, not photometric, but matches the visible-light
        // appearance in solar photos.
        vec3 col = uCentreColor;
        col.b *= mix(0.55, 1.0, mu);
        gl_FragColor = vec4(col * bright, 1.0);
      }
    `,
  });
  const core = new Mesh(coreGeom, coreMat);
  core.userData.bodyId = 'sun';

  const glowGeom = new SphereGeometry(coreRadius * 2.4, 32, 16);
  const glowMat = new ShaderMaterial({
    transparent: true,
    blending: AdditiveBlending,
    depthWrite: false,
    side: 1, // BackSide
    uniforms: {
      glowColor: { value: { r: 1.0, g: 0.78, b: 0.4 } },
    },
    vertexShader: `
      varying vec3 vNormal;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 glowColor;
      varying vec3 vNormal;
      void main() {
        float intensity = pow(0.7 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 3.0);
        gl_FragColor = vec4(glowColor, 1.0) * intensity;
      }
    `,
  });
  const glow = new Mesh(glowGeom, glowMat);

  const light = new PointLight(0xffe9bd, 4.0, 0, 0);
  light.position.set(0, 0, 0);

  return { core, glow, light };
}
