import {
  BufferGeometry,
  CanvasTexture,
  Color,
  Float32BufferAttribute,
  Group,
  Line,
  LineDashedMaterial,
  Mesh,
  MeshBasicMaterial,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  Vector3,
} from 'three';
import { LAGRANGE_SYSTEMS, type LagrangeSystem } from '../data/lagrangeSystems';
import type { BodyDescriptor } from '../physics/types';
import { lagrangePoints, type LagrangePointSet } from '../physics/lagrange';
import { eclipticToScene } from '../physics/frame';
import type { ScaleController } from '../controls/ScaleController';

type PointId = 'L1' | 'L2' | 'L3' | 'L4' | 'L5';
const POINT_IDS: PointId[] = ['L1', 'L2', 'L3', 'L4', 'L5'];

interface SystemEntry {
  system: LagrangeSystem;
  primary: BodyDescriptor;
  secondary: BodyDescriptor;
  markers: Record<PointId, Mesh>;
  labels: Record<PointId, Sprite>;
  /** L4–L5 equilateral triangle outline (primary–L4, primary–L5, secondary–L4, secondary–L5). */
  triangle: Line;
}

/**
 * Build a tiny canvas texture used as the L# label sprite. We do this lazily
 * per (label, color) pair and cache so we don't allocate many textures.
 */
const labelTextureCache = new Map<string, CanvasTexture>();
function makeLabelTexture(text: string, color: number): CanvasTexture {
  const key = `${text}:${color.toString(16)}`;
  const cached = labelTextureCache.get(key);
  if (cached) return cached;
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const ctx = c.getContext('2d')!;
  ctx.font = 'bold 28px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = `#${color.toString(16).padStart(6, '0')}`;
  ctx.shadowColor = 'rgba(0,0,0,0.9)';
  ctx.shadowBlur = 6;
  ctx.fillText(text, 32, 32);
  const tex = new CanvasTexture(c);
  tex.needsUpdate = true;
  labelTextureCache.set(key, tex);
  return tex;
}

/**
 * Visualisation of L1–L5 for a fixed set of two-body systems
 * (Sun–Earth, Sun–Jupiter, Earth–Moon by default).
 *
 * Markers and labels are recomputed each frame from the live positions of
 * the two bodies, so when the user sweeps the time slider Trojan camps
 * leading/trailing Jupiter visibly orbit with it.
 */
export class LagrangePointsLayer {
  readonly group = new Group();
  private entries: SystemEntry[] = [];

  constructor(
    private scaler: ScaleController,
    bodyRegistry: Map<string, BodyDescriptor>,
  ) {
    for (const sys of LAGRANGE_SYSTEMS) {
      const primary = bodyRegistry.get(sys.primaryId);
      const secondary = bodyRegistry.get(sys.secondaryId);
      if (!primary || !secondary) continue;

      const markers = {} as Record<PointId, Mesh>;
      const labels = {} as Record<PointId, Sprite>;
      const dotGeom = new SphereGeometry(0.012, 12, 8);
      const dotMat = new MeshBasicMaterial({ color: new Color(sys.color) });
      for (const pid of POINT_IDS) {
        const dot = new Mesh(dotGeom, dotMat);
        dot.userData.lagrangeSystem = sys.id;
        dot.userData.lagrangePoint = pid;
        this.group.add(dot);
        markers[pid] = dot;

        const labelMat = new SpriteMaterial({
          map: makeLabelTexture(pid, sys.color),
          transparent: true,
          depthTest: false,
        });
        const label = new Sprite(labelMat);
        label.scale.set(0.18, 0.18, 1);
        this.group.add(label);
        labels[pid] = label;
      }

      // L4/L5 equilateral triangle outline (primary–L4–secondary–L5 closed).
      const triGeom = new BufferGeometry();
      triGeom.setAttribute('position', new Float32BufferAttribute(new Float32Array(15), 3)); // 5 points × xyz
      const triMat = new LineDashedMaterial({
        color: new Color(sys.color),
        transparent: true,
        opacity: 0.35,
        dashSize: 0.05,
        gapSize: 0.05,
      });
      const tri = new Line(triGeom, triMat);
      tri.computeLineDistances();
      tri.frustumCulled = false;
      this.group.add(tri);

      this.entries.push({
        system: sys,
        primary,
        secondary,
        markers,
        labels,
        triangle: tri,
      });
    }
  }

  setVisible(visible: boolean): void {
    this.group.visible = visible;
  }

  isVisible(): boolean {
    return this.group.visible;
  }

  /**
   * Per-frame recompute. Reads each system's body positions, runs the
   * Lagrange solver, and updates marker / label / triangle geometry.
   */
  update(jd: number): void {
    if (!this.group.visible) return;
    for (const e of this.entries) {
      // Get primary world position. Sun has propagator=null → at origin.
      let primaryPosAU: Vector3;
      if (e.primary.propagator) {
        primaryPosAU = e.primary.propagator.stateAt(jd).position.clone();
      } else {
        primaryPosAU = new Vector3(0, 0, 0);
      }
      // Secondary: position relative to its parent. For moons (parent=earth)
      // the propagator returns geocentric coords, so we add primary's helio.
      let secondaryPosAU: Vector3;
      if (e.secondary.propagator) {
        const sv = e.secondary.propagator.stateAt(jd).position.clone();
        if (e.secondary.parentId === e.primary.id) {
          secondaryPosAU = primaryPosAU.clone().add(sv);
        } else {
          secondaryPosAU = sv;
        }
      } else {
        continue;
      }

      const points: LagrangePointSet = lagrangePoints(
        e.primary.physical.massKg,
        e.secondary.physical.massKg,
        primaryPosAU,
        secondaryPosAU,
      );

      const triPositions: number[] = [];
      for (const pid of POINT_IDS) {
        const auPos = points[pid];
        const scenePos = this.toScene(auPos);
        e.markers[pid].position.copy(scenePos);
        // Label sits slightly offset along the up direction in scene space.
        e.labels[pid].position.copy(scenePos).add(new Vector3(0, 0.06, 0));
      }

      // Triangle outline: primary – L4 – secondary – L5 – primary
      const primaryScene = this.toScene(primaryPosAU);
      const secondaryScene = this.toScene(secondaryPosAU);
      const l4Scene = e.markers.L4.position;
      const l5Scene = e.markers.L5.position;
      triPositions.push(
        primaryScene.x, primaryScene.y, primaryScene.z,
        l4Scene.x, l4Scene.y, l4Scene.z,
        secondaryScene.x, secondaryScene.y, secondaryScene.z,
        l5Scene.x, l5Scene.y, l5Scene.z,
        primaryScene.x, primaryScene.y, primaryScene.z,
      );
      const attr = e.triangle.geometry.getAttribute('position') as Float32BufferAttribute;
      attr.array.set(triPositions);
      attr.needsUpdate = true;
      e.triangle.computeLineDistances();
    }
  }

  /** Re-run scaler-dependent geometry (no static buffers, so just touch update). */
  rebuild(jd: number): void {
    this.update(jd);
  }

  /** Convert an ecliptic-AU vector to scene coords using the active scaler. */
  private toScene(auVec: Vector3): Vector3 {
    const len = auVec.length();
    if (len === 0) return eclipticToScene(auVec);
    const scaled = this.scaler.distanceAU(len);
    const scaledVec = auVec.clone().multiplyScalar(scaled / len);
    return eclipticToScene(scaledVec);
  }

  /**
   * Picking helper: given a userData carrier from a raycast hit, returns the
   * matching system + point, or null.
   */
  resolvePick(userData: { lagrangeSystem?: string; lagrangePoint?: string }): {
    system: LagrangeSystem;
    point: PointId;
  } | null {
    if (!userData?.lagrangeSystem || !userData?.lagrangePoint) return null;
    const sys = LAGRANGE_SYSTEMS.find(s => s.id === userData.lagrangeSystem);
    if (!sys) return null;
    const pid = userData.lagrangePoint as PointId;
    if (!POINT_IDS.includes(pid)) return null;
    return { system: sys, point: pid };
  }
}
