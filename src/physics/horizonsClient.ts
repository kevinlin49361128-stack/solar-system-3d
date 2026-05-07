import { Vector3 } from 'three';
import { J2000_JD } from './constants';

/**
 * Thin client for NASA JPL Horizons API. Returns ephemeris data for any
 * solar-system body identified by SPK ID, IAU number, or Horizons-recognised
 * name string ("499" / "Mars" / "C/2014 Q2" / etc.).
 *
 * Routed through Vite's dev-server proxy at /api/horizons to bypass CORS;
 * production deployments need a matching reverse-proxy (Cloudflare Worker,
 * Netlify Function, etc.).
 *
 * Documentation: https://ssd-api.jpl.nasa.gov/doc/horizons.html
 */

export interface HorizonsStateVector {
  /** Heliocentric ecliptic position (J2000 frame), AU. */
  position: Vector3;
  /** Velocity in AU/day. */
  velocity: Vector3;
  /** The Julian Date the data was sampled at. */
  jd: number;
}

export interface HorizonsBodyInfo {
  /** Heliocentric ecliptic position over time. */
  states: HorizonsStateVector[];
  /** Body name as Horizons returns it (sometimes more verbose than the query). */
  name: string;
}

/**
 * Build the Horizons API query URL. Heliocentric ecliptic mean-of-J2000
 * vectors via VECTOR ephemeris type.
 */
function buildUrl(opts: {
  command: string;       // body identifier
  startJd: number;
  stopJd: number;
  stepDays?: number;     // defaults to 1
}): string {
  const params = new URLSearchParams({
    format: 'json',
    EPHEM_TYPE: 'VECTORS',
    OBJ_DATA: 'NO',
    MAKE_EPHEM: 'YES',
    COMMAND: `'${opts.command}'`,
    CENTER: "'@sun'",
    REF_PLANE: 'ECLIPTIC',
    REF_SYSTEM: 'J2000',
    VEC_TABLE: '2',          // 2 = position + velocity
    VEC_LABELS: 'NO',
    OUT_UNITS: 'AU-D',       // AU + days
    CSV_FORMAT: 'YES',
    START_TIME: `'JD${opts.startJd.toFixed(5)}'`,
    STOP_TIME:  `'JD${opts.stopJd.toFixed(5)}'`,
    STEP_SIZE:  `'${opts.stepDays ?? 1}d'`,
  });
  return `/api/horizons?${params.toString()}`;
}

/**
 * Parse Horizons VECTORS CSV-format response. The relevant block sits between
 * `$$SOE` and `$$EOE` markers and looks like:
 *
 *   2460000.500000000, A.D. 2023-Feb-25 00:00:00.0000, X, Y, Z, VX, VY, VZ
 *
 * (Order of columns confirmed by the Horizons documentation when CSV_FORMAT
 * is YES + VEC_LABELS is NO + VEC_TABLE 2.)
 */
function parseVectorBlock(text: string): HorizonsStateVector[] {
  const start = text.indexOf('$$SOE');
  const end = text.indexOf('$$EOE');
  if (start < 0 || end < 0) return [];
  const block = text.slice(start + 5, end).trim();
  const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
  const out: HorizonsStateVector[] = [];
  for (const line of lines) {
    const cols = line.split(',').map(c => c.trim());
    if (cols.length < 8) continue;
    const jd = parseFloat(cols[0]);
    const x  = parseFloat(cols[2]);
    const y  = parseFloat(cols[3]);
    const z  = parseFloat(cols[4]);
    const vx = parseFloat(cols[5]);
    const vy = parseFloat(cols[6]);
    const vz = parseFloat(cols[7]);
    if ([jd, x, y, z, vx, vy, vz].some(n => !Number.isFinite(n))) continue;
    out.push({
      position: new Vector3(x, y, z),
      velocity: new Vector3(vx, vy, vz),
      jd,
    });
  }
  return out;
}

/**
 * Fetch heliocentric ecliptic state vectors for `body` over the given Julian
 * Date range. Returns an empty array on network/parse failure (caller can
 * fall back to its existing Kepler propagator).
 */
export async function fetchHorizonsVectors(
  body: string,
  startJd: number = J2000_JD,
  stopJd: number = J2000_JD + 30,
  stepDays: number = 1,
): Promise<HorizonsBodyInfo> {
  try {
    const url = buildUrl({ command: body, startJd, stopJd, stepDays });
    const r = await fetch(url);
    if (!r.ok) {
      console.warn('Horizons fetch failed', r.status, body);
      return { states: [], name: body };
    }
    const json = await r.json() as { result?: string };
    if (!json.result) return { states: [], name: body };
    const states = parseVectorBlock(json.result);
    // Pull the body name out of the result header for display.
    const nameMatch = /Target body name:\s+([^\n]+?)(?:\s+\{source|$)/i.exec(json.result);
    const name = nameMatch ? nameMatch[1].trim() : body;
    return { states, name };
  } catch (err) {
    console.warn('Horizons fetch error', err);
    return { states: [], name: body };
  }
}

/**
 * Convenience: fetch a single state vector at the specified JD by requesting
 * a 1-step range and returning the first sample. Useful for "snap an asteroid
 * to its current accurate position then hand it to a local Kepler fit".
 */
export async function fetchHorizonsStateAt(
  body: string,
  jd: number,
): Promise<HorizonsStateVector | null> {
  const info = await fetchHorizonsVectors(body, jd, jd + 1, 1);
  return info.states[0] ?? null;
}
