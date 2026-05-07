import {
  AdditiveBlending,
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  Points,
  ShaderMaterial,
  Vector3,
} from 'three';
import { MESSIER, MESSIER_TYPE_COLOR, dsoAngularSizeArcmin } from '../data/messier';
import { NGC_DATA } from '../data/ngc';
import { raDecToEcliptic } from '../physics/topocentric';
import { eclipticToScene } from '../physics/frame';
import { buildDSOAtlas, DSO_TILE_COUNT, DSO_TYPE_INDEX } from './dsoAtlas';

const DOME_RADIUS = 4000;
// Combine Messier + curated NGC/IC into a single point cloud — they share the
// same type-colour scheme and rendering style.
const ALL_DSOS = [...MESSIER, ...NGC_DATA];

/**
 * Renders ~170 Messier + NGC deep-sky objects as billboard points sampled
 * from a procedural 6-tile atlas (one shape per object type). The atlas is
 * grayscale; the shader multiplies by each object's type colour. Sizes
 * scale with magnitude so brighter / "showcase" DSOs read as substantially
 * larger fuzzy patches against the sky.
 */
export class MessierLayer {
  readonly object: Points;
  private mat: ShaderMaterial;

  constructor() {
    const N = ALL_DSOS.length;
    const positions = new Float32Array(N * 3);
    const colors = new Float32Array(N * 3);
    const sizes = new Float32Array(N);
    const typeIdx = new Float32Array(N);
    const arcmin = new Float32Array(N);
    const mags = new Float32Array(N);
    const tmp = new Color();

    ALL_DSOS.forEach((m, i) => {
      const dir = raDecToEcliptic(m.raHours, m.decDeg);
      const scene = eclipticToScene(dir).multiplyScalar(DOME_RADIUS);
      positions[i * 3] = scene.x;
      positions[i * 3 + 1] = scene.y;
      positions[i * 3 + 2] = scene.z;

      tmp.setHex(MESSIER_TYPE_COLOR[m.type]);
      const b = Math.max(0.55, 1.5 - m.magnitude * 0.10);
      colors[i * 3] = tmp.r * b;
      colors[i * 3 + 1] = tmp.g * b;
      colors[i * 3 + 2] = tmp.b * b;

      sizes[i] = Math.max(14, 64 - m.magnitude * 6);
      typeIdx[i] = DSO_TYPE_INDEX[m.type];
      arcmin[i] = dsoAngularSizeArcmin(m.id, m.type);
      mags[i] = m.magnitude;
    });

    const geom = new BufferGeometry();
    geom.setAttribute('position', new Float32BufferAttribute(positions, 3));
    geom.setAttribute('color', new Float32BufferAttribute(colors, 3));
    geom.setAttribute('size', new Float32BufferAttribute(sizes, 1));
    geom.setAttribute('aTypeIdx', new Float32BufferAttribute(typeIdx, 1));
    geom.setAttribute('aArcmin', new Float32BufferAttribute(arcmin, 1));
    geom.setAttribute('aMag', new Float32BufferAttribute(mags, 1));

    this.mat = new ShaderMaterial({
      uniforms: {
        uOpacity: { value: 1.0 },
        uAtlas: { value: buildDSOAtlas() },
        uTileCount: { value: DSO_TILE_COUNT },
        uStylized: { value: 1.0 },
        uRealSize: { value: 0.0 },
        uArcminToPx: { value: 0.3 },
        // Atmospheric extinction (k≈0.28 mag/airmass): dims DSOs near horizon.
        uExtinction:     { value: 0.0 },
        uObserverZenith: { value: new Vector3(0, 1, 0) },
        // Sky-background magnitude limit for DSOs. The observer can only
        // perceive an object whose magnitude is below this — combination of
        // Bortle (light pollution) and moonlight. Pristine = 6.5; full moon
        // urban can drop the limit to ~3.5.
        uDsoMagLimit:    { value: 8.0 },
      },
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      vertexShader: `
        attribute float size;
        attribute float aTypeIdx;
        attribute float aArcmin;
        attribute float aMag;
        uniform float uStylized;
        uniform float uRealSize;
        uniform float uArcminToPx;
        uniform float uExtinction;
        uniform vec3  uObserverZenith;
        uniform float uDsoMagLimit;
        varying vec3 vColor;
        varying float vTypeIdx;
        varying float vAlphaMul;
        void main() {
          vColor = color;
          vTypeIdx = aTypeIdx;

          // Atmospheric extinction (Bouguer, k≈0.28 mag/airmass).
          vec3 dsoDir = normalize(position);
          float cosZ = dot(dsoDir, uObserverZenith);
          float airmass = 1.0 / max(0.026, cosZ);
          float extinctMag = uExtinction * 0.28 * (airmass - 1.0);
          float aboveHorizon = step(0.0, cosZ);

          // Effective magnitude in current sky; if it exceeds the sky-
          // background limit (driven by Bortle + moon), the DSO is washed out.
          float effectiveMag = aMag + extinctMag;
          float magHeadroom = uDsoMagLimit - effectiveMag; // >0 visible
          float visBySky = clamp(magHeadroom, 0.0, 1.0);   // soft fade in last mag
          // Below horizon: hard hide (only when extinction is on, otherwise
          // the user can still pan around with the celestial sphere fully shown).
          float horizonMul = mix(1.0, aboveHorizon, uExtinction);
          // Brightness loss from extinction (1 mag = 2.512× dimmer).
          float extinctMul = mix(1.0, pow(2.512, -extinctMag), uExtinction);
          vAlphaMul = visBySky * horizonMul * extinctMul;

          // Real-size or stylised size selection (unchanged).
          float realisticSize = min(size, 6.0);
          float baseSize = mix(realisticSize, size, uStylized);
          float angularPx = max(4.0, aArcmin * uArcminToPx);
          float chosenSize = mix(baseSize, angularPx, uRealSize);
          // Hide entirely if alpha-mul is essentially zero (skip rasterisation).
          gl_PointSize = chosenSize * step(0.005, vAlphaMul);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uOpacity;
        uniform sampler2D uAtlas;
        uniform float uTileCount;
        uniform float uStylized;
        varying vec3 vColor;
        varying float vTypeIdx;
        varying float vAlphaMul;
        void main() {
          float v = (uTileCount - vTypeIdx - gl_PointCoord.y) / uTileCount;
          vec4 sampleC = texture2D(uAtlas, vec2(gl_PointCoord.x, v));
          vec3 stylisedRgb = vColor * sampleC.rgb;
          float stylisedA = sampleC.a;

          vec2 c = gl_PointCoord - 0.5;
          float r2 = dot(c, c) * 4.0;
          float realA = pow(max(0.0, 1.0 - r2), 2.0);
          float lum = dot(vColor, vec3(0.299, 0.587, 0.114));
          vec3 realRgb = mix(vec3(lum), vColor, 0.35) * 0.6;

          vec3 rgb = mix(realRgb,  stylisedRgb,  uStylized);
          float a  = mix(realA,    stylisedA,    uStylized) * uOpacity * vAlphaMul;
          if (a < 0.01) discard;
          gl_FragColor = vec4(rgb, a);
        }
      `,
    });
    this.object = new Points(geom, this.mat);
    this.object.frustumCulled = false;
  }

  setOpacity(opacity: number): void {
    this.mat.uniforms.uOpacity.value = opacity;
    this.object.visible = opacity > 0.01;
  }

  setVisible(visible: boolean): void {
    this.object.visible = visible;
  }

  /** true = stylised procedural icons; false = small realistic faint dots. */
  setStylized(stylized: boolean): void {
    this.mat.uniforms.uStylized.value = stylized ? 1.0 : 0.0;
  }

  setRealAngularSize(enabled: boolean): void {
    this.mat.uniforms.uRealSize.value = enabled ? 1.0 : 0.0;
  }

  /**
   * Update arcmin→screen-pixel multiplier. Caller passes the current camera
   * vertical FOV in degrees and canvas height in pixels.
   */
  updateAngularScale(fovDeg: number, canvasHeight: number): void {
    const fovArcmin = fovDeg * 60;
    this.mat.uniforms.uArcminToPx.value = canvasHeight / fovArcmin;
  }

  setExtinctionEnabled(enabled: boolean): void {
    this.mat.uniforms.uExtinction.value = enabled ? 1.0 : 0.0;
  }
  setObserverZenith(zenith: Vector3): void {
    this.mat.uniforms.uObserverZenith.value.copy(zenith).normalize();
  }
  /**
   * Combined sky-background magnitude limit for DSOs. The caller derives
   * this from current Bortle and moon brightness — a Bortle-1 dark sky
   * with no moon ≈ 7; full moon at zenith in city ≈ 3.5.
   */
  setDsoMagLimit(limit: number): void {
    this.mat.uniforms.uDsoMagLimit.value = limit;
  }
}
