import { Vector3 } from 'three';

/**
 * Three nested distance scales the camera can sit at.
 *
 * - **system**: sun at origin, planets at AU scale. ≤ ~50 scene units away.
 *   This is the only tier where solar-system meshes are usefully visible.
 * - **neighbourhood**: zoomed out so the local stellar neighbourhood
 *   (~50 light-years) fills the view. HYG point cloud + named exoplanet
 *   host halos turn on; the solar system shrinks to a faint dot.
 * - **galactic**: zoomed even further so the 3D Milky Way disk model
 *   (~50,000 ly diameter) fills the view. Spiral arms + central bar
 *   visible; HYG cloud fades to a thin shell near origin.
 *
 * Tier transitions are smooth ease-in-out cubic ramps over 4 s by default.
 * The user can interrupt mid-flight by calling `setTier` again with a new
 * target — the animation re-parameterises from the current interpolated
 * state, so there's no jarring snap.
 */
export type ScaleTier = 'system' | 'neighbourhood' | 'galactic';

/**
 * The scalar / vector quantities each tier needs the rest of the renderer
 * to know about. Smoothly interpolated during transitions; layers read the
 * current value each frame and render accordingly.
 */
export interface TierState {
  cameraDistance: number;   // scene units from origin
  cameraFov: number;        // degrees
  layerWeights: {
    solarSystem: number;    // 0..1, fades planets/asteroids/spacecraft
    hygCloud: number;       // 0..1, fades HYG 3D point cloud
    milkyWayDisk: number;   // 0..1, fades the 3D MW disk model
    milkyWaySky: number;    // 0..1, fades the inside-view ESO photo dome
                            // (the existing observer-mode "sky band")
  };
}

const TIER_TARGET: Record<ScaleTier, TierState> = {
  system: {
    cameraDistance: 14,
    cameraFov: 50,
    layerWeights: { solarSystem: 1, hygCloud: 0, milkyWayDisk: 0, milkyWaySky: 0.0 },
  },
  neighbourhood: {
    cameraDistance: 80,    // 80 ly equivalent (after HYG layer's own scale)
    cameraFov: 60,
    layerWeights: { solarSystem: 0.15, hygCloud: 1, milkyWayDisk: 0.35, milkyWaySky: 0.0 },
  },
  galactic: {
    cameraDistance: 60_000,
    cameraFov: 75,
    layerWeights: { solarSystem: 0, hygCloud: 0.25, milkyWayDisk: 1, milkyWaySky: 0.0 },
  },
};

const DEFAULT_DURATION_SEC = 4.0;

/**
 * Ease-in-out cubic. t ∈ [0, 1].
 *  t=0   → 0
 *  t=0.5 → 0.5 (with zero acceleration here)
 *  t=1   → 1
 */
function easeInOutCubic(t: number): number {
  if (t < 0.5) return 4 * t * t * t;
  const f = -2 * t + 2;
  return 1 - (f * f * f) / 2;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpState(a: TierState, b: TierState, t: number): TierState {
  return {
    // Distance is geometric — 14 → 60_000 spans 3+ decades. Linearly
    // interpolating that would spend 90% of the animation cruising between
    // 30,000 and 60,000 with a snap at the end. Use logarithmic interp.
    cameraDistance: Math.exp(lerp(Math.log(a.cameraDistance), Math.log(b.cameraDistance), t)),
    cameraFov: lerp(a.cameraFov, b.cameraFov, t),
    layerWeights: {
      solarSystem: lerp(a.layerWeights.solarSystem, b.layerWeights.solarSystem, t),
      hygCloud:    lerp(a.layerWeights.hygCloud,    b.layerWeights.hygCloud,    t),
      milkyWayDisk:lerp(a.layerWeights.milkyWayDisk,b.layerWeights.milkyWayDisk,t),
      milkyWaySky: lerp(a.layerWeights.milkyWaySky, b.layerWeights.milkyWaySky, t),
    },
  };
}

export class ScaleTierController {
  private currentTier: ScaleTier = 'system';
  private targetTier: ScaleTier = 'system';
  private currentState: TierState = TIER_TARGET.system;
  private animation: {
    startTime: number;
    duration: number;
    from: TierState;
    to: TierState;
  } | null = null;
  private listeners = new Set<(s: TierState) => void>();

  /** Camera direction unit vector (preserved during dolly). */
  private cameraDirection = new Vector3(0, 0.4, 1).normalize();

  /**
   * Animate to a target tier. Calling again mid-animation reparameterises
   * from the current interpolated state (no snap).
   */
  setTier(target: ScaleTier, durationSec: number = DEFAULT_DURATION_SEC): void {
    if (this.targetTier === target && this.animation === null) return;
    this.animation = {
      startTime: performance.now(),
      duration: durationSec * 1000,
      from: { ...this.currentState, layerWeights: { ...this.currentState.layerWeights } },
      to: TIER_TARGET[target],
    };
    this.targetTier = target;
  }

  /**
   * Snap immediately to a tier without animation. Used for camera-mode
   * resets (e.g. observer-mode entry forces system tier instantly).
   */
  snapTo(tier: ScaleTier): void {
    this.currentTier = tier;
    this.targetTier = tier;
    this.currentState = { ...TIER_TARGET[tier], layerWeights: { ...TIER_TARGET[tier].layerWeights } };
    this.animation = null;
    this.notify();
  }

  /**
   * Capture the current camera direction (unit vector from origin to camera)
   * so future tier transitions preserve the user's view angle. Should be
   * called when the user finishes manually dragging the OrbitControls.
   */
  setCameraDirection(dir: Vector3): void {
    if (dir.lengthSq() === 0) return;
    this.cameraDirection.copy(dir).normalize();
  }

  /** The currently-pointing camera direction unit vector. */
  getCameraDirection(): Vector3 {
    return this.cameraDirection.clone();
  }

  /**
   * Per-frame update. Returns the current interpolated state. Call once per
   * render cycle; the returned state is also pushed to subscribers if it
   * changed materially since last frame.
   */
  update(now: number = performance.now()): TierState {
    if (this.animation) {
      const elapsed = now - this.animation.startTime;
      const t = Math.min(1, elapsed / this.animation.duration);
      const eased = easeInOutCubic(t);
      this.currentState = lerpState(this.animation.from, this.animation.to, eased);
      if (t >= 1) {
        this.currentTier = this.targetTier;
        this.currentState = TIER_TARGET[this.targetTier];
        this.animation = null;
      }
      this.notify();
    }
    return this.currentState;
  }

  /** Settled tier (the one we're at, ignoring any in-progress animation). */
  getTier(): ScaleTier { return this.currentTier; }
  /** The tier we're animating toward (equals current tier when settled). */
  getTargetTier(): ScaleTier { return this.targetTier; }
  /** Whether a transition is currently animating. */
  isAnimating(): boolean { return this.animation !== null; }

  /**
   * Convenience: cycle to the "next further out" tier. system → neighbourhood
   * → galactic → galactic (clamped). Used by the main toolbar button.
   */
  zoomOut(): void {
    const next: Record<ScaleTier, ScaleTier> = {
      system: 'neighbourhood',
      neighbourhood: 'galactic',
      galactic: 'galactic',
    };
    this.setTier(next[this.targetTier]);
  }

  /** Inverse: galactic → neighbourhood → system → system (clamped). */
  zoomIn(): void {
    const prev: Record<ScaleTier, ScaleTier> = {
      galactic: 'neighbourhood',
      neighbourhood: 'system',
      system: 'system',
    };
    this.setTier(prev[this.targetTier]);
  }

  /** Snap home to system tier without animation. Used by 'H' shortcut. */
  home(): void {
    this.setTier('system', 2.5);
  }

  /** Subscribe to state changes (e.g. a UI status badge). */
  subscribe(fn: (s: TierState) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private notify(): void {
    for (const fn of this.listeners) fn(this.currentState);
  }
}
