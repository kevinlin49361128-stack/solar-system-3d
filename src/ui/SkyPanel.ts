import type { CameraController } from '../controls/CameraController';
import type { SolarSystem } from '../scene/SolarSystem';
import type { SimulationClock } from '../time/SimulationClock';
import type { InfoPanel } from './InfoPanel';
import { NAMED_STARS } from '../data/stars';
import { t, onLanguageChange, bodyName, maybeJa } from '../i18n';
import { computeDailyEvents, localSiderealDeg, jdToDate } from '../physics/dailyEvents';
import { bodyObservables, moonObservables } from '../physics/bodyObservables';
import { eclipticDirToRaDec } from '../physics/topocentric';
import { constellationFor, constellationLabel, loadConstellationData } from '../physics/constellationLookup';
import { getLang } from '../i18n';

const PRIORITY_IDS = [
  'sun', 'moon',
  'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune',
  'pluto', 'ceres', 'eris', 'makemake', 'haumea',
];

/**
 * Floating panel listing every visible (above-horizon) body with its current
 * altitude and azimuth from the observer. Only shown when in observer mode;
 * refreshed at a low rate to avoid flicker.
 */
export class SkyPanel {
  private readonly el: HTMLElement;
  private readonly listEl: HTMLElement;
  private rafId: number | null = null;
  private lastUpdate: number = 0;

  private infoPanel: InfoPanel | null = null;
  setInfoPanel(p: InfoPanel): void { this.infoPanel = p; }

  constructor(
    private cameraCtl: CameraController,
    private solarSystem: SolarSystem,
    private clock: SimulationClock,
  ) {
    this.el = document.getElementById('sky-panel')!;
    this.listEl = document.getElementById('sky-list')!;
    onLanguageChange(() => {
      if (this.el.style.display !== 'none') this.render();
    });

    // Double-click a row to centre the observer camera on that body / star.
    this.listEl.addEventListener('dblclick', (e) => {
      const row = (e.target as HTMLElement).closest('.sky-row') as HTMLElement | null;
      if (!row) return;
      const bodyId = row.dataset.bodyId;
      const raStr = row.dataset.ra;
      const decStr = row.dataset.dec;
      const pmRA = row.dataset.pmRa ? parseFloat(row.dataset.pmRa) : undefined;
      const pmDec = row.dataset.pmDec ? parseFloat(row.dataset.pmDec) : undefined;
      let aa: { altDeg: number; azDeg: number } | null = null;
      if (bodyId) {
        aa = this.cameraCtl.getBodyAltAz(bodyId);
        this.infoPanel?.show(bodyId);
      } else if (raStr && decStr) {
        aa = this.cameraCtl.getStarAltAz(parseFloat(raStr), parseFloat(decStr), pmRA, pmDec);
        // Match the row to a NAMED_STARS entry by ra/dec for InfoPanel.
        const ra = parseFloat(raStr), dec = parseFloat(decStr);
        const star = NAMED_STARS.find(s =>
          Math.abs(s.raHours - ra) < 1e-3 && Math.abs(s.decDeg - dec) < 1e-3);
        if (star) this.infoPanel?.showStar(star);
      }
      if (aa) this.cameraCtl.setObserverLook(aa.azDeg, aa.altDeg);
    });
  }

  show(): void {
    this.el.style.display = '';
    // Kick off constellation-boundaries fetch on first show. Until it
    // resolves, the lookup just returns null and we render no constellation
    // chip — better than blocking the whole panel on a 150 KB JSON.
    void loadConstellationData('/iau-boundaries.json').catch(() => { /* fail silently */ });
    if (this.rafId == null) this.tick();
  }

  hide(): void {
    this.el.style.display = 'none';
    if (this.rafId != null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  private tick = (): void => {
    const now = performance.now();
    if (now - this.lastUpdate > 250) {
      this.lastUpdate = now;
      this.render();
    }
    this.rafId = requestAnimationFrame(this.tick);
  };

  private render(): void {
    const bodyRows: { id: string; name: string; alt: number; az: number; mag: number; constellation: string | null }[] = [];
    const starRows: { ra: number; dec: number; pmRA?: number; pmDec?: number; name: string; bayer: string; mag: number; alt: number; az: number; constellation: string | null }[] = [];

    // Earth's heliocentric position is needed for every body's apparent
    // magnitude calculation (and to compute body→Earth direction for
    // constellation lookup). Fetch it once per render.
    const jd = this.clock.getJd();
    const earth = this.solarSystem.getBody('earth');
    const earthHelio = earth?.descriptor.propagator?.stateAt(jd).position;

    for (const id of PRIORITY_IDS) {
      const entry = this.solarSystem.getBody(id);
      if (!entry) continue;
      const aa = this.cameraCtl.getBodyAltAz(id);
      if (!aa) continue;

      // Apparent magnitude. Sun has no propagator and a fixed mag.
      // Other bodies use phase-corrected Pogson formula.
      let mag = NaN;
      let constellation: string | null = null;
      if (id === 'sun') {
        mag = -26.7;
      } else if (entry.descriptor.propagator && earthHelio) {
        const sv = entry.descriptor.propagator.stateAt(jd);
        const obs = entry.descriptor.parentId === 'earth'
          ? moonObservables(sv.position, earthHelio, entry.descriptor.physical.radiusKm)
          : bodyObservables(id, sv.position, earthHelio, entry.descriptor.physical.radiusKm);
        mag = obs.apparentMagnitude;

        // Constellation: geocentric apparent direction in ecliptic frame.
        // For the Moon the propagator already returns geocentric coords;
        // for everyone else, subtract Earth's heliocentric position.
        const geoDir = entry.descriptor.parentId === 'earth'
          ? sv.position
          : sv.position.clone().sub(earthHelio);
        const { raHours, decDeg } = eclipticDirToRaDec(geoDir.x, geoDir.y, geoDir.z);
        constellation = constellationFor(raHours, decDeg);
      }

      bodyRows.push({ id, name: bodyName(entry.descriptor), alt: aa.altDeg, az: aa.azDeg, mag, constellation });
    }

    for (const star of NAMED_STARS) {
      const aa = this.cameraCtl.getStarAltAz(star.raHours, star.decDeg, star.pmRA, star.pmDec);
      if (!aa) continue;
      starRows.push({
        ra: star.raHours,
        dec: star.decDeg,
        pmRA: star.pmRA,
        pmDec: star.pmDec,
        name: maybeJa(star.name, star.nameJa),
        bayer: star.bayer ?? '',
        mag: star.magnitude,
        alt: aa.altDeg,
        az: aa.azDeg,
        constellation: constellationFor(star.raHours, star.decDeg),
      });
    }

    // Sort: above-horizon AND naked-eye visible (mag ≤ 6.0) first,
    // then by magnitude ascending (brightest → dimmest), with altitude
    // as the tiebreaker. Below-horizon and dim entries sort to the
    // bottom but stay listed (faded) so the user can see what'll come
    // up later.
    //
    // Why this order: the original alt-only sort hid the climax of any
    // sky — Jupiter at +2° alt (mag −1.8, naked-eye obvious) sat below
    // Makemake at +84° alt (mag 17, needs a 14-inch telescope). Users
    // asking "what should I look at" want bright and visible first.
    const visibilitySort = (a: { alt: number; mag: number }, b: { alt: number; mag: number }) => {
      const aVisible = a.alt > 0 && a.mag <= 6.0 ? 1 : 0;
      const bVisible = b.alt > 0 && b.mag <= 6.0 ? 1 : 0;
      if (aVisible !== bVisible) return bVisible - aVisible;
      const aUp = a.alt > 0 ? 1 : 0;
      const bUp = b.alt > 0 ? 1 : 0;
      if (aUp !== bUp) return bUp - aUp;
      // Both visible (or both not) — magnitude wins, NaN sorts last.
      const aMag = Number.isFinite(a.mag) ? a.mag : 99;
      const bMag = Number.isFinite(b.mag) ? b.mag : 99;
      if (Math.abs(aMag - bMag) > 0.05) return aMag - bMag;
      return b.alt - a.alt;
    };
    bodyRows.sort(visibilitySort);
    starRows.sort(visibilitySort);

    let html = this.renderTonightSection();
    html += `<div class="sky-section-title">${t('sky.solarSystem')}</div>`;
    html += bodyRows.map(r => this.bodyRowHtml(r.id, r.name, r.alt, r.az, r.mag, r.constellation)).join('');
    html += `<div class="sky-section-title" style="margin-top:8px;">${t('sky.stars')}</div>`;
    html += starRows.map(r =>
      this.starRowHtml(r.ra, r.dec, r.pmRA, r.pmDec, r.name, r.bayer, r.mag, r.alt, r.az, r.constellation)
    ).join('');

    this.listEl.innerHTML = html;
  }

  /**
   * Header card showing today's sun/moon timing + LST. Computed against
   * the observer's longitude meridian so "today" matches the observer's
   * civil clock, not the browser's. Refreshed at the SkyPanel's normal
   * 4 Hz tick rate (cheap — ~80 root-finding bisections per render).
   */
  private renderTonightSection(): string {
    const { lat, lon } = this.cameraCtl.getObserverLocation();
    const jd = this.clock.getJd();
    // Anchor to the local solar noon nearest in time to `jd`. Local
    // noon-JDs lie at integer + (−lon/360) — JD increments at UT noon and
    // local noon at longitude λ is offset by −λ/15 hours UT, equivalently
    // −λ/360 in fractional days. `round` picks today's noon when within
    // ±12h, gracefully spilling to next/prev day at the edges.
    const jdLocalNoon = Math.round(jd + lon / 360) - lon / 360;
    const ev = computeDailyEvents(jdLocalNoon, lat, lon);
    const offsetMin = (lon / 15) * 60;
    const fmt = (jdT: number | null): string => {
      if (jdT == null) return '—';
      const d = jdToDate(jdT + offsetMin / 1440);
      return `${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`;
    };
    const lst = localSiderealDeg(jd, lon);
    const lstH = Math.floor(lst / 15);
    const lstM = Math.floor(((lst / 15) - lstH) * 60);
    const lstS = Math.floor((((lst / 15) - lstH) * 60 - lstM) * 60);
    const dayLen = ev.dayLengthHours;
    const dayLenStr = dayLen != null ? `${Math.floor(dayLen)}h ${pad2(Math.round((dayLen % 1) * 60))}m` : t('sky.polarNight');
    return `
      <div class="sky-section-title">${t('sky.tonight')}</div>
      <div class="tonight-grid">
        <span class="lbl">${t('sky.sunrise')}</span><span class="val">${fmt(ev.sunrise)}</span>
        <span class="lbl">${t('sky.sunset')}</span><span class="val">${fmt(ev.sunset)}</span>
        <span class="lbl">${t('sky.moonrise')}</span><span class="val">${fmt(ev.moonrise)}</span>
        <span class="lbl">${t('sky.moonset')}</span><span class="val">${fmt(ev.moonset)}</span>
        <span class="lbl">${t('sky.civilDusk')}</span><span class="val">${fmt(ev.civilDusk)}</span>
        <span class="lbl">${t('sky.nauticalDusk')}</span><span class="val">${fmt(ev.nauticalDusk)}</span>
        <span class="lbl">${t('sky.astronomicalDusk')}</span><span class="val">${fmt(ev.astronomicalDusk)}</span>
        <span class="lbl">${t('sky.astronomicalDawn')}</span><span class="val">${fmt(ev.astronomicalDawn)}</span>
        <span class="lbl">${t('sky.nauticalDawn')}</span><span class="val">${fmt(ev.nauticalDawn)}</span>
        <span class="lbl">${t('sky.civilDawn')}</span><span class="val">${fmt(ev.civilDawn)}</span>
        <span class="lbl">${t('sky.daylightLen')}</span><span class="val">${dayLenStr}</span>
        <span class="lbl">${t('sky.equationOfTime')}</span><span class="val">${ev.equationOfTimeMin >= 0 ? '+' : ''}${ev.equationOfTimeMin.toFixed(1)} ${t('sky.minutes')}</span>
        <span class="lbl">${t('sky.lst')}</span><span class="val">${pad2(lstH)}:${pad2(lstM)}:${pad2(lstS)}</span>
      </div>
    `;
  }

  private bodyRowHtml(id: string, name: string, alt: number, az: number, mag: number, constellation: string | null): string {
    const altStr = `${alt >= 0 ? '+' : ''}${alt.toFixed(1)}°`;
    const azStr = `${az.toFixed(0)}°`;
    const opacity = alt > 0 ? 1 : 0.35;
    const magStr = Number.isFinite(mag)
      ? `<span style="color:var(--text-dim);font-size:10px;">m=${mag >= 0 ? '+' : ''}${mag.toFixed(1)}</span>`
      : '';
    const constStr = constellation
      ? `<span style="color:var(--text-dim);font-size:10px;margin-left:4px;" title="${constellationLabel(constellation, getLang())}">${constellation}</span>`
      : '';
    return `<div class="sky-row" data-body-id="${id}" style="opacity:${opacity};cursor:pointer;" title="${t('sky.dblClickCenter')}">` +
      `<span class="name">${name} ${magStr}${constStr}</span>` +
      `<span class="alt">${altStr}</span>` +
      `<span class="az">${azStr}</span>` +
      `</div>`;
  }

  // (pad2 lives in this module — see end of file.)
  private starRowHtml(ra: number, dec: number, pmRA: number | undefined, pmDec: number | undefined, name: string, bayer: string, mag: number, alt: number, az: number, constellation: string | null): string {
    const altStr = `${alt >= 0 ? '+' : ''}${alt.toFixed(1)}°`;
    const azStr = `${az.toFixed(0)}°`;
    const opacity = alt > 0 ? 1 : 0.3;
    const sub = bayer ? ` <span style="color:var(--text-dim);font-size:10px;">${bayer}</span>` : '';
    const constStr = constellation
      ? `<span style="color:var(--text-dim);font-size:10px;margin-left:4px;" title="${constellationLabel(constellation, getLang())}">${constellation}</span>`
      : '';
    const pmAttr = pmRA !== undefined && pmDec !== undefined ? ` data-pm-ra="${pmRA}" data-pm-dec="${pmDec}"` : '';
    return `<div class="sky-row" data-ra="${ra}" data-dec="${dec}"${pmAttr} style="opacity:${opacity};cursor:pointer;" title="${t('sky.dblClickCenter')}">` +
      `<span class="name">${name}${sub} <span style="color:var(--text-dim);font-size:10px;">m=${mag.toFixed(1)}</span>${constStr}</span>` +
      `<span class="alt">${altStr}</span>` +
      `<span class="az">${azStr}</span>` +
      `</div>`;
  }
}

function pad2(n: number): string {
  return n.toString().padStart(2, '0');
}
