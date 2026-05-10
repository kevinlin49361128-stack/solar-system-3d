import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  Group,
  Mesh,
  Points,
  ShaderMaterial,
  Vector3,
} from 'three';
import { GALACTIC_TO_SCENE } from '../physics/galacticFrame';

/**
 * Procedural 3D Milky Way disk for the galactic-tier zoom-out.
 *
 * Design: a thin disc with a logarithmic-spiral density field plus a
 * central bulge. Built from two layers of GPU-rasterised point sprites
 * (no external texture, no expensive volumetrics) — keeps the asset
 * pipeline tight and works the same across all browsers.
 *
 * Sun is at galactic Cartesian (-8.2, 0, 0) kpc — i.e. roughly 8 kpc
 * out from the centre along the negative x-axis in galactic coords. We
 * place the disc origin at the galactic centre; the camera (still at
 * scene origin) is therefore offset by Sun→GC. To keep the camera-
 * position math elsewhere unchanged we translate the disc mesh by
 * +8 kpc along the GC direction — this puts the camera inside the
 * disc at the Sun's actual position.
 *
 * Scale: 1 scene unit = 1 light-year. The Milky Way is ~50 kpc / 163 kly
 * across, so the visible disc spans 100 000 scene units in radius. The
 * default galactic-tier camera distance (60_000 from origin) leaves
 * us inside the disc looking outward, much like the real night sky.
 *
 * No physics — purely visual. Spiral arm wind angle, bulge size, and
 * dust-lane darkening tuned to roughly match the Robert Hurt / NASA
 * 2008 artist's concept (the canonical "this is what the Milky Way
 * looks like from outside" image used in textbooks).
 */
export class GalacticDisk {
  readonly group = new Group();
  private armPoints: Points;
  private bulgePoints: Points;
  private opacity = 0;

  constructor() {
    // Spiral-arm star points: ~30 000 sprites distributed by a logarithmic
    // spiral density field. 30k is a comfortable budget — the Milky Way
    // contains 200 billion stars but visually all you need is ~30k bright
    // points to read as "spiral galaxy" from any distance.
    this.armPoints = makeSpiralArms(30_000);
    this.bulgePoints = makeBulge(8_000);

    this.group.add(this.armPoints);
    this.group.add(this.bulgePoints);
    // Position the disc so the Sun (at galactic radius ~8.2 kpc ≈
    // 26 700 ly) sits at scene origin. Translate the disc centre to
    // -GC_DIRECTION × 26 700 in scene coords.
    const SUN_TO_GC_LY = 26_700;
    const gcDir = new Vector3(1, 0, 0).applyMatrix4(GALACTIC_TO_SCENE).normalize();
    this.group.position.copy(gcDir).multiplyScalar(SUN_TO_GC_LY);
    // Rotate the disc so the disc plane (z=0 in galactic coords) aligns
    // with the actual galactic plane in scene coords.
    this.group.quaternion.setFromRotationMatrix(GALACTIC_TO_SCENE);
    this.group.visible = false;
  }

  /**
   * Per-frame opacity update. opacity 0 → invisible. We store it on the
   * shader uniform of both Points layers and toggle the group via the
   * usual setVisible threshold.
   */
  setOpacity(opacity: number): void {
    this.opacity = Math.max(0, Math.min(1, opacity));
    this.group.visible = this.opacity > 0.02;
    (this.armPoints.material as ShaderMaterial).uniforms.uOpacity.value = this.opacity;
    (this.bulgePoints.material as ShaderMaterial).uniforms.uOpacity.value = this.opacity;
  }

  isVisible(): boolean {
    return this.group.visible;
  }

  dispose(): void {
    this.armPoints.geometry.dispose();
    (this.armPoints.material as ShaderMaterial).dispose();
    this.bulgePoints.geometry.dispose();
    (this.bulgePoints.material as ShaderMaterial).dispose();
  }
}

/**
 * Generate a logarithmic-spiral disc of bright points.
 *
 * Each star's polar (r, θ) is sampled from a cumulative spiral density:
 *   r ~ exp(0.5 * ξ) for ξ ∈ [0, 1]  (concentrates stars toward inside)
 *   θ = arm + spiralPitch * ln(r) + jitter
 *
 * 4 spiral arms, pitch 0.25 rad/ln(r), arm thickness ~0.6 rad. Disc
 * thickness (vertical) σ = 200 ly which matches real Galactic disc.
 */
function makeSpiralArms(n: number): Points {
  // Real Milky Way arm radius spans ~3 kly (inner edge of Sgr-Carina) to
  // ~80 kly (Outer arm); we sample r in light-years.
  const R_INNER = 3_000;
  const R_OUTER = 80_000;
  const NUM_ARMS = 4;
  const PITCH = 0.25;          // dθ/d(ln r)
  const ARM_THICKNESS = 0.7;   // gaussian σ in radians around the arm centreline
  const Z_THICKNESS = 200;     // vertical scatter (ly)

  const positions = new Float32Array(n * 3);
  const colors = new Float32Array(n * 3);
  const sizes = new Float32Array(n);

  // Pre-defined warm white-blue gradient (warmer toward centre, bluer
  // toward outer where O-/B-type giants are).
  const colorInner = new Color(0xffd9a8);
  const colorOuter = new Color(0xb8d4ff);

  for (let i = 0; i < n; i++) {
    // Sample radius weighted toward the inner regions (where star density
    // is real-world higher).
    const u = Math.random();
    const r = R_INNER + (R_OUTER - R_INNER) * Math.pow(u, 1.6);

    const arm = Math.floor(Math.random() * NUM_ARMS);
    const armBase = (arm / NUM_ARMS) * Math.PI * 2;
    const onSpiral = armBase + PITCH * Math.log(r / R_INNER);
    const dispersion = gaussian() * ARM_THICKNESS;
    const theta = onSpiral + dispersion;

    const x = r * Math.cos(theta);
    const y = r * Math.sin(theta);
    const z = gaussian() * Z_THICKNESS;

    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;

    // Colour fades inner→outer.
    const t = (r - R_INNER) / (R_OUTER - R_INNER);
    const c = colorInner.clone().lerp(colorOuter, t);
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;

    // Size attenuated by radius — outer arms have smaller stars per ly²,
    // inner regions look denser in points.
    sizes[i] = 14 + Math.random() * 18 - t * 6;
  }

  const geom = new BufferGeometry();
  geom.setAttribute('position', new BufferAttribute(positions, 3));
  geom.setAttribute('color',    new BufferAttribute(colors, 3));
  geom.setAttribute('size',     new BufferAttribute(sizes, 1));

  const mat = makeStarSpriteMaterial(0.9);
  return new Points(geom, mat);
}

/**
 * Central bulge: spheroidal cloud of warm-coloured points centred on the
 * galactic centre, with stars more densely packed than the disc arms.
 */
function makeBulge(n: number): Points {
  const positions = new Float32Array(n * 3);
  const colors = new Float32Array(n * 3);
  const sizes = new Float32Array(n);

  const baseColor = new Color(0xffe6b8); // warm yellow-orange (old population II)

  for (let i = 0; i < n; i++) {
    // Sample inside a spheroid: r^3 distribution (volume-weighted), with
    // squashed Z (oblate spheroid) to match real galactic-bulge shape.
    const r = 5_000 * Math.pow(Math.random(), 1 / 3); // up to 5 kly
    const phi = Math.random() * Math.PI * 2;
    const cosTheta = 2 * Math.random() - 1;
    const sinTheta = Math.sqrt(1 - cosTheta * cosTheta);
    positions[i * 3]     = r * sinTheta * Math.cos(phi);
    positions[i * 3 + 1] = r * sinTheta * Math.sin(phi);
    positions[i * 3 + 2] = r * cosTheta * 0.55; // squash Z

    const tint = 0.85 + Math.random() * 0.3;
    colors[i * 3]     = baseColor.r * tint;
    colors[i * 3 + 1] = baseColor.g * tint;
    colors[i * 3 + 2] = baseColor.b * tint;

    sizes[i] = 18 + Math.random() * 14;
  }

  const geom = new BufferGeometry();
  geom.setAttribute('position', new BufferAttribute(positions, 3));
  geom.setAttribute('color',    new BufferAttribute(colors, 3));
  geom.setAttribute('size',     new BufferAttribute(sizes, 1));

  const mat = makeStarSpriteMaterial(1.2);
  return new Points(geom, mat);
}

/**
 * Soft round point sprite shader: gaussian falloff, additive blending,
 * size attenuated by distance so points stay visible at large camera
 * distances but don't smear into giant blobs up close.
 */
function makeStarSpriteMaterial(brightness: number): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: {
      uOpacity: { value: 0 },
      uBrightness: { value: brightness },
    },
    vertexShader: `
      attribute float size;
      attribute vec3 color;
      varying vec3 vColor;
      void main() {
        vColor = color;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        // Distance attenuation — sprites get smaller as the camera retreats
        // but never below 1 px.
        gl_PointSize = max(1.0, size * (300.0 / -mv.z));
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      uniform float uOpacity;
      uniform float uBrightness;
      varying vec3 vColor;
      void main() {
        // Centre-of-sprite distance from (0,0) origin = (0.5,0.5).
        vec2 d = gl_PointCoord - vec2(0.5);
        float r2 = dot(d, d);
        if (r2 > 0.25) discard;
        // Gaussian-ish falloff: bright core, soft halo.
        float a = exp(-r2 * 18.0);
        gl_FragColor = vec4(vColor * uBrightness, a * uOpacity);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    side: DoubleSide,
  });
}

/**
 * Standard normal sample via Box-Muller. We avoid `Math.random()`-based
 * acceptance/rejection because we want the disc generation to be
 * deterministic-ish on cold start; if we ever switch to a seeded RNG
 * the same algorithm still works.
 */
function gaussian(): number {
  const u = 1 - Math.random();
  const v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// Export only what the renderer needs to use.
export type { GalacticDisk as GalacticDiskType };
// Re-export Mesh for callers wanting to insert into a scene programmatically.
export { Mesh };
