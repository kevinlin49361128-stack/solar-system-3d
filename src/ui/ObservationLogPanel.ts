import type { CameraController } from '../controls/CameraController';
import type { InfoPanel } from './InfoPanel';
import type { SolarSystem } from '../scene/SolarSystem';
import {
  listEntries, totalCount, exportJson, importJson, clearAll,
  type ObservationCategory, type ObservationEntry,
} from '../data/observationLog';
import { MESSIER } from '../data/messier';
import { NAMED_STARS } from '../data/stars';
import { t } from '../i18n';

/**
 * "我的觀測" — listing of every target the user has marked as observed,
 * newest-first. The companion to InfoPanel's per-target mark/notes/rating
 * widget: this panel surfaces the cumulative log so users can browse what
 * they've seen, edit notes, re-jump to targets, or export their log.
 *
 * Click any row → re-open InfoPanel for that target + (in observer mode)
 * aim the camera at it. Same interaction pattern as TonightPlanPanel,
 * which keeps the muscle memory consistent.
 *
 * Export / import:
 *   - "💾 匯出" downloads `solar-system-observation-log-<date>.json`
 *   - "📂 匯入" opens a file picker; valid JSON replaces the current log
 *     after a confirm dialog
 *   - "🗑️ 清空" wipes the log (also confirmed)
 *
 * No server-side anything — entirely local.
 */
export class ObservationLogPanel {
  private el: HTMLElement;
  private listEl: HTMLElement;
  private summaryEl: HTMLElement;

  constructor(
    private cameraCtl: CameraController,
    private infoPanel: InfoPanel,
    private solarSystem: SolarSystem,
  ) {
    this.el = document.getElementById('observation-log-panel')!;
    this.listEl = document.getElementById('observation-log-list')!;
    this.summaryEl = document.getElementById('observation-log-summary')!;

    document.getElementById('observation-log-close')!.addEventListener('click', () => this.hide());
    document.getElementById('observation-log-export')!.addEventListener('click', () => this.doExport());
    document.getElementById('observation-log-import')!.addEventListener('click', () => this.doImport());
    document.getElementById('observation-log-clear')!.addEventListener('click', () => this.doClear());
  }

  show(): void {
    this.el.style.display = '';
    this.render();
  }
  hide(): void { this.el.style.display = 'none'; }
  isOpen(): boolean { return this.el.style.display !== 'none'; }

  private render(): void {
    const entries = listEntries();
    this.summaryEl.textContent = `${t('obslog.total')}: ${entries.length}`;

    if (entries.length === 0) {
      this.listEl.innerHTML = `<div style="color:var(--text-dim);padding:8px;font-size:12px;line-height:1.6;">${t('obslog.empty')}</div>`;
      return;
    }

    this.listEl.innerHTML = entries.map(e => this.renderEntry(e)).join('');
    this.wireClicks();
  }

  private renderEntry(e: ObservationEntry): string {
    const stars = e.rating ? '★'.repeat(e.rating) + '☆'.repeat(5 - e.rating) : '';
    const dateStr = new Date(e.lastObservedAt).toISOString().slice(0, 10);
    const categoryLabel = e.category === 'body' ? '🪐'
                        : e.category === 'messier' ? '🌌'
                        : e.category === 'star' ? '⭐' : '·';
    const sessionsTxt = e.sessionCount > 1 ? ` × ${e.sessionCount}` : '';
    const notesPreview = e.notes
      ? `<div class="ol-notes">${escape(e.notes.slice(0, 80))}${e.notes.length > 80 ? '…' : ''}</div>`
      : '';
    return `<div class="ol-entry" data-cat="${e.category}" data-id="${escape(e.id)}">
      <div class="ol-row1">
        <span class="ol-cat">${categoryLabel}</span>
        <span class="ol-name">${escape(e.displayName)}</span>
        <span class="ol-date">${dateStr}${sessionsTxt}</span>
      </div>
      ${stars ? `<div class="ol-stars">${stars}</div>` : ''}
      ${notesPreview}
    </div>`;
  }

  private wireClicks(): void {
    this.listEl.querySelectorAll<HTMLElement>('.ol-entry').forEach(row => {
      row.addEventListener('click', () => {
        const cat = row.dataset.cat as ObservationCategory;
        const id = row.dataset.id;
        if (!cat || !id) return;
        this.jumpTo(cat, id);
      });
    });
  }

  /** Re-open InfoPanel for the entry + (if in observer mode) aim camera. */
  private jumpTo(cat: ObservationCategory, id: string): void {
    const cam = this.cameraCtl;
    if (cat === 'body') {
      // Verify body still exists in the catalogue (could have been removed).
      if (this.solarSystem.getBody(id)) {
        this.infoPanel.show(id);
        if (cam.getMode() === 'observer') {
          const aa = cam.getBodyAltAz(id);
          if (aa) cam.setObserverLook(aa.azDeg, aa.altDeg);
        }
      }
      return;
    }
    if (cat === 'messier') {
      const m = MESSIER.find(x => x.id === id);
      if (!m) return;
      this.infoPanel.showMessier(m);
      if (cam.getMode() === 'observer') {
        const aa = cam.getStarAltAz(m.raHours, m.decDeg);
        if (aa) cam.setObserverLook(aa.azDeg, aa.altDeg);
      }
      return;
    }
    if (cat === 'star') {
      const s = NAMED_STARS.find(x => x.id === id);
      if (!s) return;
      this.infoPanel.showStar(s);
      if (cam.getMode() === 'observer') {
        const aa = cam.getStarAltAz(s.raHours, s.decDeg, s.pmRA, s.pmDec);
        if (aa) cam.setObserverLook(aa.azDeg, aa.altDeg);
      }
      return;
    }
    if (cat === 'unnamed') {
      // unnamed:<ra>_<dec> — re-derive RA/Dec from the id
      const [raS, decS] = id.split('_');
      const ra = parseFloat(raS);
      const dec = parseFloat(decS);
      if (Number.isFinite(ra) && Number.isFinite(dec)) {
        this.infoPanel.showStarBasic(ra, dec, 99);
        if (cam.getMode() === 'observer') {
          const aa = cam.getStarAltAz(ra, dec);
          if (aa) cam.setObserverLook(aa.azDeg, aa.altDeg);
        }
      }
    }
  }

  private doExport(): void {
    const json = exportJson();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `solar-system-observation-log-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  private doImport(): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.addEventListener('change', () => {
      const f = input.files?.[0];
      if (!f) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const text = String(reader.result ?? '');
          if (!confirm(t('obslog.importConfirm'))) return;
          const n = importJson(text);
          alert(`已匯入 ${n} 筆觀測紀錄`);
          this.render();
        } catch (e) {
          alert(`匯入失敗：${(e as Error).message}`);
        }
      };
      reader.readAsText(f);
    });
    input.click();
  }

  private doClear(): void {
    const n = totalCount();
    if (n === 0) return;
    if (!confirm(`${t('obslog.clearConfirm')}（${n} 筆）`)) return;
    clearAll();
    this.render();
  }
}

function escape(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
