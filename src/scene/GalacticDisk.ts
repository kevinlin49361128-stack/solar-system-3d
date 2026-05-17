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
  private hiiPoints: Points;
  private opacity = 0;

  constructor() {
    // Spiral-arm star points: bumped from 30k → 60k in v0.4 so close-in
    // camera angles read as a dense disc instead of a sparse particle
    // cloud. 60k stays comfortable on integrated GPUs (60 fps on M1
    // Air) because the sprite shader is trivial — gaussian falloff in
    // the fragment shader, no per-vertex lighting.
    this.armPoints = makeSpiralArms(60_000);
    // Bulge bumped 8k → 15k. The bulge is the densest visual region
    // of the real galaxy; under-sampling here is the most obvious
    // "pixelated" complaint at close zoom.
    this.bulgePoints = makeBulge(15_000);
    // HII regions — bright pink/red clusters at the real galactic
    // coordinates of famous nebulae (Eta Carinae, Orion, Lagoon,
    // North America etc.). Each is rendered as a dense bunch of
    // ~50 sprites at that position; visually they read as glowing
    // hotspots on the spiral arms, matching the canonical Robert
    // Hurt artist's-conception look.
    this.hiiPoints = makeHiiRegions();

    this.group.add(this.armPoints);
    this.group.add(this.bulgePoints);
    this.group.add(this.hiiPoints);
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
    (this.hiiPoints.material as ShaderMaterial).uniforms.uOpacity.value = this.opacity;
  }

  isVisible(): boolean {
    return this.group.visible;
  }

  dispose(): void {
    this.armPoints.geometry.dispose();
    (this.armPoints.material as ShaderMaterial).dispose();
    this.bulgePoints.geometry.dispose();
    (this.bulgePoints.material as ShaderMaterial).dispose();
    this.hiiPoints.geometry.dispose();
    (this.hiiPoints.material as ShaderMaterial).dispose();
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
 * Famous Milky Way HII / nebula complexes, with real galactic
 * coordinates (l, b in °) and distance in light-years. Each appears
 * as a tight cluster of warm-pink sprites at the listed position so
 * the disc reads as having actual hotspots — Carina arm is bright,
 * Orion spur has a knot, Sgr-Carina has the densest pink/red region
 * near the centre, etc.
 *
 * Sources: NASA Extragalactic Database (NED) summaries cross-checked
 * with WikiSky listings. Distances are rough — the visual difference
 * between 4 kly and 5 kly is invisible at this scale; we just need
 * "near or far" right.
 */
interface HiiRegion {
  /** Galactic longitude °. */ l: number;
  /** Galactic latitude °.  */ b: number;
  /** Distance from Sol in light-years. */ d: number;
  /** Visual brightness multiplier (0..1) — Eta Carinae > M42 > M27. */
  brightness: number;
}
const HII_REGIONS: HiiRegion[] = [
  // Inner arm (Sgr-Carina / Norma) — densest pink region in the canonical
  // artist's view. Lots of giants forming here.
  { l: 287.6, b: -0.6, d: 7_500,  brightness: 1.0  }, // Eta Carinae (NGC 3372)
  { l: 291.0, b: -0.5, d: 22_000, brightness: 0.7  }, // NGC 3603
  { l: 351.2, b:  0.7, d: 5_500,  brightness: 0.8  }, // NGC 6334 Cat's Paw
  { l: 353.2, b:  0.9, d: 5_900,  brightness: 0.85 }, // NGC 6357 Lobster
  { l:   6.0, b: -1.2, d: 4_100,  brightness: 0.9  }, // M8 Lagoon
  { l:   7.0, b: -0.3, d: 5_200,  brightness: 0.7  }, // M20 Trifid
  { l:  15.1, b: -0.7, d: 5_500,  brightness: 0.85 }, // M17 Omega / Swan
  { l:  17.0, b:  0.8, d: 7_000,  brightness: 0.75 }, // M16 Eagle
  // Local arm (Orion spur) — fainter cluster near the Sun
  { l: 209.0, b: -19.4, d: 1_344, brightness: 0.95 }, // M42 Orion Nebula
  { l: 205.0, b: -14.0, d: 1_600, brightness: 0.55 }, // M78 reflection
  { l: 206.0, b: -2.1,  d: 5_200, brightness: 0.75 }, // NGC 2237 Rosette
  // Sagittarius arm + Cygnus
  { l:  61.0, b: -3.7,  d: 1_360, brightness: 0.55 }, // M27 Dumbbell (planetary)
  { l:  63.0, b: 18.1,  d: 2_600, brightness: 0.5  }, // M57 Ring (planetary)
  { l:  74.0, b: -8.6,  d: 2_400, brightness: 0.7  }, // NGC 6960 Veil
  { l:  85.0, b: -0.7,  d: 2_600, brightness: 0.8  }, // NGC 7000 North America
  { l:  99.3, b:  3.7,  d: 2_400, brightness: 0.6  }, // IC 1396
  // Perseus arm
  { l: 112.2, b:  0.2,  d: 7_100, brightness: 0.55 }, // NGC 7635 Bubble
  { l: 134.6, b:  0.9,  d: 7_500, brightness: 0.7  }, // IC 1805 Heart
  { l: 137.2, b:  1.1,  d: 6_500, brightness: 0.65 }, // IC 1848 Soul
  // Outer arm — sparse, gives the canvas edge some life
  { l: 173.4, b: -1.7,  d: 8_800, brightness: 0.4  }, // Sh2-235 area
];

/** Build the bright HII-region clusters as a single Points buffer. */
function makeHiiRegions(): Points {
  // Each entry contributes ~80 small sprites jittered around the
  // listed coords for a "cluster glow" look. Total ~1600 sprites.
  const SPRITES_PER_REGION = 80;
  const total = HII_REGIONS.length * SPRITES_PER_REGION;
  const positions = new Float32Array(total * 3);
  const colors    = new Float32Array(total * 3);
  const sizes     = new Float32Array(total);

  // Warm pink / red — typical Hα-emission colour.
  const hot   = new Color(0xff7a8a);
  const warm  = new Color(0xffa6c4);
  const tmpV = new Vector3();
  let idx = 0;
  for (const r of HII_REGIONS) {
    // Galactic-Cartesian centre = distance × direction(l,b).
    const lRad = r.l * Math.PI / 180;
    const bRad = r.b * Math.PI / 180;
    const cx = r.d * Math.cos(bRad) * Math.cos(lRad);
    const cy = r.d * Math.cos(bRad) * Math.sin(lRad);
    const cz = r.d * Math.sin(bRad);
    // Cluster scale: closer regions get smaller jitter so they don't
    // smear across the local sky; far regions can spread more.
    const sigma = Math.min(150, Math.max(60, r.d * 0.012));
    for (let i = 0; i < SPRITES_PER_REGION; i++) {
      tmpV.set(gaussian(), gaussian(), gaussian() * 0.4).multiplyScalar(sigma);
      positions[idx * 3]     = cx + tmpV.x;
      positions[idx * 3 + 1] = cy + tmpV.y;
      positions[idx * 3 + 2] = cz + tmpV.z;
      const mix = Math.random() * 0.6;
      const c = hot.clone().lerp(warm, mix);
      colors[idx * 3]     = c.r;
      colors[idx * 3 + 1] = c.g;
      colors[idx * 3 + 2] = c.b;
      sizes[idx] = 22 + Math.random() * 28 * r.brightness;
      idx++;
    }
  }

  const geom = new BufferGeometry();
  geom.setAttribute('position', new BufferAttribute(positions, 3));
  geom.setAttribute('color',    new BufferAttribute(colors, 3));
  geom.setAttribute('size',     new BufferAttribute(sizes, 1));
  return new Points(geom, makeStarSpriteMaterial(1.5));
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
