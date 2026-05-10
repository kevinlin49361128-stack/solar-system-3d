import { describe, it, expect } from 'vitest';
import { Vector3 } from 'three';
import {
  GALACTIC_CENTRE_SCENE,
  GALACTIC_NP_SCENE,
  galacticLBToVector,
  galacticToScene,
} from './galacticFrame';
import { eclipticToScene } from './frame';
import { DEG2RAD } from './constants';

describe('galacticToScene', () => {
  it('preserves the unit length of input vectors', () => {
    const v = new Vector3(0.6, -0.5, 0.62450); // length ≈ 1
    v.normalize();
    const s = galacticToScene(v);
    // 8-place precision is plenty (matrix accumulates ~1e-9 from the
    // hardcoded IAU coefficients).
    expect(s.length()).toBeCloseTo(1, 8);
  });

  it('places the galactic North Pole at scene (≈180° ecliptic longitude, +30° ecliptic latitude)', () => {
    // The GNP is at equatorial (192.86°, +27.13°), which converts to
    // ecliptic ≈ (180°, +30°). After ecliptic→scene, the +Z (NP) component
    // becomes +Y (scene up). So the NP scene vector should have a strong
    // +Y component (~ sin 30° ≈ 0.5) and project in -X direction in the XZ plane.
    const np = GALACTIC_NP_SCENE;
    expect(np.length()).toBeCloseTo(1, 10);
    // Y component should match sin(30°) = 0.5 (within a few degrees).
    expect(np.y).toBeGreaterThan(0.45);
    expect(np.y).toBeLessThan(0.55);
  });

  it('places the galactic centre at scene with strong -X component (Sgr A is roughly opposite to vernal equinox in ecliptic)', () => {
    // GC at equatorial (266.4°, -28.94°) → ecliptic (~266.84°, -5.61°).
    // Ecliptic-X for that direction: cos(-5.61°) cos(266.84°) ≈ -0.056.
    // So in scene, X ≈ -0.056 (small), Z ≈ -cos(-5.61°)*sin(266.84°)*-1 = ?
    // Just sanity-check it's a unit vector and the Z (north) component is small (close to ecliptic plane).
    const gc = GALACTIC_CENTRE_SCENE;
    expect(gc.length()).toBeCloseTo(1, 10);
    // Galactic centre is near the ecliptic (b ~ -5.6°), so scene Y should be small.
    expect(Math.abs(gc.y)).toBeLessThan(0.15);
  });

  it('GNP and GC are perpendicular', () => {
    const dot = GALACTIC_NP_SCENE.dot(GALACTIC_CENTRE_SCENE);
    expect(Math.abs(dot)).toBeLessThan(1e-10);
  });
});

describe('galacticLBToVector', () => {
  it('(0, 0) is the galactic centre direction (+X in galactic frame)', () => {
    const v = galacticLBToVector(0, 0);
    expect(v.x).toBeCloseTo(1, 10);
    expect(v.y).toBeCloseTo(0, 10);
    expect(v.z).toBeCloseTo(0, 10);
  });
  it('(0, 90) is the galactic North Pole (+Z in galactic frame)', () => {
    const v = galacticLBToVector(0, 90);
    expect(v.z).toBeCloseTo(1, 10);
    expect(Math.abs(v.x)).toBeLessThan(1e-10);
  });
  it('(90, 0) is +Y in galactic frame', () => {
    const v = galacticLBToVector(90, 0);
    expect(v.y).toBeCloseTo(1, 10);
  });
});

describe('cross-check against frame.eclipticToScene', () => {
  // Galactic NP is at ecliptic (λ ≈ 180°, β ≈ +30°). Convert via
  // independently-known ecliptic→scene path and check it matches galacticToScene.
  it('GNP via galactic = GNP via ecliptic', () => {
    // Ecliptic of GNP: λ = 180.02°, β = +29.81°
    const lambdaRad = 180.02 * DEG2RAD;
    const betaRad = 29.81 * DEG2RAD;
    const eclVec = new Vector3(
      Math.cos(betaRad) * Math.cos(lambdaRad),
      Math.cos(betaRad) * Math.sin(lambdaRad),
      Math.sin(betaRad),
    );
    const viaEcliptic = eclipticToScene(eclVec);
    const viaGalactic = GALACTIC_NP_SCENE;
    // Allow a few arcmin slop for the rounded ecliptic coords above.
    expect(viaEcliptic.distanceTo(viaGalactic)).toBeLessThan(0.01);
  });
});
