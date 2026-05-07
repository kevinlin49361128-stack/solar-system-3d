export const J2000_JD = 2451545.0;

export const AU_KM = 1.495978707e8;

export const DAY_SECONDS = 86400;

export const TWO_PI = Math.PI * 2;
export const DEG2RAD = Math.PI / 180;
export const RAD2DEG = 180 / Math.PI;

export const SUN_GM = 1.32712440018e20;

export const G = 6.67430e-11;

export function jdFromDate(date: Date): number {
  return date.getTime() / 86400000 + 2440587.5;
}

export function dateFromJd(jd: number): Date {
  return new Date((jd - 2440587.5) * 86400000);
}
