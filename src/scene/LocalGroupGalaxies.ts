import {
  AdditiveBlending, CanvasTexture, Group, LinearFilter,
  Mesh, MeshBasicMaterial, PlaneGeometry,
  Sprite, SpriteMaterial, Vector3,
} from 'three';
import { galacticLBToVector, GALACTIC_TO_SCENE } from '../physics/galacticFrame';
import { langPick, onLanguageChange, type LangText } from '../i18n';

/**
 * Local Group galaxy billboards — adds named external galaxies as
 * visible objects at the galactic-tier zoom. Until v0.4 the only thing
 * outside the Milky Way disc was empty space; landing on TRAPPIST-1 was
 * impressive but the user never felt the "look how vast" moment of
 * seeing another galaxy floating nearby.
 *
 * Scale reality check (units = light-years; 1 scene unit = 1 ly):
 *   - Milky Way disc radius            ≈ 50 000 ly
 *   - LMC distance                     ≈ 163 000 ly  (apparent ~10° wide)
 *   - SMC                              ≈ 206 000 ly  (~ 5°)
 *   - M31 Andromeda                    ≈ 2 540 000 ly (~3°)
 *   - M33 Triangulum                   ≈ 2 730 000 ly (~1°)
 *   - Sculptor Dwarf                   ≈ 290 000 ly
 *   - Fornax Dwarf                     ≈ 460 000 ly
 *   - Leo I                            ≈ 820 000 ly
 *   - NGC 6822 (Barnard's Galaxy)      ≈ 1 630 000 ly
 *
 * The default galactic-tier camera distance is 60 000 ly — well inside
 * the Milky Way disc — so these distant billboards subtend the same
 * apparent angles they do from Earth. From inside our disc looking out
 * the Magellanic Clouds dominate the southern sky and Andromeda is a
 * fingertip-sized smudge in the north — matches real visual experience.
 *
 * Visuals:
 *   - Each billboard is a quad Mesh facing the camera, textured with a
 *     procedurally-drawn fuzzy ellipse (canvas + radial gradient). Spiral
 *     galaxies (M31, M33) get a faint banding hint; irregulars (LMC, SMC)
 *     are featureless blobs; dwarfs are small fuzzballs.
 *   - World-space size = 2 · distance · tan(angular_radius), so on-screen
 *     size auto-matches the real apparent diameter from Earth.
 *   - Float-up label sprite above each (same look as exoplanet halos).
 *
 * Picking: hooks into the existing raycast pipeline via userData.
 * localGroupGalaxyId; main.ts opens InfoPanel.showLocalGroupGalaxy(meta)
 * on hit.
 */

export interface LocalGroupGalaxyMeta {
  /** Stable id used for picking and i18n keys. */
  id: string;
  /** Display name as a LangText. */
  name: LangText;
  /** English short name for catalogue / a11y. */
  nameEn: string;
  /** Galactic coordinates: longitude (°, l), latitude (°, b). */
  lDeg: number;
  bDeg: number;
  /** Distance from Sol in light-years. */
  distanceLy: number;
  /** Apparent angular diameter as seen from Earth, in degrees. */
  appAngularDeg: number;
  /** Position angle of the major axis (°) — orientation hint for the
   *  billboard. 0 = vertical, 90 = horizontal. */
  paDeg: number;
  /** Aspect ratio (minor / major axis). 1 = circular; 0.3 = highly elongated. */
  aspect: number;
  /** Visual classification — purely for the texture renderer's choice
   *  of style. */
  morphology: 'spiral' | 'irregular' | 'dwarf-elliptical' | 'dwarf-spheroidal';
  /** Hex base colour. Spirals warmer (older stars dominate), irregulars
   *  bluer (active star formation), dwarfs faded. */
  colour: number;
  /** One-line description, surfaced in the InfoPanel. */
  description: LangText;
}

export const LOCAL_GROUP_GALAXIES: LocalGroupGalaxyMeta[] = [
  {
    id: 'lmc',
    name: { 'zh-Hant': '大麥哲倫雲 (LMC)', en: 'Large Magellanic Cloud', ja: '大マゼラン雲' },
    nameEn: 'LMC',
    lDeg: 280.5, bDeg: -32.9, distanceLy: 163_000,
    appAngularDeg: 10.5, paDeg: 170, aspect: 0.7,
    morphology: 'irregular', colour: 0xb8ccff,
    description: {
      'zh-Hant': '南天最大的衛星星系，1987 年超新星 SN 1987A 的母星系。',
      en: 'Largest Milky Way satellite. Host of supernova SN 1987A.',
      ja: '南天で最大の伴銀河。超新星SN 1987Aの母銀河。',
    },
  },
  {
    id: 'smc',
    name: { 'zh-Hant': '小麥哲倫雲 (SMC)', en: 'Small Magellanic Cloud', ja: '小マゼラン雲' },
    nameEn: 'SMC',
    lDeg: 302.8, bDeg: -44.3, distanceLy: 206_000,
    appAngularDeg: 5.0, paDeg: 45, aspect: 0.6,
    morphology: 'irregular', colour: 0xc4d8ff,
    description: {
      'zh-Hant': 'LMC 的伴星系，與 LMC 一起繞銀河系運行的衛星。',
      en: 'Companion to the LMC; together they orbit the Milky Way.',
      ja: 'LMCの伴銀河で、共に天の川銀河を周回する。',
    },
  },
  {
    id: 'm31',
    name: { 'zh-Hant': '仙女座星系 M31', en: 'Andromeda Galaxy (M31)', ja: 'アンドロメダ銀河 M31' },
    nameEn: 'M31',
    lDeg: 121.2, bDeg: -21.6, distanceLy: 2_540_000,
    appAngularDeg: 3.2, paDeg: 35, aspect: 0.32,
    morphology: 'spiral', colour: 0xfff0d8,
    description: {
      'zh-Hant': '本星系群最大成員，將於 ~45 億年後與銀河系合併。',
      en: 'Largest member of the Local Group. Will merge with the Milky Way in ~4.5 Gyr.',
      ja: '局所銀河群最大の銀河。約45億年後に天の川銀河と合体予定。',
    },
  },
  {
    id: 'm33',
    name: { 'zh-Hant': '三角座星系 M33', en: 'Triangulum Galaxy (M33)', ja: 'さんかく座銀河 M33' },
    nameEn: 'M33',
    lDeg: 133.6, bDeg: -31.3, distanceLy: 2_730_000,
    appAngularDeg: 1.2, paDeg: 23, aspect: 0.55,
    morphology: 'spiral', colour: 0xffe8c0,
    description: {
      'zh-Hant': '本星系群第三大成員，肉眼極限可見的最遠天體。',
      en: 'Third-largest Local Group member. The most distant object visible to the naked eye.',
      ja: '局所銀河群で3番目に大きく、肉眼で見える最遠の天体。',
    },
  },
  {
    id: 'sculptor-dwarf',
    name: { 'zh-Hant': '玉夫座矮星系', en: 'Sculptor Dwarf', ja: 'ちょうこくしつ矮銀河' },
    nameEn: 'Sculptor Dwarf',
    lDeg: 287.5, bDeg: -83.2, distanceLy: 290_000,
    appAngularDeg: 0.7, paDeg: 90, aspect: 0.6,
    morphology: 'dwarf-spheroidal', colour: 0xd8d0bc,
    description: {
      'zh-Hant': '銀河系衛星矮星系，1938 年發現。',
      en: 'Milky Way satellite dwarf, discovered 1938.',
      ja: '1938年発見の銀河系の伴矮銀河。',
    },
  },
  {
    id: 'fornax-dwarf',
    name: { 'zh-Hant': '天爐座矮星系', en: 'Fornax Dwarf', ja: 'ろ座矮銀河' },
    nameEn: 'Fornax Dwarf',
    lDeg: 237.1, bDeg: -65.7, distanceLy: 460_000,
    appAngularDeg: 0.6, paDeg: 41, aspect: 0.65,
    morphology: 'dwarf-spheroidal', colour: 0xd0c8b8,
    description: {
      'zh-Hant': '含有 6 個球狀星團，是局部群中最豐富的矮星系之一。',
      en: 'Contains 6 globular clusters — one of the richest dwarfs in the Local Group.',
      ja: '6個の球状星団を持つ、局所群で最も豊かな矮銀河の一つ。',
    },
  },
  {
    id: 'leo-i',
    name: { 'zh-Hant': '獅子座 I 矮星系', en: 'Leo I Dwarf', ja: 'しし座I矮銀河' },
    nameEn: 'Leo I',
    lDeg: 226.0, bDeg: 49.1, distanceLy: 820_000,
    appAngularDeg: 0.16, paDeg: 78, aspect: 0.7,
    morphology: 'dwarf-spheroidal', colour: 0xc8c0a8,
    description: {
      'zh-Hant': '銀河系最遠的衛星星系之一，可能不受重力束縛。',
      en: 'One of the most distant Milky Way satellites; possibly unbound.',
      ja: '銀河系で最遠の伴銀河の一つ。重力的に束縛されていない可能性。',
    },
  },
  {
    id: 'ngc-6822',
    name: { 'zh-Hant': 'NGC 6822 (巴納德星系)', en: 'NGC 6822 (Barnard\'s Galaxy)', ja: 'NGC 6822（バーナード銀河）' },
    nameEn: 'NGC 6822',
    lDeg: 25.3, bDeg: -18.4, distanceLy: 1_630_000,
    appAngularDeg: 0.25, paDeg: 10, aspect: 0.5,
    morphology: 'irregular', colour: 0xbcc8e8,
    description: {
      'zh-Hant': '巴納德 1884 年發現，是 LMC 之外最近的氣體豐富矮不規則星系。',
      en: 'Discovered by Barnard 1884; closest gas-rich dwarf irregular outside the LMC.',
      ja: '1884年バーナード発見。LMC以外で最も近いガス豊富な矮不規則銀河。',
    },
  },
];

export class LocalGroupGalaxies {
  readonly group = new Group();
  readonly pickables: Mesh[] = [];
  private entries: Array<{
    meta: LocalGroupGalaxyMeta;
    mesh: Mesh;
    label: Sprite;
    sceneScale: number;
  }> = [];
  constructor() {
    for (const meta of LOCAL_GROUP_GALAXIES) {
      this.add(meta);
    }
    // Hidden by default — main loop will fade it in via setOpacity at
    // the galactic tier.
    this.group.visible = false;
    // Re-render labels on language change so M31 / Andromeda Galaxy /
    // アンドロメダ銀河 swap correctly.
    onLanguageChange(() => this.relabelAll());
  }

  /** Set group opacity. Galactic tier weights typically drive this. */
  setOpacity(o: number): void {
    const clamped = Math.max(0, Math.min(1, o));
    this.group.visible = clamped > 0.02;
    for (const e of this.entries) {
      (e.mesh.material as MeshBasicMaterial).opacity = clamped * 0.85;
      (e.label.material as SpriteMaterial).opacity = clamped;
    }
  }

  /** Per-frame: keep billboards facing the camera. */
  update(cameraPos: Vector3): void {
    if (!this.group.visible) return;
    for (const e of this.entries) {
      e.mesh.lookAt(cameraPos);
      e.label.lookAt(cameraPos);
    }
  }

  private add(meta: LocalGroupGalaxyMeta): void {
    // Direction unit vector in galactic frame, transformed to scene.
    const dir = galacticLBToVector(meta.lDeg, meta.bDeg);
    const pos = dir.clone().applyMatrix4(GALACTIC_TO_SCENE).multiplyScalar(meta.distanceLy);

    // World-space major-axis size = 2 · d · tan(angRadius)
    const angRad = (meta.appAngularDeg / 2) * Math.PI / 180;
    const majorAxis = 2 * meta.distanceLy * Math.tan(angRad);
    const minorAxis = majorAxis * meta.aspect;

    // Procedural billboard texture (canvas) — keeps the build asset-free.
    const tex = makeGalaxyTexture(meta);
    const mat = new MeshBasicMaterial({
      map: tex,
      color: meta.colour,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: AdditiveBlending,
      side: 2,  // DoubleSide
    });
    const geom = new PlaneGeometry(majorAxis, minorAxis);
    const mesh = new Mesh(geom, mat);
    mesh.position.copy(pos);
    mesh.rotation.z = (meta.paDeg * Math.PI / 180);
    mesh.userData.localGroupGalaxyId = meta.id;
    mesh.renderOrder = -2;  // behind exoplanet halos (-1) but in front of disk

    this.group.add(mesh);
    this.pickables.push(mesh);

    // Label sprite — offset perpendicular to the disc by major-axis * 0.65
    // so it doesn't overlap the galaxy itself.
    const labelTex = makeLabelTexture(langPick(meta.name));
    const labelMat = new SpriteMaterial({
      map: labelTex, transparent: true, opacity: 0, depthWrite: false,
    });
    const label = new Sprite(labelMat);
    const labelOffset = majorAxis * 0.6;
    label.position.copy(pos).add(new Vector3(0, labelOffset, 0));
    label.scale.set(majorAxis * 1.5, majorAxis * 0.4, 1);
    this.group.add(label);

    this.entries.push({ meta, mesh, label, sceneScale: majorAxis });
  }

  private relabelAll(): void {
    for (const e of this.entries) {
      const oldMat = e.label.material as SpriteMaterial;
      const oldOpacity = oldMat.opacity;
      oldMat.map?.dispose();
      oldMat.dispose();
      const tex = makeLabelTexture(langPick(e.meta.name));
      e.label.material = new SpriteMaterial({
        map: tex, transparent: true, opacity: oldOpacity, depthWrite: false,
      });
    }
  }

  /** Picking helper — given a hit Mesh's userData, return its meta. */
  resolvePick(userData: { localGroupGalaxyId?: string }): LocalGroupGalaxyMeta | null {
    if (!userData?.localGroupGalaxyId) return null;
    return LOCAL_GROUP_GALAXIES.find(g => g.id === userData.localGroupGalaxyId) ?? null;
  }
}

/**
 * Build a galaxy "blob" texture procedurally — a radial Gaussian
 * brightness profile with morphology-specific embellishments.
 * Returns a 256×128 CanvasTexture (2:1 aspect so the planar geometry
 * doesn't need to be UV-stretched).
 */
function makeGalaxyTexture(meta: LocalGroupGalaxyMeta): CanvasTexture {
  const W = 256, H = 128;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  // Base radial Gaussian (brightness peaks at centre, falls off).
  const grad = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W / 2);
  grad.addColorStop(0,    'rgba(255,255,255,1.0)');
  grad.addColorStop(0.25, 'rgba(220,220,220,0.85)');
  grad.addColorStop(0.55, 'rgba(180,180,180,0.45)');
  grad.addColorStop(1.0,  'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  // Elliptical fill via canvas scaling to make the gradient an ellipse.
  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.scale(1, 0.5);
  ctx.beginPath();
  ctx.arc(0, 0, W / 2, 0, 2 * Math.PI);
  ctx.fill();
  ctx.restore();

  // Spiral hint — faint dust-lane band across the middle.
  if (meta.morphology === 'spiral') {
    ctx.save();
    ctx.translate(W / 2, H / 2);
    const dust = ctx.createLinearGradient(-W / 2, 0, W / 2, 0);
    dust.addColorStop(0,   'rgba(0,0,0,0)');
    dust.addColorStop(0.4, 'rgba(0,0,0,0.35)');
    dust.addColorStop(0.5, 'rgba(0,0,0,0.45)');
    dust.addColorStop(0.6, 'rgba(0,0,0,0.35)');
    dust.addColorStop(1,   'rgba(0,0,0,0)');
    ctx.fillStyle = dust;
    ctx.fillRect(-W / 2, -2, W, 4);
    ctx.restore();
  }

  // Irregular: scatter a few brighter "knots" for visual variety (HII
  // regions in LMC's case — the 30 Doradus look).
  if (meta.morphology === 'irregular') {
    ctx.save();
    ctx.translate(W / 2, H / 2);
    for (let i = 0; i < 5; i++) {
      const r = (Math.random() - 0.5) * W * 0.6;
      const t = (Math.random() - 0.5) * H * 0.5;
      const radius = 4 + Math.random() * 6;
      const knot = ctx.createRadialGradient(r, t, 0, r, t, radius);
      knot.addColorStop(0, 'rgba(255,255,255,0.55)');
      knot.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = knot;
      ctx.beginPath();
      ctx.arc(r, t, radius, 0, 2 * Math.PI);
      ctx.fill();
    }
    ctx.restore();
  }

  const tex = new CanvasTexture(canvas);
  tex.minFilter = LinearFilter;
  tex.magFilter = LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

/** Simple text label texture matching the look of exoplanet halo labels. */
function makeLabelTexture(text: string): CanvasTexture {
  const W = 512, H = 96;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  ctx.font = '600 36px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  // Outline for contrast against the bright Milky Way background.
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.85)';
  ctx.lineWidth = 5;
  ctx.strokeText(text, W / 2, H / 2);
  ctx.fillStyle = 'rgba(220, 230, 255, 0.95)';
  ctx.fillText(text, W / 2, H / 2);
  const tex = new CanvasTexture(canvas);
  tex.minFilter = LinearFilter;
  tex.magFilter = LinearFilter;
  tex.needsUpdate = true;
  return tex;
}
