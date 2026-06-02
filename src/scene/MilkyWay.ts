import {
  AdditiveBlending,
  BackSide,
  CanvasTexture,
  ClampToEdgeWrapping,
  LinearFilter,
  Matrix4,
  Mesh,
  ShaderMaterial,
  SphereGeometry,
  SRGBColorSpace,
  Texture,
  TextureLoader,
  Vector3,
} from 'three';
import {
  GALACTIC_CENTRE_SCENE,
  GALACTIC_NP_SCENE,
} from '../physics/galacticFrame';

const DOME_RADIUS = 4200; // just outside DSO/star sphere (4000)

/**
 * Quaternion that rotates the Milky Way mesh's local frame
 *   (mesh +X = galactic centre, mesh +Y = galactic NP, mesh +Z = l=90°)
 * into scene coordinates.
 *
 * We build it from the IAU-derived galactic-centre and galactic-NP unit
 * vectors (in scene frame) instead of guessing Euler angles. The mesh's
 * local +Z is then determined by mesh +X × mesh +Y (right-hand rule).
 *
 * Replaces the old `mesh.rotation.set(0.515, 1.082, 0.345) // empirically
 * aligned` magic numbers with a derivation that's traceable back to the
 * Hipparcos catalogue (ESA SP-1200 vol. 1 §1.5.3).
 */
function buildGalacticToSceneBasis(): Matrix4 {
  const xAxis = GALACTIC_CENTRE_SCENE.clone();
  const yAxis = GALACTIC_NP_SCENE.clone();
  const zAxis = new Vector3().crossVectors(xAxis, yAxis).normalize();
  return new Matrix4().makeBasis(xAxis, yAxis, zAxis);
}

/**
 * Faint Milky Way band. Drawn as the inside of a dome that's additively
 * blended with the background stars.
 *
 * Texture: ESO Brunier 360° panorama (CC BY 4.0), 4K equirectangular in
 * galactic coordinates with l=0 at u=0.5 and b=0 at v=0.5. Replaces the
 * earlier procedural Gaussian-noise approximation — real Cygnus rift,
 * Coalsack, Carina nebula, and galactic-centre bulge are now visible at
 * scientifically correct positions.
 *
 * Procedural fallback (`buildMilkyWayTexture`) is kept for offline /
 * texture-failed cases; it loads instantly while the photo fetches and
 * is replaced once the JPG resolves.
 *
 * Galactic plane orientation derived from the IAU galactic-NP / galactic-
 * centre unit vectors (see `physics/galacticFrame.ts`).
 *
 * Toggleable via `setVisible`; opacity scales with Bortle so light
 * pollution fades the Milky Way to invisibility (matching real urban
 * observation).
 */
export class MilkyWay {
  readonly mesh: Mesh;
  private mat: ShaderMaterial;
  private fallbackTex: Texture;

  constructor() {
    // Show procedural fallback immediately so first paint isn't empty,
    // then swap in the high-quality ESO panorama once it's loaded.
    this.fallbackTex = buildMilkyWayTexture();
    const tex: Texture = this.fallbackTex;
    this.loadPhotographicTexture();

    const geom = new SphereGeometry(DOME_RADIUS, 96, 64);

    this.mat = new ShaderMaterial({
      uniforms: {
        uTex:     { value: tex },
        uOpacity: { value: 1.0 },
        uBortle:  { value: 4.0 },
        uIsPhoto: { value: 0.0 }, // 1.0 once ESO photo loaded
      },
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      side: BackSide,
      vertexShader: `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D uTex;
        uniform float uOpacity;
        uniform float uBortle;
        uniform float uIsPhoto;
        varying vec3 vDir;

        void main() {
          // Equirectangular UV from direction. The texture is laid out in
          // galactic l/b — the mesh quaternion rotates so vDir is in the
          // galactic frame.
          float u = atan(vDir.z, vDir.x) / 6.28318530718 + 0.5;
          float v = asin(clamp(vDir.y, -1.0, 1.0)) / 3.14159265359 + 0.5;
          vec4 c = texture2D(uTex, vec2(u, v));
          // Light pollution kills the Milky Way visually; fade with Bortle.
          float bortleFade = clamp(1.0 - (uBortle - 1.0) / 6.0, 0.0, 1.0);
          // Photographic textures are opaque (a=1). Convert luminance to
          // alpha so dark off-band regions don't add to the night sky and
          // bright Sgr A / Cygnus regions stand out. Squaring brings the
          // mid-band into a more naturalistic apparent brightness.
          // Procedural fallback already has alpha — pass it through.
          float lum = dot(c.rgb, vec3(0.299, 0.587, 0.114));
          float photoA = lum * lum * 0.55;
          float a = mix(c.a, photoA, uIsPhoto) * uOpacity * bortleFade;
          gl_FragColor = vec4(c.rgb, a);
        }
      `,
    });
    this.mesh = new Mesh(geom, this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -200; // behind stars
    this.mesh.visible = false;
    // Orient the dome so the band aligns with the *real* galactic equator in
    // scene coordinates. Built from the IAU galactic-centre and galactic-NP
    // unit vectors — fixes the previous magic-Euler rotation that was off
    // by a couple of degrees and didn't match real Milky Way photographs.
    this.mesh.quaternion.setFromRotationMatrix(buildGalacticToSceneBasis());
  }

  setOpacity(o: number): void {
    this.mat.uniforms.uOpacity.value = o;
  }
  setBortle(b: number): void {
    this.mat.uniforms.uBortle.value = Math.max(1, Math.min(9, b));
  }
  setVisible(v: boolean): void {
    this.mesh.visible = v;
  }

  /**
   * Asynchronously fetch the ESO photographic panorama and swap it in.
   * The procedural texture is shown until this resolves (typically <300 ms
   * over a fast connection, ~1 s on cellular). On failure we silently
   * keep the procedural fallback — visually similar enough that the user
   * shouldn't notice.
   */
  private loadPhotographicTexture(): void {
    new TextureLoader().load(
      '/textures/milkyway-eso-4k.webp',
      (loaded) => {
        loaded.colorSpace = SRGBColorSpace;
        loaded.wrapS = ClampToEdgeWrapping;
        loaded.wrapT = ClampToEdgeWrapping;
        loaded.minFilter = LinearFilter;
        loaded.magFilter = LinearFilter;
        // Swap the uniform; the old procedural texture is no longer needed.
        this.mat.uniforms.uTex.value = loaded;
        this.mat.uniforms.uIsPhoto.value = 1.0;
        this.mat.uniformsNeedUpdate = true;
        this.fallbackTex.dispose();
      },
      undefined,
      () => {
        // Silently keep procedural fallback on failure.
      },
    );
  }
}

/**
 * Build a 2048×1024 equirectangular Milky Way texture. Centre column is the
 * galactic centre (Sagittarius bulge); v=0.5 is the galactic equator.
 */
function buildMilkyWayTexture(): CanvasTexture {
  const W = 2048, H = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = 'rgba(0,0,0,0)';
  ctx.fillRect(0, 0, W, H);

  // Main band: stack of vertically-narrow Gaussian gradients across the
  // image, with a brighter region near galactic centre (centre column).
  const img = ctx.createImageData(W, H);
  const rng = mulberry32(91);
  // Pre-sample some "dark cloud" centres along the band for dust lanes.
  const dustCount = 90;
  const dust: { u: number; v: number; r: number; s: number }[] = [];
  for (let i = 0; i < dustCount; i++) {
    dust.push({
      u: rng(),
      v: 0.5 + (rng() - 0.5) * 0.22,
      r: 0.012 + rng() * 0.04,
      s: 0.4 + rng() * 0.5,
    });
  }
  // Bright knots (HII regions, star clouds)
  const knots: { u: number; v: number; r: number; s: number }[] = [];
  for (let i = 0; i < 25; i++) {
    knots.push({
      u: rng(),
      v: 0.5 + (rng() - 0.5) * 0.10,
      r: 0.008 + rng() * 0.02,
      s: 0.6 + rng() * 0.6,
    });
  }

  for (let y = 0; y < H; y++) {
    const v = y / H;            // 0..1, 0.5 = galactic equator
    const dy = (v - 0.5);
    // Two-component band: a wide diffuse Gaussian + a narrow bright core.
    const wide = Math.exp(-Math.pow(dy / 0.18, 2.0));
    const core = Math.exp(-Math.pow(dy / 0.05, 2.0));
    for (let x = 0; x < W; x++) {
      const u = x / W;
      // Galactic-centre boost: peak around u=0.5.
      const du = Math.min(Math.abs(u - 0.5), 1 - Math.abs(u - 0.5));
      const centerBoost = Math.exp(-Math.pow(du / 0.18, 2.0));
      let intensity = wide * 0.45 + core * 0.85;
      intensity *= 0.55 + 0.95 * centerBoost;

      // Apply dust lanes (subtractive)
      for (const d of dust) {
        const dxu = Math.min(Math.abs(u - d.u), 1 - Math.abs(u - d.u));
        const dist = Math.hypot(dxu, v - d.v);
        if (dist < d.r) {
          const t = 1 - dist / d.r;
          intensity *= 1.0 - d.s * t * t;
        }
      }
      // Apply bright knots (additive)
      let extra = 0;
      for (const k of knots) {
        const dxu = Math.min(Math.abs(u - k.u), 1 - Math.abs(u - k.u));
        const dist = Math.hypot(dxu, v - k.v);
        if (dist < k.r) {
          const t = 1 - dist / k.r;
          extra += k.s * t * t * 0.6;
        }
      }
      intensity = Math.max(0, intensity + extra);

      // Noise grain so it doesn't look like a clean gradient
      const grain = 0.85 + 0.30 * rng();
      intensity *= grain;

      // Slight blue-white tint with warmer galactic-centre region
      const warm = 0.4 * centerBoost;
      const r = intensity * (0.55 + 0.45 * warm);
      const g = intensity * 0.6;
      const b = intensity * (0.95 - 0.30 * warm);
      const a = Math.min(1, intensity * 1.6);

      const idx = (y * W + x) * 4;
      img.data[idx]     = Math.min(255, r * 255);
      img.data[idx + 1] = Math.min(255, g * 255);
      img.data[idx + 2] = Math.min(255, b * 255);
      img.data[idx + 3] = Math.min(255, a * 200);
    }
  }
  ctx.putImageData(img, 0, 0);

  const tex = new CanvasTexture(canvas);
  tex.wrapS = ClampToEdgeWrapping;
  tex.wrapT = ClampToEdgeWrapping;
  tex.minFilter = LinearFilter;
  tex.magFilter = LinearFilter;
  tex.colorSpace = SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6D2B79F5) >>> 0;
    let r = t;
    r = Math.imul(r ^ (r >>> 15), r | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
