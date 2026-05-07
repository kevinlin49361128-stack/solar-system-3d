// Capture a batch of README showcase screenshots from the deployed site.
// Re-run after major UI / scene visual changes via `npm run screenshots`.
//
// Output: public/screenshots/{name}.jpg (committed for README to reference).

import puppeteer from 'puppeteer-core';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const URL_TO_CAPTURE = process.env.OG_URL ?? 'https://solar-system-3d-kappa.vercel.app/';
const OUT_DIR = resolve(__dirname, '../public/screenshots');
const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

mkdirSync(OUT_DIR, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: CHROME_PATH,
  headless: true,
  args: ['--enable-webgl', '--use-gl=angle', '--ignore-gpu-blocklist', '--no-sandbox'],
  defaultViewport: { width: 1600, height: 1000, deviceScaleFactor: 1 },
});

const page = await browser.newPage();
console.log(`Capturing: ${URL_TO_CAPTURE}`);
await page.goto(URL_TO_CAPTURE, { waitUntil: 'networkidle2', timeout: 30000 });
await page.waitForFunction(
  () => window.__debug?.renderer && window.__debug?.solarSystem && window.__debug?.cameraCtl,
  { timeout: 15000 },
);
await new Promise((r) => setTimeout(r, 4000));

// Common cleanup: dismiss onboarding tour + ephemeral toasts.
async function clean() {
  await page.evaluate(() => {
    document.querySelectorAll(
      '[id*="onboard"], [class*="onboard"], [id*="tour"], [class*="tour"], #toast-host'
    ).forEach((el) => { el.style.display = 'none'; });
  });
}
await clean();

async function shot(name, prep, clip = null) {
  if (prep) await prep(page);
  await new Promise((r) => setTimeout(r, 1800));
  await page.evaluate(() => {
    if (window.__debug?.renderer && window.__debug?.solarSystem && window.__debug?.cameraCtl) {
      window.__debug.renderer.render(window.__debug.solarSystem.scene, window.__debug.cameraCtl.camera);
    }
  });
  const path = resolve(OUT_DIR, `${name}.jpg`);
  await page.screenshot({ path, type: 'jpeg', quality: 88, ...(clip ? { clip } : {}) });
  console.log(`  ✓ ${name}.jpg`);
}

// ── 1. Heliocentric overview — pure scene, no UI overlay ──────────────────
await shot('heliocentric-overview', async (p) => {
  await p.evaluate(() => {
    document.querySelectorAll(
      '#left-panel, #info-panel, #sky-panel, .panel-toggle, ' +
      '#panel-toggle, #night-vision-toggle, #time-controls, ' +
      '.panel, .overlay-toggle, #map-attribution, footer, .footer'
    ).forEach((el) => { el.style.display = 'none'; });
  });
});

// ── 2. Observer mode — ground + sky atmosphere at twilight ────────────────
// We click the actual "進入觀測" UI button rather than calling setMode()
// directly, because observer mode wires up terrain fetch + sky shader
// uniforms + horizon clamp via the LeftPanel button handler. Calling
// setMode() alone leaves the scene in a half-initialised state.
await shot('observer-mode', async (p) => {
  await p.evaluate(() => {
    document.querySelectorAll('[style*="display: none"]').forEach((el) => {
      el.style.display = '';
    });
    document.querySelectorAll(
      '[id*="onboard"], [class*="onboard"], [id*="tour"], [class*="tour"]'
    ).forEach((el) => { el.style.display = 'none'; });
  });
  // Switch to 觀測 tab + click 進入觀測 button.
  await p.evaluate(() => {
    const observeTab = document.querySelector('[data-tab="observe"], button[data-i18n="tab.observe"]');
    if (observeTab) observeTab.click();
  });
  await new Promise((r) => setTimeout(r, 500));
  await p.evaluate(() => {
    const btn = document.getElementById('observer-enter');
    if (btn) btn.click();
  });
  // Terrain fetch (Esri tiles) + sky uniform setup takes a few seconds.
  await new Promise((r) => setTimeout(r, 8000));
});

// ── 3. Heliocentric with full UI (showing controls + solar system) ──────
await shot('with-ui', async (p) => {
  await p.evaluate(() => {
    document.querySelectorAll('[style*="display: none"]').forEach((el) => {
      el.style.display = '';
    });
    document.querySelectorAll(
      '[id*="onboard"], [class*="onboard"], [id*="tour"], [class*="tour"]'
    ).forEach((el) => { el.style.display = 'none'; });
    if (window.__debug?.cameraCtl?.setMode) {
      window.__debug.cameraCtl.setMode('free');
    }
  });
  await new Promise((r) => setTimeout(r, 2000));
});

await browser.close();
console.log('Done.');
