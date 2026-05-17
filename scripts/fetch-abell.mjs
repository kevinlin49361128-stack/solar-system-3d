#!/usr/bin/env node
/**
 * Build the Abell rich galaxy cluster catalogue (1958 + 1989 supp.)
 * from VizieR VII/110A into compact tuple JSON.
 *
 * Abell + Corwin + Olowin's catalogue lists ~4 073 rich galaxy
 * clusters. For the smart-telescope crowd these are the
 * "deep-imaging Mt Everest" — most are mag 15-18 with apparent
 * diameters of 10-30 arcmin, perfectly sized for a Seestar S50 FOV.
 *
 * Source: VizieR catalog VII/110A via the CDS TSV interface. Returns
 * J2000 RA/Dec, distance class, richness class, count of galaxies
 * near m10.
 *
 * Output: public/abell-clusters.json — tuple per entry:
 *   [aclo, raHours, decDeg, distClass, richness, count]
 * where:
 *   aclo        Abell catalogue number (positive int for "A NNNN")
 *   distClass   distance class 1-7 (1=nearest ≈ z 0.02, 7=farthest ≈ z 0.2)
 *   richness    Abell's richness group 0-5 (more galaxies = higher)
 *   count       galaxy count down to m10 + 2
 *
 * Run:
 *   node scripts/fetch-abell.mjs
 */
import { writeFileSync } from 'node:fs';

// VII/110A stores B1950 sexagesimal; VizieR auto-computes ICRS
// (functionally J2000 for our precision needs) via `_RA.icrs` / `_DE.icrs`
// in sexagesimal format. Note exact column names: `Dclass` (lowercase
// 'c'), and the ICRS columns use dots not capitals.
const URL = 'https://vizier.cds.unistra.fr/viz-bin/asu-tsv?'
  + '-source=VII/110A/table3'
  + '&-out=ACO,_RA.icrs,_DE.icrs,Dclass,Rich,Count'
  + '&-out.max=10000';

console.error(`Fetching ${URL}`);
const r = await fetch(URL);
if (!r.ok) {
  console.error(`Fetch failed: ${r.status}`);
  process.exit(1);
}
const tsv = await r.text();
const lines = tsv.split('\n');

// VizieR TSV: header comments, then field names + units + dashes,
// then data. Spot the dashes row to find data start.
let dataStart = -1;
for (let i = 0; i < lines.length - 1; i++) {
  if (/^-+(\t-+)+\s*$/.test(lines[i])) {
    dataStart = i + 1;
    break;
  }
}
if (dataStart < 0) {
  console.error('Could not find data block.');
  console.error('First 40 lines:');
  console.error(lines.slice(0, 40).join('\n'));
  process.exit(1);
}

const out = [];
for (let i = dataStart; i < lines.length; i++) {
  const line = lines[i];
  if (!line || line.startsWith('#')) continue;
  const cols = line.split('\t').map(s => s.trim());
  if (cols.length < 6) continue;

  const aclo = parseInt(cols[0], 10);
  if (!Number.isFinite(aclo)) continue;
  // `_RA.icrs` is "HH MM SS.s"; `_DE.icrs` is "+DD MM SS".
  const raHours = parseSexagesimalHours(cols[1]);
  const decDeg = parseSexagesimalDeg(cols[2]);
  if (!Number.isFinite(raHours) || !Number.isFinite(decDeg)) continue;
  const dClass = parseInt(cols[3], 10);
  const rich = parseInt(cols[4], 10);
  const count = parseInt(cols[5], 10);

  out.push([
    aclo,
    +raHours.toFixed(5),
    +decDeg.toFixed(4),
    Number.isFinite(dClass) ? dClass : 0,
    Number.isFinite(rich) ? rich : 0,
    Number.isFinite(count) ? count : 0,
  ]);
}

console.error(`Parsed ${out.length} Abell entries.`);
const json = JSON.stringify(out);
writeFileSync('public/abell-clusters.json', json);
console.error(`Wrote public/abell-clusters.json (${(json.length / 1024).toFixed(0)} KB)`);

/** "HH MM SS.s" → decimal hours. */
function parseSexagesimalHours(s) {
  if (!s) return NaN;
  const m = s.match(/^\s*(\d+)\s+(\d+)\s+([\d.]+)\s*$/);
  if (!m) return NaN;
  return +m[1] + (+m[2]) / 60 + (+m[3]) / 3600;
}
/** "+DD MM SS" → decimal degrees. */
function parseSexagesimalDeg(s) {
  if (!s) return NaN;
  const m = s.match(/^\s*([+-]?)(\d+)\s+(\d+)\s+([\d.]+)\s*$/);
  if (!m) return NaN;
  const sign = m[1] === '-' ? -1 : 1;
  return sign * ((+m[2]) + (+m[3]) / 60 + (+m[4]) / 3600);
}
