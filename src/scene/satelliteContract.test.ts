import { describe, it, expect } from 'vitest';
import { twoline2satrec, propagate, gstime } from 'satellite.js';

/**
 * Contract test for the satellite.js API surface SatelliteLayer relies on
 * (twoline2satrec → propagate → {position} in TEME km, plus gstime).
 * Exists so a library upgrade that changes return shapes or error
 * behaviour fails loudly here instead of silently collapsing satellites
 * to the origin in the render path.
 *
 * TLE: ISS (ZARYA) epoch 2019-06-05 ~12:13 UT — the satellite.js README
 * example. Propagated at its own epoch, so SGP4 error is negligible
 * against the loose LEO bounds asserted.
 */
const ISS_TLE1 = '1 25544U 98067A   19156.50900463  .00003075  00000-0  59442-4 0  9992';
const ISS_TLE2 = '2 25544  51.6433  59.2583 0008217  16.4489 347.6017 15.51174618173442';

describe('satellite.js contract (SatelliteLayer usage)', () => {
  it('twoline2satrec parses a valid TLE without error flag', () => {
    const rec = twoline2satrec(ISS_TLE1, ISS_TLE2);
    expect(rec).toBeTruthy();
    expect(rec.error).toBe(0);
    expect(rec.satnum).toBe('25544');
  });

  it('propagate at epoch returns an ECI position at LEO altitude', () => {
    const rec = twoline2satrec(ISS_TLE1, ISS_TLE2);
    const date = new Date(Date.UTC(2019, 5, 5, 12, 13, 0));
    const result = propagate(rec, date);
    // The render path's duck-type check:
    expect(result && typeof result === 'object' && 'position' in result).toBe(true);
    const pos = (result as { position: { x: number; y: number; z: number } }).position;
    const r = Math.hypot(pos.x, pos.y, pos.z);
    // ISS: ~6 790 km geocentric radius (≈ 420 km altitude).
    expect(r).toBeGreaterThan(6650);
    expect(r).toBeLessThan(6900);
    const vel = (result as { velocity: { x: number; y: number; z: number } }).velocity;
    const v = Math.hypot(vel.x, vel.y, vel.z);
    // LEO circular speed ≈ 7.66 km/s.
    expect(v).toBeGreaterThan(7.4);
    expect(v).toBeLessThan(7.9);
  });

  it('propagate a year past epoch still yields an orbit-shaped result or a falsy error', () => {
    const rec = twoline2satrec(ISS_TLE1, ISS_TLE2);
    const date = new Date(Date.UTC(2020, 5, 5, 12, 13, 0));
    const result = propagate(rec, date);
    // SGP4 a year out is wildly inaccurate but should not throw; the layer
    // only needs "object with position" or something falsy.
    if (result && typeof result === 'object' && 'position' in result && result.position) {
      const pos = result.position as { x: number; y: number; z: number };
      expect(Number.isFinite(pos.x)).toBe(true);
    } else {
      // v7 returns PositionAndVelocity with null members on error
      // (v6 could also return false — the layer treats both as "hide").
      expect(result == null || !(result as { position?: unknown }).position).toBe(true);
    }
  });

  it('gstime returns an angle in [0, 2π)', () => {
    const g = gstime(new Date(Date.UTC(2019, 5, 5, 12, 13, 0)));
    expect(g).toBeGreaterThanOrEqual(0);
    expect(g).toBeLessThan(2 * Math.PI + 1e-9);
  });
});
