import {
  Color,
  InstancedMesh,
  MeshBasicMaterial,
  Object3D,
  SphereGeometry,
  Vector3,
} from 'three';
import { DEG2RAD, TWO_PI } from '../physics/constants';
import { solveKepler } from '../physics/kepler';
import { eclipticToSceneInPlace } from '../physics/frame';
import type { BeltDefinition } from '../data/belts';
import type { ScaleController } from '../controls/ScaleController';

interface ParticleParams {
  a: number;
  e: number;
  iRad: number;
  ΩRad: number;
  ωRad: number;
  M0: number;
}

export class Belt {
  readonly mesh: InstancedMesh;
  readonly definition: BeltDefinition;
  private readonly particles: ParticleParams[];
  private readonly tmpObj = new Object3D();
  private readonly tmpVec = new Vector3();

  constructor(def: BeltDefinition) {
    this.definition = def;
    const geom = new SphereGeometry(def.particleSize, 4, 3);
    const mat = new MeshBasicMaterial({ color: new Color(def.color) });

    this.mesh = new InstancedMesh(geom, mat, def.count);
    this.mesh.frustumCulled = false;
    this.mesh.userData.isBelt = true;

    this.particles = new Array(def.count);
    for (let n = 0; n < def.count; n++) {
      this.particles[n] = {
        a: rand(def.aRange[0], def.aRange[1]),
        e: rand(def.eRange[0], def.eRange[1]),
        iRad: rand(def.iRange[0], def.iRange[1]) * DEG2RAD * (Math.random() < 0.5 ? 1 : -1),
        ΩRad: Math.random() * TWO_PI,
        ωRad: Math.random() * TWO_PI,
        M0: Math.random() * TWO_PI,
      };
    }
  }

  update(jd: number, scaler: ScaleController): void {
    const sizeScale = scaler.beltParticleSizeFactor();

    for (let n = 0; n < this.particles.length; n++) {
      const p = this.particles[n];

      const period = 365.256 * Math.pow(p.a, 1.5);
      const M = (p.M0 + (TWO_PI * jd) / period) % TWO_PI;
      const E = solveKepler(M, p.e);

      const xOrb = p.a * (Math.cos(E) - p.e);
      const yOrb = p.a * Math.sqrt(1 - p.e * p.e) * Math.sin(E);

      const cosO = Math.cos(p.ΩRad), sinO = Math.sin(p.ΩRad);
      const cosw = Math.cos(p.ωRad), sinw = Math.sin(p.ωRad);
      const cosi = Math.cos(p.iRad), sini = Math.sin(p.iRad);

      const r11 = cosO * cosw - sinO * sinw * cosi;
      const r12 = -cosO * sinw - sinO * cosw * cosi;
      const r21 = sinO * cosw + cosO * sinw * cosi;
      const r22 = -sinO * sinw + cosO * cosw * cosi;
      const r31 = sinw * sini;
      const r32 = cosw * sini;

      this.tmpVec.set(
        r11 * xOrb + r12 * yOrb,
        r21 * xOrb + r22 * yOrb,
        r31 * xOrb + r32 * yOrb,
      );

      const len = this.tmpVec.length();
      const scaled = scaler.distanceAU(len);
      if (len > 0) this.tmpVec.multiplyScalar(scaled / len);

      eclipticToSceneInPlace(this.tmpVec);

      this.tmpObj.position.copy(this.tmpVec);
      this.tmpObj.scale.setScalar(sizeScale);
      this.tmpObj.updateMatrix();
      this.mesh.setMatrixAt(n, this.tmpObj.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  setVisible(visible: boolean): void {
    this.mesh.visible = visible;
  }
}

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}
