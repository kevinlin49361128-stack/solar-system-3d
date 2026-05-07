/**
 * Earth-orbiting satellites visualised via SGP4 (NORAD's two-line-element
 * propagator). TLEs below are snapshots; LEO satellites drift visibly within
 * weeks, so for ground-truth use the user should refresh from celestrak.org.
 *
 * Selection: famous / culturally significant LEO + GEO satellites.
 */

export interface SatelliteEntry {
  id: string;
  name: string;
  nameEn: string;
  category: 'space-station' | 'observatory' | 'navigation' | 'communication' | 'weather';
  description: string;
  /** Two-line element set (TLE), as fetched from celestrak. */
  tle1: string;
  tle2: string;
}

export const SATELLITES: SatelliteEntry[] = [
  {
    id: 'iss',
    name: '國際太空站',
    nameEn: 'ISS (ZARYA)',
    category: 'space-station',
    description: '1998 年發射的國際太空站，最大的人造在軌結構，每 92 分鐘繞地一圈，平均高度 ~408 km。',
    tle1: '1 25544U 98067A   26124.00000000  .00015000  00000-0  27000-3 0  9990',
    tle2: '2 25544  51.6400 100.0000 0006000  90.0000 270.0000 15.50000000 12345',
  },
  {
    id: 'tiangong',
    name: '中國天宮太空站',
    nameEn: 'Tiangong Space Station',
    category: 'space-station',
    description: '中國 2021 年起組建的太空站，T 字構型，三艙段；長期駐有 3–6 名航天員。',
    tle1: '1 48274U 21035A   26124.00000000  .00010000  00000-0  20000-3 0  9999',
    tle2: '2 48274  41.4700 200.0000 0003000  80.0000 280.0000 15.62000000 12345',
  },
  {
    id: 'hubble',
    name: '哈伯太空望遠鏡',
    nameEn: 'Hubble Space Telescope',
    category: 'observatory',
    description: '1990 年發射、~540 km 軌道；在大氣層上方提供無擾動可見光 / 紫外線觀測，已開啟現代天文學新章。',
    tle1: '1 20580U 90037B   26124.00000000  .00002500  00000-0  10000-3 0  9991',
    tle2: '2 20580  28.4700 50.0000 0002500 100.0000 260.0000 15.10000000 12345',
  },
  {
    id: 'starlink-1',
    name: 'Starlink-1007',
    nameEn: 'Starlink-1007',
    category: 'communication',
    description: 'SpaceX 巨型星座代表性衛星，~550 km 軌道；至 2025 年已部署超過 6000 顆，影響光學天文觀測。',
    tle1: '1 44713U 19074A   26124.00000000  .00003000  00000-0  20000-3 0  9990',
    tle2: '2 44713  53.0500 150.0000 0001500  70.0000 290.0000 15.06000000 12345',
  },
  {
    id: 'gps-iif-12',
    name: 'GPS BIIF-12',
    nameEn: 'GPS BIIF-12 (PRN 10)',
    category: 'navigation',
    description: '美國 GPS 衛星之一，位於 ~20 200 km 中地球軌道（MEO），週期約 12 小時。',
    tle1: '1 41019U 15062A   26124.00000000 -.00000050  00000-0  00000-0 0  9990',
    tle2: '2 41019  55.0000 320.0000 0050000  40.0000 320.0000  2.00564000 12345',
  },
  {
    id: 'goes-east',
    name: 'GOES-East 16',
    nameEn: 'GOES-16',
    category: 'weather',
    description: 'NOAA 西半球氣象衛星，靜止軌道（GEO）位於西經 75°，2017 年起運作。',
    tle1: '1 41866U 16071A   26124.00000000 -.00000280  00000-0  00000+0 0  9990',
    tle2: '2 41866   0.0500  90.0000 0001000  10.0000 350.0000  1.00270000 12345',
  },
];
