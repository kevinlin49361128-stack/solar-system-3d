import { Vector3 } from 'three';
import { DEG2RAD, J2000_JD, TWO_PI } from './constants';
import { solveKepler } from './kepler';
import type { OrbitPropagator, PropagatorKind, PropagatorSource, StateVector, StaticOrbitalElements } from './types';

export interface KeplerElements {
  /** Reference epoch (Julian Date). Defaults to J2000. */
  epoch?: number;

  a: number;
  aDot?: number;

  e: number;
  eDot?: number;

  iDeg: number;
  iDotDeg?: number;

  /** Mean longitude L = M + ϖ at epoch (deg). */
  LDeg: number;
  LDotDeg?: number;

  /** Longitude of perihelion ϖ = Ω + ω (deg). */
  varpiDeg: number;
  varpiDotDeg?: number;

  /** Longitude of ascending node Ω (deg). */
  OmegaDeg: number;
  OmegaDotDeg?: number;

  /**
   * Optional fixed orbital period in days. If omitted, the period is derived
   * from L̇ for solar-orbiting bodies (assumed when used at the top level).
   * For moons, supply this explicitly.
   */
  periodDays?: number;
}

/**
 * Two-body Keplerian propagator. Uses NASA JPL "Approximate Positions of the
 * Planets" formulation: orbital elements are given at J2000 with linear
 * derivatives per Julian century. Output position is in AU, velocity in AU/day,
 * relative to the parent body's centre, expressed in the parent's reference
 * ecliptic plane (J2000 ecliptic for solar bodies).
 */
export class KeplerPropagator implements OrbitPropagator {
  readonly elements: StaticOrbitalElements;
  readonly kind: PropagatorKind;
  readonly source?: PropagatorSource;
  private readonly el: Required<Omit<KeplerElements, 'periodDays'>> & { periodDays: number };

  constructor(input: KeplerElements, source?: PropagatorSource) {
    this.source = source;
    // If any *Dot field is non-zero we expose ourselves as a perturbed
    // Kepler — useful for the InfoPanel to communicate that the elements
    // drift secularly, not just steady-state.
    this.kind =
      (input.aDot || input.eDot || input.iDotDeg || input.varpiDotDeg || input.OmegaDotDeg)
        ? 'kepler-perturbed'
        : 'kepler';

    const epoch = input.epoch ?? J2000_JD;
    const periodDays = input.periodDays ?? (input.LDotDeg ? 360 / (input.LDotDeg / 36525) : 365.25);

    this.el = {
      epoch,
      a: input.a,
      aDot: input.aDot ?? 0,
      e: input.e,
      eDot: input.eDot ?? 0,
      iDeg: input.iDeg,
      iDotDeg: input.iDotDeg ?? 0,
      LDeg: input.LDeg,
      LDotDeg: input.LDotDeg ?? 0,
      varpiDeg: input.varpiDeg,
      varpiDotDeg: input.varpiDotDeg ?? 0,
      OmegaDeg: input.OmegaDeg,
      OmegaDotDeg: input.OmegaDotDeg ?? 0,
      periodDays,
    };

    this.elements = {
      a: this.el.a,
      e: this.el.e,
      iDeg: this.el.iDeg,
      ΩDeg: this.el.OmegaDeg,
      ωDeg: this.el.varpiDeg - this.el.OmegaDeg,
      periodDays: this.el.periodDays,
    };
  }

  stateAt(jd: number): StateVector {
    const T = (jd - this.el.epoch) / 36525;

    const a = this.el.a + this.el.aDot * T;
    const e = this.el.e + this.el.eDot * T;
    const i = (this.el.iDeg + this.el.iDotDeg * T) * DEG2RAD;
    const L = (this.el.LDeg + this.el.LDotDeg * T) * DEG2RAD;
    const varpi = (this.el.varpiDeg + this.el.varpiDotDeg * T) * DEG2RAD;
    const Omega = (this.el.OmegaDeg + this.el.OmegaDotDeg * T) * DEG2RAD;

    const omega = varpi - Omega;
    const M = ((L - varpi) % TWO_PI + TWO_PI) % TWO_PI;

    const E = solveKepler(M, e);
    const cosE = Math.cos(E);
    const sinE = Math.sin(E);

    const xOrb = a * (cosE - e);
    const yOrb = a * Math.sqrt(1 - e * e) * sinE;

    // Mean motion n (rad/day)
    const n = TWO_PI / this.el.periodDays;
    // dE/dt
    const dE = n / (1 - e * cosE);
    const vxOrb = -a * sinE * dE;
    const vyOrb = a * Math.sqrt(1 - e * e) * cosE * dE;

    const cosO = Math.cos(Omega);
    const sinO = Math.sin(Omega);
    const cosw = Math.cos(omega);
    const sinw = Math.sin(omega);
    const cosi = Math.cos(i);
    const sini = Math.sin(i);

    const r11 = cosO * cosw - sinO * sinw * cosi;
    const r12 = -cosO * sinw - sinO * cosw * cosi;
    const r21 = sinO * cosw + cosO * sinw * cosi;
    const r22 = -sinO * sinw + cosO * cosw * cosi;
    const r31 = sinw * sini;
    const r32 = cosw * sini;

    // Ecliptic frame: X to vernal equinox, Y in plane, Z to ecliptic north.
    const x = r11 * xOrb + r12 * yOrb;
    const y = r21 * xOrb + r22 * yOrb;
    const z = r31 * xOrb + r32 * yOrb;

    const vx = r11 * vxOrb + r12 * vyOrb;
    const vy = r21 * vxOrb + r22 * vyOrb;
    const vz = r31 * vxOrb + r32 * vyOrb;

    return {
      position: new Vector3(x, y, z),
      velocity: new Vector3(vx, vy, vz),
    };
  }
}
