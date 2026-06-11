/// <reference types="vitest" />
import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 5180,
    strictPort: true,
    open: false,
    // CORS proxy for NASA JPL Horizons API. The public endpoint at
    // ssd.jpl.nasa.gov/api/horizons.api does NOT set Access-Control-Allow-Origin,
    // so direct fetch from a browser is blocked. Routing through the dev
    // server (or a deployed Cloudflare Worker / Netlify Function in prod)
    // strips that restriction. Production deploys must mirror this.
    proxy: {
      '/api/horizons': {
        target: 'https://ssd.jpl.nasa.gov',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api\/horizons/, '/api/horizons.api'),
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
  },
  build: {
    target: 'es2022',
    sourcemap: true,
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
