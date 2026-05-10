/**
 * RA/Dec → IAU 88 constellation 3-letter abbreviation.
 *
 * Lazy-loads `/iau-boundaries.json` (the d3-celestial GeoJSON also used
 * by the IAUBoundaries scene layer) on first call. Until the data is
 * loaded the lookup returns null, so callers should treat null as
 * "unknown" and not render an empty value as if it meant "no
 * constellation".
 *
 * Algorithm: simple even-odd point-in-polygon ray-cast against each of
 * the 88 polygons. The d3-celestial dataset stores RA in degrees in
 * the range -180..180 (with the meridian at 0); we normalise the
 * query into the same range, and per-polygon we collapse RA wrap
 * (max-min > 180°) by shifting the negative-RA vertices by +360°
 * so the polygon stays simply-connected for the ray test. A simple
 * dec bbox filter short-circuits the 88-polygon scan.
 *
 * Accuracy: good enough for "what constellation is Jupiter in tonight"
 * (matches authoritative tables for non-pole bodies). Not suitable for
 * sub-arcsec automated boundary classification.
 */
export type ConstellationAbbr = string;  // IAU 3-letter (e.g. 'Ori', 'UMa')

interface Poly {
  id: ConstellationAbbr;
  /** Vertices as (raDeg, decDeg) pairs after wrap normalisation. */
  verts: Array<[number, number]>;
  /** Bounding box for fast reject; raMin/raMax in the same coord system as verts. */
  raMin: number; raMax: number; decMin: number; decMax: number;
  /** True iff polygon crossed the RA wrap and verts have been shifted. */
  wrapped: boolean;
}

interface GeoJSONFC {
  features: Array<{
    id: string;
    geometry: {
      type: 'Polygon' | 'MultiPolygon';
      coordinates: number[][][] | number[][][][];
    };
  }>;
}

let polygons: Poly[] | null = null;
let loadPromise: Promise<void> | null = null;

/**
 * Begin loading the IAU boundaries data. Idempotent. Resolves when
 * polygons are ready; subsequent calls share the same in-flight promise.
 */
export async function loadConstellationData(url = '/iau-boundaries.json'): Promise<void> {
  if (polygons) return;
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`constellationLookup load failed: ${resp.status}`);
    const data = await resp.json() as GeoJSONFC;
    polygons = parsePolygons(data);
  })();
  return loadPromise;
}

function parsePolygons(data: GeoJSONFC): Poly[] {
  const out: Poly[] = [];
  for (const feat of data.features) {
    const id = (feat.id ?? '').toString();
    if (!id) continue;
    const rings = feat.geometry.type === 'Polygon'
      ? [feat.geometry.coordinates as number[][][]]
      : (feat.geometry.coordinates as number[][][][]);
    for (const polygon of rings) {
      // Use only the outer ring (ring 0) — IAU polygons don't have holes.
      const ring = polygon[0];
      if (!ring || ring.length < 3) continue;
      let raMin = Infinity, raMax = -Infinity;
      for (const [ra] of ring) { if (ra < raMin) raMin = ra; if (ra > raMax) raMax = ra; }
      // If the polygon's RA range exceeds 180° it crosses the antimeridian
      // (the common case is Eridanus or octans-area polygons spanning 0).
      // Shift negatives by +360 so verts live in [0..360+] and the ray
      // test runs on a simply-connected shape.
      const wrapped = raMax - raMin > 180;
      const verts: Array<[number, number]> = ring.map(([ra, dec]) =>
        [wrapped && ra < 0 ? ra + 360 : ra, dec] as [number, number]);
      const ras = verts.map(v => v[0]);
      const decs = verts.map(v => v[1]);
      out.push({
        id,
        verts,
        raMin: Math.min(...ras), raMax: Math.max(...ras),
        decMin: Math.min(...decs), decMax: Math.max(...decs),
        wrapped,
      });
    }
  }
  return out;
}

/**
 * Look up the IAU constellation containing the point (ra, dec).
 *  - raHours: 0..24
 *  - decDeg: -90..+90
 * Returns the 3-letter abbreviation (e.g. 'Tau' for Taurus) or null
 * if the data hasn't loaded yet or the point fell outside every
 * polygon (shouldn't happen for valid coords).
 */
export function constellationFor(raHours: number, decDeg: number): ConstellationAbbr | null {
  if (!polygons) return null;
  // Normalise to (-180..180] to match the d3-celestial coordinate
  // convention (most polygons live there; wrapped ones are also tested
  // against a +360-shifted query).
  const raDeg = ((raHours * 15 + 180) % 360 + 360) % 360 - 180;
  const raDegShifted = raDeg < 0 ? raDeg + 360 : raDeg;
  for (const p of polygons) {
    if (decDeg < p.decMin || decDeg > p.decMax) continue;
    const queryRa = p.wrapped ? raDegShifted : raDeg;
    if (queryRa < p.raMin || queryRa > p.raMax) continue;
    if (pointInPolygon(queryRa, decDeg, p.verts)) return p.id;
  }
  return null;
}

function pointInPolygon(x: number, y: number, verts: Array<[number, number]>): boolean {
  let inside = false;
  for (let i = 0, j = verts.length - 1; i < verts.length; j = i++) {
    const [xi, yi] = verts[i];
    const [xj, yj] = verts[j];
    const intersects = ((yi > y) !== (yj > y))
      && (x < (xj - xi) * (y - yi) / (yj - yi + 1e-30) + xi);
    if (intersects) inside = !inside;
  }
  return inside;
}
