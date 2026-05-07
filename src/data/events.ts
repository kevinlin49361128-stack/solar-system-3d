/**
 * 著名 / 即將發生的天文事件。
 * 點擊條目時，模擬時間跳轉到該日期，並可選地切換相機到適當的天體。
 */

export interface AstroEvent {
  id: string;
  name: string;
  /** ISO date (UTC), 可含時間。 */
  iso: string;
  description: string;
  /** 事件最佳觀察的天體，作為 follow target。 */
  followBody?: string;
}

export const ASTRO_EVENTS: AstroEvent[] = [
  // —— 歷史 ——
  { id: 'apollo-11', name: '阿波羅 11 號登月', iso: '1969-07-20T20:17:00Z',
    description: '人類首次踏上月球。Apollo 11 任務由阿姆斯壯與奧爾德林著陸於靜海。',
    followBody: 'moon' },
  { id: 'voyager1-launch', name: '航海家 1 號發射', iso: '1977-09-05T12:56:00Z',
    description: '航海家 1 號從卡納維拉爾角升空，飛掠木星 (1979) 與土星 (1980)，今已進入星際空間。' },
  { id: 'shoemaker-levy-9', name: '舒梅克-李維 9 號彗星撞木星', iso: '1994-07-16T20:00:00Z',
    description: '21 個彗星碎片連續撞擊木星，留下地球大小的暗斑，持續可見數月。',
    followBody: 'jupiter' },
  { id: 'jwst-launch', name: '韋伯太空望遠鏡發射', iso: '2021-12-25T12:20:00Z',
    description: '人類迄今最強大的紅外太空望遠鏡，部署於日地 L2 點。' },
  { id: 'pluto-flyby', name: '新視野號飛掠冥王星', iso: '2015-07-14T11:49:00Z',
    description: '人類首次近距離觀察冥王星，發現其表面有著名「心型」平原 Sputnik Planitia。',
    followBody: 'pluto' },
  { id: 'great-conjunction-2020', name: '木土大合 (400 年最近)', iso: '2020-12-21T18:22:00Z',
    description: '木星與土星在天空中相距僅 0.1°，肉眼幾乎合而為一；上次如此接近是 1623 年。',
    followBody: 'jupiter' },

  // —— 預期可見事件 ——
  { id: 'eclipse-2026-08-12', name: '日全食（西班牙、冰島）', iso: '2026-08-12T17:46:00Z',
    description: '從格陵蘭、冰島、西班牙北部可見全食帶；歐洲 21 世紀首次大型日全食。' },
  { id: 'eclipse-2027-08-02', name: '日全食（埃及與利比亞，6m23s）', iso: '2027-08-02T10:07:00Z',
    description: '21 世紀最長日全食之一，最大食分達 6 分 23 秒，覆蓋北非與沙烏地阿拉伯。' },
  { id: 'mars-opposition-2027', name: '火星衝（最近一次絕佳觀察）', iso: '2027-02-19T00:00:00Z',
    description: '火星距地球約 0.68 AU，視直徑 13.8"，是 2025-2030 年期間最佳的觀火時機之一。',
    followBody: 'mars' },
  { id: 'venus-transit-no-more', name: '下次金星凌日 (2117 年)', iso: '2117-12-11T02:48:00Z',
    description: '上次 2012 年發生，本世紀內不會再有；下次要等到 2117。',
    followBody: 'venus' },
  { id: 'great-conjunction-2080', name: '木土大合 (60 年週期)', iso: '2080-03-15T00:00:00Z',
    description: '下次接近 2020 等級的木土大合；下下次要等到 2417 年。' },

  // —— 真實時刻 ——
  { id: 'now', name: '當前時刻', iso: 'now',
    description: '回到瀏覽器目前的真實時間。' },
];
