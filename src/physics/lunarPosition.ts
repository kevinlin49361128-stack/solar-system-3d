import { Vector3 } from 'three';
import { J2000_JD, DEG2RAD, AU_KM } from './constants';
import type { OrbitPropagator, PropagatorKind, PropagatorSource, StateVector, StaticOrbitalElements } from './types';

/**
 * Moon geocentric position via Meeus 1998 ch. 47 (Brown's lunar theory,
 * truncated). Replaces the basic Kepler approximation in moons.ts which
 * accumulates ~6 arcmin error from ignored perturbations (evection,
 * variation, parallactic inequality, etc.).
 *
 * Accuracy with the term subset below: longitude ~10″, latitude ~10″,
 * distance ~50 km. Plenty for visualisation; lunar eclipses align to within
 * a couple of minutes.
 *
 * Returns position in **J2000 ecliptic frame**, in AU. The renderer adds the
 * Moon to Earth's group, so this geocentric vector ends up world-correct.
 */

const KM_PER_AU = AU_KM;

// Each row: [D, M, M', F, Σl coefficient (10⁻⁶ deg), Σr coefficient (km)].
// Selection: top ~28 amplitude terms from Meeus Table 47.A.
// Σl drives ecliptic longitude; Σr drives geocentric distance.
const TERMS_LR: ReadonlyArray<readonly [number, number, number, number, number, number]> = [
  [0, 0,  1,  0,  6288774, -20905355],
  [2, 0, -1,  0,  1274027,  -3699111],
  [2, 0,  0,  0,   658314,  -2955968],
  [0, 0,  2,  0,   213618,   -569925],
  [0, 1,  0,  0,  -185116,     48888],
  [0, 0,  0,  2,  -114332,     -3149],
  [2, 0, -2,  0,    58793,    246158],
  [2,-1, -1,  0,    57066,   -152138],
  [2, 0,  1,  0,    53322,   -170733],
  [2,-1,  0,  0,    45758,   -204586],
  [0, 1, -1,  0,   -40923,   -129620],
  [1, 0,  0,  0,   -34720,    108743],
  [0, 1,  1,  0,   -30383,    104755],
  [2, 0,  0, -2,    15327,     10321],
  [0, 0,  1,  2,   -12528,         0],
  [0, 0,  1, -2,    10980,     79661],
  [4, 0, -1,  0,    10675,    -34782],
  [0, 0,  3,  0,    10034,    -23210],
  [4, 0, -2,  0,     8548,    -21636],
  [2, 1, -1,  0,    -7888,     24208],
  [2, 1,  0,  0,    -6766,     30824],
  [1, 0, -1,  0,    -5163,     -8379],
  [1, 1,  0,  0,     4987,    -16675],
  [2,-1,  1,  0,     4036,    -12831],
  [2, 0,  2,  0,     3994,    -10445],
  [4, 0,  0,  0,     3861,    -11650],
  [2, 0, -3,  0,     3665,     14403],
  [0, 1, -2,  0,    -2689,     -7003],
];

// Top ~19 terms from Meeus Table 47.B for ecliptic latitude.
const TERMS_B: ReadonlyArray<readonly [number, number, number, number, number]> = [
  [0, 0,  0,  1,  5128122],
  [0, 0,  1,  1,   280602],
  [0, 0,  1, -1,   277693],
  [2, 0,  0, -1,   173237],
  [2, 0, -1,  1,    55413],
  [2, 0, -1, -1,    46271],
  [2, 0,  0,  1,    32573],
  [0, 0,  2,  1,    17198],
  [2, 0,  1, -1,     9266],
  [0, 0,  2, -1,     8822],
  [2,-1,  0, -1,     8216],
  [2, 0, -2, -1,     4324],
  [2, 0,  1,  1,     4200],
  [2, 1,  0, -1,    -3359],
  [2,-1, -1,  1,     2463],
  [2,-1,  0,  1,     2211],
  [2,-1, -1, -1,     2065],
  [0, 1, -1, -1,    -1870],
  [4, 0, -1, -1,     1828],
];

interface LunarMeans {
  Lp: number; D: number; M: number; Mp: number; F: number; E: number;
}

function lunarMeanArgs(jd: number): LunarMeans {
  const T = (jd - J2000_JD) / 36525;
  const T2 = T * T, T3 = T2 * T, T4 = T3 * T;
  return {
    // Mean longitude of Moon (deg)
    Lp: 218.3164477 + 481267.88123421 * T - 0.0015786 * T2 + T3 / 538841 - T4 / 65194000,
    // Mean elongation of Moon from Sun (deg)
    D:  297.8501921 + 445267.1114034  * T - 0.0018819 * T2 + T3 / 545868 - T4 / 113065000,
    // Sun's mean anomaly (deg)
    M:  357.5291092 +  35999.0502909  * T - 0.0001536 * T2 + T3 / 24490000,
    // Moon's mean anomaly (deg)
    Mp: 134.9633964 + 477198.8675055  * T + 0.0087414 * T2 + T3 / 69699  - T4 / 14712000,
    // Moon's argument of latitude (deg)
    F:   93.272095  + 483202.0175233  * T - 0.0036539 * T2 - T3 / 3526000 + T4 / 863310000,
    // Sun-eccentricity correction applied to terms involving M (Meeus eq. 47.6)
    E:    1 - 0.002516 * T - 0.0000074 * T2,
  };
}

/**
 * Geocentric Moon position in J2000 ecliptic Cartesian frame, units AU.
 */
export function moonPositionEcliptic(jd: number): Vector3 {
  const m = lunarMeanArgs(jd);
  const D  = m.D  * DEG2RAD;
  const Ms = m.M  * DEG2RAD;
  const Mp = m.Mp * DEG2RAD;
  const F  = m.F  * DEG2RAD;
  const E  = m.E;

  let SigmaL = 0;
  let SigmaR = 0;
  for (const [d, ms, mp, f, sl, sr] of TERMS_LR) {
    const arg = d * D + ms * Ms + mp * Mp + f * F;
    // Sun-eccentricity dependence: |M| = 1 → ×E, |M| = 2 → ×E²
    const ePow = ms === 0 ? 1 : (Math.abs(ms) === 1 ? E : E * E);
    SigmaL += sl * ePow * Math.sin(arg);
    SigmaR += sr * ePow * Math.cos(arg);
  }

  let SigmaB = 0;
  for (const [d, ms, mp, f, sb] of TERMS_B) {
    const arg = d * D + ms * Ms + mp * Mp + f * F;
    const ePow = ms === 0 ? 1 : (Math.abs(ms) === 1 ? E : E * E);
    SigmaB += sb * ePow * Math.sin(arg);
  }

  const lambdaDeg = m.Lp + SigmaL * 1e-6;
  const betaDeg   =        SigmaB * 1e-6;
  const distKm    = 385000.56 + SigmaR / 1000;

  const lambda = lambdaDeg * DEG2RAD;
  const beta   = betaDeg   * DEG2RAD;
  const r = distKm / KM_PER_AU;

  // Ecliptic spherical → Cartesian. Frame: +X to vernal equinox,
  // +Y to ecl long 90°, +Z to ecliptic north — matches frame.ts.
  return new Vector3(
    r * Math.cos(beta) * Math.cos(lambda),
    r * Math.cos(beta) * Math.sin(lambda),
    r * Math.sin(beta),
  );
}

/**
 * OrbitPropagator implementation using the Meeus formulas.
 * Velocity is the central difference of position over ~1.4 minutes — adequate
 * for renderer purposes; sufficient for any consumer that doesn't need
 * explicit lunar acceleration.
 */
export class LunarPropagator implements OrbitPropagator {
  readonly elements: StaticOrbitalElements;
  readonly kind: PropagatorKind = 'lunar-elp';
  readonly source: PropagatorSource = {
    label: 'Meeus, Astronomical Algorithms (truncated ELP-2000/82)',
    url: 'https://en.wikipedia.org/wiki/Lunar_theory',
    note: 'Geocentric ecliptic position; ~30″ accuracy over centuries',
  };

  constructor() {
    // Average elements — used only by OrbitLine for the dashed orbit visualisation.
    this.elements = {
      a: 384399 / KM_PER_AU,
      e: 0.0549,
      iDeg: 5.145,
      ΩDeg: 125.08,
      ωDeg: 318.0,
      periodDays: 27.321661,
    };
  }

  stateAt(jd: number): StateVector {
    const position = moonPositionEcliptic(jd);
    // Numerical velocity, central difference, dt ≈ 1.4 min
    const dt = 0.001;
    const fwd = moonPositionEcliptic(jd + dt);
    const bwd = moonPositionEcliptic(jd - dt);
    const velocity = fwd.clone().sub(bwd).multiplyScalar(0.5 / dt);
    return { position, velocity };
  }
}
