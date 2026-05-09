import type { LangText } from '../i18n';

/**
 * A two-body system whose Lagrange points are interesting enough to
 * visualize. Each entry references the body IDs already in the body
 * registry (so positions are read live from their propagators) and
 * provides display metadata for each of the five points.
 */
export interface LagrangeSystem {
  id: string;
  /** Body ID of the primary (more massive) body. */
  primaryId: string;
  /** Body ID of the secondary body. */
  secondaryId: string;
  /** Display name for the system label. */
  name: LangText;
  /** Marker hue used for all five points of this system. */
  color: number;
  /** Optional per-point notes. Keys are 'L1' through 'L5'. */
  notes?: Partial<Record<'L1' | 'L2' | 'L3' | 'L4' | 'L5', LangText>>;
}

export const LAGRANGE_SYSTEMS: LagrangeSystem[] = [
  {
    id: 'sun-earth',
    primaryId: 'sun',
    secondaryId: 'earth',
    name: { 'zh-Hant': '太陽–地球', 'en': 'Sun–Earth', 'ja': '太陽–地球' },
    color: 0xffe98a,
    notes: {
      L1: { 'zh-Hant': 'SOHO、ACE、DSCOVR 太陽觀測站', 'en': 'SOHO, ACE, DSCOVR solar observatories', 'ja': 'SOHO・ACE・DSCOVR' },
      L2: { 'zh-Hant': 'JWST、Gaia、Spektr-RG、Euclid', 'en': 'JWST, Gaia, Spektr-RG, Euclid', 'ja': 'JWST・Gaia・Euclid' },
      L4: { 'zh-Hant': '無天然小行星;曾是 STEREO-A 觀測點', 'en': 'No major Trojans (STEREO-A passed near here)', 'ja': '小天体は少ない' },
      L5: { 'zh-Hant': '無天然小行星;曾是 STEREO-B 觀測點', 'en': 'No major Trojans (STEREO-B passed near here)', 'ja': '小天体は少ない' },
    },
  },
  {
    id: 'sun-jupiter',
    primaryId: 'sun',
    secondaryId: 'jupiter',
    name: { 'zh-Hant': '太陽–木星', 'en': 'Sun–Jupiter', 'ja': '太陽–木星' },
    color: 0xff9b54,
    notes: {
      L4: { 'zh-Hant': '希臘群特洛伊小行星 (Greek camp)', 'en': 'Greek-camp Trojan asteroids (~6,000 known)', 'ja': 'ギリシア群トロヤ群小惑星' },
      L5: { 'zh-Hant': '特洛伊群小行星 (Trojan camp)', 'en': 'Trojan-camp asteroids (~4,000 known)', 'ja': 'トロヤ群小惑星' },
    },
  },
  {
    id: 'earth-moon',
    primaryId: 'earth',
    secondaryId: 'moon',
    name: { 'zh-Hant': '地球–月球', 'en': 'Earth–Moon', 'ja': '地球–月' },
    color: 0x9bc5ff,
    notes: {
      L1: { 'zh-Hant': '提議的月面門戶中繼站', 'en': 'Proposed Lunar Gateway relay', 'ja': '月ゲートウェイ案' },
      L2: { 'zh-Hant': '中國「鵲橋」中繼衛星', 'en': 'China\'s Queqiao relay (now Queqiao-2)', 'ja': '鵲橋中継衛星' },
      L4: { 'zh-Hant': '科爾迪萊夫斯基塵雲', 'en': 'Kordylewski dust clouds (faint)', 'ja': 'コーディレフスキー塵雲' },
      L5: { 'zh-Hant': '科爾迪萊夫斯基塵雲', 'en': 'Kordylewski dust clouds (faint)', 'ja': 'コーディレフスキー塵雲' },
    },
  },
];
