/**
 * Vercel Edge Function: reverse-proxy for the JPL Horizons API.
 *
 * The browser cannot call ssd.jpl.nasa.gov/api/horizons.api directly —
 * Horizons sends no Access-Control-Allow-Origin header, so the request is
 * blocked by CORS. In development Vite's server proxy handles /api/horizons
 * (see vite.config.ts); in production this function does the same job.
 *
 * The client (src/physics/horizonsClient.ts) builds the full query string;
 * we forward it verbatim to the upstream endpoint and stream the JSON back
 * with permissive CORS + an edge cache (ephemerides for a given query are
 * stable, so caching is safe and cuts latency + upstream load).
 *
 * Not part of the Vite/tsc build — Vercel compiles api/* on its own, and
 * tsconfig `include` is scoped to src/, so this file is intentionally
 * dependency-free Web-standard Request/Response code.
 */
export const config = { runtime: 'edge' };

const UPSTREAM = 'https://ssd.jpl.nasa.gov/api/horizons.api';

export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const target = UPSTREAM + url.search;
  try {
    const upstream = await fetch(target, { headers: { accept: 'application/json' } });
    const body = await upstream.text();
    return new Response(body, {
      status: upstream.status,
      headers: {
        'content-type': upstream.headers.get('content-type') ?? 'application/json',
        'cache-control': 'public, max-age=3600, s-maxage=86400',
        'access-control-allow-origin': '*',
      },
    });
  } catch {
    return new Response(JSON.stringify({ error: 'horizons proxy upstream failed' }), {
      status: 502,
      headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' },
    });
  }
}
