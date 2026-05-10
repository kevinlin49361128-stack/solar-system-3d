import {
  AdditiveBlending, BufferGeometry, Float32BufferAttribute,
  Group, Line, LineDashedMaterial,
  Mesh, MeshBasicMaterial, RingGeometry, Vector3,
} from 'three';
import { BodyMesh } from './BodyMesh';
import { OrbitLine } from './OrbitLine';
import { eclipticToScene } from '../physics/frame';
import {
  EXOPLANET_SYSTEMS,
  getExoplanetSystem,
  type ExoplanetSystemMeta,
} from '../data/exoplanetSystems';
import { habitableZoneAU } from '../physics/habitableZone';
import type { ScaleController } from '../controls/ScaleController';

/**
 * Scene-swap manager for the curated exoplanet systems.
 *
 * On demand (`activate(id)`), builds and shows the host star + child
 * planets at scene origin, sized roughly the way the moon sub-system
 * scales work. Hides itself otherwise so the default rendering is the
 * familiar Sun-centred solar-system view.
 *
 * Build is lazy + cached: each system's mesh tree is constructed the
 * first time it's activated, then reused on subsequent activations.
 *
 * Design choice: this layer does NOT register its bodies in the main
 * SolarSystem `bodies` Map, because that map drives a bunch of code
 * paths (geocentric reframing, scale-mode rebuilds, body-select
 * dropdowns) that don't make sense outside our own solar system.
 * Exoplanet bodies live in their own micro-scene-graph and are
 * advanced by our own update loop here.
 */
interface SystemBuild {
  group: Group;
  hostMesh: BodyMesh;
  planets: Array<{
    mesh: BodyMesh;
    orbit: OrbitLine | null;
    propagator: ReturnType<typeof Object>;
  }>;
  /** Habitable-zone disc (Recent Venus → Early Mars), or null if Teff
   *  outside the calibrated range or system has no defined HZ. */
  hzDisc: Mesh | null;
  /** Mercury's orbit projected into this system's frame, as a dashed
   *  line at 0.387 AU radius — gives an instant "compare to our solar
   *  system" sense of scale. Null if scale information unavailable. */
  mercuryOrbitOverlay: Line | null;
}

export class ExoplanetSystemView {
  /** Container — added to the scene root once at construction. */
  readonly group = new Group();
  /** Currently active system id, or null when the solar system is showing. */
  private activeId: string | null = null;
  private cache = new Map<string, SystemBuild>();

  constructor(private scaler: ScaleController) {
    this.group.visible = false;
  }

  isActive(): boolean { return this.activeId !== null; }
  getActiveId(): string | null { return this.activeId; }

  /**
   * Show the named system (building meshes the first time). Hides any
   * previously-active system. Returns the system metadata so callers
   * can plumb it to UI / info panel.
   */
  activate(id: string): ExoplanetSystemMeta | null {
    const meta = getExoplanetSystem(id);
    if (!meta) return null;
    if (this.activeId && this.activeId !== id) {
      const prev = this.cache.get(this.activeId);
      if (prev) prev.group.visible = false;
    }
    let build = this.cache.get(id);
    const isFreshBuild = !build;
    if (!build) {
      build = this.buildSystem(meta);
      this.cache.set(id, build);
      this.group.add(build.group);
    }
    build.group.visible = true;
    this.group.visible = true;
    this.activeId = id;
    // For a cache-hit, the geometry was built at whatever scale was
    // active back then. The current land-flow forces 'log' so most of
    // the time this is a no-op, but to be defensive against future
    // call paths (a debug toggle, a saved-state restore, an AB test
    // that lets users land at real scale) re-rebuild against the
    // current scaler. Cheap — just a few SphereGeometry + RingGeometry
    // resizes for the host + ≤8 planets, and OrbitLine.rebuild reuses
    // its buffer attribute in place.
    if (!isFreshBuild) this.rebuild();
    return meta;
  }

  /** Hide the exoplanet view and restore the default solar-system rendering. */
  deactivate(): void {
    if (this.activeId) {
      const build = this.cache.get(this.activeId);
      if (build) build.group.visible = false;
    }
    this.activeId = null;
    this.group.visible = false;
  }

  /**
   * Per-frame: advance the active system's planet positions from the
   * simulation clock. No-op when inactive.
   */
  update(jd: number): void {
    if (!this.activeId) return;
    const meta = getExoplanetSystem(this.activeId);
    const build = this.cache.get(this.activeId);
    if (!meta || !build) return;

    // Host stays at origin and just spins (no orbit propagator).
    build.hostMesh.setPosition(new Vector3(0, 0, 0));

    // Planet positions: propagator returns AU offset from host. We use
    // the moon-distance scale so close-in worlds (Trappist-1 is < 0.07 AU
    // for all 7 planets) don't render inside the host. moonDistanceAU
    // multipliers in log/schematic modes spread these out enough to
    // still read as separate bodies on screen.
    for (let i = 0; i < meta.planets.length; i++) {
      const planet = meta.planets[i];
      if (!planet.propagator) continue;
      const sv = planet.propagator.stateAt(jd);
      const len = sv.position.length();
      const scaledLen = this.scaler.moonDistanceAU(len);
      const scenePos = sv.position.clone();
      if (len > 0) scenePos.multiplyScalar(scaledLen / len);
      build.planets[i].mesh.setPosition(eclipticToScene(scenePos));
    }
  }

  /** Rebuild orbit-line geometry on scale-mode change. */
  rebuild(): void {
    if (!this.activeId) return;
    const build = this.cache.get(this.activeId);
    if (!build) return;
    for (const p of build.planets) p.orbit?.rebuild(this.scaler);
    // Host radius rebuild
    const meta = getExoplanetSystem(this.activeId);
    if (meta) {
      const r = this.scaler.radiusKm(meta.host.physical.radiusKm) * this.scaler.sunMultiplier();
      build.hostMesh.rebuildForRadius(r);
      const PLANET_VISIBILITY_BOOST = 5;
      for (let i = 0; i < meta.planets.length; i++) {
        const pr = this.scaler.radiusKm(meta.planets[i].physical.radiusKm) * PLANET_VISIBILITY_BOOST;
        build.planets[i].mesh.rebuildForRadius(pr);
      }
    }
  }

  private buildSystem(meta: ExoplanetSystemMeta): SystemBuild {
    const sysGroup = new Group();
    sysGroup.name = `exoplanet-system-${meta.id}`;

    // Host star — boost size with the same sun-multiplier the renderer
    // uses for our own sun, so the host is visually substantial even
    // for tiny M dwarfs like TRAPPIST-1.
    const hostR = this.scaler.radiusKm(meta.host.physical.radiusKm) * this.scaler.sunMultiplier();
    const hostMesh = new BodyMesh(meta.host, hostR);
    sysGroup.add(hostMesh.group);

    const planets: SystemBuild['planets'] = [];
    // Earth-sized exoplanets at this scale would be 1–2 px; bump by 30×
    // so the user can actually see them as discs orbiting the host.
    // Picked empirically — large enough that TRAPPIST-1 b–h read as a
    // chain of dots, small enough that they don't overlap the host.
    const PLANET_VISIBILITY_BOOST = 5;
    for (const planet of meta.planets) {
      const r = this.scaler.radiusKm(planet.physical.radiusKm) * PLANET_VISIBILITY_BOOST;
      const mesh = new BodyMesh(planet, r);
      hostMesh.group.add(mesh.group);

      let orbit: OrbitLine | null = null;
      if (planet.propagator?.elements) {
        orbit = new OrbitLine(planet.propagator.elements, {
          color: 0x88aaff,
          segments: 192,
          isMoon: true, // use moon-distance scale for tight orbits
        });
        orbit.rebuild(this.scaler);
        hostMesh.group.add(orbit.line);
      }

      planets.push({ mesh, orbit, propagator: planet.propagator });
    }

    // Habitable-zone disc (Kopparapu+2013 conservative bounds).
    // Renders as a faint green annulus on the orbital plane between
    // the Recent Venus and Early Mars edges. Sits behind the planet
    // dots (renderOrder = -1) so it doesn't fight the orbit lines.
    let hzDisc: Mesh | null = null;
    const hz = habitableZoneAU(meta.host.physical.radiusKm, meta.hostTeffK);
    if (hz) {
      // Same moon-distance scaling as the planet orbits, so the disc
      // lines up with which planet is "in" the green ring.
      const innerScene = this.scaler.moonDistanceAU(hz.innerAU);
      const outerScene = this.scaler.moonDistanceAU(hz.outerAU);
      const hzGeom = new RingGeometry(innerScene, outerScene, 96, 1);
      const hzMat = new MeshBasicMaterial({
        color: 0x46d97a,
        transparent: true,
        opacity: 0.15,
        depthWrite: false,
        side: 2,  // DoubleSide
        blending: AdditiveBlending,
      });
      hzDisc = new Mesh(hzGeom, hzMat);
      // Lay the disc flat on the orbital plane (XY in scene = ecliptic
      // XY in our convention; Three.js Y-up means we want the disc
      // normal to be Y, so rotate the default XY-plane geometry by
      // -π/2 around X).
      hzDisc.rotation.x = -Math.PI / 2;
      hzDisc.renderOrder = -1;
      hostMesh.group.add(hzDisc);
    }

    // Mercury's orbit overlay: dashed grey ring at 0.387 AU. Lets
    // the viewer instantly compare any exoplanet system's scale to
    // our solar system's innermost — for TRAPPIST-1 the dashed ring
    // sits well outside ALL 7 planets, which is the "look how
    // compact this is" moment. For Kepler-90 the ring sits inside
    // most planets, which is the equally interesting "look how far
    // these gas giants got" moment.
    const mercuryOrbitOverlay = buildMercuryOverlayLine(this.scaler);
    if (mercuryOrbitOverlay) hostMesh.group.add(mercuryOrbitOverlay);

    sysGroup.visible = false;
    return { group: sysGroup, hostMesh, planets, hzDisc, mercuryOrbitOverlay };
  }

  /** Total system count — used for diagnostics / future menu. */
  static availableSystemIds(): string[] {
    return EXOPLANET_SYSTEMS.map(s => s.id);
  }
}

/**
 * Build a dashed grey ring at Mercury's orbital semi-major axis
 * (0.387 AU), in the active scaler's moon-distance frame. Returned
 * as a plain Three.js Line so callers can attach it under the host
 * group and toggle visibility. Returns null if a degenerate radius
 * is computed.
 */
function buildMercuryOverlayLine(scaler: ScaleController): Line | null {
  const MERCURY_A_AU = 0.3871;
  const r = scaler.moonDistanceAU(MERCURY_A_AU);
  if (!Number.isFinite(r) || r <= 0) return null;
  const segments = 192;
  const positions: number[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = (i / segments) * 2 * Math.PI;
    // Lay the ring on the X-Z plane (Three.js Y-up; ecliptic plane
    // in our scene convention).
    positions.push(r * Math.cos(t), 0, r * Math.sin(t));
  }
  const geom = new BufferGeometry();
  geom.setAttribute('position', new Float32BufferAttribute(positions, 3));
  const mat = new LineDashedMaterial({
    color: 0x8a8a9c,
    dashSize: r * 0.05,
    gapSize: r * 0.03,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
  });
  const line = new Line(geom, mat);
  line.computeLineDistances();  // required for dashed rendering
  line.renderOrder = -0.5;
  return line;
}
