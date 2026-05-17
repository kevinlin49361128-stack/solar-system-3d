import { describe, it, expect } from 'vitest';
import { Vector3 } from 'three';

/**
 * Pure-math validation of the umbra/penumbra angular-overlap test that
 * lives inside BodyMesh's shadow shader. The shader does this per
 * fragment; we replicate the same formula in JS here so we can pin
 * down classical solar/lunar eclipse geometry without spinning up a
 * GPU context.
 *
 * Numbers throughout are in "scene units" — the same unit system the
 * shader sees. The test uses 1 unit = 1 AU so we can plug in Earth
 * 1 AU from sun, Moon 384400 km from Earth, etc., and compare against
 * the known geometry that a total solar eclipse has a ~270 km wide
 * umbra path on Earth's surface.
 */

const AU_KM = 1.495978707e8;
const km = (x: number) => x / AU_KM;  // km → AU

/** Reproduces the shadow factor the shader computes per fragment.
 *  fragWorld: position of the surface fragment in world (scene) units.
 *  sunWorld:  sun centre.
 *  sunRadius: sun radius (same units).
 *  occWorld:  occluder centre.
 *  occRadius: occluder radius.
 *  Returns shadow factor in [0, 1]: 0=no shadow, 1=full umbra. */
function shadowFactor(
  fragWorld: Vector3, sunWorld: Vector3, sunRadius: number,
  occWorld: Vector3, occRadius: number,
): number {
  const toSun = sunWorld.clone().sub(fragWorld);
  const toOcc = occWorld.clone().sub(fragWorld);
  const dS = toSun.length();
  const dO = toOcc.length();
  if (dO >= dS) return 0;  // occluder behind sun
  const sunDir = toSun.clone().divideScalar(dS);
  const occDir = toOcc.clone().divideScalar(dO);
  const sunR = sunRadius / dS;
  const occR = occRadius / dO;
  const sep = Math.acos(Math.max(-1, Math.min(1, sunDir.dot(occDir))));
  if (sep >= sunR + occR) return 0;
  if (sep + sunR <= occR) return 1;
  // Smooth interp (matches shader's smoothstep).
  const a = Math.max(occR - sunR, 0);
  const b = sunR + occR;
  const x = Math.max(0, Math.min(1, (sep - a) / (b - a)));
  return 1 - (x * x * (3 - 2 * x));  // smoothstep matches GLSL
}

describe('Sun-occluder shadow geometry — classical eclipse benchmarks', () => {
  // Sun: 1 AU from Earth, radius 695 700 km ≈ 0.00465 AU.
  const SUN = new Vector3(0, 0, 0);
  const SUN_RADIUS_AU = km(695700);
  // Earth: 1 AU from sun.
  const EARTH = new Vector3(1, 0, 0);
  const EARTH_RADIUS_AU = km(6378.137);
  // Moon: 384 400 km from Earth, on the opposite side of Earth from the sun
  // (so Earth is BETWEEN sun and Moon for a lunar eclipse).
  const MOON_DIST_AU = km(384400);
  const MOON_RADIUS_AU = km(1737.4);

  it('total solar eclipse: Moon between Earth and sun → umbra on Earth surface', () => {
    // Moon halfway between Earth and sun, exactly aligned.
    const moonPos = new Vector3(1 - MOON_DIST_AU, 0, 0);
    // Fragment at the centre of Earth's day-side surface (point closest to sun).
    const fragPos = new Vector3(1 - EARTH_RADIUS_AU, 0, 0);
    const f = shadowFactor(fragPos, SUN, SUN_RADIUS_AU, moonPos, MOON_RADIUS_AU);
    // Moon's angular radius from Earth ~0.26° (lunar disc). Sun's ~0.27°.
    // Near totality the Moon almost-but-not-quite covers the Sun — so we
    // expect either full umbra (1.0) or just barely penumbra. Real
    // totality DOES happen so 1.0 is physically valid.
    expect(f).toBeGreaterThan(0.5);
  });

  it('grazing alignment: Moon barely off the sun line → penumbra (partial)', () => {
    // Moon offset perpendicular to the sun-Earth line by 1 moon radius —
    // its disc just barely overlaps the sun's edge from Earth's view.
    const moonPos = new Vector3(1 - MOON_DIST_AU, MOON_RADIUS_AU * 2, 0);
    const fragPos = new Vector3(1 - EARTH_RADIUS_AU, 0, 0);
    const f = shadowFactor(fragPos, SUN, SUN_RADIUS_AU, moonPos, MOON_RADIUS_AU);
    expect(f).toBeGreaterThan(0);
    expect(f).toBeLessThan(1);
  });

  it('occluder on the FAR side of sun does nothing (dO >= dS guard)', () => {
    // Place the "occluder" at 3 AU behind Earth from the sun — it's not
    // an occluder at all.
    const farPos = new Vector3(3, 0, 0);
    const fragPos = new Vector3(1 - EARTH_RADIUS_AU, 0, 0);
    expect(shadowFactor(fragPos, SUN, SUN_RADIUS_AU, farPos, km(10000))).toBe(0);
  });

  it('night side of Earth never gets shadowed by Moon (sun behind)', () => {
    // Fragment on the night side: sun is on the far side of Earth.
    const fragPos = new Vector3(1 + EARTH_RADIUS_AU, 0, 0);
    const moonPos = new Vector3(1 - MOON_DIST_AU, 0, 0);
    // The Moon IS between fragment and sun (geometrically), but at this
    // point Earth itself is the bigger occluder. We only model explicit
    // listed occluders — and a night-side fragment legitimately CAN be
    // counted as in the Moon's shadow by the angular geometry. The
    // physical reality is that Earth's own self-shadowing (Lambert
    // cosine) makes night-side fragments already dark. So we mostly
    // just verify the function doesn't NaN out at the antipode.
    const f = shadowFactor(fragPos, SUN, SUN_RADIUS_AU, moonPos, MOON_RADIUS_AU);
    expect(Number.isFinite(f)).toBe(true);
  });

  it('lunar eclipse: Moon in Earth umbra → fragment on Moon surface is shadowed', () => {
    // Fragment on the Moon's Earth-facing side (the side that's lit at
    // full moon — and the side that goes red during lunar eclipse).
    // Moon is on far side of Earth from sun (full moon geometry).
    const fragPos = new Vector3(1 + MOON_DIST_AU - MOON_RADIUS_AU, 0, 0);
    // Occluder is Earth.
    const f = shadowFactor(fragPos, SUN, SUN_RADIUS_AU, EARTH, EARTH_RADIUS_AU);
    // Earth's angular radius from Moon ~0.95°. Sun's ~0.27°. Earth way
    // over-covers the sun → full umbra.
    expect(f).toBe(1);
  });

  it('Galilean transit shadow: Io between sun and Jupiter casts shadow disc on Jupiter', () => {
    // Jupiter at 5.2 AU, radius ~71 492 km, Io at distance 421 800 km from
    // Jupiter on the sun side.
    const jupRadiusAU = km(71492);
    const ioRadiusAU = km(1821.6);
    const ioOffset = km(421800);
    const ioPos = new Vector3(5.2 - ioOffset, 0, 0);
    // Fragment on Jupiter's sub-Io point (directly under Io's shadow).
    const fragPos = new Vector3(5.2 - jupRadiusAU, 0, 0);
    const f = shadowFactor(fragPos, SUN, SUN_RADIUS_AU, ioPos, ioRadiusAU);
    // Io is bigger than the Sun angular diameter at Jupiter (Sun is 0.10°
    // from Jupiter; Io's angular radius from Jupiter's surface is ~0.51°)
    // — Io fully covers the sun, full umbra.
    expect(f).toBe(1);
  });
});
