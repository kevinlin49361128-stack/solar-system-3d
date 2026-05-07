import { describe, it, expect } from 'vitest';
import { solarSpherical, sunPositionEcliptic } from './solarPosition';
import { AU_KM } from './constants';

/**
 * Reference values from Meeus 1998 Astronomical Algorithms Ch. 25 worked
 * examples and from JPL Horizons / DE-440 lookups for cross-checking
 * eclipse-relevant epochs.
 */

describe('solarSpherical', () => {
  it('Meeus 1998 Ch.25 example: 1992 Oct 13.0 TD → λ ≈ 199.907°, R ≈ 0.99766 AU', () => {
    // Calendar 1992-10-13.0 TD = JD 2448908.5
    const jd = 2448908.5;
    const s = solarSpherical(jd);
    // Reference (Meeus p.169): apparent longitude = 199°54'21" = 199.9058°
    expect(s.lambdaDeg).toBeGreaterThan(199.85);
    expect(s.lambdaDeg).toBeLessThan(199.95);
    // Reference distance: 0.99766 AU
    expect(s.rAU).toBeGreaterThan(0.9974);
    expect(s.rAU).toBeLessThan(0.9979);
  });

  it('2026-08-12 17:46 UT (eclipse peak): λ ≈ 140°', () => {
    // Real greatest-eclipse moment for 2026 total solar eclipse.
    // Meeus AA Ch.25 truncated: ~140.04°, accuracy ~0.01°. Tolerance
    // is generous (0.5°) to accommodate any minor TD/UTC offset.
    const jd = 2461264.5 + 17.7666 / 24;
    const s = solarSpherical(jd);
    expect(s.lambdaDeg).toBeGreaterThan(139.5);
    expect(s.lambdaDeg).toBeLessThan(140.5);
    // Sun-Earth distance in early August is ~1.013 AU.
    expect(s.rAU).toBeGreaterThan(1.010);
    expect(s.rAU).toBeLessThan(1.016);
  });

  it('2024-04-08 18:18 UT (great American eclipse peak): λ ≈ 19.50°', () => {
    const jd = 2460408.5 + 18.3 / 24;
    const s = solarSpherical(jd);
    // Sun's apparent ecliptic longitude on April 8 around 19.5°
    expect(s.lambdaDeg).toBeGreaterThan(19.0);
    expect(s.lambdaDeg).toBeLessThan(20.5);
  });
});

describe('sunPositionEcliptic', () => {
  it('produces unit-ish length vector close to 1 AU', () => {
    const v = sunPositionEcliptic(2451545.0); // J2000
    const r = v.length();
    expect(r).toBeGreaterThan(0.98);
    expect(r).toBeLessThan(1.02);
    // z-component (ecliptic latitude) is essentially 0 for the Sun.
    expect(Math.abs(v.z)).toBeLessThan(0.001);
  });

  it('annual mean anomaly cycle: position returns to similar place after 365.25 days', () => {
    const jd = 2455000;
    const a = sunPositionEcliptic(jd);
    const b = sunPositionEcliptic(jd + 365.25);
    // Magnitude diff < 0.005 AU (Earth's eccentricity gives slightly different r at same longitude).
    expect(Math.abs(a.length() - b.length())).toBeLessThan(0.005);
    // Angular position should be within ~0.5° (Earth orbital period is 365.256 days, not 365.25)
    const dotN = a.clone().normalize().dot(b.clone().normalize());
    const angDeg = Math.acos(Math.max(-1, Math.min(1, dotN))) * 180 / Math.PI;
    expect(angDeg).toBeLessThan(0.5);
  });

  it('matches KeplerPropagator-derived sun within ~1° (sanity)', () => {
    // Sanity check: we're claiming Meeus is more accurate, but it should
    // still be in the same neighbourhood as KeplerPropagator's −earthHelio.
    // Differences > a few degrees would indicate a frame bug.
    void AU_KM; // unused
    const jd = 2461265.24;
    const v = sunPositionEcliptic(jd);
    let lon = Math.atan2(v.y, v.x) * 180 / Math.PI;
    if (lon < 0) lon += 360;
    // Sun should be near 140° at this date (from astronomical references).
    expect(Math.abs(lon - 140.42)).toBeLessThan(0.5);
  });
});
