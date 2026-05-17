import { AU_KM, DAY_SECONDS, DEG2RAD } from './constants';
import { KeplerPropagator, type KeplerElements } from './keplerPropagator';
import type {
  OrbitPropagator, PropagatorKind, PropagatorSource, StateVector, StaticOrbitalElements,
} from './types';

/**
 * J2 oblateness perturbation — secular (long-term) decorator for Keplerian
 * propagators. Implements the classical Brouwer/Kozai secular theory:
 * a non-spherical body (e.g. Earth, Jupiter, Saturn) generates an extra
 * potential ∝ J2·(R_eq/r)², whose effect on a satellite is a *constant
 * angular drift* of the ascending node, argument of perigee, and mean
 * anomaly. We don't model the small periodic oscillations — those average
 * out per orbit; the secular drifts dominate over weeks-to-years.
 *
 * Three secular rates (rad/day):
 *
 *   Ω̇_J2 = -(3/2) · n · J2 · (R/p)² · cos(i)
 *   ω̇_J2 =  (3/4) · n · J2 · (R/p)² · (5cos²i − 1)
 *   δṀ_J2 = (3/2) · n · J2 · (R/p)² · √(1−e²) · (1 − (3/2)sin²i)
 *
 * where n = √(μ/a³) is the unperturbed mean motion, p = a(1−e²) is the
 * semi-latus rectum, R is the central body's equatorial radius, and i, e
 * are the satellite's inclination and eccentricity.
 *
 * Reference values reproduced by this code:
 *   ISS  (a=6778 km, i=51.6°)  → Ω̇ ≈ −5.0°/day
 *   Moon (Earth J2 alone)       → Ω̇ ≈ −19.3°/year
 *   GPS  (a=26 560 km, i=55°)   → Ω̇ ≈ −0.04°/day
 *   Sun-synch i=98°             → Ω̇ ≈ +0.986°/day  (designed so node tracks the sun)
 *
 * The "critical inclination" i = 63.435° makes (5cos²i − 1) = 0, so ω̇ = 0
 * — Molniya orbits use this so their perigee stays over a fixed latitude.
 */

export interface J2BodyParameters {
  /** Dimensionless oblateness coefficient (J2). */
  J2: number;
  /** Equatorial radius in km. */
  equatorialRadiusKm: number;
  /** Standard gravitational parameter μ = GM in km³/s². */
  muKm3PerS2: number;
}

/**
 * Published J2 + equatorial radius + GM for the major oblate solar-system
 * bodies. Numbers from IAU 2009 working group on cartographic coordinates
 * + Jacobson 2013 ephemerides — chosen for cross-source consistency
 * rather than absolute newest.
 */
export const J2_BODIES: Record<string, J2BodyParameters> = {
  // Sun: tiny J2, but the Le Verrier–Mercury anomaly is partly Sun-J2 driven.
  sun:     { J2: 2.0e-7,   equatorialRadiusKm: 695700,   muKm3PerS2: 1.32712440018e11 },
  earth:   { J2: 1.0826e-3, equatorialRadiusKm: 6378.137, muKm3PerS2: 398600.4418 },
  // Mars: ~10x Earth's J2 due to Tharsis bulge — significant on its moons.
  mars:    { J2: 1.9605e-3, equatorialRadiusKm: 3396.2,   muKm3PerS2: 42828.376 },
  // Gas giants: J2 ~1.5%, an order of magnitude bigger than Earth's. Dominant
  // secular term for Galilean / Saturnian moons.
  jupiter: { J2: 1.4736e-2, equatorialRadiusKm: 71492,    muKm3PerS2: 126686534 },
  saturn:  { J2: 1.6298e-2, equatorialRadiusKm: 60268,    muKm3PerS2: 37931187 },
  uranus:  { J2: 3.343e-3,  equatorialRadiusKm: 25559,    muKm3PerS2: 5793939 },
  neptune: { J2: 3.411e-3,  equatorialRadiusKm: 24764,    muKm3PerS2: 6836529 },
};

const KM_PER_AU = AU_KM;
const SEC_PER_DAY = DAY_SECONDS;
const RAD_PER_DAY_TO_DEG_PER_CENTURY = (180 / Math.PI) * 36525;
const RAD_PER_DAY_TO_DEG_PER_YEAR    = (180 / Math.PI) * 365.25;
const RAD_PER_DAY_TO_DEG_PER_DAY     = (180 / Math.PI);

export interface J2SecularRates {
  /** Ω̇ — ascending-node regression, rad/day. Negative for prograde orbits. */
  OmegaDotRadPerDay: number;
  /** ω̇ — argument-of-perigee advance, rad/day. Zero at i=63.435°. */
  omegaDotRadPerDay: number;
  /** δṀ — mean-anomaly correction, rad/day. */
  meanAnomalyDotRadPerDay: number;
  /** Convenience: Ω̇ in deg/day (the most common textbook number). */
  OmegaDotDegPerDay: number;
  /** Convenience: Ω̇ in deg/year. */
  OmegaDotDegPerYear: number;
  /** Convenience: ω̇ in deg/day. */
  omegaDotDegPerDay: number;
}

/**
 * Standalone helper — compute the J2 secular rates for an orbit
 * without building a propagator. Useful for diagnostic display
 * (InfoPanel "physics under the hood" row) and tests.
 *
 * Inputs:
 *   aAU      — semi-major axis (AU)
 *   e        — eccentricity
 *   iDeg     — inclination (degrees, relative to parent's equator)
 *   parent   — central body's J2 + R_eq + μ
 *
 * NB: the inclination here is measured against the parent body's
 * *equator*, not the ecliptic. For Earth satellites whose elements
 * come from TLEs this is automatically equatorial. For moons whose
 * elements are usually quoted in the parent planet's orbital plane,
 * you may need to add the parent's axial tilt to get the correct i.
 */
export function computeJ2SecularRates(
  aAU: number, e: number, iDeg: number, parent: J2BodyParameters,
): J2SecularRates {
  // Convert μ from km³/s² to AU³/day² so it composes with `aAU` directly.
  const muAU3PerDay2 = parent.muKm3PerS2 * (SEC_PER_DAY * SEC_PER_DAY) / Math.pow(KM_PER_AU, 3);
  const n = Math.sqrt(muAU3PerDay2 / Math.pow(aAU, 3));    // rad/day
  const p = aAU * (1 - e * e);                              // AU
  const RAU = parent.equatorialRadiusKm / KM_PER_AU;
  const RoverP2 = (RAU / p) * (RAU / p);
  const i = iDeg * DEG2RAD;
  const cosI = Math.cos(i);
  const sinI = Math.sin(i);

  const omegaCapDot = -1.5 * n * parent.J2 * RoverP2 * cosI;
  const omegaDot    =  0.75 * n * parent.J2 * RoverP2 * (5 * cosI * cosI - 1);
  const mDot        =  1.5 * n * parent.J2 * RoverP2 * Math.sqrt(1 - e * e) * (1 - 1.5 * sinI * sinI);

  return {
    OmegaDotRadPerDay: omegaCapDot,
    omegaDotRadPerDay: omegaDot,
    meanAnomalyDotRadPerDay: mDot,
    OmegaDotDegPerDay:  omegaCapDot * RAD_PER_DAY_TO_DEG_PER_DAY,
    OmegaDotDegPerYear: omegaCapDot * RAD_PER_DAY_TO_DEG_PER_YEAR,
    omegaDotDegPerDay:  omegaDot * RAD_PER_DAY_TO_DEG_PER_DAY,
  };
}

/**
 * Decorator — wraps a KeplerPropagator with J2-driven secular rates.
 * Implementation strategy: KeplerPropagator already supports per-century
 * linear drift in Ω / ϖ / L via its `*Dot` fields. The J2 perturbation is
 * mathematically *also* a linear secular drift (over the timescales we
 * care about), so we just compute the rates once and add them to the
 * inner propagator's existing `*Dot` fields. No runtime overhead per
 * stateAt() call — it's the same Kepler maths with bigger numbers.
 *
 * Notation reminder for the rate-stacking:
 *   ϖ = Ω + ω   →   ϖ̇ = Ω̇ + ω̇
 *   L = M + ϖ   →   L̇ = Ṁ + Ω̇ + ω̇
 * so J2's contributions to the existing element-set are:
 *   ΔΩ̇    = Ω̇_J2
 *   Δϖ̇    = Ω̇_J2 + ω̇_J2
 *   ΔL̇    = Ω̇_J2 + ω̇_J2 + δṀ_J2
 */
export class J2PerturbedKeplerPropagator implements OrbitPropagator {
  readonly elements: StaticOrbitalElements;
  readonly kind: PropagatorKind = 'kepler-perturbed-j2';
  readonly source: PropagatorSource;
  /** Diagnostic — the raw secular rates we applied. Surfaced in the InfoPanel. */
  readonly j2Rates: J2SecularRates;
  private inner: KeplerPropagator;

  constructor(input: KeplerElements, parent: J2BodyParameters, parentLabel?: string) {
    this.j2Rates = computeJ2SecularRates(input.a, input.e, input.iDeg, parent);
    const omegaCapDotDegPerCentury = this.j2Rates.OmegaDotRadPerDay * RAD_PER_DAY_TO_DEG_PER_CENTURY;
    const omegaDotDegPerCentury    = this.j2Rates.omegaDotRadPerDay * RAD_PER_DAY_TO_DEG_PER_CENTURY;
    const mDotDegPerCentury        = this.j2Rates.meanAnomalyDotRadPerDay * RAD_PER_DAY_TO_DEG_PER_CENTURY;

    this.inner = new KeplerPropagator({
      ...input,
      OmegaDotDeg: (input.OmegaDotDeg ?? 0) + omegaCapDotDegPerCentury,
      varpiDotDeg: (input.varpiDotDeg ?? 0) + omegaCapDotDegPerCentury + omegaDotDegPerCentury,
      LDotDeg:     (input.LDotDeg ?? 0)     + omegaCapDotDegPerCentury + omegaDotDegPerCentury + mDotDegPerCentury,
    });
    this.elements = this.inner.elements;
    this.source = {
      label: `Kepler + J2 secular drift (${parentLabel ?? 'parent'})`,
      note: `J2=${parent.J2.toExponential(3)}, R_eq=${parent.equatorialRadiusKm} km`,
    };
  }

  stateAt(jd: number): StateVector {
    return this.inner.stateAt(jd);
  }
}
