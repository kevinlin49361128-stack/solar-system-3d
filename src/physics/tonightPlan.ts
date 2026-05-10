import { MESSIER } from '../data/messier';
import { NAMED_STARS } from '../data/stars';
import { STARS_AND_PLANETS } from '../data/bodies';
import { scoreObservability, type ObservabilityRating } from './observability';
import type { LangText } from '../i18n';

/**
 * "Tonight's plan" — given the current observer state, returns a ranked
 * list of observable targets in three categories: planets, Messier DSOs,
 * and bright named stars. Each entry includes the current observability
 * rating + a single-line summary for fast scanning.
 *
 * Ranking is by observability score (defined in ./observability.ts). Bodies
 * below the horizon or below a magnitude threshold are filtered out — the
 * point of this list is "what should I actually look at right now", not
 * "what exists in the sky".
 *
 * Caller responsibility: pass in a `getAltAz` callback that knows how to
 * resolve a target's apparent altitude/azimuth at the current observer
 * frame. We don't reach into CameraController here so this module stays
 * pure / testable.
 */

export type TonightCategory = 'planet' | 'messier' | 'star';

export interface TonightEntry {
  category: TonightCategory;
  /** Stable id used for jump-to-target (e.g. 'mars', 'M31', 'sirius'). */
  id: string;
  /** Display name. May be a plain string (zh) or a LangText for entries that
   * carry their own per-language label (e.g. the moon). Consumers should use
   * `langPick(e.name)` from the i18n module to render. */
  name: LangText;
  nameEn: string;
  /** Current altitude (degrees, > 0 since we filter out below-horizon). */
  altDeg: number;
  /** Current azimuth (degrees, 0 = N, 90 = E). */
  azDeg: number;
  /** Apparent magnitude (lower = brighter). */
  magnitude: number;
  /** Observability rating. */
  rating: ObservabilityRating;
  /** Most-significant limiting reason (already localized via i18n). */
  primaryReason: string;
  /** Optional rendering hint: 'rising' / 'setting' / 'transiting' / 'high'. */
  trend?: 'rising' | 'setting' | 'high' | 'low';
}

export interface TonightPlanInput {
  /** Resolves alt/az for an arbitrary RA/Dec target (J2000). */
  getStarAltAz: (raHours: number, decDeg: number) => { altDeg: number; azDeg: number } | null;
  /** Resolves alt/az for a body by id (for planets, sun, moon). */
  getBodyAltAz: (bodyId: string) => { altDeg: number; azDeg: number } | null;
  /** Sun's current altitude (for twilight checks). */
  sunAltDeg: number;
  /** Moon's current state (alt, az, illuminated fraction 0–1). */
  moonAltDeg: number;
  moonAzDeg: number;
  moonPhase: number;
  /** Bortle scale at observer location (1 = pristine, 9 = inner-city). */
  bortle: number;
}

export interface TonightPlan {
  planets: TonightEntry[];
  messier: TonightEntry[];
  stars: TonightEntry[];
}

const D2R = Math.PI / 180;

/** Great-circle angular distance between two alt/az pairs (degrees). */
function angularDistanceDeg(
  a: { altDeg: number; azDeg: number },
  b: { altDeg: number; azDeg: number },
): number {
  const cosD =
    Math.sin(a.altDeg * D2R) * Math.sin(b.altDeg * D2R) +
    Math.cos(a.altDeg * D2R) * Math.cos(b.altDeg * D2R) *
    Math.cos((a.azDeg - b.azDeg) * D2R);
  return Math.acos(Math.max(-1, Math.min(1, cosD))) / D2R;
}

/** Trend hint based on current altitude. Used for UI grouping. */
function altTrend(altDeg: number): 'high' | 'low' {
  return altDeg >= 30 ? 'high' : 'low';
}

/**
 * Rank threshold: ratings worse than 'marginal' are excluded entirely
 * unless the user has a reason to care (e.g. a planet, which we always
 * show even if conditions are sub-optimal — observers want to know).
 */
function shouldInclude(rating: ObservabilityRating, isPlanet: boolean): boolean {
  if (isPlanet) return rating !== 'invisible';
  return rating === 'good' || rating === 'marginal';
}

/** Severity ordering: good > marginal > poor > invisible. */
function ratingRank(r: ObservabilityRating): number {
  return r === 'good' ? 3 : r === 'marginal' ? 2 : r === 'poor' ? 1 : 0;
}

export function computeTonightPlan(input: TonightPlanInput): TonightPlan {
  const moonPos = { altDeg: input.moonAltDeg, azDeg: input.moonAzDeg };

  const evaluate = (
    altAz: { altDeg: number; azDeg: number } | null,
    magnitude: number,
  ): { rating: ObservabilityRating; primaryReason: string; altDeg: number; azDeg: number } | null => {
    if (!altAz || altAz.altDeg <= 0) return null; // skip below-horizon early
    const moonDist = angularDistanceDeg(altAz, moonPos);
    const r = scoreObservability({
      targetAltDeg: altAz.altDeg,
      targetMag: magnitude,
      sunAltDeg: input.sunAltDeg,
      moonAltDeg: input.moonAltDeg,
      moonPhase: input.moonPhase,
      moonAngularDistanceDeg: moonDist,
      bortle: input.bortle,
    });
    return { rating: r.rating, primaryReason: r.primaryReason, altDeg: altAz.altDeg, azDeg: altAz.azDeg };
  };

  // Planets — always show all eight (and sun/moon) above horizon.
  // Magnitudes are rough averages; for finer ranking we'd use real-time
  // computed apparent magnitude, but for "is this worth looking at" the
  // mean magnitude is fine: Venus -4, Mars 0.5, Jupiter -2.5, etc.
  const planetMagFallback: Record<string, number> = {
    sun: -26.7, moon: -12.6, mercury: 0, venus: -4, mars: 0.5,
    jupiter: -2.5, saturn: 0.5, uranus: 5.7, neptune: 7.8,
  };
  const planets: TonightEntry[] = [];
  for (const b of STARS_AND_PLANETS) {
    if (b.id === 'sun') continue; // never recommend pointing at the sun
    const altAz = input.getBodyAltAz(b.id);
    const mag = planetMagFallback[b.id] ?? 5;
    const ev = evaluate(altAz, mag);
    if (!ev || !shouldInclude(ev.rating, true)) continue;
    planets.push({
      category: 'planet',
      id: b.id,
      name: b.name,
      nameEn: b.nameEn,
      altDeg: ev.altDeg,
      azDeg: ev.azDeg,
      magnitude: mag,
      rating: ev.rating,
      primaryReason: ev.primaryReason,
      trend: altTrend(ev.altDeg),
    });
  }
  // Add the moon explicitly (it's not in STARS_AND_PLANETS — it's in MOONS data).
  const moonAA = input.getBodyAltAz('moon');
  if (moonAA) {
    const ev = evaluate(moonAA, planetMagFallback.moon);
    if (ev && shouldInclude(ev.rating, true)) {
      planets.push({
        category: 'planet',
        id: 'moon',
        name: { 'zh-Hant': '月球', en: 'Moon', ja: '月' },
        nameEn: 'Moon',
        altDeg: ev.altDeg,
        azDeg: ev.azDeg,
        magnitude: planetMagFallback.moon,
        rating: ev.rating,
        primaryReason: ev.primaryReason,
        trend: altTrend(ev.altDeg),
      });
    }
  }

  // Messier objects — filter to "above horizon AND rating better than poor".
  const messier: TonightEntry[] = [];
  for (const m of MESSIER) {
    const altAz = input.getStarAltAz(m.raHours, m.decDeg);
    const ev = evaluate(altAz, m.magnitude);
    if (!ev || !shouldInclude(ev.rating, false)) continue;
    messier.push({
      category: 'messier',
      id: m.id,
      name: m.name,
      nameEn: m.nameEn,
      altDeg: ev.altDeg,
      azDeg: ev.azDeg,
      magnitude: m.magnitude,
      rating: ev.rating,
      primaryReason: ev.primaryReason,
      trend: altTrend(ev.altDeg),
    });
  }

  // Named stars — only mag < 2.5 (naked-eye class), sorted by score.
  // The full BSC list is too noisy here; observers asking "what to look at
  // tonight" want bright reference stars they can actually identify.
  const stars: TonightEntry[] = [];
  for (const s of NAMED_STARS) {
    if (s.magnitude > 2.5) continue;
    const altAz = input.getStarAltAz(s.raHours, s.decDeg);
    const ev = evaluate(altAz, s.magnitude);
    if (!ev || !shouldInclude(ev.rating, false)) continue;
    stars.push({
      category: 'star',
      id: s.id,
      name: s.name,
      nameEn: s.nameEn,
      altDeg: ev.altDeg,
      azDeg: ev.azDeg,
      magnitude: s.magnitude,
      rating: ev.rating,
      primaryReason: ev.primaryReason,
      trend: altTrend(ev.altDeg),
    });
  }

  // Sort each list: best rating first, then highest altitude as tiebreaker.
  const cmp = (a: TonightEntry, b: TonightEntry): number => {
    const dr = ratingRank(b.rating) - ratingRank(a.rating);
    if (dr !== 0) return dr;
    return b.altDeg - a.altDeg;
  };
  planets.sort(cmp);
  messier.sort(cmp);
  stars.sort(cmp);

  // Trim Messier to top 15 — observers don't scroll through 110 entries.
  return { planets, messier: messier.slice(0, 15), stars };
}
