import {
  HalfFloatType,
  LinearFilter,
  Mesh,
  NoColorSpace,
  OrthographicCamera,
  PlaneGeometry,
  RGBAFormat,
  RawShaderMaterial,
  Scene,
  Texture,
  WebGLRenderer,
  WebGLRenderTarget,
} from 'three';

/**
 * Simulated long-exposure renderer for observer mode.
 *
 * Approach: ping-pong accumulator. Each frame:
 *   1. Render the live scene to renderTarget A (fresh frame).
 *   2. Compose accumulator: out = max(prevAccum * decay, currFrame).
 *      Max-blend keeps the brightest value ever seen at each pixel —
 *      perfect for star trails (bright stars saturate; faint background
 *      decays away).
 *   3. Display the accumulator to the canvas.
 *
 * Two modes derive from the same machinery; the difference is purely in
 * camera behaviour, which the compositor doesn't care about:
 *   - "Tracking long exposure": camera follows a body via setObserverFollow
 *     → body stays fixed in frame, sky streaks past.
 *   - "Stationary long exposure": camera azimuth/altitude unchanged →
 *     stars curve in arcs centred on the celestial pole.
 *
 * Buffer format: RGBA half-float (HDR-friendly), so very faint stars can
 * accumulate over many frames without clipping at 1.0 like an LDR
 * accumulator would. Half-float is widely supported on iOS / WebGL2.
 */
export class LongExposureCompositor {
  private renderer: WebGLRenderer;
  private rtScene: WebGLRenderTarget;        // RT A — live scene (this frame)
  private rtAccumA: WebGLRenderTarget;       // ping
  private rtAccumB: WebGLRenderTarget;       // pong
  private currentAccum: WebGLRenderTarget;
  private prevAccum: WebGLRenderTarget;
  private blendScene: Scene;
  private blendQuad: Mesh<PlaneGeometry, RawShaderMaterial>;
  private displayScene: Scene;
  private displayQuad: Mesh<PlaneGeometry, RawShaderMaterial>;
  private fullCam: OrthographicCamera;
  private enabled = false;
  private needsReset = true;
  /** Decay factor per frame. 1.0 = infinite exposure (no fade). 0.99 fades out in ~100 frames. */
  private decay = 1.0;
  private width = 1;
  private height = 1;

  constructor(renderer: WebGLRenderer) {
    this.renderer = renderer;
    const w = renderer.domElement.clientWidth || 1;
    const h = renderer.domElement.clientHeight || 1;
    this.width = w; this.height = h;

    const rtOpts = {
      type: HalfFloatType,
      format: RGBAFormat,
      minFilter: LinearFilter,
      magFilter: LinearFilter,
      colorSpace: NoColorSpace,
      depthBuffer: true,    // need depth for live scene render
      stencilBuffer: false,
    };
    this.rtScene = new WebGLRenderTarget(w, h, rtOpts);
    this.rtAccumA = new WebGLRenderTarget(w, h, { ...rtOpts, depthBuffer: false });
    this.rtAccumB = new WebGLRenderTarget(w, h, { ...rtOpts, depthBuffer: false });
    this.currentAccum = this.rtAccumA;
    this.prevAccum = this.rtAccumB;

    this.fullCam = new OrthographicCamera(-1, 1, 1, -1, 0, 1);

    // Blend shader: max(prev * decay, curr) per channel.
    // (GLSL1 by default — three r18x warns if glslVersion is passed as
    // an explicit undefined, so the key is simply omitted.)
    const blendMat = new RawShaderMaterial({
      uniforms: {
        uPrev: { value: null as Texture | null },
        uCurr: { value: null as Texture | null },
        uDecay: { value: 1.0 },
        uResetWeight: { value: 0.0 }, // 0 = blend with prev; 1 = ignore prev
      },
      vertexShader: `
        attribute vec2 position;
        varying vec2 vUv;
        void main() {
          vUv = position * 0.5 + 0.5;
          gl_Position = vec4(position, 0.0, 1.0);
        }
      `,
      fragmentShader: `
        precision highp float;
        varying vec2 vUv;
        uniform sampler2D uPrev;
        uniform sampler2D uCurr;
        uniform float uDecay;
        uniform float uResetWeight;
        void main() {
          vec4 prev = texture2D(uPrev, vUv);
          vec4 curr = texture2D(uCurr, vUv);
          // Decay then max-blend with current. uResetWeight = 1 forces
          // the accumulator to reinitialise from the current frame only.
          vec3 prevDecayed = prev.rgb * uDecay * (1.0 - uResetWeight);
          vec3 outRgb = max(prevDecayed, curr.rgb);
          gl_FragColor = vec4(outRgb, 1.0);
        }
      `,
      depthTest: false,
      depthWrite: false,
    });
    const quadGeom = new PlaneGeometry(2, 2);
    this.blendQuad = new Mesh(quadGeom, blendMat);
    this.blendScene = new Scene();
    this.blendScene.add(this.blendQuad);

    // Display shader: copy accumulator to canvas with sRGB output. We
    // re-encode here because the accumulator stores linear RGB to allow
    // additive blending without gamma weirdness.
    const displayMat = new RawShaderMaterial({
      uniforms: { uAccum: { value: null as Texture | null } },
      vertexShader: `
        attribute vec2 position;
        varying vec2 vUv;
        void main() {
          vUv = position * 0.5 + 0.5;
          gl_Position = vec4(position, 0.0, 1.0);
        }
      `,
      fragmentShader: `
        precision highp float;
        varying vec2 vUv;
        uniform sampler2D uAccum;
        void main() {
          vec3 c = texture2D(uAccum, vUv).rgb;
          // Linear → sRGB approximation (sufficient for this preview).
          vec3 srgb = pow(max(c, vec3(0.0)), vec3(1.0 / 2.2));
          gl_FragColor = vec4(srgb, 1.0);
        }
      `,
      depthTest: false,
      depthWrite: false,
    });
    this.displayQuad = new Mesh(quadGeom.clone(), displayMat);
    this.displayScene = new Scene();
    this.displayScene.add(this.displayQuad);
  }

  setEnabled(v: boolean): void {
    if (this.enabled === v) return;
    this.enabled = v;
    if (v) this.needsReset = true;
  }

  isEnabled(): boolean { return this.enabled; }

  /** Decay per frame ∈ (0, 1]. 1 = no decay (perfect star trails). 0.97
   *  ≈ ~100-frame trail length. */
  setDecay(d: number): void {
    this.decay = Math.max(0, Math.min(1, d));
  }

  /** Discard the accumulator and start fresh on next frame. */
  reset(): void {
    this.needsReset = true;
  }

  /** Resize backing render targets to match the renderer canvas. */
  resize(width: number, height: number): void {
    if (width === this.width && height === this.height) return;
    this.width = width; this.height = height;
    this.rtScene.setSize(width, height);
    this.rtAccumA.setSize(width, height);
    this.rtAccumB.setSize(width, height);
    this.needsReset = true;
  }

  /**
   * Render `scene` with `camera` and composite into the long-exposure
   * accumulator. Replaces the direct `renderer.render(scene, camera)`
   * call when the compositor is enabled.
   */
  composite(scene: Scene, camera: import('three').Camera): void {
    // Live frame → rtScene.
    const prevTarget = this.renderer.getRenderTarget();
    this.renderer.setRenderTarget(this.rtScene);
    this.renderer.clear(true, true, true);
    this.renderer.render(scene, camera);

    // Blend rtScene with previous accumulator → currentAccum.
    const blendMat = this.blendQuad.material;
    blendMat.uniforms.uPrev.value = this.prevAccum.texture;
    blendMat.uniforms.uCurr.value = this.rtScene.texture;
    blendMat.uniforms.uDecay.value = this.decay;
    blendMat.uniforms.uResetWeight.value = this.needsReset ? 1.0 : 0.0;
    this.needsReset = false;
    this.renderer.setRenderTarget(this.currentAccum);
    this.renderer.clear(true, false, false);
    this.renderer.render(this.blendScene, this.fullCam);

    // Display currentAccum to canvas.
    this.renderer.setRenderTarget(prevTarget);
    const displayMat = this.displayQuad.material;
    displayMat.uniforms.uAccum.value = this.currentAccum.texture;
    this.renderer.clear(true, false, false);
    this.renderer.render(this.displayScene, this.fullCam);

    // Swap ping-pong for next frame.
    const tmp = this.currentAccum;
    this.currentAccum = this.prevAccum;
    this.prevAccum = tmp;
  }

  dispose(): void {
    this.rtScene.dispose();
    this.rtAccumA.dispose();
    this.rtAccumB.dispose();
    this.blendQuad.geometry.dispose();
    this.blendQuad.material.dispose();
    this.displayQuad.geometry.dispose();
    this.displayQuad.material.dispose();
  }
}
