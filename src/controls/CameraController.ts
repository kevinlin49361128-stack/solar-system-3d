import { PerspectiveCamera, Vector3 } from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { SolarSystem } from '../scene/SolarSystem';
import type { SimulationClock } from '../time/SimulationClock';
import {
  observerEcliptic, dirToAltAz, raDecToEcliptic, atmosphericRefractionDeg,
  applyProperMotion, applyAberration,
} from '../physics/topocentric';
import { eclipticToScene } from '../physics/frame';
import { AU_KM } from '../physics/constants';

export type CameraMode = 'free' | 'top' | 'follow' | 'observer';

export class CameraController {
  readonly camera: PerspectiveCamera;
  readonly orbit: OrbitControls;
  private mode: CameraMode = 'free';
  private followId: string | null = null;

  // Observer-mode state (defaults to Kaohsiung; UI overrides on enter)
  private observerLat: number = 22.6273;
  private observerLon: number = 120.3014;
  /**
   * Site elevation above the WGS-84 ellipsoid (m). Default 0 for cities
   * where elevation isn't tracked; observatory presets pass real values
   * (e.g. Mauna Kea 4205, Paranal 2635, South Pole Station 2835).
   */
  private observerElevationM: number = 0;
  private observerAz: number = 0;
  private observerAlt: number = Math.PI / 4;
  private observerDragging: boolean = false;
  private observerDragLast: { x: number; y: number } | null = null;
  private observerLockHorizon: boolean = true;
  /**
   * If non-null, observer-mode update() will re-aim the view at this body
   * each frame. Doubles as Stellarium-style "follow target" — useful for
   * watching the ISS pass or a planet rise. Set via setObserverFollow().
   */
  private observerFollowId: string | null = null;
  private observerFovDeg: number = 50;
  private static readonly DEFAULT_FOV_DEG = 50;
  private static readonly OBSERVER_FOV_MIN = 0.2;  // sub-1° permits high-power eyepieces
  private static readonly OBSERVER_FOV_MAX = 110;  // ~ wide-angle

  /**
   * Observer eye height above the local ground (m). The LocalTerrain mesh
   * is positioned this far below the camera (see main's positionAt call)
   * so the camera looks *down* onto the mesh rather than along its plane.
   *
   * Camera altitude above Earth's centre is computed as
   *   earthRadius + (siteElevation + EYE_HEIGHT) / AU_KM
   * — the simulator no longer uses a uniform "+637 m" factor; site
   * elevation comes from each preset (Mauna Kea 4205 m, Paranal 2635 m,
   * sea-level cities 0 m) so horizon distance, atmospheric depth, and
   * apparent altitudes of nearby ground objects match reality.
   *
   * 5 m matches a standing observer on a telescope deck; with camera near
   * plane at 1.5 m, observatory domes 30–100 m away render without
   * near-clip issues and appear at sensible (~−5 to −15°) altitudes.
   */
  /**
   * Observer's eye height above the local ground (m). Used for camera
   * positioning in observer mode — the camera sits at observerElevationM +
   * OBSERVER_EYE_HEIGHT_M above mean-sea-level Earth radius.
   *
   * Bumped from a literal-realistic 5 m to 100 m as a render-quality
   * workaround: at the literal eye height, the camera ends up 5 m above
   * Earth's spherical mesh, which is too close for the AtmosphereSky
   * cube + Earth ball + LocalTerrain meshes to compose cleanly. The
   * Sky shader's below-horizon clamp (`max(0, dot(up, direction))`)
   * leaks the horizon's pale-bright colour into the lower hemisphere,
   * showing through Earth's transparent observer-fade region as a
   * bright "ground = sky" band beyond the LocalTerrain mesh's edge.
   *
   * 100 m gives the depth buffer ~700× headroom over the new 1e-9 AU
   * near plane (vs ~33× at 5 m), which empirically resolves the leak
   * without affecting any astronomical computation:
   *   - Bennett refraction is parameterised by atmospheric pressure
   *     (set independently from the panel), not directly by altitude.
   *   - Sun/moon rise-set times shift by ~12 s for 100 m vs 0 m, well
   *     below our quoted ±1-2 min precision band.
   *   - Sub-degree alt/az accuracy is unaffected.
   *
   * Practical effect: the user is rendered "as if standing on a 100 m
   * hill at the chosen lat/lon". For city-centre lat/lons this is
   * indistinguishable from the literal site at the visual scales the
   * scene operates on.
   */
  static readonly OBSERVER_EYE_HEIGHT_M = 100;

  // Gyroscope (AR-style) state — driven by DeviceOrientationEvent on phones.
  private gyroEnabled: boolean = false;
  private gyroOffsetAzDeg: number = 0; // calibration offset (true north - device 0)
  private gyroSmoothAzDeg: number = 0;
  private gyroSmoothAltDeg: number = 0;
  private gyroInitialised: boolean = false;
  private gyroHandler: ((e: DeviceOrientationEvent) => void) | null = null;

  private readonly tmpTarget = new Vector3();
  private prevTarget = new Vector3();
  private readonly _tmpEarthPos = new Vector3();
  private readonly _tmpUp = new Vector3();
  private readonly _tmpEast = new Vector3();
  private readonly _tmpNorth = new Vector3();
  private readonly _tmpDir = new Vector3();
  private readonly _tmpLook = new Vector3();

  constructor(
    canvas: HTMLElement,
    private solarSystem: SolarSystem,
    private clock: SimulationClock,
  ) {
    // Very small near + log depth buffer covers the huge dynamic range of
    // solar-system scales (sub-mm to thousands of AU) without z-fighting.
    // 1e-11 scene units ≈ 1.5 m — small enough to render observer-mode
    // 3D objects close to the camera (telescope domes 30-100 m away)
    // without near-plane clipping.
    // Near plane at 1e-9 AU ≈ 15 cm. Earlier value of 1e-11 (~1.5 mm)
    // caused catastrophic depth-precision loss in observer mode at sea
    // level: with the eye 5 m above Earth's surface, both the Earth mesh
    // and the Sky cube ended up at near-identical depth values (1.0 - eps),
    // depth tests became coin-flips, and the Sky shader output got crushed
    // to black on certain camera orientations (notable repro: Kaohsiung
    // observer at 0 m elevation). Even with `logarithmicDepthBuffer: true`,
    // the ratio near/far dominates usable precision.
    //
    // We tried 1e-8 (1.5 m) first, but that's too close to the 5 m eye
    // height — the inner LocalTerrain mesh started z-fighting against the
    // base Earth ball through the observer-fade hole, leaving a visible
    // bright strip at the foreground. 1e-9 keeps ~33× headroom from eye
    // height (sufficient for clean sky) while leaving 5+ orders of
    // magnitude room above near plane for terrain rendering.
    this.camera = new PerspectiveCamera(50, window.innerWidth / window.innerHeight, 1e-9, 200000);
    // Default to a viewpoint that frames the inner solar system in real-scale.
    this.camera.position.set(0, 6, 14);

    this.orbit = new OrbitControls(this.camera, canvas);
    this.orbit.enableDamping = true;
    this.orbit.dampingFactor = 0.08;
    this.orbit.minDistance = 1e-5;
    // Far enough out for the v0.3.0 galactic-tier dolly (60_000 scene
    // units) plus headroom for the user to manually push past it. The
    // logarithmic depth buffer keeps z-precision usable at this range.
    this.orbit.maxDistance = 200_000;
    this.orbit.target.set(0, 0, 0);

    this.attachObserverPointerHandlers(canvas);
  }

  private attachObserverPointerHandlers(canvas: HTMLElement): void {
    // Active pointers tracked for pinch-to-zoom on touch.
    const pointers = new Map<number, { x: number; y: number }>();
    let pinchPrevDistance: number | null = null;

    const setFov = (next: number) => {
      this.observerFovDeg = Math.max(
        CameraController.OBSERVER_FOV_MIN,
        Math.min(CameraController.OBSERVER_FOV_MAX, next),
      );
      this.camera.fov = this.observerFovDeg;
      this.camera.updateProjectionMatrix();
    };

    canvas.addEventListener('pointerdown', (e) => {
      if (this.mode !== 'observer') return;
      if (this.gyroEnabled) return; // gyro is in charge — ignore drag
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      try { canvas.setPointerCapture(e.pointerId); } catch {}

      if (pointers.size === 1) {
        this.observerDragging = true;
        this.observerDragLast = { x: e.clientX, y: e.clientY };
      } else if (pointers.size === 2) {
        // Promote to pinch — drop single-finger drag state.
        this.observerDragging = false;
        this.observerDragLast = null;
        const pts = [...pointers.values()];
        pinchPrevDistance = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      }
    });

    canvas.addEventListener('pointermove', (e) => {
      if (this.mode !== 'observer') return;
      if (!pointers.has(e.pointerId)) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (pointers.size >= 2) {
        // Pinch: change FOV with the change in finger distance.
        const pts = [...pointers.values()];
        const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        if (pinchPrevDistance != null && d > 0) {
          // Spreading fingers (d grows) → zoom IN → smaller FOV.
          setFov(this.observerFovDeg * (pinchPrevDistance / d));
        }
        pinchPrevDistance = d;
        return;
      }

      // Single-finger drag — manual interaction breaks any follow lock.
      if (!this.observerDragging || !this.observerDragLast) return;
      this.observerFollowId = null;
      const dx = e.clientX - this.observerDragLast.x;
      const dy = e.clientY - this.observerDragLast.y;
      this.observerDragLast = { x: e.clientX, y: e.clientY };
      // Sensitivity scales with FOV — zoomed-in views drag slower for precision.
      const sensitivity = 0.005 * (this.observerFovDeg / CameraController.DEFAULT_FOV_DEG);
      this.observerAz -= dx * sensitivity;
      const minAlt = this.observerLockHorizon ? 0 : -Math.PI / 2 + 0.02;
      this.observerAlt = Math.max(
        minAlt,
        Math.min(Math.PI / 2 - 0.02, this.observerAlt + dy * sensitivity),
      );
    });

    const endPointer = (e: PointerEvent) => {
      pointers.delete(e.pointerId);
      try { canvas.releasePointerCapture(e.pointerId); } catch {}
      if (pointers.size < 2) pinchPrevDistance = null;
      if (pointers.size === 0) {
        this.observerDragging = false;
        this.observerDragLast = null;
      } else if (pointers.size === 1) {
        // Re-establish drag origin from the remaining finger so the view
        // doesn't jump when the second finger lifts.
        const remaining = pointers.values().next().value!;
        this.observerDragging = true;
        this.observerDragLast = { x: remaining.x, y: remaining.y };
      }
    };
    canvas.addEventListener('pointerup', endPointer);
    canvas.addEventListener('pointercancel', endPointer);
    canvas.addEventListener('pointerleave', endPointer);

    // Wheel adjusts FOV in observer mode (telephoto ↔ wide-angle).
    canvas.addEventListener('wheel', (e) => {
      if (this.mode !== 'observer') return;
      e.preventDefault();
      setFov(this.observerFovDeg * Math.exp(e.deltaY * 0.001));
    }, { passive: false });
  }

  setObserverLocation(latDeg: number, lonDeg: number, elevationM: number = 0): void {
    this.observerLat = latDeg;
    this.observerLon = lonDeg;
    this.observerElevationM = elevationM;
  }

  getObserverElevationM(): number { return this.observerElevationM; }

  /**
   * Compute current observer-frame basis (in scene coordinates) plus the
   * camera's world position. Returns null if not in observer mode or if the
   * required scene state is unavailable. Useful for sky/sun-direction queries.
   */
  getObserverContext(): {
    cameraPos: Vector3;
    zenith: Vector3;
    east: Vector3;
    north: Vector3;
  } | null {
    if (this.mode !== 'observer') return null;
    const earthRadius = this.solarSystem.getBodyRadius('earth');
    const earthPos = this.solarSystem.getWorldPosition('earth', new Vector3());
    if (earthRadius == null || !earthPos) return null;
    const f = observerEcliptic(this.observerLat, this.observerLon, this.clock.getJd());
    const zenith = eclipticToScene(f.zenith).normalize();
    const east = eclipticToScene(f.east).normalize();
    const north = eclipticToScene(f.north).normalize();
    // Elevation in scene-AU. earthRadius is the body's scene-space radius,
    // so 1 metre on Earth's surface = 1 / 1000 / AU_KM scene-AU. We add
    // both the site's real elevation (Mauna Kea 4205 m, Paranal 2635 m,
    // sea-level cities 0 m) and the observer's eye height (~5 m) on top
    // of Earth's spherical radius — this mirrors what a real observer at
    // that site would experience: their eye is `elevation + eyeHeight`
    // metres above mean-sea-level Earth.
    const elevAU = (this.observerElevationM + CameraController.OBSERVER_EYE_HEIGHT_M) / 1000 / AU_KM;
    const cameraPos = earthPos.clone().addScaledVector(zenith, earthRadius + elevAU);
    return { cameraPos, zenith, east, north };
  }

  /**
   * Compute alt/az (degrees) of a body as seen from the current observer.
   * Returns null if not in observer mode or body not found.
   */
  getBodyAltAz(bodyId: string): { altDeg: number; azDeg: number } | null {
    const ctx = this.getObserverContext();
    if (!ctx) return null;
    const bodyPos = this.solarSystem.getWorldPosition(bodyId, new Vector3());
    if (!bodyPos) return null;
    const dir = bodyPos.sub(ctx.cameraPos);
    const { altRad, azRad } = dirToAltAz(dir, ctx.zenith, ctx.east, ctx.north);
    let altDeg = altRad * 180 / Math.PI;
    altDeg += atmosphericRefractionDeg(altDeg); // apparent altitude
    return { altDeg, azDeg: azRad * 180 / Math.PI };
  }

  /**
   * Time-parametrised observer frame: same math as getObserverContext but
   * for a specified JD instead of the current clock. Used for numerical
   * derivatives (angular velocity sampling). Returns null if not in
   * observer mode.
   */
  private observerContextAt(jd: number): {
    cameraPos: Vector3; zenith: Vector3; east: Vector3; north: Vector3;
  } | null {
    if (this.mode !== 'observer') return null;
    const earthRadius = this.solarSystem.getBodyRadius('earth');
    if (earthRadius == null) return null;
    // Earth's heliocentric position at jd (read directly from propagator;
    // the scene's Earth mesh is at Sun-relative coords + scene offset).
    const earthEntry = this.solarSystem.getBody('earth');
    if (!earthEntry?.descriptor.propagator) return null;
    const earthEcl = earthEntry.descriptor.propagator.stateAt(jd).position;
    const earthScene = eclipticToScene(earthEcl);
    const f = observerEcliptic(this.observerLat, this.observerLon, jd);
    const zenith = eclipticToScene(f.zenith).normalize();
    const east = eclipticToScene(f.east).normalize();
    const north = eclipticToScene(f.north).normalize();
    const elevAU = (this.observerElevationM + CameraController.OBSERVER_EYE_HEIGHT_M) / 1000 / AU_KM;
    const cameraPos = earthScene.clone().addScaledVector(zenith, earthRadius + elevAU);
    return { cameraPos, zenith, east, north };
  }

  /**
   * Heliocentric (or root-frame) body position at JD, walking up the
   * parent chain so moon-of-planet positions are relative to the Sun.
   * Returns the position in the ecliptic-J2000 frame.
   */
  private bodyEclipticAt(bodyId: string, jd: number): Vector3 | null {
    const entry = this.solarSystem.getBody(bodyId);
    if (!entry) return null;
    // Sun (and any body without a propagator) sits at the scene origin
    // in heliocentric ecliptic coords — its apparent motion in observer
    // frame comes entirely from Earth's orbit + rotation.
    const pos = entry.descriptor.propagator
      ? entry.descriptor.propagator.stateAt(jd).position.clone()
      : new Vector3(0, 0, 0);
    let parentId: string | null | undefined = entry.descriptor.parentId;
    while (parentId) {
      const parent = this.solarSystem.getBody(parentId);
      if (!parent?.descriptor.propagator) break;
      pos.add(parent.descriptor.propagator.stateAt(jd).position);
      parentId = parent.descriptor.parentId;
    }
    return pos;
  }

  /**
   * Apparent (refraction-corrected) alt/az of a body at given JD. Used
   * for finite-difference angular-velocity calculation. Aberration is
   * intentionally NOT applied here since the velocity diff cancels its
   * roughly-constant offset.
   */
  getBodyAltAzAt(bodyId: string, jd: number): { altDeg: number; azDeg: number } | null {
    const ctx = this.observerContextAt(jd);
    if (!ctx) return null;
    const ecl = this.bodyEclipticAt(bodyId, jd);
    if (!ecl) return null;
    const scene = eclipticToScene(ecl);
    const dir = scene.sub(ctx.cameraPos);
    const { altRad, azRad } = dirToAltAz(dir, ctx.zenith, ctx.east, ctx.north);
    let altDeg = altRad * 180 / Math.PI;
    altDeg += atmosphericRefractionDeg(altDeg);
    return { altDeg, azDeg: azRad * 180 / Math.PI };
  }

  /**
   * Angular velocity (real-seconds-of-time) of the currently-tracked body
   * in the observer's local horizontal frame.
   *
   * Returns null if no body is tracked or the body / observer frame
   * is invalid. Otherwise:
   *   rateArcsecPerSec  — total apparent angular speed (always > 0)
   *   paDeg             — direction of motion, position angle measured
   *                       from local zenith (up) clockwise toward east
   *                       (i.e. "compass-like": 0° = up, 90° = right/east)
   *   sideralOffsetArcsecPerSec — magnitude minus pure sidereal rate,
   *                               positive = body moves faster than fixed
   *                               sky (e.g. moon eastward-relative-motion
   *                               makes it slower → negative offset).
   *
   * Sampled with a 1-second forward step. Refraction is included → at
   * the horizon the rate appears slower than sidereal cos(δ) due to
   * atmospheric lift varying with altitude.
   */
  getTrackedBodyAngularVelocity(): {
    rateArcsecPerSec: number;
    paDeg: number;
    sideralOffsetArcsecPerSec: number;
  } | null {
    const id = this.observerFollowId;
    if (!id) return null;
    const dt = 1 / 86400; // 1 second in JD-days
    const jd0 = this.clock.getJd();
    const a = this.getBodyAltAzAt(id, jd0);
    const b = this.getBodyAltAzAt(id, jd0 + dt);
    if (!a || !b) return null;
    // Δaz wraps through 0/360; reduce to ±180.
    let dAz = b.azDeg - a.azDeg;
    if (dAz > 180) dAz -= 360;
    if (dAz < -180) dAz += 360;
    const dAlt = b.altDeg - a.altDeg;
    // Convert azimuth difference to true angular distance on the sky:
    // small motions span cos(alt) less in azimuth than in altitude.
    const meanAlt = (a.altDeg + b.altDeg) * 0.5 * Math.PI / 180;
    const dAzCos = dAz * Math.cos(meanAlt);
    const arcsec = Math.sqrt(dAzCos * dAzCos + dAlt * dAlt) * 3600;
    // Position angle from "up" (zenith direction) clockwise toward east.
    // dAlt is "up", dAzCos is "right (east)" since +az is N→E.
    const paRad = Math.atan2(dAzCos, dAlt);
    let paDeg = paRad * 180 / Math.PI;
    if (paDeg < 0) paDeg += 360;
    // Sidereal rate at this declination ≈ 15.04″ × cos(δ). Approximate
    // δ from current alt/az + observer lat using the spherical law:
    //   sin(δ) = sin(φ)·sin(alt) + cos(φ)·cos(alt)·cos(az_from_north).
    const phi = this.observerLat * Math.PI / 180;
    const alt = a.altDeg * Math.PI / 180;
    const az = a.azDeg * Math.PI / 180;
    const sinDec = Math.sin(phi) * Math.sin(alt) + Math.cos(phi) * Math.cos(alt) * Math.cos(az);
    const cosDec = Math.sqrt(Math.max(0, 1 - sinDec * sinDec));
    const sidereal = 15.04108 * cosDec;
    return {
      rateArcsecPerSec: arcsec,
      paDeg,
      sideralOffsetArcsecPerSec: arcsec - sidereal,
    };
  }

  /**
   * Compute alt/az (degrees) of a fixed star at given J2000 (RA, Dec).
   * Applies (in order): proper motion if pm provided, IAU 1976 precession to
   * the current epoch, annual aberration via Earth's heliocentric motion,
   * then Bennett atmospheric refraction.
   */
  getStarAltAz(
    raHours: number, decDeg: number,
    pmRAMasPerYr?: number, pmDecMasPerYr?: number,
  ): { altDeg: number; azDeg: number } | null {
    const ctx = this.getObserverContext();
    if (!ctx) return null;
    const jd = this.clock.getJd();
    let ra = raHours, dec = decDeg;
    if (pmRAMasPerYr !== undefined && pmDecMasPerYr !== undefined) {
      const corr = applyProperMotion(ra, dec, jd, pmRAMasPerYr, pmDecMasPerYr);
      ra = corr.raHours;
      dec = corr.decDeg;
    }
    let dirEcl = raDecToEcliptic(ra, dec, jd);
    // Apply annual aberration: shift toward Earth's heliocentric velocity.
    // Earth's sun-to-earth vector at this jd, normalised:
    const earthEntry = this.solarSystem.getBody('earth');
    if (earthEntry?.descriptor.propagator) {
      const earthSv = earthEntry.descriptor.propagator.stateAt(jd);
      const earthSunDir = earthSv.position.clone().normalize();
      dirEcl = applyAberration(dirEcl, earthSunDir);
    }
    const dirScene = eclipticToScene(dirEcl);
    const { altRad, azRad } = dirToAltAz(dirScene, ctx.zenith, ctx.east, ctx.north);
    let altDeg = altRad * 180 / Math.PI;
    altDeg += atmosphericRefractionDeg(altDeg);
    return { altDeg, azDeg: azRad * 180 / Math.PI };
  }

  getObserverLocation(): { lat: number; lon: number } {
    return { lat: this.observerLat, lon: this.observerLon };
  }

  /** Current camera look direction in observer mode (degrees). */
  getObserverLookDeg(): { azDeg: number; altDeg: number } {
    let azDeg = (this.observerAz * 180 / Math.PI) % 360;
    if (azDeg < 0) azDeg += 360;
    return { azDeg, altDeg: this.observerAlt * 180 / Math.PI };
  }

  /** Reset look direction to a sensible default (north, 30° up). */
  resetObserverLook(): void {
    this.observerAz = 0;
    this.observerAlt = Math.PI / 6;
  }

  isGyroEnabled(): boolean { return this.gyroEnabled; }

  /**
   * Enable / disable gyroscope-driven aiming (mobile AR mode). When enabled,
   * raw drag input is ignored and the observer's az/alt mirrors the device's
   * physical orientation. Returns 'granted', 'denied', or 'unsupported'.
   *
   * iOS 13+ requires the call originate from a user gesture; the LeftPanel
   * wires this to a button click handler.
   */
  async setGyroEnabled(on: boolean): Promise<'granted' | 'denied' | 'unsupported'> {
    if (!on) {
      this.gyroEnabled = false;
      this.gyroInitialised = false;
      if (this.gyroHandler) {
        window.removeEventListener('deviceorientation', this.gyroHandler, true);
        window.removeEventListener('deviceorientationabsolute', this.gyroHandler, true);
        this.gyroHandler = null;
      }
      return 'granted';
    }
    const D = (window as { DeviceOrientationEvent?: { requestPermission?: () => Promise<string> } }).DeviceOrientationEvent;
    if (!D) return 'unsupported';
    if (typeof D.requestPermission === 'function') {
      try {
        const result = await D.requestPermission();
        if (result !== 'granted') return 'denied';
      } catch {
        return 'denied';
      }
    }
    this.gyroHandler = (e: DeviceOrientationEvent) => {
      const ev = e as DeviceOrientationEvent & { webkitCompassHeading?: number };
      // Prefer iOS's `webkitCompassHeading` (true north). Else use alpha
      // (which Android may report relative to last-known-up unless the event
      // is `deviceorientationabsolute`).
      const rawAz = ev.webkitCompassHeading ?? ev.alpha ?? 0;
      const rawAlt = 90 - (ev.beta ?? 0);
      // Low-pass filter to suppress noise without adding lag.
      const a = 0.18;
      if (!this.gyroInitialised) {
        this.gyroSmoothAzDeg = rawAz;
        this.gyroSmoothAltDeg = rawAlt;
        this.gyroInitialised = true;
      } else {
        this.gyroSmoothAzDeg = this.gyroSmoothAzDeg * (1 - a) + rawAz * a;
        this.gyroSmoothAltDeg = this.gyroSmoothAltDeg * (1 - a) + rawAlt * a;
      }
      const azDeg = ((this.gyroSmoothAzDeg - this.gyroOffsetAzDeg) % 360 + 360) % 360;
      const altDeg = Math.max(-89, Math.min(89, this.gyroSmoothAltDeg));
      this.observerAz = (azDeg * Math.PI) / 180;
      this.observerAlt = (altDeg * Math.PI) / 180;
    };
    // Try absolute first (Android), fall back to plain (iOS).
    window.addEventListener('deviceorientationabsolute', this.gyroHandler, true);
    window.addEventListener('deviceorientation', this.gyroHandler, true);
    this.gyroEnabled = true;
    return 'granted';
  }

  /**
   * Re-zero the gyro azimuth so the current device heading reads as 0°.
   * Useful when the compass is drifting or when starting in a building where
   * magnetic interference offsets the readings.
   */
  calibrateGyroNorth(): void {
    if (!this.gyroEnabled || !this.gyroInitialised) return;
    this.gyroOffsetAzDeg = this.gyroSmoothAzDeg;
  }

  /** Aim the observer camera at the given azimuth/altitude (degrees). */
  /**
   * Track a body in observer mode — the camera re-aims itself each frame
   * to keep the body centred. Pass null to stop tracking. Any manual drag
   * also clears tracking via setObserverLook().
   */
  setObserverFollow(bodyId: string | null): void {
    this.observerFollowId = bodyId;
  }
  getObserverFollow(): string | null { return this.observerFollowId; }

  setObserverLook(azDeg: number, altDeg: number): void {
    this.observerAz = (azDeg * Math.PI) / 180;
    const minAlt = this.observerLockHorizon ? 0 : -Math.PI / 2 + 0.02;
    const maxAlt = Math.PI / 2 - 0.02;
    this.observerAlt = Math.max(minAlt, Math.min(maxAlt, (altDeg * Math.PI) / 180));
  }

  /**
   * Directly set observer FOV (e.g. from a telescope preset). Bypasses the
   * wheel-zoom soft limits so high-power eyepieces (sub-1°) work; the wheel
   * itself still clamps to its own range, preserving usable interactive zoom.
   */
  setObserverFov(deg: number): void {
    this.observerFovDeg = Math.max(0.1, Math.min(170, deg));
    this.camera.fov = this.observerFovDeg;
    this.camera.updateProjectionMatrix();
  }

  /**
   * Toggle the horizon lock. When enabled, observer altitude is clamped to
   * [0, +π/2], modelling the fact that an observer on the surface cannot see
   * through the planet at their feet.
   */
  setObserverLockHorizon(lock: boolean): void {
    this.observerLockHorizon = lock;
    if (lock && this.observerAlt < 0) this.observerAlt = 0;
  }

  setMode(mode: CameraMode): void {
    const wasObserver = this.mode === 'observer';
    this.mode = mode;
    this.orbit.enabled = (mode !== 'observer');

    // When leaving observer mode, restore the camera's up axis to scene "up"
    // (Y). Otherwise OrbitControls keeps using the local zenith vector that
    // observer mode set, and orbit/pan rotates around the wrong axis.
    if (wasObserver && mode !== 'observer') {
      this.camera.up.set(0, 1, 0);
      // Re-anchor at a sensible viewpoint: from a few units behind & above origin.
      this.camera.position.set(0, 6, 14);
      this.orbit.target.set(0, 0, 0);
      this.prevTarget.set(0, 0, 0);
      // Restore default FOV (observer mode allowed wheel-zoom into telephoto).
      this.observerFovDeg = CameraController.DEFAULT_FOV_DEG;
      this.camera.fov = CameraController.DEFAULT_FOV_DEG;
      this.camera.updateProjectionMatrix();
    }

    if (mode === 'top') {
      this.camera.position.set(0, 70, 0.001);
      this.orbit.target.set(0, 0, 0);
    } else if (mode === 'free') {
      this.followId = null;
    } else if (mode === 'observer') {
      this.followId = null;
    }

    // Notify subscribers (main.ts uses this to lazy-load observer-mode
    // resources like SatelliteLayer on first entry). Decoupled via the
    // window event bus so CameraController doesn't need a SolarSystem
    // reference.
    window.dispatchEvent(new CustomEvent('sim:mode-change', { detail: { mode } }));
  }

  setFollow(bodyId: string | null): void {
    this.followId = bodyId;
    if (bodyId) {
      this.mode = 'follow';
      this.orbit.enabled = true;
    }
  }

  getMode(): CameraMode { return this.mode; }

  update(): void {
    if (this.mode === 'observer') {
      // If a follow target is set, re-aim before computing camera state so
      // the observer's view tracks moving objects (planets, ISS) frame-by-
      // frame without manual dragging.
      if (this.observerFollowId && !this.gyroEnabled) {
        const altAz = this.getBodyAltAz(this.observerFollowId);
        if (altAz) {
          this.observerAz = altAz.azDeg * Math.PI / 180;
          this.observerAlt = altAz.altDeg * Math.PI / 180;
        }
      }
      this.updateObserverCamera();
      return;
    }
    if (this.mode === 'follow' && this.followId) {
      const pos = this.solarSystem.getWorldPosition(this.followId, this.tmpTarget);
      if (pos) {
        // Translate camera by the delta target moved, so view stays locked.
        const dx = pos.x - this.prevTarget.x;
        const dy = pos.y - this.prevTarget.y;
        const dz = pos.z - this.prevTarget.z;
        this.camera.position.x += dx;
        this.camera.position.y += dy;
        this.camera.position.z += dz;
        this.orbit.target.copy(pos);
        this.prevTarget.copy(pos);

        // Clamp minDistance to just above the body surface so you can't
        // tunnel inside.
        const r = this.solarSystem.getBodyRadius(this.followId);
        if (r) this.orbit.minDistance = r * 1.05;
      }
    } else if (this.mode === 'top') {
      this.orbit.target.set(0, 0, 0);
      this.orbit.minDistance = 1e-5;
    } else {
      this.orbit.minDistance = 1e-5;
    }

    this.orbit.update();
  }

  onResize(width: number, height: number): void {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  private updateObserverCamera(): void {
    const earthRadius = this.solarSystem.getBodyRadius('earth');
    if (earthRadius == null) return;
    const earthWorld = this.solarSystem.getWorldPosition('earth', this._tmpEarthPos);
    if (!earthWorld) return;

    const frame = observerEcliptic(this.observerLat, this.observerLon, this.clock.getJd());

    // Convert ecliptic basis vectors to scene basis. eclipticToScene returns
    // a new Vector3, so capture into our temp buffers.
    this._tmpUp.copy(eclipticToScene(frame.zenith)).normalize();
    this._tmpEast.copy(eclipticToScene(frame.east)).normalize();
    this._tmpNorth.copy(eclipticToScene(frame.north)).normalize();

    // Camera sits at the site's real elevation + eye height above the
    // spherical Earth surface. Mirrors getObserverContext()'s computation
    // so AltAz queries and the rendered camera always agree.
    this._tmpDir.copy(this._tmpUp);
    const elevAU = (this.observerElevationM + CameraController.OBSERVER_EYE_HEIGHT_M) / 1000 / AU_KM;
    this.camera.position.copy(earthWorld).addScaledVector(this._tmpDir, earthRadius + elevAU);

    // Compose look direction from azimuth (from north toward east) + altitude.
    const cosAz = Math.cos(this.observerAz);
    const sinAz = Math.sin(this.observerAz);
    const cosAlt = Math.cos(this.observerAlt);
    const sinAlt = Math.sin(this.observerAlt);

    this._tmpLook.set(0, 0, 0)
      .addScaledVector(this._tmpNorth, cosAz * cosAlt)
      .addScaledVector(this._tmpEast, sinAz * cosAlt)
      .addScaledVector(this._tmpUp, sinAlt);

    this.camera.up.copy(this._tmpUp);
    this.camera.lookAt(
      this.camera.position.x + this._tmpLook.x * 1000,
      this.camera.position.y + this._tmpLook.y * 1000,
      this.camera.position.z + this._tmpLook.z * 1000,
    );
  }
}
