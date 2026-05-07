import { J2000_JD } from '../physics/constants';
import { KeplerPropagator, type KeplerElements } from '../physics/keplerPropagator';
import type { BodyDescriptor } from '../physics/types';

/**
 * Famous near-Earth asteroids (NEAs) and main-belt asteroids visited by
 * spacecraft. Orbital elements from JPL Small-Body Database, J2000 epoch.
 *
 * Reused as `comet` category in the type system because the rendering only
 * cares about size + Kepler elements; visually they're small dots like comets
 * but coloured differently for legibility.
 */

interface RawAsteroidElements {
  epoch: number;
  q: number;       // perihelion AU
  e: number;
  iDeg: number;
  omegaDeg: number;   // ω
  OmegaDeg: number;   // Ω
  M0Deg: number;      // mean anomaly at epoch (deg)
  periodDays: number;
}

function rawToKepler(c: RawAsteroidElements): KeplerElements {
  const a = c.q / (1 - c.e);
  const varpiDeg = ((c.OmegaDeg + c.omegaDeg) % 360 + 360) % 360;
  const LDeg = ((c.M0Deg + varpiDeg) % 360 + 360) % 360;
  const LDotDeg = (360 * 36525) / c.periodDays;
  return {
    epoch: c.epoch,
    a, e: c.e, iDeg: c.iDeg,
    LDeg, LDotDeg,
    varpiDeg, OmegaDeg: c.OmegaDeg,
    periodDays: c.periodDays,
  };
}

function makeAsteroid(
  id: string, name: string, nameEn: string,
  raw: RawAsteroidElements, radiusKm: number, description: string,
  color = 0xc6a978,
): BodyDescriptor {
  return {
    id,
    name,
    nameEn,
    parentId: null,
    category: 'comet', // shared category — they render via the same dim-dot path
    physical: {
      radiusKm,
      massKg: (4 / 3) * Math.PI * Math.pow(radiusKm * 1000, 3) * 2500, // ρ ≈ 2.5 g/cm³
      rotationPeriodDays: 0.5,
      axialTiltDeg: 0,
    },
    propagator: new KeplerPropagator(rawToKepler(raw)),
    appearance: { color },
    description: { 'zh-Hant': description, en: description, ja: description },
  };
}

export const ASTEROIDS: BodyDescriptor[] = [
  makeAsteroid(
    'apophis', '阿波菲斯', '99942 Apophis',
    {
      epoch: J2000_JD,
      q: 0.7461, e: 0.1914, iDeg: 3.34,
      omegaDeg: 126.40, OmegaDeg: 204.45,
      M0Deg: 254.37, periodDays: 323.59,
    },
    0.185,
    '潛在威脅小行星：2029 年 4 月 13 日將通過距地表 32 000 km 處（地球同步軌道高度），近代史上最近的危險級小天體之一。',
    0xff6a6a, // red — danger flag
  ),
  makeAsteroid(
    'bennu', '貝努', '101955 Bennu',
    {
      epoch: J2000_JD,
      q: 0.8969, e: 0.20374, iDeg: 6.03,
      omegaDeg: 66.22, OmegaDeg: 2.06,
      M0Deg: 101.70, periodDays: 436.65,
    },
    0.245,
    'NASA OSIRIS-REx 的取樣目標；2023 年 9 月把樣本送回地球，碳質球粒結構與太陽系起源研究有關。',
  ),
  makeAsteroid(
    'ryugu', '龍宮', '162173 Ryugu',
    {
      epoch: J2000_JD,
      q: 0.9633, e: 0.19035, iDeg: 5.88,
      omegaDeg: 211.43, OmegaDeg: 251.62,
      M0Deg: 248.77, periodDays: 473.88,
    },
    0.435,
    'JAXA 隼鳥 2 號 2018–2019 年駐點，2020 年 12 月 6 日在澳洲沙漠回收樣本艙；發現含氨基酸的有機物。',
  ),
  makeAsteroid(
    'eros', '愛神星', '433 Eros',
    {
      epoch: J2000_JD,
      q: 1.1336, e: 0.22269, iDeg: 10.83,
      omegaDeg: 178.66, OmegaDeg: 304.40,
      M0Deg: 320.32, periodDays: 643.15,
    },
    8.42,
    '第一顆被太空船 NEAR Shoemaker 環繞 (2000) 並著陸 (2001) 的小行星；橢長花生型，~33 km 長。',
  ),
  makeAsteroid(
    'itokawa', '糸川', '25143 Itokawa',
    {
      epoch: J2000_JD,
      q: 0.9532, e: 0.28012, iDeg: 1.62,
      omegaDeg: 162.81, OmegaDeg: 69.08,
      M0Deg: 117.14, periodDays: 556.39,
    },
    0.165,
    'JAXA 隼鳥號 2005 年取樣，2010 年回收；首批小行星樣本，揭示「碎石堆」(rubble pile) 構造。',
  ),

  // ── Visited / large main-belt asteroids ────────────────────────────────
  makeAsteroid(
    'vesta', '灶神星', '4 Vesta',
    {
      epoch: J2000_JD,
      q: 2.1545, e: 0.08874, iDeg: 7.14,
      omegaDeg: 151.20, OmegaDeg: 103.80,
      M0Deg: 169.57, periodDays: 1325.46,
    },
    262.7,
    '主帶第二大天體，NASA Dawn 2011–2012 年環繞研究；表面遍佈巨大撞擊坑「Rheasilvia」。',
    0xb89b6a,
  ),
  makeAsteroid(
    'pallas', '智神星', '2 Pallas',
    {
      epoch: J2000_JD,
      q: 2.1336, e: 0.23083, iDeg: 34.84,
      omegaDeg: 309.93, OmegaDeg: 173.10,
      M0Deg: 311.04, periodDays: 1685.98,
    },
    256,
    '主帶第三大；軌道傾角極高 (35°)，可能是早期太陽系倖存的原始天體之一。',
    0xb89b6a,
  ),
  makeAsteroid(
    'lutetia', '魯泰提亞', '21 Lutetia',
    {
      epoch: J2000_JD,
      q: 2.0413, e: 0.16401, iDeg: 3.06,
      omegaDeg: 250.13, OmegaDeg: 80.87,
      M0Deg: 130.56, periodDays: 1387.23,
    },
    49,
    'ESA Rosetta 2010 年飛掠；金屬-碳混合成分，疑似太陽系早期殘留 planetesimal。',
    0xb89b6a,
  ),
  makeAsteroid(
    'didymos', '雙叉小行星', '65803 Didymos',
    {
      epoch: J2000_JD,
      q: 1.0136, e: 0.38406, iDeg: 3.41,
      omegaDeg: 319.32, OmegaDeg: 73.20,
      M0Deg: 146.86, periodDays: 770.00,
    },
    0.39,
    'NASA DART 任務 2022 年衝撞其衛星 Dimorphos 的目標；史上首次行星防禦動能測試。',
    0xff6a6a,
  ),
];
