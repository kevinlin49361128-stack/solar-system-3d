import {
  AdditiveBlending,
  ConeGeometry,
  Mesh,
  ShaderMaterial,
  Vector3,
} from 'three';

/**
 * Zodiacal light: faint pyramidal glow extending from the sun along the
 * ecliptic, caused by sunlight scattering off interplanetary dust. Visible
 * after evening twilight and before dawn under dark skies; we render two
 * thin elongated cones (one toward sun, one anti-sun for the gegenschein /
 * counter-glow) and only draw them when the sun is below the horizon.
 *
 * Geometry: very tall, narrow cones aligned along the sun ↔ anti-sun axis,
 * with a soft falloff from base to tip.
 */
export class ZodiacalLight {
  readonly group = new Mesh();  // dummy parent so attach is symmetrical
  private toward: Mesh;
  private away: Mesh;
  private mat: ShaderMaterial;

  constructor() {
    this.mat = new ShaderMaterial({
      uniforms: {
        uOpacity: { value: 1.0 },
        uSunBelow: { value: 0.0 }, // 0 when sun is up; 1 when night
      },
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      vertexShader: `
        varying float vT;
        void main() {
          // Cone in three.js has +Y as the apex; t ∈ [0,1] along height.
          vT = clamp((position.y + 1.0) / 2.0, 0.0, 1.0);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uOpacity;
        uniform float uSunBelow;
        varying float vT;
        void main() {
          // Brightest near apex, fades to zero toward the base. Faint warm
          // glow (sunlight on dust) so it reads as orange-cream.
          float a = pow(vT, 2.0) * 0.18 * uOpacity * uSunBelow;
          gl_FragColor = vec4(0.85, 0.78, 0.55, a);
        }
      `,
    });

    // Two cones — one along sun direction, one along anti-sun direction.
    // Made tall (length 4000) and narrow (radius 600) for the characteristic
    // pyramidal silhouette.
    const geom = new ConeGeometry(600, 4000, 24, 1, true);
    geom.translate(0, 2000, 0); // base at origin, apex at +Y 4000
    this.toward = new Mesh(geom, this.mat);
    this.away = new Mesh(geom, this.mat);
    this.toward.frustumCulled = false;
    this.away.frustumCulled = false;
    this.toward.renderOrder = -100;
    this.away.renderOrder = -100;
    this.toward.visible = false;
    this.away.visible = false;
  }

  /** Aim the two cones along ±sun direction (in scene-frame). */
  orient(sunDirScene: Vector3, sunAltSin: number): void {
    const sun = sunDirScene.clone().normalize();
    aimMeshAlongDir(this.toward, sun);
    aimMeshAlongDir(this.away, sun.clone().multiplyScalar(-1));
    // Visibility: only show when sun is below horizon (dark side of twilight).
    const below = Math.max(0, -sunAltSin); // 0 when sun is up
    this.mat.uniforms.uSunBelow.value = Math.min(1, below * 4); // ramp 0→1 as sun drops 0→-15°
  }

  setVisible(v: boolean): void {
    this.toward.visible = v;
    this.away.visible = v;
  }

  setCenter(p: Vector3): void {
    this.toward.position.copy(p);
    this.away.position.copy(p);
  }

  /** Adds both cone meshes to the given scene. */
  attach(scene: { add: (o: Mesh) => void }): void {
    scene.add(this.toward);
    scene.add(this.away);
  }
}

const _yAxis = new Vector3(0, 1, 0);
function aimMeshAlongDir(mesh: Mesh, dir: Vector3): void {
  // Default cone orientation has its apex toward +Y; rotate so +Y aligns with `dir`.
  mesh.quaternion.setFromUnitVectors(_yAxis, dir);
}
