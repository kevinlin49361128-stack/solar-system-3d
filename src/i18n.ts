/**
 * Lightweight i18n: stores translations for UI chrome (buttons, labels,
 * panel headers). Body / star / site descriptions remain in their
 * authored Chinese — translating those is out of scope for v1.
 */

export type Lang = 'zh-Hant' | 'en' | 'ja';

/**
 * Multilingual text: either a plain string (single language only) or an
 * object whose keys are language codes.
 */
export type LangText = string | Partial<Record<Lang, string>>;

export function langPick(text: LangText | undefined | null): string {
  if (text == null) return '';
  if (typeof text === 'string') return text;
  return text[currentLang] ?? text['zh-Hant'] ?? text['en'] ?? text['ja'] ?? '';
}

/** Pick best body name for current language: nameJa > name (zh) for ja; nameEn for en; name for zh. */
export function bodyName(b: { name: string; nameEn: string; nameJa?: string }): string {
  switch (currentLang) {
    case 'en': return b.nameEn || b.name;
    case 'ja': return b.nameJa || b.name; // fallback to Chinese (kanji often readable)
    default: return b.name;
  }
}

/** For NamedStar / similar with explicit Japanese field. */
export function maybeJa(zh: string, ja?: string): string {
  if (currentLang === 'ja' && ja) return ja;
  if (currentLang === 'en') return zh; // English usually overridden by nameEn
  return zh;
}

const TRANSLATIONS: Record<string, Record<Lang, string>> = {
  // Top time controls
  'time.pause': { 'zh-Hant': '暫停/播放', 'en': 'Pause/Play', 'ja': '一時停止/再生' },
  'time.reverse': { 'zh-Hant': '倒轉', 'en': 'Reverse', 'ja': '逆転' },
  'time.now': { 'zh-Hant': '現在', 'en': 'Now', 'ja': '現在' },
  'time.scrubber': { 'zh-Hant': '拖曳掃過 ±1 年（雙擊歸零）', 'en': 'Drag through ±1 year (dbl-click to reset)', 'ja': '±1年をドラッグ（ダブルクリックでリセット）' },
  'speed.realtime': { 'zh-Hant': '1×（即時）', 'en': '1× (real-time)', 'ja': '1×（実時間）' },
  'speed.hourPerSec': { 'zh-Hant': '1 小時/秒', 'en': '1 hour/sec', 'ja': '1時間/秒' },
  'speed.dayPerSec': { 'zh-Hant': '1 天/秒', 'en': '1 day/sec', 'ja': '1日/秒' },
  'speed.weekPerSec': { 'zh-Hant': '1 週/秒', 'en': '1 week/sec', 'ja': '1週/秒' },
  'speed.monthPerSec': { 'zh-Hant': '1 月/秒', 'en': '1 month/sec', 'ja': '1ヶ月/秒' },
  'speed.yearPerSec': { 'zh-Hant': '1 年/秒', 'en': '1 year/sec', 'ja': '1年/秒' },

  // Left panel tab bar — top-level grouping
  'tab.scene': { 'zh-Hant': '🌍 場景', 'en': '🌍 Scene', 'ja': '🌍 シーン' },
  'tab.display': { 'zh-Hant': '👁️ 顯示', 'en': '👁️ Display', 'ja': '👁️ 表示' },
  'tab.realism': { 'zh-Hant': '🌌 寫實', 'en': '🌌 Realism', 'ja': '🌌 リアル' },
  'tab.observe': { 'zh-Hant': '🔭 觀測', 'en': '🔭 Observe', 'ja': '🔭 観測' },
  'tab.advanced': { 'zh-Hant': '⚙️ 進階', 'en': '⚙️ Advanced', 'ja': '⚙️ 詳細' },

  // Left panel sections
  'left.cameraMode': { 'zh-Hant': '鏡頭模式', 'en': 'Camera Mode', 'ja': 'カメラモード' },
  'left.followBody': { 'zh-Hant': '跟隨天體', 'en': 'Follow Body', 'ja': '追跡天体' },
  'left.scaleMode': { 'zh-Hant': '尺度模式', 'en': 'Scale Mode', 'ja': 'スケール' },
  'left.display': { 'zh-Hant': '顯示', 'en': 'Display', 'ja': '表示' },
  'left.realism': { 'zh-Hant': '寫實 / 視覺', 'en': 'Realism / Visual', 'ja': 'リアル / 視覚' },
  'realism.preset.stylized': { 'zh-Hant': '示意', 'en': 'Stylised', 'ja': '示意的' },
  'realism.preset.balanced': { 'zh-Hant': '平衡', 'en': 'Balanced', 'ja': 'バランス' },
  'realism.preset.realistic': { 'zh-Hant': '寫實', 'en': 'Realistic', 'ja': 'リアル' },
  'realism.physicsHeader': { 'zh-Hant': '寫實計算（影響亮度 / 可見性）', 'en': 'Physics corrections (brightness / visibility)', 'ja': '物理補正（輝度 / 可視性）' },
  'realism.vfxHeader': { 'zh-Hant': '視覺層（疊加光景）', 'en': 'Visual layers (additive)', 'ja': '視覚レイヤー（追加表示）' },
  'realism.extinction': { 'zh-Hant': '大氣消光（低空變暗）', 'en': 'Atmospheric extinction', 'ja': '大気減光（低空で暗化）' },
  'realism.moonGlow': { 'zh-Hant': '月光增亮天空', 'en': 'Moonlight sky brightening', 'ja': '月光による天空輝度' },
  'realism.bvColor': { 'zh-Hant': '恆星 B-V 真實色', 'en': 'Realistic star B-V colour', 'ja': '恒星 B-V 実色' },
  'realism.satShadow': { 'zh-Hant': '衛星地影過濾', 'en': 'Filter satellites in Earth shadow', 'ja': '衛星の地影フィルタ' },
  'realism.dsoRealSize': { 'zh-Hant': 'DSO 真實角直徑', 'en': 'Real DSO angular size', 'ja': 'DSO 実角直径' },
  'realism.milkyway': { 'zh-Hant': '銀河帶', 'en': 'Milky Way', 'ja': '天の川' },
  'realism.beltOfVenus': { 'zh-Hant': '暮光反日點 (Belt of Venus)', 'en': 'Belt of Venus / Earth shadow', 'ja': 'ヴィーナスの帯 / 地球影' },
  'realism.zodiacal': { 'zh-Hant': '黃道光', 'en': 'Zodiacal light', 'ja': '黄道光' },
  'realism.airglow': { 'zh-Hant': '氣輝 + 光害方向', 'en': 'Airglow + light pollution dome', 'ja': '大気光 + 光害ドーム' },
  'realism.meteors': { 'zh-Hant': '流星雨（依已知 shower）', 'en': 'Meteor showers (known showers)', 'ja': '流星群（既知のもの）' },
  'left.events': { 'zh-Hant': '天文事件', 'en': 'Astro Events', 'ja': '天文イベント' },
  'nbody.yoshida4': { 'zh-Hant': 'Yoshida 4 階積分', 'en': 'Yoshida 4th-order integrator', 'ja': '吉田4次積分' },
  'nbody.relativistic': { 'zh-Hant': '廣義相對論修正（水星進動）', 'en': 'GR correction (Mercury precession)', 'ja': '一般相対論補正（水星近日点移動）' },
  'info.goto': { 'zh-Hant': '🔭 鏡頭對準', 'en': '🔭 Aim camera', 'ja': '🔭 カメラを向ける' },
  'info.track': { 'zh-Hant': '📌', 'en': '📌', 'ja': '📌' },
  'info.bookmark': { 'zh-Hant': '⭐', 'en': '⭐', 'ja': '⭐' },
  'left.external': { 'zh-Hant': '外部整合', 'en': 'External', 'ja': '外部連携' },
  'left.bookmarks': { 'zh-Hant': '⭐ 書籤', 'en': '⭐ Bookmarks', 'ja': '⭐ ブックマーク' },
  'bookmark.empty': { 'zh-Hant': '點 ⭐ 將目前選取天體 + 時刻加入書籤，下次一鍵跳回。', 'en': 'Click ⭐ on a body card to bookmark this object + JD. Click here later to jump back.', 'ja': '天体カードの ⭐ を押すとブックマーク、次回はワンクリックで再現。' },
  'external.horizonsLabel': { 'zh-Hant': 'JPL Horizons 軌道', 'en': 'JPL Horizons orbit', 'ja': 'JPL Horizons 軌道' },
  'external.horizonsLoad': { 'zh-Hant': '載入', 'en': 'Load', 'ja': '読込' },
  'external.telescopeLabel': { 'zh-Hant': 'Stellarium 望遠鏡 (WebSocket)', 'en': 'Stellarium telescope (WS)', 'ja': 'Stellarium 望遠鏡 (WS)' },
  'external.telescopeConnect': { 'zh-Hant': '連接', 'en': 'Connect', 'ja': '接続' },
  'external.telescopeDisconnect': { 'zh-Hant': '中斷', 'en': 'Disconnect', 'ja': '切断' },
  'atmo.pressure': { 'zh-Hant': '氣壓 (mbar)', 'en': 'Pressure (mbar)', 'ja': '気圧 (mbar)' },
  'atmo.temperature': { 'zh-Hant': '氣溫 (°C)', 'en': 'Temperature (°C)', 'ja': '気温 (°C)' },
  'left.calcMode': { 'zh-Hant': '計算模式', 'en': 'Calc Mode', 'ja': '計算モード' },
  'left.physicsModel': { 'zh-Hant': '物理模型', 'en': 'Physics Model', 'ja': '物理モデル' },
  'left.observation': { 'zh-Hant': '地表觀測', 'en': 'Surface Observation', 'ja': '地表観測' },
  'left.language': { 'zh-Hant': '語言', 'en': 'Language', 'ja': '言語' },

  // Camera modes
  'camera.free': { 'zh-Hant': '自由飛行', 'en': 'Free Flight', 'ja': '自由飛行' },
  'camera.top': { 'zh-Hant': '俯視黃道面', 'en': 'Top Down', 'ja': '黄道面俯瞰' },
  'camera.follow': { 'zh-Hant': '跟隨選定天體', 'en': 'Follow Selected', 'ja': '天体追跡' },

  // Scale modes
  'scale.schematic': { 'zh-Hant': '示意', 'en': 'Schematic', 'ja': '模式' },
  'scale.log': { 'zh-Hant': '對數', 'en': 'Log', 'ja': '対数' },
  'scale.real': { 'zh-Hant': '真實', 'en': 'Real', 'ja': '実寸' },

  // Display toggles
  'display.orbits': { 'zh-Hant': '軌道線', 'en': 'Orbits', 'ja': '軌道線' },
  'display.cometOrbits': { 'zh-Hant': '彗星 / 小行星軌道', 'en': 'Comet / asteroid orbits', 'ja': '彗星 / 小惑星の軌道' },
  'display.labels': { 'zh-Hant': '名稱標籤', 'en': 'Labels', 'ja': 'ラベル' },
  'display.belts': { 'zh-Hant': '小行星帶', 'en': 'Belts', 'ja': '小惑星帯' },
  'display.constellations': { 'zh-Hant': '星座連線', 'en': 'Constellations', 'ja': '星座線' },
  'display.spacecraft': { 'zh-Hant': '太空船軌跡', 'en': 'Spacecraft', 'ja': '探査機軌道' },
  'display.lagrange': { 'zh-Hant': '拉格朗日點 L1–L5', 'en': 'Lagrange points L1–L5', 'ja': 'ラグランジュ点 L1–L5' },
  'display.starLabels': { 'zh-Hant': '恆星名稱', 'en': 'Star names', 'ja': '恒星名' },
  'display.messier': { 'zh-Hant': '深空天體 (Messier)', 'en': 'Deep-sky (Messier)', 'ja': '深宇宙天体 (Messier)' },
  'display.dsoStylized': { 'zh-Hant': '程序化星雲圖示（關閉=寫實昏暗）', 'en': 'Stylised DSO icons (off = realistic faint)', 'ja': 'DSO スタイライズ（OFF=リアル微弱）' },
  'display.iauBounds': { 'zh-Hant': 'IAU 88 星座邊界', 'en': 'IAU 88 boundaries', 'ja': 'IAU 88 星座境界' },
  'display.gridsLabel': { 'zh-Hant': '天球格線', 'en': 'Celestial grids', 'ja': '天球グリッド' },
  'display.gridEquatorial': { 'zh-Hant': '赤道網（RA/Dec）', 'en': 'Equatorial (RA/Dec)', 'ja': '赤道座標' },
  'display.gridEcliptic': { 'zh-Hant': '黃道網', 'en': 'Ecliptic', 'ja': '黄道座標' },
  'display.gridGalactic': { 'zh-Hant': '銀道網', 'en': 'Galactic', 'ja': '銀河座標' },
  'display.gridHorizontal': { 'zh-Hant': '地平網（觀測模式）', 'en': 'Horizontal (observer mode)', 'ja': '地平座標（観測モード）' },
  'display.fovRings': { 'zh-Hant': 'Telrad 視野圈 (0.5°/2°/4°)', 'en': 'Telrad finder rings (0.5°/2°/4°)', 'ja': 'Telrad ファインダー (0.5°/2°/4°)' },
  'display.fovReadout': { 'zh-Hant': '視場資訊（FOV / 倍率 / 等效焦距）', 'en': 'FOV readout (FOV / magnification / equiv. focal length)', 'ja': '視野情報（FOV / 倍率 / 等価焦点距離）' },
  'display.lunarMansions': { 'zh-Hant': '中華二十八宿', 'en': 'Chinese 28 lunar mansions', 'ja': '中国二十八宿' },
  'display.satellites': { 'zh-Hant': '近地衛星 (ISS等)', 'en': 'LEO satellites (ISS, etc.)', 'ja': '地球周回衛星 (ISS等)' },

  // Reference frame (heliocentric / geocentric)
  'left.frame': { 'zh-Hant': '參考系', 'en': 'Reference frame', 'ja': '基準系' },
  'frame.helio': { 'zh-Hant': '☀️ 日心', 'en': '☀️ Heliocentric', 'ja': '☀️ 太陽中心' },
  'frame.geo': { 'zh-Hant': '🌍 地心 (天動說)', 'en': '🌍 Geocentric (Ptolemaic)', 'ja': '🌍 地球中心（天動説）' },

  // Optics / telescope
  'left.optics': { 'zh-Hant': '光學工具', 'en': 'Optics', 'ja': '光学機器' },
  'optics.naked': { 'zh-Hant': '裸眼 (~50°)', 'en': 'Naked eye (~50°)', 'ja': '裸眼 (~50°)' },
  'optics.bin7': { 'zh-Hant': '7×50 雙筒 (7.5°)', 'en': '7×50 binoculars (7.5°)', 'ja': '7×50 双眼鏡 (7.5°)' },
  'optics.bin10': { 'zh-Hant': '10×50 雙筒 (5°)', 'en': '10×50 binoculars (5°)', 'ja': '10×50 双眼鏡 (5°)' },
  'optics.refractor80': { 'zh-Hant': '80mm 折射 + 25mm 目鏡 (1.56°)', 'en': '80mm refractor + 25mm eyepiece (1.56°)', 'ja': '80mm屈折 + 25mm接眼 (1.56°)' },
  'optics.sct8_25': { 'zh-Hant': '8" SCT + 25mm 目鏡 (0.63°)', 'en': '8" SCT + 25mm eyepiece (0.63°)', 'ja': '8" SCT + 25mm接眼 (0.63°)' },
  'optics.sct8_10': { 'zh-Hant': '8" SCT + 10mm 目鏡 (0.25°)', 'en': '8" SCT + 10mm eyepiece (0.25°)', 'ja': '8" SCT + 10mm接眼 (0.25°)' },
  'optics.fov': { 'zh-Hant': '視場', 'en': 'FOV', 'ja': '視野' },
  'optics.mag': { 'zh-Hant': '放大', 'en': 'Magnification', 'ja': '倍率' },
  'optics.magLimit': { 'zh-Hant': '極限星等', 'en': 'Limiting mag', 'ja': '極限等級' },
  'optics.bortle': { 'zh-Hant': '光害 (Bortle)', 'en': 'Light pollution (Bortle)', 'ja': '光害 (Bortle)' },
  'optics.bortle.1': { 'zh-Hant': '原野黑', 'en': 'Pristine', 'ja': '原野' },
  'optics.bortle.2': { 'zh-Hant': '真黑', 'en': 'Truly dark', 'ja': '真の暗闇' },
  'optics.bortle.3': { 'zh-Hant': '田野', 'en': 'Rural', 'ja': '田舎' },
  'optics.bortle.4': { 'zh-Hant': '郊區', 'en': 'Rural/suburb', 'ja': '郊外' },
  'optics.bortle.5': { 'zh-Hant': '亮郊區', 'en': 'Bright suburb', 'ja': '明るい郊外' },
  'optics.bortle.6': { 'zh-Hant': '亮郊區/小鎮', 'en': 'Bright suburb/town', 'ja': '明るい郊外/小都市' },
  'optics.bortle.7': { 'zh-Hant': '城郊', 'en': 'Suburb/urban', 'ja': '都市部' },
  'optics.bortle.8': { 'zh-Hant': '城市', 'en': 'City', 'ja': '都市' },
  'optics.bortle.9': { 'zh-Hant': '市中心', 'en': 'Inner city', 'ja': '都心' },

  // Panels
  'sky.title': { 'zh-Hant': '天空中的天體', 'en': 'Sky Objects', 'ja': '空の天体' },
  'sky.solarSystem': { 'zh-Hant': '太陽系天體', 'en': 'Solar System', 'ja': '太陽系天体' },
  'sky.stars': { 'zh-Hant': '恆星', 'en': 'Stars', 'ja': '恒星' },
  'sky.tonight': { 'zh-Hant': '今晚 (本地時)', 'en': 'Tonight (local)', 'ja': '今夜（現地時）' },

  'left.longExposure':       { 'zh-Hant': '📸 長時間曝光', 'en': '📸 Long Exposure', 'ja': '📸 長時間露光' },
  'longExposure.enable':     { 'zh-Hant': '啟用累積曝光', 'en': 'Enable accumulating exposure', 'ja': '累積露光を有効化' },
  'longExposure.decayLabel': { 'zh-Hant': '衰減（每幀 ×）', 'en': 'Decay (per frame ×)', 'ja': '減衰（フレームごと ×）' },
  'longExposure.reset':      { 'zh-Hant': '🔄 重置累積', 'en': '🔄 Reset accumulator', 'ja': '🔄 累積リセット' },
  'longExposure.hint':       { 'zh-Hant': '配合 📌 鎖定可拍出星空長尾跡。加快時間倍率 + 衰減 = 1.0 → 純粹星跡。鎖定行星 → 行星不動，背景拖尾。',
                                'en': 'Combine with 📌 lock for star trails. Faster time speed + decay 1.0 → pure trails. Lock a planet → planet still, background streaks.',
                                'ja': '📌ロックと組み合わせると星の軌跡が撮れる。時間倍率を上げ、減衰=1.0で純粋な軌跡。惑星をロック→惑星は静止、背景が流れる。' },
  'sky.altAzNote': { 'zh-Hant': '仰角 / 方位角（北 0°、東 90°）', 'en': 'Altitude / Azimuth (N=0°, E=90°)', 'ja': '高度 / 方位角（北=0°、東=90°）' },
  'calc.title': { 'zh-Hant': '計算模式 · 相對量', 'en': 'Calc Mode · Relative', 'ja': '計算モード · 相対量' },
  'calc.reference': { 'zh-Hant': '參考點', 'en': 'Reference', 'ja': '基準点' },
  'calc.bodyHeader': { 'zh-Hant': '天體', 'en': 'Body', 'ja': '天体' },
  'calc.distance': { 'zh-Hant': '距離 (AU)', 'en': 'Distance (AU)', 'ja': '距離 (AU)' },
  'calc.relV': { 'zh-Hant': '相對 v', 'en': 'Rel v', 'ja': '相対 v' },
  'calc.losV': { 'zh-Hant': '視線 v', 'en': 'LOS v', 'ja': '視線 v' },
  'calc.losNote': { 'zh-Hant': '視線 v：+ = 遠離參考點，- = 接近', 'en': 'LOS v: + = receding, - = approaching', 'ja': '視線 v：+ = 遠離、- = 接近' },
  'calc.enable': { 'zh-Hant': '啟用相對量計算', 'en': 'Enable Calc Mode', 'ja': '計算モードを有効に' },
  'calc.disable': { 'zh-Hant': '關閉計算模式', 'en': 'Disable Calc Mode', 'ja': '計算モードを無効に' },
  'calc.showVectors': { 'zh-Hant': '場景中顯示向量', 'en': 'Show vectors in scene', 'ja': 'シーン内にベクトル表示' },

  // Observer
  'observer.preset': { 'zh-Hant': '— 選擇地點 —', 'en': '— Pick a location —', 'ja': '— 場所を選択 —' },
  'observer.cities': { 'zh-Hant': '城市', 'en': 'Cities', 'ja': '都市' },
  'observer.observatories': { 'zh-Hant': '歷史 / 著名天文台', 'en': 'Famous Observatories', 'ja': '有名な天文台' },
  'observer.lat': { 'zh-Hant': '緯度', 'en': 'Lat', 'ja': '緯度' },
  'observer.lon': { 'zh-Hant': '經度', 'en': 'Lon', 'ja': '経度' },
  'observer.elev': { 'zh-Hant': '海拔', 'en': 'Elev', 'ja': '海抜' },
  'observer.elevPh': { 'zh-Hant': '海拔 m', 'en': 'Elev m', 'ja': '海抜 m' },
  'observer.enter': { 'zh-Hant': '進入觀測', 'en': 'Enter Observation', 'ja': '観測モード開始' },
  'observer.exit': { 'zh-Hant': '離開觀測', 'en': 'Exit Observation', 'ja': '観測モード終了' },
  'observer.lockHorizon': { 'zh-Hant': '鎖定地平線以上', 'en': 'Lock above horizon', 'ja': '地平線以上に固定' },
  'observer.gps': { 'zh-Hant': '📡 目前位置', 'en': '📡 Current location', 'ja': '📡 現在位置' },
  'observer.mapPick': { 'zh-Hant': '📍 地圖選點', 'en': '📍 Pick on map', 'ja': '📍 地図で選ぶ' },
  'observer.gyroOn': { 'zh-Hant': '🧭 啟用陀螺儀 (AR)', 'en': '🧭 Enable gyroscope (AR)', 'ja': '🧭 ジャイロを有効に (AR)' },
  'observer.gyroOff': { 'zh-Hant': '🧭 陀螺儀已啟用，點此關閉', 'en': '🧭 Gyroscope ON, click to disable', 'ja': '🧭 ジャイロON、クリックで無効' },
  'observer.gyroCalibrate': { 'zh-Hant': '校準正北', 'en': 'Calibrate north', 'ja': '北を校正' },
  'gps.fetching': { 'zh-Hant': '取得位置中…', 'en': 'Locating…', 'ja': '位置取得中…' },
  'gps.unsupported': { 'zh-Hant': '此瀏覽器不支援定位', 'en': 'Geolocation not supported', 'ja': 'このブラウザは位置情報非対応' },
  'gps.denied': { 'zh-Hant': '使用者拒絕了定位授權', 'en': 'Permission denied', 'ja': '位置情報の許可が拒否されました' },
  'gps.unavailable': { 'zh-Hant': '無法取得位置（網路或硬體問題）', 'en': 'Position unavailable (network/hardware)', 'ja': '位置を取得できません' },
  'gps.timeout': { 'zh-Hant': '取得位置逾時', 'en': 'Geolocation timed out', 'ja': '位置取得タイムアウト' },

  // N-body
  'nbody.toKepler': { 'zh-Hant': '切回 Kepler 解析', 'en': 'Switch to Kepler', 'ja': 'Kepler解析に戻す' },
  'nbody.toNbody': { 'zh-Hant': '切到 N-body 重力', 'en': 'Switch to N-body', 'ja': 'N体重力に切替' },

  // Events
  'events.historicalSelect': { 'zh-Hant': '— 歷史 / 預期事件 —', 'en': '— Historical / Future events —', 'ja': '— 歴史/今後のイベント —' },
  'events.autoScan': { 'zh-Hant': '自動偵測未來 2 年事件', 'en': 'Auto-scan next 2 years', 'ja': '今後2年を自動検出' },
  'events.title': { 'zh-Hant': '未來事件（自動偵測）', 'en': 'Upcoming Events (auto)', 'ja': '今後のイベント（自動）' },
  'events.rescan': { 'zh-Hant': '重掃', 'en': 'Rescan', 'ja': '再スキャン' },
  'events.tapNote': { 'zh-Hant': '點選跳轉時間 / 自動跟隨', 'en': 'Tap to jump time / auto-follow', 'ja': 'タップで時刻ジャンプ' },

  // Hint
  'hint.usage': { 'zh-Hant': '滑鼠左鍵旋轉、滾輪縮放、右鍵平移 · 點選天體查看資訊 · ⌘/Ctrl+F 搜尋', 'en': 'LMB rotate · Wheel zoom · RMB pan · Click body for info · ⌘/Ctrl+F to search', 'ja': '左ドラッグ回転・ホイール拡縮・右パン・天体クリックで情報・⌘/Ctrl+F 検索' },

  // Search
  'search.placeholder': { 'zh-Hant': '搜尋天體、恆星、觀測站、星座...', 'en': 'Search bodies, stars, sites, constellations...', 'ja': '天体・恒星・観測点・星座を検索...' },
  'search.usage': { 'zh-Hant': '↑↓ 選擇 · Enter 跳轉 · Esc 取消', 'en': '↑↓ select · Enter go · Esc cancel', 'ja': '↑↓ 選択 · Enter 決定 · Esc キャンセル' },
  'search.kind.body': { 'zh-Hant': '天體', 'en': 'Body', 'ja': '天体' },
  'search.kind.star': { 'zh-Hant': '恆星', 'en': 'Star', 'ja': '恒星' },
  'search.kind.site': { 'zh-Hant': '觀測點', 'en': 'Site', 'ja': '観測点' },
  'search.kind.constellation': { 'zh-Hant': '星座', 'en': 'Constellation', 'ja': '星座' },
  'search.noResults': { 'zh-Hant': '無相符結果', 'en': 'No results', 'ja': '該当なし' },

  // Toast / share
  'toast.shareCopied': { 'zh-Hant': '分享連結已複製到剪貼簿', 'en': 'Share link copied', 'ja': '共有リンクをコピーしました' },
  'toast.gyroDenied': { 'zh-Hant': '陀螺儀授權被拒絕', 'en': 'Gyroscope permission denied', 'ja': 'ジャイロの許可が拒否されました' },
  'toast.gyroUnsupported': { 'zh-Hant': '此裝置不支援陀螺儀', 'en': 'Gyroscope not supported', 'ja': 'この端末はジャイロ非対応' },
  'toast.terrainFailed': { 'zh-Hant': '地形 / 衛星影像載入失敗，使用程序化代用地形', 'en': 'Terrain / imagery load failed; using procedural fallback', 'ja': '地形 / 衛星画像の読み込みに失敗、代替地形を使用' },
  'toast.iauFailed': { 'zh-Hant': 'IAU 88 星座邊界載入失敗，圖層不可用', 'en': 'IAU 88 boundary load failed', 'ja': 'IAU 88 境界の読み込みに失敗' },
  'toast.bscFailed': { 'zh-Hant': 'Yale 亮星表載入失敗，僅顯示 67 顆名星', 'en': 'BSC catalogue load failed; showing 67 named stars only', 'ja': 'Yale輝星目録の読み込みに失敗、67恒星のみ表示' },

  // Tooltip / aria
  'btn.screenshot': { 'zh-Hant': '儲存當前畫面為 PNG', 'en': 'Save current frame as PNG', 'ja': '現在の画面をPNG保存' },
  'btn.share': { 'zh-Hant': '複製分享連結（包含目前視角與時間）', 'en': 'Copy share link (current view + time)', 'ja': '共有リンクをコピー' },
  'btn.dblClickCenter': { 'zh-Hant': '雙擊置中', 'en': 'Double-click to centre', 'ja': 'ダブルクリックで中央に' },

  // Onboarding tour (5 steps)
  'tour.skip': { 'zh-Hant': '跳過', 'en': 'Skip', 'ja': 'スキップ' },
  'tour.prev': { 'zh-Hant': '上一步', 'en': 'Back', 'ja': '戻る' },
  'tour.next': { 'zh-Hant': '下一步', 'en': 'Next', 'ja': '次へ' },
  'tour.done': { 'zh-Hant': '完成', 'en': 'Done', 'ja': '完了' },
  'tour.replay': { 'zh-Hant': '❓ 重看導覽', 'en': '❓ Replay tour', 'ja': '❓ ガイドを再生' },
  'tour.replayHint': {
    'zh-Hant': '5 步快速導覽：時間 / 視角 / 點選 / 事件偵測。',
    'en': '5-step tour: time, view modes, clicking, event detection.',
    'ja': '5ステップガイド：時間 / 視点 / クリック / イベント検出。',
  },
  'left.help': { 'zh-Hant': '說明', 'en': 'Help', 'ja': 'ヘルプ' },

  // Precision info modal
  'precision.button': { 'zh-Hant': 'ⓘ 模型精度與限制', 'en': 'ⓘ Model accuracy & limits', 'ja': 'ⓘ モデル精度と制約' },
  'precision.title': { 'zh-Hant': '模型精度與限制', 'en': 'Model accuracy & limits', 'ja': 'モデル精度と制約' },
  'precision.intro': {
    'zh-Hant': '本專案的核心定位是「可解釋的天文模擬器」 — 每個顯示的數字都該可以追溯到使用的模型與其精度。下表列出每個物理模組的來源、誤差範圍與適用區間。',
    'en': 'This project aims to be an *explainable* astronomy simulator — every number you see should be traceable to its source model and accuracy. The table below lists the model, error range, and validity range for each physics module.',
    'ja': 'このプロジェクトの位置づけは「説明可能な天文シミュレーター」 — 表示される全ての数値はモデルと精度に追跡可能。以下に各物理モジュールのソース・誤差範囲・適用範囲を記載。',
  },
  'precision.footer': {
    'zh-Hant': '若需要更高精度（例如歷史日食、星載觀測規劃），建議比對 NASA Horizons 或 SOFA 標準軟體的結果。本模擬器以「使用者能理解模型限制」為目標。',
    'en': 'For higher precision (historical eclipses, spaceborne observations, etc.), cross-check against NASA Horizons or SOFA standard software. This simulator targets "users can understand the model limits".',
    'ja': '高精度が必要な場合（歴史日食、宇宙観測計画など）はNASA HorizonsやSOFA標準ソフトウェアと照合を。本シミュレーターは「ユーザーがモデル制約を理解できる」ことを目標とする。',
  },
  'precision.source': { 'zh-Hant': '來源', 'en': 'Source', 'ja': 'ソース' },
  'precision.accuracy': { 'zh-Hant': '精度', 'en': 'Accuracy', 'ja': '精度' },
  'precision.validRange': { 'zh-Hant': '適用範圍', 'en': 'Valid range', 'ja': '適用範囲' },
  'precision.notIncluded': { 'zh-Hant': '未包含', 'en': 'Not included', 'ja': '含まれない項目' },

  // Observation log
  'obslog.open': { 'zh-Hant': '📔 我的觀測', 'en': '📔 My observations', 'ja': '📔 観測ログ' },
  'obslog.title': { 'zh-Hant': '📔 我的觀測', 'en': '📔 MY OBSERVATIONS', 'ja': '📔 観測ログ' },
  'obslog.total': { 'zh-Hant': '總共', 'en': 'Total', 'ja': '合計' },
  'obslog.empty': {
    'zh-Hant': '尚無觀測紀錄。在任一目標的資訊面板裡點「☐ 標記為已觀測」即可開始累積。',
    'en': 'No entries yet. Click "☐ Mark observed" in any target\'s info panel to start logging.',
    'ja': '記録なし。任意の対象の情報パネルで「☐ 観測済みとマーク」をクリック。',
  },
  'obslog.export': { 'zh-Hant': '💾 匯出', 'en': '💾 Export', 'ja': '💾 エクスポート' },
  'obslog.import': { 'zh-Hant': '📂 匯入', 'en': '📂 Import', 'ja': '📂 インポート' },
  'obslog.clear': { 'zh-Hant': '🗑️', 'en': '🗑️', 'ja': '🗑️' },
  'obslog.tapHint': { 'zh-Hant': '點任一項即跳轉鏡頭 + 編輯筆記', 'en': 'Tap any row → aim camera + edit notes', 'ja': 'タップで視点ジャンプ + メモ編集' },
  'obslog.importConfirm': {
    'zh-Hant': '匯入會覆蓋現有紀錄，確定？',
    'en': 'Import will overwrite the current log. Continue?',
    'ja': 'インポートは現在の記録を上書きします。続行?',
  },
  'obslog.clearConfirm': {
    'zh-Hant': '確定要清空所有觀測紀錄？此操作無法復原。',
    'en': 'Clear ALL observation entries? This cannot be undone.',
    'ja': 'すべての観測記録を削除しますか？元に戻せません。',
  },

  // Tonight planner
  'tonight.open': { 'zh-Hant': '🌟 今晚看什麼', 'en': '🌟 Tonight\'s plan', 'ja': '🌟 今夜の観測候補' },
  'tonight.title': { 'zh-Hant': '🌟 今晚看什麼', 'en': '🌟 TONIGHT\'S PLAN', 'ja': '🌟 今夜の観測候補' },
  'tonight.refresh': { 'zh-Hant': '重新計算', 'en': 'Refresh', 'ja': '再計算' },
  'tonight.tapHint': { 'zh-Hant': '點選即跳轉鏡頭 + 開啟資訊面板', 'en': 'Tap any row → aim camera + open info panel', 'ja': 'タップで視点ジャンプ + 情報パネル表示' },
  'tonight.observerOnly': { 'zh-Hant': '請先進入觀測模式', 'en': 'Enter observer mode first', 'ja': '先に観測モードに入ってください' },
  'tonight.empty': { 'zh-Hant': '目前無適合觀測的目標（檢查時間 / 位置 / Bortle）', 'en': 'No suitable targets right now (check time / location / Bortle)', 'ja': '現在は適切な対象なし（時刻 / 位置 / Bortleを確認）' },
  'tonight.summary': { 'zh-Hant': '推薦', 'en': 'Recommended', 'ja': '推奨' },
  'tonight.targets': { 'zh-Hant': '個目標', 'en': 'targets', 'ja': '個' },
  'tonight.moonPhase': { 'zh-Hant': '月相', 'en': 'moon phase', 'ja': '月相' },
  'tonight.section.planets': { 'zh-Hant': '行星 / 月球', 'en': 'Planets / Moon', 'ja': '惑星 / 月' },
  'tonight.section.messier': { 'zh-Hant': 'Messier 深空天體', 'en': 'Messier DSOs', 'ja': 'Messier天体' },
  'tonight.section.stars': { 'zh-Hant': '亮星（mag < 2.5）', 'en': 'Bright stars (mag < 2.5)', 'ja': '明るい恒星（mag < 2.5）' },

  // N-body diagnostics
  'diag.title': { 'zh-Hant': '守恆診斷', 'en': 'Conservation diagnostics', 'ja': '保存則診断' },
  'diag.idle': { 'zh-Hant': 'N-body 未啟用', 'en': 'N-body not active', 'ja': 'N-body 無効' },
  'diag.integrator': { 'zh-Hant': '積分器', 'en': 'Integrator', 'ja': '積分法' },
  'diag.resetBaseline': { 'zh-Hant': '重設基準', 'en': 'Reset baseline', 'ja': '基準を再設定' },

  'tour.welcome.title': {
    'zh-Hant': '歡迎使用太陽系模擬',
    'en': 'Welcome to Solar System 3D',
    'ja': '太陽系シミュレーターへようこそ',
  },
  'tour.welcome.body': {
    'zh-Hant': '互動式 3D 太陽系 + 從地球任一點仰望天空的雙視角模擬器。5 個重點，30 秒上手。',
    'en': 'Interactive 3D solar system + ground-based stargazing from any point on Earth. 5 quick steps to get you oriented.',
    'ja': 'インタラクティブな3D太陽系 + 地表観測の二重視点シミュレーター。5ステップで30秒理解。',
  },
  'tour.time.title': {
    'zh-Hant': '時間是核心',
    'en': 'Time is everything',
    'ja': '時間がすべて',
  },
  'tour.time.body': {
    'zh-Hant': '暫停 / 倒轉 / 加速到 1 年/秒，或跳到任意日期。右側時間軸可掃過 ±1 年看行星位置變化。',
    'en': 'Pause, reverse, or accelerate up to 1 year/sec. Jump to any date. Drag the right scrubber to sweep ±1 year and watch planets move.',
    'ja': '一時停止・逆転・最大1年/秒。任意の日付にジャンプ。右のスクラバーで±1年をスイープ。',
  },
  'tour.viewmode.title': {
    'zh-Hant': '三種視角',
    'en': 'Three view modes',
    'ja': '3つの視点',
  },
  'tour.viewmode.body': {
    'zh-Hant': '自由飛行（太陽系外）→ 跟隨某顆行星 → 從地球任一點仰望天空。下拉切換，每種模式都有專屬控制。',
    'en': 'Free-fly outside the system → follow a planet → stand on Earth and look up. Switch via the dropdown — each mode has its own controls.',
    'ja': '自由飛行（太陽系外）→ 惑星追従 → 地球上から空を見上げる。プルダウンで切り替え。',
  },
  'tour.click.title': {
    'zh-Hant': '點選看資料',
    'en': 'Click anything',
    'ja': 'クリックで詳細',
  },
  'tour.click.body': {
    'zh-Hant': '滑鼠左鍵點任何行星、衛星、恆星、太空船 → 右側顯示半徑、軌道、即時方位仰角（DMS 精度）。',
    'en': 'Left-click any planet, moon, star, or spacecraft → right panel shows radius, orbit, real-time alt/az (DMS precision).',
    'ja': '惑星・衛星・恒星・宇宙船を左クリック → 半径・軌道・方位仰角（DMS精度）を右側に表示。',
  },
  'tour.events.title': {
    'zh-Hant': '自動偵測天文事件',
    'en': 'Auto-detect events',
    'ja': '天文イベント自動検出',
  },
  'tour.events.body': {
    'zh-Hant': '「進階」分頁裡的這顆按鈕掃描未來 2 年的食、衝、合、近日點等 13 種事件。點任一筆即跳到該日期。',
    'en': 'This button (in the Advanced tab) scans 2 years of upcoming eclipses, oppositions, conjunctions, perihelia, etc. Click any row to jump there.',
    'ja': '「上級」タブのこのボタンが2年分の食・衝・合・近日点など13種を自動検出。クリックでその日へジャンプ。',
  },

  // Physics-transparency section in InfoPanel
  'physics.title':            { 'zh-Hant': '🔬 物理計算詳情', 'en': '🔬 Physics under the hood', 'ja': '🔬 物理計算の中身' },
  'physics.elements':         { 'zh-Hant': '▸ J2000 軌道根數', 'en': '▸ J2000 orbital elements', 'ja': '▸ J2000 軌道要素' },
  'physics.state':            { 'zh-Hant': '▸ 目前狀態向量', 'en': '▸ Current state vector', 'ja': '▸ 現在の状態ベクトル' },
  'physics.distance':         { 'zh-Hant': '距離', 'en': 'Distance', 'ja': '距離' },
  'physics.speed':            { 'zh-Hant': '速度大小', 'en': 'Speed', 'ja': '速度' },
  'physics.source':           { 'zh-Hant': '▸ 資料來源', 'en': '▸ Data source', 'ja': '▸ データソース' },
  'physics.heliocentricPos':  { 'zh-Hant': '日心位置 (J2000 黃道)', 'en': 'Heliocentric position (J2000 ecliptic)', 'ja': '太陽中心位置 (J2000 黄道)' },
  'physics.relativePos':      { 'zh-Hant': '相對位置', 'en': 'Position relative to', 'ja': '相対位置' },
  'physics.kind.kepler':           { 'zh-Hant': 'Kepler 兩體解析解 (J2000)', 'en': 'Two-body analytic Kepler (J2000)', 'ja': 'ケプラー二体解析解 (J2000)' },
  'physics.kind.kepler-perturbed': { 'zh-Hant': 'Kepler + 線性攝動率 (J2000)', 'en': 'Kepler with secular drift rates (J2000)', 'ja': 'ケプラー + 線形摂動率 (J2000)' },
  'physics.kind.sampled':          { 'zh-Hant': '取樣軌跡 + 線性內插', 'en': 'Sampled trajectory + linear interpolation', 'ja': 'サンプル軌跡 + 線形補間' },
  'physics.kind.horizons':         { 'zh-Hant': 'JPL Horizons + Hermite 內插', 'en': 'JPL Horizons + Hermite interpolation', 'ja': 'JPL Horizons + エルミート補間' },
  'physics.kind.nbody':            { 'zh-Hant': 'N-body 數值積分 (Yoshida4)', 'en': 'N-body integration (Yoshida 4th-order symplectic)', 'ja': 'N体数値積分 (Yoshida 4次)' },
  'physics.kind.lunar-elp':        { 'zh-Hant': 'Meeus / ELP-2000 月球理論', 'en': 'Meeus / ELP-2000 lunar theory', 'ja': 'Meeus / ELP-2000 月理論' },
};

let currentLang: Lang = (localStorage.getItem('solarSysLang') as Lang) || 'zh-Hant';

export function getLang(): Lang { return currentLang; }
export function setLang(lang: Lang): void {
  currentLang = lang;
  localStorage.setItem('solarSysLang', lang);
  applyLanguage();
}

export function t(key: string): string {
  const entry = TRANSLATIONS[key];
  if (!entry) return key;
  return entry[currentLang] ?? entry['zh-Hant'] ?? key;
}

/**
 * Walk all elements with [data-i18n] attribute and replace their text content.
 * Walk all [data-i18n-attr="attr:key,attr:key"] for placeholder/title.
 */
export function applyLanguage(): void {
  document.querySelectorAll<HTMLElement>('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n!;
    el.textContent = t(key);
  });
  document.querySelectorAll<HTMLElement>('[data-i18n-attr]').forEach(el => {
    const spec = el.dataset.i18nAttr!;
    for (const part of spec.split(',')) {
      const [attr, key] = part.split(':');
      if (attr && key) el.setAttribute(attr, t(key));
    }
  });
  // Notify subscribers (panels that render dynamically)
  for (const fn of subscribers) fn();
}

const subscribers = new Set<() => void>();
export function onLanguageChange(fn: () => void): () => void {
  subscribers.add(fn);
  return () => subscribers.delete(fn);
}
