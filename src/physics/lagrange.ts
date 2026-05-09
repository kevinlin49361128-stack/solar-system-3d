import { Vector3 } from 'three';

/**
 * Compute the five Lagrange points of a circular restricted three-body
 * problem (CR3BP) given the instantaneous positions of two massive bodies.
 *
 * Returns each Lagrange point as a Vector3 in the same world frame as the
 * input positions (typically the ecliptic, in AU).
 *
 * Derivation: in the corotating frame with the barycenter at origin, primary
 * at x = -μ·r and secondary at x = (1-μ)·r, where μ = M2/(M1+M2). The
 * effective potential's saddle / extremum points solve, on the x-axis:
 *
 *   L1: (1-μ)/(x+μ)² − μ/(1-μ-x)² − x = 0      (between the two masses)
 *   L2: (1-μ)/(x+μ)² + μ/(x-(1-μ))² − x = 0    (beyond the secondary)
 *   L3: (1-μ)/(x+μ)² + μ/(x-(1-μ))² + x = 0    (beyond the primary, opposite side)
 *
 * L4/L5 are the apexes of equilateral triangles with the two masses as
 * vertices — exactly 60° leading / trailing the secondary.
 *
 * Newton–Raphson is used for L1/L2/L3 starting from the standard Hill
 * approximation (μ/3)^(1/3); convergence is fast (5–8 iterations to 1e-12).
 */
export interface LagrangePointSet {
  L1: Vector3;
  L2: Vector3;
  L3: Vector3;
  L4: Vector3;
  L5: Vector3;
}

const NEWTON_TOL = 1e-12;
const NEWTON_MAX_ITERS = 50;

/**
 * Solve f(x)=0 with Newton–Raphson, with a safe fallback line-search if a
 * step would cross a singularity (x = -μ or x = 1-μ).
 */
function newton(
  f: (x: number) => number,
  fPrime: (x: number) => number,
  x0: number,
  forbidden: number[],
): number {
  let x = x0;
  for (let i = 0; i < NEWTON_MAX_ITERS; i++) {
    const fx = f(x);
    if (Math.abs(fx) < NEWTON_TOL) return x;
    const fpx = fPrime(x);
    if (fpx === 0) break;
    let step = fx / fpx;
    let xNext = x - step;
    // Don't allow crossing a singularity in one step.
    let safety = 0;
    while (
      forbidden.some(b => (x - b) * (xNext - b) < 0) &&
      safety < 20
    ) {
      step *= 0.5;
      xNext = x - step;
      safety++;
    }
    x = xNext;
  }
  return x;
}

/**
 * Compute Lagrange points in the canonical rotating frame (units: r=1,
 * primary at -μ, secondary at 1-μ). Caller transforms back to world coords.
 */
function lagrangeCanonical(mu: number): {
  l1: number;   // x-coord on x-axis
  l2: number;
  l3: number;
  l4: [number, number]; // (x, y) in orbital plane
  l5: [number, number];
} {
  const xPrimary = -mu;
  const xSecondary = 1 - mu;

  // L1: between primary and secondary. f(x) = (1-μ)/(x+μ)² − μ/(1-μ-x)² − x
  const f1 = (x: number) =>
    (1 - mu) / (x + mu) ** 2 - mu / (1 - mu - x) ** 2 - x;
  const f1p = (x: number) =>
    -2 * (1 - mu) / (x + mu) ** 3 - 2 * mu / (1 - mu - x) ** 3 - 1;
  // Hill approximation: ξ ≈ (μ/3)^(1/3), L1_x ≈ (1-μ) - ξ
  const xi1 = Math.cbrt(mu / 3);
  const l1Init = xSecondary - xi1;
  const l1 = newton(f1, f1p, l1Init, [xPrimary, xSecondary]);

  // L2: beyond secondary. f(x) = (1-μ)/(x+μ)² + μ/(x-(1-μ))² − x
  const f2 = (x: number) =>
    (1 - mu) / (x + mu) ** 2 + mu / (x - (1 - mu)) ** 2 - x;
  const f2p = (x: number) =>
    -2 * (1 - mu) / (x + mu) ** 3 - 2 * mu / (x - (1 - mu)) ** 3 - 1;
  const l2Init = xSecondary + xi1;
  const l2 = newton(f2, f2p, l2Init, [xSecondary]);

  // L3: opposite side, slightly past -1.
  const f3 = (x: number) =>
    (1 - mu) / (x + mu) ** 2 + mu / (x - (1 - mu)) ** 2 + x;
  const f3p = (x: number) =>
    -2 * (1 - mu) / (x + mu) ** 3 - 2 * mu / (x - (1 - mu)) ** 3 + 1;
  const l3Init = -1 - (5 * mu) / 12;
  const l3 = newton(f3, f3p, l3Init, [xPrimary]);

  // L4/L5: equilateral triangle apices.
  const SQ3_2 = Math.sqrt(3) / 2;
  const lx = 0.5 - mu;     // midpoint between primary and secondary on x
  const l4: [number, number] = [lx, SQ3_2];
  const l5: [number, number] = [lx, -SQ3_2];

  return { l1, l2, l3, l4, l5 };
}

/**
 * Compute Lagrange points in world-frame coordinates.
 *
 * @param massPrimary    mass of body 1 (kg)
 * @param massSecondary  mass of body 2 (kg, must be < massPrimary)
 * @param primaryPos     position of primary in world frame (AU or any consistent unit)
 * @param secondaryPos   position of secondary in same frame
 * @param planeNormal    optional unit normal to orbital plane; defaults to
 *                       ecliptic Z (0,0,1). Used to construct the in-plane
 *                       perpendicular for L4/L5. For Sun-planet systems the
 *                       ecliptic Z is an excellent approximation.
 */
export function lagrangePoints(
  massPrimary: number,
  massSecondary: number,
  primaryPos: Vector3,
  secondaryPos: Vector3,
  planeNormal: Vector3 = new Vector3(0, 0, 1),
): LagrangePointSet {
  const mu = massSecondary / (massPrimary + massSecondary);
  const sep = secondaryPos.clone().sub(primaryPos);
  const r = sep.length();
  if (r === 0) {
    // Degenerate; return all-zero points to avoid NaN.
    return {
      L1: primaryPos.clone(),
      L2: primaryPos.clone(),
      L3: primaryPos.clone(),
      L4: primaryPos.clone(),
      L5: primaryPos.clone(),
    };
  }
  const ux = sep.clone().multiplyScalar(1 / r);
  // In-plane perpendicular: project planeNormal cleanly, then take ux × normal.
  const uz = planeNormal.clone().normalize();
  // If ux is nearly parallel to uz (orbit nearly polar), pick a fallback.
  let uy = new Vector3().crossVectors(uz, ux);
  if (uy.lengthSq() < 1e-10) {
    // Fallback: arbitrary perpendicular.
    const fallback = Math.abs(ux.x) < 0.9 ? new Vector3(1, 0, 0) : new Vector3(0, 1, 0);
    uy = new Vector3().crossVectors(fallback, ux).normalize();
  } else {
    uy.normalize();
  }

  const { l1, l2, l3, l4, l5 } = lagrangeCanonical(mu);
  // Canonical frame has barycenter at origin and primary at -μ·r along ux.
  const barycenter = primaryPos.clone().addScaledVector(ux, mu * r);

  const place = (cx: number, cy: number) =>
    barycenter
      .clone()
      .addScaledVector(ux, cx * r)
      .addScaledVector(uy, cy * r);

  return {
    L1: place(l1, 0),
    L2: place(l2, 0),
    L3: place(l3, 0),
    L4: place(l4[0], l4[1]),
    L5: place(l5[0], l5[1]),
  };
}

/**
 * Convenience: just the mass ratio. Useful for tests.
 */
export function massRatio(m1: number, m2: number): number {
  return m2 / (m1 + m2);
}
