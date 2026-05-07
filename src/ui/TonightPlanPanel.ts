import type { CameraController } from '../controls/CameraController';
import type { InfoPanel } from './InfoPanel';
import { computeTonightPlan, type TonightEntry } from '../physics/tonightPlan';
import { MESSIER } from '../data/messier';
import { NAMED_STARS } from '../data/stars';
import { isObserved, getEntry as getObsEntry } from '../data/observationLog';
import { t } from '../i18n';

/**
 * "今晚看什麼" — ranked observable list, generated from the current observer
 * state every time the panel is opened or the user hits the refresh button.
 *
 * Categories surfaced:
 *   - 🪐 Planets currently above horizon (always shown, even if conditions are
 *     marginal — observers want to know if Saturn is up regardless of moonlight)
 *   - 🌌 Top 15 Messier DSOs ranked by observability score, filtered to
 *     "marginal" or better
 *   - ⭐ Bright named stars (mag < 2.5) ranked the same way
 *
 * Click any entry → jump observer mode to that target's alt/az direction
 * + open the InfoPanel for it. This is the "ship it" interaction loop the
 * stargazer-tester explicitly asked for: scan list → tap → telescope's
 * pointing arrow now matches the recommendation.
 *
 * Refreshes are explicit (not per-frame) because the O(N) scan over 110
 * Messier + ~70 named stars touches the topocentric frame for each entry.
 * That's fine for a one-shot rebuild but unwanted at 60Hz.
 */
export class TonightPlanPanel {
  private el: HTMLElement;
  private listEl: HTMLElement;

  constructor(
    private cameraCtl: CameraController,
    private infoPanel: InfoPanel,
  ) {
    this.el = document.getElementById('tonight-plan-panel')!;
    this.listEl = document.getElementById('tonight-plan-list')!;

    document.getElementById('tonight-plan-close')!
      .addEventListener('click', () => this.hide());
    document.getElementById('tonight-plan-refresh')!
      .addEventListener('click', () => this.rebuild());
  }

  show(): void {
    this.el.style.display = '';
    this.rebuild();
  }
  hide(): void { this.el.style.display = 'none'; }
  isOpen(): boolean { return this.el.style.display !== 'none'; }

  /**
   * Recompute the plan and re-render the list. Called on `show()` and on
   * the refresh button. Not called per-frame; the user can re-tap to get
   * an updated ranking after time-jumping or moving the observer.
   */
  rebuild(): void {
    const cam = this.cameraCtl;
    if (cam.getMode() !== 'observer') {
      this.listEl.innerHTML = `<div style="color:var(--text-dim);padding:8px;font-size:12px;">${t('tonight.observerOnly')}</div>`;
      return;
    }

    const sunAA = cam.getBodyAltAz('sun');
    const moonAA = cam.getBodyAltAz('moon');
    const bortleSlider = document.getElementById('bortle-slider') as HTMLInputElement | null;
    const bortle = bortleSlider ? parseInt(bortleSlider.value, 10) || 4 : 4;

    if (!sunAA || !moonAA) {
      this.listEl.innerHTML = `<div style="color:var(--text-dim);padding:8px;font-size:12px;">${t('tonight.observerOnly')}</div>`;
      return;
    }

    // Compute moon phase from sun-moon elongation
    const D2R = Math.PI / 180;
    const cosElong =
      Math.sin(sunAA.altDeg * D2R) * Math.sin(moonAA.altDeg * D2R) +
      Math.cos(sunAA.altDeg * D2R) * Math.cos(moonAA.altDeg * D2R) *
      Math.cos((sunAA.azDeg - moonAA.azDeg) * D2R);
    const elongDeg = Math.acos(Math.max(-1, Math.min(1, cosElong))) / D2R;
    const moonPhase = (1 - Math.cos(elongDeg * D2R)) / 2;

    const plan = computeTonightPlan({
      getStarAltAz: (ra, dec) => cam.getStarAltAz(ra, dec),
      getBodyAltAz: (id) => cam.getBodyAltAz(id),
      sunAltDeg: sunAA.altDeg,
      moonAltDeg: moonAA.altDeg,
      moonAzDeg: moonAA.azDeg,
      moonPhase,
      bortle,
    });

    let html = '';
    if (plan.planets.length === 0 && plan.messier.length === 0 && plan.stars.length === 0) {
      html = `<div style="color:var(--text-dim);padding:8px;font-size:12px;">${t('tonight.empty')}</div>`;
    } else {
      const totalCount = plan.planets.length + plan.messier.length + plan.stars.length;
      html += `<div class="tn-summary">${t('tonight.summary')}: ${totalCount} ${t('tonight.targets')}（Bortle ${bortle}, ${t('tonight.moonPhase')} ${(moonPhase * 100).toFixed(0)}%）</div>`;
      if (plan.planets.length > 0) {
        html += this.renderSection(t('tonight.section.planets'), '🪐', plan.planets);
      }
      if (plan.messier.length > 0) {
        html += this.renderSection(t('tonight.section.messier'), '🌌', plan.messier);
      }
      if (plan.stars.length > 0) {
        html += this.renderSection(t('tonight.section.stars'), '⭐', plan.stars);
      }
    }
    this.listEl.innerHTML = html;
    this.wireClicks();
  }

  private renderSection(title: string, emoji: string, entries: TonightEntry[]): string {
    return `<div class="tn-section">` +
      `<div class="tn-section-title">${emoji} ${title}（${entries.length}）</div>` +
      entries.map(e => this.renderEntry(e)).join('') +
      `</div>`;
  }

  private renderEntry(e: TonightEntry): string {
    const ratingDot = e.rating === 'good' ? '🟢'
                    : e.rating === 'marginal' ? '🟡'
                    : e.rating === 'poor' ? '🔴' : '⚫';
    const altText = `${e.altDeg.toFixed(0)}°`;
    const azText = compassFor(e.azDeg);
    const magText = `m=${e.magnitude >= 0 ? '+' : ''}${e.magnitude.toFixed(1)}`;
    // Already-observed targets get dimmed + a ✓ badge so users can scan
    // for "what I haven't seen yet" without filtering. Stars + Messier +
    // bodies all share the same observation-log key scheme.
    const obsCategory = e.category === 'planet' ? 'body' : e.category;
    const observed = isObserved(obsCategory, e.id);
    let observedBadge = '';
    if (observed) {
      const obsEntry = getObsEntry(obsCategory, e.id);
      const stars = obsEntry?.rating ? '★'.repeat(obsEntry.rating) : '✓';
      observedBadge = `<span class="tn-observed">${stars}</span>`;
    }
    const dimClass = observed ? ' tn-entry-observed' : '';
    return `<div class="tn-entry${dimClass}" data-cat="${e.category}" data-id="${escape(e.id)}">` +
      `<div class="tn-row1">` +
        `<span class="tn-rating">${ratingDot}</span>` +
        `<span class="tn-name">${escape(e.name)}</span>` +
        observedBadge +
        `<span class="tn-altaz">${altText} ${azText}</span>` +
      `</div>` +
      `<div class="tn-row2">` +
        `<span class="tn-mag">${magText}</span>` +
        `<span class="tn-reason">${escape(e.primaryReason)}</span>` +
      `</div>` +
    `</div>`;
  }

  private wireClicks(): void {
    this.listEl.querySelectorAll<HTMLElement>('.tn-entry').forEach(row => {
      row.addEventListener('click', () => {
        const cat = row.dataset.cat as 'planet' | 'messier' | 'star' | undefined;
        const id = row.dataset.id;
        if (!cat || !id) return;
        this.jumpTo(cat, id);
      });
    });
  }

  /**
   * Aim the observer camera at the chosen target + open InfoPanel for it.
   * Each category needs different lookup paths — planets via SolarSystem,
   * Messier via the MESSIER catalog (RA/Dec), stars via NAMED_STARS.
   */
  private jumpTo(cat: 'planet' | 'messier' | 'star', id: string): void {
    const cam = this.cameraCtl;
    if (cat === 'planet') {
      const aa = cam.getBodyAltAz(id);
      if (aa) cam.setObserverLook(aa.azDeg, aa.altDeg);
      this.infoPanel.show(id);
      return;
    }
    if (cat === 'messier') {
      const m = MESSIER.find(x => x.id === id);
      if (!m) return;
      const aa = cam.getStarAltAz(m.raHours, m.decDeg);
      if (aa) cam.setObserverLook(aa.azDeg, aa.altDeg);
      this.infoPanel.showMessier(m);
      return;
    }
    if (cat === 'star') {
      const s = NAMED_STARS.find(x => x.id === id);
      if (!s) return;
      this.infoPanel.showStar(s);
      const aa = cam.getStarAltAz(s.raHours, s.decDeg, s.pmRA, s.pmDec);
      if (aa) cam.setObserverLook(aa.azDeg, aa.altDeg);
    }
  }
}

/** 16-point compass direction for an azimuth in degrees. */
function compassFor(azDeg: number): string {
  const labels = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
                  'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  return labels[Math.round(azDeg / 22.5) % 16];
}

function escape(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}