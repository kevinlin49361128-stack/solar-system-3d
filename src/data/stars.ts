/**
 * 著名亮星資料（J2000 epoch 平均位置）。
 *
 * 用於觀測模式列表與星空背景繪製。座標來源：Hipparcos / SIMBAD。
 * 由於恆星距離極遠，可視作位於無窮遠的固定方向，本太陽系模擬中
 * 不考慮自行 (proper motion) 與光行差，視覺上夠用。
 */

export interface NamedStar {
  id: string;
  name: string;       // 中文常用名
  nameEn: string;
  nameJa?: string;    // 日文（多為片假名音譯）
  bayer?: string;
  raHours: number;
  decDeg: number;
  magnitude: number;
  /** Annual proper motion in RA (mas/year, cosδ-corrected per Hipparcos). */
  pmRA?: number;
  /** Annual proper motion in Dec (mas/year). */
  pmDec?: number;
  description?: string;
}

/**
 * Hipparcos proper motion (mas/yr, cosδ-corrected on RA) for the named stars
 * below. Values applied at module init via the merge step at the bottom of
 * this file — saves repeating the fields on every literal entry. Stars
 * without an entry default to 0 (negligible motion at our visualisation
 * accuracy / typical FOV).
 */
const HIPPARCOS_PM: Record<string, [number, number]> = {
  sirius:     [-546.05, -1223.14],
  canopus:    [   19.93,    23.24],
  arcturus:   [-1093.45, -1999.40],
  vega:       [  200.94,   286.23],
  capella:    [   75.52,  -427.13],
  rigel:      [    1.31,    -0.50],
  procyon:    [ -714.59, -1036.80],
  achernar:   [   88.02,   -40.08],
  betelgeuse: [   27.54,    11.30],
  altair:     [  536.82,   385.54],
  aldebaran:  [   62.78,  -189.36],
  spica:      [  -42.50,   -31.73],
  antares:    [  -10.16,   -23.21],
  pollux:     [ -626.55,  -45.80],
  deneb:      [    1.99,     1.85],
  regulus:    [ -249.40,     4.91],
  castor:     [ -191.45,   -97.92],
  polaris:    [   44.22,   -11.74],
  mizar:      [  119.01,   -25.97],
  acrux:      [  -35.83,    -14.86],
  // Big Dipper bowl + handle
  dubhe:      [ -136.46,   -35.25],
  merak:      [   81.66,    33.74],
  phecda:     [  107.68,    11.01],
  megrez:     [  103.56,     7.30],
  alioth:     [  111.74,   -8.99],
  alkaid:     [ -121.23,   -15.56],
  // Ursa Minor
  kochab:     [  -32.61,    11.42],
  pherkad:    [   -1.56,    18.04],
  // Orion
  bellatrix:  [   -8.75,   -13.28],
  mintaka:    [    1.65,     0.43],
  alnilam:    [    1.49,    -1.06],
  alnitak:    [    3.99,     2.54],
  saiph:      [    1.46,    -1.28],
};

export const NAMED_STARS: NamedStar[] = applyHipparcosPM([
  { id: 'sirius',     name: '天狼星',   nameEn: 'Sirius',     nameJa: 'シリウス',     bayer: 'α CMa', raHours: 6.7525,  decDeg: -16.7161, magnitude: -1.46,
    pmRA: -546.05, pmDec: -1223.14,
    description: '全天最亮恆星，距離 8.6 光年；雙星系統，伴星為白矮星天狼星 B。' },
  { id: 'canopus',    name: '老人星',   nameEn: 'Canopus',    nameJa: 'カノープス',   bayer: 'α Car', raHours: 6.3992,  decDeg: -52.6957, magnitude: -0.74,
    description: '全天第二亮，南天著名巨星；古中國視為長壽象徵。' },
  { id: 'arcturus',   name: '大角星',   nameEn: 'Arcturus',   nameJa: 'アークトゥルス', bayer: 'α Boo', raHours: 14.2610, decDeg: 19.1825,  magnitude: -0.05,
    pmRA: -1093.45, pmDec: -1999.40,
    description: '北天最亮、距離 36.7 光年的橙巨星，1933 年芝加哥世博會的開幕燈光由其光照觸發。' },
  { id: 'vega',       name: '織女星',   nameEn: 'Vega',       nameJa: 'ベガ（織女星）', bayer: 'α Lyr', raHours: 18.6157, decDeg: 38.7837,  magnitude: 0.03,
    pmRA: 200.94, pmDec: 286.23,
    description: '夏夜大三角之一，曾為公元前 12 000 年的北極星，將於約 13 700 年後再度成為。' },
  { id: 'capella',    name: '五車二',   nameEn: 'Capella',    nameJa: 'カペラ',       bayer: 'α Aur', raHours: 5.2782,  decDeg: 45.9981,  magnitude: 0.08,
    description: '御夫座主星，實為四星系統；冬季星空北方顯眼黃色亮星。' },
  { id: 'rigel',      name: '參宿七',   nameEn: 'Rigel',      nameJa: 'リゲル',       bayer: 'β Ori', raHours: 5.2423,  decDeg: -8.2017,  magnitude: 0.13,
    description: '獵戶座右下角，藍超巨星，光度約為太陽 12 萬倍。' },
  { id: 'procyon',    name: '南河三',   nameEn: 'Procyon',    nameJa: 'プロキオン',   bayer: 'α CMi', raHours: 7.6550,  decDeg: 5.2250,   magnitude: 0.34,
    pmRA: -714.59, pmDec: -1036.80,
    description: '冬季大三角之一，距離僅 11.4 光年；亦為雙星系統，伴星為白矮星。' },
  { id: 'achernar',   name: '水委一',   nameEn: 'Achernar',   nameJa: 'アケルナル',   bayer: 'α Eri', raHours: 1.6286,  decDeg: -57.2367, magnitude: 0.46,
    description: '波江座尾端，南天明亮藍星，自轉速度極快使其呈扁球狀。' },
  { id: 'betelgeuse', name: '參宿四',   nameEn: 'Betelgeuse', nameJa: 'ベテルギウス', bayer: 'α Ori', raHours: 5.9195,  decDeg: 7.4071,   magnitude: 0.50,
    description: '獵戶座左肩紅超巨星，半徑為太陽約 700 倍，可能在數萬至十萬年內爆發為超新星。' },
  { id: 'altair',     name: '河鼓二',   nameEn: 'Altair',     nameJa: 'アルタイル（牽牛星）', bayer: 'α Aql', raHours: 19.8463, decDeg: 8.8683,   magnitude: 0.77,
    pmRA: 536.82, pmDec: 385.54,
    description: '即「牛郎星」，夏夜大三角之一，距離 16.7 光年，自轉一周僅 9 小時。' },
  { id: 'aldebaran',  name: '畢宿五',   nameEn: 'Aldebaran',  nameJa: 'アルデバラン', bayer: 'α Tau', raHours: 4.5987,  decDeg: 16.5092,  magnitude: 0.85,
    pmRA: 62.78, pmDec: -189.36,
    description: '金牛座紅巨星眼睛，先驅 10 號太空船下一個會接近的恆星（約 200 萬年後）。' },
  { id: 'spica',      name: '角宿一',   nameEn: 'Spica',      nameJa: 'スピカ',       bayer: 'α Vir', raHours: 13.4199, decDeg: -11.1614, magnitude: 1.04,
    description: '室女座主星，藍白雙星系統，公轉週期僅 4 天。' },
  { id: 'antares',    name: '心宿二',   nameEn: 'Antares',    nameJa: 'アンタレス',   bayer: 'α Sco', raHours: 16.4901, decDeg: -26.4320, magnitude: 1.09,
    description: '天蠍座心臟，紅超巨星，名稱意為「火星的對手」（顏色相近）。' },
  { id: 'pollux',     name: '北河三',   nameEn: 'Pollux',     nameJa: 'ポルックス',   bayer: 'β Gem', raHours: 7.7553,  decDeg: 28.0262,  magnitude: 1.14,
    description: '雙子座主星，橙巨星，距離 33.8 光年，已確認有系外行星 Pollux b。' },
  { id: 'deneb',      name: '天津四',   nameEn: 'Deneb',      nameJa: 'デネブ',       bayer: 'α Cyg', raHours: 20.6905, decDeg: 45.2803,  magnitude: 1.25,
    description: '天鵝座尾，夏夜大三角之一；藍超巨星，距離約 2 600 光年仍極亮，本身光度為太陽近 20 萬倍。' },
  { id: 'regulus',    name: '軒轅十四', nameEn: 'Regulus',    nameJa: 'レグルス',     bayer: 'α Leo', raHours: 10.1395, decDeg: 11.9672,  magnitude: 1.36,
    description: '獅子座心臟，幾乎座落於黃道上，月亮與行星經常掩遮它。' },
  { id: 'castor',     name: '北河二',   nameEn: 'Castor',     nameJa: 'カストル',     bayer: 'α Gem', raHours: 7.5766,  decDeg: 31.8883,  magnitude: 1.58,
    description: '雙子座頭部，實為六星系統 (三對雙星)；距離 51 光年。' },
  { id: 'polaris',    name: '北極星',   nameEn: 'Polaris',    nameJa: '北極星（ポラリス）', bayer: 'α UMi', raHours: 2.5303,  decDeg: 89.2641,  magnitude: 1.97,
    description: '小熊座主星，目前距離天球北極不到 1°；地球歲差使極星每約 26 000 年輪換一次。' },
  { id: 'mizar',      name: '開陽',     nameEn: 'Mizar',      bayer: 'ζ UMa', raHours: 13.3988, decDeg: 54.9254,  magnitude: 2.04,
    description: '北斗七星斗柄第二顆；與其旁的開陽增一 (Alcor) 構成天然視力測試的雙星。' },
  { id: 'acrux',      name: '十字架二', nameEn: 'Acrux',      bayer: 'α Cru', raHours: 12.4433, decDeg: -63.0991, magnitude: 0.77,
    description: '南十字座最亮星；南半球象徵性恆星，多國國旗繪有其位置。' },

  // —— 北斗七星 (大熊座 Ursa Major) ——
  { id: 'dubhe',    name: '天樞', nameEn: 'Dubhe',    bayer: 'α UMa', raHours: 11.0621, decDeg: 61.7508,  magnitude: 1.79,
    description: '北斗七星斗口外側星，與天璇 (Merak) 連線指向北極星，故合稱「指極星」。橙巨星，距離 124 光年。' },
  { id: 'merak',    name: '天璇', nameEn: 'Merak',    bayer: 'β UMa', raHours: 11.0307, decDeg: 56.3824,  magnitude: 2.37,
    description: '北斗七星斗口內側星；與天樞構成指極星線。距離 80 光年的 A 型主序星。' },
  { id: 'phecda',   name: '天璣', nameEn: 'Phecda',   bayer: 'γ UMa', raHours: 11.8972, decDeg: 53.6948,  magnitude: 2.44,
    description: '北斗七星斗底；分光雙星系統，距離 84 光年。' },
  { id: 'megrez',   name: '天權', nameEn: 'Megrez',   bayer: 'δ UMa', raHours: 12.2571, decDeg: 57.0326,  magnitude: 3.31,
    description: '北斗七星斗柄與斗身連接點，七星中最暗者，居住在大熊運動星團（Ursa Major Moving Group）的核心。' },
  { id: 'alioth',   name: '玉衡', nameEn: 'Alioth',   bayer: 'ε UMa', raHours: 12.9005, decDeg: 55.9598,  magnitude: 1.76,
    description: '北斗七星中最亮者；化學特殊星 (Ap)，磁場強烈、譜線異常。' },
  { id: 'alkaid',   name: '搖光', nameEn: 'Alkaid',   bayer: 'η UMa', raHours: 13.7923, decDeg: 49.3133,  magnitude: 1.85,
    description: '北斗七星斗柄末端；藍主序星，是七星中唯一不屬於大熊運動星團的成員。' },

  // —— 小熊座 Ursa Minor ——
  { id: 'kochab',   name: '北極二', nameEn: 'Kochab',   bayer: 'β UMi', raHours: 14.8451, decDeg: 74.1555, magnitude: 2.07,
    description: '小熊座斗口星；公元前 1500 年至公元 500 年間曾為「天極星」，後因歲差讓位給現代北極星。' },
  { id: 'pherkad',  name: '北極一', nameEn: 'Pherkad',  bayer: 'γ UMi', raHours: 15.3457, decDeg: 71.8340, magnitude: 3.00,
    description: '小熊座斗口另一星，與 Kochab 並稱「Guardians of the Pole」（守極二星）。' },

  // —— 獵戶座 Orion ——
  { id: 'bellatrix',name: '參宿五', nameEn: 'Bellatrix', bayer: 'γ Ori', raHours: 5.4188, decDeg: 6.3497,  magnitude: 1.64,
    description: '獵戶座左肩（與參宿四對稱），藍巨星；拉丁名意為「女戰士」。' },
  { id: 'mintaka',  name: '參宿三', nameEn: 'Mintaka',   bayer: 'δ Ori', raHours: 5.5334, decDeg: -0.2991, magnitude: 2.23,
    description: '獵戶腰帶西端最高位置星，幾乎正好位於天球赤道上。多重星系統。' },
  { id: 'alnilam',  name: '參宿二', nameEn: 'Alnilam',   bayer: 'ε Ori', raHours: 5.6036, decDeg: -1.2019, magnitude: 1.69,
    description: '獵戶腰帶中央星；藍超巨星，光度為太陽 38 萬倍，距離 2,000 光年。' },
  { id: 'alnitak',  name: '參宿一', nameEn: 'Alnitak',   bayer: 'ζ Ori', raHours: 5.6793, decDeg: -1.9426, magnitude: 1.77,
    description: '獵戶腰帶東端星；附近有著名的「火焰星雲」(NGC 2024) 與「馬頭星雲」(IC 434) 暗黑星雲。' },
  { id: 'saiph',    name: '參宿六', nameEn: 'Saiph',     bayer: 'κ Ori', raHours: 5.7959, decDeg: -9.6696, magnitude: 2.06,
    description: '獵戶座右下角，藍超巨星；雖然亮度與參宿七相當，但能量集中在紫外波段，可見光看似較暗。' },

  // —— 仙后座 Cassiopeia (W shape) ——
  { id: 'caph',      name: '王良一', nameEn: 'Caph',      bayer: 'β Cas', raHours: 0.1530, decDeg: 59.1497,  magnitude: 2.27,
    description: '仙后 W 形最右端，黃白巨星，是一顆 δ 盾牌座變星，週期 2.5 小時。' },
  { id: 'schedar',   name: '王良四', nameEn: 'Schedar',   bayer: 'α Cas', raHours: 0.6751, decDeg: 56.5374,  magnitude: 2.24,
    description: '仙后 W 形右下角，橙巨星；距離 230 光年，光度為太陽 855 倍。' },
  { id: 'cih',       name: '策',     nameEn: 'Tsih',      bayer: 'γ Cas', raHours: 0.9451, decDeg: 60.7167,  magnitude: 2.47,
    description: '仙后 W 形中央星；自轉極快（赤道速度 ~432 km/s），環繞氣體盤造成不規則亮度變化的原型。' },
  { id: 'ruchbah',   name: '閣道三', nameEn: 'Ruchbah',   bayer: 'δ Cas', raHours: 1.4303, decDeg: 60.2353,  magnitude: 2.68,
    description: '仙后 W 形左下角，食變星，週期 759 天。' },
  { id: 'segin',     name: '閣道二', nameEn: 'Segin',     bayer: 'ε Cas', raHours: 1.9067, decDeg: 63.6701,  magnitude: 3.38,
    description: '仙后 W 形最左端，藍主序星，距離 410 光年。' },

  // —— 天琴座 Lyra (parallelogram) ——
  { id: 'sheliak',   name: '漸台二', nameEn: 'Sheliak',   bayer: 'β Lyr', raHours: 18.8348, decDeg: 33.3628, magnitude: 3.45,
    description: '天琴座 β 型食變星的原型，雙星互相強烈交換物質、形成扭曲外殼，亮度在 12.94 天內變化 1 等。' },
  { id: 'sulafat',   name: '漸台三', nameEn: 'Sulafat',   bayer: 'γ Lyr', raHours: 18.9821, decDeg: 32.6896, magnitude: 3.24,
    description: '天琴座平行四邊形東南角；藍巨星，距離 620 光年。' },
  { id: 'lyr-delta', name: '漸台一', nameEn: 'Delta Lyr', bayer: 'δ Lyr', raHours: 18.9135, decDeg: 36.8987, magnitude: 4.30,
    description: '天琴座 δ 為光學雙星：紅巨星 δ¹ + 藍主序星 δ²，雙筒可見明顯顏色對比。' },

  // —— 天鷹座 Aquila ——
  { id: 'tarazed',   name: '河鼓三', nameEn: 'Tarazed',   bayer: 'γ Aql', raHours: 19.7710, decDeg: 10.6133, magnitude: 2.72,
    description: '牛郎星（Altair）的北側鄰星；橙巨星，光度為太陽 2,500 倍。' },
  { id: 'alshain',   name: '河鼓一', nameEn: 'Alshain',   bayer: 'β Aql', raHours: 19.9219, decDeg: 6.4067,  magnitude: 3.71,
    description: '牛郎星（Altair）的南側鄰星；與牛郎、河鼓三合稱「河鼓三星」，傳統視作扁擔挑物的形象。' },

  // —— 天鵝座 Cygnus (Northern Cross) ——
  { id: 'sadr',      name: '天津一', nameEn: 'Sadr',      bayer: 'γ Cyg', raHours: 20.3705, decDeg: 40.2566, magnitude: 2.23,
    description: '天鵝座十字交點（「天鵝胸口」），周圍佈滿銀河帶氣體與恆星形成區（IC 1318）。' },
  { id: 'gienah-cyg',name: '天津九', nameEn: 'Gienah',    bayer: 'ε Cyg', raHours: 20.7702, decDeg: 33.9703, magnitude: 2.48,
    description: '天鵝座右翼末端；橙巨星，距離 72 光年。' },
  { id: 'aljanah',   name: '天津五', nameEn: 'Aljanah',   bayer: 'δ Cyg', raHours: 19.7497, decDeg: 45.1308, magnitude: 2.87,
    description: '天鵝座左翼末端；三星系統，將於約 11,000 年後成為新的北極星（歲差使然）。' },
  { id: 'albireo',   name: '輦道增七', nameEn: 'Albireo', bayer: 'β Cyg', raHours: 19.5126, decDeg: 27.9597, magnitude: 3.05,
    description: '天鵝頭部；著名「彩色雙星」— 望遠鏡分解後可見金黃 + 藍綠色對比，是業餘天文最受歡迎的觀測目標之一。' },

  // —— 雙子座 Gemini ——
  { id: 'alhena',    name: '井宿三', nameEn: 'Alhena',    bayer: 'γ Gem', raHours: 6.6285,  decDeg: 16.3993, magnitude: 1.93,
    description: '雙子座 Pollux 之足星；亞巨星，距離 109 光年，與冬季大三角構成週邊明顯亮星。' },
  { id: 'mebsuta',   name: '井宿五', nameEn: 'Mebsuta',   bayer: 'ε Gem', raHours: 6.7325,  decDeg: 25.1311, magnitude: 3.06,
    description: '雙子座 Castor 之足星；超巨星，光度為太陽 8,500 倍，距離 840 光年。' },

  // —— 金牛座 Taurus ——
  { id: 'elnath',    name: '五車五', nameEn: 'Elnath',    bayer: 'β Tau', raHours: 5.4382,  decDeg: 28.6075, magnitude: 1.65,
    description: '金牛座的北角，IAU 1930 年劃界前曾被劃入御夫座（與五車二、五車三共組御夫五邊形）。' },
  { id: 'alcyone',   name: '昴宿六', nameEn: 'Alcyone',   bayer: 'η Tau', raHours: 3.7914,  decDeg: 24.1051, magnitude: 2.87,
    description: '七姊妹星團（昴宿星團 / Pleiades / M45）中最亮的一顆；該星團距離 444 光年，是最容易觀測的疏散星團。' },

  // —— 獅子座 Leo ——
  { id: 'denebola',  name: '五帝座一', nameEn: 'Denebola', bayer: 'β Leo', raHours: 11.8177, decDeg: 14.5722, magnitude: 2.13,
    description: '獅子座尾部；A 型主序星，距離 36 光年，外環有大量塵埃盤可能形成行星系統。' },
  { id: 'algieba',   name: '軒轅十二', nameEn: 'Algieba',  bayer: 'γ Leo', raHours: 10.3329, decDeg: 19.8415, magnitude: 2.61,
    description: '獅子座頸部；雙星系統，主星於 2009 年確認伴隨一顆木星級系外行星。' },
  { id: 'zosma',     name: '太微右垣', nameEn: 'Zosma',    bayer: 'δ Leo', raHours: 11.2351, decDeg: 20.5237, magnitude: 2.56,
    description: '獅子座背部；A 型主序星，自轉極快赤道速度 180 km/s。' },

  // —— 天蠍座 Scorpius ——
  { id: 'shaula',    name: '尾宿八', nameEn: 'Shaula',    bayer: 'λ Sco', raHours: 17.5601, decDeg: -37.1038, magnitude: 1.62,
    description: '天蠍尾鉤的尖端；多星系統，藍色亞巨星，是 X 射線爆發源 PSR J1740 的鄰近恆星。' },
  { id: 'sargas',    name: '尾宿五', nameEn: 'Sargas',    bayer: 'θ Sco', raHours: 17.6217, decDeg: -42.9978, magnitude: 1.86,
    description: '天蠍尾部；黃白超巨星，光度為太陽 1,800 倍，距離 270 光年。' },
  { id: 'dschubba',  name: '房宿三', nameEn: 'Dschubba',  bayer: 'δ Sco', raHours: 16.0056, decDeg: -22.6217, magnitude: 2.29,
    description: '天蠍頭部；2000 年起出現不規則亮度變化（從 2.3 變到 1.6 等），可能是吸積盤活動。' },
  { id: 'graffias',  name: '房宿四', nameEn: 'Graffias',  bayer: 'β Sco', raHours: 16.0905, decDeg: -19.8054, magnitude: 2.62,
    description: '天蠍頭部；至少六星系統，業餘望遠鏡可分解為 β¹ + β² 雙星。' },

  // —— 大犬座 Canis Major (附近 Sirius) ——
  { id: 'mirzam',    name: '軍市一', nameEn: 'Mirzam',    bayer: 'β CMa', raHours: 6.3783,  decDeg: -17.9559, magnitude: 1.98,
    description: '位於 Sirius 西側；β Cep 型脈動變星的原型，0.25 天週期內亮度變化 0.04 等。' },
  { id: 'wezen',     name: '弧矢一', nameEn: 'Wezen',     bayer: 'δ CMa', raHours: 7.1397,  decDeg: -26.3935, magnitude: 1.83,
    description: '大犬座尾部；黃超巨星，光度為太陽 50,000 倍，可能在 10 萬年內成為超新星。' },
  { id: 'adhara',    name: '弧矢七', nameEn: 'Adhara',    bayer: 'ε CMa', raHours: 6.9770,  decDeg: -28.9721, magnitude: 1.50,
    description: '約 470 萬年前，Adhara 距太陽僅 34 光年，是當時夜空中最亮的恆星 (-3.99 等)，遠勝今日的 Sirius。' },

  // —— 仙女座 Andromeda + 飛馬座 Pegasus (秋四方) ——
  { id: 'alpheratz', name: '壁宿二', nameEn: 'Alpheratz', bayer: 'α And', raHours: 0.1398,  decDeg: 29.0904, magnitude: 2.06,
    description: '飛馬-仙女大四邊形東北角，是仙女座的星但歷史上曾與飛馬座共用，呈現星座邊界沿革的有趣案例。' },
  { id: 'mirach',    name: '奎宿九', nameEn: 'Mirach',    bayer: 'β And', raHours: 1.1623,  decDeg: 35.6206, magnitude: 2.06,
    description: '從 Mirach 向北可指向仙女座大星雲 (M31)；紅巨星，距離 197 光年。' },
  { id: 'almach',    name: '天大將軍一', nameEn: 'Almach', bayer: 'γ And', raHours: 2.0651, decDeg: 42.3297, magnitude: 2.10,
    description: '仙女座著名「彩色雙星」—望遠鏡可見金黃主星 + 藍色伴星對比，與輦道增七 (Albireo) 並稱兩大美麗雙星。' },
  { id: 'markab',    name: '室宿一', nameEn: 'Markab',    bayer: 'α Peg', raHours: 23.0793, decDeg: 15.2052, magnitude: 2.49,
    description: '飛馬大四邊形西南角；阿拉伯名意為「鞍」，暗示飛馬騎乘部位。' },
  { id: 'scheat',    name: '室宿二', nameEn: 'Scheat',    bayer: 'β Peg', raHours: 23.0629, decDeg: 28.0828, magnitude: 2.42,
    description: '飛馬大四邊形西北角；紅巨星，半規則變星，週期約 43 天。' },
  { id: 'algenib',   name: '壁宿一', nameEn: 'Algenib',   bayer: 'γ Peg', raHours: 0.2206,  decDeg: 15.1836, magnitude: 2.83,
    description: '飛馬大四邊形東南角；β Cep 型脈動變星，週期 3.6 小時內亮度小幅變化。' },

  // —— 御夫座 Auriga ——
  { id: 'menkalinan',name: '五車三', nameEn: 'Menkalinan', bayer: 'β Aur', raHours: 5.9921, decDeg: 44.9476, magnitude: 1.90,
    description: '御夫五邊形東南角；食雙星，週期 3.96 天內亮度變化 0.1 等。' },

  // —— 牧夫座 Boötes ——
  { id: 'izar',      name: '梗河一', nameEn: 'Izar',      bayer: 'ε Boo', raHours: 14.7498, decDeg: 27.0742, magnitude: 2.37,
    description: '又名「Pulcherrima（最美麗的）」；雙星系統，望遠鏡可見金橙主星 + 藍綠伴星，被譽為夜空最美雙星之一。' },
  { id: 'nekkar',    name: '七公增五', nameEn: 'Nekkar',  bayer: 'β Boo', raHours: 15.0322, decDeg: 40.3905, magnitude: 3.50,
    description: '牧夫座頭部；黃巨星，每秒約 4 km 自轉的耀斑型恆星。' },

  // —— 室女座 Virgo ——
  { id: 'porrima',   name: '東上相', nameEn: 'Porrima',   bayer: 'γ Vir', raHours: 12.6943, decDeg: -1.4494, magnitude: 2.74,
    description: '室女座著名雙星；公轉週期 169 年，2005 年達近距點（角距僅 0.3″），雙筒不可見、需大口徑望遠鏡分解。' },
  { id: 'vindemiatrix', name: '東次將', nameEn: 'Vindemiatrix', bayer: 'ε Vir', raHours: 13.0364, decDeg: 10.9591, magnitude: 2.83,
    description: '拉丁名意為「葡萄收穫者」—古羅馬時期此星黎明升起預示葡萄收穫季節到來。黃巨星。' },

  // —— 南十字座 Crux ——
  { id: 'mimosa',    name: '十字架三', nameEn: 'Mimosa',    bayer: 'β Cru', raHours: 12.7953, decDeg: -59.6886, magnitude: 1.25,
    description: '南十字座東臂端；藍亞巨星，距離 280 光年，光度為太陽 34,000 倍。' },
  { id: 'gacrux',    name: '十字架一', nameEn: 'Gacrux',    bayer: 'γ Cru', raHours: 12.5194, decDeg: -57.1133, magnitude: 1.59,
    description: '南十字座頂端；紅巨星，是離太陽最近的紅巨星之一（88 光年）。' },
  { id: 'imai',      name: '十字架四', nameEn: 'Imai',      bayer: 'δ Cru', raHours: 12.2525, decDeg: -58.7489, magnitude: 2.79,
    description: '南十字座西臂端；β Cep 型脈動變星，距離 345 光年。' },

  // —— 半人馬座 Centaurus ——
  { id: 'rigil-kent',name: '南門二', nameEn: 'Alpha Cen',  bayer: 'α Cen', raHours: 14.6600, decDeg: -60.8354, magnitude: -0.27,
    description: '距太陽最近的恆星系統 (4.37 光年)；三星系：α Cen A、α Cen B 與比鄰星 (Proxima Centauri)。比鄰星擁有已確認的潛在宜居系外行星 Proxima b。' },
  { id: 'hadar',     name: '馬腹一', nameEn: 'Hadar',      bayer: 'β Cen', raHours: 14.0637, decDeg: -60.3730, magnitude: 0.61,
    description: '南天第十亮星；藍超巨星，距離 390 光年，是著名的「南指極星」之一（Hadar + Rigil Kent 連線指向南天極）。' },

  // —— 船底座 Carina ——
  { id: 'miaplacidus', name: '南船三', nameEn: 'Miaplacidus', bayer: 'β Car', raHours: 9.2200, decDeg: -69.7172, magnitude: 1.69,
    description: '南天第二十八亮星；A 型亞巨星，距離 113 光年，是船底座「假十字」的一員。' },

  // —— 英仙座 Perseus (Algol 已有，加 Mirfak) ——
  { id: 'mirfak',    name: '天船三', nameEn: 'Mirfak',    bayer: 'α Per', raHours: 3.4054,  decDeg: 49.8612, magnitude: 1.79,
    description: '英仙座最亮星；位於英仙運動星團（Alpha Persei Cluster）中央，肉眼即可見其周圍鬆散星群。' },
  { id: 'algol',     name: '大陵五', nameEn: 'Algol',     bayer: 'β Per', raHours: 3.1361,  decDeg: 40.9556, magnitude: 2.12,
    description: '著名食變星：每 2.87 天規則變暗一次。古阿拉伯人視為「魔鬼之眼」(Ra\'s al-Ghūl)。' },

  // —— 人馬座 Sagittarius (茶壺) ——
  { id: 'kaus-aus',  name: '箕宿三', nameEn: 'Kaus Australis', bayer: 'ε Sgr', raHours: 18.4029, decDeg: -34.3847, magnitude: 1.85,
    description: '人馬座弓形「茶壺」底部最亮星；藍亞巨星，距離 145 光年。鄰近銀河系中心方向，天區內有大量深空天體。' },
  { id: 'nunki',     name: '斗宿四', nameEn: 'Nunki',     bayer: 'σ Sgr', raHours: 18.9211, decDeg: -26.2967, magnitude: 2.05,
    description: '人馬座茶壺把手頂端；蘇美爾名意為「Eridu」（蘇美的聖城）。藍主序星，距離 228 光年。' },
  { id: 'ascella',   name: '斗宿六', nameEn: 'Ascella',   bayer: 'ζ Sgr', raHours: 19.0436, decDeg: -29.8801, magnitude: 2.59,
    description: '人馬座茶壺把手底；雙星系統，主星為 A 型主序星，距離 89 光年。' },
  { id: 'kaus-med',  name: '箕宿二', nameEn: 'Kaus Media', bayer: 'δ Sgr', raHours: 18.3500, decDeg: -29.8281, magnitude: 2.70,
    description: '人馬座弓形中段；橙巨星，銀河系中心方向 4° 內，星周散射出大量塵埃雲。' },
]);

function applyHipparcosPM(stars: NamedStar[]): NamedStar[] {
  return stars.map(s => {
    if (s.pmRA !== undefined || s.pmDec !== undefined) return s;
    const pm = HIPPARCOS_PM[s.id];
    if (!pm) return s;
    return { ...s, pmRA: pm[0], pmDec: pm[1] };
  });
}
