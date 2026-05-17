import {
  AdditiveBlending, BufferAttribute, BufferGeometry,
  Points, ShaderMaterial, Vector3,
} from 'three';
import { raDecToEcliptic } from '../physics/topocentric';
import { eclipticToScene } from '../physics/frame';

const DOME_RADIUS = 4000;

/**
 * Sharpless 2 (Sh2) emission-nebula catalog — 313 Hα-bright HII
 * regions catalogued by Sharpless in 1959. Sweet spot for the smart-
 * telescope crowd: most Sh2 objects are invisible to the eye even
 * through 10" Dob in a dark site (mean surface brightness ≈ 22
 * mag/arcsec²) but stack out in 30 min through an Optolong L-eXtreme
 * narrowband filter on a Seestar / Vespera.
 *
 * Data: `public/sharpless2.json`, packed tuples
 *   [id, raHours, decDeg, diameterArcmin, brightnessClass, formClass]
 * where brightnessClass is 1 (faintest) → 3 (brightest) per Sharpless.
 *
 * Rendering: a single Points cloud with a faint pink/red shader,
 * brightness scaled by Sh class, size scaled by catalog diameter
 * (clamped — Sh2-7 is 4° across; we'd never want a 4° point sprite).
 * Opt-in via a Realism toggle so the default DSO view (Messier + NGC
 * curated) stays uncluttered.
 *
 * Lazy-loaded: load() fetches the JSON only on first request. While
 * the toggle is off the object isn't downloaded at all.
 */
export class SharplessLayer {
  readonly object: Points;
  private mat: ShaderMaterial;
  private loaded = false;
  private loading: Promise<void> | null = null;

  constructor() {
    const geom = new BufferGeometry();
    // Start empty; load() populates on demand.
    geom.setAttribute('position', new BufferAttribute(new Float32Array(0), 3));
    geom.setAttribute('aBright',  new BufferAttribute(new Float32Array(0), 1));
    geom.setAttribute('aSize',    new BufferAttribute(new Float32Array(0), 1));
    this.mat = new ShaderMaterial({
      uniforms: {
        uOpacity: { value: 0 },
      },
      vertexShader: `
        attribute float aBright;   // 1..3 from Sharpless's brightness class
        attribute float aSize;     // pixel size pre-attenuation
        varying float vBright;
        void main() {
          vBright = aBright;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          // Distance attenuation: closer parts of the celestial dome
          // get bigger sprites. Since all DSOs sit on the dome at the
          // same radius this collapses to a near-constant per-frame
          // size, but the form is kept generic for FOV-driven scale.
          gl_PointSize = max(2.0, aSize * (180.0 / -mv.z));
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: `
        uniform float uOpacity;
        varying float vBright;
        void main() {
          vec2 d = gl_PointCoord - vec2(0.5);
          float r2 = dot(d, d);
          if (r2 > 0.25) discard;
          // Smooth radial falloff for diffuse nebula look.
          float a = exp(-r2 * 14.0);
          // Sharpless brightness 1..3 → 0.4..1.0 luminance scaling.
          float b = 0.4 + 0.3 * (vBright - 1.0);
          // Hα pink/red: emission nebulae glow at 656 nm so the dominant
          // colour is red. The +0.5 green / +0.7 blue baseline keeps
          // them visibly pinker than solid red, matching how they
          // appear in stacked smart-scope captures.
          vec3 c = vec3(1.0 * b, 0.42 * b, 0.55 * b);
          gl_FragColor = vec4(c, a * uOpacity);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    });
    this.object = new Points(geom, this.mat);
    this.object.frustumCulled = false;
    this.object.renderOrder = -3;  // behind Messier (-2-ish) so they don't overdraw
    this.object.visible = false;
  }

  /** Fetch + parse the Sh2 JSON. Idempotent. */
  async load(url = '/sharpless2.json'): Promise<void> {
    if (this.loaded) return;
    if (this.loading) return this.loading;
    this.loading = (async () => {
      const r = await fetch(url);
      if (!r.ok) throw new Error(`Sharpless 2 fetch failed: ${r.status}`);
      const data: Array<[number, number, number, number, number, number]> = await r.json();

      const n = data.length;
      const positions = new Float32Array(n * 3);
      const brights = new Float32Array(n);
      const sizes = new Float32Array(n);

      const v = new Vector3();
      for (let i = 0; i < n; i++) {
        const [, raH, decD, diamArcmin, bright] = data[i];
        const dir = raDecToEcliptic(raH, decD);
        v.copy(eclipticToScene(dir)).multiplyScalar(DOME_RADIUS);
        positions[i * 3]     = v.x;
        positions[i * 3 + 1] = v.y;
        positions[i * 3 + 2] = v.z;
        // Size scales with sqrt(diam) for visual variety without letting
        // the 4°-across Sh2-7 dominate the view. Clamped to a sensible
        // range so smart-scope users planning targets can still spot
        // the small ones.
        const d = Math.min(120, Math.max(2, diamArcmin));
        sizes[i] = 14 + Math.sqrt(d) * 4;
        brights[i] = bright;
      }
      const geom = this.object.geometry;
      geom.setAttribute('position', new BufferAttribute(positions, 3));
      geom.setAttribute('aBright',  new BufferAttribute(brights, 1));
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
}
