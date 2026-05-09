import { describe, it, expect } from 'vitest';
import { Vector3 } from 'three';
import { lagrangePoints, massRatio } from './lagrange';

describe('lagrangePoints — Sun–Earth system', () => {
  // M_sun = 1.989e30 kg, M_earth = 5.972e24 kg, separation 1 AU.
  const M_SUN = 1.989e30;
  const M_EARTH = 5.972e24;
  const AU = 1; // working in AU
  const sun = new Vector3(0, 0, 0);
  const earth = new Vector3(AU, 0, 0);

  const points = lagrangePoints(M_SUN, M_EARTH, sun, earth);

  it('μ has the textbook value (~3.04e-6)', () => {
    const mu = massRatio(M_SUN, M_EARTH);
    expect(mu).toBeGreaterThan(2e-6);
    expect(mu).toBeLessThan(4e-6);
  });

  it('L1 sits on the Sun–Earth line ~1.5 million km sunward of Earth', () => {
    const distFromEarth = points.L1.distanceTo(earth);
    // Hill radius (μ/3)^(1/3) ≈ 0.01 AU = 1.496e6 km. Accept ±20%.
    expect(distFromEarth).toBeGreaterThan(0.008);
    expect(distFromEarth).toBeLessThan(0.012);
    // L1 is between the two: |Sun-L1| < |Sun-Earth|
    expect(points.L1.length()).toBeLessThan(AU);
    // L1 is collinear: y, z negligible
    expect(Math.abs(points.L1.y)).toBeLessThan(1e-9);
    expect(Math.abs(points.L1.z)).toBeLessThan(1e-9);
  });

  it('L2 sits on the Sun–Earth line ~1.5 million km past Earth', () => {
    const distFromEarth = points.L2.distanceTo(earth);
    expect(distFromEarth).toBeGreaterThan(0.008);
    expect(distFromEarth).toBeLessThan(0.012);
    expect(points.L2.length()).toBeGreaterThan(AU);
    expect(Math.abs(points.L2.y)).toBeLessThan(1e-9);
  });

  it('L3 sits roughly opposite the Sun, slightly past 1 AU', () => {
    expect(points.L3.x).toBeLessThan(-0.99);
    expect(points.L3.x).toBeGreaterThan(-1.01);
    expect(Math.abs(points.L3.y)).toBeLessThan(1e-9);
  });

  it('L4 and L5 form equilateral triangles with Sun and Earth', () => {
    // |L4-Sun| = |L4-Earth| = 1 AU exactly.
    const distSunL4 = points.L4.distanceTo(sun);
    const distEarthL4 = points.L4.distanceTo(earth);
    expect(distSunL4).toBeCloseTo(AU, 10);
    expect(distEarthL4).toBeCloseTo(AU, 10);
    // L4 leads (positive y in our convention with ecliptic Z normal)
    expect(points.L4.y).toBeGreaterThan(0);

    const distSunL5 = points.L5.distanceTo(sun);
    const distEarthL5 = points.L5.distanceTo(earth);
    expect(distSunL5).toBeCloseTo(AU, 10);
    expect(distEarthL5).toBeCloseTo(AU, 10);
    expect(points.L5.y).toBeLessThan(0);
  });
});

describe('lagrangePoints — Sun–Jupiter system (Trojans live at L4/L5)', () => {
  const M_SUN = 1.989e30;
  const M_JUP = 1.898e27;
  const sun = new Vector3(0, 0, 0);
  const jupiter = new Vector3(5.2, 0, 0);

  const points = lagrangePoints(M_SUN, M_JUP, sun, jupiter);

  it('L4/L5 are 5.2 AU from both the Sun and Jupiter', () => {
    expect(points.L4.distanceTo(sun)).toBeCloseTo(5.2, 8);
    expect(points.L4.distanceTo(jupiter)).toBeCloseTo(5.2, 8);
    expect(points.L5.distanceTo(sun)).toBeCloseTo(5.2, 8);
    expect(points.L5.distanceTo(jupiter)).toBeCloseTo(5.2, 8);
  });

  it('L1 / L2 distance from Jupiter scales with Hill radius (μ ~ 1e-3)', () => {
    // Jupiter Hill radius ≈ 5.2 · (μ/3)^(1/3) ≈ 5.2 · 0.069 ≈ 0.36 AU.
    const d1 = points.L1.distanceTo(jupiter);
    const d2 = points.L2.distanceTo(jupiter);
    expect(d1).toBeGreaterThan(0.30);
    expect(d1).toBeLessThan(0.40);
    expect(d2).toBeGreaterThan(0.30);
    expect(d2).toBeLessThan(0.40);
  });
});

describe('lagrangePoints — frame transformation', () => {
  it('respects the orientation of the secondary in 3D', () => {
    // Place primary at origin, secondary along +y axis instead of +x.
    const M_SUN = 1.989e30;
    const M_EARTH = 5.972e24;
    const sun = new Vector3(0, 0, 0);
    const earth = new Vector3(0, 1, 0);
    const points = lagrangePoints(M_SUN, M_EARTH, sun, earth);
    // L1 should now be along +y, not +x.
    expect(Math.abs(points.L1.y)).toBeGreaterThan(0.9);
    expect(Math.abs(points.L1.x)).toBeLessThan(0.1);
    // L4/L5 should have non-zero x component (perpendicular to Sun-Earth line, in ecliptic plane).
    expect(Math.abs(points.L4.x)).toBeGreaterThan(0.5);
  });
});
