import { KeplerPropagator, type KeplerElements } from '../physics/keplerPropagator';
import { J2000_JD } from '../physics/constants';
import type { BodyDescriptor, PropagatorSource } from '../physics/types';
import type { LangText } from '../i18n';

/**
 * Curated list of ~12 exoplanet systems for the v0.3.0 galactic flythrough.
 *
 * Each system has:
 *   - a `host` BodyDescriptor (the star) — placed at scene origin in its
 *     own local AU-scale frame when the user "lands" on the system.
 *     `parentId: null` because in the system-local view it is the centre
 *     of mass.
 *   - one or more planet BodyDescriptors, each with `parentId` set to
 *     the host's id. Existing renderer code (`OrbitLine`, `BodyMesh`,
 *     `KeplerPropagator`, `LagrangePoints`) all respect parentId and
 *     "just work" for planets orbiting any star, not just the Sun.
 *   - top-level metadata: distance from Sol (light-years) and the
 *     equatorial position of the host star, used by `ExoplanetHost.ts`
 *     to place the host's halo sprite in the HYG-cloud frame.
 *
 * Data sources:
 *   - NASA Exoplanet Archive (https://exoplanetarchive.ipac.caltech.edu)
 *     for orbital elements and stellar parameters.
 *   - Distances and positions from SIMBAD / Hipparcos (where in the HYG
 *     catalogue) or from the discovery paper for systems beyond Hipparcos.
 *   - Where ω, Ω, or i are unconstrained by observation we use the
 *     conventional defaults: i = 89° for transit detections, i = 0° for
 *     radial-velocity-only, Ω = 0°, ω = 0°. The visual flythrough doesn't
 *     change perceptibly within the real uncertainty band.
 *
 * GM unit note: KeplerPropagator's mean-motion uses `LDotDeg` (degrees
 * per Julian century). For each planet we set this directly from the
 * observed period: `LDotDeg = 360 * 36525 / period_days`.
 */

const NASA_EXOPLANET_ARCHIVE: PropagatorSource = {
  label: 'NASA Exoplanet Archive',
  url: 'https://exoplanetarchive.ipac.caltech.edu',
  note: 'Stellar + planetary parameters as of catalogue v2025',
};

export interface ExoplanetSystemMeta {
  /** Top-level system identifier; bodies use this as parentId. */
  id: string;
  /** Display name in zh-Hant / en / ja. */
  name: LangText;
  /** Distance from Sol in light-years. */
  distanceLy: number;
  /** Host position on the celestial sphere (J2000), used for HYG-frame placement. */
  raHours: number;
  decDeg: number;
  /** Short blurb shown on click. */
  description: LangText;
  /** Host star + all confirmed planets (the renderer reads parentId chains). */
  host: BodyDescriptor;
  planets: BodyDescriptor[];
  /**
   * Host effective temperature in K. Used by ExoplanetSystemView to
   * compute the conservative habitable-zone disc (Kopparapu+2013) and
   * by InfoPanel for the "G2V main-sequence" / "M8 dwarf" readout.
   * Required for the HZ shading; if absent the green ring is skipped.
   */
  hostTeffK: number;
}

/**
 * Helper: build a planet BodyDescriptor with reasonable defaults.
 * Inclination defaults to 89° (most exoplanets we know about were
 * discovered by transit so they have to be near edge-on).
 */
function makePlanet(args: {
  id: string;
  name: string;
  nameEn: string;
  parentId: string;
  radiusKm: number;
  massKg?: number;
  /** Semi-major axis in AU. */
  a: number;
  e?: number;
  iDeg?: number;
  /** Orbital period in days. Mandatory; mean motion derived from this. */
  periodDays: number;
  M0Deg?: number;        // Mean anomaly at J2000
  varpiDeg?: number;
  OmegaDeg?: number;
  color?: number;
  description: LangText;
}): BodyDescriptor {
  const a = args.a;
  const e = args.e ?? 0;
  const iDeg = args.iDeg ?? 89;
  const periodDays = args.periodDays;
  const varpiDeg = args.varpiDeg ?? 0;
  const OmegaDeg = args.OmegaDeg ?? 0;
  const M0Deg = args.M0Deg ?? 0;
  const LDeg = ((M0Deg + varpiDeg) % 360 + 360) % 360;
  const LDotDeg = (360 / periodDays) * 36525;
  const radiusM3 = (4 / 3) * Math.PI * Math.pow(args.radiusKm * 1000, 3);
  const massKg = args.massKg ?? radiusM3 * 1500; // ρ ≈ 1.5 g/cm³ default (Neptune-ish)
  const elem: KeplerElements = {
    epoch: J2000_JD, a, e, iDeg, LDeg, LDotDeg, varpiDeg, OmegaDeg, periodDays,
  };
  return {
    id: args.id,
    name: args.name,
    nameEn: args.nameEn,
    parentId: args.parentId,
    category: 'planet',
    physical: {
      radiusKm: args.radiusKm,
      massKg,
      rotationPeriodDays: 1,    // unknown for almost all exoplanets
      axialTiltDeg: 0,
    },
    propagator: new KeplerPropagator(elem, NASA_EXOPLANET_ARCHIVE),
    appearance: { color: args.color ?? 0xb0b0b0 },
    description: args.description,
  };
}

function makeHost(args: {
  id: string;
  name: string;
  nameEn: string;
  /** Star radius in km (R☉ × 695 700). */
  radiusKm: number;
  /** Star mass in kg (M☉ × 1.989e30). */
  massKg: number;
  rotationPeriodDays?: number;
  /** Surface temperature in K, used to derive a rough display colour. */
  teffK: number;
}): BodyDescriptor {
  return {
    id: args.id,
    name: args.name,
    nameEn: args.nameEn,
    parentId: null,
    category: 'star',
    physical: {
      radiusKm: args.radiusKm,
      massKg: args.massKg,
      rotationPeriodDays: args.rotationPeriodDays ?? 30,
      axialTiltDeg: 0,
    },
    propagator: null,
    appearance: { color: teffToColor(args.teffK), emissive: true },
  };
}

/** Crude blackbody-temperature → display colour (matches the HYG B-V mapping). */
function teffToColor(teffK: number): number {
  if (teffK > 10000) return 0xa8c8ff;
  if (teffK > 7500)  return 0xcfdcff;
  if (teffK > 6000)  return 0xffffff;
  if (teffK > 5200)  return 0xfff4d8;
  if (teffK > 3700)  return 0xffc070;
  return 0xff7050; // M dwarfs
}

// Convenience constants
const R_SUN_KM   = 695_700;
const M_SUN_KG   = 1.98892e30;
const R_EARTH_KM = 6_371;
const M_EARTH_KG = 5.972e24;
const R_JUP_KM   = 69_911;
const M_JUP_KG   = 1.898e27;

// =============================================================================
// 1. TRAPPIST-1 — the showcase: 7 Earth-sized planets in resonance
// =============================================================================
const TRAPPIST_1_HOST = makeHost({
  id: 'trappist-1', name: 'TRAPPIST-1', nameEn: 'TRAPPIST-1',
  radiusKm: 0.121 * R_SUN_KM,
  massKg:   0.0898 * M_SUN_KG,
  teffK: 2566,
});

const TRAPPIST_1_PLANETS: BodyDescriptor[] = [
  makePlanet({
    id: 'trappist-1-b', name: 'TRAPPIST-1 b', nameEn: 'TRAPPIST-1 b', parentId: 'trappist-1',
    radiusKm: 1.116 * R_EARTH_KM, massKg: 1.374 * M_EARTH_KG,
    a: 0.01154, e: 0.00622, periodDays: 1.510826, iDeg: 89.728,
    description: { 'zh-Hant': '7 顆中最內側、可能潮汐熔融的世界。', 'en': 'Innermost world; likely tidally heated.', 'ja': '7惑星中最内側。潮汐加熱の可能性あり。' },
  }),
  makePlanet({
    id: 'trappist-1-c', name: 'TRAPPIST-1 c', nameEn: 'TRAPPIST-1 c', parentId: 'trappist-1',
    radiusKm: 1.097 * R_EARTH_KM, massKg: 1.308 * M_EARTH_KG,
    a: 0.01580, e: 0.00654, periodDays: 2.421937, iDeg: 89.778,
    description: { 'zh-Hant': '岩質世界，潮汐鎖定。JWST 已測其表面溫度。', 'en': 'Rocky tidally-locked world; JWST has measured its dayside temperature.', 'ja': '岩石惑星、潮汐固定。JWST が昼側温度を観測済み。' },
  }),
  makePlanet({
    id: 'trappist-1-d', name: 'TRAPPIST-1 d', nameEn: 'TRAPPIST-1 d', parentId: 'trappist-1',
    radiusKm: 0.788 * R_EARTH_KM, massKg: 0.388 * M_EARTH_KG,
    a: 0.02227, e: 0.00837, periodDays: 4.049219, iDeg: 89.896,
    description: { 'zh-Hant': '宜居帶內緣；可能有水。', 'en': 'Inner edge of habitable zone; potentially water-bearing.', 'ja': 'ハビタブルゾーン内縁。水の存在可能性。' },
  }),
  makePlanet({
    id: 'trappist-1-e', name: 'TRAPPIST-1 e', nameEn: 'TRAPPIST-1 e', parentId: 'trappist-1',
    radiusKm: 0.920 * R_EARTH_KM, massKg: 0.692 * M_EARTH_KG,
    a: 0.02925, e: 0.00510, periodDays: 6.101013, iDeg: 89.793,
    description: { 'zh-Hant': '宜居帶中心，最像地球的候選之一。', 'en': 'Mid habitable zone — one of the best Earth analogues known.', 'ja': 'ハビタブルゾーン中央。最も地球に近い候補の一つ。' },
  }),
  makePlanet({
    id: 'trappist-1-f', name: 'TRAPPIST-1 f', nameEn: 'TRAPPIST-1 f', parentId: 'trappist-1',
    radiusKm: 1.045 * R_EARTH_KM, massKg: 1.039 * M_EARTH_KG,
    a: 0.03849, e: 0.01007, periodDays: 9.207540, iDeg: 89.740,
    description: { 'zh-Hant': '宜居帶外側，水冰可能在表面。', 'en': 'Outer habitable zone; surface water-ice plausible.', 'ja': 'ハビタブルゾーン外側、表面水氷の可能性。' },
  }),
  makePlanet({
    id: 'trappist-1-g', name: 'TRAPPIST-1 g', nameEn: 'TRAPPIST-1 g', parentId: 'trappist-1',
    radiusKm: 1.129 * R_EARTH_KM, massKg: 1.321 * M_EARTH_KG,
    a: 0.04683, e: 0.00208, periodDays: 12.352446, iDeg: 89.742,
    description: { 'zh-Hant': '系統中最大，質量也最大；7 顆中最具挑戰性的觀測目標。', 'en': 'Largest and most massive of the seven; among the toughest to characterise.', 'ja': '系内最大・最重。観測難度の高い惑星。' },
  }),
  makePlanet({
    id: 'trappist-1-h', name: 'TRAPPIST-1 h', nameEn: 'TRAPPIST-1 h', parentId: 'trappist-1',
    radiusKm: 0.755 * R_EARTH_KM, massKg: 0.326 * M_EARTH_KG,
    a: 0.06189, e: 0.00567, periodDays: 18.772866, iDeg: 89.805,
    description: { 'zh-Hant': '最外側、最冷；公轉週期為 b 的整數倍 (3:2 共振鏈)。', 'en': 'Outermost and coldest; locked in a 3:2 resonance chain back to b.', 'ja': '最外側で最も寒冷。bとの間で 3:2 共鳴連鎖。' },
  }),
];

const TRAPPIST_1_SYSTEM: ExoplanetSystemMeta = {
  id: 'trappist-1',
  name: { 'zh-Hant': 'TRAPPIST-1', 'en': 'TRAPPIST-1', 'ja': 'TRAPPIST-1' },
  distanceLy: 40.66,
  raHours: 23.108,
  decDeg: -5.041,
  hostTeffK: 2566,
  description: {
    'zh-Hant': '7 顆地球大小行星，繞 M8 矮星運轉，全部塞在比水星軌道還小的範圍內，且彼此構成 8:5:3:2:1 的軌道共振鏈。系統中 e、f、g 都在宜居帶內。',
    'en': '7 Earth-sized planets orbiting an M8 dwarf, all packed inside an orbit smaller than Mercury\'s, locked in an 8:5:3:2:1 mean-motion resonance chain. e, f, and g sit inside the habitable zone.',
    'ja': 'M8型矮星を周回する7つの地球サイズ惑星。すべて水星軌道より内側に収まり、8:5:3:2:1 の軌道共鳴連鎖を形成。e, f, g はハビタブルゾーン内。',
  },
  host: TRAPPIST_1_HOST,
  planets: TRAPPIST_1_PLANETS,
};

// =============================================================================
// 2. PROXIMA CENTAURI — the closest exoplanet host to Sol
// =============================================================================
const PROXIMA_HOST = makeHost({
  id: 'proxima', name: 'Proxima Centauri', nameEn: 'Proxima Centauri',
  radiusKm: 0.1542 * R_SUN_KM,
  massKg:   0.1221 * M_SUN_KG,
  teffK: 3042,
});

const PROXIMA_PLANETS: BodyDescriptor[] = [
  makePlanet({
    id: 'proxima-d', name: 'Proxima d', nameEn: 'Proxima d', parentId: 'proxima',
    radiusKm: 0.81 * R_EARTH_KM, massKg: 0.26 * M_EARTH_KG,
    a: 0.02885, e: 0.04, periodDays: 5.122,
    description: { 'zh-Hant': '最內側，極熱；2022 年確認。', 'en': 'Innermost; sub-Earth mass; confirmed 2022.', 'ja': '最内側、極熱。2022 年確認。' },
  }),
  makePlanet({
    id: 'proxima-b', name: 'Proxima b', nameEn: 'Proxima b', parentId: 'proxima',
    radiusKm: 1.07 * R_EARTH_KM, massKg: 1.07 * M_EARTH_KG,
    a: 0.04856, e: 0.0, periodDays: 11.184, iDeg: 88,
    description: { 'zh-Hant': '太陽系外最近的潛在類地行星，2016 年發現。', 'en': 'The nearest potentially Earth-like exoplanet to Sol; discovered 2016.', 'ja': '太陽系外で最も近い類地球候補。2016 年発見。' },
  }),
  makePlanet({
    id: 'proxima-c', name: 'Proxima c', nameEn: 'Proxima c', parentId: 'proxima',
    radiusKm: 2.0 * R_EARTH_KM, massKg: 7 * M_EARTH_KG,
    a: 1.489, e: 0.04, periodDays: 1928,
    description: { 'zh-Hant': '超級地球或迷你海王星，遠在冰線外。仍待最終確認。', 'en': 'Super-Earth / mini-Neptune candidate beyond the ice line; awaits final confirmation.', 'ja': 'スーパーアース／ミニ海王星候補。氷線の外側。最終確認待ち。' },
  }),
];

const PROXIMA_SYSTEM: ExoplanetSystemMeta = {
  id: 'proxima',
  name: { 'zh-Hant': '比鄰星 (Proxima)', 'en': 'Proxima Centauri', 'ja': 'プロキシマ・ケンタウリ' },
  distanceLy: 4.246,
  raHours: 14.4955,
  decDeg: -62.6794,
  hostTeffK: 3042,
  description: {
    'zh-Hant': '距離太陽最近的恆星 (4.24 ly)，紅矮星伴星 α Cen AB。已確認 3 顆行星，b 在宜居帶。',
    'en': 'Closest star to Sol (4.24 ly), an M5.5V red-dwarf companion to α Cen AB. Three confirmed planets; b sits in the habitable zone.',
    'ja': '太陽系から最も近い恒星（4.24 ly）。α ケンタウリ AB の伴星。確認済み 3 惑星、b はハビタブルゾーン内。',
  },
  host: PROXIMA_HOST,
  planets: PROXIMA_PLANETS,
};

// =============================================================================
// 3. KEPLER-186 — first Earth-sized planet in a habitable zone
// =============================================================================
const KEPLER_186_HOST = makeHost({
  id: 'kepler-186', name: 'Kepler-186', nameEn: 'Kepler-186',
  radiusKm: 0.523 * R_SUN_KM, massKg: 0.480 * M_SUN_KG,
  teffK: 3788,
});

const KEPLER_186_PLANETS: BodyDescriptor[] = [
  makePlanet({ id: 'kepler-186-b', name: 'Kepler-186 b', nameEn: 'Kepler-186 b', parentId: 'kepler-186',
    radiusKm: 1.07 * R_EARTH_KM, a: 0.0343, e: 0.0, periodDays: 3.886,
    description: { 'zh-Hant': '最內側，潮汐鎖定。', 'en': 'Innermost; tidally locked.', 'ja': '最内側、潮汐固定。' } }),
  makePlanet({ id: 'kepler-186-c', name: 'Kepler-186 c', nameEn: 'Kepler-186 c', parentId: 'kepler-186',
    radiusKm: 1.25 * R_EARTH_KM, a: 0.0451, e: 0.0, periodDays: 7.267,
    description: { 'zh-Hant': '岩質超地球。', 'en': 'Rocky super-Earth.', 'ja': '岩石スーパーアース。' } }),
  makePlanet({ id: 'kepler-186-d', name: 'Kepler-186 d', nameEn: 'Kepler-186 d', parentId: 'kepler-186',
    radiusKm: 1.40 * R_EARTH_KM, a: 0.0781, e: 0.0, periodDays: 13.343,
    description: { 'zh-Hant': '岩質超地球。', 'en': 'Rocky super-Earth.', 'ja': '岩石スーパーアース。' } }),
  makePlanet({ id: 'kepler-186-e', name: 'Kepler-186 e', nameEn: 'Kepler-186 e', parentId: 'kepler-186',
    radiusKm: 1.27 * R_EARTH_KM, a: 0.110, e: 0.0, periodDays: 22.408,
    description: { 'zh-Hant': '宜居帶內緣。', 'en': 'Inner edge of habitable zone.', 'ja': 'ハビタブルゾーン内縁。' } }),
  makePlanet({ id: 'kepler-186-f', name: 'Kepler-186 f', nameEn: 'Kepler-186 f', parentId: 'kepler-186',
    radiusKm: 1.17 * R_EARTH_KM, a: 0.432, e: 0.04, periodDays: 129.946,
    description: { 'zh-Hant': '首顆已知地球大小、位於宜居帶的系外行星 (2014)。', 'en': 'First known Earth-sized planet in the habitable zone (2014).', 'ja': '初の地球サイズ・ハビタブルゾーン惑星（2014 年発見）。' } }),
];

const KEPLER_186_SYSTEM: ExoplanetSystemMeta = {
  id: 'kepler-186',
  name: { 'zh-Hant': 'Kepler-186', 'en': 'Kepler-186', 'ja': 'ケプラー 186' },
  distanceLy: 580,
  raHours: 19.916,
  decDeg: 43.954,
  hostTeffK: 3788,
  description: {
    'zh-Hant': 'M1V 紅矮星，5 顆行星。f 是第一顆於另一恆星宜居帶被確認的地球大小世界。',
    'en': 'M1V red dwarf, 5 planets. f was the first Earth-sized world confirmed in another star\'s habitable zone.',
    'ja': 'M1V 赤色矮星、5 惑星。f は他星のハビタブルゾーンで初めて確認された地球サイズ惑星。',
  },
  host: KEPLER_186_HOST,
  planets: KEPLER_186_PLANETS,
};

// =============================================================================
// 4. KEPLER-90 — 8 planets, ties Sol for most-known
// =============================================================================
const KEPLER_90_HOST = makeHost({
  id: 'kepler-90', name: 'Kepler-90', nameEn: 'Kepler-90',
  radiusKm: 1.20 * R_SUN_KM, massKg: 1.13 * M_SUN_KG,
  teffK: 6080,
});

const KEPLER_90_PLANETS: BodyDescriptor[] = [
  makePlanet({ id: 'kepler-90-b', name: 'Kepler-90 b', nameEn: 'Kepler-90 b', parentId: 'kepler-90',
    radiusKm: 1.31 * R_EARTH_KM, a: 0.074, periodDays: 7.008,
    description: { 'zh-Hant': '岩質。', 'en': 'Rocky.', 'ja': '岩石。' } }),
  makePlanet({ id: 'kepler-90-c', name: 'Kepler-90 c', nameEn: 'Kepler-90 c', parentId: 'kepler-90',
    radiusKm: 1.18 * R_EARTH_KM, a: 0.089, periodDays: 8.720,
    description: { 'zh-Hant': '岩質。', 'en': 'Rocky.', 'ja': '岩石。' } }),
  makePlanet({ id: 'kepler-90-i', name: 'Kepler-90 i', nameEn: 'Kepler-90 i', parentId: 'kepler-90',
    radiusKm: 1.32 * R_EARTH_KM, a: 0.107, periodDays: 14.449,
    description: { 'zh-Hant': '2017 年由 Google AI 在 Kepler 訊號中發現，第 8 顆行星，使本系統與太陽系並列。', 'en': 'Discovered 2017 by Google AI in Kepler signals — the 8th planet, tying this system with Sol.', 'ja': '2017 年に Google AI が Kepler 信号から発見。8 番目の惑星で太陽系と並ぶ。' } }),
  makePlanet({ id: 'kepler-90-d', name: 'Kepler-90 d', nameEn: 'Kepler-90 d', parentId: 'kepler-90',
    radiusKm: 2.88 * R_EARTH_KM, a: 0.32, periodDays: 59.737,
    description: { 'zh-Hant': '迷你海王星。', 'en': 'Mini-Neptune.', 'ja': 'ミニ海王星。' } }),
  makePlanet({ id: 'kepler-90-e', name: 'Kepler-90 e', nameEn: 'Kepler-90 e', parentId: 'kepler-90',
    radiusKm: 2.67 * R_EARTH_KM, a: 0.42, periodDays: 91.939,
    description: { 'zh-Hant': '迷你海王星。', 'en': 'Mini-Neptune.', 'ja': 'ミニ海王星。' } }),
  makePlanet({ id: 'kepler-90-f', name: 'Kepler-90 f', nameEn: 'Kepler-90 f', parentId: 'kepler-90',
    radiusKm: 2.89 * R_EARTH_KM, a: 0.48, periodDays: 124.914,
    description: { 'zh-Hant': '迷你海王星。', 'en': 'Mini-Neptune.', 'ja': 'ミニ海王星。' } }),
  makePlanet({ id: 'kepler-90-g', name: 'Kepler-90 g', nameEn: 'Kepler-90 g', parentId: 'kepler-90',
    radiusKm: 8.13 * R_EARTH_KM, a: 0.71, periodDays: 210.6,
    description: { 'zh-Hant': '氣態巨行星。', 'en': 'Gas giant.', 'ja': 'ガス惑星。' } }),
  makePlanet({ id: 'kepler-90-h', name: 'Kepler-90 h', nameEn: 'Kepler-90 h', parentId: 'kepler-90',
    radiusKm: 11.32 * R_EARTH_KM, a: 1.00, periodDays: 331.6,
    description: { 'zh-Hant': '木星級巨行星。', 'en': 'Jovian gas giant.', 'ja': '木星級ガス惑星。' } }),
];

const KEPLER_90_SYSTEM: ExoplanetSystemMeta = {
  id: 'kepler-90',
  name: { 'zh-Hant': 'Kepler-90', 'en': 'Kepler-90', 'ja': 'ケプラー 90' },
  distanceLy: 2840,
  raHours: 18.957,
  decDeg: 49.305,
  hostTeffK: 6080,
  description: {
    'zh-Hant': 'G 型恆星，8 顆已知行星，與太陽系並列「行星數最多」紀錄。第 8 顆 (i) 是 2017 年用機器學習方法重新分析 Kepler 資料時發現。',
    'en': 'G-type star with 8 known planets — tied with Sol for the planet-count record. The 8th (i) was found in 2017 by reanalysing Kepler data with machine-learning techniques.',
    'ja': 'G型星、8 個の既知惑星で太陽系と並ぶ最多記録。第 8 惑星 (i) は 2017 年に機械学習で Kepler データを再解析し発見。',
  },
  host: KEPLER_90_HOST,
  planets: KEPLER_90_PLANETS,
};

// =============================================================================
// 5. 51 Pegasi — first confirmed exoplanet
// =============================================================================
const PEG_51_SYSTEM: ExoplanetSystemMeta = {
  id: '51-pegasi',
  name: { 'zh-Hant': '飛馬座 51 (51 Pegasi)', 'en': '51 Pegasi', 'ja': 'ペガスス座 51 番星' },
  distanceLy: 50.45,
  raHours: 22.961,
  decDeg: 20.769,
  hostTeffK: 5793,
  description: {
    'zh-Hant': '1995 年確認的第一顆繞主序星的系外行星。其熱木星 b 直接導致天文界對行星形成理論大幅修正，並開啟系外行星時代。',
    'en': 'In 1995, the first exoplanet ever confirmed around a Sun-like star. Its hot-Jupiter b forced a major rethink of planetary-formation theory and launched the exoplanet era.',
    'ja': '1995 年に主系列星の周りで初めて確認された系外惑星。ホットジュピター b は惑星形成理論を一新し、系外惑星時代の幕開けとなった。',
  },
  host: makeHost({
    id: '51-pegasi', name: '51 Pegasi', nameEn: '51 Pegasi',
    radiusKm: 1.237 * R_SUN_KM, massKg: 1.06 * M_SUN_KG, teffK: 5793,
  }),
  planets: [
    makePlanet({
      id: '51-pegasi-b', name: '51 Pegasi b', nameEn: '51 Pegasi b', parentId: '51-pegasi',
      radiusKm: 1.27 * R_JUP_KM, massKg: 0.46 * M_JUP_KG,
      a: 0.0527, e: 0.013, periodDays: 4.230785, iDeg: 80,
      description: { 'zh-Hant': '熱木星，公轉 4.23 天；史上第一顆「太陽系外行星」(1995)。', 'en': 'Hot Jupiter, 4.23-day orbit; the first-ever discovered "exoplanet around a Sun-like star" (1995).', 'ja': 'ホットジュピター、4.23 日周期。「主系列星周りの初の系外惑星」(1995)。' },
    }),
  ],
};

// =============================================================================
// 6. HD 209458 — first transit detection
// =============================================================================
const HD_209458_SYSTEM: ExoplanetSystemMeta = {
  id: 'hd-209458',
  name: { 'zh-Hant': 'HD 209458', 'en': 'HD 209458', 'ja': 'HD 209458' },
  distanceLy: 159,
  raHours: 22.052,
  decDeg: 18.884,
  hostTeffK: 6065,
  description: {
    'zh-Hant': '第一顆透過凌日法確認的系外行星 (1999)。「Osiris」b 失去大氣以驚人速率，是最早被探測大氣成分的系外行星。',
    'en': 'First exoplanet confirmed by the transit method (1999). "Osiris" b is losing its atmosphere at startling rates — the first exoplanet with measured atmospheric composition.',
    'ja': '初めてトランジット法で確認された系外惑星（1999 年）。「オシリス」b は大気が急速に失われており、大気組成を初めて測定された系外惑星でもある。',
  },
  host: makeHost({
    id: 'hd-209458', name: 'HD 209458', nameEn: 'HD 209458',
    radiusKm: 1.203 * R_SUN_KM, massKg: 1.119 * M_SUN_KG, teffK: 6065,
  }),
  planets: [
    makePlanet({
      id: 'hd-209458-b', name: 'HD 209458 b', nameEn: 'HD 209458 b (Osiris)', parentId: 'hd-209458',
      radiusKm: 1.39 * R_JUP_KM, massKg: 0.69 * M_JUP_KG,
      a: 0.04747, e: 0.014, periodDays: 3.524749, iDeg: 86.71,
      description: { 'zh-Hant': '別名 Osiris；史上第一顆凌日系外行星 (1999)，第一顆被測得大氣 (2001)。', 'en': 'Aka Osiris. First transiting exoplanet (1999); first exoplanet with measured atmosphere (2001).', 'ja': '通称オシリス。史上初のトランジット系外惑星（1999）であり、初めて大気が測定された系外惑星（2001）。' },
    }),
  ],
};

// =============================================================================
// 7. TOI-700 — TESS-discovered habitable-zone earth-size
// =============================================================================
const TOI_700_SYSTEM: ExoplanetSystemMeta = {
  id: 'toi-700',
  name: { 'zh-Hant': 'TOI-700', 'en': 'TOI-700', 'ja': 'TOI-700' },
  distanceLy: 101.4,
  raHours: 6.5135,
  decDeg: -65.578,
  hostTeffK: 3480,
  description: {
    'zh-Hant': 'TESS 任務發現的 4 顆行星系統。e 是宜居帶內的地球大小世界 (2023 年確認)。',
    'en': 'A 4-planet system found by NASA TESS. Planet e is an Earth-sized world in the habitable zone, confirmed 2023.',
    'ja': 'TESS が発見した 4 惑星系。惑星 e は 2023 年に確認された地球サイズのハビタブルゾーン惑星。',
  },
  host: makeHost({ id: 'toi-700', name: 'TOI-700', nameEn: 'TOI-700',
    radiusKm: 0.420 * R_SUN_KM, massKg: 0.416 * M_SUN_KG, teffK: 3480 }),
  planets: [
    makePlanet({ id: 'toi-700-b', name: 'TOI-700 b', nameEn: 'TOI-700 b', parentId: 'toi-700',
      radiusKm: 0.926 * R_EARTH_KM, a: 0.0677, periodDays: 9.9776,
      description: { 'zh-Hant': '地球大小，潮汐熱。', 'en': 'Earth-sized, tidally heated.', 'ja': '地球サイズ、潮汐加熱。' } }),
    makePlanet({ id: 'toi-700-c', name: 'TOI-700 c', nameEn: 'TOI-700 c', parentId: 'toi-700',
      radiusKm: 2.65 * R_EARTH_KM, a: 0.0929, periodDays: 16.051,
      description: { 'zh-Hant': '迷你海王星。', 'en': 'Mini-Neptune.', 'ja': 'ミニ海王星。' } }),
    makePlanet({ id: 'toi-700-d', name: 'TOI-700 d', nameEn: 'TOI-700 d', parentId: 'toi-700',
      radiusKm: 1.144 * R_EARTH_KM, a: 0.1633, periodDays: 37.426,
      description: { 'zh-Hant': '宜居帶內緣的地球大小世界 (2020 年確認)。', 'en': 'Earth-sized, inner edge of HZ; confirmed 2020.', 'ja': '地球サイズ、ハビタブルゾーン内縁。2020 年確認。' } }),
    makePlanet({ id: 'toi-700-e', name: 'TOI-700 e', nameEn: 'TOI-700 e', parentId: 'toi-700',
      radiusKm: 0.953 * R_EARTH_KM, a: 0.134, periodDays: 27.81,
      description: { 'zh-Hant': '2023 年宣布的第二顆 HZ 地球大小行星。', 'en': 'Second Earth-sized HZ planet, announced 2023.', 'ja': '2023 年発表、2 番目の地球サイズ HZ 惑星。' } }),
  ],
};

// =============================================================================
// 8. WASP-12 — extreme hot Jupiter being shredded
// =============================================================================
const WASP_12_SYSTEM: ExoplanetSystemMeta = {
  id: 'wasp-12',
  name: { 'zh-Hant': 'WASP-12', 'en': 'WASP-12', 'ja': 'WASP-12' },
  distanceLy: 1410,
  raHours: 6.5092,
  decDeg: 29.6727,
  hostTeffK: 6300,
  description: {
    'zh-Hant': '極端熱木星 b 被恆星撕裂，每秒損失約 60 億公噸物質。軌道在 1300 萬年內衰減進入恆星。',
    'en': 'Extreme hot Jupiter b being torn apart — losing ~6 billion tonnes/sec of mass. Will spiral into the star within 13 Myr.',
    'ja': '極端なホットジュピター b は恒星の重力で破壊されており、毎秒約 60 億トンの物質を失っている。1300 万年以内に恒星に落下する。',
  },
  host: makeHost({ id: 'wasp-12', name: 'WASP-12', nameEn: 'WASP-12',
    radiusKm: 1.657 * R_SUN_KM, massKg: 1.434 * M_SUN_KG, teffK: 6300 }),
  planets: [
    makePlanet({ id: 'wasp-12-b', name: 'WASP-12 b', nameEn: 'WASP-12 b', parentId: 'wasp-12',
      radiusKm: 1.937 * R_JUP_KM, massKg: 1.465 * M_JUP_KG,
      a: 0.0234, e: 0.0447, periodDays: 1.0914222, iDeg: 83.37,
      description: { 'zh-Hant': '質量幾乎在每年被恆星拆走。表面溫度 ~2500 K。', 'en': 'Tidally shredded; surface temperature ~2500 K. Orbit decaying.', 'ja': '潮汐破壊中。表面温度約 2500 K。軌道は減衰中。' } }),
  ],
};

// =============================================================================
// 9. LHS 1140 — 2 super-Earths around a quiet M dwarf
// =============================================================================
const LHS_1140_SYSTEM: ExoplanetSystemMeta = {
  id: 'lhs-1140',
  name: { 'zh-Hant': 'LHS 1140', 'en': 'LHS 1140', 'ja': 'LHS 1140' },
  distanceLy: 48.94,
  raHours: 0.8763,
  decDeg: -15.272,
  hostTeffK: 3216,
  description: {
    'zh-Hant': 'M4.5 矮星，安靜不易耀斑，是大氣探測的優先目標。b 是岩質超地球，c 在外側軌道。',
    'en': 'Quiet M4.5 dwarf — low flare activity makes it a high-priority atmosphere-characterisation target. b is a rocky super-Earth; c orbits further out.',
    'ja': 'M4.5 矮星。フレア活動が少なく大気観測の優先対象。b は岩石スーパーアース、c はより外側を周回。',
  },
  host: makeHost({ id: 'lhs-1140', name: 'LHS 1140', nameEn: 'LHS 1140',
    radiusKm: 0.211 * R_SUN_KM, massKg: 0.179 * M_SUN_KG, teffK: 3216 }),
  planets: [
    makePlanet({ id: 'lhs-1140-c', name: 'LHS 1140 c', nameEn: 'LHS 1140 c', parentId: 'lhs-1140',
      radiusKm: 1.282 * R_EARTH_KM, a: 0.02675, periodDays: 3.7779, iDeg: 89.92,
      description: { 'zh-Hant': '岩質。', 'en': 'Rocky.', 'ja': '岩石。' } }),
    makePlanet({ id: 'lhs-1140-b', name: 'LHS 1140 b', nameEn: 'LHS 1140 b', parentId: 'lhs-1140',
      radiusKm: 1.727 * R_EARTH_KM, massKg: 6.38 * M_EARTH_KG,
      a: 0.0957, e: 0.06, periodDays: 24.7368, iDeg: 89.86,
      description: { 'zh-Hant': '宜居帶內側的超地球，密度高 (~7 g/cm³)，岩質確認。', 'en': 'Habitable-zone super-Earth; high density (~7 g/cm³), confirmed rocky.', 'ja': 'ハビタブルゾーン内縁のスーパーアース。密度約 7 g/cm³ で岩石組成確認。' } }),
  ],
};

// =============================================================================
// 10. GJ 1214 — first mini-Neptune characterised
// =============================================================================
const GJ_1214_SYSTEM: ExoplanetSystemMeta = {
  id: 'gj-1214',
  name: { 'zh-Hant': 'GJ 1214', 'en': 'GJ 1214', 'ja': 'GJ 1214' },
  distanceLy: 47.5,
  raHours: 17.302,
  decDeg: 4.965,
  hostTeffK: 3250,
  description: {
    'zh-Hant': 'M4.5 紅矮星，b 是首顆被詳細研究的「迷你海王星」(2009)。其大氣可能富含水蒸氣。',
    'en': 'M4.5 red dwarf. b was the first "mini-Neptune" characterised in detail (2009); its atmosphere may be water-rich.',
    'ja': 'M4.5 赤色矮星。b は初めて詳細に研究された「ミニ海王星」(2009)。大気は水蒸気に富む可能性。',
  },
  host: makeHost({ id: 'gj-1214', name: 'GJ 1214', nameEn: 'GJ 1214',
    radiusKm: 0.215 * R_SUN_KM, massKg: 0.157 * M_SUN_KG, teffK: 3250 }),
  planets: [
    makePlanet({ id: 'gj-1214-b', name: 'GJ 1214 b', nameEn: 'GJ 1214 b', parentId: 'gj-1214',
      radiusKm: 2.742 * R_EARTH_KM, massKg: 8.17 * M_EARTH_KG,
      a: 0.01411, e: 0.0, periodDays: 1.58040482, iDeg: 88.7,
      description: { 'zh-Hant': '迷你海王星，2009 年發現。可能是水氣世界。', 'en': 'Mini-Neptune, discovered 2009. Possibly a water world.', 'ja': 'ミニ海王星、2009 年発見。水の世界の可能性。' } }),
  ],
};

// =============================================================================
// 11. KEPLER-452 — "Earth's older cousin"
// =============================================================================
const KEPLER_452_SYSTEM: ExoplanetSystemMeta = {
  id: 'kepler-452',
  name: { 'zh-Hant': 'Kepler-452', 'en': 'Kepler-452', 'ja': 'ケプラー 452' },
  distanceLy: 1402,
  raHours: 19.722,
  decDeg: 44.277,
  hostTeffK: 5757,
  description: {
    'zh-Hant': 'G 型恆星，比太陽老 15 億年。b 在宜居帶，公轉週期幾乎和地球一樣 (385 d)，被稱為「地球的老表親」。',
    'en': 'G-type star ~1.5 Gyr older than the Sun. Planet b sits in the habitable zone with a 385-day orbit — Earth\'s "older cousin".',
    'ja': 'G型星で太陽より 15 億年古い。惑星 b は公転周期 385 日でハビタブルゾーン内、「地球の年上のいとこ」と呼ばれる。',
  },
  host: makeHost({ id: 'kepler-452', name: 'Kepler-452', nameEn: 'Kepler-452',
    radiusKm: 1.110 * R_SUN_KM, massKg: 1.04 * M_SUN_KG, teffK: 5757 }),
  planets: [
    makePlanet({ id: 'kepler-452-b', name: 'Kepler-452 b', nameEn: 'Kepler-452 b', parentId: 'kepler-452',
      radiusKm: 1.63 * R_EARTH_KM, a: 1.046, e: 0.04, periodDays: 384.843, iDeg: 89.806,
      description: { 'zh-Hant': '超地球，宜居帶；公轉 385 d 與地球非常接近。', 'en': 'Super-Earth in the HZ; 385-day orbit close to Earth\'s.', 'ja': 'スーパーアース、HZ 内、公転周期 385 日は地球に酷似。' } }),
  ],
};

// =============================================================================
// 12. ALPHA CENTAURI A & B — symbolic system, no confirmed planets yet
// =============================================================================
const ALPHA_CEN_SYSTEM: ExoplanetSystemMeta = {
  id: 'alpha-centauri',
  name: { 'zh-Hant': '半人馬座 α (α Centauri)', 'en': 'Alpha Centauri', 'ja': 'ケンタウルス座 α 星' },
  distanceLy: 4.3667,
  raHours: 14.660,
  decDeg: -60.834,
  hostTeffK: 5790,
  description: {
    'zh-Hant': '與比鄰星形成三合星系統 (α Cen A, B, Proxima)。Toliman 任務 (2025+) 將以差分干涉測量法搜尋 α Cen A 周圍的類地行星。',
    'en': 'Forms a triple system with Proxima Centauri. The Toliman mission (2025+) will use differential astrometry to search α Cen A for Earth-like planets.',
    'ja': 'プロキシマ・ケンタウリと三重星系を形成。Toliman ミッション（2025〜）が差分位置観測で α Cen A 周辺の地球型惑星を探索予定。',
  },
  host: makeHost({ id: 'alpha-centauri', name: 'α Centauri A', nameEn: 'Alpha Centauri A',
    radiusKm: 1.2234 * R_SUN_KM, massKg: 1.0788 * M_SUN_KG, teffK: 5790 }),
  planets: [],
};

// =============================================================================
// Master export
// =============================================================================
export const EXOPLANET_SYSTEMS: ExoplanetSystemMeta[] = [
  TRAPPIST_1_SYSTEM,
  PROXIMA_SYSTEM,
  ALPHA_CEN_SYSTEM,
  KEPLER_186_SYSTEM,
  KEPLER_90_SYSTEM,
  KEPLER_452_SYSTEM,
  TOI_700_SYSTEM,
  PEG_51_SYSTEM,
  HD_209458_SYSTEM,
  WASP_12_SYSTEM,
  LHS_1140_SYSTEM,
  GJ_1214_SYSTEM,
];

/**
 * Quick lookup of a system by id. Used by the InfoPanel and the
 * ExoplanetHost click handler.
 */
export function getExoplanetSystem(id: string): ExoplanetSystemMeta | undefined {
  return EXOPLANET_SYSTEMS.find(s => s.id === id);
}
