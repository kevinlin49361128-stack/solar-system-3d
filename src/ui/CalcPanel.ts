import type { SolarSystem } from '../scene/SolarSystem';
import type { SimulationClock } from '../time/SimulationClock';
import type { BodyDescriptor } from '../physics/types';
import { AU_KM } from '../physics/constants';
import { bodyName, onLanguageChange } from '../i18n';

const ELIGIBLE_IDS = [
  'sun',
  'mercury', 'venus', 'earth', 'mars',
  'jupiter', 'saturn', 'uranus', 'neptune',
  'pluto', 'ceres', 'eris', 'makemake', 'haumea',
];

/**
 * 計算模式 panel — 給定一個參考天體，列出其他天體相對於參考點的各種物理量：
 * 距離、相對速度向量大小、視線速度、角直徑等。
 *
 * 依 SimulationClock 每約 250 ms 重新計算一次，避免 DOM 抖動。
 */
export class CalcPanel {
  private readonly el: HTMLElement;
  private readonly listEl: HTMLElement;
  private readonly refSelectEl: HTMLSelectElement;
  private referenceId: string = 'sun';
  private rafId: number | null = null;
  private lastUpdate: number = 0;

  constructor(
    private solarSystem: SolarSystem,
    private clock: SimulationClock,
  ) {
    this.el = document.getElementById('calc-panel')!;
    this.listEl = document.getElementById('calc-list')!;
    this.refSelectEl = document.getElementById('calc-ref') as HTMLSelectElement;

    for (const id of ELIGIBLE_IDS) {
      const entry = this.solarSystem.getBody(id);
      if (!entry) continue;
      const opt = document.createElement('option');
      opt.value = id;
      opt.textContent = bodyName(entry.descriptor);
      this.refSelectEl.appendChild(opt);
    }
    this.refSelectEl.value = 'sun';
    onLanguageChange(() => {
      // Repopulate dropdown labels and re-render rows
      this.refSelectEl.querySelectorAll('option').forEach(opt => {
        const e = this.solarSystem.getBody(opt.value);
        if (e) opt.textContent = bodyName(e.descriptor);
      });
      if (this.isOpen()) this.lastUpdate = 0;
    });
    this.refSelectEl.addEventListener('change', () => {
      this.referenceId = this.refSelectEl.value;
      this.lastUpdate = 0;
    });

    document.getElementById('calc-close')!.addEventListener('click', () => this.hide());
  }

  show(): void {
    this.el.style.display = '';
    this.lastUpdate = 0;
    if (this.rafId == null) this.tick();
  }

  hide(): void {
    this.el.style.display = 'none';
    if (this.rafId != null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  isOpen(): boolean { return this.el.style.display !== 'none'; }
  getReference(): string { return this.referenceId; }

  private tick = (): void => {
    const now = performance.now();
    if (now - this.lastUpdate > 250) {
      this.lastUpdate = now;
      this.render();
    }
    this.rafId = requestAnimationFrame(this.tick);
  };

  private render(): void {
    const jd = this.clock.getJd();
    const refEntry = this.solarSystem.getBody(this.referenceId);
    if (!refEntry) { this.listEl.innerHTML = ''; return; }
    const refDesc = refEntry.descriptor;

    // Reference state in ecliptic AU + AU/day. Sun is at origin.
    const refState = refDesc.propagator
      ? refDesc.propagator.stateAt(jd)
      : { position: zero(), velocity: zero() };

    type Row = {
      desc: BodyDescriptor;
      distAU: number;
      relSpeedKmS: number;
      losKmS: number;
      angularArcsec: number;
      angularRateDegPerHr: number;
    };
    const rows: Row[] = [];

    for (const id of ELIGIBLE_IDS) {
      if (id === this.referenceId) continue;
      const entry = this.solarSystem.getBody(id);
      if (!entry) continue;
      const d = entry.descriptor;
      const sv = d.propagator ? d.propagator.stateAt(jd) : { position: zero(), velocity: zero() };
      const dx = sv.position.x - refState.position.x;
      const dy = sv.position.y - refState.position.y;
      const dz = sv.position.z - refState.position.z;
      const distAU = Math.hypot(dx, dy, dz);

      const vx = sv.velocity.x - refState.velocity.x;
      const vy = sv.velocity.y - refState.velocity.y;
      const vz = sv.velocity.z - refState.velocity.z;
      const relSpeedAUperDay = Math.hypot(vx, vy, vz);
      const relSpeedKmS = relSpeedAUperDay * AU_KM / 86400;

      // Line-of-sight (radial) velocity — projection of relV onto unit dir.
      let losKmS = 0;
      if (distAU > 0) {
        const ux = dx / distAU, uy = dy / distAU, uz = dz / distAU;
        const losAUperDay = vx * ux + vy * uy + vz * uz;
        losKmS = losAUperDay * AU_KM / 86400;
      }

      // Apparent angular diameter (arcseconds) given body radius / distance.
      // 2 * arctan(R / d). For tiny ratios, arctan ≈ ratio.
      const distKm = distAU * AU_KM;
      const angularRad = 2 * Math.atan(d.physical.radiusKm / Math.max(distKm, 1));
      const angularArcsec = angularRad * (180 / Math.PI) * 3600;

      // Angular rate of motion across the sky from reference's POV (deg/hour).
      // Tangential speed = sqrt(|v|^2 - v_los^2). angular rate = v_t / d.
      const tangentialAUperDay = Math.sqrt(Math.max(0, relSpeedAUperDay * relSpeedAUperDay - (losKmS * 86400 / AU_KM) ** 2));
      const angularRateDegPerHr = (tangentialAUperDay / Math.max(distAU, 1e-12))
        * (180 / Math.PI) / 24;

      rows.push({ desc: d, distAU, relSpeedKmS, losKmS, angularArcsec, angularRateDegPerHr });
    }

    rows.sort((a, b) => a.distAU - b.distAU);

    let html = `<div class="calc-row calc-head">`
      + `<span class="cn">天體</span>`
      + `<span>距離 (AU)</span>`
      + `<span>相對 v</span>`
      + `<span>視線 v</span>`
      + `</div>`;

    for (const r of rows) {
      const losClass = r.losKmS > 0.001 ? 'los-pos' : (r.losKmS < -0.001 ? 'los-neg' : '');
      const losSign = r.losKmS > 0 ? '+' : '';
      const nm = bodyName(r.desc);
      html += `<div class="calc-row" data-id="${r.desc.id}" title="${escapeHtml(nm)}">`
        + `<span class="cn">${escapeHtml(nm)}</span>`
        + `<span>${r.distAU >= 100 ? r.distAU.toFixed(1) : r.distAU.toFixed(3)}</span>`
        + `<span>${r.relSpeedKmS.toFixed(2)} km/s</span>`
        + `<span class="${losClass}">${losSign}${r.losKmS.toFixed(2)}</span>`
        + `</div>`
        + `<div class="calc-extra" data-id="${r.desc.id}">`
        + `視角直徑 <b>${formatArcsec(r.angularArcsec)}</b> · 角速度 <b>${r.angularRateDegPerHr.toFixed(4)}°/hr</b>`
        + `</div>`;
    }

    this.listEl.innerHTML = html;
  }
}

function zero(): { x: number; y: number; z: number } {
  return { x: 0, y: 0, z: 0 };
}

function formatArcsec(arcsec: number): string {
  if (arcsec >= 3600) return `${(arcsec / 3600).toFixed(2)}°`;
  if (arcsec >= 60) return `${(arcsec / 60).toFixed(1)}'`;
  return `${arcsec.toFixed(1)}"`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
}
