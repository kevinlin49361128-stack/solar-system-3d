import {
  AdditiveBlending, BufferAttribute, BufferGeometry,
  Points, ShaderMaterial, Vector3,
} from 'three';
import { raDecToEcliptic } from '../physics/topocentric';
import { eclipticToScene } from '../physics/frame';

const DOME_RADIUS = 4000;

/**
 * Full NGC + IC catalogue layer — ~11 000 entries from OpenNGC v2,
 * excluding the ~50 curated NGC objects already in `src/data/ngc.ts`
 * (which have trilingual names + dedicated InfoPanel paths) and all
 * Messier cross-references (rendered by MessierLayer with type-specific
 * atlas sprites).
 *
 * Why a separate layer instead of merging into MessierLayer:
 *   - MessierLayer's per-object atlas tile + colour pipeline is
 *     overkill for the bulk: every NGC galaxy looks visually identical
 *     anyway. A flat per-type tint is plenty.
 *   - Lazy-load: NGC is opt-in (~445 KB) for the smart-scope crowd
 *     and skipped by everyone else.
 *   - Cleaner code: MessierLayer's atlas + per-type colour assignment
 *     stays focused on the curated 110+50 entries.
 *
 * Each NGC/IC entry is rendered as a single small point with a
 * type-based colour (galaxies blue-grey, planetaries cyan-green, etc.)
 * and brightness scaled by visual magnitude. Sizes are uniform
 * (3–4 px) — distinct objects, not the diffuse Hα blobs of Sharpless.
 *
 * Picking isn't wired in this commit; the layer is render-only for
 * v0.5. A future enhancement could project the click to the nearest
 * point in this cloud and open an InfoPanel for "NGC 1234, mag 13.2,
 * Galaxy".
 *
 * Data tuple from public/ngc-full.json:
 *   [idShort, raHours, decDeg, mag, typeIdx, majorArcmin, minorArcmin]
 * idShort > 0 → NGC; idShort < 0 → IC (sign-encoded).
 */

const TYPE_COLOR: Array<[number, number, number]> = [
  [0.65, 0.75, 1.00],  // 0 = Galaxy → soft blue-white
  [0.95, 0.85, 0.65],  // 1 = Globular cluster → warm gold
  [0.95, 0.95, 0.95],  // 2 = Open cluster → white
  [0.95, 0.55, 0.65],  // 3 = Nebula → pink (Hα)
  [0.55, 0.95, 0.85],  // 4 = Planetary nebula → cyan-green
  [1.00, 0.60, 0.55],  // 5 = SNR → red
];

export class NGCFullLayer {
  readonly object: Points;
  private mat: ShaderMaterial;
  private loaded = false;
  private loading: Promise<void> | null = null;

  constructor() {
    const geom = new BufferGeometry();
    geom.setAttribute('position', new BufferAttribute(new Float32Array(0), 3));
    geom.setAttribute('aColor',   new BufferAttribute(new Float32Array(0), 3));
    geom.setAttribute('aSize',    new BufferAttribute(new Float32Array(0), 1));
    this.mat = new ShaderMaterial({
      uniforms: { uOpacity: { value: 0 } },
      vertexShader: `
        attribute vec3 aColor;
        attribute float aSize;
        varying vec3 vColor;
        void main() {
          vColor = aColor;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = max(1.0, aSize);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: `
        uniform float uOpacity;
        varying vec3 vColor;
        void main() {
          // Slightly soft circular sprite — distinct from the diffuse
          // Sharpless / Messier blobs, more like a dim catalogue marker.
          vec2 d = gl_PointCoord - vec2(0.5);
          float r2 = dot(d, d);
          if (r2 > 0.25) discard;
          float a = exp(-r2 * 22.0);
          gl_FragColor = vec4(vColor, a * uOpacity);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    });
    this.object = new Points(geom, this.mat);
    this.object.frustumCulled = false;
    this.object.renderOrder = -4;  // behind Messier (-2) + Sharpless (-3)
    this.object.visible = false;
  }

  async load(url = '/ngc-full.json'): Promise<void> {
    if (this.loaded) return;
    if (this.loading) return this.loading;
    this.loading = (async () => {
      const r = await fetch(url);
      if (!r.ok) throw new Error(`NGC full fetch failed: ${r.status}`);
      const data: Array<[number, number, number, number, number, number, number]> = await r.json();
      this.rawData = data;

      const n = data.length;
      const positions = new Float32Array(n * 3);
      const colors    = new Float32Array(n * 3);
      const sizes     = new Float32Array(n);

      const v = new Vector3();
      for (let i = 0; i < n; i++) {
        const [, raH, decD, mag, typeIdx] = data[i];
        const dir = raDecToEcliptic(raH, decD);
        v.copy(eclipticToScene(dir)).multiplyScalar(DOME_RADIUS);
        positions[i * 3]     = v.x;
        positions[i * 3 + 1] = v.y;
        positions[i * 3 + 2] = v.z;

        const [cr, cg, cb] = TYPE_COLOR[typeIdx] ?? TYPE_COLOR[0];
        // Brightness modulation: mag 6 → 1.0 luminance, mag 14 → 0.25.
        const lum = Math.max(0.15, Math.min(1.0, 1.4 - (mag - 6) * 0.15));
        colors[i * 3]     = cr * lum;
        colors[i * 3 + 1] = cg * lum;
        colors[i * 3 + 2] = cb * lum;

        // Sizes 2.5 – 4 px so the bulk catalogue reads as a dense
        // background sprinkle, not competing with the named DSO sprites.
        sizes[i] = Math.max(2.5, 4.5 - (mag - 8) * 0.15);
      }

      const geom = this.object.geometry;
      geom.setAttribute('position', new BufferAttribute(positions, 3));
      geom.setAttribute('aColor',   new BufferAttribute(colors, 3));
      geom.setAttribute('aSize',    new BufferAttribute(sizes, 1));
      this.loaded = true;
    })();
    try {
      await this.loading;
    } finally {
      this.loading = null;
    }
  }

  setOpacity(o: number): void {
    const c = Math.max(0, Math.min(1, o));
    this.mat.uniforms.uOpacity.value = c;
    this.object.visible = c > 0.02 && this.loaded;
  }

  isLoaded(): boolean { return this.loaded; }

  /**
   * Cached raw rows for screen-space picking. Tuple shape:
   *   [idShort, raHours, decDeg, mag, typeIdx, majorArcmin, minorArcmin]
   * idShort > 0 → NGC; < 0 → IC (sign-encoded).
   */
  private rawData: Array<[number, number, number, number, number, number, number]> = [];
  getRawData(): Array<[number, number, number, number, number, number, number]> {
    return this.rawData;
  }
}
