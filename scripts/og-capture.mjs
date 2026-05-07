// Headless screenshot capture for og:image (the social-share preview card).
// Re-run after major scene visual changes to refresh public/og-image.jpg.
//
// Usage:   node scripts/og-capture.mjs
// Requires: puppeteer-core (devDep) + Google Chrome installed on macOS.
//
// Why this exists: the deployed Three.js canvas can't be captured cleanly via
// the social-card service or naive Chrome --headless --screenshot, because the
// scene needs ~6s of WebGL render time after first paint before all orbits,
// labels, and asteroid belts are visible. Puppeteer drives a real Chromium
// instance, polls for window.__debug to confirm the scene is wired, hides the
// UI chrome, and crops to the OG-standard 1200x630 strip.

import puppeteer from 'puppeteer-core';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const URL_TO_CAPTURE = process.env.OG_URL ?? 'https://solar-system-3d-kappa.vercel.app/';
const OUT_PATH = resolve(__dirname, '../public/og-image.jpg');
const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

mkdirSync(dirname(OUT_PATH), { recursive: true });

const browser = await puppeteer.launch({
  executablePath: CHROME_PATH,
  headless: true,
  args: [
    '--enable-webgl',
    '--use-gl=angle',
    '--ignore-gpu-blocklist',
    '--no-sandbox',
    '--disable-dev-shm-usage',
  ],
  defaultViewport: { width: 1200, height: 800, deviceScaleFactor: 1 },
});

try {
  const page = await browser.newPage();
  console.log(`Capturing: ${URL_TO_CAPTURE}`);
  await page.goto(URL_TO_CAPTURE, { waitUntil: 'networkidle2', timeout: 30000 });

  // Wait until the SolarSystem + renderer are exposed on window.__debug.
  await page.waitForFunction(
    () => window.__debug?.renderer && window.__debug?.solarSystem && window.__debug?.cameraCtl,
    { timeout: 15000 },
  );

  // Three.js needs a few render frames for textures + label sprites to settle.
  await new Promise((r) => setTimeout(r, 4000));

  // Hide every UI overlay so the screenshot is pure scene. Force one final
  // render so the canvas's preserveDrawingBuffer holds the latest frame.
  await page.evaluate(() => {
    document.querySelectorAll(
      '[id*="onboard"], [class*="onboard"], [id*="tour"], [class*="tour"], ' +
      '#left-panel, .left-panel, #panel-toggle, #night-vision-toggle, ' +
      '#time-controls, #info-panel, .panel, .overlay-toggle, ' +
      '#map-attribution, .panel-toggle, ' +
      '#left-panel-toggle, #info-panel-toggle, #sky-panel-toggle, ' +
      '#sky-panel, footer, .footer, #status-bar, #toast-host',
    ).forEach((el) => { el.style.display = 'none'; });
    if (window.__debug?.renderer && window.__debug?.solarSystem && window.__debug?.cameraCtl) {
      window.__debug.renderer.render(window.__debug.solarSystem.scene, window.__debug.cameraCtl.camera);
    }
  });
  await new Promise((r) => setTimeout(r, 1500));

  await page.screenshot({
    path: OUT_PATH,
    type: 'jpeg',
    quality: 88,
    clip: { x: 0, y: 85, width: 1200, height: 630 },
  });
  console.log(`Saved: ${OUT_PATH}`);
} finally {
  await browser.close();
}
