import {
  ConeGeometry,
  Color,
  Group,
  Mesh,
  MeshBasicMaterial,
  Vector3,
} from 'three';
import { DEG2RAD } from '../physics/constants';

/**
 * 在地球（或任意天體 mesh）的指定 lat/lon 上放置一個尖端標記。
 *
 * 標記掛在 mesh 的子節點，因此自動繼承 mesh.rotation.y (= GMST) 與
 * tilt 父節點的軸傾角，永遠對齊真實表面位置。
 */
export class LocationPin {
  readonly group: Group;
  private cone: Mesh;
  private parentMesh: Mesh | null = null;
  private bodyRadius: number = 1;
  private latDeg: number = 0;
  private lonDeg: number = 0;

  constructor() {
    this.group = new Group();

    // Cone pointing along its local +Y axis (default Three.js cone orientation).
    // We orient it so the apex points OUTWARD from Earth's surface.
    const geom = new ConeGeometry(1, 4, 14);
    const mat = new MeshBasicMaterial({
      color: new Color(0xff3030),
      transparent: false,
      depthTest: true,
    });
    this.cone = new Mesh(geom, mat);
    // cone.position.y is set in recompute() so it scales with body radius —
    // a fixed value here would be wildly off in the scene's tiny units.
    this.group.add(this.cone);
    this.group.visible = false;
    this.cone.renderOrder = 100;
  }

  attachTo(mesh: Mesh, bodyRadius: number): void {
    if (this.parentMesh && this.parentMesh !== mesh) {
      this.parentMesh.remove(this.group);
    }
    this.parentMesh = mesh;
    this.bodyRadius = bodyRadius;
    mesh.add(this.group);
    this.recompute();
  }

  setBodyRadius(r: number): void {
    this.bodyRadius = r;
    this.recompute();
  }

  setLatLon(latDeg: number, lonDeg: number): void {
    this.latDeg = latDeg;
    this.lonDeg = lonDeg;
    this.recompute();
  }

  show(): void { this.group.visible = true; }
  hide(): void { this.group.visible = false; }

  private recompute(): void {
    if (!this.parentMesh) return;
    const phi = this.latDeg * DEG2RAD;
    const lambda = this.lonDeg * DEG2RAD;
    const r = this.bodyRadius;
    // Mesh-local frame: +X = lon 0, +Y = lat 90 (north), -Z = lon 90E
    const x =  Math.cos(phi) * Math.cos(lambda) * r;
    const y =  Math.sin(phi) * r;
    const z = -Math.cos(phi) * Math.sin(lambda) * r;
    this.group.position.set(x, y, z);

    // Orient cone so its +Y axis points along the surface normal (outward).
    const up = new Vector3(x, y, z).normalize();
    // Cone default points +Y; apply rotation that maps (0,1,0) to `up`.
    const defaultUp = new Vector3(0, 1, 0);
    const axis = new Vector3().crossVectors(defaultUp, up);
    const angle = Math.acos(Math.max(-1, Math.min(1, defaultUp.dot(up))));
    if (axis.lengthSq() > 1e-10) {
      this.group.quaternion.setFromAxisAngle(axis.normalize(), angle);
    } else if (up.y < 0) {
      // Antipode: 180° flip
      this.group.quaternion.setFromAxisAngle(new Vector3(1, 0, 0), Math.PI);
    } else {
      this.group.quaternion.identity();
    }

    // Tiny surface marker — only visible when zoomed in close to the body.
    // Cone geometry height is 4 (apex at +2 in local cone frame). After
    // scaling, half-height = 2 * scale, so we shift the cone up by that
    // amount to put the base flush with the surface.
    const scale = r * 0.006;
    this.cone.scale.set(scale, scale, scale);
    this.cone.position.set(0, 2 * scale, 0);
  }
}
