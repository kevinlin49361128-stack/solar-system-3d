/**
 * Tiny FPS / frame-time HUD. Shift+P toggles visibility (off by default to
 * keep the screen clean). Costs nothing when hidden — the per-frame `mark()`
 * is a single timestamp + ring-buffer write.
 */
export class PerfHUD {
  private el: HTMLDivElement;
  private samples: number[] = [];
  private lastFlush = performance.now();
  private prev = performance.now();
  private visible = false;

  constructor() {
    this.el = document.createElement('div');
    this.el.id = 'perf-hud';
    this.el.style.cssText = [
      'position: fixed',
      'bottom: 36px',
      'right: 16px',
      'z-index: 1400',
      'background: rgba(8, 12, 22, 0.85)',
      'border: 1px solid rgba(120, 160, 220, 0.3)',
      'border-radius: 6px',
      'padding: 6px 10px',
      'color: #cfe2ff',
      'font: 11px ui-monospace, "SF Mono", Menlo, monospace',
      'pointer-events: none',
      'min-width: 120px',
      'display: none',
      'white-space: pre',
      'line-height: 1.45',
      'backdrop-filter: blur(8px)',
      '-webkit-backdrop-filter: blur(8px)',
    ].join(';');
    document.body.appendChild(this.el);

    window.addEventListener('keydown', (e) => {
      // Shift+P toggle. Avoid hijacking when typing in inputs.
      if (e.shiftKey && (e.key === 'P' || e.key === 'p')) {
        const active = document.activeElement as HTMLElement | null;
        if (active && /^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName)) return;
        this.setVisible(!this.visible);
      }
    });
  }

  setVisible(v: boolean): void {
    this.visible = v;
    this.el.style.display = v ? '' : 'none';
  }

  /** Call once per rendered frame. */
  mark(): void {
    const now = performance.now();
    this.samples.push(now - this.prev);
    this.prev = now;

    // Keep a rolling 240-sample window (~4 sec at 60 FPS).
    if (this.samples.length > 240) this.samples.splice(0, this.samples.length - 240);

    if (!this.visible) return;
    if (now - this.lastFlush < 200) return; // 5 Hz refresh
    this.lastFlush = now;

    const n = this.samples.length;
    let sum = 0;
    let max = 0;
    for (const s of this.samples) {
      sum += s;
      if (s > max) max = s;
    }
    const avg = sum / n;
    const fps = 1000 / avg;
    const drawCalls = (window as { __drawCalls?: number }).__drawCalls;
    const triangles = (window as { __triangles?: number }).__triangles;

    let line = `${fps.toFixed(0).padStart(3)} FPS · ${avg.toFixed(1)}ms (max ${max.toFixed(1)})`;
    if (drawCalls !== undefined) line += `\ndraw calls: ${drawCalls}`;
    if (triangles !== undefined) line += `\ntris: ${triangles.toLocaleString()}`;
    this.el.textContent = line;
  }
}
