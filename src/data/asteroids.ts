import { J2000_JD } from '../physics/constants';
import { KeplerPropagator, type KeplerElements } from '../physics/keplerPropagator';
import type { BodyDescriptor, PropagatorSource } from '../physics/types';
import type { LangText } from '../i18n';

const JPL_SBDB: PropagatorSource = {
  label: 'JPL Small-Body Database',
  url: 'https://ssd.jpl.nasa.gov/sbdb.cgi',
  note: 'Osculating elements at J2000 epoch',
};

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
  raw: RawAsteroidElements, radiusKm: number, description: string | LangText,
  color = 0xc6a978,
): BodyDescriptor {
  // Description can be either a single string (legacy zh-Hant only) or a
  // proper LangText. Normalise so InfoPanel always gets a LangText.
  const desc: LangText = typeof description === 'string'
    ? { 'zh-Hant': description, en: description, ja: description }
    : description;
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
    propagator: new KeplerPropagator(rawToKepler(raw), JPL_SBDB),
    appearance: { color },
    description: desc,
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

  // ── Jupiter Trojans: L4 (Greek camp, leading) ─────────────────────────
  // These live ~60° ahead of Jupiter in its orbit, exactly at Sun–Jupiter L4.
  // Toggle the Lagrange point overlay to see them clustered around that marker.
  makeAsteroid(
    'achilles', '阿基里斯', '588 Achilles',
    {
      epoch: J2000_JD,
      q: 4.4214, e: 0.14752, iDeg: 10.32,
      omegaDeg: 132.78, OmegaDeg: 316.40,
      M0Deg: 213.44, periodDays: 4324.95,
    },
    67.5,
    {
      'zh-Hant': '1906 年發現，史上第一顆木星特洛伊小行星，居於太陽–木星 L4（希臘群）。',
      'en': 'Discovered 1906 — the first known Jupiter Trojan, parked at the Sun–Jupiter L4 (Greek camp).',
      'ja': '1906 年発見、史上初の木星トロヤ群小惑星。太陽–木星 L4（ギリシア群）に位置。',
    },
    0x66c2a5,
  ),
  makeAsteroid(
    'hektor', '赫克特', '624 Hektor',
    {
      epoch: J2000_JD,
      q: 5.0058, e: 0.02371, iDeg: 18.16,
      omegaDeg: 184.69, OmegaDeg: 342.61,
      M0Deg: 196.13, periodDays: 4317.15,
    },
    112,
    {
      'zh-Hant': '最大的木星特洛伊（約 250×125 km 雙葉狀），居 L4 希臘群；NASA Lucy 任務 2027 年將造訪。',
      'en': 'Largest Jupiter Trojan (~250×125 km, bilobed), in the L4 Greek camp; NASA Lucy will visit in 2027.',
      'ja': '最大の木星トロヤ群小惑星（約 250×125 km、二葉状）。L4 ギリシア群所属。NASA Lucy が 2027 年訪問予定。',
    },
    0x66c2a5,
  ),
  // ── Jupiter Trojans: L5 (Trojan camp, trailing) ───────────────────────
  makeAsteroid(
    'patroclus', '巴特羅克勒斯', '617 Patroclus',
    {
      epoch: J2000_JD,
      q: 4.5097, e: 0.13986, iDeg: 22.05,
      omegaDeg: 306.86, OmegaDeg: 44.36,
      M0Deg: 24.87, periodDays: 4338.72,
    },
    113,
    {
      'zh-Hant': '少見的雙小行星系統 (Patroclus + Menoetius)，居 L5 特洛伊群；NASA Lucy 2033 年將造訪。',
      'en': 'Rare binary asteroid (Patroclus + Menoetius) in the L5 Trojan camp; NASA Lucy arrives in 2033.',
      'ja': '珍しい二重小惑星系（パトロクロス + メノイティオス）。L5 トロヤ群所属。NASA Lucy が 2033 年到達予定。',
    },
    0xfc8d62,
  ),
  makeAsteroid(
    'eurybates', '尤里巴提斯', '3548 Eurybates',
    {
      epoch: J2000_JD,
      q: 4.7782, e: 0.09028, iDeg: 8.06,
      omegaDeg: 28.83, OmegaDeg: 43.57,
      M0Deg: 15.23, periodDays: 4337.45,
    },
    32,
    {
      'zh-Hant': 'NASA Lucy 任務 2027 年首站，碳質 C 型小行星家族成員；揭示特洛伊群早期分裂歷史。',
      'en': 'First target of NASA Lucy (2027); C-type carbonaceous family member that reveals early Trojan-group fragmentation history.',
      'ja': 'NASA Lucy ミッションの 2027 年初訪問先。炭素質 C 型小惑星ファミリー、トロヤ群の初期分裂史を解明。',
    },
    0xfc8d62,
  ),

  // ── Other named NEOs / interesting bodies ─────────────────────────────
  makeAsteroid(
    'phaethon', '法厄同', '3200 Phaethon',
    {
      epoch: J2000_JD,
      q: 0.13988, e: 0.88983, iDeg: 22.26,
      omegaDeg: 322.18, OmegaDeg: 265.27,
      M0Deg: 156.94, periodDays: 523.59,
    },
    2.9,
    {
      'zh-Hant': '雙子座流星雨母體；近日點 0.14 AU 比水星還靠太陽，疑似「岩質彗星」。JAXA DESTINY+ 將於 2028 年造訪。',
      'en': 'Parent body of the Geminids meteor shower. Perihelion 0.14 AU — closer to the Sun than Mercury — and suspected "rock comet". JAXA DESTINY+ visits in 2028.',
      'ja': 'ふたご座流星群の母天体。近日点 0.14 AU は水星よりも太陽寄りで、「岩石彗星」の疑い。JAXA DESTINY+ が 2028 年訪問予定。',
    },
    0xff9d54,
  ),
  makeAsteroid(
    'icarus', '伊卡魯斯', '1566 Icarus',
    {
      epoch: J2000_JD,
      q: 0.18661, e: 0.82687, iDeg: 22.83,
      omegaDeg: 31.34, OmegaDeg: 88.04,
      M0Deg: 122.17, periodDays: 408.78,
    },
    0.5,
    {
      'zh-Hant': '1949 年發現，第一顆編號的近日小行星 (q < 1 AU)；高離心率、近日點接近水星軌道。',
      'en': 'Discovered 1949 — the first numbered Apollo-class near-Earth asteroid (q < 1 AU). High eccentricity; perihelion close to Mercury\'s orbit.',
      'ja': '1949 年発見、最初に番号付けされた近日点 q<1 AU の近地球小惑星。高離心率で、近日点は水星軌道に接近。',
    },
    0xff6a6a,
  ),
  makeAsteroid(
    'ganymed', '蓋尼米德', '1036 Ganymed',
    {
      epoch: J2000_JD,
      q: 1.2440, e: 0.53354, iDeg: 26.69,
      omegaDeg: 132.30, OmegaDeg: 215.51,
      M0Deg: 314.82, periodDays: 1585.23,
    },
    19.5,
    {
      'zh-Hant': '已知最大近地小行星（直徑約 38 km），不會撞地球，但體積之大若撞擊將造成全球性災難。',
      'en': 'Largest known near-Earth asteroid (~38 km diameter). Not on a collision course, but its sheer size means an impact would be globally catastrophic.',
      'ja': '既知最大の近地球小惑星（直径約 38 km）。地球に衝突する軌道ではないが、その規模ゆえに衝突すれば地球規模の壊滅的影響をもたらす。',
    },
    0xff6a6a,
  ),
];
