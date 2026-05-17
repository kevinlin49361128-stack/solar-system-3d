import {
  AdditiveBlending, BufferAttribute, BufferGeometry, LineSegments, LineBasicMaterial,
  Object3D, RingGeometry, Mesh, MeshBasicMaterial, DoubleSide, Vector3,
} from 'three';
import { raDecToEcliptic } from '../physics/topocentric';
import { eclipticToScene } from '../physics/frame';

const DOME_RADIUS = 4000;
/** Reticle visual radius in scene units (matches HZ disc / map dot sizing). */
const RETICLE_RADIUS = 35;

/**
 * Green reticle marking an external telescope's current pointing on the
 * celestial dome. Drawn slightly inside the star-dome radius so it stays
 * crisp against the starfield without z-fighting Messier sprites.
 *
 * Visual: a ring + a cross (4 short ticks pointing in/out). Mimics a
 * classic Telrad / red-dot finder pattern so observers immediately
 * recognise it as "scope is aimed here". Green is the conventional
 * "live external system" colour (compare red selection brackets for
 * "user has clicked this").
 *
 * The reticle hides itself until setPointing() is called; calling
 * hide() returns it to that state when the scope disconnects.
 */
export class ScopeReticle {
  readonly object: Object3D;
  private ring: Mesh;
  private cross: LineSegments;
  private currentPos = new Vector3();
  private visible = false;

  constructor() {
    this.object = new Object3D();
    this.object.renderOrder = 800;  // above the dome, below the cursor brackets (999)

    // Outer ring — open in the middle so the target stays visible.
    const ringGeom = new RingGeometry(RETICLE_RADIUS, RETICLE_RADIUS + 3, 64);
    const ringMat = new MeshBasicMaterial({
      color: 0x44ff66,
      transparent: true,
      opacity: 0.85,
      side: DoubleSide,
      depthWrite: false,
      depthTest: false,
      blending: AdditiveBlending,
    });
    this.ring = new Mesh(ringGeom, ringMat);
    this.ring.renderOrder = 800;
    this.object.add(this.ring);

    // Cross — 4 short ticks pointing away from centre. Telrad style:
    // ticks DON'T touch the centre so a star sits in the gap.
    const tick = RETICLE_RADIUS * 0.55;
    const gap  = RETICLE_RADIUS * 0.25;
    const positions = new Float32Array([
      // Top tick
       0,  gap, 0,   0,  tick, 0,
      // Bottom tick
       0, -gap, 0,   0, -tick, 0,
      // Left tick
      -gap, 0, 0,  -tick, 0, 0,
      // Right tick
       gap, 0, 0,   tick, 0, 0,
    ]);
    const crossGeom = new BufferGeometry();
    crossGeom.setAttribute('position', new BufferAttribute(positions, 3));
    const crossMat = new LineBasicMaterial({
      color: 0x44ff66,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      depthTest: false,
      blending: AdditiveBlending,
    });
    // LineSegments draws each consecutive pair of vertices as a separate
    // segment (4 ticks from 8 vertices) — exactly what we want.
    this.cross = new LineSegments(crossGeom, crossMat);
    this.cross.renderOrder = 800;
    this.object.add(this.cross);

    this.object.visible = false;
  }

  /**
   * Place the reticle at the given J2000 RA/Dec. Reticle is rotated so
   * the cross lies in the local tangent plane — i.e. the cross's "up"
   * points roughly toward the celestial north pole as seen from the
   * scene origin. This keeps the reticle reading correctly regardless
   * of where on the sky the scope is pointing.
   */
  setPointing(raHours: number, decDeg: number): void {
    const dirEcl = raDecToEcliptic(raHours, decDeg);
    const dirScene = eclipticToScene(dirEcl);
    const pos = dirScene.clone().multiplyScalar(DOME_RADIUS - 50);
    this.currentPos.copy(pos);
    this.object.position.copy(pos);
    // Orient so the reticle's local +Z axis points outward from origin
    // (i.e. the ring faces the camera regardless of view).
    this.object.lookAt(pos.clone().multiplyScalar(2));
    this.visible = true;
    this.object.visible = true;
  }

  hide(): void {
    this.visible = false;
    this.object.visible = false;
  }

  isVisible(): boolean { return this.visible; }
}
