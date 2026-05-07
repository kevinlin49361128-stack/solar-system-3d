/**
 * 星座連線：以 [star_id, star_id] pair 列出每個星座的線段。
 * star_id 必須對應 stars.ts 中的 NAMED_STARS。
 */

export interface Constellation {
  id: string;
  name: string;
  nameEn: string;
  /** 連線：每個 entry 是一條折線（多顆星依序相連）。 */
  lines: string[][];
}

export const CONSTELLATIONS: Constellation[] = [
  {
    id: 'ursa-major',
    name: '北斗七星 (大熊座)',
    nameEn: 'Ursa Major (Big Dipper)',
    lines: [['dubhe', 'merak', 'phecda', 'megrez', 'alioth', 'mizar', 'alkaid'],
            ['megrez', 'dubhe']],
  },
  {
    id: 'ursa-minor',
    name: '小熊座',
    nameEn: 'Ursa Minor',
    lines: [['polaris', 'kochab', 'pherkad']],
  },
  {
    id: 'orion',
    name: '獵戶座',
    nameEn: 'Orion',
    lines: [
      ['betelgeuse', 'bellatrix'],
      ['betelgeuse', 'alnitak', 'saiph'],
      ['bellatrix', 'mintaka', 'rigel'],
      ['mintaka', 'alnilam', 'alnitak'],
    ],
  },
  {
    id: 'cassiopeia',
    name: '仙后座',
    nameEn: 'Cassiopeia',
    lines: [['caph', 'schedar', 'cih', 'ruchbah', 'segin']],
  },
  {
    id: 'cygnus',
    name: '天鵝座 (北十字)',
    nameEn: 'Cygnus (Northern Cross)',
    lines: [
      ['deneb', 'sadr', 'albireo'],
      ['gienah-cyg', 'sadr', 'aljanah'],
    ],
  },
  {
    id: 'lyra',
    name: '天琴座',
    nameEn: 'Lyra',
    lines: [
      ['vega', 'lyr-delta', 'sulafat', 'sheliak', 'vega'],
    ],
  },
  {
    id: 'aquila',
    name: '天鷹座',
    nameEn: 'Aquila',
    lines: [['tarazed', 'altair', 'alshain']],
  },
  {
    id: 'gemini',
    name: '雙子座',
    nameEn: 'Gemini',
    lines: [
      ['castor', 'pollux'],
      ['pollux', 'alhena'],
      ['castor', 'mebsuta'],
    ],
  },
  {
    id: 'canis-major',
    name: '大犬座',
    nameEn: 'Canis Major',
    lines: [
      ['sirius', 'mirzam'],
      ['sirius', 'wezen', 'adhara'],
      ['sirius', 'adhara'],
    ],
  },
  {
    id: 'taurus',
    name: '金牛座',
    nameEn: 'Taurus',
    lines: [
      ['aldebaran', 'elnath'],
      ['aldebaran', 'alcyone'],
    ],
  },
  {
    id: 'leo',
    name: '獅子座',
    nameEn: 'Leo',
    lines: [
      ['regulus', 'algieba', 'zosma', 'denebola'],
      ['regulus', 'denebola'],
    ],
  },
  {
    id: 'scorpius',
    name: '天蠍座',
    nameEn: 'Scorpius',
    lines: [
      ['antares', 'graffias'],
      ['antares', 'sargas', 'shaula'],
      ['graffias', 'dschubba'],
    ],
  },
  {
    id: 'sagittarius',
    name: '人馬座 (茶壺)',
    nameEn: 'Sagittarius (Teapot)',
    lines: [
      ['nunki', 'ascella', 'kaus-aus', 'kaus-med', 'nunki'],
    ],
  },
  {
    id: 'crux',
    name: '南十字座',
    nameEn: 'Crux',
    lines: [
      ['acrux', 'gacrux'],
      ['mimosa', 'imai'],
    ],
  },
  {
    id: 'centaurus',
    name: '半人馬座',
    nameEn: 'Centaurus',
    lines: [['rigil-kent', 'hadar']],
  },
  {
    id: 'pegasus-andromeda',
    name: '飛馬-仙女 (秋四方)',
    nameEn: 'Pegasus / Andromeda',
    lines: [
      ['markab', 'scheat', 'algenib', 'alpheratz', 'markab'],
      ['alpheratz', 'mirach', 'almach'],
    ],
  },
  {
    id: 'auriga',
    name: '御夫座',
    nameEn: 'Auriga',
    lines: [
      ['capella', 'menkalinan', 'elnath'],
    ],
  },
  {
    id: 'bootes',
    name: '牧夫座 (風箏)',
    nameEn: 'Boötes',
    lines: [
      ['arcturus', 'izar', 'nekkar'],
    ],
  },
  {
    id: 'virgo',
    name: '室女座',
    nameEn: 'Virgo',
    lines: [
      ['spica', 'porrima', 'vindemiatrix'],
    ],
  },
  {
    id: 'perseus',
    name: '英仙座',
    nameEn: 'Perseus',
    lines: [
      ['mirfak', 'algol'],
    ],
  },
];
