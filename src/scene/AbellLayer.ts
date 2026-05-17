import {
  AdditiveBlending, BufferAttribute, BufferGeometry,
  Points, ShaderMaterial, Vector3,
} from 'three';
import { raDecToEcliptic } from '../physics/topocentric';
import { eclipticToScene } from '../physics/frame';

const DOME_RADIUS = 4000;

/**
 * Abell rich-galaxy-cluster catalogue layer — 2 712 entries from
 * VizieR VII/110A (Abell + Corwin + Olowin 1989). The "deep-imaging
 * Mt Everest" of the smart-telescope era: most clusters are red-
 * shifted mag 15–18, but their 10–30 arcmin diameters fit a Seestar
 * S50's FOV beautifully and stack into recognisable galaxy fields
 * after a few hours of Hα + R + G + B sub exposures.
 *
 * Visual treatment: tiny faint cyan-purple dots scaled by richness
 * class (0=poorest → 5=richest). Distance class drives a slight
 * size attenuation — closer clusters get bigger sprites because
 * their constituent galaxies span a larger angle.
 *
 * Tuple shape from public/abell-clusters.json:
 *   [aclo, raHours, decDeg, distClass, richness, count]
 *
 * Lazy-loaded — the layer mounts but doesn't fetch until the
 * Realism toggle is turned on. Same pattern as SharplessLayer +
 * NGCFullLayer.
 */
export class AbellLayer {
  readonly object: Points;
  private mat: ShaderMaterial;
  private loaded = false;
  private loading: Promise<void> | null = null;
  private rawData: Array<[number, number, number, number, number, number]> = [];

  constructor() {
    const geom = new BufferGeometry();
    geom.setAttribute('position', new BufferAttribute(new Float32Array(0), 3));
    geom.setAttribute('aSize',    new BufferAttribute(new Float32Array(0), 1));
    geom.setAttribute('aBright',  new BufferAttribute(new Float32Array(0), 1));
    this.mat = new ShaderMaterial({
      uniforms: { uOpacity: { value: 0 } },
      vertexShader: `
        attribute float aSize;
        attribute float aBright;
        varying float vBright;
        void main() {
          vBright = aBright;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = max(1.0, aSize);
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
          float a = exp(-r2 * 24.0);
          // Cool blue-purple — galaxy-cluster baseline is heavily redshifted
          // distant light; the visual convention is to render them in cool
          // colours to distinguish from the warm Hα Sharpless layer.
          vec3 c = vec3(0.55 * vBright, 0.50 * vBright, 0.85 * vBright);
          gl_FragColor = vec4(c, a * uOpacity);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    });
    this.object = new Points(geom, this.mat);
    this.object.frustumCulled = false;
    this.object.renderOrder = -5;  // deepest of the DSO layers
    this.object.visible = false;
  }

  async load(url = '/abell-clusters.json'): Promise<void> {
    if (this.loaded) return;
    if (this.loading) return this.loading;
    this.loading = (async () => {
      const r = await fetch(url);
      if (!r.ok) throw new Error(`Abell fetch failed: ${r.status}`);
      const data: Array<[number, number, number, number, number, number]> = await r.json();
      this.rawData = data;
      const n = data.length;
      const positions = new Float32Array(n * 3);
      const sizes     = new Float32Array(n);
      const brights   = new Float32Array(n);
      const v = new Vector3();
      for (let i = 0; i < n; i++) {
        const [, raH, decD, distClass, richness] = data[i];
        const dir = raDecToEcliptic(raH, decD);
        v.copy(eclipticToScene(dir)).multiplyScalar(DOME_RADIUS);
        positions[i * 3]     = v.x;
        positions[i * 3 + 1] = v.y;
        positions[i * 3 + 2] = v.z;
        // Size: closer clusters (lower distClass) → bigger sprite.
        // distClass ranges 1..7. Range 2 (closer) → 4 px, range 7 → 2 px.
        const distFactor = distClass > 0 ? Math.max(2, 5 - (distClass - 1) * 0.5) : 2.5;
        sizes[i] = distFactor;
        // Brightness: richness 0..5 → 0.3..0.9.
        brights[i] = 0.3 + Math.min(richness, 5) * 0.12;
      }
      const geom = this.object.geometry;
      geom.setAttribute('position', new BufferAttribute(positions, 3));
      geom.setAttribute('aSize',    new BufferAttribute(sizes, 1));
      geom.setAttribute('aBright',  new BufferAttribute(brights, 1));
      this.loaded = true;
    })();
    try { await this.loading; } finally { this.loading = null; }
  }

  setOpacity(o: number): void {
    const c = Math.max(0, Math.min(1, o));
    this.mat.uniforms.uOpacity.value = c;
    this.object.visible = c > 0.02 && this.loaded;
  }

  isLoaded(): boolean { return this.loaded; }
  getRawData(): Array<[number, number, number, number, number, number]> {
    return this.rawData;
  }
}
