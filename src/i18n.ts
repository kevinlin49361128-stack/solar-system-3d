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
  'realism.skyModelHeader': { 'zh-Hant': '大氣散射模型', 'en': 'Atmospheric scattering model', 'ja': '大気散乱モデル' },
  'realism.skyPreetham':    { 'zh-Hant': 'Preetham 1999（預設）', 'en': 'Preetham 1999 (default)', 'ja': 'Preetham 1999（既定）' },
  'realism.skyHosekWilkie': { 'zh-Hant': 'Hosek-Wilkie 2012（暮光更佳）', 'en': 'Hosek-Wilkie 2012 (better twilight)', 'ja': 'Hosek-Wilkie 2012（薄明改善）' },
  'realism.vfxHeader': { 'zh-Hant': '視覺層（疊加光景）', 'en': 'Visual layers (additive)', 'ja': '視覚レイヤー（追加表示）' },
  'realism.extinction': { 'zh-Hant': '大氣消光（低空變暗）', 'en': 'Atmospheric extinction', 'ja': '大気減光（低空で暗化）' },
  'realism.moonGlow': { 'zh-Hant': '月光增亮天空', 'en': 'Moonlight sky brightening', 'ja': '月光による天空輝度' },
  'realism.bvColor': { 'zh-Hant': '恆星 B-V 真實色', 'en': 'Realistic star B-V colour', 'ja': '恒星 B-V 実色' },
  'realism.satShadow': { 'zh-Hant': '衛星地影過濾', 'en': 'Filter satellites in Earth shadow', 'ja': '衛星の地影フィルタ' },
  'realism.dsoRealSize': { 'zh-Hant': 'DSO 真實角直徑', 'en': 'Real DSO angular size', 'ja': 'DSO 実角直径' },
  'realism.deepStars': { 'zh-Hant': '深空星表 (mag 9，~3 MB)', 'en': 'Deep star field (mag 9, ~3 MB)', 'ja': '深空星カタログ (mag 9, ~3 MB)' },
  'realism.sharpless2': { 'zh-Hant': 'Sharpless 2 發射星雲 (313 個)', 'en': 'Sharpless 2 emission nebulae (313)', 'ja': 'Sharpless 2 散光星雲 (313)' },
  'realism.ngcFull': { 'zh-Hant': 'NGC 全集 (~11k，~445 KB)', 'en': 'NGC full catalogue (~11k, ~445 KB)', 'ja': 'NGC 全カタログ (~11k, ~445 KB)' },
  'realism.abell':   { 'zh-Hant': 'Abell 星系團 (2712 個，~80 KB)', 'en': 'Abell galaxy clusters (2712, ~80 KB)', 'ja': 'Abell 銀河団 (2712, ~80 KB)' },
  'realism.milkyway': { 'zh-Hant': '銀河帶', 'en': 'Milky Way', 'ja': '天の川' },
  'realism.beltOfVenus': { 'zh-Hant': '暮光反日點 (Belt of Venus)', 'en': 'Belt of Venus / Earth shadow', 'ja': 'ヴィーナスの帯 / 地球影' },
  'realism.zodiacal': { 'zh-Hant': '黃道光', 'en': 'Zodiacal light', 'ja': '黄道光' },
  'realism.airglow': { 'zh-Hant': '氣輝 + 光害方向', 'en': 'Airglow + light pollution dome', 'ja': '大気光 + 光害ドーム' },
  'realism.meteors': { 'zh-Hant': '流星雨（依已知 shower）', 'en': 'Meteor showers (known showers)', 'ja': '流星群（既知のもの）' },
  'realism.hzOverlay': { 'zh-Hant': '系外行星宜居帶 overlay（Kopparapu）', 'en': 'Exoplanet habitable-zone overlay (Kopparapu)', 'ja': '系外惑星ハビタブルゾーン overlay (Kopparapu)' },
  'left.events': { 'zh-Hant': '天文事件', 'en': 'Astro Events', 'ja': '天文イベント' },
  'nbody.yoshida4': { 'zh-Hant': 'Yoshida 4 階積分', 'en': 'Yoshida 4th-order integrator', 'ja': '吉田4次積分' },
  'nbody.relativistic': { 'zh-Hant': '廣義相對論修正（水星進動）', 'en': 'GR correction (Mercury precession)', 'ja': '一般相対論補正（水星近日点移動）' },
  'nbody.solarJ2': { 'zh-Hant': '太陽 J2 扁率（~3″/cy）', 'en': 'Solar J2 oblateness (~3″/cy)', 'ja': '太陽 J2 扁平度（~3″/cy）' },
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
  // INDI / ASCOM scope-bridge — v0.7 Tier 1 (read-only pointing)
  'external.scopeBridgeLabel':   { 'zh-Hant': '🔭 INDI / ASCOM 望遠鏡橋接（v0.7 預覽）', 'en': '🔭 INDI / ASCOM scope bridge (v0.7 preview)', 'ja': '🔭 INDI / ASCOM 望遠鏡ブリッジ（v0.7 プレビュー）' },
  'external.scopeBridgeConnect': { 'zh-Hant': '連接', 'en': 'Connect', 'ja': '接続' },
  'external.scopeBridgeDisconnect': { 'zh-Hant': '中斷', 'en': 'Disconnect', 'ja': '切断' },
  'external.scopeBridgeHint':    { 'zh-Hant': '需先啟動本機橋接服務（見 docs/future-telescope-bridge.md）。Tier 1 為唯讀：螢幕上會出現綠色十字標示目前望遠鏡指向。', 'en': 'Requires the local bridge helper running (see docs/future-telescope-bridge.md). Tier 1 is read-only: a green reticle on the sky marks the scope’s pointing.', 'ja': 'ローカルブリッジヘルパーが必要（docs/future-telescope-bridge.md 参照）。Tier 1 は読み取り専用：望遠鏡の指向位置に緑色のレチクルが表示されます。' },
  'external.scopeBridgeIdle':    { 'zh-Hant': '未連接', 'en': 'Not connected', 'ja': '未接続' },
  'external.scopeBridgeConnecting': { 'zh-Hant': '連線中…', 'en': 'Connecting…', 'ja': '接続中…' },
  'external.scopeBridgeConnected': { 'zh-Hant': '已連接 · 等待指向資料', 'en': 'Connected · awaiting pointing data', 'ja': '接続済み · 指向データ待機中' },
  'external.scopeBridgeReceiving': { 'zh-Hant': '已連接 · RA={ra} Dec={dec}°', 'en': 'Connected · RA={ra} Dec={dec}°', 'ja': '接続済み · RA={ra} Dec={dec}°' },
  'external.scopeBridgeError':   { 'zh-Hant': '連線失敗（橋接服務未啟動？）', 'en': 'Connection failed (bridge helper not running?)', 'ja': '接続失敗（ブリッジヘルパー未起動？）' },
  // v0.7 Tier 2 — slew control + safety gates
  'external.scopeBridgeTier2Title': { 'zh-Hant': '⚠️ Tier 2 — 望遠鏡控制（高風險，預設關閉）', 'en': '⚠️ Tier 2 — Scope control (HIGH RISK, off by default)', 'ja': '⚠️ Tier 2 — 望遠鏡制御（高リスク、デフォルトOFF）' },
  'external.scopeBridgeAck':     { 'zh-Hant': '我已了解：軟體 bug 可能將載重撞向赤道儀子午翻轉牆。我已設定機械限位、會親自監看。', 'en': 'I understand: a software bug could crash my mount into the meridian-flip wall. I have set hardware limits and will supervise in person.', 'ja': '理解しました：ソフトウェアのバグで搭載機材を赤道儀の子午線翻転壁に衝突させる可能性があります。機械リミットを設定し、現地で監視します。' },
  'external.scopeBridgeMaxSlew': { 'zh-Hant': '最大移動', 'en': 'Max slew', 'ja': '最大移動' },
  'external.scopeBridgeDecFloor':{ 'zh-Hant': 'Dec 下限', 'en': 'Dec floor', 'ja': 'Dec 下限' },
  'external.scopeBridgeDecCeiling':{ 'zh-Hant': 'Dec 上限', 'en': 'Dec ceiling', 'ja': 'Dec 上限' },
  'external.scopeBridgeStop':    { 'zh-Hant': '🛑 緊急停止', 'en': '🛑 PANIC STOP', 'ja': '🛑 緊急停止' },
  'external.scopeBridgeSlewing': { 'zh-Hant': '正在移動… 剩餘 {remDeg}°', 'en': 'Slewing… {remDeg}° remaining', 'ja': '移動中… 残り {remDeg}°' },
  'external.scopeBridgeSlewDone':{ 'zh-Hant': '到位 · RA={ra}h Dec={dec}°', 'en': 'On target · RA={ra}h Dec={dec}°', 'ja': '到達 · RA={ra}h Dec={dec}°' },
  'external.scopeBridgeSlewAbort':{ 'zh-Hant': '已停止', 'en': 'Stopped', 'ja': '停止しました' },
  'external.scopeBridgeSlewError':{ 'zh-Hant': '失敗：{message}', 'en': 'Failed: {message}', 'ja': '失敗：{message}' },
  // Per-target slew button + gate-reason messages
  'info.slewScopeTitle':         { 'zh-Hant': '把望遠鏡指向此目標', 'en': 'Slew telescope to this target', 'ja': 'この目標に望遠鏡を向ける' },
  'external.scopeBridgeGateOk':       { 'zh-Hant': 'GoTo 指令已送出', 'en': 'GoTo command sent', 'ja': 'GoTo コマンド送信済み' },
  'external.scopeBridgeGateDisabled': { 'zh-Hant': '未啟用 Tier 2 控制', 'en': 'Tier 2 control not enabled', 'ja': 'Tier 2 制御が無効です' },
  'external.scopeBridgeGateBadCoords':{ 'zh-Hant': '座標無效', 'en': 'Invalid coordinates', 'ja': '座標が無効です' },
  'external.scopeBridgeGateDecFloor': { 'zh-Hant': '目標低於 Dec 下限', 'en': 'Target below Dec floor', 'ja': '目標が Dec 下限以下です' },
  'external.scopeBridgeGateDecCeil':  { 'zh-Hant': '目標高於 Dec 上限', 'en': 'Target above Dec ceiling', 'ja': '目標が Dec 上限以上です' },
  'external.scopeBridgeGateTooLarge': { 'zh-Hant': '移動角度超過上限 ({maxDeg}°)', 'en': 'Slew exceeds max ({maxDeg}°)', 'ja': '移動角度が上限超過 ({maxDeg}°)' },
  'external.scopeBridgeGateBusy':     { 'zh-Hant': '已有移動進行中', 'en': 'Already slewing', 'ja': '既に移動中です' },
  'external.scopeBridgeGateNotConn':  { 'zh-Hant': '望遠鏡未連接', 'en': 'Telescope not connected', 'ja': '望遠鏡未接続' },
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
  // Smart telescope FOV presets (v0.5 — Seestar / Vespera / Dwarf era)
  'optics.group.visual': { 'zh-Hant': '👁️ 視覺觀測', 'en': '👁️ Visual observing', 'ja': '👁️ 眼視観測' },
  'optics.group.smart':  { 'zh-Hant': '🤖 智慧望遠鏡', 'en': '🤖 Smart telescopes', 'ja': '🤖 スマート望遠鏡' },
  'optics.seestar30':    { 'zh-Hant': 'Seestar S30 (1.6° × 0.9°)', 'en': 'Seestar S30 (1.6° × 0.9°)', 'ja': 'Seestar S30 (1.6° × 0.9°)' },
  'optics.seestar50':    { 'zh-Hant': 'Seestar S50 (1.3° × 0.7°)', 'en': 'Seestar S50 (1.3° × 0.7°)', 'ja': 'Seestar S50 (1.3° × 0.7°)' },
  'optics.vesperaPro':   { 'zh-Hant': 'Vespera Pro (2.5° × 1.5°)', 'en': 'Vespera Pro (2.5° × 1.5°)', 'ja': 'Vespera Pro (2.5° × 1.5°)' },
  'optics.dwarf3':       { 'zh-Hant': 'Dwarf 3 (3.0° × 2.0°)', 'en': 'Dwarf 3 (3.0° × 2.0°)', 'ja': 'Dwarf 3 (3.0° × 2.0°)' },
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
  'observer.findDarkSky': { 'zh-Hant': '🌑 找最近暗空地點', 'en': '🌑 Find nearest dark sky', 'ja': '🌑 近くの暗い空を探す' },
  'darkSky.found': { 'zh-Hant': '已跳至', 'en': 'Jumped to', 'ja': 'ジャンプ先' },
  'darkSky.empty': { 'zh-Hant': '附近沒有暗空地點資料', 'en': 'No dark-sky places nearby', 'ja': '近くに暗空地点がありません' },
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
  'physics.precisionWarn':    {
    'zh-Hant': '目前時間 {year} 已超出此 propagator 的精度窗（{min}–{max}）— 位置仍會計算但可能偏離數弧分到數度。',
    'en': 'Current epoch {year} is outside this propagator\'s accuracy window ({min}–{max}). Positions still compute but may drift by arcminutes-to-degrees.',
    'ja': '現在の年代 {year} はこの伝播モデルの精度範囲（{min}–{max}）の外です。位置は計算されますが、数分角〜数度のずれの可能性があります。',
  },
  'physics.heliocentricPos':  { 'zh-Hant': '日心位置 (J2000 黃道)', 'en': 'Heliocentric position (J2000 ecliptic)', 'ja': '太陽中心位置 (J2000 黄道)' },
  'physics.relativePos':      { 'zh-Hant': '相對位置', 'en': 'Position relative to', 'ja': '相対位置' },
  'physics.kind.kepler':           { 'zh-Hant': 'Kepler 兩體解析解 (J2000)', 'en': 'Two-body analytic Kepler (J2000)', 'ja': 'ケプラー二体解析解 (J2000)' },
  'physics.kind.kepler-perturbed': { 'zh-Hant': 'Kepler + 線性攝動率 (J2000)', 'en': 'Kepler with secular drift rates (J2000)', 'ja': 'ケプラー + 線形摂動率 (J2000)' },
  'physics.kind.kepler-perturbed-j2': { 'zh-Hant': 'Kepler + J2 扁率攝動', 'en': 'Kepler with J2 oblateness perturbation', 'ja': 'ケプラー + J2 扁平度摂動' },
  'physics.j2.title':         { 'zh-Hant': '▸ J2 扁率長期攝動率（{parent} 引力場）', 'en': '▸ J2 secular rates from {parent}\'s oblateness', 'ja': '▸ J2 扁平度による長期摂動率（{parent} 重力場）' },
  'physics.j2.applied':       { 'zh-Hant': '本天體的傳播器已套用 J2 修正。', 'en': 'These rates are applied to this body\'s propagator.', 'ja': 'これらの値はこの天体のプロパゲーターに適用されています。' },
  'physics.j2.diagnostic':    { 'zh-Hant': '診斷顯示 — 本天體傳播器尚未套用 J2 修正，僅供比較。', 'en': 'Diagnostic only — propagator does not include J2 correction.', 'ja': '診断表示 — このプロパゲーターは J2 補正を含みません。' },
  'physics.kind.sampled':          { 'zh-Hant': '取樣軌跡 + 線性內插', 'en': 'Sampled trajectory + linear interpolation', 'ja': 'サンプル軌跡 + 線形補間' },
  'physics.kind.horizons':         { 'zh-Hant': 'JPL Horizons + Hermite 內插', 'en': 'JPL Horizons + Hermite interpolation', 'ja': 'JPL Horizons + エルミート補間' },
  'physics.kind.nbody':            { 'zh-Hant': 'N-body 數值積分 (Yoshida4)', 'en': 'N-body integration (Yoshida 4th-order symplectic)', 'ja': 'N体数値積分 (Yoshida 4次)' },
  'physics.kind.lunar-elp':        { 'zh-Hant': 'Meeus / ELP-2000 月球理論', 'en': 'Meeus / ELP-2000 lunar theory', 'ja': 'Meeus / ELP-2000 月理論' },

  // InfoPanel — body data rows
  'info.row.radius':           { 'zh-Hant': '半徑', 'en': 'Radius', 'ja': '半径' },
  'info.row.mass':             { 'zh-Hant': '質量', 'en': 'Mass', 'ja': '質量' },
  'info.row.rotationPeriod':   { 'zh-Hant': '自轉週期', 'en': 'Rotation period', 'ja': '自転周期' },
  'info.row.axialTilt':        { 'zh-Hant': '軸傾角', 'en': 'Axial tilt', 'ja': '自転軸傾斜' },
  'info.row.semiMajorAxis':    { 'zh-Hant': '軌道半長軸', 'en': 'Semi-major axis', 'ja': '軌道長半径' },
  'info.row.eccentricity':     { 'zh-Hant': '離心率', 'en': 'Eccentricity', 'ja': '離心率' },
  'info.row.inclination':      { 'zh-Hant': '軌道傾角', 'en': 'Orbital inclination', 'ja': '軌道傾斜角' },
  'info.row.orbitalPeriod':    { 'zh-Hant': '軌道週期', 'en': 'Orbital period', 'ja': '軌道周期' },
  'info.row.synodicEarth':     { 'zh-Hant': '會合週期 (對地球)', 'en': 'Synodic period (vs Earth)', 'ja': '会合周期 (対地球)' },
  'info.row.hillSphere':       { 'zh-Hant': '希爾球半徑', 'en': 'Hill sphere radius', 'ja': 'ヒル球半径' },
  'info.row.classification':   { 'zh-Hant': '分類', 'en': 'Classification', 'ja': '分類' },
  'info.row.surfaceGravity':   { 'zh-Hant': '表面重力', 'en': 'Surface gravity', 'ja': '表面重力' },
  'info.row.escapeVelocity':   { 'zh-Hant': '逃逸速度', 'en': 'Escape velocity', 'ja': '脱出速度' },
  'info.row.meanTemp':         { 'zh-Hant': '平均溫度', 'en': 'Mean surface temp', 'ja': '平均表面温度' },
  'info.row.tempRange':        { 'zh-Hant': '溫度範圍', 'en': 'Temperature range', 'ja': '温度範囲' },
  'info.row.altitude':         { 'zh-Hant': '仰角', 'en': 'Altitude', 'ja': '仰角' },
  'info.row.azimuth':          { 'zh-Hant': '方位角', 'en': 'Azimuth', 'ja': '方位角' },
  'info.row.distFromMoon':     { 'zh-Hant': '距月球', 'en': 'Angular distance from Moon', 'ja': '月との離角' },
  'info.row.ra2000':           { 'zh-Hant': '赤經 (J2000)', 'en': 'Right ascension (J2000)', 'ja': '赤経 (J2000)' },
  'info.row.dec2000':          { 'zh-Hant': '赤緯 (J2000)', 'en': 'Declination (J2000)', 'ja': '赤緯 (J2000)' },
  'info.row.magnitude':        { 'zh-Hant': '視星等', 'en': 'Apparent magnitude', 'ja': '実視等級' },
  'info.row.type':             { 'zh-Hant': '類型', 'en': 'Type', 'ja': 'タイプ' },
  'info.row.constellation':    { 'zh-Hant': '星座', 'en': 'Constellation', 'ja': '星座' },
  'info.row.properMotion':     { 'zh-Hant': '自行', 'en': 'Proper motion', 'ja': '固有運動' },
  'info.row.moonBelowHorizon': { 'zh-Hant': '（月在地平下）', 'en': '(Moon below horizon)', 'ja': '（月は地平下）' },
  'info.row.horizonWarning':   { 'zh-Hant': '⚠️ 地平警示', 'en': '⚠️ Near-horizon warning', 'ja': '⚠️ 地平線警告' },
  'info.row.horizonWarningMsg':{ 'zh-Hant': '仰角過低，多數地點被遮蔽', 'en': 'Altitude too low — blocked at most observation sites', 'ja': '仰角が低く、多くの観測地点で遮蔽される' },

  // InfoPanel — sky condition labels
  'info.cond.good':       { 'zh-Hant': '🟢 適合觀測', 'en': '🟢 Good for observation', 'ja': '🟢 観測に適' },
  'info.cond.marginal':   { 'zh-Hant': '🟡 條件普通', 'en': '🟡 Marginal conditions', 'ja': '🟡 条件は普通' },
  'info.cond.poor':       { 'zh-Hant': '🔴 條件不佳', 'en': '🔴 Poor conditions', 'ja': '🔴 条件不良' },
  'info.cond.invisible':  { 'zh-Hant': '⚫ 不可見', 'en': '⚫ Not visible', 'ja': '⚫ 観測不可' },

  // InfoPanel — body category labels (used in subtitle)
  'info.cat.star':   { 'zh-Hant': '恆星', 'en': 'Star', 'ja': '恒星' },
  'info.cat.planet': { 'zh-Hant': '行星', 'en': 'Planet', 'ja': '惑星' },
  'info.cat.dwarf':  { 'zh-Hant': '矮行星', 'en': 'Dwarf planet', 'ja': '準惑星' },
  'info.cat.moon':   { 'zh-Hant': '衛星', 'en': 'Moon', 'ja': '衛星' },
  'info.cat.comet':  { 'zh-Hant': '彗星', 'en': 'Comet', 'ja': '彗星' },

  // InfoPanel — observation log block
  'info.obs.markObserved':    { 'zh-Hant': '☐ 標記為已觀測', 'en': '☐ Mark as observed', 'ja': '☐ 観測済みに記録' },
  'info.obs.markedObserved':  { 'zh-Hant': '☑ 已觀測', 'en': '☑ Observed', 'ja': '☑ 観測済み' },
  'info.obs.ratingTooltip':   { 'zh-Hant': '評分（再次點擊清除）', 'en': 'Rating (click again to clear)', 'ja': '評価（再クリックで解除）' },
  'info.obs.notesPlaceholder': { 'zh-Hant': '筆記（自動儲存）', 'en': 'Notes (auto-saved)', 'ja': 'メモ（自動保存）' },

  // InfoPanel — defaults / fallbacks
  'info.section.surfaceTemp': { 'zh-Hant': '表面溫度', 'en': 'Surface temperature', 'ja': '表面温度' },
  'info.text.bayerStar':      { 'zh-Hant': '夜空中可見的恆星之一。', 'en': 'A star visible in the night sky.', 'ja': '夜空に見える恒星の一つ。' },
  'info.text.bayerSuffix':    { 'zh-Hant': 'Bayer 編號', 'en': 'Bayer designation', 'ja': 'Bayer 符号' },
  'info.row.retrograde':      { 'zh-Hant': '（逆向）', 'en': '(retrograde)', 'ja': '（逆行）' },
  'info.row.days':            { 'zh-Hant': '天', 'en': 'days', 'ja': '日' },

  // InfoPanel — observation-mode dynamic rows
  'info.row.orbitalSpeed':   { 'zh-Hant': '軌道速度', 'en': 'Orbital speed', 'ja': '軌道速度' },
  'info.row.distFromEarth':  { 'zh-Hant': '距地球', 'en': 'Distance from Earth', 'ja': '地球からの距離' },
  'info.row.lightDelay':     { 'zh-Hant': '光行時延', 'en': 'Light-travel time', 'ja': '光行時間' },
  'info.row.apparentSize':   { 'zh-Hant': '視角度大小', 'en': 'Apparent size', 'ja': '視角直径' },
  'info.row.surfaceBrightness': { 'zh-Hant': '表面亮度', 'en': 'Surface brightness', 'ja': '面輝度' },
  'info.row.brightnessClass':  { 'zh-Hant': '亮度等級', 'en': 'Brightness class', 'ja': '輝度クラス' },
  'info.row.form':             { 'zh-Hant': '形態', 'en': 'Form', 'ja': '形態' },
  'info.cat.sharpless':        { 'zh-Hant': 'Sharpless 2 發射星雲', 'en': 'Sharpless 2 emission nebula', 'ja': 'Sharpless 2 散光星雲' },
  'info.sharp.formCircular':   { 'zh-Hant': '圓形', 'en': 'circular', 'ja': '円形' },
  'info.sharp.formEllip':      { 'zh-Hant': '橢圓', 'en': 'elliptical', 'ja': '楕円' },
  'info.sharp.formIrreg':      { 'zh-Hant': '不規則', 'en': 'irregular', 'ja': '不規則' },
  'info.sharp.brightFaint':    { 'zh-Hant': '最暗', 'en': 'faintest', 'ja': '最暗' },
  'info.sharp.brightMed':      { 'zh-Hant': '中等', 'en': 'medium', 'ja': '中程度' },
  'info.sharp.brightBright':   { 'zh-Hant': '最亮', 'en': 'brightest', 'ja': '最明' },
  'info.text.sharpless':       { 'zh-Hant': 'Hα 發射星雲（HII 區）。視覺極暗，但智慧望遠鏡 30 min stack + 窄頻濾鏡可清楚拍出。', 'en': 'Hα emission nebula (HII region). Faint visually, but stacks out in 30 min with a smart-scope + narrowband filter.', 'ja': 'Hα散光星雲（HII領域）。眼視は暗いが、スマート望遠鏡＋ナローバンド30分積分で写る。' },
  'info.text.ngcBulk':         { 'zh-Hant': 'NGC/IC 全集條目。資料來源：OpenNGC v2。點 📋 加入觀測隊列。', 'en': 'NGC/IC bulk catalogue entry. Source: OpenNGC v2. Tap 📋 to queue for tonight.', 'ja': 'NGC/IC 全カタログのエントリ。出典：OpenNGC v2。📋 でキューに追加。' },
  // Abell rich-galaxy-cluster catalogue (v0.6 deep-sky tier)
  'info.cat.abell':            { 'zh-Hant': 'Abell 富星系團', 'en': 'Abell rich galaxy cluster', 'ja': 'Abell 銀河団' },
  'info.row.distClass':        { 'zh-Hant': '距離級', 'en': 'Distance class', 'ja': '距離クラス' },
  'info.row.richness':         { 'zh-Hant': '豐富度', 'en': 'Richness', 'ja': '富有度' },
  'info.row.memberCount':      { 'zh-Hant': '成員星系數', 'en': 'Member galaxies', 'ja': 'メンバー銀河数' },
  'info.text.abell':           { 'zh-Hant': 'Abell 1989 富星系團。多在 mag 15–18，眼視幾乎不可見，但 30 cm 智慧望遠鏡 2–4 小時積分可拍出星系團場景。', 'en': 'Abell 1989 rich galaxy cluster. Typically mag 15–18 — invisible visually, but 2–4 h of stacking on a 30 cm smart-scope reveals the cluster field.', 'ja': 'Abell 1989 銀河団。通常 15〜18 等で眼視ほぼ不可視。30 cm スマート望遠鏡で2〜4時間積分すれば銀河団の姿が浮かぶ。' },
  'info.preview.label':        { 'zh-Hant': '智慧望遠鏡疊圖預覽（模擬）', 'en': 'Smart-scope stacked preview (simulated)', 'ja': 'スマート望遠鏡スタックプレビュー（模擬）' },
  'info.preview.tooltip':      { 'zh-Hant': '程序生成的視覺示意 — 非真實天文影像。要看真實影像請使用 Aladin Lite / PanSTARRS。', 'en': 'Procedural visual hint — NOT a real image. For real previews, use Aladin Lite / PanSTARRS.', 'ja': 'プロシージャル生成のイメージ — 実天体写真ではありません。実画像は Aladin Lite / PanSTARRS で。' },
  // Observation queue (smart-scope session planner, v0.5)
  'info.queueTitle':          { 'zh-Hant': '加入觀測隊列', 'en': 'Add to observation queue', 'ja': '観測キューに追加' },
  'queue.title':              { 'zh-Hant': '📋 觀測隊列', 'en': '📋 Observation Queue', 'ja': '📋 観測キュー' },
  'queue.open':               { 'zh-Hant': '📋 觀測隊列', 'en': '📋 Observation Queue', 'ja': '📋 観測キュー' },
  'queue.empty':              { 'zh-Hant': '隊列為空 — 點任何 Messier 物件的 📋 按鈕加入', 'en': 'Empty — tap 📋 on any Messier object to add it', 'ja': '空 — Messier天体の📋ボタンで追加' },
  'queue.clearAll':           { 'zh-Hant': '清空', 'en': 'Clear all', 'ja': 'クリア' },
  'queue.confirmClear':       { 'zh-Hant': '確認清空整個觀測隊列？', 'en': 'Clear the entire observation queue?', 'ja': '観測キュー全体をクリアしますか？' },
  'queue.remove':             { 'zh-Hant': '從隊列移除', 'en': 'Remove from queue', 'ja': 'キューから削除' },
  'queue.totalIntegration':   { 'zh-Hant': '總曝光時間', 'en': 'Total integration', 'ja': '総積分時間' },
  'queue.window':             { 'zh-Hant': '今晚天文夜長', 'en': 'Tonight\'s astronomical night', 'ja': '今夜の天文夜の長さ' },
  'queue.fits':               { 'zh-Hant': '可在今晚完成', 'en': 'fits in tonight\'s window', 'ja': '今夜完了可能' },
  'queue.overflows':          { 'zh-Hant': '超過今晚可用時間', 'en': 'exceeds tonight\'s window', 'ja': '今夜の時間を超過' },
  'queue.noWindowData':       { 'zh-Hant': '無法計算今晚天文夜（極區或設定不全）', 'en': 'Tonight\'s window unavailable (polar latitude or no observer)', 'ja': '今夜の窓を計算不可（極域または観測者未設定）' },
  'queue.tapHint':            { 'zh-Hant': '點目標名稱跳轉鏡頭 · 改下拉選單切換設備', 'en': 'Tap a target to aim camera · change scope via dropdown', 'ja': 'ターゲット名でカメラ移動・ドロップダウンで望遠鏡変更' },
  'info.row.phaseAngle':     { 'zh-Hant': '相位角', 'en': 'Phase angle', 'ja': '位相角' },
  'info.row.illuminated':    { 'zh-Hant': '照明', 'en': 'illuminated', 'ja': '照射部分' },
  'info.row.angularDiameter':{ 'zh-Hant': '視直徑', 'en': 'Angular diameter', 'ja': '視直径' },
  'info.row.nextTransit':    { 'zh-Hant': '下次過中天', 'en': 'Next transit', 'ja': '次の南中' },
  'info.row.transitAlt':     { 'zh-Hant': '過中天高度', 'en': 'Transit altitude', 'ja': '南中時の仰角' },
  'info.row.nextRise':       { 'zh-Hant': '下次升起', 'en': 'Next rise', 'ja': '次の出' },
  'info.row.nextSet':        { 'zh-Hant': '下次西沒', 'en': 'Next set', 'ja': '次の入' },

  // InfoPanel — section titles
  'info.section.composition':  { 'zh-Hant': '組成（質量比）', 'en': 'Composition (by mass)', 'ja': '組成（質量比）' },
  'info.section.atmosphere':   { 'zh-Hant': '大氣', 'en': 'Atmosphere', 'ja': '大気' },
  'info.section.interior':     { 'zh-Hant': '內部結構（剖面）', 'en': 'Internal structure', 'ja': '内部構造' },
  'info.section.geology':      { 'zh-Hant': '地質 / 表面', 'en': 'Geology / surface', 'ja': '地質 / 表面' },
  'info.section.notes':        { 'zh-Hant': '註記', 'en': 'Notable facts', 'ja': '注釈' },

  // InfoPanel — event-type labels
  'info.event.opposition':       { 'zh-Hant': '衝',     'en': 'Opposition',          'ja': '衝' },
  'info.event.conjunctionSup':   { 'zh-Hant': '上合',   'en': 'Superior conjunction','ja': '外合' },
  'info.event.conjunctionInf':   { 'zh-Hant': '下合',   'en': 'Inferior conjunction','ja': '内合' },
  'info.event.elongationEast':   { 'zh-Hant': '東大距', 'en': 'Greatest eastern elongation', 'ja': '東方最大離角' },
  'info.event.elongationWest':   { 'zh-Hant': '西大距', 'en': 'Greatest western elongation', 'ja': '西方最大離角' },
  'info.event.newMoon':          { 'zh-Hant': '新月',   'en': 'New moon',           'ja': '新月' },
  'info.event.fullMoon':         { 'zh-Hant': '滿月',   'en': 'Full moon',          'ja': '満月' },
  'info.event.solarEclipse':     { 'zh-Hant': '日食',   'en': 'Solar eclipse',      'ja': '日食' },
  'info.event.lunarEclipse':     { 'zh-Hant': '月食',   'en': 'Lunar eclipse',      'ja': '月食' },
  'info.event.transit':          { 'zh-Hant': '凌日',   'en': 'Transit',            'ja': '太陽面通過' },
  'info.event.occultation':      { 'zh-Hant': '月掩星', 'en': 'Lunar occultation',  'ja': '月による掩蔽' },
  'info.event.equinox':          { 'zh-Hant': '分點',   'en': 'Equinox',            'ja': '分点' },

  // InfoPanel — fallbacks / parent labels
  'info.parent.sun':           { 'zh-Hant': '太陽', 'en': 'Sun', 'ja': '太陽' },
  'info.warn.altLow':          { 'zh-Hant': '⚠️ 地平警示',     'en': '⚠️ Near-horizon',         'ja': '⚠️ 地平線警告' },
  'info.warn.altOnlyMsg':      { 'zh-Hant': '仰角僅',          'en': 'Altitude only',           'ja': '仰角のみ' },
  'info.warn.altLowMsg':       { 'zh-Hant': '多數地點被遮蔽', 'en': 'blocked at most sites',   'ja': '多くの観測地で遮蔽' },

  // InfoPanel — late additions
  'info.title.tonightVisibility': { 'zh-Hant': '今晚可見性', 'en': 'Tonight\'s visibility', 'ja': '今夜の見やすさ' },
  'info.title.starHyg':           { 'zh-Hant': '恆星 (HYG)', 'en': 'Star (HYG)', 'ja': '恒星 (HYG)' },
  'info.text.starHygFallback':    {
    'zh-Hant': 'HYG 目錄中的恆星，無常用名與專屬描述。可從赤經/赤緯查詢更詳細的恆星資料。',
    'en': 'A star from the HYG catalogue without a common name or dedicated description. Look up its RA/Dec for further detail.',
    'ja': 'HYG カタログ中の恒星で、固有名や専用解説はありません。赤経・赤緯から詳細を確認してください。',
  },
  'info.row.surfacePressure':    { 'zh-Hant': '表面氣壓', 'en': 'Surface pressure', 'ja': '表面気圧' },
  'info.row.distToParent':       { 'zh-Hant': '目前距', 'en': 'Distance from', 'ja': '現在の距離から' },
  'info.row.observedCount':      { 'zh-Hant': '已觀測', 'en': 'Observed', 'ja': '観測済み' },
  'info.row.observedTimes':      { 'zh-Hant': '次（最近', 'en': 'time(s) — last', 'ja': '回（最近' },
  'info.time.minutes':           { 'zh-Hant': '分後', 'en': 'min from now', 'ja': '分後' },
  'info.time.hours':             { 'zh-Hant': '小時後', 'en': 'hours from now', 'ja': '時間後' },
  'info.time.daysLater':         { 'zh-Hant': '天後', 'en': 'days from now', 'ja': '日後' },

  // LunarEclipseMap
  'lecl.noEvent':       { 'zh-Hant': '（無月食事件）', 'en': '(No lunar eclipse)', 'ja': '（月食なし）' },
  'lecl.penumbra':      { 'zh-Hant': '半影', 'en': 'Penumbra', 'ja': '半影' },
  'lecl.umbra':         { 'zh-Hant': '本影', 'en': 'Umbra', 'ja': '本影' },
  'lecl.greatest':      { 'zh-Hant': '★ 食甚', 'en': '★ Greatest', 'ja': '★ 食の最大' },
  'lecl.kind.total':       { 'zh-Hant': '月全食',     'en': 'Total lunar eclipse',    'ja': '皆既月食' },
  'lecl.kind.partial':     { 'zh-Hant': '月偏食',     'en': 'Partial lunar eclipse',  'ja': '部分月食' },
  'lecl.kind.penumbral':   { 'zh-Hant': '半影月食',   'en': 'Penumbral lunar eclipse','ja': '半影月食' },
  'lecl.kind.none':        { 'zh-Hant': '無月食',     'en': 'No eclipse',             'ja': '月食なし' },
  'lecl.magnitude':     { 'zh-Hant': '食分', 'en': 'Magnitude', 'ja': '食分' },
  'lecl.p1':            { 'zh-Hant': 'P1（半影開始）', 'en': 'P1 (penumbra start)',  'ja': 'P1（半影食の始め）' },
  'lecl.u1':            { 'zh-Hant': 'U1（本影開始）', 'en': 'U1 (umbra start)',     'ja': 'U1（本影食の始め）' },
  'lecl.u2':            { 'zh-Hant': 'U2（全食開始）', 'en': 'U2 (totality start)',  'ja': 'U2（皆既の始め）' },
  'lecl.u3':            { 'zh-Hant': 'U3（全食結束）', 'en': 'U3 (totality end)',    'ja': 'U3（皆既の終わり）' },
  'lecl.u4':            { 'zh-Hant': 'U4（本影結束）', 'en': 'U4 (umbra end)',       'ja': 'U4（本影食の終わり）' },
  'lecl.p4':            { 'zh-Hant': 'P4（半影結束）', 'en': 'P4 (penumbra end)',    'ja': 'P4（半影食の終わり）' },
  'lecl.note.total':    {
    'zh-Hant': '全食時段（U2 → U3）月球完全進入地球本影，呈現紅銅色「血月」。',
    'en': 'During totality (U2 → U3) the Moon is fully inside Earth\'s umbra and turns the famous coppery "blood moon" red.',
    'ja': '皆既時間中（U2→U3）に月は地球の本影に完全に入り、銅色の「ブラッドムーン」となる。',
  },
  'lecl.note.partial':  {
    'zh-Hant': '部分月面進入本影；未進入部分仍受半影微弱遮蔽。',
    'en': 'Part of the lunar disk enters the umbra; the remaining surface still passes through the fainter penumbra.',
    'ja': '月面の一部が本影に入る。残りの部分は半影中にある。',
  },
  'lecl.note.penumbral': {
    'zh-Hant': '月面僅穿過半影區，肉眼難以察覺；攝影可記錄到輕微暗化。',
    'en': 'The Moon passes only through the penumbra — nearly invisible to the eye but a slight dimming is captured photographically.',
    'ja': '月面は半影のみを通過する。肉眼ではほぼ識別できないが、撮影では僅かな減光が記録される。',
  },

  // InfoPanel — observation planning window
  'info.planning.tonightBest':       { 'zh-Hant': '今晚最佳觀測', 'en': 'Best window tonight', 'ja': '今夜のベスト時間帯' },
  'info.planning.windowDetail':      { 'zh-Hant': '小時，仰角 ≥ 30° 且海上昏影後', 'en': 'h above 30° altitude after astronomical dusk', 'ja': '時間、仰角 ≥ 30° かつ航海薄明終了後' },
  'info.planning.noWindow':          { 'zh-Hant': '今晚未達 30° 仰角的暗夜窗。', 'en': 'No 30°-altitude dark-sky window tonight.', 'ja': '今夜は仰角 30° を超える暗夜時間帯がありません。' },
  'info.planning.nextEvent':         { 'zh-Hant': '下一個重要事件', 'en': 'Next major event', 'ja': '次の主要イベント' },
  'info.time.hoursLater':            { 'zh-Hant': '小時後', 'en': 'h from now', 'ja': '時間後' },
  'info.time.monthsLater':           { 'zh-Hant': '個月後', 'en': 'mo from now', 'ja': 'ヶ月後' },
  'info.time.justNow':               { 'zh-Hant': '剛剛',   'en': 'just now',     'ja': 'たった今' },
  'info.time.minutesAgo':            { 'zh-Hant': '分鐘前', 'en': 'min ago',      'ja': '分前' },
  'info.time.hoursAgo':              { 'zh-Hant': '小時前', 'en': 'h ago',        'ja': '時間前' },
  'info.time.daysAgo':               { 'zh-Hant': '天前',   'en': 'd ago',        'ja': '日前' },
  'info.time.monthsAgo':             { 'zh-Hant': '個月前', 'en': 'mo ago',       'ja': 'ヶ月前' },
  'info.unit.hour':                  { 'zh-Hant': '小時',   'en': 'h',     'ja': '時間' },
  'info.unit.day':                   { 'zh-Hant': '天',     'en': 'd',     'ja': '日' },
  'info.unit.year':                  { 'zh-Hant': '年',     'en': 'yr',    'ja': '年' },
  'info.unit.thousandKm':            { 'zh-Hant': '千 km',  'en': "k km",  'ja': '千 km' },

  'info.event.solstice':         { 'zh-Hant': '至點',     'en': 'Solstice',           'ja': '至点' },
  'info.event.perihelion':       { 'zh-Hant': '近日點',   'en': 'Perihelion',         'ja': '近日点' },
  'info.event.aphelion':         { 'zh-Hant': '遠日點',   'en': 'Aphelion',           'ja': '遠日点' },
  'info.event.planetConj':       { 'zh-Hant': '行星合',   'en': 'Planet conjunction', 'ja': '惑星合' },

  // Exoplanet flythrough
  'exo.visitSystem':       { 'zh-Hant': '降落到此系統', 'en': 'Land on this system', 'ja': 'このシステムに降下' },
  'exo.returnToGalaxy':    { 'zh-Hant': '↩ 回到銀河', 'en': '↩ Return to galaxy', 'ja': '↩ 銀河に戻る' },
  'exo.activeBanner':      { 'zh-Hant': '正在參觀', 'en': 'Currently visiting', 'ja': '訪問中' },
  // Habitable-zone classification badges (Kopparapu+2013 conservative HZ)
  'exo.hz.inHz':           { 'zh-Hant': '宜居帶內（保守）', 'en': 'In HZ (conservative)', 'ja': 'HZ内（保守）' },
  'exo.hz.inHzOpt':        { 'zh-Hant': '宜居帶內（樂觀）', 'en': 'In HZ (optimistic only)', 'ja': 'HZ内（楽観のみ）' },
  'exo.hz.hotEdge':        { 'zh-Hant': '高溫邊緣', 'en': 'Hot edge', 'ja': '高温端' },
  'exo.hz.coldEdge':       { 'zh-Hant': '低溫邊緣', 'en': 'Cold edge', 'ja': '低温端' },
  'exo.hz.tooHot':         { 'zh-Hant': '過熱', 'en': 'Too hot', 'ja': '高温過ぎ' },
  'exo.hz.tooCold':        { 'zh-Hant': '過冷', 'en': 'Too cold', 'ja': '低温過ぎ' },
  'info.row.hzRange':      { 'zh-Hant': '宜居帶範圍 (Kopparapu)', 'en': 'Habitable zone (Kopparapu)', 'ja': 'ハビタブルゾーン (Kopparapu)' },
  'info.row.hzRangeOpt':   { 'zh-Hant': '樂觀 HZ (Recent Venus / Early Mars)', 'en': 'Optimistic HZ (Recent Venus / Early Mars)', 'ja': '楽観 HZ（Recent Venus / Early Mars）' },
  'info.row.hzRangeCon':   { 'zh-Hant': '保守 HZ (Runaway / Maximum Greenhouse)', 'en': 'Conservative HZ (Runaway / Max Greenhouse)', 'ja': '保守 HZ（Runaway / Max Greenhouse）' },

  // SkyPanel — sun/moon events
  'sky.polarNight':         { 'zh-Hant': '極夜/極晝',     'en': 'Polar night/day',         'ja': '極夜/白夜' },
  'sky.sunrise':            { 'zh-Hant': '☀ 升', 'en': '☀ Rise',  'ja': '☀ 出' },
  'sky.sunset':             { 'zh-Hant': '☀ 落', 'en': '☀ Set',   'ja': '☀ 入' },
  'sky.moonrise':           { 'zh-Hant': '☽ 升', 'en': '☽ Rise',  'ja': '☽ 出' },
  'sky.moonset':            { 'zh-Hant': '☽ 落', 'en': '☽ Set',   'ja': '☽ 入' },
  'sky.civilDusk':          { 'zh-Hant': '民用昏', 'en': 'Civil dusk',         'ja': '市民薄明（夕）' },
  'sky.nauticalDusk':       { 'zh-Hant': '航海昏', 'en': 'Nautical dusk',      'ja': '航海薄明（夕）' },
  'sky.astronomicalDusk':   { 'zh-Hant': '天文昏', 'en': 'Astronomical dusk',  'ja': '天文薄明（夕）' },
  'sky.astronomicalDawn':   { 'zh-Hant': '天文晨', 'en': 'Astronomical dawn',  'ja': '天文薄明（朝）' },
  'sky.nauticalDawn':       { 'zh-Hant': '航海晨', 'en': 'Nautical dawn',      'ja': '航海薄明（朝）' },
  'sky.civilDawn':          { 'zh-Hant': '民用晨', 'en': 'Civil dawn',         'ja': '市民薄明（朝）' },
  'sky.daylightLen':        { 'zh-Hant': '白晝', 'en': 'Daylight',           'ja': '昼長' },
  'sky.equationOfTime':     { 'zh-Hant': '時差', 'en': 'Eq. of time',        'ja': '均時差' },
  'sky.minutes':            { 'zh-Hant': '分',   'en': 'min',                'ja': '分' },
  'sky.lst':                { 'zh-Hant': '恆星時', 'en': 'Sidereal time',    'ja': '恒星時' },
  // Layout-mode picker (shown on first visit; reachable later in settings)
  'picker.title':           { 'zh-Hant': '太陽系 3D', 'en': 'Solar System 3D', 'ja': '太陽系 3D' },
  'picker.subtitle':        { 'zh-Hant': '選擇適合你裝置的介面風格 — 之後可從選單裡切換。', 'en': 'Pick the UI that fits your device — you can switch later in the menu.', 'ja': 'デバイスに合うUIを選択 — 後でメニューから切替可能。' },
  'picker.desktop.title':   { 'zh-Hant': '桌機版', 'en': 'Desktop', 'ja': 'デスクトップ版' },
  'picker.desktop.subtitle':{ 'zh-Hant': '鍵盤、滑鼠、寬螢幕', 'en': 'Keyboard, mouse, wide screen', 'ja': 'キーボード・マウス・広い画面' },
  'picker.mobile.title':    { 'zh-Hant': '手機版', 'en': 'Mobile', 'ja': 'モバイル版' },
  'picker.mobile.subtitle': { 'zh-Hant': '觸控、全螢幕、底部工具列', 'en': 'Touch, full-screen, bottom toolbar', 'ja': 'タッチ・全画面・下部ツールバー' },
  'picker.remember':        { 'zh-Hant': '記住我的選擇', 'en': 'Remember my choice', 'ja': '選択を記憶' },
  // Mobile bottom toolbar labels (5 icons)
  'mb.scale':               { 'zh-Hant': '尺度', 'en': 'Scale',  'ja': 'スケール' },
  'mb.time':                { 'zh-Hant': '時間', 'en': 'Time',   'ja': '時間' },
  'mb.camera':              { 'zh-Hant': '鏡頭', 'en': 'Camera', 'ja': 'カメラ' },
  'mb.view':                { 'zh-Hant': '顯示', 'en': 'View',   'ja': '表示' },
  'mb.find':                { 'zh-Hant': '搜尋', 'en': 'Find',   'ja': '探す' },
  // Mobile chrome placeholder messages (until Phase D fills sheets)
  'mb.menuStub':            { 'zh-Hant': '設定面板開發中 — Phase D', 'en': 'Settings sheet coming in Phase D', 'ja': '設定シートは Phase D で実装予定' },
  'mb.sheetStub':           { 'zh-Hant': '「{name}」面板開發中 — Phase D', 'en': '"{name}" sheet coming in Phase D', 'ja': '「{name}」シートは Phase D で実装予定' },
  'mb.empty':               { 'zh-Hant': '（此面板沒有可顯示的內容）', 'en': '(No content available for this sheet)', 'ja': '（このシートに表示する内容はありません）' },
  'mb.gyroNudge':           { 'zh-Hant': '💡 在「鏡頭」面板裡可啟用陀螺儀，把手機指向天空即可瞄準。', 'en': '💡 Tap "Camera" to enable gyroscope — point your phone at the sky to aim.', 'ja': '💡 「カメラ」シートでジャイロを有効に — 携帯を空に向けて視界を移動。' },
  'mb.settings':            { 'zh-Hant': '⚙️ 設定', 'en': '⚙️ Settings', 'ja': '⚙️ 設定' },
  // Layout-mode switcher (in advanced tab + mobile settings sheet)
  'left.layoutMode':        { 'zh-Hant': '介面模式', 'en': 'UI Layout', 'ja': 'UIモード' },
  'layout.currentLabel':    { 'zh-Hant': '目前：{mode}', 'en': 'Current: {mode}', 'ja': '現在：{mode}' },
  'layout.switchTo':        { 'zh-Hant': '切換到{mode}', 'en': 'Switch to {mode}', 'ja': '{mode}へ切替' },
  'layout.confirmSwitch':   { 'zh-Hant': '從 {from} 切換到 {to}？頁面會重新整理以套用新的介面。', 'en': 'Switch from {from} to {to}? The page will reload to apply the new UI.', 'ja': '{from} から {to} に切替えますか？新UIを適用するためページが再読込されます。' },
  // Open-Meteo weather opt-in
  'weather.optinPitch':     { 'zh-Hant': '查看今晚雲量？資料來源 open-meteo.com（免費、不需帳號）。', 'en': 'Check tonight\'s cloud cover? Data from open-meteo.com (free, no account).', 'ja': '今夜の雲量を確認？データは open-meteo.com（無料・登録不要）。' },
  'weather.optinAction':    { 'zh-Hant': '啟用', 'en': 'Enable', 'ja': '有効にする' },
  'weather.fetching':       { 'zh-Hant': '雲量資料載入中…', 'en': 'Fetching cloud cover…', 'ja': '雲量データ取得中…' },
  'weather.disable':        { 'zh-Hant': '停用', 'en': 'disable', 'ja': '無効化' },
  'weather.clear':          { 'zh-Hant': '晴朗', 'en': 'clear', 'ja': '快晴' },
  'weather.partly':         { 'zh-Hant': '部分多雲', 'en': 'partly cloudy', 'ja': '部分曇り' },
  'weather.overcast':       { 'zh-Hant': '陰天', 'en': 'overcast', 'ja': '曇天' },
  'sky.dblClickCenter':     { 'zh-Hant': '雙擊置中',   'en': 'Double-click to center', 'ja': 'ダブルクリックで中心に' },

  // SearchBar
  'search.constellationLines':  { 'zh-Hant': '包含', 'en': 'contains', 'ja': '構成線数' },
  'search.constellationLines2': { 'zh-Hant': '條連線', 'en': 'connection lines', 'ja': '本' },
  'search.observerHint':        { 'zh-Hant': '進入觀測模式可在天空中找到此星座。', 'en': 'Enter observer mode to locate it in the sky.', 'ja': '観測モードに入ると、天空でこの星座を見つけられます。' },
  'search.coordsSub':           { 'zh-Hant': 'J2000 直接座標', 'en': 'J2000 raw coordinates', 'ja': 'J2000 直接座標' },
  'search.coordsHint':          { 'zh-Hant': '進入觀測模式即可定位至此座標。', 'en': 'Enter observer mode to point at these coordinates.', 'ja': '観測モードに入るとこの座標へポイントできます。' },
  'search.noResult':            { 'zh-Hant': '無相符結果', 'en': 'No matches', 'ja': '該当なし' },
  'search.cat.body':            { 'zh-Hant': '天體', 'en': 'Body', 'ja': '天体' },
  'search.cat.star':            { 'zh-Hant': '恆星', 'en': 'Star', 'ja': '恒星' },
  'search.cat.site':            { 'zh-Hant': '觀測點', 'en': 'Observing site', 'ja': '観測地' },
  'search.cat.constellation':   { 'zh-Hant': '星座', 'en': 'Constellation', 'ja': '星座' },

  // EventsPanel
  'events.empty':            { 'zh-Hant': '無事件，按「重掃」嘗試。', 'en': 'No events — try the "Rescan" button.', 'ja': 'イベントなし。「再スキャン」をお試しください。' },
  'events.eclipsePathBtn':   { 'zh-Hant': '🗺️ 食帶地圖', 'en': '🗺️ Eclipse path map', 'ja': '🗺️ 食帯地図' },
  'events.lunarContactBtn':  { 'zh-Hant': '🌑 接觸圖', 'en': '🌑 Contact diagram', 'ja': '🌑 接触図' },
  'events.eclipsePathLabel': { 'zh-Hant': '日食食帶', 'en': 'Solar eclipse path', 'ja': '日食帯' },
  'events.lunarContactLabel':{ 'zh-Hant': '月食接觸圖', 'en': 'Lunar eclipse contacts', 'ja': '月食接触図' },
  'events.maybeEclipse':     { 'zh-Hant': '可能日食', 'en': 'Possible eclipse', 'ja': '日食の可能性' },

  // CalcPanel — table column headers (some defined earlier; only add new ones)
  'calc.body':         { 'zh-Hant': '天體',     'en': 'Body',           'ja': '天体' },
  'calc.angularSize':  { 'zh-Hant': '視角直徑', 'en': 'Angular size',   'ja': '視直径' },
  'calc.angularRate':  { 'zh-Hant': '角速度',   'en': 'Angular rate',   'ja': '角速度' },

  // LeftPanel + map picker
  'lp.now':                  { 'zh-Hant': '現在',                  'en': 'Now',                'ja': '現在' },
  'lp.cityGroup':            { 'zh-Hant': '城市',                  'en': 'Cities',             'ja': '都市' },
  'lp.observatoryGroup':     { 'zh-Hant': '歷史 / 著名天文台',     'en': 'Historic / famous observatories', 'ja': '歴史的・著名な天文台' },
  'lp.darkSkyGroup':         { 'zh-Hant': '🌑 國際暗空認證地點',   'en': '🌑 Certified Dark Sky Places', 'ja': '🌑 国際ダークスカイ認定地' },
  'lp.elevation':            { 'zh-Hant': '海拔',                  'en': 'Elevation',          'ja': '標高' },
  'mp.loadFail':             { 'zh-Hant': '地圖載入失敗（請檢查網路）', 'en': 'Map failed to load (check your connection)', 'ja': '地図の読み込みに失敗しました（ネットワークをご確認ください）' },

  // EclipseMap
  'em.greatest':       { 'zh-Hant': '★ 食甚', 'en': '★ Greatest eclipse', 'ja': '★ 食の最大' },
  'em.kind.total':     { 'zh-Hant': '日全食', 'en': 'Total solar eclipse',  'ja': '皆既日食' },
  'em.kind.annular':   { 'zh-Hant': '日環食', 'en': 'Annular solar eclipse','ja': '金環日食' },
  'em.kind.partial':   { 'zh-Hant': '日偏食', 'en': 'Partial solar eclipse','ja': '部分日食' },

  // ObservationLogPanel
  'obslog.imported':         { 'zh-Hant': '已匯入 N 筆觀測紀錄', 'en': 'Imported N observation entries', 'ja': '観測記録を N 件読み込みました' },
  'obslog.importFail':       { 'zh-Hant': '匯入失敗', 'en': 'Import failed', 'ja': '読み込み失敗' },
  'obslog.clearConfirmCount':{ 'zh-Hant': '筆',       'en': 'entries',       'ja': '件' },

  // Horizons external integration (main.ts dynamic status)
  'horizons.loading':  { 'zh-Hant': '查詢中…',                       'en': 'Loading…',                              'ja': '読み込み中…' },
  'horizons.noOrbit':  { 'zh-Hant': '查無軌道（檢查名稱 / SPK）',     'en': 'No orbit found (check name / SPK ID)',  'ja': '軌道が見つかりません（名称 / SPK を確認）' },
  'horizons.added':    { 'zh-Hant': '已加入：{name}（{n} 點）',       'en': 'Added: {name} ({n} samples)',           'ja': '追加しました：{name}（{n} 点）' },
  'horizons.dupName':  { 'zh-Hant': '已存在同名物體',                 'en': 'Object with that name already exists',  'ja': '同名の天体がすでに存在します' },
  'horizons.error':    { 'zh-Hant': '錯誤：{err}',                    'en': 'Error: {err}',                          'ja': 'エラー：{err}' },

  // Stellarium telescope status (main.ts)
  'telescope.connected':     { 'zh-Hant': '已連接 ✓', 'en': 'Connected ✓',     'ja': '接続済 ✓' },
  'telescope.disconnect':    { 'zh-Hant': '中斷',     'en': 'Disconnect',      'ja': '切断' },
  'telescope.connectFailed': { 'zh-Hant': '連接失敗', 'en': 'Connection failed','ja': '接続失敗' },
  'telescope.idle':          { 'zh-Hant': '未連接',   'en': 'Not connected',   'ja': '未接続' },
  'telescope.connect':       { 'zh-Hant': '連接',     'en': 'Connect',         'ja': '接続' },

  // Measure tool / observer overlays (main.ts)
  'measure.pickNext':        { 'zh-Hant': '點下一個',  'en': 'pick next',       'ja': '次を選択' },
  'compass.az':              { 'zh-Hant': '方位',      'en': 'Az',              'ja': '方位' },
  'compass.alt':             { 'zh-Hant': '仰角',      'en': 'Alt',             'ja': '仰角' },
  'observer.customLocation': { 'zh-Hant': '自訂位置',  'en': 'Custom location', 'ja': 'カスタム位置' },
  'track.sidereal':          { 'zh-Hant': '≈ 恆星時',                'en': '≈ sidereal',                  'ja': '≈ 恒星時' },
  'track.vsSidereal':        { 'zh-Hant': '″/s vs 恆星時',           'en': '″/s vs sidereal',             'ja': '″/s 対 恒星時' },

  // Observability reason codes (physics/observability.ts)
  'obs.reason.belowHorizon':       { 'zh-Hant': '目標位於地平線下',                                  'en': 'Target is below the horizon',                              'ja': '目標は地平線下にあります' },
  'obs.reason.belowHorizonDetail': { 'zh-Hant': '目標位於地平線下（仰角 ≤ 0°）',                      'en': 'Target is below the horizon (altitude ≤ 0°)',              'ja': '目標は地平線下（仰角 ≤ 0°）' },
  'obs.reason.altVeryLow':         { 'zh-Hant': '仰角僅 {alt}°，極低（受地形遮蔽 + 大量大氣消光）',    'en': 'Altitude only {alt}° — very low (terrain + heavy atmospheric extinction)', 'ja': '仰角はわずか {alt}°（地形遮蔽 + 大気減光）' },
  'obs.reason.altLow':             { 'zh-Hant': '仰角偏低 {alt}°（airmass > 4，星光顯著減弱）',        'en': 'Low altitude {alt}° (airmass > 4, significant dimming)',   'ja': '仰角が低い {alt}°（airmass > 4、減光が顕著）' },
  'obs.reason.altMid':             { 'zh-Hant': '仰角中等 {alt}°（airmass ~2，可觀但非最佳）',         'en': 'Moderate altitude {alt}° (airmass ~2, observable but not optimal)', 'ja': '中程度の仰角 {alt}°（airmass ~2、観測可能だが最適ではない）' },
  'obs.reason.twilightCivil':      { 'zh-Hant': '尚未天文夜（太陽仰角 > -6°，市民/航海曙暮光）',       'en': 'Not yet astronomical night (sun > -6°, civil/nautical twilight)', 'ja': '天文夜になっていません（太陽 > -6°、市民/航海薄明）' },
  'obs.reason.twilightNautical':   { 'zh-Hant': '航海曙暮光中（太陽 -12° 以上，背景仍亮）',            'en': 'Nautical twilight (sun above -12°, sky still bright)',     'ja': '航海薄明中（太陽 -12° 以上、空はまだ明るい）' },
  'obs.reason.twilightAstro':      { 'zh-Hant': '天文曙暮光（太陽 -18° 以上，背景輕微泛光）',          'en': 'Astronomical twilight (sun above -18°, slight skyglow)',   'ja': '天文薄明（太陽 -18° 以上、わずかな空の明るさ）' },
  'obs.reason.moonHeavy':          { 'zh-Hant': '月光嚴重影響（{pct}% 月相，距目標 {dist}°）',         'en': 'Severe moonlight impact ({pct}% phase, {dist}° from target)','ja': '月光の影響大（月相 {pct}%、目標から {dist}°）' },
  'obs.reason.moonStrong':         { 'zh-Hant': '月光影響（{pct}% 月相，距目標 {dist}°）',             'en': 'Moonlight impact ({pct}% phase, {dist}° from target)',     'ja': '月光の影響あり（月相 {pct}%、目標から {dist}°）' },
  'obs.reason.moonBrightFar':      { 'zh-Hant': '亮月（{pct}%）在天空，但距目標 {dist}° 較遠',          'en': 'Bright moon ({pct}%) up, but {dist}° from target',         'ja': '明るい月（{pct}%）が出ているが、目標から {dist}° 離れている' },
  'obs.reason.moonMildClose':      { 'zh-Hant': '月光輕度影響（{pct}% 月相，距目標 {dist}°）',          'en': 'Mild moonlight ({pct}% phase, {dist}° from target)',       'ja': '月光わずかに影響（月相 {pct}%、目標から {dist}°）' },
  'obs.reason.moonMild':           { 'zh-Hant': '月光輕度影響（{pct}% 月相）',                          'en': 'Mild moonlight ({pct}% phase)',                            'ja': '月光わずかに影響（月相 {pct}%）' },
  'obs.reason.magBelowLimit':      { 'zh-Hant': '亮度低於可見極限 {amount} mag（目標 {tmag} vs 可見 {limit}）', 'en': 'Brightness below limit by {amount} mag (target {tmag} vs limit {limit})', 'ja': '輝度が可視限界より {amount} mag 下回る（目標 {tmag} vs 限界 {limit}）' },
  'obs.reason.magNearLimit':       { 'zh-Hant': '接近可見極限（餘量僅 {margin} mag，需要好條件 + 適應暗）', 'en': 'Near visibility limit (margin only {margin} mag — needs good conditions + dark adaptation)', 'ja': '可視限界に近い（余裕は {margin} mag のみ、好条件 + 暗順応が必要）' },
  'obs.reason.magMargin':          { 'zh-Hant': '亮度餘量 {margin} mag（可見但不顯眼）',                'en': 'Brightness margin {margin} mag (visible but inconspicuous)','ja': '輝度余裕 {margin} mag（可視だが目立たない）' },
  'obs.reason.goodConditions':     { 'zh-Hant': '條件良好',                                            'en': 'Good conditions',                                          'ja': '条件良好' },

  // Observation planning status (physics/observationPlanning.ts)
  'plan.status.belowHorizon':  { 'zh-Hant': '🌑 地平線下',               'en': '🌑 Below horizon',                'ja': '🌑 地平線下' },
  'plan.status.sunUp':         { 'zh-Hant': '☀️ 太陽未沉，難觀測',        'en': '☀️ Sun still up — hard to observe','ja': '☀️ 太陽が沈んでおらず観測困難' },
  'plan.status.twilight':      { 'zh-Hant': '🌆 暮光中（−18° < 太陽 < −6°）','en': '🌆 In twilight (−18° < sun < −6°)','ja': '🌆 薄明中（−18° < 太陽 < −6°）' },
  'plan.status.observable':    { 'zh-Hant': '🌙 適合觀測',                 'en': '🌙 Good for observing',           'ja': '🌙 観測に適しています' },

  // Event kind names (physics/eventScanner.ts)
  'event.kind.opposition':         { 'zh-Hant': '衝',          'en': 'Opposition',            'ja': '衝' },
  'event.kind.conjunction-sup':    { 'zh-Hant': '上合',        'en': 'Superior conjunction',  'ja': '外合' },
  'event.kind.conjunction-inf':    { 'zh-Hant': '下合',        'en': 'Inferior conjunction',  'ja': '内合' },
  'event.kind.elongation-east':    { 'zh-Hant': '東大距',      'en': 'Greatest eastern elongation', 'ja': '東方最大離角' },
  'event.kind.elongation-west':    { 'zh-Hant': '西大距',      'en': 'Greatest western elongation', 'ja': '西方最大離角' },
  'event.kind.new-moon':           { 'zh-Hant': '新月',        'en': 'New moon',              'ja': '新月' },
  'event.kind.full-moon':          { 'zh-Hant': '滿月',        'en': 'Full moon',             'ja': '満月' },
  'event.kind.solar-eclipse':      { 'zh-Hant': '日食（可能）','en': 'Solar eclipse (possible)','ja': '日食（可能性）' },
  'event.kind.lunar-eclipse':      { 'zh-Hant': '月食（可能）','en': 'Lunar eclipse (possible)','ja': '月食（可能性）' },
  'event.kind.transit':            { 'zh-Hant': '凌日',        'en': 'Transit',               'ja': '太陽面通過' },
  'event.kind.occultation':        { 'zh-Hant': '月掩星',      'en': 'Lunar occultation',     'ja': '月の掩蔽' },
  'event.kind.equinox':            { 'zh-Hant': '分點',        'en': 'Equinox',               'ja': '分点' },
  'event.kind.solstice':           { 'zh-Hant': '至點',        'en': 'Solstice',              'ja': '至点' },
  'event.kind.perihelion':         { 'zh-Hant': '近日點',      'en': 'Perihelion',            'ja': '近日点' },
  'event.kind.aphelion':           { 'zh-Hant': '遠日點',      'en': 'Aphelion',              'ja': '遠日点' },
  'event.kind.planet-conjunction': { 'zh-Hant': '行星合',      'en': 'Planetary conjunction', 'ja': '惑星の合' },

  // EclipseMap details (ui/EclipseMap.ts footer)
  'em.maxWidth':   { 'zh-Hant': '食帶最寬',           'en': 'Max path width',     'ja': '食帯最大幅' },
  'em.peak':       { 'zh-Hant': '食甚：',              'en': 'Greatest:',          'ja': '食の最大：' },
  'em.location':   { 'zh-Hant': '位置：',              'en': 'Location:',          'ja': '位置：' },
  'em.bandStart':  { 'zh-Hant': '影帶起點：',          'en': 'Path start:',        'ja': '食帯開始：' },
  'em.bandEnd':    { 'zh-Hant': '影帶終點：',          'en': 'Path end:',          'ja': '食帯終了：' },
  'em.legend':     { 'zh-Hant': '紅色中心線 = 全食/環食帶；金色 ★ = 食甚位置；標示為距食甚的時間（分鐘）。', 'en': 'Red centerline = totality/annularity path; gold ★ = greatest-eclipse spot; labels are minutes from greatest.', 'ja': '赤線 = 皆既/金環帯；金色 ★ = 食最大の位置；ラベルは食最大からの分単位。' },

  // LunarEclipseMap details (ui/LunarEclipseMap.ts)
  'lecl.date':            { 'zh-Hant': '日期：',                                                'en': 'Date:',                                                       'ja': '日付：' },
  'lecl.danjonFootnote':  { 'zh-Hant': '包含 Danjon 大氣修正（影錐 +2%）；食甚時刻 < 1 分鐘誤差，接觸時刻 ±1-2 分鐘。', 'en': 'Includes Danjon atmospheric correction (umbra +2%); greatest-eclipse time < 1 min error, contact times ±1–2 min.', 'ja': 'Danjon 大気補正を含む（影錐 +2%）。食最大は誤差 <1 分、接触は ±1〜2 分。' },
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
