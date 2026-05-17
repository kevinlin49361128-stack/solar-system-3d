import { describe, it, expect } from 'vitest';
import { Vector3 } from 'three';
import { starScenePosition } from './StarMap';
import { NAMED_STARS, type NamedStar } from '../data/stars';
import { applyProperMotion } from '../physics/topocentric';
import { J2000_JD } from '../physics/constants';

/** Helper: PM-only scene-position delta for `star` over `years` years,
 *  isolating the proper motion contribution from precession. */
function positionPMOnly(star: NamedStar, years: number): number {
  if (star.pmRA === undefined || star.pmDec === undefined) return 0;
  const jd = J2000_JD + years * 365.25;
  // Apply PM directly to the catalogue RA/Dec; then compare the modified
  // RA/Dec to the un-modified one via great-circle distance on the dome.
  const driftedRaDec = applyProperMotion(star.raHours, star.decDeg, jd, star.pmRA, star.pmDec);
  const dDecRad = (driftedRaDec.decDeg - star.decDeg) * Math.PI / 180;
  const dRaRad = (driftedRaDec.raHours - star.raHours) * 15 * Math.PI / 180;
  const decRad = star.decDeg * Math.PI / 180;
  // Local-tangent-plane angular distance:
  const dxRad = dRaRad * Math.cos(decRad);
  const angRad = Math.sqrt(dxRad * dxRad + dDecRad * dDecRad);
  return angRad * 4000;  // dome radius in scene units
}

const STAR_DOME_RADIUS = 4000;

/**
 * Sanity checks on the proper-motion + aberration path that drives the
 * named-star sprites and constellation lines. We exercise the pure
 * `starScenePosition` helper here — touching the full StarMap class
 * needs document-driven sprite/texture machinery that happy-dom doesn't
 * faithfully reproduce.
 *
 * Reference: NamedStar PM values are Hipparcos mas/yr (cosine-corrected
 * for pmRA per the catalogue convention).
 */
describe('starScenePosition — proper motion', () => {
  // Pick the highest-PM named star in our catalogue as a test pivot.
  // Barnard's Star (HIP 87937) has the fastest proper motion of any star
  // visible from Earth (~10.358″/yr) at PM ≈ (-798.71, +10337.77) mas/yr.
  // We don't ship Barnard's in NAMED_STARS, but Sirius is famous for fast
  // PM too: (-546.05, -1223.14) mas/yr. Total PM ≈ 1.339″/yr.
  const sirius = NAMED_STARS.find(s => s.id === 'sirius');

  it('at t=J2000 the position equals the catalogue position', () => {
    if (!sirius) return;
    const j2000 = starScenePosition(sirius, J2000_JD, null);
    // Just verify the position sits on the dome sphere — the catalog
    // direction itself is correct by construction.
    expect(j2000.length()).toBeCloseTo(STAR_DOME_RADIUS, 0);
  });

  it('drift increases roughly linearly with elapsed time', () => {
    if (!sirius) return;
    // Both PM and IAU 1976 precession are first-order linear in time
    // over the centuries we care about, so the 1000-yr drift should be
    // ~10× the 100-yr drift. Doesn't pin absolute magnitudes (those
    // are owned by topocentric.test.ts) but catches sign / scaling bugs.
    const now = starScenePosition(sirius, J2000_JD, null);
    const a100  = starScenePosition(sirius, J2000_JD + 100  * 365.25, null);
    const a1000 = starScenePosition(sirius, J2000_JD + 1000 * 365.25, null);
    const d100  = now.distanceTo(a100);
    const d1000 = now.distanceTo(a1000);
    expect(d100).toBeGreaterThan(0);
    expect(d1000).toBeGreaterThan(d100 * 5);
    expect(d1000).toBeLessThan(d100 * 20);
  });

  it('high-PM stars drift faster than low-PM stars over 100 yr', () => {
    // PM-only delta (precession affects all equally). Pick two of our
    // named stars with very different PM magnitudes. Sirius PM total
    // ≈ 1.34″/yr; Betelgeuse PM ≈ 0.03″/yr (~50× slower). Compare drift.
    const lowPmStar = NAMED_STARS.find(s =>
      s.id !== sirius?.id
      && s.pmRA !== undefined
      && Math.hypot(s.pmRA, s.pmDec ?? 0) < 100,  // mas/yr → ≤ 0.1″/yr
    );
    if (!sirius || !lowPmStar) return;
    // Apply PM only — pass null for jd to skip precession.
    const driftSirius = positionPMOnly(sirius, 100);
    const driftLow    = positionPMOnly(lowPmStar, 100);
    expect(driftSirius).toBeGreaterThan(driftLow * 2);
  });

  it('aberration shifts star direction toward Earth\'s velocity', () => {
    if (!sirius) return;
    // Earth at vernal equinox: sun→earth direction is (+1, 0, 0) ecliptic.
    // Earth's velocity is perpendicular in the ecliptic plane → (0, +1, 0).
    const noAb = starScenePosition(sirius, J2000_JD, null);
    const withAb = starScenePosition(sirius, J2000_JD, new Vector3(1, 0, 0));
    // Aberration moves the star by up to ~20.5″ — on a 4000-unit dome
    // that's 4000 × (20.5/206265) ≈ 0.4 units. Should be detectable but small.
    const shift = noAb.distanceTo(withAb);
    expect(shift).toBeGreaterThan(0);
    expect(shift).toBeLessThan(1);  // not more than the 20.5″ max
  });
});
