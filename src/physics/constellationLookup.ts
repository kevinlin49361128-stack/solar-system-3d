/**
 * RA/Dec → IAU 88 constellation 3-letter abbreviation.
 *
 * Lazy-loads `/iau-boundaries.json` (the d3-celestial GeoJSON also used
 * by the IAUBoundaries scene layer) on first call. Until the data is
 * loaded the lookup returns null, so callers should treat null as
 * "unknown" and not render an empty value as if it meant "no
 * constellation".
 *
 * Algorithm: simple even-odd point-in-polygon ray-cast against each of
 * the 88 polygons. The d3-celestial dataset stores RA in degrees in
 * the range -180..180 (with the meridian at 0); we normalise the
 * query into the same range, and per-polygon we collapse RA wrap
 * (max-min > 180°) by shifting the negative-RA vertices by +360°
 * so the polygon stays simply-connected for the ray test. A simple
 * dec bbox filter short-circuits the 88-polygon scan.
 *
 * Accuracy: good enough for "what constellation is Jupiter in tonight"
 * (matches authoritative tables for non-pole bodies). Not suitable for
 * sub-arcsec automated boundary classification.
 */
export type ConstellationAbbr = string;  // IAU 3-letter (e.g. 'Ori', 'UMa')

/**
 * IAU 3-letter abbreviation → trilingual full name. The Latin /
 * English / zh-Hant / ja columns match the Wikipedia "List of IAU
 * constellations" canonical translations. Used by SkyPanel's
 * tooltip so that users who don't recognise "Tau" still see "Taurus
 * 金牛座 / おうし座".
 */
export interface ConstellationName {
  /** Latin (canonical) — e.g. 'Taurus'. */
  latin: string;
  /** Traditional Chinese astronomical name. */
  zhHant: string;
  /** Japanese astronomical name (hiragana + 座). */
  ja: string;
}
export const CONSTELLATION_NAMES: Record<ConstellationAbbr, ConstellationName> = {
  And: { latin: 'Andromeda',         zhHant: '仙女座',     ja: 'アンドロメダ座' },
  Ant: { latin: 'Antlia',            zhHant: '唧筒座',     ja: 'ポンプ座' },
  Aps: { latin: 'Apus',              zhHant: '天燕座',     ja: 'ふうちょう座' },
  Aql: { latin: 'Aquila',            zhHant: '天鷹座',     ja: 'わし座' },
  Aqr: { latin: 'Aquarius',          zhHant: '寶瓶座',     ja: 'みずがめ座' },
  Ara: { latin: 'Ara',               zhHant: '天壇座',     ja: 'さいだん座' },
  Ari: { latin: 'Aries',             zhHant: '白羊座',     ja: 'おひつじ座' },
  Aur: { latin: 'Auriga',            zhHant: '御夫座',     ja: 'ぎょしゃ座' },
  Boo: { latin: 'Boötes',            zhHant: '牧夫座',     ja: 'うしかい座' },
  CMa: { latin: 'Canis Major',       zhHant: '大犬座',     ja: 'おおいぬ座' },
  CMi: { latin: 'Canis Minor',       zhHant: '小犬座',     ja: 'こいぬ座' },
  CVn: { latin: 'Canes Venatici',    zhHant: '獵犬座',     ja: 'りょうけん座' },
  Cae: { latin: 'Caelum',            zhHant: '雕具座',     ja: 'ちょうこくぐ座' },
  Cam: { latin: 'Camelopardalis',    zhHant: '鹿豹座',     ja: 'きりん座' },
  Cap: { latin: 'Capricornus',       zhHant: '摩羯座',     ja: 'やぎ座' },
  Car: { latin: 'Carina',            zhHant: '船底座',     ja: 'りゅうこつ座' },
  Cas: { latin: 'Cassiopeia',        zhHant: '仙后座',     ja: 'カシオペヤ座' },
  Cen: { latin: 'Centaurus',         zhHant: '半人馬座',   ja: 'ケンタウルス座' },
  Cep: { latin: 'Cepheus',           zhHant: '仙王座',     ja: 'ケフェウス座' },
  Cet: { latin: 'Cetus',             zhHant: '鯨魚座',     ja: 'くじら座' },
  Cha: { latin: 'Chamaeleon',        zhHant: '蝘蜓座',     ja: 'カメレオン座' },
  Cir: { latin: 'Circinus',          zhHant: '圓規座',     ja: 'コンパス座' },
  Cnc: { latin: 'Cancer',            zhHant: '巨蟹座',     ja: 'かに座' },
  Col: { latin: 'Columba',           zhHant: '天鴿座',     ja: 'はと座' },
  Com: { latin: 'Coma Berenices',    zhHant: '后髮座',     ja: 'かみのけ座' },
  CrA: { latin: 'Corona Australis',  zhHant: '南冕座',     ja: 'みなみのかんむり座' },
  CrB: { latin: 'Corona Borealis',   zhHant: '北冕座',     ja: 'かんむり座' },
  Crt: { latin: 'Crater',            zhHant: '巨爵座',     ja: 'コップ座' },
  Cru: { latin: 'Crux',              zhHant: '南十字座',   ja: 'みなみじゅうじ座' },
  Crv: { latin: 'Corvus',            zhHant: '烏鴉座',     ja: 'からす座' },
  Cyg: { latin: 'Cygnus',            zhHant: '天鵝座',     ja: 'はくちょう座' },
  Del: { latin: 'Delphinus',         zhHant: '海豚座',     ja: 'いるか座' },
  Dor: { latin: 'Dorado',            zhHant: '劍魚座',     ja: 'かじき座' },
  Dra: { latin: 'Draco',             zhHant: '天龍座',     ja: 'りゅう座' },
  Equ: { latin: 'Equuleus',          zhHant: '小馬座',     ja: 'こうま座' },
  Eri: { latin: 'Eridanus',          zhHant: '波江座',     ja: 'エリダヌス座' },
  For: { latin: 'Fornax',            zhHant: '天爐座',     ja: 'ろ座' },
  Gem: { latin: 'Gemini',            zhHant: '雙子座',     ja: 'ふたご座' },
  Gru: { latin: 'Grus',              zhHant: '天鶴座',     ja: 'つる座' },
  Her: { latin: 'Hercules',          zhHant: '武仙座',     ja: 'ヘルクレス座' },
  Hor: { latin: 'Horologium',        zhHant: '時鐘座',     ja: 'とけい座' },
  Hya: { latin: 'Hydra',             zhHant: '長蛇座',     ja: 'うみへび座' },
  Hyi: { latin: 'Hydrus',            zhHant: '水蛇座',     ja: 'みずへび座' },
  Ind: { latin: 'Indus',             zhHant: '印第安座',   ja: 'インディアン座' },
  LMi: { latin: 'Leo Minor',         zhHant: '小獅座',     ja: 'こじし座' },
  Lac: { latin: 'Lacerta',           zhHant: '蝎虎座',     ja: 'とかげ座' },
  Leo: { latin: 'Leo',               zhHant: '獅子座',     ja: 'しし座' },
  Lep: { latin: 'Lepus',             zhHant: '天兔座',     ja: 'うさぎ座' },
  Lib: { latin: 'Libra',             zhHant: '天秤座',     ja: 'てんびん座' },
  Lup: { latin: 'Lupus',             zhHant: '豺狼座',     ja: 'おおかみ座' },
  Lyn: { latin: 'Lynx',              zhHant: '天貓座',     ja: 'やまねこ座' },
  Lyr: { latin: 'Lyra',              zhHant: '天琴座',     ja: 'こと座' },
  Men: { latin: 'Mensa',             zhHant: '山案座',     ja: 'テーブルさん座' },
  Mic: { latin: 'Microscopium',      zhHant: '顯微鏡座',   ja: 'けんびきょう座' },
  Mon: { latin: 'Monoceros',         zhHant: '麒麟座',     ja: 'いっかくじゅう座' },
  Mus: { latin: 'Musca',             zhHant: '蒼蠅座',     ja: 'はえ座' },
  Nor: { latin: 'Norma',             zhHant: '矩尺座',     ja: 'じょうぎ座' },
  Oct: { latin: 'Octans',            zhHant: '南極座',     ja: 'はちぶんぎ座' },
  Oph: { latin: 'Ophiuchus',         zhHant: '蛇夫座',     ja: 'へびつかい座' },
  Ori: { latin: 'Orion',             zhHant: '獵戶座',     ja: 'オリオン座' },
  Pav: { latin: 'Pavo',              zhHant: '孔雀座',     ja: 'くじゃく座' },
  Peg: { latin: 'Pegasus',           zhHant: '飛馬座',     ja: 'ペガスス座' },
  Per: { latin: 'Perseus',           zhHant: '英仙座',     ja: 'ペルセウス座' },
  Phe: { latin: 'Phoenix',           zhHant: '鳳凰座',     ja: 'ほうおう座' },
  Pic: { latin: 'Pictor',            zhHant: '繪架座',     ja: 'がか座' },
  PsA: { latin: 'Piscis Austrinus',  zhHant: '南魚座',     ja: 'みなみのうお座' },
  Psc: { latin: 'Pisces',            zhHant: '雙魚座',     ja: 'うお座' },
  Pup: { latin: 'Puppis',            zhHant: '船尾座',     ja: 'とも座' },
  Pyx: { latin: 'Pyxis',             zhHant: '羅盤座',     ja: 'らしんばん座' },
  Ret: { latin: 'Reticulum',         zhHant: '網罟座',     ja: 'レチクル座' },
  Scl: { latin: 'Sculptor',          zhHant: '玉夫座',     ja: 'ちょうこくしつ座' },
  Sco: { latin: 'Scorpius',          zhHant: '天蠍座',     ja: 'さそり座' },
  Sct: { latin: 'Scutum',            zhHant: '盾牌座',     ja: 'たて座' },
  Ser: { latin: 'Serpens',           zhHant: '巨蛇座',     ja: 'へび座' },
  Sex: { latin: 'Sextans',           zhHant: '六分儀座',   ja: 'ろくぶんぎ座' },
  Sge: { latin: 'Sagitta',           zhHant: '天箭座',     ja: 'や座' },
  Sgr: { latin: 'Sagittarius',       zhHant: '人馬座',     ja: 'いて座' },
  Tau: { latin: 'Taurus',            zhHant: '金牛座',     ja: 'おうし座' },
  Tel: { latin: 'Telescopium',       zhHant: '望遠鏡座',   ja: 'ぼうえんきょう座' },
  TrA: { latin: 'Triangulum Australe', zhHant: '南三角座', ja: 'みなみのさんかく座' },
  Tri: { latin: 'Triangulum',        zhHant: '三角座',     ja: 'さんかく座' },
  Tuc: { latin: 'Tucana',            zhHant: '杜鵑座',     ja: 'きょしちょう座' },
  UMa: { latin: 'Ursa Major',        zhHant: '大熊座',     ja: 'おおぐま座' },
  UMi: { latin: 'Ursa Minor',        zhHant: '小熊座',     ja: 'こぐま座' },
  Vel: { latin: 'Vela',              zhHant: '船帆座',     ja: 'ほ座' },
  Vir: { latin: 'Virgo',             zhHant: '室女座',     ja: 'おとめ座' },
  Vol: { latin: 'Volans',            zhHant: '飛魚座',     ja: 'とびうお座' },
  Vul: { latin: 'Vulpecula',         zhHant: '狐狸座',     ja: 'こぎつね座' },
};

/**
 * Localised label for a constellation abbreviation, given the active
 * UI language. Returns the abbreviation itself as a fallback if the
 * abbrev is unknown (shouldn't happen — the table covers all 88).
 */
export function constellationLabel(abbr: ConstellationAbbr, lang: 'zh-Hant' | 'en' | 'ja'): string {
  const entry = CONSTELLATION_NAMES[abbr];
  if (!entry) return abbr;
  if (lang === 'en') return entry.latin;
  if (lang === 'ja') return entry.ja;
  return entry.zhHant;
}

interface Poly {
  id: ConstellationAbbr;
  /** Vertices as (raDeg, decDeg) pairs after wrap normalisation. */
  verts: Array<[number, number]>;
  /** Bounding box for fast reject; raMin/raMax in the same coord system as verts. */
  raMin: number; raMax: number; decMin: number; decMax: number;
  /** True iff polygon crossed the RA wrap and verts have been shifted. */
  wrapped: boolean;
}

interface GeoJSONFC {
  features: Array<{
    id: string;
    geometry: {
      type: 'Polygon' | 'MultiPolygon';
      coordinates: number[][][] | number[][][][];
    };
  }>;
}

let polygons: Poly[] | null = null;
let loadPromise: Promise<void> | null = null;

/**
 * Begin loading the IAU boundaries data. Idempotent. Resolves when
 * polygons are ready; subsequent calls share the same in-flight promise.
 */
export async function loadConstellationData(url = '/iau-boundaries.json'): Promise<void> {
  if (polygons) return;
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`constellationLookup load failed: ${resp.status}`);
    const data = await resp.json() as GeoJSONFC;
    polygons = parsePolygons(data);
  })();
  return loadPromise;
}

function parsePolygons(data: GeoJSONFC): Poly[] {
  const out: Poly[] = [];
  for (const feat of data.features) {
    const id = (feat.id ?? '').toString();
    if (!id) continue;
    const rings = feat.geometry.type === 'Polygon'
      ? [feat.geometry.coordinates as number[][][]]
      : (feat.geometry.coordinates as number[][][][]);
    for (const polygon of rings) {
      // Use only the outer ring (ring 0) — IAU polygons don't have holes.
      const ring = polygon[0];
      if (!ring || ring.length < 3) continue;
      let raMin = Infinity, raMax = -Infinity;
      for (const [ra] of ring) { if (ra < raMin) raMin = ra; if (ra > raMax) raMax = ra; }
      // If the polygon's RA range exceeds 180° it crosses the antimeridian
      // (the common case is Eridanus or octans-area polygons spanning 0).
      // Shift negatives by +360 so verts live in [0..360+] and the ray
      // test runs on a simply-connected shape.
      const wrapped = raMax - raMin > 180;
      const verts: Array<[number, number]> = ring.map(([ra, dec]) =>
        [wrapped && ra < 0 ? ra + 360 : ra, dec] as [number, number]);
      const ras = verts.map(v => v[0]);
      const decs = verts.map(v => v[1]);
      out.push({
        id,
        verts,
        raMin: Math.min(...ras), raMax: Math.max(...ras),
        decMin: Math.min(...decs), decMax: Math.max(...decs),
        wrapped,
      });
    }
  }
  return out;
}

/**
 * Look up the IAU constellation containing the point (ra, dec).
 *  - raHours: 0..24
 *  - decDeg: -90..+90
 * Returns the 3-letter abbreviation (e.g. 'Tau' for Taurus) or null
 * if the data hasn't loaded yet or the point fell outside every
 * polygon (shouldn't happen for valid coords).
 */
export function constellationFor(raHours: number, decDeg: number): ConstellationAbbr | null {
  if (!polygons) return null;
  // Normalise to (-180..180] to match the d3-celestial coordinate
  // convention (most polygons live there; wrapped ones are also tested
  // against a +360-shifted query).
  const raDeg = ((raHours * 15 + 180) % 360 + 360) % 360 - 180;
  const raDegShifted = raDeg < 0 ? raDeg + 360 : raDeg;
  for (const p of polygons) {
    if (decDeg < p.decMin || decDeg > p.decMax) continue;
    const queryRa = p.wrapped ? raDegShifted : raDeg;
    if (queryRa < p.raMin || queryRa > p.raMax) continue;
    if (pointInPolygon(queryRa, decDeg, p.verts)) return p.id;
  }
  return null;
}

function pointInPolygon(x: number, y: number, verts: Array<[number, number]>): boolean {
  let inside = false;
  for (let i = 0, j = verts.length - 1; i < verts.length; j = i++) {
    const [xi, yi] = verts[i];
    const [xj, yj] = verts[j];
    const intersects = ((yi > y) !== (yj > y))
      && (x < (xj - xi) * (y - yi) / (yj - yi + 1e-30) + xi);
    if (intersects) inside = !inside;
  }
  return inside;
}
