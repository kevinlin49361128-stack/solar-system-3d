import type { ObserverLocation } from '../physics/topocentric';

/**
 * Curated list of certified Dark Sky Places (DSP) for the "find
 * nearest dark sky" button.
 *
 * Sources:
 *   - DarkSky International (formerly IDA) International Dark Sky
 *     Places programme: https://darksky.org/places/
 *     Includes Reserves (largest, with a core + buffer), Parks,
 *     Sanctuaries (most remote / pristine), Communities, and Urban
 *     Night Sky Places.
 *   - A handful of well-known sites that aren't formally certified
 *     but are widely regarded as world-class dark-sky destinations
 *     (e.g. the Atacama in Chile, the South Pole) are included
 *     with `bortle` set based on published SQM measurements.
 *
 * Why curate manually instead of scraping at build time:
 *   - The IDA list churns: places get certified, decertified, or
 *     renamed several times a year. We want a stable v0.3.0 ship.
 *   - The IDA list also has minor places (small fields adjacent to
 *     larger reserves) that bloat the dataset without adding signal.
 *   - The Bortle column is editorial — IDA certifies on a different
 *     scale (Gold / Silver / Bronze tier) which maps imperfectly to
 *     Bortle. We pin a representative integer.
 *
 * Coverage: aim for at least one entry per inhabited continent so
 * the "find nearest" button isn't useless from anywhere on Earth.
 * Asia and Africa are under-represented in the IDA programme — we
 * pad with notable national parks / observatory zones to give the
 * button something to suggest there.
 */

export const DARK_SKY_PLACES: ObserverLocation[] = [
  // ─── East Asia ─────────────────────────────────────────────────
  {
    id: 'hehuanshan',
    name: '合歡山國際暗空公園',
    nameEn: 'Hehuanshan International Dark Sky Park',
    nameJa: '合歡山国際ダークスカイパーク',
    lat: 24.142, lon: 121.275, elevationM: 3158,
    bortle: 2,
    website: 'https://darksky.org/places/hehuanshan-international-dark-sky-park/',
    description: 'Taiwan\'s first IDA-certified Dark Sky Park, designated 2019. The Wuling and Kunyang sites sit above 3000 m with negligible light dome.',
  },
  {
    id: 'iriomote-ishigaki',
    name: '西表石垣國家公園',
    nameEn: 'Iriomote-Ishigaki National Park',
    nameJa: '西表石垣国立公園',
    lat: 24.336, lon: 124.165,
    bortle: 2,
    website: 'https://darksky.org/places/iriomote-ishigaki-national-park/',
    description: 'Japan\'s first IDA Dark Sky Park (2018). Southern Yaeyama Islands with view of constellations only visible below 25°N.',
  },
  {
    id: 'yeongyang-firefly',
    name: '英陽螢火蟲生態公園',
    nameEn: 'Yeongyang Firefly Eco Park',
    nameJa: '英陽ホタル生態公園',
    lat: 36.667, lon: 129.135,
    bortle: 3,
    website: 'https://darksky.org/places/yeongyang-firefly-eco-park/',
    description: 'South Korea\'s first IDA Dark Sky Park, in a mountainous valley with active firefly conservation.',
  },

  // ─── North America (Western US & Canada) ───────────────────────
  {
    id: 'cherry-springs',
    name: '櫻泉州立公園',
    nameEn: 'Cherry Springs State Park',
    nameJa: 'チェリースプリングス州立公園',
    lat: 41.660, lon: -77.825, elevationM: 700,
    bortle: 2,
    website: 'https://darksky.org/places/cherry-springs-state-park/',
    description: 'Eastern-US flagship; Gold-tier IDA Park surrounded by 2.6 M-acre Susquehannock State Forest. Hosts the annual Cherry Springs Star Party.',
  },
  {
    id: 'death-valley',
    name: '死谷國家公園',
    nameEn: 'Death Valley National Park',
    nameJa: 'デスバレー国立公園',
    lat: 36.461, lon: -116.867,
    bortle: 1,
    website: 'https://darksky.org/places/death-valley-national-park/',
    description: 'Gold-tier IDA Park since 2013. One of the few mainland US sites with Bortle Class 1 zones.',
  },
  {
    id: 'big-bend',
    name: '大彎曲國家公園',
    nameEn: 'Big Bend National Park',
    nameJa: 'ビッグベンド国立公園',
    lat: 29.250, lon: -103.250,
    bortle: 1,
    website: 'https://darksky.org/places/big-bend-national-park/',
    description: 'Least light-polluted national park in the contiguous US (per NPS surveys). IDA Dark Sky Park since 2012.',
  },
  {
    id: 'grand-canyon',
    name: '大峽谷國家公園',
    nameEn: 'Grand Canyon National Park',
    nameJa: 'グランドキャニオン国立公園',
    lat: 36.057, lon: -112.144, elevationM: 2138,
    bortle: 2,
    website: 'https://darksky.org/places/grand-canyon-national-park/',
    description: 'IDA Park since 2019. Hosts the annual Grand Canyon Star Party.',
  },
  {
    id: 'bryce-canyon',
    name: '布萊斯峽谷國家公園',
    nameEn: 'Bryce Canyon National Park',
    nameJa: 'ブライスキャニオン国立公園',
    lat: 37.594, lon: -112.187, elevationM: 2438,
    bortle: 2,
    website: 'https://darksky.org/places/bryce-canyon-national-park/',
    description: 'Famous for hoodoo formations against star-rich skies. Annual astronomy festival each June.',
  },
  {
    id: 'natural-bridges',
    name: '天然橋國家保護區',
    nameEn: 'Natural Bridges National Monument',
    nameJa: 'ナチュラルブリッジ国定公園',
    lat: 37.609, lon: -110.012, elevationM: 1981,
    bortle: 1,
    website: 'https://darksky.org/places/natural-bridges-national-monument/',
    description: 'World\'s first IDA Dark Sky Park (designated 2007). Surrounded by some of the darkest skies in the lower 48.',
  },
  {
    id: 'joshua-tree',
    name: '約書亞樹國家公園',
    nameEn: 'Joshua Tree National Park',
    nameJa: 'ジョシュアツリー国立公園',
    lat: 33.881, lon: -115.900,
    bortle: 2,
    website: 'https://darksky.org/places/joshua-tree-national-park/',
    description: 'Most accessible dark-sky park from LA / SD. IDA-certified 2017.',
  },
  {
    id: 'glacier-waterton',
    name: '冰川-沃特頓國際和平公園',
    nameEn: 'Waterton-Glacier International Peace Park',
    nameJa: 'ウォータートン・グレイシャー国際平和自然公園',
    lat: 48.700, lon: -113.700,
    bortle: 1,
    website: 'https://darksky.org/places/waterton-glacier-international-peace-park/',
    description: 'First international IDA Dark Sky Park (US + Canada, 2017). Northern lights frequently visible.',
  },
  {
    id: 'mont-megantic',
    name: '蒙特梅根蒂克',
    nameEn: 'Mont-Mégantic Dark Sky Reserve',
    nameJa: 'モンメガンティック・ダークスカイ保護区',
    lat: 45.456, lon: -71.153, elevationM: 1100,
    bortle: 2,
    website: 'https://darksky.org/places/mont-megantic-international-dark-sky-reserve/',
    description: 'World\'s first IDA International Dark Sky Reserve (2007). Hosts a public observatory.',
  },
  {
    id: 'jasper-np',
    name: '加拿大賈斯珀國家公園',
    nameEn: 'Jasper National Park Dark Sky Preserve',
    nameJa: 'ジャスパー国立公園ダークスカイ保護区',
    lat: 52.873, lon: -118.081, elevationM: 1062,
    bortle: 2,
    website: 'https://www.pc.gc.ca/en/pn-np/ab/jasper/activ/etoiles-stars',
    description: 'One of the world\'s largest dark sky preserves (11 000 km²). Annual Dark Sky Festival every October.',
  },
  {
    id: 'wood-buffalo',
    name: '伍德布法羅國家公園',
    nameEn: 'Wood Buffalo National Park',
    nameJa: 'ウッドバッファロー国立公園',
    lat: 59.733, lon: -112.317,
    bortle: 1,
    website: 'https://darksky.org/places/wood-buffalo-national-park/',
    description: 'World\'s largest IDA Dark Sky Preserve (44 800 km²). Pristine boreal forest in the Northwest Territories.',
  },
  {
    id: 'kitt-peak',
    name: '基特峰',
    nameEn: 'Kitt Peak (Sonoran Skies Dark Sky Park)',
    nameJa: 'キットピーク',
    lat: 31.958, lon: -111.598, elevationM: 2096,
    bortle: 2,
    website: 'https://noirlab.edu/public/programs/kitt-peak-national-observatory/',
    description: 'Sonoran Skies IDA Park; site of the historic Kitt Peak National Observatory.',
  },

  // ─── Europe ────────────────────────────────────────────────────
  {
    id: 'galloway-forest',
    name: '加洛韋森林公園',
    nameEn: 'Galloway Forest Dark Sky Park',
    nameJa: 'ギャロウェイ森林公園',
    lat: 55.105, lon: -4.418,
    bortle: 3,
    website: 'https://darksky.org/places/galloway-forest-park/',
    description: 'UK\'s first IDA Dark Sky Park (2009). Southern Scotland\'s 770 km² of pristine forest.',
  },
  {
    id: 'brecon-beacons',
    name: '布雷肯比肯斯',
    nameEn: 'Brecon Beacons International Dark Sky Reserve',
    nameJa: 'ブレコンビーコンズ',
    lat: 51.884, lon: -3.434,
    bortle: 3,
    website: 'https://darksky.org/places/brecon-beacons-national-park/',
    description: 'Welsh national park; IDA Reserve since 2013. Bands of the Milky Way visible from the central peaks.',
  },
  {
    id: 'exmoor',
    name: '埃克斯穆爾',
    nameEn: 'Exmoor National Park Dark Sky Reserve',
    nameJa: 'エクスムーア',
    lat: 51.187, lon: -3.794,
    bortle: 3,
    website: 'https://darksky.org/places/exmoor-national-park/',
    description: 'Europe\'s first IDA Reserve (2011). Southwest England moorland with low coastal light pollution.',
  },
  {
    id: 'snowdonia',
    name: '斯諾登尼亞',
    nameEn: 'Snowdonia / Eryri National Park',
    nameJa: 'スノードニア国立公園',
    lat: 52.910, lon: -3.985,
    bortle: 3,
    website: 'https://darksky.org/places/snowdonia-national-park/',
    description: 'Northern Welsh Reserve; the only IDA Reserve where you can stargaze inside a UNESCO-listed mountain landscape.',
  },
  {
    id: 'pic-du-midi',
    name: '南峰',
    nameEn: 'Pic du Midi International Dark Sky Reserve',
    nameJa: 'ピクデュミディ',
    lat: 42.937, lon: 0.142, elevationM: 2877,
    bortle: 2,
    website: 'https://darksky.org/places/pic-du-midi-international-dark-sky-reserve/',
    description: 'French Pyrenees Reserve including the 19th-century Pic du Midi Observatory. Cable-car access to the peak.',
  },
  {
    id: 'westhavelland',
    name: '西哈韋爾蘭',
    nameEn: 'Westhavelland International Dark Sky Reserve',
    nameJa: 'ヴェストハーフェルランド',
    lat: 52.728, lon: 12.402,
    bortle: 3,
    website: 'https://darksky.org/places/westhavelland-international-dark-sky-reserve/',
    description: 'Germany\'s first IDA Reserve (2014), 100 km west of Berlin in the Havel river plain.',
  },
  {
    id: 'eifel-np',
    name: '艾費爾國家公園',
    nameEn: 'Eifel National Park',
    nameJa: 'アイフェル国立公園',
    lat: 50.587, lon: 6.418,
    bortle: 3,
    website: 'https://darksky.org/places/nationalpark-eifel/',
    description: 'Western Germany / Belgium border Park (2019). Easily reachable from Cologne / Aachen.',
  },
  {
    id: 'zselic',
    name: '熱舍利克',
    nameEn: 'Zselic Starry Sky Park',
    nameJa: 'ジェリチ',
    lat: 46.275, lon: 17.708,
    bortle: 2,
    website: 'https://darksky.org/places/zselic-national-landscape-protection-area/',
    description: 'Hungary; Europe\'s first IDA Park (2009). Renowned for unobstructed horizon views.',
  },
  {
    id: 'hortobagy',
    name: '霍爾托巴吉',
    nameEn: 'Hortobágy National Park',
    nameJa: 'ホルトバージ国立公園',
    lat: 47.611, lon: 21.057,
    bortle: 3,
    website: 'https://darksky.org/places/hortobagy-national-park/',
    description: 'UNESCO-listed steppe in eastern Hungary; IDA Park since 2011.',
  },
  {
    id: 'cevennes',
    name: '塞文山國家公園',
    nameEn: 'Cévennes National Park',
    nameJa: 'セヴェンヌ国立公園',
    lat: 44.250, lon: 3.580,
    bortle: 2,
    website: 'https://darksky.org/places/cevennes-national-park/',
    description: 'World\'s largest IDA Reserve in Europe (3560 km², 2018). Southern French Massif Central.',
  },
  {
    id: 'alqueva',
    name: '阿爾蓋瓦',
    nameEn: 'Alqueva Dark Sky Reserve',
    nameJa: 'アルケヴァ',
    lat: 38.205, lon: -7.460,
    bortle: 2,
    website: 'https://www.darkskyalqueva.com/',
    description: 'Portuguese Alentejo Reserve; first Starlight Tourism Destination (UNESCO + IAU).',
  },
  {
    id: 'la-palma',
    name: '拉帕爾馬',
    nameEn: 'La Palma — Roque de los Muchachos',
    nameJa: 'ラパルマ',
    lat: 28.764, lon: -17.892, elevationM: 2396,
    bortle: 2,
    website: 'https://www.iac.es/en/observatorios-de-canarias/roque-de-los-muchachos-observatory',
    description: 'Canary Islands site of the Roque de los Muchachos Observatory; protected by Spain\'s 1988 Sky Law.',
  },
  {
    id: 'kerry',
    name: '凱里國際暗空保護區',
    nameEn: 'Kerry International Dark Sky Reserve',
    nameJa: 'ケリー国際ダークスカイ保護区',
    lat: 51.943, lon: -10.310,
    bortle: 2,
    website: 'https://darksky.org/places/kerry-international-dark-sky-reserve/',
    description: 'Southwest Ireland Reserve (2014). Atlantic-coast Skellig Coast region.',
  },
  {
    id: 'mayo',
    name: '梅奧暗空公園',
    nameEn: 'Mayo Dark Sky Park',
    nameJa: 'メイヨー・ダークスカイパーク',
    lat: 54.071, lon: -9.738,
    bortle: 2,
    website: 'https://darksky.org/places/mayo-dark-sky-park/',
    description: 'Northwest Ireland\'s Wild Nephin / Ballycroy area; certified 2016.',
  },

  // ─── Southern Africa ───────────────────────────────────────────
  {
    id: 'namibrand',
    name: '納米布蘭德自然保護區',
    nameEn: 'NamibRand Nature Reserve',
    nameJa: 'ナミブランド自然保護区',
    lat: -25.245, lon: 16.013,
    bortle: 1,
    website: 'https://darksky.org/places/namibrand-nature-reserve/',
    description: 'Gold-tier IDA Reserve — widely cited as one of the darkest sky measurements ever recorded (SQM ≥ 22.0 mag/arcsec²).',
  },
  {
    id: 'saao-sutherland',
    name: '蘇瑟蘭天文台',
    nameEn: 'SAAO Sutherland',
    nameJa: 'サザーランド天文台',
    lat: -32.376, lon: 20.811, elevationM: 1798,
    bortle: 2,
    website: 'https://www.saao.ac.za/about/observatories/',
    description: 'South African Astronomical Observatory\'s flagship site. Hosts SALT (Southern African Large Telescope).',
  },

  // ─── South America ─────────────────────────────────────────────
  {
    id: 'eso-paranal',
    name: '帕拉那爾天文台',
    nameEn: 'ESO Paranal Observatory',
    nameJa: 'パラナル天文台',
    lat: -24.627, lon: -70.404, elevationM: 2635,
    bortle: 1,
    website: 'https://www.eso.org/public/teles-instr/paranal-observatory/',
    description: 'Atacama Desert; ESO\'s Very Large Telescope site. Often cited as one of the world\'s most pristine night skies.',
  },
  {
    id: 'la-silla',
    name: '拉西亞天文台',
    nameEn: 'La Silla Observatory',
    nameJa: 'ラ・シヤ天文台',
    lat: -29.257, lon: -70.733, elevationM: 2400,
    bortle: 1,
    website: 'https://www.eso.org/public/teles-instr/lasilla/',
    description: 'ESO\'s first observatory (1969). Southern Atacama.',
  },
  {
    id: 'gemini-south',
    name: '雙子星座南天文台',
    nameEn: 'Cerro Pachón / Gemini South',
    nameJa: 'セロパチョン',
    lat: -30.241, lon: -70.737, elevationM: 2737,
    bortle: 1,
    website: 'https://www.gemini.edu/observatory/cerro-pachon',
    description: 'Chilean Andes; site of Gemini-South + the upcoming Vera C. Rubin Observatory.',
  },
  {
    id: 'elqui-valley',
    name: '埃爾基谷',
    nameEn: 'Elqui Valley Dark Sky Sanctuary',
    nameJa: 'エルキ谷',
    lat: -30.030, lon: -70.694,
    bortle: 2,
    website: 'https://darksky.org/places/gabriela-mistral-dark-sky-sanctuary/',
    description: 'Gabriela Mistral Dark Sky Sanctuary, Chile. First IDA Sanctuary in the Americas.',
  },

  // ─── Oceania ───────────────────────────────────────────────────
  {
    id: 'aoraki-mackenzie',
    name: '奧拉基麥肯齊',
    nameEn: 'Aoraki Mackenzie International Dark Sky Reserve',
    nameJa: 'アオラキ・マッケンジー',
    lat: -43.737, lon: 170.097, elevationM: 1031,
    bortle: 2,
    website: 'https://darksky.org/places/aoraki-mackenzie-international-dark-sky-reserve/',
    description: 'New Zealand South Island; 4300 km² Reserve including Mt John Observatory.',
  },
  {
    id: 'great-barrier-island',
    name: '大堡礁島',
    nameEn: 'Aotea / Great Barrier Island',
    nameJa: 'グレートバリア島',
    lat: -36.187, lon: 175.408,
    bortle: 2,
    website: 'https://darksky.org/places/aotea-great-barrier-island/',
    description: 'New Zealand Hauraki Gulf; third IDA Sanctuary in the world (2017).',
  },
  {
    id: 'warrumbungle',
    name: '瓦倫邦格國家公園',
    nameEn: 'Warrumbungle National Park',
    nameJa: 'ワルンブングル国立公園',
    lat: -31.275, lon: 149.043,
    bortle: 3,
    website: 'https://darksky.org/places/warrumbungle-national-park/',
    description: 'Australia\'s first IDA Dark Sky Park (2016). NSW central west; site of Siding Spring Observatory.',
  },
  {
    id: 'river-murray',
    name: '默累河國際暗空保護區',
    nameEn: 'River Murray International Dark Sky Reserve',
    nameJa: 'マレー川',
    lat: -34.567, lon: 139.617,
    bortle: 2,
    website: 'https://darksky.org/places/river-murray-international-dark-sky-reserve/',
    description: 'South Australia\'s Mid Murray region. Gold-tier Reserve (2019).',
  },

  // ─── Polar / Remote ────────────────────────────────────────────
  {
    id: 'amundsen-scott',
    name: '阿蒙森-斯科特南極站',
    nameEn: 'Amundsen-Scott South Pole Station',
    nameJa: 'アムンゼン・スコット基地',
    lat: -89.998, lon: -139.272, elevationM: 2835,
    bortle: 1,
    website: 'https://www.nsf.gov/geo/opp/support/southp.jsp',
    description: 'US research station at geographic South Pole. Six months of continuous darkness (austral winter) with no atmospheric water vapour.',
  },
  {
    id: 'concordia-dome-c',
    name: 'C 站康科迪亞',
    nameEn: 'Concordia Station, Dome C',
    nameJa: 'コンコルディア基地',
    lat: -75.100, lon: 123.350, elevationM: 3233,
    bortle: 1,
    website: 'https://www.france-pyrenees-meridiennes.org/concordia-dome-c/',
    description: 'French-Italian high-Antarctic research station. Sub-arcsecond seeing measurements; the closest thing to ground-based "above the atmosphere".',
  },

  // ─── North Asia / Middle East ──────────────────────────────────
  {
    id: 'gobi-desert',
    name: '戈壁沙漠 (蒙古國)',
    nameEn: 'Gobi Desert (Mongolian Highland)',
    nameJa: 'ゴビ砂漠',
    lat: 43.500, lon: 105.000,
    bortle: 1,
    description: 'Not IDA-certified but among the most light-pollution-free regions on Earth per VIIRS satellite measurements.',
  },
];

/**
 * Great-circle (haversine) distance between two lat/lon pairs, in km.
 * Earth modelled as a sphere of mean radius 6371 km — accurate to
 * ~0.5% which is more than enough for "is this place 200 or 2000 km
 * away" decision-making.
 */
export function haversineKm(
  lat1: number, lon1: number,
  lat2: number, lon2: number,
): number {
  const R = 6371;
  const toRad = (d: number) => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

/**
 * Rank Dark Sky Places by their proximity to (lat, lon) plus a
 * Bortle penalty, so a Bortle-1 sanctuary 300 km away beats a
 * Bortle-3 park 250 km away.
 *
 * Score formula:  distance_km + (bortle - 1) × 25
 * Lower is better. The 25 km/Bortle weight matches the intuition
 * "I'd drive an extra 25 km to drop one Bortle class" — picked from
 * the rough Bortle-vs-magnitude-gain curve.
 *
 * Returns top `count` matches sorted by score, with the raw distance
 * attached for UI display.
 */
export function nearestDarkSkyPlaces(
  lat: number, lon: number,
  count = 5,
): Array<{ place: ObserverLocation; distanceKm: number; score: number }> {
  return DARK_SKY_PLACES
    .map(place => {
      const distanceKm = haversineKm(lat, lon, place.lat, place.lon);
      const bortlePenalty = ((place.bortle ?? 4) - 1) * 25;
      return { place, distanceKm, score: distanceKm + bortlePenalty };
    })
    .sort((a, b) => a.score - b.score)
    .slice(0, count);
}
