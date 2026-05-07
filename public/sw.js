/*
 * Service worker for 太陽系 3D 模擬.
 *
 * Strategy:
 *   - Pre-cache the app shell (HTML, manifest, icons). Tiny — keeps the
 *     "installable" + "loads instantly on second visit" promise without
 *     pinning multi-megabyte texture / star catalog assets up front.
 *   - Runtime cache: same-origin static assets (built JS / CSS, textures,
 *     star catalog JSON, screenshots). Stale-while-revalidate, so users
 *     get an offline-capable copy on first encounter and updates land in
 *     the background. Never blocks navigation.
 *   - Skip cross-origin: Esri / AWS / OSM / Wikipedia tiles are live-only.
 *     Caching them would (a) bloat user storage with one-off requests for
 *     specific lat/lon tiles, and (b) violate provider tile-usage policies
 *     ("no offline storage of tiles"). Let the browser handle them with
 *     normal HTTP cache semantics.
 *
 * Versioning:
 *   Bump CACHE_VERSION on any breaking change. The "activate" event purges
 *   anything not matching the current version, so stale workers + caches
 *   from previous versions clean themselves up.
 */
const CACHE_VERSION = 'v1-2026-05-07';
const SHELL_CACHE = `shell-${CACHE_VERSION}`;
const RUNTIME_CACHE = `runtime-${CACHE_VERSION}`;

const SHELL_FILES = [
  '/',
  '/manifest.webmanifest',
  '/favicon.ico',
  '/og-image.jpg',
  '/icons/icon-180.png',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_FILES))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names
          .filter((n) => n !== SHELL_CACHE && n !== RUNTIME_CACHE)
          .map((n) => caches.delete(n)),
      ),
    ).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Cross-origin: don't intercept. Lets browser obey CORS + provider policies.
  if (url.origin !== location.origin) return;

  // HTML navigation: network-first so users get fresh deploys immediately;
  // fall back to cached shell when offline.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(SHELL_CACHE).then((c) => c.put('/', copy));
          return res;
        })
        .catch(() => caches.match('/').then((m) => m ?? Response.error())),
    );
    return;
  }

  // Static assets: stale-while-revalidate. Hit cache instantly, refresh in
  // background. Vite-built assets have hashed filenames so stale revisions
  // are eventually evicted naturally.
  event.respondWith(
    caches.open(RUNTIME_CACHE).then(async (cache) => {
      const cached = await cache.match(req);
      const networkP = fetch(req)
        .then((res) => {
          if (res.ok) cache.put(req, res.clone());
          return res;
        })
        .catch(() => null);
      return cached ?? (await networkP) ?? Response.error();
    }),
  );
});
