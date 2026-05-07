import { CanvasTexture, ClampToEdgeWrapping, LinearFilter, SRGBColorSpace } from 'three';
import type { MessierType } from '../data/messier';

/**
 * Procedural texture atlas for deep-sky-object icons. Each row is a 256×256
 * tile with characteristic shape per object type — galaxies look like
 * tilted ellipses with a bright core, globulars are dense round balls,
 * open clusters are scattered points, diffuse nebulae are irregular clouds,
 * planetary nebulae are bright rings, SNRs are wispy filaments.
 *
 * The atlas is grayscale (alpha-only) so the MessierLayer can multiply by
 * each object's type colour at render time. Layout is a 1-column × 6-row
 * vertical strip so the per-vertex tile lookup is just a y-axis offset.
 */
export const DSO_TILE_SIZE = 256;
export const DSO_TILE_COUNT = 6;

export const DSO_TYPE_INDEX: Record<MessierType, number> = {
  G:   0,
  GC:  1,
  OC:  2,
  N:   3,
  PN:  4,
  SNR: 5,
};

export function buildDSOAtlas(): CanvasTexture {
  const W = DSO_TILE_SIZE;
  const H = DSO_TILE_SIZE * DSO_TILE_COUNT;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = 'rgba(0,0,0,0)';
  ctx.fillRect(0, 0, W, H);

  drawGalaxy(ctx, 0 * DSO_TILE_SIZE);
  drawGlobular(ctx, 1 * DSO_TILE_SIZE);
  drawOpenCluster(ctx, 2 * DSO_TILE_SIZE);
  drawDiffuseNebula(ctx, 3 * DSO_TILE_SIZE);
  drawPlanetaryNebula(ctx, 4 * DSO_TILE_SIZE);
  drawSNR(ctx, 5 * DSO_TILE_SIZE);

  const tex = new CanvasTexture(canvas);
  tex.wrapS = ClampToEdgeWrapping;
  tex.wrapT = ClampToEdgeWrapping;
  tex.minFilter = LinearFilter;
  tex.magFilter = LinearFilter;
  tex.colorSpace = SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

const S = DSO_TILE_SIZE;
const HALF = S / 2;

function drawGalaxy(ctx: CanvasRenderingContext2D, yOff: number): void {
  ctx.save();
  ctx.translate(HALF, yOff + HALF);
  ctx.rotate((-25 * Math.PI) / 180); // characteristic spiral tilt
  // Outer disc — wide elliptical fade
  let g = ctx.createRadialGradient(0, 0, 0, 0, 0, HALF * 0.95);
  g.addColorStop(0.00, 'rgba(255,255,255,0.95)');
  g.addColorStop(0.20, 'rgba(255,255,255,0.55)');
  g.addColorStop(0.55, 'rgba(255,255,255,0.18)');
  g.addColorStop(1.00, 'rgba(255,255,255,0.00)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(0, 0, HALF * 0.92, HALF * 0.42, 0, 0, Math.PI * 2);
  ctx.fill();
  // Bright central bulge
  g = ctx.createRadialGradient(0, 0, 0, 0, 0, HALF * 0.30);
  g.addColorStop(0.0, 'rgba(255,255,255,1)');
  g.addColorStop(1.0, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(0, 0, HALF * 0.30, HALF * 0.18, 0, 0, Math.PI * 2);
  ctx.fill();
  // Hint of dust lane: a thin dark cut across the disc
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(0, 0, HALF * 0.92, HALF * 0.04, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawGlobular(ctx: CanvasRenderingContext2D, yOff: number): void {
  ctx.save();
  ctx.translate(HALF, yOff + HALF);
  // Dense bright core
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, HALF * 0.85);
  g.addColorStop(0.00, 'rgba(255,255,255,1.00)');
  g.addColorStop(0.10, 'rgba(255,255,255,0.92)');
  g.addColorStop(0.30, 'rgba(255,255,255,0.55)');
  g.addColorStop(0.60, 'rgba(255,255,255,0.20)');
  g.addColorStop(1.00, 'rgba(255,255,255,0.00)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, HALF * 0.85, 0, Math.PI * 2);
  ctx.fill();
  // Sprinkle resolved stars near the edges
  const rng = mulberry32(11);
  for (let i = 0; i < 90; i++) {
    const a = rng() * Math.PI * 2;
    const r = (0.25 + rng() * 0.55) * HALF;
    const sz = 0.6 + rng() * 1.2;
    ctx.fillStyle = `rgba(255,255,255,${0.45 + rng() * 0.4})`;
    ctx.beginPath();
    ctx.arc(Math.cos(a) * r, Math.sin(a) * r, sz, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawOpenCluster(ctx: CanvasRenderingContext2D, yOff: number): void {
  ctx.save();
  ctx.translate(HALF, yOff + HALF);
  // Faint background haze so a far-away cluster still reads as "fuzzy"
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, HALF * 0.85);
  g.addColorStop(0, 'rgba(255,255,255,0.18)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, HALF * 0.85, 0, Math.PI * 2);
  ctx.fill();
  // Scattered bright stars (no central concentration)
  const rng = mulberry32(31);
  for (let i = 0; i < 35; i++) {
    const a = rng() * Math.PI * 2;
    // Approximately uniform-in-area distribution
    const r = Math.sqrt(rng()) * HALF * 0.78;
    const sz = 1.2 + rng() * 2.4;
    const alpha = 0.6 + rng() * 0.4;
    const x = Math.cos(a) * r, y = Math.sin(a) * r;
    // Crisp star
    ctx.fillStyle = `rgba(255,255,255,${alpha})`;
    ctx.beginPath();
    ctx.arc(x, y, sz, 0, Math.PI * 2);
    ctx.fill();
    // Small halo
    const hg = ctx.createRadialGradient(x, y, 0, x, y, sz * 4);
    hg.addColorStop(0, `rgba(255,255,255,${alpha * 0.5})`);
    hg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = hg;
    ctx.beginPath();
    ctx.arc(x, y, sz * 4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawDiffuseNebula(ctx: CanvasRenderingContext2D, yOff: number): void {
  ctx.save();
  ctx.translate(HALF, yOff + HALF);
  // Build an irregular cloud by stacking many soft ellipses at random
  // positions, weighted toward the centre.
  const rng = mulberry32(73);
  for (let i = 0; i < 60; i++) {
    const cx = (rng() - 0.5) * HALF * 1.2;
    const cy = (rng() - 0.5) * HALF * 1.0;
    const rx = HALF * (0.10 + rng() * 0.32);
    const ry = HALF * (0.08 + rng() * 0.26);
    const rot = rng() * Math.PI;
    const peak = 0.10 + rng() * 0.18;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(rx, ry));
    g.addColorStop(0, `rgba(255,255,255,${peak})`);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rot);
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  // A few embedded bright knots / proto-stars
  for (let i = 0; i < 5; i++) {
    const cx = (rng() - 0.5) * HALF * 0.9;
    const cy = (rng() - 0.5) * HALF * 0.9;
    const r = HALF * (0.04 + rng() * 0.05);
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, 'rgba(255,255,255,0.95)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawPlanetaryNebula(ctx: CanvasRenderingContext2D, yOff: number): void {
  ctx.save();
  ctx.translate(HALF, yOff + HALF);
  // Bright halo ring
  const ringR = HALF * 0.55;
  const ringW = HALF * 0.18;
  const g = ctx.createRadialGradient(0, 0, ringR - ringW, 0, 0, ringR + ringW);
  g.addColorStop(0.00, 'rgba(255,255,255,0.00)');
  g.addColorStop(0.25, 'rgba(255,255,255,0.20)');
  g.addColorStop(0.50, 'rgba(255,255,255,0.95)');
  g.addColorStop(0.75, 'rgba(255,255,255,0.20)');
  g.addColorStop(1.00, 'rgba(255,255,255,0.00)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, ringR + ringW, 0, Math.PI * 2);
  ctx.fill();
  // Soft inner glow
  const ig = ctx.createRadialGradient(0, 0, 0, 0, 0, ringR * 0.85);
  ig.addColorStop(0, 'rgba(255,255,255,0.30)');
  ig.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = ig;
  ctx.beginPath();
  ctx.arc(0, 0, ringR * 0.85, 0, Math.PI * 2);
  ctx.fill();
  // Central white dwarf
  const cg = ctx.createRadialGradient(0, 0, 0, 0, 0, HALF * 0.10);
  cg.addColorStop(0, 'rgba(255,255,255,1)');
  cg.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = cg;
  ctx.beginPath();
  ctx.arc(0, 0, HALF * 0.10, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawSNR(ctx: CanvasRenderingContext2D, yOff: number): void {
  ctx.save();
  ctx.translate(HALF, yOff + HALF);
  // A cluster of thin filamentary arcs at random orientations — Veil-like
  const rng = mulberry32(53);
  ctx.lineCap = 'round';
  for (let i = 0; i < 22; i++) {
    const cx = (rng() - 0.5) * HALF * 0.4;
    const cy = (rng() - 0.5) * HALF * 0.4;
    const r = HALF * (0.30 + rng() * 0.55);
    const a0 = rng() * Math.PI * 2;
    const span = 0.4 + rng() * 1.2;
    const w = 1.5 + rng() * 2.2;
    ctx.strokeStyle = `rgba(255,255,255,${0.18 + rng() * 0.45})`;
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.arc(cx, cy, r, a0, a0 + span);
    ctx.stroke();
  }
  // A diffuse halo so the wisps don't look stranded on transparent pixels
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, HALF * 0.95);
  g.addColorStop(0.00, 'rgba(255,255,255,0.10)');
  g.addColorStop(0.55, 'rgba(255,255,255,0.05)');
  g.addColorStop(1.00, 'rgba(255,255,255,0.00)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, HALF * 0.95, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// Deterministic pseudo-RNG so the atlas looks identical on every load.
function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6D2B79F5) >>> 0;
    let r = t;
    r = Math.imul(r ^ (r >>> 15), r | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
