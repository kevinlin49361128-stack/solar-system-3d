import {
  BufferGeometry,
  Float32BufferAttribute,
  Line,
  LineBasicMaterial,
  Vector3,
} from 'three';
import { DEG2RAD, TWO_PI } from '../physics/constants';
import type { StaticOrbitalElements } from '../physics/types';
import type { ScaleController } from '../controls/ScaleController';
import { eclipticToSceneInPlace } from '../physics/frame';

/**
 * Renders a static elliptical orbit from Keplerian elements. The line lives
 * in the parent body's local frame; for moons, that's the parent planet's
 * group; for planets, the heliocentric ecliptic frame parented to the sun.
 */
export class OrbitLine {
  readonly line: Line;
  private readonly elements: StaticOrbitalElements;
  private readonly segments: number;
  private readonly isMoon: boolean;

  constructor(elements: StaticOrbitalElements, opts: { color?: number; segments?: number; isMoon?: boolean } = {}) {
    this.elements = elements;
    this.segments = opts.segments ?? 256;
    this.isMoon = opts.isMoon ?? false;

    const geom = new BufferGeometry();
    geom.setAttribute('position', new Float32BufferAttribute(new Float32Array(this.segments * 3 + 3), 3));

    const mat = new LineBasicMaterial({
      color: opts.color ?? 0x4a6a8a,
      transparent: true,
      opacity: 0.45,
    });

    this.line = new Line(geom, mat);
    this.line.frustumCulled = false;
  }

  rebuild(scaler: ScaleController): void {
    const a = this.elements.a;
    const e = this.elements.e;
    const i = this.elements.iDeg * DEG2RAD;
    const Ω = this.elements.ΩDeg * DEG2RAD;
    const ω = this.elements.ωDeg * DEG2RAD;

    const cosO = Math.cos(Ω), sinO = Math.sin(Ω);
    const cosw = Math.cos(ω), sinw = Math.sin(ω);
    const cosi = Math.cos(i), sini = Math.sin(i);

    const r11 = cosO * cosw - sinO * sinw * cosi;
    const r12 = -cosO * sinw - sinO * cosw * cosi;
    const r21 = sinO * cosw + cosO * sinw * cosi;
    const r22 = -sinO * sinw + cosO * cosw * cosi;
    const r31 = sinw * sini;
    const r32 = cosw * sini;

    const positions = (this.line.geometry.getAttribute('position') as Float32BufferAttribute).array as Float32Array;
    const tmp = new Vector3();

    for (let s = 0; s <= this.segments; s++) {
      const E = (s / this.segments) * TWO_PI;
      const xOrb = a * (Math.cos(E) - e);
      const yOrb = a * Math.sqrt(1 - e * e) * Math.sin(E);

      tmp.set(
        r11 * xOrb + r12 * yOrb,
        r21 * xOrb + r22 * yOrb,
        r31 * xOrb + r32 * yOrb,
      );

      // Apply scale mode (moon orbits use a different scale).
      const len = tmp.length();
      const scaledLen = this.isMoon ? scaler.moonDistanceAU(len) : scaler.distanceAU(len);
      if (len > 0) tmp.multiplyScalar(scaledLen / len);

      eclipticToSceneInPlace(tmp);

      const idx = s * 3;
      positions[idx] = tmp.x;
      positions[idx + 1] = tmp.y;
      positions[idx + 2] = tmp.z;
    }

    (this.line.geometry.getAttribute('position') as Float32BufferAttribute).needsUpdate = true;
    this.line.geometry.computeBoundingSphere();
  }

  setVisible(visible: boolean): void {
    this.line.visible = visible;
  }
}
