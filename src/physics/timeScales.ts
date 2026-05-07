/**
 * Time-scale conversions for high-precision astronomy.
 *
 * What this module exposes
 * ------------------------
 * - `deltaTSeconds(year)`: ΔT = TT − UT1 (seconds), the offset between
 *   uniform Terrestrial Time used by ephemerides and Earth's actual
 *   (slowing) rotation time. Positive in modern era (~70s in 2025);
 *   negative around 1900; ~10000s in antiquity.
 * - `tdtFromUtcJd(jd)`: convert a JD treated as UTC ≈ UT1 to TT-based JD,
 *   the time scale ephemerides like VSOP87 / DE actually want.
 *
 * Formula
 * -------
 * Espenak & Meeus 2006 "Five Millennium Canon of Solar Eclipses"
 * piecewise polynomial set, used by NASA Eclipse pages. Valid −1999 to
 * +3000 with claimed accuracy ±10 s in modern era, ±30 min in antiquity.
 *
 *   https://eclipse.gsfc.nasa.gov/SEcat5/deltatpoly.html
 *
 * Why this matters in this app
 * ----------------------------
 * Most existing physics code treats simulation JD as UTC and feeds that
 * directly into Kepler / Meeus formulas (which want TT). For modern
 * dates the ΔT ≈ 70s makes <0.001° error in solar position — invisible.
 * For historical events (e.g. Halley's apparition in 1066) ΔT is ~40 min
 * and produces ~0.1° error — visible. We surface ΔT so the user
 * understands the limitation, even though we don't yet plumb TT through
 * the propagators.
 */

const J2000_JD = 2451545.0;

/**
 * ΔT = TT − UT1, in seconds, for the given decimal year.
 * Espenak-Meeus 2006 piecewise polynomials.
 *
 * Examples (decimal years → seconds):
 *   2000 → 63.83 (J2000 reference)
 *   1950 → 29.1
 *   1900 → -2.7 (UT was ahead of TT briefly)
 *   1800 → 13.7
 *   1000 → 1574
 *   0    → 10580
 *
 * @param year decimal year (e.g. 2025.5 for mid-2025)
 */
export function deltaTSeconds(year: number): number {
  const y = year;
  let u: number, t: number;

  // Modern era: 2005 — present, refined regularly
  if (y >= 2005 && y < 2050) {
    t = y - 2000;
    return 62.92 + 0.32217 * t + 0.005589 * t * t;
  }
  // Near future projection (rough)
  if (y >= 2050 && y < 2150) {
    u = (y - 1820) / 100;
    return -20 + 32 * u * u - 0.5628 * (2150 - y);
  }
  // Far future / far past asymptotic form
  if (y < -500 || y >= 2150) {
    u = (y - 1820) / 100;
    return -20 + 32 * u * u;
  }
  // -500 to +500
  if (y >= -500 && y < 500) {
    u = y / 100;
    return 10583.6
         - 1014.41 * u
         + 33.78311 * u ** 2
         - 5.952053 * u ** 3
         - 0.1798452 * u ** 4
         + 0.022174192 * u ** 5
         + 0.0090316521 * u ** 6;
  }
  // 500 to 1600
  if (y >= 500 && y < 1600) {
    u = (y - 1000) / 100;
    return 1574.2
         - 556.01 * u
         + 71.23472 * u ** 2
         + 0.319781 * u ** 3
         - 0.8503463 * u ** 4
         - 0.005050998 * u ** 5
         + 0.0083572073 * u ** 6;
  }
  // 1600 to 1700
  if (y >= 1600 && y < 1700) {
    t = y - 1600;
    return 120 - 0.9808 * t - 0.01532 * t * t + (t * t * t) / 7129;
  }
  // 1700 to 1800
  if (y >= 1700 && y < 1800) {
    t = y - 1700;
    return 8.83
         + 0.1603 * t
         - 0.0059285 * t * t
         + 0.00013336 * t ** 3
         - (t ** 4) / 1174000;
  }
  // 1800 to 1860
  if (y >= 1800 && y < 1860) {
    t = y - 1800;
    return 13.72
         - 0.332447 * t
         + 0.0068612 * t * t
         + 0.0041116 * t ** 3
         - 0.00037436 * t ** 4
         + 0.0000121272 * t ** 5
         - 0.0000001699 * t ** 6
         + 0.000000000875 * t ** 7;
  }
  // 1860 to 1900
  if (y >= 1860 && y < 1900) {
    t = y - 1860;
    return 7.62
         + 0.5737 * t
         - 0.251754 * t * t
         + 0.01680668 * t ** 3
         - 0.0004473624 * t ** 4
         + (t ** 5) / 233174;
  }
  // 1900 to 1920
  if (y >= 1900 && y < 1920) {
    t = y - 1900;
    return -2.79
         + 1.494119 * t
         - 0.0598939 * t * t
         + 0.0061966 * t ** 3
         - 0.000197 * t ** 4;
  }
  // 1920 to 1941
  if (y >= 1920 && y < 1941) {
    t = y - 1920;
    return 21.20
         + 0.84493 * t
         - 0.076100 * t * t
         + 0.0020936 * t ** 3;
  }
  // 1941 to 1961
  if (y >= 1941 && y < 1961) {
    t = y - 1950;
    return 29.07
         + 0.407 * t
         - (t * t) / 233
         + (t ** 3) / 2547;
  }
  // 1961 to 1986
  if (y >= 1961 && y < 1986) {
    t = y - 1975;
    return 45.45
         + 1.067 * t
         - (t * t) / 260
         - (t ** 3) / 718;
  }
  // 1986 to 2005
  if (y >= 1986 && y < 2005) {
    t = y - 2000;
    return 63.86
         + 0.3345 * t
         - 0.060374 * t * t
         + 0.0017275 * t ** 3
         + 0.000651814 * t ** 4
         + 0.00002373599 * t ** 5;
  }
  // Should be unreachable
  return 0;
}

/**
 * Convert a Julian Date that is currently treated as UTC ≈ UT1 into the
 * equivalent JD on the TT (Terrestrial Time) scale. The shift is small
 * (~70s in 2025) but matters for high-precision ephemerides.
 *
 * NOTE: most propagators in this codebase don't currently distinguish —
 * they accept whatever JD they're given. Use this when you want explicit
 * TT input (e.g. comparing against Horizons or VSOP87 results).
 */
export function tdtFromUtcJd(jd: number): number {
  const year = jdToDecimalYear(jd);
  const dt = deltaTSeconds(year);
  return jd + dt / 86400;
}

/** JD → decimal year (Gregorian, sufficient for ΔT lookup). */
export function jdToDecimalYear(jd: number): number {
  // Approximate: avg year length 365.25 days; J2000.0 = 2000.0 in TT.
  return 2000 + (jd - J2000_JD) / 365.25;
}
