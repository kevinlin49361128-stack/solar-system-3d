/**
 * Famous NGC / IC deep-sky objects beyond the Messier catalogue. Selection
 * focuses on visually-rewarding targets popular among amateur astronomers:
 * dark nebulae, edge-on galaxies, planetary nebulae, large-aperture clusters.
 *
 * Same shape as MessierObject so they share rendering / sky-panel pipeline.
 * Coordinates J2000.
 */

import type { MessierType } from './messier';

export interface NGCObject {
  id: string;
  name: string;
  nameEn: string;
  type: MessierType;
  raHours: number;
  decDeg: number;
  magnitude: number;
  constellation: string;
}

export const NGC_DATA: NGCObject[] = [
  // ── Iconic emission / reflection nebulae ──────────────────────────────
  { id: 'NGC 7000',  name: '北美洲星雲',       nameEn: 'North America Nebula',  type: 'N',   raHours: 20.9833, decDeg:  44.3333, magnitude: 4.0,  constellation: 'Cyg' },
  { id: 'IC 5070',   name: '鵜鶘星雲',         nameEn: 'Pelican Nebula',         type: 'N',   raHours: 20.8333, decDeg:  44.3667, magnitude: 8.0,  constellation: 'Cyg' },
  { id: 'NGC 1499',  name: '加州星雲',         nameEn: 'California Nebula',      type: 'N',   raHours:  4.0667, decDeg:  36.4167, magnitude: 5.0,  constellation: 'Per' },
  { id: 'NGC 2024',  name: '火焰星雲',         nameEn: 'Flame Nebula',           type: 'N',   raHours:  5.6817, decDeg:  -1.8500, magnitude: 10.0, constellation: 'Ori' },
  { id: 'IC 434',    name: '馬頭星雲',         nameEn: 'Horsehead Nebula',       type: 'N',   raHours:  5.6800, decDeg:  -2.4500, magnitude: 6.8,  constellation: 'Ori' },
  { id: 'IC 410',    name: '蝌蚪星雲',         nameEn: 'Tadpoles Nebula',        type: 'N',   raHours:  5.3700, decDeg:  33.4667, magnitude: 7.5,  constellation: 'Aur' },
  { id: 'IC 405',    name: '火焰星星雲',       nameEn: 'Flaming Star Nebula',    type: 'N',   raHours:  5.2667, decDeg:  34.2500, magnitude: 10.0, constellation: 'Aur' },
  { id: 'NGC 7635',  name: '泡泡星雲',         nameEn: 'Bubble Nebula',          type: 'N',   raHours: 23.3475, decDeg:  61.2000, magnitude: 11.0, constellation: 'Cas' },
  { id: 'NGC 2237',  name: '玫瑰星雲',         nameEn: 'Rosette Nebula',         type: 'N',   raHours:  6.5333, decDeg:   4.9500, magnitude: 9.0,  constellation: 'Mon' },
  { id: 'NGC 281',   name: '小精靈星雲',       nameEn: 'Pacman Nebula',          type: 'N',   raHours:  0.8800, decDeg:  56.6167, magnitude: 7.4,  constellation: 'Cas' },
  { id: 'NGC 1333',  name: '英仙座 NGC 1333',  nameEn: 'NGC 1333',               type: 'N',   raHours:  3.4900, decDeg:  31.3667, magnitude: 6.0,  constellation: 'Per' },
  { id: 'NGC 7822',  name: '質子星雲',         nameEn: 'NGC 7822',               type: 'N',   raHours:  0.0333, decDeg:  68.6000, magnitude: 7.0,  constellation: 'Cep' },
  { id: 'NGC 1973',  name: '奔跑人星雲',       nameEn: 'Running Man Nebula',     type: 'N',   raHours:  5.5933, decDeg:  -4.7333, magnitude: 7.0,  constellation: 'Ori' },
  { id: 'NGC 6334',  name: '貓爪星雲',         nameEn: "Cat's Paw Nebula",       type: 'N',   raHours: 17.3450, decDeg: -35.7167, magnitude: 10.0, constellation: 'Sco' },
  { id: 'NGC 6357',  name: '戰爭與和平星雲',   nameEn: 'War and Peace Nebula',   type: 'N',   raHours: 17.4083, decDeg: -34.2000, magnitude: 8.0,  constellation: 'Sco' },
  { id: 'NGC 6188',  name: '鬥龍星雲',         nameEn: 'Fighting Dragons',       type: 'N',   raHours: 16.6333, decDeg: -48.7333, magnitude: 5.2,  constellation: 'Ara' },
  { id: 'NGC 7822-2',name: '靈魂星雲',         nameEn: 'Soul Nebula',            type: 'N',   raHours:  2.9300, decDeg:  60.7833, magnitude: 6.5,  constellation: 'Cas' },
  { id: 'IC 1805',   name: '心臟星雲',         nameEn: 'Heart Nebula',           type: 'N',   raHours:  2.5500, decDeg:  61.4500, magnitude: 6.5,  constellation: 'Cas' },

  // ── Veil Nebula (Cygnus Loop SNR) ─────────────────────────────────────
  { id: 'NGC 6960',  name: '面紗星雲・西',     nameEn: 'Veil Nebula (West)',     type: 'SNR', raHours: 20.7600, decDeg:  30.7167, magnitude: 7.0,  constellation: 'Cyg' },
  { id: 'NGC 6992',  name: '面紗星雲・東',     nameEn: 'Veil Nebula (East)',     type: 'SNR', raHours: 20.9067, decDeg:  31.7167, magnitude: 7.0,  constellation: 'Cyg' },

  // ── Planetary nebulae ─────────────────────────────────────────────────
  { id: 'NGC 7293',  name: '螺旋星雲',         nameEn: 'Helix Nebula',           type: 'PN',  raHours: 22.4933, decDeg: -20.8367, magnitude: 7.6,  constellation: 'Aqr' },
  { id: 'NGC 6543',  name: '貓眼星雲',         nameEn: "Cat's Eye Nebula",       type: 'PN',  raHours: 17.9750, decDeg:  66.6333, magnitude: 8.1,  constellation: 'Dra' },
  { id: 'NGC 7027',  name: '寶石星雲',         nameEn: 'Jewel Bug Nebula',       type: 'PN',  raHours: 21.1233, decDeg:  42.2333, magnitude: 8.5,  constellation: 'Cyg' },
  { id: 'NGC 6826',  name: '眨眼星雲',         nameEn: 'Blinking Planetary',     type: 'PN',  raHours: 19.7450, decDeg:  50.5167, magnitude: 8.8,  constellation: 'Cyg' },
  { id: 'NGC 6781',  name: '幽靈星雲',         nameEn: 'NGC 6781',               type: 'PN',  raHours: 19.3050, decDeg:   6.5333, magnitude: 11.4, constellation: 'Aql' },
  { id: 'NGC 2392',  name: '愛斯基摩星雲',     nameEn: 'Eskimo Nebula',          type: 'PN',  raHours:  7.4900, decDeg:  20.9117, magnitude: 9.2,  constellation: 'Gem' },
  { id: 'NGC 3242',  name: '木魂星雲',         nameEn: 'Ghost of Jupiter',       type: 'PN',  raHours: 10.4083, decDeg: -18.6333, magnitude: 7.7,  constellation: 'Hya' },
  { id: 'NGC 6302',  name: '蟲星雲',           nameEn: 'Bug Nebula',             type: 'PN',  raHours: 17.2333, decDeg: -37.1000, magnitude: 9.6,  constellation: 'Sco' },
  { id: 'NGC 7009',  name: '土星狀星雲',       nameEn: 'Saturn Nebula',          type: 'PN',  raHours: 21.0683, decDeg: -11.3667, magnitude: 8.0,  constellation: 'Aqr' },
  { id: 'NGC 40',    name: '蝴蝶結星雲',       nameEn: 'Bow-Tie Nebula',         type: 'PN',  raHours:  0.2150, decDeg:  72.5183, magnitude: 11.6, constellation: 'Cep' },
  { id: 'NGC 246',   name: '骷髏星雲',         nameEn: 'Skull Nebula',           type: 'PN',  raHours:  0.7833, decDeg: -11.8717, magnitude: 8.0,  constellation: 'Cet' },

  // ── Edge-on / large galaxies ──────────────────────────────────────────
  { id: 'NGC 891',   name: 'NGC 891 側面銀河', nameEn: 'NGC 891',                type: 'G',   raHours:  2.3767, decDeg:  42.3500, magnitude: 9.9,  constellation: 'And' },
  { id: 'NGC 4565',  name: '針狀星系',         nameEn: 'Needle Galaxy',          type: 'G',   raHours: 12.6067, decDeg:  25.9883, magnitude: 9.6,  constellation: 'Com' },
  { id: 'NGC 5128',  name: '半人馬 A',         nameEn: 'Centaurus A',            type: 'G',   raHours: 13.4250, decDeg: -43.0167, magnitude: 6.8,  constellation: 'Cen' },
  { id: 'NGC 253',   name: '銀幣星系',         nameEn: 'Sculptor Galaxy',        type: 'G',   raHours:  0.7917, decDeg: -25.2883, magnitude: 7.1,  constellation: 'Scl' },
  { id: 'NGC 4631',  name: '鯨魚星系',         nameEn: 'Whale Galaxy',           type: 'G',   raHours: 12.4217, decDeg:  32.5417, magnitude: 9.2,  constellation: 'CVn' },
  { id: 'NGC 4656',  name: '曲棍球桿星系',     nameEn: 'Hockey Stick Galaxy',    type: 'G',   raHours: 12.7400, decDeg:  32.1667, magnitude: 10.5, constellation: 'CVn' },
  { id: 'NGC 4945',  name: 'NGC 4945',         nameEn: 'NGC 4945',               type: 'G',   raHours: 13.0917, decDeg: -49.4683, magnitude: 9.3,  constellation: 'Cen' },
  { id: 'NGC 7331',  name: '飛馬座 NGC 7331',  nameEn: 'NGC 7331',               type: 'G',   raHours: 22.6167, decDeg:  34.4167, magnitude: 9.5,  constellation: 'Peg' },
  { id: 'NGC 2403',  name: 'NGC 2403',         nameEn: 'NGC 2403',               type: 'G',   raHours:  7.6133, decDeg:  65.6017, magnitude: 8.5,  constellation: 'Cam' },
  { id: 'NGC 300',   name: '玉夫座 NGC 300',   nameEn: 'NGC 300',                type: 'G',   raHours:  0.9167, decDeg: -37.6833, magnitude: 8.7,  constellation: 'Scl' },
  { id: 'NGC 1232',  name: '波江座 NGC 1232',  nameEn: 'NGC 1232',               type: 'G',   raHours:  3.1583, decDeg: -20.5817, magnitude: 9.9,  constellation: 'Eri' },
  { id: 'NGC 2683',  name: 'UFO 星系',         nameEn: 'UFO Galaxy',             type: 'G',   raHours:  8.8800, decDeg:  33.4167, magnitude: 9.8,  constellation: 'Lyn' },
  { id: 'NGC 5907',  name: '碎裂條紋星系',     nameEn: 'Splinter Galaxy',        type: 'G',   raHours: 15.2617, decDeg:  56.3300, magnitude: 10.4, constellation: 'Dra' },
  { id: 'NGC 4244',  name: '銀針星系',         nameEn: 'Silver Needle',          type: 'G',   raHours: 12.2917, decDeg:  37.8067, magnitude: 10.4, constellation: 'CVn' },

  // ── Open / globular clusters ──────────────────────────────────────────
  { id: 'NGC 869',   name: '英仙雙重星團 h',   nameEn: 'Double Cluster (h Per)', type: 'OC',  raHours:  2.3500, decDeg:  57.1333, magnitude: 4.3,  constellation: 'Per' },
  { id: 'NGC 884',   name: '英仙雙重星團 χ',   nameEn: 'Double Cluster (χ Per)', type: 'OC',  raHours:  2.3833, decDeg:  57.1333, magnitude: 4.4,  constellation: 'Per' },
  { id: 'NGC 663',   name: '仙后座 NGC 663',   nameEn: 'NGC 663',                type: 'OC',  raHours:  1.7700, decDeg:  61.2167, magnitude: 7.1,  constellation: 'Cas' },
  { id: 'NGC 457',   name: 'ET 星團',           nameEn: 'ET Cluster',             type: 'OC',  raHours:  1.3267, decDeg:  58.2833, magnitude: 6.4,  constellation: 'Cas' },
  { id: 'NGC 752',   name: '仙女座 NGC 752',   nameEn: 'NGC 752',                type: 'OC',  raHours:  1.9633, decDeg:  37.7833, magnitude: 5.7,  constellation: 'And' },
  { id: 'NGC 7789',  name: '卡羅琳的玫瑰',     nameEn: "Caroline's Rose",        type: 'OC',  raHours: 23.9700, decDeg:  56.7167, magnitude: 6.7,  constellation: 'Cas' },
  { id: 'NGC 6231',  name: '南天昴宿星團',     nameEn: 'Southern Pleiades',      type: 'OC',  raHours: 16.9000, decDeg: -41.8333, magnitude: 2.6,  constellation: 'Sco' },
  { id: 'NGC 4755',  name: '寶盒星團',         nameEn: 'Jewel Box Cluster',      type: 'OC',  raHours: 12.8917, decDeg: -60.3500, magnitude: 4.2,  constellation: 'Cru' },
  { id: 'NGC 3532',  name: '許願井星團',       nameEn: 'Wishing Well Cluster',   type: 'OC',  raHours: 11.0950, decDeg: -58.7333, magnitude: 3.0,  constellation: 'Car' },
  { id: 'NGC 2070',  name: '蜘蛛星雲',         nameEn: 'Tarantula Nebula',       type: 'N',   raHours:  5.6383, decDeg: -69.1000, magnitude: 8.0,  constellation: 'Dor' },
  { id: 'NGC 5139',  name: '半人馬 ω',         nameEn: 'Omega Centauri',         type: 'GC',  raHours: 13.4467, decDeg: -47.4833, magnitude: 3.7,  constellation: 'Cen' },
  { id: 'NGC 104',   name: '杜鵑 47',          nameEn: '47 Tucanae',             type: 'GC',  raHours:  0.4017, decDeg: -72.0833, magnitude: 4.9,  constellation: 'Tuc' },

  // ── Interacting / peculiar galaxies ───────────────────────────────────
  { id: 'NGC 4038',  name: '觸角星系',         nameEn: 'Antennae Galaxies',      type: 'G',   raHours: 12.0283, decDeg: -18.8717, magnitude: 10.3, constellation: 'Crv' },
  { id: 'NGC 4676',  name: '老鼠星系',         nameEn: 'Mice Galaxies',          type: 'G',   raHours: 12.7600, decDeg:  30.7333, magnitude: 13.5, constellation: 'Com' },
  { id: 'NGC 660',   name: '極環星系',         nameEn: 'Polar Ring Galaxy',      type: 'G',   raHours:  1.7300, decDeg:  13.6450, magnitude: 11.2, constellation: 'Psc' },
  { id: 'NGC 5195',  name: '渦狀星系伴',       nameEn: 'Whirlpool Companion',    type: 'G',   raHours: 13.5000, decDeg:  47.2667, magnitude: 9.6,  constellation: 'CVn' },
  { id: 'NGC 7752',  name: '飛馬座小棒',       nameEn: 'NGC 7752/3',             type: 'G',   raHours: 23.7283, decDeg:  29.4717, magnitude: 13.0, constellation: 'Peg' },
];
