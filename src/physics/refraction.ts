/**
 * Bennett 1982 atmospheric refraction (apparent − true altitude).
 *
 * Returns refraction in arcminutes for a body at true altitude `altDeg`.
 * Includes the Meeus 1998 temperature/pressure scaling so observers at
 * altitude or cold sites get correctly reduced refraction — conditions
 * come from the shared atmospheric state in `topocentric.ts`
 * (set via `setAtmosphericConditions`).
 *
 * Domain notes:
 *  - Below −1.5° the body is too far under the horizon for refraction to
 *    matter visually → returns 0.
 *  - The formula's argument is clamped at −0.5° (Bennett's fit is only
 *    valid down to the horizon region; below that the tangent blows up).
 *  - At the horizon (0°) with standard conditions (1010 mbar, 10 °C) the
 *    classic value is ≈ 34′ — which is why the sun stays visible a full
 *    solar diameter past geometric sunset.
 */
import { getAtmosphericConditions } from './topocentric';

export function bennettRefractionArcmin(altDeg: number): number {
  if (altDeg < -1.5) return 0;
  const h = Math.max(-0.5, altDeg);
  const baseArcmin = 1 / Math.tan(((h + 7.31 / (h + 4.4)) * Math.PI) / 180);
  const { pressureMbar, temperatureC } = getAtmosphericConditions();
  const scale = (pressureMbar / 1010) * (283 / (273 + temperatureC));
  return baseArcmin * scale;
}
