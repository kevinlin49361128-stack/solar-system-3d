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

// Hosek "chi" anisotropy function (Eq. 5 of HW 2012). Diverges as
// γ→0 when H is near 1 (the canonical solar-disc-aureole behaviour);
// we cap the denominator at 1e-3 so the function stays bounded — the
// sky shader's job is to render the AUREOLE, not the solar disc
// itself (the disc comes from the separate Sun mesh).
vec3 chi(vec3 H, float gamma) {
  float cg = cos(gamma);
  vec3 denom = max(vec3(1e-3), 1.0 + H * H - 2.0 * H * cg);
  return (1.0 + cg * cg) / pow(denom, vec3(1.5));
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

  // HW's main-term polynomial can go negative for some coefficient
  // sets at large γ — that's normal in the formal model (it just means
  // "zero scattered radiance from this direction"). Clamp to ≥0 so a
  // sign-flip doesn't leak through the tone map as black holes.
  vec3 radiance = max(vec3(0.0), hwRadiance(theta, gamma)) * uZenithLuminance;

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
   * Daytime baseline values come from the published HW 2012 paper
   * Table 1 reference set (T=4 "clear sky", sun near zenith, albedo
   * ≈ 0.3). These produce mathematically well-behaved radiance —
   * D ≈ -1.4 (not -3.5 like the hand-tuned values that came before,
   * which made the main-term go negative across most of the sky and
   * created the "huge yellow-green blob" daytime bug).
   *
   * Twilight + night transitions interpolate the daytime values
   * toward dimmer / warmer settings; this isn't part of the formal
   * HW model (which solves for fixed sun elevations) but gives a
   * smooth visual transition. Full LUT-based interpolation across
   * solar elevation^(1/3) is still future work — see
   * docs/future-hosek-wilkie.md.
   */
  applySunAltitude(sunAltDeg: number): void {
    const u = this.mat.uniforms;

    // --- Two-point HW elevation interpolation (T=4 clear-sky, albedo≈0.3) ----
    //
    // The full HW model evaluates each A..I coefficient as a quintic
    // Bezier in solar-elevation^(1/3) using 6 control points per (turbidity,
    // albedo, channel, coefficient). We approximate that with a linear
    // interpolation between two endpoint sets:
    //
    //   sun-high (Table 1, sun near zenith) — what shipped previously
    //   sun-low  (HW paper figure 4, sun near horizon)
    //
    // Captures the qualitative variation across the day — at sunrise the
    // limb-darkening A coefficient is more negative, the aureole gain D
    // is larger in magnitude, and the cos²γ term F is bigger (forward
    // scatter dominates). Quintic Bezier interp is the obvious follow-up
    // if anyone wants closer-to-spec output.
    const highA = [-1.06, -1.09, -1.04];
    const highB = [-0.17, -0.16, -0.18];
    const highC = [ 1.65,  1.71,  1.74];
    const highD = [-1.40, -1.43, -1.49];
    const highE = [ 0.045, 0.034, 0.043];
    const highF = [ 0.071, 0.078, 0.060];
    const highG = [ 0.0002, 0.0001, 0.0002];
    const highH = [ 0.999, 0.998, 0.997];
    const highI = [ 0.020, 0.020, 0.022];
    // Hand-fit "sun near horizon" coefficients matching HW paper figure 4
    // golden-hour appearance. Most channels shift toward the more
    // negative A (deeper limb darkening) and larger F (more forward
    // scattering toward the warm-glow horizon).
    const lowA  = [-1.30, -1.20, -1.08];
    const lowB  = [-0.18, -0.17, -0.18];
    const lowC  = [ 1.95,  1.70,  1.10];   // C drops on blue → warm bias
    const lowD  = [-2.20, -2.10, -2.40];   // bigger aureole at sunset
    const lowE  = [ 0.050, 0.040, 0.045];
    const lowF  = [ 0.220, 0.150, 0.110];  // stronger forward scatter
    const lowG  = [ 0.0002, 0.0001, 0.0002];
    const lowH  = [ 0.998, 0.997, 0.996];
    const lowI  = [ 0.030, 0.025, 0.022];

    // Interpolation parameter: 0 at sun on horizon, 1 at sun at zenith.
    // HW recommends elevation^(1/3) for smoother visual transition.
    const sunAltRad = Math.max(0, sunAltDeg) * Math.PI / 180;
    const t = Math.pow(sunAltRad / (Math.PI / 2), 1 / 3);  // 0..1
    const interp = (lo: number[], hi: number[], i: number) => lo[i] + (hi[i] - lo[i]) * t;
    setRGB(u.uA.value, interp(lowA, highA, 0), interp(lowA, highA, 1), interp(lowA, highA, 2));
    setRGB(u.uB.value, interp(lowB, highB, 0), interp(lowB, highB, 1), interp(lowB, highB, 2));
    setRGB(u.uC.value, interp(lowC, highC, 0), interp(lowC, highC, 1), interp(lowC, highC, 2));
    setRGB(u.uD.value, interp(lowD, highD, 0), interp(lowD, highD, 1), interp(lowD, highD, 2));
    setRGB(u.uE.value, interp(lowE, highE, 0), interp(lowE, highE, 1), interp(lowE, highE, 2));
    setRGB(u.uF.value, interp(lowF, highF, 0), interp(lowF, highF, 1), interp(lowF, highF, 2));
    setRGB(u.uG.value, interp(lowG, highG, 0), interp(lowG, highG, 1), interp(lowG, highG, 2));
    setRGB(u.uH.value, interp(lowH, highH, 0), interp(lowH, highH, 1), interp(lowH, highH, 2));
    setRGB(u.uI.value, interp(lowI, highI, 0), interp(lowI, highI, 1), interp(lowI, highI, 2));

    // --- Zenith luminance + overall intensity by sun altitude --------
    // At noon, sky is brightest blue. Near sunset, biased warm. After
    // astronomical twilight, fades to dark with a hint of blue so the
    // starfield doesn't sit on pure black.
    if (sunAltDeg > 5) {
      setRGB(u.uZenithLuminance.value, 0.18, 0.22, 0.45);
      u.uIntensity.value = 0.65;
    } else if (sunAltDeg > -6) {
      // Civil twilight: blend day → golden hour over a 11° window.
      const t = Math.max(0, (sunAltDeg + 6) / 11);
      setRGB(u.uZenithLuminance.value,
        lerp(0.40, 0.18, t),   // R fades from warm
        lerp(0.22, 0.22, t),
        lerp(0.10, 0.45, t),   // B grows toward blue noon
      );
      u.uIntensity.value = lerp(0.45, 0.65, t);
    } else if (sunAltDeg > -18) {
      // Nautical → astronomical twilight: fade to near-black.
      const t = Math.max(0, (sunAltDeg + 18) / 12);
      setRGB(u.uZenithLuminance.value,
        lerp(0.010, 0.40, t * t),
        lerp(0.012, 0.22, t * t),
        lerp(0.025, 0.10, t * t),
      );
      u.uIntensity.value = lerp(0.08, 0.45, t);
    } else {
      // Night. Just a hint of deep blue so stars don't sit on pure black.
      setRGB(u.uZenithLuminance.value, 0.008, 0.010, 0.022);
      u.uIntensity.value = 0.06;
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
