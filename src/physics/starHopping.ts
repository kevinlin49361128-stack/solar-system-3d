import { NAMED_STARS } from '../data/stars';

/**
 * Star-hopping helper: find a chain of bright reference stars connecting
 * a known easy-to-find anchor (mag ≤ 3) to a faint target (DSO, dim
 * planet, faint star). Used for non-GoTo telescope/binocular observers
 * who need to walk the eyepiece across the sky in small jumps.
 *
 * Algorithm
 * ---------
 * 1. Compute angular distance from the target to every named star.
 * 2. Sort by distance ascending.
 * 3. Walk the list outward, building a path: each step's reference must
 *    be within `MAX_STEP_DEG` of the previous step (so the user keeps it
 *    in their finder field while moving), AND the path can't exceed
 *    `MAX_STEPS` total hops.
 * 4. Stop when the latest step is within `MAX_STEP_DEG` of a true bright
 *    anchor (mag ≤ 2.0) — that's the "you can see this with naked eye
 *    from anywhere" handoff point.
 *
 * Output: ordered list of waypoints from anchor → target. Each entry has
 * the named star + its angular distance to the next waypoint, suitable
 * for direct rendering in InfoPanel as "vega → α Lyr → ... → M57".
 *
 * Limitations: uses NAMED_STARS only (~70 entries) — fine for major DSOs
 * in well-populated regions, may fail near the south celestial pole
 * where named stars are sparse. A future BSC-aware version would solve
 * that but adds complexity (8400 candidates per query).
 */

export interface StarHopWaypoint {
  /** Named-star id (e.g. "vega"), or null for the start (target itself). */
  starId: string | null;
  name: string;
  nameEn: string;
  raHours: number;
  decDeg: number;
  magnitude: number;
  /** Angular distance to the NEXT waypoint (degrees). 0 for the final entry. */
  distanceToNextDeg: number;
  /** Position-angle (compass bearing) to the next waypoint, deg. -1 = N/A. */
  bearingToNextDeg: number;
}

const MAX_STEP_DEG = 10;      // ~7×50 binocular field, slight slack
const MAX_STEPS = 5;
// mag ≤ 2.5 — naked-eye reliable in suburban skies (Bortle 6-).
// Tightened to ≤ 2.0 forces the algorithm to find truly bright anchors,
// but most named-star catalogues thin out fast below 2.0 leaving DSO
// regions like Cassiopeia / Andromeda unreachable.
const ANCHOR_MAG_LIMIT = 2.5;

const D2R = Math.PI / 180;
const R2D = 180 / Math.PI;

/** Great-circle angular distance between two RA/Dec positions, degrees. */
function angularDistanceDeg(
  ra1H: number, dec1: number,
  ra2H: number, dec2: number,
): number {
  const ra1 = ra1H * 15 * D2R;
  const ra2 = ra2H * 15 * D2R;
  const d1 = dec1 * D2R;
  const d2 = dec2 * D2R;
  const cosD = Math.sin(d1) * Math.sin(d2) + Math.cos(d1) * Math.cos(d2) * Math.cos(ra1 - ra2);
  return Math.acos(Math.max(-1, Math.min(1, cosD))) * R2D;
}

/** Compass-style bearing on the celestial sphere from (ra1,dec1) toward (ra2,dec2). */
function bearingDeg(
  ra1H: number, dec1: number,
  ra2H: number, dec2: number,
): number {
  const ra1 = ra1H * 15 * D2R;
  const ra2 = ra2H * 15 * D2R;
  const d1 = dec1 * D2R;
  const d2 = dec2 * D2R;
  const dRa = ra2 - ra1;
  const y = Math.sin(dRa) * Math.cos(d2);
  const x = Math.cos(d1) * Math.sin(d2) - Math.sin(d1) * Math.cos(d2) * Math.cos(dRa);
  let b = Math.atan2(y, x) * R2D;
  if (b < 0) b += 360;
  return b;
}

/** Compass cardinal label for a bearing. */
export function bearingCardinal(deg: number): string {
  const labels = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return labels[Math.round(deg / 45) % 8];
}

/**
 * Compute a star-hopping path from a bright anchor star to the given
 * target. Returns null if no usable path exists (e.g. target is too far
 * from any named star). The path is target-LAST: callers traverse from
 * `path[0]` (the bright anchor) to `path[path.length - 1]` (the target).
 *
 * @param targetRaHours target RA in hours (J2000)
 * @param targetDecDeg  target Dec in degrees (J2000)
 * @param targetName    display name of the target (last entry)
 */
export function findStarHopPath(
  targetRaHours: number,
  targetDecDeg: number,
  targetName: string,
): StarHopWaypoint[] | null {
  // Distance from target to every candidate.
  const candidates = NAMED_STARS.map(s => ({
    star: s,
    distFromTarget: angularDistanceDeg(s.raHours, s.decDeg, targetRaHours, targetDecDeg),
  })).sort((a, b) => a.distFromTarget - b.distFromTarget);

  if (candidates.length === 0) return null;

  // Closest named star to target — must be within MAX_STEP_DEG, otherwise
  // the path would start with a leap larger than a finder field.
  const nearest = candidates[0];
  if (nearest.distFromTarget > MAX_STEP_DEG) return null;

  // Walk outward: at each step, find the brightest near-by named star
  // that's within MAX_STEP_DEG of the previous waypoint. Stop when we
  // hit one with mag ≤ ANCHOR_MAG_LIMIT.
  const path: typeof NAMED_STARS = [nearest.star];
  let last = nearest.star;
  for (let i = 0; i < MAX_STEPS && last.magnitude > ANCHOR_MAG_LIMIT; i++) {
    // Among unused stars within MAX_STEP_DEG of `last`, pick the brightest.
    const next = NAMED_STARS
      .filter(s => !path.includes(s))
      .map(s => ({ s, d: angularDistanceDeg(s.raHours, s.decDeg, last.raHours, last.decDeg) }))
      .filter(({ d }) => d <= MAX_STEP_DEG)
      .sort((a, b) => a.s.magnitude - b.s.magnitude)[0]?.s;
    if (!next) break;
    path.push(next);
    last = next;
  }

  // Reverse so the path runs anchor → target. (We built it target-side first.)
  path.reverse();

  // If the final star in our anchor walk isn't itself an anchor-bright
  // star, the path isn't actually a star hop — refuse to render rather
  // than mislead the observer.
  if (path[0].magnitude > ANCHOR_MAG_LIMIT) return null;

  // Build waypoints with distances + bearings to the next.
  const out: StarHopWaypoint[] = [];
  for (let i = 0; i < path.length; i++) {
    const cur = path[i];
    const next = i < path.length - 1 ? path[i + 1] : null;
    const distToNext = next
      ? angularDistanceDeg(cur.raHours, cur.decDeg, next.raHours, next.decDeg)
      : angularDistanceDeg(cur.raHours, cur.decDeg, targetRaHours, targetDecDeg);
    const bearingNext = next
      ? bearingDeg(cur.raHours, cur.decDeg, next.raHours, next.decDeg)
      : bearingDeg(cur.raHours, cur.decDeg, targetRaHours, targetDecDeg);
    out.push({
      starId: cur.id,
      name: cur.name,
      nameEn: cur.nameEn,
      raHours: cur.raHours,
      decDeg: cur.decDeg,
      magnitude: cur.magnitude,
      distanceToNextDeg: distToNext,
      bearingToNextDeg: bearingNext,
    });
  }
  // Append the target itself as the final waypoint (with distance 0).
  out.push({
    starId: null,
    name: targetName,
    nameEn: targetName,
    raHours: targetRaHours,
    decDeg: targetDecDeg,
    magnitude: 99,
    distanceToNextDeg: 0,
    bearingToNextDeg: -1,
  });
  return out;
}
