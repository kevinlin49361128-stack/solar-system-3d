#!/usr/bin/env node
/**
 * Build a compact 3D HYG star catalog from the upstream HYG v4.1 CSV
 * (~32 MB) into JSON suitable for runtime fetch.
 *
 * Input: `tmp_hyg/hyg.csv` (downloaded from
 *   https://raw.githubusercontent.com/astronexus/HYG-Database/main/hyg/CURRENT/hygdata_v41.csv
 * )
 *
 * Usage:
 *   node scripts/build-hyg-3d.mjs                                 # default: mag 7 → stars-hyg-3d.json
 *   node scripts/build-hyg-3d.mjs --mag 9 --out public/stars-hyg-3d-deep.json
 *
 * Schema per record (Float32-friendly tuple):
 *   [xLy, yLy, zLy, mag, packedColor]
 *
 * Coordinates are equatorial Cartesian in light-years (HYG ships them
 * pre-computed in parsecs as x/y/z; we convert to ly so 1 scene unit
 * = 1 ly downstream).
 *
 * `packedColor` is the same RGB-packed 24-bit integer the existing
 * stars-hyg.json uses, derived from the B-V colour index. The viewer
 * code already has a colour mapper for this format — we keep it
 * consistent so HygCloud can reuse it.
 *
 * Filters:
 *   - mag ≤ MAG_LIMIT (CLI default 7.0 — naked-eye + binocular limit;
 *     v0.4 added a 9.0 "deep" variant for the smart-telescope era)
 *   - distance > 0 (drops the Sol row + any nan parallax stars)
 *   - distance < 10000 ly (anything further is past the local stellar
 *     neighbourhood; flythrough doesn't need it)
 */
import { readFileSync, writeFileSync } from 'node:fs';

// CLI arg parsing — single --mag and --out flags, both optional.
const argv = process.argv.slice(2);
function arg(name, fallback) {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : fallback;
}
const MAG_LIMIT = parseFloat(arg('mag', '7.0'));
const OUT_PATH = arg('out', 'public/stars-hyg-3d.json');

const PC_TO_LY = 3.26156;
const MAX_DIST_LY = 10_000;

const txt = readFileSync('tmp_hyg/hyg.csv', 'utf8');
const lines = txt.split('\n');
const header = lines[0].split(',').map((s) => s.replace(/"/g, '').trim());
const idx = (name) => {
  const i = header.indexOf(name);
  if (i < 0) throw new Error(`Column not found: ${name}`);
  return i;
};

const I_X = idx('x');
const I_Y = idx('y');
const I_Z = idx('z');
const I_DIST = idx('dist');
const I_MAG = idx('mag');
const I_CI = idx('ci');
const I_SPECT = idx('spect');

let kept = 0;
const out = [];

for (let li = 1; li < lines.length; li++) {
  const line = lines[li];
  if (!line) continue;

  // Naive CSV split — HYG has quoted strings only in `proper`, `bf`,
  // `bayer`, etc., none of which contain commas. The pre-quoted cells
  // do, but the columns we read are all numeric so no escaping needed.
  // We do need to handle quoted spectral types though, which can have
  // commas in rare cases? Actually no — HYG spectral types use ":" and
  // spaces, no commas. Naive split works.
  const f = line.split(',');

  const dist = parseFloat(f[I_DIST]);
  if (!Number.isFinite(dist) || dist <= 0) continue;
  const distLy = dist * PC_TO_LY;
  if (distLy > MAX_DIST_LY) continue;

  const mag = parseFloat(f[I_MAG]);
  if (!Number.isFinite(mag) || mag > MAG_LIMIT) continue;

  // Pre-computed equatorial Cartesian (in parsecs) → light-years.
  const x = parseFloat(f[I_X]) * PC_TO_LY;
  const y = parseFloat(f[I_Y]) * PC_TO_LY;
  const z = parseFloat(f[I_Z]) * PC_TO_LY;

  // B-V colour index → RGB. Same heuristic the existing stars-hyg.json
  // build uses (we replicate it here so the runtime decoder is one
  // function for both files).
  const ci = parseFloat(f[I_CI]);
  const colour = bvToColour(Number.isFinite(ci) ? ci : 0.6);

  // 3-decimal-place ly precision (still 1 part in 10^4 at 1 kly) is
  // more than enough for the visual flythrough; saves bytes.
  out.push([
    +x.toFixed(3),
    +y.toFixed(3),
    +z.toFixed(3),
    +mag.toFixed(2),
    colour,
  ]);
  kept++;
}

console.log(`HYG → 3D: ${kept} stars kept (mag ≤ ${MAG_LIMIT}, dist ≤ ${MAX_DIST_LY} ly)`);
const json = JSON.stringify(out);
console.log(`JSON size: ${(json.length / 1024 / 1024).toFixed(2)} MB`);
writeFileSync(OUT_PATH, json);
console.log(`Wrote ${OUT_PATH}`);

/**
 * Map B-V colour index to packed 24-bit RGB.
 *
 * Reference points (Wien's law for blackbody given the B-V → T_eff
 * approximation; rough piecewise linear fit):
 *   B-V = -0.3  → blue-white (O/B), 0xa8c8ff
 *   B-V =  0.0  → white      (A0V Vega), 0xffffff
 *   B-V =  0.6  → yellow-white (G2V Sun), 0xfff4d8
 *   B-V =  1.5  → orange     (K7), 0xffc070
 *   B-V =  3.0  → deep red   (M cool dwarfs), 0xff7050
 */
function bvToColour(bv) {
  let r, g, b;
  if (bv < 0.0) {
    const t = clamp01((bv + 0.4) / 0.4);
    r = lerp(0.66, 1.0, t);
    g = lerp(0.78, 1.0, t);
    b = 1.0;
  } else if (bv < 0.6) {
    const t = bv / 0.6;
    r = 1.0;
    g = lerp(1.0, 0.96, t);
    b = lerp(1.0, 0.85, t);
  } else if (bv < 1.5) {
    const t = (bv - 0.6) / 0.9;
    r = 1.0;
    g = lerp(0.96, 0.75, t);
    b = lerp(0.85, 0.43, t);
  } else {
    const t = clamp01((bv - 1.5) / 1.5);
    r = lerp(1.0, 1.0, t);
    g = lerp(0.75, 0.44, t);
    b = lerp(0.43, 0.31, t);
  }
  const ri = Math.max(0, Math.min(255, Math.round(r * 255)));
  const gi = Math.max(0, Math.min(255, Math.round(g * 255)));
  const bi = Math.max(0, Math.min(255, Math.round(b * 255)));
  return (ri << 16) | (gi << 8) | bi;
}

function lerp(a, b, t) { return a + (b - a) * t; }
function clamp01(v) { return Math.max(0, Math.min(1, v)); }
