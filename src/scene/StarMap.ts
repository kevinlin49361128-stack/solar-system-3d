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
import { NAMED_STARS, type NamedStar } from '../data/stars';
import { CONSTELLATIONS } from '../data/constellations';
import { raDecToEcliptic } from '../physics/topocentric';
import { eclipticToScene } from '../physics/frame';
import { getLang, onLanguageChange } from '../i18n';

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

  constructor() {
    const positions: number[] = [];
    const colors: number[] = [];
    const sizes: number[] = [];
    const tmp = new Color();

    NAMED_STARS.forEach((s, i) => {
      const dirEcl = raDecToEcliptic(s.raHours, s.decDeg);
      const dirScene = eclipticToScene(dirEcl).multiplyScalar(STAR_DOME_RADIUS);
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

    // Constellation lines
    const linePositions: number[] = [];
    for (const c of CONSTELLATIONS) {
      for (const polyline of c.lines) {
        for (let k = 0; k < polyline.length - 1; k++) {
          const a = NAMED_STARS[this.idIndex.get(polyline[k]) ?? -1];
          const b = NAMED_STARS[this.idIndex.get(polyline[k + 1]) ?? -1];
          if (!a || !b) continue;
          const da = eclipticToScene(raDecToEcliptic(a.raHours, a.decDeg)).multiplyScalar(STAR_DOME_RADIUS);
          const db = eclipticToScene(raDecToEcliptic(b.raHours, b.decDeg)).multiplyScalar(STAR_DOME_RADIUS);
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
      NAMED_STARS.forEach((s) => {
        const dirEcl = raDecToEcliptic(s.raHours, s.decDeg);
        const dirScene = eclipticToScene(dirEcl).multiplyScalar(STAR_DOME_RADIUS * 0.99);
        const labelText = lang === 'en' ? s.nameEn
                        : lang === 'ja' ? (s.nameJa ?? s.nameEn)
                        : s.name;
        const sprite = makeStarLabelSprite(labelText);
        sprite.position.copy(dirScene);
        this.labels.add(sprite);
      });
    };
    buildLabels();
    onLanguageChange(buildLabels);
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
