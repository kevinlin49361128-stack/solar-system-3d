import {
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  Group,
  Points,
  ShaderMaterial,
  Vector3,
} from 'three';
import { twoline2satrec, propagate, gstime, type SatRec } from 'satellite.js';
import { AU_KM, DEG2RAD } from '../physics/constants';
import { SATELLITES, type SatelliteEntry } from '../data/satellites';
import { toast } from '../ui/toast';
import { t } from '../i18n';
import type { ScaleController } from '../controls/ScaleController';

const EARTH_TILT_RAD = 23.4393 * DEG2RAD;

/**
 * Render famous Earth-orbiting satellites as small bright dots positioned
 * via SGP4. LEO satellites are within a few hundred km of Earth's surface,
 * so even at "real" scale the entire constellation is sub-pixel; we apply
 * the same exaggeration as moon distances and add a constant minimum offset
 * so they're always discernible from the planet body.
 *
 * Position pipeline: TLE → SGP4 → ECI position (km) → ecliptic frame (rotate
 * around X by -obliquity) → AU → satellite-distance scaling → eclipticToScene.
 *
 * Children are added to Earth's group, so the satellites inherit Earth's
 * world transform (which is already correctly positioned heliocentrically or
 * geocentrically by SolarSystem.update).
 */
export class SatelliteLayer {
  readonly object: Group;
  private satrecs: { entry: SatelliteEntry; rec: SatRec }[] = [];
  private points: Points;
  private positions: Float32Array;
  private alphas: Float32Array;
  private mat: ShaderMaterial;
  private earthShadowFilter = false;

  constructor() {
    this.object = new Group();
    this.object.name = 'satellite-layer';

    for (const s of SATELLITES) {
      try {
        const rec = twoline2satrec(s.tle1, s.tle2);
        this.satrecs.push({ entry: s, rec });
      } catch (err) {
        console.warn('SatelliteLayer: TLE parse failed for', s.id, err);
      }
    }

    this.positions = new Float32Array(this.satrecs.length * 3);
    this.alphas = new Float32Array(this.satrecs.length).fill(1);

    const geom = new BufferGeometry();
    geom.setAttribute('position', new Float32BufferAttribute(this.positions, 3));
    geom.setAttribute('aAlpha', new Float32BufferAttribute(this.alphas, 1));
    const colors = new Float32Array(this.satrecs.length * 3);
    const tmp = new Color();
    this.satrecs.forEach((s, i) => {
      // Color by category for quick visual ID.
      const c = categoryColor(s.entry.category);
      tmp.setHex(c);
      colors[i * 3]     = tmp.r;
      colors[i * 3 + 1] = tmp.g;
      colors[i * 3 + 2] = tmp.b;
    });
    geom.setAttribute('color', new Float32BufferAttribute(colors, 3));

    this.mat = new ShaderMaterial({
      uniforms: { uOpacity: { value: 1.0 }, uPointSize: { value: 4.5 } },
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      vertexShader: `
        attribute float aAlpha;
        varying vec3 vColor;
        varying float vAlpha;
        uniform float uPointSize;
        void main() {
          vColor = color;
          vAlpha = aAlpha;
          gl_PointSize = uPointSize * step(0.001, aAlpha);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uOpacity;
        varying vec3 vColor;
        varying float vAlpha;
        void main() {
          vec2 c = gl_PointCoord - 0.5;
          float r = length(c);
          if (r > 0.5) discard;
          float a = smoothstep(0.5, 0.0, r);
          gl_FragColor = vec4(vColor, a * uOpacity * vAlpha);
        }
      `,
    });
    this.points = new Points(geom, this.mat);
    this.points.frustumCulled = false;
    this.object.add(this.points);
  }

  /**
   * Replace each satellite's bundled snapshot TLE with its CURRENT element
   * set from CelesTrak (via the /api/tle proxy), so positions are real and
   * not weeks-stale. Swaps satrecs in place — the satellite count and the
   * geometry buffers are unchanged, so the next frame simply propagates the
   * fresh elements. Per-satellite failures keep that satellite's bundled
   * snapshot; only if EVERY fetch fails do we surface a single toast.
   * Fire-and-forget: the layer already renders from the bundled snapshots,
   * so this is a best-effort upgrade, never a blocker.
   */
  async refreshFromCelesTrak(): Promise<void> {
    let anyOk = false;
    let anyFail = false;
    await Promise.all(this.satrecs.map(async (s) => {
      const norad = s.entry.noradId;
      if (!norad) { anyFail = true; return; }
      try {
        const r = await fetch(`/api/tle?catnr=${norad}`);
        if (!r.ok) throw new Error(`status ${r.status}`);
        const lines = (await r.text()).trim().split(/\r?\n/).map((l) => l.trimEnd());
        const l1 = lines.find((l) => l.startsWith('1 '));
        const l2 = lines.find((l) => l.startsWith('2 '));
        if (!l1 || !l2) throw new Error('no TLE lines in response');
        const rec = twoline2satrec(l1, l2);
        if (rec.error) throw new Error(`satrec error ${rec.error}`);
        s.rec = rec;
        anyOk = true;
      } catch {
        anyFail = true;
      }
    }));
    if (!anyOk && anyFail) {
      toast.warn(t('toast.tleFailed'));
    }
  }

  /**
   * Recompute satellite positions for the given Julian Date. Body positions
   * are emitted in Earth-centred ecliptic frame (AU, post-scaling), so the
   * caller adds `this.object` to Earth's group for free heliocentric tracking.
   */
  setEarthShadowFilter(enabled: boolean): void {
    this.earthShadowFilter = enabled;
  }

  update(jd: number, scaler: ScaleController, sunDirEcl?: Vector3): void {
    const date = jdToDate(jd);
    const gmst = gstime(date);
    void gmst; // SGP4 internally derives ECI; ECF transform unused here.

    // Earth-shadow cone test: a satellite is in shadow if it's on the
    // anti-sun side of Earth (sat·sun < 0) AND its perpendicular distance
    // from the Earth–sun axis is less than Earth's radius. Using a cylinder
    // approximation (umbra cone is essentially parallel at this scale).
    const earthRadiusKm = 6371;
    const sunDir = sunDirEcl?.clone().normalize();

    for (let i = 0; i < this.satrecs.length; i++) {
      const { rec } = this.satrecs[i];
      const result = propagate(rec, date);
      const pos = (result && typeof result === 'object' && 'position' in result)
        ? result.position
        : null;
      if (!pos || typeof pos !== 'object') {
        // Decay or numerical error — hide by collapsing to origin.
        this.positions[i * 3]     = 0;
        this.positions[i * 3 + 1] = 0;
        this.positions[i * 3 + 2] = 0;
        continue;
      }
      // SGP4 returns ECI (TEME, not exactly J2000) in km. For our visual
      // accuracy needs, treat as J2000-ish equatorial.
      const xEqKm = pos.x;
      const yEqKm = pos.y;
      const zEqKm = pos.z;

      // Equatorial → ecliptic: rotate around X by -obliquity.
      const cE = Math.cos(EARTH_TILT_RAD);
      const sE = Math.sin(EARTH_TILT_RAD);
      const xEclKm =  xEqKm;
      const yEclKm =  yEqKm * cE + zEqKm * sE;
      const zEclKm = -yEqKm * sE + zEqKm * cE;

      // km → AU; then apply moon-style scaling so satellites are visible
      // (otherwise LEO sat ≈ 4e-5 AU sub-pixel above Earth).
      const x_AU = xEclKm / AU_KM;
      const y_AU = yEclKm / AU_KM;
      const z_AU = zEclKm / AU_KM;
      const lenAU = Math.hypot(x_AU, y_AU, z_AU);
      const scaledLen = scaler.moonDistanceAU(lenAU);
      const k = lenAU > 0 ? scaledLen / lenAU : 0;

      // Note: scene-frame conversion is +X ecl→+X scene, +Y ecl→-Z scene,
      // +Z ecl→+Y scene (see frame.ts).
      this.positions[i * 3]     = x_AU * k;
      this.positions[i * 3 + 1] = z_AU * k;
      this.positions[i * 3 + 2] = -y_AU * k;

      // Shadow filter: check sat in geocentric ecliptic frame (km) against
      // Earth–sun axis. Skip if filter off or sun direction not provided.
      if (this.earthShadowFilter && sunDir) {
        // Sat position in ecliptic frame, in km (pre-scaling).
        const sx = xEclKm, sy = yEclKm, sz = zEclKm;
        const along = sx * sunDir.x + sy * sunDir.y + sz * sunDir.z;
        const inAntiSun = along < 0;
        const perpX = sx - along * sunDir.x;
        const perpY = sy - along * sunDir.y;
        const perpZ = sz - along * sunDir.z;
        const perpDist = Math.hypot(perpX, perpY, perpZ);
        const inUmbra = inAntiSun && perpDist < earthRadiusKm;
        this.alphas[i] = inUmbra ? 0 : 1;
      } else {
        this.alphas[i] = 1;
      }
    }
    const posAttr = this.points.geometry.attributes.position;
    (posAttr.array as Float32Array).set(this.positions);
    posAttr.needsUpdate = true;
    const alphaAttr = this.points.geometry.attributes.aAlpha;
    (alphaAttr.array as Float32Array).set(this.alphas);
    alphaAttr.needsUpdate = true;
  }

  setVisible(visible: boolean): void {
    this.object.visible = visible;
  }

  getSatellites(): readonly SatelliteEntry[] {
    return SATELLITES;
  }

  /**
   * Compute a single satellite's heliocentric ecliptic-frame position vector
   * in AU. Used by alt/az lookup in observer mode.
   */
  getEclipticPosition(id: string, jd: number, earthHelioAU: Vector3): Vector3 | null {
    const found = this.satrecs.find(s => s.entry.id === id);
    if (!found) return null;
    const date = jdToDate(jd);
    const result = propagate(found.rec, date);
    const pos = (result && typeof result === 'object' && 'position' in result)
      ? result.position
      : null;
    if (!pos || typeof pos !== 'object') return null;
    const cE = Math.cos(EARTH_TILT_RAD);
    const sE = Math.sin(EARTH_TILT_RAD);
    const xEcl =  pos.x;
    const yEcl =  pos.y * cE + pos.z * sE;
    const zEcl = -pos.y * sE + pos.z * cE;
    return new Vector3(
      xEcl / AU_KM + earthHelioAU.x,
      yEcl / AU_KM + earthHelioAU.y,
      zEcl / AU_KM + earthHelioAU.z,
    );
  }
}

function categoryColor(cat: SatelliteEntry['category']): number {
  switch (cat) {
    case 'space-station': return 0xffd76a;     // gold
    case 'observatory':   return 0x6fc5d8;     // cyan
    case 'navigation':    return 0xb691ff;     // violet
    case 'communication': return 0x6bff96;     // green
    case 'weather':       return 0xff9c6b;     // orange
  }
}

function jdToDate(jd: number): Date {
  // JD epoch is 4713 BC noon; UNIX is 1970-01-01 midnight.
  return new Date((jd - 2440587.5) * 86400000);
}
