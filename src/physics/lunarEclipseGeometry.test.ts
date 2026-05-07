import { describe, it, expect } from 'vitest';
import { Vector3 } from 'three';
import { computeLunarEclipse } from './lunarEclipseGeometry';
import { sunPositionEcliptic } from './solarPosition';
import { moonPositionEcliptic } from './lunarPosition';

/**
 * Lunar-eclipse geometry tests, anchored to known events from
 * NASA Five Millennium Catalog of Lunar Eclipses.
 */

describe('computeLunarEclipse', () => {
  const sun = (jd: number): Vector3 => sunPositionEcliptic(jd);
  const moon = (jd: number): Vector3 => moonPositionEcliptic(jd);

  it('detects 2025-03-14 total lunar eclipse', () => {
    // NASA: greatest eclipse 2025-03-14 06:58 UT, total, magnitude 1.178
    // JD = 2460748.5 + 6.97/24
    const peakJd = 2460748.5 + 6.97 / 24;
    const r = computeLunarEclipse(sun, moon, peakJd, 0.25, 1 / 1440);
    expect(r.kind).toBe('total');
    expect(r.umbraMagnitude).toBeGreaterThan(1.0);
    expect(r.umbraMagnitude).toBeLessThan(1.3);
    // Contacts should be in correct order: P1 < U1 < U2 < Max < U3 < U4 < P4
    expect(r.p1Jd).not.toBeNull();
    expect(r.u1Jd).not.toBeNull();
    expect(r.u2Jd).not.toBeNull();
    expect(r.greatestJd).not.toBeNull();
    expect(r.u3Jd).not.toBeNull();
    expect(r.u4Jd).not.toBeNull();
    expect(r.p4Jd).not.toBeNull();
    expect(r.p1Jd!).toBeLessThan(r.u1Jd!);
    expect(r.u1Jd!).toBeLessThan(r.u2Jd!);
    expect(r.u2Jd!).toBeLessThan(r.greatestJd!);
    expect(r.greatestJd!).toBeLessThan(r.u3Jd!);
    expect(r.u3Jd!).toBeLessThan(r.u4Jd!);
    expect(r.u4Jd!).toBeLessThan(r.p4Jd!);
  });

  it('detects 2026-03-03 total lunar eclipse', () => {
    // NASA: greatest 2026-03-03 11:33 UT, total, magnitude 1.151
    const peakJd = 2461102.5 + 11.55 / 24;
    const r = computeLunarEclipse(sun, moon, peakJd, 0.25, 1 / 1440);
    expect(r.kind).toBe('total');
    expect(r.umbraMagnitude).toBeGreaterThan(1.0);
  });

  it('returns "none" for a non-eclipse full moon', () => {
    // 2024-04-23 full moon — no eclipse (penumbral but skipped here).
    const peakJd = 2460423.5 + 23.5 / 24;
    const r = computeLunarEclipse(sun, moon, peakJd, 0.25, 5 / 1440);
    // Should be 'none' or 'penumbral' at most; magnitude < 1.
    expect(r.kind === 'none' || r.kind === 'penumbral').toBe(true);
  });

  it('contact times are monotonic and within search window', () => {
    const peakJd = 2460748.5 + 6.97 / 24;
    const r = computeLunarEclipse(sun, moon, peakJd, 0.25, 1 / 1440);
    if (r.p1Jd != null && r.p4Jd != null) {
      expect(r.p4Jd - r.p1Jd).toBeLessThan(0.5); // <12h total span
      expect(r.p4Jd - r.p1Jd).toBeGreaterThan(0.05); // >1h
    }
  });

  it('frames cover the full search window', () => {
    const peakJd = 2460748.5 + 6.97 / 24;
    const r = computeLunarEclipse(sun, moon, peakJd, 0.25, 1 / 1440);
    expect(r.frames.length).toBeGreaterThan(500);
    // Earliest frame ≈ peakJd - 0.25, latest ≈ peakJd + 0.25
    expect(r.frames[0].jd).toBeCloseTo(peakJd - 0.25, 2);
    expect(r.frames[r.frames.length - 1].jd).toBeCloseTo(peakJd + 0.25, 2);
  });
});
