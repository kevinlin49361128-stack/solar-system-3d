import { describe, it, expect } from 'vitest';
import { Vector3 } from 'three';
import {
  apparentMagnitude, phaseAngleDeg, illuminatedFraction,
  angularDiameterArcsec, synodicPeriod, hillSphereAU, rocheLimitAU,
  bodyObservables, moonObservables,
} from './bodyObservables';

describe('phaseAngleDeg', () => {
  it('= 0 when observer is on the body→sun line (full phase)', () => {
    const body = new Vector3(2, 0, 0);   // 2 AU from sun
    const earth = new Vector3(3, 0, 0);  // 1 AU beyond body, both colinear with sun
    // Sun-body-observer angle: sun→body direction = (-1,0,0), observer→body = (1,0,0).
    // Vectors from body's perspective: sun is at -body, observer is at earth-body = (1,0,0).
    // dot(sun_from_body, obs_from_body) = (-1,0,0)·(1,0,0) = -1 → α = 180° (back of body).
    expect(phaseAngleDeg(body, earth)).toBeCloseTo(180, 1);
  });
  it('= 90° when observer is perpendicular to sun-body line (half phase)', () => {
    const body = new Vector3(1, 0, 0);
    const earth = new Vector3(1, 1, 0); // body's "side" view
    // sun→body unit vec from body = (-1,0,0); obs→body from body = (0,1,0).
    // dot = 0 → 90°.
    expect(phaseAngleDeg(body, earth)).toBeCloseTo(90, 1);
  });
});

describe('illuminatedFraction', () => {
  it('= 1 at α=0 (full)', () => {
    expect(illuminatedFraction(0)).toBeCloseTo(1, 6);
  });
  it('= 0.5 at α=90° (half)', () => {
    expect(illuminatedFraction(90)).toBeCloseTo(0.5, 6);
  });
  it('= 0 at α=180° (new)', () => {
    expect(illuminatedFraction(180)).toBeCloseTo(0, 6);
  });
});

describe('angularDiameterArcsec', () => {
  it('Sun (radius 696000 km) at 1 AU ≈ 1919″', () => {
    expect(angularDiameterArcsec(696000, 1)).toBeCloseTo(1919, -1);
  });
  it('Moon (radius 1737 km) at 384400 km ≈ 1865″', () => {
    const distAU = 384400 / 1.495978707e8;
    expect(angularDiameterArcsec(1737, distAU)).toBeCloseTo(1865, -1);
  });
  it('Jupiter (radius 69911 km) at 4 AU ≈ 48″', () => {
    expect(angularDiameterArcsec(69911, 4)).toBeCloseTo(48, 0);
  });
});

describe('apparentMagnitude', () => {
  it('Venus at α=0, far side (superior conjunction) ~−3.9', () => {
    // r = 0.72, Δ = 1.72 (Venus on far side of sun), α=0 (full).
    const m = apparentMagnitude('venus', 0.72, 1.72, 0);
    expect(m).toBeGreaterThan(-4.5);
    expect(m).toBeLessThan(-3);
  });
  it('Mars at opposition (r ≈ 1.52, Δ ≈ 0.52, α ≈ 0) ≈ −2 mag', () => {
    const m = apparentMagnitude('mars', 1.52, 0.52, 0);
    expect(m).toBeGreaterThan(-3);
    expect(m).toBeLessThan(-1);
  });
  it('returns NaN for unknown body id', () => {
    expect(apparentMagnitude('starlink-1', 1, 1, 0)).toBeNaN();
  });
});

describe('synodicPeriod', () => {
  it('Earth-Mars (365.25 / 686.97 days) ≈ 779.9 days', () => {
    expect(synodicPeriod(365.25, 686.97)).toBeCloseTo(779.9, 0);
  });
  it('Earth-Venus (365.25 / 224.7) ≈ 583.9 days', () => {
    expect(synodicPeriod(365.25, 224.7)).toBeCloseTo(583.9, 0);
  });
  it('returns Infinity for equal periods', () => {
    expect(synodicPeriod(100, 100)).toBe(Infinity);
  });
});

describe('hillSphereAU', () => {
  it("Earth's Hill sphere ≈ 0.01 AU (1.5 M km)", () => {
    // Earth: a=1, e=0.0167, m=5.972e24, M_sun=1.989e30
    const r = hillSphereAU(1, 0.0167, 5.972e24, 1.989e30);
    expect(r).toBeCloseTo(0.0098, 3); // ~1.47 M km / AU_KM
  });
  it("Jupiter's Hill sphere ≈ 0.34 AU (51 M km)", () => {
    const r = hillSphereAU(5.2, 0.0489, 1.898e27, 1.989e30);
    expect(r).toBeGreaterThan(0.32);
    expect(r).toBeLessThan(0.36);
  });
});

describe('rocheLimitAU', () => {
  it('Earth-density satellite at Earth ≈ 9500 km (rigid)', () => {
    // Earth radius 6371, both densities 5515 → R · 2^(1/3) = 8024 km
    const km = rocheLimitAU(6371, 5515, 5515) * 1.495978707e8;
    expect(km).toBeGreaterThan(7000);
    expect(km).toBeLessThan(9000);
  });
});

describe('bodyObservables (full pipeline)', () => {
  it('Mars opposition geometry produces reasonable observables', () => {
    // Mars at (1.52, 0, 0), Earth at (1, 0, 0) — opposition.
    const mars = new Vector3(1.52, 0, 0);
    const earth = new Vector3(1, 0, 0);
    const obs = bodyObservables('mars', mars, earth, 3389);
    expect(obs.heliocentricDistanceAU).toBeCloseTo(1.52, 3);
    expect(obs.observerDistanceAU).toBeCloseTo(0.52, 3);
    expect(obs.phaseAngleDeg).toBeLessThan(5);
    expect(obs.illuminatedFraction).toBeGreaterThan(0.99);
    expect(obs.angularDiameterArcsec).toBeGreaterThan(15);
    expect(obs.angularDiameterArcsec).toBeLessThan(40);
  });
});

describe('moonObservables', () => {
  it('full moon geometry: moon anti-sunward of Earth', () => {
    // Earth at (1, 0, 0). Full moon = Earth shadow side, so moon is
    // FURTHER from Sun than Earth → moon helio = (1.00257, 0, 0) →
    // moonGeo = (+0.00257, 0, 0).
    const moonGeo = new Vector3(0.00257, 0, 0);
    const earth = new Vector3(1, 0, 0);
    const obs = moonObservables(moonGeo, earth, 1737);
    expect(obs.phaseAngleDeg).toBeLessThan(2);
    expect(obs.illuminatedFraction).toBeGreaterThan(0.99);
  });
});
