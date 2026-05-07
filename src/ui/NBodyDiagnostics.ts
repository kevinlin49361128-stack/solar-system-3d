import type { SolarSystem } from '../scene/SolarSystem';
import { t } from '../i18n';

/**
 * N-body conservation diagnostics panel. Shipped as part of the project's
 * "explainable astronomy simulator" angle (Tier 1 from astrophysicist
 * tester feedback).
 *
 * What it shows
 * -------------
 * - Current relative drift of total energy: |E(t) − E₀| / |E₀|
 * - Current relative drift of |L|: ||L(t)| − |L₀|| / |L₀|
 * - A small sparkline plotting the energy drift over the last ~120 samples
 *
 * Sampling
 * --------
 * Samples once per second (in real wall-clock time) — frequent enough to
 * make integrator differences visible when scrubbing time fast, infrequent
 * enough that the O(N²) PE pair sum doesn't show up in profiling. The
 * baseline (E₀, L₀) is captured the first time N-body is enabled and
 * persists across integrator/GR-toggle changes so the user can SEE how
 * switching integrators affects the drift.
 *
 * Visibility
 * ----------
 * Hidden when N-body is off (panel only makes sense for an active sim).
 * The "reset baseline" button lets the user re-zero E₀, L₀ — useful for
 * comparing integrators fairly: enable Yoshida 4 → click reset → wait
 * 30s of sim time → drift number now reflects only Yoshida.
 */
export class NBodyDiagnostics {
  private el: HTMLElement;
  private statusEl: HTMLElement;
  private sparkCanvas: HTMLCanvasElement;
  private sparkCtx: CanvasRenderingContext2D;
  private resetBtn: HTMLButtonElement;

  private baselineE: number | null = null;
  private baselineL: number | null = null;
  private samples: number[] = []; // last N relative-energy-drift values (signed)
  private readonly SAMPLE_LIMIT = 120;
  private timer: number | null = null;

  constructor(private solarSystem: SolarSystem) {
    this.el = document.getElementById('nbody-diag-panel')!;
    this.statusEl = document.getElementById('nbody-diag-status')!;
    this.sparkCanvas = document.getElementById('nbody-diag-spark') as HTMLCanvasElement;
    this.sparkCtx = this.sparkCanvas.getContext('2d')!;
    this.resetBtn = document.getElementById('nbody-diag-reset') as HTMLButtonElement;

    this.resetBtn.addEventListener('click', () => this.resetBaseline());

    // Sample once per real second. Cheap enough to keep running even when
    // N-body is disabled (we just no-op if there's no sim).
    this.timer = window.setInterval(() => this.sample(), 1000);
  }

  /** Reset baseline E₀, L₀ to the current values + clear sparkline. */
  resetBaseline(): void {
    const sim = this.solarSystem.getNBodySimulation();
    if (!sim) return;
    const c = sim.getConservation();
    this.baselineE = c.totalE;
    this.baselineL = c.angMom;
    this.samples = [];
    this.render();
  }

  private sample(): void {
    const sim = this.solarSystem.getNBodySimulation();
    if (!sim) {
      // N-body disabled — hide panel + drop baseline so next enable starts fresh
      this.el.style.display = 'none';
      this.baselineE = null;
      this.baselineL = null;
      this.samples = [];
      return;
    }
    this.el.style.display = '';
    const c = sim.getConservation();
    if (this.baselineE === null || this.baselineL === null) {
      this.baselineE = c.totalE;
      this.baselineL = c.angMom;
      this.samples = [];
    }
    // Relative drift, signed (gain or loss). For a symplectic integrator
    // it should oscillate around 0 — non-zero mean = bug.
    const dE = (c.totalE - this.baselineE) / Math.abs(this.baselineE);
    this.samples.push(dE);
    if (this.samples.length > this.SAMPLE_LIMIT) this.samples.shift();
    this.render();
  }

  private render(): void {
    const sim = this.solarSystem.getNBodySimulation();
    if (!sim || this.baselineE === null || this.baselineL === null) {
      this.statusEl.innerHTML = `<span style="color:var(--text-dim);">${t('diag.idle')}</span>`;
      return;
    }
    const c = sim.getConservation();
    const dE = (c.totalE - this.baselineE) / Math.abs(this.baselineE);
    const dL = (c.angMom - this.baselineL) / Math.abs(this.baselineL);
    const integrator = sim.integrator === 'yoshida4' ? 'Yoshida 4' : 'Verlet';
    const gr = sim.relativisticGR ? ' + GR' : '';

    const eClass = Math.abs(dE) < 1e-6 ? 'good' : Math.abs(dE) < 1e-3 ? 'ok' : 'bad';
    const lClass = Math.abs(dL) < 1e-9 ? 'good' : Math.abs(dL) < 1e-6 ? 'ok' : 'bad';

    this.statusEl.innerHTML = `
      <div class="nb-row"><span class="nb-key">${t('diag.integrator')}</span>
        <span class="nb-val">${integrator}${gr}</span></div>
      <div class="nb-row"><span class="nb-key">ΔE / E₀</span>
        <span class="nb-val nb-${eClass}">${this.fmtSci(dE)}</span></div>
      <div class="nb-row"><span class="nb-key">Δ|L| / |L₀|</span>
        <span class="nb-val nb-${lClass}">${this.fmtSci(dL)}</span></div>
    `;
    this.drawSparkline();
  }

  /** Format a small signed number in scientific notation, e.g. "+3.42e-7". */
  private fmtSci(x: number): string {
    if (x === 0) return '0';
    const abs = Math.abs(x);
    if (abs > 1) return x.toExponential(2);
    return (x >= 0 ? '+' : '') + x.toExponential(2);
  }

  private drawSparkline(): void {
    const ctx = this.sparkCtx;
    const W = this.sparkCanvas.width;
    const H = this.sparkCanvas.height;
    ctx.clearRect(0, 0, W, H);

    const samples = this.samples;
    if (samples.length < 2) return;

    // Y-scale: symmetric around 0, autosize to peak abs value (with floor
    // so a perfect symplectic doesn't render as a flat invisible line).
    const peak = Math.max(...samples.map(Math.abs), 1e-12);
    const yScale = (H * 0.4) / peak;

    // Zero baseline
    ctx.strokeStyle = 'rgba(160,180,210,0.25)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, H / 2);
    ctx.lineTo(W, H / 2);
    ctx.stroke();

    // Trace
    ctx.strokeStyle = '#5db1ff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < samples.length; i++) {
      const x = (i / (this.SAMPLE_LIMIT - 1)) * W;
      const y = H / 2 - samples[i] * yScale;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Peak label
    ctx.fillStyle = 'rgba(180,200,230,0.55)';
    ctx.font = '9px ui-monospace, monospace';
    ctx.fillText(`±${this.fmtSci(peak)}`, 4, 10);
  }

  destroy(): void {
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
  }
}
