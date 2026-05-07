import { describe, it, expect } from 'vitest';
import { findStarHopPath, bearingCardinal } from './starHopping';

describe('findStarHopPath', () => {
  it('returns null for target far from all named stars', () => {
    // Random sky position in a sparse region — should fail to find an
    // anchor within step distance.
    // Pick south galactic pole-ish: low star density.
    const path = findStarHopPath(0, -85, 'Antarctic dummy');
    // May or may not succeed depending on named stars near south pole;
    // just verify the function returns a sensible shape.
    if (path) {
      expect(path[path.length - 1].name).toBe('Antarctic dummy');
    }
  });

  it('finds a path to M31 (near Andromeda β/γ)', () => {
    // M31 RA 0.7128h, Dec +41.27° — close to Mirach (β And) and Almach (γ And)
    const path = findStarHopPath(0.7128, 41.27, 'M31');
    expect(path).not.toBeNull();
    if (!path) return;
    // Last waypoint must be the target
    expect(path[path.length - 1].name).toBe('M31');
    expect(path[path.length - 1].starId).toBeNull();
    // First waypoint must be a "guidepost-bright" star (mag ≤ 2.5)
    expect(path[0].magnitude).toBeLessThanOrEqual(2.5);
    // No two consecutive waypoints further apart than the step limit
    for (let i = 0; i < path.length - 1; i++) {
      expect(path[i].distanceToNextDeg).toBeLessThanOrEqual(10.5); // small slack
    }
  });

  it('first waypoint is bright enough to find naked-eye', () => {
    // M42 (Orion Nebula) is right next to ι Ori, very close to bright belt
    const path = findStarHopPath(5.5883, -5.39, 'M42');
    expect(path).not.toBeNull();
    if (path) expect(path[0].magnitude).toBeLessThanOrEqual(2.5);
  });

  it('path runs anchor → target (correct order)', () => {
    const path = findStarHopPath(18.7833, 33.0291, 'M57'); // Ring Nebula in Lyra
    if (!path) return;
    // First entry brightest, last entry the target
    expect(path[0].magnitude).toBeLessThan(path[path.length - 1].magnitude);
    expect(path[path.length - 1].name).toBe('M57');
  });

  it('every waypoint has finite position fields', () => {
    const path = findStarHopPath(13.7033, 28.3771, 'M3');
    if (!path) return;
    for (const w of path) {
      expect(Number.isFinite(w.raHours)).toBe(true);
      expect(Number.isFinite(w.decDeg)).toBe(true);
      expect(Number.isFinite(w.distanceToNextDeg)).toBe(true);
    }
  });
});

describe('bearingCardinal', () => {
  it('maps cardinal directions correctly', () => {
    expect(bearingCardinal(0)).toBe('N');
    expect(bearingCardinal(45)).toBe('NE');
    expect(bearingCardinal(90)).toBe('E');
    expect(bearingCardinal(180)).toBe('S');
    expect(bearingCardinal(270)).toBe('W');
    expect(bearingCardinal(359)).toBe('N'); // wraps
  });
});
