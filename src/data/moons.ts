import { KeplerPropagator } from '../physics/keplerPropagator';
import { LunarPropagator } from '../physics/lunarPosition';
import type { BodyDescriptor } from '../physics/types';
import { DETAILS } from './body-details';

/**
 * Major moons. Orbital elements are simplified: we use mean values for
 * (a, e, i) plus a synthetic L̇ derived from the orbital period. The starting
 * mean longitude is approximate; for visual purposes this is fine. Kepler
 * elements are relative to the parent planet's local equatorial / orbital
 * plane (we treat them as if in the parent's reference plane — good enough
 * for visualisation, can be refined when we add a precession model).
 *
 * Distances in AU (converted from km).
 */

const KM_PER_AU = 1.495978707e8;

function toAU(km: number): number {
  return km / KM_PER_AU;
}

function moonProp(opts: {
  aKm: number;
  e: number;
  iDeg: number;
  LDeg: number;
  varpiDeg?: number;
  OmegaDeg?: number;
  periodDays: number;
}): KeplerPropagator {
  return new KeplerPropagator({
    a: toAU(opts.aKm),
    e: opts.e,
    iDeg: opts.iDeg,
    LDeg: opts.LDeg,
    LDotDeg: (360 / opts.periodDays) * 36525,
    varpiDeg: opts.varpiDeg ?? 0,
    OmegaDeg: opts.OmegaDeg ?? 0,
    periodDays: opts.periodDays,
  });
}

export const MOON: BodyDescriptor = {
  id: 'moon',
  name: '月球',
  nameEn: 'Moon',
  nameJa: '月',
  parentId: 'earth',
  category: 'moon',
  physical: { radiusKm: 1737.4, massKg: 7.342e22, rotationPeriodDays: 27.321661, axialTiltDeg: 6.68 },
  // Meeus 1998 ch. 47 perturbation theory — drops position error from
  // ~6 arcmin (basic Kepler) to ~10 arcsec, restoring eclipse / occultation
  // timing fidelity.
  propagator: new LunarPropagator(),
  appearance: { color: 0xb8b3a8, textureUrl: '/textures/moon.jpg' },
  details: DETAILS.moon,
};

export const IO: BodyDescriptor = {
  id: 'io',
  name: '木衛一（埃歐）',
  nameEn: 'Io',
  nameJa: 'イオ',
  parentId: 'jupiter',
  category: 'moon',
  physical: { radiusKm: 1821.6, massKg: 8.93e22, rotationPeriodDays: 1.769, axialTiltDeg: 0 },
  propagator: moonProp({ aKm: 421800, e: 0.0041, iDeg: 0.05, LDeg: 0, periodDays: 1.769137786 }),
  appearance: { color: 0xe6d36b },
};

export const EUROPA: BodyDescriptor = {
  id: 'europa',
  name: '木衛二（歐羅巴）',
  nameEn: 'Europa',
  nameJa: 'エウロパ',
  parentId: 'jupiter',
  category: 'moon',
  physical: { radiusKm: 1560.8, massKg: 4.8e22, rotationPeriodDays: 3.551, axialTiltDeg: 0.1 },
  propagator: moonProp({ aKm: 671100, e: 0.009, iDeg: 0.47, LDeg: 90, periodDays: 3.551181 }),
  appearance: { color: 0xc8b89a },
};

export const GANYMEDE: BodyDescriptor = {
  id: 'ganymede',
  name: '木衛三（甘尼米德）',
  nameEn: 'Ganymede',
  nameJa: 'ガニメデ',
  parentId: 'jupiter',
  category: 'moon',
  physical: { radiusKm: 2634.1, massKg: 1.4819e23, rotationPeriodDays: 7.155, axialTiltDeg: 0.33 },
  propagator: moonProp({ aKm: 1070400, e: 0.0013, iDeg: 0.2, LDeg: 180, periodDays: 7.15455296 }),
  appearance: { color: 0x9c9087 },
};

export const CALLISTO: BodyDescriptor = {
  id: 'callisto',
  name: '木衛四（卡利斯多）',
  nameEn: 'Callisto',
  nameJa: 'カリスト',
  parentId: 'jupiter',
  category: 'moon',
  physical: { radiusKm: 2410.3, massKg: 1.0759e23, rotationPeriodDays: 16.689, axialTiltDeg: 0 },
  propagator: moonProp({ aKm: 1882700, e: 0.0074, iDeg: 0.192, LDeg: 270, periodDays: 16.6890184 }),
  appearance: { color: 0x6e645c },
};

export const TITAN: BodyDescriptor = {
  id: 'titan',
  name: '土衛六（泰坦）',
  nameEn: 'Titan',
  nameJa: 'タイタン',
  parentId: 'saturn',
  category: 'moon',
  physical: { radiusKm: 2574.7, massKg: 1.3452e23, rotationPeriodDays: 15.945, axialTiltDeg: 0 },
  propagator: moonProp({ aKm: 1221870, e: 0.0288, iDeg: 0.34854, LDeg: 0, periodDays: 15.945421 }),
  appearance: { color: 0xd9a058 },
};

export const PHOBOS: BodyDescriptor = {
  id: 'phobos',
  name: '火衛一（福波斯）',
  nameEn: 'Phobos',
  nameJa: 'フォボス',
  parentId: 'mars',
  category: 'moon',
  physical: { radiusKm: 11.27, massKg: 1.0659e16, rotationPeriodDays: 0.31891, axialTiltDeg: 0 },
  propagator: moonProp({ aKm: 9376, e: 0.0151, iDeg: 1.093, LDeg: 0, periodDays: 0.31891 }),
  appearance: { color: 0x5e564c },
};

export const DEIMOS: BodyDescriptor = {
  id: 'deimos',
  name: '火衛二（德摩斯）',
  nameEn: 'Deimos',
  nameJa: 'デイモス',
  parentId: 'mars',
  category: 'moon',
  physical: { radiusKm: 6.2, massKg: 1.4762e15, rotationPeriodDays: 1.26244, axialTiltDeg: 0 },
  propagator: moonProp({ aKm: 23463, e: 0.00033, iDeg: 0.93, LDeg: 90, periodDays: 1.26244 }),
  appearance: { color: 0x70685c },
};

export const ENCELADUS: BodyDescriptor = {
  id: 'enceladus',
  name: '土衛二（恩克拉多斯）',
  nameEn: 'Enceladus',
  nameJa: 'エンケラドゥス',
  parentId: 'saturn',
  category: 'moon',
  physical: { radiusKm: 252.1, massKg: 1.08e20, rotationPeriodDays: 1.37022, axialTiltDeg: 0 },
  propagator: moonProp({ aKm: 238040, e: 0.0047, iDeg: 0.019, LDeg: 30, periodDays: 1.37022 }),
  appearance: { color: 0xf0f4ff },
};

export const RHEA: BodyDescriptor = {
  id: 'rhea',
  name: '土衛五（瑞亞）',
  nameEn: 'Rhea',
  nameJa: 'レア',
  parentId: 'saturn',
  category: 'moon',
  physical: { radiusKm: 763.5, massKg: 2.307e21, rotationPeriodDays: 4.518, axialTiltDeg: 0 },
  propagator: moonProp({ aKm: 527108, e: 0.001, iDeg: 0.345, LDeg: 60, periodDays: 4.518 }),
  appearance: { color: 0xc0bcb0 },
};

export const IAPETUS: BodyDescriptor = {
  id: 'iapetus',
  name: '土衛八（伊阿珀托斯）',
  nameEn: 'Iapetus',
  nameJa: 'イアペトゥス',
  parentId: 'saturn',
  category: 'moon',
  physical: { radiusKm: 734.5, massKg: 1.806e21, rotationPeriodDays: 79.32, axialTiltDeg: 0 },
  propagator: moonProp({ aKm: 3560820, e: 0.0286, iDeg: 15.47, LDeg: 120, periodDays: 79.32 }),
  appearance: { color: 0x8c7060 },
};

export const TITANIA: BodyDescriptor = {
  id: 'titania',
  name: '天衛三（泰坦尼亞）',
  nameEn: 'Titania',
  nameJa: 'チタニア',
  parentId: 'uranus',
  category: 'moon',
  physical: { radiusKm: 788.4, massKg: 3.4e21, rotationPeriodDays: 8.706, axialTiltDeg: 0 },
  propagator: moonProp({ aKm: 435910, e: 0.0011, iDeg: 0.34, LDeg: 0, periodDays: 8.706 }),
  appearance: { color: 0xa0a0a0 },
};

export const OBERON: BodyDescriptor = {
  id: 'oberon',
  name: '天衛四（奧伯龍）',
  nameEn: 'Oberon',
  nameJa: 'オベロン',
  parentId: 'uranus',
  category: 'moon',
  physical: { radiusKm: 761.4, massKg: 3.076e21, rotationPeriodDays: 13.46, axialTiltDeg: 0 },
  propagator: moonProp({ aKm: 583520, e: 0.0014, iDeg: 0.058, LDeg: 90, periodDays: 13.46 }),
  appearance: { color: 0x988476 },
};

export const TRITON: BodyDescriptor = {
  id: 'triton',
  name: '海衛一（崔頓）',
  nameEn: 'Triton',
  nameJa: 'トリトン',
  parentId: 'neptune',
  category: 'moon',
  physical: { radiusKm: 1353.4, massKg: 2.14e22, rotationPeriodDays: -5.877, axialTiltDeg: 0 },
  // Retrograde orbit — encoded as negative period in moonProp wouldn't work; use positive for visualization.
  propagator: moonProp({ aKm: 354759, e: 0.000016, iDeg: 156.865, LDeg: 0, periodDays: 5.877 }),
  appearance: { color: 0xd5b88a },
};

export const MOONS: BodyDescriptor[] = [
  MOON, PHOBOS, DEIMOS,
  IO, EUROPA, GANYMEDE, CALLISTO,
  TITAN, ENCELADUS, RHEA, IAPETUS,
  TITANIA, OBERON,
  TRITON,
];
