#!/usr/bin/env node
/**
 * Convert the HYG database (https://github.com/astronexus/HYG-Database) into
 * the compact JSON format consumed by RealStarfield: a flat array of
 *   [raHours, decDeg, mag, colorInt?]
 * tuples. Only stars BRIGHTER than MAG_LIMIT are emitted (the BSC catalogue
 * already shipped covers mag ≤ 6.5; this extended set adds the next ~50k
 * stars down to mag 9 — still light enough to ship over the network).
 *
 * Usage:
 *   curl -L -o hyg.csv https://github.com/astronexus/HYG-Database/raw/main/hyg/CURRENT/hygdata_v41.csv
 *   node scripts/build-extended-stars.mjs hyg.csv public/stars-hyg.json
 */

import { readFileSync, writeFileSync } from 'fs';

const MAG_LIMIT = 9.0;
// Skip stars already in BSC (which we ship at full mag) — anything brighter
// than mag 6.5 is presumed already loaded via stars-bsc.json. Tiny double-
// count is harmless because additive blending normalises.
const MAG_FLOOR = 6.5;

const [, , inPath, outPath] = process.argv;
if (!inPath || !outPath) {
  console.error('usage: build-extended-stars.mjs <hyg.csv> <out.json>');
  process.exit(1);
}

const text = readFileSync(inPath, 'utf8');
const lines = text.split('\n');
const header = lines[0].split(',').map((s) => s.replace(/"/g, '').trim());
const idx = (name) => header.indexOf(name);
const I_RA = idx('ra'), I_DEC = idx('dec'), I_MAG = idx('mag'), I_CI = idx('ci');

if (I_RA < 0 || I_DEC < 0 || I_MAG < 0) {
  console.error('Missing required columns in HYG CSV header');
  process.exit(1);
}

/**
 * B-V index → packed RGB. Empirical 5-stop interpolation between bluish-
 * white (-0.4) → white (0.0) → yellow (0.6) → orange (1.0) → red (1.5+).
 * Output: 0xRRGGBB integer ready for RealStarfield's `colorInt` slot.
 */
function bvToColorInt(bv) {
  if (!Number.isFinite(bv)) return 0xffffff;
  // 5 anchor colours, weights linear between.
  const stops = [
    { bv: -0.4, rgb: [0.65, 0.78, 1.00] },
    { bv:  0.0, rgb: [1.00, 1.00, 1.00] },
    { bv:  0.6, rgb: [1.00, 0.96, 0.78] },
    { bv:  1.0, rgb: [1.00, 0.80, 0.55] },
    { bv:  1.6, rgb: [1.00, 0.60, 0.40] },
  ];
  let lo = stops[0], hi = stops[stops.length - 1];
  for (let i = 0; i < stops.length - 1; i++) {
    if (bv >= stops[i].bv && bv <= stops[i + 1].bv) {
      lo = stops[i];
      hi = stops[i + 1];
      break;
    }
  }
  const t = lo === hi ? 0 : (bv - lo.bv) / (hi.bv - lo.bv);
  const r = Math.round(255 * (lo.rgb[0] + (hi.rgb[0] - lo.rgb[0]) * t));
  const g = Math.round(255 * (lo.rgb[1] + (hi.rgb[1] - lo.rgb[1]) * t));
  const b = Math.round(255 * (lo.rgb[2] + (hi.rgb[2] - lo.rgb[2]) * t));
  return (r << 16) | (g << 8) | b;
}

const out = [];
let kept = 0, skippedBright = 0, skippedDim = 0, skippedBad = 0;

for (let i = 1; i < lines.length; i++) {
  const cols = lines[i].split(',');
  if (cols.length < I_MAG + 1) continue;
  const raH = parseFloat(cols[I_RA]);
  const dec = parseFloat(cols[I_DEC]);
  const mag = parseFloat(cols[I_MAG]);
  const ci = I_CI >= 0 ? parseFloat(cols[I_CI]) : NaN;
  if (!Number.isFinite(raH) || !Number.isFinite(dec) || !Number.isFinite(mag)) {
    skippedBad++;
    continue;
  }
  if (mag <= MAG_FLOOR) { skippedBright++; continue; }
  if (mag > MAG_LIMIT) { skippedDim++; continue; }
  const colorInt = bvToColorInt(ci);
  // Round positions to 4 decimals (~0.36 arcsec → still far under naked-eye
  // ~60 arcsec and any on-screen pixel) to shrink JSON footprint. 4dp vs 6dp
  // is a ~19 % brotli cut on this on-demand fetch with no visible change.
  out.push([
    Math.round(raH * 1e4) / 1e4,
    Math.round(dec * 1e4) / 1e4,
    Math.round(mag * 100) / 100,
    colorInt,
  ]);
  kept++;
}

writeFileSync(outPath, JSON.stringify(out));
console.log(`Wrote ${kept} stars to ${outPath}`);
console.log(`  Skipped: ${skippedBright} bright (already in BSC), ${skippedDim} too dim, ${skippedBad} parse error`);
const sizeKB = (Buffer.byteLength(JSON.stringify(out)) / 1024).toFixed(1);
console.log(`  Output size: ${sizeKB} KB (raw JSON, gzip will be ~40%)`);
