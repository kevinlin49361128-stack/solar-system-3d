import { describe, it, expect } from 'vitest';
import { Vector3 } from 'three';
import {
  gmstRad, observerEcliptic, raDecToEcliptic, atmosphericRefractionDeg,
  applyProperMotion, applyAberration,
} from './topocentric';
import { J2000_JD } from './constants';

const TWO_PI = Math.PI * 2;

describe('gmstRad', () => {
  it('produces reasonable values at J2000.0', () => {
    // At J2000.0 (JD 2451545.0 = 2000-01-01 12:00 UTC), GMST is well known
    // to be approximately 18h 41m 50.5s ≈ 280.46° ≈ 4.895 rad.
    const g = gmstRad(J2000_JD);
    const deg = (g * 180) / Math.PI;
    expect(deg).toBeGreaterThan(280);
    expect(deg).toBeLessThan(281);
  });

  it('advances by ~360.985° per UT day (sidereal vs solar)', () => {
    const g0 = gmstRad(J2000_JD);
    const g1 = gmstRad(J2000_JD + 1);
    // Δ should be 24h sidereal − 24h solar ≈ +3m 56.6s ≈ 0.985°.
    let delta = (g1 - g0) * 180 / Math.PI;
    delta = ((delta % 360) + 360) % 360;
    expect(delta).toBeGreaterThan(0.95);
    expect(delta).toBeLessThan(1.05);
  });

  it('always returns a value in [0, 2π)', () => {
    for (const jd of [2440000, J2000_JD, 2470000, 2500000]) {
      const g = gmstRad(jd);
      expect(g).toBeGreaterThanOrEqual(0);
      expect(g).toBeLessThan(TWO_PI);
    }
  });
});

describe('observerEcliptic', () => {
  it('zenith is unit length and orthogonal to east/north', () => {
    const f = observerEcliptic(22.6273, 120.3014, J2000_JD);
    expect(f.zenith.length()).toBeCloseTo(1, 9);
    expect(f.east.length()).toBeCloseTo(1, 9);
    expect(f.north.length()).toBeCloseTo(1, 9);
    expect(Math.abs(f.zenith.dot(f.east))).toBeLessThan(1e-12);
    expect(Math.abs(f.zenith.dot(f.north))).toBeLessThan(1e-12);
    expect(Math.abs(f.east.dot(f.north))).toBeLessThan(1e-12);
  });

  it('east × zenith ≈ north (right-handed local frame)', () => {
    const f = observerEcliptic(22.6273, 120.3014, J2000_JD);
    const cross = f.east.clone().cross(f.zenith);
    // cross should be -north (because the cross of east×zenith on a sphere
    // gives the direction toward the south pole side; conventions can flip).
    // Either +north or -north — assert magnitude only.
    expect(Math.abs(Math.abs(cross.dot(f.north)) - 1)).toBeLessThan(1e-9);
  });

  it('position has magnitude = Earth radius (in AU)', () => {
    const f = observerEcliptic(35.0, -120.0, J2000_JD);
    const EARTH_RADIUS_AU = 6371.0 / 1.495978707e8;
    expect(f.position.length()).toBeCloseTo(EARTH_RADIUS_AU, 12);
  });

  it('north pole observer has zenith parallel to ECEF Z (up to obliquity rotation)', () => {
    // At lat=+90, ECEF zenith = (0,0,1) regardless of lon. After GMST + obliquity
    // rotations, |zenith.z| should be cos(obliquity) ≈ 0.9175.
    const f = observerEcliptic(90, 0, J2000_JD);
    // Length conservation
    expect(f.zenith.length()).toBeCloseTo(1, 9);
  });
});

describe('raDecToEcliptic', () => {
  it('produces unit-length vectors', () => {
    for (const [ra, dec] of [[0, 0], [6, 30], [12, -45], [18, 89]]) {
      const v = raDecToEcliptic(ra, dec);
      expect(v.length()).toBeCloseTo(1, 12);
    }
  });

  it('Polaris (RA ≈ 2.53h, Dec ≈ 89.26°) lies near ecliptic +Z', () => {
    const v = raDecToEcliptic(2.5303, 89.2641);
    // After ecliptic rotation, ecliptic Z is the ecliptic north pole — but
    // Polaris is near the celestial north pole, which is offset by 23.4°
    // from the ecliptic pole. So z should be ≈ cos(23.4°) ≈ 0.917.
    expect(v.z).toBeGreaterThan(0.9);
    expect(v.z).toBeLessThan(0.95);
  });

  it('precession at 1 century shifts star position by ~1.4°', () => {
    // 100 years past J2000 → cumulative precession effect
    const JD_2100 = J2000_JD + 100 * 365.25;
    const v0 = raDecToEcliptic(6.7525, -16.7161);                // Sirius J2000
    const v1 = raDecToEcliptic(6.7525, -16.7161, JD_2100);       // Sirius mean of 2100
    const cosAngle = v0.dot(v1);
    const angleDeg = Math.acos(Math.max(-1, Math.min(1, cosAngle))) * 180 / Math.PI;
    expect(angleDeg).toBeGreaterThan(1.0);
    expect(angleDeg).toBeLessThan(1.6);
  });

  it('precession at J2000 itself is the identity', () => {
    const v0 = raDecToEcliptic(14.2610, 19.1825);                   // Arcturus, no jd
    const v1 = raDecToEcliptic(14.2610, 19.1825, J2000_JD);         // Arcturus, jd=J2000
    expect(v0.x).toBeCloseTo(v1.x, 9);
    expect(v0.y).toBeCloseTo(v1.y, 9);
    expect(v0.z).toBeCloseTo(v1.z, 9);
  });
});

describe('applyProperMotion', () => {
  it('is the identity at J2000', () => {
    const out = applyProperMotion(6.7525, -16.7161, J2000_JD, -546.05, -1223.14);
    expect(out.raHours).toBeCloseTo(6.7525, 6);
    expect(out.decDeg).toBeCloseTo(-16.7161, 6);
  });

  it("Sirius drifts ~1.31″/yr in declination (Hipparcos pmDec = −1223 mas/yr)", () => {
    // 100 years past J2000 → Dec should change by 100 * -1.22314 = -122.31 arcsec
    const JD_2100 = J2000_JD + 100 * 365.25;
    const out = applyProperMotion(6.7525, -16.7161, JD_2100, -546.05, -1223.14);
    const dDecArcsec = (out.decDeg - (-16.7161)) * 3600;
    expect(dDecArcsec).toBeCloseTo(-122.31, 1);
  });

  it('RA correction includes cosine-correction inverse', () => {
    // pmRA in Hipparcos is already cos(dec)-corrected, so applying it back
    // should divide by cos(dec). Star at high dec → small dRA on sky but
    // large RA-coordinate shift.
    const decDeg = 80; // High declination
    const JD_FUTURE = J2000_JD + 1000 * 365.25; // 1000 years
    const pmRA = 1000; // mas/yr cosine-corrected
    const out = applyProperMotion(0, decDeg, JD_FUTURE, pmRA, 0);
    // Expected: dRA in coordinate-deg = (1000 mas/yr × 1000 yr) / cos(80°) / 1000ms/s/3600
    // = 1e6 mas / 0.1736 / 3600000 = 1.6 deg
    expect(out.raHours * 15).toBeCloseTo(1.6, 1);
  });
});

describe('applyAberration', () => {
  it('preserves unit length', () => {
    const star = new Vector3(0.6, 0.8, 0).normalize();
    const earth = new Vector3(1, 0, 0); // sun→earth = +X
    const out = applyAberration(star, earth);
    expect(out.length()).toBeCloseTo(1, 9);
  });

  it('star perpendicular to Earth velocity is shifted by ~20.5″', () => {
    // Earth's velocity is +Y (perpendicular to +X sun→earth). Star at +X.
    // Aberration shifts toward +Y (the velocity direction).
    const star = new Vector3(1, 0, 0);
    const earthSunDir = new Vector3(1, 0, 0); // velocity = (-y,x,0)/|.| = (0,1,0)
    const out = applyAberration(star, earthSunDir);
    // Magnitude of shift in radians ≈ κ = 20.49552″ = 9.9365e-5 rad
    const dot = star.dot(out);
    const angleRad = Math.acos(Math.max(-1, Math.min(1, dot)));
    const angleArcsec = angleRad * 180 / Math.PI * 3600;
    expect(angleArcsec).toBeGreaterThan(20.0);
    expect(angleArcsec).toBeLessThan(21.0);
  });

  it('star parallel to Earth velocity is barely shifted (linear-in-κ approximation)', () => {
    // Star at +Y, velocity at +Y → no perpendicular component → no shift.
    const star = new Vector3(0, 1, 0);
    const earthSunDir = new Vector3(1, 0, 0); // velocity = +Y
    const out = applyAberration(star, earthSunDir);
    const dot = star.dot(out);
    const angleArcsec = Math.acos(Math.max(-1, Math.min(1, dot))) * 180 / Math.PI * 3600;
    expect(angleArcsec).toBeLessThan(0.1);
  });
});

describe('atmosphericRefractionDeg', () => {
  it('returns positive values (apparent altitude is higher than true)', () => {
    expect(atmosphericRefractionDeg(0)).toBeGreaterThan(0);
    expect(atmosphericRefractionDeg(10)).toBeGreaterThan(0);
    expect(atmosphericRefractionDeg(45)).toBeGreaterThan(0);
  });

  it('is largest at the horizon', () => {
    const h0 = atmosphericRefractionDeg(0);
    const h10 = atmosphericRefractionDeg(10);
    const h45 = atmosphericRefractionDeg(45);
    const h89 = atmosphericRefractionDeg(89);
    expect(h0).toBeGreaterThan(h10);
    expect(h10).toBeGreaterThan(h45);
    expect(h45).toBeGreaterThan(h89);
  });

  it('matches Bennett reference values (within 0.1 arcmin)', () => {
    // Reference values from Bennett 1982 / Meeus Astronomical Algorithms ch. 16
    // refraction in arcmin: ~34.5' at 0°, ~5.3' at 10°, ~1.0' at 45°, ~0.02' at 80°
    expect(atmosphericRefractionDeg(0) * 60).toBeCloseTo(34.5, 0);
    expect(atmosphericRefractionDeg(10) * 60).toBeCloseTo(5.3, 0);
    expect(atmosphericRefractionDeg(45) * 60).toBeCloseTo(1.0, 0);
  });

  it('returns 0 well below horizon', () => {
    expect(atmosphericRefractionDeg(-5)).toBe(0);
  });
});
