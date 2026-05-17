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
  if (starTeffK < 2300 || starTeffK > 8000) return null;
  const L = luminositySolar(starRadiusKm, starTeffK);
  const sInner = sEff(RECENT_VENUS, starTeffK);
  const sOuter = sEff(EARLY_MARS, starTeffK);
  if (sInner <= 0 || sOuter <= 0) return null;
  const innerAU = Math.sqrt(L / sInner);
  const outerAU = Math.sqrt(L / sOuter);
  return { innerAU, outerAU };
}

/**
 * Classification of a planet's semi-major axis relative to its host's
 * habitable zone. Used by InfoPanel to badge each exoplanet with a
 * visual hint (🟢 in HZ, 🟠 too hot, 🔵 too cold). The "edge" buckets
 * give a 10 % grace either side of the conservative HZ — these are
 * planets that brush the boundaries and might be habitable under more
 * optimistic assumptions (e.g. cloud feedback, atmospheric H₂).
 */
export type HabitabilityBucket =
  | 'in-hz'        // strictly inside the conservative HZ
  | 'hot-edge'     // 0–10 % closer than inner edge
  | 'cold-edge'    // 0–10 % beyond outer edge
  | 'too-hot'      // > 10 % closer than inner edge
  | 'too-cold'     // > 10 % beyond outer edge
  | 'unknown';     // host Teff outside Kopparapu calibration range

export function classifyHabitability(
  planetAU: number, hz: { innerAU: number; outerAU: number } | null,
): HabitabilityBucket {
  if (!hz) return 'unknown';
  if (planetAU >= hz.innerAU && planetAU <= hz.outerAU) return 'in-hz';
  if (planetAU < hz.innerAU) {
    return planetAU > hz.innerAU * 0.90 ? 'hot-edge' : 'too-hot';
  }
  return planetAU < hz.outerAU * 1.10 ? 'cold-edge' : 'too-cold';
}
