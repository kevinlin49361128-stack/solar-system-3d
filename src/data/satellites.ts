/**
 * Earth-orbiting satellites visualised via SGP4 (NORAD's two-line-element
 * propagator).
 *
 * The TLEs below are REAL snapshots taken from CelesTrak (epoch ~2026-06,
 * day-of-year 164). They are bundled only as an offline fallback: at
 * runtime SatelliteLayer.refreshFromCelesTrak() fetches each satellite's
 * current element set live from CelesTrak (via the /api/tle proxy) keyed
 * by `noradId`, because LEO satellites drift visibly within weeks and a
 * stale snapshot would draw the ISS where it no longer is. If the live
 * fetch fails (offline / proxy down) the app falls back to these snapshots
 * and shows a toast — positions are then approximate, not fictional.
 *
 * Selection: famous / culturally significant LEO + MEO + GEO satellites.
 */

export interface SatelliteEntry {
  id: string;
  name: string;
  nameEn: string;
  category: 'space-station' | 'observatory' | 'navigation' | 'communication' | 'weather';
  description: string;
  /** NORAD catalog number — drives the live CelesTrak refresh. */
  noradId: number;
  /** Bundled fallback TLE (real CelesTrak snapshot, epoch ~2026 day 164). */
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
    noradId: 25544,
    tle1: '1 25544U 98067A   26164.83523427  .00008738  00000+0  16534-3 0  9990',
    tle2: '2 25544  51.6333 316.6832 0004955 182.4672 177.6293 15.49214103571238',
  },
  {
    id: 'tiangong',
    name: '中國天宮太空站',
    nameEn: 'Tiangong (CSS / Tianhe)',
    category: 'space-station',
    description: '中國 2021 年起組建的太空站，T 字構型，三艙段；長期駐有 3–6 名航天員。',
    noradId: 48274,
    tle1: '1 48274U 21035A   26164.84158950  .00024252  00000+0  28689-3 0  9995',
    tle2: '2 48274  41.4695 342.3609 0007804  49.8258 310.3263 15.60672813292648',
  },
  {
    id: 'hubble',
    name: '哈伯太空望遠鏡',
    nameEn: 'Hubble Space Telescope',
    category: 'observatory',
    description: '1990 年發射、~540 km 軌道；在大氣層上方提供無擾動可見光 / 紫外線觀測，已開啟現代天文學新章。',
    noradId: 20580,
    tle1: '1 20580U 90037B   26164.23141094  .00006133  00000+0  19317-3 0  9993',
    tle2: '2 20580  28.4712 107.6084 0001932 101.0971 258.9842 15.30704754787962',
  },
  {
    id: 'starlink-1008',
    name: 'Starlink-1008',
    nameEn: 'Starlink-1008',
    category: 'communication',
    description: 'SpaceX 巨型星座代表性衛星，~550 km 軌道；至 2025 年已部署超過 6000 顆，影響光學天文觀測。',
    noradId: 44714,
    tle1: '1 44714U 19074B   26164.50664332  .00069989  00000+0  12401-2 0  9999',
    tle2: '2 44714  53.1526  86.3448 0002931 112.5370 247.5950 15.49651313363643',
  },
  {
    id: 'gps-iif-12',
    name: 'GPS BIIF-12',
    nameEn: 'GPS BIIF-12 / NAVSTAR 75',
    category: 'navigation',
    description: '美國 GPS 衛星之一，位於 ~20 200 km 中地球軌道（MEO），週期約 12 小時。',
    noradId: 41019,
    tle1: '1 41019U 15062A   26164.28853580 -.00000062  00000+0  00000+0 0  9994',
    tle2: '2 41019  56.9567  30.9614 0111821 231.1221 127.9314  2.00566966 77757',
  },
  {
    id: 'goes-east',
    name: 'GOES-East 16',
    nameEn: 'GOES-16',
    category: 'weather',
    description: 'NOAA 西半球氣象衛星，靜止軌道（GEO）位於西經 75°，2017 年起運作。',
    noradId: 41866,
    tle1: '1 41866U 16071A   26164.66993006 -.00000080  00000+0  00000+0 0  9995',
    tle2: '2 41866   0.3318  85.5379 0000211 287.0700  25.8595  1.00270040 35069',
  },
];
