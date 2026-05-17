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
import { EXOPLANET_SYSTEMS } from '../data/exoplanetSystems';
import { MESSIER_ANG_SIZES, messierSurfaceBrightness } from '../data/messier';
import { renderStackedPreview, type DSOKind } from './stackedPreview';
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
  const label = r.rating === 'good' ? t('info.cond.good')
              : r.rating === 'marginal' ? t('info.cond.marginal')
              : r.rating === 'poor' ? t('info.cond.poor')
              : t('info.cond.invisible');
  const reasons = r.reasons.length > 0
    ? `<ul style="margin:4px 0 0 0;padding-left:18px;">${r.reasons.slice(0, 3).map(s => `<li>${s}</li>`).join('')}</ul>`
    : '';
  return `<div class="planning-card">` +
           `<div class="planning-status"><b>${t('info.title.tonightVisibility')} — ${label}</b></div>` +
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
    const moonStatus = moonAltAz.altDeg < 0 ? t('info.row.moonBelowHorizon')
                     : moonDeg < 30 ? '⚠️'
                     : moonDeg < 60 ? ''
                     : '✓';
    rows.push([t('info.row.distFromMoon'), `${moonDeg.toFixed(1)}° ${moonStatus}`.trim()]);
  }

  // Low-horizon warning: alt < 5° usually unreachable behind buildings/
  // terrain even at flat sites. Surface as a row so the user notices.
  if (targetAltDeg > 0 && targetAltDeg < 5) {
    rows.push([t('info.warn.altLow'), `${t('info.warn.altOnlyMsg')} ${targetAltDeg.toFixed(1)}°, ${t('info.warn.altLowMsg')}`]);
  }

  return rows;
}

/**
 * Localised category label. Resolved at call-time (not module-load time),
 * because if we cache the map at module init, switching language later
 * leaves the panel's subtitle stuck on the language at first import.
 */
function categoryLabel(cat: BodyDescriptor['category']): string {
  return t(`info.cat.${cat}`);
}

export class InfoPanel {
  private readonly el: HTMLElement;
  private readonly nameEl: HTMLElement;
  private readonly subtitleEl: HTMLElement;
  private readonly dataEl: HTMLElement;
  private readonly planningEl: HTMLElement;
  private readonly extraEl: HTMLElement;
  private currentId: string | null = null;
  /** Cached named-star object so the GoTo button can re-aim with proper motion. */
  private lastNamedStar: import('../data/stars').NamedStar | null = null;
  private unsubscribe: (() => void) | null = null;

  /** Read-only accessor used by share-URL serialisation so a permalink
   *  can encode "the user was looking at this body". */
  getCurrentId(): string | null { return this.currentId; }

  /** Hide the queue-add button. Called by every non-Messier show*
   *  path; Messier path re-shows + populates after. Cheap idempotent. */
  private hideQueueButton(): void {
    const btn = document.getElementById('info-queue-add');
    if (btn) (btn as HTMLElement).style.display = 'none';
  }

  /** Stacked-preview HTML stashed by the DSO show methods; rendered
   *  ahead of star-hop hints in extraEl. Cleared by hideQueueButton. */
  private previewHtmlForExtra = '';

  private cameraCtl: CameraController | null = null;
  private eventsPanel: EventsPanel | null = null;
  private observationQueuePanel: import('./ObservationQueuePanel').ObservationQueuePanel | null = null;
  setObservationQueuePanel(p: import('./ObservationQueuePanel').ObservationQueuePanel): void {
    this.observationQueuePanel = p;
  }

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
      if (!this.currentId) return;
      // Exoplanet panels live outside the body registry, so render()
      // — which dispatches on getBody(currentId) — would no-op for
      // them. Re-call showExoplanetSystem with the cached meta so the
      // host name, planet list, "Land on..." button, and per-row
      // descriptions all pick up the new language.
      if (this.currentId.startsWith('exo:')) {
        const sysId = this.currentId.slice(4);
        const meta = EXOPLANET_SYSTEMS.find(s => s.id === sysId);
        if (meta) this.showExoplanetSystem(meta);
        return;
      }
      this.render();
    });

    // GoTo: in observer mode, aim the observer's view at the selected
    // target. Handles four kinds of currentId:
    //   "mars"               → body, use getBodyAltAz
    //   "star:vega"          → named star, look up RA/Dec from NAMED_STARS
    //   "messier:M31"        → DSO, look up from messier dataset
    //   "unnamed:RA_Dec"     → catalogue HYG star, parse RA/Dec from dataset
    // Outside observer mode, falls back to follow-body for the body case
    // (the others have no analog).
    document.getElementById('info-goto')?.addEventListener('click', () => {
      if (!this.currentId) return;
      const cam = this.cameraCtl;
      if (!cam) return;
      const id = this.currentId;
      if (cam.getMode() === 'observer') {
        cam.setObserverFollow(null);
        let altAz: { altDeg: number; azDeg: number } | null = null;

        if (id.startsWith('unnamed:')) {
          const ra = parseFloat((this.nameEl as HTMLElement).dataset.unnamedStarRa ?? '');
          const dec = parseFloat((this.nameEl as HTMLElement).dataset.unnamedStarDec ?? '');
          if (Number.isFinite(ra) && Number.isFinite(dec)) {
            altAz = cam.getStarAltAz(ra, dec);
          }
        } else if (id.startsWith('star:')) {
          const named = this.lastNamedStar;
          if (named && this.currentId === `star:${named.id}`) {
            altAz = cam.getStarAltAz(named.raHours, named.decDeg, named.pmRA, named.pmDec);
          }
        } else if (id.startsWith('messier:')) {
          // showMessier reuses the unnamed-star dataset attrs.
          const ra = parseFloat((this.nameEl as HTMLElement).dataset.unnamedStarRa ?? '');
          const dec = parseFloat((this.nameEl as HTMLElement).dataset.unnamedStarDec ?? '');
          if (Number.isFinite(ra) && Number.isFinite(dec)) {
            altAz = cam.getStarAltAz(ra, dec);
          }
        } else {
          // Plain body id.
          altAz = cam.getBodyAltAz(id);
        }
        if (altAz) cam.setObserverLook(altAz.azDeg, altAz.altDeg);
      } else if (!id.includes(':')) {
        const sel = document.getElementById('follow-body') as HTMLSelectElement | null;
        if (sel) {
          sel.value = id;
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
      const label = entry ? bodyName(entry.descriptor) : this.currentId;
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

    // 📋 Add-to-queue: persist a QueueTarget for the smart-telescope
    // session planner. The button shows only for catalogue entries
    // where surface brightness is meaningful — Messier (showMessier
    // populates a dataset attribute pre-existing-fetched), NGC named
    // (NGC_DATA), and Sharpless 2 (when a Sharpless InfoPanel path
    // exists). We read state off the rendered button's dataset
    // (data-queue-source / data-queue-target) so the wiring stays
    // here and per-render code is just markup.
    document.getElementById('info-queue-add')?.addEventListener('click', () => {
      const btn = document.getElementById('info-queue-add') as HTMLButtonElement | null;
      if (!btn) return;
      const targetJson = btn.dataset.queueTarget;
      if (!targetJson) return;
      try {
        const target = JSON.parse(targetJson) as import('../physics/observationQueue').QueueTarget;
        // Stamp the add time at click-time, not at button-build time.
        target.addedAt = Date.now();
        void import('../data/observationQueueStore').then(({ addToQueue }) => {
          addToQueue(target);
          this.observationQueuePanel?.refreshIfOpen();
          // Lightweight feedback — temporarily swap the icon to a
          // check, then back.
          const orig = btn.textContent;
          btn.textContent = '✓';
          setTimeout(() => { btn.textContent = orig; }, 1500);
        });
      } catch (err) {
        console.warn('queue-add: invalid target', err);
      }
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
    this.hideQueueButton();
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
   * Show an exoplanet system summary. Reuses the standard data/extra
   * panes — host star physics + a planet roster + system blurb. Each
   * planet in the system is also added to the body registry on the
   * fly via SolarSystem so that follow-up clicks (or future "fly
   * here") work the same as for our own planets.
   */
  showExoplanetSystem(sys: import('../data/exoplanetSystems').ExoplanetSystemMeta): void {
    this.hideQueueButton();
    this.currentId = `exo:${sys.id}`;
    this.el.classList.add('visible');
    this.updateCompactState();
    const gotoBtn = document.getElementById('info-goto');
    if (gotoBtn) gotoBtn.style.display = 'none';
    const actionRow = document.getElementById('info-action-row');
    if (actionRow) actionRow.style.display = 'none';
    if (this.unsubscribe) { this.unsubscribe(); this.unsubscribe = null; }

    const name = langPick(sys.name);
    this.nameEl.textContent = name;
    delete (this.nameEl as HTMLElement).dataset.bodyId;
    delete (this.nameEl as HTMLElement).dataset.starId;
    this.subtitleEl.textContent = `${t('info.cat.star')} · ${sys.planets.length} ${t('info.cat.planet')} · ${sys.distanceLy.toFixed(2)} ly`;

    const rows: [string, string][] = [
      [t('info.row.distFromEarth'), `${sys.distanceLy.toFixed(2)} ly`],
      [t('info.row.ra2000'), `${sys.raHours.toFixed(4)} h`],
      [t('info.row.dec2000'), `${sys.decDeg.toFixed(4)}°`],
      [t('info.row.radius'), `${formatNumber(sys.host.physical.radiusKm, 0)} km (${(sys.host.physical.radiusKm / 695700).toFixed(3)} R☉)`],
      [t('info.row.mass'), `${sys.host.physical.massKg.toExponential(3)} kg (${(sys.host.physical.massKg / 1.989e30).toFixed(3)} M☉)`],
    ];
    this.dataEl.innerHTML = rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');

    // Description + planet roster
    const desc = `<div class="info-section"><div class="info-text">${escapeHtml(langPick(sys.description))}</div></div>`;
    const visitBtn = sys.planets.length > 0
      ? `<button id="visit-exoplanet-${sys.id}" data-exo-visit-id="${sys.id}"
            style="display:block;width:100%;margin:8px 0;padding:8px 14px;font-size:12px;font-weight:600;
                   background:linear-gradient(135deg,#4a8eff,#5db1ff);color:#001a33;border:0;border-radius:6px;
                   cursor:pointer;font-family:inherit;">
            🚀 ${t('exo.visitSystem')}
          </button>`
      : '';
    const planetList = sys.planets.length === 0
      ? ''
      : `<div class="info-section">
           <div class="info-section-title">${escapeHtml(t('info.cat.planet'))} × ${sys.planets.length}</div>
           ${sys.planets.map(p => `
             <div style="font-size:11px;line-height:1.55;margin:4px 0;padding:4px 6px;background:rgba(93,177,255,0.04);border-left:2px solid var(--panel-border);border-radius:3px;">
               <b>${escapeHtml(p.nameEn)}</b> &mdash; ${langPick(p.description ?? { 'zh-Hant': '', en: '', ja: '' })}
               <div style="color:var(--text-dim);font-family:ui-monospace,monospace;font-size:10px;margin-top:2px;">
                 a = ${p.propagator?.elements?.a.toFixed(5)} AU,
                 P = ${formatPeriod(p.propagator?.elements?.periodDays ?? 0)},
                 e = ${p.propagator?.elements?.e.toFixed(4) ?? '—'}
               </div>
             </div>`).join('')}
         </div>`;
    this.extraEl.innerHTML = desc + visitBtn + planetList;
    this.planningEl.innerHTML = '';

    // Wire the visit button — actual activation happens via a custom
    // event so main.ts can drive camera animation alongside.
    const btn = document.getElementById(`visit-exoplanet-${sys.id}`);
    btn?.addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('sim:exo-visit', { detail: { id: sys.id } }));
    });
  }

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
    this.hideQueueButton();
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

    this.nameEl.textContent = t('info.title.starHyg');
    this.subtitleEl.textContent = `RA ${raHours.toFixed(4)}h Dec ${decDeg >= 0 ? '+' : ''}${decDeg.toFixed(4)}° · m=${magnitude.toFixed(2)}`;

    const rows: [string, string][] = [];
    rows.push([t('info.row.ra2000'), formatRA(raHours)]);
    rows.push([t('info.row.dec2000'), `${decDeg >= 0 ? '+' : ''}${decDeg.toFixed(4)}°`]);
    rows.push([t('info.row.magnitude'), `${magnitude >= 0 ? '+' : ''}${magnitude.toFixed(2)}`]);
    this.dataEl.innerHTML = rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');
    this.extraEl.innerHTML = `<div class="info-section"><div class="info-text" style="color:var(--text-dim);">${t('info.text.starHygFallback')}</div></div>`;
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
    rows.push([t('info.row.type'), m.type]);
    rows.push([t('info.row.constellation'), m.constellation]);
    rows.push([t('info.row.ra2000'), formatRA(m.raHours)]);
    rows.push([t('info.row.dec2000'), `${m.decDeg >= 0 ? '+' : ''}${m.decDeg.toFixed(4)}°`]);
    rows.push([t('info.row.magnitude'), `${m.magnitude >= 0 ? '+' : ''}${m.magnitude.toFixed(2)}`]);
    // Apparent angular extent + surface brightness — critical numbers for
    // the smart-telescope crowd ("will this fit my Seestar's FOV / is it
    // bright enough per pixel to stack out from light pollution?"). The
    // standard visual magnitude is misleading for diffuse objects (M33 is
    // mag 5.7 but you can't see it from suburbia because it's spread over
    // 1° of sky); surface brightness is the better predictor.
    const axes = MESSIER_ANG_SIZES[m.id];
    let sbValue = NaN;
    if (axes) {
      const [major, minor] = axes;
      const sizeStr = major === minor
        ? `${major.toFixed(1)}′`
        : `${major.toFixed(1)}′ × ${minor.toFixed(1)}′`;
      rows.push([t('info.row.apparentSize'), sizeStr]);
      sbValue = messierSurfaceBrightness(m.id, m.magnitude);
      if (Number.isFinite(sbValue)) {
        rows.push([t('info.row.surfaceBrightness'), `${sbValue.toFixed(1)} mag/arcsec²`]);
      }
    }
    this.dataEl.innerHTML = rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');

    // Stacked-preview thumbnail — what a smart-scope's 30 min stack
    // would roughly look like. Prepend to the existing extraHtml that
    // showMessier's caller (star-hop hint) builds further down.
    const previewKind = messierTypeToKind(m.type);
    const previewSize = axes?.[0] ?? 8;
    const previewMinor = axes?.[1];
    const seed = numericSeedFromId(m.id);
    const previewSrc = renderStackedPreview({
      kind: previewKind,
      majorArcmin: previewSize,
      minorArcmin: previewMinor,
      paDeg: 0,
      magnitude: m.magnitude,
      seed,
    });
    this.previewHtmlForExtra = `
      <div class="info-section info-preview-wrap">
        <div class="info-preview-label">${t('info.preview.label')}</div>
        <img class="info-preview-thumb" src="${previewSrc}"
             alt="simulated preview"
             title="${t('info.preview.tooltip')}" />
      </div>
    `;

    // Stash a serialised QueueTarget on the add-to-queue button so
    // its click handler doesn't need to re-resolve catalogue data.
    // Only show the button when surface brightness is computable
    // (otherwise the integration-time estimate would be blank).
    const queueBtn = document.getElementById('info-queue-add') as HTMLButtonElement | null;
    if (queueBtn) {
      if (Number.isFinite(sbValue)) {
        const target: import('../physics/observationQueue').QueueTarget = {
          id: `messier:${m.id}`,
          label: `${m.id} · ${m.name}`,
          source: 'messier',
          surfaceBrightness: sbValue,
          magnitude: m.magnitude,
          raHours: m.raHours,
          decDeg: m.decDeg,
          scope: 'seestar-s50',  // default; per-target overridable in panel
          overrideMinutes: null,
          addedAt: 0,            // stamped at actual add-click time
        };
        queueBtn.dataset.queueTarget = JSON.stringify(target);
        queueBtn.style.display = '';
      } else {
        delete queueBtn.dataset.queueTarget;
        queueBtn.style.display = 'none';
      }
    }

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
    this.extraEl.innerHTML = this.previewHtmlForExtra + hopHtml;
    this.previewHtmlForExtra = '';
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
      [t('info.row.altitude'), `${altAz.altDeg >= 0 ? '+' : ''}${altAz.altDeg.toFixed(3)}°`],
      [t('info.row.azimuth'), `${altAz.azDeg.toFixed(3)}°`],
      ...fieldDataRows(this.cameraCtl, altAz.altDeg, altAz.azDeg),
    ];
    this.dataEl.querySelectorAll('[data-dyn]').forEach(n => n.remove());
    this.dataEl.insertAdjacentHTML('beforeend',
      dyn.map(([k, v]) => `<dt data-dyn>${k}</dt><dd data-dyn>${v}</dd>`).join(''));
  }

  /**
   * Open the panel for a Sharpless 2 emission nebula picked via
   * raycast on the SharplessLayer. Same structural shape as
   * showMessier — populates the catalogue card + integrates with
   * the observation-queue Add button.
   *
   * Tuple columns:
   *   id, raHours, decDeg, diameterArcmin, brightnessClass, formClass
   */
  showSharpless(row: [number, number, number, number, number, number]): void {
    this.hideQueueButton();
    const [id, raHours, decDeg, diamArcmin, bright, form] = row;
    const stableId = `sharpless:Sh2-${id}`;
    this.currentId = stableId;
    this.lastNamedStar = null;
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

    this.nameEl.textContent = `Sh2-${id}`;
    // Sharpless catalogue doesn't ship a visual magnitude — we'd need
    // to compute it from photographic data. Show diameter + Sharpless
    // brightness class instead; the "smart-scope users care about Hα
    // surface brightness, not visual" framing fits this catalogue.
    const formLabel = ['—', t('info.sharp.formCircular'), t('info.sharp.formEllip'), t('info.sharp.formIrreg')][form] ?? '—';
    const brightLabel = ['—', t('info.sharp.brightFaint'), t('info.sharp.brightMed'), t('info.sharp.brightBright')][bright] ?? '—';
    this.subtitleEl.textContent =
      `${t('info.cat.sharpless')} · ${diamArcmin.toFixed(0)}′ · ${brightLabel}`;

    const rows: [string, string][] = [];
    rows.push([t('info.row.ra2000'), formatRA(raHours)]);
    rows.push([t('info.row.dec2000'), `${decDeg >= 0 ? '+' : ''}${decDeg.toFixed(4)}°`]);
    rows.push([t('info.row.apparentSize'), `${diamArcmin.toFixed(0)}′`]);
    rows.push([t('info.row.brightnessClass'), `${bright}/3 · ${brightLabel}`]);
    rows.push([t('info.row.form'), formLabel]);
    this.dataEl.innerHTML = rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');
    const sharpPreview = renderStackedPreview({
      kind: 'nebula',
      majorArcmin: diamArcmin,
      paDeg: 0,
      seed: id,
    });
    this.extraEl.innerHTML =
      `<div class="info-section info-preview-wrap">` +
      `<div class="info-preview-label">${t('info.preview.label')}</div>` +
      `<img class="info-preview-thumb" src="${sharpPreview}" alt="simulated preview" title="${t('info.preview.tooltip')}" />` +
      `</div>` +
      `<div class="info-section"><div class="info-text" style="color:var(--text-dim);">${t('info.text.sharpless')}</div></div>`;
    this.planningEl.innerHTML = '';

    // Queue button — Sharpless surface brightness isn't published but
    // we can estimate from Sharpless's discrete brightness class:
    // class 1 (faintest, ~24 mag/⬚²) / 2 (~22) / 3 (~20). These
    // numbers are rough — Sharpless used photographic plates with no
    // calibration scale — but good enough for "is this 30 min or 90
    // min" planning decisions.
    const sbEstimate = bright === 3 ? 20.0 : bright === 2 ? 22.0 : 24.0;
    const queueBtn = document.getElementById('info-queue-add') as HTMLButtonElement | null;
    if (queueBtn) {
      const target: import('../physics/observationQueue').QueueTarget = {
        id: stableId,
        label: `Sh2-${id} (${diamArcmin.toFixed(0)}′)`,
        source: 'sharpless',
        surfaceBrightness: sbEstimate,
        magnitude: NaN,
        raHours, decDeg,
        scope: 'seestar-s50',
        overrideMinutes: null,
        addedAt: 0,
      };
      queueBtn.dataset.queueTarget = JSON.stringify(target);
      queueBtn.style.display = '';
    }

    if (this.unsubscribe) this.unsubscribe();
    this.unsubscribe = this.clock.subscribe(() => {
      if (this.currentId === stableId && this.el.classList.contains('visible')) {
        this.renderUnnamedDynamic(raHours, decDeg);
      }
    });
    this.renderUnnamedDynamic(raHours, decDeg);
    this.renderObservationBlock();
  }

  /**
   * Open the panel for a bulk NGC/IC entry picked via raycast on
   * NGCFullLayer. Same structural shape; queue button wired off the
   * V-mag and major-axis when both are present.
   *
   * Tuple columns:
   *   idShort, raHours, decDeg, mag, typeIdx, majorArcmin, minorArcmin
   * idShort > 0 → NGC; < 0 → IC.
   */
  showNGCFull(row: [number, number, number, number, number, number, number]): void {
    this.hideQueueButton();
    const [idShort, raHours, decDeg, mag, typeIdx, major, minor] = row;
    const prefix = idShort < 0 ? 'IC' : 'NGC';
    const num = Math.abs(idShort);
    const designation = `${prefix} ${num}`;
    const stableId = `ngc:${designation}`;
    this.currentId = stableId;
    this.lastNamedStar = null;
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

    const typeLabel = ['G', 'GC', 'OC', 'N', 'PN', 'SNR'][typeIdx] ?? '?';
    this.nameEl.textContent = designation;
    this.subtitleEl.textContent =
      `${typeLabel} · m=${mag.toFixed(1)}` +
      (major > 0 ? ` · ${major.toFixed(1)}′${minor && minor !== major ? ` × ${minor.toFixed(1)}′` : ''}` : '');

    const rows: [string, string][] = [];
    rows.push([t('info.row.type'), typeLabel]);
    rows.push([t('info.row.ra2000'), formatRA(raHours)]);
    rows.push([t('info.row.dec2000'), `${decDeg >= 0 ? '+' : ''}${decDeg.toFixed(4)}°`]);
    rows.push([t('info.row.magnitude'), `${mag >= 0 ? '+' : ''}${mag.toFixed(2)}`]);
    let sbValue = NaN;
    if (major > 0 && minor > 0) {
      const sizeStr = major === minor
        ? `${major.toFixed(1)}′`
        : `${major.toFixed(1)}′ × ${minor.toFixed(1)}′`;
      rows.push([t('info.row.apparentSize'), sizeStr]);
      // Same formula as messierSurfaceBrightness: SB = m + 2.5·log10(πab) with a,b in arcsec.
      const a = major * 60, b = minor * 60;
      sbValue = mag + 2.5 * Math.log10(Math.PI * a * b);
      if (Number.isFinite(sbValue)) {
        rows.push([t('info.row.surfaceBrightness'), `${sbValue.toFixed(1)} mag/arcsec²`]);
      }
    }
    this.dataEl.innerHTML = rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');
    const ngcKind = ngcTypeIdxToKind(typeIdx);
    const ngcPreview = renderStackedPreview({
      kind: ngcKind,
      majorArcmin: major > 0 ? major : 3,
      minorArcmin: minor > 0 ? minor : undefined,
      magnitude: mag,
      paDeg: 0,
      seed: Math.abs(idShort),
    });
    this.extraEl.innerHTML =
      `<div class="info-section info-preview-wrap">` +
      `<div class="info-preview-label">${t('info.preview.label')}</div>` +
      `<img class="info-preview-thumb" src="${ngcPreview}" alt="simulated preview" title="${t('info.preview.tooltip')}" />` +
      `</div>` +
      `<div class="info-section"><div class="info-text" style="color:var(--text-dim);">${t('info.text.ngcBulk')}</div></div>`;
    this.planningEl.innerHTML = '';

    const queueBtn = document.getElementById('info-queue-add') as HTMLButtonElement | null;
    if (queueBtn) {
      if (Number.isFinite(sbValue)) {
        const target: import('../physics/observationQueue').QueueTarget = {
          id: stableId,
          label: designation,
          source: 'ngc',
          surfaceBrightness: sbValue,
          magnitude: mag,
          raHours, decDeg,
          scope: 'seestar-s50',
          overrideMinutes: null,
          addedAt: 0,
        };
        queueBtn.dataset.queueTarget = JSON.stringify(target);
        queueBtn.style.display = '';
      } else {
        queueBtn.style.display = 'none';
      }
    }

    if (this.unsubscribe) this.unsubscribe();
    this.unsubscribe = this.clock.subscribe(() => {
      if (this.currentId === stableId && this.el.classList.contains('visible')) {
        this.renderUnnamedDynamic(raHours, decDeg);
      }
    });
    this.renderUnnamedDynamic(raHours, decDeg);
    this.renderObservationBlock();
  }

  showStar(star: import('../data/stars').NamedStar): void {
    this.hideQueueButton();
    this.currentId = `star:${star.id}`;
    this.lastNamedStar = star;
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
    subtitleParts.push(t('info.cat.star'));
    this.subtitleEl.textContent = subtitleParts.join(' · ');

    const rows: [string, string][] = [];
    rows.push([t('info.row.ra2000'), formatRA(s.raHours)]);
    rows.push([t('info.row.dec2000'), `${s.decDeg >= 0 ? '+' : ''}${s.decDeg.toFixed(4)}°`]);
    rows.push([t('info.row.magnitude'), `${s.magnitude >= 0 ? '+' : ''}${s.magnitude.toFixed(2)}`]);
    if (s.pmRA != null && s.pmDec != null) {
      const total = Math.sqrt(s.pmRA * s.pmRA + s.pmDec * s.pmDec);
      rows.push([t('info.row.properMotion'), `${total.toFixed(1)} mas/yr`]);
    }

    this.dataEl.innerHTML = rows
      .map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`)
      .join('');

    // Description card
    const descHtml = s.description
      ? `<div class="info-section"><div class="info-text">${escapeHtml(s.description)}</div></div>`
      : `<div class="info-section"><div class="info-text" style="color:var(--text-dim);">${t('info.text.bayerStar')}${s.bayer ? `${t('info.text.bayerSuffix')} ${s.bayer}.` : ''}</div></div>`;
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
      [t('info.row.altitude'), `${altAz.altDeg >= 0 ? '+' : ''}${altAz.altDeg.toFixed(3)}°`],
      [t('info.row.azimuth'), `${altAz.azDeg.toFixed(3)}°`],
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
      ? `✓ ${t('info.row.observedCount')} · ${entry!.sessionCount} ${t('info.row.observedTimes')} ${formatRelativeDate(entry!.lastObservedAt)}）`
      : t('info.obs.markObserved');
    el.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;gap:6px;margin-bottom:4px;">
        <button id="obs-toggle" style="flex:1;text-align:left;background:${observed ? 'rgba(118,209,138,0.15)' : 'rgba(255,255,255,0.06)'};border:1px solid ${observed ? 'rgba(118,209,138,0.4)' : 'rgba(255,255,255,0.12)'};color:${observed ? '#76d18a' : 'var(--text)'};padding:5px 8px;border-radius:5px;cursor:pointer;font-size:11px;">${toggleLabel}</button>
        <div id="obs-stars" style="display:flex;gap:2px;font-size:14px;cursor:pointer;user-select:none;color:#ffcc40;" title=t('info.obs.ratingTooltip')>
          ${[1, 2, 3, 4, 5].map(n => `<span data-star="${n}" style="cursor:pointer;${n <= rating ? '' : 'opacity:0.3;'}">★</span>`).join('')}
        </div>
      </div>
      <textarea id="obs-notes" placeholder="${t('info.obs.notesPlaceholder')}" style="width:100%;min-height:42px;background:rgba(0,0,0,0.25);border:1px solid rgba(160,190,230,0.18);color:var(--text);padding:5px 7px;border-radius:5px;font-size:11px;font-family:inherit;resize:vertical;box-sizing:border-box;">${escapeHtml(notes)}</textarea>
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
      ? `${categoryLabel(d.category)} · ${d.nameEn} · ${parentName}`
      : `${categoryLabel(d.category)} · ${d.nameEn}`;

    const rows: [string, string][] = [];
    rows.push([t('info.row.radius'), `${formatNumber(d.physical.radiusKm, 1)} km`]);
    rows.push([t('info.row.mass'), `${d.physical.massKg.toExponential(3)} kg`]);
    rows.push([t('info.row.rotationPeriod'), `${formatNumber(Math.abs(d.physical.rotationPeriodDays), 4)} ${t('info.row.days')}${d.physical.rotationPeriodDays < 0 ? t('info.row.retrograde') : ''}`]);
    rows.push([t('info.row.axialTilt'), `${formatNumber(d.physical.axialTiltDeg, 2)}°`]);

    const el = d.propagator?.elements;
    if (el) {
      rows.push([t('info.row.semiMajorAxis'), `${formatNumber(el.a, 4)} AU`]);
      rows.push([t('info.row.eccentricity'), `${formatNumber(el.e, 4)}`]);
      rows.push([t('info.row.inclination'), `${formatNumber(el.iDeg, 2)}°`]);
      rows.push([t('info.row.orbitalPeriod'), formatPeriod(el.periodDays)]);

      // Synodic period vs Earth — only meaningful for solar-system bodies
      // other than Earth itself, and only if Earth is in the system.
      if (d.id !== 'earth' && d.parentId == null) {
        const earth = this.solarSystem.getBody('earth');
        const earthEl = earth?.descriptor.propagator?.elements;
        if (earthEl) {
          const syn = synodicPeriod(el.periodDays, earthEl.periodDays);
          if (Number.isFinite(syn)) rows.push([t('info.row.synodicEarth'), formatPeriod(syn)]);
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
        rows.push([t('info.row.hillSphere'), formatHill(rH)]);
      }
    }

    if (d.details?.classification) {
      rows.push([t('info.row.classification'), langPick(d.details.classification)]);
    }
    if (d.details?.surfaceGravityMS2 != null) {
      rows.push([t('info.row.surfaceGravity'), `${formatNumber(d.details.surfaceGravityMS2, 2)} m/s²`]);
    }
    if (d.details?.escapeVelocityKmS != null) {
      rows.push([t('info.row.escapeVelocity'), `${formatNumber(d.details.escapeVelocityKmS, 2)} km/s`]);
    }
    if (d.details?.meanSurfaceTempC != null) {
      rows.push([t('info.row.meanTemp'), `${formatNumber(d.details.meanSurfaceTempC, 0)}°C`]);
    }
    if (d.details?.surfaceTempRangeC) {
      const [lo, hi] = d.details.surfaceTempRangeC;
      rows.push([t('info.row.tempRange'), `${formatNumber(lo, 0)}°C ~ ${formatNumber(hi, 0)}°C`]);
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

    // Out-of-range precision disclaimer. Console.warn (which gmstRad
    // already does) is invisible to non-developers; surface a yellow
    // pill in the InfoPanel when the user has time-jumped outside the
    // propagator's documented accuracy window. Numbers still display
    // and animate — the panel just owns the "but trust them less".
    let precisionWarn = '';
    const src = prop.source;
    if (src?.validJdMin != null && src?.validJdMax != null
        && (jd < src.validJdMin || jd > src.validJdMax)) {
      const year = jdToYear(jd);
      const minYear = jdToYear(src.validJdMin);
      const maxYear = jdToYear(src.validJdMax);
      precisionWarn = `
        <div style="font-size:11px;margin-top:8px;padding:5px 8px;
                     background:rgba(255,204,64,0.10);
                     border:1px solid rgba(255,204,64,0.35);
                     border-radius:4px;color:#ffcc40;line-height:1.4;">
          ⚠ ${t('physics.precisionWarn')
                .replace('{year}', year.toFixed(0))
                .replace('{min}', minYear.toFixed(0))
                .replace('{max}', maxYear.toFixed(0))}
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
          ${precisionWarn}
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
      html += sectionTitle(t('info.section.surfaceTemp'));
      html += tempGaugeHtml(d.meanSurfaceTempC, d.surfaceTempRangeC);
    }

    if (d?.bulkComposition) {
      html += sectionTitle(t('info.section.composition'));
      const list = d.bulkComposition.map(c => ({ name: langPick(c.name), pct: c.pct }));
      html += pieChartSvg(list);
      html += compositionListHtml(list);
    }

    if (d?.atmosphere) {
      html += sectionTitle(t('info.section.atmosphere'));
      if (d.atmosphere.surfacePressureKpa != null) {
        html += `<div class="info-text"><b style="color:var(--accent);">${t('info.row.surfacePressure')}</b> ${formatNumber(d.atmosphere.surfacePressureKpa, 2)} kPa</div>`;
      }
      if (d.atmosphere.pressureNote) {
        html += `<div class="info-text" style="color:var(--text-dim);">${escapeHtml(langPick(d.atmosphere.pressureNote))}</div>`;
      }
      const atm = d.atmosphere.composition.map(c => ({ name: langPick(c.name), pct: c.pct }));
      html += pieChartSvg(atm);
      html += compositionListHtml(atm);
    }

    if (d?.internalStructure) {
      html += sectionTitle(t('info.section.interior'));
      html += '<div class="info-layers">';
      for (const layer of d.internalStructure) {
        html += `<div class="info-layer"><b>${escapeHtml(langPick(layer.layer))}</b><span>${escapeHtml(langPick(layer.description))}</span></div>`;
      }
      html += '</div>';
    }

    if (d?.geology) {
      html += sectionTitle(t('info.section.geology'));
      html += `<div class="info-text">${escapeHtml(langPick(d.geology))}</div>`;
    }

    if (d?.notableFacts && d.notableFacts.length > 0) {
      html += sectionTitle(t('info.section.notes'));
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

    const parentDesc = d.parentId ? this.solarSystem.getBody(d.parentId)?.descriptor : undefined;
    const parentName = parentDesc ? bodyName(parentDesc) : t('info.parent.sun');
    const dynRows: [string, string][] = [
      [`${t('info.row.distToParent')}${parentName}`, `${formatNumber(dist, 4)} AU`],
      [t('info.row.orbitalSpeed'), `${formatNumber(speedKmS, 2)} km/s`],
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
          dynRows.push([t('info.warn.altLow'), `${t('info.warn.altOnlyMsg')} ${altAz.altDeg.toFixed(1)}°`]);
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
        dynRows.push([t('info.row.distFromEarth'), `${formatNumber(obs.observerDistanceAU, 4)} AU`]);
        // Light-time delay: at this distance you're seeing the body
        // as it was N seconds/minutes/hours ago. c = 173.14463 AU/day
        // (one light-day = ~173 AU). For Sun/Mercury/Venus this is
        // 3–8 minutes; for outer planets 30 minutes–6 hours; for the
        // Moon, 1.3 seconds.
        const lightSec = obs.observerDistanceAU * 86400 / 173.14463;
        dynRows.push([t('info.row.lightDelay'), formatLightDelay(lightSec)]);
        if (Number.isFinite(obs.apparentMagnitude)) {
          dynRows.push([t('info.row.magnitude'), `${formatMag(obs.apparentMagnitude)}`]);
        }
        dynRows.push([t('info.row.phaseAngle'), `${formatNumber(obs.phaseAngleDeg, 1)}°  (${t('info.row.illuminated')} ${(obs.illuminatedFraction * 100).toFixed(1)}%)`]);
        dynRows.push([t('info.row.angularDiameter'), formatAngularSize(obs.angularDiameterArcsec)]);
      }
    } else if (d.id === 'sun') {
      // Sun: angular diameter from Earth varies with distance; we can
      // still derive it from Earth's heliocentric distance since the Sun
      // sits at the origin in our scene.
      const earth = this.solarSystem.getBody('earth');
      const earthHelio = earth?.descriptor.propagator?.stateAt(jd).position;
      if (earthHelio) {
        const distFromEarth = earthHelio.length();
        dynRows.push([t('info.row.distFromEarth'), `${formatNumber(distFromEarth, 4)} AU`]);
        const angDiam = (2 * Math.atan(d.physical.radiusKm / (distFromEarth * AU_KM))) * 206264.806;
        dynRows.push([t('info.row.angularDiameter'), formatAngularSize(angDiam)]);
        dynRows.push([t('info.row.magnitude'), '−26.74']);
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
    const fmtRelative = (jdValue: number | null): string => {
      if (jdValue == null) return '—';
      const dh = (jdValue - jd) * 24;
      if (dh < 1) return `${Math.round(dh * 60)} ${t('info.time.minutes')}`;
      if (dh < 48) return `${dh.toFixed(1)} ${t('info.time.hours')}`;
      return `${(dh / 24).toFixed(1)} ${t('info.time.daysLater')}`;
    };

    const rows: [string, string][] = [];
    if (transit) {
      rows.push([t('info.row.nextTransit'), `${fmtTime(transit.jd)} (${fmtRelative(transit.jd)})`]);
      rows.push([t('info.row.transitAlt'), `${transit.altDeg >= 0 ? '+' : ''}${transit.altDeg.toFixed(1)}°`]);
    }
    if (nextRiseJd != null) {
      rows.push([t('info.row.nextRise'), `${fmtTime(nextRiseJd)} (${fmtRelative(nextRiseJd)})`]);
    }
    if (nextSetJd != null) {
      rows.push([t('info.row.nextSet'), `${fmtTime(nextSetJd)} (${fmtRelative(nextSetJd)})`]);
    }

    let windowHtml = '';
    if (window) {
      windowHtml = `<div class="planning-window">` +
        `${t('info.planning.tonightBest')}: <span class="strong">${fmtTime(window.startJd)} – ${fmtTime(window.endJd)}</span>` +
        ` (${window.durationHours.toFixed(1)} ${t('info.planning.windowDetail')})` +
        `</div>`;
    } else {
      windowHtml = `<div class="planning-window">${t('info.planning.noWindow')}</div>`;
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
          const rel = days < 1 ? `${Math.round(days * 24)} ${t('info.time.hoursLater')}`
                   : days < 60 ? `${Math.round(days)} ${t('info.time.daysLater')}`
                   : `${(days / 30).toFixed(1)} ${t('info.time.monthsLater')}`;
          nextEventHtml = `<div class="planning-window">` +
            `${t('info.planning.nextEvent')}: <span class="strong">${dateStr} ${getEventKindShort(ev.kind)}</span>（${rel}）` +
            `</div>`;
        }
      }
    }

    this.planningEl.innerHTML =
      `<div class="planning-card">` +
        `<div class="planning-status">${vis.statusLabel}(${t('info.row.altitude')} ${altNow >= 0 ? '+' : ''}${altNow.toFixed(1)}°)</div>` +
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
    'opposition': t('info.event.opposition'),
    'conjunction-sup': t('info.event.conjunctionSup'),
    'conjunction-inf': t('info.event.conjunctionInf'),
    'elongation-east': t('info.event.elongationEast'),
    'elongation-west': t('info.event.elongationWest'),
    'new-moon': t('info.event.newMoon'),
    'full-moon': t('info.event.fullMoon'),
    'solar-eclipse': t('info.event.solarEclipse'),
    'lunar-eclipse': t('info.event.lunarEclipse'),
    'transit': t('info.event.transit'),
    'occultation': t('info.event.occultation'),
    'equinox': t('info.event.equinox'),
    'solstice': t('info.event.solstice'),
    'perihelion': t('info.event.perihelion'),
    'aphelion': t('info.event.aphelion'),
    'planet-conjunction': t('info.event.planetConj'),
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
  if (days < 1) return `${formatNumber(days * 24, 2)} ${t('info.unit.hour')}`;
  if (days < 1000) return `${formatNumber(days, 2)} ${t('info.unit.day')}`;
  const years = days / 365.256;
  return `${formatNumber(years, 2)} ${t('info.unit.year')}`;
}

function formatHill(rAU: number): string {
  const km = rAU * AU_KM;
  if (rAU >= 0.01) return `${formatNumber(rAU, 4)} AU`;
  if (km >= 1000) return `${formatNumber(km / 1000, 2)} ${t('info.unit.thousandKm')}`;
  return `${formatNumber(km, 0)} km`;
}

/** Apparent magnitude with proper sign + 2-decimal formatting. */
function formatMag(m: number): string {
  const sign = m < 0 ? '−' : '+';
  return `${sign}${Math.abs(m).toFixed(2)}`;
}

/** Quick JD → Gregorian year (integer). Used by the precision warning
 *  to print "you're at 1650 CE, this propagator is good 1800–2050". */
/**
 * Map MessierObject.type to the DSOKind enum the stacked-preview
 * renderer expects. Used for the Messier and named-NGC paths
 * (NGCFullLayer uses ngcTypeIdxToKind for the integer index variant).
 */
function messierTypeToKind(t: import('../data/messier').MessierType): DSOKind {
  switch (t) {
    case 'G':  return 'galaxy';
    case 'GC': return 'cluster-globular';
    case 'OC': return 'cluster-open';
    case 'N':  return 'nebula';
    case 'PN': return 'planetary';
    case 'SNR': return 'snr';
    default:   return 'unknown';
  }
}

/** Same mapping for the NGCFullLayer's integer typeIdx (0..5). */
function ngcTypeIdxToKind(idx: number): DSOKind {
  return (['galaxy', 'cluster-globular', 'cluster-open', 'nebula', 'planetary', 'snr'] as const)[idx] ?? 'unknown';
}

/** Deterministic numeric seed from a catalogue id string. Used so the
 *  same object renders the same background-star speckle pattern every
 *  time it's opened. */
function numericSeedFromId(id: string): number {
  let h = 5381;
  for (let i = 0; i < id.length; i++) {
    h = ((h << 5) + h) ^ id.charCodeAt(i);
  }
  return h >>> 0;
}

function jdToYear(jd: number): number {
  return jdToDate(jd).getUTCFullYear();
}

/**
 * Format a light-time delay in human-friendly units.
 * < 60s → seconds, < 90 min → minutes, else hours+minutes.
 * Used to express "you're seeing this object as it was N units ago" —
 * the Sun's reading is iconic (~8m 20s); Jupiter at opposition ~33m;
 * Voyager 1 at ~22 light-hours.
 */
function formatLightDelay(seconds: number): string {
  if (seconds < 60) return `${seconds.toFixed(1)} s`;
  if (seconds < 5400) {  // < 90 min
    const m = Math.floor(seconds / 60);
    const s = Math.round(seconds % 60);
    return `${m}m ${s.toString().padStart(2, '0')}s`;
  }
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return `${h}h ${m.toString().padStart(2, '0')}m`;
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
  if (sec < 30) return t('info.time.justNow');
  const min = Math.round(sec / 60);
  if (min < 60) return `${min} ${t('info.time.minutesAgo')}`;
  const hr = Math.round(min / 60);
  if (hr < 48) return `${hr} ${t('info.time.hoursAgo')}`;
  const day = Math.round(hr / 24);
  if (day < 60) return `${day} ${t('info.time.daysAgo')}`;
  const mo = Math.round(day / 30);
  if (mo < 24) return `${mo} ${t('info.time.monthsAgo')}`;
  return new Date(ms).toISOString().slice(0, 10);
}

function sectionTitle(text: string): string {
  return `<div class="info-section-title">${escapeHtml(text)}</div>`;
}
