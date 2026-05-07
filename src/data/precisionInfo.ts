import type { LangText } from '../i18n';

/**
 * Authoritative table of which physical quantity comes from which model,
 * and what its expected accuracy is. Surfaced to users via the
 * "ⓘ 模型精度" modal and (selectively) inline in InfoPanel rows.
 *
 * Adding a new physics module? Add an entry here so users can verify
 * the assumptions behind the number we show them. This is the single
 * source of truth — README and docs/precision-and-limits.md cross-link
 * back to it via item ids.
 *
 * Philosophy: the project differentiates from generic planetariums by
 * being *explainable*. Every number a user sees should answer:
 *   - what model produced it?
 *   - what's the expected error?
 *   - what time/space range is the model valid over?
 *   - what's NOT included that might surprise the user?
 */

export interface PrecisionEntry {
  /** Stable id, used for cross-referencing from other modules / docs. */
  id: string;
  /** Short display label (e.g. "行星位置"). */
  label: LangText;
  /** What model / formula produces this number. */
  source: LangText;
  /** Expected accuracy in plain language. */
  accuracy: LangText;
  /** Time range over which the accuracy claim holds. */
  validRange: LangText;
  /** What's deliberately NOT modelled (so users don't over-trust). */
  notIncluded?: LangText;
}

export const PRECISION_INFO: PrecisionEntry[] = [
  {
    id: 'planet-position',
    label: { 'zh-Hant': '行星位置（八大行星）', 'en': 'Planet position (8 majors)', 'ja': '惑星位置（八大惑星）' },
    source: { 'zh-Hant': 'Standish 2007 J2000 Kepler 根數 + 線性 dM/dt', 'en': 'Standish 2007 J2000 Kepler elements with linear dM/dt', 'ja': 'Standish 2007 J2000 Keplerian要素 + 線形 dM/dt' },
    accuracy: { 'zh-Hant': '位置誤差 < 600 km（約 0.01°）', 'en': 'Position error < 600 km (~0.01°)', 'ja': '位置誤差 < 600 km（≈0.01°）' },
    validRange: { 'zh-Hant': '1800–2050', 'en': '1800–2050', 'ja': '1800–2050' },
    notIncluded: { 'zh-Hant': '行星間相互攝動（除非切到 N-body 模式）、相對論修正（除水星進動可選）', 'en': 'Planet–planet perturbations (unless N-body enabled); relativistic corrections (except optional Mercury precession)', 'ja': '惑星間相互摂動（N-bodyモード以外）、一般相対論補正（水星近日点歳差を除き任意）' },
  },
  {
    id: 'moon-position',
    label: { 'zh-Hant': '月球位置', 'en': 'Moon position', 'ja': '月の位置' },
    source: { 'zh-Hant': 'Meeus AA Ch.47 / ELP-2000 截斷（60 LR + 60 B 項）', 'en': 'Meeus AA Ch.47 / ELP-2000 truncated (60 LR + 60 B terms)', 'ja': 'Meeus AA Ch.47 / ELP-2000 短縮版（60 LR + 60 B 項）' },
    accuracy: { 'zh-Hant': '黃經 ±10″、黃緯 ±5″（約 ±20 km）', 'en': '±10″ ecliptic longitude, ±5″ latitude (~±20 km)', 'ja': '黄経 ±10″、黄緯 ±5″（約 ±20 km）' },
    validRange: { 'zh-Hant': '1500–2500', 'en': '1500–2500', 'ja': '1500–2500' },
    notIncluded: { 'zh-Hant': '高階潮汐項、行星攝動細節', 'en': 'Higher-order tidal terms, detailed planet perturbations', 'ja': '高次潮汐項、惑星摂動詳細' },
  },
  {
    id: 'sun-position',
    label: { 'zh-Hant': '太陽位置（從地球視角）', 'en': 'Sun position (geocentric)', 'ja': '太陽位置（地心）' },
    source: { 'zh-Hant': 'Meeus AA Ch.25 截斷', 'en': 'Meeus AA Ch.25 truncated', 'ja': 'Meeus AA Ch.25 短縮版' },
    accuracy: { 'zh-Hant': '黃經 ±30″（約 0.008°）', 'en': '±30″ ecliptic longitude (~0.008°)', 'ja': '黄経 ±30″（約 0.008°）' },
    validRange: { 'zh-Hant': '1800–2200', 'en': '1800–2200', 'ja': '1800–2200' },
  },
  {
    id: 'eclipse-timing',
    label: { 'zh-Hant': '日 / 月食接觸時刻', 'en': 'Solar / lunar eclipse contact times', 'ja': '日食・月食の接触時刻' },
    source: { 'zh-Hant': '由太陽 + 月球位置幾何計算（含 Danjon 大氣修正 +2%）', 'en': 'Computed from sun + moon positions (with Danjon +2% atmospheric enlargement)', 'ja': '太陽 + 月の位置から幾何計算（Danjon大気補正 +2%）' },
    accuracy: { 'zh-Hant': '食甚 < 1 min；P1 / U1 / U4 / P4 接觸 ±1–2 min', 'en': '< 1 min for greatest; P1/U1/U4/P4 contacts ±1–2 min', 'ja': '食甚 < 1分；P1/U1/U4/P4 接触 ±1–2分' },
    validRange: { 'zh-Hant': '受太陽 / 月球模型限制', 'en': 'Limited by sun / moon model ranges', 'ja': '太陽 / 月モデルに依存' },
    notIncluded: { 'zh-Hant': '地球橢球體高精度修正、ΔT 精細歷史值', 'en': 'High-precision Earth ellipsoid corrections, fine historical ΔT values', 'ja': '地球楕円体の高精度補正、ΔTの詳細な歴史値' },
  },
  {
    id: 'star-position',
    label: { 'zh-Hant': '恆星位置', 'en': 'Star position', 'ja': '恒星位置' },
    source: { 'zh-Hant': 'Hipparcos / BSC J2000 + Hipparcos 自行 + IAU 1976 歲差 + 年度光行差', 'en': 'Hipparcos / BSC J2000 + Hipparcos proper motion + IAU 1976 precession + annual aberration', 'ja': 'Hipparcos / BSC J2000 + 固有運動 + IAU 1976 歳差 + 年周光行差' },
    accuracy: { 'zh-Hant': '亮星 < 1″、暗星 ≲ 5″', 'en': 'Bright stars < 1″, faint stars ≲ 5″', 'ja': '明るい星 < 1″、暗い星 ≲ 5″' },
    validRange: { 'zh-Hant': '1900–2100（自行限制）', 'en': '1900–2100 (proper motion limited)', 'ja': '1900–2100（固有運動の制約）' },
    notIncluded: { 'zh-Hant': '長期視向速度、雙星軌道運動', 'en': 'Long-term radial velocity, binary star orbital motion', 'ja': '長期視線速度、連星軌道運動' },
  },
  {
    id: 'topocentric',
    label: { 'zh-Hant': '地表觀測（仰角 / 方位）', 'en': 'Topocentric (alt / az)', 'ja': '地心地表（仰角 / 方位）' },
    source: { 'zh-Hant': 'GMST (Vallado 1982) + ECEF→ECI→ecliptic + Bennett 折射 (含 T/P 修正)', 'en': 'GMST (Vallado 1982) + ECEF→ECI→ecliptic + Bennett refraction (T/P corrected)', 'ja': 'GMST (Vallado 1982) + ECEF→ECI→ecliptic + Bennett大気差（T/P補正）' },
    accuracy: { 'zh-Hant': '< 5″ 仰角誤差於 alt > 5°；地平面附近誤差較大', 'en': '< 5″ altitude error above 5°; larger near horizon', 'ja': '仰角5°以上で<5″誤差、地平面付近で誤差増大' },
    validRange: { 'zh-Hant': '所有現代日期', 'en': 'All modern dates', 'ja': '現代の全日付' },
    notIncluded: { 'zh-Hant': '天頂距大氣延遲、極移、章動高階項', 'en': 'Zenith atmospheric delay, polar motion, higher-order nutation', 'ja': '天頂大気遅延、極運動、章動の高次項' },
  },
  {
    id: 'time-scales',
    label: { 'zh-Hant': '時間尺度（UTC / TT / ΔT）', 'en': 'Time scales (UTC / TT / ΔT)', 'ja': '時刻系（UTC / TT / ΔT）' },
    source: { 'zh-Hant': 'ΔT 用 Espenak-Meeus 2006 多項式；模擬 JD 視為 UTC ≈ UT1', 'en': 'ΔT from Espenak-Meeus 2006 polynomials; simulation JD treated as UTC ≈ UT1', 'ja': 'ΔTはEspenak-Meeus 2006多項式；シミュレーション JD は UTC ≈ UT1 として扱う' },
    accuracy: { 'zh-Hant': '現代 ΔT ±10s；古代（−500 至 +500）±30 min', 'en': 'Modern ΔT ±10s; antiquity (−500 to +500) ±30 min', 'ja': '現代 ΔT ±10s、古代（−500〜+500）±30分' },
    validRange: { 'zh-Hant': '−1999 至 +3000', 'en': '−1999 to +3000', 'ja': '−1999〜+3000' },
    notIncluded: { 'zh-Hant': '所有計算目前未把 UTC ↔ TT 區分傳到 propagator —— 現代日期影響可忽略，歷史日食可能有 ±tens 秒誤差', 'en': 'Propagators don\'t currently distinguish UTC vs TT — negligible for modern dates, ~tens of seconds error for historical eclipses', 'ja': '伝搬関数は現在 UTC vs TT を区別していない —— 現代の日付では無視できるが、歴史日食では±数十秒の誤差あり' },
  },
  {
    id: 'nbody',
    label: { 'zh-Hant': 'N-body 重力模擬（可選）', 'en': 'N-body gravity (optional)', 'ja': 'N-body重力（オプション）' },
    source: { 'zh-Hant': 'Velocity Verlet 或 Yoshida 4 階；可選水星近日點 GR 修正', 'en': 'Velocity Verlet or Yoshida 4th order; optional Mercury perihelion GR correction', 'ja': 'Velocity Verlet または Yoshida 4次；水星近日点GR補正は任意' },
    accuracy: { 'zh-Hant': '能量守恆 ~10⁻⁶ 級；長期演化才看得到攝動效果', 'en': 'Energy conservation ~10⁻⁶; perturbation effects only visible over long simulations', 'ja': 'エネルギー保存 ~10⁻⁶；摂動効果は長期シミュレーションでのみ顕在化' },
    validRange: { 'zh-Hant': '步長相關；預設 1 day/step 對行星穩定', 'en': 'Step-size dependent; default 1 day/step is stable for planets', 'ja': 'ステップ依存；デフォルト1日/ステップで惑星は安定' },
    notIncluded: { 'zh-Hant': '彗星與太空船不參與攝動；非重力項（彗星 outgassing、輻射壓）未建模', 'en': 'Comets and spacecraft don\'t feed back perturbations; non-gravitational forces (comet outgassing, radiation pressure) not modelled', 'ja': '彗星と宇宙船は摂動に寄与しない；非重力項（彗星アウトガス、放射圧）はモデル化されていない' },
  },
];
