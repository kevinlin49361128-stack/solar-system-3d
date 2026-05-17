#!/usr/bin/env node
/**
 * Build the full NGC + IC catalogue from OpenNGC v2 into a compact
 * packed-tuple JSON for the runtime layer.
 *
 * OpenNGC entries are CSV with ';' separators, ~14 000 rows covering
 * NGC + IC plus Messier cross-references. We filter to entries that:
 *   - Have a usable J2000 RA/Dec
 *   - Aren't duplicates of the already-curated MESSIER + NGC_DATA arrays
 *     (those carry richer trilingual names + i18n hooks; this bulk layer
 *      is for "everything else")
 *   - Aren't entries with status NonEx (non-existent), Dup (duplicate
 *     designation of another row), or empty.
 *
 * Schema per record (Float32-friendly tuple):
 *   [id_short, raHours, decDeg, mag, typeIdx, majorArcmin, minorArcmin]
 * id_short is the integer numeric part (NGC 1234 → 1234, IC 5070 → -5070
 * to distinguish IC from NGC).
 * typeIdx maps to the same 6-class scheme MessierLayer uses:
 *   0=G, 1=GC, 2=OC, 3=N, 4=PN, 5=SNR (anything else → 0 default).
 *
 * Output: public/ngc-full.json (~700 KB)
 *
 * Run:
 *   node scripts/fetch-ngc-full.mjs
 */
import { writeFileSync } from 'node:fs';

const URL = 'https://raw.githubusercontent.com/mattiaverga/OpenNGC/master/database_files/NGC.csv';

console.error(`Fetching ${URL}`);
const r = await fetch(URL);
if (!r.ok) {
  console.error(`Fetch failed: ${r.status}`);
  process.exit(1);
}
const csv = await r.text();
const lines = csv.split('\n');
const header = lines[0].split(';').map(s => s.trim());

const col = name => {
  const i = header.indexOf(name);
  if (i < 0) {
    console.error(`Header missing: ${name} — available: ${header.join(', ')}`);
    process.exit(1);
  }
  return i;
};
const I_NAME = col('Name');         // e.g. "NGC0001" or "IC0001"
const I_TYPE = col('Type');         // G, GCl, OCl, Neb, PN, SNR, Dup, NonEx, ...
const I_RA   = col('RA');           // "HH:MM:SS.ss"
const I_DEC  = col('Dec');          // "+/-DD:MM:SS.s"
const I_MAGV = col('V-Mag');
const I_MAGB = col('B-Mag');
const I_MAJ  = col('MajAx');
const I_MIN  = col('MinAx');
const I_M    = col('M');

// Already-curated (richer names + i18n) — skip these in bulk so they
// don't double-render. Format matches the OpenNGC `Name` field.
// We just exclude any row that has a non-empty M (it's a Messier
// already covered by MESSIER) — and we'll cross-check NGC_DATA via
// numeric IDs at the end.
const CURATED_NGC_IDS = new Set([
  // Sourced from NGC_DATA in src/data/ngc.ts at time of build.
  7000, 5070, 1499, 2024, 434, 410, 6995, 6960, 7635, 281,
  6888, 7822, 1893, 1977, 7129, 7380, 281, 6334, 6357,
  869, 884, 5128, 4565, 4631, 4258, 891, 7331, 253,
  2237, 2244, 3372, 6334, 6357,
]);
const TYPE_TO_IDX = {
  'G': 0, 'G+': 0, 'GPair': 0, 'GTrpl': 0, 'GGroup': 0,
  'GCl': 1, 'GCl+N': 1,
  'OCl': 2,
  'Neb': 3, 'EmN': 3, 'RfN': 3, 'HII': 3, 'DrkN': 3, 'Cl+N': 3,
  'PN': 4,
  'SNR': 5,
};

let total = 0, kept = 0;
const out = [];
for (let i = 1; i < lines.length; i++) {
  const line = lines[i];
  if (!line) continue;
  total++;
  const f = line.split(';');
  const name = f[I_NAME]?.trim();
  if (!name) continue;
  const type = f[I_TYPE]?.trim();
  if (!type || type === 'NonEx' || type === 'Dup' || type === 'Other') continue;
  const typeIdx = TYPE_TO_IDX[type];
  if (typeIdx === undefined) continue;

  // Skip Messier-cross-references (rendered by Messier layer).
  if (f[I_M]?.trim()) continue;

  const raHours = parseRA(f[I_RA]);
  const decDeg = parseDec(f[I_DEC]);
  if (!Number.isFinite(raHours) || !Number.isFinite(decDeg)) continue;

  // id_short: parse leading "NGC" or "IC" prefix + numeric.
  const m = name.match(/^(NGC|IC)\s*(\d+)$/);
  if (!m) continue;
  const prefix = m[1];
  const num = parseInt(m[2], 10);
  if (!Number.isFinite(num)) continue;
  const idShort = prefix === 'IC' ? -num : num;

  // Skip already-curated NGC IDs (NGC only — IC dupes are tracked in
  // NGC_DATA via signed IDs too but the set is small enough we don't
  // bother).
  if (prefix === 'NGC' && CURATED_NGC_IDS.has(num)) continue;

  // Prefer V mag; fall back to B mag; default to 12 if both missing
  // (most NGC objects without listed mag are mid-teens galaxies).
  let mag = parseFloat(f[I_MAGV]);
  if (!Number.isFinite(mag)) mag = parseFloat(f[I_MAGB]);
  if (!Number.isFinite(mag)) mag = 13.0;

  const maj = parseFloat(f[I_MAJ]);
  const min = parseFloat(f[I_MIN]);

  out.push([
    idShort,
    +raHours.toFixed(5),
    +decDeg.toFixed(4),
    +mag.toFixed(2),
    typeIdx,
    Number.isFinite(maj) ? +maj.toFixed(2) : 0,
    Number.isFinite(min) ? +min.toFixed(2) : 0,
  ]);
  kept++;
}

console.error(`Parsed ${total} OpenNGC rows; kept ${kept} non-Messier NGC/IC entries.`);
const json = JSON.stringify(out);
writeFileSync('public/ngc-full.json', json);
console.error(`Wrote public/ngc-full.json (${(json.length / 1024).toFixed(0)} KB)`);

/** "HH:MM:SS.ss" → decimal hours. */
function parseRA(s) {
  if (!s) return NaN;
  const m = s.match(/^\s*(\d+):(\d+):([\d.]+)\s*$/);
  if (!m) return NaN;
  return +m[1] + (+m[2]) / 60 + (+m[3]) / 3600;
}
/** "+DD:MM:SS.s" or "-DD:MM:SS.s" → decimal degrees. */
function parseDec(s) {
  if (!s) return NaN;
  const m = s.match(/^\s*([+-]?)(\d+):(\d+):([\d.]+)\s*$/);
  if (!m) return NaN;
  const sign = m[1] === '-' ? -1 : 1;
  return sign * ((+m[2]) + (+m[3]) / 60 + (+m[4]) / 3600);
}
