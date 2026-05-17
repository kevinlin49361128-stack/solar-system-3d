import { describe, it, expect } from 'vitest';
import { iauPoleToSceneDir } from './iauPole';

/**
 * IAU WGCCRE 2015 pole orientations for the planets we apply this to
 * (Jupiter + Saturn). The conversion goes:
 *   equatorial RA/Dec → ecliptic 3-vec (rotate by -ε around X)
 *   → scene 3-vec (x stays, y becomes z, z becomes -y)
 *
 * Sanity checks:
 *   - Output is a unit vector
 *   - Earth pole (~0°, +90°) maps to scene-Y dominated (close to ecliptic
 *     north tilted by obliquity = ~23.4° from scene-Y toward scene-X)
 *   - Jupiter pole (~268°, +64.5°) tilts only 3° from ecliptic normal
 *   - Saturn pole (~40.6°, +83.5°) tilts 26.7° from ecliptic normal
 */
describe('iauPoleToSceneDir', () => {
  const len = (v: { x: number; y: number; z: number }) =>
    Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);

  it('always returns a unit vector', () => {
    for (const [ra, dec] of [[0, 0], [180, 45], [268, 64.5], [40.6, 83.5], [0, 90], [0, -90]]) {
      const v = iauPoleToSceneDir(ra, dec);
      expect(len(v)).toBeCloseTo(1, 6);
    }
  });

  it('Earth pole (Dec=+90°) maps near the ecliptic-north direction tilted by obliquity', () => {
    // Equatorial north pole is at the geographic pole — tilted from
    // ecliptic north by Earth's obliquity (23.44°). In scene frame
    // (y = ecliptic-z), the pole vector should be:
    //   tilt 23.44° from +Y toward +Z direction (because ε is positive
    //   and our transform puts ecliptic-Y onto scene-(-Z), and equatorial
    //   pole sits at higher ecliptic latitude than ecliptic pole on the
    //   side of the autumnal equinox).
    const v = iauPoleToSceneDir(0, 90);
    // y dominates (close to +1, tilted by ε)
    expect(v.y).toBeGreaterThan(0.9);
    // Off-axis tilt magnitude ~sin(ε) = 0.397
    const offAxis = Math.sqrt(v.x * v.x + v.z * v.z);
    expect(offAxis).toBeGreaterThan(0.35);
    expect(offAxis).toBeLessThan(0.45);
  });

  it('Saturn pole sits ~26.7° from ecliptic normal (sin(26.7°)=0.449)', () => {
    const v = iauPoleToSceneDir(40.589, 83.537);
    // Pole tilt = arccos(v.y) since scene-Y is the ecliptic normal.
    const tiltDeg = Math.acos(Math.max(-1, Math.min(1, v.y))) * 180 / Math.PI;
    // Saturn's spin axis is tilted 26.73° from its orbit plane (≈ ecliptic
    // for these purposes). Allow ±1° for the small ecliptic-to-Saturn-
    // orbit inclination contribution.
    expect(Math.abs(tiltDeg - 26.73)).toBeLessThan(2);
  });

  it('Jupiter pole sits ~3.1° from ecliptic normal', () => {
    const v = iauPoleToSceneDir(268.057, 64.495);
    const tiltDeg = Math.acos(Math.max(-1, Math.min(1, v.y))) * 180 / Math.PI;
    expect(Math.abs(tiltDeg - 3.13)).toBeLessThan(2);
  });
});
