import {
  BufferGeometry,
  CanvasTexture,
  Color,
  Float32BufferAttribute,
  Group,
  LineBasicMaterial,
  LineSegments,
  Points,
  PointsMaterial,
  Sprite,
  SpriteMaterial,
} from 'three';
import { Vector3 } from 'three';
import { NAMED_STARS, type NamedStar } from '../data/stars';
import { CONSTELLATIONS } from '../data/constellations';
import { raDecToEcliptic, applyProperMotion, applyAberration } from '../physics/topocentric';
import { eclipticToScene } from '../physics/frame';
import { getLang, onLanguageChange } from '../i18n';
import { J2000_JD } from '../physics/constants';

const STAR_DOME_RADIUS = 4000;
const STAR_LABEL_SCALE = 60; // sprite size in dome units; tuned for ~12 px on screen

/**
 * Renders the named bright stars as 3D points (size scaled by magnitude) and
 * the constellation lines connecting them. Both are placed on a sphere of
 * radius `STAR_DOME_RADIUS` so they appear at infinity to the camera.
 */
export class StarMap {
  readonly points: Points;
  readonly lines: LineSegments;
  readonly labels: Group;

  private readonly idIndex = new Map<string, number>();
  private linesUserVisible = false;
  private labelsUserVisible = false;
  /** JD of the most recent setEpoch() call. We throttle re-evaluation
   *  so per-frame 60 Hz playback doesn't redo the whole loop every
   *  frame — PM is hundredths of an arcsec per day, so updates every
   *  ~10 sim-days are visually indistinguishable from per-frame. */
  private lastEpochJd = J2000_JD;
  /** Cached for label re-positioning when language changes mid-session. */
  private currentEarthSunDirEcl: Vector3 | null = null;
  /** Per-star scene positions at the current epoch — cached so the
   *  label-rebuild path (triggered by language change) doesn't have to
   *  redo PM math. */
  private scenePositions: Vector3[] = [];

  constructor() {
    const positions: number[] = [];
    const colors: number[] = [];
    const sizes: number[] = [];
    const tmp = new Color();

    NAMED_STARS.forEach((s, i) => {
      // J2000 reference positions at construction time. setEpoch(jd) will
      // overwrite this buffer with proper-motion-corrected positions on
      // each meaningful sim-time change.
      const dirScene = starScenePosition(s, J2000_JD, null);
      this.scenePositions.push(dirScene);
      positions.push(dirScene.x, dirScene.y, dirScene.z);

      // Brighter (lower mag) → larger + whiter; faint (higher mag) → smaller + dimmer.
      const m = s.magnitude;
      const brightness = Math.max(0.4, 1.0 - m * 0.18);
      tmp.setRGB(brightness, brightness, brightness * 0.95);
      colors.push(tmp.r, tmp.g, tmp.b);

      // Unused for plain Points (no per-vertex size), kept for future shader.
      sizes.push(Math.max(1.5, 5 - m * 0.6));

      this.idIndex.set(s.id, i);
    });

    const pointsGeom = new BufferGeometry();
    pointsGeom.setAttribute('position', new Float32BufferAttribute(positions, 3));
    pointsGeom.setAttribute('color', new Float32BufferAttribute(colors, 3));
    // Round point sprite — without an alpha map, PointsMaterial renders
     // each point as a solid 3×3 px square. Generate a soft radial alpha
     // gradient once and reuse it as a circular sprite for all named stars.
    const pointsMat = new PointsMaterial({
      size: 5,
      sizeAttenuation: false,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      map: makeRoundPointTexture(),
      alphaTest: 0.01,
    });
    this.points = new Points(pointsGeom, pointsMat);
    this.points.frustumCulled = false;

    // Constellation lines — uses the same scenePositions array so the
    // lines automatically stay anchored to their stars under PM updates.
    const linePositions: number[] = [];
    for (const c of CONSTELLATIONS) {
      for (const polyline of c.lines) {
        for (let k = 0; k < polyline.length - 1; k++) {
          const ia = this.idIndex.get(polyline[k]) ?? -1;
          const ib = this.idIndex.get(polyline[k + 1]) ?? -1;
          if (ia < 0 || ib < 0) continue;
          const da = this.scenePositions[ia];
          const db = this.scenePositions[ib];
          linePositions.push(da.x, da.y, da.z, db.x, db.y, db.z);
        }
      }
    }
    const lineGeom = new BufferGeometry();
    lineGeom.setAttribute('position', new Float32BufferAttribute(linePositions, 3));
    const lineMat = new LineBasicMaterial({
      color: 0x6090d0,
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
    });
    this.lines = new LineSegments(lineGeom, lineMat);
    this.lines.frustumCulled = false;
    this.lines.visible = this.linesUserVisible;

    // Star name labels — one Sprite per named star, placed at its position
    // on the dome. Toggleable; off by default to keep the sky uncluttered.
    this.labels = new Group();
    this.labels.frustumCulled = false;
    this.labels.visible = this.labelsUserVisible;
    const buildLabels = () => {
      // Clear existing children before rebuilding (called both at
      // construction and after a language switch).
      while (this.labels.children.length > 0) {
        const child = this.labels.children[0];
        this.labels.remove(child);
        // dispose sprite material + texture if present
        const mat = (child as unknown as { material?: { map?: { dispose: () => void }; dispose: () => void } }).material;
        if (mat) {
          mat.map?.dispose();
          mat.dispose();
        }
      }
      const lang = getLang();
      NAMED_STARS.forEach((s, i) => {
        // Use the cached scenePositions (already PM-corrected if setEpoch
        // has been called) and scale just slightly inside the dome so
        // labels render in front of the constellation lines.
        const dirScene = this.scenePositions[i].clone().multiplyScalar(0.99);
        const labelText = lang === 'en' ? s.nameEn
                        : lang === 'ja' ? (s.nameJa ?? s.nameEn)
                        : s.name;
        const sprite = makeStarLabelSprite(labelText);
        sprite.position.copy(dirScene);
        this.labels.add(sprite);
      });
    };
    buildLabels();
    // Language change rebuilds labels using whatever positions the
    // scenePositions array holds at that moment — already PM-corrected
    // if setEpoch has been called since startup.
    onLanguageChange(buildLabels);
  }

  /**
   * Recompute star positions for a new epoch — applies proper motion
   * (from each NamedStar's pmRA/pmDec, mas/yr Hipparcos values) and
   * optionally annual aberration (using Earth's heliocentric direction
   * as passed in). Called from the per-frame hook in main.ts but
   * throttled internally so 60 Hz playback doesn't recompute every
   * frame — PM is sub-arcsec per day, so updates every ~10 sim-days
   * are visually indistinguishable from per-frame.
   *
   * Drives THREE buffer updates:
   *   - this.points (BufferGeometry.position)
   *   - this.lines  (BufferGeometry.position, constellation lines)
   *   - this.labels (Sprite positions, one per named star)
   *
   * Sub-arcsec accuracy for ±500 yr; linear-PM approximation drifts
   * at the second-derivative-of-PM scale past that (Barnard's Star
   * accumulates ~1° secular error by ±1000 yr). Good enough for
   * "scrub the clock and watch the sky shift" visualisation.
   */
  setEpoch(jd: number, earthSunDirEcl: Vector3 | null = null): void {
    // Throttle: 10 sim-days ≈ Barnard's Star moves 0.014 px on a 4000-unit
    // dome at 1080p — well below pixel rounding. For PM purposes this is
    // imperceptible; aberration cycles annually so it's also fine at 10 d.
    const earthChanged = !!earthSunDirEcl && (
      !this.currentEarthSunDirEcl
      || this.currentEarthSunDirEcl.distanceToSquared(earthSunDirEcl) > 1e-6
    );
    if (Math.abs(jd - this.lastEpochJd) < 10 && !earthChanged) return;
    this.lastEpochJd = jd;
    if (earthSunDirEcl) {
      this.currentEarthSunDirEcl = this.currentEarthSunDirEcl ?? new Vector3();
      this.currentEarthSunDirEcl.copy(earthSunDirEcl);
    }

    // Recompute every named-star scene position with PM + aberration.
    for (let i = 0; i < NAMED_STARS.length; i++) {
      const s = NAMED_STARS[i];
      const next = starScenePosition(s, jd, earthSunDirEcl);
      this.scenePositions[i].copy(next);
    }

    // Push to the Points geometry buffer.
    const posAttr = this.points.geometry.getAttribute('position') as Float32BufferAttribute;
    for (let i = 0; i < NAMED_STARS.length; i++) {
      const p = this.scenePositions[i];
      posAttr.setXYZ(i, p.x, p.y, p.z);
    }
    posAttr.needsUpdate = true;

    // Push to the constellation-line geometry buffer.
    const lineAttr = this.lines.geometry.getAttribute('position') as Float32BufferAttribute;
    let writeIndex = 0;
    for (const c of CONSTELLATIONS) {
      for (const polyline of c.lines) {
        for (let k = 0; k < polyline.length - 1; k++) {
          const ia = this.idIndex.get(polyline[k]) ?? -1;
          const ib = this.idIndex.get(polyline[k + 1]) ?? -1;
          if (ia < 0 || ib < 0) continue;
          const da = this.scenePositions[ia];
          const db = this.scenePositions[ib];
          lineAttr.setXYZ(writeIndex++, da.x, da.y, da.z);
          lineAttr.setXYZ(writeIndex++, db.x, db.y, db.z);
        }
      }
    }
    lineAttr.needsUpdate = true;

    // Push to the label sprites — they're individual Object3Ds, no buffer.
    for (let i = 0; i < this.labels.children.length && i < NAMED_STARS.length; i++) {
      this.labels.children[i].position.copy(this.scenePositions[i]).multiplyScalar(0.99);
    }
  }

  /** Current epoch (JD) the star positions were computed at. */
  getEpoch(): number { return this.lastEpochJd; }

  /**
   * Return the current PM + aberration corrected scene position for a
   * named star (by ID), or null if unknown. Cached — no recomputation;
   * callers that need exact visual alignment (selection brackets, hit
   * detection) should use this rather than re-projecting from J2000
   * catalog RA/Dec or they'll be offset from the actual sprite by the
   * accumulated PM drift since J2000.
   *
   * Returned vector is owned by the StarMap and should not be mutated
   * (it's the live cache entry). Clone it before chaining operations.
   */
  getStarScenePosition(starId: string): Vector3 | null {
    const i = this.idIndex.get(starId);
    return i === undefined ? null : this.scenePositions[i];
  }

  /** Walk every named-star's cached position. The callback receives the
   *  star and its current scene position; used by the hit-test path. */
  forEachStarScenePosition(cb: (s: NamedStar, pos: Vector3) => void): void {
    for (let i = 0; i < NAMED_STARS.length; i++) {
      cb(NAMED_STARS[i], this.scenePositions[i]);
    }
  }

  setOpacity(opacity: number): void {
    (this.points.material as PointsMaterial).opacity = opacity;
    (this.lines.material as LineBasicMaterial).opacity = opacity * 0.4;
    this.points.visible = opacity > 0.01;
    // Don't override the user's lines toggle — only fade them with day/night.
    this.lines.visible = this.linesUserVisible && opacity > 0.01;
  }

  setLinesVisible(visible: boolean): void {
    this.linesUserVisible = visible;
    this.lines.visible = visible;
  }

  setLabelsVisible(visible: boolean): void {
    this.labelsUserVisible = visible;
    this.labels.visible = visible;
  }

  /** Get the named star by ID, used by search bar. */
  static getStar(id: string): NamedStar | undefined {
    return NAMED_STARS.find(s => s.id === id);
  }
}

/**
 * Compute a named star's scene position at a given epoch, with optional
 * annual aberration applied.
 *
 *   - Proper motion: classical linear approximation, valid to sub-arcsec
 *     for ±500 yr from J2000. Catalogue pmRA / pmDec are the Hipparcos
 *     mas/yr values (pmRA is already cos(dec)-corrected).
 *   - Aberration: shift toward Earth's heliocentric velocity. Skipped if
 *     no Earth direction is supplied (e.g. at module load time).
 *
 * Returns a Vector3 on the STAR_DOME_RADIUS sphere in scene coordinates.
 */
export function starScenePosition(
  star: NamedStar, jd: number, earthSunDirEcl: Vector3 | null,
): Vector3 {
  let raHours = star.raHours;
  let decDeg = star.decDeg;
  if (star.pmRA !== undefined && star.pmDec !== undefined && jd !== J2000_JD) {
    const corr = applyProperMotion(raHours, decDeg, jd, star.pmRA, star.pmDec);
    raHours = corr.raHours;
    decDeg = corr.decDeg;
  }
  let dirEcl = raDecToEcliptic(raHours, decDeg, jd);
  if (earthSunDirEcl) {
    dirEcl = applyAberration(dirEcl, earthSunDirEcl);
  }
  return eclipticToScene(dirEcl).multiplyScalar(STAR_DOME_RADIUS);
}

/**
 * Generates a soft circular alpha texture (radial gradient: opaque white
 * centre → transparent edge) used as the point sprite for named stars.
 * Without this, `PointsMaterial` renders each point as a hard square the
 * size of `size` px — the visual artifact that prompted this fix.
 *
 * The gradient is gamma-soft (smoothstep) so stars look like little dots,
 * not crisp discs that would expose pixel-grid aliasing at small sizes.
 * Module-level cached so all 84 stars share one GPU texture.
 */
let _roundPointTexture: CanvasTexture | null = null;
function makeRoundPointTexture(): CanvasTexture {
  if (_roundPointTexture) return _roundPointTexture;
  const SIZE = 32;
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(SIZE / 2, SIZE / 2, 0, SIZE / 2, SIZE / 2, SIZE / 2);
  grad.addColorStop(0.0, 'rgba(255,255,255,1.0)');
  grad.addColorStop(0.4, 'rgba(255,255,255,0.85)');
  grad.addColorStop(0.7, 'rgba(255,255,255,0.25)');
  grad.addColorStop(1.0, 'rgba(255,255,255,0.0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, SIZE, SIZE);
  _roundPointTexture = new CanvasTexture(canvas);
  _roundPointTexture.needsUpdate = true;
  return _roundPointTexture;
}

function makeStarLabelSprite(text: string): Sprite {
  const fontSize = 32;
  const padding = 6;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  ctx.font = `${fontSize}px -apple-system, "PingFang TC", sans-serif`;
  const metrics = ctx.measureText(text);
  const w = Math.ceil(metrics.width) + padding * 2;
  const h = fontSize + padding * 2;
  canvas.width = w;
  canvas.height = h;
  ctx.font = `${fontSize}px -apple-system, "PingFang TC", sans-serif`;
  ctx.fillStyle = 'rgba(0,0,0,0)';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#ffd76a';
  ctx.shadowColor = 'rgba(0,0,0,0.95)';
  ctx.shadowBlur = 6;
  ctx.textBaseline = 'middle';
  ctx.fillText(text, padding, h / 2);

  const tex = new CanvasTexture(canvas);
  tex.needsUpdate = true;

  const mat = new SpriteMaterial({
    map: tex,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });
  const sprite = new Sprite(mat);
  const aspect = w / h;
  sprite.scale.set(STAR_LABEL_SCALE * aspect, STAR_LABEL_SCALE, 1);
  sprite.renderOrder = 998;
  return sprite;
}
