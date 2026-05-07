import { describe, it, expect } from 'vitest';
import { solveKepler, trueAnomalyFromEccentric } from './kepler';

const TWO_PI = Math.PI * 2;

describe('solveKepler', () => {
  it('returns M when e = 0 (circular orbit)', () => {
    for (const M of [0, 0.5, 1.7, -2.3, 5.0]) {
      const E = solveKepler(M, 0);
      // Both should reduce to the same principal angle
      const norm = (a: number) => {
        let x = ((a % TWO_PI) + TWO_PI) % TWO_PI;
        if (x > Math.PI) x -= TWO_PI;
        return x;
      };
      expect(E).toBeCloseTo(norm(M), 9);
    }
  });

  it('satisfies Kepler equation E - e·sin(E) = M for moderate eccentricity', () => {
    for (const e of [0.01, 0.1, 0.3, 0.5]) {
      for (const M of [0.1, 1.0, 2.5, -1.5, Math.PI]) {
        const E = solveKepler(M, e);
        const residual = E - e * Math.sin(E) - M;
        // Residual normalised to [-π, π]
        const r = ((residual + Math.PI) % TWO_PI + TWO_PI) % TWO_PI - Math.PI;
        expect(Math.abs(r)).toBeLessThan(1e-9);
      }
    }
  });

  it('converges for high eccentricity (Halley-like, e = 0.967)', () => {
    const e = 0.967;
    for (const M of [0.01, 0.5, 1.0, 2.0, Math.PI - 0.01]) {
      const E = solveKepler(M, e);
      expect(E - e * Math.sin(E)).toBeCloseTo(M, 8);
    }
  });

  it('regression: high-e M values that previously sent Newton-Raphson divergent', () => {
    // These specific M values caused the old solver to return wildly wrong
    // E (e.g. 381182 rad) due to catastrophic overshoot when f'(E) ≈ 1 - e.
    // After Halley's mean longitude wrap, M lives near π and the divergence
    // produced jumping comet positions in the rendered scene.
    const e = 0.96714;
    for (const M of [3.3584, 3.3589, 3.3597, 3.3653, 3.3722, 3.3791, 3.3860, 3.4067]) {
      const E = solveKepler(M, e);
      const residual = E - e * Math.sin(E) - M;
      // Residual normalised to [-π, π]
      const TWO_PI = Math.PI * 2;
      const r = ((residual + Math.PI) % TWO_PI + TWO_PI) % TWO_PI - Math.PI;
      expect(Math.abs(r)).toBeLessThan(1e-9);
    }
  });

  it('extreme eccentricity (Hale-Bopp, e = 0.995) still converges across full orbit', () => {
    const e = 0.995;
    for (let i = 0; i < 36; i++) {
      const M = (i / 36) * TWO_PI;
      const E = solveKepler(M, e);
      const residual = E - e * Math.sin(E) - M;
      const r = ((residual + Math.PI) % TWO_PI + TWO_PI) % TWO_PI - Math.PI;
      expect(Math.abs(r)).toBeLessThan(1e-9);
    }
  });

  it('handles M = 0 → E = 0', () => {
    expect(solveKepler(0, 0.5)).toBeCloseTo(0, 12);
  });

  it('handles negative M (orbit before perihelion)', () => {
    const E = solveKepler(-1.0, 0.2);
    expect(E - 0.2 * Math.sin(E)).toBeCloseTo(-1.0, 9);
  });
});

describe('trueAnomalyFromEccentric', () => {
  it('returns 0 at E = 0', () => {
    expect(trueAnomalyFromEccentric(0, 0.5)).toBeCloseTo(0, 12);
  });

  it('returns π at E = π (apoapsis)', () => {
    expect(Math.abs(trueAnomalyFromEccentric(Math.PI, 0.3))).toBeCloseTo(Math.PI, 9);
  });

  it('matches circular case (true anomaly = E when e = 0)', () => {
    for (const E of [0.3, 1.0, 2.5]) {
      expect(trueAnomalyFromEccentric(E, 0)).toBeCloseTo(E, 9);
    }
  });

  it('agrees with the alternative arccos formula', () => {
    // ν = arccos((cos E - e) / (1 - e·cos E))
    for (const e of [0.1, 0.4, 0.7]) {
      for (const E of [0.5, 1.2, 2.1]) {
        const nu1 = trueAnomalyFromEccentric(E, e);
        const nu2 = Math.acos((Math.cos(E) - e) / (1 - e * Math.cos(E)));
        expect(Math.abs(nu1)).toBeCloseTo(nu2, 9);
      }
    }
  });
});
