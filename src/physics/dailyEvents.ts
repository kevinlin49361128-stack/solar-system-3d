import { gmstRad } from './topocentric';

/**
 * Daily-cycle calculations for an observer at a given lat/lon: sun and
 * moon rise/set, civil/nautical/astronomical twilight, day length,
 * equation of time. Pure functions — no Vector3 dependency, just JD +
 * lat/lon in/out.
 *
 * Method: low-precision sun/moon ephemerides (good to ~1 minute) +
 * iterative root-finding on altitude(t) for rise/set times. Twilight
 * uses the same root-finder with different target altitude:
 *   civil:        sun altitude  = −6°
 *   nautical:                    = −12°
 *   astronomical:                = −18°
 *   sun-rise/set:                = −0.833° (refraction + sun radius)
 *   moon-rise/set:               = +0.125° (parallax − refraction, approx)
 *
 * Where applicable, we work in solar time of the local longitude meridian
 * (UT + lon/15) so "today" is well-defined for the observer's clock.
 */

const DEG = Math.PI / 180;

/**
 * Local sidereal time, degrees [0, 360).
 *   LST = GMST + λ_east
 *
 * Used for hour-angle conversions (HA = LST − RA) and observation
 * planning ("what's transiting now?").
 */
export function localSiderealDeg(jd: number, lonDeg: number): number {
  const gmstDeg = (gmstRad(jd) * 180 / Math.PI) % 360;
  let lst = (gmstDeg + lonDeg) % 360;
  if (lst < 0) lst += 360;
  return lst;
}

/** Hour angle (degrees) of a body at given local sidereal time and RA. */
export function hourAngleDeg(raHours: number, lstDeg: number): number {
  let ha = (lstDeg - raHours * 15) % 360;
  if (ha > 180) ha -= 360;
  if (ha < -180) ha += 360;
  return ha;
}

/**
 * Low-precision sun ecliptic longitude (degrees) and declination.
 * Source: Astronomical Almanac low-accuracy formulas (good to ~1 arcmin).
 */
function sunPosition(jd: number): { raDeg: number; decDeg: number } {
  const n = jd - 2451545.0; // days since J2000
  // Mean longitude (deg) and mean anomaly (deg).
  const L = (280.460 + 0.9856474 * n) % 360;
  const g = ((357.528 + 0.9856003 * n) % 360) * DEG;
  // Ecliptic longitude with two-term equation of centre.
  const lambda = (L + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)) * DEG;
  // Obliquity of the ecliptic (slow drift; 23.439 − 4e-7·n is fine).
  const eps = (23.439 - 4e-7 * n) * DEG;
  // Equatorial coords.
  const sinDec = Math.sin(eps) * Math.sin(lambda);
  const decDeg = Math.asin(sinDec) * 180 / Math.PI;
  let raDeg = Math.atan2(Math.cos(eps) * Math.sin(lambda), Math.cos(lambda)) * 180 / Math.PI;
  if (raDeg < 0) raDeg += 360;
  return { raDeg, decDeg };
}

/** Sun altitude (degrees) at a given JD for an observer at (lat, lon). */
export function sunAltitudeDeg(jd: number, latDeg: number, lonDeg: number): number {
  const sun = sunPosition(jd);
  const lst = localSiderealDeg(jd, lonDeg);
  const ha = (lst - sun.raDeg) * DEG;
  const lat = latDeg * DEG;
  const dec = sun.decDeg * DEG;
  const sinAlt = Math.sin(lat) * Math.sin(dec) + Math.cos(lat) * Math.cos(dec) * Math.cos(ha);
  return Math.asin(Math.max(-1, Math.min(1, sinAlt))) * 180 / Math.PI;
}

/**
 * Low-precision moon ecliptic longitude / latitude / parallax. Brown's
 * theory of the moon truncated to a few main terms (good to ~0.1° on
 * ecliptic longitude — plenty for rise/set computation since the ±1
 * minute uncertainty from limb / refraction dominates).
 */
function moonPosition(jd: number): { raDeg: number; decDeg: number } {
  const n = jd - 2451545.0;
  const T = n / 36525;
  // Mean longitudes (degrees).
  const Lp = 218.316 + 13.176396 * n;
  const M  = 134.963 + 13.064993 * n;
  const F  = 93.272  + 13.229350 * n;
  const D  = 297.850 + 12.190749 * n; // mean elongation
  void T;
  const lambda = (Lp
    + 6.289 * Math.sin(M * DEG)
    - 1.274 * Math.sin((M - 2 * D) * DEG)
    + 0.658 * Math.sin(2 * D * DEG)
    - 0.186 * Math.sin((2 * M - 2 * D) * DEG)
    - 0.059 * Math.sin((2 * M) * DEG)
    - 0.057 * Math.sin((M + 2 * D) * DEG)
    + 0.053 * Math.sin((M + 2 * D - 2 * D) * DEG)
  ) * DEG;
  const beta = (5.128 * Math.sin(F * DEG)
    + 0.281 * Math.sin((M + F) * DEG)
    - 0.278 * Math.sin((M - F) * DEG)
  ) * DEG;
  const eps = (23.439 - 4e-7 * n) * DEG;
  // Convert ecliptic → equatorial.
  const sinDec = Math.sin(beta) * Math.cos(eps) + Math.cos(beta) * Math.sin(eps) * Math.sin(lambda);
  const decDeg = Math.asin(Math.max(-1, Math.min(1, sinDec))) * 180 / Math.PI;
  const y = Math.sin(lambda) * Math.cos(eps) - Math.tan(beta) * Math.sin(eps);
  const x = Math.cos(lambda);
  let raDeg = Math.atan2(y, x) * 180 / Math.PI;
  if (raDeg < 0) raDeg += 360;
  return { raDeg, decDeg };
}

/** Moon altitude (degrees) at a given JD for an observer at (lat, lon). */
export function moonAltitudeDeg(jd: number, latDeg: number, lonDeg: number): number {
  const m = moonPosition(jd);
  const lst = localSiderealDeg(jd, lonDeg);
  const ha = (lst - m.raDeg) * DEG;
  const lat = latDeg * DEG;
  const dec = m.decDeg * DEG;
  const sinAlt = Math.sin(lat) * Math.sin(dec) + Math.cos(lat) * Math.cos(dec) * Math.cos(ha);
  return Math.asin(Math.max(-1, Math.min(1, sinAlt))) * 180 / Math.PI;
}

/**
 * Find the JD nearest to `centerJd` (within ±halfWindowDays) where the
 * altitude of `body` crosses `targetAltDeg` from below (rise) or above
 * (set). Returns null if no crossing.
 *
 * Strategy: sample altitude every step (default 10 min), look for a sign
 * change of (alt − target), then bisect to refine to ~1 second.
 */
function findCrossing(
  altFn: (jd: number) => number,
  centerJd: number,
  halfWindowDays: number,
  targetAltDeg: number,
  direction: 'rise' | 'set',
  stepDays: number = 10 / 1440, // 10 minutes
): number | null {
  const start = centerJd - halfWindowDays;
  const end = centerJd + halfWindowDays;
  let prevJd = start;
  let prevAlt = altFn(prevJd) - targetAltDeg;
  for (let jd = start + stepDays; jd <= end; jd += stepDays) {
    const alt = altFn(jd) - targetAltDeg;
    const wantSign = direction === 'rise' ? prevAlt < 0 && alt >= 0 : prevAlt > 0 && alt <= 0;
    if (wantSign) {
      // Bisect within [prevJd, jd] for sub-minute precision.
      let lo = prevJd, hi = jd;
      for (let k = 0; k < 24; k++) { // 24 halvings ≈ 0.5 sec
        const mid = (lo + hi) / 2;
        const a = altFn(mid) - targetAltDeg;
        if ((direction === 'rise' && a < 0) || (direction === 'set' && a > 0)) lo = mid;
        else hi = mid;
      }
      return (lo + hi) / 2;
    }
    prevJd = jd;
    prevAlt = alt;
  }
  return null;
}

export interface DailyEvents {
  /** Sunrise UTC JD, or null if sun doesn't rise in this window (polar). */
  sunrise: number | null;
  sunset: number | null;
  /** Civil twilight (sun = −6°): start = morning end-of-darkness, end = evening start-of-darkness. */
  civilDawn: number | null;
  civilDusk: number | null;
  /** Nautical twilight (sun = −12°). */
  nauticalDawn: number | null;
  nauticalDusk: number | null;
  /** Astronomical twilight (sun = −18° → fully dark sky). */
  astronomicalDawn: number | null;
  astronomicalDusk: number | null;
  /** Solar noon (sun's transit, highest altitude). */
  solarNoon: number | null;
  /** Day length (sunrise to sunset), hours. null if no rise/set. */
  dayLengthHours: number | null;
  /** Equation of time (apparent − mean solar time), minutes. */
  equationOfTimeMin: number;
  /** Moon rise / set in same window. */
  moonrise: number | null;
  moonset: number | null;
}

/**
 * Compute today's sun/moon events for the observer. `jdLocalNoon` should
 * be roughly midday at the observer's longitude — we search ±0.6 days
 * around it to capture today's rise/set even when the cycle straddles
 * 00:00 UT.
 */
export function computeDailyEvents(
  jdLocalNoon: number,
  latDeg: number,
  lonDeg: number,
): DailyEvents {
  const sunAlt = (jd: number) => sunAltitudeDeg(jd, latDeg, lonDeg);
  const moonAlt = (jd: number) => moonAltitudeDeg(jd, latDeg, lonDeg);

  const win = 0.6; // ±14.4 hours
  // Standard atmospheric refraction at horizon ≈ 34′ + sun semi-diameter
  // 16′ = 50′ → use −0.833° as the effective sunrise/sunset altitude.
  const SUN_HORIZON = -0.833;
  const MOON_HORIZON = +0.125; // parallax ≈ 57′ minus refraction 34′ ≈ +23′; we use +7.5′ as compromise

  const sunrise = findCrossing(sunAlt, jdLocalNoon, win, SUN_HORIZON, 'rise');
  const sunset  = findCrossing(sunAlt, jdLocalNoon, win, SUN_HORIZON, 'set');
  const civilDawn        = findCrossing(sunAlt, jdLocalNoon, win, -6, 'rise');
  const civilDusk        = findCrossing(sunAlt, jdLocalNoon, win, -6, 'set');
  const nauticalDawn     = findCrossing(sunAlt, jdLocalNoon, win, -12, 'rise');
  const nauticalDusk     = findCrossing(sunAlt, jdLocalNoon, win, -12, 'set');
  const astronomicalDawn = findCrossing(sunAlt, jdLocalNoon, win, -18, 'rise');
  const astronomicalDusk = findCrossing(sunAlt, jdLocalNoon, win, -18, 'set');
  const moonrise = findCrossing(moonAlt, jdLocalNoon, win, MOON_HORIZON, 'rise');
  const moonset  = findCrossing(moonAlt, jdLocalNoon, win, MOON_HORIZON, 'set');

  // Solar noon: hour-angle = 0 ↔ sun's RA = LST.
  // Approximate: bracket maximum altitude in the window.
  let solarNoon: number | null = null;
  let bestAlt = -Infinity;
  for (let jd = jdLocalNoon - 0.5; jd <= jdLocalNoon + 0.5; jd += 1 / 1440) {
    const a = sunAlt(jd);
    if (a > bestAlt) { bestAlt = a; solarNoon = jd; }
  }

  const dayLengthHours = (sunrise != null && sunset != null && sunset > sunrise)
    ? (sunset - sunrise) * 24
    : null;

  // Equation of time: difference between apparent and mean solar time
  // at the observer's longitude meridian, in minutes.
  // EoT = (mean longitude − apparent right ascension) − (mean longitude − apparent longitude)
  // Practical low-accuracy form (Meeus): in minutes,
  //   EoT ≈ 9.87·sin(2B) − 7.53·cos(B) − 1.5·sin(B), where B = 2π(N−81)/365
  // N is day-of-year. Good to ~30 seconds.
  const date = new Date((jdLocalNoon - 2440587.5) * 86400000);
  const doy = Math.floor(
    (Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
      - Date.UTC(date.getUTCFullYear(), 0, 0)) / 86400000,
  );
  const B = (2 * Math.PI * (doy - 81)) / 365;
  const equationOfTimeMin =
    9.87 * Math.sin(2 * B) - 7.53 * Math.cos(B) - 1.5 * Math.sin(B);

  return {
    sunrise, sunset,
    civilDawn, civilDusk,
    nauticalDawn, nauticalDusk,
    astronomicalDawn, astronomicalDusk,
    solarNoon, dayLengthHours,
    equationOfTimeMin,
    moonrise, moonset,
  };
}

/** Convert a JD to a Date object. */
export function jdToDate(jd: number): Date {
  return new Date((jd - 2440587.5) * 86400000);
}
