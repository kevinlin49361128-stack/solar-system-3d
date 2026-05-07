import { describe, it, expect } from 'vitest';
import { computeTonightPlan, type TonightPlanInput } from './tonightPlan';

/**
 * Helper — fabricate a `getStarAltAz` and `getBodyAltAz` that put every
 * target at a fixed altitude/azimuth so we can test ranking + filtering
 * without spinning up the real topocentric pipeline.
 */
function makeInput(opts: {
  altDeg?: number;
  sunAltDeg?: number;
  moonAltDeg?: number;
  moonPhase?: number;
  bortle?: number;
} = {}): TonightPlanInput {
  return {
    getStarAltAz: () => ({ altDeg: opts.altDeg ?? 60, azDeg: 180 }),
    getBodyAltAz: (id) => {
      // Sun and moon get explicit altitudes from input
      if (id === 'sun') return { altDeg: opts.sunAltDeg ?? -30, azDeg: 0 };
      if (id === 'moon') return { altDeg: opts.moonAltDeg ?? -20, azDeg: 90 };
      // Other bodies: pretend they're at the same altitude as stars
      return { altDeg: opts.altDeg ?? 60, azDeg: 180 };
    },
    sunAltDeg: opts.sunAltDeg ?? -30,
    moonAltDeg: opts.moonAltDeg ?? -20,
    moonAzDeg: 90,
    moonPhase: opts.moonPhase ?? 0,
    bortle: opts.bortle ?? 3,
  };
}

describe('computeTonightPlan', () => {
  it('returns three categories', () => {
    const plan = computeTonightPlan(makeInput());
    expect(plan).toHaveProperty('planets');
    expect(plan).toHaveProperty('messier');
    expect(plan).toHaveProperty('stars');
  });

  it('dark site at midnight: rich star + Messier list', () => {
    const plan = computeTonightPlan(makeInput({ bortle: 3, sunAltDeg: -30 }));
    expect(plan.stars.length).toBeGreaterThan(5);
    expect(plan.messier.length).toBeGreaterThan(0);
  });

  it('inner-city Bortle 9 has fewer "good" Messier than Bortle 1', () => {
    const dark = computeTonightPlan(makeInput({ bortle: 1 }));
    const city = computeTonightPlan(makeInput({ bortle: 9 }));
    const goodDark = dark.messier.filter(e => e.rating === 'good').length;
    const goodCity = city.messier.filter(e => e.rating === 'good').length;
    expect(goodCity).toBeLessThan(goodDark);
  });

  it('daytime sun above horizon kills the deep-sky list', () => {
    const plan = computeTonightPlan(makeInput({ sunAltDeg: 30 }));
    // Bright stars near horizon may still survive for planets, but DSO
    // and faint stars should drop out.
    expect(plan.messier.length).toBe(0);
  });

  it('all targets below horizon → empty lists', () => {
    const plan = computeTonightPlan(makeInput({ altDeg: -10 }));
    expect(plan.planets.length).toBe(0);
    expect(plan.messier.length).toBe(0);
    expect(plan.stars.length).toBe(0);
  });

  it('Messier list capped at 15 entries even in pristine conditions', () => {
    const plan = computeTonightPlan(makeInput({ bortle: 1, altDeg: 75 }));
    expect(plan.messier.length).toBeLessThanOrEqual(15);
  });

  it('sorts entries by rating (best first), then altitude (high first)', () => {
    const plan = computeTonightPlan(makeInput());
    // Within stars, ratings should be non-increasing
    const ratings = plan.stars.map(e =>
      e.rating === 'good' ? 3 : e.rating === 'marginal' ? 2 : e.rating === 'poor' ? 1 : 0
    );
    for (let i = 1; i < ratings.length; i++) {
      expect(ratings[i]).toBeLessThanOrEqual(ratings[i - 1]);
    }
  });

  it('every entry has the required fields populated', () => {
    const plan = computeTonightPlan(makeInput());
    const all = [...plan.planets, ...plan.messier, ...plan.stars];
    for (const e of all) {
      expect(e.id).toBeTruthy();
      expect(e.name).toBeTruthy();
      expect(e.nameEn).toBeTruthy();
      expect(Number.isFinite(e.altDeg)).toBe(true);
      expect(Number.isFinite(e.azDeg)).toBe(true);
      expect(['good', 'marginal', 'poor', 'invisible']).toContain(e.rating);
    }
  });
});
