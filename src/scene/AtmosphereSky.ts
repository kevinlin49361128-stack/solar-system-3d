import { Vector3 } from 'three';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import type { Scene } from 'three';

/**
 * Wraps Three.js's Sky (Preetham/Hosek-Wilkie atmospheric scattering shader)
 * for use as the observer-mode sky background.
 *
 * The shader produces accurate-looking sky colors based on sun position:
 *  - Daytime: deep blue zenith, white-yellow horizon, warm near-sun glow
 *  - Twilight: orange/red near horizon, purple opposite, navy zenith
 *  - Night: near-black (real stars show through)
 */
export class AtmosphereSky {
  readonly sky: Sky;
  private sunPos = new Vector3();

  constructor() {
    this.sky = new Sky();
    this.sky.scale.setScalar(8000);
    this.sky.visible = false;

    const u = this.sky.material.uniforms;
    u['turbidity'].value = 6;        // 1–20: haze; 6 ≈ clear day
    u['rayleigh'].value = 2.5;       // 0–4: blue-scattering strength
    u['mieCoefficient'].value = 0.005;
    u['mieDirectionalG'].value = 0.7;

    // Note: Three.js Sky.js renders below-horizon directions with the same
    // "horizon-bright" pale white colour as the actual horizon (because
    // `max(0, dot(up, direction))` clamps below-horizon zenithAngle to 90°).
    // In observer mode this leaks white past the LocalTerrain mesh edge.
    // We tried an early-out shader patch but the visible result on London
    // 0 m showed the patch firing on the wrong half of the cube — likely
    // because Three's Sky writes `gl_Position.z = gl_Position.w` which
    // breaks the relationship between vWorldPosition and what the camera
    // actually renders. Punted: see docs/known-issues for follow-up.
  }

  /**
   * Tune Preetham parameters as a function of sun altitude. Real Hosek-Wilkie
   * rendering would handle this implicitly via its CIE-fit polynomial — we
   * approximate here by lowering turbidity + boosting rayleigh near the
   * horizon, which softens the twilight band that vanilla Preetham draws too
   * abruptly. Cheap fix until full Hosek-Wilkie integration (deferred — see
   * docs/future-hosek-wilkie.md).
   */
  applyTwilightTuning(sunAltDeg: number): void {
    const u = this.sky.material.uniforms;
    if (sunAltDeg > 10) {
      // Plain daylight — reset to defaults.
      u['turbidity'].value = 6;
      u['rayleigh'].value = 2.5;
    } else if (sunAltDeg > -6) {
      // Civil twilight: blend between day and dusk.
      const t = Math.max(0, (sunAltDeg + 6) / 16); // 0 at -6°, 1 at +10°
      u['turbidity'].value = 3 + 3 * t;
      u['rayleigh'].value = 3.5 - 1.0 * t;
    } else {
      // Nautical / astronomical twilight & night — let stars show through.
      u['turbidity'].value = 2.5;
      u['rayleigh'].value = 1.5;
    }
  }

  setVisible(visible: boolean): void {
    this.sky.visible = visible;
  }

  /**
   * Update sun direction. `sunDirection` should be a unit vector in scene
   * frame, pointing FROM the observer TOWARD the sun.
   */
  setSunDirection(sunDirection: Vector3): void {
    this.sunPos.copy(sunDirection).multiplyScalar(1);
    this.sky.material.uniforms['sunPosition'].value.copy(this.sunPos);
  }

  /** Position the sky dome around the camera so the user is always inside it. */
  setCenter(cameraPosition: Vector3): void {
    this.sky.position.copy(cameraPosition);
  }

  /**
   * Tell the shader which direction is "up" (the observer's zenith) so the
   * scattering math computes against the observer's actual horizon. Without
   * this, the shader assumes world +Y is up and produces a sharp seam where
   * its assumed horizon crosses the real horizon.
   */
  setUp(zenith: Vector3): void {
    this.sky.material.uniforms['up'].value.copy(zenith);
  }

  attach(scene: Scene): void {
    scene.add(this.sky);
  }

  // Stubs filled in by AtmosphereOverlay; see SolarSystem wiring.
  private beltEnabled = false;
  private airglowEnabled = false;
  setBeltOfVenusEnabled(enabled: boolean): void { this.beltEnabled = enabled; }
  setAirglowEnabled(enabled: boolean): void { this.airglowEnabled = enabled; }
  isBeltOfVenusEnabled(): boolean { return this.beltEnabled; }
  isAirglowEnabled(): boolean { return this.airglowEnabled; }
}
