import { describe, it, expect } from 'vitest';
import { EXOPLANET_SYSTEMS, getExoplanetSystem } from './exoplanetSystems';
import { J2000_JD } from '../physics/constants';

/**
 * exoplanetSystems derives each planet's mean-motion (LDotDeg = 360/period
 * × 36525), mean longitude (wrapped to [0,360)), and a default mass from
 * radius³×density — all of which survive typecheck even when wrong. These
 * tests guard that the derivation actually produces working propagators.
 */
describe('getExoplanetSystem', () => {
  it('returns the TRAPPIST-1 system with its 7 planets', () => {
    const sys = getExoplanetSystem('trappist-1');
    expect(sys).toBeDefined();
    expect(sys!.planets.length).toBe(7);
  });

  it('returns undefined for an unknown id', () => {
    expect(getExoplanetSystem('nope-404')).toBeUndefined();
  });
});

describe('EXOPLANET_SYSTEMS integrity', () => {
  it('has multiple systems, each with a host (some, like α Cen A, are planet-less)', () => {
    expect(EXOPLANET_SYSTEMS.length).toBeGreaterThan(1);
    for (const s of EXOPLANET_SYSTEMS) {
      expect(s.host).toBeDefined();
      expect(Array.isArray(s.planets)).toBe(true);
    }
    // ...but most systems do model planets.
    expect(EXOPLANET_SYSTEMS.filter((s) => s.planets.length > 0).length).toBeGreaterThan(1);
  });

  it('every planet declares parentId = its system id and carries a propagator', () => {
    for (const s of EXOPLANET_SYSTEMS) {
      for (const p of s.planets) {
        expect(p.parentId).toBe(s.id);
        expect(p.propagator).toBeDefined();
      }
    }
  });

  it('every planet has a finite positive mass (default-density path never NaNs)', () => {
    for (const s of EXOPLANET_SYSTEMS) {
      for (const p of s.planets) {
        expect(Number.isFinite(p.physical.massKg)).toBe(true);
        expect(p.physical.massKg).toBeGreaterThan(0);
      }
    }
  });
});

describe('derived propagators produce finite, moving orbits', () => {
  it('TRAPPIST-1 planets return finite state vectors and actually move (LDotDeg ≠ 0)', () => {
    const sys = getExoplanetSystem('trappist-1')!;
    for (const p of sys.planets) {
      const s0 = p.propagator!.stateAt(J2000_JD);
      const s1 = p.propagator!.stateAt(J2000_JD + 1);
      for (const v of [s0.position, s0.velocity, s1.position]) {
        expect(Number.isFinite(v.x) && Number.isFinite(v.y) && Number.isFinite(v.z)).toBe(true);
      }
      // A non-zero LDotDeg means the planet advances over a day.
      expect(s0.position.distanceTo(s1.position)).toBeGreaterThan(0);
    }
  });

  it('a short-period planet (TRAPPIST-1 b, ~1.5 d) returns near its start after one period', () => {
    const sys = getExoplanetSystem('trappist-1')!;
    const b = sys.planets[0]; // innermost
    const start = b.propagator!.stateAt(J2000_JD).position;
    // TRAPPIST-1 b period ≈ 1.51 d; after that it should be back near start.
    const after = b.propagator!.stateAt(J2000_JD + 1.51).position;
    expect(after.distanceTo(start)).toBeLessThan(start.length() * 0.5);
  });
});
