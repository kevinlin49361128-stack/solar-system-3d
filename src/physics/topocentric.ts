import { Vector3 } from 'three';
import { DEG2RAD, J2000_JD, AU_KM, TWO_PI } from './constants';

const EARTH_TILT_DEG = 23.4393;
const EARTH_TILT_RAD = EARTH_TILT_DEG * DEG2RAD;
const EARTH_RADIUS_KM = 6371.0;
export const EARTH_RADIUS_AU = EARTH_RADIUS_KM / AU_KM;

/**
 * Greenwich Mean Sidereal Time (rad).
 *
 * Vallado / IAU 1982 polynomial. Valid throughout the modern era; sub-arcsec
 * accuracy is overkill here, we only need it for sky-pointing visualisation.
 *
 * Range: the polynomial is documented to ~sub-arcsec accuracy in the
 * 1900–2100 window. Outside that we still return a reasonable answer
 * (errors grow as O(T⁴) from the omitted higher-order terms), but for
 * year < 1700 or year > 2300 a one-time console warning fires so a
 * curious dev sees that they're extrapolating. The simulator stays
 * usable; this is just a "you asked for 1342 CE — your numbers may
 * drift a few arcminutes" note.
 */
const GMST_VALID_JD_MIN = 2342032.5;  // 1700-01-01
const GMST_VALID_JD_MAX = 2488092.5;  // 2300-01-01
let gmstWarnedOnce = false;
export function gmstRad(jd: number): number {
  if (!gmstWarnedOnce && (jd < GMST_VALID_JD_MIN || jd > GMST_VALID_JD_MAX)) {
    gmstWarnedOnce = true;
    console.warn(
      `gmstRad(jd=${jd.toFixed(2)}): outside the IAU 1982 polynomial's ~1700–2300 calibration window; sky-pointing accuracy may degrade by minutes-of-arc.`,
    );
  }
  const T = (jd - J2000_JD) / 36525;
  let gmstSec = 67310.54841
    + (876600 * 3600 + 8640184.812866) * T
    + 0.093104 * T * T
    - 6.2e-6 * T * T * T;
  gmstSec = ((gmstSec % 86400) + 86400) % 86400;
  let rad = gmstSec * (Math.PI / 43200);
  rad = ((rad % TWO_PI) + TWO_PI) % TWO_PI;
  return rad;
}

export interface ObserverFrame {
  /** Offset from Earth centre, in ecliptic-J2000 frame, magnitude = Earth radius (AU). */
  position: Vector3;
  /** Local zenith (up), unit vector in ecliptic frame. */
  zenith: Vector3;
  /** Local east, unit vector in ecliptic frame. */
  east: Vector3;
  /** Local north, unit vector in ecliptic frame. */
  north: Vector3;
}

/**
 * Compute observer's local horizon frame in J2000 ecliptic coordinates.
 *
 * Pipeline: ECEF (Earth-fixed) → ECI equatorial (apply GMST around Z) →
 * ecliptic (rotate around X by -obliquity).
 */
export function observerEcliptic(latDeg: number, lonDeg: number, jd: number): ObserverFrame {
  const lat = latDeg * DEG2RAD;
  const lon = lonDeg * DEG2RAD;
  const cosLat = Math.cos(lat);
  const sinLat = Math.sin(lat);
  const cosLon = Math.cos(lon);
  const sinLon = Math.sin(lon);

  // ECEF basis (Earth-fixed): X to lon=0/lat=0, Z to north pole
  const ecefPos = new Vector3(cosLat * cosLon, cosLat * sinLon, sinLat);
  // ECEF zenith = position direction
  const ecefZen = ecefPos.clone();
  // ECEF east = ∂pos/∂lon (normalised)
  const ecefEast = new Vector3(-sinLon, cosLon, 0);
  // ECEF north = zenith × east
  const ecefNorth = new Vector3(-sinLat * cosLon, -sinLat * sinLon, cosLat);

  // ECEF → ECI equatorial: rotate around Z by GMST
  const gmst = gmstRad(jd);
  const cosG = Math.cos(gmst);
  const sinG = Math.sin(gmst);
  const rotateZ = (v: Vector3) => new Vector3(
    cosG * v.x - sinG * v.y,
    sinG * v.x + cosG * v.y,
    v.z,
  );

  // Equatorial → ecliptic: rotate around X by -ε
  const ce = Math.cos(EARTH_TILT_RAD);
  const se = Math.sin(EARTH_TILT_RAD);
  const rotateX = (v: Vector3) => new Vector3(
    v.x,
    v.y * ce + v.z * se,
    -v.y * se + v.z * ce,
  );

  const transform = (v: Vector3) => rotateX(rotateZ(v));

  return {
    position: transform(ecefPos).multiplyScalar(EARTH_RADIUS_AU),
    zenith: transform(ecefZen),
    east: transform(ecefEast),
    north: transform(ecefNorth),
  };
}

/**
 * Convert J2000 equatorial coordinates (RA in hours, Dec in degrees) to a
 * unit direction in the ecliptic-J2000 frame. Useful for fixed stars whose
 * direction does not change with time (within visualisation tolerance).
 *
 * If `jd` is provided, applies IAU 1976 precession to convert to the mean
 * equinox of date. Without precession, by 2100 stars drift ~1.4° from their
 * J2000 catalogue positions.
 */
/**
 * Apply proper motion to a star's RA/Dec. Inputs in degrees + mas/yr; jd is
 * the target epoch. Output in {raHours, decDeg} at the new epoch.
 *
 * pmRA is the cosine-corrected motion (mas / yr), as published by Hipparcos.
 * Annual rate; assumes linear approximation valid over hundreds of years.
 */
export function applyProperMotion(
  raHours: number, decDeg: number, jd: number,
  pmRAMasPerYr: number, pmDecMasPerYr: number,
): { raHours: number; decDeg: number } {
  const yearsFromJ2000 = (jd - J2000_JD) / 365.25;
  // mas → degrees
  const dRaDeg = (pmRAMasPerYr / 3.6e6) * yearsFromJ2000 / Math.cos(decDeg * DEG2RAD);
  const dDecDeg = (pmDecMasPerYr / 3.6e6) * yearsFromJ2000;
  // RA in deg, then convert back to hours
  const raDeg = raHours * 15;
  return {
    raHours: ((raDeg + dRaDeg) % 360 + 360) % 360 / 15,
    decDeg: decDeg + dDecDeg,
  };
}

/**
 * Annual aberration: shift the apparent direction of a star toward Earth's
 * motion through space. Magnitude up to ~20.5″ (constant of aberration).
 *
 * Approximation: treat Earth's heliocentric velocity as uniform circular
 * motion at 29.78 km/s, perpendicular to the Earth-Sun direction in the
 * ecliptic plane. Formula from Meeus ch. 23 (low-precision form).
 *
 * Inputs: ecliptic-frame star direction (unit vector), Earth's heliocentric
 * direction at jd (sun→earth, NOT earth→sun). Returns aberration-corrected
 * direction (unit vector) in the same ecliptic frame.
 */
export function applyAberration(
  starDirEcl: Vector3,
  earthSunDirEcl: Vector3,
): Vector3 {
  // Earth's heliocentric VELOCITY direction is perpendicular to the
  // sun→earth radial in the ecliptic plane, rotated 90° prograde:
  // if sun→earth = (x, y, z), velocity ≈ (-y, x, 0)/|.|.
  const vDir = new Vector3(-earthSunDirEcl.y, earthSunDirEcl.x, 0).normalize();
  const kappa = 20.49552 / 3600 * DEG2RAD; // constant of aberration in rad
  // Apparent direction = star + (κ × component of velocity perpendicular to star).
  // Linear-in-κ approximation; max error 1e-9 rad.
  const proj = starDirEcl.dot(vDir);
  const perp = vDir.clone().sub(starDirEcl.clone().multiplyScalar(proj));
  return starDirEcl.clone().addScaledVector(perp, kappa).normalize();
}

/**
 * Inverse of `raDecToEcliptic` for J2000: takes a 3D direction in the
 * ecliptic-J2000 frame (any non-zero magnitude OK; we only use the
 * direction) and returns its equatorial RA in hours [0, 24) and Dec in
 * degrees [-90, +90]. Used by SkyPanel to look up which constellation
 * a planet currently occupies.
 *
 * No precession or nutation — fine for "what constellation" since the
 * IAU 88 boundaries are large enough that J2000-vs-mean-of-date drift
 * (≤ 1.4° by 2100) doesn't change the answer except for points right
 * on a boundary.
 */
export function eclipticDirToRaDec(eclX: number, eclY: number, eclZ: number): { raHours: number; decDeg: number } {
  // Ecliptic → equatorial: rotate +ε around X (inverse of the rotation
  // baked into raDecToEcliptic, which goes equatorial → ecliptic via −ε).
  const ce = Math.cos(EARTH_TILT_RAD);
  const se = Math.sin(EARTH_TILT_RAD);
  const eqX = eclX;
  const eqY = ce * eclY - se * eclZ;
  const eqZ = se * eclY + ce * eclZ;
  const len = Math.hypot(eqX, eqY, eqZ);
  if (len === 0) return { raHours: 0, decDeg: 0 };
  const decRad = Math.asin(Math.max(-1, Math.min(1, eqZ / len)));
  let raRad = Math.atan2(eqY, eqX);
  if (raRad < 0) raRad += 2 * Math.PI;
  return { raHours: raRad * 12 / Math.PI, decDeg: decRad * 180 / Math.PI };
}

export function raDecToEcliptic(raHours: number, decDeg: number, jd?: number): Vector3 {
  let ra = raHours * Math.PI / 12;
  let dec = decDeg * DEG2RAD;

  if (jd !== undefined) {
    const T = (jd - J2000_JD) / 36525;
    // IAU 1976 precession (arcseconds → radians)
    const arcsec = Math.PI / (180 * 3600);
    const zeta  = (2306.2181 * T + 0.30188 * T * T + 0.017998 * T * T * T) * arcsec;
    const z     = (2306.2181 * T + 1.09468 * T * T + 0.018203 * T * T * T) * arcsec;
    const theta = (2004.3109 * T - 0.42665 * T * T - 0.041833 * T * T * T) * arcsec;
    // Apply rotation R3(-z) R2(theta) R3(-zeta) to (RA, Dec) on celestial sphere
    const x0 = Math.cos(dec) * Math.cos(ra);
    const y0 = Math.cos(dec) * Math.sin(ra);
    const z0 = Math.sin(dec);
    // R3(-zeta) around equatorial Z
    const cZ1 = Math.cos(zeta), sZ1 = Math.sin(zeta);
    const x1 = cZ1 * x0 + sZ1 * y0;
    const y1 = -sZ1 * x0 + cZ1 * y0;
    const z1 = z0;
    // R2(theta) around equatorial Y
    const cT = Math.cos(theta), sT = Math.sin(theta);
    const x2 = cT * x1 - sT * z1;
    const y2 = y1;
    const z2 = sT * x1 + cT * z1;
    // R3(-z)
    const cZ2 = Math.cos(z), sZ2 = Math.sin(z);
    const x3 = cZ2 * x2 + sZ2 * y2;
    const y3 = -sZ2 * x2 + cZ2 * y2;
    const z3 = z2;
    ra = Math.atan2(y3, x3);
    dec = Math.asin(Math.max(-1, Math.min(1, z3)));
  }

  const xEq = Math.cos(dec) * Math.cos(ra);
  const yEq = Math.cos(dec) * Math.sin(ra);
  const zEq = Math.sin(dec);
  const cE = Math.cos(EARTH_TILT_RAD);
  const sE = Math.sin(EARTH_TILT_RAD);
  return new Vector3(xEq, yEq * cE + zEq * sE, -yEq * sE + zEq * cE);
}

/**
 * Bennett 1982 atmospheric refraction formula. Given true altitude (degrees),
 * returns the apparent shift upward in degrees (always positive for objects
 * above ~-1° true altitude).
 */
export function atmosphericRefractionDeg(trueAltDeg: number): number {
  if (trueAltDeg < -2) return 0;
  const altPlus = trueAltDeg + 7.31 / (trueAltDeg + 4.4);
  const cot = 1 / Math.tan(altPlus * DEG2RAD);
  return cot / 60 * REFRACTION_TP_SCALE;
}

/**
 * Pressure (mbar) and temperature (°C) scaling for Bennett refraction
 * (Meeus 1998 §16). Default is sea-level standard atmosphere (1010 mbar /
 * 10 °C). Mountain-top observatories want lower P + lower T; tropical
 * humid sites want unchanged P + higher T. Updated externally via
 * `setAtmosphericConditions`.
 */
let REFRACTION_TP_SCALE = 1.0;
let CURRENT_PRESSURE_MBAR = 1010;
let CURRENT_TEMPERATURE_C = 10;

export function setAtmosphericConditions(pressureMbar: number, temperatureC: number): void {
  CURRENT_PRESSURE_MBAR = pressureMbar;
  CURRENT_TEMPERATURE_C = temperatureC;
  REFRACTION_TP_SCALE = (pressureMbar / 1010) * (283 / (273 + temperatureC));
}
export function getAtmosphericConditions(): { pressureMbar: number; temperatureC: number } {
  return { pressureMbar: CURRENT_PRESSURE_MBAR, temperatureC: CURRENT_TEMPERATURE_C };
}

/**
 * Decompose a unit direction (in scene frame) into a horizon frame defined by
 * basis vectors (also in scene frame). Returns altitude (radians, +π/2 = zenith)
 * and azimuth (radians, 0 = north, +π/2 = east).
 */
export function dirToAltAz(
  dir: { x: number; y: number; z: number },
  zenith: { x: number; y: number; z: number },
  east: { x: number; y: number; z: number },
  north: { x: number; y: number; z: number },
): { altRad: number; azRad: number } {
  const len = Math.hypot(dir.x, dir.y, dir.z) || 1;
  const dx = dir.x / len, dy = dir.y / len, dz = dir.z / len;
  const upComp = dx * zenith.x + dy * zenith.y + dz * zenith.z;
  const eastComp = dx * east.x + dy * east.y + dz * east.z;
  const northComp = dx * north.x + dy * north.y + dz * north.z;
  let altRad = Math.asin(Math.max(-1, Math.min(1, upComp)));
  let azRad = Math.atan2(eastComp, northComp);
  if (azRad < 0) azRad += TWO_PI;
  return { altRad, azRad };
}

/** Predefined observation locations. */
export interface ObserverLocation {
  id: string;
  name: string;
  nameEn?: string;
  nameJa?: string;
  lat: number;
  lon: number;
  elevationM?: number;
  description?: string;
  /**
   * Suggested Bortle scale (1 = pristine dark, 9 = inner-city). Auto-applied
   * when the user picks this preset; they can still override via the slider.
   * Cities default to 7–8, observatories 1–3, polar stations 1.
   */
  bortle?: number;
  /**
   * Official site or canonical reference URL — shown as a clickable link
   * in the SiteInfo card so users can read more. Wikipedia or
   * institutional homepages preferred over personal pages.
   */
  website?: string;
  /**
   * Optional thumbnail image (Wikimedia Commons preferred — they allow
   * hotlinking under CC license). Shown above the description text in the
   * SiteInfo card. Use ~300–600 px wide URLs to keep download light.
   */
  imageUrl?: string;
}

export const OBSERVER_CITIES: ObserverLocation[] = [
  { id: 'kaohsiung', name: '高雄', nameEn: 'Kaohsiung', nameJa: '高雄',           lat: 22.6273, lon: 120.3014, bortle: 8 },
  { id: 'tokyo',     name: '東京', nameEn: 'Tokyo',     nameJa: '東京',           lat: 35.6762, lon: 139.6503, bortle: 9 },
  { id: 'new-york',  name: '紐約', nameEn: 'New York',  nameJa: 'ニューヨーク',   lat: 40.7128, lon: -74.0060, bortle: 9 },
  { id: 'london',    name: '倫敦', nameEn: 'London',    nameJa: 'ロンドン',       lat: 51.5074, lon: -0.1278, bortle: 8 },
  { id: 'sydney',    name: '雪梨', nameEn: 'Sydney',    nameJa: 'シドニー',       lat: -33.8688, lon: 151.2093, bortle: 8 },
  { id: 'cape',      name: '開普敦', nameEn: 'Cape Town', nameJa: 'ケープタウン', lat: -33.9249, lon: 18.4241, bortle: 7 },
];

/** Famous astronomical observatories — both modern and historical. */
// Wikimedia Special:FilePath URLs are permanent redirects to the current
// canonical file location — preferred over direct upload.wikimedia.org
// links because they survive file re-uploads / renames.
const WM = (filename: string, width = 600): string =>
  `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(filename)}?width=${width}`;

export const OBSERVER_OBSERVATORIES: ObserverLocation[] = [
  {
    id: 'mauna-kea',
    name: '茂納凱亞天文台',
    nameEn: 'Mauna Kea Observatories',
    nameJa: 'マウナケア天文台群',
    lat: 19.8237, lon: -155.4729, elevationM: 4205, bortle: 1,
    description: '夏威夷大島茂納凱亞火山頂，海拔 4 205 m，集結 13 座望遠鏡，包含凱克 (Keck I/II 各 10 m)、昴星團 (Subaru 8.2 m)、雙子北 (Gemini 8 m)。低濕度、極暗夜空與穩定氣流使其長期被列為地球上最佳光學/紅外觀測點。原為夏威夷原住民聖地，至今觀測站擴建仍受社會爭議。',
    website: 'https://www.maunakeaobservatories.org/',
    imageUrl: WM('Mauna_Kea_observatory.jpg'),
  },
  {
    id: 'paranal',
    name: '帕拉納天文台',
    nameEn: 'Cerro Paranal / VLT',
    nameJa: 'パラナル天文台 / VLT',
    lat: -24.6275, lon: -70.4044, elevationM: 2635, bortle: 1,
    description: '智利阿塔卡馬沙漠，歐洲南方天文台 (ESO) 旗艦站。四座 8.2 m UT 鏡可單獨運作或合成 130 m 等效口徑的 VLTI 干涉儀。2017 年首次拍攝太陽系外行星直接成像 (HR 8799)、2019 年 EHT 黑洞影像中也納入此站貢獻。年均晴夜超過 330 天。',
    website: 'https://www.eso.org/public/teles-instr/paranal-observatory/',
    imageUrl: WM('ESO-VLT-Laser-phot-33a-07.jpg'),
  },
  {
    id: 'mt-wilson',
    name: '威爾遜山天文台',
    nameEn: 'Mount Wilson Observatory',
    nameJa: 'ウィルソン山天文台',
    lat: 34.2257, lon: -118.0572, elevationM: 1742, bortle: 6,
    description: '加州洛杉磯近郊，海拔 1 742 m。1917 年完工的 100 吋 (2.5 m) Hooker 望遠鏡使哈伯 (Edwin Hubble) 在 1923 年確認仙女座為「島宇宙」、1929 年發現宇宙膨脹的紅移-距離關係，奠定現代宇宙學。也是夏普利在 1918 年首次定出銀河系大小的所在。',
    website: 'https://www.mtwilson.edu/',
    imageUrl: WM('100_inch_Hooker_Telescope_900_px.jpg'),
  },
  {
    id: 'lowell',
    name: '羅威爾天文台',
    nameEn: 'Lowell Observatory',
    nameJa: 'ローウェル天文台',
    lat: 35.2027, lon: -111.6646, elevationM: 2210, bortle: 3,
    description: '美國亞利桑那弗拉格斯塔夫，由帕西瓦・羅威爾於 1894 年創立。1930 年克萊德・湯博 (Clyde Tombaugh) 用此地 13 吋天文照相儀發現冥王星。羅威爾本人晚年痴迷於火星「運河」假說，雖然錯誤但激勵了行星天文學研究。',
    website: 'https://lowell.edu/',
    imageUrl: WM('Lowell_Observatory.jpg'),
  },
  {
    id: 'greenwich',
    name: '格林威治皇家天文台',
    nameEn: 'Royal Greenwich Observatory',
    nameJa: 'グリニッジ天文台',
    lat: 51.4769, lon: 0.0005, elevationM: 47, bortle: 9,
    description: '倫敦東南。1675 年由查理二世下令建立，目標是改進天文導航以解決經度問題。1851 年 Airy 子午儀定義了「本初子午線」(經度 0°)，1884 年國際會議正式採用為全球基準。也是格林威治平均時 (GMT) 的發源地。',
    website: 'https://www.rmg.co.uk/royal-observatory',
    imageUrl: WM('Royal_observatory_greenwich.jpg'),
  },
  {
    id: 'paris-obs',
    name: '巴黎天文台',
    nameEn: 'Observatoire de Paris',
    nameJa: 'パリ天文台',
    lat: 48.8366, lon: 2.3366, elevationM: 67, bortle: 9,
    description: '1667 年由路易十四下令建立，全球最古老仍在運作的天文台之一。卡西尼父子四代曾任台長：喬瓦尼・卡西尼於此測定地火距離、發現土星環縫 (Cassini Division) 與四顆土衛。今日為法國天文研究國家中心。',
    website: 'https://www.observatoiredeparis.psl.eu/',
    imageUrl: WM('Observatoire_de_Paris.jpg'),
  },
  {
    id: 'beijing-ancient',
    name: '北京古觀象台',
    nameEn: 'Beijing Ancient Observatory',
    nameJa: '北京古観象台',
    lat: 39.9059, lon: 116.4282, elevationM: 50, bortle: 9,
    description: '建於明正統七年 (1442 年)，元代天文台基址；坐落於北京建國門立交橋西南。曾置赤道經緯儀、紀限儀等八件大型青銅儀器，由耶穌會傳教士南懷仁於康熙年間參與設計。連續觀測近 500 年，是世界上連續使用最久的觀象台之一，1929 年才停止天文觀測。',
    website: 'https://zh.wikipedia.org/wiki/北京古观象台',
    imageUrl: WM('北京古观象台.jpg'),
  },
  {
    id: 'jaipur-jantar',
    name: '齋浦爾簡塔曼塔',
    nameEn: 'Jaipur Jantar Mantar',
    nameJa: 'ジャイプール・ジャンタル・マンタル',
    lat: 26.9248, lon: 75.8246, elevationM: 432, bortle: 8,
    description: '印度齋浦爾的王公賈伊・辛格二世於 1734 年建造的露天石造天文儀器群，是其建立的五座簡塔曼塔中規模最大者。包含 27 m 高的「Samrat Yantra」日晷，可達 2 秒精度，是目前世上最大的石製日晷。2010 年列入聯合國世界遺產。',
    website: 'https://whc.unesco.org/en/list/1338/',
    imageUrl: WM('Jantar_Mantar_at_Jaipur.jpg'),
  },
  {
    id: 'stonehenge',
    name: '巨石陣',
    nameEn: 'Stonehenge',
    nameJa: 'ストーンヘンジ',
    lat: 51.1789, lon: -1.8262, elevationM: 100, bortle: 4,
    description: '英格蘭威爾特郡，建於公元前 3000–2000 年的新石器時代遺址。主軸線指向夏至日出與冬至日落方向，學界普遍認為具天文與曆法功能。雖然非「天文台」意義上的觀測場所，卻是已知最早將天文知識融入巨型建築的人類遺產之一。',
    website: 'https://www.english-heritage.org.uk/visit/places/stonehenge/',
    imageUrl: WM('Stonehenge2007_07_30.jpg'),
  },
  {
    id: 'south-pole',
    name: '阿蒙森-斯科特南極站',
    nameEn: 'Amundsen-Scott South Pole Station',
    nameJa: 'アムンセン・スコット基地（南極点）',
    lat: -89.99, lon: 0, elevationM: 2835, bortle: 1,
    description: '位於地理南極點。極端低溫、低濕度與半年連續黑夜，使其成為宇宙微波背景輻射 (CMB) 與南天觀測的理想地點。BICEP/Keck 系列實驗 (測 CMB 偏振以追溯宇宙暴脹) 與 IceCube 微中子天文台 (探測 1 km³ 冰下) 均在此運作。',
    website: 'https://www.nsf.gov/geo/opp/support/southp.jsp',
    imageUrl: WM('Amundsen-scott-south_pole_station_2007.jpg'),
  },
];

export const OBSERVER_PRESETS: ObserverLocation[] = [
  ...OBSERVER_CITIES,
  ...OBSERVER_OBSERVATORIES,
];
