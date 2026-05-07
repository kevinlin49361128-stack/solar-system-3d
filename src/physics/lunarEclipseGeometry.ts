import type { Vector3 } from 'three';
import { AU_KM } from './constants';

/**
 * Lunar-eclipse geometry: when the Moon passes through Earth's shadow.
 *
 * Frame: we work in the geocentric ecliptic-J2000 plane projected
 * perpendicular to the Sun-Earth axis. The shadow is two concentric
 * circles centred on the antisolar point at the Moon's geocentric
 * distance:
 *   - Penumbra radius: r_p = (R_earth + R_sun · d_em / d_sm) ≈ R_earth · 2.5
 *   - Umbra radius:    r_u = (R_earth − R_sun · d_em / d_sm) ≈ R_earth · 0.7
 * (signs/signs flipped from solar eclipse cone — for solar we look outside
 * the moon's shadow, here we look inside Earth's.)
 *
 * Method:
 *   1. At time t, compute Moon's apparent offset from antisolar direction
 *      (this is the Moon's "position" relative to shadow centre).
 *   2. Compare that offset to umbra/penumbra radii to detect contacts.
 *   3. Bisection-find the four canonical contact times (P1/U1/U4/P4) and
 *      the maximum-eclipse moment (centre of closest-approach to umbra).
 *
 * Returns positions/contact times. UI overlays the moon disc moving
 * across the umbra circle for each frame.
 */

const R_SUN_KM = 696000;
const R_MOON_KM = 1737.4;
const R_EARTH_KM = 6371.0;

/**
 * Danjon atmospheric enlargement factor — Earth's atmosphere refracts
 * light into the geometric umbra/penumbra, making the effective shadow
 * boundary appear ~2% larger than pure geometry. Standard NASA / Meeus
 * convention uses 1/85 ≈ 1.176 % (Chauvenet) up to 2 % (Danjon empirical).
 * We use 2 % which matches Espenak's published eclipse predictions.
 */
const ATMOSPHERIC_ENLARGEMENT = 1.02;

export interface LunarEclipseFrame {
  jd: number;
  /** Moon centre offset from shadow axis, projected on plane perpendicular to Sun-Earth line, in km. */
  moonOffsetKm: { x: number; y: number };
  /** Earth's umbra radius at moon's geocentric distance (km). */
  umbraRadiusKm: number;
  /** Earth's penumbra radius at moon's geocentric distance (km). */
  penumbraRadiusKm: number;
  /** Moon's apparent radius at this distance (km, just R_moon since we're at moon distance). */
  moonRadiusKm: number;
  /** Distance from moon centre to shadow centre (km). */
  shadowDistKm: number;
}

export type LunarEclipseKind = 'total' | 'partial' | 'penumbral' | 'none';

export interface LunarEclipseResult {
  /** P1: penumbra first contact (moon edge enters penumbra). null if no penumbral phase. */
  p1Jd: number | null;
  /** U1: umbra first contact (moon edge enters umbra). null if not at least partial. */
  u1Jd: number | null;
  /** Greatest eclipse: maximum penetration (smallest centre-to-centre distance). */
  greatestJd: number | null;
  /** U2: total phase begins (moon fully inside umbra). null if not total. */
  u2Jd: number | null;
  /** U3: total phase ends. null if not total. */
  u3Jd: number | null;
  /** U4: umbra last contact. null if not at least partial. */
  u4Jd: number | null;
  /** P4: penumbra last contact. null if no penumbral phase. */
  p4Jd: number | null;
  /** Eclipse classification (final tier reached). */
  kind: LunarEclipseKind;
  /** Frame samples for path visualisation (~1 min step). */
  frames: LunarEclipseFrame[];
  /** Eclipse magnitude at greatest (umbra: 1.0+ = total). */
  umbraMagnitude: number;
}

/**
 * Compute lunar eclipse geometry around `peakJd`.
 *
 * @param sunGeocentric Sun geocentric ecliptic position (AU). Use Meeus
 *   solarSpherical for ~0.01° accuracy.
 * @param moonGeocentric Moon geocentric ecliptic position (AU). Use ELP-2000.
 * @param peakJd Approximate full-moon JD (from event scanner).
 * @param halfWindowDays Search half-window (default 0.25 day = 6 h).
 * @param stepDays Sampling step (default 1 min).
 */
export function computeLunarEclipse(
  sunGeocentric: (jd: number) => Vector3,
  moonGeocentric: (jd: number) => Vector3,
  peakJd: number,
  halfWindowDays: number = 0.25,
  stepDays: number = 1 / 1440,
): LunarEclipseResult {
  const frames: LunarEclipseFrame[] = [];
  let bestJd = peakJd;
  let bestDist = Infinity;
  let bestUmbraR = 0;
  let bestPenumbraR = 0;
  let bestMoonR = 0;

  for (let jd = peakJd - halfWindowDays; jd <= peakJd + halfWindowDays; jd += stepDays) {
    const f = sampleAt(sunGeocentric, moonGeocentric, jd);
    frames.push(f);
    if (f.shadowDistKm < bestDist) {
      bestDist = f.shadowDistKm;
      bestJd = jd;
      bestUmbraR = f.umbraRadiusKm;
      bestPenumbraR = f.penumbraRadiusKm;
      bestMoonR = f.moonRadiusKm;
    }
  }

  // Determine eclipse kind from greatest moment.
  const m_umbra = (bestUmbraR + bestMoonR - bestDist) / (2 * bestMoonR);
  let kind: LunarEclipseKind;
  if (bestDist + bestMoonR < bestUmbraR) kind = 'total';
  else if (bestDist - bestMoonR < bestUmbraR) kind = 'partial';
  else if (bestDist - bestMoonR < bestPenumbraR) kind = 'penumbral';
  else kind = 'none';

  // Find contact times by bisection. For each contact we look for the
  // first crossing of (shadowDist − targetRadius) from + → − or − → +.
  const targetSign = (jd: number, target: 'p_in' | 'p_out' | 'u_in' | 'u_out' | 'tot_in' | 'tot_out'): number => {
    const f = sampleAt(sunGeocentric, moonGeocentric, jd);
    const r = f.shadowDistKm;
    switch (target) {
      case 'p_in':
      case 'p_out':
        // Penumbra contact: moon edge touches penumbra circle.
        // Crossing at r = penumbraR + moonR.
        return r - (f.penumbraRadiusKm + f.moonRadiusKm);
      case 'u_in':
      case 'u_out':
        return r - (f.umbraRadiusKm + f.moonRadiusKm);
      case 'tot_in':
      case 'tot_out':
        return r - (f.umbraRadiusKm - f.moonRadiusKm);
    }
  };

  const findContact = (
    target: Parameters<typeof targetSign>[1],
    direction: 'before' | 'after',
  ): number | null => {
    // 'before' = scan from peak going back, look for sign flip + → −
    //   (moon enters shadow zone)
    // 'after' = scan forward, look for − → +
    const sign = direction === 'before' ? -1 : 1;
    let prev = targetSign(bestJd, target);
    if (prev > 0) return null; // not in this zone at peak
    for (let dt = 0; dt <= halfWindowDays; dt += stepDays) {
      const jd = bestJd + sign * dt;
      const cur = targetSign(jd, target);
      if (cur > 0 && prev < 0) {
        // Bisect [jd_prev_in_signed_dir, jd]
        let lo = bestJd + sign * (dt - stepDays);
        let hi = jd;
        if (sign < 0) [lo, hi] = [hi, lo];
        for (let k = 0; k < 24; k++) {
          const mid = (lo + hi) / 2;
          const m = targetSign(mid, target);
          if ((m > 0) === (sign > 0)) hi = mid;
          else lo = mid;
        }
        return (lo + hi) / 2;
      }
      prev = cur;
    }
    return null;
  };

  // Penumbra contacts always exist if there's any contact.
  const p1Jd = (kind !== 'none') ? findContact('p_in', 'before') : null;
  const p4Jd = (kind !== 'none') ? findContact('p_out', 'after') : null;
  const u1Jd = (kind === 'partial' || kind === 'total') ? findContact('u_in', 'before') : null;
  const u4Jd = (kind === 'partial' || kind === 'total') ? findContact('u_out', 'after') : null;
  const u2Jd = (kind === 'total') ? findContact('tot_in', 'before') : null;
  const u3Jd = (kind === 'total') ? findContact('tot_out', 'after') : null;

  return {
    p1Jd, u1Jd, u2Jd, u3Jd, u4Jd, p4Jd,
    greatestJd: kind !== 'none' ? bestJd : null,
    kind,
    frames,
    umbraMagnitude: kind !== 'none' ? m_umbra : 0,
  };
}

/**
 * Sample at one JD: project Moon onto plane perpendicular to Sun-Earth
 * axis, return offset from shadow centre + shadow radii.
 */
function sampleAt(
  sunGeocentric: (jd: number) => Vector3,
  moonGeocentric: (jd: number) => Vector3,
  jd: number,
): LunarEclipseFrame {
  const S = sunGeocentric(jd); // Earth → Sun
  const M = moonGeocentric(jd); // Earth → Moon
  // Antisolar direction (shadow axis from Earth):
  const sunDist = S.length();
  const antiSun = S.clone().multiplyScalar(-1 / sunDist);
  // Project Moon onto plane perpendicular to anti-sun, at moon's distance.
  // Moon's component along antisolar (positive = Moon is on far side from Sun):
  const moonAlong = M.dot(antiSun);
  // Moon's perpendicular offset (vector):
  const moonPerp = M.clone().sub(antiSun.clone().multiplyScalar(moonAlong));
  const moonOffsetAU = moonPerp.length();
  const moonOffsetKm = moonOffsetAU * AU_KM;

  // Moon's geocentric distance — used to scale shadow radii:
  const moonDistAU = M.length();
  const moonDistKm = moonDistAU * AU_KM;
  const sunDistKm = sunDist * AU_KM;

  // Earth's umbra cone tapers from R_earth at Earth, to 0 at L_u beyond Earth.
  // L_u = R_earth · sun_dist / (R_sun − R_earth)
  // At distance d from Earth (along antisolar axis), umbra radius:
  //   r_u(d) = R_earth · (1 − d / L_u) = R_earth − d · (R_sun − R_earth) / sun_dist
  const umbraGeomKm = Math.max(0,
    R_EARTH_KM - moonDistKm * (R_SUN_KM - R_EARTH_KM) / sunDistKm);
  // Penumbra widens from R_earth at Earth, half-angle = (R_sun + R_earth) / sun_dist
  const penumbraGeomKm =
    R_EARTH_KM + moonDistKm * (R_SUN_KM + R_EARTH_KM) / sunDistKm;
  // Danjon atmospheric enlargement (see comment at top of module).
  const umbraRadiusKm = umbraGeomKm * ATMOSPHERIC_ENLARGEMENT;
  const penumbraRadiusKm = penumbraGeomKm * ATMOSPHERIC_ENLARGEMENT;

  // Build 2D offset coords on the plane. Pick basis: u = ecliptic +Z proj
  // perpendicular to antiSun, v = antiSun × u.
  // Simpler: use moonPerp itself (3-vector) → record signed projection on
  // an arbitrary fixed in-plane basis (X axis = antiSun × ecliptic-Z).
  const eclipticZ = { x: 0, y: 0, z: 1 };
  // u = unit(eclipticZ × antiSun)  — points "ecliptic east" perpendicular to shadow axis
  let ux = eclipticZ.y * antiSun.z - eclipticZ.z * antiSun.y;
  let uy = eclipticZ.z * antiSun.x - eclipticZ.x * antiSun.z;
  let uz = eclipticZ.x * antiSun.y - eclipticZ.y * antiSun.x;
  const uLen = Math.hypot(ux, uy, uz) || 1;
  ux /= uLen; uy /= uLen; uz /= uLen;
  // v = antiSun × u  — points "ecliptic north" perpendicular to shadow axis
  const vx = antiSun.y * uz - antiSun.z * uy;
  const vy = antiSun.z * ux - antiSun.x * uz;
  const vz = antiSun.x * uy - antiSun.y * ux;
  const offX = (moonPerp.x * ux + moonPerp.y * uy + moonPerp.z * uz) * AU_KM;
  const offY = (moonPerp.x * vx + moonPerp.y * vy + moonPerp.z * vz) * AU_KM;

  return {
    jd,
    moonOffsetKm: { x: offX, y: offY },
    umbraRadiusKm,
    penumbraRadiusKm,
    moonRadiusKm: R_MOON_KM,
    shadowDistKm: moonOffsetKm,
  };
}
