import {
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  Group,
  Line,
  LineBasicMaterial,
  Mesh,
  MeshBasicMaterial,
  SphereGeometry,
  Vector3,
} from 'three';
import { SPACECRAFT, SampledPropagator, type SpacecraftDescriptor } from '../data/spacecraft';
import { eclipticToScene } from '../physics/frame';
import type { ScaleController } from '../controls/ScaleController';

interface SpacecraftEntry {
  desc: SpacecraftDescriptor;
  prop: SampledPropagator;
  mesh: Mesh;
  trajectory: Line;
}

/**
 * Renders all spacecraft as small dots + their full trajectory lines.
 * Updated each frame from the simulation clock.
 */
export class SpacecraftLayer {
  readonly group = new Group();
  private entries: SpacecraftEntry[] = [];

  constructor(private scaler: ScaleController) {
    for (const sc of SPACECRAFT) {
      const prop = new SampledPropagator(sc.samples);

      // Build trajectory line by sampling propagator densely between start/end.
      const lineGeom = new BufferGeometry();
      const samples = sc.samples;
      const startJd = samples[0][0];
      const endJd = samples[samples.length - 1][0];
      const N = 200;
      const positions = new Float32Array(N * 3);
      for (let i = 0; i < N; i++) {
        const t = i / (N - 1);
        const j = startJd + (endJd - startJd) * t;
        const sv = prop.stateAt(j);
        const len = sv.position.length();
        const scaled = this.scaler.distanceAU(len);
        const out = sv.position.clone();
        if (len > 0) out.multiplyScalar(scaled / len);
        const scene = eclipticToScene(out);
        positions[i * 3] = scene.x;
        positions[i * 3 + 1] = scene.y;
        positions[i * 3 + 2] = scene.z;
      }
      lineGeom.setAttribute('position', new Float32BufferAttribute(positions, 3));
      const lineMat = new LineBasicMaterial({
        color: new Color(sc.color),
        transparent: true,
        opacity: 0.55,
      });
      const line = new Line(lineGeom, lineMat);
      line.frustumCulled = false;
      this.group.add(line);

      // Dot mesh for current position.
      const dotGeom = new SphereGeometry(0.015, 12, 8);
      const dotMat = new MeshBasicMaterial({ color: new Color(sc.color) });
      const mesh = new Mesh(dotGeom, dotMat);
      mesh.userData.bodyId = sc.id;
      mesh.userData.spacecraft = sc;
      this.group.add(mesh);

      this.entries.push({ desc: sc, prop, mesh, trajectory: line });
    }
  }

  setVisible(visible: boolean): void {
    this.group.visible = visible;
  }

  /** Per-frame update: relocate each spacecraft dot. */
  update(jd: number): void {
    if (!this.group.visible) return;
    for (const e of this.entries) {
      const sv = e.prop.stateAt(jd);
      const len = sv.position.length();
      const scaled = this.scaler.distanceAU(len);
      const out = sv.position.clone();
      if (len > 0) out.multiplyScalar(scaled / len);
      const scene = eclipticToScene(out);
      e.mesh.position.copy(scene);
    }
  }

  /** Re-build geometry when scale mode changes (because scaler.distanceAU changed). */
  rebuild(): void {
    for (const e of this.entries) {
      const samples = e.desc.samples;
      const startJd = samples[0][0];
      const endJd = samples[samples.length - 1][0];
      const N = 200;
      const positions = (e.trajectory.geometry.getAttribute('position') as Float32BufferAttribute).array as Float32Array;
      for (let i = 0; i < N; i++) {
        const t = i / (N - 1);
        const j = startJd + (endJd - startJd) * t;
        const sv = e.prop.stateAt(j);
        const len = sv.position.length();
        const scaled = this.scaler.distanceAU(len);
        const out = sv.position.clone();
        if (len > 0) out.multiplyScalar(scaled / len);
        const scene = eclipticToScene(out);
        positions[i * 3] = scene.x;
        positions[i * 3 + 1] = scene.y;
        positions[i * 3 + 2] = scene.z;
      }
      (e.trajectory.geometry.getAttribute('position') as Float32BufferAttribute).needsUpdate = true;
    }
  }
}

void Vector3;
