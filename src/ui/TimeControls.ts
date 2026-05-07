import type { SimulationClock } from '../time/SimulationClock';
import { deltaTSeconds, jdToDecimalYear } from '../physics/timeScales';

export class TimeControls {
  private readonly btnPause: HTMLButtonElement;
  private readonly btnReverse: HTMLButtonElement;
  private readonly btnNow: HTMLButtonElement;
  private readonly speedSelect: HTMLSelectElement;
  private readonly dateInput: HTMLInputElement;
  private readonly dateDisplay: HTMLElement;
  private readonly deltaTReadout: HTMLElement | null;
  private lastSpeedSign = 1;

  constructor(private clock: SimulationClock) {
    this.btnPause = document.getElementById('btn-pause') as HTMLButtonElement;
    this.btnReverse = document.getElementById('btn-reverse') as HTMLButtonElement;
    this.btnNow = document.getElementById('btn-now') as HTMLButtonElement;
    this.speedSelect = document.getElementById('speed-select') as HTMLSelectElement;
    this.dateInput = document.getElementById('date-input') as HTMLInputElement;
    this.dateDisplay = document.getElementById('date-display')!;
    this.deltaTReadout = document.getElementById('delta-t-readout');

    // Initialize from clock
    clock.setSpeed(parseFloat(this.speedSelect.value));
    this.syncDate();

    this.btnPause.addEventListener('click', () => {
      clock.toggle();
      this.btnPause.textContent = clock.isPlaying() ? '⏸' : '▶';
    });

    this.btnReverse.addEventListener('click', () => {
      clock.reverse();
      this.lastSpeedSign = -this.lastSpeedSign;
      this.btnReverse.classList.toggle('active', clock.getSpeed() < 0);
    });

    this.speedSelect.addEventListener('change', () => {
      const v = parseFloat(this.speedSelect.value);
      clock.setSpeed(v * this.lastSpeedSign);
    });

    this.dateInput.addEventListener('change', () => {
      const v = this.dateInput.value;
      if (v) {
        // datetime-local value is in user's local timezone — Date constructor
        // parses naked "YYYY-MM-DDTHH:MM:SS" as local time.
        const parsed = new Date(v);
        if (!Number.isNaN(parsed.getTime())) clock.setDate(parsed);
      }
    });

    this.btnNow.addEventListener('click', () => {
      clock.setDate(new Date());
      // Snap speed back to real-time forward 1×: the user is asking for
      // "right now", and that intuitively means simulation time also tracks
      // wall-clock from this moment, not whatever zoomed-in/reversed state
      // they were exploring before.
      this.speedSelect.value = '1';
      this.lastSpeedSign = 1;
      clock.setSpeed(1);
      this.btnReverse.classList.remove('active');
      // Resume playback if paused — same reasoning: "現在" is about live time.
      if (!clock.isPlaying()) {
        clock.toggle();
        this.btnPause.textContent = '⏸';
      }
    });

    // Step buttons (−1y / −1mo / −1d / −1h / −1m / +1m / +1h / +1d / +1mo / +1y).
    // Each button's `data-step` attribute carries the offset in seconds; we
    // apply it to the current simulated time. ±1 month is a calendar-aware
    // step, the others are exact seconds.
    document.querySelectorAll<HTMLButtonElement>('.time-step').forEach(b => {
      b.addEventListener('click', () => {
        const stepSec = parseInt(b.dataset.step ?? '0', 10);
        if (!stepSec) return;
        const cur = clock.getDate();
        // For ±month/year, use calendar arithmetic so month-end edge cases
        // (e.g. Jan 31 → Feb 28) round correctly per locale expectations.
        let next: Date;
        if (Math.abs(stepSec) === 31536000) {
          next = new Date(cur);
          next.setFullYear(cur.getFullYear() + Math.sign(stepSec));
        } else if (Math.abs(stepSec) === 2592000) {
          next = new Date(cur);
          next.setMonth(cur.getMonth() + Math.sign(stepSec));
        } else {
          next = new Date(cur.getTime() + stepSec * 1000);
        }
        clock.setDate(next);
      });
    });

    // Time scrubber: relative ±365 days from anchor JD captured on dragstart.
    const scrubber = document.getElementById('time-scrubber') as HTMLInputElement;
    let anchorJd: number | null = null;
    let suppressScrub = false;
    scrubber.addEventListener('pointerdown', () => { anchorJd = clock.getJd(); });
    scrubber.addEventListener('input', () => {
      if (anchorJd == null) anchorJd = clock.getJd();
      const offset = parseFloat(scrubber.value);
      suppressScrub = true;
      clock.setJd(anchorJd + offset);
      suppressScrub = false;
    });
    scrubber.addEventListener('pointerup', () => {
      anchorJd = null;
      scrubber.value = '0';
    });
    scrubber.addEventListener('dblclick', () => {
      anchorJd = null;
      scrubber.value = '0';
    });

    clock.subscribe(() => {
      if (!suppressScrub) this.syncDate();
      else this.syncDate();
    });

    // External components (e.g. LeftPanel observer enter / exit) tell us when
    // to override the timezone via a CustomEvent — keeps coupling loose.
    window.addEventListener('sim:tz-override', (e: Event) => {
      const ev = e as CustomEvent<{ offsetMin: number | null }>;
      this.setTimezoneOffsetMinutes(ev.detail.offsetMin);
    });
  }

  private offsetMin: number | null = null;

  /**
   * Override the browser timezone with an explicit offset (in minutes east of
   * UTC). Used when entering observer mode at a specific longitude — the
   * simulator shows that location's nominal solar time instead of the
   * browser host's. Pass `null` to revert to the browser's local timezone.
   */
  setTimezoneOffsetMinutes(offsetMin: number | null): void {
    this.offsetMin = offsetMin;
    this.syncDate();
  }

  private syncDate(): void {
    const date = this.clock.getDate();
    // For the input we feed local-time ISO so what the user picks is what
    // they read off their wall clock (browser local — overriding here would
    // confuse <input type="datetime-local"> which works in browser-local).
    this.dateInput.value = formatLocalDateTime(date);
    this.dateDisplay.textContent = formatDisplay(date, this.offsetMin);
    this.syncDeltaT();
  }

  /**
   * Update the small ΔT readout next to the date. Shows TT−UT1 in the most
   * readable unit for the magnitude (s for modern era, min/h for historical).
   * Hidden entirely if abs(ΔT) is below ~10s (sub-arcsec impact, just clutter).
   */
  private syncDeltaT(): void {
    if (!this.deltaTReadout) return;
    const dt = deltaTSeconds(jdToDecimalYear(this.clock.getJd()));
    const abs = Math.abs(dt);
    let txt: string;
    if (abs < 5) {
      // Modern era is around 70s in 2025 — anything below 5s means we're
      // near the brief 1900-1960 zero-crossing where ΔT was small. Still
      // show it (educational) but in plain seconds.
      txt = `ΔT ${dt >= 0 ? '+' : ''}${dt.toFixed(1)}s`;
    } else if (abs < 600) {
      txt = `ΔT ${dt >= 0 ? '+' : ''}${dt.toFixed(0)}s`;
    } else if (abs < 3600) {
      txt = `ΔT ${dt >= 0 ? '+' : ''}${(dt / 60).toFixed(1)}min`;
    } else {
      txt = `ΔT ${dt >= 0 ? '+' : ''}${(dt / 3600).toFixed(2)}h`;
    }
    this.deltaTReadout.textContent = ` · ${txt}`;
  }
}

function pad(n: number, width = 2): string {
  return n.toString().padStart(width, '0');
}

function formatLocalDateTime(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function formatDisplay(date: Date, overrideOffsetMin: number | null): string {
  const tzMin = overrideOffsetMin !== null ? overrideOffsetMin : -date.getTimezoneOffset();
  // Compute display fields in the chosen offset.
  const utcMs = date.getTime();
  const shifted = new Date(utcMs + tzMin * 60000);
  // Use UTC accessors on the shifted ms to render that offset's wall-clock time.
  const local = `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())} ` +
    `${pad(shifted.getUTCHours())}:${pad(shifted.getUTCMinutes())}:${pad(shifted.getUTCSeconds())}`;
  const sign = tzMin >= 0 ? '+' : '-';
  const tzAbs = Math.abs(tzMin);
  const tzH = Math.floor(tzAbs / 60);
  const tzM = tzAbs % 60;
  const tz = tzM === 0 ? `UTC${sign}${tzH}` : `UTC${sign}${tzH}:${pad(tzM)}`;
  return `${local} ${tz}`;
}
