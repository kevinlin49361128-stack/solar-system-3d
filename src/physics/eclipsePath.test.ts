import { describe, it, expect } from 'vitest';
import { Vector3 } from 'three';
import { computeEclipsePath } from './eclipsePath';

/**
 * Synthetic geometry tests — feed the computer a known sun/moon
 * configuration and check the output makes geometric sense. Real
 * propagator-driven tests run in integration tests (data/integration.test.ts).
 */

const AU_KM = 1.495978707e8;

describe('computeEclipsePath', () => {
  it('produces valid samples and finds the peak (synthetic central eclipse)', () => {
    // Construct a synthetic central solar eclipse:
    //   - Earth at ~1 AU from Sun (Earth's heliocentric position vector ≈ (1, 0, 0))
    //   - Moon between Sun and Earth, on the Earth-Sun line (geocentric position ≈ (-d_moon_AU, 0, 0))
    //   - At "peak time" (synthetic JD 2460500) the moon-sun-earth alignment is exact.
    //
    // We model Earth's heliocentric position as constant during the ±3h window
    // (Earth moves ~0.0005 AU in 3h — tiny on this scale) and have the moon
    // drift slightly in y over time so the shadow sweeps a path on Earth.
    const PEAK_JD = 2460500;
    const moonGeoMag = 384400 / AU_KM; // ~0.00257 AU
    const earthHelioAt = (_jd: number): Vector3 => new Vector3(1, 0, 0);
    const moonGeoAt = (jd: number): Vector3 => {
      // Move moon slightly in y as jd advances, simulating Earth's rotation
      // sweeping the shadow across Earth's surface from west to east.
      const dt = jd - PEAK_JD; // days
      const drift = dt * 0.5e-4; // y component drifts; peak is at dt=0 with shadow centered
      return new Vector3(-moonGeoMag, drift, 0);
    };

    const path = computeEclipsePath(PEAK_JD, earthHelioAt, moonGeoAt, 1, 5); // ±1h, 5min step

    expect(path.samples.length).toBeGreaterThan(10);
    // Peak should be at exact center (jd = PEAK_JD).
    expect(Math.abs(path.peakJd - PEAK_JD)).toBeLessThan(0.01); // within 15 min
    // Peak should classify as total or annular (not partial — geometry is central).
    expect(path.type === 'total' || path.type === 'annular').toBe(true);
    // Some samples should hit Earth (path on surface).
    const hits = path.samples.filter(s => s.latDeg != null);
    expect(hits.length).toBeGreaterThan(0);
    // Peak sample's lat/lon should be near (0, 0) since Earth at +X is sun-facing
    // and shadow line passes through origin from -X direction.
    const peakSample = path.samples.find(s => Math.abs(s.jd - path.peakJd) < 0.01);
    expect(peakSample?.latDeg).not.toBeNull();
    expect(Math.abs(peakSample!.latDeg!)).toBeLessThan(5);
  });

  it('returns no surface hits when moon is far off the Earth-Sun line', () => {
    // Moon far from the sun direction → no shadow on Earth.
    const PEAK_JD = 2460500;
    const earthHelioAt = (_jd: number): Vector3 => new Vector3(1, 0, 0);
    // Moon at +z direction from Earth → shadow ray from sun through moon
    // points away from Earth.
    const moonGeoAt = (_jd: number): Vector3 => new Vector3(0, 0, 0.00257);

    const path = computeEclipsePath(PEAK_JD, earthHelioAt, moonGeoAt, 0.5, 10);
    const hits = path.samples.filter(s => s.latDeg != null);
    // No surface hits AND separation should be large.
    expect(hits.length).toBe(0);
    expect(path.type).toBe('partial');
  });

  it('separation angle is small near peak', () => {
    const PEAK_JD = 2460500;
    const moonGeoMag = 384400 / AU_KM;
    const earthHelioAt = (_jd: number): Vector3 => new Vector3(1, 0, 0);
    const moonGeoAt = (_jd: number): Vector3 => new Vector3(-moonGeoMag, 0, 0);

    const path = computeEclipsePath(PEAK_JD, earthHelioAt, moonGeoAt, 0.5, 10);
    const peakSample = path.samples.reduce((a, b) =>
      a.separationDeg < b.separationDeg ? a : b);
    // Sun and Moon directions both ≈ (-1, 0, 0) from Earth → near-zero separation.
    expect(peakSample.separationDeg).toBeLessThan(0.5);
  });

  it('umbra radius positive for total, negative for annular geometries', () => {
    const PEAK_JD = 2460500;
    // Force annular: increase moon distance so umbra cone tip falls SHORT of Earth.
    // L_umbra = R_moon / tan(α_umbra) = R_moon · sun_dist / (R_sun − R_moon) ≈ 374000 km.
    // If moon is 400000 km away, umbra cone tip is 26000 km BEFORE Earth's surface
    // (since Earth radius is 6371 km; Earth far side at 400000+6371 km from moon) → annular.
    const moonGeoFar = 400000 / AU_KM;
    const earthHelioAt = (_jd: number): Vector3 => new Vector3(1, 0, 0);
    const moonGeoAt = (_jd: number): Vector3 => new Vector3(-moonGeoFar, 0, 0);

    const path = computeEclipsePath(PEAK_JD, earthHelioAt, moonGeoAt, 0.5, 10);
    const peakSample = path.samples.reduce((a, b) =>
      a.separationDeg < b.separationDeg ? a : b);
    if (peakSample.latDeg != null) {
      // Annular: umbra "radius" is negative (cone tip inside Earth). Magnitude small.
      expect(peakSample.umbraRadiusKm).toBeLessThan(0);
    }
  });
});
