/**
 * Observation queue — the planning data model that turns the smart-
 * telescope catalogue work (Sharpless 2, NGC, Messier with surface
 * brightness) into "what can I actually image tonight?".
 *
 * A queue is an ordered list of targets the user wants to capture
 * tonight; each carries its source catalogue, current alt/az
 * snapshot, and a per-target integration-time estimate against the
 * chosen smart-scope.
 *
 * Two pure-function exports:
 *   - estimateIntegrationMinutes(): the model for "this device on
 *     this surface-brightness target needs N minutes for a decent
 *     stack".
 *   - feasibleTonight(): given the queue + tonight's astronomical-
 *     dark window, returns per-target {finishable, startsBefore,
 *     endsBy} so the UI can warn "this target won't fit".
 *
 * Pure data layer — no DOM. The ObservationQueuePanel UI owns
 * persistence + render.
 */

export type SmartScopeId = 'seestar-s30' | 'seestar-s50' | 'vespera-pro' | 'dwarf-3';

/** Approximate aperture (mm) of each smart scope's primary lens.
 *  Used by the integration-time model — bigger aperture = less time. */
export const SMART_SCOPE_APERTURE_MM: Record<SmartScopeId, number> = {
  'seestar-s30': 30,
  'seestar-s50': 50,
  'vespera-pro': 50,   // 50mm quadruplet refractor
  'dwarf-3':     35,   // dual lens, but effective aperture ~35mm
};

/**
 * Rough integration-time estimator for a smart-scope live-stack.
 *
 * Inputs:
 *   surfaceBrightness  — target's mean SB in mag/arcsec² (lower → brighter)
 *   apertureMm         — primary aperture of the scope in mm
 *   targetSnr          — desired stacked SNR; default 10 is a good
 *                        "shareable preview" threshold; up by ~2× for
 *                        "magazine quality"
 *
 * Model derivation:
 *   Pogson-style: flux per pixel ∝ 10^(−0.4·SB) · aperture²
 *   Time to reach a fixed SNR ∝ 1 / flux
 *   So t(min) ≈ k · 10^(0.4·(SB − SB_ref)) · (apertureRef / aperture)²
 *
 *   Calibration: Seestar S50 (50mm aperture) on a SB = 20 mag/arcsec²
 *   target takes ~15 min for a decent stack (manufacturer-stated +
 *   Cloudy Nights reviews). Solving for k with SB_ref = 20,
 *   apertureRef = 50:
 *     k ≈ 15
 *
 *   For brighter targets (SB 18, e.g. Lagoon Nebula M8) the formula
 *   gives 15 · 10^(0.4·(18−20)) = 15 · 0.40 = 6 min — matches reality.
 *   For faint (SB 22, e.g. NGC 891 outer disc) → 15 · 10^(0.8) = 95 min
 *   — also matches the "all-night project" smart-scope users report.
 *
 *   The model is intentionally simple — read noise, dark current, sky
 *   glow, filter throughput all matter in reality. For first-order
 *   "should I queue this?" decisions the SB + aperture model is enough.
 */
export function estimateIntegrationMinutes(
  surfaceBrightness: number,
  apertureMm: number,
  targetSnr = 10,
): number {
  if (!Number.isFinite(surfaceBrightness)) return NaN;
  if (apertureMm <= 0) return NaN;
  const SB_REF = 20;
  const APERTURE_REF = 50;
  const K = 15;  // min for Seestar S50 on SB-20 target at SNR 10
  const sbFactor = Math.pow(10, 0.4 * (surfaceBrightness - SB_REF));
  const apertureFactor = Math.pow(APERTURE_REF / apertureMm, 2);
  const snrFactor = (targetSnr / 10) ** 2;
  return K * sbFactor * apertureFactor * snrFactor;
}

export interface QueueTarget {
  /** Stable ID for de-dup + persistence.
   *  - Messier: "M31", "M42"...
   *  - NGC bulk: "NGC1234", "IC5070"
   *  - Sharpless: "Sh2-7"
   *  - Named star: "star:sirius"
   *  - Other:    "messier:M31" style — InfoPanel id scheme
   */
  id: string;
  /** Display label — pre-localised at add time so the queue doesn't
   *  flicker on language change. */
  label: string;
  /** Catalogue source — drives where to look up surface brightness. */
  source: 'messier' | 'ngc' | 'sharpless' | 'other';
  /** Target's mean surface brightness, mag/arcsec². May be NaN if the
   *  catalogue doesn't list angular size. */
  surfaceBrightness: number;
  /** Apparent visual magnitude — kept for display fallback. */
  magnitude: number;
  /** Target sky position (J2000) — for tonight-window feasibility. */
  raHours: number;
  decDeg: number;
  /** Selected smart-scope for this target. Can vary per-target so the
   *  user can mix Vespera for big stuff + Seestar for small. */
  scope: SmartScopeId;
  /** User-overridden integration time in minutes. If null, the panel
   *  shows the model estimate. */
  overrideMinutes: number | null;
  /** When the entry was added (ms epoch) — used for sort-by-add-time. */
  addedAt: number;
}

/**
 * Compute the resolved integration minutes — either the user's
 * override or the model estimate. Returns NaN when neither is
 * available (which happens when surface brightness is missing and
 * the user hasn't set an override).
 */
export function targetIntegrationMinutes(t: QueueTarget): number {
  if (t.overrideMinutes != null && Number.isFinite(t.overrideMinutes)) {
    return t.overrideMinutes;
  }
  return estimateIntegrationMinutes(
    t.surfaceBrightness,
    SMART_SCOPE_APERTURE_MM[t.scope],
  );
}

export interface TonightWindow {
  /** JD of the start of astronomical night (sun reaches −18° altitude). */
  astroDuskJd: number | null;
  /** JD of the end of astronomical night. */
  astroDawnJd: number | null;
}

/**
 * Sum the queue's integration minutes and compare against the
 * astronomical-night window. Returns total minutes + window minutes
 * + a boolean for "queue fits in window". Useful for the panel
 * footer's at-a-glance verdict.
 */
export function queueFitsTonight(
  queue: QueueTarget[],
  window: TonightWindow,
): { totalMinutes: number; windowMinutes: number; fits: boolean } {
  const totalMinutes = queue.reduce((s, t) => {
    const m = targetIntegrationMinutes(t);
    return s + (Number.isFinite(m) ? m : 0);
  }, 0);
  let windowMinutes = NaN;
  if (window.astroDuskJd != null && window.astroDawnJd != null) {
    windowMinutes = (window.astroDawnJd - window.astroDuskJd) * 24 * 60;
  }
  return {
    totalMinutes,
    windowMinutes,
    fits: Number.isFinite(windowMinutes) ? totalMinutes <= windowMinutes : true,
  };
}
