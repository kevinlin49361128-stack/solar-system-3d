import { describe, it, expect } from 'vitest';
import { SimulationClock } from './SimulationClock';
import { J2000_JD, jdFromDate, dateFromJd } from '../physics/constants';

/**
 * SimulationClock drives every frame via tick() in the render loop. Its
 * branches (pause, reverse, notify-on-set) are exactly the kind a refactor
 * could silently break, so they get pinned here. Pure, no DOM.
 */
describe('SimulationClock', () => {
  it('defaults to J2000 epoch with no initial date', () => {
    expect(new SimulationClock().getJd()).toBe(J2000_JD);
  });

  it('seeds from an initial Date', () => {
    const d = new Date(Date.UTC(2030, 0, 1, 12, 0, 0));
    expect(new SimulationClock(d).getJd()).toBeCloseTo(jdFromDate(d), 9);
  });

  it('tick advances exactly speed×dt/86400 JD at default speed (86400 = 1 day/s)', () => {
    const c = new SimulationClock(new Date(Date.UTC(2000, 0, 1, 12)));
    const j0 = c.getJd();
    c.tick(1); // 1 real second × 86400 sim-s/s ÷ 86400 = +1 day
    expect(c.getJd() - j0).toBeCloseTo(1, 9);
    c.tick(0.5);
    expect(c.getJd() - j0).toBeCloseTo(1.5, 9);
  });

  it('a paused clock does not advance and does not notify', () => {
    const c = new SimulationClock();
    let calls = 0;
    c.subscribe(() => calls++);
    c.pause();
    const j0 = c.getJd();
    c.tick(10);
    expect(c.getJd()).toBe(j0);
    expect(calls).toBe(0);
  });

  it('play resumes advancing after pause', () => {
    const c = new SimulationClock();
    c.pause(); c.tick(1);
    c.play(); const j0 = c.getJd(); c.tick(1);
    expect(c.getJd() - j0).toBeCloseTo(1, 9);
  });

  it('toggle flips playing state', () => {
    const c = new SimulationClock();
    expect(c.isPlaying()).toBe(true);
    c.toggle(); expect(c.isPlaying()).toBe(false);
    c.toggle(); expect(c.isPlaying()).toBe(true);
  });

  it('reverse negates direction; twice restores forward', () => {
    const c = new SimulationClock(new Date(Date.UTC(2000, 0, 1, 12)));
    const j0 = c.getJd();
    c.reverse(); c.tick(1);
    expect(c.getJd() - j0).toBeCloseTo(-1, 9); // went backward one day
    c.reverse(); c.tick(1);
    expect(c.getJd() - j0).toBeCloseTo(0, 9);  // back to start
  });

  it('setSpeed changes the per-second rate', () => {
    const c = new SimulationClock(new Date(Date.UTC(2000, 0, 1, 12)));
    c.setSpeed(3600); // 1 hour per real second
    const j0 = c.getJd();
    c.tick(1);
    expect(c.getJd() - j0).toBeCloseTo(1 / 24, 9);
  });

  it('subscribe fires on setJd/setDate with the new JD; unsubscribe stops it', () => {
    const c = new SimulationClock();
    const seen: number[] = [];
    const off = c.subscribe((jd) => seen.push(jd));
    c.setJd(2460000.5);
    expect(seen.at(-1)).toBe(2460000.5);
    const d = new Date(Date.UTC(2025, 5, 1));
    c.setDate(d);
    expect(seen.at(-1)).toBeCloseTo(jdFromDate(d), 9);
    off();
    c.setJd(123);
    expect(seen.at(-1)).not.toBe(123); // no further calls after unsubscribe
  });

  it('getDate/setDate round-trip through JD', () => {
    const c = new SimulationClock();
    const d = new Date(Date.UTC(2027, 8, 15, 6, 30, 0));
    c.setDate(d);
    expect(c.getDate().getTime()).toBeCloseTo(d.getTime(), -1); // within ~10ms
  });
});

/**
 * jd<->date conversion underpins the clock and all 16 event timestamps.
 * The code is correct now; these lock it so a tweak to the epoch offset or
 * ms/day arithmetic can't silently corrupt every displayed date.
 */
describe('jdFromDate / dateFromJd', () => {
  it('J2000_JD is the 2000-01-01T12:00Z anchor', () => {
    expect(dateFromJd(J2000_JD).toISOString()).toBe('2000-01-01T12:00:00.000Z');
    expect(jdFromDate(new Date('2000-01-01T12:00:00.000Z'))).toBeCloseTo(J2000_JD, 9);
  });

  it('round-trips for several JDs to ~1e-6 day', () => {
    for (const jd of [2451545.0, 2400000.5, 2460000.0, 2469807.25, 2415020.5]) {
      expect(jdFromDate(dateFromJd(jd))).toBeCloseTo(jd, 6);
    }
  });

  it('the Unix epoch is JD 2440587.5', () => {
    expect(jdFromDate(new Date(0))).toBeCloseTo(2440587.5, 9);
  });
});
