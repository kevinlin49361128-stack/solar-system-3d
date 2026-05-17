/**
 * Procedurally-generated "what your smart scope sees in 30 min"
 * preview thumbnails. Renders an SVG/canvas approximation of the
 * Hα-bright, narrowband-filtered look smart-scope sessions produce
 * — soft red/pink for emission nebulae, white-yellow elliptical
 * smudge for galaxies, sharp pin-prick stars for clusters.
 *
 * No actual astronomical image fetching — these are stylised
 * suggestions, NOT real previews. The label is honest about that
 * ("Stacked preview (simulated)"). Real preview integration would
 * need an image-archive API (DSS, PanSTARRS, Aladin Lite) and is
 * tracked in docs/future-real-stacked-previews.md.
 *
 * Output: a 256×256 CanvasTexture data-URL string ready to drop into
 * an <img src> tag in the InfoPanel.
 */

export type DSOKind = 'galaxy' | 'nebula' | 'cluster-globular' | 'cluster-open' | 'planetary' | 'snr' | 'unknown';

export interface PreviewSpec {
  kind: DSOKind;
  /** Major axis in arcmin (controls how big the smudge is on the thumbnail). */
  majorArcmin: number;
  /** Minor axis in arcmin; if omitted, treated as circular. */
  minorArcmin?: number;
  /** Position-angle of major axis in degrees (0 = vertical). */
  paDeg?: number;
  /** Visual mag if known — drives star/galaxy core brightness. */
  magnitude?: number;
  /** Deterministic seed (e.g. catalogue id) so the same target always
   *  renders the same speckle pattern across re-opens. */
  seed?: number;
}

const W = 256, H = 256;

/**
 * Render the preview thumbnail and return a data URL.
 *
 * The thumbnail simulates a smart-scope FOV that matches the
 * target's apparent angular size, with the target filling ~60% of
 * the frame. Background star sprinkle is consistent across renders
 * for the same seed.
 */
export function renderStackedPreview(spec: PreviewSpec): string {
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  // Background — near-black with subtle vignetting + faint Hα tint
  // bleed (most narrowband stacks have it from background sky glow).
  const bg = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W * 0.7);
  bg.addColorStop(0,   '#0d0511');
  bg.addColorStop(1,   '#04030a');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Deterministic RNG so seed → identical output.
  const rng = makeRng(spec.seed ?? 42);

  // Background field stars (always present in real stacks). Ranged
  // 0.7–2.0 px with subtle warm tint.
  const starCount = 90;
  for (let i = 0; i < starCount; i++) {
    const x = rng() * W;
    const y = rng() * H;
    const r = 0.7 + rng() * 1.3;
    const lum = 0.4 + rng() * 0.5;
    const tint = rng() > 0.5 ? `255, ${230 + Math.floor(rng() * 20)}, ${200 + Math.floor(rng() * 30)}` : `${220 + Math.floor(rng() * 30)}, 230, 255`;
    const grad = ctx.createRadialGradient(x, y, 0, x, y, r * 2.2);
    grad.addColorStop(0,   `rgba(${tint}, ${lum})`);
    grad.addColorStop(0.4, `rgba(${tint}, ${lum * 0.4})`);
    grad.addColorStop(1,   `rgba(${tint}, 0)`);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, r * 2.2, 0, 2 * Math.PI);
    ctx.fill();
  }

  // Target — drawn over background with type-specific aesthetics.
  const cx = W / 2, cy = H / 2;
  // Target visual size: scale so a ~30 arcmin target fills 60% of
  // the frame width. Tiny targets (1 arcmin galaxies) stay legible
  // by clamping to ≥ 6 px.
  const targetPx = Math.max(12, Math.min(W * 0.85, spec.majorArcmin * 5));
  const minorPx = spec.minorArcmin
    ? targetPx * (spec.minorArcmin / spec.majorArcmin)
    : targetPx;
  const paRad = (spec.paDeg ?? 0) * Math.PI / 180;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(paRad);

  switch (spec.kind) {
    case 'galaxy': {
      // Elliptical gradient core + faint disc.
      const halo = ctx.createRadialGradient(0, 0, 0, 0, 0, targetPx / 2);
      halo.addColorStop(0,    'rgba(255, 248, 220, 0.95)');
      halo.addColorStop(0.15, 'rgba(255, 230, 180, 0.7)');
      halo.addColorStop(0.4,  'rgba(240, 200, 150, 0.35)');
      halo.addColorStop(0.7,  'rgba(200, 170, 130, 0.10)');
      halo.addColorStop(1,    'rgba(0, 0, 0, 0)');
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.ellipse(0, 0, targetPx / 2, minorPx / 2, 0, 0, 2 * Math.PI);
      ctx.fill();
      // Faint dust lane for edge-on galaxies (minor/major < 0.5).
      if (minorPx / targetPx < 0.5) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
        ctx.fillRect(-targetPx / 2, -minorPx * 0.08, targetPx, minorPx * 0.16);
      }
      break;
    }
    case 'nebula':
    case 'snr': {
      // Soft Hα cloud — irregular blob with internal brighter knots.
      const cloud = ctx.createRadialGradient(0, 0, 0, 0, 0, targetPx / 2);
      cloud.addColorStop(0,   'rgba(255, 130, 150, 0.55)');
      cloud.addColorStop(0.35, 'rgba(240, 90, 120, 0.30)');
      cloud.addColorStop(0.7, 'rgba(200, 70, 100, 0.10)');
      cloud.addColorStop(1,   'rgba(0, 0, 0, 0)');
      ctx.fillStyle = cloud;
      ctx.beginPath();
      ctx.ellipse(0, 0, targetPx / 2, minorPx / 2, 0, 0, 2 * Math.PI);
      ctx.fill();
      // Internal HII knots — 3-5 brighter spots.
      const knotCount = 3 + Math.floor(rng() * 3);
      for (let i = 0; i < knotCount; i++) {
        const kx = (rng() - 0.5) * targetPx * 0.55;
        const ky = (rng() - 0.5) * minorPx * 0.55;
        const kr = targetPx * 0.04 * (0.7 + rng() * 0.6);
        const knot = ctx.createRadialGradient(kx, ky, 0, kx, ky, kr);
        knot.addColorStop(0, 'rgba(255, 220, 220, 0.7)');
        knot.addColorStop(1, 'rgba(255, 180, 200, 0)');
        ctx.fillStyle = knot;
        ctx.beginPath();
        ctx.arc(kx, ky, kr, 0, 2 * Math.PI);
        ctx.fill();
      }
      break;
    }
    case 'planetary': {
      // PNe are typically annular — bright ring with dim centre.
      const ringR = targetPx / 2;
      const outer = ctx.createRadialGradient(0, 0, 0, 0, 0, ringR);
      outer.addColorStop(0,    'rgba(150, 220, 220, 0.15)');
      outer.addColorStop(0.55, 'rgba(120, 220, 200, 0.30)');
      outer.addColorStop(0.85, 'rgba(80, 180, 180, 0.45)');
      outer.addColorStop(1,    'rgba(0, 0, 0, 0)');
      ctx.fillStyle = outer;
      ctx.beginPath();
      ctx.arc(0, 0, ringR, 0, 2 * Math.PI);
      ctx.fill();
      // Central star (white-ish, very small).
      const star = ctx.createRadialGradient(0, 0, 0, 0, 0, ringR * 0.08);
      star.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
      star.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = star;
      ctx.beginPath();
      ctx.arc(0, 0, ringR * 0.08, 0, 2 * Math.PI);
      ctx.fill();
      break;
    }
    case 'cluster-globular':
    case 'cluster-open': {
      // Cluster — many small bright dots with central concentration.
      const dense = spec.kind === 'cluster-globular' ? 90 : 35;
      for (let i = 0; i < dense; i++) {
        // Distance to centre weighted by sqrt() (denser near centre)
        const r = (rng() ** 0.6) * (targetPx / 2);
        const theta = rng() * 2 * Math.PI;
        const x = r * Math.cos(theta);
        const y = r * Math.sin(theta) * (minorPx / targetPx);
        const sr = 0.8 + rng() * 1.4;
        const lum = 0.7 + rng() * 0.3;
        const g = ctx.createRadialGradient(x, y, 0, x, y, sr * 1.6);
        g.addColorStop(0, `rgba(255, 250, 230, ${lum})`);
        g.addColorStop(1, `rgba(255, 250, 230, 0)`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y, sr * 1.6, 0, 2 * Math.PI);
        ctx.fill();
      }
      break;
    }
    default: {
      // Unknown — neutral grey blob.
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, targetPx / 2);
      g.addColorStop(0,   'rgba(200, 200, 200, 0.55)');
      g.addColorStop(0.6, 'rgba(150, 150, 150, 0.20)');
      g.addColorStop(1,   'rgba(0, 0, 0, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, targetPx / 2, 0, 2 * Math.PI);
      ctx.fill();
    }
  }
  ctx.restore();

  // "Simulated" watermark + scale tick at bottom.
  ctx.font = '10px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  ctx.fillStyle = 'rgba(180, 180, 200, 0.55)';
  ctx.textAlign = 'left';
  ctx.fillText('simulated', 8, H - 8);
  ctx.textAlign = 'right';
  ctx.fillText(`${spec.majorArcmin.toFixed(0)}′`, W - 8, H - 8);

  return canvas.toDataURL('image/png');
}

/** Mulberry32 PRNG — small, fast, deterministic per seed. */
function makeRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
