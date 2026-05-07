import { J2000_JD } from '../physics/constants';
import { KeplerPropagator, type KeplerElements } from '../physics/keplerPropagator';
import type { BodyDescriptor } from '../physics/types';

/**
 * Famous periodic comets. Orbital elements adapted from JPL Small-Body
 * Database / Wikipedia.
 *
 * Elements are quoted in the more natural "comet form" (perihelion distance q,
 * argument of perihelion ω, longitude of ascending node Ω, time of perihelion
 * passage Tp), then converted into the propagator's planetary form (mean
 * longitude L, longitude of perihelion ϖ) by `cometToKepler` below.
 */

interface CometRawElements {
  /** Reference epoch (Julian Date). */
  epoch: number;
  /** Perihelion distance (AU). */
  q: number;
  /** Eccentricity. Must be < 1 for the periodic propagator to make sense. */
  e: number;
  /** Inclination (deg). */
  iDeg: number;
  /** Argument of perihelion (deg). */
  omegaDeg: number;
  /** Longitude of ascending node (deg). */
  OmegaDeg: number;
  /** Time of perihelion passage (Julian Date). */
  Tp: number;
  /** Orbital period (days). */
  periodDays: number;
}

function cometToKepler(c: CometRawElements): KeplerElements {
  const a = c.q / (1 - c.e);
  const varpiDeg = ((c.OmegaDeg + c.omegaDeg) % 360 + 360) % 360;
  // Mean anomaly at epoch: full revolutions worth of time since perihelion.
  let MDeg = ((c.epoch - c.Tp) / c.periodDays) * 360;
  MDeg = ((MDeg % 360) + 360) % 360;
  const LDeg = ((MDeg + varpiDeg) % 360 + 360) % 360;
  const LDotDeg = (360 * 36525) / c.periodDays;
  return {
    epoch: c.epoch,
    a,
    e: c.e,
    iDeg: c.iDeg,
    LDeg,
    LDotDeg,
    varpiDeg,
    OmegaDeg: c.OmegaDeg,
    periodDays: c.periodDays,
  };
}

/**
 * Build a comet body descriptor. Comets get a distinctive cyan-white
 * appearance and a small radius (most are 1–10 km).
 */
/**
 * Coma colour archetypes. Spectroscopy of comae reveals different molecular
 * mixes that dominate the visible glow:
 *  - "iceRich" (Halley-type, hyperactive): C₂ + CN + CO+ → blue-cyan
 *  - "dustRich" (Encke-type, evolved): scattered sunlight off dust → yellow-white
 *  - "gasGiant" (Hale-Bopp, ISON): bright blue ion tail dominant → cyan-blue
 *  - "sungrazer" (Lovejoy, large flare): orange-yellow from heated metals
 *  - "primordial" (long-period virgin): C₂ + CN line dominated → blue-violet
 */
export const COMET_COMA_COLOR: Record<string, [number, number, number]> = {
  halley:           [0.55, 0.85, 1.00], // iceRich
  encke:            [1.00, 0.92, 0.65], // dustRich
  swift_tuttle:     [0.65, 0.90, 1.00], // iceRich
  tuttle:           [0.70, 0.92, 0.95], // mixed
  tempel1:          [0.80, 0.95, 0.85], // mostly C₂ green-cyan
  hale_bopp:        [0.50, 0.80, 1.00], // gasGiant
  hyakutake:        [0.45, 0.75, 1.00], // gasGiant, classic CN tail
  ison:             [1.00, 0.80, 0.55], // sungrazer (until disintegration)
  neowise:          [1.00, 0.95, 0.75], // dustRich (famously dust-bright)
  lovejoy:          [1.00, 0.78, 0.50], // sungrazer
  mcnaught:         [1.00, 0.85, 0.65], // dustRich + bright dust tail
  tsuchinshan_atlas:[0.70, 0.92, 1.00], // mixed iceRich
};

const DEFAULT_COMA_COLOR: [number, number, number] = [0.85, 0.92, 1.00];

export function getComaColor(id: string): [number, number, number] {
  return COMET_COMA_COLOR[id] ?? DEFAULT_COMA_COLOR;
}

function makeComet(
  id: string,
  name: string,
  nameEn: string,
  raw: CometRawElements,
  radiusKm: number,
  description: string,
): BodyDescriptor {
  return {
    id,
    name,
    nameEn,
    parentId: null,
    category: 'comet',
    physical: {
      radiusKm,
      massKg: 1e13, // rough order of magnitude — most short-period nuclei are 10^13–10^15 kg
      rotationPeriodDays: 0.5,
      axialTiltDeg: 0,
    },
    propagator: new KeplerPropagator(cometToKepler(raw)),
    appearance: {
      color: 0xb6dcff,
    },
    description: { 'zh-Hant': description, en: description, ja: description },
  };
}

export const COMETS: BodyDescriptor[] = [
  makeComet(
    'halley', '哈雷彗星', '1P/Halley',
    {
      epoch: J2000_JD,
      q: 0.5871, e: 0.96714, iDeg: 162.26,
      omegaDeg: 111.33, OmegaDeg: 58.42,
      Tp: 2446470.95,         // 1986-02-09 perihelion
      periodDays: 27510,      // ≈ 75.32 years
    },
    11,
    '最有名的週期彗星，平均 76 年回歸一次，下一次近日點為 2061 年；軌道為逆行 (i > 90°)。',
  ),
  makeComet(
    'encke', '恩克彗星', '2P/Encke',
    {
      epoch: J2000_JD,
      q: 0.3361, e: 0.84825, iDeg: 11.78,
      omegaDeg: 186.55, OmegaDeg: 334.57,
      Tp: 2454259.14,         // 2007-04-19 perihelion
      periodDays: 1205,       // ≈ 3.30 years
    },
    2.4,
    '已知週期最短的彗星，3.3 年一周；近日點僅 0.34 AU，常年熱蒸發殆盡塵埃。',
  ),
  makeComet(
    'tempel1', '坦普爾 1 號彗星', '9P/Tempel 1',
    {
      epoch: J2000_JD,
      q: 1.5085, e: 0.51748, iDeg: 10.47,
      omegaDeg: 178.84, OmegaDeg: 68.94,
      Tp: 2453533.5,          // 2005-07-05 perihelion (Deep Impact event)
      periodDays: 2026,       // ≈ 5.55 years
    },
    3.0,
    '2005 年 NASA 深度撞擊號 (Deep Impact) 撞擊任務的目標；分析撞擊噴出物的結構提供彗核成分線索。',
  ),
  makeComet(
    'churyumov', '楚留莫夫－格拉西緬科彗星', '67P/Churyumov–Gerasimenko',
    {
      epoch: J2000_JD,
      q: 1.2432, e: 0.64102, iDeg: 7.04,
      omegaDeg: 12.78, OmegaDeg: 50.15,
      Tp: 2453610.5,          // 2005-09-12 perihelion
      periodDays: 2354,       // ≈ 6.44 years
    },
    2.0,
    '羅塞塔號 (Rosetta) 探測器於 2014–2016 年伴飛、菲萊 (Philae) 著陸器歷史性著陸的雙葉狀彗核。',
  ),
  makeComet(
    'halebopp', '海爾－波普彗星', 'C/1995 O1 (Hale–Bopp)',
    {
      epoch: J2000_JD,
      q: 0.9141, e: 0.99511, iDeg: 89.43,
      omegaDeg: 130.59, OmegaDeg: 282.47,
      Tp: 2450537.0,          // 1997-04-01 perihelion
      periodDays: 925000,     // ≈ 2533 years
    },
    30,
    '1997 年的「世紀大彗星」，肉眼可見達 18 個月之久；軌道為近垂直 (i ≈ 89°)。',
  ),
  makeComet(
    'neowise', '新智彗星', 'C/2020 F3 (NEOWISE)',
    {
      epoch: J2000_JD,
      q: 0.2947, e: 0.99918, iDeg: 128.94,
      omegaDeg: 37.28, OmegaDeg: 61.02,
      Tp: 2459033.0,          // 2020-07-03 perihelion
      periodDays: 2470000,    // ≈ 6766 years
    },
    2.5,
    '2020 年北半球肉眼可見的「世紀彗星」，因 NEOWISE 太空望遠鏡發現命名；長尾、軌道近逆行。',
  ),
  makeComet(
    'tsuchinshan-atlas', '紫金山－ATLAS', 'C/2023 A3 (Tsuchinshan–ATLAS)',
    {
      // Slight e<1 keeps a = q/(1-e) finite; visually indistinguishable from
      // the actual near-parabolic orbit at our scale.
      epoch: J2000_JD,
      q: 0.3914, e: 0.99998, iDeg: 139.11,
      omegaDeg: 308.49, OmegaDeg: 21.56,
      Tp: 2460594.0,          // 2024-09-27 perihelion
      periodDays: 30000000,
    },
    5,
    '2024 年下半年現身南北半球皆肉眼可見；中國紫金山天文台與 ATLAS 巡天獨立發現。',
  ),
  makeComet(
    'lovejoy', '洛夫喬伊彗星', 'C/2014 Q2 (Lovejoy)',
    {
      epoch: J2000_JD,
      q: 1.2906, e: 0.99820, iDeg: 80.30,
      omegaDeg: 12.39, OmegaDeg: 94.97,
      Tp: 2457069.5,          // 2015-01-30 perihelion
      periodDays: 2900000,    // ≈ 7944 years
    },
    8,
    '2014–15 年北半球冬夜的綠色彗星，業餘望遠鏡輕鬆可見。',
  ),
  makeComet(
    'mcnaught', '麥克諾特彗星', 'C/2006 P1 (McNaught)',
    {
      epoch: J2000_JD,
      q: 0.1707, e: 0.99998, iDeg: 77.83,
      omegaDeg: 155.98, OmegaDeg: 267.41,
      Tp: 2454113.5,          // 2007-01-12 perihelion
      periodDays: 30000000,
    },
    25,
    '2007 年「白晝彗星」，亮度達 −5.5 等，南半球可見巨大扇形塵尾。',
  ),
];
