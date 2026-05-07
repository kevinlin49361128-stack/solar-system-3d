/**
 * Angle-formatting utilities for the observer/sky UI.
 *
 * Kept in its own file (rather than inline in main.ts) so unit tests
 * can exercise the carry-handling and sign edge cases without spinning
 * up the whole app.
 */

/**
 * Format an angle as degrees-minutes-seconds (DMS) — the astronomy standard
 * used by telescope setting circles, ephemerides, and Stellarium.
 *
 * Examples:
 *   formatDMS(123.4567)        → '123°27′24″'
 *   formatDMS(-12.345, true)   → '-12°20′42″'
 *   formatDMS(56.789, true)    → '+56°47′20″'
 *   formatDMS(0)               → '0°00′00″'
 *
 * Carry handling: rounding the seconds to integer can push 60→0 with a
 * carry into minutes (and same for minutes 60→0 with a carry into degrees);
 * this is propagated correctly so we never emit '12°59′60″'.
 *
 * @param deg     angle in decimal degrees
 * @param signed  if true, prefix '+' for non-negative (use for altitude /
 *                declination); if false, no sign on positives (azimuth /
 *                right-ascension where the value is always 0–360°).
 */
export function formatDMS(deg: number, signed = false): string {
  const sign = deg < 0 ? '-' : (signed ? '+' : '');
  const abs = Math.abs(deg);
  let d = Math.floor(abs);
  const mFloat = (abs - d) * 60;
  let m = Math.floor(mFloat);
  let s = Math.round((mFloat - m) * 60);
  if (s === 60) { s = 0; m += 1; }
  if (m === 60) { m = 0; d += 1; }
  return `${sign}${d}°${String(m).padStart(2, '0')}′${String(s).padStart(2, '0')}″`;
}
