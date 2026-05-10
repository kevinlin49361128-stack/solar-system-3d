import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  Points,
  ShaderMaterial,
} from 'three';

/**
 * HYG 3D star cloud — the local stellar neighbourhood for the
 * neighbourhood-tier zoom-out.
 *
 * The data file (`stars-hyg-3d.json`) is built from the upstream
 * HYG v4.1 database via `scripts/build-hyg-3d.mjs`. Each entry is a
 * 5-tuple `[xLy, yLy, zLy, mag, packedColor]` in equatorial Cartesian
 * light-years. Origin = Sun.
 *
 * Render strategy: a single `Points` cloud with a soft round sprite,
 * additive blending, and per-vertex colour + size. Sprite size is
 * driven by apparent magnitude (brighter stars are larger) with mild
 * distance attenuation so close stars look like distinct points and
 * the far-field reads as a textured Milky Way background.
 *
 * Lazy-loaded: the data file is only fetched when `load()` is called,
 * which the scale-tier controller does on first transition to the
 * neighbourhood tier. Default behaviour at the system tier is "cloud
 * doesn't exist yet, draw nothing".
 */
type HygTuple = [number, number, number, number, number];

export class HygCloud {
  readonly group = new Points();
  private mat: ShaderMaterial;
  private loaded = false;
  private loading: Promise<void> | null = null;

  constructor() {
    this.mat = new ShaderMaterial({
      uniforms: {
        uOpacity: { value: 0 },
        uPixelRatio: { value: typeof window !== 'undefined' ? window.devicePixelRatio : 1 },
      },
      vertexShader: /* glsl */`
        attribute float starSize;
        attribute vec3 starColor;
        varying vec3 vColor;
        uniform float uPixelRatio;
        void main() {
          vColor = starColor;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          // Magnitude-based sprite size with mild perspective shrink.
          // 600 / -mv.z keeps a 25-ly-distant 1st-magnitude star at
          // about 6 px on a 1200 px viewport.
          gl_PointSize = max(1.0, starSize * uPixelRatio * (600.0 / max(-mv.z, 1.0)));
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */`
        uniform float uOpacity;
        varying vec3 vColor;
        void main() {
          vec2 d = gl_PointCoord - vec2(0.5);
          float r2 = dot(d, d);
          if (r2 > 0.25) discard;
          float a = exp(-r2 * 16.0);
          gl_FragColor = vec4(vColor, a * uOpacity);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    });
    this.group.material = this.mat;
    this.group.frustumCulled = false;
    this.group.visible = false;
  }

  /**
   * Fetch and parse `public/stars-hyg-3d.json`. Idempotent — calling
   * twice is safe; the second call resolves immediately.
   */
  load(url = '/stars-hyg-3d.json'): Promise<void> {
    if (this.loaded) return Promise.resolve();
    if (this.loading) return this.loading;
    this.loading = (async () => {
      const r = await fetch(url);
      if (!r.ok) throw new Error(`HYG 3D fetch failed: ${r.status}`);
      const data: HygTuple[] = await r.json();

      const n = data.length;
      const positions = new Float32Array(n * 3);
      const colors = new Float32Array(n * 3);
      const sizes = new Float32Array(n);

      const tmpColor = new Color();
      for (let i = 0; i < n; i++) {
        const [x, y, z, mag, packed] = data[i];
        positions[i * 3] = x;
        positions[i * 3 + 1] = y;
        positions[i * 3 + 2] = z;
        tmpColor.setHex(packed);
        colors[i * 3] = tmpColor.r;
        colors[i * 3 + 1] = tmpColor.g;
        colors[i * 3 + 2] = tmpColor.b;
        // Sprite size in (pixels × ly / scene-unit). We invert mag so
        // brighter (smaller mag value) → bigger sprite. mag=0 → 12 px
        // base, mag=7 → ~3 px. The vertex shader applies further
        // distance attenuation.
        sizes[i] = Math.max(1.5, 12 - mag * 1.3);
      }

      const geom = new BufferGeometry();
      geom.setAttribute('position', new BufferAttribute(positions, 3));
      geom.setAttribute('starColor', new BufferAttribute(colors, 3));
      geom.setAttribute('starSize',  new BufferAttribute(sizes, 1));
      this.group.geometry = geom;
      this.loaded = true;
    })();
    return this.loading;
  }

  /** Per-frame opacity. opacity ≤ 0.02 → group invisible. */
  setOpacity(opacity: number): void {
    const o = Math.max(0, Math.min(1, opacity));
    this.mat.uniforms.uOpacity.value = o;
    this.group.visible = o > 0.02 && this.loaded;
  }

  isLoaded(): boolean { return this.loaded; }
}
