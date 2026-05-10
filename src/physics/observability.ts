import { t } from '../i18n';

/**
 * "今晚可見性" — composite observability scorer for stars and DSOs.
 *
 * Designed in response to astrophysicist tester feedback: real observers
 * care about whether tonight is worth observing a target, which depends
 * on multiple independent factors that single-dimensional Bortle can't
 * capture. This scorer combines:
 *
 *   - target altitude (extinction increases with airmass)
 *   - sun altitude (twilight dilutes contrast)
 *   - moon altitude + phase + angular distance (moonlight overwhelms DSOs)
 *   - light pollution (Bortle scale sets sky-glow magnitude limit)
 *   - target magnitude vs the resulting effective limit
 *
 * Output is a 3-tier badge ('good' / 'marginal' / 'poor') with a list of
 * limiting reasons in plain language. Both are surfaced in InfoPanel.
 *
 * IMPORTANT scope: this is intentionally a HEURISTIC for casual observation
 * planning. It is NOT a calibrated photometric model. The tester's
 * suggested "transparency / seeing as separate dimensions" requires
 * observatory-grade weather data we don't have; we use defaults instead.
 * For a serious observatory site, consult the actual sky brightness
 * monitoring service (e.g. Cerro Tololo SQM data).
 */

export type ObservabilityRating = 'good' | 'marginal' | 'poor' | 'invisible';

export interface ObservabilityFactors {
  /** Target's current altitude (degrees, can be negative if below horizon). */
  targetAltDeg: number;
  /** Target's apparent magnitude. Lower = brighter. */
  targetMag: number;
  /** Sun's current altitude (degrees). */
  sunAltDeg: number;
  /** Moon's current altitude (degrees). */
  moonAltDeg: number;
  /** Moon's illuminated fraction (0 = new, 1 = full). */
  moonPhase: number;
  /** Angular distance moon ↔ target (degrees, 0 to 180). */
  moonAngularDistanceDeg: number;
  /** Bortle scale (1 = pristine, 9 = inner-city). */
  bortle: number;
}

export interface ObservabilityResult {
  rating: ObservabilityRating;
  /** Effective sky magnitude limit at the target's altitude (mag/arcsec²-equivalent). */
  effectiveLimitMag: number;
  /** Headline reason: longest-pole limiting factor. */
  primaryReason: string;
  /** All contributing reasons, ordered by severity. */
  reasons: string[];
}

/** Tag plus optional reason text — internal helper. */
interface Reason {
  /** Severity weight added to score (higher = worse). */
  weight: number;
  /** zh-Hant translation (caller can swap with i18n if needed). */
  text: string;
}

/**
 * Compute observability rating + reasons. Caller passes pre-computed
 * altitudes, magnitudes, and angular distances — this function is a pure
 * scorer that doesn't reach into propagators or observer state.
 */
export function scoreObservability(f: ObservabilityFactors): ObservabilityResult {
  const reasons: Reason[] = [];

  // 1. Below horizon → trivially invisible
  if (f.targetAltDeg <= 0) {
    return {
      rating: 'invisible',
      effectiveLimitMag: 0,
      primaryReason: t('obs.reason.belowHorizon'),
      reasons: [t('obs.reason.belowHorizonDetail')],
    };
  }

  // 2. Altitude penalty (airmass = 1/sin(alt) approx)
  // Below 15° atmospheric extinction is significant.
  const altStr = f.targetAltDeg.toFixed(1);
  if (f.targetAltDeg < 5) {
    reasons.push({ weight: 4, text: t('obs.reason.altVeryLow').replace('{alt}', altStr) });
  } else if (f.targetAltDeg < 15) {
    reasons.push({ weight: 2, text: t('obs.reason.altLow').replace('{alt}', altStr) });
  } else if (f.targetAltDeg < 30) {
    reasons.push({ weight: 1, text: t('obs.reason.altMid').replace('{alt}', altStr) });
  }

  // 3. Twilight: sun > -18° = astronomical twilight or brighter
  if (f.sunAltDeg > -6) {
    reasons.push({ weight: 5, text: t('obs.reason.twilightCivil') });
  } else if (f.sunAltDeg > -12) {
    reasons.push({ weight: 3, text: t('obs.reason.twilightNautical') });
  } else if (f.sunAltDeg > -18) {
    reasons.push({ weight: 1, text: t('obs.reason.twilightAstro') });
  }

  // 4. Moonlight: only matters if moon is up
  if (f.moonAltDeg > 0 && f.moonPhase > 0.05) {
    // Moon dims dramatically with distance from target. Within 30° = bad,
    // 30-60° = noticeable, > 60° = minor.
    const phasePct = String(Math.round(f.moonPhase * 100));
    const distStr = f.moonAngularDistanceDeg.toFixed(0);
    if (f.moonPhase > 0.7) {
      // Bright moon
      if (f.moonAngularDistanceDeg < 30) {
        reasons.push({ weight: 4, text: t('obs.reason.moonHeavy').replace('{pct}', phasePct).replace('{dist}', distStr) });
      } else if (f.moonAngularDistanceDeg < 60) {
        reasons.push({ weight: 2, text: t('obs.reason.moonStrong').replace('{pct}', phasePct).replace('{dist}', distStr) });
      } else {
        reasons.push({ weight: 1, text: t('obs.reason.moonBrightFar').replace('{pct}', phasePct).replace('{dist}', distStr) });
      }
    } else if (f.moonPhase > 0.3) {
      if (f.moonAngularDistanceDeg < 30) {
        reasons.push({ weight: 2, text: t('obs.reason.moonMildClose').replace('{pct}', phasePct).replace('{dist}', distStr) });
      } else if (f.moonAngularDistanceDeg < 60) {
        reasons.push({ weight: 1, text: t('obs.reason.moonMild').replace('{pct}', phasePct) });
      }
    }
  }

  // 5. Magnitude vs effective sky limit
  // Sky limit at zenith for given Bortle (Schaefer 1990 approximation):
  //   Bortle 1 ~ 7.5 mag/arcsec² limit
  //   Bortle 9 ~ 3.5 mag/arcsec²
  const zenithLimit = 7.8 - 0.45 * (f.bortle - 1);
  // Reduce by airmass-dependent extinction (~0.3 mag per airmass at sea level)
  const airmass = 1 / Math.max(0.1, Math.sin(f.targetAltDeg * Math.PI / 180));
  const extinction = 0.25 * airmass;
  // Reduce by moonlight dimming (rough heuristic, scales with phase + proximity)
  let moonDim = 0;
  if (f.moonAltDeg > 0) {
    const proximityFactor = Math.max(0, 1 - f.moonAngularDistanceDeg / 90);
    moonDim = f.moonPhase * proximityFactor * 2.0;
  }
  // Reduce by twilight
  let twilightDim = 0;
  if (f.sunAltDeg > -18) {
    twilightDim = Math.max(0, (f.sunAltDeg + 18) / 18) * 3.5;
  }
  const effectiveLimit = zenithLimit - extinction - moonDim - twilightDim;
  const margin = effectiveLimit - f.targetMag;
  if (margin < 0) {
    reasons.push({
      weight: 5,
      text: t('obs.reason.magBelowLimit')
        .replace('{amount}', (-margin).toFixed(1))
        .replace('{tmag}', f.targetMag.toFixed(1))
        .replace('{limit}', effectiveLimit.toFixed(1)),
    });
  } else if (margin < 1) {
    reasons.push({ weight: 3, text: t('obs.reason.magNearLimit').replace('{margin}', margin.toFixed(1)) });
  } else if (margin < 2) {
    reasons.push({ weight: 1, text: t('obs.reason.magMargin').replace('{margin}', margin.toFixed(1)) });
  }

  // Aggregate weights → rating
  const totalWeight = reasons.reduce((s, r) => s + r.weight, 0);
  let rating: ObservabilityRating;
  if (margin < -2) rating = 'invisible';
  else if (totalWeight === 0) rating = 'good';
  else if (totalWeight <= 3) rating = 'good';
  else if (totalWeight <= 7) rating = 'marginal';
  else rating = 'poor';

  // Sort by weight (desc) for primary-reason selection
  reasons.sort((a, b) => b.weight - a.weight);
  const primary = reasons[0]?.text ?? t('obs.reason.goodConditions');

  return {
    rating,
    effectiveLimitMag: effectiveLimit,
    primaryReason: primary,
    reasons: reasons.map(r => r.text),
  };
}
