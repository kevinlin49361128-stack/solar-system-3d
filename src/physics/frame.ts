import { Matrix4, Vector3 } from 'three';

/**
 * Ecliptic (J2000) coordinate frame:
 *   +X → vernal equinox
 *   +Y → 90° east in ecliptic
 *   +Z → ecliptic north pole
 *
 * Three.js convention used here:
 *   +X → vernal equinox (kept identical)
 *   +Y → ecliptic north pole (so the ecliptic is the XZ plane, and "up" is Y)
 *   +Z → 90° east in ecliptic (right-handed)
 *
 * The conversion is a 90° rotation around X mapping ecliptic_Z → scene_Y,
 * ecliptic_Y → scene_-Z. Centralised here so swapping conventions later
 * (e.g. astronomical "up" or rotating to equatorial) does not touch the rest
 * of the code.
 */

const ECLIPTIC_TO_SCENE = new Matrix4().set(
  1, 0,  0, 0,
  0, 0,  1, 0,
  0, -1, 0, 0,
  0, 0,  0, 1,
);

export function eclipticToScene(v: Vector3): Vector3 {
  return v.clone().applyMatrix4(ECLIPTIC_TO_SCENE);
}

export function eclipticToSceneInPlace(v: Vector3): Vector3 {
  return v.applyMatrix4(ECLIPTIC_TO_SCENE);
}
