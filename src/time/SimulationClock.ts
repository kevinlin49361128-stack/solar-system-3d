import { jdFromDate, dateFromJd, J2000_JD } from '../physics/constants';

type Listener = (jd: number) => void;

/**
 * Central simulation clock. Internal time unit is Julian Date (JD).
 *
 * Time advances by `realDeltaSeconds * speedSecondsPerSecond / 86400` JD per
 * frame. Speed is in *simulated seconds per real second*; e.g. speed = 86400
 * means one simulated day passes per real second.
 */
export class SimulationClock {
  private jd: number;
  private speed: number = 86400; // 1 day per real second
  private playing: boolean = true;
  private listeners: Set<Listener> = new Set();

  constructor(initialDate?: Date) {
    this.jd = initialDate ? jdFromDate(initialDate) : J2000_JD;
  }

  tick(realDeltaSeconds: number): void {
    if (!this.playing) return;
    this.jd += (realDeltaSeconds * this.speed) / 86400;
    this.notify();
  }

  getJd(): number { return this.jd; }
  setJd(jd: number): void { this.jd = jd; this.notify(); }

  getDate(): Date { return dateFromJd(this.jd); }
  setDate(date: Date): void { this.setJd(jdFromDate(date)); }

  getSpeed(): number { return this.speed; }
  setSpeed(secondsPerSecond: number): void { this.speed = secondsPerSecond; }

  isPlaying(): boolean { return this.playing; }
  pause(): void { this.playing = false; }
  play(): void { this.playing = true; }
  toggle(): void { this.playing = !this.playing; }
  reverse(): void { this.speed = -this.speed; }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private notify(): void {
    for (const fn of this.listeners) fn(this.jd);
  }
}
