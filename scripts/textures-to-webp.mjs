#!/usr/bin/env node
// Convert public/textures/*.jpg|*.png to .webp (q=85).
// Leaves originals in place — caller is responsible for deletion + ref update.
// Run via: npm run textures:webp

import { readdir, stat } from 'node:fs/promises';
import { join, parse } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const QUALITY = 85;
// fileURLToPath handles non-ASCII paths (e.g., 太陽系模擬) correctly;
// raw `.pathname` would leave them %-encoded.
const TEX_DIR = fileURLToPath(new URL('../public/textures/', import.meta.url));

const human = (b) => (b / 1024 / 1024).toFixed(2) + ' MB';

const entries = await readdir(TEX_DIR);
const inputs = entries.filter((f) => /\.(jpe?g|png)$/i.test(f));

let beforeTotal = 0;
let afterTotal = 0;

console.log(`Converting ${inputs.length} files in ${TEX_DIR}\n`);

for (const file of inputs.sort()) {
  const src = join(TEX_DIR, file);
  const out = join(TEX_DIR, parse(file).name + '.webp');
  const beforeSize = (await stat(src)).size;
  await sharp(src).webp({ quality: QUALITY }).toFile(out);
  const afterSize = (await stat(out)).size;
  beforeTotal += beforeSize;
  afterTotal += afterSize;
  const pct = (((beforeSize - afterSize) / beforeSize) * 100).toFixed(1);
  console.log(`  ${file.padEnd(28)} ${human(beforeSize).padStart(10)} → ${human(afterSize).padStart(10)}  (-${pct}%)`);
}

console.log(`\nTotal: ${human(beforeTotal)} → ${human(afterTotal)}  (saved ${human(beforeTotal - afterTotal)}, -${(((beforeTotal - afterTotal) / beforeTotal) * 100).toFixed(1)}%)`);
