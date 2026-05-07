import { describe, it, expect } from 'vitest';
import { STARS_AND_PLANETS } from './bodies';
import { MOONS } from './moons';
import { DWARFS } from './dwarfs';
import { COMETS } from './comets';
import { J2000_JD } from '../physics/constants';

/**
 * Integration tests at the data level: every BodyDescriptor must be
 * structurally valid and its propagator must produce non-degenerate states
 * at J2000 and at a far-future date. This catches bad orbital elements
 * (e.g. mistyped period, NaN-producing inputs) before they hit the renderer.
 *
 * No DOM / WebGL / Three.js wiring needed — these run headless in vitest.
 */

const ALL_BODIES = [...STARS_AND_PLANETS, ...DWARFS, ...COMETS, ...MOONS];

describe('Body descriptors — schema', () => {
  it('every body has unique id + non-empty name', () => {
    const ids = new Set<string>();
    for (const b of ALL_BODIES) {
      expect(b.id).toBeTruthy();
      expect(b.name).toBeTruthy();
      expect(b.nameEn).toBeTruthy();
      expect(ids.has(b.id), `duplicate id: ${b.id}`).toBe(false);
      ids.add(b.id);
    }
  });

  it('every body has positive radius and a category', () => {
    for (const b of ALL_BODIES) {
      expect(b.physical.radiusKm, b.id).toBeGreaterThan(0);
      expect(['star', 'planet', 'dwarf', 'moon', 'comet']).toContain(b.category);
    }
  });

  it('moons have parentId referring to a registered body', () => {
    const ids = new Set(ALL_BODIES.map(b => b.id));
    for (const m of MOONS) {
      expect(m.parentId).toBeTruthy();
      expect(ids.has(m.parentId!), `moon ${m.id} → parent ${m.parentId} not found`).toBe(true);
    }
  });
});

describe('Propagators — produce finite states', () => {
  // Two reference epochs: J2000 (the propagator's home) and ~25 years past.
  const epochs = [J2000_JD, J2000_JD + 25 * 365.25];

  it.each(STARS_AND_PLANETS.filter(b => b.propagator))('planet %s state vector is finite', (body) => {
    for (const jd of epochs) {
      const sv = body.propagator!.stateAt(jd);
      expect(Number.isFinite(sv.position.x), `${body.id} pos.x at ${jd}`).toBe(true);
      expect(Number.isFinite(sv.position.y), `${body.id} pos.y at ${jd}`).toBe(true);
      expect(Number.isFinite(sv.position.z), `${body.id} pos.z at ${jd}`).toBe(true);
      expect(Number.isFinite(sv.velocity.x)).toBe(true);
    }
  });

  it.each(DWARFS)('dwarf %s state vector is finite', (body) => {
    for (const jd of epochs) {
      const sv = body.propagator!.stateAt(jd);
      expect(Number.isFinite(sv.position.length())).toBe(true);
    }
  });

  it.each(COMETS)('comet %s position stays bounded over a century', (body) => {
    // Sample 100 jds spread over ±50 years from J2000. None should explode.
    let maxR = 0;
    for (let i = 0; i < 100; i++) {
      const jd = J2000_JD + (i - 50) * 365.25;
      const sv = body.propagator!.stateAt(jd);
      const r = sv.position.length();
      expect(Number.isFinite(r), `${body.id} at ${jd}`).toBe(true);
      // Long-period comets can reach Oort-cloud distances. Cap at the inner
      // Oort boundary (~50 000 AU); anything beyond is propagator garbage
      // (the old Newton divergence bug spat out 10⁵+ AU).
      expect(r).toBeLessThan(50000);
      if (r > maxR) maxR = r;
    }
    // Sanity: comet's max-r should be at least its perihelion distance,
    // i.e. propagator isn't returning a collapsed orbit.
    expect(maxR).toBeGreaterThan(0.1);
  });

  it('Earth orbit at J2000 is approximately 1 AU and on the ecliptic', () => {
    const earth = STARS_AND_PLANETS.find(b => b.id === 'earth');
    expect(earth).toBeDefined();
    const sv = earth!.propagator!.stateAt(J2000_JD);
    const r = sv.position.length();
    expect(r).toBeGreaterThan(0.98);
    expect(r).toBeLessThan(1.02);
    // Ecliptic coordinate frame: ecliptic plane is z=0, Earth's i ≈ 0 → |z| < 0.001
    expect(Math.abs(sv.position.z)).toBeLessThan(0.001);
  });

  it('Halley near aphelion in 2026 (regression: high-e Newton divergence)', () => {
    // Halley last perihelion 1986; aphelion ~2024. By 2026 it should be near
    // 35 AU. The OLD solver returned chaotic values jumping 0.5–35 AU per day.
    const halley = COMETS.find(b => b.id === 'halley');
    expect(halley).toBeDefined();
    // 2026-05-01 ≈ JD 2461161
    const sv1 = halley!.propagator!.stateAt(2461161);
    const sv2 = halley!.propagator!.stateAt(2461162);
    const r1 = sv1.position.length();
    const r2 = sv2.position.length();
    expect(r1).toBeGreaterThan(34);
    expect(r1).toBeLessThan(36);
    // 1-day delta should be tiny near aphelion (mean motion is slow there).
    expect(Math.abs(r1 - r2)).toBeLessThan(0.01);
  });
});
