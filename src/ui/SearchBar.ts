import type { CameraController } from '../controls/CameraController';
import type { SolarSystem } from '../scene/SolarSystem';
import type { InfoPanel } from './InfoPanel';
import { t } from '../i18n';
import { NAMED_STARS } from '../data/stars';
import { OBSERVER_PRESETS } from '../physics/topocentric';
import { CONSTELLATIONS } from '../data/constellations';

interface SearchEntry {
  id: string;
  label: string;
  sub: string;
  kind: 'body' | 'star' | 'site' | 'constellation';
  search: string; // lowercase haystack
  action: () => void;
}

/**
 * Parse free-form RA/Dec input into hours/degrees. Accepted forms:
 *  - "5h35m17s -5d20m"
 *  - "ra 5:35:17 dec -5:20:52"
 *  - "5 35 17 +22 00 52"
 *  - "83.633 -5.391"  (degrees / degrees)
 *  - "5.5755h 22.014d"  (decimal)
 * Returns null when nothing parseable. Case- and unit-flexible.
 */
function parseRaDec(input: string): { raHours: number; decDeg: number } | null {
  // Strip leading "ra"/"dec" prefixes; allow ° ʰ ' " etc as separators.
  const s = input.replace(/[°ʰ"'′″]/g, ' ')
    .replace(/[hms]/gi, ' ')
    .replace(/[d:]/gi, ' ')
    .replace(/[,;]/g, ' ')
    .replace(/\bra\b|\bdec\b/gi, ' ')
    .replace(/\s+/g, ' ').trim();
  const tokens = s.split(' ').filter(Boolean).map(Number);
  if (tokens.some(n => Number.isNaN(n))) return null;
  // Try sexagesimal form: 6 numbers (h m s + d m s) with sign carry.
  if (tokens.length === 6) {
    const raHours = tokens[0] + tokens[1] / 60 + tokens[2] / 3600;
    const decSign = tokens[3] < 0 || Object.is(tokens[3], -0) ? -1 : 1;
    const decDeg = decSign * (Math.abs(tokens[3]) + tokens[4] / 60 + tokens[5] / 3600);
    if (raHours >= 0 && raHours < 24 && Math.abs(decDeg) <= 90) return { raHours, decDeg };
  }
  // Decimal pair.
  if (tokens.length === 2) {
    const [ra, dec] = tokens;
    // Auto-detect: if RA > 24, treat as degrees.
    const raHours = ra > 24 ? ra / 15 : ra;
    if (raHours >= 0 && raHours < 24 && Math.abs(dec) <= 90) {
      return { raHours, decDeg: dec };
    }
  }
  return null;
}

/**
 * Cmd/Ctrl-F search across bodies, named stars, observation sites and
 * constellations. Selecting an entry triggers a context-appropriate action:
 *   body → follow + open info
 *   star → open info-panel-like detail (here: just camera-mode info)
 *   site → select preset + show site-info
 */
export class SearchBar {
  private overlay: HTMLElement;
  private input: HTMLInputElement;
  private resultsEl: HTMLElement;
  private entries: SearchEntry[] = [];
  private selectedIdx = 0;

  constructor(
    solarSystem: SolarSystem,
    cameraCtl: CameraController,
    infoPanel: InfoPanel,
  ) {
    this.overlay = document.getElementById('search-overlay')!;
    this.input = document.getElementById('search-input') as HTMLInputElement;
    this.resultsEl = document.getElementById('search-results')!;

    void cameraCtl;
    // Stash for the RA/Dec parsing path which can't see this scope.
    (window as { __cameraCtl?: CameraController }).__cameraCtl = cameraCtl;
    this.buildEntries(solarSystem, cameraCtl, infoPanel);

    window.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'f' || e.key === 'F')) {
        e.preventDefault();
        this.open();
      } else if (e.key === 'Escape' && this.isOpen()) {
        e.preventDefault();
        this.close();
      }
    });

    this.input.addEventListener('input', () => {
      this.selectedIdx = 0;
      this.render();
    });
    this.input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') { this.selectedIdx++; this.render(); e.preventDefault(); }
      else if (e.key === 'ArrowUp') { this.selectedIdx--; this.render(); e.preventDefault(); }
      else if (e.key === 'Enter') { this.executeSelected(); e.preventDefault(); }
    });
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) this.close();
    });
  }

  private buildEntries(
    solarSystem: SolarSystem,
    cameraCtl: CameraController,
    infoPanel: InfoPanel,
  ): void {
    // Bodies
    for (const entry of solarSystem.getAllBodies()) {
      const d = entry.descriptor;
      this.entries.push({
        id: `body:${d.id}`,
        label: d.name,
        sub: `${d.nameEn} · ${d.category}`,
        kind: 'body',
        search: `${d.name} ${d.nameEn} ${d.id}`.toLowerCase(),
        action: () => {
          cameraCtl.setFollow(d.id);
          infoPanel.show(d.id);
          (document.getElementById('camera-mode') as HTMLSelectElement).value = 'follow';
          (document.getElementById('follow-body') as HTMLSelectElement).value = d.id;
        },
      });
    }
    // Stars
    for (const s of NAMED_STARS) {
      this.entries.push({
        id: `star:${s.id}`,
        label: s.name,
        sub: `${s.nameEn}${s.bayer ? ' · ' + s.bayer : ''} · m=${s.magnitude.toFixed(1)}`,
        kind: 'star',
        search: `${s.name} ${s.nameEn} ${s.bayer ?? ''} ${s.id}`.toLowerCase(),
        action: () => {
          infoPanel.showStar(s);
          // If in observer mode, also aim the camera at the star.
          if (cameraCtl.getMode() === 'observer') {
            const aa = cameraCtl.getStarAltAz(s.raHours, s.decDeg, s.pmRA, s.pmDec);
            if (aa) cameraCtl.setObserverLook(aa.azDeg, aa.altDeg);
          }
        },
      });
    }
    // Observation sites
    for (const p of OBSERVER_PRESETS) {
      this.entries.push({
        id: `site:${p.id}`,
        label: p.name,
        sub: `${p.nameEn ?? ''} · ${p.lat.toFixed(2)}, ${p.lon.toFixed(2)}`,
        kind: 'site',
        search: `${p.name} ${p.nameEn ?? ''} ${p.id}`.toLowerCase(),
        action: () => {
          (document.getElementById('observer-preset') as HTMLSelectElement).value = p.id;
          (document.getElementById('observer-preset') as HTMLSelectElement).dispatchEvent(new Event('change'));
        },
      });
    }
    // Constellations
    for (const c of CONSTELLATIONS) {
      this.entries.push({
        id: `con:${c.id}`,
        label: c.name,
        sub: c.nameEn,
        kind: 'constellation',
        search: `${c.name} ${c.nameEn} ${c.id}`.toLowerCase(),
        action: () => {
          alert(`${c.name} (${c.nameEn})\n${t('search.constellationLines')} ${c.lines.length} ${t('search.constellationLines2')}.\n${t('search.observerHint')}`);
        },
      });
    }
  }

  private isOpen(): boolean {
    return this.overlay.style.display !== 'none';
  }

  open(): void {
    this.overlay.style.display = '';
    this.input.value = '';
    this.input.focus();
    this.selectedIdx = 0;
    this.render();
  }

  close(): void {
    this.overlay.style.display = 'none';
  }

  private query(): SearchEntry[] {
    const q = this.input.value.trim().toLowerCase();
    if (!q) return this.entries.slice(0, 30);
    // RA/Dec direct input shortcut. Recognised forms (whitespace-loose):
    //   "ra 5h35m dec -5d20m"     · "5:35:17 +22:00:52"     · "5h35m17s -5°20'"
    // Returns a synthetic entry that, on selection, points the observer-mode
    // camera at the supplied coordinates (or shows an alert if not in
    // observer mode).
    const radec = parseRaDec(q);
    if (radec) {
      return [{
        id: 'radec',
        label: `RA ${radec.raHours.toFixed(4)}ʰ  Dec ${radec.decDeg.toFixed(3)}°`,
        sub: t('search.coordsSub'),
        kind: 'star',
        search: q,
        action: () => {
          const cam = (window as { __cameraCtl?: CameraController }).__cameraCtl;
          if (cam && cam.getMode() === 'observer') {
            const altAz = cam.getStarAltAz(radec.raHours, radec.decDeg);
            if (altAz) cam.setObserverLook(altAz.azDeg, altAz.altDeg);
          } else {
            alert(`RA ${radec.raHours.toFixed(4)}ʰ\nDec ${radec.decDeg.toFixed(3)}°\n\n${t('search.coordsHint')}`);
          }
        },
      }];
    }
    return this.entries.filter(e => e.search.includes(q)).slice(0, 30);
  }

  private render(): void {
    const items = this.query();
    if (items.length === 0) {
      this.resultsEl.innerHTML = `<div style="color:var(--text-dim);padding:8px;">${t('search.noResult')}</div>`;
      return;
    }
    this.selectedIdx = ((this.selectedIdx % items.length) + items.length) % items.length;
    this.resultsEl.innerHTML = items.map((e, i) => {
      const cls = i === this.selectedIdx ? 'search-result selected' : 'search-result';
      return `<div class="${cls}" data-i="${i}">` +
        `<span><b>${escapeHtml(e.label)}</b>&nbsp;<span style="color:var(--text-dim);">${escapeHtml(e.sub)}</span></span>` +
        `<span class="kind">${kindLabel(e.kind)}</span>` +
        `</div>`;
    }).join('');
    this.resultsEl.querySelectorAll<HTMLElement>('.search-result').forEach(el => {
      el.addEventListener('click', () => {
        this.selectedIdx = parseInt(el.dataset.i!, 10);
        this.executeSelected();
      });
    });
  }

  private executeSelected(): void {
    const items = this.query();
    if (items.length === 0) return;
    const e = items[this.selectedIdx];
    this.close();
    e.action();
  }
}

function kindLabel(k: SearchEntry['kind']): string {
  switch (k) {
    case 'body': return t('search.cat.body');
    case 'star': return t('search.cat.star');
    case 'site': return t('search.cat.site');
    case 'constellation': return t('search.cat.constellation');
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
}
