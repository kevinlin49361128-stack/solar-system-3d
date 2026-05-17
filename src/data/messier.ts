/**
 * Messier 110 deep-sky objects.
 * Type codes: G=galaxy, GC=globular cluster, OC=open cluster,
 *             N=nebula, PN=planetary nebula, SNR=supernova remnant.
 * Coordinates are J2000 epoch.
 */

export type MessierType = 'G' | 'GC' | 'OC' | 'N' | 'PN' | 'SNR';

export interface MessierObject {
  id: string;          // M1, M31, ...
  name: string;        // 中文 / 通稱
  nameEn: string;
  type: MessierType;
  raHours: number;     // J2000 RA in hours
  decDeg: number;      // J2000 Dec in degrees
  magnitude: number;   // visual mag
  constellation: string;
}

// All 110 Messier objects, sorted by Messier number.
export const MESSIER: MessierObject[] = [
  { id: 'M1',  name: '蟹狀星雲',       nameEn: 'Crab Nebula',         type: 'SNR', raHours: 5.5755, decDeg: 22.0145, magnitude: 8.4,  constellation: 'Tau' },
  { id: 'M2',  name: '寶瓶座 M2',      nameEn: 'M2',                  type: 'GC',  raHours: 21.5577, decDeg: -0.8233, magnitude: 6.5, constellation: 'Aqr' },
  { id: 'M3',  name: '獵犬座 M3',      nameEn: 'M3',                  type: 'GC',  raHours: 13.7033, decDeg: 28.3771, magnitude: 6.2, constellation: 'CVn' },
  { id: 'M4',  name: '天蠍座 M4',      nameEn: 'M4',                  type: 'GC',  raHours: 16.3933, decDeg: -26.5256, magnitude: 5.9, constellation: 'Sco' },
  { id: 'M5',  name: '巨蛇座 M5',      nameEn: 'M5',                  type: 'GC',  raHours: 15.3092, decDeg: 2.0817,  magnitude: 5.6, constellation: 'Ser' },
  { id: 'M6',  name: '蝴蝶星團',       nameEn: 'Butterfly Cluster',   type: 'OC',  raHours: 17.6700, decDeg: -32.2167, magnitude: 4.2, constellation: 'Sco' },
  { id: 'M7',  name: '托勒密星團',     nameEn: 'Ptolemy Cluster',     type: 'OC',  raHours: 17.8967, decDeg: -34.7833, magnitude: 3.3, constellation: 'Sco' },
  { id: 'M8',  name: '礁湖星雲',       nameEn: 'Lagoon Nebula',       type: 'N',   raHours: 18.0608, decDeg: -24.3867, magnitude: 6.0, constellation: 'Sgr' },
  { id: 'M9',  name: '蛇夫座 M9',      nameEn: 'M9',                  type: 'GC',  raHours: 17.3197, decDeg: -18.5161, magnitude: 7.7, constellation: 'Oph' },
  { id: 'M10', name: '蛇夫座 M10',     nameEn: 'M10',                 type: 'GC',  raHours: 16.9527, decDeg: -4.1003,  magnitude: 6.6, constellation: 'Oph' },
  { id: 'M11', name: '野鴨星團',       nameEn: 'Wild Duck Cluster',   type: 'OC',  raHours: 18.8517, decDeg: -6.2750,  magnitude: 6.3, constellation: 'Sct' },
  { id: 'M12', name: '蛇夫座 M12',     nameEn: 'M12',                 type: 'GC',  raHours: 16.7872, decDeg: -1.9483,  magnitude: 6.7, constellation: 'Oph' },
  { id: 'M13', name: '武仙座大星團',   nameEn: 'Hercules Cluster',    type: 'GC',  raHours: 16.6948, decDeg: 36.4602,  magnitude: 5.8, constellation: 'Her' },
  { id: 'M14', name: '蛇夫座 M14',     nameEn: 'M14',                 type: 'GC',  raHours: 17.6260, decDeg: -3.2458,  magnitude: 7.6, constellation: 'Oph' },
  { id: 'M15', name: '飛馬座 M15',     nameEn: 'M15',                 type: 'GC',  raHours: 21.4998, decDeg: 12.1670,  magnitude: 6.2, constellation: 'Peg' },
  { id: 'M16', name: '老鷹星雲',       nameEn: 'Eagle Nebula',        type: 'N',   raHours: 18.3133, decDeg: -13.7833, magnitude: 6.0, constellation: 'Ser' },
  { id: 'M17', name: '奧米伽星雲',     nameEn: 'Omega/Swan Nebula',   type: 'N',   raHours: 18.3460, decDeg: -16.1717, magnitude: 6.0, constellation: 'Sgr' },
  { id: 'M18', name: '人馬座 M18',     nameEn: 'M18',                 type: 'OC',  raHours: 18.3320, decDeg: -17.1000, magnitude: 7.5, constellation: 'Sgr' },
  { id: 'M19', name: '蛇夫座 M19',     nameEn: 'M19',                 type: 'GC',  raHours: 17.0421, decDeg: -26.2675, magnitude: 6.8, constellation: 'Oph' },
  { id: 'M20', name: '三葉星雲',       nameEn: 'Trifid Nebula',       type: 'N',   raHours: 18.0367, decDeg: -23.0300, magnitude: 6.3, constellation: 'Sgr' },
  { id: 'M21', name: '人馬座 M21',     nameEn: 'M21',                 type: 'OC',  raHours: 18.0750, decDeg: -22.5000, magnitude: 5.9, constellation: 'Sgr' },
  { id: 'M22', name: '人馬座 M22',     nameEn: 'M22',                 type: 'GC',  raHours: 18.6065, decDeg: -23.9047, magnitude: 5.1, constellation: 'Sgr' },
  { id: 'M23', name: '人馬座 M23',     nameEn: 'M23',                 type: 'OC',  raHours: 17.9483, decDeg: -19.0167, magnitude: 5.5, constellation: 'Sgr' },
  { id: 'M24', name: '人馬座 M24',     nameEn: 'Sagittarius Star Cloud', type: 'OC', raHours: 18.2825, decDeg: -18.4500, magnitude: 4.6, constellation: 'Sgr' },
  { id: 'M25', name: '人馬座 M25',     nameEn: 'M25',                 type: 'OC',  raHours: 18.5300, decDeg: -19.2500, magnitude: 4.6, constellation: 'Sgr' },
  { id: 'M26', name: '盾牌座 M26',     nameEn: 'M26',                 type: 'OC',  raHours: 18.7517, decDeg: -9.4000,  magnitude: 8.0, constellation: 'Sct' },
  { id: 'M27', name: '啞鈴星雲',       nameEn: 'Dumbbell Nebula',     type: 'PN',  raHours: 19.9933, decDeg: 22.7211,  magnitude: 7.5, constellation: 'Vul' },
  { id: 'M28', name: '人馬座 M28',     nameEn: 'M28',                 type: 'GC',  raHours: 18.4093, decDeg: -24.8697, magnitude: 6.8, constellation: 'Sgr' },
  { id: 'M29', name: '天鵝座 M29',     nameEn: 'M29',                 type: 'OC',  raHours: 20.3983, decDeg: 38.5333,  magnitude: 7.1, constellation: 'Cyg' },
  { id: 'M30', name: '摩羯座 M30',     nameEn: 'M30',                 type: 'GC',  raHours: 21.6727, decDeg: -23.1797, magnitude: 7.2, constellation: 'Cap' },
  { id: 'M31', name: '仙女座星系',     nameEn: 'Andromeda Galaxy',    type: 'G',   raHours: 0.7123,  decDeg: 41.2692,  magnitude: 3.4, constellation: 'And' },
  { id: 'M32', name: '仙女座 M32',     nameEn: 'M32',                 type: 'G',   raHours: 0.7117,  decDeg: 40.8650,  magnitude: 8.1, constellation: 'And' },
  { id: 'M33', name: '三角座星系',     nameEn: 'Triangulum Galaxy',   type: 'G',   raHours: 1.5642,  decDeg: 30.6602,  magnitude: 5.7, constellation: 'Tri' },
  { id: 'M34', name: '英仙座 M34',     nameEn: 'M34',                 type: 'OC',  raHours: 2.7000,  decDeg: 42.7833,  magnitude: 5.5, constellation: 'Per' },
  { id: 'M35', name: '雙子座 M35',     nameEn: 'M35',                 type: 'OC',  raHours: 6.1483,  decDeg: 24.3333,  magnitude: 5.3, constellation: 'Gem' },
  { id: 'M36', name: '御夫座 M36',     nameEn: 'M36',                 type: 'OC',  raHours: 5.6050,  decDeg: 34.1333,  magnitude: 6.3, constellation: 'Aur' },
  { id: 'M37', name: '御夫座 M37',     nameEn: 'M37',                 type: 'OC',  raHours: 5.8717,  decDeg: 32.5500,  magnitude: 6.2, constellation: 'Aur' },
  { id: 'M38', name: '御夫座 M38',     nameEn: 'M38',                 type: 'OC',  raHours: 5.4783,  decDeg: 35.8500,  magnitude: 7.4, constellation: 'Aur' },
  { id: 'M39', name: '天鵝座 M39',     nameEn: 'M39',                 type: 'OC',  raHours: 21.5350, decDeg: 48.4333,  magnitude: 4.6, constellation: 'Cyg' },
  { id: 'M40', name: '大熊座 M40',     nameEn: 'Winnecke 4',          type: 'OC',  raHours: 12.3700, decDeg: 58.0833,  magnitude: 8.4, constellation: 'UMa' },
  { id: 'M41', name: '大犬座 M41',     nameEn: 'M41',                 type: 'OC',  raHours: 6.7667,  decDeg: -20.7333, magnitude: 4.5, constellation: 'CMa' },
  { id: 'M42', name: '獵戶座大星雲',   nameEn: 'Orion Nebula',        type: 'N',   raHours: 5.5881,  decDeg: -5.3911,  magnitude: 4.0, constellation: 'Ori' },
  { id: 'M43', name: 'De Mairan 星雲', nameEn: "De Mairan's Nebula",  type: 'N',   raHours: 5.5919,  decDeg: -5.2675,  magnitude: 9.0, constellation: 'Ori' },
  { id: 'M44', name: '蜂巢星團',       nameEn: 'Beehive / Praesepe',  type: 'OC',  raHours: 8.6700,  decDeg: 19.6667,  magnitude: 3.7, constellation: 'Cnc' },
  { id: 'M45', name: '昴星團',         nameEn: 'Pleiades',            type: 'OC',  raHours: 3.7917,  decDeg: 24.1167,  magnitude: 1.6, constellation: 'Tau' },
  { id: 'M46', name: '船尾座 M46',     nameEn: 'M46',                 type: 'OC',  raHours: 7.6967,  decDeg: -14.8167, magnitude: 6.1, constellation: 'Pup' },
  { id: 'M47', name: '船尾座 M47',     nameEn: 'M47',                 type: 'OC',  raHours: 7.6100,  decDeg: -14.5000, magnitude: 4.4, constellation: 'Pup' },
  { id: 'M48', name: '長蛇座 M48',     nameEn: 'M48',                 type: 'OC',  raHours: 8.2300,  decDeg: -5.7500,  magnitude: 5.5, constellation: 'Hya' },
  { id: 'M49', name: '室女座 M49',     nameEn: 'M49',                 type: 'G',   raHours: 12.4965, decDeg: 8.0003,   magnitude: 8.4, constellation: 'Vir' },
  { id: 'M50', name: '麒麟座 M50',     nameEn: 'M50',                 type: 'OC',  raHours: 7.0500,  decDeg: -8.3333,  magnitude: 5.9, constellation: 'Mon' },
  { id: 'M51', name: '渦狀星系',       nameEn: 'Whirlpool Galaxy',    type: 'G',   raHours: 13.4979, decDeg: 47.1953,  magnitude: 8.4, constellation: 'CVn' },
  { id: 'M52', name: '仙后座 M52',     nameEn: 'M52',                 type: 'OC',  raHours: 23.4067, decDeg: 61.5833,  magnitude: 5.0, constellation: 'Cas' },
  { id: 'M53', name: '后髮座 M53',     nameEn: 'M53',                 type: 'GC',  raHours: 13.2153, decDeg: 18.1683,  magnitude: 7.6, constellation: 'Com' },
  { id: 'M54', name: '人馬座 M54',     nameEn: 'M54',                 type: 'GC',  raHours: 18.9170, decDeg: -30.4798, magnitude: 7.6, constellation: 'Sgr' },
  { id: 'M55', name: '人馬座 M55',     nameEn: 'M55',                 type: 'GC',  raHours: 19.6664, decDeg: -30.9636, magnitude: 6.3, constellation: 'Sgr' },
  { id: 'M56', name: '天琴座 M56',     nameEn: 'M56',                 type: 'GC',  raHours: 19.2767, decDeg: 30.1833,  magnitude: 8.3, constellation: 'Lyr' },
  { id: 'M57', name: '指環星雲',       nameEn: 'Ring Nebula',         type: 'PN',  raHours: 18.8932, decDeg: 33.0292,  magnitude: 8.8, constellation: 'Lyr' },
  { id: 'M58', name: '室女座 M58',     nameEn: 'M58',                 type: 'G',   raHours: 12.6300, decDeg: 11.8181,  magnitude: 9.7, constellation: 'Vir' },
  { id: 'M59', name: '室女座 M59',     nameEn: 'M59',                 type: 'G',   raHours: 12.7000, decDeg: 11.6469,  magnitude: 9.6, constellation: 'Vir' },
  { id: 'M60', name: '室女座 M60',     nameEn: 'M60',                 type: 'G',   raHours: 12.7283, decDeg: 11.5526,  magnitude: 8.8, constellation: 'Vir' },
  { id: 'M61', name: '室女座 M61',     nameEn: 'M61',                 type: 'G',   raHours: 12.3653, decDeg: 4.4736,   magnitude: 9.7, constellation: 'Vir' },
  { id: 'M62', name: '蛇夫座 M62',     nameEn: 'M62',                 type: 'GC',  raHours: 17.0202, decDeg: -30.1117, magnitude: 6.5, constellation: 'Oph' },
  { id: 'M63', name: '向日葵星系',     nameEn: 'Sunflower Galaxy',    type: 'G',   raHours: 13.2633, decDeg: 42.0292,  magnitude: 8.6, constellation: 'CVn' },
  { id: 'M64', name: '黑眼星系',       nameEn: 'Black Eye Galaxy',    type: 'G',   raHours: 12.9456, decDeg: 21.6831,  magnitude: 8.5, constellation: 'Com' },
  { id: 'M65', name: 'Leo 三 M65',     nameEn: 'Leo Triplet M65',     type: 'G',   raHours: 11.3156, decDeg: 13.0922,  magnitude: 9.3, constellation: 'Leo' },
  { id: 'M66', name: 'Leo 三 M66',     nameEn: 'Leo Triplet M66',     type: 'G',   raHours: 11.3375, decDeg: 12.9911,  magnitude: 8.9, constellation: 'Leo' },
  { id: 'M67', name: '巨蟹座 M67',     nameEn: 'M67',                 type: 'OC',  raHours: 8.8550,  decDeg: 11.8000,  magnitude: 6.1, constellation: 'Cnc' },
  { id: 'M68', name: '長蛇座 M68',     nameEn: 'M68',                 type: 'GC',  raHours: 12.6589, decDeg: -26.7444, magnitude: 7.8, constellation: 'Hya' },
  { id: 'M69', name: '人馬座 M69',     nameEn: 'M69',                 type: 'GC',  raHours: 18.5232, decDeg: -32.3481, magnitude: 7.6, constellation: 'Sgr' },
  { id: 'M70', name: '人馬座 M70',     nameEn: 'M70',                 type: 'GC',  raHours: 18.7203, decDeg: -32.2922, magnitude: 7.9, constellation: 'Sgr' },
  { id: 'M71', name: '天箭座 M71',     nameEn: 'M71',                 type: 'GC',  raHours: 19.8964, decDeg: 18.7794,  magnitude: 8.2, constellation: 'Sge' },
  { id: 'M72', name: '寶瓶座 M72',     nameEn: 'M72',                 type: 'GC',  raHours: 20.8910, decDeg: -12.5372, magnitude: 9.4, constellation: 'Aqr' },
  { id: 'M73', name: '寶瓶座 M73',     nameEn: 'M73',                 type: 'OC',  raHours: 20.9817, decDeg: -12.6333, magnitude: 9.0, constellation: 'Aqr' },
  { id: 'M74', name: '雙魚座 M74',     nameEn: 'M74',                 type: 'G',   raHours: 1.6111,  decDeg: 15.7833,  magnitude: 9.4, constellation: 'Psc' },
  { id: 'M75', name: '人馬座 M75',     nameEn: 'M75',                 type: 'GC',  raHours: 20.1011, decDeg: -21.9225, magnitude: 8.6, constellation: 'Sgr' },
  { id: 'M76', name: '小啞鈴星雲',     nameEn: 'Little Dumbbell',     type: 'PN',  raHours: 1.7058,  decDeg: 51.5750,  magnitude: 10.1, constellation: 'Per' },
  { id: 'M77', name: '鯨魚座 M77',     nameEn: 'M77 (Cetus A)',       type: 'G',   raHours: 2.7117,  decDeg: -0.0133,  magnitude: 8.9, constellation: 'Cet' },
  { id: 'M78', name: '獵戶座 M78',     nameEn: 'M78',                 type: 'N',   raHours: 5.7800,  decDeg: 0.0500,   magnitude: 8.3, constellation: 'Ori' },
  { id: 'M79', name: '天兔座 M79',     nameEn: 'M79',                 type: 'GC',  raHours: 5.4042,  decDeg: -24.5242, magnitude: 7.7, constellation: 'Lep' },
  { id: 'M80', name: '天蠍座 M80',     nameEn: 'M80',                 type: 'GC',  raHours: 16.2840, decDeg: -22.9764, magnitude: 7.3, constellation: 'Sco' },
  { id: 'M81', name: '波德星系',       nameEn: "Bode's Galaxy",       type: 'G',   raHours: 9.9256,  decDeg: 69.0653,  magnitude: 6.9, constellation: 'UMa' },
  { id: 'M82', name: '雪茄星系',       nameEn: 'Cigar Galaxy',        type: 'G',   raHours: 9.9311,  decDeg: 69.6797,  magnitude: 8.4, constellation: 'UMa' },
  { id: 'M83', name: '南風車星系',     nameEn: 'Southern Pinwheel',   type: 'G',   raHours: 13.6167, decDeg: -29.8658, magnitude: 7.5, constellation: 'Hya' },
  { id: 'M84', name: '室女座 M84',     nameEn: 'M84',                 type: 'G',   raHours: 12.4181, decDeg: 12.8869,  magnitude: 9.1, constellation: 'Vir' },
  { id: 'M85', name: '后髮座 M85',     nameEn: 'M85',                 type: 'G',   raHours: 12.4233, decDeg: 18.1911,  magnitude: 9.1, constellation: 'Com' },
  { id: 'M86', name: '室女座 M86',     nameEn: 'M86',                 type: 'G',   raHours: 12.4364, decDeg: 12.9461,  magnitude: 8.9, constellation: 'Vir' },
  { id: 'M87', name: '室女座 A',       nameEn: 'Virgo A (M87)',       type: 'G',   raHours: 12.5137, decDeg: 12.3911,  magnitude: 8.6, constellation: 'Vir' },
  { id: 'M88', name: '后髮座 M88',     nameEn: 'M88',                 type: 'G',   raHours: 12.5331, decDeg: 14.4203,  magnitude: 9.6, constellation: 'Com' },
  { id: 'M89', name: '室女座 M89',     nameEn: 'M89',                 type: 'G',   raHours: 12.5947, decDeg: 12.5564,  magnitude: 9.8, constellation: 'Vir' },
  { id: 'M90', name: '室女座 M90',     nameEn: 'M90',                 type: 'G',   raHours: 12.6136, decDeg: 13.1625,  magnitude: 9.5, constellation: 'Vir' },
  { id: 'M91', name: '后髮座 M91',     nameEn: 'M91',                 type: 'G',   raHours: 12.5894, decDeg: 14.4961,  magnitude: 10.2, constellation: 'Com' },
  { id: 'M92', name: '武仙座 M92',     nameEn: 'M92',                 type: 'GC',  raHours: 17.2870, decDeg: 43.1361,  magnitude: 6.4, constellation: 'Her' },
  { id: 'M93', name: '船尾座 M93',     nameEn: 'M93',                 type: 'OC',  raHours: 7.7450,  decDeg: -23.8667, magnitude: 6.2, constellation: 'Pup' },
  { id: 'M94', name: '獵犬座 M94',     nameEn: 'M94',                 type: 'G',   raHours: 12.8483, decDeg: 41.1206,  magnitude: 8.2, constellation: 'CVn' },
  { id: 'M95', name: '獅子座 M95',     nameEn: 'M95',                 type: 'G',   raHours: 10.7325, decDeg: 11.7036,  magnitude: 9.7, constellation: 'Leo' },
  { id: 'M96', name: '獅子座 M96',     nameEn: 'M96',                 type: 'G',   raHours: 10.7794, decDeg: 11.8200,  magnitude: 9.2, constellation: 'Leo' },
  { id: 'M97', name: '貓頭鷹星雲',     nameEn: 'Owl Nebula',          type: 'PN',  raHours: 11.2467, decDeg: 55.0192,  magnitude: 9.9, constellation: 'UMa' },
  { id: 'M98', name: '后髮座 M98',     nameEn: 'M98',                 type: 'G',   raHours: 12.2306, decDeg: 14.9006,  magnitude: 10.1, constellation: 'Com' },
  { id: 'M99', name: '后髮座 M99',     nameEn: 'M99',                 type: 'G',   raHours: 12.3128, decDeg: 14.4164,  magnitude: 9.9, constellation: 'Com' },
  { id: 'M100', name: '后髮座 M100',   nameEn: 'M100',                type: 'G',   raHours: 12.3819, decDeg: 15.8225,  magnitude: 9.3, constellation: 'Com' },
  { id: 'M101', name: '風車星系',      nameEn: 'Pinwheel Galaxy',     type: 'G',   raHours: 14.0531, decDeg: 54.3486,  magnitude: 7.9, constellation: 'UMa' },
  { id: 'M102', name: '紡錘星系',      nameEn: 'Spindle Galaxy',      type: 'G',   raHours: 15.1083, decDeg: 55.7631,  magnitude: 9.9, constellation: 'Dra' },
  { id: 'M103', name: '仙后座 M103',   nameEn: 'M103',                type: 'OC',  raHours: 1.5550,  decDeg: 60.6667,  magnitude: 7.4, constellation: 'Cas' },
  { id: 'M104', name: '草帽星系',      nameEn: 'Sombrero Galaxy',     type: 'G',   raHours: 12.6664, decDeg: -11.6231, magnitude: 8.0, constellation: 'Vir' },
  { id: 'M105', name: '獅子座 M105',   nameEn: 'M105',                type: 'G',   raHours: 10.7972, decDeg: 12.5817,  magnitude: 9.3, constellation: 'Leo' },
  { id: 'M106', name: '獵犬座 M106',   nameEn: 'M106',                type: 'G',   raHours: 12.3158, decDeg: 47.3036,  magnitude: 8.4, constellation: 'CVn' },
  { id: 'M107', name: '蛇夫座 M107',   nameEn: 'M107',                type: 'GC',  raHours: 16.5424, decDeg: -13.0537, magnitude: 7.9, constellation: 'Oph' },
  { id: 'M108', name: '大熊座 M108',   nameEn: 'M108',                type: 'G',   raHours: 11.1928, decDeg: 55.6742,  magnitude: 10.0, constellation: 'UMa' },
  { id: 'M109', name: '大熊座 M109',   nameEn: 'M109',                type: 'G',   raHours: 11.9600, decDeg: 53.3744,  magnitude: 9.8, constellation: 'UMa' },
  { id: 'M110', name: '仙女座 M110',   nameEn: 'M110',                type: 'G',   raHours: 0.6731,  decDeg: 41.6856,  magnitude: 8.5, constellation: 'And' },
];

export const MESSIER_TYPE_LABEL: Record<MessierType, string> = {
  G:   '星系',
  GC:  '球狀星團',
  OC:  '疏散星團',
  N:   '星雲',
  PN:  '行星狀星雲',
  SNR: '超新星遺跡',
};

export const MESSIER_TYPE_COLOR: Record<MessierType, number> = {
  G:   0xff80c0,    // pink for galaxies
  GC:  0xffd060,    // gold for globular clusters
  OC:  0x60d0ff,    // light blue for open clusters
  N:   0x80ff80,    // green for emission nebulae
  PN:  0x80ffd0,    // teal for planetary nebulae
  SNR: 0xff6060,    // red for supernova remnants
};

/**
 * Apparent major-axis size in arcminutes for the most visually striking
 * DSOs. Used by the "real angular size" rendering mode (item #4 in the
 * realism toggles). Objects not listed fall back to a type-based default
 * (galaxies ~5′, globulars ~10′, nebulae ~15′, etc.).
 *
 * Values from SEDS / Wikipedia. Rough — many DSOs have very irregular
 * extents; we use the major axis to drive a billboard radius.
 */
export const MESSIER_ANGULAR_SIZE_ARCMIN: Record<string, number> = {
  M1: 6, M3: 18, M5: 23, M6: 25, M7: 80, M8: 90, M11: 14, M13: 20, M16: 35, M17: 11,
  M20: 28, M22: 32, M24: 95, M27: 8, M31: 178, M32: 8, M33: 73, M35: 28, M36: 12,
  M37: 24, M38: 21, M41: 38, M42: 65, M43: 20, M44: 95, M45: 110, M46: 27, M47: 30,
  M48: 54, M50: 16, M51: 11, M52: 13, M57: 1.4, M63: 10, M64: 10, M65: 10, M66: 9,
  M67: 30, M71: 7, M76: 2.7, M78: 8, M81: 27, M82: 11, M83: 13, M87: 8, M92: 14,
  M101: 29, M104: 9, M106: 19, M108: 8, M110: 22, M97: 3.4,
  // NGC additions covered separately when present in NGC_DATA.
  'NGC2244': 80, 'NGC7000': 120, 'NGC6960': 70, 'NGC6992': 60, 'NGC2070': 40,
  'IC1396': 170, 'NGC869': 30, 'NGC884': 30, 'NGC4565': 16, 'NGC5128': 26,
};

const TYPE_DEFAULT_ARCMIN: Record<MessierType, number> = {
  G: 5, GC: 10, OC: 18, N: 15, PN: 1.5, SNR: 8,
};

export function dsoAngularSizeArcmin(id: string, type: MessierType): number {
  return MESSIER_ANGULAR_SIZE_ARCMIN[id] ?? TYPE_DEFAULT_ARCMIN[type];
}

/**
 * Detailed apparent dimensions for each Messier object — major and
 * minor axes in arcminutes. Generated from OpenNGC v2 via
 * `scripts/fetch-messier-sizes.mjs`, with 4 manual entries appended
 * for objects OpenNGC omits (M40 double star, M45 Pleiades, M73
 * asterism, M102 spindle galaxy candidate).
 *
 * Used to compute surface brightness for InfoPanel display:
 *   SB = m + 2.5·log10(π/4 · major · minor · 60²)   (mag/arcsec²)
 * where major × minor is the elliptical apparent area in arcsec².
 *
 * The single-axis `MESSIER_ANGULAR_SIZE_ARCMIN` table above stays
 * unchanged so the realism-layer "real angular size" rendering
 * doesn't shift; this is purely an additive enrichment.
 */
export const MESSIER_ANG_SIZES: Record<string, [number, number]> = {
  'M1': [8, 4], 'M2': [8.4, 8.4], 'M3': [16.2, 16.2], 'M4': [28.2, 28.2],
  'M5': [15, 15], 'M6': [15.6, 15.6], 'M7': [22.2, 22.2], 'M8': [45, 30],
  'M9': [6.9, 6.9], 'M10': [9.3, 9.3], 'M11': [9, 9], 'M12': [11.1, 11.1],
  'M13': [16.5, 16.5], 'M14': [9.9, 9.9], 'M15': [11.1, 11.1],
  'M16': [120, 25], 'M17': [12.6, 12.6], 'M18': [6, 6], 'M19': [7.5, 7.5],
  'M20': [28, 28], 'M21': [6, 6], 'M22': [12.6, 12.6], 'M23': [16.8, 16.8],
  'M24': [120, 60], 'M25': [14.1, 14.1], 'M26': [6, 6], 'M27': [6.7, 6.7],
  'M28': [5.1, 5.1], 'M29': [3.6, 3.6], 'M30': [9, 9],
  'M31': [177.83, 69.66], 'M32': [7.74, 4.86], 'M33': [62.09, 36.73],
  'M34': [22.5, 22.5], 'M35': [24, 24], 'M36': [7.2, 7.2], 'M37': [11.4, 11.4],
  'M38': [9.6, 9.6], 'M39': [19.5, 19.5],
  'M40': [0.8, 0.8],          // double star — manual addition (OpenNGC omits)
  'M41': [12, 12], 'M42': [90, 60], 'M43': [20, 15], 'M44': [108.6, 108.6],
  'M45': [110, 110],          // Pleiades — manual; OpenNGC truncates open clusters
  'M46': [21, 21], 'M47': [19.8, 19.8], 'M48': [28.2, 28.2],
  'M49': [10.21, 8.38], 'M50': [14.1, 14.1], 'M51': [13.71, 11.67],
  'M52': [9.9, 9.9], 'M53': [9, 9], 'M54': [5.1, 5.1], 'M55': [12, 12],
  'M56': [5.8, 5.8], 'M57': [1.27, 1.27], 'M58': [5.01, 3.84],
  'M59': [4.55, 3.21], 'M60': [6.78, 5.45], 'M61': [6.89, 6.56],
  'M62': [7.8, 7.8], 'M63': [11.83, 7.16], 'M64': [10.52, 5.33],
  'M65': [7.64, 1.97], 'M66': [10.28, 4.61], 'M67': [33, 33],
  'M68': [6.6, 6.6], 'M69': [5.7, 5.7], 'M70': [6.6, 6.6], 'M71': [6.9, 6.9],
  'M72': [4.5, 4.5],
  'M73': [2.8, 2.8],          // asterism — manual
  'M74': [9.89, 9.33], 'M75': [3.6, 3.6], 'M76': [1.12, 1.12],
  'M77': [6.11, 5.61], 'M78': [4.5, 4.5], 'M79': [7.2, 7.2], 'M80': [5.7, 5.7],
  'M81': [21.63, 11.25], 'M82': [10.99, 5.11], 'M83': [13.61, 13.21],
  'M84': [7.41, 6.44], 'M85': [6.95, 5.35], 'M86': [11.53, 8.43],
  'M87': [7.11, 6.67], 'M88': [8.65, 4.38], 'M89': [8.13, 8],
  'M90': [9.12, 3.82], 'M91': [5.55, 4.52], 'M92': [14.4, 14.4],
  'M93': [15, 15], 'M94': [7.74, 6.68], 'M95': [7.23, 4.45],
  'M96': [8.26, 5.51], 'M97': [3.58, 3.58], 'M98': [11.04, 2.66],
  'M99': [5.04, 4.74], 'M100': [6.1, 5.62], 'M101': [23.99, 23.07],
  'M102': [5.2, 2.3],         // NGC 5866 Spindle Galaxy candidate — manual
  'M103': [4.5, 4.5], 'M104': [8.45, 4.91], 'M105': [4.89, 4.25],
  'M106': [16.98, 7.24], 'M107': [7.8, 7.8], 'M108': [3.98, 1.66],
  'M109': [8.07, 5.64], 'M110': [16.22, 9.59],
};

/**
 * Mean surface brightness in mag/arcsec². Returns NaN if angular size
 * data is missing for the object. Computed as:
 *
 *   SB = m + 2.5·log10(πab)
 *
 * where (a, b) are the major/minor axes converted to arcseconds and
 * πab is the elliptical apparent area. This is the "mean within
 * isophote" surface brightness astronomers cite for diffuse objects
 * — for star clusters the value is poorly defined and should be
 * read as "rough comparison only".
 */
export function messierSurfaceBrightness(
  id: string, apparentMag: number,
): number {
  const axes = MESSIER_ANG_SIZES[id];
  if (!axes) return NaN;
  const [major, minor] = axes;
  if (!(major > 0 && minor > 0)) return NaN;
  // Major/minor are arcmin; convert to arcsec and compute πab area.
  const a = major * 60;
  const b = minor * 60;
  const areaArcsec2 = Math.PI * a * b;
  return apparentMag + 2.5 * Math.log10(areaArcsec2);
}
