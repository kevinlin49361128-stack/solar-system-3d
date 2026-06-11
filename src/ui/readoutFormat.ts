/**
 * Pure formatting helpers for the observer-mode readouts (compass,
 * tracking-rate, FOV pill, local clock). Extracted from main.ts so they
 * can be unit-tested — every function here is a pure value → string map
 * with no DOM or scene dependencies.
 */

/** 8-point compass label for an azimuth in degrees (0 = N, 90 = E). */
export function cardinalLabel(azDeg: number): string {
  const labels = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const idx = Math.round(azDeg / 45) % 8;
  return labels[idx];
}

/**
 * Arrow glyph for a position angle in the horizontal frame
 * (0° = up/zenith, 90° = right/east) — used by the tracking readout to
 * show which way the tracked body is drifting.
 */
export function paCardinal(paDeg: number): string {
  const labels = ['↑', '↗', '→', '↘', '↓', '↙', '←', '↖'];
  const idx = Math.round(paDeg / 45) % 8;
  return labels[idx];
}

/** Angular rate, auto-switching ″/s → ′/s at 60″/s. */
export function formatRate(arcsecPerSec: number): string {
  if (arcsecPerSec >= 60) return `${(arcsecPerSec / 60).toFixed(2)}′/s`;
  return `${arcsecPerSec.toFixed(2)}″/s`;
}

/** Field of view, auto-switching ° → ′ → ″ with 3-significant-digit style. */
export function formatFov(deg: number): string {
  if (deg >= 1) return `${deg.toFixed(deg < 10 ? 2 : 1)}°`;
  const arcmin = deg * 60;
  if (arcmin >= 1) return `${arcmin.toFixed(arcmin < 10 ? 2 : 1)}′`;
  return `${(arcmin * 60).toFixed(1)}″`;
}

/** 35 mm-equivalent focal length, auto-switching mm → m at 1000 mm. */
export function formatFocal(mm: number): string {
  if (mm >= 1000) return `${(mm / 1000).toFixed(2)} m`;
  if (mm >= 100)  return `${mm.toFixed(0)} mm`;
  return `${mm.toFixed(1)} mm`;
}

/**
 * Local mean solar time (UT + lon/15 h) for a Julian Date at longitude
 * `lonDeg`, formatted HH:MM:SS with 24 h wrapping. This is the observer's
 * sundial-style clock, not a civil timezone — deliberate, since the
 * simulator places observers anywhere on the globe including mid-ocean.
 */
export function formatLocalMeanTime(jd: number, lonDeg: number): string {
  const offsetMin = (lonDeg / 15) * 60;
  const localMs = (jd - 2440587.5) * 86400000 + offsetMin * 60000;
  const d = new Date(localMs);
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  const ss = String(d.getUTCSeconds()).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}
