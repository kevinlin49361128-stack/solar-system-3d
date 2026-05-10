import { Matrix4, Vector3 } from 'three';
import { DEG2RAD } from './constants';

/**
 * Galactic ↔ scene coordinate transformations.
 *
 * The galactic frame is the standard IAU 1958 system, redefined for J2000:
 *
 *   +X → galactic centre   (l = 0°,  b = 0°)
 *   +Y → l = 90°            (in the galactic plane, looking down along +Z)
 *   +Z → galactic North Pole (l = arbitrary, b = 90°)
 *
 * Reference points (J2000):
 *   - Galactic NP at equatorial (α, δ) = (192.85948°, +27.12825°)
 *   - Galactic centre at equatorial (266.40499°, −28.93620°)
 *
 * The transformation chain is
 *
 *   galactic ── R_gal2eq ──► equatorial ── R_eq2ecl ──► ecliptic ── R_ecl2scene ──► scene
 *
 * where R_eq2ecl is a rotation around the equatorial X axis by -ε (J2000
 * obliquity), R_ecl2scene swaps Y and Z (because Three.js uses Y-up while
 * astronomical ecliptic uses Z-up), and R_gal2eq is the standard IAU matrix
 * documented in Hipparcos catalogue ESA SP-1200 vol. 1 §1.5.3.
 */

// J2000 obliquity (IAU 2006).
const EPSILON_J2000_RAD = 23.4392911 * DEG2RAD;

/**
 * Galactic → J2000 equatorial. Standard IAU rotation, hardcoded so we don't
 * accumulate numerical error from the three-Euler-rotation construction.
 */
const GAL_TO_EQ = new Matrix4().set(
  -0.054875560416,  0.494109427876, -0.867666149019, 0,
  -0.873437090235, -0.444829633741, -0.198076373431, 0,
  -0.483835015549,  0.746982244497,  0.455983776175, 0,
   0,               0,               0,              1,
);

/**
 * J2000 equatorial → J2000 ecliptic (rotation around +X by -ε).
 *
 * In matrix form:
 *   [1   0     0  ]
 *   [0  cos ε sin ε]
 *   [0 -sin ε cos ε]
 */
const EQ_TO_ECL = new Matrix4().set(
  1, 0,                          0,                         0,
  0, Math.cos(EPSILON_J2000_RAD),  Math.sin(EPSILON_J2000_RAD), 0,
  0, -Math.sin(EPSILON_J2000_RAD), Math.cos(EPSILON_J2000_RAD), 0,
  0, 0,                          0,                         1,
);

/**
 * Ecliptic (Z-up) → Three.js scene (Y-up).
 *   scene_x =  ecl_x
 *   scene_y =  ecl_z
 *   scene_z = -ecl_y
 */
const ECL_TO_SCENE = new Matrix4().set(
  1, 0,  0, 0,
  0, 0,  1, 0,
  0, -1, 0, 0,
  0, 0,  0, 1,
);

/**
 * Combined galactic → scene transformation. Apply this to any unit vector
 * expressed in galactic Cartesian (l, b) coordinates to get its position in
 * Three.js scene coordinates.
 */
export const GALACTIC_TO_SCENE: Matrix4 = new Matrix4()
  .multiplyMatrices(ECL_TO_SCENE, EQ_TO_ECL)
  .multiply(GAL_TO_EQ);

/**
 * Transform a galactic-frame vector to scene coordinates.
 */
export function galacticToScene(vGalactic: Vector3): Vector3 {
  return vGalactic.clone().applyMatrix4(GALACTIC_TO_SCENE);
}

/** Galactic centre direction in galactic frame (unit vector along +X). */
export const GALACTIC_CENTRE_GAL = new Vector3(1, 0, 0);

/** Galactic North Pole direction in galactic frame (unit vector along +Z). */
export const GALACTIC_NP_GAL = new Vector3(0, 0, 1);

/**
 * Galactic centre direction in scene coordinates. Pre-computed for layers
 * that want to face the camera toward the centre (e.g. a "look at GC"
 * shortcut).
 */
export const GALACTIC_CENTRE_SCENE = galacticToScene(GALACTIC_CENTRE_GAL);

/** Galactic North Pole direction in scene coordinates. */
export const GALACTIC_NP_SCENE = galacticToScene(GALACTIC_NP_GAL);

/**
 * Convert galactic spherical coordinates (l, b in degrees) to a unit vector
 * in galactic Cartesian. Used to position dust clouds, H II regions, etc.
 * at scientifically correct locations on the Milky Way dome.
 */
export function galacticLBToVector(lDeg: number, bDeg: number): Vector3 {
  const lRad = lDeg * DEG2RAD;
  const bRad = bDeg * DEG2RAD;
  return new Vector3(
    Math.cos(bRad) * Math.cos(lRad),
    Math.cos(bRad) * Math.sin(lRad),
    Math.sin(bRad),
  );
}
