import { TWO_PI } from './constants';

/**
 * Solve Kepler's equation E - e·sin(E) = M for the eccentric anomaly E.
 *
 * Robust against high eccentricities (tested up to e ≈ 0.99). The naive
 * Newton-Raphson with starting guess E = π diverges for highly eccentric
 * orbits because near E = 0 the derivative f'(E) = 1 - e·cos(E) collapses
 * to (1 - e), and a single Newton step overshoots by a factor of ~30 for
 * Halley-class comets — sending E to ±10⁵ rad and the orbit into chaos.
 *
 * Mitigations:
 *  1. Better initial guess: `E ≈ m + e·sin(m)` (first-order series), much
 *     closer to the truth than `π` for arbitrary m.
 *  2. Step damping: clamp |ΔE| ≤ 1 rad per iteration so a near-zero f'
 *     can't catapult E out of the convergence basin.
 */
export function solveKepler(M: number, e: number, tol = 1e-12, maxIter = 60): number {
  // Reject parabolic/hyperbolic orbits (e ≥ 1). Kepler's equation as
  // written here is the elliptic form; a non-periodic comet (e.g.
  // ʻOumuamua, e ≈ 1.2) needs the hyperbolic equation
  //     e·sinh(F) − F = M
  // which has a different solver entirely. Without this guard, the
  // `1 − e·cos(E)` denominator can flirt with zero and the iteration
  // returns garbage that downstream code (sqrt(1 − e²)) silently NaNs.
  if (!(e >= 0 && e < 1)) {
    throw new Error(`solveKepler: eccentricity must be in [0, 1); got e=${e}`);
  }
  let m = ((M % TWO_PI) + TWO_PI) % TWO_PI;
  if (m > Math.PI) m -= TWO_PI;

  // First-order expansion: solves the linear part of Kepler's equation
  // analytically and is correct to O(e³).
  let E = m + e * Math.sin(m);

  for (let i = 0; i < maxIter; i++) {
    const f = E - e * Math.sin(E) - m;
    const fp = 1 - e * Math.cos(E);
    let dE = f / fp;
    if (dE > 1) dE = 1;
    else if (dE < -1) dE = -1;
    E -= dE;
    if (Math.abs(dE) < tol) return E;
  }
  return E;
}

export function trueAnomalyFromEccentric(E: number, e: number): number {
  return 2 * Math.atan2(
    Math.sqrt(1 + e) * Math.sin(E / 2),
    Math.sqrt(1 - e) * Math.cos(E / 2)
  );
}
