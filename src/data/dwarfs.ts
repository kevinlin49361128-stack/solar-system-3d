import { KeplerPropagator } from '../physics/keplerPropagator';
import type { BodyDescriptor } from '../physics/types';

/**
 * Dwarf planets. Mean orbital elements (J2000 epoch where available),
 * approximate. Sufficient for visualisation; for precise ephemeris use a
 * dedicated propagator from JPL Horizons later.
 */

export const CERES: BodyDescriptor = {
  id: 'ceres',
  name: '穀神星',
  nameEn: 'Ceres',
  nameJa: 'ケレス',
  parentId: null,
  category: 'dwarf',
  physical: { radiusKm: 473, massKg: 9.38e20, rotationPeriodDays: 0.3781, axialTiltDeg: 4 },
  propagator: new KeplerPropagator({
    a: 2.7691652, e: 0.0760091, iDeg: 10.59407,
    LDeg: 95.989, LDotDeg: (360 / 1683.145) * 36525,
    varpiDeg: 73.597 + 80.305, OmegaDeg: 80.305,
    periodDays: 1683.145,
  }),
  appearance: { color: 0x9b8c7a },
};

export const PLUTO: BodyDescriptor = {
  id: 'pluto',
  name: '冥王星',
  nameEn: 'Pluto',
  nameJa: '冥王星',
  parentId: null,
  category: 'dwarf',
  physical: {
    radiusKm: 1188.3, massKg: 1.303e22, rotationPeriodDays: -6.387, axialTiltDeg: 122.53,
    // Pluto's spin axis points well south of the ecliptic (122.5° tilt).
    // IAU values; Pluto's mutual orbit with Charon makes the system's
    // barycentre wobble visible but the body orientation is well-defined.
    poleRaJ2000Deg: 132.993, poleDecJ2000Deg: -6.163,
  },
  propagator: new KeplerPropagator({
    a: 39.482, e: 0.2488, iDeg: 17.16,
    LDeg: 238.92881, LDotDeg: (360 / 90560) * 36525,
    varpiDeg: 113.834 + 110.299, OmegaDeg: 110.299,
    periodDays: 90560,
  }),
  appearance: { color: 0xc4a48a },
};

export const HAUMEA: BodyDescriptor = {
  id: 'haumea',
  name: '妊神星',
  nameEn: 'Haumea',
  nameJa: 'ハウメア',
  parentId: null,
  category: 'dwarf',
  physical: { radiusKm: 780, massKg: 4.006e21, rotationPeriodDays: 0.163, axialTiltDeg: 0 },
  propagator: new KeplerPropagator({
    a: 43.13, e: 0.19126, iDeg: 28.19,
    LDeg: 209.07, LDotDeg: (360 / 103774) * 36525,
    varpiDeg: 239.18 + 121.79, OmegaDeg: 121.79,
    periodDays: 103774,
  }),
  appearance: { color: 0xe0d8c8 },
};

export const MAKEMAKE: BodyDescriptor = {
  id: 'makemake',
  name: '鳥神星',
  nameEn: 'Makemake',
  nameJa: 'マケマケ',
  parentId: null,
  category: 'dwarf',
  physical: { radiusKm: 715, massKg: 3.1e21, rotationPeriodDays: 0.95, axialTiltDeg: 0 },
  propagator: new KeplerPropagator({
    a: 45.79, e: 0.159, iDeg: 28.96,
    LDeg: 165.51, LDotDeg: (360 / 112897) * 36525,
    varpiDeg: 296.50 + 79.31, OmegaDeg: 79.31,
    periodDays: 112897,
  }),
  appearance: { color: 0xb88862 },
};

export const ERIS: BodyDescriptor = {
  id: 'eris',
  name: '鬩神星',
  nameEn: 'Eris',
  nameJa: 'エリス',
  parentId: null,
  category: 'dwarf',
  physical: { radiusKm: 1163, massKg: 1.66e22, rotationPeriodDays: 1.08, axialTiltDeg: 0 },
  propagator: new KeplerPropagator({
    a: 67.864, e: 0.43607, iDeg: 44.04,
    LDeg: 205.989, LDotDeg: (360 / 203830) * 36525,
    varpiDeg: 151.64 + 35.95, OmegaDeg: 35.95,
    periodDays: 203830,
  }),
  appearance: { color: 0xd6cfc2 },
};

export const DWARFS: BodyDescriptor[] = [CERES, PLUTO, HAUMEA, MAKEMAKE, ERIS];
