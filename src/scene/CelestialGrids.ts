import {
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  Group,
  LineBasicMaterial,
  LineSegments,
  Quaternion,
  Vector3,
} from 'three';
import { eclipticToScene } from '../physics/frame';
import { raDecToEcliptic } from '../physics/topocentric';
import { DEG2RAD } from '../physics/constants';

const RADIUS = 4500; // outside DSO sphere (4000) and Milky Way (4200)
const PARALLEL_STEP = 15;
const MERIDIAN_STEP = 30;
const SEGS_PER_GREAT_CIRCLE = 96;
const SEGS_PER_PARALLEL = 96;

const EARTH_TILT_RAD = 23.4393 * DEG2RAD;

// Pre-compute the galactic-north-pole direction in scene frame: take its
// equatorial coords (RA 12h51m26s, Dec +27.13°) → ecliptic → scene.
const GAL_NP_SCENE = (() => {
  const raH = 192.86 / 15; // hours
  const decDeg = 27.13;
  return eclipticToScene(raDecToEcliptic(raH, decDeg));
})();

/**
 * Multiple coordinate-grid layers (Stellarium-style). Four independent grids
 * each drawn as a sphere of latitude rings + meridian arcs, oriented in its
 * native frame:
 *
 *   • equatorial  — RA / Dec system (J2000)
 *   • ecliptic    — celestial latitude / longitude (sun's path)
 *   • galactic    — galactic equator runs through the Milky Way band
 *   • horizontal  — alt/az; only meaningful in observer mode (rotated each
 *                   frame to the observer's zenith via setObserverFrame)
 */
export class CelestialGrids {
  readonly object = new Group();
  private equatorial: LineSegments;
  private ecliptic: LineSegments;
  private galactic: LineSegments;
  private horizontal: LineSegments;

  constructor() {
    // Each grid is built with mesh-local +Y as its polar axis. We then
    // rotate the geometry so +Y aligns with the desired pole expressed in
    // SCENE coordinates. No further frame transform is applied — that means
    // setObserverFrame() can drive the horizontal grid via a clean basis
    // matrix without a hidden ecliptic/scene flip getting in the way.

    // Ecliptic frame: scene's "natural" up axis IS the ecliptic pole, since
    // ecliptic.z = scene.y after eclipticToScene mapping. So no rotation.
    this.ecliptic = makeGrid(0xffaa55, new Vector3(0, 1, 0));

    // Equatorial frame: celestial pole in scene = (0, cos ε, −sin ε) — that
    // is, ecliptic pole rotated by Earth's obliquity around the equinox
    // direction (scene +X).
    this.equatorial = makeGrid(
      0x6fc8ff,
      new Vector3(0, Math.cos(EARTH_TILT_RAD), -Math.sin(EARTH_TILT_RAD)),
    );

    // Galactic pole: pre-computed above.
    this.galactic = makeGrid(0xa18cff, GAL_NP_SCENE.clone());

    // Horizontal grid: native frame is fine; setObserverFrame() rewrites
    // the object's matrix each frame to align with observer zenith.
    this.horizontal = makeGrid(0x90ff90, new Vector3(0, 1, 0));

    this.object.add(this.ecliptic);
    this.object.add(this.equatorial);
    this.object.add(this.galactic);
    this.object.add(this.horizontal);

    this.equatorial.visible = false;
    this.ecliptic.visible = false;
    this.galactic.visible = false;
    this.horizontal.visible = false;
  }

  setVisible(kind: 'equatorial' | 'ecliptic' | 'galactic' | 'horizontal', v: boolean): void {
    this[kind].visible = v;
  }

  /**
   * Re-orient the horizontal grid to the observer's local frame. east /
   * north / zenith are scene-frame unit vectors. Mesh +X = east, +Y =
   * zenith, +Z = north (since we want longitude 0 / azimuth 0 along north).
   */
  setObserverFrame(zenith: Vector3, east: Vector3, north: Vector3): void {
    const m = this.horizontal.matrix;
    m.makeBasis(east, zenith, north);
    this.horizontal.matrixAutoUpdate = false;
    this.horizontal.matrix.copy(m);
    this.horizontal.matrixWorldNeedsUpdate = true;
  }
}

/**
 * Construct a grid mesh: latitude parallels at every PARALLEL_STEP° and
 * meridian arcs at every MERIDIAN_STEP°. All vertices are on a sphere of
 * radius RADIUS in mesh-local frame (Y polar). Then a single quaternion
 * rotates +Y to `polarAxisInScene` so the grid's pole sits at the right
 * direction without an additional frame conversion.
 */
function makeGrid(hexColor: number, polarAxisInScene: Vector3): LineSegments {
  const verts: number[] = [];

  for (let lat = -90 + PARALLEL_STEP; lat < 90; lat += PARALLEL_STEP) {
    const phi = lat * DEG2RAD;
    const r = Math.cos(phi) * RADIUS;
    const y = Math.sin(phi) * RADIUS;
    let prev: [number, number, number] | null = null;
    for (let i = 0; i <= SEGS_PER_PARALLEL; i++) {
      const lon = (i / SEGS_PER_PARALLEL) * 2 * Math.PI;
      const x = r * Math.cos(lon);
      const z = r * Math.sin(lon);
      if (prev) verts.push(prev[0], prev[1], prev[2], x, y, z);
      prev = [x, y, z];
    }
  }

  for (let lon = 0; lon < 360; lon += MERIDIAN_STEP) {
    const lambda = lon * DEG2RAD;
    let prev: [number, number, number] | null = null;
    for (let i = 0; i <= SEGS_PER_GREAT_CIRCLE; i++) {
      const t = (i / SEGS_PER_GREAT_CIRCLE) * Math.PI - Math.PI / 2;
      const x = Math.cos(t) * Math.cos(lambda) * RADIUS;
      const y = Math.sin(t) * RADIUS;
      const z = Math.cos(t) * Math.sin(lambda) * RADIUS;
      if (prev) verts.push(prev[0], prev[1], prev[2], x, y, z);
      prev = [x, y, z];
    }
  }

  const geom = new BufferGeometry();
  geom.setAttribute('position', new Float32BufferAttribute(verts, 3));

  // Rotate so mesh +Y aligns with the desired scene-space pole.
  const q = new Quaternion().setFromUnitVectors(
    new Vector3(0, 1, 0),
    polarAxisInScene.clone().normalize(),
  );
  const positions = geom.attributes.position;
  const tmp = new Vector3();
  for (let i = 0; i < positions.count; i++) {
    tmp.set(positions.getX(i), positions.getY(i), positions.getZ(i));
    tmp.applyQuaternion(q);
    positions.setXYZ(i, tmp.x, tmp.y, tmp.z);
  }
  geom.computeBoundingSphere();

  const mat = new LineBasicMaterial({
    color: new Color(hexColor),
    transparent: true,
    opacity: 0.32,
    depthWrite: false,
  });
  const lines = new LineSegments(geom, mat);
  lines.frustumCulled = false;
  lines.renderOrder = -100;
  return lines;
}
