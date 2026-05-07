/**
 * Lightweight inline-SVG chart helpers for InfoPanel.
 *
 * Returns raw SVG/HTML strings — InfoPanel composes them into innerHTML.
 * Stylable via the parent panel's CSS (we set inline fills/strokes).
 */

const PALETTE = [
  '#5db1ff', '#ff8a5d', '#7fd07f', '#d97aff',
  '#ffd060', '#5ed4d4', '#ff6b9b', '#a89bff',
  '#9ed062', '#ff9966', '#bdb6c4',
];

export interface ChartEntry {
  name: string;
  pct: number;
}

export function pieChartSvg(entries: ChartEntry[], size = 120): string {
  const total = entries.reduce((s, e) => s + e.pct, 0);
  if (total <= 0) return '';

  const r = size / 2 - 1;
  const cx = size / 2;
  const cy = size / 2;
  let acc = 0;
  let paths = '';

  entries.forEach((e, i) => {
    const start = (acc / total) * Math.PI * 2 - Math.PI / 2;
    acc += e.pct;
    const end = (acc / total) * Math.PI * 2 - Math.PI / 2;
    const sweep = end - start;

    const color = PALETTE[i % PALETTE.length];
    if (sweep >= Math.PI * 2 - 1e-6) {
      // single full slice — render as a circle to avoid degenerate path
      paths += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}"/>`;
      return;
    }
    const x1 = cx + r * Math.cos(start);
    const y1 = cy + r * Math.sin(start);
    const x2 = cx + r * Math.cos(end);
    const y2 = cy + r * Math.sin(end);
    const largeArc = sweep > Math.PI ? 1 : 0;
    paths += `<path d="M${cx} ${cy} L${x1} ${y1} A${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z" fill="${color}"/>`;
  });

  return `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" style="display:block;margin:6px auto;">${paths}</svg>`;
}

export function paletteColor(i: number): string {
  return PALETTE[i % PALETTE.length];
}

/**
 * Render a single composition row with name, color swatch, % bar, and value.
 * Used inline within a vertical list.
 */
export function compositionRowHtml(entry: ChartEntry, index: number, maxPct: number): string {
  const color = paletteColor(index);
  const widthPct = Math.max(0.5, (entry.pct / maxPct) * 100);
  const valueStr = formatPct(entry.pct);
  return `
    <div class="comp-row">
      <span class="swatch" style="background:${color};"></span>
      <span class="comp-name">${escapeHtml(entry.name)}</span>
      <span class="comp-bar"><span class="comp-bar-fill" style="width:${widthPct.toFixed(2)}%;background:${color};"></span></span>
      <span class="comp-val">${valueStr}</span>
    </div>`;
}

export function compositionListHtml(entries: ChartEntry[]): string {
  const max = entries.reduce((m, e) => Math.max(m, e.pct), 0);
  return entries.map((e, i) => compositionRowHtml(e, i, max)).join('');
}

/** Temperature gauge: shows a coloured bar with a marker for mean & range. */
export function tempGaugeHtml(meanC: number | undefined, rangeC: [number, number] | undefined): string {
  if (meanC == null && !rangeC) return '';

  // Anchor scale: -250°C (Pluto) to +500°C (Venus). Anything outside clamps to edges.
  const minScale = -250;
  const maxScale = 500;
  const toPct = (c: number) => Math.max(0, Math.min(100, ((c - minScale) / (maxScale - minScale)) * 100));

  let html = '<div class="temp-gauge">';
  html += '<div class="temp-track">';
  if (rangeC) {
    const [lo, hi] = rangeC;
    const left = toPct(lo);
    const w = Math.max(1, toPct(hi) - left);
    html += `<div class="temp-range" style="left:${left.toFixed(1)}%;width:${w.toFixed(1)}%;"></div>`;
  }
  if (meanC != null) {
    html += `<div class="temp-mean" style="left:${toPct(meanC).toFixed(1)}%;"></div>`;
  }
  html += '</div>';
  html += '<div class="temp-labels"><span>-250°C</span><span>0°C</span><span>+500°C</span></div>';
  html += '</div>';
  return html;
}

function formatPct(pct: number): string {
  if (pct >= 1) return `${pct.toFixed(pct >= 10 ? 1 : 2)}%`;
  if (pct >= 0.001) return `${pct.toFixed(3)}%`;
  return `${pct.toExponential(2)}%`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
