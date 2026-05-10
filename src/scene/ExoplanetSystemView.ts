import { Group, Vector3 } from 'three';
import { BodyMesh } from './BodyMesh';
import { OrbitLine } from './OrbitLine';
import { eclipticToScene } from '../physics/frame';
import {
  EXOPLANET_SYSTEMS,
  getExoplanetSystem,
  type ExoplanetSystemMeta,
} from '../data/exoplanetSystems';
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
    if (!build) {
      build = this.buildSystem(meta);
      this.cache.set(id, build);
      this.group.add(build.group);
    }
    build.group.visible = true;
    this.group.visible = true;
    this.activeId = id;
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

    sysGroup.visible = false;
    return { group: sysGroup, hostMesh, planets };
  }

  /** Total system count — used for diagnostics / future menu. */
  static availableSystemIds(): string[] {
    return EXOPLANET_SYSTEMS.map(s => s.id);
  }
}
