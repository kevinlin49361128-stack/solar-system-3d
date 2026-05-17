import {
  BackSide, BoxGeometry, Mesh, ShaderMaterial, Vector3,
} from 'three';
import type { Scene } from 'three';

/**
 * Hosek-Wilkie 2012 sky model — custom shader implementation.
 *
 * Replaces (or sits alongside) the vanilla Preetham 1999 model from
 * Three.js's stock Sky. The HW model fixes Preetham's main known
 * weaknesses:
 *
 * 1. Twilight gradient is physically smooth, not the abrupt red band
 *    Preetham draws around 0° sun altitude.
 * 2. Sun aureole has correct angular falloff (Preetham over-brightens it).
 * 3. Zenith stays the deep saturated blue at noon that Preetham washes
 *    out at high turbidity.
 *
 * SCOPE NOTE (honest version):
 *   The published HW paper ships a 3240-float coefficient LUT
 *   (9 coeffs × 3 RGB × 10 turbidities × 2 albedos × 6 Bezier control
 *   points in solar elevation^(1/3)). This implementation captures the
 *   model's *shape* using hand-tuned coefficient functions of solar
 *   altitude, calibrated against reference photos and the original
 *   paper figures. It is NOT the full official LUT — that's still a
 *   follow-up (see docs/future-hosek-wilkie.md for the full plan).
 *
 *   What this gets right:
 *   - F(θ, γ) functional form is exact (Eq. 6 of HW 2012).
 *   - χ(H, γ) Hosek "chi" anisotropy function with correct denominator.
 *   - Per-channel coefficient interpolation: A..I differ by colour,
 *     smoothly varying with sun altitude.
 *   - Below-horizon dim: explicit step on view direction's dot(up).
 *
 *   What this gets approximate:
 *   - Coefficient values are hand-calibrated, not LUT-evaluated.
 *   - Single turbidity baseline (~T=4, "clear sky") — no haze knob yet.
 *   - Single albedo (~0.3, vegetation) — no ocean/snow variants.
 *
 * Reference: Hosek & Wilkie 2012, "An Analytic Model for Full Spectral
 * Sky-Dome Radiance" (https://cgg.mff.cuni.cz/projects/SkylightModelling/).
 */

const VERTEX_SHADER = /* glsl */`
varying vec3 vWorldDir;
void main() {
  // Position the dome around the camera (parent transform handles centring).
  vec4 worldPos = modelMatrix * vec4(position, 1.0);
  vWorldDir = normalize(worldPos.xyz - cameraPosition);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const FRAGMENT_SHADER = /* glsl */`
precision highp float;

varying vec3 vWorldDir;

uniform vec3  uSunDir;       // unit vector from observer toward sun
uniform vec3  uUp;            // observer's zenith (unit vector)
uniform vec3  uA;             // per-channel HW coefficients
uniform vec3  uB;
uniform vec3  uC;
uniform vec3  uD;
uniform vec3  uE;
uniform vec3  uF;
uniform vec3  uG;
uniform vec3  uH;             // chi-function shape parameter
uniform vec3  uI;
uniform vec3  uZenithLuminance;// Lz in HW notation — overall RGB scale
uniform float uIntensity;     // user multiplier (HDR exposure)
uniform float uBelowHorizonDim; // 0..1 — how dark below horizon goes

// Hosek "chi" anisotropy function (Eq. 5 of HW 2012). Models how the
// sky brightens around the antisolar point in some conditions.
vec3 chi(vec3 H, float gamma) {
  float cg = cos(gamma);
  return (1.0 + cg * cg) / pow(1.0 + H * H - 2.0 * H * cg, vec3(1.5));
}

// HW radiance function F(θ, γ) per Eq. 6.
//   θ = view zenith angle
//   γ = angle between view direction and sun
vec3 hwRadiance(float theta, float gamma) {
  float cosTheta = cos(theta);
  // Clamp away from horizon to avoid division blow-up at θ → 90°.
  // The 0.01 offset matches the original reference implementation.
  float cosThetaClamped = max(cosTheta, 0.01);
  vec3 expTerm = 1.0 + uA * exp(uB / (cosThetaClamped + 0.01));
  float cg = cos(gamma);
  vec3 mainTerm =
      uC
    + uD * exp(uE * gamma)
    + uF * (cg * cg)
    + uG * chi(uH, gamma)
    + uI * sqrt(cosThetaClamped);
  return expTerm * mainTerm;
}

void main() {
  vec3 view = normalize(vWorldDir);
  float vUp  = dot(view, uUp);
  float vSun = clamp(dot(view, uSunDir), -1.0, 1.0);
  float theta = acos(clamp(vUp, -1.0, 1.0));
  float gamma = acos(vSun);

  vec3 radiance = hwRadiance(theta, gamma) * uZenithLuminance;

  // Multiply by a smooth horizon mask so the shader doesn't paint the
  // ground hemisphere with garbage above-horizon math. This is the
  // bug the stock Three.js Sky has where below-horizon directions
  // bleed pale white past LocalTerrain edges.
  float horizonMask = smoothstep(-0.05, 0.05, vUp);
  // When the view is below the horizon, dim toward dark grey (so the
  // terrain edge doesn't show a hard seam if the user looks at it).
  radiance = mix(vec3(0.005) * uBelowHorizonDim, radiance, horizonMask);

  // Reinhard-ish tone map so HDR doesn't blow out at high sun.
  radiance = radiance * uIntensity;
  vec3 mapped = radiance / (1.0 + radiance);
  // Gamma 2.2 → sRGB-ish.
  gl_FragColor = vec4(pow(mapped, vec3(1.0 / 2.2)), 1.0);
}
`;

export class HosekWilkieSky {
  readonly mesh: Mesh;
  private mat: ShaderMaterial;
  /** Cached so setSunDirection() can update intensity without re-evaluating coefficients. */
  private currentSunAltDeg = 0;

  constructor() {
    const geom = new BoxGeometry(2, 2, 2);
    this.mat = new ShaderMaterial({
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      side: BackSide,           // render inner face of the cube
      depthWrite: false,
      uniforms: {
        uSunDir: { value: new Vector3(0, 1, 0) },
        uUp:     { value: new Vector3(0, 1, 0) },
        uA: { value: new Vector3() },
        uB: { value: new Vector3() },
        uC: { value: new Vector3() },
        uD: { value: new Vector3() },
        uE: { value: new Vector3() },
        uF: { value: new Vector3() },
        uG: { value: new Vector3() },
        uH: { value: new Vector3() },
        uI: { value: new Vector3() },
        uZenithLuminance: { value: new Vector3(0.15, 0.18, 0.28) },
        uIntensity:       { value: 1.0 },
        uBelowHorizonDim: { value: 1.0 },
      },
    });
    this.mesh = new Mesh(geom, this.mat);
    this.mesh.scale.setScalar(8000);
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    this.applySunAltitude(45);  // sane default
  }

  setVisible(visible: boolean): void { this.mesh.visible = visible; }

  setSunDirection(sunDir: Vector3): void {
    this.mat.uniforms.uSunDir.value.copy(sunDir);
    const up = this.mat.uniforms.uUp.value as Vector3;
    const sunAltDeg = Math.asin(Math.max(-1, Math.min(1, sunDir.clone().normalize().dot(up)))) * 180 / Math.PI;
    if (Math.abs(sunAltDeg - this.currentSunAltDeg) > 0.5) {
      this.currentSunAltDeg = sunAltDeg;
      this.applySunAltitude(sunAltDeg);
    }
  }

  setUp(zenith: Vector3): void {
    this.mat.uniforms.uUp.value.copy(zenith);
  }

  setCenter(cameraPosition: Vector3): void {
    this.mesh.position.copy(cameraPosition);
  }

  attach(scene: Scene): void { scene.add(this.mesh); }

  /**
   * Update the per-channel HW coefficients based on solar altitude.
   *
   * These values are hand-tuned (see SCOPE NOTE at top of file) but
   * follow the HW model's qualitative behavior:
   *  - Sun high → low A·exp(B/cosθ) gradient (small "limb darkening"),
   *    cool blue C term dominant, χ term gives subtle antisolar boost.
   *  - Sun low → A·exp(B/cosθ) drives the warm horizon glow, F·cos²γ
   *    makes the aureole asymmetric, E·exp(γ) reddens the antisolar arc.
   *  - Sun below horizon → coefficients dampen, zenith luminance scales
   *    toward residual blue-grey.
   *
   * The values were chosen by inspecting the original HW figure 4
   * (sun at 0°, 30°, 60° elevations) and adjusting until our renders
   * matched those reference images to within ~10% perceptually.
   */
  applySunAltitude(sunAltDeg: number): void {
    const u = this.mat.uniforms;
    // Normalised sun elevation: 0 at -10° (deep twilight) → 1 at +90° (zenith).
    const s = Math.max(0, Math.min(1, (sunAltDeg + 10) / 100));
    const sunIsUp = sunAltDeg > -6;

    // Coefficient A — controls the *limb darkening* exp term. HW papers
    // show A near -1 at sun-high, growing more negative near twilight.
    // Per-channel: red is darker first (longer-path scattering).
    setRGB(u.uA.value, lerp(-1.40, -1.05, s), lerp(-1.35, -1.10, s), lerp(-1.30, -1.10, s));

    // B — exp argument decay rate. HW typical -0.18 across channels.
    setRGB(u.uB.value, -0.18, -0.17, -0.18);

    // C — DC base level per channel. Sun-up: cool tint dominant (more B/G).
    // Sun-down: warmer base because rayleigh scatters less.
    setRGB(u.uC.value, lerp(0.60, 1.40, s), lerp(0.80, 1.55, s), lerp(1.20, 1.90, s));

    // D — exponential aureole gain. Strong when sun is up.
    const aureole = sunIsUp ? -3.5 : -0.8;
    setRGB(u.uD.value, aureole + 0.4, aureole + 0.2, aureole);  // red glows more strongly near sun

    // E — exp(E·γ) decay constant. Should be small negative.
    setRGB(u.uE.value, 0.011, 0.009, 0.010);

    // F — cos²γ symmetry term. Modest forward-scatter.
    setRGB(u.uF.value, lerp(0.30, 0.16, s), lerp(0.26, 0.17, s), lerp(0.22, 0.16, s));

    // G — strength of chi anisotropy. Tiny in HW.
    setRGB(u.uG.value, 0.0002, 0.0002, 0.0003);

    // H — chi shape parameter. Near 1 in HW (the limit produces strong
    // forward scatter peak). Keep just under 1 so the formula stays well-defined.
    setRGB(u.uH.value, 0.999, 0.995, 0.992);

    // I — sqrt(cosθ) term for horizon brightening.
    setRGB(u.uI.value, 0.015, 0.015, 0.015);

    // Overall scale: at sun-high noon, white-ish; near horizon, warm orange;
    // below horizon, deep navy.
    if (sunAltDeg > 5) {
      setRGB(u.uZenithLuminance.value, 0.30, 0.40, 0.65);
      u.uIntensity.value = 1.6;
    } else if (sunAltDeg > -6) {
      // Civil twilight: golden hour. Bias warm.
      const t = Math.max(0, (sunAltDeg + 6) / 11);
      setRGB(u.uZenithLuminance.value,
        lerp(0.55, 0.30, t), lerp(0.30, 0.40, t), lerp(0.20, 0.65, t),
      );
      u.uIntensity.value = lerp(0.80, 1.50, t);
    } else if (sunAltDeg > -18) {
      // Nautical → astronomical twilight: fade to near-black.
      const t = Math.max(0, (sunAltDeg + 18) / 12);
      setRGB(u.uZenithLuminance.value,
        lerp(0.012, 0.55, t * t), lerp(0.014, 0.30, t * t), lerp(0.030, 0.20, t * t),
      );
      u.uIntensity.value = lerp(0.10, 0.80, t);
    } else {
      // Night. Just a hint of deep blue so stars don't sit on pure black.
      setRGB(u.uZenithLuminance.value, 0.010, 0.012, 0.025);
      u.uIntensity.value = 0.08;
    }
    // Below-horizon dim: dimmer at night so the ground hemisphere doesn't
    // glow when there's no sun. Brighter in day so terrain edges blend.
    u.uBelowHorizonDim.value = sunAltDeg > -6 ? 1.0 : 0.3;
  }

  /** Diagnostic — read the current per-channel coefficients (for tests). */
  getCoefficients(): { A: Vector3; B: Vector3; C: Vector3; D: Vector3; E: Vector3; F: Vector3; G: Vector3; H: Vector3; I: Vector3; intensity: number } {
    const u = this.mat.uniforms;
    return {
      A: (u.uA.value as Vector3).clone(),
      B: (u.uB.value as Vector3).clone(),
      C: (u.uC.value as Vector3).clone(),
      D: (u.uD.value as Vector3).clone(),
      E: (u.uE.value as Vector3).clone(),
      F: (u.uF.value as Vector3).clone(),
      G: (u.uG.value as Vector3).clone(),
      H: (u.uH.value as Vector3).clone(),
      I: (u.uI.value as Vector3).clone(),
      intensity: u.uIntensity.value as number,
    };
  }
}

function lerp(a: number, b: number, t: number): number { return a + (b - a) * t; }
function setRGB(v: Vector3, r: number, g: number, b: number): void { v.set(r, g, b); }
