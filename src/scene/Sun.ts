import {
  AdditiveBlending,
  Mesh,
  MeshBasicMaterial,
  PointLight,
  ShaderMaterial,
  SphereGeometry,
} from 'three';

/**
 * Sun rendering: solid emissive core + outer glow shell using fake fresnel
 * shader. Includes a PointLight at origin so other bodies are lit.
 */
export function createSunGroup(coreRadius: number): { core: Mesh; glow: Mesh; light: PointLight } {
  const coreGeom = new SphereGeometry(coreRadius, 64, 32);
  const coreMat = new MeshBasicMaterial({ color: 0xfff2c0 });
  const core = new Mesh(coreGeom, coreMat);
  core.userData.bodyId = 'sun';

  const glowGeom = new SphereGeometry(coreRadius * 2.4, 32, 16);
  const glowMat = new ShaderMaterial({
    transparent: true,
    blending: AdditiveBlending,
    depthWrite: false,
    side: 1, // BackSide
    uniforms: {
      glowColor: { value: { r: 1.0, g: 0.78, b: 0.4 } },
    },
    vertexShader: `
      varying vec3 vNormal;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 glowColor;
      varying vec3 vNormal;
      void main() {
        float intensity = pow(0.7 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 3.0);
        gl_FragColor = vec4(glowColor, 1.0) * intensity;
      }
    `,
  });
  const glow = new Mesh(glowGeom, glowMat);

  const light = new PointLight(0xffe9bd, 4.0, 0, 0);
  light.position.set(0, 0, 0);

  return { core, glow, light };
}
