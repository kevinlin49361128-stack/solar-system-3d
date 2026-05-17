import {
  AdditiveBlending,
  BufferGeometry,
  Float32BufferAttribute,
  Points,
  ShaderMaterial,
  Vector3,
} from 'three';
import { raDecToEcliptic } from '../physics/topocentric';
import { eclipticToScene } from '../physics/frame';
import { toast } from '../ui/toast';
import { t } from '../i18n';
import { NAMED_STARS } from '../data/stars';

const STAR_DOME_RADIUS = 4000;

/**
 * Pre-computed unit vectors for every NAMED_STAR's J2000 position.
 * Used to filter bulk-catalog entries that duplicate a named star
 * (otherwise the user sees a "double" — the StarMap sprite drifts
 * under PM correction while the unfiltered HYG entry stays at J2000,
 * and they no longer overlap). Built lazily on first populate() call.
 */
let _namedStarUnitVectors: Vector3[] | null = null;
const NAMED_DEDUP_COS_THRESHOLD = Math.cos(0.3 * Math.PI / 180);  // 0.3°
function getNamedStarUnitVectors(): Vector3[] {
  if (_namedStarUnitVectors) return _namedStarUnitVectors;
  _namedStarUnitVectors = NAMED_STARS.map((s) => {
    const eclDir = raDecToEcliptic(s.raHours, s.decDeg);
    return eclipticToScene(eclDir);  // unit length (raDecToEcliptic normalises)
  });
  return _namedStarUnitVectors;
}

/**
 * Renders the Yale Bright Star Catalog (BSC) — ~8400 stars to magnitude 6.5
 * (the human eye limit under perfect skies). Each star's screen-space size
 * encodes its visual magnitude.
 *
 * Uses a custom ShaderMaterial because PointsMaterial cannot apply
 * per-vertex point sizes.
 */
export class RealStarfield {
  readonly object: Points;
  private mat: ShaderMaterial;
  private loaded = false;
  /**
   * Combined catalog data: BSC (≤ mag 6.5) is loaded first, then optionally
   * extended catalog (HYG-derived, mag 6.5 → 9). We keep both raw entries so
   * a re-populate call (e.g. after lazy-loading the extension) can rebuild
   * the GPU buffers in one pass without re-fetching.
   */
  private catalogEntries: Array<[number, number, number, number?]> = [];
  private extendedLoading: Promise<void> | null = null;
  private extendedLoaded = false;

  constructor() {
    const geom = new BufferGeometry();
    // empty buffers; populated by load()
    geom.setAttribute('position', new Float32BufferAttribute(new Float32Array(0), 3));
    geom.setAttribute('color', new Float32BufferAttribute(new Float32Array(0), 3));
    geom.setAttribute('size', new Float32BufferAttribute(new Float32Array(0), 1));

    this.mat = new ShaderMaterial({
      uniforms: {
        uOpacity:  { value: 1.0 },
        // Hard limit: any star with magnitude > uMagLimit is fully discarded
        // (telescope mode pretends to "see deeper", but BSC tops out at 6.5
        // so this only differs from naked-eye when the limit is set < 6.5).
        uMagLimit: { value: 7.0 },
        // Soft Bortle dimming: stars fainter than (uMagLimit - 1) get a
        // log-falloff in alpha, mimicking how light pollution washes out
        // faint stars before fully extinguishing them. uBortle in [1, 9].
        uBortle:   { value: 4.0 },
        // Atmospheric extinction (item #1). When > 0.5 the shader applies
        // the Bouguer formula using `uObserverZenith`: stars near horizon
        // get dimmed proportional to airmass.
        uExtinction:      { value: 0.0 },
        uObserverZenith:  { value: new Vector3(0, 1, 0) },
        // Moon-induced sky brightening (item #2). Externally computed as
        // illuminated-fraction × moon-altitude factor; the shader subtracts
        // this from the effective magnitude limit so faint stars vanish when
        // the moon is high and bright.
        uMoonExtraDimMag: { value: 0.0 },
        // B-V color toggle (item #6). 0 = monochrome (luminance only),
        // 1 = stored RGB from the catalog colour index.
        uBVColorMix:      { value: 0.0 },
        // Twinkle (atmospheric scintillation). Amplitude scales with airmass
        // so horizon stars wink visibly while zenith stars are stable.
        // Driven by a wall-clock time uniform updated each frame.
        uTwinkle:         { value: 0.0 },
        uTime:            { value: 0.0 },
      },
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      vertexShader: `
        attribute float size;
        attribute float mag;
        varying vec3 vColor;
        varying float vMag;
        varying float vExtinctMag;
        varying float vTwinkleMul;
        uniform float uMagLimit;
        uniform float uExtinction;
        uniform vec3  uObserverZenith;
        uniform float uMoonExtraDimMag;
        uniform float uTwinkle;
        uniform float uTime;
        void main() {
          vColor = color;
          // Atmospheric extinction. Star direction is its position vector
          // normalised (sphere is centred at origin). cosZ = star · zenith.
          // airmass ≈ 1/cosZ, capped at 38 (~horizon). Bouguer with
          // k≈0.28 mag/airmass for V band on a clear night.
          vec3 starDir = normalize(position);
          float cosZ = dot(starDir, uObserverZenith);
          float airmass = 1.0 / max(0.026, cosZ);
          float extinctMag = uExtinction * 0.28 * (airmass - 1.0);
          // Stars below the horizon: collapse so they never contribute
          // (atmosphere shader covers that hemisphere anyway).
          float aboveHorizon = step(0.0, cosZ);
          vExtinctMag = extinctMag;
          float effectiveMag = mag + extinctMag + uMoonExtraDimMag;
          vMag = effectiveMag;
          float visible = step(effectiveMag, uMagLimit) * mix(1.0, aboveHorizon, uExtinction);

          // Atmospheric scintillation (twinkle). Amplitude grows with airmass
          // so zenith stars are steady, horizon stars flicker. Phase per star
          // is seeded from the position so neighbouring stars don't twinkle
          // in lockstep. Frequency ~3 Hz feels natural.
          float twinkleAmp = uTwinkle * clamp((airmass - 1.0) * 0.6, 0.0, 0.6);
          float twinklePhase = uTime * 6.28 * 3.0
                             + position.x * 0.731
                             + position.y * 1.293
                             + position.z * 0.517;
          float twinkle = 1.0 + twinkleAmp * sin(twinklePhase);
          vTwinkleMul = twinkle;
          gl_PointSize = size * visible * mix(1.0, twinkle, step(0.001, uTwinkle));
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uOpacity;
        uniform float uMagLimit;
        uniform float uBortle;
        uniform float uBVColorMix;
        varying vec3 vColor;
        varying float vMag;
        varying float vExtinctMag;
        varying float vTwinkleMul;
        void main() {
          vec2 c = gl_PointCoord - 0.5;
          float r = length(c);
          if (r > 0.5) discard;
          float a = smoothstep(0.5, 0.15, r);
          float headroom = uMagLimit - vMag;
          float bortleFactor = mix(1.0, smoothstep(0.0, 1.0, headroom), (uBortle - 1.0) / 8.0);
          float extinctAlphaScale = pow(2.512, -vExtinctMag);
          // Twinkle modulates alpha too (intensity scintillation).
          float twinkleAlpha = mix(1.0, vTwinkleMul, 0.7);
          float lum = dot(vColor, vec3(0.299, 0.587, 0.114));
          vec3 col = mix(vec3(lum), vColor, uBVColorMix);
          gl_FragColor = vec4(col, a * uOpacity * bortleFactor * extinctAlphaScale * twinkleAlpha);
        }
      `,
    });
    this.object = new Points(geom, this.mat);
    this.object.frustumCulled = false;
  }

  async load(url: string): Promise<void> {
    if (this.loaded) return;
    try {
      const resp = await fetch(url);
      if (!resp.ok) throw new Error('star catalog fetch failed: ' + resp.status);
      const data = await resp.json() as Array<[number, number, number, number?]>;
      this.catalogEntries = data;
      this.populate(this.catalogEntries);
      this.loaded = true;
    } catch (err) {
      console.warn('RealStarfield: failed to load', url, err);
      toast.warn(t('toast.bscFailed'));
    }
  }

  /**
   * Lazy-load the extended HYG catalogue (~75 k stars, mag 6.5 → 9). Called
   * automatically when the user picks an optics preset whose magnitude limit
   * would benefit (binoculars, telescope). Idempotent.
   */
  async loadExtendedCatalog(url: string = '/stars-hyg.json'): Promise<void> {
    if (this.extendedLoaded) return;
    if (this.extendedLoading) return this.extendedLoading;
    this.extendedLoading = (async () => {
      try {
        const resp = await fetch(url);
        if (!resp.ok) throw new Error('extended catalog fetch failed: ' + resp.status);
        const data = await resp.json() as Array<[number, number, number, number?]>;
        this.catalogEntries = this.catalogEntries.concat(data);
        this.populate(this.catalogEntries);
        this.extendedLoaded = true;
      } catch (err) {
        console.warn('RealStarfield: failed to load extended catalog', url, err);
      } finally {
        this.extendedLoading = null;
      }
    })();
    return this.extendedLoading;
  }

  private populate(data: Array<[number, number, number, number?]>): void {
    // Drop bulk-catalogue entries that duplicate a NAMED_STAR. The
    // StarMap renders those separately with PM + aberration applied; if
    // we leave them in here they show up as a second un-corrected dot
    // a fraction of a degree from the rendered named-star sprite — the
    // "double-star" bug from the PM commit. Filter is angular-distance
    // on the unit sphere (cos > threshold = within ε). We only care
    // about bright bulk entries since dim collisions are imperceptible.
    const namedUnit = getNamedStarUnitVectors();
    const tmpUnit = new Vector3();
    const filtered: Array<[number, number, number, number?]> = [];
    for (const row of data) {
      const [raH, decDeg, mag] = row;
      let isNamed = false;
      if (mag < 4.5) {
        // Bright enough for a duplicate dot to be visually obvious.
        tmpUnit.copy(eclipticToScene(raDecToEcliptic(raH, decDeg)));
        for (const u of namedUnit) {
          if (tmpUnit.dot(u) > NAMED_DEDUP_COS_THRESHOLD) { isNamed = true; break; }
        }
      }
      if (!isNamed) filtered.push(row);
    }

    // Keep `catalogEntries` aligned with the geometry's vertex order so
    // pickAtScreen() can index both with the same `i`. Idempotent under
    // re-population (filtering twice gives the same result), so the
    // loadExtendedCatalog concat-then-populate flow stays correct.
    this.catalogEntries = filtered;

    const N = filtered.length;
    const positions = new Float32Array(N * 3);
    const colors = new Float32Array(N * 3);
    const sizes = new Float32Array(N);
    const mags = new Float32Array(N);

    for (let i = 0; i < N; i++) {
      const [raH, decDeg, mag, colorInt] = filtered[i];
      const dirEcl = raDecToEcliptic(raH, decDeg);
      const dirScene = eclipticToScene(dirEcl).multiplyScalar(STAR_DOME_RADIUS);
      positions[i * 3]     = dirScene.x;
      positions[i * 3 + 1] = dirScene.y;
      positions[i * 3 + 2] = dirScene.z;

      const size = Math.max(0.7, Math.min(5.5, 4.6 - mag * 0.6));
      sizes[i] = size;
      mags[i] = mag;

      // Brightness factor reduces dim stars' contribution to additive blend.
      const b = Math.max(0.25, Math.min(1.0, 1.1 - mag * 0.13));
      let r = b, g = b, bl = b;
      if (colorInt !== undefined) {
        r  = ((colorInt >> 16) & 0xff) / 255 * b;
        g  = ((colorInt >> 8)  & 0xff) / 255 * b;
        bl = ( colorInt        & 0xff) / 255 * b;
      }
      colors[i * 3]     = r;
      colors[i * 3 + 1] = g;
      colors[i * 3 + 2] = bl;
    }

    const geom = this.object.geometry;
    geom.setAttribute('position', new Float32BufferAttribute(positions, 3));
    geom.setAttribute('color',    new Float32BufferAttribute(colors, 3));
    geom.setAttribute('size',     new Float32BufferAttribute(sizes, 1));
    geom.setAttribute('mag',      new Float32BufferAttribute(mags, 1));
    geom.computeBoundingSphere();
  }

  setOpacity(opacity: number): void {
    this.mat.uniforms.uOpacity.value = opacity;
    this.object.visible = opacity > 0.01;
  }

  /**
   * Find the nearest catalog star to the given screen click position.
   * Returns null if no star is within `tolerancePx` of the click, or the
   * starfield is empty / hidden. Iterates the full catalog (~75 k after
   * extended load) — costs ~3 ms on M-series; acceptable for click events.
   *
   * Uses screen-space proximity (camera.project). Handles the dome being
   * placed at huge scene radius — we project each star and skip those
   * with NDC.z out of view (behind camera or past far plane).
   *
   * @returns { raHours, decDeg, magnitude, distancePx } or null
   */
  pickAtScreen(
    clickX: number,
    clickY: number,
    camera: import('three').Camera,
    canvasRect: DOMRect,
    tolerancePx: number = 12,
    magLimit: number = Infinity,
  ): { raHours: number; decDeg: number; magnitude: number; distancePx: number } | null {
    if (!this.object.visible) return null;
    const positions = this.object.geometry.attributes.position;
    if (!positions || positions.count === 0) return null;

    // Project all (or sample-skip if catalog is large). For a 75k catalog
    // a full scan is fast enough on a click event; we still skip stars
    // that fail the magnitude filter so a binoculars-mode user can click
    // a faint star without naked-eye stars stealing focus.
    const v = new (camera.position.constructor as typeof import('three').Vector3)();
    let bestDist = tolerancePx + 0.5;
    let bestIdx = -1;
    const cssX = clickX - canvasRect.left;
    const cssY = clickY - canvasRect.top;
    const W = canvasRect.width;
    const H = canvasRect.height;

    for (let i = 0; i < positions.count; i++) {
      const mag = this.catalogEntries[i]?.[2] ?? 99;
      if (mag > magLimit) continue;
      v.set(positions.getX(i), positions.getY(i), positions.getZ(i));
      v.project(camera);
      // Skip behind-camera stars.
      if (v.z > 1 || v.z < -1) continue;
      const sx = (v.x * 0.5 + 0.5) * W;
      const sy = (-v.y * 0.5 + 0.5) * H;
      const dx = sx - cssX;
      const dy = sy - cssY;
      const d = Math.hypot(dx, dy);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    }
    if (bestIdx < 0) return null;
    const entry = this.catalogEntries[bestIdx];
    return {
      raHours: entry[0],
      decDeg: entry[1],
      magnitude: entry[2],
      distancePx: bestDist,
    };
  }

  /** Set the hard magnitude limit (stars fainter than this are hidden). */
  setMagnitudeLimit(magLimit: number): void {
    this.mat.uniforms.uMagLimit.value = magLimit;
  }

  /** Set the Bortle scale value (1 = pristine, 9 = inner city). */
  setBortleScale(bortle: number): void {
    this.mat.uniforms.uBortle.value = Math.max(1, Math.min(9, bortle));
  }

  /** Whether the BSC catalog has been loaded yet (for lazy-load gating). */
  isLoaded(): boolean {
    return this.loaded;
  }
  isExtendedLoaded(): boolean {
    return this.extendedLoaded;
  }

  setExtinctionEnabled(enabled: boolean): void {
    this.mat.uniforms.uExtinction.value = enabled ? 1.0 : 0.0;
  }
  setObserverZenith(zenith: Vector3): void {
    this.mat.uniforms.uObserverZenith.value.copy(zenith).normalize();
  }
  setMoonExtraDimMag(mag: number): void {
    this.mat.uniforms.uMoonExtraDimMag.value = Math.max(0, mag);
  }
  setBVColorEnabled(enabled: boolean): void {
    this.mat.uniforms.uBVColorMix.value = enabled ? 1.0 : 0.0;
  }
  setTwinkleEnabled(enabled: boolean): void {
    this.mat.uniforms.uTwinkle.value = enabled ? 1.0 : 0.0;
  }
  setTime(seconds: number): void {
    this.mat.uniforms.uTime.value = seconds;
  }
}
