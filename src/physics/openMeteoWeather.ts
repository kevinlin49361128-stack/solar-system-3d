/**
 * Lightweight Open-Meteo client for "is tonight a go?" observation
 * planning.
 *
 * Open-Meteo is free, requires no API key, and responds with CORS
 * headers — so we can call it directly from the browser. The free
 * tier explicitly permits non-commercial use; for our hobby project
 * + the (rare) high-traffic Show-HN spike we stay well under the
 * documented 10 000 requests / day / IP soft limit because we cache
 * aggressively.
 *
 * The fetch is **opt-in**: the caller passes a `consent: true` flag
 * (driven by a user-toggleable preference) so that
 *   (a) PWA / offline users never get a surprise outbound request,
 *   (b) privacy-conscious users see a clear "opt in to fetch
 *       weather from open-meteo.com" toggle before any GeoIP-ish
 *       data leaves their browser.
 *
 * Caching: in-memory only, keyed on (lat_rounded_2dp, lon_rounded_2dp).
 * Round to ~1 km grid so a user nudging the location pin within a
 * city doesn't refetch. 30-minute TTL — Open-Meteo's hourly forecast
 * doesn't change faster than that.
 */

export interface CurrentWeather {
  cloudCoverPct: number;    // 0–100, where 0 is "completely clear"
  tempC: number;
  windKph: number;
  /** YYYY-MM-DDTHH:00 from the Open-Meteo response (UTC) for the
   *  matched forecast hour. */
  observationTime: string;
  /** Wall-clock time when this data was fetched, for cache freshness. */
  fetchedAt: number;
}

interface CacheEntry {
  data: CurrentWeather;
  fetchedAt: number;
}

const CACHE_TTL_MS = 30 * 60 * 1000;
const cache = new Map<string, CacheEntry>();

function cacheKey(lat: number, lon: number): string {
  // 0.01° ≈ 1.1 km — small enough that observation-relevant terrain
  // doesn't change, large enough that the cache actually hits.
  return `${lat.toFixed(2)},${lon.toFixed(2)}`;
}

/**
 * Fetch current-hour weather for (lat, lon). Returns the cached entry
 * if one was fetched within the last 30 minutes for this rounded grid
 * cell. Returns null on network error / consent missing / malformed
 * response — callers should fall back to displaying nothing rather
 * than blocking.
 */
export async function fetchCurrentWeather(
  lat: number, lon: number, consent: boolean,
): Promise<CurrentWeather | null> {
  if (!consent) return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

  const key = cacheKey(lat, lon);
  const cached = cache.get(key);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.data;
  }

  // The "current" endpoint returns just the current-hour reading,
  // which is all we need for "is the sky clear right now". For
  // future-tonight planning we'd switch to "/forecast" with hourly
  // arrays — left as a TODO once anyone actually asks.
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.searchParams.set('latitude', lat.toFixed(4));
  url.searchParams.set('longitude', lon.toFixed(4));
  url.searchParams.set('current', 'cloud_cover,temperature_2m,wind_speed_10m');
  url.searchParams.set('wind_speed_unit', 'kmh');
  url.searchParams.set('timezone', 'UTC');

  try {
    const resp = await fetch(url.toString(), {
      signal: AbortSignal.timeout(8000),  // bail fast if Open-Meteo lags
    });
    if (!resp.ok) return null;
    const json = await resp.json();
    const cur = json.current;
    if (!cur) return null;
    const data: CurrentWeather = {
      cloudCoverPct: typeof cur.cloud_cover === 'number' ? cur.cloud_cover : NaN,
      tempC:         typeof cur.temperature_2m === 'number' ? cur.temperature_2m : NaN,
      windKph:       typeof cur.wind_speed_10m === 'number' ? cur.wind_speed_10m : NaN,
      observationTime: typeof cur.time === 'string' ? cur.time : '',
      fetchedAt: Date.now(),
    };
    cache.set(key, { data, fetchedAt: data.fetchedAt });
    return data;
  } catch {
    return null;
  }
}

/** Consent state: persisted in localStorage so the toggle survives
 *  page reloads. Default false (opt-in). */
const CONSENT_KEY = 'sim:openMeteoConsent';
export function getOpenMeteoConsent(): boolean {
  try { return localStorage.getItem(CONSENT_KEY) === 'true'; } catch { return false; }
}
export function setOpenMeteoConsent(consent: boolean): void {
  try { localStorage.setItem(CONSENT_KEY, consent ? 'true' : 'false'); } catch { /* ignore */ }
}
