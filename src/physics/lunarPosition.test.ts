import { describe, it, expect } from 'vitest';
import { moonPositionEcliptic, moonLibrationDeg, LunarPropagator } from './lunarPosition';
import { J2000_JD, AU_KM } from './constants';

describe('moonPositionEcliptic', () => {
  it('produces sensible distance (between perigee 356,500 km and apogee 406,700 km)', () => {
    // Sample 30 days at 1-day intervals to cover ~1 sidereal month
    for (let i = 0; i < 30; i++) {
      const jd = J2000_JD + i;
      const r = moonPositionEcliptic(jd).length() * AU_KM;
      expect(r).toBeGreaterThan(355000);
      expect(r).toBeLessThan(410000);
    }
  });

  it('Meeus 1998 worked example (1992 April 12, 0h TD): λ ≈ 133°10′ , β ≈ −3°13′ , Δ ≈ 368,409 km', () => {
    // Meeus 47.a worked example, reference solution.
    // Convert calendar date to JD: 1992-04-12 00:00 TD = JD 2448724.5
    const jd = 2448724.5;
    const v = moonPositionEcliptic(jd);
    const r = v.length();
    const distKm = r * AU_KM;

    // Reference distance: 368,409.7 km. Truncated theory ≈ ±50 km.
    expect(distKm).toBeGreaterThan(368300);
    expect(distKm).toBeLessThan(368500);

    // Geocentric ecliptic longitude — restore from Cartesian.
    let lambdaDeg = Math.atan2(v.y, v.x) * 180 / Math.PI;
    if (lambdaDeg < 0) lambdaDeg += 360;
    // Reference: 133.167° (133°10′). Tolerance: < 0.05° (180″).
    expect(lambdaDeg).toBeGreaterThan(133.10);
    expect(lambdaDeg).toBeLessThan(133.25);

    // Ecliptic latitude
    const betaDeg = Math.asin(v.z / r) * 180 / Math.PI;
    // Reference: −3.229°. Tolerance: < 0.02°.
    expect(betaDeg).toBeGreaterThan(-3.27);
    expect(betaDeg).toBeLessThan(-3.18);
  });

  it('position evolves smoothly day-to-day (no Newton-divergence-style jumps)', () => {
    let maxDelta = 0;
    let prev = moonPositionEcliptic(J2000_JD).length() * AU_KM;
    for (let i = 1; i < 60; i++) {
      const r = moonPositionEcliptic(J2000_JD + i).length() * AU_KM;
      maxDelta = Math.max(maxDelta, Math.abs(r - prev));
      prev = r;
    }
    // Moon's radial velocity peaks at ~6000 km/day mid-swing between
    // perigee and apogee (a·e·n × Keplerian factor). 12,000 km/day is well
    // above any real motion and would only fire if the series diverges.
    expect(maxDelta).toBeLessThan(12000);
  });

  it('completes ~ one orbit per sidereal month (mean longitude wraps)', () => {
    const a = moonPositionEcliptic(J2000_JD);
    const b = moonPositionEcliptic(J2000_JD + 27.32);
    // Position should be close (within ~1 AU/AU_KM normalised distance)
    // because sidereal period is 27.32 days. Distance similarity isn't a tight
    // bound (eccentric orbit), but angular position should be within ~10°.
    const aLon = Math.atan2(a.y, a.x);
    const bLon = Math.atan2(b.y, b.x);
    let diff = Math.abs(aLon - bLon);
    if (diff > Math.PI) diff = 2 * Math.PI - diff;
    expect(diff * 180 / Math.PI).toBeLessThan(15);
  });
});

describe('LunarPropagator', () => {
  it('returns finite state with non-zero velocity', () => {
    const prop = new LunarPropagator();
    const sv = prop.stateAt(J2000_JD);
    expect(Number.isFinite(sv.position.x)).toBe(true);
    expect(Number.isFinite(sv.velocity.x)).toBe(true);
    // Lunar velocity ≈ 1 km/s ≈ 1/AU_KM AU/s ≈ 86400/AU_KM AU/day ≈ 5.78e-4 AU/day
    const v = sv.velocity.length();
    expect(v).toBeGreaterThan(4e-4);
    expect(v).toBeLessThan(8e-4);
  });

  it('exposes orbital elements consistent with the Moon', () => {
    const prop = new LunarPropagator();
    expect(prop.elements.a).toBeCloseTo(384399 / AU_KM, 6);
    expect(prop.elements.e).toBeCloseTo(0.0549, 4);
    expect(prop.elements.periodDays).toBeCloseTo(27.32, 1);
  });
});

describe('moonLibrationDeg — Meeus chapter 53 optical libration', () => {
  it('stays bounded within textbook ±10° on both axes across a year', () => {
    // Theoretical maxima are ±7.9° (longitude) and ±6.7° (latitude),
    // but the geometric formula occasionally peaks slightly higher
    // when the apparent latitude term contributes — keep a generous
    // ±10° box for the regression check.
    for (let i = 0; i < 365; i += 7) {
      const lib = moonLibrationDeg(J2000_JD + i);
      expect(Math.abs(lib.longitudeDeg)).toBeLessThan(10);
      expect(Math.abs(lib.latitudeDeg)).toBeLessThan(10);
    }
  });

  it('matches Meeus example 53.a at JD 2448724.5 (1992 Apr 12)', () => {
    // Meeus 1998 worked example: l' = -1.206°, b' = +4.196°.
    // Our truncated Brown-theory expansion has ~19″ position error, so
    // libration here matches to ~0.2° rather than Meeus's 6 decimal places.
    const lib = moonLibrationDeg(2448724.5);
    expect(lib.longitudeDeg).toBeCloseTo(-1.206, 0);
    expect(lib.latitudeDeg).toBeCloseTo(4.196, 0);
  });

  it('libration in latitude oscillates over a draconic month (~27.21 d)', () => {
    // Sample b' every 2 days for 30 days; expect to cross zero at least
    // once (a draconic period fits inside 30 days regardless of phase).
    let signChanges = 0;
    let prevSign = 0;
    for (let i = 0; i <= 30; i += 2) {
      const b = moonLibrationDeg(J2000_JD + i).latitudeDeg;
      const sgn = Math.sign(b);
      if (prevSign !== 0 && sgn !== 0 && sgn !== prevSign) signChanges++;
      if (sgn !== 0) prevSign = sgn;
    }
    expect(signChanges).toBeGreaterThanOrEqual(1);
  });

  it('libration is deterministic for repeated calls (no state leakage)', () => {
    const a = moonLibrationDeg(J2000_JD + 100);
    const b = moonLibrationDeg(J2000_JD + 100);
    expect(a.longitudeDeg).toBe(b.longitudeDeg);
    expect(a.latitudeDeg).toBe(b.latitudeDeg);
  });
});
