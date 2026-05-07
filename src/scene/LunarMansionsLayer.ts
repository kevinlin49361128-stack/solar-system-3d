import {
  CanvasTexture,
  SpriteMaterial,
  Sprite,
  Group,
  Color,
  SRGBColorSpace,
} from 'three';
import { LUNAR_MANSIONS, PALACE_LABELS } from '../data/lunarMansions';
import { raDecToEcliptic } from '../physics/topocentric';
import { eclipticToScene } from '../physics/frame';

const DOME_RADIUS = 4100; // between Milky Way (4200) and DSO sphere (4000)

/**
 * 二十八宿 label sprites pinned to each mansion's determinative-star
 * direction on the celestial sphere. Each label shows the single-glyph
 * Chinese name (角/亢/氐 …) coloured by its palace (青龍/玄武/白虎/朱雀).
 *
 * Rendered as Sprites so labels always face the camera.
 */
export class LunarMansionsLayer {
  readonly object = new Group();

  constructor() {
    for (const m of LUNAR_MANSIONS) {
      const palace = PALACE_LABELS[m.palace];
      const tex = makeLabelTexture(m.glyph, palace.color);
      const mat = new SpriteMaterial({
        map: tex,
        transparent: true,
        depthWrite: false,
        depthTest: false,
      });
      const sprite = new Sprite(mat);
      sprite.userData.mansion = m;
      const dir = eclipticToScene(raDecToEcliptic(m.raHours, m.decDeg));
      sprite.position.copy(dir).multiplyScalar(DOME_RADIUS);
      sprite.scale.set(80, 80, 1);
      sprite.renderOrder = 200;
      this.object.add(sprite);
    }
    this.object.visible = false;
  }

  setVisible(v: boolean): void {
    this.object.visible = v;
  }
}

/**
 * Render a single Chinese glyph onto a 96×96 canvas with a coloured halo
 * and a hint of underline. Returns a Three.js CanvasTexture.
 */
function makeLabelTexture(glyph: string, hexColor: number): CanvasTexture {
  const SIZE = 96;
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, SIZE, SIZE);

  const c = new Color(hexColor);
  ctx.font = 'bold 64px "Noto Sans TC", "PingFang TC", "Microsoft JhengHei", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Halo layer.
  ctx.shadowColor = `rgba(${(c.r*255)|0}, ${(c.g*255)|0}, ${(c.b*255)|0}, 0.85)`;
  ctx.shadowBlur = 14;
  ctx.fillStyle = `rgba(${(c.r*255)|0}, ${(c.g*255)|0}, ${(c.b*255)|0}, 1.0)`;
  ctx.fillText(glyph, SIZE / 2, SIZE / 2);

  // Re-draw without halo for crisp letters.
  ctx.shadowBlur = 0;
  ctx.fillText(glyph, SIZE / 2, SIZE / 2);

  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}
