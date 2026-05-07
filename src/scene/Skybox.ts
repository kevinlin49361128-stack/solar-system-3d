import {
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  Points,
  PointsMaterial,
} from 'three';

/**
 * Procedural starfield: ~5000 random points on a giant sphere with subtle
 * color and brightness variation. Cheaper than loading a CubeMap and works
 * without external assets.
 */
export function createStarfield(count = 5000, radius = 4000): Points {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const c = new Color();

  for (let i = 0; i < count; i++) {
    const u = Math.random();
    const v = Math.random();
    const theta = 2 * Math.PI * u;
    const phi = Math.acos(2 * v - 1);

    const x = radius * Math.sin(phi) * Math.cos(theta);
    const y = radius * Math.sin(phi) * Math.sin(theta);
    const z = radius * Math.cos(phi);

    const i3 = i * 3;
    positions[i3] = x;
    positions[i3 + 1] = y;
    positions[i3 + 2] = z;

    // Slight bluish/whitish/yellow tint with dim majority
    const t = Math.random();
    const brightness = 0.3 + Math.pow(Math.random(), 2.5) * 0.9;
    if (t < 0.7) c.setRGB(brightness, brightness, brightness);
    else if (t < 0.9) c.setRGB(brightness * 0.85, brightness * 0.9, brightness);
    else c.setRGB(brightness, brightness * 0.85, brightness * 0.7);

    colors[i3] = c.r;
    colors[i3 + 1] = c.g;
    colors[i3 + 2] = c.b;
  }

  const geom = new BufferGeometry();
  geom.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geom.setAttribute('color', new Float32BufferAttribute(colors, 3));

  const mat = new PointsMaterial({
    size: 1.5,
    sizeAttenuation: false,
    vertexColors: true,
    transparent: true,
    depthWrite: false,
  });

  const points = new Points(geom, mat);
  points.frustumCulled = false;
  return points;
}

/**
 * Compute a daytime/twilight blended sky colour.
 *
 * - dayFactor 0 = full night (deep almost-black)
 * - dayFactor 1 = bright daylight blue
 * Twilight is a smoothstep over the sun's altitude crossing the horizon.
 */
export function skyColorForDayFactor(dayFactor: number, out: Color): Color {
  const night = new Color(0x000005);
  const day = new Color(0x4a8fd6);
  const twilight = new Color(0x6b3a6b); // purple-orange mix at horizon
  if (dayFactor <= 0) return out.copy(night);
  if (dayFactor >= 1) return out.copy(day);
  if (dayFactor < 0.5) {
    // Night → twilight as dayFactor goes 0 → 0.5
    return out.copy(night).lerp(twilight, dayFactor * 2);
  }
  // Twilight → day as dayFactor goes 0.5 → 1
  return out.copy(twilight).lerp(day, (dayFactor - 0.5) * 2);
}

/**
 * Smoothstep( -6° → +6° ) of the sun's altitude maps to a 0..1 daytime factor.
 */
export function sunAltToDayFactor(sunAltRad: number): number {
  const lo = -6 * Math.PI / 180;
  const hi = 6 * Math.PI / 180;
  const t = Math.max(0, Math.min(1, (sunAltRad - lo) / (hi - lo)));
  return t * t * (3 - 2 * t); // smoothstep
}
