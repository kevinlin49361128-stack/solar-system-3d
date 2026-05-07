/**
 * Per-body observation planning helpers — answer "when is X visible?"
 * questions for the user's current location and time. All inputs are
 * primitives (jd, lat, lon, plus a sampling function for body alt) so
 * this module stays decoupled from CameraController / SolarSystem and
 * is easy to unit-test.
 *
 * Pattern: caller provides `bodyAltAt(jd) → degrees` (which can include
 * refraction etc.) and `sunAltAt(jd) → degrees`; we do root-finding
 * (bisection on sign-changes of [alt − target]) to locate transits,
 * rise/set events, and twilight boundaries. Same machinery as
 * dailyEvents.ts; here we just point it at a parametrised body.
 */

export interface BodyVisibility {
  /** Current altitude (deg). Negative = below horizon. */
  altDeg: number;
  /** Sun altitude (deg) at the same JD. */
  sunAltDeg: number;
  /** True if altitude > 0 (above local geometric horizon, refraction-included). */
  aboveHorizon: boolean;
  /** True if sun altitude < −6° (civil dusk passed → sky dark enough to start seeing). */
  darkSky: boolean;
  /**
   * Short label describing whether this is a good time to observe.
   * Examples:  '🌙 適合觀測' | '🌅 太陽未沉' | '🌑 在地平線下'
   */
  status: 'observable' | 'sun-up' | 'below-horizon' | 'twilight';
  /** Human-readable Chinese status label. */
  statusLabel: string;
}

export function currentVisibility(altDeg: number, sunAltDeg: number): BodyVisibility {
  const aboveHorizon = altDeg > 0;
  const darkSky = sunAltDeg < -6; // civil twilight ends ≈ −6°
  let status: BodyVisibility['status'];
  let statusLabel: string;
  if (!aboveHorizon) {
    status = 'below-horizon';
    statusLabel = '🌑 地平線下';
  } else if (sunAltDeg > -0.833) {
    status = 'sun-up';
    statusLabel = '☀️ 太陽未沉，難觀測';
  } else if (!darkSky) {
    status = 'twilight';
    statusLabel = '🌆 暮光中（−18° < 太陽 < −6°）';
  } else {
    status = 'observable';
    statusLabel = '🌙 適合觀測';
  }
  return { altDeg, sunAltDeg, aboveHorizon, darkSky, status, statusLabel };
}

/**
 * Find the next time `bodyAltAt(jd)` crosses `targetAltDeg` in the given
 * direction within ±maxSearchDays of `fromJd`. Returns the JD or null
 * if no crossing in that window.
 *
 * Uses linear scan (default 5-min step) followed by bisection. Caller
 * picks the step coarse enough for cheapness, fine enough to never skip
 * a half-period (e.g. for moon HA crossings, 5 min is fine; for sun
 * crossings, 10 min works).
 */
export function findNextCrossing(
  bodyAltAt: (jd: number) => number,
  fromJd: number,
  targetAltDeg: number,
  direction: 'rise' | 'set',
  maxSearchDays = 1,
  stepDays = 5 / 1440,
): number | null {
  let prevJd = fromJd;
  let prevAlt = bodyAltAt(prevJd) - targetAltDeg;
  const end = fromJd + maxSearchDays;
  for (let jd = fromJd + stepDays; jd <= end; jd += stepDays) {
    const alt = bodyAltAt(jd) - targetAltDeg;
    const match = direction === 'rise' ? prevAlt < 0 && alt >= 0 : prevAlt > 0 && alt <= 0;
    if (match) {
      let lo = prevJd, hi = jd;
      for (let k = 0; k < 24; k++) {
        const mid = (lo + hi) / 2;
        const a = bodyAltAt(mid) - targetAltDeg;
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

/**
 * Find the next local maximum of `bodyAltAt(jd)` — the body's transit
 * (highest altitude of the day, when its hour angle = 0). Returns
 * { jd, altDeg } or null. Searches up to 1.5 days ahead with a 10-min
 * step then refines with golden-section.
 */
export function findNextTransit(
  bodyAltAt: (jd: number) => number,
  fromJd: number,
  maxSearchDays = 1.5,
  stepDays = 10 / 1440,
): { jd: number; altDeg: number } | null {
  let prev2 = bodyAltAt(fromJd);
  let prev1 = bodyAltAt(fromJd + stepDays);
  // Need a strictly increasing-then-decreasing triplet to bracket a max.
  for (let i = 2; i * stepDays <= maxSearchDays; i++) {
    const jd = fromJd + i * stepDays;
    const cur = bodyAltAt(jd);
    if (prev1 > prev2 && prev1 > cur) {
      // Bracketed by [jd-2*step, jd] with prev1 in the middle. Golden-section refine.
      let lo = jd - 2 * stepDays, hi = jd;
      const phi = (Math.sqrt(5) - 1) / 2; // 0.618…
      let x1 = hi - (hi - lo) * phi;
      let x2 = lo + (hi - lo) * phi;
      let f1 = bodyAltAt(x1), f2 = bodyAltAt(x2);
      for (let k = 0; k < 32; k++) {
        if (f1 > f2) {
          hi = x2; x2 = x1; f2 = f1;
          x1 = hi - (hi - lo) * phi;
          f1 = bodyAltAt(x1);
        } else {
          lo = x1; x1 = x2; f1 = f2;
          x2 = lo + (hi - lo) * phi;
          f2 = bodyAltAt(x2);
        }
      }
      const best = f1 > f2 ? x1 : x2;
      return { jd: best, altDeg: bodyAltAt(best) };
    }
    prev2 = prev1;
    prev1 = cur;
  }
  return null;
}

/**
 * Optimal observation window for tonight: longest contiguous interval
 * within the next 24 hours where:
 *   - body altitude > minAltDeg
 *   - sun altitude < maxSunAltDeg (default −6° = civil dusk)
 *
 * Returns { startJd, endJd, durationHours } or null if no window.
 */
export function findOptimalWindow(
  bodyAltAt: (jd: number) => number,
  sunAltAt: (jd: number) => number,
  fromJd: number,
  minAltDeg = 30,
  maxSunAltDeg = -12, // nautical twilight — slightly stricter than civil
  searchDays = 1,
  stepDays = 5 / 1440,
): { startJd: number; endJd: number; durationHours: number } | null {
  const isGood = (jd: number) => bodyAltAt(jd) > minAltDeg && sunAltAt(jd) < maxSunAltDeg;
  let bestStart = -1, bestEnd = -1, bestDur = 0;
  let curStart = -1;
  for (let jd = fromJd; jd <= fromJd + searchDays; jd += stepDays) {
    const good = isGood(jd);
    if (good && curStart < 0) curStart = jd;
    else if (!good && curStart >= 0) {
      const dur = jd - curStart;
      if (dur > bestDur) { bestDur = dur; bestStart = curStart; bestEnd = jd; }
      curStart = -1;
    }
  }
  if (curStart >= 0) {
    const dur = fromJd + searchDays - curStart;
    if (dur > bestDur) { bestDur = dur; bestStart = curStart; bestEnd = fromJd + searchDays; }
  }
  if (bestStart < 0) return null;
  return { startJd: bestStart, endJd: bestEnd, durationHours: bestDur * 24 };
}
