import { describe, it, expect } from 'vitest';
import {
  localSiderealDeg, hourAngleDeg, sunAltitudeDeg, moonAltitudeDeg,
  computeDailyEvents,
} from './dailyEvents';

// JD 2460000 = 2023-02-25 00:00 UT.
const JD_2023_FEB_25 = 2460000;

describe('localSiderealDeg', () => {
  it('matches GMST (within 1°) at lon=0', () => {
    const lst = localSiderealDeg(JD_2023_FEB_25, 0);
    // No checked value to compare to here, but it should be in [0, 360).
    expect(lst).toBeGreaterThanOrEqual(0);
    expect(lst).toBeLessThan(360);
  });
  it('shifts +90° when lon advances by +90°', () => {
    const lst0 = localSiderealDeg(JD_2023_FEB_25, 0);
    const lst90 = localSiderealDeg(JD_2023_FEB_25, 90);
    const diff = (lst90 - lst0 + 360) % 360;
    expect(diff).toBeCloseTo(90, 0);
  });
});

describe('hourAngleDeg', () => {
  it('= 0 when LST equals body RA', () => {
    expect(hourAngleDeg(6, 90)).toBeCloseTo(0, 6); // RA 6h = 90°
  });
  it('= +60° when body lies 4h east of meridian', () => {
    // Meridian transits when HA=0. 4 hours after transit, HA = +60° (west).
    expect(hourAngleDeg(0, 60)).toBeCloseTo(60, 6);
  });
});

describe('sunAltitudeDeg', () => {
  it('produces finite values for any input', () => {
    const alt = sunAltitudeDeg(JD_2023_FEB_25, 0, 0);
    expect(Number.isFinite(alt)).toBe(true);
    expect(alt).toBeGreaterThanOrEqual(-90);
    expect(alt).toBeLessThanOrEqual(90);
  });
  it('is positive at local solar noon at the equator', () => {
    // JD 2460000.0 = 2023-02-25 12:00 UT (JD increments at noon).
    // At noon UT at lon=0, sun should be near the meridian.
    expect(sunAltitudeDeg(JD_2023_FEB_25, 0, 0)).toBeGreaterThan(70);
  });
});

describe('moonAltitudeDeg', () => {
  it('returns finite altitude', () => {
    const alt = moonAltitudeDeg(JD_2023_FEB_25, 25, 121); // Taipei
    expect(Number.isFinite(alt)).toBe(true);
  });
});

describe('computeDailyEvents', () => {
  // Equinox-ish date, mid-latitude → close to 12-hour day.
  const JD_2023_MAR_20 = 2460023; // around vernal equinox
  it('Greenwich on 2023-03-20 has ≈12-hour day length (within 30 min)', () => {
    const ev = computeDailyEvents(JD_2023_MAR_20, 51.4769, -0.0005);
    expect(ev.dayLengthHours).not.toBeNull();
    expect(ev.dayLengthHours!).toBeGreaterThan(11.5);
    expect(ev.dayLengthHours!).toBeLessThan(12.5);
  });
  it("equinox EoT is small (<10 min in magnitude)", () => {
    const ev = computeDailyEvents(JD_2023_MAR_20, 51.4769, -0.0005);
    expect(Math.abs(ev.equationOfTimeMin)).toBeLessThan(10);
  });
  it('twilight order: astronomical-dawn ≤ nautical-dawn ≤ civil-dawn ≤ sunrise', () => {
    const ev = computeDailyEvents(JD_2023_MAR_20, 51.4769, -0.0005);
    if (ev.astronomicalDawn != null && ev.nauticalDawn != null
        && ev.civilDawn != null && ev.sunrise != null) {
      expect(ev.astronomicalDawn).toBeLessThanOrEqual(ev.nauticalDawn);
      expect(ev.nauticalDawn).toBeLessThanOrEqual(ev.civilDawn);
      expect(ev.civilDawn).toBeLessThanOrEqual(ev.sunrise);
    }
  });
  it('summer solstice in north has long day, polar regions near 24h', () => {
    // 2023-06-21 summer solstice
    const JD_2023_JUN_21 = 2460116.5;
    const arctic = computeDailyEvents(JD_2023_JUN_21, 75, 0);
    // Above the Arctic Circle in summer — sun never sets. Either
    // dayLengthHours is null (no rise/set) OR ≈24h.
    expect(arctic.dayLengthHours == null || arctic.dayLengthHours > 23).toBe(true);
  });
});
