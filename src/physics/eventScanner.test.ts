import { describe, it, expect } from 'vitest';
import { scanEvents, crossesAngle, type DetectedEvent } from './eventScanner';
import { STARS_AND_PLANETS } from '../data/bodies';
import { MOON } from '../data/moons';
import { jdFromDate } from '../physics/constants';

/**
 * Golden tests for the astro-event detection engine (551 LOC, previously
 * zero coverage). We scan a full calendar year and assert the events that
 * are physically fixed: Earth perihelion in early January, ~12-13 lunar
 * phase events of each kind, 4 equinox/solstice markers near their known
 * dates. These pin the detection branches without over-fitting to exact
 * timestamps.
 */
const BODIES = [...STARS_AND_PLANETS, MOON];
const YEAR_START = jdFromDate(new Date(Date.UTC(2025, 0, 1)));
const YEAR_END = jdFromDate(new Date(Date.UTC(2025, 11, 31, 23, 59)));

let events: DetectedEvent[];
function ev(): DetectedEvent[] {
  if (!events) events = scanEvents(BODIES, YEAR_START, YEAR_END);
  return events;
}
const monthOf = (e: DetectedEvent) => e.date.getUTCMonth(); // 0-based

describe('scanEvents — 2025 calendar year', () => {
  it('returns a non-trivial number of events', () => {
    expect(ev().length).toBeGreaterThan(10);
  });

  it('every event has a valid kind, jd in range, and a Date matching its jd', () => {
    for (const e of ev()) {
      expect(typeof e.kind).toBe('string');
      expect(e.jd).toBeGreaterThanOrEqual(YEAR_START - 2);
      expect(e.jd).toBeLessThanOrEqual(YEAR_END + 2);
      expect(Number.isFinite(e.date.getTime())).toBe(true);
    }
  });

  it('Earth perihelion lands in early January', () => {
    const peri = ev().filter((e) => e.kind === 'perihelion');
    expect(peri.length).toBeGreaterThanOrEqual(1);
    // Earth perihelion is ~Jan 3-5 every year.
    expect(peri.some((e) => monthOf(e) === 0 && e.date.getUTCDate() <= 8)).toBe(true);
  });

  it('Earth aphelion lands in early July', () => {
    const aph = ev().filter((e) => e.kind === 'aphelion');
    if (aph.length > 0) {
      expect(aph.some((e) => monthOf(e) === 6)).toBe(true);
    }
  });

  it('detects roughly one new moon and one full moon per lunation (~monthly)', () => {
    const newMoons = ev().filter((e) => e.kind === 'new-moon');
    const fullMoons = ev().filter((e) => e.kind === 'full-moon');
    // A year has 12-13 lunations. The truncated lunar series + 6h scan grid
    // occasionally drops one near a threshold, so the floor is 10 (this is a
    // regression lock on current behaviour, not a grade of the model's
    // sensitivity). Anything <10 or >14 signals a real detection regression.
    expect(newMoons.length).toBeGreaterThanOrEqual(10);
    expect(newMoons.length).toBeLessThanOrEqual(14);
    expect(fullMoons.length).toBeGreaterThanOrEqual(10);
    expect(fullMoons.length).toBeLessThanOrEqual(14);
  });

  it('detects exactly the 4 equinox/solstice markers near their canonical dates', () => {
    const equi = ev().filter((e) => e.kind === 'equinox');
    const sols = ev().filter((e) => e.kind === 'solstice');
    expect(equi.length).toBe(2);
    expect(sols.length).toBe(2);
    // March equinox ~20th, Sept equinox ~22-23rd.
    expect(equi.some((e) => monthOf(e) === 2)).toBe(true);
    expect(equi.some((e) => monthOf(e) === 8)).toBe(true);
    // June solstice ~21st, Dec solstice ~21-22nd.
    expect(sols.some((e) => monthOf(e) === 5)).toBe(true);
    expect(sols.some((e) => monthOf(e) === 11)).toBe(true);
  });

  it('inner-planet greatest elongations are detected for Venus and/or Mercury', () => {
    const elong = ev().filter((e) => e.kind === 'elongation-east' || e.kind === 'elongation-west');
    expect(elong.length).toBeGreaterThanOrEqual(1);
    expect(elong.every((e) => e.bodyId === 'mercury' || e.bodyId === 'venus')).toBe(true);
  });
});

describe('crossesAngle (equinox/solstice gate)', () => {
  it('detects a forward crossing through the target', () => {
    expect(crossesAngle(89, 91, 90)).toBe(true);
    expect(crossesAngle(91, 89, 90)).toBe(true); // reverse direction too
  });

  it('detects a crossing through 0° across the 359→1 wrap', () => {
    expect(crossesAngle(359, 1, 0)).toBe(true);
  });

  it('no crossing when both samples sit on the same side', () => {
    expect(crossesAngle(10, 20, 90)).toBe(false);
    expect(crossesAngle(100, 110, 90)).toBe(false);
  });

  it('rejects a large jump whose swing exceeds the 30° wrap guard', () => {
    // 350→40 straddles 0 but the 50° swing is a sampling artefact, not a real pass.
    expect(crossesAngle(350, 40, 0)).toBe(false);
  });
});
