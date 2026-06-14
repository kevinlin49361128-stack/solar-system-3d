/// <reference types="vitest" />
import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 5180,
    strictPort: true,
    open: false,
    // CORS proxies mirroring the production Vercel edge functions in
    // api/horizons.ts and api/tle.ts. The upstream APIs (JPL Horizons,
    // CelesTrak) either send no Access-Control-Allow-Origin or are
    // friendlier through a same-origin proxy, so dev routes them here and
    // prod routes the identical paths through the edge functions.
    proxy: {
      '/api/horizons': {
        target: 'https://ssd.jpl.nasa.gov',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api\/horizons/, '/api/horizons.api'),
      },
      '/api/tle': {
        target: 'https://celestrak.org',
        changeOrigin: true,
        rewrite: (p) => {
          const catnr = new URL(p, 'http://x').searchParams.get('catnr') ?? '';
          return `/NORAD/elements/gp.php?CATNR=${encodeURIComponent(catnr)}&FORMAT=TLE`;
        },
      },
    },
  },
  // Vitest: physics tests run in node (default); UI smoke tests opt into
  // happy-dom by inserting `// @vitest-environment happy-dom` at the top
  // of the file. Cheaper than forcing happy-dom globally for the 100+
  // pure-math tests in physics/.
  test: {
    environment: 'node',
    setupFiles: ['./test/setup.ts'],
    // `npm run test:coverage` surfaces blind spots (run on demand, no gate).
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['**/*.test.ts', 'src/main.ts', 'src/vite-env.d.ts'],
    },
  },
  build: {
    target: 'es2022',
    sourcemap: true,
    // The default 500 KB warning fires on minified RAW size; our real
    // transfer is ~320 KB gzip (three ~142 + index ~176), healthy for a
    // WebGL app. Raise the threshold so the build log isn't misleading.
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        // Split Three.js into its own vendor chunk. Three is ~600 KB raw
        // / ~150 KB gz and never changes between deploys, so isolating it
        // lets the browser long-cache the heavy bit while our app code
        // (which DOES change between deploys) lives in a small chunk
        // that gets re-downloaded. Net effect: returning visitors save
        // ~150 KB on every release.
        // (Function form — vite 8 / rolldown dropped the object syntax.)
        manualChunks(id: string) {
          if (id.includes('node_modules/three/')) return 'three';
        },
      },
    },
  },
});
