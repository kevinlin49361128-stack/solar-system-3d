import { Vector3 } from 'three';
import type { SolarSystem } from '../scene/SolarSystem';
import {
  computeLunarEclipse,
  type LunarEclipseResult,
} from '../physics/lunarEclipseGeometry';
import { sunPositionEcliptic } from '../physics/solarPosition';
import { moonPositionEcliptic } from '../physics/lunarPosition';

/**
 * Diagrammatic visualisation of a lunar eclipse: Earth's umbra (dark)
 * and penumbra (light) circles fixed at the centre of a 2D canvas, with
 * the Moon drawn as a small disc traveling along its path through them.
 *
 * Different from solar-eclipse map's geographic projection — lunar
 * eclipse is visible from the entire night-side of Earth at the same
 * time, so there's no "path on the ground" to draw. Instead we show
 * the geometric configuration in the shadow plane.
 *
 * Renders:
 *   - Light grey ring: penumbra circle
 *   - Dark grey disc: umbra circle
 *   - Yellow polyline: Moon's trajectory across both
 *   - White circle: Moon disc at greatest eclipse
 *   - Tick marks at P1/U1/U2/Max/U3/U4/P4 contact moments
 */
export class LunarEclipseMap {
  private el: HTMLElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private titleEl: HTMLElement;
  private detailsEl: HTMLElement;
  private currentResult: LunarEclipseResult | null = null;

  constructor(_solarSystem: SolarSystem) {
    void _solarSystem;
    this.el = document.getElementById('lunar-eclipse-map')!;
    this.canvas = document.getElementById('lunar-eclipse-map-canvas') as HTMLCanvasElement;
    this.ctx = this.canvas.getContext('2d')!;
    this.titleEl = document.getElementById('lunar-eclipse-map-title')!;
    this.detailsEl = document.getElementById('lunar-eclipse-map-details')!;
    document.getElementById('lunar-eclipse-map-close')!
      .addEventListener('click', () => this.hide());
  }

  show(peakJd: number, label: string): void {
    const sun = (jd: number): Vector3 => sunPositionEcliptic(jd);
    const moon = (jd: number): Vector3 => moonPositionEcliptic(jd);
    this.currentResult = computeLunarEclipse(sun, moon, peakJd, 0.25, 1 / 1440);
    this.titleEl.textContent = label;
    this.el.style.display = '';
    requestAnimationFrame(() => this.draw());
    this.renderDetails();
  }

  hide(): void { this.el.style.display = 'none'; }

  private draw(): void {
    const r = this.currentResult;
    if (!r) return;
    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = Math.round(rect.width * dpr);
    this.canvas.height = Math.round(rect.height * dpr);
    const ctx = this.ctx;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const W = rect.width, H = rect.height;
    ctx.fillStyle = '#0a1020';
    ctx.fillRect(0, 0, W, H);

    if (r.kind === 'none') {
      ctx.fillStyle = 'rgba(220,230,245,0.7)';
      ctx.font = '14px sans-serif';
      ctx.fillText('（無月食事件）', W / 2 - 50, H / 2);
      return;
    }

    // Find scale: largest radius we need to fit (penumbra at greatest moment).
    const peak = r.frames.find(f => Math.abs(f.jd - r.greatestJd!) < 1 / 1440 / 2)
              ?? r.frames[Math.floor(r.frames.length / 2)];
    const maxRadiusKm = peak.penumbraRadiusKm * 1.15; // give 15% margin
    // Map km → CSS pixels. Use the smaller of W, H as the diameter.
    const cx = W / 2, cy = H / 2;
    const scale = Math.min(W, H) * 0.45 / maxRadiusKm;
    const km2px = (k: number) => k * scale;

    // Penumbra (light grey ring outline + faint fill)
    ctx.fillStyle = 'rgba(180,190,220,0.07)';
    ctx.strokeStyle = 'rgba(180,190,220,0.45)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, km2px(peak.penumbraRadiusKm), 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Umbra (dark grey disc)
    ctx.fillStyle = 'rgba(80,80,90,0.7)';
    ctx.strokeStyle = 'rgba(120,120,140,0.85)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, km2px(peak.umbraRadiusKm), 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Labels for shadow circles
    ctx.fillStyle = 'rgba(180,190,220,0.6)';
    ctx.font = '10px sans-serif';
    ctx.fillText('半影', cx + km2px(peak.penumbraRadiusKm) * 0.7, cy - km2px(peak.penumbraRadiusKm) * 0.7);
    ctx.fillStyle = 'rgba(220,220,235,0.7)';
    ctx.fillText('本影', cx + km2px(peak.umbraRadiusKm) * 0.7, cy - km2px(peak.umbraRadiusKm) * 0.7);

    // Moon trajectory polyline
    ctx.strokeStyle = 'rgba(255,200,80,0.7)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    let first = true;
    for (const f of r.frames) {
      const x = cx + km2px(f.moonOffsetKm.x);
      const y = cy - km2px(f.moonOffsetKm.y);
      if (first) { ctx.moveTo(x, y); first = false; }
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Moon disc at greatest moment (white with golden outline).
    {
      const x = cx + km2px(peak.moonOffsetKm.x);
      const y = cy - km2px(peak.moonOffsetKm.y);
      ctx.fillStyle = 'rgba(245,235,210,0.9)';
      ctx.strokeStyle = '#ffcc40';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, km2px(peak.moonRadiusKm), 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#ffcc40';
      ctx.font = 'bold 11px sans-serif';
      ctx.fillText('★ 食甚', x + km2px(peak.moonRadiusKm) + 6, y + 4);
    }

    // Contact dots (P1/U1/U2/U3/U4/P4) — small ticks at known contact times.
    const contacts: Array<{ jd: number | null; label: string; color: string }> = [
      { jd: r.p1Jd, label: 'P1', color: 'rgba(180,200,230,0.85)' },
      { jd: r.u1Jd, label: 'U1', color: '#ff7050' },
      { jd: r.u2Jd, label: 'U2', color: '#ffcc40' },
      { jd: r.u3Jd, label: 'U3', color: '#ffcc40' },
      { jd: r.u4Jd, label: 'U4', color: '#ff7050' },
      { jd: r.p4Jd, label: 'P4', color: 'rgba(180,200,230,0.85)' },
    ];
    for (const c of contacts) {
      if (c.jd == null) continue;
      const f = r.frames.reduce((a, b) =>
        Math.abs(a.jd - c.jd!) < Math.abs(b.jd - c.jd!) ? a : b);
      const x = cx + km2px(f.moonOffsetKm.x);
      const y = cy - km2px(f.moonOffsetKm.y);
      ctx.fillStyle = c.color;
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = c.color;
      ctx.font = '10px sans-serif';
      ctx.fillText(c.label, x + 6, y - 4);
    }
  }

  private renderDetails(): void {
    const r = this.currentResult;
    if (!r) { this.detailsEl.innerHTML = ''; return; }
    const fmtTime = (jd: number | null): string => {
      if (jd == null) return '—';
      const d = new Date((jd - 2440587.5) * 86400000);
      return `${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}:${pad2(d.getUTCSeconds())} UT`;
    };
    const kindLabel = r.kind === 'total' ? '月全食'
                    : r.kind === 'partial' ? '月偏食'
                    : r.kind === 'penumbral' ? '半影月食'
                    : '無月食';
    const date = r.greatestJd != null
      ? new Date((r.greatestJd - 2440587.5) * 86400000).toISOString().slice(0, 10)
      : '—';
    this.detailsEl.innerHTML = `
      <div><b>${kindLabel}</b>${r.kind !== 'none' ? ` · 食分 ${r.umbraMagnitude.toFixed(3)}` : ''}</div>
      <div style="margin-top:6px;">日期：${date}</div>
      <table style="font-size:11px;margin-top:6px;width:100%;border-collapse:collapse;">
        <tr><td style="color:rgba(180,200,230,0.85);">P1（半影開始）</td><td style="text-align:right;">${fmtTime(r.p1Jd)}</td></tr>
        <tr><td style="color:#ff7050;">U1（本影開始）</td><td style="text-align:right;">${fmtTime(r.u1Jd)}</td></tr>
        <tr><td style="color:#ffcc40;">U2（全食開始）</td><td style="text-align:right;">${fmtTime(r.u2Jd)}</td></tr>
        <tr><td style="color:#ffcc40;font-weight:600;">★ 食甚</td><td style="text-align:right;font-weight:600;">${fmtTime(r.greatestJd)}</td></tr>
        <tr><td style="color:#ffcc40;">U3（全食結束）</td><td style="text-align:right;">${fmtTime(r.u3Jd)}</td></tr>
        <tr><td style="color:#ff7050;">U4（本影結束）</td><td style="text-align:right;">${fmtTime(r.u4Jd)}</td></tr>
        <tr><td style="color:rgba(180,200,230,0.85);">P4（半影結束）</td><td style="text-align:right;">${fmtTime(r.p4Jd)}</td></tr>
      </table>
      <div style="margin-top:6px;color:var(--text-dim);font-size:10px;">
        ${r.kind === 'total'
          ? '全食時段（U2 → U3）月球完全進入地球本影，呈現紅銅色「血月」。'
          : r.kind === 'partial'
          ? '部分月面進入本影；未進入部分仍受半影微弱遮蔽。'
          : r.kind === 'penumbral'
          ? '月面僅穿過半影區，肉眼難以察覺；攝影可記錄到輕微暗化。'
          : ''}
        <br>包含 Danjon 大氣修正（影錐 +2%）；食甚時刻 < 1 分鐘誤差，接觸時刻 ±1-2 分鐘。
      </div>
    `;
  }
}

function pad2(n: number): string {
  return n.toString().padStart(2, '0');
}
