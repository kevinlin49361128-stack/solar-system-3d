export interface BeltDefinition {
  id: string;
  name: string;
  count: number;
  /** Semi-major axis range (AU) */
  aRange: [number, number];
  /** Eccentricity range */
  eRange: [number, number];
  /** Inclination range (deg) */
  iRange: [number, number];
  color: number;
  particleSize: number;
}

export const ASTEROID_BELT: BeltDefinition = {
  id: 'asteroid-belt',
  name: '小行星帶',
  count: 5000,
  aRange: [2.2, 3.3],
  eRange: [0.0, 0.25],
  iRange: [0, 20],
  color: 0xb8a890,
  particleSize: 0.005,
};

export const KUIPER_BELT: BeltDefinition = {
  id: 'kuiper-belt',
  name: '古柏帶',
  count: 8000,
  aRange: [30, 50],
  eRange: [0.0, 0.15],
  iRange: [0, 30],
  color: 0xa8b8c8,
  particleSize: 0.012,
};

export const BELTS: BeltDefinition[] = [ASTEROID_BELT, KUIPER_BELT];
