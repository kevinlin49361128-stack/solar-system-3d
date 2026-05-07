import { Vector3 } from 'three';
import { J2000_JD, DEG2RAD } from './constants';

/**
 * Sun geocentric ecliptic position via Meeus 1998 ch. 25 (low-precision
 * formulas). The basic Kepler-element approach in `bodies.ts` for Earth
 * has ~0.5–1° angular drift over decades — the elements are accurate
 * mean values but skip equation-of-centre nuances and Jupiter
 * perturbation. Meeus's truncated series gives ~0.01° (~36″) accuracy
 * for 2000 ± 50 yrs, sufficient for solar-eclipse path geometry where
 * the Moon's umbra axis is hyper-sensitive to Sun direction.
 *
 * Returns geocentric ecliptic-J2000 position vector in AU.
 *
 * Frame: +X to vernal equinox, +Y to ecl long 90°, +Z to ecl north.
 * Earth-to-Sun direction = result.normalise().
 */

/** Sun ecliptic apparent longitude (deg) and Earth-Sun distance (AU). */
export interface SolarSpherical {
  /** Apparent geocentric ecliptic longitude (deg), corrected for nutation
   *  & aberration (Meeus 25.10). */
  lambdaDeg: number;
  /** Geocentric ecliptic latitude (deg). For the Sun ≤ ~0.001″ from
   *  ecliptic plane, so we treat as exactly 0 — caller can ignore. */
  betaDeg: number;
  /** Earth-Sun distance (AU). */
  rAU: number;
}

/**
 * Compute the Sun's geocentric apparent ecliptic-J2000 position.
 * Implements Meeus AA Ch. 25 truncated formulas:
 *   L0 (mean longitude), M (mean anomaly), e (eccentricity),
 *   C (equation of centre), then true longitude + apparent correction.
 */
export function solarSpherical(jd: number): SolarSpherical {
  const T = (jd - J2000_JD) / 36525;
  const T2 = T * T;
  // Mean longitude (deg)
  const L0 = mod360(280.46646 + 36000.76983 * T + 0.0003032 * T2);
  // Mean anomaly (deg)
  const M = mod360(357.52911 + 35999.05029 * T - 0.0001537 * T2);
  const Mrad = M * DEG2RAD;
  // Eccentricity
  const e = 0.016708634 - 0.000042037 * T - 0.0000001267 * T2;
  // Equation of centre (deg)
  const C =
    (1.914602 - 0.004817 * T - 0.000014 * T2) * Math.sin(Mrad) +
    (0.019993 - 0.000101 * T) * Math.sin(2 * Mrad) +
    0.000289 * Math.sin(3 * Mrad);
  // True longitude (deg)
  const trueL = L0 + C;
  // True anomaly (deg)
  const trueM = M + C;
  // Earth-Sun distance (AU). Meeus 25.5
  const rAU = (1.000001018 * (1 - e * e)) / (1 + e * Math.cos(trueM * DEG2RAD));
  // Apparent longitude — correct for nutation & aberration via Meeus 25.10:
  //   λ_app = ☉ − 0.00569 − 0.00478 sin(Ω) ; Ω = 125.04 − 1934.136 T
  const omega = 125.04 - 1934.136 * T;
  const lambdaDeg = trueL - 0.00569 - 0.00478 * Math.sin(omega * DEG2RAD);
  return {
    lambdaDeg: mod360(lambdaDeg),
    betaDeg: 0,
    rAU,
  };
}

/**
 * Sun's geocentric ecliptic position as Cartesian Vector3 (AU). Same
 * frame as `moonPositionEcliptic`: +X = vernal equinox, +Y = +90° lon,
 * +Z = ecliptic north.
 *
 * Use this in eclipse path geometry instead of `-earthHelio` (which
 * inherits the Kepler propagator's ~0.5–1° accumulated phase error).
 */
export function sunPositionEcliptic(jd: number): Vector3 {
  const s = solarSpherical(jd);
  const lam = s.lambdaDeg * DEG2RAD;
  // beta = 0, so cos(beta) = 1.
  return new Vector3(
    s.rAU * Math.cos(lam),
    s.rAU * Math.sin(lam),
    0,
  );
}

function mod360(x: number): number {
  const m = x % 360;
  return m < 0 ? m + 360 : m;
}
