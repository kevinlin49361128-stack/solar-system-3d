/**
 * Vercel Edge Function: reverse-proxy for CelesTrak GP/TLE element sets.
 *
 * SatelliteLayer.refreshFromCelesTrak() fetches each satellite's current
 * TLE so the ISS/Tiangong/etc. render at their ACTUAL positions instead of
 * a stale bundled snapshot. CelesTrak generally allows cross-origin reads,
 * but proxying here gives us a stable same-origin endpoint, input
 * validation, and an edge cache that is friendly to CelesTrak's request
 * limits.
 *
 * Query: /api/tle?catnr=<NORAD catalog number>. Returns the 3-line TLE
 * (name + line1 + line2) as text/plain. catnr is strictly validated to
 * digits to avoid turning this into an open proxy.
 *
 * Not part of the Vite/tsc build (tsconfig scoped to src/); Vercel compiles
 * api/* separately, so this stays dependency-free Web-standard code.
 */
export const config = { runtime: 'edge' };

export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const catnr = url.searchParams.get('catnr') ?? '';
  if (!/^\d{1,6}$/.test(catnr)) {
    return new Response('bad catnr', {
      status: 400,
      headers: { 'access-control-allow-origin': '*' },
    });
  }
  const target = `https://celestrak.org/NORAD/elements/gp.php?CATNR=${catnr}&FORMAT=TLE`;
  try {
    const upstream = await fetch(target, { headers: { 'user-agent': 'solar-system-3d' } });
    const body = await upstream.text();
    return new Response(body, {
      status: upstream.status,
      headers: {
        'content-type': 'text/plain; charset=utf-8',
        // 6h shared edge cache, 1h browser — TLEs update a few times a day.
        'cache-control': 'public, max-age=3600, s-maxage=21600',
        'access-control-allow-origin': '*',
      },
    });
  } catch {
    return new Response('tle proxy upstream failed', {
      status: 502,
      headers: { 'access-control-allow-origin': '*' },
    });
  }
}
