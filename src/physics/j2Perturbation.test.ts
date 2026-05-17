import { describe, it, expect } from 'vitest';
import {
  computeJ2SecularRates, J2PerturbedKeplerPropagator, J2_BODIES,
} from './j2Perturbation';
import { KeplerPropagator } from './keplerPropagator';
import { AU_KM, J2000_JD } from './constants';

const toAU = (km: number) => km / AU_KM;

/**
 * Reference values come from Vallado's "Fundamentals of Astrodynamics and
 * Applications" (4th ed.) Chapter 9 and the standard Brouwer-Lyddane
 * secular theory. All tolerances are well outside the secular formula's
 * own error budget (~1 part in 10⁴ for low-Earth orbits) so any future
 * regression in the constants or formula will trip these.
 */
describe('J2 secular rates — classical Earth-orbit benchmarks', () => {
  const EARTH = J2_BODIES.earth;

  it('ISS-like LEO at i=51.6° regresses its node at ≈ -5.0°/day', () => {
    // ISS: 400 km altitude, near-circular, 51.6° inclination.
    const a = toAU(6378.137 + 400);
    const e = 0.0003;
    const i = 51.6;
    const r = computeJ2SecularRates(a, e, i, EARTH);
    // Published Ω̇ for ISS is ~-5.0°/day (5.05 from STK, 5.04 from Vallado).
    expect(r.OmegaDotDegPerDay).toBeCloseTo(-5.0, 1);
  });

  it('GPS-like MEO at i=55° regresses much slower (~-0.04°/day)', () => {
    // GPS: a≈26 560 km, i=55°. Bigger a → smaller (R/p)² → tiny J2 effect.
    const a = toAU(26560);
    const e = 0.01;
    const i = 55;
    const r = computeJ2SecularRates(a, e, i, EARTH);
    // Published Ω̇ for GPS is ~-0.038°/day.
    expect(r.OmegaDotDegPerDay).toBeCloseTo(-0.038, 2);
  });

  it('sun-synchronous polar orbit at i≈98° has POSITIVE node drift ≈ +0.986°/day', () => {
    // Sun-synchronous: i chosen so the J2 node-drift exactly tracks Earth's
    // mean motion around the Sun (360°/365.25 days ≈ 0.9856°/day). Most
    // imaging sats sit here. For a 800 km altitude orbit that's i≈98.6°.
    const a = toAU(6378.137 + 800);
    const e = 0.001;
    const i = 98.6;
    const r = computeJ2SecularRates(a, e, i, EARTH);
    expect(r.OmegaDotDegPerDay).toBeGreaterThan(0);
    expect(r.OmegaDotDegPerDay).toBeCloseTo(0.986, 1);
  });

  it('argument-of-perigee drift is ZERO at the critical inclination i=63.435°', () => {
    // Molniya orbits exploit this — perigee stays over a fixed latitude.
    // (5cos²i − 1) = 0 when cos²i = 1/5  →  i = acos(1/√5) ≈ 63.4349°.
    const a = toAU(20000);
    const r = computeJ2SecularRates(a, 0.7, 63.4349, EARTH);
    expect(Math.abs(r.omegaDotDegPerDay)).toBeLessThan(0.001);
  });

  it('node regression flips sign at retrograde i>90°', () => {
    const a = toAU(8000);
    const prograde   = computeJ2SecularRates(a, 0.01, 45,  EARTH);
    const retrograde = computeJ2SecularRates(a, 0.01, 135, EARTH);
    // cos(135°) = -cos(45°), so Ω̇ flips sign.
    expect(Math.sign(prograde.OmegaDotDegPerDay)).toBe(-1);
    expect(Math.sign(retrograde.OmegaDotDegPerDay)).toBe(1);
    expect(retrograde.OmegaDotDegPerDay).toBeCloseTo(-prograde.OmegaDotDegPerDay, 6);
  });
});

describe('J2 secular rates — Galilean moon benchmarks', () => {
  const JUPITER = J2_BODIES.jupiter;

  it('Io node drift dominated by Jupiter J2 (~tens of deg/year)', () => {
    // Io: a=421 800 km, e=0.0041, i=0.05° relative to Jupiter equator.
    const a = toAU(421800);
    const r = computeJ2SecularRates(a, 0.0041, 0.05, JUPITER);
    // Published J2-driven node regression for Io is ~45–49°/year depending
    // on which J2_Jupiter / R_eq value the source uses (Jacobson 2013 vs
    // Voyager-era IAU); we use 1.4736e-2 and get -47.2°/year. Wide tolerance
    // because the absolute value is data-source-sensitive — the shape and
    // sign are what we're really validating.
    expect(r.OmegaDotDegPerYear).toBeGreaterThan(-50);
    expect(r.OmegaDotDegPerYear).toBeLessThan(-45);
    // Sanity: it's much bigger than Earth's because J2_Jupiter / J2_Earth ≈ 14.
    expect(Math.abs(r.OmegaDotDegPerYear)).toBeGreaterThan(40);
  });
});

describe('J2PerturbedKeplerPropagator — decorator behaviour', () => {
  it('produces the same instantaneous state as plain Kepler at t=epoch', () => {
    const elements = {
      epoch: J2000_JD,
      a: toAU(6378.137 + 400), e: 0.0003, iDeg: 51.6,
      LDeg: 30, varpiDeg: 60, OmegaDeg: 45,
      periodDays: 92.68 / 1440,
    };
    const plain = new KeplerPropagator(elements);
    const j2    = new J2PerturbedKeplerPropagator(elements, J2_BODIES.earth);
    const sPlain = plain.stateAt(J2000_JD);
    const sJ2    = j2.stateAt(J2000_JD);
    // At t=epoch, the secular drift contributes zero — positions should match
    // bit-for-bit (modulo Kepler-solver rounding).
    expect(sJ2.position.x).toBeCloseTo(sPlain.position.x, 8);
    expect(sJ2.position.y).toBeCloseTo(sPlain.position.y, 8);
    expect(sJ2.position.z).toBeCloseTo(sPlain.position.z, 8);
  });

  it('node drifts at the predicted rate over 30 days (integration ↔ secular)', () => {
    // Polar orbit at 800 km — Ω̇ should be measurable and clearly non-zero.
    const elements = {
      epoch: J2000_JD,
      a: toAU(6378.137 + 800), e: 0.001, iDeg: 60,
      LDeg: 0, varpiDeg: 0, OmegaDeg: 0,
      periodDays: 100.87 / 1440,
    };
    const j2 = new J2PerturbedKeplerPropagator(elements, J2_BODIES.earth);
    const predicted = j2.j2Rates.OmegaDotDegPerDay;
    // We can't read Ω directly out of stateAt() — instead, watch the orbital
    // plane normal rotate. Compute h = r × v at t=0 and t=30 days; the in-
    // plane component of the angle between them is the J2 node drift over
    // that interval.
    const s0  = j2.stateAt(J2000_JD);
    const s30 = j2.stateAt(J2000_JD + 30);
    const h0 = cross(s0.position, s0.velocity);
    const h30 = cross(s30.position, s30.velocity);
    // For a 60°-inclined orbit the angular-momentum vector has a large
    // equatorial component; if Ω regresses by ΔΩ, then h's equatorial
    // projection rotates by ΔΩ around the ecliptic Z axis.
    // Project onto the XY plane and measure the angle.
    const angle0  = Math.atan2(h0.y,  h0.x);
    const angle30 = Math.atan2(h30.y, h30.x);
    let delta = (angle30 - angle0) * 180 / Math.PI;
    // Unwrap to [-180, 180]
    while (delta > 180) delta -= 360;
    while (delta < -180) delta += 360;
    const observed = delta / 30;  // deg/day
    // Tolerance: the inner KeplerPropagator's per-orbit position error is
    // higher than the secular-theory's own error, so we allow 5% slack.
    expect(observed).toBeCloseTo(predicted, 1);
  });

  it('exposes correct PropagatorKind for InfoPanel labelling', () => {
    const j2 = new J2PerturbedKeplerPropagator(
      { epoch: J2000_JD, a: toAU(7000), e: 0, iDeg: 50, LDeg: 0, varpiDeg: 0, OmegaDeg: 0, periodDays: 0.06 },
      J2_BODIES.earth,
    );
    expect(j2.kind).toBe('kepler-perturbed-j2');
    expect(j2.source.label).toMatch(/J2/);
  });
});

// Small util — we'd normally reach for Three.Vector3 but inlining a 6-line
// cross product avoids importing three just for a test.
function cross(
  a: { x: number; y: number; z: number },
  b: { x: number; y: number; z: number },
) {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}
