import { Vector3 } from 'three';
import { DEG2RAD } from './constants';

/**
 * Earth obliquity at J2000 (IAU 1976), radians. Used to rotate
 * equatorial-frame IAU pole directions to ecliptic frame.
 */
const EARTH_TILT_RAD = 23.4393 * DEG2RAD;

/**
 * Convert an IAU body north-pole direction expressed as J2000
 * RIGHT ASCENSION + DECLINATION into a unit vector in the scene's
 * coordinate frame. The scene's frame transform places:
 *   scene.x = ecliptic.x
 *   scene.y = ecliptic.z
 *   scene.z = -ecliptic.y
 * (i.e. ecliptic-Z becomes scene-up, ecliptic-Y becomes -scene-Z).
 *
 * Pipeline: equatorial unit vector → rotate around equatorial-X by
 * -ε to ecliptic → reorder axes to scene frame.
 *
 * Returns a unit Vector3 — caller can then build a quaternion that
 * maps the body's local +Y axis (its spin pole in untilted geometry)
 * to this direction, fixing both the body's tilt magnitude AND its
 * azimuth in the inertial frame. Without the azimuth part, ring
 * planes (Saturn) phase incorrectly relative to real-world dates.
 *
 * Reference data: IAU WGCCRE 2015 report
 * (https://iau-comm4.jpl.nasa.gov/PCK/wgccre2015_v1.txt) gives every
 * planet's pole as (α₀, δ₀) at J2000 plus optional precession terms.
 * For our visualisation we use the J2000 fixed pole (precession over
 * decades is sub-degree for the giants — negligible visually).
 */
export function iauPoleToSceneDir(poleRaDeg: number, poleDecDeg: number): Vector3 {
  const ra = poleRaDeg * DEG2RAD;
  const dec = poleDecDeg * DEG2RAD;
  // Equatorial unit vector from spherical RA/Dec.
  const eqX = Math.cos(dec) * Math.cos(ra);
  const eqY = Math.cos(dec) * Math.sin(ra);
  const eqZ = Math.sin(dec);
  // Equatorial → ecliptic: rotate around X by -ε. (cosε, +sinε on Y;
  // -sinε, cosε on Z applied as the inverse of the ecl→eq rotation.)
  const ce = Math.cos(EARTH_TILT_RAD);
  const se = Math.sin(EARTH_TILT_RAD);
  const eclX = eqX;
  const eclY = ce * eqY + se * eqZ;
  const eclZ = -se * eqY + ce * eqZ;
  // Ecliptic → scene: (x, y, z)_scene = (eclX, eclZ, -eclY).
  return new Vector3(eclX, eclZ, -eclY).normalize();
}
