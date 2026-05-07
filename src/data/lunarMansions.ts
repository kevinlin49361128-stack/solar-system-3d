/**
 * 二十八宿 — Chinese lunar mansions (xiu / 宿). Traditional Chinese star
 * cataloguing scheme dividing the celestial sphere into 28 segments along
 * the celestial equator, grouped into four directional palaces:
 *
 *   東方青龍 (Eastern Azure Dragon):  角亢氐房心尾箕
 *   北方玄武 (Northern Black Tortoise): 斗牛女虛危室壁
 *   西方白虎 (Western White Tiger):   奎婁胃昴畢觜參
 *   南方朱雀 (Southern Vermilion Bird): 井鬼柳星張翼軫
 *
 * Each mansion has a "determinative star" (距星) anchoring its boundary.
 * J2000 coordinates of those determinatives are listed below — drawn from
 * Sun Xiaochun's "Chinese Star Catalogue" cross-reference.
 */

export interface LunarMansion {
  /** 1-letter Chinese name (角, 亢, 氐, …). */
  glyph: string;
  /** Full Chinese name (角宿, 亢宿…). */
  name: string;
  /** Pinyin / romanisation. */
  pinyin: string;
  /** Determinative star designation (Bayer / Flamsteed). */
  determinative: string;
  /** RA (hours, J2000) of the determinative star. */
  raHours: number;
  /** Dec (degrees, J2000) of the determinative star. */
  decDeg: number;
  /** Cardinal palace this mansion belongs to. */
  palace: 'east' | 'north' | 'west' | 'south';
}

export const LUNAR_MANSIONS: LunarMansion[] = [
  // 東方青龍
  { glyph: '角', name: '角宿', pinyin: 'Jiǎo',  determinative: 'α Vir (Spica)',     raHours: 13.4199, decDeg: -11.1614, palace: 'east' },
  { glyph: '亢', name: '亢宿', pinyin: 'Kàng',  determinative: 'κ Vir',             raHours: 14.2110, decDeg: -10.2742, palace: 'east' },
  { glyph: '氐', name: '氐宿', pinyin: 'Dī',    determinative: 'α² Lib (Zubenelgenubi)', raHours: 14.8479, decDeg: -16.0418, palace: 'east' },
  { glyph: '房', name: '房宿', pinyin: 'Fáng',  determinative: 'π Sco',             raHours: 15.9836, decDeg: -26.1141, palace: 'east' },
  { glyph: '心', name: '心宿', pinyin: 'Xīn',   determinative: 'σ Sco',             raHours: 16.3534, decDeg: -25.5928, palace: 'east' },
  { glyph: '尾', name: '尾宿', pinyin: 'Wěi',   determinative: 'μ¹ Sco',            raHours: 16.8654, decDeg: -38.0473, palace: 'east' },
  { glyph: '箕', name: '箕宿', pinyin: 'Jī',    determinative: 'γ Sgr',             raHours: 18.0966, decDeg: -30.4239, palace: 'east' },
  // 北方玄武
  { glyph: '斗', name: '斗宿', pinyin: 'Dǒu',   determinative: 'φ Sgr',             raHours: 18.7807, decDeg: -26.9907, palace: 'north' },
  { glyph: '牛', name: '牛宿', pinyin: 'Niú',   determinative: 'β Cap',             raHours: 20.3500, decDeg: -14.7814, palace: 'north' },
  { glyph: '女', name: '女宿', pinyin: 'Nǚ',    determinative: 'ε Aqr',             raHours: 20.7948, decDeg: -9.4958,  palace: 'north' },
  { glyph: '虛', name: '虛宿', pinyin: 'Xū',    determinative: 'β Aqr (Sadalsuud)', raHours: 21.5258, decDeg: -5.5712,  palace: 'north' },
  { glyph: '危', name: '危宿', pinyin: 'Wēi',   determinative: 'α Aqr (Sadalmelik)', raHours: 22.0964, decDeg: -0.3197,  palace: 'north' },
  { glyph: '室', name: '室宿', pinyin: 'Shì',   determinative: 'α Peg (Markab)',    raHours: 23.0793, decDeg: 15.2053,  palace: 'north' },
  { glyph: '壁', name: '壁宿', pinyin: 'Bì',    determinative: 'γ Peg (Algenib)',   raHours: 0.2206,  decDeg: 15.1836,  palace: 'north' },
  // 西方白虎
  { glyph: '奎', name: '奎宿', pinyin: 'Kuí',   determinative: 'η And',             raHours: 0.9468,  decDeg: 23.4178,  palace: 'west' },
  { glyph: '婁', name: '婁宿', pinyin: 'Lóu',   determinative: 'β Ari',             raHours: 1.9112,  decDeg: 20.8081,  palace: 'west' },
  { glyph: '胃', name: '胃宿', pinyin: 'Wèi',   determinative: '35 Ari',            raHours: 2.7244,  decDeg: 27.7081,  palace: 'west' },
  { glyph: '昴', name: '昴宿', pinyin: 'Mǎo',   determinative: 'η Tau (Pleiades)',  raHours: 3.7913,  decDeg: 24.1051,  palace: 'west' },
  { glyph: '畢', name: '畢宿', pinyin: 'Bì',    determinative: 'ε Tau',             raHours: 4.4766,  decDeg: 19.1804,  palace: 'west' },
  { glyph: '觜', name: '觜宿', pinyin: 'Zī',    determinative: 'λ Ori',             raHours: 5.5856,  decDeg: 9.9342,   palace: 'west' },
  { glyph: '參', name: '參宿', pinyin: 'Shēn',  determinative: 'ζ Ori (Alnitak)',   raHours: 5.6793,  decDeg: -1.9426,  palace: 'west' },
  // 南方朱雀
  { glyph: '井', name: '井宿', pinyin: 'Jǐng',  determinative: 'μ Gem',             raHours: 6.3829,  decDeg: 22.5136,  palace: 'south' },
  { glyph: '鬼', name: '鬼宿', pinyin: 'Guǐ',   determinative: 'θ Cnc',             raHours: 8.5618,  decDeg: 18.1546,  palace: 'south' },
  { glyph: '柳', name: '柳宿', pinyin: 'Liǔ',   determinative: 'δ Hya',             raHours: 8.7240,  decDeg: 5.7036,   palace: 'south' },
  { glyph: '星', name: '星宿', pinyin: 'Xīng',  determinative: 'α Hya (Alphard)',   raHours: 9.4598,  decDeg: -8.6586,  palace: 'south' },
  { glyph: '張', name: '張宿', pinyin: 'Zhāng', determinative: 'υ¹ Hya',            raHours: 9.8499,  decDeg: -14.8467, palace: 'south' },
  { glyph: '翼', name: '翼宿', pinyin: 'Yì',    determinative: 'α Crt (Alkes)',     raHours: 10.9959, decDeg: -18.2987, palace: 'south' },
  { glyph: '軫', name: '軫宿', pinyin: 'Zhěn',  determinative: 'γ Crv (Gienah)',    raHours: 12.2634, decDeg: -17.5419, palace: 'south' },
];

export const PALACE_LABELS: Record<LunarMansion['palace'], { name: string; nameEn: string; color: number }> = {
  east:  { name: '東方青龍', nameEn: 'Eastern Azure Dragon',     color: 0x4ca8ff },
  north: { name: '北方玄武', nameEn: 'Northern Black Tortoise',  color: 0x6f6fff },
  west:  { name: '西方白虎', nameEn: 'Western White Tiger',      color: 0xfff0d8 },
  south: { name: '南方朱雀', nameEn: 'Southern Vermilion Bird',  color: 0xff7766 },
};
