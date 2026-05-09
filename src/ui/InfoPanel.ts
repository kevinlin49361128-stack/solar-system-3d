import type { BodyDescriptor } from '../physics/types';
import type { SolarSystem } from '../scene/SolarSystem';
import type { SimulationClock } from '../time/SimulationClock';
import type { CameraController } from '../controls/CameraController';
import type { EventsPanel } from './EventsPanel';
import { AU_KM } from '../physics/constants';
import { pieChartSvg, compositionListHtml, tempGaugeHtml } from './charts';
import { langPick, bodyName, onLanguageChange, t } from '../i18n';
import {
  bodyObservables, moonObservables,
  synodicPeriod, hillSphereAU,
} from '../physics/bodyObservables';
import {
  currentVisibility, findNextTransit, findNextCrossing, findOptimalWindow,
} from '../physics/observationPlanning';
import { sunAltitudeDeg, jdToDate } from '../physics/dailyEvents';
import { scoreObservability, type ObservabilityResult } from '../physics/observability';
import {
  type ObservationCategory, getEntry as getObsEntry,
  markObserved, unmarkObserved, updateNotes, updateRating,
} from '../data/observationLog';
import { findStarHopPath, bearingCardinal } from '../physics/starHopping';
import { Vector3 } from 'three';

/**
 * Build the input for scoreObservability() from current observer state +
 * a target's apparent altitude/azimuth + magnitude. Returns null if not
 * in observer mode or any required component (sun/moon position) is
 * unavailable. Caller decides whether to render.
 *
 * Magnitude lookup is the caller's responsibility — for stars we have
 * Hipparcos catalogue, for DSOs we have Messier mag, for planets we
 * compute apparent magnitude separately.
 */
function buildObservability(
  cam: CameraController,
  targetAltDeg: number,
  targetAzDeg: number,
  targetMag: number,
): ObservabilityResult | null {
  const sunAltAz = cam.getBodyAltAz('sun');
  const moonAltAz = cam.getBodyAltAz('moon');
  if (!sunAltAz || !moonAltAz) return null;

  // Angular distance moon ↔ target via spherical law of cosines on local
  // alt/az frame (both bodies seen from the same observer).
  const D2R = Math.PI / 180;
  const cosD =
    Math.sin(moonAltAz.altDeg * D2R) * Math.sin(targetAltDeg * D2R) +
    Math.cos(moonAltAz.altDeg * D2R) * Math.cos(targetAltDeg * D2R) *
    Math.cos((moonAltAz.azDeg - targetAzDeg) * D2R);
  const moonTargetDeg = Math.acos(Math.max(-1, Math.min(1, cosD))) / D2R;

  // Moon phase = (1 - cos(elongation)) / 2 where elongation = angle sun↔moon
  const cosElong =
    Math.sin(sunAltAz.altDeg * D2R) * Math.sin(moonAltAz.altDeg * D2R) +
    Math.cos(sunAltAz.altDeg * D2R) * Math.cos(moonAltAz.altDeg * D2R) *
    Math.cos((sunAltAz.azDeg - moonAltAz.azDeg) * D2R);
  const elongDeg = Math.acos(Math.max(-1, Math.min(1, cosElong))) / D2R;
  const moonPhase = (1 - Math.cos(elongDeg * D2R)) / 2;

  // Bortle: read live from slider (defaults to 4 if not present)
  const bortleSlider = document.getElementById('bortle-slider') as HTMLInputElement | null;
  const bortle = bortleSlider ? parseInt(bortleSlider.value, 10) || 4 : 4;

  return scoreObservability({
    targetAltDeg,
    targetMag,
    sunAltDeg: sunAltAz.altDeg,
    moonAltDeg: moonAltAz.altDeg,
    moonPhase,
    moonAngularDistanceDeg: moonTargetDeg,
    bortle,
  });
}

/**
 * Parse `InfoPanel.currentId` into the (category, id) pair used by the
 * observation log. The currentId convention:
 *   "saturn"           → body
 *   "star:vega"        → named star
 *   "messier:M31"      → Messier object
 *   "unnamed:6.7_-12"  → arbitrary catalogue star (no stable id)
 */
function parseTargetKey(currentId: string): { category: ObservationCategory; id: string } {
  if (currentId.startsWith('star:'))    return { category: 'star',    id: currentId.slice(5) };
  if (currentId.startsWith('messier:')) return { category: 'messier', id: currentId.slice(8) };
  if (currentId.startsWith('unnamed:')) return { category: 'unnamed', id: currentId.slice(8) };
  return { category: 'body', id: currentId };
}

function observabilityBadgeHtml(r: ObservabilityResult): string {
  const label = r.rating === 'good' ? '🟢 適合觀測'
              : r.rating === 'marginal' ? '🟡 條件普通'
              : r.rating === 'poor' ? '🔴 條件不佳'
              : '⚫ 不可見';
  const reasons = r.reasons.length > 0
    ? `<ul style="margin:4px 0 0 0;padding-left:18px;">${r.reasons.slice(0, 3).map(s => `<li>${s}</li>`).join('')}</ul>`
    : '';
  return `<div class="planning-card">` +
           `<div class="planning-status"><b>今晚可見性 — ${label}</b></div>` +
           `<div style="font-size:11px;color:var(--text-dim);margin-top:2px;line-height:1.5;">${reasons}</div>` +
         `</div>`;
}

/**
 * Compute "field-observable" data rows for a target at known alt/az: airmass,
 * angular distance to moon, and a low-horizon warning. Returns an array of
 * [label, value] suitable for direct injection into the dynamic-data section.
 *
 * Returns an empty list if observer mode isn't active (sun/moon positions
 * unavailable) — caller should not render anything in that case.
 *
 * Why these three: the stargazer-tester's "what I check repeatedly" shortlist:
 *  - airmass (whether atmospheric extinction makes magnitude limit usable)
 *  - moon distance (whether moon glare washes out faint targets nearby)
 *  - horizon margin (whether the target is high enough above terrain)
 */
function fieldDataRows(
  cam: CameraController,
  targetAltDeg: number,
  targetAzDeg: number,
): [string, string][] {
  const rows: [string, string][] = [];

  // Airmass = sec(z) where z = zenith angle. Pickering 2002 has a better
  // low-altitude formula, but plain sec(z) is fine for alt > 5° and gives
  // an immediately recognisable number ("airmass 2.0 = 60° from zenith").
  if (targetAltDeg > 0) {
    const am = 1 / Math.sin(targetAltDeg * Math.PI / 180);
    if (am < 30) {
      rows.push(['Airmass', am < 10 ? am.toFixed(2) : am.toFixed(0)]);
    }
  }

  // Moon angular separation (only when both target and moon are above the
  // horizon, OR when moon is up and observer might worry about its glare).
  // We always compute and show — useful even if the target is currently
  // below horizon, so the user can plan ahead.
  const moonAltAz = cam.getBodyAltAz('moon');
  if (moonAltAz) {
    const D2R = Math.PI / 180;
    const cosD =
      Math.sin(moonAltAz.altDeg * D2R) * Math.sin(targetAltDeg * D2R) +
      Math.cos(moonAltAz.altDeg * D2R) * Math.cos(targetAltDeg * D2R) *
      Math.cos((moonAltAz.azDeg - targetAzDeg) * D2R);
    const moonDeg = Math.acos(Math.max(-1, Math.min(1, cosD))) / D2R;
    const moonStatus = moonAltAz.altDeg < 0 ? '（月在地平下）'
                     : moonDeg < 30 ? '⚠️'
                     : moonDeg < 60 ? ''
                     : '✓';
    rows.push(['距月球', `${moonDeg.toFixed(1)}° ${moonStatus}`.trim()]);
  }

  // Low-horizon warning: alt < 5° usually unreachable behind buildings/
  // terrain even at flat sites. Surface as a row so the user notices.
  if (targetAltDeg > 0 && targetAltDeg < 5) {
    rows.push(['⚠️ 地平警示', `仰角僅 ${targetAltDeg.toFixed(1)}°，多數地點被遮蔽`]);
  }

  return rows;
}

const CATEGORY_LABEL: Record<BodyDescriptor['category'], string> = {
  star: '恆星',
  planet: '行星',
  dwarf: '矮行星',
  moon: '衛星',
  comet: '彗星',
};

export class InfoPanel {
  private readonly el: HTMLElement;
  private readonly nameEl: HTMLElement;
  private readonly subtitleEl: HTMLElement;
  private readonly dataEl: HTMLElement;
  private readonly planningEl: HTMLElement;
  private readonly extraEl: HTMLElement;
  private currentId: string | null = null;
  private unsubscribe: (() => void) | null = null;

  private cameraCtl: CameraController | null = null;
  private eventsPanel: EventsPanel | null = null;

  constructor(
    private solarSystem: SolarSystem,
    private clock: SimulationClock,
  ) {
    this.el = document.getElementById('info-panel')!;
    this.nameEl = document.getElementById('info-name')!;
    this.subtitleEl = document.getElementById('info-subtitle')!;
    this.dataEl = document.getElementById('info-data')!;
    this.planningEl = document.getElementById('info-planning')!;
    this.extraEl = document.getElementById('info-extra')!;

    document.getElementById('info-close')!.addEventListener('click', () => this.hide());
    onLanguageChange(() => {
      if (this.currentId) this.render();
    });

    // GoTo: in observer mode, aim the observer's view at the selected body.
    // In other modes, switch to follow-body. Button is hidden by render()
    // when no body is selected.
    document.getElementById('info-goto')?.addEventListener('click', () => {
      if (!this.currentId) return;
      const cam = this.cameraCtl;
      if (!cam) return;
      if (cam.getMode() === 'observer') {
        // One-shot aim — clear any prior follow lock so this is purely
        // a "where is it right now" pointer.
        cam.setObserverFollow(null);
        const altAz = cam.getBodyAltAz(this.currentId);
        if (altAz) cam.setObserverLook(altAz.azDeg, altAz.altDeg);
      } else {
        const sel = document.getElementById('follow-body') as HTMLSelectElement | null;
        if (sel) {
          sel.value = this.currentId;
          sel.dispatchEvent(new Event('change'));
        }
      }
    });

    // 📌 Track: continuously follow the body in observer mode (re-aims each
    // frame). Toggle: clicking again on the same body releases the lock.
    document.getElementById('info-track')?.addEventListener('click', () => {
      if (!this.currentId || !this.cameraCtl) return;
      const cam = this.cameraCtl;
      const cur = cam.getObserverFollow();
      if (cur === this.currentId) cam.setObserverFollow(null);
      else cam.setObserverFollow(this.currentId);
      this.refreshTrackState();
    });

    // ⭐ Bookmark: persist {bodyId, jd, label} to localStorage. Reading lives
    // in the LeftPanel bookmark list (separate UI surface).
    document.getElementById('info-bookmark')?.addEventListener('click', () => {
      if (!this.currentId) return;
      const entry = this.solarSystem.getBody(this.currentId);
      const label = entry ? entry.descriptor.name : this.currentId;
      const bookmark = { id: this.currentId, jd: this.clock.getJd(), label, ts: Date.now() };
      const raw = localStorage.getItem('bookmarks') ?? '[]';
      let list: typeof bookmark[] = [];
      try { list = JSON.parse(raw); } catch { list = []; }
      list.unshift(bookmark);
      // Cap at 100 — older entries roll off.
      if (list.length > 100) list.length = 100;
      localStorage.setItem('bookmarks', JSON.stringify(list));
      window.dispatchEvent(new CustomEvent('bookmarks:changed'));
    });
  }

  private refreshTrackState(): void {
    const btn = document.getElementById('info-track');
    if (!btn || !this.cameraCtl) return;
    const tracking = this.cameraCtl.getObserverFollow() === this.currentId;
    btn.classList.toggle('active', tracking);
    btn.style.background = tracking ? 'rgba(93,177,255,0.40)' : 'rgba(255,255,255,0.06)';
  }

  /** Plug in the camera controller post-construction (avoids ctor cycle). */
  setCameraController(cam: CameraController): void {
    this.cameraCtl = cam;
  }

  /** Plug in the events panel for "next major event" lookup. */
  setEventsPanel(p: EventsPanel): void {
    this.eventsPanel = p;
  }

  show(bodyId: string): void {
    this.currentId = bodyId;
    this.el.classList.add('visible');
    this.updateCompactState();
    const gotoBtn = document.getElementById('info-goto');
    if (gotoBtn) gotoBtn.style.display = '';
    const actionRow = document.getElementById('info-action-row');
    if (actionRow) actionRow.style.display = 'flex';
    // Publish current body id as a data attribute so external listeners
    // (e.g. main.ts's telescope-bridge GoTo handler) can read it without
    // needing direct access to InfoPanel internals.
    (this.nameEl as HTMLElement).dataset.bodyId = bodyId;
    delete (this.nameEl as HTMLElement).dataset.starId;
    this.render();
    this.renderObservationBlock();

    if (this.unsubscribe) this.unsubscribe();
    // Re-render dynamic fields (distance, speed) as the clock advances.
    this.unsubscribe = this.clock.subscribe(() => {
      if (this.currentId === bodyId && this.el.classList.contains('visible')) {
        this.renderDynamic();
      }
    });
  }

  /**
   * Open the panel for a fixed star (named-stars catalog). Stars don't
   * have propagators / orbital elements; instead we show RA/Dec/mag and
   * compute current alt/az + rise/set in the same per-tick refresh loop
   * that bodies use. Hooked up to SearchBar + SkyPanel double-click.
   *
   * Side effect: tags `info-name.dataset.starId = star.id` so the
   * selection-marker overlay (in main.ts) can locate it independent of
   * the body-driven `dataset.bodyId` path.
   */
  /**
   * Lightweight info card for an unnamed catalog star (HYG/BSC). When
   * the user clicks an unidentified star in observer mode, this opens
   * the InfoPanel showing only the data we have: RA, Dec, magnitude.
   * No description / proper motion / Bayer designation since the star
   * isn't in NAMED_STARS — those are reserved for famous bright stars.
   *
   * The data attribute uses `dataset.unnamedStarRa` / `dataset.unnamedStarDec`
   * so the selection marker (main.ts) can still project the star's
   * direction without relying on a NAMED_STARS lookup.
   */
  showStarBasic(raHours: number, decDeg: number, magnitude: number): void {
    this.currentId = `unnamed:${raHours.toFixed(4)}_${decDeg.toFixed(4)}`;
    this.el.classList.add('visible');
    this.updateCompactState();
    const gotoBtn = document.getElementById('info-goto');
    if (gotoBtn) gotoBtn.style.display = '';
    const actionRow = document.getElementById('info-action-row');
    if (actionRow) actionRow.style.display = 'flex';
    delete (this.nameEl as HTMLElement).dataset.bodyId;
    delete (this.nameEl as HTMLElement).dataset.starId;
    (this.nameEl as HTMLElement).dataset.unnamedStarRa = String(raHours);
    (this.nameEl as HTMLElement).dataset.unnamedStarDec = String(decDeg);

    this.nameEl.textContent = `恆星 (HYG)`;
    this.subtitleEl.textContent = `RA ${raHours.toFixed(4)}h Dec ${decDeg >= 0 ? '+' : ''}${decDeg.toFixed(4)}° · m=${magnitude.toFixed(2)}`;

    const rows: [string, string][] = [];
    rows.push(['赤經 (J2000)', formatRA(raHours)]);
    rows.push(['赤緯 (J2000)', `${decDeg >= 0 ? '+' : ''}${decDeg.toFixed(4)}°`]);
    rows.push(['視星等', `${magnitude >= 0 ? '+' : ''}${magnitude.toFixed(2)}`]);
    this.dataEl.innerHTML = rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');
    this.extraEl.innerHTML = `<div class="info-section"><div class="info-text" style="color:var(--text-dim);">HYG 目錄中的恆星，無常用名與專屬描述。可從赤經/赤緯查詢更詳細的恆星資料。</div></div>`;
    this.planningEl.innerHTML = '';

    if (this.unsubscribe) this.unsubscribe();
    this.unsubscribe = this.clock.subscribe(() => {
      if (this.currentId?.startsWith('unnamed:') && this.el.classList.contains('visible')) {
        this.renderUnnamedDynamic(raHours, decDeg);
      }
    });
    this.renderUnnamedDynamic(raHours, decDeg);
    this.renderObservationBlock();
  }

  /**
   * Open the panel for a Messier deep-sky object. Like `showStarBasic` but
   * uses a stable `messier:<id>` key so the observation log can persist
   * "I've seen M31" across sessions even if the user re-imports the
   * catalogue or changes language.
   */
  showMessier(m: import('../data/messier').MessierObject): void {
    this.currentId = `messier:${m.id}`;
    this.el.classList.add('visible');
    this.updateCompactState();
    const gotoBtn = document.getElementById('info-goto');
    if (gotoBtn) gotoBtn.style.display = '';
    const actionRow = document.getElementById('info-action-row');
    if (actionRow) actionRow.style.display = 'flex';
    delete (this.nameEl as HTMLElement).dataset.bodyId;
    delete (this.nameEl as HTMLElement).dataset.starId;
    (this.nameEl as HTMLElement).dataset.unnamedStarRa = String(m.raHours);
    (this.nameEl as HTMLElement).dataset.unnamedStarDec = String(m.decDeg);

    this.nameEl.textContent = `${m.id} · ${m.name}`;
    this.subtitleEl.textContent = `RA ${m.raHours.toFixed(4)}h Dec ${m.decDeg >= 0 ? '+' : ''}${m.decDeg.toFixed(4)}° · m=${m.magnitude.toFixed(2)} · ${m.type}`;

    const rows: [string, string][] = [];
    rows.push(['類型', m.type]);
    rows.push(['星座', m.constellation]);
    rows.push(['赤經 (J2000)', formatRA(m.raHours)]);
    rows.push(['赤緯 (J2000)', `${m.decDeg >= 0 ? '+' : ''}${m.decDeg.toFixed(4)}°`]);
    rows.push(['視星等', `${m.magnitude >= 0 ? '+' : ''}${m.magnitude.toFixed(2)}`]);
    this.dataEl.innerHTML = rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');

    // Star-hopping hint: connect this DSO back to the nearest bright
    // anchor star via named-star waypoints. Helpful for finder-scope
    // observers who don't have GoTo. Only shown for genuinely faint
    // targets (mag > 4); brighter Messiers are usually visible
    // unaided once the user knows the constellation.
    let hopHtml = '';
    if (m.magnitude > 4) {
      const path = findStarHopPath(m.raHours, m.decDeg, m.id);
      if (path && path.length >= 2) {
        const steps = path.map((w, i) => {
          const isLast = i === path.length - 1;
          const isAnchor = i === 0;
          const wName = isLast ? `<b>${escapeHtml(w.name)}</b>` : escapeHtml(w.name);
          const arrow = isLast ? '' : ` <span style="color:var(--text-dim);">→ ${w.distanceToNextDeg.toFixed(1)}° ${bearingCardinal(w.bearingToNextDeg)}</span>`;
          const magBadge = isAnchor ? `<span style="color:#ffcc40;">m=${w.magnitude.toFixed(1)}</span>` : '';
          return `<span>${magBadge} ${wName}${arrow}</span>`;
        }).join(' · ');
        hopHtml = `<div class="info-section" style="margin-top:6px;padding:6px 8px;background:rgba(93,177,255,0.06);border-left:2px solid var(--accent);border-radius:4px;font-size:11px;line-height:1.6;">
          <div style="color:var(--accent);font-weight:600;margin-bottom:2px;">🔭 星橋路徑（從亮星跳到目標）</div>
          ${steps}
        </div>`;
      }
    }
    this.extraEl.innerHTML = hopHtml;
    this.planningEl.innerHTML = '';

    if (this.unsubscribe) this.unsubscribe();
    this.unsubscribe = this.clock.subscribe(() => {
      if (this.currentId === `messier:${m.id}` && this.el.classList.contains('visible')) {
        this.renderUnnamedDynamic(m.raHours, m.decDeg);
      }
    });
    this.renderUnnamedDynamic(m.raHours, m.decDeg);
    this.renderObservationBlock();
  }

  private renderUnnamedDynamic(raHours: number, decDeg: number): void {
    if (!this.cameraCtl) return;
    const altAz = this.cameraCtl.getStarAltAz(raHours, decDeg);
    if (!altAz) return;
    const dyn: [string, string][] = [
      ['仰角', `${altAz.altDeg >= 0 ? '+' : ''}${altAz.altDeg.toFixed(3)}°`],
      ['方位角', `${altAz.azDeg.toFixed(3)}°`],
      ...fieldDataRows(this.cameraCtl, altAz.altDeg, altAz.azDeg),
    ];
    this.dataEl.querySelectorAll('[data-dyn]').forEach(n => n.remove());
    this.dataEl.insertAdjacentHTML('beforeend',
      dyn.map(([k, v]) => `<dt data-dyn>${k}</dt><dd data-dyn>${v}</dd>`).join(''));
  }

  showStar(star: import('../data/stars').NamedStar): void {
    this.currentId = `star:${star.id}`;
    this.el.classList.add('visible');
    this.updateCompactState();
    const gotoBtn = document.getElementById('info-goto');
    if (gotoBtn) gotoBtn.style.display = '';
    const actionRow = document.getElementById('info-action-row');
    if (actionRow) actionRow.style.display = 'flex';
    delete (this.nameEl as HTMLElement).dataset.bodyId;
    (this.nameEl as HTMLElement).dataset.starId = star.id;
    this.renderStar(star);

    if (this.unsubscribe) this.unsubscribe();
    this.unsubscribe = this.clock.subscribe(() => {
      if (this.currentId === `star:${star.id}` && this.el.classList.contains('visible')) {
        this.renderStarDynamic(star);
      }
    });
    this.renderObservationBlock();
  }

  private renderStar(s: import('../data/stars').NamedStar): void {
    this.nameEl.textContent = s.name;
    const subtitleParts = [s.nameEn];
    if (s.bayer) subtitleParts.push(s.bayer);
    subtitleParts.push('恆星');
    this.subtitleEl.textContent = subtitleParts.join(' · ');

    const rows: [string, string][] = [];
    rows.push(['赤經 (J2000)', formatRA(s.raHours)]);
    rows.push(['赤緯 (J2000)', `${s.decDeg >= 0 ? '+' : ''}${s.decDeg.toFixed(4)}°`]);
    rows.push(['視星等', `${s.magnitude >= 0 ? '+' : ''}${s.magnitude.toFixed(2)}`]);
    if (s.pmRA != null && s.pmDec != null) {
      const total = Math.sqrt(s.pmRA * s.pmRA + s.pmDec * s.pmDec);
      rows.push(['自行', `${total.toFixed(1)} mas/yr`]);
    }

    this.dataEl.innerHTML = rows
      .map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`)
      .join('');

    // Description card
    const descHtml = s.description
      ? `<div class="info-section"><div class="info-text">${escapeHtml(s.description)}</div></div>`
      : `<div class="info-section"><div class="info-text" style="color:var(--text-dim);">夜空中可見的恆星之一。${s.bayer ? `Bayer 編號 ${s.bayer}。` : ''}</div></div>`;
    this.extraEl.innerHTML = descHtml;

    this.renderStarDynamic(s);
  }

  /**
   * Live-updated star observables: alt/az now (refraction-corrected),
   * hour angle, and a Stellarium-style observation status.
   */
  private renderStarDynamic(s: import('../data/stars').NamedStar): void {
    if (!this.cameraCtl) { this.planningEl.innerHTML = ''; return; }
    const cam = this.cameraCtl;
    const altAz = cam.getStarAltAz(s.raHours, s.decDeg, s.pmRA, s.pmDec);
    if (!altAz) {
      // Not in observer mode → just clear the dynamic part.
      this.dataEl.querySelectorAll('[data-dyn]').forEach(n => n.remove());
      this.planningEl.innerHTML = '';
      return;
    }
    const dyn: [string, string][] = [
      ['仰角', `${altAz.altDeg >= 0 ? '+' : ''}${altAz.altDeg.toFixed(3)}°`],
      ['方位角', `${altAz.azDeg.toFixed(3)}°`],
      ...fieldDataRows(cam, altAz.altDeg, altAz.azDeg),
    ];
    this.dataEl.querySelectorAll('[data-dyn]').forEach(n => n.remove());
    const html = dyn.map(([k, v]) => `<dt data-dyn>${k}</dt><dd data-dyn>${v}</dd>`).join('');
    this.dataEl.insertAdjacentHTML('beforeend', html);

    // Composite observability score (alt + sun + moon + Bortle). Replaces
    // the previous single-dimensional "alt-only" badge with a multi-factor
    // assessment per the explainable-simulator positioning.
    const obs = buildObservability(cam, altAz.altDeg, altAz.azDeg, s.magnitude);
    if (obs) {
      this.planningEl.innerHTML = observabilityBadgeHtml(obs);
    } else {
      // Outside observer mode → keep clean (don't display stale badge)
      this.planningEl.innerHTML = '';
    }
  }

  /**
   * Build the "已觀測 / 評分 / 筆記" block for the current target.
   *
   * Renders:
   *   - ✓ "Mark observed" toggle (becomes "Already observed N times" once set)
   *   - 5-star rating row (click to set/clear)
   *   - Notes textarea (debounced auto-save on blur)
   *
   * Hidden for the Sun and for non-target IDs (e.g. when nothing is loaded).
   * The block lives in `<div id="info-observation">` which we toggle
   * display:none/'' to avoid empty-card whitespace.
   */
  private renderObservationBlock(): void {
    const el = document.getElementById('info-observation');
    if (!el || !this.currentId) return;
    // Skip the sun — observing the sun isn't a typical log entry, and
    // it would litter the log with auto-marks every time the user clicks
    // it for info.
    if (this.currentId === 'sun') {
      el.style.display = 'none';
      el.innerHTML = '';
      return;
    }
    const { category, id } = parseTargetKey(this.currentId);
    const displayName = this.nameEl.textContent ?? id;
    const entry = getObsEntry(category, id);
    const observed = entry !== null;
    const rating = entry?.rating ?? 0;
    const notes = entry?.notes ?? '';

    el.style.display = '';
    const toggleLabel = observed
      ? `✓ 已觀測 · ${entry!.sessionCount} 次（最近 ${formatRelativeDate(entry!.lastObservedAt)}）`
      : '☐ 標記為已觀測';
    el.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;gap:6px;margin-bottom:4px;">
        <button id="obs-toggle" style="flex:1;text-align:left;background:${observed ? 'rgba(118,209,138,0.15)' : 'rgba(255,255,255,0.06)'};border:1px solid ${observed ? 'rgba(118,209,138,0.4)' : 'rgba(255,255,255,0.12)'};color:${observed ? '#76d18a' : 'var(--text)'};padding:5px 8px;border-radius:5px;cursor:pointer;font-size:11px;">${toggleLabel}</button>
        <div id="obs-stars" style="display:flex;gap:2px;font-size:14px;cursor:pointer;user-select:none;color:#ffcc40;" title="評分（再次點擊清除）">
          ${[1, 2, 3, 4, 5].map(n => `<span data-star="${n}" style="cursor:pointer;${n <= rating ? '' : 'opacity:0.3;'}">★</span>`).join('')}
        </div>
      </div>
      <textarea id="obs-notes" placeholder="筆記（自動儲存）" style="width:100%;min-height:42px;background:rgba(0,0,0,0.25);border:1px solid rgba(160,190,230,0.18);color:var(--text);padding:5px 7px;border-radius:5px;font-size:11px;font-family:inherit;resize:vertical;box-sizing:border-box;">${escapeHtml(notes)}</textarea>
    `;

    document.getElementById('obs-toggle')?.addEventListener('click', () => {
      if (observed) {
        unmarkObserved(category, id);
      } else {
        markObserved(category, id, displayName);
      }
      this.renderObservationBlock();
    });

    document.getElementById('obs-stars')?.addEventListener('click', (ev) => {
      const target = ev.target as HTMLElement | null;
      const n = target?.dataset.star ? parseInt(target.dataset.star, 10) : 0;
      if (!n) return;
      // Click on already-set rating → clear
      const newRating = (n === rating) ? null : n;
      updateRating(category, id, displayName, newRating);
      this.renderObservationBlock();
    });

    const notesEl = document.getElementById('obs-notes') as HTMLTextAreaElement | null;
    if (notesEl) {
      // Save on blur and after 1.5s of inactivity (debounce). Inactivity
      // saves protect against lost notes when the user closes the panel
      // mid-typing.
      let timeoutId: number | null = null;
      const flush = (): void => {
        if (notesEl.value === notes) return;
        updateNotes(category, id, displayName, notesEl.value);
      };
      notesEl.addEventListener('input', () => {
        if (timeoutId !== null) window.clearTimeout(timeoutId);
        timeoutId = window.setTimeout(flush, 1500);
      });
      notesEl.addEventListener('blur', flush);
    }
  }

  hide(): void {
    this.el.classList.remove('visible');
    this.currentId = null;
    const gotoBtn = document.getElementById('info-goto');
    if (gotoBtn) gotoBtn.style.display = 'none';
    const actionRow = document.getElementById('info-action-row');
    if (actionRow) actionRow.style.display = 'none';
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
  }

  /** Recompute whether the panel needs to shrink to share the right side. */
  updateCompactState(): void {
    const siteOpen = (document.getElementById('site-info')?.style.display ?? 'none') !== 'none';
    const calcOpen = (document.getElementById('calc-panel')?.style.display ?? 'none') !== 'none';
    const eventsOpen = (document.getElementById('auto-events-panel')?.style.display ?? 'none') !== 'none';
    this.el.classList.toggle('compact', siteOpen || calcOpen || eventsOpen);
  }

  private render(): void {
    if (!this.currentId) return;
    const entry = this.solarSystem.getBody(this.currentId);
    if (!entry) return;
    const d = entry.descriptor;

    this.nameEl.textContent = bodyName(d);
    const parentDesc = d.parentId ? this.solarSystem.getBody(d.parentId)?.descriptor : undefined;
    const parentName = parentDesc ? bodyName(parentDesc) : '';
    this.subtitleEl.textContent = parentName
      ? `${CATEGORY_LABEL[d.category]} · ${d.nameEn} · ${parentName}`
      : `${CATEGORY_LABEL[d.category]} · ${d.nameEn}`;

    const rows: [string, string][] = [];
    rows.push(['半徑', `${formatNumber(d.physical.radiusKm, 1)} km`]);
    rows.push(['質量', `${d.physical.massKg.toExponential(3)} kg`]);
    rows.push(['自轉週期', `${formatNumber(Math.abs(d.physical.rotationPeriodDays), 4)} 天${d.physical.rotationPeriodDays < 0 ? '（逆向）' : ''}`]);
    rows.push(['軸傾角', `${formatNumber(d.physical.axialTiltDeg, 2)}°`]);

    const el = d.propagator?.elements;
    if (el) {
      rows.push(['軌道半長軸', `${formatNumber(el.a, 4)} AU`]);
      rows.push(['離心率', `${formatNumber(el.e, 4)}`]);
      rows.push(['軌道傾角', `${formatNumber(el.iDeg, 2)}°`]);
      rows.push(['軌道週期', formatPeriod(el.periodDays)]);

      // Synodic period vs Earth — only meaningful for solar-system bodies
      // other than Earth itself, and only if Earth is in the system.
      if (d.id !== 'earth' && d.parentId == null) {
        const earth = this.solarSystem.getBody('earth');
        const earthEl = earth?.descriptor.propagator?.elements;
        if (earthEl) {
          const syn = synodicPeriod(el.periodDays, earthEl.periodDays);
          if (Number.isFinite(syn)) rows.push(['會合週期 (對地球)', formatPeriod(syn)]);
        }
      }

      // Hill sphere — meaningful for any body orbiting a primary. For
      // solar-system planets the primary is the Sun (mass 1.989e30 kg).
      // For moons we use the parent body's mass.
      const parentMassKg = d.parentId
        ? this.solarSystem.getBody(d.parentId)?.descriptor.physical.massKg
        : 1.989e30; // Sun
      if (parentMassKg && d.physical.massKg > 0) {
        const rH = hillSphereAU(el.a, el.e, d.physical.massKg, parentMassKg);
        rows.push(['希爾球半徑', formatHill(rH)]);
      }
    }

    if (d.details?.classification) {
      rows.push(['分類', langPick(d.details.classification)]);
    }
    if (d.details?.surfaceGravityMS2 != null) {
      rows.push(['表面重力', `${formatNumber(d.details.surfaceGravityMS2, 2)} m/s²`]);
    }
    if (d.details?.escapeVelocityKmS != null) {
      rows.push(['逃逸速度', `${formatNumber(d.details.escapeVelocityKmS, 2)} km/s`]);
    }
    if (d.details?.meanSurfaceTempC != null) {
      rows.push(['平均溫度', `${formatNumber(d.details.meanSurfaceTempC, 0)}°C`]);
    }
    if (d.details?.surfaceTempRangeC) {
      const [lo, hi] = d.details.surfaceTempRangeC;
      rows.push(['溫度範圍', `${formatNumber(lo, 0)}°C ~ ${formatNumber(hi, 0)}°C`]);
    }

    this.dataEl.innerHTML = rows
      .map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`)
      .join('');

    // Order: description → physics transparency → rest of detail sections.
    // Physics goes high up so it's discoverable without having to scroll
    // past atmospheric composition / internal structure / etc. on rich
    // bodies like Mars.
    const descText = d.description ? langPick(d.description) : '';
    const descHtml = descText
      ? `<div class="info-section"><div class="info-text">${escapeHtml(descText)}</div></div>`
      : '';
    this.extraEl.innerHTML =
      descHtml +
      this.renderPhysicsSection(d) +
      this.renderDetailSections(d.details, undefined);

    this.renderDynamic();
  }

  /**
   * "Physics transparency" — exposes which propagator is being used to
   * compute this body's position, where the orbital data originally came
   * from, and the current state vector at the simulation's clock time.
   *
   * Hidden behind a collapsed <details> so it doesn't dominate the panel.
   */
  private renderPhysicsSection(d: BodyDescriptor): string {
    const prop = d.propagator;
    if (!prop) return ''; // Sun has no propagator

    const kindLabel = prop.kind ? t(`physics.kind.${prop.kind}`) : prop.kind ?? '';

    // Current state vector — read at the clock's current jd. Fallback to
    // J2000 if no clock is wired in (shouldn't happen for visible bodies).
    const jd = this.clock?.getJd?.() ?? 2451545.0;
    let stateHtml = '';
    try {
      const sv = prop.stateAt(jd);
      const px = sv.position.x, py = sv.position.y, pz = sv.position.z;
      const r = Math.hypot(px, py, pz);
      const v = Math.hypot(sv.velocity.x, sv.velocity.y, sv.velocity.z);
      // For moons, the position is geocentric — annotate accordingly.
      const frameLabel = d.parentId
        ? `${t('physics.relativePos')} ${this.bodyShort(d.parentId)}`
        : t('physics.heliocentricPos');
      stateHtml = `
        <div style="font-size:11px;color:var(--text-dim);margin-top:6px;line-height:1.55;font-family:ui-monospace,monospace;">
          <div style="color:var(--accent);margin-bottom:2px;">${t('physics.state')} (JD ${jd.toFixed(3)})</div>
          <div>${frameLabel}: (${px.toFixed(4)}, ${py.toFixed(4)}, ${pz.toFixed(4)}) AU</div>
          <div>${t('physics.distance')}: ${r.toFixed(4)} AU = ${(r * AU_KM).toExponential(3)} km</div>
          <div>${t('physics.speed')}: ${v.toFixed(4)} AU/d = ${(v * AU_KM / 86400).toFixed(2)} km/s</div>
        </div>
      `;
    } catch {
      stateHtml = '';
    }

    // Orbital elements (if Keplerian)
    let elementsHtml = '';
    if (prop.elements) {
      const el = prop.elements;
      elementsHtml = `
        <div style="font-size:11px;color:var(--text-dim);margin-top:6px;line-height:1.55;font-family:ui-monospace,monospace;">
          <div style="color:var(--accent);margin-bottom:2px;">${t('physics.elements')}</div>
          <div>a = ${el.a.toFixed(6)} AU</div>
          <div>e = ${el.e.toFixed(6)}</div>
          <div>i = ${el.iDeg.toFixed(4)}°</div>
          <div>Ω = ${el.ΩDeg.toFixed(4)}°</div>
          <div>ω = ${el.ωDeg.toFixed(4)}°</div>
        </div>
      `;
    }

    // Source attribution
    let sourceHtml = '';
    if (prop.source) {
      const s = prop.source;
      const linkLabel = s.url
        ? `<a href="${escapeHtml(s.url)}" target="_blank" rel="noopener noreferrer" style="color:var(--accent);text-decoration:none;border-bottom:1px dotted var(--accent);">${escapeHtml(s.label)} ↗</a>`
        : escapeHtml(s.label);
      sourceHtml = `
        <div style="font-size:11px;color:var(--text-dim);margin-top:6px;line-height:1.55;">
          <div style="color:var(--accent);margin-bottom:2px;">${t('physics.source')}</div>
          <div>${linkLabel}</div>
          ${s.note ? `<div style="opacity:0.8;font-style:italic;">${escapeHtml(s.note)}</div>` : ''}
        </div>
      `;
    }

    return `
      <details class="info-section physics-details" style="margin-top:6px;background:rgba(93,177,255,0.05);border:1px solid rgba(93,177,255,0.18);border-radius:6px;padding:6px 10px;">
        <summary style="cursor:pointer;color:var(--accent);font-size:12px;font-weight:600;list-style:none;user-select:none;">
          ${t('physics.title')}（${kindLabel}）
        </summary>
        <div style="padding:4px 0 2px 0;margin-top:4px;border-top:1px dashed rgba(93,177,255,0.18);">
          ${elementsHtml}
          ${stateHtml}
          ${sourceHtml}
        </div>
      </details>
    `;
  }

  private bodyShort(id: string): string {
    const b = this.solarSystem.getBody(id)?.descriptor;
    return b ? bodyName(b) : id;
  }

  private renderDetailSections(details: BodyDescriptor['details'], description?: string): string {
    let html = '';
    const d = details;

    if (description) {
      html += `<div class="info-section"><div class="info-text">${escapeHtml(langPick(description))}</div></div>`;
    }

    if (d?.meanSurfaceTempC != null || d?.surfaceTempRangeC) {
      html += sectionTitle('表面溫度');
      html += tempGaugeHtml(d.meanSurfaceTempC, d.surfaceTempRangeC);
    }

    if (d?.bulkComposition) {
      html += sectionTitle('組成（質量比）');
      const list = d.bulkComposition.map(c => ({ name: langPick(c.name), pct: c.pct }));
      html += pieChartSvg(list);
      html += compositionListHtml(list);
    }

    if (d?.atmosphere) {
      html += sectionTitle('大氣');
      if (d.atmosphere.surfacePressureKpa != null) {
        html += `<div class="info-text"><b style="color:var(--accent);">表面氣壓</b> ${formatNumber(d.atmosphere.surfacePressureKpa, 2)} kPa</div>`;
      }
      if (d.atmosphere.pressureNote) {
        html += `<div class="info-text" style="color:var(--text-dim);">${escapeHtml(langPick(d.atmosphere.pressureNote))}</div>`;
      }
      const atm = d.atmosphere.composition.map(c => ({ name: langPick(c.name), pct: c.pct }));
      html += pieChartSvg(atm);
      html += compositionListHtml(atm);
    }

    if (d?.internalStructure) {
      html += sectionTitle('內部結構（剖面）');
      html += '<div class="info-layers">';
      for (const layer of d.internalStructure) {
        html += `<div class="info-layer"><b>${escapeHtml(langPick(layer.layer))}</b><span>${escapeHtml(langPick(layer.description))}</span></div>`;
      }
      html += '</div>';
    }

    if (d?.geology) {
      html += sectionTitle('地質 / 表面');
      html += `<div class="info-text">${escapeHtml(langPick(d.geology))}</div>`;
    }

    if (d?.notableFacts && d.notableFacts.length > 0) {
      html += sectionTitle('註記');
      html += '<ul class="info-list">';
      for (const f of d.notableFacts) html += `<li>${escapeHtml(langPick(f))}</li>`;
      html += '</ul>';
    }

    return html;
  }

  private renderDynamic(): void {
    if (!this.currentId) return;
    const entry = this.solarSystem.getBody(this.currentId);
    if (!entry || !entry.descriptor.propagator) return;
    const d = entry.descriptor;

    const jd = this.clock.getJd();
    const sv = d.propagator!.stateAt(jd);
    const dist = sv.position.length();
    const speed = sv.velocity.length();
    const speedKmS = speed * AU_KM / 86400;

    const parentName = d.parentId ? this.solarSystem.getBody(d.parentId)?.descriptor.name : '太陽';
    const dynRows: [string, string][] = [
      [`目前距${parentName}`, `${formatNumber(dist, 4)} AU`],
      ['軌道速度', `${formatNumber(speedKmS, 2)} km/s`],
    ];

    // Field-observable rows (airmass / 距月球 / 地平警示) — only when in
    // observer mode AND body has a topocentric alt/az we can resolve.
    if (this.cameraCtl && this.cameraCtl.getMode() === 'observer') {
      const altAz = this.cameraCtl.getBodyAltAz(this.currentId);
      if (altAz && this.currentId !== 'moon') {
        // Skip moon-distance for the moon itself (would always be 0°).
        dynRows.push(...fieldDataRows(this.cameraCtl, altAz.altDeg, altAz.azDeg));
      } else if (altAz && this.currentId === 'moon') {
        // For the moon target itself, only airmass + horizon warning make sense.
        if (altAz.altDeg > 0) {
          const am = 1 / Math.sin(altAz.altDeg * Math.PI / 180);
          if (am < 30) dynRows.push(['Airmass', am < 10 ? am.toFixed(2) : am.toFixed(0)]);
        }
        if (altAz.altDeg > 0 && altAz.altDeg < 5) {
          dynRows.push(['⚠️ 地平警示', `仰角僅 ${altAz.altDeg.toFixed(1)}°`]);
        }
      }
    }

    // Earth-observed apparent magnitude / phase / angular diameter.
    // Only computed for solar-system bodies (not stars, not Sun itself).
    // For the Moon we feed its geocentric position (its propagator is
    // Earth-relative); for everything else we feed heliocentric.
    if (d.category !== 'star' && d.id !== 'sun') {
      const earth = this.solarSystem.getBody('earth');
      const earthHelio = earth?.descriptor.propagator?.stateAt(jd).position;
      if (earthHelio) {
        const obs = d.parentId === 'earth'
          ? moonObservables(sv.position, earthHelio, d.physical.radiusKm)
          : bodyObservables(d.id, sv.position, earthHelio, d.physical.radiusKm);
        dynRows.push(['距地球', `${formatNumber(obs.observerDistanceAU, 4)} AU`]);
        if (Number.isFinite(obs.apparentMagnitude)) {
          dynRows.push(['視星等', `${formatMag(obs.apparentMagnitude)}`]);
        }
        dynRows.push(['相位角', `${formatNumber(obs.phaseAngleDeg, 1)}°  (照明 ${(obs.illuminatedFraction * 100).toFixed(1)}%)`]);
        dynRows.push(['視直徑', formatAngularSize(obs.angularDiameterArcsec)]);
      }
    } else if (d.id === 'sun') {
      // Sun: angular diameter from Earth varies with distance; we can
      // still derive it from Earth's heliocentric distance since the Sun
      // sits at the origin in our scene.
      const earth = this.solarSystem.getBody('earth');
      const earthHelio = earth?.descriptor.propagator?.stateAt(jd).position;
      if (earthHelio) {
        const distFromEarth = earthHelio.length();
        dynRows.push(['距地球', `${formatNumber(distFromEarth, 4)} AU`]);
        const angDiam = (2 * Math.atan(d.physical.radiusKm / (distFromEarth * AU_KM))) * 206264.806;
        dynRows.push(['視直徑', formatAngularSize(angDiam)]);
        dynRows.push(['視星等', '−26.74']);
      }
    }
    void Vector3;

    const fixed = this.dataEl.querySelectorAll('dt, dd');
    const dynHtml = dynRows.map(([k, v]) => `<dt data-dyn>${k}</dt><dd data-dyn>${v}</dd>`).join('');

    this.dataEl.querySelectorAll('[data-dyn]').forEach(n => n.remove());
    this.dataEl.insertAdjacentHTML('beforeend', dynHtml);
    void fixed;

    this.renderPlanning(d.id);
  }

  /**
   * Observation-planning card: only shown for solar-system bodies in
   * observer mode. Computes transit time, optimal window, rise/set, and
   * looks up the next major event (opposition, conjunction, etc.) from
   * the eventScanner-driven future-events panel.
   */
  private renderPlanning(bodyId: string): void {
    if (!this.cameraCtl || this.cameraCtl.getMode() !== 'observer') {
      this.planningEl.innerHTML = '';
      return;
    }
    // Skip planning for stars and Sun's parent-less location.
    const entry = this.solarSystem.getBody(bodyId);
    if (!entry || entry.descriptor.category === 'star') {
      this.planningEl.innerHTML = '';
      return;
    }
    const cam = this.cameraCtl;
    const jd = this.clock.getJd();
    const { lat, lon } = cam.getObserverLocation();

    const bodyAltAt = (t: number): number => {
      const aa = cam.getBodyAltAzAt(bodyId, t);
      return aa ? aa.altDeg : NaN;
    };
    const sunAltAt = (t: number): number => sunAltitudeDeg(t, lat, lon);

    const altNow = bodyAltAt(jd);
    const sunAltNow = sunAltAt(jd);
    if (!Number.isFinite(altNow)) { this.planningEl.innerHTML = ''; return; }

    const vis = currentVisibility(altNow, sunAltNow);

    // Next transit (≤ 1.5 days ahead — handles slow-moving outer planets
    // whose transit can be just over 24h after sidereal day).
    const transit = findNextTransit(bodyAltAt, jd, 1.5);

    // Next set: only meaningful if currently above horizon.
    // Next rise: only if currently below.
    const SET_ALT = -0.583; // body horizon (refraction-included; matches sun)
    let nextSetJd: number | null = null;
    let nextRiseJd: number | null = null;
    if (vis.aboveHorizon) {
      nextSetJd = findNextCrossing(bodyAltAt, jd, SET_ALT, 'set', 1.5);
    } else {
      nextRiseJd = findNextCrossing(bodyAltAt, jd, SET_ALT, 'rise', 1.5);
    }

    // Optimal window: ≥ 30° altitude AND nautical-twilight-or-darker.
    const window = findOptimalWindow(bodyAltAt, sunAltAt, jd, 30, -12, 1);

    // Format helpers.
    const timezoneOffsetMin = (lon / 15) * 60;
    const fmtTime = (t: number | null): string => {
      if (t == null) return '—';
      const d = jdToDate(t + timezoneOffsetMin / 1440);
      return `${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`;
    };
    const fmtRelative = (t: number | null): string => {
      if (t == null) return '—';
      const dh = (t - jd) * 24;
      if (dh < 1) return `${Math.round(dh * 60)} 分後`;
      if (dh < 48) return `${dh.toFixed(1)} 小時後`;
      return `${(dh / 24).toFixed(1)} 天後`;
    };

    const rows: [string, string][] = [];
    if (transit) {
      rows.push(['下次過中天', `${fmtTime(transit.jd)} (${fmtRelative(transit.jd)})`]);
      rows.push(['過中天高度', `${transit.altDeg >= 0 ? '+' : ''}${transit.altDeg.toFixed(1)}°`]);
    }
    if (nextRiseJd != null) {
      rows.push(['下次升起', `${fmtTime(nextRiseJd)} (${fmtRelative(nextRiseJd)})`]);
    }
    if (nextSetJd != null) {
      rows.push(['下次西沒', `${fmtTime(nextSetJd)} (${fmtRelative(nextSetJd)})`]);
    }

    let windowHtml = '';
    if (window) {
      windowHtml = `<div class="planning-window">` +
        `今晚最佳觀測：<span class="strong">${fmtTime(window.startJd)} – ${fmtTime(window.endJd)}</span>` +
        ` （${window.durationHours.toFixed(1)} 小時，仰角 ≥ 30° 且海上昏影後）` +
        `</div>`;
    } else {
      windowHtml = `<div class="planning-window">今晚未達 30° 仰角的暗夜窗。</div>`;
    }

    // Next major event for this body — pulled from the eventScanner
    // results that drive the future-events panel. Pruned to ≤ 365 days
    // ahead so it stays relevant ("next opposition in 8 months", not
    // "in 4 years").
    let nextEventHtml = '';
    if (this.eventsPanel) {
      const ev = this.eventsPanel.getNextEventFor(bodyId);
      if (ev) {
        const days = ev.jd - jd;
        if (days < 365) {
          const dateStr = ev.date.toISOString().slice(0, 10);
          const rel = days < 1 ? `${Math.round(days * 24)} 小時後`
                   : days < 60 ? `${Math.round(days)} 天後`
                   : `${(days / 30).toFixed(1)} 個月後`;
          nextEventHtml = `<div class="planning-window">` +
            `下一個重要事件：<span class="strong">${dateStr} ${getEventKindShort(ev.kind)}</span>（${rel}）` +
            `</div>`;
        }
      }
    }

    this.planningEl.innerHTML =
      `<div class="planning-card">` +
        `<div class="planning-status">${vis.statusLabel}（仰角 ${altNow >= 0 ? '+' : ''}${altNow.toFixed(1)}°）</div>` +
        `<dl class="planning-grid">` +
          rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('') +
        `</dl>` +
        windowHtml +
        nextEventHtml +
      `</div>`;
  }
}

/** Compact label for an event kind, used in the planning footer. */
function getEventKindShort(kind: string): string {
  const m: Record<string, string> = {
    'opposition': '衝',
    'conjunction-sup': '上合',
    'conjunction-inf': '下合',
    'elongation-east': '東大距',
    'elongation-west': '西大距',
    'new-moon': '新月',
    'full-moon': '滿月',
    'solar-eclipse': '日食',
    'lunar-eclipse': '月食',
    'transit': '凌日',
    'occultation': '月掩星',
    'equinox': '分點',
    'solstice': '至點',
    'perihelion': '近日點',
    'aphelion': '遠日點',
    'planet-conjunction': '行星合',
  };
  return m[kind] ?? kind;
}

function pad2(n: number): string {
  return n.toString().padStart(2, '0');
}

/** Decimal hours → "Xh YYm ZZ.Zs" format. */
function formatRA(raHours: number): string {
  const h = Math.floor(raHours);
  const m = (raHours - h) * 60;
  const mInt = Math.floor(m);
  const s = (m - mInt) * 60;
  return `${h}h ${pad2(mInt)}m ${s.toFixed(1)}s`;
}

function formatNumber(n: number, digits: number): string {
  if (Math.abs(n) >= 1000) {
    return n.toLocaleString('en-US', { maximumFractionDigits: 0 });
  }
  return n.toLocaleString('en-US', { maximumFractionDigits: digits, minimumFractionDigits: Math.min(digits, 2) });
}

function formatPeriod(days: number): string {
  if (days < 1) return `${formatNumber(days * 24, 2)} 小時`;
  if (days < 1000) return `${formatNumber(days, 2)} 天`;
  const years = days / 365.256;
  return `${formatNumber(years, 2)} 年`;
}

function formatHill(rAU: number): string {
  const km = rAU * AU_KM;
  if (rAU >= 0.01) return `${formatNumber(rAU, 4)} AU`;
  if (km >= 1000) return `${formatNumber(km / 1000, 2)} 千 km`;
  return `${formatNumber(km, 0)} km`;
}

/** Apparent magnitude with proper sign + 2-decimal formatting. */
function formatMag(m: number): string {
  const sign = m < 0 ? '−' : '+';
  return `${sign}${Math.abs(m).toFixed(2)}`;
}

/** Format angular size with appropriate unit (″ < 60 → arcsec, < 60′ → arcmin, else degrees). */
function formatAngularSize(arcsec: number): string {
  if (arcsec < 60) return `${arcsec.toFixed(1)}″`;
  const arcmin = arcsec / 60;
  if (arcmin < 60) return `${arcmin.toFixed(2)}′`;
  return `${(arcmin / 60).toFixed(2)}°`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Plain-language relative date for the observation log: "3 天前", "剛剛",
 * "8 個月前". Bias toward short / readable; absolute date for old entries.
 */
function formatRelativeDate(ms: number): string {
  const diffMs = Date.now() - ms;
  const sec = Math.round(diffMs / 1000);
  if (sec < 30) return '剛剛';
  const min = Math.round(sec / 60);
  if (min < 60) return `${min} 分鐘前`;
  const hr = Math.round(min / 60);
  if (hr < 48) return `${hr} 小時前`;
  const day = Math.round(hr / 24);
  if (day < 60) return `${day} 天前`;
  const mo = Math.round(day / 30);
  if (mo < 24) return `${mo} 個月前`;
  return new Date(ms).toISOString().slice(0, 10);
}

function sectionTitle(text: string): string {
  return `<div class="info-section-title">${escapeHtml(text)}</div>`;
}
