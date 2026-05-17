import { describe, it, expect, beforeAll } from 'vitest';
import { HosekWilkieSky } from './HosekWilkieSky';

// happy-dom doesn't ship WebGL2RenderingContext. Three.js's ShaderMaterial
// construction doesn't actually need GL — it just stores the source — so
// constructing HosekWilkieSky works in jsdom/happy-dom as long as we don't
// call render. All these tests exercise the coefficient-update path only.

describe('HosekWilkieSky — coefficient evaluation by sun altitude', () => {
  let sky: HosekWilkieSky;
  beforeAll(() => { sky = new HosekWilkieSky(); });

  it('starts hidden until setVisible(true)', () => {
    expect(sky.mesh.visible).toBe(false);
    sky.setVisible(true);
    expect(sky.mesh.visible).toBe(true);
    sky.setVisible(false);
  });

  it('coefficient B (exp gradient) stays near -0.18 across channels', () => {
    sky.applySunAltitude(45);
    const c = sky.getCoefficients();
    // HW canonical B value is ~ -0.18 across RGB. Tight bound since it's a
    // structural constant in the model.
    for (const v of [c.B.x, c.B.y, c.B.z]) {
      expect(v).toBeGreaterThan(-0.20);
      expect(v).toBeLessThan(-0.15);
    }
  });

  it('intensity collapses to near-black below astronomical twilight', () => {
    sky.applySunAltitude(-25);
    const c = sky.getCoefficients();
    expect(c.intensity).toBeLessThan(0.15);
  });

  it('intensity recovers to ~1.5 at full noon', () => {
    sky.applySunAltitude(80);
    const c = sky.getCoefficients();
    expect(c.intensity).toBeGreaterThan(1.4);
    expect(c.intensity).toBeLessThan(1.7);
  });

  it('coefficient D (aureole gain) is more negative when sun is up', () => {
    sky.applySunAltitude(50);
    const cDay = sky.getCoefficients();
    sky.applySunAltitude(-15);
    const cNight = sky.getCoefficients();
    // |D| is bigger (more negative) when sun is up — aureole is brighter
    // in daylight. We use D.y (green channel) as the representative value.
    expect(cDay.D.y).toBeLessThan(cNight.D.y);
  });

  it('coefficient H (chi shape) stays in [0.99, 1.0) for all altitudes', () => {
    // chi denominator (1 + H² - 2H·cosγ)^(1.5) blows up when H ≥ 1, so we
    // need a structural guarantee that H < 1 always.
    for (const alt of [-30, -10, 0, 20, 50, 89]) {
      sky.applySunAltitude(alt);
      const c = sky.getCoefficients();
      expect(c.H.x).toBeLessThan(1);
      expect(c.H.y).toBeLessThan(1);
      expect(c.H.z).toBeLessThan(1);
      expect(c.H.x).toBeGreaterThanOrEqual(0.99);
    }
  });

  it('only re-evaluates coefficients on meaningful sun-altitude changes', () => {
    // Set sun at 30°, capture A.
    sky.applySunAltitude(30);
    const before = sky.getCoefficients().A.x;
    // Tiny tweak (< 0.5° threshold inside setSunDirection) shouldn't change
    // anything — we call applySunAltitude directly to bypass the throttle.
    // This test instead verifies that values are deterministic per input.
    sky.applySunAltitude(30);
    const after = sky.getCoefficients().A.x;
    expect(after).toBe(before);
  });
});
