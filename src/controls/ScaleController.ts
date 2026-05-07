import { AU_KM } from '../physics/constants';

export type ScaleMode = 'real' | 'log' | 'schematic';
export type ReferenceFrame = 'heliocentric' | 'geocentric';

/**
 * Maps physical units (AU for distance, km for radius) into Three.js scene
 * units. The fundamental visualisation problem with the solar system is that
 * the Sun's diameter is ~100× Earth's, and 1 AU is ~10000× the Sun's radius.
 * No single linear scale shows both planet detail and orbital geometry. So
 * each mode picks a different compromise.
 *
 * - real:      truly proportional. Planets are dots; useful for pure orbits.
 * - log:       log of distance, body radii exaggerated ~80×. Compromise.
 * - schematic: textbook-diagram look. Distances compressed via power 0.55,
 *              body radii log-mapped so all bodies are visible without the
 *              Sun swallowing the inner planets. Sizes are visual, not real.
 */
export class ScaleController {
  private mode: ScaleMode = 'real';
  private frame: ReferenceFrame = 'heliocentric';
  private listeners: Set<() => void> = new Set();

  getMode(): ScaleMode { return this.mode; }

  setMode(mode: ScaleMode): void {
    if (this.mode === mode) return;
    this.mode = mode;
    for (const fn of this.listeners) fn();
  }

  /**
   * Reference frame: 'heliocentric' (sun-centred, default Copernican view)
   * or 'geocentric' (earth-centred, Ptolemaic view — planets trace epicycle
   * loops as in pre-1543 astronomy, but using real ephemeris data).
   */
  getFrame(): ReferenceFrame { return this.frame; }

  setFrame(frame: ReferenceFrame): void {
    if (this.frame === frame) return;
    this.frame = frame;
    for (const fn of this.listeners) fn();
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /** Solar-distance scaling: AU → scene units. Operates on a magnitude. */
  distanceAU(au: number): number {
    switch (this.mode) {
      case 'real':
        return au;
      case 'log':
        return Math.log10(1 + au * 5) * 4;
      case 'schematic':
        return Math.pow(au, 0.55) * 3.0;
    }
  }

  /** Body radius (km) → scene units. */
  radiusKm(km: number): number {
    const radiusAU = km / AU_KM;
    switch (this.mode) {
      case 'real':
        return radiusAU;
      case 'log':
        // log mode keeps proportional radii but exaggerates ~80×.
        return radiusAU * 80;
      case 'schematic':
        // Logarithmic body radii so all bodies are visible without the Sun
        // dwarfing everything. km / 1000 → log10(1+x) → scaled.
        return 0.025 + Math.log10(1 + km / 1000) * 0.07;
    }
  }

  /**
   * Extra multiplier applied to the Sun on top of `radiusKm`. In `real` and
   * `log` modes the Sun would otherwise be a tiny dot or tiny disc; we boost
   * it so it's recognisable. In `schematic` mode the log-mapping already
   * makes it visible, so no extra factor.
   */
  sunMultiplier(): number {
    switch (this.mode) {
      case 'real': return 8;
      case 'log': return 3;
      case 'schematic': return 1;
    }
  }

  /**
   * Moon distances use a separate, smaller scaling than solar distances.
   * Multipliers are tuned so a moon's orbit stays inside its parent planet's
   * "neighbourhood" — i.e. the orbit ring does not cross the next planet's
   * solar orbit, even after the planet's body radius is exaggerated in
   * non-real modes.
   */
  moonDistanceAU(au: number): number {
    switch (this.mode) {
      case 'real':
        return au;
      case 'log':
        return au * 30;
      case 'schematic':
        return au * 100;
    }
  }

  /** Visual size for asteroid/Kuiper belt particles (base size in geometry). */
  beltParticleSizeFactor(): number {
    switch (this.mode) {
      case 'real': return 1;
      case 'log': return 2;
      case 'schematic': return 2.5;
    }
  }
}
