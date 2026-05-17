import {
  Mesh,
  MeshStandardMaterial,
  MeshBasicMaterial,
  SphereGeometry,
  Group,
  Sprite,
  SpriteMaterial,
  CanvasTexture,
  Color,
  Vector3,
  RingGeometry,
  DoubleSide,
  BackSide,
  TextureLoader,
  SRGBColorSpace,
  ShaderMaterial,
  AdditiveBlending,
} from 'three';
import type { BodyDescriptor } from '../physics/types';
import { DEG2RAD } from '../physics/constants';
import { TextureConfig } from './textureConfig';
import { bodyName, onLanguageChange } from '../i18n';

/**
 * A celestial body in the scene: a sphere mesh with axial tilt + rotation,
 * plus an optional name label sprite. Position is set externally each frame.
 */
export class BodyMesh {
  readonly group: Group;
  readonly mesh: Mesh;
  readonly descriptor: BodyDescriptor;
  label: Sprite;
  private readonly tilt: Group;
  private rotationRate: number;
  private rings: Mesh | null = null;
  private labelAspect: number = 1;
  private labelTargetPixels: number = 14;
  private bodyRadius: number;
  private cloudMesh: Mesh | null = null;
  private atmoMesh: Mesh | null = null;
  /** onLanguageChange unsubscribe handle. Captured so that callers
   *  evicting BodyMesh instances (e.g. ExoplanetSystemView cache
   *  invalidation, future user-defined-body deletion) can release it
   *  via dispose() and not leak listeners. */
  private langUnsubscribe: (() => void) | null = null;

  /** Pickable surface for raycasting; remains at unit-scale-relative size. */
  readonly pickable: Mesh;

  /**
   * Observer-fade uniforms. When the user is in observer mode the surface
   * directly under their feet is occluded by the LocalTerrain mesh — but
   * the underlying body ball would otherwise be visible just past the
   * terrain edge as a low-res "halo" with a hard boundary. We fade the
   * ball's alpha based on world-space normal · uObsDir so the local
   * patch dissolves smoothly into the LocalTerrain's outer tier.
   *
   * cosStart > cosEnd because larger cos = smaller angle to observer; the
   * fade ramps from cosStart (start fading) toward cosEnd (fully gone).
   * Inactive default: cosEnd > 1 means the smoothstep never triggers.
   */
  private observerFadeUniforms = {
    uObsDir: { value: new Vector3(0, 1, 0) },
    uObsFadeCosStart: { value: 2.0 },
    uObsFadeCosEnd: { value: 2.0 },
  };

  /**
   * Per-body brightness multiplier applied in the fragment shader. Used by
   * observer-mode realism to tint planets toward red as they sink toward
   * the horizon (per-channel atmospheric extinction) and to scale the
   * body's apparent emission/brightness with phase-angle magnitude.
   * Default (1, 1, 1) = no effect.
   */
  private brightTintUniform = { value: new Color(1, 1, 1) };

  /**
   * Earthshine: faint glow on the moon's dark hemisphere from Earth-reflected
   * sunlight. Active only on Earth's moon (set via shader injection at
   * construction time when descriptor.id === 'moon'). Intensity 0..1 scales
   * with `(1 - moon_illuminated_fraction)` so it peaks at new crescent.
   */
  private earthshineUniforms = {
    uEarthshine: { value: 0.0 },
    uSunDirLocal: { value: new Vector3(1, 0, 0) }, // body-local sun direction
  };

  /**
   * Atmospheric refraction flattening (sun/moon ovality near horizon). When
   * the body is low on the observer's horizon, refraction lifts its lower
   * limb more than its upper limb so the disc appears compressed along the
   * zenith axis. We implement it as a non-uniform scale in the body's
   * local frame around the world-space zenith direction. yScale = 1 → no
   * effect; 0.85 ≈ disc fully on horizon.
   */
  private flattenUniforms = {
    uFlatZenith: { value: new Vector3(0, 1, 0) },
    uFlatYScale: { value: 1.0 },
  };

  /**
   * Saturn ring-shadow uniforms. The fragment shader on Saturn's body casts
   * the ring annulus's shadow onto the planet by tracing a ray from each
   * surface point along the sun direction (in mesh-local frame) and
   * checking whether that ray intersects the ring plane within the ring's
   * inner/outer radii. Caller must update uSunDirRingLocal each frame.
   */
  private ringShadowUniforms = {
    uSunDirRingLocal: { value: new Vector3(1, 0, 0) },
    uRingInner: { value: 0.0 },
    uRingOuter: { value: 0.0 },
  };

  /**
   * Differential rotation (Jupiter / Saturn): the equatorial belt rotates
   * slightly faster than the poles, so band features migrate eastward over
   * time. Implemented as a latitude-dependent U offset added to the texture
   * sample. Caller (main.ts) updates uDriftPhase every frame from JD.
   */
  private driftUniforms = {
    uDriftPhase: { value: 0.0 },
  };

  /**
   * Planet-on-planet shadow uniforms — real eclipses on body surfaces.
   *
   * For each surface fragment, we treat the sun as a finite disc (not a
   * point) and check angular overlap with each of up to MAX_OCCLUDERS
   * spheres in world space. Standard occultation geometry: if the
   * angular distance between sun-centre and occluder-centre as seen
   * from the fragment is less than the sum of their angular radii, the
   * fragment is in penumbra; if less than the difference, full umbra.
   *
   * Receivers: every non-emissive BodyMesh.
   * Occluders: in practice just the receiver's parent + same-parent
   * siblings (Galilean moons cast shadows on Jupiter; Earth's shadow
   * eclipses the Moon during lunar eclipses). Cross-system shadows
   * are geometrically negligible.
   *
   * All positions / radii in WORLD scene units. Sun position is the
   * sun's world centre. Caller (main.ts) refreshes every frame.
   */
  private shadowUniforms = {
    uSunWorldPos:    { value: new Vector3(0, 0, 0) },
    uSunRadius:      { value: 0.0 },
    uShadowCount:    { value: 0 },
    uShadowPos:      { value: [new Vector3(), new Vector3(), new Vector3(), new Vector3()] },
    uShadowRadius:   { value: [0, 0, 0, 0] },
  };

  constructor(descriptor: BodyDescriptor, sceneRadius: number) {
    this.descriptor = descriptor;
    this.group = new Group();
    this.group.name = descriptor.id;
    this.bodyRadius = sceneRadius;

    this.tilt = new Group();
    // Axial tilt: rotate around scene-X axis. Combined with the
    // ecliptic→scene transform this yields a spin axis tilted ε from scene-Y
    // (ecliptic north) toward +Z, matching the IAU convention used by the
    // topocentric math.
    this.tilt.rotation.x = -descriptor.physical.axialTiltDeg * DEG2RAD;
    this.group.add(this.tilt);

    // Earth (and other bodies the user is likely to view up close) get a far
    // higher tessellation so the silhouette stays smooth at observer-mode
    // distances. The vertex cost is negligible compared to texture bandwidth.
    const closeUp = descriptor.id === 'earth' || descriptor.id === 'moon';
    const widthSeg = closeUp ? 256 : 48;
    const heightSeg = closeUp ? 128 : 32;
    const geom = new SphereGeometry(sceneRadius, widthSeg, heightSeg);
    const color = new Color(descriptor.appearance.color);

    const mat = descriptor.appearance.emissive
      ? new MeshBasicMaterial({ color })
      : new MeshStandardMaterial({
          color,
          roughness: 0.9,
          metalness: 0.0,
        });

    if (descriptor.id === 'earth' && !descriptor.appearance.emissive) {
      // The shader injection below is in place at all times, but the
      // transparent/depthWrite flags are toggled dynamically in
      // `setObserverFade`. When NOT in observer mode the body must stay
      // opaque so depth is written and stars/constellation lines/grids
      // get correctly occluded by Earth's silhouette. When observer mode
      // activates the fade-hole, we flip to transparent/no-depth-write so
      // the see-through region renders correctly.
      const m = mat as MeshStandardMaterial;
      const u = this.observerFadeUniforms;
      m.onBeforeCompile = (shader) => {
        shader.uniforms.uObsDir = u.uObsDir;
        shader.uniforms.uObsFadeCosStart = u.uObsFadeCosStart;
        shader.uniforms.uObsFadeCosEnd = u.uObsFadeCosEnd;
        // Pass world-space surface direction (== world normal on a sphere).
        shader.vertexShader = shader.vertexShader.replace(
          '#include <common>',
          `#include <common>\nvarying vec3 vBodyWorldDir;`,
        ).replace(
          '#include <project_vertex>',
          `vBodyWorldDir = normalize(mat3(modelMatrix) * normal);\n#include <project_vertex>`,
        );
        shader.fragmentShader = shader.fragmentShader.replace(
          '#include <common>',
          `#include <common>\nuniform vec3 uObsDir;\nuniform float uObsFadeCosStart;\nuniform float uObsFadeCosEnd;\nvarying vec3 vBodyWorldDir;`,
        ).replace(
          '#include <map_fragment>',
          `#include <map_fragment>\n{\n  float _d = dot(vBodyWorldDir, uObsDir);\n  float _fade = 1.0 - smoothstep(uObsFadeCosStart, uObsFadeCosEnd, _d);\n  diffuseColor.a *= _fade;\n}`,
        );
      };
    }

    // Generic brightness tint (atmospheric extinction + phase-angle dimming)
    // for non-emissive bodies — Sun is left alone.
    if (!descriptor.appearance.emissive) {
      const m = mat as MeshStandardMaterial;
      const tintU = this.brightTintUniform;
      const isMoon = descriptor.id === 'moon';
      const isSaturn = descriptor.id === 'saturn';
      const isGasGiant = descriptor.id === 'jupiter' || descriptor.id === 'saturn';
      const earthshineU = this.earthshineUniforms;
      const flattenU = this.flattenUniforms;
      const ringU = this.ringShadowUniforms;
      const driftU = this.driftUniforms;
      const shadowU = this.shadowUniforms;
      const prevCompile = m.onBeforeCompile;
      m.onBeforeCompile = (shader) => {
        if (prevCompile) prevCompile(shader, undefined as unknown as never);
        shader.uniforms.uBrightTint = tintU;
        shader.uniforms.uFlatZenith = flattenU.uFlatZenith;
        shader.uniforms.uFlatYScale = flattenU.uFlatYScale;
        shader.uniforms.uSunWorldPos = shadowU.uSunWorldPos;
        shader.uniforms.uSunRadius = shadowU.uSunRadius;
        shader.uniforms.uShadowCount = shadowU.uShadowCount;
        shader.uniforms.uShadowPos = shadowU.uShadowPos;
        shader.uniforms.uShadowRadius = shadowU.uShadowRadius;
        // Vertex shader: forward world-space position so the fragment can do
        // the per-pixel sun-occluder angular geometry. Reuses vBodyWorldDir
        // pattern if Earth's observer-fade already added one — we add a
        // distinct varying to avoid conflict.
        shader.vertexShader = shader.vertexShader.replace(
          '#include <common>',
          `#include <common>\nvarying vec3 vShadowWorldPos;`,
        ).replace(
          '#include <project_vertex>',
          `vShadowWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;\n#include <project_vertex>`,
        );
        // Atmospheric flattening: compress the body along its mesh-local
        // zenith axis so the disc looks oval near the horizon. Caller passes
        // zenith already converted to mesh-local space (rotation/tilt
        // accounted for) so we don't need any matrix-inversion in shader.
        shader.vertexShader = shader.vertexShader.replace(
          '#include <common>',
          `#include <common>\nuniform vec3 uFlatZenith;\nuniform float uFlatYScale;`,
        ).replace(
          '#include <project_vertex>',
          `{
            vec3 _zL = normalize(uFlatZenith);
            float _along = dot(transformed, _zL);
            vec3 _perp = transformed - _along * _zL;
            transformed = _perp + _along * uFlatYScale * _zL;
          }
          #include <project_vertex>`,
        );
        // Common header block — every non-emissive body gets the shadow
        // uniforms. The shadow apply block goes after map_fragment so it
        // sees the texture-modulated diffuseColor (we want shadows to
        // dim the lit surface uniformly regardless of albedo).
        const shadowHeader =
          `\nuniform vec3 uSunWorldPos;\nuniform float uSunRadius;` +
          `\nuniform int uShadowCount;\nuniform vec3 uShadowPos[4];` +
          `\nuniform float uShadowRadius[4];\nvarying vec3 vShadowWorldPos;`;
        // Sun-occluder angular geometry. For each occluder:
        //   sunDir, occDir = direction from fragment to sun / occluder
        //   sunR, occR     = angular radius of sun / occluder as seen from fragment
        //   sep            = angular distance between sun centre and occluder centre
        // Three cases:
        //   sep >= sunR + occR → no occlusion → factor 0
        //   sep + sunR <= occR → full umbra  → factor 1
        //   else                → penumbra → smooth interp
        // Aggregate by taking the MAX shadow factor across occluders (a
        // fragment can't be more than fully shadowed). Dim diffuseColor
        // by up to 0.97 in the umbra — leave a hint of ambient so the
        // moon during a total lunar eclipse stays just-visible-reddish
        // (which is the right look anyway: refracted light, "blood moon").
        const shadowApply =
          `\n{
            for (int _i = 0; _i < 4; _i++) {
              if (_i >= uShadowCount) break;
              vec3 _toSun = uSunWorldPos - vShadowWorldPos;
              vec3 _toOcc = uShadowPos[_i] - vShadowWorldPos;
              float _dS = length(_toSun);
              float _dO = length(_toOcc);
              if (_dO >= _dS) continue;          // occluder behind sun from fragment
              vec3 _sunDir = _toSun / max(_dS, 1e-6);
              vec3 _occDir = _toOcc / max(_dO, 1e-6);
              float _sunR  = uSunRadius        / max(_dS, 1e-6);
              float _occR  = uShadowRadius[_i] / max(_dO, 1e-6);
              float _sep   = acos(clamp(dot(_sunDir, _occDir), -1.0, 1.0));
              float _shadow;
              if (_sep >= _sunR + _occR)        _shadow = 0.0;
              else if (_sep + _sunR <= _occR)   _shadow = 1.0;
              else {
                _shadow = 1.0 - smoothstep(
                  max(_occR - _sunR, 0.0),
                  _sunR + _occR,
                  _sep);
                // Penumbra-only limb-darkening correction. The Sun's disc
                // is darker at its rim (Pierce-Slaughter: limb is ~30 %
                // of centre brightness), so when an occluder covers ONLY
                // the limb (sep near sunR+occR) it removes less light
                // than the uniform-disc shadow formula predicts. When the
                // occluder approaches the disc centre (sep near 0) the
                // limb-darkening barely matters.
                //   cover_centrality: 1 at sep=0 (centred) → 0 at sep=sunR+occR (touching)
                //   ld_factor:        1.0 → 0.30 along the same range
                // Umbra is left at 1.0 because the disc is fully blocked
                // regardless of where on it the occluder sits.
                float _coverCent = 1.0 - _sep / max(_sunR + _occR, 1e-6);
                float _ldFactor = 0.30 + 0.70 * _coverCent;
                _shadow *= _ldFactor;
              }
              // 0.92 floor leaves ~8% residue in full umbra. Two reasons:
              // (a) gives the existing lunar-eclipse red tint headroom to
              //     stack on top → blood moon stays visibly red instead of
              //     near-black, and (b) Galilean moons in Jupiter's shadow
              //     stay just-discernible rather than disappearing entirely,
              //     matching how they look in long-exposure astrophotos.
              diffuseColor.rgb *= 1.0 - 0.92 * _shadow;
            }
          }`;
        if (isGasGiant) {
          shader.uniforms.uDriftPhase = driftU.uDriftPhase;
          // Replace the standard map sampling with a UV-shifted version.
          // Latitude weighting cos((vMapUv.y - 0.5) * π) peaks at equator,
          // zero at poles → equatorial belts drift fastest, polar caps stay.
          shader.fragmentShader = shader.fragmentShader.replace(
            '#include <common>',
            `#include <common>\nuniform vec3 uBrightTint;\nuniform float uDriftPhase;${shadowHeader}`,
          ).replace(
            '#include <map_fragment>',
            `#ifdef USE_MAP
              vec2 _drifted = vec2(
                fract(vMapUv.x + uDriftPhase * cos((vMapUv.y - 0.5) * 3.14159265)),
                vMapUv.y);
              vec4 sampledDiffuseColor = texture2D(map, _drifted);
              diffuseColor *= sampledDiffuseColor;
            #endif
            diffuseColor.rgb *= uBrightTint;${shadowApply}`,
          );
        } else {
          shader.fragmentShader = shader.fragmentShader.replace(
            '#include <common>',
            `#include <common>\nuniform vec3 uBrightTint;${shadowHeader}`,
          ).replace(
            '#include <map_fragment>',
            `#include <map_fragment>\ndiffuseColor.rgb *= uBrightTint;${shadowApply}`,
          );
        }
        if (isSaturn) {
          shader.uniforms.uSunDirRingLocal = ringU.uSunDirRingLocal;
          shader.uniforms.uRingInner = ringU.uRingInner;
          shader.uniforms.uRingOuter = ringU.uRingOuter;
          // Mesh-local position is already what we want — sphere centered at
          // origin, ring is in the same parent (tilt) group's XZ plane.
          // We pass mesh-local position to the fragment via a varying.
          shader.vertexShader = shader.vertexShader.replace(
            '#include <common>',
            `#include <common>\nvarying vec3 vBodyLocalPos;`,
          ).replace(
            '#include <project_vertex>',
            `vBodyLocalPos = transformed;\n#include <project_vertex>`,
          );
          shader.fragmentShader = shader.fragmentShader.replace(
            '#include <common>',
            `#include <common>\nuniform vec3 uSunDirRingLocal;\nuniform float uRingInner;\nuniform float uRingOuter;\nvarying vec3 vBodyLocalPos;`,
          ).replace(
            '#include <emissivemap_fragment>',
            `#include <emissivemap_fragment>
            // Trace ray from this surface point toward the sun (in tilt-local
            // frame). If the ray crosses the ring plane (Y = 0) at a radius
            // inside the ring annulus, this point is in the ring's shadow.
            {
              vec3 P = vBodyLocalPos;
              vec3 S = normalize(uSunDirRingLocal);
              if (abs(S.y) > 1e-3) {
                float t = -P.y / S.y;
                if (t > 0.0) {
                  vec2 hit = vec2(P.x + t * S.x, P.z + t * S.z);
                  float rh = length(hit);
                  if (rh > uRingInner && rh < uRingOuter) {
                    // Soft falloff at the ring edges to avoid aliasing.
                    float edge = 0.96;
                    float band = smoothstep(uRingInner, uRingInner / edge, rh)
                               * (1.0 - smoothstep(uRingOuter * edge, uRingOuter, rh));
                    diffuseColor.rgb *= 1.0 - 0.65 * band;
                  }
                }
              }
            }`,
          );
        }
        if (isMoon) {
          shader.uniforms.uEarthshine = earthshineU.uEarthshine;
          shader.uniforms.uSunDirLocal = earthshineU.uSunDirLocal;
          // Add a faint blue glow on the moon's dark hemisphere proportional
          // to (1 - illuminated_fraction). Standard normal is the sphere's
          // outward-pointing local normal; sun direction is provided in the
          // moon's local frame so the dot product correctly identifies the
          // night side regardless of mesh orientation/rotation.
          shader.fragmentShader = shader.fragmentShader.replace(
            '#include <common>',
            `#include <common>\nuniform float uEarthshine;\nuniform vec3 uSunDirLocal;`,
          ).replace(
            '#include <emissivemap_fragment>',
            `#include <emissivemap_fragment>\n{\n  float _nl = dot(normalize(vNormal), normalize(uSunDirLocal));\n  float _night = clamp(-_nl, 0.0, 1.0);\n  totalEmissiveRadiance += vec3(0.18, 0.22, 0.32) * uEarthshine * _night;\n}`,
          );
        }
      };
      // Force shader recompile so any prior compile result is replaced.
      m.needsUpdate = true;
    }

    if (descriptor.appearance.textureUrl && !descriptor.appearance.emissive) {
      new TextureLoader().load(descriptor.appearance.textureUrl, (tex) => {
        tex.colorSpace = SRGBColorSpace;
        tex.anisotropy = TextureConfig.maxAnisotropy;
        (mat as MeshStandardMaterial).map = tex;
        (mat as MeshStandardMaterial).color.setHex(0xffffff);
        (mat as MeshStandardMaterial).needsUpdate = true;
      });
    }
    if (descriptor.appearance.nightTextureUrl && !descriptor.appearance.emissive) {
      new TextureLoader().load(descriptor.appearance.nightTextureUrl, (tex) => {
        tex.colorSpace = SRGBColorSpace;
        tex.anisotropy = TextureConfig.maxAnisotropy;
        const m = mat as MeshStandardMaterial;
        m.emissiveMap = tex;
        m.emissive = new Color(0xffffff);
        m.emissiveIntensity = 1.4;
        m.needsUpdate = true;
      });
    }

    this.mesh = new Mesh(geom, mat);
    this.tilt.add(this.mesh);

    // Cloud shell — a slightly larger transparent sphere over the surface.
    if (descriptor.appearance.cloudTextureUrl && !descriptor.appearance.emissive) {
      const cloudGeom = new SphereGeometry(sceneRadius * 1.005, widthSeg, heightSeg);
      const cloudMat = new MeshStandardMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.65,
        depthWrite: false,
        roughness: 1.0,
      });
      new TextureLoader().load(descriptor.appearance.cloudTextureUrl, (tex) => {
        tex.colorSpace = SRGBColorSpace;
        tex.anisotropy = TextureConfig.maxAnisotropy;
        cloudMat.map = tex;
        cloudMat.alphaMap = tex;
        cloudMat.needsUpdate = true;
      });
      const clouds = new Mesh(cloudGeom, cloudMat);
      this.cloudMesh = clouds;
      this.tilt.add(clouds);
    }

    // Atmospheric glow shell (fresnel rim).
    if (descriptor.appearance.atmosphere) {
      const atmo = descriptor.appearance.atmosphere;
      const scale = atmo.scale ?? 1.04;
      const power = atmo.power ?? 2.5;
      const intensity = atmo.intensity ?? 1.0;
      const atmoGeom = new SphereGeometry(sceneRadius * scale, widthSeg, heightSeg);
      const atmoMat = new ShaderMaterial({
        transparent: true,
        blending: AdditiveBlending,
        depthWrite: false,
        side: BackSide,
        uniforms: {
          glowColor: { value: new Color(atmo.color) },
          power: { value: power },
          intensity: { value: intensity },
        },
        vertexShader: `
          varying vec3 vNormal;
          varying vec3 vViewDir;
          void main() {
            vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
            vNormal = normalize(normalMatrix * normal);
            vViewDir = normalize(-mvPos.xyz);
            gl_Position = projectionMatrix * mvPos;
          }
        `,
        fragmentShader: `
          uniform vec3 glowColor;
          uniform float power;
          uniform float intensity;
          varying vec3 vNormal;
          varying vec3 vViewDir;
          void main() {
            // BackSide flips normals; reverse so dot is positive at limb.
            float rim = pow(max(0.0, 1.0 - abs(dot(vNormal, vViewDir))), power);
            gl_FragColor = vec4(glowColor * intensity * rim, rim);
          }
        `,
      });
      const atmoMesh = new Mesh(atmoGeom, atmoMat);
      this.atmoMesh = atmoMesh;
      this.tilt.add(atmoMesh);
    }

    // Slightly larger invisible pick proxy so tiny planets are still clickable.
    const pickRadius = Math.max(sceneRadius * 1.5, 0.05);
    const pickGeom = new SphereGeometry(pickRadius, 12, 8);
    const pickMat = new MeshBasicMaterial({ visible: false });
    this.pickable = new Mesh(pickGeom, pickMat);
    this.pickable.userData.bodyId = descriptor.id;
    this.group.add(this.pickable);

    this.label = this.createLabel(bodyName(descriptor));
    this.label.position.set(0, sceneRadius * 1.6 + 0.2, 0);
    this.group.add(this.label);
    // Re-bake the label sprite when the user switches language so the
    // name on the planet updates without a page reload.
    this.langUnsubscribe = onLanguageChange(() => {
      this.relabel(bodyName(descriptor), sceneRadius);
    });

    // rotation rate: radians per simulated day. Negative period = retrograde.
    const period = descriptor.physical.rotationPeriodDays;
    this.rotationRate = period === 0 ? 0 : (2 * Math.PI) / period;

    if (descriptor.id === 'saturn') {
      this.addRings(sceneRadius);
    }
  }

  private addRings(planetRadius: number): void {
    const inner = planetRadius * 1.3;
    const outer = planetRadius * 2.2;
    // Publish radii so the body shader's ring-shadow trace knows its bounds.
    this.ringShadowUniforms.uRingInner.value = inner;
    this.ringShadowUniforms.uRingOuter.value = outer;
    const geom = new RingGeometry(inner, outer, 96);
    const mat = new MeshBasicMaterial({
      color: 0xd9c391,
      side: DoubleSide,
      transparent: true,
      opacity: 0.7,
      // Critical for ring/sphere overlap: without depthWrite=false the
      // ring's back-face writes depth values that prevent the planet's
      // far hemisphere from rendering correctly, leaving a giant
      // tilted-disc-shaped "shadow" stamped into the scene that extends
      // way beyond the planet's silhouette.
      depthWrite: false,
    });
    const ring = new Mesh(geom, mat);
    ring.rotation.x = Math.PI / 2;
    // Render after the planet's solid surface so transparency blends
    // correctly with the body underneath.
    ring.renderOrder = 1;
    this.rings = ring;
    this.tilt.add(ring);
  }

  private createLabel(text: string): Sprite {
    const fontSize = 64;
    const padding = 16;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    ctx.font = `${fontSize}px -apple-system, "PingFang TC", sans-serif`;
    const metrics = ctx.measureText(text);
    const width = Math.ceil(metrics.width) + padding * 2;
    const height = fontSize + padding * 2;
    canvas.width = width;
    canvas.height = height;
    ctx.font = `${fontSize}px -apple-system, "PingFang TC", sans-serif`;
    ctx.fillStyle = 'rgba(0, 0, 0, 0)';
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = '#cfe2ff';
    ctx.shadowColor = 'rgba(0,0,0,0.9)';
    ctx.shadowBlur = 8;
    ctx.textBaseline = 'middle';
    ctx.fillText(text, padding, height / 2);

    const tex = new CanvasTexture(canvas);
    tex.needsUpdate = true;

    const mat = new SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false });
    const sprite = new Sprite(mat);
    const aspect = width / height;
    this.labelAspect = aspect;
    sprite.scale.set(0.001 * aspect, 0.001, 1);
    sprite.renderOrder = 999;
    return sprite;
  }

  /**
   * Replace the label sprite's texture with one rendered for the given
   * text. Used by the language-switch hook so planet names update from
   * "太陽" → "Sun" → "太陽" without rebuilding the whole BodyMesh.
   */
  private relabel(text: string, sceneRadius: number): void {
    // Capture previous visibility — don't force-on after a language
    // switch if the user had labels turned off via the display toggle.
    const wasVisible = this.label.visible;
    // Dispose the old map so we don't leak GPU textures on every switch.
    const oldMat = this.label.material as SpriteMaterial;
    oldMat.map?.dispose();
    oldMat.dispose();
    // Re-create using the same constructor logic, then move the geometry.
    this.group.remove(this.label);
    this.label = this.createLabel(text);
    this.label.position.set(0, sceneRadius * 1.6 + 0.2, 0);
    this.label.visible = wasVisible;
    this.group.add(this.label);
  }

  setPosition(scenePos: Vector3): void {
    this.group.position.copy(scenePos);
  }

  /** Advance rotation by simulated dt in days. */
  advanceRotation(dDays: number): void {
    this.mesh.rotation.y += this.rotationRate * dDays;
    if (this.cloudMesh) {
      // Clouds drift eastward slightly faster than the surface (~5%).
      this.cloudMesh.rotation.y += this.rotationRate * dDays * 1.05;
    }
  }

  /** Set absolute rotation angle (radians around local Y). Used for Earth=GMST. */
  setRotationAngle(rad: number): void {
    this.mesh.rotation.y = rad;
    if (this.cloudMesh) {
      // Drift clouds slightly relative to ground; offset proportional to rad
      // so they don't snap when JD jumps.
      this.cloudMesh.rotation.y = rad * 1.05;
    }
  }

  /** For moons: apply optical libration around X (lat) and Z (lon) axes. */
  setLibration(libLatRad: number, libLonRad: number): void {
    this.tilt.rotation.x = -this.descriptor.physical.axialTiltDeg * DEG2RAD + libLatRad;
    this.tilt.rotation.z = libLonRad;
  }

  setLabelVisible(visible: boolean): void {
    this.label.visible = visible;
  }

  /**
   * Set the per-channel brightness multiplier for this body. (1, 1, 1) is
   * neutral; lower values dim the body, RGB imbalance shifts hue. Used by
   * the realism layer for atmospheric extinction (low-altitude reddening
   * + dimming) and phase-angle magnitude (Venus crescent dimming, etc.).
   */
  setBrightnessTint(r: number, g: number, b: number): void {
    this.brightTintUniform.value.setRGB(r, g, b);
  }

  /** Multiply the current per-body brightness tint by another factor. */
  multiplyBrightnessTint(r: number, g: number, b: number): void {
    const v = this.brightTintUniform.value;
    v.setRGB(v.r * r, v.g * g, v.b * b);
  }

  /**
   * Apply atmospheric refraction flattening. `zenithLocal` is the observer's
   * zenith direction expressed in this body's mesh-local frame (caller
   * inverse-transforms via mesh.matrixWorld). yScale 1.0 = no effect; 0.8 ≈
   * disc fully on horizon.
   */
  setAtmosphericFlattening(zenithLocal: Vector3, yScale: number): void {
    this.flattenUniforms.uFlatZenith.value.copy(zenithLocal).normalize();
    this.flattenUniforms.uFlatYScale.value = Math.max(0.5, Math.min(1.0, yScale));
  }

  /**
   * Update the sun direction (in this body's tilt-local frame) used by the
   * Saturn ring-shadow shader. No-op for non-Saturn bodies — the uniform is
   * created but never reaches a fragment shader.
   */
  setRingShadowSun(sunDirLocal: Vector3): void {
    this.ringShadowUniforms.uSunDirRingLocal.value.copy(sunDirLocal).normalize();
  }

  /** Set differential-rotation phase (Jupiter / Saturn band drift). */
  setDriftPhase(phase: number): void {
    this.driftUniforms.uDriftPhase.value = phase;
  }

  /**
   * Set Earthshine intensity on the moon (0..1). Caller computes from current
   * lunar phase: brightest at new crescent, zero at full moon. Sun direction
   * must be supplied in the body's local frame (i.e. relative to mesh.tilt
   * + rotation). No-op on non-moon bodies — uniform exists but never reaches
   * a fragment shader.
   */
  setEarthshine(intensity: number, sunDirLocal: Vector3): void {
    this.earthshineUniforms.uEarthshine.value = Math.max(0, Math.min(1, intensity));
    this.earthshineUniforms.uSunDirLocal.value.copy(sunDirLocal).normalize();
  }

  /**
   * Update planet-on-planet shadow inputs. Pass the sun's world-space
   * centre + radius and a list of up to 4 occluders (world centre + radius
   * for each). Each frame, main.ts builds the occluder list for each
   * body — typically just the parent + same-parent siblings. Pass an
   * empty array to clear all shadows on this body.
   *
   * Coordinates are scene world units (NOT AU directly — must already be
   * scaled by the active scale-controller).
   */
  setShadowInputs(
    sunWorldPos: Vector3, sunRadius: number,
    occluders: Array<{ worldPos: Vector3; radius: number }>,
  ): void {
    const u = this.shadowUniforms;
    u.uSunWorldPos.value.copy(sunWorldPos);
    u.uSunRadius.value = sunRadius;
    const n = Math.min(4, occluders.length);
    u.uShadowCount.value = n;
    for (let i = 0; i < n; i++) {
      (u.uShadowPos.value[i] as Vector3).copy(occluders[i].worldPos);
      (u.uShadowRadius.value as number[])[i] = occluders[i].radius;
    }
  }

  /**
   * Drive the observer-fade hole. Pass a unit world-space zenith direction
   * and the half-angle (degrees) over which alpha ramps from 1 → 0.
   * `setObserverFade(null)` disables the fade.
   */
  setObserverFade(args: { zenithWorld: Vector3; startDeg: number; endDeg: number } | null): void {
    const u = this.observerFadeUniforms;
    const m = this.mesh.material as MeshStandardMaterial;
    if (!args) {
      // Push smoothstep range above 1 so the body is fully opaque again,
      // and flip back to opaque rendering so the body silhouette occludes
      // stars / constellation lines / grids correctly.
      u.uObsFadeCosStart.value = 2.0;
      u.uObsFadeCosEnd.value = 2.0;
      if (m.transparent) {
        m.transparent = false;
        m.depthWrite = true;
      }
      return;
    }
    if (!m.transparent) {
      // Re-enable alpha blending + skip depth write so the fade-hole
      // doesn't carve a black disc into whatever's behind Earth.
      m.transparent = true;
      m.depthWrite = false;
    }
    u.uObsDir.value.copy(args.zenithWorld).normalize();
    // smoothstep(a, b, x): a < b. Larger cos = closer to observer; we want
    // fade to ramp 0→1 as we approach the observer, then we invert.
    // Set cosStart at start of fade (smaller cos / larger angle), cosEnd
    // at fully transparent (larger cos / smaller angle).
    const cosStart = Math.cos(args.startDeg * DEG2RAD);
    const cosEnd   = Math.cos(args.endDeg   * DEG2RAD);
    u.uObsFadeCosStart.value = cosStart;
    u.uObsFadeCosEnd.value   = cosEnd;
  }

  /**
   * Update label sprite scale so it occupies a constant pixel height regardless
   * of camera distance. Call once per frame from the render loop.
   */
  updateLabelScreenSize(distanceToCamera: number, fovRad: number, canvasHeight: number): void {
    if (!this.label.visible || canvasHeight === 0) return;
    const worldUnitsPerPixel = (2 * distanceToCamera * Math.tan(fovRad / 2)) / canvasHeight;
    const labelHeight = this.labelTargetPixels * worldUnitsPerPixel;
    this.label.scale.set(labelHeight * this.labelAspect, labelHeight, 1);
    this.label.position.y = this.bodyRadius + worldUnitsPerPixel * (this.labelTargetPixels * 1.4);
  }

  /** Re-create geometry when scale mode changes. */
  rebuildForRadius(sceneRadius: number): void {
    this.bodyRadius = sceneRadius;
    const closeUp = this.descriptor.id === 'earth' || this.descriptor.id === 'moon';
    const widthSeg = closeUp ? 256 : 48;
    const heightSeg = closeUp ? 128 : 32;

    this.mesh.geometry.dispose();
    this.mesh.geometry = new SphereGeometry(sceneRadius, widthSeg, heightSeg);

    this.pickable.geometry.dispose();
    const pickRadius = Math.max(sceneRadius * 1.5, 0.05);
    this.pickable.geometry = new SphereGeometry(pickRadius, 12, 8);

    if (this.rings) {
      this.rings.geometry.dispose();
      this.rings.geometry = new RingGeometry(sceneRadius * 1.3, sceneRadius * 2.2, 96);
      this.ringShadowUniforms.uRingInner.value = sceneRadius * 1.3;
      this.ringShadowUniforms.uRingOuter.value = sceneRadius * 2.2;
    }
    if (this.cloudMesh) {
      this.cloudMesh.geometry.dispose();
      this.cloudMesh.geometry = new SphereGeometry(sceneRadius * 1.005, widthSeg, heightSeg);
    }
    if (this.atmoMesh) {
      const atmo = this.descriptor.appearance.atmosphere!;
      const scale = atmo.scale ?? 1.04;
      this.atmoMesh.geometry.dispose();
      this.atmoMesh.geometry = new SphereGeometry(sceneRadius * scale, widthSeg, heightSeg);
    }
  }

  /**
   * Tear down this BodyMesh: release its language-change subscription,
   * dispose all geometries + materials + textures. Only needs calling
   * when a BodyMesh is being evicted from the scene graph for good
   * (e.g. user-defined body deletion, ExoplanetSystemView cache
   * shootdown). Bodies built once at startup don't need disposal.
   */
  dispose(): void {
    if (this.langUnsubscribe) {
      this.langUnsubscribe();
      this.langUnsubscribe = null;
    }
    this.mesh.geometry.dispose();
    this.pickable.geometry.dispose();
    if (this.rings) this.rings.geometry.dispose();
    if (this.cloudMesh) this.cloudMesh.geometry.dispose();
    if (this.atmoMesh) this.atmoMesh.geometry.dispose();
    const labelMat = this.label.material as { map?: { dispose: () => void }; dispose: () => void };
    labelMat.map?.dispose();
    labelMat.dispose();
  }
}
