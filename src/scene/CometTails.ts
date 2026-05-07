import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Float32BufferAttribute,
  Group,
  LineSegments,
  Points,
  ShaderMaterial,
  Vector3,
} from 'three';
import type { ScaleController } from '../controls/ScaleController';
import { COMETS, getComaColor } from '../data/comets';
import { eclipticToScene } from '../physics/frame';

const SEGMENTS_PER_TAIL = 16;     // gradient resolution per tail
const TAILS_PER_COMET = 2;        // ion (straight, blue) + dust (curved, white-yellow)
const ION_COLOR  = [0.45, 0.65, 1.00];
const DUST_COLOR = [1.00, 0.92, 0.70];

/**
 * Renders comet ion tails as additively-blended faded line strips. Each
 * comet gets `SEGMENTS_PER_TAIL` line segments stretching from the nucleus
 * along the anti-sun direction. Length scales with 1/r² heliocentric
 * (proxy for water sublimation rate); below ~5 AU activity ramps up, with
 * a hard cutoff at 8 AU (no useful sublimation).
 *
 * The geometry is one big LineSegments mesh — `COMETS.length × SEGMENTS_PER_TAIL`
 * pairs of points — updated in place every frame.
 */
export class CometTails {
  readonly object: Group;
  private tails: LineSegments;
  private comaPoints: Points;
  private positions: Float32Array;
  private alphas: Float32Array;
  private colors: Float32Array;
  private comaPositions: Float32Array;
  private comaSizes: Float32Array;
  private comaActivity: Float32Array;
  private mat: ShaderMaterial;
  private comaMat: ShaderMaterial;

  constructor() {
    const N = COMETS.length;
    // Each comet has TWO tails (ion + dust); each tail has SEGMENTS_PER_TAIL.
    const totalSegs = N * TAILS_PER_COMET * SEGMENTS_PER_TAIL;
    this.positions = new Float32Array(totalSegs * 6);
    this.alphas    = new Float32Array(totalSegs * 2);
    this.colors    = new Float32Array(totalSegs * 6); // per-vertex RGB

    const geom = new BufferGeometry();
    geom.setAttribute('position', new BufferAttribute(this.positions, 3));
    geom.setAttribute('aAlpha',   new BufferAttribute(this.alphas, 1));
    geom.setAttribute('aColor',   new BufferAttribute(this.colors, 3));

    this.mat = new ShaderMaterial({
      uniforms: {
        uOpacity:  { value: 1.0 },
      },
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      vertexShader: `
        attribute float aAlpha;
        attribute vec3 aColor;
        varying float vAlpha;
        varying vec3 vColor;
        void main() {
          vAlpha = aAlpha;
          vColor = aColor;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uOpacity;
        varying float vAlpha;
        varying vec3 vColor;
        void main() {
          gl_FragColor = vec4(vColor, vAlpha * uOpacity);
        }
      `,
    });
    this.tails = new LineSegments(geom, this.mat);
    this.tails.frustumCulled = false;
    this.tails.renderOrder = 5;

    // Coma: 3 nested sprites per comet — inner CN/C₂ core, mid dust shell,
    // outer extended H₂O/OH halo. Colour per comet from the molecular-
    // emission lookup; per-shell tint varies (inner brightest blue-violet,
    // outer faintest cool grey-blue). Sizes nest 1.0/2.4/5.0 × base.
    const SHELLS_PER_COMET = 3;
    const totalSprites = N * SHELLS_PER_COMET;
    this.comaPositions = new Float32Array(totalSprites * 3);
    this.comaSizes     = new Float32Array(totalSprites);
    this.comaActivity  = new Float32Array(totalSprites);
    const comaColors   = new Float32Array(totalSprites * 3);
    // Per-shell colour modulation: row-major [shell0_r,g,b, shell1_r,g,b, shell2_r,g,b]
    const SHELL_TINT = [
      [1.10, 1.05, 1.00], // inner: slight enhancement
      [0.85, 0.95, 1.00], // middle: cooler/dustier
      [0.55, 0.70, 0.95], // outer: faint blue-grey
    ];
    for (let i = 0; i < N; i++) {
      const [cr, cg, cb] = getComaColor(COMETS[i].id);
      for (let s = 0; s < SHELLS_PER_COMET; s++) {
        const idx = (i * SHELLS_PER_COMET + s) * 3;
        const [tr, tg, tb] = SHELL_TINT[s];
        comaColors[idx]     = cr * tr;
        comaColors[idx + 1] = cg * tg;
        comaColors[idx + 2] = cb * tb;
      }
    }
    const comaGeom = new BufferGeometry();
    comaGeom.setAttribute('position', new Float32BufferAttribute(this.comaPositions, 3));
    comaGeom.setAttribute('aSize',    new Float32BufferAttribute(this.comaSizes, 1));
    comaGeom.setAttribute('aAct',     new Float32BufferAttribute(this.comaActivity, 1));
    comaGeom.setAttribute('aColor',   new Float32BufferAttribute(comaColors, 3));
    this.comaMat = new ShaderMaterial({
      uniforms: { uOpacity: { value: 1.0 } },
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      vertexShader: `
        attribute float aSize;
        attribute float aAct;
        attribute vec3 aColor;
        varying float vAct;
        varying vec3 vColor;
        void main() {
          vAct = aAct;
          vColor = aColor;
          gl_PointSize = aSize;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uOpacity;
        varying float vAct;
        varying vec3 vColor;
        void main() {
          vec2 c = gl_PointCoord - 0.5;
          float r = length(c);
          if (r > 0.5) discard;
          float a = pow(max(0.0, 1.0 - r * 2.0), 2.5) * vAct;
          gl_FragColor = vec4(vColor, a * uOpacity);
        }
      `,
    });
    this.comaPoints = new Points(comaGeom, this.comaMat);
    this.comaPoints.frustumCulled = false;
    this.comaPoints.renderOrder = 6;

    this.object = new Group();
    this.object.add(this.tails);
    this.object.add(this.comaPoints);
    this.object.visible = true;
  }

  setVisible(v: boolean): void { this.object.visible = v; }

  /**
   * Recompute every comet's tail. Caller passes the heliocentric→scene
   * scaling helper so tail-tip positions match how the comet body itself
   * is rendered (e.g. log/schematic distance compression).
   */
  update(jd: number, scaler: ScaleController): void {
    const tmp = new Vector3();
    const ionDir = new Vector3();
    const dustDir = new Vector3();
    let writePos = 0;
    let writeAlpha = 0;
    let writeColor = 0;
    let writeComa = 0;
    for (let ci = 0; ci < COMETS.length; ci++) {
      const c = COMETS[ci];
      if (!c.propagator) {
        for (let pad = 0; pad < TAILS_PER_COMET * SEGMENTS_PER_TAIL; pad++) {
          for (let k = 0; k < 6; k++) this.positions[writePos++] = 0;
          this.alphas[writeAlpha++] = 0;
          this.alphas[writeAlpha++] = 0;
          for (let k = 0; k < 6; k++) this.colors[writeColor++] = 0;
        }
        // 3 shells × 3 components, sizes & activity 0
        for (let s = 0; s < 3; s++) {
          this.comaPositions[writeComa] = 0;
          this.comaPositions[writeComa + 1] = 0;
          this.comaPositions[writeComa + 2] = 0;
          this.comaSizes[ci * 3 + s] = 0;
          this.comaActivity[ci * 3 + s] = 0;
          writeComa += 3;
        }
        continue;
      }
      const sv = c.propagator.stateAt(jd);
      const r = sv.position.length();
      let activity = 0;
      if (r < 8) activity = Math.max(0, Math.min(1, 1.0 / Math.max(0.3, r * r * 0.3)));
      const ionLengthAU = activity * 0.6;
      const dustLengthAU = activity * 0.5; // slightly shorter, fans out

      const sunDist = sv.position.length();
      if (sunDist < 1e-9 || activity <= 0) {
        for (let pad = 0; pad < TAILS_PER_COMET * SEGMENTS_PER_TAIL; pad++) {
          for (let k = 0; k < 6; k++) this.positions[writePos++] = 0;
          this.alphas[writeAlpha++] = 0;
          this.alphas[writeAlpha++] = 0;
          for (let k = 0; k < 6; k++) this.colors[writeColor++] = 0;
        }
        for (let s = 0; s < 3; s++) {
          this.comaPositions[writeComa] = 0;
          this.comaPositions[writeComa + 1] = 0;
          this.comaPositions[writeComa + 2] = 0;
          this.comaSizes[ci * 3 + s] = 0;
          this.comaActivity[ci * 3 + s] = 0;
          writeComa += 3;
        }
        continue;
      }
      // Coma: 3 nested sprites at the same nucleus position, with size
      // ratios 1 : 2.4 : 5 and activity falloff per shell so the outer
      // halo only contributes when the comet is very active.
      {
        const headEcl = sv.position.clone();
        const headK = scaler.distanceAU(headEcl.length()) / Math.max(1e-9, headEcl.length());
        headEcl.multiplyScalar(headK);
        const headScene = eclipticToScene(headEcl);
        const baseSize = 6.0 + activity * 26.0;
        const SHELL_SIZE = [1.0, 2.4, 5.0];
        // Outer shell only meaningful with high activity (close perihelion).
        const SHELL_ACT = [activity, activity * 0.6, activity * activity * 0.5];
        for (let s = 0; s < 3; s++) {
          this.comaPositions[writeComa] = headScene.x;
          this.comaPositions[writeComa + 1] = headScene.y;
          this.comaPositions[writeComa + 2] = headScene.z;
          this.comaSizes[ci * 3 + s] = baseSize * SHELL_SIZE[s];
          this.comaActivity[ci * 3 + s] = SHELL_ACT[s];
          writeComa += 3;
        }
      }
      // Anti-sun direction (ion tail aligns straight along this).
      ionDir.copy(sv.position).divideScalar(sunDist);
      // Dust tail bends toward the comet's *backward* velocity direction —
      // dust grains carry orbital momentum that radiation pressure only
      // partially overcomes. We blend (1-t)·antiSun + t·(-velocity_dir)
      // for parameter t along the tail.
      const speed = sv.velocity.length();
      const velUnit = speed > 1e-9 ? sv.velocity.clone().multiplyScalar(-1 / speed) : ionDir.clone();

      for (let tailIdx = 0; tailIdx < TAILS_PER_COMET; tailIdx++) {
        const isIon = tailIdx === 0;
        const tailLen = isIon ? ionLengthAU : dustLengthAU;
        const color = isIon ? ION_COLOR : DUST_COLOR;
        for (let s = 0; s < SEGMENTS_PER_TAIL; s++) {
          const t0 = s / SEGMENTS_PER_TAIL;
          const t1 = (s + 1) / SEGMENTS_PER_TAIL;
          const dir0 = isIon ? ionDir : blendDir(dustDir, ionDir, velUnit, t0);
          const dir1 = isIon ? ionDir : blendDir(dustDir, ionDir, velUnit, t1);
          tmp.copy(dir0).multiplyScalar(tailLen * t0);
          const p0Ecl = sv.position.clone().add(tmp);
          tmp.copy(dir1).multiplyScalar(tailLen * t1);
          const p1Ecl = sv.position.clone().add(tmp);
          const k0 = p0Ecl.length() > 0 ? scaler.distanceAU(p0Ecl.length()) / p0Ecl.length() : 0;
          const k1 = p1Ecl.length() > 0 ? scaler.distanceAU(p1Ecl.length()) / p1Ecl.length() : 0;
          p0Ecl.multiplyScalar(k0);
          p1Ecl.multiplyScalar(k1);
          const a = eclipticToScene(p0Ecl);
          const b = eclipticToScene(p1Ecl);
          this.positions[writePos++] = a.x;
          this.positions[writePos++] = a.y;
          this.positions[writePos++] = a.z;
          this.positions[writePos++] = b.x;
          this.positions[writePos++] = b.y;
          this.positions[writePos++] = b.z;
          this.alphas[writeAlpha++] = (1 - t0) * activity;
          this.alphas[writeAlpha++] = (1 - t1) * activity;
          for (let v = 0; v < 2; v++) {
            this.colors[writeColor++] = color[0];
            this.colors[writeColor++] = color[1];
            this.colors[writeColor++] = color[2];
          }
        }
      }
    }
    (this.tails.geometry.attributes.position as BufferAttribute).needsUpdate = true;
    (this.tails.geometry.attributes.aAlpha   as BufferAttribute).needsUpdate = true;
    (this.tails.geometry.attributes.aColor   as BufferAttribute).needsUpdate = true;
    (this.comaPoints.geometry.attributes.position as BufferAttribute).needsUpdate = true;
    (this.comaPoints.geometry.attributes.aSize    as BufferAttribute).needsUpdate = true;
    (this.comaPoints.geometry.attributes.aAct     as BufferAttribute).needsUpdate = true;
  }
}

/**
 * Dust-tail direction blend: from anti-sun at t=0 to a 50/50 mix of
 * anti-sun + retrograde velocity at t=1, producing the characteristic
 * arc behind the comet.
 */
function blendDir(out: Vector3, antiSun: Vector3, retroVel: Vector3, t: number): Vector3 {
  const w = t * 0.5; // weight on retrograde velocity
  return out.copy(antiSun).multiplyScalar(1 - w).addScaledVector(retroVel, w).normalize();
}
