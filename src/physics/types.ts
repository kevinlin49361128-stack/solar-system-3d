import { Vector3 } from 'three';

export interface StateVector {
  position: Vector3;
  velocity: Vector3;
}

export interface OrbitPropagator {
  stateAt(jd: number): StateVector;

  /**
   * Optional: pre-computed orbital elements for orbit-line rendering and
   * info display. May be undefined for propagators that don't expose
   * a simple Keplerian description (e.g. an N-body propagator).
   */
  readonly elements?: StaticOrbitalElements;

  /**
   * Optional metadata used by the InfoPanel to make the underlying physics
   * transparent to the user — what kind of propagator is being used and
   * where the orbital data originally came from.
   */
  readonly kind?: PropagatorKind;
  readonly source?: PropagatorSource;
}

export type PropagatorKind =
  | 'kepler'         // analytic two-body Kepler
  | 'kepler-perturbed' // Kepler with secular drift terms
  | 'sampled'        // table of (jd, state) samples interpolated
  | 'horizons'       // queried from JPL Horizons
  | 'nbody'          // member of an N-body simulation
  | 'lunar-elp';     // lunar series (ELP / Meeus)

export interface PropagatorSource {
  /** Short human label, e.g. "NASA JPL Approx. Positions". */
  label: string;
  /** Optional URL pointing to the data origin / publication / dataset. */
  url?: string;
  /** Optional short note, e.g. epoch or accuracy claim. */
  note?: string;
  /**
   * Documented JD range over which this propagator's accuracy claim
   * holds. Outside this range positions still compute (you'd never want
   * to grey-screen the sim just because the user asked for 1492 CE) but
   * the InfoPanel surfaces a yellow disclaimer so the user knows the
   * shown distance / RA / Dec may have drifted from physical reality.
   *
   * The window is the published "good" zone, not the absolute "this
   * still kinda works" zone — e.g. NASA's approximate-positions table
   * is documented good 1800–2050, but stays within a few arcminutes for
   * 1500–2500.
   */
  validJdMin?: number;
  validJdMax?: number;
}

export interface StaticOrbitalElements {
  a: number;
  e: number;
  iDeg: number;
  ΩDeg: number;
  ωDeg: number;
  periodDays: number;
}

export interface PhysicalProperties {
  radiusKm: number;
  massKg: number;
  rotationPeriodDays: number;
  axialTiltDeg: number;
}

export interface Appearance {
  color: number;
  textureUrl?: string;
  emissive?: boolean;
  /** If set, render an extra translucent shell with this texture (white = opaque). */
  cloudTextureUrl?: string;
  /** If set, dim side of body uses this texture as emissive (city lights). */
  nightTextureUrl?: string;
  /**
   * If set, render a fresnel-based atmospheric glow shell around the body.
   * `color` is the rim colour, `power` controls how thin/thick the rim is
   * (higher = thinner), `scale` is the shell radius relative to body radius.
   */
  atmosphere?: {
    color: number;
    power?: number;
    scale?: number;
    intensity?: number;
  };
}

export type BodyCategory =
  | 'star'
  | 'planet'
  | 'dwarf'
  | 'moon'
  | 'comet';

import type { LangText } from '../i18n';

export interface AtmosphereData {
  surfacePressureKpa?: number;
  pressureNote?: LangText;
  composition: { name: LangText; pct: number }[];
}

export interface InternalLayer {
  layer: LangText;
  description: LangText;
}

export interface CompositionEntry {
  name: LangText;
  pct: number;
}

export interface BodyDetails {
  classification?: LangText;
  meanSurfaceTempC?: number;
  surfaceTempRangeC?: [number, number];
  surfaceGravityMS2?: number;
  escapeVelocityKmS?: number;
  bulkComposition?: CompositionEntry[];
  atmosphere?: AtmosphereData;
  internalStructure?: InternalLayer[];
  geology?: LangText;
  notableFacts?: LangText[];
}

export interface BodyDescriptor {
  id: string;
  name: string;
  nameEn: string;
  nameJa?: string;
  parentId: string | null;
  category: BodyCategory;
  physical: PhysicalProperties;
  propagator: OrbitPropagator | null;
  appearance: Appearance;
  description?: LangText;
  details?: BodyDetails;
}
