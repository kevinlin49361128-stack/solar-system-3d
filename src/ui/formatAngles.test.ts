import { describe, it, expect } from 'vitest';
import { formatDMS } from './formatAngles';

describe('formatDMS', () => {
  it('formats a basic positive angle', () => {
    // 123.4567° = 123° + 0.4567×60′ = 123°27.402′ = 123°27′24.12″ → 123°27′24″
    expect(formatDMS(123.4567)).toBe('123°27′24″');
  });

  it('formats zero correctly', () => {
    expect(formatDMS(0)).toBe('0°00′00″');
    expect(formatDMS(0, true)).toBe('+0°00′00″');
  });

  it('omits sign for non-negative when signed=false', () => {
    expect(formatDMS(45.5)).toBe('45°30′00″');
  });

  it('shows + for non-negative when signed=true (altitude convention)', () => {
    expect(formatDMS(45.5, true)).toBe('+45°30′00″');
    expect(formatDMS(-12.5, true)).toBe('-12°30′00″');
  });

  it('shows - for negative regardless of signed flag', () => {
    expect(formatDMS(-1.5)).toBe('-1°30′00″');
    expect(formatDMS(-1.5, true)).toBe('-1°30′00″');
  });

  it('pads minutes and seconds to 2 digits', () => {
    expect(formatDMS(1.0166666)).toBe('1°01′00″'); // 1°1′0″ → 1°01′00″
    expect(formatDMS(10.005)).toBe('10°00′18″');
  });

  it('handles seconds-rounding carry into minutes', () => {
    // 0.9999° = 0°59′59.64″ → rounds to 60 → carries to 1°00′00″
    expect(formatDMS(0.9999)).toBe('1°00′00″');
  });

  it('handles double carry (s=60 → carry m=60 → carry d+1)', () => {
    // 12.9999° = 12°59′59.64″ → s rounds to 60 → m=60 → carry → d=13
    expect(formatDMS(12.9999)).toBe('13°00′00″');
  });

  it('preserves negative sign across carries', () => {
    expect(formatDMS(-0.9999, true)).toBe('-1°00′00″');
  });

  it('handles full circle azimuth values', () => {
    // 359.99999 → carries up to 360°00′00″
    expect(formatDMS(359.99999)).toBe('360°00′00″');
    expect(formatDMS(180)).toBe('180°00′00″');
  });

  it('handles tiny angles', () => {
    expect(formatDMS(0.001)).toBe('0°00′04″'); // 3.6″, rounds to 4″
    expect(formatDMS(0.000277)).toBe('0°00′01″'); // 1″
  });
});
