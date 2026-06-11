import { describe, it, expect } from 'vitest';
import {
  cardinalLabel, paCardinal, formatRate, formatFov, formatFocal,
  formatLocalMeanTime,
} from './readoutFormat';

describe('cardinalLabel', () => {
  it('maps the 8 principal azimuths', () => {
    expect(cardinalLabel(0)).toBe('N');
    expect(cardinalLabel(45)).toBe('NE');
    expect(cardinalLabel(90)).toBe('E');
    expect(cardinalLabel(135)).toBe('SE');
    expect(cardinalLabel(180)).toBe('S');
    expect(cardinalLabel(225)).toBe('SW');
    expect(cardinalLabel(270)).toBe('W');
    expect(cardinalLabel(315)).toBe('NW');
  });

  it('wraps near 360° back to N', () => {
    expect(cardinalLabel(359)).toBe('N');
    expect(cardinalLabel(337)).toBe('NW'); // 337.5 is the NW/N boundary
    expect(cardinalLabel(338)).toBe('N');
  });

  it('rounds to the nearest sector', () => {
    expect(cardinalLabel(22)).toBe('N');   // 22 < 22.5 boundary
    expect(cardinalLabel(23)).toBe('NE');
  });
});

describe('paCardinal', () => {
  it('maps PA to arrow glyphs (0 = up, 90 = right/east)', () => {
    expect(paCardinal(0)).toBe('↑');
    expect(paCardinal(90)).toBe('→');
    expect(paCardinal(180)).toBe('↓');
    expect(paCardinal(270)).toBe('←');
  });

  it('wraps near 360° back to up', () => {
    expect(paCardinal(350)).toBe('↑');
  });
});

describe('formatRate', () => {
  it('uses ″/s below 60″/s', () => {
    expect(formatRate(15.04)).toBe('15.04″/s'); // sidereal rate
    expect(formatRate(0.5)).toBe('0.50″/s');
  });

  it('switches to ′/s at 60″/s', () => {
    expect(formatRate(60)).toBe('1.00′/s');
    expect(formatRate(90)).toBe('1.50′/s');
  });
});

describe('formatFov', () => {
  it('degrees with 1 decimal at ≥10°', () => {
    expect(formatFov(45)).toBe('45.0°');
  });
  it('degrees with 2 decimals below 10°', () => {
    expect(formatFov(5)).toBe('5.00°');
  });
  it('arcminutes below 1°', () => {
    expect(formatFov(0.5)).toBe('30.0′');
    expect(formatFov(0.1)).toBe('6.00′');
  });
  it('arcseconds below 1′', () => {
    expect(formatFov(0.01)).toBe('36.0″');
  });
});

describe('formatFocal', () => {
  it('metres at ≥1000 mm', () => {
    expect(formatFocal(1500)).toBe('1.50 m');
  });
  it('integer mm in the 100–999 range', () => {
    expect(formatFocal(250)).toBe('250 mm');
  });
  it('1-decimal mm below 100', () => {
    expect(formatFocal(50)).toBe('50.0 mm');
  });
});

describe('formatLocalMeanTime', () => {
  // JD 2451545.0 = 2000-01-01 12:00:00 UT exactly.
  const J2000 = 2451545.0;

  it('Greenwich noon at J2000 epoch', () => {
    expect(formatLocalMeanTime(J2000, 0)).toBe('12:00:00');
  });

  it('+15° longitude = +1 h local mean time', () => {
    expect(formatLocalMeanTime(J2000, 15)).toBe('13:00:00');
  });

  it('Taipei (121.56°E) ≈ UT+8h06m', () => {
    expect(formatLocalMeanTime(J2000, 121.56)).toBe('20:06:14');
  });

  it('western longitudes run behind UT', () => {
    expect(formatLocalMeanTime(J2000, -75)).toBe('07:00:00');
  });

  it('wraps across midnight', () => {
    expect(formatLocalMeanTime(J2000, 180)).toBe('00:00:00');
  });
});
