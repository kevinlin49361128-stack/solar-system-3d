import type { CameraController } from '../controls/CameraController';
import type { InfoPanel } from './InfoPanel';
import type { SimulationClock } from '../time/SimulationClock';
import {
  listQueue, removeFromQueue, updateQueueTarget, clearQueue,
} from '../data/observationQueueStore';
import {
  targetIntegrationMinutes, queueFitsTonight,
  SMART_SCOPE_APERTURE_MM,
  type QueueTarget, type SmartScopeId, type TonightWindow,
} from '../physics/observationQueue';
import { computeDailyEvents } from '../physics/dailyEvents';
import { t, onLanguageChange } from '../i18n';

/**
 * Floating panel that surfaces the observation queue — the smart-
 * telescope era's "tonight's plan" feature. Lists every target the
 * user has added (via InfoPanel's "Add to queue" button); shows each
 * target's current alt + integration estimate + the per-scope picker;
 * footer totals minutes vs the astronomical-night window.
 *
 * Same rough shape as TonightPlanPanel + ObservationLogPanel — the
 * three observer-side panels share visual language even though they
 * solve different problems:
 *   - TonightPlan = "what's worth looking at right now?" (visual)
 *   - ObservationQueue = "tonight's imaging session plan" (smart scope)
 *   - ObservationLog = "what have I already observed?" (history)
 */
export class ObservationQueuePanel {
  private el: HTMLElement;
  private listEl: HTMLElement;
  private footerEl: HTMLElement;

  constructor(
    private cameraCtl: CameraController,
    private infoPanel: InfoPanel,
    private clock: SimulationClock,
  ) {
    this.el = document.getElementById('observation-queue-panel')!;
    this.listEl = document.getElementById('queue-list')!;
    this.footerEl = document.getElementById('queue-footer')!;
    document.getElementById('queue-close')!
      .addEventListener('click', () => this.hide());
    document.getElementById('queue-clear')!
      .addEventListener('click', () => {
        if (!confirm(t('queue.confirmClear'))) return;
        clearQueue();
        this.rebuild();
      });
    onLanguageChange(() => {
      if (this.isOpen()) this.rebuild();
    });
  }

  show(): void {
    this.el.style.display = '';
    this.rebuild();
  }
  hide(): void { this.el.style.display = 'none'; }
  isOpen(): boolean { return this.el.style.display !== 'none'; }

  /** Called by InfoPanel after a successful add — keeps the panel in
   *  sync without needing the user to close + reopen. */
  refreshIfOpen(): void {
    if (this.isOpen()) this.rebuild();
  }

  /**
   * Re-render the list + footer from the current store + clock state.
   * Cheap (≤ ~50 targets in any realistic queue) so we don't bother
   * with diffing.
   */
  rebuild(): void {
    const queue = listQueue();
    if (queue.length === 0) {
      this.listEl.innerHTML = `<div class="queue-empty">${t('queue.empty')}</div>`;
      this.footerEl.innerHTML = '';
      return;
    }

    this.listEl.innerHTML = queue
      .map(target => this.renderEntry(target))
      .join('');

    this.wireEntryControls();

    // Footer: total integration + tonight-window verdict.
    const window = this.tonightAstroWindow();
    const stats = queueFitsTonight(queue, window);
    const totalStr = formatMinutes(stats.totalMinutes);
    let windowLine = '';
    if (Number.isFinite(stats.windowMinutes)) {
      const windowStr = formatMinutes(stats.windowMinutes);
      const verdict = stats.fits
        ? `<span class="queue-ok">✓ ${t('queue.fits')}</span>`
        : `<span class="queue-warn">⚠ ${t('queue.overflows')}</span>`;
      windowLine = `${t('queue.window')}: ${windowStr} · ${verdict}`;
    } else {
      windowLine = `<span class="queue-dim">${t('queue.noWindowData')}</span>`;
    }
    this.footerEl.innerHTML = `
      <div class="queue-stat-row">
        <span>${t('queue.totalIntegration')}: <b>${totalStr}</b></span>
      </div>
      <div class="queue-stat-row">${windowLine}</div>
    `;
  }

  private renderEntry(target: QueueTarget): string {
    const minutes = targetIntegrationMinutes(target);
    const minutesStr = Number.isFinite(minutes)
      ? formatMinutes(minutes)
      : '—';
    const sbStr = Number.isFinite(target.surfaceBrightness)
      ? `${target.surfaceBrightness.toFixed(1)} mag/⬚²`
      : `m=${target.magnitude.toFixed(1)}`;
    // Current alt/az for "is it up right now?" — quick visibility hint.
    const aa = this.cameraCtl.getStarAltAz(target.raHours, target.decDeg);
    const altStr = aa
      ? `${aa.altDeg >= 0 ? '+' : ''}${aa.altDeg.toFixed(0)}° alt`
      : '—';
    const altClass = aa && aa.altDeg > 20 ? 'queue-alt-good'
                  : aa && aa.altDeg > 0  ? 'queue-alt-low'
                  : 'queue-alt-below';

    // Smart-scope picker — 4 options. Per-target so user can mix
    // (Vespera Pro for big nebula, Seestar S30 for tight clusters).
    const scopeOptions = (Object.keys(SMART_SCOPE_APERTURE_MM) as SmartScopeId[])
      .map(id =>
        `<option value="${id}"${id === target.scope ? ' selected' : ''}>${t(`optics.${optsKey(id)}`)}</option>`)
      .join('');

    return `
      <div class="queue-entry" data-target-id="${escape(target.id)}">
        <div class="queue-entry-head">
          <span class="queue-name">${escape(target.label)}</span>
          <button class="queue-remove" data-action="remove" data-id="${escape(target.id)}"
                  aria-label="${t('queue.remove')}">✕</button>
        </div>
        <div class="queue-entry-row">
          <span class="${altClass}">${altStr}</span>
          <span class="queue-dim">·</span>
          <span>${sbStr}</span>
        </div>
        <div class="queue-entry-row">
          <select class="queue-scope" data-action="scope" data-id="${escape(target.id)}">
            ${scopeOptions}
          </select>
          <span class="queue-min">⌛ <b>${minutesStr}</b></span>
        </div>
      </div>
    `;
  }

  private wireEntryControls(): void {
    this.listEl.querySelectorAll<HTMLElement>('[data-action="remove"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        if (!id) return;
        removeFromQueue(id);
        this.rebuild();
      });
    });
    this.listEl.querySelectorAll<HTMLSelectElement>('[data-action="scope"]').forEach(sel => {
      sel.addEventListener('change', () => {
        const id = sel.dataset.id;
        if (!id) return;
        updateQueueTarget(id, { scope: sel.value as SmartScopeId });
        this.rebuild();
      });
    });
    this.listEl.querySelectorAll<HTMLElement>('.queue-name').forEach(name => {
      name.addEventListener('click', () => {
        const id = (name.closest('.queue-entry') as HTMLElement | null)?.dataset.targetId;
        if (!id) return;
        this.openInfoPanelFor(id);
      });
      (name as HTMLElement).style.cursor = 'pointer';
    });
  }

  /**
   * Best-effort dispatch: figure out which InfoPanel.show method
   * matches the queued id and call it.
   */
  private openInfoPanelFor(id: string): void {
    if (id.startsWith('messier:')) {
      // Defer to existing Messier path via the InfoPanel's own logic
      // (TonightPlanPanel does the same).
      const sub = id.slice(8);
      const m = (window as unknown as { __messierIndex?: unknown }).__messierIndex
        ?? null;
      void m;  // not exposed yet; fall back to simple show()
      this.infoPanel.show(sub);
      return;
    }
    // Body / star / NGC paths — InfoPanel.show handles plain ids.
    this.infoPanel.show(id);
  }

  /**
   * Compute tonight's astronomical-night window at the current
   * observer location. Returns { astroDuskJd, astroDawnJd } in JD;
   * either may be null at polar latitudes / mid-summer where the
   * sun never reaches −18° below horizon.
   */
  private tonightAstroWindow(): TonightWindow {
    const { lat, lon } = this.cameraCtl.getObserverLocation();
    const jd = this.clock.getJd();
    // Anchor on local noon nearest jd so "today's night" picks the
    // upcoming evening's dark window, not yesterday's.
    const jdLocalNoon = Math.round(jd + lon / 360) - lon / 360;
    const ev = computeDailyEvents(jdLocalNoon, lat, lon);
    return {
      astroDuskJd: ev.astronomicalDusk ?? null,
      astroDawnJd: ev.astronomicalDawn ?? null,
    };
  }
}

function escape(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formatMinutes(min: number): string {
  if (!Number.isFinite(min)) return '—';
  if (min < 1) return `< 1 min`;
  if (min < 60) return `${Math.round(min)} min`;
  const h = Math.floor(min / 60);
  const m = Math.round(min - h * 60);
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/** SmartScopeId → i18n key fragment for `optics.${frag}` lookup. */
function optsKey(id: SmartScopeId): string {
  switch (id) {
    case 'seestar-s30': return 'seestar30';
    case 'seestar-s50': return 'seestar50';
    case 'vespera-pro': return 'vesperaPro';
    case 'dwarf-3':     return 'dwarf3';
  }
}
