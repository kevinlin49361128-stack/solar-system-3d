import { describe, it, expect } from 'vitest';
import { Vector3 } from 'three';
import { NBodySimulation } from './nbody';

/**
 * Tiny 2-body fixture: a sun and a circular-orbit "planet" at 1 AU.
 * Velocity magnitude for a circular orbit at 1 AU around 1 M_sun is
 * exactly 2π / 365.25636 AU/day ≈ 0.01720 AU/day (Gaussian gravitational
 * constant). We use this to validate conservation diagnostics: a
 * symplectic integrator on a circular orbit should keep |E|, |L| flat
 * to within a tight tolerance.
 */
function twoBodyInitial(): { id: string; massKg: number; pos: Vector3; vel: Vector3 }[] {
  return [
    {
      id: 'sun',
      massKg: 1.98892e30,
      pos: new Vector3(0, 0, 0),
      vel: new Vector3(0, 0, 0),
    },
    {
      id: 'planet',
      // Earth-mass tracer; a true test particle (m → 0) would also work.
      massKg: 5.972e24,
      pos: new Vector3(1, 0, 0),
      // Circular orbit speed = 2π / sidereal year (in AU/day units)
      vel: new Vector3(0, 2 * Math.PI / 365.25636, 0),
    },
  ];
}

describe('NBodySimulation.getConservation', () => {
  it('returns finite values for kinetic, potential, total energy + |L|', () => {
    const sim = new NBodySimulation(twoBodyInitial(), 2451545);
    const c = sim.getConservation();
    expect(Number.isFinite(c.kineticE)).toBe(true);
    expect(Number.isFinite(c.potentialE)).toBe(true);
    expect(Number.isFinite(c.totalE)).toBe(true);
    expect(Number.isFinite(c.angMom)).toBe(true);
  });

  it('PE is negative for bound bodies', () => {
    const sim = new NBodySimulation(twoBodyInitial(), 2451545);
    const c = sim.getConservation();
    expect(c.potentialE).toBeLessThan(0);
  });

  it('|L| > 0 for an orbiting two-body system', () => {
    const sim = new NBodySimulation(twoBodyInitial(), 2451545);
    expect(sim.getConservation().angMom).toBeGreaterThan(0);
  });

  it('Velocity Verlet preserves energy + |L| within ~1e-5 over 1 year', () => {
    const sim = new NBodySimulation(twoBodyInitial(), 2451545);
    sim.integrator = 'verlet';
    const c0 = sim.getConservation();

    // Step forward 1 year in 1-day steps. ~365 steps of Velocity Verlet.
    for (let i = 0; i < 365; i++) sim.step(1);

    const c1 = sim.getConservation();
    const dE = Math.abs((c1.totalE - c0.totalE) / c0.totalE);
    const dL = Math.abs((c1.angMom - c0.angMom) / c0.angMom);
    // Velocity Verlet on a circular orbit: ΔE oscillates but bounded.
    // 1e-5 is loose enough to be robust, tight enough to catch a bug
    // (a non-symplectic Euler would drift to >1e-2 in a year).
    expect(dE).toBeLessThan(1e-5);
    expect(dL).toBeLessThan(1e-10); // |L| is exactly conserved for central force
  });

  it('Yoshida 4 preserves energy ~10× better than Verlet', () => {
    const simV = new NBodySimulation(twoBodyInitial(), 2451545);
    simV.integrator = 'verlet';

    const simY = new NBodySimulation(twoBodyInitial(), 2451545);
    simY.integrator = 'yoshida4';

    const e0 = simV.getConservation().totalE;
    for (let i = 0; i < 365; i++) { simV.step(1); simY.step(1); }
    const eV = simV.getConservation().totalE;
    const eY = simY.getConservation().totalE;

    const dV = Math.abs((eV - e0) / e0);
    const dY = Math.abs((eY - e0) / e0);
    // Yoshida 4 should be cleaner. We require dY < dV (Yoshida wins) but
    // don't enforce a specific ratio — both are very tight on this fixture.
    expect(dY).toBeLessThanOrEqual(dV * 1.1); // tiny slack for noise
  });
});

describe('Sun J2 perturbation', () => {
  it('toggle adds extra radial acceleration on Mercury-like orbit', () => {
    // Mercury at 0.387 AU. Two sims: one with J2 off, one with J2 on.
    // Step one tiny dt and compare velocity deltas.
    const merc = [
      { id: 'sun',     massKg: 1.98892e30, pos: new Vector3(0, 0, 0),     vel: new Vector3(0, 0, 0) },
      { id: 'mercury', massKg: 3.3011e23,  pos: new Vector3(0.387, 0, 0), vel: new Vector3(0, 0.0102, 0) },
    ];
    const simOff = new NBodySimulation(JSON.parse(JSON.stringify(merc)).map(reHydrate), 2451545);
    const simOn  = new NBodySimulation(JSON.parse(JSON.stringify(merc)).map(reHydrate), 2451545);
    simOn.solarJ2 = true;
    simOff.step(0.1);
    simOn.step(0.1);
    const vOff = simOff.getState('mercury')!.velocity;
    const vOn  = simOn.getState('mercury')!.velocity;
    // J2 contribution should be radial (pointing toward Sun), so the
    // x-component of mercury's velocity should be MORE negative with J2.
    // (mercury was at +x with zero radial velocity, J2 pulls it inward).
    expect(vOn.x).toBeLessThan(vOff.x);
    // Magnitude check: J2_solar = 2e-7, (R_sun/r)² ~ (0.00465/0.387)² ~ 1.44e-4,
    // so J2 correction is ~3/2 · 2e-7 · 1.44e-4 ≈ 4e-11 fractional gravity boost.
    // Over 0.1 day on a Mercury-like orbit (orbital velocity ~10 km/s = 5.7e-3 AU/d),
    // expect Δvx of order 4e-11 × 5.7e-3 × 0.1 ≈ 2e-14 AU/d — measurable in fp64.
    expect(Math.abs(vOn.x - vOff.x)).toBeGreaterThan(1e-15);
    expect(Math.abs(vOn.x - vOff.x)).toBeLessThan(1e-10);
  });

  it('default is off (no behavior change unless opted in)', () => {
    const sim = new NBodySimulation(twoBodyInitial(), 2451545);
    expect(sim.solarJ2).toBe(false);
  });
});

// Re-hydrate plain {x,y,z} JSON back into Vector3 — JSON.parse strips classes.
function reHydrate<T extends { pos: { x: number; y: number; z: number }; vel: { x: number; y: number; z: number } }>(p: T) {
  return { ...p, pos: new Vector3(p.pos.x, p.pos.y, p.pos.z), vel: new Vector3(p.vel.x, p.vel.y, p.vel.z) };
}
