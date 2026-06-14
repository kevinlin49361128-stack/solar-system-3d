import { Vector3 } from 'three';
import { AU_KM } from './constants';

/**
 * Per-body observable quantities — apparent magnitude, phase, angular
 * diameter, plus a few static orbital geometry helpers (synodic period,
 * Hill sphere). These are pure-physics functions: caller passes the
 * body's heliocentric position and Earth's heliocentric position; module
 * does the geometry. UI consumers read the result and render it.
 *
 * Magnitude formulas: standard Astronomical Almanac H + 5·log₁₀(rΔ) +
 * phase-correction polynomial. Coefficients differ per planet (Mercury
 * has steepest phase curve, gas giants are nearly phase-independent).
 * Accuracy: ±0.1–0.2 mag is fine for educational display; serious
 * predictions need IAU phase functions which we don't ship.
 */

export interface BodyObservables {
  /** Distance from observer (Earth) in AU. Δ in textbooks. */
  observerDistanceAU: number;
  /** Distance from Sun in AU. r in textbooks. */
  heliocentricDistanceAU: number;
  /** Phase angle (Sun-body-observer angle), degrees, 0 = full, 180 = new. */
  phaseAngleDeg: number;
  /** Illuminated fraction k = (1 + cos α) / 2, range 0–1. */
  illuminatedFraction: number;
  /** Apparent magnitude (V-band, approximate). */
  apparentMagnitude: number;
  /** Apparent angular diameter, arcseconds. */
  angularDiameterArcsec: number;
}

/**
 * Standard absolute magnitude H₀ (V-band, at r = Δ = 1 AU, phase α = 0)
 * and phase-coefficient polynomial constants. Format: m = H₀ + 5·log(rΔ) +
 * c₁·α + c₂·α² + c₃·α³  (α in degrees).
 *
 * Sources: Astronomical Almanac 2014 (apparent magnitude tables) and
 * Mallama et al. 2018 (Mercury / Venus refinements).
 */
const MAGNITUDE_COEFFS: Record<string, { H0: number; c1: number; c2?: number; c3?: number }> = {
  mercury: { H0: -0.613, c1: 0.06328,  c2: -1.6336e-3, c3: 3.3644e-5 },
  venus:   { H0: -4.384, c1: -0.001044, c2: 3.687e-4,  c3: -2.814e-6 },
  earth:   { H0: -3.99,  c1: -0.0019,   c2: 6.1e-6,    c3: 0 },
  mars:    { H0: -1.601, c1: 0.02267,  c2: -1.302e-4, c3: 0 },
  jupiter: { H0: -9.395, c1: -3.7e-4,  c2: 6.16e-4,   c3: 0 },
  saturn:  { H0: -8.95,  c1: 0,        c2: 0,         c3: 0 }, // ring contribution averaged out — see note
  uranus:  { H0: -7.110, c1: 6.587e-3, c2: 1.045e-4,  c3: 0 },
  neptune: { H0: -7.00,  c1: 7.944e-3, c2: 9.617e-5,  c3: 0 },
  pluto:   { H0: -1.0,   c1: 0,        c2: 0,         c3: 0 },
  // Dwarf planets / asteroids share Mercury-style polynomials; coefficients
  // here are crude but order-of-magnitude correct for educational display.
  ceres:    { H0: 3.34,  c1: 0.04, c2: 0, c3: 0 },
  eris:     { H0: -1.17, c1: 0.04, c2: 0, c3: 0 },
  makemake: { H0: -0.20, c1: 0.04, c2: 0, c3: 0 },
  haumea:   { H0: 0.43,  c1: 0.04, c2: 0, c3: 0 },
  // Moon — H₀ much brighter and phase function very steep.
  moon: { H0: 0.21, c1: 0.026, c2: 4.0e-9, c3: 0 },
};

/**
 * Apparent magnitude with phase correction. Returns NaN if the body has
 * no calibrated coefficients (e.g. spacecraft, comets without active
 * sublimation modelling).
 */
export function apparentMagnitude(
  bodyId: string,
  helioDistanceAU: number,
  observerDistanceAU: number,
  phaseAngleDeg: number,
): number {
  const c = MAGNITUDE_COEFFS[bodyId];
  if (!c) return NaN;
  const r = helioDistanceAU;
  const d = observerDistanceAU;
  const a = phaseAngleDeg;
  // Standard H + 5log(rΔ) + phase polynomial.
  return c.H0 + 5 * Math.log10(r * d)
    + (c.c1 ?? 0) * a
    + (c.c2 ?? 0) * a * a
    + (c.c3 ?? 0) * a * a * a;
}

/**
 * Compute phase angle α = ∠(Sun, Body, Observer). Inputs are heliocentric
 * positions (AU). Body and Earth must be in the SAME reference frame (we
 * use ecliptic-J2000 throughout the simulator).
 */
export function phaseAngleDeg(bodyHelio: Vector3, earthHelio: Vector3): number {
  const sunFromBody = bodyHelio.clone().multiplyScalar(-1).normalize();
  const obsFromBody = earthHelio.clone().sub(bodyHelio).normalize();
  const cosA = Math.max(-1, Math.min(1, sunFromBody.dot(obsFromBody)));
  return Math.acos(cosA) * 180 / Math.PI;
}

/** Illuminated fraction k = (1 + cos α) / 2. Range [0, 1]. */
export function illuminatedFraction(phaseAngleDegValue: number): number {
  const a = phaseAngleDegValue * Math.PI / 180;
  return (1 + Math.cos(a)) / 2;
}

/**
 * Apparent angular diameter in arcseconds.
 *   θ = 2·atan(R / Δ) ≈ 2·R / Δ for small angles
 * R: body radius (km), Δ: observer distance (AU). Returned in arcsec.
 */
export function angularDiameterArcsec(radiusKm: number, observerDistanceAU: number): number {
  const distKm = observerDistanceAU * AU_KM;
  if (distKm <= 0) return 0;
  const radians = 2 * Math.atan(radiusKm / distKm);
  return radians * 206264.806; // rad → arcsec
}

/**
 * Compute everything observer-related for a body in one shot. Takes
 * heliocentric Vector3s for body and Earth. For the Moon, pass its
 * GEOcentric position as `bodyHelio` and Earth's actual position as
 * `earthHelio` — but that double-counts; instead callers should pass
 * Sun's position (origin) as Earth ref. See moonObservables() below for
 * the proper geocentric-to-observables wrapper.
 */
export function bodyObservables(
  bodyId: string,
  bodyHelio: Vector3,
  earthHelio: Vector3,
  radiusKm: number,
): BodyObservables {
  const r = bodyHelio.length();
  const d = bodyHelio.clone().sub(earthHelio).length();
  const phase = phaseAngleDeg(bodyHelio, earthHelio);
  const k = illuminatedFraction(phase);
  return {
    heliocentricDistanceAU: r,
    observerDistanceAU: d,
    phaseAngleDeg: phase,
    illuminatedFraction: k,
    apparentMagnitude: apparentMagnitude(bodyId, r, d, phase),
    angularDiameterArcsec: angularDiameterArcsec(radiusKm, d),
  };
}

/**
 * Moon-specific observables: takes its geocentric position (which is
 * what its propagator yields, since Moon's parent is Earth) plus Earth's
 * heliocentric position.
 *
 *   r (Sun→Moon) = earthHelio + moonGeo
 *   Δ (Earth→Moon) = |moonGeo|
 *   phase angle = ∠(Sun, Moon, Earth)
 */
export function moonObservables(
  moonGeo: Vector3,
  earthHelio: Vector3,
  moonRadiusKm: number,
): BodyObservables {
  const moonHelio = earthHelio.clone().add(moonGeo);
  return bodyObservables('moon', moonHelio, earthHelio, moonRadiusKm);
}

/**
 * Synodic period between two bodies orbiting the same primary:
 *   1/T_syn = |1/T₁ − 1/T₂|
 * Returns Infinity if periods are equal (no relative motion). Caller
 * passes both periods in the same units; output matches input units.
 */
export function synodicPeriod(periodA: number, periodB: number): number {
  const diff = Math.abs(1 / periodA - 1 / periodB);
  if (diff === 0) return Infinity;
  return 1 / diff;
}

/**
 * Hill sphere radius (gravitational sphere of influence) in AU.
 *   r_H ≈ a·(1 − e)·(m / 3M)^(1/3)
 * a: semi-major axis (AU); e: eccentricity; m: body mass (kg);
 * M: primary mass (kg). For planets around the Sun, M = M_sun.
 *
 * Use (1 − e) to give the perihelion-side limit (stricter than the mean).
 */
export function hillSphereAU(
  semiMajorAxisAU: number,
  eccentricity: number,
  bodyMassKg: number,
  primaryMassKg: number,
): number {
  const ratio = bodyMassKg / (3 * primaryMassKg);
  return semiMajorAxisAU * (1 - eccentricity) * Math.cbrt(ratio);
}

/**
 * Roche limit (rigid-body, conservative — actual fluid limit is ~2.4× this
 * for tidal disruption of self-gravitating bodies). In AU.
 *   d ≈ R_primary · (2 · ρ_primary / ρ_satellite)^(1/3)
 *
 * radiusPrimaryKm + densities (kg/m³). Returns AU.
 */
export function rocheLimitAU(
  radiusPrimaryKm: number,
  densityPrimaryKgM3: number,
  densitySatelliteKgM3: number,
): number {
  const dKm = radiusPrimaryKm * Math.cbrt(2 * densityPrimaryKgM3 / densitySatelliteKgM3);
  return dKm / AU_KM;
}

