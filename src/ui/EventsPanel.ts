import type { SolarSystem } from '../scene/SolarSystem';
import type { SimulationClock } from '../time/SimulationClock';
import type { CameraController } from '../controls/CameraController';
import type { InfoPanel } from './InfoPanel';
import { scanEvents, eventKindLabel, type DetectedEvent } from '../physics/eventScanner';
import { STARS_AND_PLANETS } from '../data/bodies';
import { MOONS } from '../data/moons';
/**
 * Structural type covering only what EventsPanel needs from the eclipse-map
 * UI components. This lets `main.ts` plug in a lazy proxy that defers the
 * actual `import('./EclipseMap')` until the user clicks an eclipse row —
 * keeping ~10 KB of map-rendering code out of the initial bundle.
 */
type EclipseMapLike = { show(peakJd: number, label: string): void };

/**
 * 自動偵測未來事件清單。掃描從目前時刻起 ~2 年的事件，依時間排序。
 */
export class EventsPanel {
  private el: HTMLElement;
  private listEl: HTMLElement;
  private events: DetectedEvent[] = [];

  constructor(
    private clock: SimulationClock,
    private cameraCtl: CameraController,
    private infoPanel: InfoPanel,
    private solarSystem: SolarSystem,
  ) {
    this.el = document.getElementById('auto-events-panel')!;
    this.listEl = document.getElementById('auto-events-list')!;
    document.getElementById('auto-events-close')!.addEventListener('click', () => this.hide());
    document.getElementById('auto-events-rescan')!.addEventListener('click', () => this.rescan());

    void this.solarSystem;
  }

  private eclipseMap: EclipseMapLike | null = null;
  private lunarEclipseMap: EclipseMapLike | null = null;
  /** Plug in EclipseMap so solar-eclipse rows can show the path. */
  setEclipseMap(m: EclipseMapLike): void { this.eclipseMap = m; }
  /** Plug in LunarEclipseMap so lunar-eclipse rows show the contact diagram. */
  setLunarEclipseMap(m: EclipseMapLike): void { this.lunarEclipseMap = m; }

  show(): void {
    this.el.style.display = '';
    if (this.events.length === 0) this.rescan();
    this.render();
  }
  hide(): void { this.el.style.display = 'none'; }
  isOpen(): boolean { return this.el.style.display !== 'none'; }

  /**
   * Look up the next future event for a given body id (e.g. 'mars' →
   * next opposition / conjunction). Returns null if the scanner hasn't
   * run yet, OR if no future event exists for this body. Triggers a
   * lazy scan on first call so the InfoPanel can use this without the
   * user having to click "auto-detect" first.
   */
  getNextEventFor(bodyId: string): DetectedEvent | null {
    if (this.events.length === 0) this.rescan();
    const now = this.clock.getJd();
    const matching = this.events.filter(e => e.bodyId === bodyId && e.jd > now);
    return matching.length > 0 ? matching[0] : null;
  }

  private rescan(): void {
    const allBodies = [...STARS_AND_PLANETS, ...MOONS];
    const startJd = this.clock.getJd();
    const endJd = startJd + 730; // 2 years
    this.events = scanEvents(allBodies, startJd, endJd);
    this.render();
  }

  private render(): void {
    if (this.events.length === 0) {
      this.listEl.innerHTML = `<div style="color:var(--text-dim);padding:8px;">無事件，按「重掃」嘗試。</div>`;
      return;
    }
    this.listEl.innerHTML = this.events.map((e, i) => {
      const dateStr = e.date.toISOString().slice(0, 10);
      // Solar-eclipse rows get an extra "show map" button. Lunar-eclipse
      // rows get a contact-diagram button (different geometry — the
      // shadow falls on the Moon, not on Earth).
      const mapBtn = e.kind === 'solar-eclipse'
        ? `<button class="eclipse-map-btn" data-i="${i}" style="margin-top:4px;background:rgba(255,200,80,0.15);border:1px solid rgba(255,200,80,0.4);color:#ffcc40;padding:3px 8px;border-radius:4px;cursor:pointer;font-size:10px;">🗺️ 食帶地圖</button>`
        : e.kind === 'lunar-eclipse'
        ? `<button class="lunar-eclipse-map-btn" data-i="${i}" style="margin-top:4px;background:rgba(255,200,80,0.15);border:1px solid rgba(255,200,80,0.4);color:#ffcc40;padding:3px 8px;border-radius:4px;cursor:pointer;font-size:10px;">🌑 接觸圖</button>`
        : '';
      return `<div class="event-row" data-i="${i}">` +
        `<div><span style="color:var(--accent);font-size:11px;">${dateStr}</span> ` +
        `<b>${eventKindLabel(e.kind)}</b></div>` +
        `<div style="color:var(--text-dim);font-size:11px;line-height:1.5;">${e.description}</div>` +
        mapBtn +
        `</div>`;
    }).join('');
    this.listEl.querySelectorAll<HTMLElement>('.event-row').forEach(el => {
      el.addEventListener('click', (ev) => {
        // Don't time-jump if the click was on a map button.
        const cl = (ev.target as HTMLElement).classList;
        if (cl.contains('eclipse-map-btn') || cl.contains('lunar-eclipse-map-btn')) return;
        const i = parseInt(el.dataset.i!, 10);
        const e = this.events[i];
        this.clock.setDate(e.date);
        if (e.bodyId !== 'moon') {
          this.cameraCtl.setFollow(e.bodyId);
          this.infoPanel.show(e.bodyId);
          (document.getElementById('camera-mode') as HTMLSelectElement).value = 'follow';
          (document.getElementById('follow-body') as HTMLSelectElement).value = e.bodyId;
        }
      });
    });
    this.listEl.querySelectorAll<HTMLElement>('.eclipse-map-btn').forEach(el => {
      el.addEventListener('click', (ev) => {
        ev.stopPropagation();
        const i = parseInt(el.dataset.i!, 10);
        const e = this.events[i];
        // Jump time to the eclipse first so the simulator's body
        // positions match the map.
        this.clock.setDate(e.date);
        const dateStr = e.date.toISOString().slice(0, 10);
        const label = `日食食帶 — ${dateStr}（${e.description.split('：')[0] ?? '可能日食'}）`;
        this.eclipseMap?.show(e.jd, label);
      });
    });
    this.listEl.querySelectorAll<HTMLElement>('.lunar-eclipse-map-btn').forEach(el => {
      el.addEventListener('click', (ev) => {
        ev.stopPropagation();
        const i = parseInt(el.dataset.i!, 10);
        const e = this.events[i];
        this.clock.setDate(e.date);
        const dateStr = e.date.toISOString().slice(0, 10);
        const label = `月食接觸圖 — ${dateStr}`;
        this.lunarEclipseMap?.show(e.jd, label);
      });
    });
  }
}
