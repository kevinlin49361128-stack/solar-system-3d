import { Vector3 } from 'three';
import { observerEcliptic } from './topocentric';

/**
 * Solar-eclipse path computation: where on Earth's surface does the
 * Moon's shadow land, sampled minute-by-minute over the eclipse window?
 *
 * Geometry: at each sample JD,
 *   1. Sun direction from Earth = −Earth's heliocentric position vector
 *   2. Moon direction from Earth = its geocentric position
 *   3. Shadow centerline = ray from Sun through Moon's centre, extended
 *      to intersect Earth's surface
 *   4. If the line intersects Earth, that point is the centre of the
 *      umbra/penumbra disc — convert ECEF coords to (lat, lon).
 *
 * Both umbra (total) and penumbra (partial) are computed; their disc
 * radii on Earth's surface depend on cone half-angles given by:
 *   tan(α_umbra)    = (R_sun − R_moon) / (sun-moon distance)
 *   tan(α_penumbra) = (R_sun + R_moon) / (sun-moon distance)
 *
 * The umbra cone has its tip pointing AWAY from the Sun; if the tip
 * doesn't reach Earth, the eclipse is annular (we still trace the
 * "antumbra" path with the same algorithm — just produces a small
 * radius). Caller distinguishes total vs annular by examining the
 * umbraRadiusKm sign in returned samples.
 *
 * Coordinate convention: ECEF (Earth-Centered Earth-Fixed) for the
 * surface intersection, then converted to geodetic lat/lon. Earth is
 * modeled as a sphere here (radius = R_earth_km); WGS-84 ellipsoid
 * correction would shift the path by ~10 km worst case which is fine
 * for the educational visualisation.
 */

const R_SUN_KM = 695700;
const R_MOON_KM = 1737.4;
const R_EARTH_KM = 6371;
const AU_KM = 1.495978707e8;
const RAD2DEG = 180 / Math.PI;

export interface PathSample {
  jd: number;
  /** UTC date for this sample. */
  date: Date;
  /** Sub-shadow point latitude (deg) — null if no intersection (no eclipse on Earth at this t). */
  latDeg: number | null;
  /** Sub-shadow longitude (deg, east-positive). */
  lonDeg: number | null;
  /** Umbra disc radius on Earth surface (km). Negative = annular; positive = total. */
  umbraRadiusKm: number;
  /** Penumbra disc radius on Earth surface (km). Always positive. */
  penumbraRadiusKm: number;
  /** Sun-Moon angular separation as seen from Earth's centre (deg) — small near eclipse maximum. */
  separationDeg: number;
}

export interface EclipsePath {
  /** All samples (some may have null lat/lon if shadow misses Earth). */
  samples: PathSample[];
  /** Greatest-eclipse JD (sample with smallest separation). */
  peakJd: number;
  /** Eclipse type at peak. */
  type: 'total' | 'annular' | 'partial';
  /** Maximum total-or-annular path width on Earth (km). */
  maxWidthKm: number;
}

/**
 * Compute the eclipse path. `peakJd` should be near the eclipse maximum
 * (e.g. from eventScanner's solar-eclipse event). We sample ±3 hours
 * around it at 1-minute resolution and return all samples that hit
 * Earth — the caller filters / draws the polyline.
 *
 * `bodyHelio(id, jd)` is a callback that returns the body's ecliptic
 * heliocentric (or geocentric for moon) position; pass-through wrappers
 * around the simulator's propagators.
 */
export function computeEclipsePath(
  peakJd: number,
  earthHelioAt: (jd: number) => Vector3,
  moonGeoAt: (jd: number) => Vector3,
  windowHours = 3,
  stepMinutes = 1,
): EclipsePath {
  const samples: PathSample[] = [];
  const stepDays = stepMinutes / 1440;
  const halfWin = windowHours / 24;
  let bestJd = peakJd;
  let bestSep = Infinity;
  let maxWidth = 0;
  let peakUmbraType: 'total' | 'annular' | 'partial' = 'partial';

  for (let jd = peakJd - halfWin; jd <= peakJd + halfWin; jd += stepDays) {
    const earthEcl = earthHelioAt(jd);          // Earth's heliocentric pos
    const moonGeoEcl = moonGeoAt(jd);            // Moon geocentric (from Earth)
    // Sun direction from Earth: −Earth's heliocentric pos (Earth→Sun).
    const earthToSun = earthEcl.clone().multiplyScalar(-1);
    const sunDistAU = earthToSun.length();
    const sunDistKm = sunDistAU * AU_KM;
    const sunFromEarth = earthToSun.clone().normalize();

    // Moon position from Earth (already geocentric, AU).
    const moonFromEarth = moonGeoEcl.clone().normalize();

    // Angular separation seen from Earth's centre (deg).
    const cosSep = Math.max(-1, Math.min(1, sunFromEarth.dot(moonFromEarth)));
    const separationDeg = Math.acos(cosSep) * RAD2DEG;

    // Sun-Moon distance (Sun-side line passing through Moon).
    // This is the apex distance of both umbra and penumbra cones.
    const sunMoonDistKm = sunDistKm; // Earth-Sun ≈ Earth-Moon + Moon-Sun → Moon-Sun ≈ sunDist; correct to within 0.5%.

    // Cone half-angles. tan(α) ≈ (R_sun ± R_moon) / sun-moon distance.
    const tanAlphaU = (R_SUN_KM - R_MOON_KM) / sunMoonDistKm;
    const tanAlphaP = (R_SUN_KM + R_MOON_KM) / sunMoonDistKm;

    // Umbra cone tip distance from Moon (along anti-sun direction):
    //   L_umbra = R_moon / tan(α_umbra). Positive ≈ 374,000 km.
    const lUmbra = R_MOON_KM / tanAlphaU;

    // Shadow line: parametric ray from sun-center through moon-center.
    // We work in Earth-centered ecliptic coords:
    //   Point on line at parameter t: Moon_pos + t · (-sunFromEarth)
    //   (i.e. extended from Moon away from Sun)
    // Intersect with sphere |P| = R_earth_AU.
    // We need the point in km; convert moonGeoEcl to km.
    const moonGeoKm = moonGeoEcl.clone().multiplyScalar(AU_KM);
    const dir = sunFromEarth.clone().multiplyScalar(-1); // anti-sun = shadow direction

    // Solve |moonGeoKm + t·dir|² = R_earth²
    // (moonGeoKm·moonGeoKm) + 2·t·(moonGeoKm·dir) + t² = R_earth²
    const A = 1;
    const B = 2 * moonGeoKm.dot(dir);
    const C = moonGeoKm.dot(moonGeoKm) - R_EARTH_KM * R_EARTH_KM;
    const disc = B * B - 4 * A * C;

    let latDeg: number | null = null;
    let lonDeg: number | null = null;
    let umbraRadiusKm = 0;
    let penumbraRadiusKm = 0;

    if (disc >= 0) {
      // Two intersections — take the closer one (smaller t, which is the
      // sun-facing surface). We want the side of Earth where sun is up.
      const sqrtDisc = Math.sqrt(disc);
      const t1 = (-B - sqrtDisc) / (2 * A);
      const t2 = (-B + sqrtDisc) / (2 * A);
      const t = t1 > 0 ? t1 : t2; // first positive intersection
      if (t > 0) {
        const hit = moonGeoKm.clone().addScaledVector(dir, t);
        // hit is in Earth-centered ecliptic coords. Convert to ECEF
        // (Earth-Centered Earth-Fixed) by removing GMST rotation.
        const obs = observerEcliptic(0, 0, jd);
        // observerEcliptic returns the (ECEF +X = lon 0 prime meridian)
        // basis IN ecliptic coords, expressed as zenith/east/north at
        // (lat 0, lon 0). Use these to project `hit` into ECEF.
        // The basis at lat 0 lon 0 has:
        //   zenith ↔ ECEF +X (toward prime meridian on equator)
        //   east   ↔ ECEF +Y
        //   north  ↔ ECEF +Z (north pole)
        const x = hit.dot(obs.zenith);  // ECEF X
        const y = hit.dot(obs.east);    // ECEF Y
        const z = hit.dot(obs.north);   // ECEF Z

        const r = Math.sqrt(x * x + y * y + z * z);
        latDeg = Math.asin(z / r) * RAD2DEG;
        lonDeg = Math.atan2(y, x) * RAD2DEG;

        // Distance from Moon to surface hit point.
        const moonToHit = moonGeoKm.distanceTo(hit);
        // Umbra radius at surface: (L_umbra − moonToHit) · tan(α_umbra)
        // Positive = umbra cone tip is past the surface (TOTAL eclipse here).
        // Negative = surface is past the cone tip → ANNULAR (we plot the
        // antumbra disc with abs(radius)).
        umbraRadiusKm = (lUmbra - moonToHit) * tanAlphaU;
        // Penumbra radius: (L_penumbra + moonToHit) · tan(α_penumbra).
        // Penumbra cone has its tip on the SUN side, so distance from
        // tip to surface = sunMoonDist - moonToHit (approx; the tip is
        // actually at the sun centre so add R_sun-side terms).
        penumbraRadiusKm = (R_MOON_KM + moonToHit * tanAlphaP);
      }
    }

    samples.push({
      jd, date: new Date((jd - 2440587.5) * 86400000),
      latDeg, lonDeg, umbraRadiusKm, penumbraRadiusKm, separationDeg,
    });

    if (separationDeg < bestSep) {
      bestSep = separationDeg;
      bestJd = jd;
      // Determine type from umbra radius sign at peak.
      if (latDeg != null) {
        peakUmbraType = umbraRadiusKm > 0 ? 'total' : 'annular';
      } else if (separationDeg < 1) {
        // Shadow misses Earth's surface but moon-sun separation is small
        // → partial eclipse only.
        peakUmbraType = 'partial';
      }
    }
    if (latDeg != null && Math.abs(umbraRadiusKm) > maxWidth) {
      maxWidth = Math.abs(umbraRadiusKm) * 2;
    }
  }

  return { samples, peakJd: bestJd, type: peakUmbraType, maxWidthKm: maxWidth };
}
