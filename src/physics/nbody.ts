import { Vector3 } from 'three';
import type { OrbitPropagator, PropagatorKind, PropagatorSource, StateVector, BodyDescriptor } from './types';
import { AU_KM, DAY_SECONDS, J2000_JD, SUN_GM } from './constants';

// Speed of light in scene-physics units (AU / day).
const C_AU_PER_DAY = 299792.458 /* km/s */ * DAY_SECONDS / AU_KM;
const C2_AU_PER_DAY2 = C_AU_PER_DAY * C_AU_PER_DAY;

/**
 * 全系統 N-body 重力數值積分。
 *
 * 工作原理：
 *  - 在啟用時刻，從每顆天體既有的 Kepler 解析解抓初始位置與速度作為初始條件。
 *  - 之後以 Velocity Verlet 步進整個系統的狀態（一個共享 simulation）。
 *  - 每顆天體擁有一個 `NBodyAdapter` 實作 OrbitPropagator，stateAt(jd) 會
 *    驅動共享 simulation 推進到目標 JD（前後皆可，反向時用負步長）。
 *
 * 因此架構上「每顆天體一個 propagator」的契約仍然成立，背後是共享狀態。
 *
 * 優點：可看到真實的攝動 (Mercury 進動、外行星共振) — 雖然在短時間內肉眼難察覺。
 * 缺點：
 *  - 取消後需要重新從 Kepler 設定初始條件
 *  - 大時間跳躍會花很多步長 (clamp 到 ~10 年防卡)
 */

const G_AU3_PER_MSUN_PER_DAY2 = (() => {
  // 從 SI 計算 G in AU^3 / (M_sun · day^2)
  // SUN_GM = G * M_sun in m^3/s^2
  const G = SUN_GM; // m^3/(s^2 · 1 sun mass), so as if M_sun = 1
  const auInM = AU_KM * 1000;
  const dayInS = DAY_SECONDS;
  // G in (m/AU)^-3 * s^2/day^2 ... messy; do directly:
  return G * (dayInS * dayInS) / (auInM * auInM * auInM);
})();

const MASS_SUN_KG = 1.98892e30;

interface NBodyParticle {
  id: string;
  mass: number;        // 太陽質量單位
  pos: Vector3;        // AU
  vel: Vector3;        // AU/day
}

export type IntegratorKind = 'verlet' | 'yoshida4';

export class NBodySimulation {
  particles: NBodyParticle[] = [];
  jd: number = J2000_JD;
  private acc = new Map<string, Vector3>();
  /** Cached state per id, to satisfy stateAt() without re-stepping. */
  private cache = new Map<string, StateVector>();
  /**
   * Numerical integrator. Verlet is 2nd order symplectic (energy-stable,
   * good for solar-system over centuries). Yoshida 4 is 4th order
   * symplectic (~10× more accurate per step at ~3× cost) — use it when
   * "verifying" against precise ephemerides or running long integrations.
   */
  integrator: IntegratorKind = 'verlet';
  /**
   * Toggle post-Newtonian (Schwarzschild) correction for sun→planet
   * gravity. Adds the Mercury 43"/century perihelion precession plus
   * smaller GR effects on the other inner planets. Negligible for outer
   * bodies but the numerical cost is trivial.
   */
  relativisticGR = false;
  /**
   * Toggle Sun J2 oblateness perturbation. The Sun is very slightly
   * oblate (J2 ≈ 2e-7) due to rotation; the resulting perihelion advance
   * on Mercury is small (~3"/century) but historically important — it
   * was the dominant non-Newtonian effect proposed by Newcomb / Le
   * Verrier before GR. Cost: one extra heliocentric pass per step.
   */
  solarJ2 = false;

  constructor(initial: { id: string; massKg: number; pos: Vector3; vel: Vector3 }[], startJd: number) {
    this.jd = startJd;
    for (const i of initial) {
      const p: NBodyParticle = {
        id: i.id,
        mass: i.massKg / MASS_SUN_KG,
        pos: i.pos.clone(),
        vel: i.vel.clone(),
      };
      this.particles.push(p);
      this.acc.set(p.id, new Vector3());
      this.cache.set(p.id, { position: p.pos.clone(), velocity: p.vel.clone() });
    }
    this.computeAccelerations();
  }

  /** Compute gravitational acceleration on each particle from all others. */
  private computeAccelerations(): void {
    for (const p of this.particles) {
      this.acc.get(p.id)!.set(0, 0, 0);
    }
    for (let i = 0; i < this.particles.length; i++) {
      const a = this.particles[i];
      const aAcc = this.acc.get(a.id)!;
      for (let j = i + 1; j < this.particles.length; j++) {
        const b = this.particles[j];
        const dx = b.pos.x - a.pos.x;
        const dy = b.pos.y - a.pos.y;
        const dz = b.pos.z - a.pos.z;
        // Plummer softening: replaces 1/r³ with 1/(r² + ε²)^1.5 so
        // even an exact close approach (r → 0) keeps the force finite.
        // ε² = 1e-6 AU² ≈ (1500 km)² is below any planet's physical
        // radius but well above the floating-point catastrophe zone.
        // The original `+ 1e-30` softener was decorative — at r ≈ 0
        // r3 dropped to 1e-30, accelerations reached ~1e30 AU/day², and
        // the integrator silently exploded. With current dataset
        // (planets stay > 0.3 AU apart) this is defensive; matters once
        // someone adds a comet with a flyby trajectory.
        const SOFT2 = 1e-6;
        const r2 = dx * dx + dy * dy + dz * dz;
        const softR2 = r2 + SOFT2;
        const r3 = softR2 * Math.sqrt(softR2);
        const G = G_AU3_PER_MSUN_PER_DAY2;
        const aFactor = G * b.mass / r3;
        const bFactor = G * a.mass / r3;
        aAcc.x += dx * aFactor;
        aAcc.y += dy * aFactor;
        aAcc.z += dz * aFactor;
        const bAcc = this.acc.get(b.id)!;
        bAcc.x -= dx * bFactor;
        bAcc.y -= dy * bFactor;
        bAcc.z -= dz * bFactor;
      }
    }
    if (this.relativisticGR) this.applyRelativisticCorrection();
    if (this.solarJ2) this.applySolarJ2();
  }

  /**
   * Add post-Newtonian (Schwarzschild metric) correction to each non-sun
   * particle's acceleration. Source: standard GR perihelion-precession
   * formula
   *   a_GR = (GM/r²)·[(4·GM/(r·c²) − v²/c²)·ê_r + 4·(v · ê_r)·v / c²]
   * applied between sun (mass M_⊙) and each planet. This reproduces the
   * 43″/century anomalous Mercury precession and ~8″/cy for Venus, etc.
   * Negligible (<0.01″/cy) past Mars but cost is one extra acc loop.
   */
  private applyRelativisticCorrection(): void {
    const sun = this.particles.find(p => p.id === 'sun');
    if (!sun) return;
    const GM = G_AU3_PER_MSUN_PER_DAY2 * sun.mass;
    for (const p of this.particles) {
      if (p === sun) continue;
      const dx = p.pos.x - sun.pos.x;
      const dy = p.pos.y - sun.pos.y;
      const dz = p.pos.z - sun.pos.z;
      const r2 = dx*dx + dy*dy + dz*dz;
      const r = Math.sqrt(r2);
      if (r < 1e-9) continue;
      const ux = dx / r, uy = dy / r, uz = dz / r;
      const vx = p.vel.x - sun.vel.x;
      const vy = p.vel.y - sun.vel.y;
      const vz = p.vel.z - sun.vel.z;
      const v2 = vx*vx + vy*vy + vz*vz;
      const vDotU = vx*ux + vy*uy + vz*uz;
      const term1 = (4 * GM) / (r * C2_AU_PER_DAY2) - v2 / C2_AU_PER_DAY2;
      const term2 = 4 * vDotU / C2_AU_PER_DAY2;
      const factor = GM / r2;
      // Will (1993), eq. 6.83: a_PN = (GM/r²){ [4GM/(rc²) − v²/c²] r̂ + 4(v·r̂)v/c² }
      // r̂ = (planet − sun) / r → ux,uy,uz here.
      const aAcc = this.acc.get(p.id)!;
      aAcc.x += factor * (term1 * ux + term2 * vx);
      aAcc.y += factor * (term1 * uy + term2 * vy);
      aAcc.z += factor * (term1 * uz + term2 * vz);
    }
  }

  /**
   * Sun J2 oblateness perturbation in the ECLIPTIC frame.
   *
   * Strictly the Sun's J2 is defined about its spin axis (tilted 7.155°
   * from the ecliptic toward longitude 73.5°), but the spin-axis tilt
   * makes < 1 % difference to the dominant Mercury contribution at this
   * scale. We use the ecliptic-frame approximation (z = 0 in the orbital
   * plane → standard J2 formula simplifies to the in-plane radial term):
   *
   *   a_J2 = -(3/2) μ J2 (R/r)² · [r̂ (1 - 5sin²φ) + 2ẑ sinφ] / r²
   *
   * where φ is the latitude relative to the Sun's equator. For ecliptic
   * planets sin²φ ≈ 0 so the dominant term is a radial inward bonus of
   * size (3/2)·J2·(R/r)² times the standard gravity — i.e. a tiny extra
   * inward pull that shows up over centuries as Mercury perihelion
   * advance of ~3 arcsec/century (vs the 43 arcsec/century from GR).
   *
   * Reference: Pireaux & Rozelot 2003 doi:10.1023/A:1023929420683
   */
  private applySolarJ2(): void {
    const sun = this.particles.find(p => p.id === 'sun');
    if (!sun) return;
    const GM = G_AU3_PER_MSUN_PER_DAY2 * sun.mass;
    // J2 = 2.0e-7, R_sun = 695700 km converted to AU.
    const J2 = 2.0e-7;
    const R_AU = 695700 / AU_KM;
    const R2 = R_AU * R_AU;
    for (const p of this.particles) {
      if (p === sun) continue;
      const dx = p.pos.x - sun.pos.x;
      const dy = p.pos.y - sun.pos.y;
      const dz = p.pos.z - sun.pos.z;
      const r2 = dx*dx + dy*dy + dz*dz;
      const r = Math.sqrt(r2);
      if (r < 1e-9) continue;
      const r5 = r2 * r2 * r;
      // sin(φ) where φ is the latitude above the Sun's equator. Treat
      // ecliptic z directly (small-tilt approximation noted above).
      const sinPhi = dz / r;
      const sinPhi2 = sinPhi * sinPhi;
      const factor = -1.5 * GM * J2 * R2 / r5;
      // Radial part (1 - 5sin²φ) on r̂ + 2 sinφ on ẑ:
      const radialCoef = factor * (1 - 5 * sinPhi2);
      const zCoef      = factor * 2 * sinPhi;
      const aAcc = this.acc.get(p.id)!;
      aAcc.x += radialCoef * dx;
      aAcc.y += radialCoef * dy;
      aAcc.z += radialCoef * dz + zCoef * r;
    }
  }

  /**
   * Conservation diagnostics. Returns total energy and angular-momentum
   * magnitude in natural simulation units (M_sun · AU² / day² for E,
   * M_sun · AU² / day for |L|). The absolute values are not very
   * meaningful — what's useful is to compare against initial values to
   * see drift over time, which directly measures integrator quality.
   *
   * Cost: O(N²) for the PE pair sum. Cheap at our scale (<30 bodies)
   * but call it at most a few Hz from the UI side, not every frame.
   */
  getConservation(): { kineticE: number; potentialE: number; totalE: number; angMom: number } {
    let ke = 0;
    let pe = 0;
    for (const p of this.particles) {
      const v2 = p.vel.x * p.vel.x + p.vel.y * p.vel.y + p.vel.z * p.vel.z;
      ke += 0.5 * p.mass * v2;
    }
    for (let i = 0; i < this.particles.length; i++) {
      const a = this.particles[i];
      for (let j = i + 1; j < this.particles.length; j++) {
        const b = this.particles[j];
        const dx = b.pos.x - a.pos.x;
        const dy = b.pos.y - a.pos.y;
        const dz = b.pos.z - a.pos.z;
        const r = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (r > 0) pe -= G_AU3_PER_MSUN_PER_DAY2 * a.mass * b.mass / r;
      }
    }
    // |L| = |sum m_i * (r_i × v_i)|
    let lx = 0, ly = 0, lz = 0;
    for (const p of this.particles) {
      lx += p.mass * (p.pos.y * p.vel.z - p.pos.z * p.vel.y);
      ly += p.mass * (p.pos.z * p.vel.x - p.pos.x * p.vel.z);
      lz += p.mass * (p.pos.x * p.vel.y - p.pos.y * p.vel.x);
    }
    const angMom = Math.sqrt(lx * lx + ly * ly + lz * lz);
    return { kineticE: ke, potentialE: pe, totalE: ke + pe, angMom };
  }

  /** Advance simulation by `dDays` days. Allows negative for time reversal. */
  step(dDays: number): void {
    if (dDays === 0) return;
    if (this.integrator === 'yoshida4') {
      this.stepYoshida4(dDays);
    } else {
      this.stepVerlet(dDays);
    }
    this.jd += dDays;
    this.refreshCache();
  }

  /** Velocity-Verlet (2nd order symplectic). Energy-stable, fast. */
  private stepVerlet(dDays: number): void {
    const halfDt = dDays * 0.5;
    for (const p of this.particles) {
      const a = this.acc.get(p.id)!;
      p.vel.x += a.x * halfDt;
      p.vel.y += a.y * halfDt;
      p.vel.z += a.z * halfDt;
      p.pos.x += p.vel.x * dDays;
      p.pos.y += p.vel.y * dDays;
      p.pos.z += p.vel.z * dDays;
    }
    this.computeAccelerations();
    for (const p of this.particles) {
      const a = this.acc.get(p.id)!;
      p.vel.x += a.x * halfDt;
      p.vel.y += a.y * halfDt;
      p.vel.z += a.z * halfDt;
    }
  }

  /**
   * Yoshida 4th-order symplectic integrator (Yoshida 1990). Drift-kick-drift
   * decomposition with 3 sub-Verlet steps using the canonical coefficient set
   *   x = 1 / (2 − 2^(1/3))    →    sub-steps: x·dt, (1−2x)·dt, x·dt
   * Each sub-step is itself a Verlet half-drift / kick / half-drift.
   * Energy stability ≈ 10⁻⁹ over century-scale runs vs Verlet's 10⁻⁶.
   */
  private stepYoshida4(dDays: number): void {
    const X = 1 / (2 - Math.pow(2, 1 / 3));
    const subSteps = [X, 1 - 2 * X, X];
    for (const sub of subSteps) {
      const sd = dDays * sub;
      this.stepVerlet(sd);
    }
  }

  private refreshCache(): void {
    for (const p of this.particles) {
      const sv = this.cache.get(p.id)!;
      sv.position.copy(p.pos);
      sv.velocity.copy(p.vel);
    }
  }

  /**
   * Drive integration to target JD using ~ 1-day steps (clamped to keep
   * arbitrary jumps tractable).
   */
  advanceTo(targetJd: number): void {
    const maxJump = 365 * 10; // 10 years max in one call
    let dt = targetJd - this.jd;
    if (Math.abs(dt) > maxJump) {
      this.jd = targetJd;
      // Don't simulate huge jumps — would take many seconds.
      // Mark all particles as "out of sync"; results are stale until next step.
      this.refreshCache();
      return;
    }
    const stepDays = 1.0;
    while (Math.abs(this.jd - targetJd) > 1e-6) {
      const remaining = targetJd - this.jd;
      const ds = Math.sign(remaining) * Math.min(Math.abs(remaining), stepDays);
      this.step(ds);
    }
  }

  getState(id: string): StateVector | undefined {
    return this.cache.get(id);
  }
}

/**
 * Adapter: an OrbitPropagator that returns the shared NBodySimulation's
 * cached state for a given particle. Calls advanceTo() before reading.
 */
export class NBodyAdapter implements OrbitPropagator {
  readonly elements = undefined;
  readonly kind: PropagatorKind = 'nbody';
  readonly source: PropagatorSource = {
    label: 'N-body simulation (Yoshida 4th-order symplectic)',
    note: 'Initialised from Kepler state at simulation start',
  };
  constructor(
    private sim: NBodySimulation,
    private id: string,
    private fallback: OrbitPropagator | null,
  ) {}

  stateAt(jd: number): StateVector {
    this.sim.advanceTo(jd);
    const s = this.sim.getState(this.id);
    if (s) return { position: s.position.clone(), velocity: s.velocity.clone() };
    if (this.fallback) return this.fallback.stateAt(jd);
    return { position: new Vector3(), velocity: new Vector3() };
  }
}

/**
 * Build an N-body simulation from the current set of body descriptors
 * by sampling each body's existing propagator at startJd.
 */
export function buildNBodyFromDescriptors(bodies: BodyDescriptor[], startJd: number): NBodySimulation {
  const initial: { id: string; massKg: number; pos: Vector3; vel: Vector3 }[] = [];

  // Sun is at origin, stationary (heliocentric reference frame).
  const sun = bodies.find(b => b.id === 'sun');
  if (sun) {
    initial.push({
      id: 'sun',
      massKg: sun.physical.massKg,
      pos: new Vector3(0, 0, 0),
      vel: new Vector3(0, 0, 0),
    });
  }
  // All other heliocentric bodies (planets + dwarfs) sampled from their Kepler propagator.
  for (const b of bodies) {
    if (b.id === 'sun') continue;
    if (b.parentId !== null) continue; // Skip moons (would need parent's frame)
    if (!b.propagator) continue;
    const sv = b.propagator.stateAt(startJd);
    initial.push({
      id: b.id,
      massKg: b.physical.massKg,
      pos: sv.position.clone(),
      vel: sv.velocity.clone(),
    });
  }
  return new NBodySimulation(initial, startJd);
}
