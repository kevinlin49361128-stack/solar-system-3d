import { Vector3 } from 'three';
import type { OrbitPropagator, StateVector } from './types';
import type { HorizonsStateVector } from './horizonsClient';

/**
 * OrbitPropagator backed by a tabulated set of Horizons state vectors.
 * Interpolates between consecutive samples using cubic Hermite (which
 * uses both position and velocity) so the trajectory is smooth and the
 * derived velocities are continuous across sample boundaries.
 *
 * Outside the sampled range we extrapolate linearly from the nearest
 * endpoint — visually fine for short-term drift, but flag with `inRange`
 * if the caller wants to refresh.
 */
export class HorizonsPropagator implements OrbitPropagator {
  readonly elements = undefined;
  /** Sorted ascending by jd; safe to mutate carefully (keep order). */
  readonly samples: HorizonsStateVector[];

  constructor(samples: HorizonsStateVector[]) {
    if (!samples.length) throw new Error('HorizonsPropagator: empty sample set');
    // Defensive sort — Horizons returns ascending but no guarantee.
    this.samples = [...samples].sort((a, b) => a.jd - b.jd);
  }

  inRange(jd: number): boolean {
    const lo = this.samples[0].jd;
    const hi = this.samples[this.samples.length - 1].jd;
    return jd >= lo && jd <= hi;
  }

  stateAt(jd: number): StateVector {
    const s = this.samples;
    if (jd <= s[0].jd) return clone(s[0]);
    if (jd >= s[s.length - 1].jd) return clone(s[s.length - 1]);
    // Binary search for the segment containing jd.
    let lo = 0, hi = s.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (s[mid].jd <= jd) lo = mid; else hi = mid;
    }
    const a = s[lo], b = s[hi];
    const dt = b.jd - a.jd;
    if (dt < 1e-9) return clone(a);
    const tau = (jd - a.jd) / dt;
    return hermite(a, b, dt, tau);
  }
}

function clone(sv: HorizonsStateVector): StateVector {
  return {
    position: sv.position.clone(),
    velocity: sv.velocity.clone(),
  };
}

/**
 * Cubic Hermite interpolation in 3D using endpoint position + velocity.
 *   H(τ) = h00·p0 + h10·dt·v0 + h01·p1 + h11·dt·v1
 *   H'(τ) = (h00'·p0 + h10'·dt·v0 + h01'·p1 + h11'·dt·v1) / dt
 * where the basis polynomials are the standard cubic Hermites.
 */
function hermite(a: HorizonsStateVector, b: HorizonsStateVector, dt: number, tau: number): StateVector {
  const t2 = tau * tau;
  const t3 = t2 * tau;
  const h00 = 2 * t3 - 3 * t2 + 1;
  const h10 = t3 - 2 * t2 + tau;
  const h01 = -2 * t3 + 3 * t2;
  const h11 = t3 - t2;

  // Velocity coefficients (derivative w.r.t. τ, then divide by dt).
  const dh00 = (6 * t2 - 6 * tau) / dt;
  const dh10 = (3 * t2 - 4 * tau + 1) / dt;
  const dh01 = (-6 * t2 + 6 * tau) / dt;
  const dh11 = (3 * t2 - 2 * tau) / dt;

  const pos = new Vector3()
    .addScaledVector(a.position, h00)
    .addScaledVector(a.velocity, h10 * dt)
    .addScaledVector(b.position, h01)
    .addScaledVector(b.velocity, h11 * dt);
  const vel = new Vector3()
    .addScaledVector(a.position, dh00)
    .addScaledVector(a.velocity, dh10 * dt)
    .addScaledVector(b.position, dh01)
    .addScaledVector(b.velocity, dh11 * dt);
  return { position: pos, velocity: vel };
}
