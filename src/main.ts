import { ACESFilmicToneMapping, Color, Raycaster, Vector2, Vector3, WebGLRenderer } from 'three';
import { setAtmosphericConditions, raDecToEcliptic } from './physics/topocentric';
import { eclipticToScene } from './physics/frame';
import { NAMED_STARS } from './data/stars';
import { SolarSystem } from './scene/SolarSystem';
import { SimulationClock } from './time/SimulationClock';
import { CameraController } from './controls/CameraController';
import { ScaleController } from './controls/ScaleController';
import { ScaleTierController } from './controls/ScaleTierController';
import { TimeControls } from './ui/TimeControls';
import { InfoPanel } from './ui/InfoPanel';
import { LeftPanel } from './ui/LeftPanel';
import { SkyPanel } from './ui/SkyPanel';
import { SearchBar } from './ui/SearchBar';
import { CalcPanel } from './ui/CalcPanel';
import { EventsPanel } from './ui/EventsPanel';
// EclipseMap and LunarEclipseMap are lazy-loaded — see the proxy hookup
// below `eventsPanel` instantiation. Keeps their canvas rendering code
// (~10 KB gz) out of the initial bundle until the user clicks an eclipse
// row in the auto-events list.
import type { EclipseMap as EclipseMapType } from './ui/EclipseMap';
import type { LunarEclipseMap as LunarEclipseMapType } from './ui/LunarEclipseMap';
import { CalcVectors } from './scene/CalcVectors';
import { LongExposureCompositor } from './scene/LongExposureCompositor';
import { skyColorForDayFactor, sunAltToDayFactor } from './scene/Skybox';
import { TextureConfig } from './scene/textureConfig';
import { applyLanguage, getLang, setLang, t, bodyName, langPick, onLanguageChange, type Lang } from './i18n';
import { toast } from './ui/toast';
import { PerfHUD } from './ui/PerfHUD';
import { OnboardingTour } from './ui/OnboardingTour';
import { PrecisionInfoPanel } from './ui/PrecisionInfoPanel';
import { NBodyDiagnostics } from './ui/NBodyDiagnostics';
import { TonightPlanPanel } from './ui/TonightPlanPanel';
import { ObservationLogPanel } from './ui/ObservationLogPanel';
import { ObservationQueuePanel } from './ui/ObservationQueuePanel';
import { setupNightVision } from './ui/NightVision';
import { formatDMS } from './ui/formatAngles';
import {
  cardinalLabel, paCardinal, formatRate, formatFov, formatFocal,
  formatLocalMeanTime,
} from './ui/readoutFormat';
import { createScreenPickers } from './bootstrap/picking';
import { createAtmosphericEffects } from './bootstrap/atmosphericEffects';
import {
  getStoredLayoutMode, setStoredLayoutMode,
  autoDetectLayoutMode, applyLayoutMode, showLayoutPicker,
} from './ui/layoutMode';

// Choose the layout mode before anything else mounts. If the user
// has a saved preference, apply silently; otherwise show the picker
// modal and wait for their choice. Either way the body class lands
// before any UI module reads its layout-dependent state.
async function initLayoutMode(): Promise<void> {
  const stored = getStoredLayoutMode();
  if (stored) {
    applyLayoutMode(stored);
    return;
  }
  // First visit: pre-select the auto-detected choice as the visual
  // default, then let the user confirm or override.
  const detected = autoDetectLayoutMode();
  applyLayoutMode(detected);
  const { mode, remember } = await showLayoutPicker();
  applyLayoutMode(mode);
  if (remember) setStoredLayoutMode(mode);
}
// Block initial DOM wiring on the picker. Top-level await is supported
// by Vite's ES2022 target so the rest of the file runs after the user
// has made the choice. The 3D scene constructed below sees the right
// body class from the start.
await initLayoutMode();

const canvasContainer = document.getElementById('app')!;

const renderer = new WebGLRenderer({
  antialias: true,
  powerPreference: 'high-performance',
  preserveDrawingBuffer: true,
  logarithmicDepthBuffer: true,
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x000005, 1);
// Tone mapping compresses bright highlights so Earth surface detail isn't
// blown to pure white when lit on the day side.
renderer.toneMapping = ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.9;
canvasContainer.appendChild(renderer.domElement);

TextureConfig.maxAnisotropy = renderer.capabilities.getMaxAnisotropy();

const scaleCtl = new ScaleController();
const clock = new SimulationClock(new Date());

const solarSystem = new SolarSystem(scaleCtl, clock);
const cameraCtl = new CameraController(renderer.domElement, solarSystem, clock);
const tierCtl = new ScaleTierController();

new TimeControls(clock);
const infoPanel = new InfoPanel(solarSystem, clock);
infoPanel.setCameraController(cameraCtl);
const skyPanel = new SkyPanel(cameraCtl, solarSystem, clock);
skyPanel.setInfoPanel(infoPanel);
const calcPanel = new CalcPanel(solarSystem, clock);
const calcVectors = new CalcVectors(solarSystem);
const eventsPanel = new EventsPanel(clock, cameraCtl, infoPanel, solarSystem);
infoPanel.setEventsPanel(eventsPanel);

// Lazy proxies for the eclipse maps: the proxy.show() call returns
// immediately, fire-and-forget loads the chunk, then opens the map. From
// the user's perspective there's a 100–300 ms delay on first click while
// the lazy chunk fetches; subsequent clicks are instant.
let eclipseMap: EclipseMapType | null = null;
let lunarEclipseMap: LunarEclipseMapType | null = null;
eventsPanel.setEclipseMap({
  show: (jd, label) => {
    void (async () => {
      if (!eclipseMap) {
        const { EclipseMap } = await import('./ui/EclipseMap');
        eclipseMap = new EclipseMap(solarSystem);
      }
      eclipseMap.show(jd, label);
    })();
  },
});
eventsPanel.setLunarEclipseMap({
  show: (jd, label) => {
    void (async () => {
      if (!lunarEclipseMap) {
        const { LunarEclipseMap } = await import('./ui/LunarEclipseMap');
        lunarEclipseMap = new LunarEclipseMap(solarSystem);
      }
      lunarEclipseMap.show(jd, label);
    })();
  },
});
new LeftPanel(solarSystem, cameraCtl, scaleCtl, infoPanel, skyPanel, calcPanel, calcVectors, clock, eventsPanel);
new SearchBar(solarSystem, cameraCtl, infoPanel);

// Desktop layout-switch button (in LeftPanel's advanced tab).
// Wires the "switch to mobile" affordance for desktop users.
const { attachDesktopLayoutSwitch } = await import('./ui/layoutSwitchUI');
attachDesktopLayoutSwitch();

// Mobile chrome — only constructs interactivity when body.mobile-ui is
// set (decided by initLayoutMode above). On desktop this is a no-op
// constructor and no DOM is mutated.
if (document.body.classList.contains('mobile-ui')) {
  const { MobileUI } = await import('./ui/MobileUI');
  const { buildMobileSheets } = await import('./ui/mobileSheets');
  const { attachMobileInfoBackdrop } = await import('./ui/mobileInfoBackdrop');
  const { MobileObserverHUD } = await import('./ui/mobileObserverHUD');
  const mobile = new MobileUI(clock);
  const sheetHandlers = buildMobileSheets();
  // Wire each bottom-toolbar button to open its sheet. Done after a
  // micro-defer so the DOM nodes the sheets want to reparent (e.g.
  // #time-controls, #left-panel sections) have been fully populated
  // by their respective constructors above.
  queueMicrotask(() => {
    (Object.keys(sheetHandlers) as Array<keyof typeof sheetHandlers>).forEach(id => {
      mobile.setSheetHandler(id, sheetHandlers[id]);
    });
  });
  attachMobileInfoBackdrop();
  new MobileObserverHUD(cameraCtl);
}

// Realism state → live scene wiring. Each toggle pushes its value into the
// relevant scene module's uniform / setter; per-frame updates (e.g. observer
// zenith for extinction, moon glow factor) live inside updateSkyForObserver.
// Methods that depend on later-implemented features are accessed via `any`
// casts; missing methods become no-ops via the optional-chain.
solarSystem.realism.subscribe((s) => {
  const stars = solarSystem.getRealStarfield();
  if (stars) {
    stars.setExtinctionEnabled(s.extinction);
    stars.setBVColorEnabled(s.bvColor);
    // Twinkle (scintillation) is the same atmospheric phenomenon as
    // extinction — bound to the same toggle. Planets don't twinkle in real
    // life because their angular size averages out atmospheric turbulence;
    // we don't render them via this layer so the distinction is automatic.
    stars.setTwinkleEnabled(s.extinction);
    if (!s.moonGlow) stars.setMoonExtraDimMag(0);
  }
  // Same extinction toggle drives DSOs.
  solarSystem.getMessierLayer()?.setExtinctionEnabled(s.extinction);
  const atmo = solarSystem.getAtmosphereSky() as unknown as
    { setBeltOfVenusEnabled?: (b: boolean) => void; setAirglowEnabled?: (b: boolean) => void } | null;
  atmo?.setBeltOfVenusEnabled?.(s.beltOfVenus);
  atmo?.setAirglowEnabled?.(s.airglow);
  const ss = solarSystem as unknown as {
    setMilkyWayVisible?: (b: boolean) => void;
    setZodiacalLightVisible?: (b: boolean) => void;
    setMeteorShowersVisible?: (b: boolean) => void;
    setMessierRealAngularSize?: (b: boolean) => void;
  };
  ss.setMilkyWayVisible?.(s.milkyway);
  ss.setZodiacalLightVisible?.(s.zodiacal);
  ss.setMeteorShowersVisible?.(s.meteors);
  ss.setMessierRealAngularSize?.(s.dsoRealSize);
  // Deep HYG catalog swap (v0.4 — Realism panel "Deep star field" toggle).
  solarSystem.setDeepStarsEnabled(s.deepStars);
  // Sharpless 2 emission-nebula overlay (v0.5).
  solarSystem.setSharpless2Enabled(s.sharpless2);
  // Full NGC + IC catalogue overlay (v0.5).
  solarSystem.setNGCFullEnabled(s.ngcFull);
  // Abell galaxy-cluster overlay (v0.6).
  solarSystem.setAbellEnabled(s.abell);
  const sat = solarSystem.getSatelliteLayer() as unknown as
    { setEarthShadowFilter?: (b: boolean) => void } | null;
  sat?.setEarthShadowFilter?.(s.satShadow);
});

// i18n: language selector + initial apply
const langSel = document.getElementById('lang-select') as HTMLSelectElement;
langSel.value = getLang();
langSel.addEventListener('change', () => setLang(langSel.value as Lang));
applyLanguage();

scaleCtl.subscribe(() => {
  // While landed on an exoplanet, override any user attempt to flip
  // the scale-mode toggle. Log scale is required for the host + close-
  // in worlds to render at usable sizes (real-mode TRAPPIST-1 is one
  // pixel even point-blank). Snap back to log; the saved-mode-on-Land
  // dance restores whatever the user had after Return.
  if (solarSystem.isExoplanetSystemActive() && scaleCtl.getMode() !== 'log') {
    scaleCtl.setMode('log');
    return;  // setMode will re-fire this subscriber with mode='log'
  }
  solarSystem.update(clock.getJd());
});

// Raycasting for picking
const raycaster = new Raycaster();
const pointer = new Vector2();
let pointerDownPos: { x: number; y: number } | null = null;
const pickers = createScreenPickers({ solarSystem, cameraCtl });
const atmosphericFx = createAtmosphericEffects(solarSystem);

renderer.domElement.addEventListener('pointerdown', (e) => {
  pointerDownPos = { x: e.clientX, y: e.clientY };
});

renderer.domElement.addEventListener('pointerup', (e) => {
  if (!pointerDownPos) return;
  const dx = e.clientX - pointerDownPos.x;
  const dy = e.clientY - pointerDownPos.y;
  pointerDownPos = null;
  // Treat as click only if not dragged
  if (Math.hypot(dx, dy) > 4) return;

  pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(pointer, cameraCtl.camera);

  // 1) Prefer geometric raycast hit (most accurate when the body is large
  //    enough to actually overlap the cursor).
  const pickables = solarSystem.getPickableMeshes().map(p => p.object);
  const hits = raycaster.intersectObjects(pickables, false);
  if (hits.length > 0) {
    const id = hits[0].object.userData.bodyId;
    if (id) { infoPanel.show(id); return; }
  }

  // 1b) Exoplanet host halos at neighbourhood tier — these only become
  //     pickable once the layer is visible, so this check is a no-op
  //     while the user is at system tier.
  const exoHits = raycaster.intersectObjects(solarSystem.getExoplanetHostPickables(), false);
  if (exoHits.length > 0) {
    const sys = solarSystem.getExoplanetHosts()?.resolvePick(exoHits[0].object.userData);
    if (sys) {
      infoPanel.showExoplanetSystem(sys);
      return;
    }
  }

  // 2) Fall back to screen-space proximity, so tiny dwarfs / moons that are
  //    sub-pixel in scene units are still selectable.
  const rect = renderer.domElement.getBoundingClientRect();
  const id = solarSystem.pickByScreenPosition(e.clientX, e.clientY, cameraCtl.camera, rect, 30);
  if (id) { infoPanel.show(id); return; }

  // 3) Star pick: NAMED_STARS first (descriptions + selection marker),
  //    then HYG via RealStarfield. Tolerance is generous — stars are
  //    sub-pixel sprites so the user has to aim near rather than at.
  if (cameraCtl.getMode() === 'observer') {
    const starHit = pickers.pickNamedStarAtScreen(e.clientX, e.clientY, rect, 14);
    if (starHit) { infoPanel.showStar(starHit); return; }
    // 3b) Bulk-catalogue picks — checks the loaded NGC / Sharpless /
    //     Abell layers in priority order. Tolerance widens
    //     progressively (8 → 14 → 20 px) so a tight click lands on
    //     the *nearest* candidate without misfires, and a slightly
    //     sloppy click still finds something in dense regions.
    //     Priority: NGC (galaxies the user is most likely looking
    //     for) > Sharpless (emission nebulae) > Abell (faint clusters).
    for (const tol of [8, 14, 20]) {
      const ngcHit = pickers.pickNGCAtScreen(e.clientX, e.clientY, rect, tol);
      if (ngcHit) { infoPanel.showNGCFull(ngcHit); return; }
      const shHit = pickers.pickSharplessAtScreen(e.clientX, e.clientY, rect, tol);
      if (shHit) { infoPanel.showSharpless(shHit); return; }
      const abHit = pickers.pickAbellAtScreen(e.clientX, e.clientY, rect, tol);
      if (abHit) { infoPanel.showAbell(abHit); return; }
    }
    const rsf = solarSystem.getRealStarfield();
    if (rsf) {
      const hyg = rsf.pickAtScreen(e.clientX, e.clientY, cameraCtl.camera, rect, 14);
      if (hyg) infoPanel.showStarBasic(hyg.raHours, hyg.decDeg, hyg.magnitude);
    }
  }
});

window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  cameraCtl.onResize(window.innerWidth, window.innerHeight);
  longExposure.resize(window.innerWidth, window.innerHeight);
});

// Long-exposure compositor: ping-pong RT accumulator that simulates camera
// long-exposure photography. Toggled from the observer-tab UI; replaces
// the per-frame direct renderer.render() when active. See LongExposureCompositor.ts
// for the blend shader details.
const longExposure = new LongExposureCompositor(renderer);

(() => {
  const toggle = document.getElementById('long-exposure-toggle') as HTMLInputElement | null;
  const decay = document.getElementById('long-exposure-decay') as HTMLInputElement | null;
  const decayVal = document.getElementById('long-exposure-decay-val');
  const resetBtn = document.getElementById('long-exposure-reset');
  if (!toggle || !decay || !resetBtn) return;
  toggle.addEventListener('change', () => longExposure.setEnabled(toggle.checked));
  const applyDecay = () => {
    const d = parseFloat(decay.value);
    longExposure.setDecay(d);
    if (decayVal) decayVal.textContent = d.toFixed(3);
  };
  decay.addEventListener('input', applyDecay);
  applyDecay();
  resetBtn.addEventListener('click', () => longExposure.reset());
  // Auto-reset accumulator when the user switches observer location or
  // exits/enters observer mode — otherwise the previous frame's content
  // smears across the new view.
  window.addEventListener('sim:tz-override', () => longExposure.reset());
  // Also reset when the user pans the view via mouse drag (camera angle
  // changes invalidate prior accumulation). We listen on canvas pointer
  // events; tracking-driven camera moves don't trigger pointer events,
  // so they're correctly preserved.
  renderer.domElement.addEventListener('pointermove', (e) => {
    if (e.buttons !== 0 && longExposure.isEnabled()) longExposure.reset();
  });
})();

// Hide loading
requestAnimationFrame(() => {
  const loading = document.getElementById('loading');
  if (loading) loading.classList.add('hidden');
});

// Onboarding tour: auto-runs on first visit (localStorage flag suppresses
// future runs). Re-triggered via the "重看導覽" button in the Advanced tab.
const onboardingTour = new OnboardingTour();
onboardingTour.maybeAutoStart();
document.getElementById('onboarding-replay')
  ?.addEventListener('click', () => onboardingTour.replay());

// Precision-info modal: lists every physics module's source/accuracy/range.
// The "explainable astronomy simulator" pitch — see data/precisionInfo.ts.
const precisionPanel = new PrecisionInfoPanel();
document.getElementById('precision-info-btn')
  ?.addEventListener('click', () => precisionPanel.open());

// N-body conservation diagnostics: visible when N-body mode is on.
new NBodyDiagnostics(solarSystem);

// Night-vision (red-light) mode for field observers. Toggle button next
// to hamburger; 'R' key shortcut. State persisted across sessions.
setupNightVision();

// "今晚看什麼" — ranked observable list. Open from the Observe tab button.
const tonightPlan = new TonightPlanPanel(cameraCtl, infoPanel);
document.getElementById('tonight-plan-open')?.addEventListener('click', () => {
  if (tonightPlan.isOpen()) tonightPlan.hide();
  else { observationLogPanel.hide(); tonightPlan.show(); }
});

// 我的觀測 (observation log) — listing of past targets, with notes/ratings/export.
const observationLogPanel = new ObservationLogPanel(cameraCtl, infoPanel, solarSystem);
document.getElementById('observation-log-open')?.addEventListener('click', () => {
  if (observationLogPanel.isOpen()) observationLogPanel.hide();
  else { tonightPlan.hide(); observationQueuePanel.hide(); observationLogPanel.show(); }
});

// 觀測隊列 (observation queue) — smart-scope session planner. Pairs
// with InfoPanel's "Add to queue" button on DSO entries.
const observationQueuePanel = new ObservationQueuePanel(cameraCtl, infoPanel, clock);
infoPanel.setObservationQueuePanel(observationQueuePanel);
document.getElementById('observation-queue-open')?.addEventListener('click', () => {
  if (observationQueuePanel.isOpen()) observationQueuePanel.hide();
  else { tonightPlan.hide(); observationLogPanel.hide(); observationQueuePanel.show(); }
});

// Lazy-load observer-mode-only resources on first entry.
window.addEventListener('sim:mode-change', (e) => {
  const ev = e as CustomEvent<{ mode: string }>;
  if (ev.detail?.mode === 'observer') {
    void solarSystem.ensureSatellites();
  }
  // Esri / AWS attribution is required while LocalTerrain tiles are visible
  // (observer mode). Hidden in heliocentric / free mode where no third-party
  // map tiles are on screen. See CSS / HTML comment in index.html.
  const attribEl = document.getElementById('map-attribution');
  if (attribEl) {
    attribEl.classList.toggle('visible', ev.detail?.mode === 'observer');
  }
});

// Initial attribution visibility — covers the case where the page loads
// directly into observer mode via URL params (mode-change event already
// fired before our listener attached).
{
  const attribEl = document.getElementById('map-attribution');
  if (attribEl && cameraCtl.getMode() === 'observer') {
    attribEl.classList.add('visible');
  }
}

// Debug hook — exposed in dev so console probes can inspect scene state
// without re-shipping a separate inspector. Kept (rather than gated on
// `import.meta.env.DEV`) because it has zero runtime cost beyond a single
// object assignment, and lets users self-diagnose live deployments.
(window as unknown as { __debug: unknown }).__debug = {
  solarSystem, cameraCtl, clock, scaleCtl, renderer,
};

// PWA service worker registration. Skipped in dev (Vite serves modules at
// untransformed paths the worker doesn't know about, and HMR fights the
// cache layer). In production the SW does shell pre-cache + same-origin
// stale-while-revalidate; cross-origin requests pass through untouched.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.warn('SW registration failed:', err);
    });
  });
}

// Screenshot: snapshot the canvas + label overlays into a PNG. Note this
// captures only the WebGL canvas (sky / planets / orbits / terrain). HTML
// overlays like info panels are intentionally excluded so the picture is
// unobstructed.
const screenshotBtn = document.getElementById('btn-screenshot');
if (screenshotBtn) {
  screenshotBtn.addEventListener('click', () => {
    // Force a fresh render so the just-generated frame is what gets captured;
    // some platforms otherwise snapshot a previous frame after preserveDrawingBuffer.
    renderer.render(solarSystem.scene, cameraCtl.camera);
    renderer.domElement.toBlob((blob) => {
      if (!blob) return;
      const a = document.createElement('a');
      const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      a.href = URL.createObjectURL(blob);
      a.download = `solar-${ts}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    }, 'image/png');
  });
}

// Exoplanet "visit" handler: when the user clicks the InfoPanel's
// "Land on this system" button, swap the scene from solar-system to
// the chosen exoplanet system and snap the camera to system tier.
// A floating banner appears with a "return to galaxy" button.
const exoBanner = (() => {
  const el = document.createElement('div');
  el.id = 'exo-banner';
  el.style.cssText = [
    'position:fixed', 'top:64px', 'left:50%', 'transform:translateX(-50%)',
    'z-index:90', 'display:none', 'gap:10px', 'align-items:center',
    'padding:6px 14px', 'background:var(--panel-bg-strong)',
    'border:1px solid var(--accent)', 'border-radius:20px',
    'backdrop-filter:blur(20px) saturate(140%)',
    '-webkit-backdrop-filter:blur(20px) saturate(140%)',
    'font-size:12px', 'font-family:inherit', 'color:var(--text)',
    'box-shadow:0 4px 16px rgba(0,0,0,0.4)',
  ].join(';');
  // Static labels (the "Visiting" prefix and the "Return to galaxy"
  // button) are translated through i18n. The banner is created once but
  // its labels need to re-render whenever the user switches language;
  // the body name (TRAPPIST-1, …) is filled in below at activate-time.
  const renderBannerLabels = () => {
    el.innerHTML = `
      <span><span style="color:var(--text-dim);">${t('exo.activeBanner')}:</span>
        <b id="exo-banner-name" style="color:var(--accent);"></b></span>
      <button id="exo-banner-return" style="background:transparent;border:1px solid var(--accent);color:var(--accent);
              padding:3px 10px;border-radius:14px;cursor:pointer;font-family:inherit;font-size:11px;">
        ${t('exo.returnToGalaxy')}
      </button>
    `;
    el.querySelector('#exo-banner-return')?.addEventListener('click', () => {
      solarSystem.deactivateExoplanetSystem();
      el.style.display = 'none';
      // Restore the user's pre-landing scale mode.
      if (savedScaleModeForExoVisit && scaleCtl.getMode() !== savedScaleModeForExoVisit) {
        scaleCtl.setMode(savedScaleModeForExoVisit);
      }
      savedScaleModeForExoVisit = null;
      // Restore the user's pre-landing camera mode (free / top / follow / observer).
      if (savedCameraModeForExoVisit && cameraCtl.getMode() !== savedCameraModeForExoVisit) {
        cameraCtl.setMode(savedCameraModeForExoVisit);
      }
      savedCameraModeForExoVisit = null;
      // Camera zoom out: leave the system, head to neighbourhood tier.
      tierCtl.setTier('neighbourhood', 3.0);
    });
    // Re-fill the host name in the new language if a system is currently
    // active (so swapping language mid-visit updates "TRAPPIST-1" too).
    if (el.style.display !== 'none') {
      const id = solarSystem.getActiveExoplanetSystemId?.();
      const sys = id ? solarSystem.getExoplanetHosts()?.resolvePick({ exoplanetSystemId: id }) : null;
      const nameEl = el.querySelector('#exo-banner-name');
      if (sys && nameEl) {
        nameEl.textContent =
          typeof sys.name === 'string' ? sys.name : langPick(sys.name);
      }
    }
  };
  renderBannerLabels();
  document.body.appendChild(el);
  onLanguageChange(renderBannerLabels);
  return el;
})();

// Captured before we land on an exoplanet, so the return trip restores
// whatever scale mode the user had picked beforehand.
let savedScaleModeForExoVisit: 'real' | 'log' | 'schematic' | null = null;
// Same idea for the camera mode — landing forces free-flight so the
// camera actually parks at the host instead of being dragged by a
// follow-mode anchor back into the solar system.
let savedCameraModeForExoVisit: ReturnType<typeof cameraCtl.getMode> | null = null;

window.addEventListener('sim:exo-visit', (e) => {
  const id = (e as CustomEvent<{ id: string }>).detail?.id;
  if (!id) return;
  // Force log scale before activate, so the host + close-in worlds
  // render at sizes the user can actually see (real-mode TRAPPIST-1 is
  // basically a single pixel even at point-blank camera distance). The
  // mode change triggers ScaleController listeners which rebuild
  // orbit-line geometry; activate() then mounts the exoplanet group on
  // top of that fresh state.
  savedScaleModeForExoVisit = scaleCtl.getMode() as 'real' | 'log' | 'schematic';
  if (savedScaleModeForExoVisit !== 'log') scaleCtl.setMode('log');

  // Force free-flight camera mode. If we leave 'follow' on, every frame
  // CameraController re-anchors the camera + target to the followed
  // body's heliocentric position, dragging us back to the solar system
  // even though we hid the heliocentric group. Save the previous mode
  // so we can restore it on Return — the user can re-pick a follow body
  // themselves if they want; that's simpler than plumbing the followId.
  savedCameraModeForExoVisit = cameraCtl.getMode();
  if (savedCameraModeForExoVisit !== 'free') {
    cameraCtl.setMode('free');
    // Sync the LeftPanel selectors so the UI doesn't lie about being
    // "Follow Mercury" while we've actually flipped to free-flight.
    const camModeSel = document.getElementById('camera-mode') as HTMLSelectElement | null;
    if (camModeSel) camModeSel.value = 'free';
    const followSel = document.getElementById('follow-body') as HTMLSelectElement | null;
    if (followSel) followSel.value = '';
  }

  const ok = solarSystem.activateExoplanetSystem(id);
  if (!ok) return;
  // Snap camera to system tier so the host fills the view.
  tierCtl.snapTo('system');
  // Place the camera close to origin — the host is roughly 0.135
  // scene-unit radius in log mode (Sun-like multiplier), and the
  // closest planets are ~0.3–0.4 units out. Distance ≈ 1.2 keeps the
  // host plus the inner few orbits in frame without clipping.
  // We also reset the OrbitControls target + sync internal spherical
  // state, otherwise the per-frame `orbit.update()` would snap the
  // camera back to its previous spherical position (the neighbourhood
  // tier camera the user was just at) and we'd never actually see the
  // exoplanet system at origin.
  cameraCtl.orbit.target.set(0, 0, 0);
  cameraCtl.camera.position.set(0, 0.3, 1.2);
  cameraCtl.camera.lookAt(0, 0, 0);
  cameraCtl.orbit.update();
  // Capture this fresh direction in the tier controller so the next
  // tier transition (when we click Return) starts from the right view.
  tierCtl.setCameraDirection(cameraCtl.camera.position.clone());
  // Show the banner with the system name (language-aware).
  const sys = solarSystem.getExoplanetHosts()?.resolvePick({ exoplanetSystemId: id });
  const nameEl = exoBanner.querySelector('#exo-banner-name');
  if (sys && nameEl) {
    nameEl.textContent =
      typeof sys.name === 'string' ? sys.name : langPick(sys.name);
  }
  exoBanner.style.display = 'flex';
});

// Galactic flythrough: keyboard shortcuts.
//   G — zoom one tier outward (system → neighbourhood → galactic)
//   Shift-G — zoom one tier inward
//   H — snap home to system tier (with brief animation)
// Skipped when typing into a text field or when the user is in a panel.
window.addEventListener('keydown', (e) => {
  // Don't hijack shortcuts when the user is typing into an input.
  const tag = (e.target as HTMLElement | null)?.tagName?.toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (cameraCtl.getMode() === 'observer') return;
  // Don't allow tier shortcuts while landed on an exoplanet — pressing
  // G mid-visit would tier-animate, which re-shows hidden layers (HYG
  // cloud, other halos, the heliocentric group) and dissolves the
  // climax. Force the user through the explicit Return-to-galaxy
  // banner button, which deactivates cleanly.
  if (solarSystem.isExoplanetSystemActive()) return;

  if (e.key === 'g' && !e.shiftKey) {
    tierCtl.zoomOut();
    e.preventDefault();
  } else if (e.key === 'G' && e.shiftKey) {
    tierCtl.zoomIn();
    e.preventDefault();
  } else if (e.key === 'h' || e.key === 'H') {
    tierCtl.home();
    e.preventDefault();
  }
});

// Share link: encode current state (jd, scale, frame, observer lat/lon if
// active, follow body) into URL hash. On load, read it and apply.
const shareBtn = document.getElementById('btn-share');
if (shareBtn) {
  shareBtn.addEventListener('click', async () => {
    const params = new URLSearchParams();
    params.set('jd', clock.getJd().toFixed(4));
    params.set('scale', scaleCtl.getMode());
    params.set('frame', scaleCtl.getFrame());
    if (cameraCtl.getMode() === 'observer') {
      const loc = cameraCtl.getObserverLocation();
      params.set('obs', `${loc.lat.toFixed(4)},${loc.lon.toFixed(4)}`);
    } else {
      // Encode non-observer camera state so a permalink survives a round
      // trip. Observer mode is its own beast (auto-enters via the obs
      // param above) and overrides whatever mode/follow we'd write.
      const mode = cameraCtl.getMode();
      if (mode !== 'free') params.set('mode', mode);
      const followId = cameraCtl.getFollowId();
      if (followId) params.set('follow', followId);
    }
    // Active exoplanet system trumps everything visually — if the user
    // is currently parked at TRAPPIST-1, the receiver of the share URL
    // should land there too. Activation will force scale=log and
    // mode=free internally; we don't need to also write those.
    const exoId = solarSystem.getActiveExoplanetSystemId();
    if (exoId) params.set('exo', exoId);
    // Body selected in the InfoPanel — the right-side panel re-opens to
    // that body on load. Supports the same id schemes as InfoPanel.show
    // (plain body id, "star:X", "messier:M31", "unnamed:RA_Dec", "exo:Y").
    const bodyId = infoPanel.getCurrentId();
    if (bodyId) params.set('body', bodyId);
    const url = `${location.origin}${location.pathname}#${params.toString()}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.info(t('toast.shareCopied'));
    } catch {
      // Fallback: replace location hash so user can copy from URL bar.
      location.hash = params.toString();
    }
  });
}

// Decode URL hash on load and apply the state.
function applyUrlState(): void {
  if (!location.hash || location.hash.length < 2) return;
  const params = new URLSearchParams(location.hash.slice(1));
  const jd = params.get('jd');
  if (jd) {
    // Validate before applying — a malformed share URL with `?jd=foo`
    // or `?jd=NaN` would otherwise propagate NaN into every body's
    // propagator and grey-screen the whole sim. Also clamp to the
    // documented JPL approximate-positions range (1800–2050) plus a
    // generous buffer so people who want to wander further out still
    // can, but a typo year of 9999999 doesn't break anything.
    const parsed = parseFloat(jd);
    const J1500 = 2268932.5;  // 1500-01-01
    const J2500 = 2634167.5;  // 2500-01-01
    if (Number.isFinite(parsed) && parsed >= J1500 && parsed <= J2500) {
      clock.setJd(parsed);
    }
  }
  const scale = params.get('scale');
  if (scale === 'real' || scale === 'log' || scale === 'schematic') {
    scaleCtl.setMode(scale);
    document.querySelectorAll('.scale-toggle button[data-scale]').forEach(b => {
      b.classList.toggle('active', (b as HTMLElement).dataset.scale === scale);
    });
  }
  const frame = params.get('frame');
  if (frame === 'heliocentric' || frame === 'geocentric') {
    scaleCtl.setFrame(frame);
    document.querySelectorAll('.scale-toggle button[data-frame]').forEach(b => {
      b.classList.toggle('active', (b as HTMLElement).dataset.frame === frame);
    });
  }
  const obs = params.get('obs');
  if (obs) {
    const [latS, lonS] = obs.split(',');
    const lat = parseFloat(latS), lon = parseFloat(lonS);
    if (Number.isFinite(lat) && Number.isFinite(lon)) {
      const latIn = document.getElementById('observer-lat') as HTMLInputElement;
      const lonIn = document.getElementById('observer-lon') as HTMLInputElement;
      latIn.value = lat.toFixed(4);
      lonIn.value = lon.toFixed(4);
      // Auto-enter observer mode after a tick so all wiring is ready.
      setTimeout(() => document.getElementById('observer-enter')?.click(), 200);
    }
  } else {
    // No observer mode in URL — try free/follow/top camera params.
    // Sequenced behind a microtask so other listeners have wired up.
    const mode = params.get('mode');
    const follow = params.get('follow');
    if (mode === 'free' || mode === 'top' || mode === 'follow') {
      setTimeout(() => {
        cameraCtl.setMode(mode);
        if (mode === 'follow' && follow) cameraCtl.setFollow(follow);
        // Sync the LeftPanel <select>s so the UI doesn't lie.
        const cms = document.getElementById('camera-mode') as HTMLSelectElement | null;
        if (cms) cms.value = mode;
        if (mode === 'follow' && follow) {
          const fbs = document.getElementById('follow-body') as HTMLSelectElement | null;
          if (fbs) fbs.value = follow;
        }
      }, 150);
    }
  }

  // Exoplanet-system landing: dispatch the same event the InfoPanel's
  // Land button fires, so a /#exo=trappist-1 permalink reproduces the
  // climax shot exactly (HZ disc, Mercury overlay, scale=log forced,
  // camera at host). Run AFTER the other params so the saved scale /
  // mode are captured properly before the land flow overrides them.
  const exo = params.get('exo');
  if (exo) {
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('sim:exo-visit', { detail: { id: exo } }));
    }, 300);
  }

  // Selected body — restore the InfoPanel to whatever the user had
  // open when they hit Share. Supports the same id schemes as
  // InfoPanel itself (body / star: / messier: / unnamed: / exo:).
  // Delayed because InfoPanel.show consults solarSystem.getBody() which
  // needs `solarSystem.update(jd)` to have run at least once after our
  // jd write above.
  const body = params.get('body');
  if (body) {
    setTimeout(() => {
      if (body.startsWith('exo:')) {
        // Exo InfoPanel doesn't have a public show-by-id; if /#exo=
        // was set above it'll open the panel itself. Otherwise skip.
        return;
      }
      if (body.startsWith('star:')) {
        const id = body.slice(5);
        const star = NAMED_STARS.find(s => s.id === id);
        if (star) infoPanel.showStar(star);
      } else if (body.startsWith('messier:') || body.startsWith('unnamed:')) {
        // These open through dedicated paths; for now we skip them
        // since they need data we don't pre-load. Future work.
      } else {
        infoPanel.show(body);
      }
    }, 350);
  }
}
applyUrlState();

// Mobile hamburger: toggle left panel visibility on narrow screens.
const panelToggleBtn = document.getElementById('panel-toggle');
const leftPanelEl = document.getElementById('left-panel');
if (panelToggleBtn && leftPanelEl) {
  panelToggleBtn.addEventListener('click', () => {
    leftPanelEl.classList.toggle('open');
  });
  // Tapping outside the panel closes it.
  document.addEventListener('pointerdown', (e) => {
    if (!leftPanelEl.classList.contains('open')) return;
    const target = e.target as HTMLElement;
    if (leftPanelEl.contains(target) || panelToggleBtn.contains(target)) return;
    leftPanelEl.classList.remove('open');
  });
}

// External integrations: JPL Horizons body loader + Stellarium telescope WS.
import { fetchHorizonsVectors } from './physics/horizonsClient';
import { HorizonsPropagator } from './physics/horizonsPropagator';
import { StellariumTelescope } from './controls/StellariumTelescope';
import { ScopeBridge } from './controls/ScopeBridge';
import type { BodyDescriptor } from './physics/types';

(() => {
  const input = document.getElementById('horizons-input') as HTMLInputElement | null;
  const btn = document.getElementById('horizons-load') as HTMLButtonElement | null;
  const status = document.getElementById('horizons-status');
  if (!input || !btn || !status) return;
  let runtimeIds: string[] = [];
  btn.addEventListener('click', async () => {
    const target = input.value.trim();
    if (!target) return;
    btn.disabled = true;
    status.textContent = t('horizons.loading');
    try {
      // Fetch ±1 year around current sim time at 5-day resolution; Hermite
      // interpolation makes that smooth for visualisation purposes.
      const jd = clock.getJd();
      const result = await fetchHorizonsVectors(target, jd - 365, jd + 365, 5);
      if (!result.states.length) {
        status.textContent = t('horizons.noOrbit');
        return;
      }
      const propagator = new HorizonsPropagator(result.states);
      const id = `horizons-${target.replace(/\W+/g, '_')}-${Date.now()}`;
      const desc: BodyDescriptor = {
        id,
        name: result.name,
        nameEn: result.name,
        parentId: null,
        category: 'comet', // treated like an asteroid/comet for orbit-style rendering
        physical: { radiusKm: 5, massKg: 1e13, rotationPeriodDays: 1, axialTiltDeg: 0 },
        propagator,
        appearance: { color: 0xffd060 },
        description: { 'zh-Hant': `Horizons 載入：${result.name}`, en: `Horizons: ${result.name}`, ja: `Horizons 読み込み：${result.name}` },
      };
      const ok = solarSystem.addRuntimeBody(desc);
      if (ok) {
        runtimeIds.push(id);
        status.textContent = t('horizons.added')
          .replace('{name}', result.name)
          .replace('{n}', String(result.states.length));
        // Force a render update so the new body appears immediately.
        solarSystem.update(jd);
      } else {
        status.textContent = t('horizons.dupName');
      }
    } catch (e) {
      status.textContent = t('horizons.error').replace('{err}', String(e));
    } finally {
      btn.disabled = false;
    }
  });
  void runtimeIds; // future: undo/clear button
})();

const stellariumScope = new StellariumTelescope();
(() => {
  const urlInput = document.getElementById('telescope-url') as HTMLInputElement | null;
  const btn = document.getElementById('telescope-connect') as HTMLButtonElement | null;
  const status = document.getElementById('telescope-status');
  if (!urlInput || !btn || !status) return;
  // Track current state so we can re-render on language change without
  // waiting for the next StellariumTelescope state event.
  let currentState: 'connected' | 'error' | 'idle' = 'idle';
  const renderState = (): void => {
    if (currentState === 'connected') {
      status.textContent = t('telescope.connected');
      btn.textContent = t('telescope.disconnect');
    } else if (currentState === 'error') {
      status.textContent = t('telescope.connectFailed');
      btn.textContent = t('telescope.connect');
    } else {
      status.textContent = t('telescope.idle');
      btn.textContent = t('telescope.connect');
    }
  };
  stellariumScope.onStateChange((s) => {
    currentState = s === 'connected' ? 'connected' : s === 'error' ? 'error' : 'idle';
    renderState();
  });
  onLanguageChange(renderState);
  renderState();
  btn.addEventListener('click', async () => {
    if (stellariumScope.isConnected()) {
      stellariumScope.disconnect();
      return;
    }
    stellariumScope.setUrl(urlInput.value.trim() || 'ws://localhost:10002');
    try { await stellariumScope.connect(); } catch { /* state event will update */ }
  });
})();
// Forward the existing GoTo button (info-panel) to the telescope when
// connected — same click also drives the in-app camera (handled inside
// InfoPanel). RA/Dec are derived lazily here so we don't pre-compute when
// telescope isn't connected.
document.getElementById('info-goto')?.addEventListener('click', () => {
  if (!stellariumScope.isConnected()) return;
  // Use SkyPanel-equivalent path: get body RA/Dec at current time.
  // We piggy-back on infoPanel's currently-selected body via the dataset.
  const id = (document.getElementById('info-name') as HTMLElement | null)?.dataset.bodyId;
  if (!id) return;
  const entry = solarSystem.getBody(id);
  if (!entry) return;
  // Convert body world position → RA/Dec via topocentric helper.
  const pos = solarSystem.getWorldPosition(id, new Vector3());
  if (!pos) return;
  // RA/Dec from heliocentric position, geocentric approximation: subtract
  // earth's world position so we get earth-centred direction.
  const earth = solarSystem.getWorldPosition('earth', new Vector3());
  const rel = earth ? pos.clone().sub(earth) : pos.clone();
  const len = rel.length();
  if (len < 1e-9) return;
  // Scene → ecliptic → equatorial. Since scene Y-up = ecliptic +Z, and
  // we want J2000 equatorial RA/Dec, use the inverse of frame.ts's mapping
  // and apply obliquity rotation.
  // For simplicity: treat scene-frame direction as ecliptic, derive l/b,
  // rotate by -ε around X to equatorial, then atan2.
  const x = rel.x / len, y = -rel.z / len, z = rel.y / len; // scene→ecliptic
  const eps = 23.4393 * Math.PI / 180;
  const xe = x;
  const ye = y * Math.cos(eps) - z * Math.sin(eps);
  const ze = y * Math.sin(eps) + z * Math.cos(eps);
  let raDeg = Math.atan2(ye, xe) * 180 / Math.PI;
  if (raDeg < 0) raDeg += 360;
  const decDeg = Math.asin(Math.max(-1, Math.min(1, ze))) * 180 / Math.PI;
  stellariumScope.sendGoto(raDeg / 15, decDeg);
});

// INDI / ASCOM scope-bridge — v0.7 Tier 1 (read-only).
// Subscribes to a local helper at ws://localhost:7624/sim, draws a
// green reticle on the celestial dome wherever the mount is pointed.
// Helper failures (not running, mount disconnected, network drop) all
// cleanly hide the reticle; the simulator itself never breaks.
const scopeBridge = new ScopeBridge();
(() => {
  const urlInput = document.getElementById('scope-bridge-url') as HTMLInputElement | null;
  const btn = document.getElementById('scope-bridge-connect') as HTMLButtonElement | null;
  const status = document.getElementById('scope-bridge-status');
  if (!urlInput || !btn || !status) return;
  // Track state locally so we can re-render on language change without
  // waiting for the bridge to emit a new state event.
  let currentState: import('./controls/ScopeBridge').ScopeBridgeState = 'idle';
  let lastFix: import('./controls/ScopeBridge').PointingFix | null = null;
  const renderState = (): void => {
    if (currentState === 'connecting') {
      status.textContent = t('external.scopeBridgeConnecting');
      btn.textContent = t('external.scopeBridgeConnect');
    } else if (currentState === 'connected') {
      btn.textContent = t('external.scopeBridgeDisconnect');
      if (lastFix) {
        status.textContent = t('external.scopeBridgeReceiving')
          .replace('{ra}', lastFix.raHours.toFixed(4))
          .replace('{dec}', lastFix.decDeg.toFixed(3));
      } else {
        status.textContent = t('external.scopeBridgeConnected');
      }
    } else if (currentState === 'error') {
      status.textContent = t('external.scopeBridgeError');
      btn.textContent = t('external.scopeBridgeConnect');
    } else {
      status.textContent = t('external.scopeBridgeIdle');
      btn.textContent = t('external.scopeBridgeConnect');
    }
  };
  scopeBridge.onState((s) => {
    currentState = s;
    if (s !== 'connected') {
      lastFix = null;
      // Bridge dropped → hide the reticle. Done here rather than in the
      // pointing path so a clean disconnect (no new pointing message)
      // still hides it.
      solarSystem.getScopeReticle()?.hide();
    }
    renderState();
  });
  scopeBridge.onPointing((p) => {
    lastFix = p;
    solarSystem.getScopeReticle()?.setPointing(p.raHours, p.decDeg);
    renderState();
  });
  onLanguageChange(renderState);
  renderState();
  btn.addEventListener('click', async () => {
    if (scopeBridge.isConnected() || scopeBridge.getState() === 'connecting') {
      scopeBridge.disconnect();
      return;
    }
    scopeBridge.setUrl(urlInput.value.trim() || 'ws://localhost:7624/sim');
    // connect() resolves on open; an immediate error (e.g. helper not
    // running) reaches us via the 'error' state callback, so the catch
    // is intentionally a no-op.
    try { await scopeBridge.connect(); } catch { /* state callback handles UI */ }
  });
})();

// Scope bridge Tier 2 — slew/sync/park outbound. Each piece is opt-in:
// (a) the user must tick the risk-acknowledgement checkbox, (b) every
// slew is range-checked against user-settable limits before leaving
// the browser, (c) the panic-stop button is wired even when control is
// disabled so it's there when you reach for it.
(() => {
  const ack = document.getElementById('scope-bridge-ack') as HTMLInputElement | null;
  const maxSlewInput = document.getElementById('scope-bridge-max-slew') as HTMLInputElement | null;
  const decMinInput = document.getElementById('scope-bridge-dec-min') as HTMLInputElement | null;
  const decMaxInput = document.getElementById('scope-bridge-dec-max') as HTMLInputElement | null;
  const stopBtn = document.getElementById('scope-bridge-stop') as HTMLButtonElement | null;
  const slewStatus = document.getElementById('scope-bridge-slew-status');
  const slewBtn = document.getElementById('info-slew-scope') as HTMLButtonElement | null;
  if (!ack || !maxSlewInput || !decMinInput || !decMaxInput || !stopBtn || !slewStatus || !slewBtn) return;

  const refreshSafety = () => {
    const maxSlew = Math.max(1, Math.min(180, Number(maxSlewInput.value) || 90));
    const decMinRaw = decMinInput.value.trim();
    const decMaxRaw = decMaxInput.value.trim();
    const decMin = decMinRaw === '' ? null : Math.max(-90, Math.min(90, Number(decMinRaw)));
    const decMax = decMaxRaw === '' ? null : Math.max(-90, Math.min(90, Number(decMaxRaw)));
    scopeBridge.setSafety({ maxSlewDeg: maxSlew, minDecDeg: decMin, maxDecDeg: decMax });
  };
  const refreshControl = () => {
    scopeBridge.setControlEnabled(ack.checked);
    updateSlewButtonVisibility();
  };
  const updateSlewButtonVisibility = () => {
    // Show the slew button only when ALL three conditions hold:
    //   bridge connected + tier-2 enabled + InfoPanel actually showing
    //   a target with RA/Dec (the dataset attributes set by show* methods).
    const nameEl = document.getElementById('info-name') as HTMLElement | null;
    const hasTarget = !!(nameEl?.dataset.unnamedStarRa || nameEl?.dataset.bodyId || nameEl?.dataset.starId);
    const enabled = scopeBridge.isConnected() && scopeBridge.isControlEnabled() && hasTarget;
    slewBtn.style.display = enabled ? '' : 'none';
  };

  ack.addEventListener('change', refreshControl);
  maxSlewInput.addEventListener('change', refreshSafety);
  decMinInput.addEventListener('change', refreshSafety);
  decMaxInput.addEventListener('change', refreshSafety);
  refreshSafety();

  // Slew-event stream → status indicator. Auto-clears after slew.done /
  // slew.error so the status field doesn't get sticky on the next session.
  scopeBridge.onSlew((e) => {
    if (e.type === 'start') {
      slewStatus.style.color = '#7fffa0';
      slewStatus.textContent = t('external.scopeBridgeSlewing').replace('{remDeg}', '?');
    } else if (e.type === 'progress') {
      slewStatus.textContent = t('external.scopeBridgeSlewing').replace('{remDeg}', e.remainingDeg.toFixed(1));
    } else if (e.type === 'done') {
      slewStatus.style.color = '#7fffa0';
      slewStatus.textContent = t('external.scopeBridgeSlewDone')
        .replace('{ra}', e.raHours.toFixed(4))
        .replace('{dec}', e.decDeg.toFixed(3));
    } else if (e.type === 'aborted') {
      slewStatus.style.color = '#ffb060';
      slewStatus.textContent = t('external.scopeBridgeSlewAbort');
    } else if (e.type === 'error') {
      slewStatus.style.color = '#ff7878';
      slewStatus.textContent = t('external.scopeBridgeSlewError').replace('{message}', e.message);
    }
  });
  // Show / hide the slew button as bridge state changes.
  scopeBridge.onState(updateSlewButtonVisibility);
  // Also reactively after panel updates — main.ts already mutates the
  // dataset on each show*; this captures all of them in one place.
  const obs = new MutationObserver(updateSlewButtonVisibility);
  const nameEl = document.getElementById('info-name');
  if (nameEl) obs.observe(nameEl, { attributes: true, attributeFilter: ['data-body-id', 'data-star-id', 'data-unnamed-star-ra'] });

  stopBtn.addEventListener('click', () => {
    const g = scopeBridge.abort();
    if (g === 'not-connected') {
      slewStatus.style.color = '#ff7878';
      slewStatus.textContent = t('external.scopeBridgeGateNotConn');
    }
  });

  slewBtn.addEventListener('click', () => {
    // Resolve RA/Dec from whatever the InfoPanel currently shows.
    // Three datasets cover the three shapes: planets (bodyId via
    // getWorldPosition lookup), named stars (starId), and unnamed/
    // catalogue rows (unnamedStarRa + unnamedStarDec).
    const nameEl2 = document.getElementById('info-name') as HTMLElement | null;
    if (!nameEl2) return;
    let raHours: number | null = null, decDeg: number | null = null;
    const unnamedRa = nameEl2.dataset.unnamedStarRa;
    const unnamedDec = nameEl2.dataset.unnamedStarDec;
    if (unnamedRa && unnamedDec) {
      raHours = Number(unnamedRa); decDeg = Number(unnamedDec);
    } else if (nameEl2.dataset.starId) {
      const star = NAMED_STARS.find((s) => s.id === nameEl2.dataset.starId);
      if (star) { raHours = star.raHours; decDeg = star.decDeg; }
    } else if (nameEl2.dataset.bodyId) {
      // Body — reuse the same scene→ecliptic→equatorial path as the
      // Stellarium GoTo above. Inlined for clarity (the maths is small).
      const pos = solarSystem.getWorldPosition(nameEl2.dataset.bodyId, new Vector3());
      const earth = solarSystem.getWorldPosition('earth', new Vector3());
      if (pos) {
        const rel = earth ? pos.clone().sub(earth) : pos.clone();
        const len = rel.length();
        if (len > 1e-9) {
          const x = rel.x / len, y = -rel.z / len, z = rel.y / len;
          const eps = 23.4393 * Math.PI / 180;
          const xe = x;
          const ye = y * Math.cos(eps) - z * Math.sin(eps);
          const ze = y * Math.sin(eps) + z * Math.cos(eps);
          let raDeg = Math.atan2(ye, xe) * 180 / Math.PI;
          if (raDeg < 0) raDeg += 360;
          raHours = raDeg / 15;
          decDeg = Math.asin(Math.max(-1, Math.min(1, ze))) * 180 / Math.PI;
        }
      }
    }
    if (raHours == null || decDeg == null) return;
    const gate = scopeBridge.slew(raHours, decDeg);
    if (gate === 'ok') {
      slewStatus.style.color = '#7fffa0';
      slewStatus.textContent = t('external.scopeBridgeGateOk');
    } else {
      slewStatus.style.color = '#ffb060';
      slewStatus.textContent = scopeBridgeGateMessage(gate, scopeBridge.getSafety().maxSlewDeg);
    }
  });

  onLanguageChange(updateSlewButtonVisibility);
})();

/** Map gate codes from ScopeBridge.slew() to human-readable, localised
 *  status text. Kept module-local because it's the only call site. */
function scopeBridgeGateMessage(gate: import('./controls/ScopeBridge').SlewGate, maxDeg: number): string {
  switch (gate) {
    case 'control-disabled': return t('external.scopeBridgeGateDisabled');
    case 'bad-coords':       return t('external.scopeBridgeGateBadCoords');
    case 'dec-floor':        return t('external.scopeBridgeGateDecFloor');
    case 'dec-ceiling':      return t('external.scopeBridgeGateDecCeil');
    case 'slew-too-large':   return t('external.scopeBridgeGateTooLarge').replace('{maxDeg}', String(maxDeg));
    case 'already-slewing':  return t('external.scopeBridgeGateBusy');
    case 'not-connected':    return t('external.scopeBridgeGateNotConn');
    case 'send-failed':      return t('external.scopeBridgeError');
    case 'ok':               return t('external.scopeBridgeGateOk');
  }
}

// Persist user preferences for left-panel selections (checkboxes, selects,
// sliders, scale/frame button groups). Called after LeftPanel construction
// so initial event listeners exist before we replay stored values via
// dispatchEvent — that way every consumer sees the restored state as if
// the user had just clicked / typed it.
function setupUiPersistence(): void {
  const PREFIX = 'ui-pref-';
  // Inputs & selects whose state should persist. Restricted to the left
  // panel + a few global selects (language, speed). Date / scrubber are
  // explicitly excluded — they are session/time-dependent.
  const inputs = document.querySelectorAll<HTMLInputElement | HTMLSelectElement>([
    '#left-panel input[id]',
    '#left-panel select[id]',
    '#speed-select',
    '#lang-select',
    '#observer-lat',
    '#observer-lon',
  ].join(','));
  const isCheckbox = (el: HTMLInputElement | HTMLSelectElement) =>
    el.tagName === 'INPUT' && (el as HTMLInputElement).type === 'checkbox';
  for (const el of inputs) {
    const key = PREFIX + el.id;
    const stored = localStorage.getItem(key);
    if (stored != null) {
      if (isCheckbox(el)) {
        const cb = el as HTMLInputElement;
        if (cb.checked !== (stored === '1')) {
          cb.checked = stored === '1';
          cb.dispatchEvent(new Event('change', { bubbles: true }));
        }
      } else if (el.value !== stored) {
        el.value = stored;
        el.dispatchEvent(new Event('change', { bubbles: true }));
        el.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }
    const save = () => {
      const v = isCheckbox(el)
        ? ((el as HTMLInputElement).checked ? '1' : '0')
        : el.value;
      localStorage.setItem(key, v);
    };
    el.addEventListener('change', save);
    el.addEventListener('input', save);
  }
  // Button groups (scale-toggle / frame-toggle) don't have a single value;
  // we store the active button's data-attribute and replay a click.
  for (const attr of ['data-scale', 'data-frame'] as const) {
    const btns = document.querySelectorAll<HTMLButtonElement>(`.scale-toggle button[${attr}]`);
    if (btns.length === 0) continue;
    const groupKey = `${PREFIX}${attr}`;
    const stored = localStorage.getItem(groupKey);
    if (stored != null) {
      const propName = attr.slice(5); // 'data-scale' → 'scale'
      const target = Array.from(btns).find(b => b.dataset[propName] === stored);
      if (target && !target.classList.contains('active')) target.click();
    }
    for (const b of btns) {
      b.addEventListener('click', () => {
        const propName = attr.slice(5);
        const v = b.dataset[propName] || '';
        localStorage.setItem(groupKey, v);
      });
    }
  }
  // Realism preset buttons — record which preset was last picked so the
  // active highlight survives reloads (the underlying toggles are already
  // persisted via the inputs loop above; this is purely cosmetic).
  for (const presetId of ['preset-stylized', 'preset-balanced', 'preset-realistic']) {
    const btn = document.getElementById(presetId);
    if (!btn) continue;
    btn.addEventListener('click', () => {
      localStorage.setItem(`${PREFIX}realism-preset`, presetId);
    });
  }
  const presetKey = localStorage.getItem(`${PREFIX}realism-preset`);
  if (presetKey) {
    for (const id of ['preset-stylized', 'preset-balanced', 'preset-realistic']) {
      document.getElementById(id)?.classList.toggle('active', id === presetKey);
    }
  }
}
setupUiPersistence();

// Angular separation tool: hold Shift while clicking two bodies; the readout
// shows the great-circle angle between them. Re-uses the existing raycaster.
(() => {
  const readout = document.getElementById('measure-readout');
  const content = document.getElementById('measure-content');
  if (!readout || !content) return;
  let firstId: string | null = null;
  const tmpA = new Vector3(), tmpB = new Vector3();
  readout.addEventListener('click', () => {
    readout.style.display = 'none';
    firstId = null;
  });
  renderer.domElement.addEventListener('pointerdown', (e) => {
    if (!e.shiftKey) { firstId = null; return; }
    // Reuse picker logic: cast a ray from the canvas-relative cursor into the
    // pickable mesh list. Mirror the existing search/click flow.
    const r = renderer.domElement.getBoundingClientRect();
    const ndc = new Vector2(
      ((e.clientX - r.left) / r.width) * 2 - 1,
      -(((e.clientY - r.top) / r.height) * 2 - 1),
    );
    const ray = new Raycaster();
    ray.setFromCamera(ndc, cameraCtl.camera);
    const pickList = solarSystem.getPickableMeshes();
    const hits = ray.intersectObjects(pickList.map(p => p.object));
    if (!hits.length) return;
    const hitObj = hits[0].object;
    const id = pickList.find(p => p.object === hitObj)?.bodyId;
    if (!id) return;
    if (!firstId) {
      firstId = id;
      const entry = solarSystem.getBody(id);
      const nm = entry ? bodyName(entry.descriptor) : id;
      content.textContent = `${nm} → ${t('measure.pickNext')}`;
      readout.style.display = '';
      return;
    }
    if (firstId === id) return;
    const aPos = solarSystem.getWorldPosition(firstId, tmpA);
    const bPos = solarSystem.getWorldPosition(id, tmpB);
    if (!aPos || !bPos) return;
    // Angle between directions FROM the camera. For sub-pixel accuracy at
    // long distance, use atan2 of cross/dot rather than acos directly.
    const camPos = cameraCtl.camera.position;
    const da = aPos.clone().sub(camPos).normalize();
    const db = bPos.clone().sub(camPos).normalize();
    const dot = Math.max(-1, Math.min(1, da.dot(db)));
    const cross = da.clone().cross(db).length();
    const angDeg = Math.atan2(cross, dot) * 180 / Math.PI;
    const aEntry = solarSystem.getBody(firstId);
    const bEntry = solarSystem.getBody(id);
    const aName = aEntry ? bodyName(aEntry.descriptor) : firstId;
    const bName = bEntry ? bodyName(bEntry.descriptor) : id;
    content.textContent = `${aName} ↔ ${bName}: ${angDeg.toFixed(3)}°` +
      (angDeg < 1 ? ` (${(angDeg * 60).toFixed(2)}′)` : '');
    firstId = null;
  });
})();

// Telrad / FOV rings — toggle visibility + per-frame size from current FOV.
(() => {
  const cb = document.getElementById('toggle-fov-rings') as HTMLInputElement | null;
  const cont = document.getElementById('fov-rings');
  if (!cb || !cont) return;
  cb.addEventListener('change', () => {
    cont.classList.toggle('visible', cb.checked && cameraCtl.getMode() === 'observer');
  });
  // Hide automatically when leaving observer mode; re-show when entering if
  // toggle was on. Hooked into the existing reticle update path.
  setInterval(() => {
    cont.classList.toggle('visible', cb.checked && cameraCtl.getMode() === 'observer');
  }, 500);
  const rings = cont.querySelectorAll<HTMLElement>('.ring');
  setInterval(() => {
    if (cameraCtl.getMode() !== 'observer') return;
    const fov = cameraCtl.camera.fov;
    const h = renderer.domElement.clientHeight;
    // Vertical FOV in deg → pixels-per-degree is (h / fov).
    const pxPerDeg = h / fov;
    rings.forEach(r => {
      const deg = parseFloat(r.dataset.deg ?? '1');
      const sz = deg * pxPerDeg * 2; // diameter
      r.style.width = `${sz}px`;
      r.style.height = `${sz}px`;
    });
  }, 60); // 60ms ≈ 16 fps for resize is plenty for a static overlay.
})();

// Bookmark list — fed by ⭐ button on info panel. Each entry: {id, jd, label}.
(() => {
  const list = document.getElementById('bookmark-list');
  const empty = document.getElementById('bookmark-empty');
  if (!list || !empty) return;
  const render = () => {
    let entries: { id: string; jd: number; label: string; ts: number }[] = [];
    try { entries = JSON.parse(localStorage.getItem('bookmarks') ?? '[]'); } catch { /* ignore */ }
    if (entries.length === 0) {
      empty.style.display = '';
      list.innerHTML = '';
      return;
    }
    empty.style.display = 'none';
    list.innerHTML = entries.map((b, i) => {
      const date = new Date((b.jd - 2440587.5) * 86400000);
      const dStr = date.toISOString().slice(0, 16).replace('T', ' ');
      return `<div class="bookmark-row" data-idx="${i}" style="display:flex;justify-content:space-between;gap:6px;padding:4px 6px;border-radius:4px;cursor:pointer;align-items:center;">
        <span style="flex:1;color:var(--text);">${b.label}</span>
        <span style="color:var(--text-dim);font-size:10px;">${dStr}</span>
        <span class="bookmark-del" data-idx="${i}" style="cursor:pointer;color:var(--text-dim);padding:0 4px;">×</span>
      </div>`;
    }).join('');
    list.querySelectorAll<HTMLElement>('.bookmark-row').forEach(row => {
      row.addEventListener('click', (e) => {
        if ((e.target as HTMLElement).classList.contains('bookmark-del')) return;
        const idx = parseInt(row.dataset.idx ?? '-1', 10);
        if (idx < 0 || !entries[idx]) return;
        const b = entries[idx];
        clock.setDate(new Date((b.jd - 2440587.5) * 86400000));
        const entry = solarSystem.getBody(b.id);
        if (entry) infoPanel.show(b.id);
      });
    });
    list.querySelectorAll<HTMLElement>('.bookmark-del').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(el.dataset.idx ?? '-1', 10);
        if (idx < 0) return;
        entries.splice(idx, 1);
        localStorage.setItem('bookmarks', JSON.stringify(entries));
        window.dispatchEvent(new CustomEvent('bookmarks:changed'));
      });
    });
  };
  render();
  window.addEventListener('bookmarks:changed', render);
})();

// Atmospheric T/P inputs feed Bennett refraction scaling.
(() => {
  const press = document.getElementById('atmo-pressure') as HTMLInputElement | null;
  const temp = document.getElementById('atmo-temperature') as HTMLInputElement | null;
  if (!press || !temp) return;
  const apply = () => {
    const p = parseFloat(press.value);
    const t = parseFloat(temp.value);
    if (Number.isFinite(p) && Number.isFinite(t)) {
      setAtmosphericConditions(p, t);
    }
  };
  press.addEventListener('input', apply);
  temp.addEventListener('input', apply);
  apply();
})();

// Side-panel collapse toggles (chevron buttons that slide each panel
// off-screen). State persists in localStorage so the user's layout
// preference survives reloads.
type PanelToggle = { btnId: string; bodyClass: string; collapsedArrow: string; expandedArrow: string; onlyWhen?: () => boolean };
const PANEL_TOGGLES: PanelToggle[] = [
  { btnId: 'left-panel-toggle', bodyClass: 'left-panel-collapsed',  collapsedArrow: '▶', expandedArrow: '◀' },
  { btnId: 'info-panel-toggle', bodyClass: 'info-panel-collapsed',  collapsedArrow: '◀', expandedArrow: '▶' },
  { btnId: 'sky-panel-toggle',  bodyClass: 'sky-panel-collapsed',   collapsedArrow: '▶', expandedArrow: '◀' },
];
for (const tog of PANEL_TOGGLES) {
  const btn = document.getElementById(tog.btnId);
  if (!btn) continue;
  // Restore from localStorage.
  const stored = localStorage.getItem(`ui-${tog.bodyClass}`);
  if (stored === '1') document.body.classList.add(tog.bodyClass);
  btn.textContent = document.body.classList.contains(tog.bodyClass) ? tog.collapsedArrow : tog.expandedArrow;
  btn.addEventListener('click', () => {
    document.body.classList.toggle(tog.bodyClass);
    const collapsed = document.body.classList.contains(tog.bodyClass);
    btn.textContent = collapsed ? tog.collapsedArrow : tog.expandedArrow;
    localStorage.setItem(`ui-${tog.bodyClass}`, collapsed ? '1' : '0');
  });
}
// Info-panel toggle should only appear when InfoPanel itself is visible
// (i.e. user has selected a body). Watch via MutationObserver on the panel.
{
  const infoPanel = document.getElementById('info-panel');
  const infoToggle = document.getElementById('info-panel-toggle');
  if (infoPanel && infoToggle) {
    const sync = () => {
      const open = infoPanel.classList.contains('visible');
      infoToggle.style.display = open ? 'block' : 'none';
    };
    sync();
    new MutationObserver(sync).observe(infoPanel, { attributes: true, attributeFilter: ['class', 'style'] });
  }
}

// ---- Observer-mode reticle ------------------------------------------------
// FPS-style compass tape: 1° = 2px, ticks every 15°, three copies of the
// 24-tick cycle so the centred segment is always inside the rendered tape.
const observerReticle = document.getElementById('observer-reticle')!;
const compassTape = document.getElementById('compass-tape')!;
const compassReadout = document.getElementById('compass-readout')!;
const COMPASS_LABELS_15 = [
  'N', '15', '30', 'NE', '60', '75',
  'E', '105', '120', 'SE', '150', '165',
  'S', '195', '210', 'SW', '240', '255',
  'W', '285', '300', 'NW', '330', '345',
];
const COMPASS_TICK_PX = 30; // 15° per tick × 2 px/° = 30 px
(function buildCompassTape(): void {
  let html = '';
  // Three copies of the 24-tick cycle so center segment is always populated.
  for (let copy = 0; copy < 3; copy++) {
    for (let i = 0; i < COMPASS_LABELS_15.length; i++) {
      const lbl = COMPASS_LABELS_15[i];
      const isCardinal = (i % 6 === 0);
      const isInter = !isCardinal && (i % 3 === 0);
      const cls = isCardinal ? 'tick cardinal' : isInter ? 'tick intercardinal' : 'tick';
      html += `<span class="${cls}">${lbl}</span>`;
    }
  }
  compassTape.innerHTML = html;
  // Total tape width: 24 ticks * 30px * 3 copies
  compassTape.style.width = `${24 * COMPASS_TICK_PX * 3}px`;
})();
function updateObserverReticle(): void {
  if (cameraCtl.getMode() !== 'observer') {
    observerReticle.classList.remove('visible');
    return;
  }
  observerReticle.classList.add('visible');
  const { azDeg, altDeg } = cameraCtl.getObserverLookDeg();
  // Strip is 280px wide. Each tick spans 30 px (15°×2 px/°) with text
  // centred inside it, so the tick representing `azDeg` has its label centre
  // at tape-x = (360 + azDeg) * 2 + 15 (start of middle copy + offset to centre).
  const stripWidth = 280;
  const tapeX = (360 + azDeg) * 2 + COMPASS_TICK_PX / 2;
  compassTape.style.transform = `translateX(${stripWidth / 2 - tapeX}px)`;

  // Show DMS to arcsec — what setting circles read. ~1″ display precision
  // is far below the propagator's actual accuracy (~arcmin for planets,
  // ~arcsec for stars), but it lets users distinguish neighbouring sky
  // targets that are 1–10′ apart, which the previous integer-degree
  // readout couldn't.
  const cardinal = cardinalLabel(azDeg);
  compassReadout.textContent =
    `${cardinal} · ${t('compass.az')} ${formatDMS(azDeg)} · ${t('compass.alt')} ${formatDMS(altDeg, true)}`;
  updateLocalTimeReadout();
  updateFovReadout();
  updateTrackReadout();
}

// Observer's local clock. Re-uses the existing simulation-time machinery:
// JD + observer longitude → mean local solar time. We could also read the
// top-bar `date-display` but recomputing here keeps the format independent
// (HH:MM:SS clock is more glanceable than the ISO date+TZ string). The
// site label tracks whichever observer preset is selected (or "自訂位置"
// if user typed manual lat/lon).
const localTimeReadoutEl = document.getElementById('local-time-readout')!;
function updateLocalTimeReadout(): void {
  if (cameraCtl.getMode() !== 'observer') {
    localTimeReadoutEl.style.display = 'none';
    return;
  }
  const { lon } = cameraCtl.getObserverLocation();
  const localTime = formatLocalMeanTime(clock.getJd(), lon);
  // Site label: prefer the matched preset's name; fall back to manual lat/lon.
  const presetSel = document.getElementById('observer-preset') as HTMLSelectElement | null;
  const presetVal = presetSel?.value;
  let siteLabel = t('observer.customLocation');
  if (presetVal) {
    const opt = presetSel?.querySelector(`option[value="${presetVal}"]`);
    if (opt?.textContent) siteLabel = opt.textContent.trim();
  }
  localTimeReadoutEl.style.display = '';
  localTimeReadoutEl.innerHTML =
    `<span class="clock">🕐 ${localTime}</span>` +
    `<span class="site">${siteLabel}</span>`;
}

// Tracking-rate readout: shown only while a body is being tracked (📌).
// Displays apparent rate in the local horizontal frame, the position-angle
// (compass-style: 0° = up/zenith, 90° = right/east), and the deviation
// from the pure-sidereal rate at the body's declination — useful for
// understanding why the moon needs faster-than-sidereal tracking.
const trackReadoutEl = document.getElementById('track-readout')!;
function updateTrackReadout(): void {
  if (cameraCtl.getMode() !== 'observer' || !cameraCtl.getObserverFollow()) {
    trackReadoutEl.classList.remove('visible');
    return;
  }
  const v = cameraCtl.getTrackedBodyAngularVelocity();
  if (!v) {
    trackReadoutEl.classList.remove('visible');
    return;
  }
  const arrow = paCardinal(v.paDeg);
  const dev = v.sideralOffsetArcsecPerSec;
  const devStr = Math.abs(dev) < 0.05
    ? t('track.sidereal')
    : `${dev > 0 ? '+' : ''}${dev.toFixed(2)}${t('track.vsSidereal')}`;
  trackReadoutEl.innerHTML =
    `<span class="track-rate">📌 ${formatRate(v.rateArcsecPerSec)}</span> ` +
    `<span class="track-pa">${arrow} ${v.paDeg.toFixed(1)}°</span>` +
    `<span class="track-dev">(${devStr})</span>`;
  trackReadoutEl.classList.add('visible');
}

// FOV / magnification / equiv. 35mm focal length pill below the crosshair.
const fovReadoutEl = document.getElementById('fov-readout')!;
const fovReadoutToggle = document.getElementById('toggle-fov-readout') as HTMLInputElement | null;
function updateFovReadout(): void {
  if (!fovReadoutToggle?.checked) {
    fovReadoutEl.classList.remove('visible');
    return;
  }
  // Vertical FOV from camera (Three.js stores fov as vertical degrees).
  const vFovDeg = cameraCtl.camera.fov;
  // Horizontal FOV from aspect ratio.
  const aspect = renderer.domElement.clientWidth / renderer.domElement.clientHeight;
  const vRad = vFovDeg * Math.PI / 180;
  const hFovDeg = 2 * Math.atan(Math.tan(vRad / 2) * aspect) * 180 / Math.PI;
  // Diagonal FOV — most natural single-number summary.
  const diag = Math.sqrt(1 + aspect * aspect);
  const dFovDeg = 2 * Math.atan(Math.tan(vRad / 2) * diag) * 180 / Math.PI;
  // Magnification: Stellarium-style, 50° naked-eye reference / current FOV
  // (use diagonal so it matches "what you can see at once").
  const mag = 50 / dFovDeg;
  // Equivalent 35mm focal length (full-frame: 24mm tall sensor).
  const focalMm = 12 / Math.tan(vRad / 2);
  // Render: FOV (h×v) · ×mag · ~mm
  fovReadoutEl.innerHTML =
    `<span class="fov-num">${formatFov(hFovDeg)}×${formatFov(vFovDeg)}</span>` +
    `<span class="sep">·</span>` +
    `<span class="mag-num">${mag < 10 ? mag.toFixed(2) : mag.toFixed(0)}×</span>` +
    `<span class="sep">·</span>` +
    `<span class="focal-num">~${formatFocal(focalMm)}</span>`;
  fovReadoutEl.classList.add('visible');
}
fovReadoutToggle?.addEventListener('change', updateFovReadout);

// Stellarium-style selection marker — 4 corner brackets that follow the
// currently-selected target on screen. We read the InfoPanel's selection
// (body or star) from the DOM data attributes that InfoPanel sets, which
// avoids a tighter coupling between InfoPanel and main.ts. Each frame we
// project the target's world direction to NDC → CSS pixels and update
// the marker's transform; if the target is behind the camera or below
// the horizon (in observer mode), the marker is hidden.
const selectionMarkerEl = document.getElementById('selection-marker')!;
const selectionMarkerLabel = document.getElementById('selection-marker-label')!;
const _markerWorldPos = new Vector3();
const _markerScreenVec = new Vector3();
function updateSelectionMarker(): void {
  const nameEl = document.getElementById('info-name') as HTMLElement | null;
  const infoVisible = document.getElementById('info-panel')?.classList.contains('visible');
  if (!nameEl || !infoVisible) {
    selectionMarkerEl.classList.remove('visible');
    return;
  }
  const bodyId = nameEl.dataset.bodyId;
  const starId = nameEl.dataset.starId;

  let labelText = '';
  // Resolve world position of the target.
  if (bodyId) {
    const entry = solarSystem.getBody(bodyId);
    if (!entry) { selectionMarkerEl.classList.remove('visible'); return; }
    const got = solarSystem.getWorldPosition(bodyId, _markerWorldPos);
    if (!got) { selectionMarkerEl.classList.remove('visible'); return; }
    labelText = bodyName(entry.descriptor);
  } else if (starId) {
    const star = NAMED_STARS.find((s) => s.id === starId);
    if (!star) { selectionMarkerEl.classList.remove('visible'); return; }
    // Stars: source the position from StarMap's cached PM + aberration
    // corrected scenePositions so the marker stays on top of the actual
    // rendered sprite. Falling back to J2000 projection would offset
    // the bracket from the sprite by the accumulated PM drift (the
    // "double-star" bug — bracket at J2000, sprite at current epoch).
    const cached = solarSystem.getStarMap()?.getStarScenePosition(starId);
    if (cached) {
      _markerWorldPos.copy(cached);
    } else {
      const dirEcl = raDecToEcliptic(star.raHours, star.decDeg);
      const dirScene = eclipticToScene(dirEcl);
      _markerWorldPos.copy(dirScene).multiplyScalar(4000);
    }
    const lang = getLang();
    labelText = lang === 'en' ? star.nameEn
              : lang === 'ja' ? (star.nameJa ?? star.nameEn)
              : star.name;
  } else if (nameEl.dataset.unnamedStarRa && nameEl.dataset.unnamedStarDec) {
    // HYG-catalog (unnamed) star — same projection as named, tagged via
    // `dataset.unnamedStarRa/Dec` rather than a star id.
    const ra = parseFloat(nameEl.dataset.unnamedStarRa);
    const dec = parseFloat(nameEl.dataset.unnamedStarDec);
    const dirEcl = raDecToEcliptic(ra, dec);
    const dirScene = eclipticToScene(dirEcl);
    _markerWorldPos.copy(dirScene).multiplyScalar(4000);
    labelText = `RA ${ra.toFixed(2)}h Dec ${dec.toFixed(1)}°`;
  } else {
    selectionMarkerEl.classList.remove('visible');
    return;
  }

  // Project to NDC. Vector3.project mutates the input, so use a copy.
  _markerScreenVec.copy(_markerWorldPos);
  _markerScreenVec.project(cameraCtl.camera);
  // Behind camera or wildly outside — z is in clip space [−1, 1]; >1 means
  // beyond far plane (rare for normal scenes), <−1 means behind camera.
  if (_markerScreenVec.z > 1 || _markerScreenVec.z < -1) {
    selectionMarkerEl.classList.remove('visible');
    return;
  }
  // Convert NDC [-1, 1] → CSS pixels.
  const cssW = renderer.domElement.clientWidth;
  const cssH = renderer.domElement.clientHeight;
  const x = (_markerScreenVec.x * 0.5 + 0.5) * cssW;
  const y = (-_markerScreenVec.y * 0.5 + 0.5) * cssH;
  // Hide if outside viewport (with a small margin so half-clipped target
  // still shows the visible side of the bracket).
  if (x < -40 || x > cssW + 40 || y < -40 || y > cssH + 40) {
    selectionMarkerEl.classList.remove('visible');
    return;
  }
  selectionMarkerEl.style.transform = `translate(${x}px, ${y}px)`;
  selectionMarkerLabel.textContent = labelText;
  selectionMarkerEl.classList.add('visible');
}

const perfHUD = new PerfHUD();

let lastTime = performance.now();
function tick(now: number): void {
  const realDt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;

  clock.tick(realDt);
  const currentJd = clock.getJd();
  solarSystem.update(currentJd);

  // Apply proper motion + annual aberration to the named-star sprites
  // and constellation lines. StarMap.setEpoch internally throttles to
  // every ~10 sim-days so 60 Hz playback at 1× sim-speed doesn't
  // re-evaluate every frame — PM is sub-arcsec/day so updates that
  // coarse are visually indistinguishable from per-frame.
  const starMap = solarSystem.getStarMap();
  if (starMap) {
    const earth = solarSystem.getBody('earth')?.descriptor.propagator;
    const earthSunDirEcl = earth ? earth.stateAt(currentJd).position.clone().normalize() : null;
    starMap.setEpoch(currentJd, earthSunDirEcl);
  }

  // Drive the scale-tier camera dolly when a transition is animating.
  // Outside an animation the user can freely orbit-zoom; we only take over
  // the camera when explicitly requested via setTier(). Skipped in observer
  // mode (which uses a totally different camera math path).
  if (tierCtl.isAnimating() && cameraCtl.getMode() !== 'observer') {
    const state = tierCtl.update(now);
    const dir = tierCtl.getCameraDirection();
    cameraCtl.camera.position.copy(dir).multiplyScalar(state.cameraDistance);
    cameraCtl.camera.lookAt(0, 0, 0);
    if (Math.abs(cameraCtl.camera.fov - state.cameraFov) > 0.05) {
      cameraCtl.camera.fov = state.cameraFov;
      cameraCtl.camera.updateProjectionMatrix();
    }
    // Apply layer weights — solar system, HYG cloud, host halos, disk.
    // Skip while landed on an exoplanet system: activateExoplanetSystem
    // captured a visibility snapshot of every distracting layer and set
    // them all to invisible. Calling these setters here would stomp the
    // snapshot (system-tier solarSystem weight = 1 → re-shows the whole
    // heliocentric group inside the climax shot — exact bug the user
    // reported in their first take, where HYG stars bled through the
    // Kepler-90 close-up after a stray scroll-zoom triggered an animation).
    if (!solarSystem.isExoplanetSystemActive()) {
      solarSystem.setSolarSystemOpacity(state.layerWeights.solarSystem);
      solarSystem.setHygCloudOpacity(state.layerWeights.hygCloud);
      solarSystem.setExoplanetHostsOpacity(state.layerWeights.hygCloud);
      solarSystem.setGalacticDiskOpacity(state.layerWeights.milkyWayDisk);
      // Local Group galaxies share the galactic-tier fade with the disk
      // (Phase #2 of v0.4 detail roll-up).
      solarSystem.setLocalGroupOpacity(state.layerWeights.milkyWayDisk);
    }
  } else {
    // Always advance internal state even when not driving the camera, so
    // subscribers and the controller's clock stay consistent.
    tierCtl.update(now);
    // Capture current camera direction so the next tier transition starts
    // along the user's chosen view angle.
    const camDir = cameraCtl.camera.position.clone();
    if (camDir.lengthSq() > 0) tierCtl.setCameraDirection(camDir);
  }

  cameraCtl.update();
  // Keep host halos billboarded to the camera each frame.
  solarSystem.updateExoplanetHosts(cameraCtl.camera.position);
  // Same for the Local Group galaxy billboards.
  solarSystem.updateLocalGroup(cameraCtl.camera.position);
  // Advance the active exoplanet system's planets, if any.
  solarSystem.updateExoplanetSystem(clock.getJd());
  solarSystem.updateLabelSizes(cameraCtl.camera, renderer.domElement.clientHeight);
  // Drive DSO real-angular-size scaling from current FOV + canvas height.
  solarSystem.updateMessierAngularScale(cameraCtl.camera.fov, renderer.domElement.clientHeight);
  // Animate meteor showers (in real wall-clock ms, not simulated time).
  solarSystem.getMeteorShowers()?.update(clock.getJd(), realDt * 1000);
  // Drive scintillation phase from wall-clock seconds.
  solarSystem.getRealStarfield()?.setTime(performance.now() / 1000);
  // Saturn ring shadow: sun direction in Saturn's tilt-local frame.
  atmosphericFx.updateSaturnRingShadow();
  // Jupiter / Saturn differential-rotation drift. Phase is JD-driven so
  // forward / reverse / fast time scrubbing all behave consistently.
  // Real System I vs System II: ~0.84 % faster at equator → about
  // 0.084 cycle / Jovian rotation period (~9.92 h ≈ 0.413 day).
  const jd = clock.getJd();
  const jupiter = solarSystem.getBody('jupiter');
  const saturn = solarSystem.getBody('saturn');
  if (jupiter) jupiter.mesh.setDriftPhase(((jd - 2451545.0) / 0.413) * 0.0084 % 1);
  if (saturn)  saturn.mesh.setDriftPhase(((jd - 2451545.0) / 0.444) * 0.0072 % 1);
  updateSkyForObserver();
  updateObserverReticle();
  updateSelectionMarker();
  if (calcPanel.isOpen()) {
    calcVectors.setReference(calcPanel.getReference());
    calcVectors.update();
  }

  // Render path: in observer mode with long-exposure on, route through
  // the compositor so frames accumulate into a ping-pong buffer (star
  // trails / tracking-streak photography). All other modes render direct.
  if (longExposure.isEnabled() && cameraCtl.getMode() === 'observer') {
    longExposure.composite(solarSystem.scene, cameraCtl.camera);
  } else {
    renderer.render(solarSystem.scene, cameraCtl.camera);
  }
  // Surface renderer stats so PerfHUD can show draw-call / triangle count.
  (window as { __drawCalls?: number }).__drawCalls = renderer.info.render.calls;
  (window as { __triangles?: number }).__triangles = renderer.info.render.triangles;
  perfHUD.mark();
  requestAnimationFrame(tick);
}

const NIGHT_BG = new Color(0x000005);
const _sunDirCache = new Vector3();
function updateSkyForObserver(): void {
  const atmo = solarSystem.getAtmosphereSky();
  const terrain = solarSystem.getLocalTerrain();
  const atmoOverlay = solarSystem.getAtmosphereOverlay();
  if (cameraCtl.getMode() !== 'observer') {
    if (atmo) atmo.setVisible(false);
    solarSystem.getHosekWilkieSky()?.setVisible(false);
    if (terrain) terrain.setVisible(false);
    // AtmosphereOverlay (Belt of Venus + airglow + moon-glow dome) is
    // observer-mode-only; without this hide, leaving observer mode at any
    // elevation > 0 left a visible "atmosphere arc" floating around the
    // observer's old surface position when seen from heliocentric view.
    if (atmoOverlay) atmoOverlay.setVisible(false);
    solarSystem.setStarfieldOpacity(1);
    renderer.setClearColor(NIGHT_BG, 1);
    solarSystem.setBackgroundColor(NIGHT_BG);
    solarSystem.getBody('earth')?.mesh.setObserverFade(null);
    // Zodiacal light is two tall cones (4000 units each) anchored at the
    // observer's position, only physically meaningful when viewed from
    // INSIDE in observer mode. From a heliocentric / follow view they
    // appear as a giant 3D sandstorm-coloured blob obscuring the scene.
    // Hide unconditionally outside observer mode regardless of the
    // realism toggle — the toggle still controls visibility once observer
    // mode activates.
    solarSystem.getZodiacalLight()?.setVisible(false);
    // Reset any per-body brightness tints / Earthshine / flattening left
    // over from observer mode so heliocentric view shows planets at their
    // natural colour and round shape.
    atmosphericFx.resetBodyVisuals();
    return;
  }
  if (terrain) terrain.setVisible(true);
  const ctx = cameraCtl.getObserverContext();
  if (!ctx) return;
  // Sun direction from observer
  const sunWorld = solarSystem.getWorldPosition('sun', _sunDirCache);
  if (!sunWorld) return;
  const sunDir = sunWorld.clone().sub(ctx.cameraPos).normalize();

  // Day factor still drives starfield fade and clear color (background fallback).
  const sunAlt = Math.asin(Math.max(-1, Math.min(1, sunDir.dot(ctx.zenith))));
  const dayFactor = sunAltToDayFactor(sunAlt);
  solarSystem.setStarfieldOpacity(1 - dayFactor);

  // Position local terrain at observer location, but offset downward by eye
  // height so the camera isn't co-planar with the mesh's ground plane (in
  // which case the mesh renders edge-on and disappears).
  const t2 = solarSystem.getLocalTerrain();
  if (t2) {
    const earthRadiusAU = solarSystem.getBodyRadius('earth') ?? 0;
    // earthRadiusAU is scene-AU at current scale. eyeHeight in metres ⇒ AU:
    //   eyeHeight_m / (earthRadius_m_per_AU) where earthRadius_m_per_AU is
    //   what 1 AU's worth of "earth radius" would be — but the scene
    //   already stores earth at earthRadiusAU, so the conversion is
    //   eyeHeight_m * (earthRadiusAU / 6_371_000).
    const eyeHeightAU = (CameraController.OBSERVER_EYE_HEIGHT_M / 6371000) * earthRadiusAU;
    t2.positionAt(ctx.cameraPos, ctx.zenith, ctx.east, ctx.north, eyeHeightAU);
  }

  // Update horizontal grid orientation if visible.
  solarSystem.getCelestialGrids()?.setObserverFrame(ctx.zenith, ctx.east, ctx.north);

  // Realism: zodiacal light orientation
  const zod = solarSystem.getZodiacalLight();
  if (zod) {
    if (solarSystem.realism.get().zodiacal) {
      zod.setVisible(true);
      zod.setCenter(ctx.cameraPos);
      zod.orient(sunDir, sunAlt > 0 ? Math.sin(sunAlt) : -Math.sin(-sunAlt));
    } else {
      zod.setVisible(false);
    }
  }

  // Atmospheric refraction lifts every body's apparent direction toward the
  // zenith — the sun stays visible ~34′ past geometric horizon. We apply
  // this BEFORE the extinction / eclipse / flattening passes so they all
  // use the apparent positions naturally.
  if (solarSystem.realism.get().extinction) {
    atmosphericFx.applyRefractionLift(ctx.cameraPos, ctx.zenith);
  }

  // Realism: drive atmosphere overlay (Belt of Venus + airglow + light pollution).
  const overlay = solarSystem.getAtmosphereOverlay();
  if (overlay) {
    const r = solarSystem.realism.get();
    if (r.beltOfVenus || r.airglow) {
      overlay.setSunDirection(sunDir);
      overlay.setZenith(ctx.zenith);
      overlay.setCenter(ctx.cameraPos);
      overlay.setBeltEnabled(r.beltOfVenus);
      overlay.setAirglowEnabled(r.airglow);
    } else {
      overlay.setBeltEnabled(false);
      overlay.setAirglowEnabled(false);
    }
  }

  // Realism: feed observer zenith + moon-glow factor to RealStarfield + DSOs.
  const stars = solarSystem.getRealStarfield();
  const messier = solarSystem.getMessierLayer();
  const realismState = solarSystem.realism.get();
  // Compute moon-induced dimming once and reuse for stars + DSO mag limit
  // + atmosphere overlay glow.
  let moonDim = 0;
  let moonDirCache: Vector3 | null = null;
  if (realismState.moonGlow) {
    const moonWorld = solarSystem.getWorldPosition('moon', new Vector3());
    if (moonWorld) {
      const moonDir = moonWorld.clone().sub(ctx.cameraPos).normalize();
      moonDirCache = moonDir;
      const moonAltSin = moonDir.dot(ctx.zenith);
      const sunMoonCos = sunDir.dot(moonDir);
      const illumFrac = (1 - sunMoonCos) / 2;
      moonDim = Math.max(0, moonAltSin) * illumFrac * 2.2;
    }
  }
  if (stars) {
    stars.setObserverZenith(ctx.zenith);
    stars.setMoonExtraDimMag(moonDim);
  }
  if (messier) {
    messier.setObserverZenith(ctx.zenith);
    // DSO sky-background mag limit. Naked-eye baseline ≈ 6.5 in pristine
    // dark skies; degrades by 0.4 mag per Bortle step + the moon dimming
    // contribution computed above. Telescope optics extend the limit
    // separately via uMagLimit on RealStarfield.
    const bortle = (document.getElementById('bortle-slider') as HTMLInputElement | null);
    const bortleVal = bortle ? parseInt(bortle.value, 10) : 4;
    const bortleDim = Math.max(0, (bortleVal - 1)) * 0.4;
    const dsoLimit = 6.5 - bortleDim - moonDim;
    messier.setDsoMagLimit(dsoLimit);
  }
  // Atmosphere overlay also gets the moon glow factor for ambient sky brightening.
  const overlayWithMoon = solarSystem.getAtmosphereOverlay() as
    { setMoonGlow?: (intensity: number, dirLocal: Vector3 | null) => void } | null;
  overlayWithMoon?.setMoonGlow?.(moonDim, moonDirCache);

  // Per-planet extinction (Bouguer per RGB channel) + Venus phase magnitude.
  // Atmospheric extinction coefficients (mag/airmass), V band: k_R≈0.10,
  // k_G≈0.16, k_B≈0.28 — blue suffers most → low planet appears red.
  atmosphericFx.applyBodyExtinctionAndPhase(realismState.extinction, ctx.cameraPos, ctx.zenith, sunWorld);

  // Earthshine on moon — peaks at new crescent (Earth full from moon).
  if (realismState.moonGlow) {
    atmosphericFx.applyEarthshine(ctx.cameraPos, sunWorld);
  } else {
    atmosphericFx.resetEarthshine();
  }

  // Lunar eclipse: when moon is in Earth's umbra (full moon + close
  // alignment), tint it dark red. Modulates the brightness tint already
  // set by extinction so the effect stacks naturally.
  atmosphericFx.applyLunarEclipse(sunWorld);

  // Per-fragment planet-on-planet shadows. The shader on each body's
  // material checks angular sun/occluder overlap and dims the surface
  // where the occluder blocks the sun — gives real directional shadows
  // (Galilean shadow disc on Jupiter's cloud tops, Moon shadow on Earth
  // during solar eclipse, Earth shadow on Moon during lunar eclipse).
  // Supersedes the old applyPlanetaryMoonEclipses flat-tint approach.
  atmosphericFx.applyBodyShadows(sunWorld);

  // Atmospheric refraction flattens the sun / moon disc near the horizon.
  // Effect is only meaningful below ~10° altitude.
  atmosphericFx.applyAtmosphericFlattening(ctx.cameraPos, ctx.zenith);

  // Punch a soft hole in Earth's diffuse ball where LocalTerrain covers it.
  // Outer LOD covers ~67.5 km half-width which subtends ≈0.61° at Earth's
  // centre; the outer mesh's own alpha then feathers out from ~0.47°→0.61°.
  // We make Earth ball fully transparent inside that disk (so the mesh isn't
  // overlaid on the duplicated ball texture) and opaque past 0.9° (well
  // before the visible 2.56° horizon at 6.4 km altitude), so the user
  // perceives a single continuous ground from 0° to the horizon.
  solarSystem.getBody('earth')?.mesh.setObserverFade({
    zenithWorld: ctx.zenith,
    startDeg: 0.9,
    endDeg: 0.45,
  });

  if (atmo) {
    const skyModel = solarSystem.getSkyModel();
    const hosek = solarSystem.getHosekWilkieSky();
    const usePreetham = skyModel === 'preetham';
    // Drive BOTH skies every frame regardless of which is active — that
    // way a mid-twilight toggle doesn't snap colours, and any latent
    // sun-direction/zenith state stays consistent. Cheap: each setter
    // is one uniform-write.
    atmo.setVisible(usePreetham);
    atmo.setSunDirection(sunDir);
    atmo.setCenter(ctx.cameraPos);
    atmo.setUp(ctx.zenith);
    atmo.applyTwilightTuning(sunAlt * 180 / Math.PI);
    if (hosek) {
      hosek.setVisible(!usePreetham);
      hosek.setSunDirection(sunDir);
      hosek.setCenter(ctx.cameraPos);
      hosek.setUp(ctx.zenith);
    }
    // Background should be black so sky shader is the only sky source.
    renderer.setClearColor(NIGHT_BG, 1);
    solarSystem.setBackgroundColor(NIGHT_BG);
  } else {
    // Fallback: linear lerp like before
    const tmp = new Color();
    skyColorForDayFactor(dayFactor, tmp);
    renderer.setClearColor(tmp, 1);
    solarSystem.setBackgroundColor(tmp);
  }
}
requestAnimationFrame(tick);
