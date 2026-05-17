/**
 * Habitable-zone (HZ) inner/outer radii for an exoplanet host star.
 *
 * Uses the Kopparapu et al. 2013 ApJ 765:131 formulation: the
 * "Recent Venus" inner edge and "Early Mars" outer edge — the most
 * conservative, broadly-cited boundaries that bracket the range of
 * stellar fluxes consistent with surface liquid water on an
 * Earth-like planet over geological time.
 *
 * Why these boundaries: anything closer than Recent Venus is
 * presumed to lose its oceans to a runaway greenhouse (Venus did
 * so ~1 Gyr ago); anything beyond Early Mars is presumed to freeze
 * out. The "optimistic" version of the HZ extends slightly wider
 * but is also more controversial; we lead with the conservative
 * range and note the optimistic one in tooltip comments.
 *
 * Output is in AU (the same units as a planet's semi-major axis a),
 * so the consumer (ExoplanetSystemView) can paint a green disc with
 * inner/outer radii on the orbital plane and the user immediately
 * sees which planets sit inside the green ring.
 *
 * Source coefficients: Kopparapu+2013 Table 3, validated against
 * the online HZ calculator at https://depts.washington.edu/naivpl/.
 */

interface KopparapuCoeffs {
  sEffSun: number;
  a: number;
  b: number;
  c: number;
  d: number;
}

// "Optimistic" HZ bounds — widest set, based on geological evidence of
// liquid water on Venus (Recent Venus) and Mars (Early Mars).
const RECENT_VENUS: KopparapuCoeffs = {
  sEffSun: 1.7763,
  a: 1.4335e-4,
  b: 3.3954e-9,
  c: -7.6364e-12,
  d: -1.1950e-15,
};

const EARLY_MARS: KopparapuCoeffs = {
  sEffSun: 0.3207,
  a: 5.4471e-5,
  b: 1.5275e-9,
  c: -2.1709e-12,
  d: -3.8282e-16,
};

// "Conservative" HZ bounds — narrower set, based on theoretical climate
// models. Runaway Greenhouse is where a wet Earth analogue loses its
// oceans; Maximum Greenhouse is where even a CO₂-thick atmosphere can't
// keep liquid water from freezing out. Numbers from Kopparapu+2013
// Table 3, same paper as the optimistic bounds.
const RUNAWAY_GREENHOUSE: KopparapuCoeffs = {
  sEffSun: 1.0512,
  a: 1.3242e-4,
  b: 1.5418e-8,
  c: -7.9895e-12,
  d: -1.8328e-15,
};

const MAXIMUM_GREENHOUSE: KopparapuCoeffs = {
  sEffSun: 0.3438,
  a: 5.8942e-5,
  b: 1.6558e-9,
  c: -3.0045e-12,
  d: -5.2983e-16,
};

function sEff(coeffs: KopparapuCoeffs, teffK: number): number {
  // Polynomial expansion centred at Teff = 5780 K (Sun's effective temp).
  // Kopparapu's polynomial is calibrated for 2600 K ≤ Teff ≤ 7200 K.
  // Outside that we extrapolate; for our 12 curated hosts (M8 dwarf to
  // F-type) the range is fully covered.
  const T = teffK - 5780;
  return coeffs.sEffSun
    + coeffs.a * T
    + coeffs.b * T * T
    + coeffs.c * T * T * T
    + coeffs.d * T * T * T * T;
}

/**
 * Stellar luminosity in solar units, derived from Stefan-Boltzmann
 * (assuming spherical blackbody): L/L_sun = (R/R_sun)² · (T/T_sun)⁴
 */
function luminositySolar(radiusKm: number, teffK: number): number {
  const R_SUN_KM = 695700;
  const T_SUN_K = 5778;
  const rRel = radiusKm / R_SUN_KM;
  const tRel = teffK / T_SUN_K;
  return rRel * rRel * tRel * tRel * tRel * tRel;
}

/**
 * Compute the conservative HZ inner & outer edges in AU.
 *
 *   inner = "Recent Venus" boundary (highest-flux Earth analogue)
 *   outer = "Early Mars" boundary  (lowest-flux Earth analogue)
 *
 * Returns null if Teff is outside the calibrated range and the
 * polynomial extrapolation would be untrustworthy.
 */
export function habitableZoneAU(
  starRadiusKm: number,
  starTeffK: number,
): { innerAU: number; outerAU: number } | null {
  const ex = habitableZoneAUExtended(starRadiusKm, starTeffK);
  return ex ? { innerAU: ex.optimisticInnerAU, outerAU: ex.optimisticOuterAU } : null;
}

/**
 * Compute both Kopparapu HZ pairs in AU at once.
 *
 *   optimisticInner / optimisticOuter — Recent Venus / Early Mars
 *     (the widest plausible band; what habitableZoneAU returns)
 *   conservativeInner / conservativeOuter — Runaway / Maximum Greenhouse
 *     (theoretical climate-model bounds; tighter)
 *
 * For Sol: optimistic ≈ 0.75 → 1.77 AU, conservative ≈ 0.99 → 1.69 AU.
 * Earth sits at the inner edge of the conservative band; Mars (1.524 AU)
 * is in the optimistic band but outside the conservative one. Both
 * facts come up in pop-science exoplanet discussion, so we surface them.
 */
export function habitableZoneAUExtended(
  starRadiusKm: number,
  starTeffK: number,
): {
  optimisticInnerAU: number; optimisticOuterAU: number;
  conservativeInnerAU: number; conservativeOuterAU: number;
} | null {
  if (starTeffK < 2300 || starTeffK > 8000) return null;
  const L = luminositySolar(starRadiusKm, starTeffK);
  const sOptIn  = sEff(RECENT_VENUS, starTeffK);
  const sOptOut = sEff(EARLY_MARS, starTeffK);
  const sConIn  = sEff(RUNAWAY_GREENHOUSE, starTeffK);
  const sConOut = sEff(MAXIMUM_GREENHOUSE, starTeffK);
  if (sOptIn <= 0 || sOptOut <= 0 || sConIn <= 0 || sConOut <= 0) return null;
  return {
    optimisticInnerAU:   Math.sqrt(L / sOptIn),
    optimisticOuterAU:   Math.sqrt(L / sOptOut),
    conservativeInnerAU: Math.sqrt(L / sConIn),
    conservativeOuterAU: Math.sqrt(L / sConOut),
  };
}

/**
 * Classification of a planet's semi-major axis relative to its host's
 * habitable zone. Used by InfoPanel to badge each exoplanet with a
 * visual hint:
 *
 *   🟢 in-hz       — inside the Runaway/Max Greenhouse conservative HZ
 *                    (the strongest case for "could host liquid water")
 *   🟡 in-hz-opt   — in optimistic but NOT conservative HZ — habitable
 *                    only under cloud-feedback / extra-CO₂ models
 *   🔥 too-hot     — closer than the optimistic inner edge
 *   ❄️ too-cold    — beyond the optimistic outer edge
 *   ❓ unknown     — host Teff outside Kopparapu calibration range
 *
 * If the caller passes the legacy `{innerAU, outerAU}` shape (the old
 * `habitableZoneAU` return), it's treated as the optimistic bounds and
 * the conservative ones are unavailable — falls back to a single 'in-hz'
 * bucket with edge classifications by ±10 % of the optimistic edges.
 */
export type HabitabilityBucket =
  | 'in-hz'        // inside conservative HZ
  | 'in-hz-opt'    // inside optimistic only
  | 'hot-edge'     // brushing inner edge of optimistic
  | 'cold-edge'    // brushing outer edge of optimistic
  | 'too-hot'      // closer than optimistic inner
  | 'too-cold'     // beyond optimistic outer
  | 'unknown';

export function classifyHabitability(
  planetAU: number,
  hz:
    | { innerAU: number; outerAU: number }
    | { optimisticInnerAU: number; optimisticOuterAU: number;
        conservativeInnerAU: number; conservativeOuterAU: number; }
    | null,
): HabitabilityBucket {
  if (!hz) return 'unknown';
  if ('conservativeInnerAU' in hz) {
    if (planetAU >= hz.conservativeInnerAU && planetAU <= hz.conservativeOuterAU) return 'in-hz';
    if (planetAU >= hz.optimisticInnerAU   && planetAU <= hz.optimisticOuterAU)   return 'in-hz-opt';
    if (planetAU < hz.optimisticInnerAU) {
      return planetAU > hz.optimisticInnerAU * 0.90 ? 'hot-edge' : 'too-hot';
    }
    return planetAU < hz.optimisticOuterAU * 1.10 ? 'cold-edge' : 'too-cold';
  }
  // Legacy single-band shape — treat as optimistic only.
  if (planetAU >= hz.innerAU && planetAU <= hz.outerAU) return 'in-hz';
  if (planetAU < hz.innerAU) {
    return planetAU > hz.innerAU * 0.90 ? 'hot-edge' : 'too-hot';
  }
  return planetAU < hz.outerAU * 1.10 ? 'cold-edge' : 'too-cold';
}
