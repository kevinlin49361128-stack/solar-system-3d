import { describe, it, expect, beforeEach } from 'vitest';
import { bennettRefractionArcmin } from './refraction';
import { setAtmosphericConditions } from './topocentric';

/**
 * Reference values for Bennett 1982 at standard conditions
 * (1010 mbar, 10 °C — the conditions where the published table applies
 * with scale factor exactly 1):
 *   alt 0°  → ≈ 34.5′  (the classic "sun visible past geometric sunset")
 *   alt 5°  → ≈ 9.9′
 *   alt 10° → ≈ 5.4′
 *   alt 45° → ≈ 1.0′
 *   alt 90° → ≈ 0′  (Bennett's fit leaves ~0.07′ residual at zenith)
 */
describe('bennettRefractionArcmin', () => {
  beforeEach(() => {
    setAtmosphericConditions(1010, 10); // scale factor = exactly 1
  });

  it('horizon refraction ≈ 34′ at standard conditions', () => {
    expect(bennettRefractionArcmin(0)).toBeGreaterThan(33);
    expect(bennettRefractionArcmin(0)).toBeLessThan(36);
  });

  it('5° altitude ≈ 9.9′', () => {
    expect(bennettRefractionArcmin(5)).toBeCloseTo(9.9, 0);
  });

  it('45° altitude ≈ 1.0′', () => {
    expect(bennettRefractionArcmin(45)).toBeCloseTo(1.0, 0);
  });

  it('zenith refraction is ~0 (small Bennett residual allowed)', () => {
    expect(bennettRefractionArcmin(90)).toBeLessThan(0.1);
  });

  it('monotonically decreases with altitude', () => {
    let prev = Infinity;
    for (const alt of [0, 2, 5, 10, 20, 45, 70, 90]) {
      const r = bennettRefractionArcmin(alt);
      expect(r).toBeLessThan(prev);
      prev = r;
    }
  });

  it('returns 0 below −1.5° (body too deep below horizon)', () => {
    expect(bennettRefractionArcmin(-2)).toBe(0);
    expect(bennettRefractionArcmin(-10)).toBe(0);
  });

  it('clamps the formula at −0.5° so the dip region stays finite', () => {
    expect(bennettRefractionArcmin(-1.0)).toBe(bennettRefractionArcmin(-0.5));
    expect(bennettRefractionArcmin(-0.5)).toBeGreaterThan(bennettRefractionArcmin(0));
  });

  it('scales down with low pressure (high-altitude site)', () => {
    const sea = bennettRefractionArcmin(1);
    setAtmosphericConditions(700, 10); // ~3000 m elevation
    const mountain = bennettRefractionArcmin(1);
    expect(mountain).toBeCloseTo(sea * (700 / 1010), 5);
  });

  it('scales down with high temperature', () => {
    const cold = bennettRefractionArcmin(1);
    setAtmosphericConditions(1010, 40);
    const hot = bennettRefractionArcmin(1);
    expect(hot).toBeCloseTo(cold * (283 / 313), 5);
  });
});
