import type { BodyDetails } from '../physics/types';

/**
 * 各天體的詳細資料（地質、組成、剖面、溫度、大氣）。
 * 數據來源：NASA Planetary Fact Sheet, Lodders 2003 (太陽組成),
 * USGS Astrogeology, IPCC 大氣資料。
 */

export const DETAILS: Record<string, BodyDetails> = {
  sun: {
    classification: { 'zh-Hant': 'G2V 主序星', 'en': 'G2V Main-sequence Star', 'ja': 'G2V 主系列星' },
    meanSurfaceTempC: 5505,
    surfaceTempRangeC: [4000, 6000],
    surfaceGravityMS2: 274,
    escapeVelocityKmS: 617.5,
    bulkComposition: [
      { name: { 'zh-Hant': '氫 (H)', 'en': 'Hydrogen (H)', 'ja': '水素 (H)' }, pct: 73.46 },
      { name: { 'zh-Hant': '氦 (He)', 'en': 'Helium (He)', 'ja': 'ヘリウム (He)' }, pct: 24.85 },
      { name: { 'zh-Hant': '氧 (O)', 'en': 'Oxygen (O)', 'ja': '酸素 (O)' }, pct: 0.77 },
      { name: { 'zh-Hant': '碳 (C)', 'en': 'Carbon (C)', 'ja': '炭素 (C)' }, pct: 0.29 },
      { name: { 'zh-Hant': '鐵 (Fe)', 'en': 'Iron (Fe)', 'ja': '鉄 (Fe)' }, pct: 0.16 },
      { name: { 'zh-Hant': '其他', 'en': 'Others', 'ja': 'その他' }, pct: 0.47 },
    ],
    internalStructure: [
      { layer: { 'zh-Hant': '核心', 'en': 'Core', 'ja': '中心核' },
        description: { 'zh-Hant': '半徑 0–25%；溫度 1500 萬 K，密度 150 g/cm³，氫核融合為氦發生於此。', 'en': 'Inner 25% radius; 15M K, 150 g/cm³. Hydrogen fuses into helium here.', 'ja': '半径 0–25%、1500 万 K、密度 150 g/cm³。水素核融合の場。' } },
      { layer: { 'zh-Hant': '輻射層', 'en': 'Radiative Zone', 'ja': '放射層' },
        description: { 'zh-Hant': '半徑 25–70%；能量以光子輻射形式向外傳遞，光子穿越需 17 萬年。', 'en': '25–70% radius; energy transferred outward as photons (taking ~170k years to escape).', 'ja': '半径 25–70%、光子で外へ熱輸送。光子の通過に 17 万年。' } },
      { layer: { 'zh-Hant': '對流層', 'en': 'Convection Zone', 'ja': '対流層' },
        description: { 'zh-Hant': '半徑 70–100%；電漿對流上升下沉形成米粒組織。', 'en': '70–100% radius; convective plasma cells form the granulation pattern.', 'ja': '半径 70–100%、対流が粒状斑を形成。' } },
      { layer: { 'zh-Hant': '光球層', 'en': 'Photosphere', 'ja': '光球' },
        description: { 'zh-Hant': '可見「表面」，厚 ~500 km，溫度 5505°C，光子最終逃逸進入太空。', 'en': 'Visible "surface", ~500 km thick, 5505°C; photons finally escape into space.', 'ja': '可視の「表面」、厚さ 500 km、5505°C。光子が宇宙へ放出される。' } },
      { layer: { 'zh-Hant': '色球層 / 日冕', 'en': 'Chromosphere / Corona', 'ja': '彩層 / コロナ' },
        description: { 'zh-Hant': '稀薄外層，日冕溫度反而升至 100 萬 K（高溫之謎尚未完全解釋）。', 'en': 'Thin outer layers; corona reaches 1M K (heating mechanism still debated).', 'ja': '希薄な外層。コロナは 100 万 K に達する（加熱機構は未解明）。' } },
    ],
    geology: { 'zh-Hant': '太陽質量佔太陽系 99.86%，每秒將 6 億噸氫融合成氦並損失 4 百萬噸質量，能量以光與微中子釋放。預期再 50 億年後膨脹為紅巨星。',
      'en': 'Holds 99.86% of solar-system mass. Fuses 600M tons of hydrogen per second, losing 4M tons as energy emitted as light and neutrinos. Will expand into a red giant in ~5B years.',
      'ja': '太陽系全質量の 99.86% を占める。毎秒 6 億トンの水素を融合し、400 万トンが光と微小中性子としてエネルギー放出。約 50 億年後に赤色巨星化。' },
    notableFacts: [
      { 'zh-Hant': '11 年磁活動週期，黑子數量、閃焰、日冕物質拋射隨之起伏。',
        'en': '11-year magnetic activity cycle drives sunspot count, flares, and CMEs.',
        'ja': '11 年周期の磁気活動。黒点数・フレア・CME がこれに連動。' },
      { 'zh-Hant': '太陽風以 400–800 km/s 向外吹拂，影響整個太陽圈直到太陽風頂。',
        'en': 'Solar wind blows outward at 400–800 km/s, shaping the heliosphere out to the heliopause.',
        'ja': '太陽風は 400–800 km/s で吹き出し、太陽圏を太陽風端まで形成。' },
    ],
  },

  mercury: {
    classification: '類地行星（最內、最小）',
    meanSurfaceTempC: 167,
    surfaceTempRangeC: [-173, 427],
    surfaceGravityMS2: 3.7,
    escapeVelocityKmS: 4.25,
    bulkComposition: [
      { name: '鐵 (Fe，含核心)', pct: 70 },
      { name: '矽酸鹽 (mantle/crust)', pct: 30 },
    ],
    atmosphere: {
      pressureNote: '近乎真空（外逸層 ~ 10⁻¹⁵ kPa）',
      composition: [
        { name: '氧 (O)', pct: 42 },
        { name: '鈉 (Na)', pct: 29 },
        { name: '氫 (H)', pct: 22 },
        { name: '氦 (He)', pct: 6 },
        { name: '其他', pct: 1 },
      ],
    },
    internalStructure: [
      { layer: '核心', description: '半徑約 1 800 km，佔全行星 ~75% 半徑；液態鐵-鎳，產生微弱磁場。' },
      { layer: '地函', description: '厚約 600 km，矽酸鹽。' },
      { layer: '地殼', description: '厚 100–300 km，富含碳質與硫化物。' },
    ],
    geology: '表面類似月球：滿布隕石坑、平原（如 Caloris 盆地直徑 1550 km）、皺脊（lobate scarps）顯示行星冷卻收縮。極區永夜坑底有水冰。',
    notableFacts: [
      '一個太陽日 = 176 地球日（自轉 58.6 日 + 公轉 88 日的共振）。',
      '軌道離心率 0.21，近日點與遠日點距日相差 ~24%。',
    ],
  },

  venus: {
    classification: '類地行星（地球姊妹）',
    meanSurfaceTempC: 464,
    surfaceTempRangeC: [437, 482],
    surfaceGravityMS2: 8.87,
    escapeVelocityKmS: 10.36,
    bulkComposition: [
      { name: '矽酸鹽地函', pct: 70 },
      { name: '鐵核心', pct: 30 },
    ],
    atmosphere: {
      surfacePressureKpa: 9200,
      pressureNote: '92 倍地球大氣壓',
      composition: [
        { name: '二氧化碳 (CO₂)', pct: 96.5 },
        { name: '氮 (N₂)', pct: 3.5 },
        { name: '硫酸雲、SO₂、Ar', pct: 0.015 },
      ],
    },
    internalStructure: [
      { layer: '核心', description: '半徑約 3 200 km，鐵-鎳；無內生磁場（自轉太慢或核心已凝固）。' },
      { layer: '地函', description: '矽酸鹽，類似地球但無板塊運動。' },
      { layer: '地殼', description: '厚 50 km 玄武岩；估計每 3-6 億年發生一次全球性火山重鋪。' },
    ],
    geology: '90% 表面為火山平原；超過 1 600 座大型火山。完全乾涸（H₂O < 20 ppm）。CO₂ 溫室效應使表面比水星更熱。',
    notableFacts: [
      '逆向自轉，自轉週期 243 日比公轉 225 日還長。',
      '硫酸雲頂端風速可達 360 km/h（超自轉現象）。',
    ],
  },

  earth: {
    classification: { 'zh-Hant': '類地行星（唯一已知具生命）', 'en': 'Terrestrial planet (only known with life)', 'ja': '地球型惑星（唯一生命を持つ）' },
    meanSurfaceTempC: 15,
    surfaceTempRangeC: [-89.2, 56.7],
    surfaceGravityMS2: 9.807,
    escapeVelocityKmS: 11.186,
    bulkComposition: [
      { name: { 'zh-Hant': '鐵 (Fe)', 'en': 'Iron (Fe)', 'ja': '鉄 (Fe)' }, pct: 32.1 },
      { name: { 'zh-Hant': '氧 (O)', 'en': 'Oxygen (O)', 'ja': '酸素 (O)' }, pct: 30.1 },
      { name: { 'zh-Hant': '矽 (Si)', 'en': 'Silicon (Si)', 'ja': 'ケイ素 (Si)' }, pct: 15.1 },
      { name: { 'zh-Hant': '鎂 (Mg)', 'en': 'Magnesium (Mg)', 'ja': 'マグネシウム (Mg)' }, pct: 13.9 },
      { name: { 'zh-Hant': '硫 (S)', 'en': 'Sulfur (S)', 'ja': '硫黄 (S)' }, pct: 2.9 },
      { name: { 'zh-Hant': '其他', 'en': 'Others', 'ja': 'その他' }, pct: 5.9 },
    ],
    atmosphere: {
      surfacePressureKpa: 101.325,
      composition: [
        { name: { 'zh-Hant': '氮 (N₂)', 'en': 'Nitrogen (N₂)', 'ja': '窒素 (N₂)' }, pct: 78.084 },
        { name: { 'zh-Hant': '氧 (O₂)', 'en': 'Oxygen (O₂)', 'ja': '酸素 (O₂)' }, pct: 20.946 },
        { name: { 'zh-Hant': '氬 (Ar)', 'en': 'Argon (Ar)', 'ja': 'アルゴン (Ar)' }, pct: 0.934 },
        { name: { 'zh-Hant': '二氧化碳 (CO₂)', 'en': 'Carbon Dioxide (CO₂)', 'ja': '二酸化炭素 (CO₂)' }, pct: 0.042 },
        { name: { 'zh-Hant': '水汽 (變動)', 'en': 'Water vapor (variable)', 'ja': '水蒸気 (変動)' }, pct: 0.4 },
      ],
    },
    internalStructure: [
      { layer: { 'zh-Hant': '內核', 'en': 'Inner Core', 'ja': '内核' },
        description: { 'zh-Hant': '半徑 1 220 km，固態鐵-鎳，溫度 ~5400°C。', 'en': '1,220 km radius, solid iron-nickel, ~5400°C.', 'ja': '半径 1,220 km、固体の鉄-ニッケル、~5400°C。' } },
      { layer: { 'zh-Hant': '外核', 'en': 'Outer Core', 'ja': '外核' },
        description: { 'zh-Hant': '厚 2 260 km，液態鐵-鎳；對流產生地球磁場。', 'en': '2,260 km thick, liquid iron-nickel; convection drives the geomagnetic field.', 'ja': '厚さ 2,260 km、液体の鉄-ニッケル。対流が地磁気を生む。' } },
      { layer: { 'zh-Hant': '下地函', 'en': 'Lower Mantle', 'ja': '下部マントル' },
        description: { 'zh-Hant': '厚 2 200 km，固態矽酸鹽（鈣鈦礦結構）。', 'en': '2,200 km thick, solid silicates (perovskite structure).', 'ja': '厚さ 2,200 km、固体ケイ酸塩（ペロブスカイト構造）。' } },
      { layer: { 'zh-Hant': '上地函 / 軟流圈', 'en': 'Upper Mantle / Asthenosphere', 'ja': '上部マントル / アセノスフェア' },
        description: { 'zh-Hant': '厚 670 km，部分熔融，驅動板塊運動。', 'en': '670 km thick, partially molten, drives plate tectonics.', 'ja': '厚さ 670 km、部分的に溶融、プレート運動を駆動。' } },
      { layer: { 'zh-Hant': '地殼', 'en': 'Crust', 'ja': '地殻' },
        description: { 'zh-Hant': '海洋地殼 5–10 km、大陸地殼 30–70 km。', 'en': 'Oceanic crust 5–10 km; continental crust 30–70 km.', 'ja': '海洋地殻 5–10 km、大陸地殻 30–70 km。' } },
    ],
    geology: { 'zh-Hant': '唯一具有活躍板塊構造的行星。約 71% 表面為水覆蓋。磁場保護大氣不被太陽風剝離。生命已存在 ~38 億年並大幅改造大氣。',
      'en': 'Only planet with active plate tectonics. ~71% surface water-covered. Magnetic field shields the atmosphere from solar wind. Life has reshaped the atmosphere over ~3.8 Gyr.',
      'ja': '活発なプレートテクトニクスを持つ唯一の惑星。表面の約 71% は水。磁場が大気を太陽風から守る。約 38 億年の生命活動が大気を改造。' },
    notableFacts: [
      { 'zh-Hant': '軸傾角 23.44° 造成季節變化。', 'en': 'Axial tilt of 23.44° causes the seasons.', 'ja': '自転軸傾斜 23.44° が四季を生む。' },
      { 'zh-Hant': '月球潮汐使地球自轉每世紀變慢 1.7 毫秒。', 'en': 'Lunar tides slow Earth\'s rotation by 1.7 ms per century.', 'ja': '月の潮汐により自転が 1 世紀あたり 1.7 ms 遅くなる。' },
      { 'zh-Hant': '預估 50 億年後太陽紅巨星化將吞噬地球。', 'en': 'In ~5 Gyr the Sun\'s red-giant phase will likely engulf Earth.', 'ja': '約 50 億年後、太陽の赤色巨星化により地球は呑み込まれる見込み。' },
    ],
  },

  mars: {
    classification: '類地行星（紅色行星）',
    meanSurfaceTempC: -63,
    surfaceTempRangeC: [-143, 35],
    surfaceGravityMS2: 3.71,
    escapeVelocityKmS: 5.03,
    bulkComposition: [
      { name: '鐵 (Fe，含氧化鐵)', pct: 27 },
      { name: '矽酸鹽地函', pct: 65 },
      { name: '硫 (S)', pct: 8 },
    ],
    atmosphere: {
      surfacePressureKpa: 0.636,
      pressureNote: '~0.6% 地球大氣壓',
      composition: [
        { name: '二氧化碳 (CO₂)', pct: 95.32 },
        { name: '氮 (N₂)', pct: 2.7 },
        { name: '氬 (Ar)', pct: 1.6 },
        { name: '氧 (O₂)', pct: 0.13 },
        { name: '一氧化碳、水汽', pct: 0.25 },
      ],
    },
    internalStructure: [
      { layer: '核心', description: '半徑 1 700 km，部分液態硫鐵；磁場早期消失。' },
      { layer: '地函', description: '矽酸鹽，富含鎂與鐵，較地球冷。' },
      { layer: '地殼', description: '南半球古老（44 億年）厚 ~80 km，北半球年輕薄 ~32 km。' },
    ],
    geology: '奧林帕斯山高 25 km、底寬 600 km，太陽系最大火山。水手號峽谷長 4 000 km、深 7 km。極冠由 CO₂ 與水冰組成，季節性升降。表面紅色源於氧化鐵（Fe₂O₃）。',
    notableFacts: [
      '一個火星年約 687 地球日。',
      '兩顆衛星 Phobos、Deimos 可能是被捕獲的小行星。',
      'NASA Insight 偵測到火星震，證明內部仍有地質活動。',
    ],
  },

  jupiter: {
    classification: '氣態巨行星（最大行星）',
    meanSurfaceTempC: -145,
    surfaceTempRangeC: [-145, -110],
    surfaceGravityMS2: 24.79,
    escapeVelocityKmS: 59.5,
    bulkComposition: [
      { name: '氫 (H₂)', pct: 89 },
      { name: '氦 (He)', pct: 10 },
      { name: '甲烷、氨、水汽', pct: 1 },
    ],
    atmosphere: {
      pressureNote: '無固體表面；分層：對流層→平流層→熱層',
      composition: [
        { name: '氫 (H₂)', pct: 89.8 },
        { name: '氦 (He)', pct: 10.2 },
        { name: '甲烷 (CH₄)', pct: 0.3 },
        { name: '氨 (NH₃)', pct: 0.026 },
        { name: '水汽 (H₂O)', pct: 0.0004 },
      ],
    },
    internalStructure: [
      { layer: '雲層大氣', description: '頂部 0–80 km：氨冰雲、氫硫化銨雲、水冰雲三層。' },
      { layer: '分子氫層', description: '從雲層底部至 20 000 km 深，壓力到 100 萬 atm。' },
      { layer: '金屬氫層', description: '20 000–55 000 km；液態金屬氫導電產生強大磁場。' },
      { layer: '核心', description: '可能為「稀釋核心」(diluted core)，富岩石與冰，質量 ~10 地球質量。' },
    ],
    geology: '無固體表面。著名「大紅斑」是反氣旋風暴，已存在至少 350 年。磁場強度為地球 14 倍，磁層延伸至土星軌道。',
    notableFacts: [
      '主要行星帶有 95 顆已知衛星（伽利略四大衛星最為著名）。',
      '一日約 9 小時 56 分，自轉最快的行星，赤道離心率 6.5%。',
      '若質量再大 80 倍即可成為棕矮星。',
    ],
  },

  saturn: {
    classification: '氣態巨行星（環系最壯麗）',
    meanSurfaceTempC: -178,
    surfaceTempRangeC: [-189, -139],
    surfaceGravityMS2: 10.44,
    escapeVelocityKmS: 35.5,
    bulkComposition: [
      { name: '氫 (H₂)', pct: 96.3 },
      { name: '氦 (He)', pct: 3.25 },
      { name: '甲烷、氨', pct: 0.45 },
    ],
    atmosphere: {
      pressureNote: '無固體表面；雲頂風速可達 1 800 km/h',
      composition: [
        { name: '氫 (H₂)', pct: 96.3 },
        { name: '氦 (He)', pct: 3.25 },
        { name: '甲烷 (CH₄)', pct: 0.45 },
        { name: '氨 (NH₃)', pct: 0.0125 },
      ],
    },
    internalStructure: [
      { layer: '分子氫層', description: '雲層至 30 000 km 深處。' },
      { layer: '金屬氫層', description: '較木星淺薄。' },
      { layer: '核心', description: '岩石+冰，質量約 9–22 地球質量；最新分析認為可能為延伸至 60% 半徑的稀釋核心。' },
    ],
    geology: '密度 0.687 g/cm³，是太陽系唯一密度小於水的行星。北極有六邊形噴流，邊長 14 500 km。環系由 99% 水冰粒子構成，厚度僅 10 m–1 km，寬卻達 28 萬 km。',
    notableFacts: [
      '146 顆已知衛星，土衛六（泰坦）有濃厚大氣與液態甲烷湖泊。',
      '土衛二（恩克拉多斯）冰殼下有液態海洋，南極噴泉噴出水蒸氣。',
    ],
  },

  uranus: {
    classification: '冰巨行星',
    meanSurfaceTempC: -224,
    surfaceTempRangeC: [-224, -216],
    surfaceGravityMS2: 8.87,
    escapeVelocityKmS: 21.3,
    bulkComposition: [
      { name: '冰類（H₂O、NH₃、CH₄）', pct: 80 },
      { name: '氫氦氣體外殼', pct: 15 },
      { name: '岩石核心', pct: 5 },
    ],
    atmosphere: {
      pressureNote: '無固體表面；雲頂溫度為太陽系行星最冷',
      composition: [
        { name: '氫 (H₂)', pct: 82.5 },
        { name: '氦 (He)', pct: 15.2 },
        { name: '甲烷 (CH₄)', pct: 2.3 },
      ],
    },
    internalStructure: [
      { layer: '大氣', description: '氫-氦混合氣體，含甲烷使其呈青藍色。' },
      { layer: '冰幔', description: '主要為「熱液態」水、氨、甲烷混合（不是固態冰）；可能存在電離水的怪異物相。' },
      { layer: '岩石核心', description: '矽酸鹽+鐵，質量約 0.55 地球質量。' },
    ],
    geology: '自轉軸傾角 97.77°，幾乎側躺繞日；推測曾被地球大小天體撞擊。每 84 年完成一個軌道，每極連續 42 年日照／42 年黑暗。',
    notableFacts: [
      '27 顆已知衛星，多以莎士比亞與蒲柏的角色命名。',
      '13 條暗淡環，由 1977 年掩星觀測首次發現。',
    ],
  },

  neptune: {
    classification: '冰巨行星',
    meanSurfaceTempC: -218,
    surfaceTempRangeC: [-218, -200],
    surfaceGravityMS2: 11.15,
    escapeVelocityKmS: 23.5,
    bulkComposition: [
      { name: '冰類', pct: 80 },
      { name: '氫氦', pct: 15 },
      { name: '岩石', pct: 5 },
    ],
    atmosphere: {
      pressureNote: '無固體表面；風速可達 2 100 km/h（太陽系最快）',
      composition: [
        { name: '氫 (H₂)', pct: 80 },
        { name: '氦 (He)', pct: 19 },
        { name: '甲烷 (CH₄)', pct: 1.5 },
      ],
    },
    internalStructure: [
      { layer: '大氣', description: '氫-氦含甲烷；深藍色源於甲烷吸收紅光。' },
      { layer: '冰幔', description: '溫熱液態水/氨/甲烷混合，內部熱量 2.6× 接收的太陽能。' },
      { layer: '岩石核心', description: '質量約 1.2 地球質量。' },
    ],
    geology: '內部熱源使其風速比天王星更狂暴。大暗斑（Voyager 2 觀察）為週期性反氣旋風暴。海王星發現於 1846 年，先以萬有引力推算位置再被觀測——數學發現的行星。',
    notableFacts: [
      '14 顆衛星；衛一（崔頓）逆向公轉，可能是被捕獲的古柏帶天體。',
      '一個海王星年 = 165 地球年；自 1846 年發現以來只完成了一個公轉週期（2011 年）。',
    ],
  },

  moon: {
    classification: '地球的天然衛星',
    meanSurfaceTempC: -23,
    surfaceTempRangeC: [-173, 127],
    surfaceGravityMS2: 1.62,
    escapeVelocityKmS: 2.38,
    bulkComposition: [
      { name: '氧 (O)', pct: 43 },
      { name: '矽 (Si)', pct: 21 },
      { name: '鎂 (Mg)', pct: 19 },
      { name: '鐵 (Fe)', pct: 10 },
      { name: '鈣、鋁、其他', pct: 7 },
    ],
    atmosphere: {
      pressureNote: '近乎真空（外逸層粒子數 ~10⁵/cm³）',
      composition: [
        { name: '氦 (He)', pct: 25 },
        { name: '氖 (Ne)', pct: 25 },
        { name: '氫 (H)', pct: 23 },
        { name: '氬 (Ar)', pct: 20 },
        { name: '其他', pct: 7 },
      ],
    },
    internalStructure: [
      { layer: '內核', description: '固態鐵，半徑 ~240 km。' },
      { layer: '外核', description: '液態鐵，厚 ~90 km；磁場早已消失。' },
      { layer: '部分熔融層', description: '厚 ~150 km，月震多源於此。' },
      { layer: '地函', description: '矽酸鹽，富鎂鐵礦物。' },
      { layer: '月殼', description: '正面 ~50 km、背面 ~150 km；不對稱原因尚有爭議。' },
    ],
    geology: '主流形成假說「大撞擊」：早期地球與火星大小天體碰撞，碎片凝聚成月球。表面分為亮高地（斜長岩）與暗月海（玄武岩流）。沒有大氣與水侵蝕，撞擊坑保存完好。',
    notableFacts: [
      '同步自轉：永遠以同一面（正面）對著地球。',
      '每年遠離地球 3.8 cm。',
      '導致地球潮汐並穩定地球自轉軸（沒有月球，地球軸傾角會混沌變化）。',
    ],
  },
};
