#!/usr/bin/env node
/**
 * Fetch and bundle the Sharpless 2 (Sh2) catalog of HII regions /
 * emission nebulae. Sharpless 1959 listed 313 objects across the
 * Milky Way; this is the smart-scope era's bread-and-butter target
 * list (Hα-bright nebulae that stack out from suburban skies through
 * narrowband filters but are invisible to visual observers).
 *
 * Source: VizieR catalog VII/20 (Sharpless 1959) via the CDS TSV
 * HTTP interface. We restrict to the fields we render:
 *   - id (Sh2-NNN)
 *   - RA (J2000, hours)
 *   - Dec (J2000, degrees)
 *   - diameter (arcmin)
 *   - brightness class (1=brightest, 3=faintest per Sharpless)
 *   - form class (1=circular, 4=highly irregular)
 *   - structure class (1=amorphous, 3=filamentary)
 *
 * Output: public/sharpless2.json — packed tuple per entry:
 *   [id, raHours, decDeg, diameterArcmin, brightnessClass, formClass]
 *
 * Run:
 *   node scripts/fetch-sharpless.mjs
 */
import { writeFileSync } from 'node:fs';

// VII/20 stores coordinates in B1900; ask VizieR to auto-project to
// J2000 via the underscore-prefixed magic columns `_RAJ2000/_DEJ2000`.
// Diam in arcmin; Form/Struct/Bright are Sharpless's 1-3 classifications.
const URL = 'https://vizier.cds.unistra.fr/viz-bin/asu-tsv?'
  + '-source=VII/20/catalog'
  + '&-out=Sh2,_RAJ2000,_DEJ2000,Diam,Form,Struct,Bright'
  + '&-out.max=400';

console.error(`Fetching ${URL}`);
const r = await fetch(URL);
if (!r.ok) {
  console.error(`Fetch failed: ${r.status} ${r.statusText}`);
  process.exit(1);
}
const tsv = await r.text();
const lines = tsv.split('\n');

// VizieR TSV has a header block of comments then field names + units
// + separator dashes, then data. Find the data start by spotting the
// row of all-dashes followed by a non-dash row.
let dataStart = -1;
for (let i = 0; i < lines.length - 1; i++) {
  if (/^-+(\t-+)+\s*$/.test(lines[i])) {
    dataStart = i + 1;
    break;
  }
}
if (dataStart < 0) {
  console.error('Could not find data block — VizieR format may have changed.');
  console.error('First 30 lines:');
  console.error(lines.slice(0, 30).join('\n'));
  process.exit(1);
}

const out = [];
for (let i = dataStart; i < lines.length; i++) {
  const line = lines[i];
  if (!line || line.startsWith('#')) continue;
  const cols = line.split('\t').map(s => s.trim());
  if (cols.length < 7) continue;

  const id = cols[0];
  if (!id) continue;
  // _RAJ2000 / _DEJ2000 (VizieR's auto-projected magic columns) return
  // DEGREES, not the sexagesimal you'd get from RAB2000/DEB2000. Convert
  // RA to hours for consistency with our other catalogues.
  const raDeg = parseFloat(cols[1]);
  const decDeg = parseFloat(cols[2]);
  const raHours = Number.isFinite(raDeg) ? raDeg / 15 : NaN;
  const diam    = parseFloat(cols[3]);
  const form    = parseInt(cols[4], 10);
  // const struct  = parseInt(cols[5], 10);
  const bright  = parseInt(cols[6], 10);
  if (!Number.isFinite(raHours) || !Number.isFinite(decDeg) || !Number.isFinite(diam)) continue;

  out.push([
    +id,
    +raHours.toFixed(5),
    +decDeg.toFixed(4),
    +diam.toFixed(1),
    Number.isFinite(bright) ? bright : 3,
    Number.isFinite(form) ? form : 4,
  ]);
}

console.error(`Parsed ${out.length} entries.`);
writeFileSync('public/sharpless2.json', JSON.stringify(out));
const bytes = JSON.stringify(out).length;
console.error(`Wrote public/sharpless2.json (${(bytes / 1024).toFixed(1)} KB)`);

/** "HH MM SS.s" → decimal hours. Handles single-token + multi-format. */
function parseSexagesimalHours(s) {
  if (!s) return NaN;
  const m = s.match(/^\s*(\d+)\s+(\d+)\s+([\d.]+)\s*$/);
  if (!m) {
    // Fallback: maybe it's already a decimal.
    const f = parseFloat(s);
    return Number.isFinite(f) ? f : NaN;
  }
  return parseInt(m[1], 10) + parseInt(m[2], 10) / 60 + parseFloat(m[3]) / 3600;
}

/** "+DD MM SS" → decimal degrees. */
function parseSexagesimalDeg(s) {
  if (!s) return NaN;
  const m = s.match(/^\s*([+-]?)(\d+)\s+(\d+)\s+([\d.]+)\s*$/);
  if (!m) {
    const f = parseFloat(s);
    return Number.isFinite(f) ? f : NaN;
  }
  const sign = m[1] === '-' ? -1 : 1;
  return sign * (parseInt(m[2], 10) + parseInt(m[3], 10) / 60 + parseFloat(m[4]) / 3600);
}
