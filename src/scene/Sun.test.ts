import { describe, it, expect } from 'vitest';
import { solarLimbBrightness, SOLAR_LIMB_U1, SOLAR_LIMB_U2 } from './Sun';

/**
 * Pierce-Slaughter 1977 V-band coefficients applied as:
 *   I(μ)/I(1) = 1 - u₁·(1-μ) - u₂·(1-μ)²
 *
 * Anchors the formula against published numbers; if anyone tweaks the
 * coefficients the test pins down the visual contract.
 */
describe('solarLimbBrightness', () => {
  it('returns 1.0 exactly at disc centre (μ = 1)', () => {
    expect(solarLimbBrightness(1)).toBe(1);
  });

  it('returns ~0.30 at the limb (μ = 0) — published V-band value', () => {
    // 1 - 0.93·1 - (-0.23)·1 = 1 - 0.93 + 0.23 = 0.30
    expect(solarLimbBrightness(0)).toBeCloseTo(1 - SOLAR_LIMB_U1 - SOLAR_LIMB_U2, 6);
    expect(solarLimbBrightness(0)).toBeCloseTo(0.30, 2);
  });

  it('is monotonically increasing from limb to centre', () => {
    let prev = solarLimbBrightness(0);
    for (let mu = 0.05; mu <= 1; mu += 0.05) {
      const cur = solarLimbBrightness(mu);
      expect(cur).toBeGreaterThanOrEqual(prev - 1e-12);
      prev = cur;
    }
  });

  it('clamps gracefully outside [0, 1] inputs', () => {
    // Negative μ — caller shouldn't pass it (limb is at μ=0) but a stray
    // negative shouldn't NaN. Should clamp to limb value (μ treated as 0).
    expect(solarLimbBrightness(-0.5)).toBeCloseTo(solarLimbBrightness(0), 6);
    expect(solarLimbBrightness(1.5)).toBeCloseTo(solarLimbBrightness(1), 6);
  });

  it('at μ = 0.5 is intermediate between centre and limb', () => {
    const half = solarLimbBrightness(0.5);
    expect(half).toBeGreaterThan(solarLimbBrightness(0));
    expect(half).toBeLessThan(1);
    // Closed-form: 1 - 0.93·0.5 - (-0.23)·0.25 = 1 - 0.465 + 0.0575 = 0.5925
    expect(half).toBeCloseTo(0.5925, 3);
  });
});
