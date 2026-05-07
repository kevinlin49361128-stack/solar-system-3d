import { describe, it, expect } from 'vitest';
import { deltaTSeconds, tdtFromUtcJd, jdToDecimalYear } from './timeScales';

/**
 * ΔT reference values from NASA Eclipse "Polynomial Expressions for Delta T"
 * page (Espenak-Meeus 2006). Tolerance ±0.5 s for modern era — these are
 * the numbers fed into the canon of solar eclipses, treat them as gold.
 */
describe('deltaTSeconds', () => {
  // [decimalYear, expectedΔTseconds, tolerance]
  const cases: Array<[number, number, number]> = [
    // Modern, well-constrained
    [2000.0,   63.83,    0.5],
    [2010.0,   66.2,     1.0],
    // 2025+ values are projected by Espenak-Meeus; actual IERS values
    // diverge slightly because Earth's recent rotation is faster than
    // predicted. ±3s tolerance captures both.
    [2025.0,   74.0,     3.0],
    [1990.0,   56.86,    0.5],
    [1980.0,   50.54,    0.5],
    [1970.0,   40.18,    0.5],
    [1950.0,   29.15,    0.5],
    [1900.0,   -2.79,    0.5],   // briefly UT > TT
    // 19th century
    [1800.0,   13.72,    1.0],
    [1850.0,    7.59,    1.5],
    // Pre-1600 polynomial, looser tolerance
    [1500.0,  198.0,    10.0],
    [1000.0, 1574.0,    20.0],
    [500.0,  5710.0,    50.0],
    [0.0,   10583.6,   100.0],
    // Antiquity asymptotic
    [-1000.0, 25400.0, 200.0],
  ];

  for (const [year, expected, tol] of cases) {
    it(`year ${year} → ΔT ≈ ${expected}s (±${tol}s)`, () => {
      expect(deltaTSeconds(year)).toBeCloseTo(expected, -Math.log10(2 * tol));
      // Also a robust absolute-error check
      expect(Math.abs(deltaTSeconds(year) - expected)).toBeLessThan(tol);
    });
  }

  it('ΔT is continuous across polynomial breakpoints', () => {
    // Check both sides of each transition agree to within ~1s
    const breakpoints = [-500, 500, 1600, 1700, 1800, 1860, 1900, 1920, 1941, 1961, 1986, 2005, 2050, 2150];
    for (const y of breakpoints) {
      const before = deltaTSeconds(y - 0.001);
      const after = deltaTSeconds(y + 0.001);
      expect(Math.abs(after - before)).toBeLessThan(2);
    }
  });
});

describe('jdToDecimalYear', () => {
  it('J2000.0 (JD 2451545.0) → 2000.0', () => {
    expect(jdToDecimalYear(2451545.0)).toBeCloseTo(2000, 5);
  });

  it('J2025 mid-year', () => {
    // Approx 2025-07-02 12:00 UT → JD ≈ 2460859
    const y = jdToDecimalYear(2460859);
    expect(y).toBeGreaterThan(2025.4);
    expect(y).toBeLessThan(2025.6);
  });
});

describe('tdtFromUtcJd', () => {
  it('shifts forward by current ΔT', () => {
    const utcJd = 2460676.0; // ~2025-01-01
    const ttJd = tdtFromUtcJd(utcJd);
    const shiftSec = (ttJd - utcJd) * 86400;
    // Modern ΔT around 70s
    expect(shiftSec).toBeGreaterThan(60);
    expect(shiftSec).toBeLessThan(85);
  });

  it('historical: 1700 → ΔT ~9 s shift', () => {
    // JD 2342028 ≈ 1700-01-01
    const utcJd = 2342028;
    const shift = (tdtFromUtcJd(utcJd) - utcJd) * 86400;
    expect(shift).toBeGreaterThan(7);
    expect(shift).toBeLessThan(11);
  });
});
