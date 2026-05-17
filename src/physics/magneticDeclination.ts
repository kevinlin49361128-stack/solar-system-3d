/**
 * Magnetic declination — the angle between magnetic north (what a
 * compass needle / phone magnetometer points to) and true (geographic)
 * north. Positive = magnetic north is EAST of true north (e.g. NYC at
 * ~-13° → magnetic is 13° WEST of true → compass heading 0° actually
 * means you're facing 13° east of geographic north).
 *
 * Why we need this: in observer-mode AR (phone gyro driving the camera),
 * iOS's `webkitCompassHeading` and Android's `alpha` both report
 * MAGNETIC heading. If we treat that as TRUE heading the rendered sky
 * is rotated by the local declination — for Taipei ~3°, for London ~1°,
 * for Vancouver ~16°. The latter is "the sun should be over there but
 * the screen shows it 16° off" levels of wrong.
 *
 * Model: a truncated WMM 2025 spherical-harmonic expansion to order n=3
 * (dipole + quadrupole + octupole). Uses 20 Gauss coefficients total:
 *
 *   n=1 (dipole):     g₁⁰, g₁¹, h₁¹                              — 3
 *   n=2 (quadrupole): g₂⁰, g₂¹, h₂¹, g₂², h₂²                    — 5
 *   n=3 (octupole):   g₃⁰, g₃¹, h₃¹, g₃², h₃², g₃³, h₃³          — 7
 *   (m=0 terms have no h component.)
 *
 * Versus the full 12th-order WMM (168 coefficients), this catches the
 * global declination pattern to ~3° in most populated regions. n=3 vs
 * the previous n=2 fix specifically improves Pacific Northwest (sign
 * flip resolved) and reduces South Atlantic anomaly error from ~17°
 * to ~10°. Worst-case residual is still ~10° at hotspots; acceptable
 * for an AR sky aid given the phone gyro's own 1–3° noise floor.
 *
 * Coefficients are WMM 2025 epoch 2025.0, units nT.
 * Reference: https://www.ncei.noaa.gov/products/world-magnetic-model
 */

// Dipole (n=1)
const G10 = -29404.8;
const G11 =  -1450.9;
const H11 =   4652.5;
// Quadrupole (n=2)
const G20 = -2499.6;
const G21 =  2982.0;
const H21 = -2991.6;
const G22 =  1677.0;
const H22 =  -734.6;
// Octupole (n=3) — WMM 2025 epoch 2025.0
const G30 =  1363.2;
const G31 = -2381.2;
const H31 =   -82.1;
const G32 =  1236.2;
const H32 =   241.9;
const G33 =   525.7;
const H33 =  -543.4;
const SQRT3 = Math.sqrt(3);
// Schmidt-normalization constants for n=3:
//   P_3^1 has Schmidt factor √(2·2!/4!) = √(1/6) → (1/√6) · 3·sinθ·(5cos²θ−1)/2 doesn't simplify nicely;
//   we use the closed-form Schmidt P_3^m below directly.
//   Coefficients in front of the Legendre-derived polynomials:
const SCH_31 = Math.sqrt(6) / 4;   // for sinθ·(5cos²θ − 1) basis  → matches Schmidt
const SCH_32 = Math.sqrt(60) / 4;  // for sin²θ·cosθ basis
const SCH_33 = Math.sqrt(10) / 4;  // for sin³θ basis

/**
 * Compute magnetic declination at the given geographic coordinates,
 * in degrees. Positive = magnetic north is EAST of true north.
 *
 *   latDeg  — geographic latitude (-90..+90)
 *   lonDeg  — geographic longitude (-180..+180), east-positive
 *
 * Returned value: angle from true north to magnetic north, measured
 * eastward, in degrees. Typical magnitudes: 0–25° at populated lats,
 * up to ~180° at the magnetic poles themselves.
 */
export function magneticDeclinationDeg(latDeg: number, lonDeg: number): number {
  // Clamp latitude to avoid pole singularity; treat anything within
  // 0.01° of a pole as the pole itself (declination is undefined exactly
  // at the magnetic poles since "north" has no meaning there).
  const lat = Math.max(-89.99, Math.min(89.99, latDeg)) * Math.PI / 180;
  const lon = lonDeg * Math.PI / 180;
  // Colatitude θ ∈ (0, π); ecliptic longitude λ.
  const theta = Math.PI / 2 - lat;
  const sinT = Math.sin(theta);
  const cosT = Math.cos(theta);
  const sinL = Math.sin(lon);
  const cosL = Math.cos(lon);
  const sin2L = 2 * sinL * cosL;
  const cos2L = 1 - 2 * sinL * sinL;
  const sin3L = 3 * sinL - 4 * sinL * sinL * sinL;
  const cos3L = 4 * cosL * cosL * cosL - 3 * cosL;
  const cos2T = 2 * cosT * cosT - 1;
  const sin2T_sq = sinT * sinT;     // sin²θ
  const fiveCos2_1 = 5 * cosT * cosT - 1;
  const fifteenCos2_11 = 15 * cosT * cosT - 11;
  const threeCos2_1 = 3 * cosT * cosT - 1;

  // X (north) component: + Σ_n Σ_m (g·cos mλ + h·sin mλ) · dP_n^m/dθ
  // (we drop the (a/r)^(n+2) factor — it cancels in atan2 declination).
  //
  //   n=1, m=0:  g₁⁰ · (-sinθ)
  //   n=1, m=1:  (g₁¹·cosλ + h₁¹·sinλ) · cosθ           [Schmidt-norm: dP_1^1/dθ = cosθ]
  //   n=2, m=0:  g₂⁰ · (-3·sinθ·cosθ)
  //   n=2, m=1:  (g₂¹·cosλ + h₂¹·sinλ) · √3·cos(2θ)
  //   n=2, m=2:  (g₂²·cos(2λ) + h₂²·sin(2λ)) · √3·sinθ·cosθ
  //   n=3, m=0:  g₃⁰ · -(3/2) sinθ (5cos²θ - 1)
  //   n=3, m=1:  (g₃¹·cosλ + h₃¹·sinλ) · (√6/4) · cosθ · (15cos²θ - 11)
  //   n=3, m=2:  (g₃²·cos(2λ) + h₃²·sin(2λ)) · (√60/4) · sinθ · (3cos²θ - 1)
  //   n=3, m=3:  (g₃³·cos(3λ) + h₃³·sin(3λ)) · (3√10/4) · sin²θ · cosθ
  const X =
    - G10 * sinT
    + (G11 * cosL + H11 * sinL) * cosT
    - G20 * 3 * sinT * cosT
    + (G21 * cosL + H21 * sinL) * SQRT3 * cos2T
    + (G22 * cos2L + H22 * sin2L) * SQRT3 * sinT * cosT
    - G30 * 1.5 * sinT * fiveCos2_1
    + (G31 * cosL + H31 * sinL) * SCH_31 * cosT * fifteenCos2_11
    + (G32 * cos2L + H32 * sin2L) * SCH_32 * sinT * threeCos2_1
    + (G33 * cos3L + H33 * sin3L) * 3 * SCH_33 * sin2T_sq * cosT;

  // Y (east) component: -(1/sinθ) · Σ_n Σ_m m·(-g·sin mλ + h·cos mλ)·P_n^m
  //
  //   n=1, m=1:  (g₁¹·sinλ − h₁¹·cosλ)                          [Schmidt-norm: P_1^1 = sinθ]
  //   n=2, m=1:  (g₂¹·sinλ − h₂¹·cosλ) · √3·cosθ
  //   n=2, m=2:  (g₂²·sin(2λ) − h₂²·cos(2λ)) · √3·sinθ
  //   n=3, m=1:  (g₃¹·sinλ − h₃¹·cosλ) · (√6/4) · (5cos²θ − 1)
  //   n=3, m=2:  2·(g₃²·sin(2λ) − h₃²·cos(2λ)) · (√60/4) · sinθ·cosθ
  //   n=3, m=3:  3·(g₃³·sin(3λ) − h₃³·cos(3λ)) · (√10/4) · sin²θ
  const Y =
      (G11 * sinL - H11 * cosL)
    + (G21 * sinL - H21 * cosL) * SQRT3 * cosT
    + (G22 * sin2L - H22 * cos2L) * SQRT3 * sinT
    + (G31 * sinL - H31 * cosL) * SCH_31 * fiveCos2_1
    + 2 * (G32 * sin2L - H32 * cos2L) * SCH_32 * sinT * cosT
    + 3 * (G33 * sin3L - H33 * cos3L) * SCH_33 * sin2T_sq;

  // Declination = atan2(Y, X), positive east of north.
  return Math.atan2(Y, X) * 180 / Math.PI;
}

/**
 * Apply magnetic declination to a magnetic compass heading.
 *
 *   magneticHeadingDeg — what the phone's magnetometer reports
 *                        (0° = magnetic N, 90° = magnetic E)
 *   latDeg, lonDeg     — observer's geographic coordinates
 *
 * Returns the corresponding TRUE heading in [0, 360).
 *
 * Rule: true = magnetic + declination (when declination is positive-
 * east). Example: NYC declination ≈ −13° → if phone reads magnetic
 * heading 90° (E), true heading is 90 + (−13) = 77° → user is actually
 * facing N77°E, not due east.
 */
export function magneticToTrueHeadingDeg(
  magneticHeadingDeg: number, latDeg: number, lonDeg: number,
): number {
  const dec = magneticDeclinationDeg(latDeg, lonDeg);
  const trueDeg = magneticHeadingDeg + dec;
  return ((trueDeg % 360) + 360) % 360;
}
