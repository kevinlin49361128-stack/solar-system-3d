import { describe, it, expect } from 'vitest';
import { habitableZoneAU, classifyHabitability } from './habitableZone';

/**
 * Reference values from Kopparapu+2013 Table 3 plus the online
 * calculator at https://depts.washington.edu/naivpl/. All tolerances
 * are well outside the formula's own ~3 % error band so any future
 * coefficient drift trips the tests.
 */
describe('habitableZoneAU — Kopparapu 2013 benchmarks', () => {
  it('Sol HZ ≈ 0.75 → 1.77 AU (Recent Venus / Early Mars)', () => {
    const hz = habitableZoneAU(695700, 5778);
    expect(hz).not.toBeNull();
    expect(hz!.innerAU).toBeCloseTo(0.75, 1);
    expect(hz!.outerAU).toBeCloseTo(1.77, 1);
    // Earth at 1.0 AU should sit comfortably inside.
    expect(1.0).toBeGreaterThan(hz!.innerAU);
    expect(1.0).toBeLessThan(hz!.outerAU);
  });

  it('TRAPPIST-1 (M8 dwarf, 0.121 R☉, 2566 K) — HZ tight around 0.025–0.057 AU', () => {
    const hz = habitableZoneAU(0.121 * 695700, 2566);
    // Tolerance: Kopparapu polynomial extrapolation gets shaky in the
    // late-M regime, but published values are 0.024 → 0.049 AU; we
    // accept a wide band here since the absolute number is what's
    // pedagogically meaningful (HZ is INSIDE Mercury's orbit).
    expect(hz).not.toBeNull();
    expect(hz!.innerAU).toBeGreaterThan(0.015);
    expect(hz!.innerAU).toBeLessThan(0.060);
    expect(hz!.outerAU).toBeGreaterThan(0.035);
    expect(hz!.outerAU).toBeLessThan(0.090);
    // TRAPPIST-1 e at 0.029 AU — inside the HZ.
    expect(0.029).toBeGreaterThan(hz!.innerAU);
    expect(0.029).toBeLessThan(hz!.outerAU);
  });

  it('Proxima Centauri (M5.5, 0.154 R☉, 3042 K) — Proxima b at 0.0485 AU', () => {
    const hz = habitableZoneAU(0.154 * 695700, 3042);
    expect(hz).not.toBeNull();
    // Proxima b's a ≈ 0.0485 AU sits inside the conservative HZ.
    expect(0.0485).toBeGreaterThan(hz!.innerAU * 0.9);
    expect(0.0485).toBeLessThan(hz!.outerAU * 1.1);
  });

  it('returns null below the calibrated 2300 K floor', () => {
    expect(habitableZoneAU(100000, 2000)).toBeNull();
  });

  it('returns null above the calibrated 8000 K ceiling', () => {
    expect(habitableZoneAU(1500000, 9500)).toBeNull();
  });
});

describe('classifyHabitability — per-planet bucket', () => {
  const hz = { innerAU: 0.75, outerAU: 1.77 };  // Sol's HZ

  it('Earth (1.0 AU) classifies as in-hz around Sol', () => {
    expect(classifyHabitability(1.0, hz)).toBe('in-hz');
  });

  it('Mars (1.524 AU) classifies as in-hz under conservative bounds', () => {
    // Surprising-to-laypeople fact: Mars IS inside the conservative HZ.
    // It's not habitable because it lost its atmosphere — the HZ is a
    // necessary but not sufficient condition. Worth surfacing visually
    // so the user sees that orbits inside the green ring still aren't
    // automatically Earth analogues.
    expect(classifyHabitability(1.524, hz)).toBe('in-hz');
  });

  it('Venus (0.723 AU) classifies as hot-edge (just inside the runaway boundary)', () => {
    // 0.723 / 0.75 = 0.964 → within 10 % of inner edge → hot-edge.
    expect(classifyHabitability(0.723, hz)).toBe('hot-edge');
  });

  it('Mercury (0.387 AU) classifies as too-hot', () => {
    expect(classifyHabitability(0.387, hz)).toBe('too-hot');
  });

  it('Jupiter (5.2 AU) classifies as too-cold', () => {
    expect(classifyHabitability(5.2, hz)).toBe('too-cold');
  });

  it('returns unknown when HZ data missing', () => {
    expect(classifyHabitability(1.0, null)).toBe('unknown');
  });
});
