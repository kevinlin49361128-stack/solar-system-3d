import {
  AmbientLight,
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  Group,
  Line,
  LineBasicMaterial,
  PerspectiveCamera,
  Points,
  Scene,
  Vector3,
} from 'three';
import type { BodyDescriptor } from '../physics/types';
import { eclipticToScene } from '../physics/frame';
import { BodyMesh } from './BodyMesh';
import { OrbitLine } from './OrbitLine';
import { Belt } from './Belt';
import { createSunGroup } from './Sun';
import { createStarfield } from './Skybox';
import { StarMap } from './StarMap';
import { RealStarfield } from './RealStarfield';
import { AtmosphereSky } from './AtmosphereSky';
import { LocationPin } from './LocationPin';
import { MessierLayer } from './MessierLayer';
import { IAUBoundaries } from './IAUBoundaries';
import { LocalTerrain } from './LocalTerrain';
import { SpacecraftLayer } from './Spacecraft';
import { LagrangePointsLayer } from './LagrangePoints';
import type { ScaleController } from '../controls/ScaleController';
import type { SimulationClock } from '../time/SimulationClock';
import { gmstRad } from '../physics/topocentric';
import { buildNBodyFromDescriptors, NBodyAdapter, type NBodySimulation } from '../physics/nbody';
import { STARS_AND_PLANETS, SUN } from '../data/bodies';
import { MOONS } from '../data/moons';
import { DWARFS } from '../data/dwarfs';
import { BELTS } from '../data/belts';
import { COMETS } from '../data/comets';
import { ASTEROIDS } from '../data/asteroids';
// SatelliteLayer is lazy-loaded — see ensureSatellites() below. Importing
// only the type keeps satellite.js (~21 KB gz) out of the initial bundle.
// The chunk is fetched on the first observer-mode entry, where Earth-orbiting
// satellites are actually visible. Heliocentric users never download it.
import type { SatelliteLayer } from './SatelliteLayer';
import { RealismState } from './RealismSettings';
import { AtmosphereOverlay } from './AtmosphereOverlay';
import { MilkyWay } from './MilkyWay';
import { ZodiacalLight } from './ZodiacalLight';
import { MeteorShowers } from './MeteorShowers';
import { CometTails } from './CometTails';
import { CelestialGrids } from './CelestialGrids';
import { LunarMansionsLayer } from './LunarMansionsLayer';
import { GalacticDisk } from './GalacticDisk';
import { HygCloud } from './HygCloud';

interface BodyEntry {
  descriptor: BodyDescriptor;
  mesh: BodyMesh;
  orbit: OrbitLine | null;
  /** Where this body's group lives in the scene graph (sun root or parent body's group). */
  parentGroup: Group;
}

/**
 * Top-level orchestrator: builds the scene from data, updates positions each
 * frame from JD, and reacts to scale changes by rebuilding visuals.
 */
export class SolarSystem {
  readonly scene = new Scene();
  /** Heliocentric root: sun is at origin; planets are children. */
  private readonly heliocentric = new Group();

  private readonly bodies = new Map<string, BodyEntry>();
  private readonly belts: Belt[] = [];
  private readonly orbitsRoot = new Group();        // planet / dwarf orbits
  private readonly cometOrbitsRoot = new Group();   // comet + asteroid orbits (more chaotic, opt-in)
  private starfield: Points | null = null;
  private starMap: StarMap | null = null;
  private realStarfield: RealStarfield | null = null;
  private atmosphereSky: AtmosphereSky | null = null;
  private locationPin: LocationPin | null = null;
  private messierLayer: MessierLayer | null = null;
  private iauBoundaries: IAUBoundaries | null = null;
  private localTerrain: LocalTerrain | null = null;
  private spacecraft: SpacecraftLayer | null = null;
  private lagrangePoints: LagrangePointsLayer | null = null;
  private satellites: SatelliteLayer | null = null;
  private nbodySim: NBodySimulation | null = null;
  private atmosphereOverlay: AtmosphereOverlay | null = null;
  private milkyWay: MilkyWay | null = null;
  private zodiacalLight: ZodiacalLight | null = null;
  private meteorShowers: MeteorShowers | null = null;
  private cometTails: CometTails | null = null;
  private celestialGrids: CelestialGrids | null = null;
  private lunarMansions: LunarMansionsLayer | null = null;
  private galacticDisk: GalacticDisk | null = null;
  private hygCloud: HygCloud | null = null;
  readonly realism = new RealismState();
  private originalPropagators = new Map<string, import('../physics/types').OrbitPropagator | null>();

  /**
   * Sub-groups parented to a planet's group for hierarchical bodies (moons).
   * Moon distances use a different (much larger) scale than solar distances,
   * because at solar scale the Moon would be inside Earth's mesh.
   */
  private readonly moonOrbitsRoot = new Group();

  private lastJd: number;
  private prevScaleMode: string;
  private prevFrame: string;
  private orbitsVisible: boolean = true;
  private geocentricOrbits: Map<string, Line> = new Map();

  constructor(
    private scaler: ScaleController,
    clock: SimulationClock,
  ) {
    this.lastJd = clock.getJd();
    this.prevScaleMode = scaler.getMode();
    this.prevFrame = scaler.getFrame();

    // Lightweight random starfield as immediate fallback while the real
    // catalog loads; we hide it once the catalog is ready.
    this.starfield = createStarfield(2000);
    this.scene.add(this.starfield);

    this.realStarfield = new RealStarfield();
    this.scene.add(this.realStarfield.object);
    // Lazy-load: defer the 600 KB BSC catalogue fetch until the browser is
    // idle (or after 1.5 s, whichever comes first). On first paint this
    // shaves perceived load time noticeably; users in heliocentric view
    // never need the full catalogue anyway.
    const triggerLoad = () => {
      this.realStarfield!.load('/stars-bsc.json').then(() => {
        if (this.starfield) {
          const mat = this.starfield.material as { opacity: number };
          mat.opacity = 0;
          this.starfield.visible = false;
        }
      });
    };
    if ('requestIdleCallback' in window) {
      (window as { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => void })
        .requestIdleCallback?.(triggerLoad, { timeout: 1500 });
    } else {
      setTimeout(triggerLoad, 1500);
    }

    this.starMap = new StarMap();
    this.scene.add(this.starMap.points);
    this.scene.add(this.starMap.lines);
    this.scene.add(this.starMap.labels);

    this.messierLayer = new MessierLayer();
    this.scene.add(this.messierLayer.object);

    this.iauBoundaries = new IAUBoundaries();
    this.scene.add(this.iauBoundaries.object);
    this.iauBoundaries.load('/iau-boundaries.json');

    this.localTerrain = new LocalTerrain();
    this.scene.add(this.localTerrain.object);

    this.atmosphereSky = new AtmosphereSky();
    this.atmosphereSky.attach(this.scene);
    this.atmosphereOverlay = new AtmosphereOverlay();
    this.scene.add(this.atmosphereOverlay.mesh);
    this.milkyWay = new MilkyWay();
    this.scene.add(this.milkyWay.mesh);
    this.zodiacalLight = new ZodiacalLight();
    this.zodiacalLight.attach(this.scene);
    this.meteorShowers = new MeteorShowers();
    this.scene.add(this.meteorShowers.object);
    this.cometTails = new CometTails();
    this.scene.add(this.cometTails.object);
    this.celestialGrids = new CelestialGrids();
    this.scene.add(this.celestialGrids.object);
    this.lunarMansions = new LunarMansionsLayer();
    this.scene.add(this.lunarMansions.object);
    // 3D Milky Way disk — only visible at the galactic tier of the
    // scale-tier zoom-out. Lazy-built once the layer is requested so it
    // doesn't burn ~30k vertex-buffer entries on first paint.
    this.galacticDisk = new GalacticDisk();
    this.scene.add(this.galacticDisk.group);
    // HYG 3D point cloud — created here but data is lazy-loaded the
    // first time the neighbourhood tier is requested (~600 KB JSON).
    this.hygCloud = new HygCloud();
    this.scene.add(this.hygCloud.group);
    // Ambient kept low so the day/night terminator on textured planets is
    // visible, but high enough to make the night side faintly readable.
    this.scene.add(new AmbientLight(0x6878a0, 0.55));

    this.scene.add(this.heliocentric);
    this.heliocentric.add(this.orbitsRoot);
    this.heliocentric.add(this.cometOrbitsRoot);
    this.heliocentric.add(this.moonOrbitsRoot);
    this.cometOrbitsRoot.visible = false; // off by default — opt-in to declutter

    this.buildSun();
    this.buildPlanets();
    this.buildDwarfs();
    this.buildComets();
    this.buildMoons();
    this.buildBelts();

    this.spacecraft = new SpacecraftLayer(this.scaler);
    this.heliocentric.add(this.spacecraft.group);

    // Lagrange points (L1–L5) for Sun–Earth, Sun–Jupiter, Earth–Moon.
    // Built from the live body registry so positions track each frame.
    const descriptorMap = new Map<string, BodyDescriptor>();
    for (const [id, entry] of this.bodies) descriptorMap.set(id, entry.descriptor);
    this.lagrangePoints = new LagrangePointsLayer(this.scaler, descriptorMap);
    this.lagrangePoints.setVisible(false); // off by default — opt-in
    this.heliocentric.add(this.lagrangePoints.group);

    // Earth-orbiting satellites are NOT constructed here — see
    // ensureSatellites(). At heliocentric scale the LEO constellation is
    // sub-pixel anyway; only observer-mode users need it.

    this.update(clock.getJd());
  }

  /**
   * Lazy-load and construct the SatelliteLayer. Called on first observer-mode
   * entry. Subsequent calls are no-ops (memoized). The async chunk fetch
   * (satellite.js ~21 KB gz) typically completes in 100–300 ms; until then
   * `this.satellites` stays null and `update()` skips the satellite step.
   */
  private satellitesPromise: Promise<void> | null = null;
  ensureSatellites(): Promise<void> {
    if (this.satellitesPromise) return this.satellitesPromise;
    this.satellitesPromise = (async () => {
      const { SatelliteLayer } = await import('./SatelliteLayer');
      this.satellites = new SatelliteLayer();
      const earthBody = this.bodies.get('earth');
      if (earthBody) earthBody.mesh.group.add(this.satellites.object);
      // Apply current visibility state from the toggle, since the user may
      // have flipped it during the load.
      const toggle = document.getElementById('toggle-satellites') as HTMLInputElement | null;
      if (toggle) this.satellites.setVisible(toggle.checked);
    })();
    return this.satellitesPromise;
  }

  private buildSun(): void {
    const r = this.scaler.radiusKm(SUN.physical.radiusKm) * this.scaler.sunMultiplier();

    // BodyMesh creates an inner sphere (we hide it) + label + pickable.
    // We then add the actual emissive sphere + glow + PointLight into the same group,
    // so the whole thing moves/positions/picks as one unit at the origin.
    const mesh = new BodyMesh(SUN, r);
    mesh.mesh.visible = false;
    const { core, glow, light } = createSunGroup(r);
    mesh.group.add(core);
    mesh.group.add(glow);
    mesh.group.add(light);

    this.heliocentric.add(mesh.group);

    this.bodies.set(SUN.id, {
      descriptor: SUN,
      mesh,
      orbit: null,
      parentGroup: this.heliocentric,
    });
  }

  private buildPlanets(): void {
    for (const body of STARS_AND_PLANETS) {
      if (body.id === 'sun') continue;
      this.addSolarBody(body);
    }
  }

  private buildDwarfs(): void {
    for (const body of DWARFS) {
      this.addSolarBody(body);
    }
  }

  private buildComets(): void {
    for (const body of COMETS) {
      this.addSolarBody(body);
    }
    for (const body of ASTEROIDS) {
      this.addSolarBody(body);
    }
  }

  /**
   * Add a body at runtime (e.g. from a Horizons fetch). Same code path as
   * the constructor's body builders. Returns true if added; false if a body
   * with the same id already exists.
   */
  addRuntimeBody(body: BodyDescriptor): boolean {
    if (this.bodies.has(body.id)) return false;
    this.addSolarBody(body);
    return true;
  }

  /** Remove a previously-added runtime body by id. */
  removeRuntimeBody(id: string): boolean {
    const entry = this.bodies.get(id);
    if (!entry) return false;
    this.heliocentric.remove(entry.mesh.group);
    if (entry.orbit) {
      this.orbitsRoot.remove(entry.orbit.line);
      this.cometOrbitsRoot.remove(entry.orbit.line);
    }
    this.bodies.delete(id);
    return true;
  }

  private addSolarBody(body: BodyDescriptor): void {
    const r = this.scaler.radiusKm(body.physical.radiusKm);
    const mesh = new BodyMesh(body, r);
    this.heliocentric.add(mesh.group);

    let orbit: OrbitLine | null = null;
    if (body.propagator?.elements) {
      orbit = new OrbitLine(body.propagator.elements, { color: orbitColor(body), segments: 256 });
      orbit.rebuild(this.scaler);
      // Comets + asteroids land in their own group so users can toggle them
      // independently of the (much tidier) planet/dwarf orbit set.
      const target = body.category === 'comet' ? this.cometOrbitsRoot : this.orbitsRoot;
      target.add(orbit.line);
    }

    this.bodies.set(body.id, {
      descriptor: body,
      mesh,
      orbit,
      parentGroup: this.heliocentric,
    });
  }

  private buildMoons(): void {
    for (const moon of MOONS) {
      const parent = this.bodies.get(moon.parentId!);
      if (!parent) continue;

      const r = this.scaler.radiusKm(moon.physical.radiusKm);
      const mesh = new BodyMesh(moon, r);
      parent.mesh.group.add(mesh.group);

      let orbit: OrbitLine | null = null;
      if (moon.propagator?.elements) {
        orbit = new OrbitLine(moon.propagator.elements, {
          color: 0x6a7a8a,
          segments: 96,
          isMoon: true,
        });
        orbit.rebuild(this.scaler);
        parent.mesh.group.add(orbit.line);
      }

      this.bodies.set(moon.id, {
        descriptor: moon,
        mesh,
        orbit,
        parentGroup: parent.mesh.group,
      });
    }
  }

  private buildBelts(): void {
    for (const def of BELTS) {
      const belt = new Belt(def);
      this.belts.push(belt);
      this.heliocentric.add(belt.mesh);
    }
  }

  // ------------------------------------------------------------------------
  // Update loop
  // ------------------------------------------------------------------------

  update(jd: number): void {
    const dDays = jd - this.lastJd;
    this.lastJd = jd;

    // In geocentric mode, all heliocentric bodies have Earth's position
    // subtracted before scaling — Earth ends up at origin, Sun ~1 AU on the
    // opposite side, and outer planets trace epicycle loops over time.
    const isGeocentric = this.scaler.getFrame() === 'geocentric';
    let earthHelioPos: Vector3 | null = null;
    if (isGeocentric) {
      const earth = this.bodies.get('earth');
      if (earth?.descriptor.propagator) {
        earthHelioPos = earth.descriptor.propagator.stateAt(jd).position.clone();
      }
    }

    for (const entry of this.bodies.values()) {
      const desc = entry.descriptor;

      // Sun has no propagator — in geocentric mode we still need to position
      // it at -earthHelioPos (scaled). Heliocentric mode leaves it at origin.
      if (desc.id === 'sun') {
        if (isGeocentric && earthHelioPos) {
          const sunGeoPos = earthHelioPos.clone().multiplyScalar(-1);
          const len = sunGeoPos.length();
          const scaledLen = this.scaler.distanceAU(len);
          if (len > 0) sunGeoPos.multiplyScalar(scaledLen / len);
          entry.mesh.setPosition(eclipticToScene(sunGeoPos));
        } else {
          entry.mesh.setPosition(new Vector3(0, 0, 0));
        }
        entry.mesh.advanceRotation(dDays);
        continue;
      }

      if (!desc.propagator) continue;

      const sv = desc.propagator.stateAt(jd);
      const isMoon = desc.category === 'moon';

      // Geocentric transformation: subtract Earth's heliocentric position from
      // any non-moon body. (Moons stay relative to their parent — handled by
      // the scene-graph parent transform.)
      let pos = sv.position;
      if (isGeocentric && earthHelioPos && !isMoon) {
        pos = pos.clone().sub(earthHelioPos);
      }

      const len = pos.length();
      const scaledLen = isMoon
        ? this.scaler.moonDistanceAU(len)
        : this.scaler.distanceAU(len);

      const scenePos = pos.clone();
      if (len > 0) scenePos.multiplyScalar(scaledLen / len);
      const out = eclipticToScene(scenePos);
      entry.mesh.setPosition(out);

      // Earth: lock rotation to GMST so the texture aligns with topocentric
      // observer math. Other bodies just spin at their natural rate.
      if (desc.id === 'earth') {
        entry.mesh.setRotationAngle(gmstRad(jd));
      } else {
        entry.mesh.advanceRotation(dDays);
      }

      // Moon: apply optical libration so we see slightly more than 50% of the
      // surface over the synodic month. Simple sinusoidal approximation.
      if (desc.id === 'moon') {
        const Tdays = jd - 2451545.0;
        // Libration in longitude: ±7.9° with anomalistic month period ~27.55 d
        const libLonDeg = 7.9 * Math.sin((2 * Math.PI / 27.55) * Tdays);
        // Libration in latitude: ±6.7° with draconic month period ~27.21 d
        const libLatDeg = 6.7 * Math.sin((2 * Math.PI / 27.21) * Tdays);
        entry.mesh.setLibration(libLatDeg * Math.PI / 180, libLonDeg * Math.PI / 180);
      }
    }

    for (const belt of this.belts) {
      belt.update(jd, this.scaler);
    }

    if (this.spacecraft) this.spacecraft.update(jd);
    if (this.lagrangePoints) this.lagrangePoints.update(jd);
    if (this.cometTails) this.cometTails.update(jd, this.scaler);
    if (this.satellites) {
      // Sun direction in ecliptic frame, as seen from Earth (for shadow test).
      // Heliocentric: sunHelio = origin → sun is at (0,0,0); from earth, the
      // direction *to* the sun is (sun - earth) → in ecliptic that's just
      // -earthHelio. We pass a unit vector.
      const earthEntry = this.bodies.get('earth');
      const earthPropagator = earthEntry?.descriptor.propagator;
      let sunDirEcl: Vector3 | undefined;
      if (earthPropagator) {
        const sv = earthPropagator.stateAt(jd);
        sunDirEcl = sv.position.clone().multiplyScalar(-1).normalize();
      }
      this.satellites.update(jd, this.scaler, sunDirEcl);
    }

    if (this.scaler.getMode() !== this.prevScaleMode) {
      this.handleScaleChange();
      this.prevScaleMode = this.scaler.getMode();
    }
    if (this.scaler.getFrame() !== this.prevFrame) {
      this.handleFrameChange();
      this.prevFrame = this.scaler.getFrame();
    }
  }

  private handleScaleChange(): void {
    for (const entry of this.bodies.values()) {
      const r = this.scaler.radiusKm(entry.descriptor.physical.radiusKm);
      const finalR = entry.descriptor.id === 'sun' ? r * this.scaler.sunMultiplier() : r;
      entry.mesh.rebuildForRadius(finalR);
      if (entry.orbit) entry.orbit.rebuild(this.scaler);
    }
    // Geocentric trajectory lines depend on scale → rebuild them too.
    if (this.scaler.getFrame() === 'geocentric') this.buildGeocentricOrbitLines();
    if (this.spacecraft) this.spacecraft.rebuild();
    if (this.lagrangePoints) this.lagrangePoints.rebuild(this.lastJd);
    this.refreshLocationPin();
  }

  private handleFrameChange(): void {
    const isGeo = this.scaler.getFrame() === 'geocentric';
    // Toggle the analytic Kepler ellipses (only valid heliocentrically).
    for (const entry of this.bodies.values()) {
      if (entry.orbit) entry.orbit.line.visible = !isGeo && this.orbitsVisible;
    }
    // Show/hide / rebuild geocentric trajectory lines.
    if (isGeo) {
      this.buildGeocentricOrbitLines();
    } else {
      this.disposeGeocentricOrbitLines();
    }
  }

  private buildGeocentricOrbitLines(): void {
    this.disposeGeocentricOrbitLines();
    const earth = this.bodies.get('earth');
    if (!earth?.descriptor.propagator) return;
    const earthProp = earth.descriptor.propagator;
    const earthPeriod = 365.25;
    const jdNow = this.lastJd || 2451545.0;

    for (const [id, entry] of this.bodies) {
      if (id === 'earth') continue;
      if (entry.descriptor.category === 'moon') continue;
      const prop = entry.descriptor.propagator;
      if (!prop) {
        // Sun gets a special straight-back orbit: 1-year ellipse around Earth
        // (mirror image of Earth's heliocentric orbit). Build it like other bodies
        // so the user sees the apparent solar path.
        if (id === 'sun') {
          const verts: number[] = [];
          const sampleDays = earthPeriod;
          const steps = 200;
          for (let i = 0; i <= steps; i++) {
            const jd = jdNow - sampleDays / 2 + (i / steps) * sampleDays;
            const ep = earthProp.stateAt(jd).position;
            const sunGeo = ep.clone().multiplyScalar(-1);
            const len = sunGeo.length();
            const scaledLen = this.scaler.distanceAU(len);
            if (len > 0) sunGeo.multiplyScalar(scaledLen / len);
            const p = eclipticToScene(sunGeo);
            verts.push(p.x, p.y, p.z);
          }
          this.addGeocentricLine(id, verts, orbitColor(entry.descriptor), entry.descriptor.category);
        }
        continue;
      }
      const period = prop.elements?.periodDays ?? 365;
      // Synodic period = how often the body returns to same phase relative
      // to Earth = how often the apparent loop pattern repeats.
      const synodic = Math.abs(1 / Math.abs(1 / period - 1 / earthPeriod));
      const sampleDays = Math.max(120, Math.min(synodic, 1200));
      const steps = 240;
      const verts: number[] = [];
      for (let i = 0; i <= steps; i++) {
        const jd = jdNow - sampleDays / 2 + (i / steps) * sampleDays;
        const bp = prop.stateAt(jd).position;
        const ep = earthProp.stateAt(jd).position;
        const rel = bp.clone().sub(ep);
        const len = rel.length();
        const scaledLen = this.scaler.distanceAU(len);
        if (len > 0) rel.multiplyScalar(scaledLen / len);
        const p = eclipticToScene(rel);
        verts.push(p.x, p.y, p.z);
      }
      this.addGeocentricLine(id, verts, orbitColor(entry.descriptor), entry.descriptor.category);
    }
  }

  private addGeocentricLine(id: string, verts: number[], color: number, category: BodyDescriptor['category']): void {
    const geom = new BufferGeometry();
    geom.setAttribute('position', new Float32BufferAttribute(verts, 3));
    const mat = new LineBasicMaterial({
      color, transparent: true, opacity: 0.55, depthWrite: false,
    });
    const line = new Line(geom, mat);
    line.frustumCulled = false;
    line.visible = this.orbitsVisible;
    this.geocentricOrbits.set(id, line);
    const target = category === 'comet' ? this.cometOrbitsRoot : this.orbitsRoot;
    target.add(line);
  }

  private disposeGeocentricOrbitLines(): void {
    for (const line of this.geocentricOrbits.values()) {
      // Lines may have been added to either parent — let parent removal happen
      // automatically via Object3D's parent tracking.
      line.parent?.remove(line);
      line.geometry.dispose();
      (line.material as LineBasicMaterial).dispose();
    }
    this.geocentricOrbits.clear();
  }

  // ------------------------------------------------------------------------
  // Public accessors
  // ------------------------------------------------------------------------

  getBody(id: string): BodyEntry | undefined {
    return this.bodies.get(id);
  }

  getAllBodies(): BodyEntry[] {
    return Array.from(this.bodies.values());
  }

  getPickableMeshes(): { object: any; bodyId: string }[] {
    const list: { object: any; bodyId: string }[] = [];
    for (const entry of this.bodies.values()) {
      list.push({ object: entry.mesh.pickable, bodyId: entry.descriptor.id });
    }
    return list;
  }

  setOrbitsVisible(visible: boolean): void {
    this.orbitsVisible = visible;
    this.orbitsRoot.visible = visible;
    for (const entry of this.bodies.values()) {
      if (entry.descriptor.category === 'moon' && entry.orbit) {
        entry.orbit.setVisible(visible);
      }
    }
  }

  /**
   * Comet + asteroid orbits live in their own group so the user can keep
   * them off by default — their high eccentricity / inclination makes the
   * planet view look like a tangle when shown together.
   */
  setCometOrbitsVisible(visible: boolean): void {
    this.cometOrbitsRoot.visible = visible;
  }

  setLabelsVisible(visible: boolean): void {
    for (const entry of this.bodies.values()) {
      entry.mesh.setLabelVisible(visible);
    }
  }

  /**
   * Keep all label sprites at constant pixel size by reverse-projecting
   * camera distance into world units each frame.
   */
  private readonly _tmpLabelPos = new Vector3();
  updateLabelSizes(camera: PerspectiveCamera, canvasHeightPx: number): void {
    const fovRad = (camera.fov * Math.PI) / 180;
    for (const entry of this.bodies.values()) {
      entry.mesh.group.getWorldPosition(this._tmpLabelPos);
      const dist = this._tmpLabelPos.distanceTo(camera.position);
      entry.mesh.updateLabelScreenSize(dist, fovRad, canvasHeightPx);
    }
  }

  setBeltsVisible(visible: boolean): void {
    for (const belt of this.belts) belt.setVisible(visible);
  }

  /** Set the starfield's overall opacity (1 = fully visible, 0 = invisible). */
  setStarfieldOpacity(opacity: number): void {
    if (this.realStarfield) this.realStarfield.setOpacity(opacity);
    if (this.starMap) this.starMap.setOpacity(opacity);
    if (this.messierLayer) this.messierLayer.setOpacity(opacity);
  }

  setMessierVisible(visible: boolean): void {
    if (this.messierLayer) this.messierLayer.setVisible(visible);
  }

  setMessierStylized(stylized: boolean): void {
    if (this.messierLayer) this.messierLayer.setStylized(stylized);
  }

  setMessierRealAngularSize(enabled: boolean): void {
    if (this.messierLayer) this.messierLayer.setRealAngularSize(enabled);
  }

  updateMessierAngularScale(fovDeg: number, canvasHeight: number): void {
    if (this.messierLayer) this.messierLayer.updateAngularScale(fovDeg, canvasHeight);
  }

  getMessierLayer(): MessierLayer | null { return this.messierLayer; }

  setIAUBoundariesVisible(visible: boolean): void {
    if (this.iauBoundaries) this.iauBoundaries.setVisible(visible);
  }

  getLocalTerrain(): LocalTerrain | null { return this.localTerrain; }

  setConstellationsVisible(visible: boolean): void {
    if (this.starMap) this.starMap.setLinesVisible(visible);
  }

  setStarLabelsVisible(visible: boolean): void {
    if (this.starMap) this.starMap.setLabelsVisible(visible);
  }

  setStarfieldMagnitudeLimit(magLimit: number): void {
    if (this.realStarfield) this.realStarfield.setMagnitudeLimit(magLimit);
  }

  setBortleScale(bortle: number): void {
    if (this.realStarfield) this.realStarfield.setBortleScale(bortle);
    if (this.milkyWay) this.milkyWay.setBortle(bortle);
    if (this.atmosphereOverlay) this.atmosphereOverlay.setBortle(bortle);
  }

  getRealStarfield(): RealStarfield | null { return this.realStarfield; }
  getSatelliteLayer(): SatelliteLayer | null { return this.satellites; }
  getAtmosphereOverlay(): AtmosphereOverlay | null { return this.atmosphereOverlay; }

  setMilkyWayVisible(visible: boolean): void {
    if (this.milkyWay) this.milkyWay.setVisible(visible);
  }
  setMilkyWayBortle(bortle: number): void {
    if (this.milkyWay) this.milkyWay.setBortle(bortle);
  }
  setGridVisible(kind: 'equatorial' | 'ecliptic' | 'galactic' | 'horizontal', v: boolean): void {
    this.celestialGrids?.setVisible(kind, v);
  }
  getCelestialGrids(): CelestialGrids | null { return this.celestialGrids; }
  setLunarMansionsVisible(v: boolean): void {
    this.lunarMansions?.setVisible(v);
  }
  setZodiacalLightVisible(v: boolean): void { this.zodiacalLight?.setVisible(v); }
  setMeteorShowersVisible(v: boolean): void { this.meteorShowers?.setVisible(v); }
  getZodiacalLight(): ZodiacalLight | null { return this.zodiacalLight; }
  getMeteorShowers(): MeteorShowers | null { return this.meteorShowers; }

  setSpacecraftVisible(visible: boolean): void {
    if (this.spacecraft) this.spacecraft.setVisible(visible);
  }

  /**
   * Fade the entire heliocentric layer (sun + planets + moons + asteroids
   * + spacecraft + Lagrange overlay) by setting Group.visible. Used by the
   * scale-tier zoom-out animation: when the camera retreats to the local
   * stellar neighbourhood, the solar-system meshes are no longer
   * meaningfully visible (sub-pixel) and continuing to render them just
   * wastes draw calls and can produce z-fighting artefacts.
   *
   * Opacity 0 → group hidden; opacity > 0 → group visible. We don't try
   * to interpolate per-mesh material opacity here because that would
   * require touching every BodyMesh / OrbitLine / Belt material, and the
   * crossfade duration is short enough that a hard hide/show is fine.
   */
  setSolarSystemOpacity(opacity: number): void {
    this.heliocentric.visible = opacity > 0.05;
  }

  /** Galactic-tier 3D Milky Way disk visibility. */
  setGalacticDiskOpacity(opacity: number): void {
    this.galacticDisk?.setOpacity(opacity);
  }

  /**
   * Neighbourhood-tier HYG point cloud visibility. Triggers lazy data
   * fetch on first non-zero opacity (idempotent) so the ~600 KB JSON
   * isn't paid by users who never zoom out.
   */
  setHygCloudOpacity(opacity: number): void {
    if (!this.hygCloud) return;
    if (opacity > 0 && !this.hygCloud.isLoaded()) {
      void this.hygCloud.load();
    }
    this.hygCloud.setOpacity(opacity);
  }

  setLagrangePointsVisible(visible: boolean): void {
    if (this.lagrangePoints) {
      this.lagrangePoints.setVisible(visible);
      // Force one update so markers snap to current positions when shown.
      if (visible) this.lagrangePoints.update(this.lastJd);
    }
  }

  getLagrangePoints(): LagrangePointsLayer | null {
    return this.lagrangePoints;
  }

  setSatellitesVisible(visible: boolean): void {
    if (this.satellites) this.satellites.setVisible(visible);
  }

  /**
   * Switch every heliocentric body's propagator to a shared N-body simulation
   * sampled from the current Kepler state at `jd`. Reverse with disableNBody().
   */
  enableNBody(jd: number): void {
    if (this.nbodySim) return;
    const allDescs = [...STARS_AND_PLANETS, ...DWARFS];
    this.nbodySim = buildNBodyFromDescriptors(allDescs, jd);
    for (const d of allDescs) {
      if (d.id === 'sun') continue;
      this.originalPropagators.set(d.id, d.propagator);
      (d as { propagator: import('../physics/types').OrbitPropagator | null })
        .propagator = new NBodyAdapter(this.nbodySim, d.id, d.propagator);
    }
  }

  disableNBody(): void {
    if (!this.nbodySim) return;
    for (const [id, prop] of this.originalPropagators) {
      const d = [...STARS_AND_PLANETS, ...DWARFS].find(x => x.id === id);
      if (d) (d as { propagator: import('../physics/types').OrbitPropagator | null }).propagator = prop;
    }
    this.originalPropagators.clear();
    this.nbodySim = null;
  }

  isNBodyEnabled(): boolean { return this.nbodySim !== null; }

  /**
   * Switch the N-body integrator. 'verlet' = 2nd order (default, fast);
   * 'yoshida4' = 4th order symplectic (slower but ~10× more accurate).
   * No-op if N-body is not currently enabled.
   */
  setNBodyIntegrator(kind: 'verlet' | 'yoshida4'): void {
    if (this.nbodySim) this.nbodySim.integrator = kind;
  }
  /**
   * Toggle post-Newtonian (Schwarzschild) correction on the N-body sim.
   * Adds Mercury's 43"/century perihelion precession + smaller GR effects
   * on the other inner planets. Negligible cost.
   */
  setNBodyRelativistic(enabled: boolean): void {
    if (this.nbodySim) this.nbodySim.relativisticGR = enabled;
  }
  getNBodyIntegrator(): 'verlet' | 'yoshida4' {
    return this.nbodySim?.integrator ?? 'verlet';
  }
  getNBodyRelativistic(): boolean {
    return this.nbodySim?.relativisticGR ?? false;
  }
  /** Returns the live N-body simulation, or null if not currently enabled.
   *  Used by the diagnostics panel to read conservation quantities. */
  getNBodySimulation(): NBodySimulation | null { return this.nbodySim; }

  setBackgroundColor(color: Color): void {
    this.scene.background = color.clone();
  }

  getAtmosphereSky(): AtmosphereSky | null { return this.atmosphereSky; }

  /**
   * Show / move the location pin on Earth at given lat/lon.
   * Pin auto-attaches to Earth's mesh, inheriting its rotation and tilt.
   */
  setLocationPin(latDeg: number, lonDeg: number): void {
    const earth = this.bodies.get('earth');
    if (!earth) return;
    if (!this.locationPin) this.locationPin = new LocationPin();
    const r = this.scaler.radiusKm(earth.descriptor.physical.radiusKm);
    this.locationPin.attachTo(earth.mesh.mesh, r);
    this.locationPin.setLatLon(latDeg, lonDeg);
    this.locationPin.show();
  }

  hideLocationPin(): void {
    if (this.locationPin) this.locationPin.hide();
  }

  /** Update pin's body radius when scale mode changes. */
  refreshLocationPin(): void {
    if (!this.locationPin) return;
    const earth = this.bodies.get('earth');
    if (!earth) return;
    const r = this.scaler.radiusKm(earth.descriptor.physical.radiusKm);
    this.locationPin.setBodyRadius(r);
  }

  /**
   * Compute world-space position of a body for camera-follow. Walks up the
   * parent chain since moons are nested under planet groups.
   */
  getWorldPosition(id: string, target: Vector3): Vector3 | null {
    const entry = this.bodies.get(id);
    if (!entry) return null;
    return entry.mesh.group.getWorldPosition(target);
  }

  /** Body's current scene-units radius (depends on scale mode). */
  getBodyRadius(id: string): number | null {
    const entry = this.bodies.get(id);
    if (!entry) return null;
    const r = this.scaler.radiusKm(entry.descriptor.physical.radiusKm);
    return entry.descriptor.id === 'sun' ? r * this.scaler.sunMultiplier() : r;
  }

  /**
   * Pick a body by projecting each body's centre to screen-space and finding
   * the closest one within `thresholdPx` of the cursor. Solves the problem
   * that geometrical raycast hits are essentially impossible for sub-pixel
   * dwarf planets and moons, especially in real scale.
   */
  private readonly _tmpPickPos = new Vector3();
  private readonly _tmpPickProj = new Vector3();
  pickByScreenPosition(
    cursorX: number,
    cursorY: number,
    camera: import('three').Camera,
    canvasRect: { left: number; top: number; width: number; height: number },
    thresholdPx: number = 30,
  ): string | null {
    let bestId: string | null = null;
    let bestScore = thresholdPx;
    let bestDepth = Infinity;

    for (const entry of this.bodies.values()) {
      entry.mesh.group.getWorldPosition(this._tmpPickPos);
      this._tmpPickProj.copy(this._tmpPickPos).project(camera);
      // Behind near plane or outside NDC z range.
      if (this._tmpPickProj.z < -1 || this._tmpPickProj.z > 1) continue;

      const sx = (this._tmpPickProj.x + 1) * 0.5 * canvasRect.width + canvasRect.left;
      const sy = (-this._tmpPickProj.y + 1) * 0.5 * canvasRect.height + canvasRect.top;
      const dist = Math.hypot(sx - cursorX, sy - cursorY);

      if (dist < bestScore) {
        const depth = this._tmpPickPos.distanceToSquared(camera.position);
        bestScore = dist;
        bestDepth = depth;
        bestId = entry.descriptor.id;
      } else if (dist < thresholdPx && dist === bestScore) {
        const depth = this._tmpPickPos.distanceToSquared(camera.position);
        if (depth < bestDepth) {
          bestDepth = depth;
          bestId = entry.descriptor.id;
        }
      }
    }
    return bestId;
  }
}

function orbitColor(body: BodyDescriptor): number {
  switch (body.category) {
    case 'planet': return 0x5a8ec2;
    case 'dwarf': return 0x9c7aa8;
    case 'comet': return 0x6fc5d8;
    default: return 0x4a6a8a;
  }
}
