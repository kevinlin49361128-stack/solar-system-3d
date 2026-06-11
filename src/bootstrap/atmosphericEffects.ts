/**
 * Observer-mode per-frame visual effects, extracted from main.ts.
 *
 * Everything here mutates body-mesh shader state (tints, shadow inputs,
 * flattening, earthshine) or body group positions (refraction lift) from
 * the current scene geometry. The functions are called once per frame
 * from updateSkyForObserver() / tick(); scratch Vector3s are module-local
 * so the render loop stays allocation-free.
 */
import { Vector3 } from 'three';
import type { SolarSystem } from '../scene/SolarSystem';
import { bennettRefractionArcmin } from '../physics/refraction';

export interface AtmosphericEffects {
  /** Extinction tint (per-channel airmass) + Venus/Mercury phase dimming. */
  applyBodyExtinctionAndPhase(
    extinctionEnabled: boolean, cameraPos: Vector3, zenith: Vector3, sunWorld: Vector3,
  ): void;
  /** Sun direction in Saturn's tilt-local frame → ring-shadow shader. */
  updateSaturnRingShadow(): void;
  /** Bennett refraction lift of every body's apparent position. */
  applyRefractionLift(cameraPos: Vector3, zenith: Vector3): void;
  /** Sun/moon disc vertical compression near the horizon. */
  applyAtmosphericFlattening(cameraPos: Vector3, zenith: Vector3): void;
  /** Earth-umbra "blood moon" tint when geometry aligns. */
  applyLunarEclipse(sunWorld: Vector3): void;
  /** Per-body occluder lists for the sun-disc-vs-occluder shadow shader. */
  applyBodyShadows(sunWorld: Vector3): void;
  /** Earthshine on the moon's night side, peaking at new crescent. */
  applyEarthshine(cameraPos: Vector3, sunWorld: Vector3): void;
  /** Turn off earthshine (realism toggle off / leaving observer mode). */
  resetEarthshine(): void;
  /** Clear all per-body tints + flattening (leaving observer mode). */
  resetBodyVisuals(): void;
}

export function createAtmosphericEffects(solarSystem: SolarSystem): AtmosphericEffects {
  const _tmpBodyPos = new Vector3();
  const _tmpVec1 = new Vector3();
  const _tmpVec2 = new Vector3();
  const _refractWorld = new Vector3();
  const _refractDir = new Vector3();
  const _refractAxis = new Vector3();
  const _localZenithCache = new Vector3(0, 1, 0);
  const _earthshineSunDir = new Vector3(1, 0, 0);

  /**
   * Tint each visible body by atmospheric extinction (per-channel airmass)
   * plus phase-magnitude dimming for Venus / Mercury (the only planets where
   * phase is dramatic). Bodies below the horizon get a tint of (0,0,0) so
   * the user doesn't see them through the local terrain mesh.
   */
  function applyBodyExtinctionAndPhase(
    extinctionEnabled: boolean,
    cameraPos: Vector3,
    zenith: Vector3,
    sunWorld: Vector3,
  ): void {
    for (const entry of solarSystem.getAllBodies()) {
      const id = entry.descriptor.id;
      if (id === 'sun') continue;
      const body = solarSystem.getWorldPosition(id, _tmpBodyPos);
      if (!body) continue;
      const dir = _tmpVec1.copy(body).sub(cameraPos).normalize();
      const cosZ = dir.dot(zenith);
      let r = 1, g = 1, b = 1;
      if (extinctionEnabled) {
        if (cosZ <= 0) {
          // Below horizon — fully suppress so it doesn't show through terrain.
          r = g = b = 0;
        } else {
          const X = 1 / Math.max(0.026, cosZ);
          const dmR = 0.10 * (X - 1);
          const dmG = 0.16 * (X - 1);
          const dmB = 0.28 * (X - 1);
          r = Math.pow(2.512, -dmR);
          g = Math.pow(2.512, -dmG);
          b = Math.pow(2.512, -dmB);
        }
      }
      // Phase-angle magnitude dimming for inner planets. Phase angle α =
      // angle sun-planet-observer. Polynomial fit follows Mallama 2018 for
      // Venus; Mercury uses a simpler linear approximation.
      if (id === 'venus' || id === 'mercury') {
        const sunFromBody = _tmpVec2.copy(sunWorld).sub(body).normalize();
        // `dir` is (body − cam) normalised, so observer-from-body = −dir.
        const obsFromBody = dir.clone().multiplyScalar(-1);
        const cosAlpha = Math.max(-1, Math.min(1, sunFromBody.dot(obsFromBody)));
        const alphaDeg = Math.acos(cosAlpha) * 180 / Math.PI;
        let dmag: number;
        if (id === 'venus') {
          // Mallama 2018, Venus: valid 0° ≤ α < 163.7°
          dmag = -1.044e-3 * alphaDeg
               + 3.687e-4 * alphaDeg * alphaDeg
               - 2.814e-6 * alphaDeg * alphaDeg * alphaDeg
               + 8.938e-9 * alphaDeg * alphaDeg * alphaDeg * alphaDeg;
        } else {
          // Mercury: linear approximation, ~0.045 mag/° on average
          dmag = 0.045 * alphaDeg;
        }
        // Skip the 5 log10 distance term — that already happens implicitly via
        // the body's screen size/sub-pixel rendering.
        const phaseFactor = Math.pow(2.512, -Math.max(0, dmag));
        r *= phaseFactor; g *= phaseFactor; b *= phaseFactor;
      }
      entry.mesh.setBrightnessTint(r, g, b);
    }
  }

  /**
   * Compute the sun direction in Saturn's tilt-local frame and push it to
   * Saturn's body shader so the ring's shadow band rakes across the planet
   * as Saturn orbits the sun (i.e., across the ~29-year Saturn year).
   */
  function updateSaturnRingShadow(): void {
    const saturn = solarSystem.getBody('saturn');
    if (!saturn) return;
    const sunWorld = solarSystem.getWorldPosition('sun', _tmpVec1);
    const saturnWorld = solarSystem.getWorldPosition('saturn', _tmpVec2);
    if (!sunWorld || !saturnWorld) return;
    const sunFromSaturn = _tmpBodyPos.copy(sunWorld).sub(saturnWorld).normalize();
    // Convert world-space direction → Saturn's mesh-local frame (parent of
    // body sphere is the tilt group; its world matrix encodes axial tilt +
    // rotation, which we want to undo for the shader's local-frame trace).
    const inv = saturn.mesh.mesh.matrixWorld.clone().invert();
    _localZenithCache.copy(sunFromSaturn).transformDirection(inv);
    saturn.mesh.setRingShadowSun(_localZenithCache);
  }

  /**
   * Lift each visible body's apparent direction toward the zenith by the
   * Bennett refraction angle for its true altitude. Operates in world space
   * (via Group.getWorldPosition / worldToLocal) so it works correctly for
   * moons whose group.position is parent-relative.
   *
   * Applied per-frame in observer mode before the extinction / eclipse /
   * flattening passes so they all see the apparent position.
   */
  function applyRefractionLift(cameraPos: Vector3, zenith: Vector3): void {
    for (const entry of solarSystem.getAllBodies()) {
      const grp = entry.mesh.group;
      grp.updateMatrixWorld(true);
      grp.getWorldPosition(_refractWorld);
      _refractDir.copy(_refractWorld).sub(cameraPos);
      const dist = _refractDir.length();
      if (dist < 1e-9) continue;
      _refractDir.divideScalar(dist);
      const altSin = Math.max(-1, Math.min(1, _refractDir.dot(zenith)));
      const altDeg = Math.asin(altSin) * 180 / Math.PI;
      if (altDeg > 12 || altDeg < -1.5) continue;
      const refDeg = bennettRefractionArcmin(altDeg) / 60;
      if (refDeg < 0.005) continue;
      _refractAxis.copy(_refractDir).cross(zenith);
      if (_refractAxis.lengthSq() < 1e-12) continue;
      _refractAxis.normalize();
      _refractDir.applyAxisAngle(_refractAxis, refDeg * Math.PI / 180);
      _refractWorld.copy(cameraPos).addScaledVector(_refractDir, dist);
      if (grp.parent) grp.parent.worldToLocal(_refractWorld);
      grp.position.copy(_refractWorld);
      grp.updateMatrixWorld(true);
    }
  }

  /**
   * Compress sun / moon disc along the observer's zenith axis to mimic
   * atmospheric-refraction-induced flattening near the horizon. The bottom
   * limb gets lifted more than the top limb (refraction is monotonically
   * decreasing with altitude), so the disc shortens vertically.
   */
  function applyAtmosphericFlattening(cameraPos: Vector3, zenith: Vector3): void {
    const angRadiusDeg = 0.27; // ~16′ for sun and moon (close enough)
    const tmp = new Vector3();
    for (const id of ['sun', 'moon'] as const) {
      const entry = solarSystem.getBody(id);
      if (!entry) continue;
      const pos = solarSystem.getWorldPosition(id, tmp);
      if (!pos) continue;
      const dir = pos.clone().sub(cameraPos).normalize();
      const altDeg = Math.asin(Math.max(-1, Math.min(1, dir.dot(zenith)))) * 180 / Math.PI;
      if (altDeg > 12) {
        // Above 12° refraction differential is < 0.5 % — disc essentially round.
        entry.mesh.setAtmosphericFlattening(_localZenithCache, 1.0);
        continue;
      }
      const rTop = bennettRefractionArcmin(altDeg + angRadiusDeg);
      const rBot = bennettRefractionArcmin(Math.max(0, altDeg - angRadiusDeg));
      const yScale = Math.max(0.5, (2 * angRadiusDeg + (rTop - rBot) / 60) / (2 * angRadiusDeg));
      // Convert world zenith to body-local frame via inverse of mesh.matrixWorld
      const inv = entry.mesh.mesh.matrixWorld.clone().invert();
      _localZenithCache.copy(zenith).transformDirection(inv);
      entry.mesh.setAtmosphericFlattening(_localZenithCache, yScale);
    }
  }

  /**
   * Lunar eclipse detection. Earth umbra geometry: from sun, earth subtends
   * a small angle; the umbra cone extends behind earth and tapers. At lunar
   * distance (~384 000 km past earth), umbra radius ≈ 4 500 km — about 1.4×
   * moon's radius, so total eclipses are common during alignments.
   *
   * Approximation: project moon's heliocentric position onto the sun→earth
   * axis. If the projection sits *past* earth (t > 1) and the perpendicular
   * distance is below an umbra threshold scaled by t, moon is in shadow.
   */
  function applyLunarEclipse(sunWorld: Vector3): void {
    const moon = solarSystem.getBody('moon');
    if (!moon) return;
    const moonPos = solarSystem.getWorldPosition('moon', _tmpVec1);
    const earthPos = solarSystem.getWorldPosition('earth', _tmpVec2);
    if (!moonPos || !earthPos) return;
    const sunMoon = _tmpBodyPos.copy(moonPos).sub(sunWorld);
    const sunEarth = _tmpVec1.copy(earthPos).sub(sunWorld);
    const sunEarthLen2 = sunEarth.lengthSq();
    if (sunEarthLen2 < 1e-12) return;
    const t = sunMoon.dot(sunEarth) / sunEarthLen2;
    if (t < 1.0 || t > 1.05) {
      return; // moon not on the anti-sun side of earth
    }
    // perpendicular distance from sun-earth axis (in scene-AU units).
    const perp = sunMoon.clone().addScaledVector(sunEarth, -t);
    const perpAU = perp.length();
    // Earth radius scene-AU at current scale.
    const earthRadiusAU = solarSystem.getBodyRadius('earth') ?? 0;
    // Umbra threshold ~1.4× earth radius at lunar distance is too tight at
    // schematic scales where bodies are exaggerated. Use 2× earth radius as
    // a forgiving fudge so eclipses register cleanly across scale modes.
    const umbraAU = earthRadiusAU * 2.0;
    const penumbraAU = earthRadiusAU * 5.0;
    if (perpAU > penumbraAU) return;
    // Compute eclipse darkness: 1 = full umbra (deep red), 0 = grazing penumbra.
    const x = (penumbraAU - perpAU) / Math.max(1e-9, penumbraAU - umbraAU);
    const eclipseFrac = Math.max(0, Math.min(1, x));
    // Multiply existing tint by red-orange eclipse colour.
    // Full umbra: typical "blood moon" rgb ≈ (0.55, 0.18, 0.10).
    const er = 1.0 - eclipseFrac * 0.45;  // red survives
    const eg = 1.0 - eclipseFrac * 0.82;
    const eb = 1.0 - eclipseFrac * 0.90;
    // Stack the eclipse colour on top of any extinction-derived tint.
    moon.mesh.multiplyBrightnessTint(er, eg, eb);
  }

  /**
   * Push a per-frame "what might be casting a shadow on me" list to every
   * body's fragment shader. The shader does the actual angular-overlap
   * sun-disc-vs-occluder-disc maths per fragment, so this function only
   * needs to enumerate candidates — typically a body's parent + same-parent
   * siblings + own children. Max 4 occluders per body (shader array size).
   *
   * Capability matrix this gives us "for free" via the shader:
   *  - Moon shadow on Earth's surface (real solar eclipse silhouette)
   *  - Earth's shadow on Moon (lunar eclipse umbra/penumbra geometry)
   *  - Galilean moon shadows on Jupiter (the famous transit shadow discs)
   *  - Jupiter's shadow on its moons (Io/Europa darkening when on far side)
   *  - Titan's shadow on Saturn (and Saturn's on Titan)
   *
   * All occluder positions are world-space scene units (already AU-scaled
   * by the active ScaleController), matching the shader's vShadowWorldPos
   * varying. Sun radius likewise uses solarSystem.getBodyRadius('sun')
   * which already returns post-scale scene units.
   */
  function applyBodyShadows(sunWorld: Vector3): void {
    const sunRadius = solarSystem.getBodyRadius('sun') ?? 0;
    const allBodies = solarSystem.getAllBodies();
    // Pre-cache world positions + radii in one pass — avoids repeated
    // getWorldPosition() calls inside the inner loop (each is a matrix
    // walk through the scene graph).
    const cache = new Map<string, { pos: Vector3; radius: number }>();
    for (const b of allBodies) {
      if (b.descriptor.id === 'sun') continue;
      const pos = solarSystem.getWorldPosition(b.descriptor.id, new Vector3());
      if (!pos) continue;
      cache.set(b.descriptor.id, { pos, radius: solarSystem.getBodyRadius(b.descriptor.id) ?? 0 });
    }
    for (const receiver of allBodies) {
      if (receiver.descriptor.id === 'sun') continue;
      if (receiver.descriptor.appearance.emissive) continue;
      const occluders: Array<{ worldPos: Vector3; radius: number }> = [];
      const receiverId = receiver.descriptor.id;
      const parentId = receiver.descriptor.parentId;
      // Parent (e.g. Earth for Moon, Jupiter for Io). Skip Sun — it's the
      // light source, never an occluder.
      if (parentId && parentId !== 'sun') {
        const p = cache.get(parentId);
        if (p) occluders.push({ worldPos: p.pos, radius: p.radius });
      }
      // Same-parent siblings (e.g. Europa shadowing Io). Cap at 3 so the
      // total stays ≤ shader's 4-slot limit even when parent is included.
      if (parentId) {
        let sibCount = 0;
        for (const other of allBodies) {
          if (sibCount >= 3) break;
          const oId = other.descriptor.id;
          if (oId === receiverId) continue;
          if (other.descriptor.parentId !== parentId) continue;
          const p = cache.get(oId);
          if (p) { occluders.push({ worldPos: p.pos, radius: p.radius }); sibCount++; }
        }
      }
      // Own children (e.g. Moon shadowing Earth — solar eclipse). For a
      // planet, this is its moons.
      let childCount = 0;
      for (const other of allBodies) {
        if (occluders.length >= 4) break;
        if (childCount >= 4 - occluders.length) break;
        if (other.descriptor.parentId !== receiverId) continue;
        const p = cache.get(other.descriptor.id);
        if (p) { occluders.push({ worldPos: p.pos, radius: p.radius }); childCount++; }
      }
      receiver.mesh.setShadowInputs(sunWorld, sunRadius, occluders);
    }
  }

  /**
   * Apply Earthshine on the moon's dark hemisphere. Intensity scales with
   * (1 - moon_illum_fraction)² because Earth subtends a large solid angle
   * but we want emphasis at the new-crescent end. Sun direction is converted
   * to the moon's local frame so the shader's normal-dot test correctly
   * identifies the night side regardless of mesh tilt + rotation.
   */
  function applyEarthshine(cameraPos: Vector3, sunWorld: Vector3): void {
    const moon = solarSystem.getBody('moon');
    if (!moon) return;
    const moonWorld = solarSystem.getWorldPosition('moon', _tmpVec1);
    if (!moonWorld) return;
    const sunFromMoon = _tmpVec2.copy(sunWorld).sub(moonWorld).normalize();
    const obsFromMoon = _tmpBodyPos.copy(cameraPos).sub(moonWorld).normalize();
    const cosAng = Math.max(-1, Math.min(1, sunFromMoon.dot(obsFromMoon)));
    const illum = (1 + cosAng) / 2;
    // (1-illum)² emphasises crescent phase. Cap at 0.6 so the dark side never
    // outshines the lit side visually.
    const intensity = Math.min(0.6, Math.pow(1 - illum, 2));
    // Convert world-space sun direction → moon's local frame using the inverse
    // of the body group's matrix (rotation/tilt only).
    const moonGroup = moon.mesh.group;
    const localSun = _tmpVec1.copy(sunFromMoon)
      .applyMatrix4(moonGroup.matrixWorld.clone().invert());
    // Strip translation: only direction matters.
    localSun.normalize();
    moon.mesh.setEarthshine(intensity, localSun);
  }

  function resetEarthshine(): void {
    solarSystem.getBody('moon')?.mesh.setEarthshine(0, _earthshineSunDir);
  }

  function resetBodyVisuals(): void {
    for (const b of solarSystem.getAllBodies()) {
      b.mesh.setBrightnessTint(1, 1, 1);
      b.mesh.setAtmosphericFlattening(_localZenithCache, 1.0);
    }
    resetEarthshine();
  }

  return {
    applyBodyExtinctionAndPhase,
    updateSaturnRingShadow,
    applyRefractionLift,
    applyAtmosphericFlattening,
    applyLunarEclipse,
    applyBodyShadows,
    applyEarthshine,
    resetEarthshine,
    resetBodyVisuals,
  };
}
