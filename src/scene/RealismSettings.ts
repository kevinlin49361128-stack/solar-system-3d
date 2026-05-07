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
}

export type RealismPreset = 'stylized' | 'balanced' | 'realistic';

export const PRESET_VALUES: Record<RealismPreset, RealismSettings> = {
  stylized: {
    extinction: false, moonGlow: false, bvColor: false, satShadow: false, dsoRealSize: false,
    milkyway: false, beltOfVenus: false, zodiacal: false, airglow: false, meteors: false,
  },
  balanced: {
    extinction: true, moonGlow: true, bvColor: true, satShadow: true, dsoRealSize: false,
    milkyway: true, beltOfVenus: true, zodiacal: false, airglow: false, meteors: false,
  },
  realistic: {
    extinction: true, moonGlow: true, bvColor: true, satShadow: true, dsoRealSize: true,
    milkyway: true, beltOfVenus: true, zodiacal: true, airglow: true, meteors: true,
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
