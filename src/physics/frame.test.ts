import { describe, it, expect } from 'vitest';
import { Vector3 } from 'three';
import { eclipticToScene } from './frame';

describe('eclipticToScene', () => {
  it('keeps +X invariant (vernal equinox stays the X axis)', () => {
    const v = eclipticToScene(new Vector3(1, 0, 0));
    expect(v.x).toBeCloseTo(1, 12);
    expect(v.y).toBeCloseTo(0, 12);
    expect(v.z).toBeCloseTo(0, 12);
  });

  it('maps ecliptic +Z (north pole) to scene +Y', () => {
    const v = eclipticToScene(new Vector3(0, 0, 1));
    expect(v.x).toBeCloseTo(0, 12);
    expect(v.y).toBeCloseTo(1, 12);
    expect(v.z).toBeCloseTo(0, 12);
  });

  it('maps ecliptic +Y (90° east) to scene -Z', () => {
    const v = eclipticToScene(new Vector3(0, 1, 0));
    expect(v.x).toBeCloseTo(0, 12);
    expect(v.y).toBeCloseTo(0, 12);
    expect(v.z).toBeCloseTo(-1, 12);
  });

  it('preserves vector length (rotation is isometric)', () => {
    for (const v of [new Vector3(3, 4, 0), new Vector3(1, 2, 3), new Vector3(-5, 1, 7)]) {
      const w = eclipticToScene(v);
      expect(w.length()).toBeCloseTo(v.length(), 9);
    }
  });

  it('does not mutate the input', () => {
    const input = new Vector3(0.5, 0.5, 0.5);
    const out = eclipticToScene(input);
    expect(input.x).toBe(0.5);
    expect(input.y).toBe(0.5);
    expect(input.z).toBe(0.5);
    // out should be a different vector reference
    expect(out).not.toBe(input);
  });
});
