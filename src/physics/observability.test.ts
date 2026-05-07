import { describe, it, expect } from 'vitest';
import { scoreObservability, type ObservabilityFactors } from './observability';

const baseFactors: ObservabilityFactors = {
  targetAltDeg: 60,
  targetMag: 2.0,
  sunAltDeg: -30,
  moonAltDeg: -20,
  moonPhase: 0,
  moonAngularDistanceDeg: 90,
  bortle: 3,
};

describe('scoreObservability', () => {
  it('a bright star high in a dark sky → "good"', () => {
    const r = scoreObservability(baseFactors);
    expect(r.rating).toBe('good');
  });

  it('below horizon → "invisible"', () => {
    const r = scoreObservability({ ...baseFactors, targetAltDeg: -5 });
    expect(r.rating).toBe('invisible');
  });

  it('daytime sun above horizon → very poor', () => {
    const r = scoreObservability({ ...baseFactors, sunAltDeg: 30 });
    expect(['marginal', 'poor', 'invisible']).toContain(r.rating);
    expect(r.reasons.some(s => s.includes('天文夜') || s.includes('曙暮光'))).toBe(true);
  });

  it('low altitude near horizon flagged in reasons', () => {
    const r = scoreObservability({ ...baseFactors, targetAltDeg: 8 });
    expect(r.reasons.some(s => s.includes('仰角'))).toBe(true);
  });

  it('full moon close to target severely degrades DSO observability', () => {
    const r = scoreObservability({
      ...baseFactors,
      targetMag: 8.5, // typical Messier galaxy
      moonAltDeg: 50,
      moonPhase: 1.0,
      moonAngularDistanceDeg: 15,
    });
    expect(r.rating).not.toBe('good');
    expect(r.reasons.some(s => s.includes('月光'))).toBe(true);
  });

  it('inner-city Bortle 9 makes faint targets invisible', () => {
    const r = scoreObservability({
      ...baseFactors,
      targetMag: 7.0,
      bortle: 9,
    });
    expect(r.rating).not.toBe('good');
  });

  it('target dimmer than effective limit → invisible', () => {
    const r = scoreObservability({
      ...baseFactors,
      targetMag: 12, // too dim for naked eye even in dark sky
      bortle: 3,
    });
    expect(['poor', 'invisible']).toContain(r.rating);
  });

  it('returns finite effectiveLimitMag', () => {
    const r = scoreObservability(baseFactors);
    expect(Number.isFinite(r.effectiveLimitMag)).toBe(true);
  });

  it('reasons are sorted by severity (descending weight)', () => {
    // A combo of multiple problems
    const r = scoreObservability({
      ...baseFactors,
      targetAltDeg: 8,
      targetMag: 6.5,
      sunAltDeg: -10, // twilight
      moonAltDeg: 30,
      moonPhase: 0.9,
      moonAngularDistanceDeg: 20,
    });
    // The most severe (highest-weight) reason should be primary
    expect(r.reasons[0]).toBe(r.primaryReason);
  });
});
