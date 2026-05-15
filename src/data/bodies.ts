import { KeplerPropagator } from '../physics/keplerPropagator';
import type { BodyDescriptor, PropagatorSource } from '../physics/types';
import { DETAILS } from './body-details';

/**
 * Sun + 8 planets.
 *
 * Orbital elements (J2000) and rates per Julian century are taken from
 * NASA JPL "Approximate Positions of the Planets":
 * https://ssd.jpl.nasa.gov/planets/approx_pos.html
 *
 * Period (days) is computed from L̇ when present; we set it explicitly so
 * mean motion in the propagator is correct without assumptions.
 */
const JPL_APPROX_POS: PropagatorSource = {
  label: 'NASA JPL Approximate Positions of the Planets',
  url: 'https://ssd.jpl.nasa.gov/planets/approx_pos.html',
  note: 'J2000 elements + linear rates (1800–2050, error < 600 km)',
  validJdMin: 2378497.5,  // 1800-01-01
  validJdMax: 2469807.5,  // 2050-01-01
};

export const SUN: BodyDescriptor = {
  id: 'sun',
  name: '太陽',
  nameEn: 'Sun',
  nameJa: '太陽',
  parentId: null,
  category: 'star',
  physical: {
    radiusKm: 695700,
    massKg: 1.98892e30,
    rotationPeriodDays: 25.05,
    axialTiltDeg: 7.25,
  },
  propagator: null,
  appearance: { color: 0xffd56b, emissive: true, textureUrl: '/textures/sun.jpg' },
  description: { 'zh-Hant': 'G2V 主序星，太陽系質量約佔 99.86%。', 'en': 'G2V main-sequence star; ~99.86% of solar-system mass.', 'ja': 'G2V 主系列星。太陽系全質量の 99.86% を占める。' },
  details: DETAILS.sun,
};

export const MERCURY: BodyDescriptor = {
  id: 'mercury',
  name: '水星',
  nameEn: 'Mercury',
  nameJa: '水星',
  parentId: null,
  category: 'planet',
  physical: { radiusKm: 2439.7, massKg: 3.3011e23, rotationPeriodDays: 58.646, axialTiltDeg: 0.034 },
  propagator: new KeplerPropagator({
    a: 0.38709927, aDot: 0.00000037,
    e: 0.20563593, eDot: 0.00001906,
    iDeg: 7.00497902, iDotDeg: -0.00594749,
    LDeg: 252.25032350, LDotDeg: 149472.67411175,
    varpiDeg: 77.45779628, varpiDotDeg: 0.16047689,
    OmegaDeg: 48.33076593, OmegaDotDeg: -0.12534081,
    periodDays: 87.9691,
  }, JPL_APPROX_POS),
  appearance: { color: 0x8c8275, textureUrl: '/textures/mercury.jpg' },
  details: DETAILS.mercury,
};

export const VENUS: BodyDescriptor = {
  id: 'venus',
  name: '金星',
  nameEn: 'Venus',
  nameJa: '金星',
  parentId: null,
  category: 'planet',
  physical: { radiusKm: 6051.8, massKg: 4.8675e24, rotationPeriodDays: -243.025, axialTiltDeg: 177.36 },
  propagator: new KeplerPropagator({
    a: 0.72333566, aDot: 0.00000390,
    e: 0.00677672, eDot: -0.00004107,
    iDeg: 3.39467605, iDotDeg: -0.00078890,
    LDeg: 181.97909950, LDotDeg: 58517.81538729,
    varpiDeg: 131.60246718, varpiDotDeg: 0.00268329,
    OmegaDeg: 76.67984255, OmegaDotDeg: -0.27769418,
    periodDays: 224.701,
  }, JPL_APPROX_POS),
  appearance: {
    color: 0xe4c186,
    textureUrl: '/textures/venus.jpg',
    atmosphere: { color: 0xf0d493, power: 2.0, scale: 1.06, intensity: 1.2 },
  },
  details: DETAILS.venus,
};

export const EARTH: BodyDescriptor = {
  id: 'earth',
  name: '地球',
  nameEn: 'Earth',
  nameJa: '地球',
  parentId: null,
  category: 'planet',
  physical: { radiusKm: 6371.0, massKg: 5.972e24, rotationPeriodDays: 0.99726968, axialTiltDeg: 23.4393 },
  propagator: new KeplerPropagator({
    a: 1.00000261, aDot: 0.00000562,
    e: 0.01671123, eDot: -0.00004392,
    iDeg: -0.00001531, iDotDeg: -0.01294668,
    LDeg: 100.46457166, LDotDeg: 35999.37244981,
    varpiDeg: 102.93768193, varpiDotDeg: 0.32327364,
    OmegaDeg: 0.0, OmegaDotDeg: 0.0,
    periodDays: 365.256,
  }, JPL_APPROX_POS),
  appearance: {
    color: 0x3d7ec9,
    textureUrl: '/textures/earth.jpg',
    cloudTextureUrl: '/textures/earth-clouds.jpg',
    nightTextureUrl: '/textures/earth-night.jpg',
    atmosphere: { color: 0x4a8eff, power: 2.5, scale: 1.025, intensity: 1.4 },
  },
  details: DETAILS.earth,
};

export const MARS: BodyDescriptor = {
  id: 'mars',
  name: '火星',
  nameEn: 'Mars',
  nameJa: '火星',
  parentId: null,
  category: 'planet',
  physical: { radiusKm: 3389.5, massKg: 6.4171e23, rotationPeriodDays: 1.02595675, axialTiltDeg: 25.19 },
  propagator: new KeplerPropagator({
    a: 1.52371034, aDot: 0.00001847,
    e: 0.09339410, eDot: 0.00007882,
    iDeg: 1.84969142, iDotDeg: -0.00813131,
    LDeg: -4.55343205, LDotDeg: 19140.30268499,
    varpiDeg: -23.94362959, varpiDotDeg: 0.44441088,
    OmegaDeg: 49.55953891, OmegaDotDeg: -0.29257343,
    periodDays: 686.971,
  }, JPL_APPROX_POS),
  appearance: {
    color: 0xc1542d,
    textureUrl: '/textures/mars.jpg',
    atmosphere: { color: 0xd07a3e, power: 3.0, scale: 1.015, intensity: 0.6 },
  },
  details: DETAILS.mars,
};

export const JUPITER: BodyDescriptor = {
  id: 'jupiter',
  name: '木星',
  nameEn: 'Jupiter',
  nameJa: '木星',
  parentId: null,
  category: 'planet',
  physical: { radiusKm: 69911, massKg: 1.8982e27, rotationPeriodDays: 0.41354, axialTiltDeg: 3.13 },
  propagator: new KeplerPropagator({
    a: 5.20288700, aDot: -0.00011607,
    e: 0.04838624, eDot: -0.00013253,
    iDeg: 1.30439695, iDotDeg: -0.00183714,
    LDeg: 34.39644051, LDotDeg: 3034.74612775,
    varpiDeg: 14.72847983, varpiDotDeg: 0.21252668,
    OmegaDeg: 100.47390909, OmegaDotDeg: 0.20469106,
    periodDays: 4332.589,
  }, JPL_APPROX_POS),
  appearance: {
    color: 0xd5b48a,
    textureUrl: '/textures/jupiter.jpg',
    atmosphere: { color: 0xc9a878, power: 2.5, scale: 1.03, intensity: 1.0 },
  },
  details: DETAILS.jupiter,
};

export const SATURN: BodyDescriptor = {
  id: 'saturn',
  name: '土星',
  nameEn: 'Saturn',
  nameJa: '土星',
  parentId: null,
  category: 'planet',
  physical: { radiusKm: 58232, massKg: 5.6834e26, rotationPeriodDays: 0.43958, axialTiltDeg: 26.73 },
  propagator: new KeplerPropagator({
    a: 9.53667594, aDot: -0.00125060,
    e: 0.05386179, eDot: -0.00050991,
    iDeg: 2.48599187, iDotDeg: 0.00193609,
    LDeg: 49.95424423, LDotDeg: 1222.49362201,
    varpiDeg: 92.59887831, varpiDotDeg: -0.41897216,
    OmegaDeg: 113.66242448, OmegaDotDeg: -0.28867794,
    periodDays: 10759.22,
  }, JPL_APPROX_POS),
  appearance: {
    color: 0xe6c87a,
    textureUrl: '/textures/saturn.jpg',
    atmosphere: { color: 0xe0c280, power: 2.5, scale: 1.04, intensity: 0.9 },
  },
  details: DETAILS.saturn,
};

export const URANUS: BodyDescriptor = {
  id: 'uranus',
  name: '天王星',
  nameEn: 'Uranus',
  nameJa: '天王星',
  parentId: null,
  category: 'planet',
  physical: { radiusKm: 25362, massKg: 8.6810e25, rotationPeriodDays: -0.71833, axialTiltDeg: 97.77 },
  propagator: new KeplerPropagator({
    a: 19.18916464, aDot: -0.00196176,
    e: 0.04725744, eDot: -0.00004397,
    iDeg: 0.77263783, iDotDeg: -0.00242939,
    LDeg: 313.23810451, LDotDeg: 428.48202785,
    varpiDeg: 170.95427630, varpiDotDeg: 0.40805281,
    OmegaDeg: 74.01692503, OmegaDotDeg: 0.04240589,
    periodDays: 30688.5,
  }, JPL_APPROX_POS),
  appearance: {
    color: 0x9fd6e2,
    textureUrl: '/textures/uranus.jpg',
    atmosphere: { color: 0x88c8e0, power: 2.5, scale: 1.04, intensity: 1.0 },
  },
  details: DETAILS.uranus,
};

export const NEPTUNE: BodyDescriptor = {
  id: 'neptune',
  name: '海王星',
  nameEn: 'Neptune',
  nameJa: '海王星',
  parentId: null,
  category: 'planet',
  physical: { radiusKm: 24622, massKg: 1.02413e26, rotationPeriodDays: 0.6713, axialTiltDeg: 28.32 },
  propagator: new KeplerPropagator({
    a: 30.06992276, aDot: 0.00026291,
    e: 0.00859048, eDot: 0.00005105,
    iDeg: 1.77004347, iDotDeg: 0.00035372,
    LDeg: -55.12002969, LDotDeg: 218.45945325,
    varpiDeg: 44.96476227, varpiDotDeg: -0.32241464,
    OmegaDeg: 131.78422574, OmegaDotDeg: -0.00508664,
    periodDays: 60182.0,
  }, JPL_APPROX_POS),
  appearance: {
    color: 0x4166f5,
    textureUrl: '/textures/neptune.jpg',
    atmosphere: { color: 0x4068ff, power: 2.5, scale: 1.04, intensity: 1.1 },
  },
  details: DETAILS.neptune,
};

export const PLANETS: BodyDescriptor[] = [
  MERCURY, VENUS, EARTH, MARS, JUPITER, SATURN, URANUS, NEPTUNE,
];

export const STARS_AND_PLANETS: BodyDescriptor[] = [SUN, ...PLANETS];
