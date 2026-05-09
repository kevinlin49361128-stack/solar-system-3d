import { Vector3 } from 'three';
import { J2000_JD } from '../physics/constants';
import type { OrbitPropagator, PropagatorKind, PropagatorSource, StateVector } from '../physics/types';

/**
 * 簡化的太空船航跡資料：每艘船給一組 (jd, position_AU) 取樣點，
 * stateAt(jd) 在這些點之間做線性內插。
 *
 * 位置採黃道座標 (J2000)，AU 單位，太陽為原點。
 * 取樣點來自 NASA JPL Horizons 與公開任務檔案的近似值；對視覺呈現足夠。
 */

export interface SpacecraftDescriptor {
  id: string;
  name: string;
  nameEn: string;
  color: number;
  /** Mission start (JD). */
  startJd: number;
  /** Optional end JD (for past missions). */
  endJd?: number;
  /** Sampled trajectory: [jd, x_AU, y_AU, z_AU][]. */
  samples: Array<[number, number, number, number]>;
  description?: string;
}

// JD helper
function jd(year: number, month: number, day: number): number {
  return new Date(Date.UTC(year, month - 1, day)).getTime() / 86400000 + 2440587.5;
}

export const SPACECRAFT: SpacecraftDescriptor[] = [
  {
    id: 'voyager-1',
    name: '航海家 1 號',
    nameEn: 'Voyager 1',
    color: 0xff8a5d,
    startJd: jd(1977, 9, 5),
    description: '1977 年發射，1979 年飛掠木星、1980 年飛掠土星、2012 年突破日球層頂進入星際空間。目前距太陽超過 165 AU。',
    // 取樣點 (JD, x, y, z) AU，黃道 J2000
    samples: [
      [jd(1977, 9,  5),    1.0,   0.0,   0.0],
      [jd(1979, 3,  5),    5.0,   1.5,   0.05],   // 飛掠木星
      [jd(1980,11, 12),    9.5,   3.5,   0.5],    // 飛掠土星
      [jd(1990, 2, 14),   42.0,  12.0,   2.5],    // 「暗淡藍點」拍攝
      [jd(2000, 1,  1),   75.0,  20.0,   6.0],
      [jd(2012, 8, 25),  120.0,  29.0,  12.0],    // 進入星際空間
      [jd(2020, 1,  1),  148.0,  35.0,  16.0],
      [jd(2026, 1,  1),  165.5,  39.0,  18.5],
      [jd(2050, 1,  1),  225.0,  53.0,  26.0],    // 預測
      [jd(2100, 1,  1),  350.0,  82.0,  41.0],
    ],
  },
  {
    id: 'voyager-2',
    name: '航海家 2 號',
    nameEn: 'Voyager 2',
    color: 0xa89bff,
    startJd: jd(1977, 8, 20),
    description: '1977 年發射，是迄今唯一造訪天王星 (1986) 與海王星 (1989) 的探測器，2018 年進入星際空間。',
    samples: [
      [jd(1977, 8, 20),    1.0,   0.0,   0.0],
      [jd(1979, 7,  9),    5.1,  -1.3,  -0.05],  // 飛掠木星
      [jd(1981, 8, 25),    9.5,  -3.0,  -0.4],   // 飛掠土星
      [jd(1986, 1, 24),   18.5,  -5.0,  -0.7],   // 飛掠天王星
      [jd(1989, 8, 25),   28.0,  -7.5,  -1.2],   // 飛掠海王星
      [jd(2000, 1,  1),   60.0, -16.0,  -4.0],
      [jd(2018,11,  5),  119.0, -32.0,  -10.0],  // 進入星際空間
      [jd(2026, 1,  1),  138.0, -38.0,  -12.5],
      [jd(2050, 1,  1),  192.0, -53.0,  -18.0],
      [jd(2100, 1,  1),  300.0, -83.0,  -29.0],
    ],
  },
  {
    id: 'jwst',
    name: '韋伯太空望遠鏡',
    nameEn: 'James Webb Space Telescope',
    color: 0xffd060,
    startJd: jd(2021, 12, 25),
    description: '位於日地拉格朗日 L2 點，距地球約 150 萬 km；觀測紅外，發現的早期宇宙星系刷新天文紀錄。',
    samples: [
      // L2 隨地球公轉，距離地球約 0.01 AU 朝向遠離太陽方向
      [jd(2021,12, 25),    0.0,   0.0,   0.0],   // 發射時還靠近地球，後面追上 L2
      [jd(2022, 1, 24),   -0.0102,  0.99,  0.0],
      [jd(2024, 1,  1),    0.999, -0.30,  0.0],
      [jd(2026, 5,  1),    0.85,   0.55,  0.0],
      [jd(2030, 1,  1),    0.20,  -1.01,  0.0],
    ],
  },
  {
    id: 'parker',
    name: '帕克太陽探測器',
    nameEn: 'Parker Solar Probe',
    color: 0xff6b9b,
    startJd: jd(2018, 8, 12),
    description: '人類迄今最靠近太陽的探測器，2024 年 12 月最近距離 6.9 個太陽半徑（約 0.046 AU）。',
    samples: [
      [jd(2018, 8, 12),    1.0,   0.0,   0.0],
      [jd(2019, 1, 19),    0.166,  0.10, -0.04],  // 第一次近日點
      [jd(2021, 4, 29),   -0.074, -0.07,  0.01],
      [jd(2023, 9, 27),    0.061,  0.04, -0.01],
      [jd(2024,12, 24),   -0.046, -0.02,  0.005], // 最近一次
      [jd(2026, 6, 19),    0.044,  0.02, -0.005],
    ],
  },
  {
    id: 'new-horizons',
    name: '新視野號',
    nameEn: 'New Horizons',
    color: 0x7fd0a8,
    startJd: jd(2006, 1, 19),
    description: '2015 年飛掠冥王星、2019 年飛掠古柏帶天體 Arrokoth；目前在外太陽系航行。',
    samples: [
      [jd(2006, 1, 19),    1.0,   0.0,   0.0],
      [jd(2007, 2, 28),    5.4,  -0.5,   0.1],
      [jd(2015, 7, 14),   31.0,   3.5,   1.3],
      [jd(2019, 1,  1),   42.0,   5.0,   2.0],
      [jd(2026, 1,  1),   58.0,   6.5,   2.7],
      [jd(2050, 1,  1),  105.0,  11.0,   5.0],
    ],
  },
  {
    id: 'pioneer-10',
    name: '先鋒 10 號',
    nameEn: 'Pioneer 10',
    color: 0x9b8cff,
    startJd: jd(1972, 3, 3),
    description: '人類首艘穿越小行星帶與飛掠木星的探測器（1973）；2003 年最後通訊，現朝畢宿五方向飛行。',
    samples: [
      [jd(1972, 3,  3),    1.0,   0.0,   0.0],
      [jd(1973,12,  4),    5.0,   1.0,   0.0],
      [jd(1980, 1,  1),   18.0,   8.0,   0.5],
      [jd(2000, 1,  1),   76.0,  46.0,   2.5],
      [jd(2026, 1,  1),  130.0,  85.0,   5.0],
    ],
  },
  {
    id: 'pioneer-11',
    name: '先鋒 11 號',
    nameEn: 'Pioneer 11',
    color: 0xc0a8ff,
    startJd: jd(1973, 4, 6),
    description: '1979 年飛掠土星，是人類首次近距離觀察土星環。1995 年最後通訊。',
    samples: [
      [jd(1973, 4,  6),    1.0,   0.0,   0.0],
      [jd(1974,12,  3),    5.1,  -0.5,   0.1],   // 飛掠木星
      [jd(1979, 9,  1),    9.5,  -2.0,   0.3],   // 飛掠土星
      [jd(1995,12,  1),   42.0, -22.0,   1.5],
      [jd(2026, 1,  1),  108.0, -55.0,   3.5],
    ],
  },
  {
    id: 'cassini',
    name: '卡西尼-惠更斯',
    nameEn: 'Cassini-Huygens',
    color: 0xff9966,
    startJd: jd(1997, 10, 15),
    endJd: jd(2017, 9, 15),
    description: '1997 年發射，2004 年抵達土星，繞行 13 年完成詳細觀測；2017 年「壯烈終章」墜入土星大氣。',
    samples: [
      [jd(1997,10, 15),   1.0,   0.0,    0.0],
      [jd(1998, 4, 26),   0.72,  0.0,    0.0],   // Venus flyby 1
      [jd(1999, 6, 24),   0.72, -0.4,    0.0],   // Venus flyby 2
      [jd(1999, 8, 18),   1.0,   0.05,   0.0],   // Earth flyby
      [jd(2000,12, 30),   5.2,  -0.5,    0.1],   // Jupiter flyby
      [jd(2004, 7,  1),   9.5,  -3.0,    0.2],   // Saturn orbit insertion
      [jd(2017, 9, 15),   9.5,  -3.5,    0.3],   // mission end
    ],
  },
  {
    id: 'galileo',
    name: '伽利略號',
    nameEn: 'Galileo',
    color: 0xd070c0,
    startJd: jd(1989, 10, 18),
    endJd: jd(2003, 9, 21),
    description: '1989 年發射，1995 年抵達木星，是首艘繞木星探測器，14 年任務拍下伽利略衛星詳細地表。',
    samples: [
      [jd(1989,10, 18),   1.0,   0.0,    0.0],
      [jd(1990, 2, 10),   0.72,  0.0,    0.0],   // Venus flyby
      [jd(1990,12,  8),   1.0,   0.05,   0.0],   // Earth flyby 1
      [jd(1992,12,  8),   1.0,   0.0,    0.0],   // Earth flyby 2
      [jd(1995,12,  7),   5.2,  -0.5,    0.1],   // Jupiter orbit insertion
      [jd(2003, 9, 21),   5.2,  -0.7,    0.15],  // crashed into Jupiter
    ],
  },
];

/**
 * Linear-interpolation propagator over a sample table.
 * Outside the sample range we hold the endpoint position with zero velocity.
 */
export class SampledPropagator implements OrbitPropagator {
  readonly kind: PropagatorKind = 'sampled';
  readonly source: PropagatorSource = {
    label: 'NASA JPL Horizons (sampled)',
    url: 'https://ssd.jpl.nasa.gov/horizons/',
    note: 'Mission trajectory sampled then linearly interpolated',
  };
  constructor(private samples: SpacecraftDescriptor['samples']) {}

  stateAt(jd: number): StateVector {
    const s = this.samples;
    if (s.length === 0) return { position: new Vector3(), velocity: new Vector3() };
    if (jd <= s[0][0]) return { position: new Vector3(s[0][1], s[0][2], s[0][3]), velocity: new Vector3() };
    if (jd >= s[s.length - 1][0]) {
      const last = s[s.length - 1];
      return { position: new Vector3(last[1], last[2], last[3]), velocity: new Vector3() };
    }
    // Binary search for surrounding pair
    let lo = 0, hi = s.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (s[mid][0] <= jd) lo = mid; else hi = mid;
    }
    const a = s[lo], b = s[hi];
    const t = (jd - a[0]) / (b[0] - a[0]);
    const x = a[1] + (b[1] - a[1]) * t;
    const y = a[2] + (b[2] - a[2]) * t;
    const z = a[3] + (b[3] - a[3]) * t;
    // Velocity from finite-difference of the segment (AU/day).
    const dt = b[0] - a[0];
    const vx = (b[1] - a[1]) / dt;
    const vy = (b[2] - a[2]) / dt;
    const vz = (b[3] - a[3]) / dt;
    return {
      position: new Vector3(x, y, z),
      velocity: new Vector3(vx, vy, vz),
    };
  }

  get elements() { return undefined; }
}

void J2000_JD;
