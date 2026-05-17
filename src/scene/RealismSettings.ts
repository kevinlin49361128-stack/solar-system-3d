/**
 * Centralised state for realism / visual layer toggles. The various scene
 * modules (RealStarfield, AtmosphereSky, MessierLayer, SatelliteLayer, ...)
 * subscribe to this and update their uniforms / visibility on every change.
 *
 * Three presets pre-flip groups of toggles for one-click profiles:
 *   stylized   — eye-candy default (no physics corrections, no extra layers)
 *   balanced   — physics on, visual layers minimal
 *   realistic  — everything on, mirrors a high-end planetarium feel
 */

export interface RealismSettings {
  // physics corrections
  extinction: boolean;
  moonGlow: boolean;
  bvColor: boolean;
  satShadow: boolean;
  dsoRealSize: boolean;
  // visual layers
  milkyway: boolean;
  beltOfVenus: boolean;
  zodiacal: boolean;
  airglow: boolean;
  meteors: boolean;
  // catalogue depth (v0.4) — toggled on lazy-loads the deep HYG
  // variant (mag ≤ 9, ~3 MB, 78k stars vs default 15k mag-7 stars).
  // Especially useful in observer mode under dark skies and for the
  // smart-telescope crowd.
  deepStars: boolean;
  // Sharpless 2 emission-nebula overlay (v0.5) — 313 Hα HII regions.
  // Off by default to keep the DSO view uncluttered for casual users;
  // smart-scope planners flip it on.
  sharpless2: boolean;
  // Full NGC + IC catalogue (v0.5) — ~11k entries (445 KB JSON). Bulk
  // background sprinkle over the curated Messier + named NGC layer.
  // Opt-in for the same reason: most NGC objects are invisible to
  // visual observers and only become useful with a smart scope.
  ngcFull: boolean;
  // Abell rich-galaxy-cluster catalogue (v0.6) — 2712 entries
  // (80 KB JSON). The deep-imaging extreme: most clusters mag 15-18.
  abell: boolean;
}

export type RealismPreset = 'stylized' | 'balanced' | 'realistic';

export const PRESET_VALUES: Record<RealismPreset, RealismSettings> = {
  stylized: {
    extinction: false, moonGlow: false, bvColor: false, satShadow: false, dsoRealSize: false,
    milkyway: false, beltOfVenus: false, zodiacal: false, airglow: false, meteors: false,
    deepStars: false, sharpless2: false, ngcFull: false, abell: false,
  },
  balanced: {
    extinction: true, moonGlow: true, bvColor: true, satShadow: true, dsoRealSize: false,
    milkyway: true, beltOfVenus: true, zodiacal: false, airglow: false, meteors: false,
    deepStars: false, sharpless2: false, ngcFull: false, abell: false,
  },
  realistic: {
    extinction: true, moonGlow: true, bvColor: true, satShadow: true, dsoRealSize: true,
    milkyway: true, beltOfVenus: true, zodiacal: true, airglow: true, meteors: true,
    deepStars: true, sharpless2: true, ngcFull: true, abell: true,
  },
};

export class RealismState {
  private settings: RealismSettings = { ...PRESET_VALUES.stylized };
  private listeners: ((s: RealismSettings) => void)[] = [];

  get(): Readonly<RealismSettings> { return this.settings; }

  set<K extends keyof RealismSettings>(key: K, value: RealismSettings[K]): void {
    if (this.settings[key] === value) return;
    this.settings[key] = value;
    this.emit();
  }

  setPreset(preset: RealismPreset): void {
    this.settings = { ...PRESET_VALUES[preset] };
    this.emit();
  }

  subscribe(fn: (s: RealismSettings) => void): () => void {
    this.listeners.push(fn);
    fn(this.settings);
    return () => {
      const i = this.listeners.indexOf(fn);
      if (i >= 0) this.listeners.splice(i, 1);
    };
  }

  private emit(): void {
    for (const fn of this.listeners) fn(this.settings);
  }
}
