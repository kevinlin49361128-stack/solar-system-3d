import type { CameraController, CameraMode } from '../controls/CameraController';
import type { ScaleController, ScaleMode } from '../controls/ScaleController';
import type { SolarSystem } from '../scene/SolarSystem';
import type { InfoPanel } from './InfoPanel';
import type { SkyPanel } from './SkyPanel';
import type { CalcPanel } from './CalcPanel';
import type { CalcVectors } from '../scene/CalcVectors';
import type { EventsPanel } from './EventsPanel';
import { OBSERVER_CITIES, OBSERVER_OBSERVATORIES, OBSERVER_PRESETS } from '../physics/topocentric';
import { DARK_SKY_PLACES, nearestDarkSkyPlaces } from '../data/darkSkyPlaces';
import { toast } from './toast';
import { ASTRO_EVENTS } from '../data/events';
import type { SimulationClock } from '../time/SimulationClock';
import { t, onLanguageChange, bodyName, getLang } from '../i18n';
import type { RealismPreset, RealismSettings } from '../scene/RealismSettings';

/**
 * Wires up the left-side UI panel: camera mode select, follow-body select,
 * scale-mode toggle, and visibility toggles.
 */
export class LeftPanel {
  constructor(
    solarSystem: SolarSystem,
    cameraCtl: CameraController,
    scaleCtl: ScaleController,
    infoPanel: InfoPanel,
    skyPanel: SkyPanel,
    calcPanel: CalcPanel,
    calcVectors: CalcVectors,
    clock: SimulationClock,
    eventsPanel: EventsPanel,
  ) {
    // Tab bar — switch between scene / display / realism / observe / advanced
    // panels. Persistence is handled by the same `ui-pref-` mechanism via a
    // hidden hidden-input (we set its value when the tab changes); this keeps
    // the localStorage layer simple and consistent. Observer-mode entry
    // auto-jumps to the "observe" tab via a CustomEvent dispatched from the
    // observer-enter handler below.
    const tabButtons = document.querySelectorAll<HTMLButtonElement>('#left-tab-bar .tab-button');
    const tabPanels = document.querySelectorAll<HTMLElement>('.tab-panel[data-tab-panel]');
    const setActiveTab = (name: string): void => {
      tabButtons.forEach((b) => b.classList.toggle('active', b.dataset.tab === name));
      tabPanels.forEach((p) => p.classList.toggle('active', p.dataset.tabPanel === name));
      try { localStorage.setItem('ui-pref-left-tab', name); } catch { /* private mode */ }
      // Reset scroll on tab change so the user always lands at the top of the
      // new tab — otherwise switching from a long Display tab to short Scene
      // tab leaves the panel scrolled into emptiness.
      const lp = document.getElementById('left-panel');
      if (lp) lp.scrollTop = 0;
    };
    tabButtons.forEach((btn) => {
      btn.addEventListener('click', () => setActiveTab(btn.dataset.tab ?? 'scene'));
    });
    // Restore last-used tab.
    try {
      const saved = localStorage.getItem('ui-pref-left-tab');
      if (saved) setActiveTab(saved);
    } catch { /* private mode — keep default */ }
    // External hook so the observer-enter handler can request a jump without
    // needing direct access to the closure.
    window.addEventListener('ui:left-tab', (e) => {
      const ev = e as CustomEvent<{ tab: string }>;
      if (ev.detail?.tab) setActiveTab(ev.detail.tab);
    });

    const cameraMode = document.getElementById('camera-mode') as HTMLSelectElement;
    cameraMode.addEventListener('change', () => {
      cameraCtl.setMode(cameraMode.value as CameraMode);
    });

    const followBody = document.getElementById('follow-body') as HTMLSelectElement;
    const buildBodyOptions = () => {
      // Preserve selection across rebuilds (e.g. after a language switch).
      const prev = followBody.value;
      followBody.innerHTML = '';
      const placeholder = document.createElement('option');
      placeholder.value = '';
      placeholder.textContent = '—';
      followBody.appendChild(placeholder);
      for (const entry of solarSystem.getAllBodies()) {
        const opt = document.createElement('option');
        opt.value = entry.descriptor.id;
        opt.textContent = bodyName(entry.descriptor);
        followBody.appendChild(opt);
      }
      followBody.value = prev;
    };
    buildBodyOptions();
    onLanguageChange(buildBodyOptions);
    followBody.value = '';
    followBody.addEventListener('change', () => {
      const v = followBody.value || null;
      cameraCtl.setFollow(v);
      if (v) {
        cameraMode.value = 'follow';
        infoPanel.show(v);
      }
    });

    document.querySelectorAll<HTMLButtonElement>('.scale-toggle button[data-scale]').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.scale-toggle button[data-scale]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        scaleCtl.setMode(btn.dataset.scale as ScaleMode);
      });
    });

    document.querySelectorAll<HTMLButtonElement>('.scale-toggle button[data-frame]').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.scale-toggle button[data-frame]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        scaleCtl.setFrame(btn.dataset.frame as 'heliocentric' | 'geocentric');
      });
    });

    (document.getElementById('toggle-orbits') as HTMLInputElement).addEventListener('change', (e) => {
      solarSystem.setOrbitsVisible((e.target as HTMLInputElement).checked);
    });

    (document.getElementById('toggle-comet-orbits') as HTMLInputElement).addEventListener('change', (e) => {
      solarSystem.setCometOrbitsVisible((e.target as HTMLInputElement).checked);
    });

    (document.getElementById('toggle-labels') as HTMLInputElement).addEventListener('change', (e) => {
      solarSystem.setLabelsVisible((e.target as HTMLInputElement).checked);
    });

    (document.getElementById('toggle-belts') as HTMLInputElement).addEventListener('change', (e) => {
      solarSystem.setBeltsVisible((e.target as HTMLInputElement).checked);
    });

    (document.getElementById('toggle-constellations') as HTMLInputElement).addEventListener('change', (e) => {
      solarSystem.setConstellationsVisible((e.target as HTMLInputElement).checked);
    });

    (document.getElementById('toggle-star-labels') as HTMLInputElement).addEventListener('change', (e) => {
      solarSystem.setStarLabelsVisible((e.target as HTMLInputElement).checked);
    });

    (document.getElementById('toggle-spacecraft') as HTMLInputElement).addEventListener('change', (e) => {
      solarSystem.setSpacecraftVisible((e.target as HTMLInputElement).checked);
    });

    const lagrangeToggle = document.getElementById('toggle-lagrange') as HTMLInputElement | null;
    if (lagrangeToggle) {
      lagrangeToggle.addEventListener('change', (e) => {
        solarSystem.setLagrangePointsVisible((e.target as HTMLInputElement).checked);
      });
    }

    (document.getElementById('toggle-satellites') as HTMLInputElement).addEventListener('change', (e) => {
      solarSystem.setSatellitesVisible((e.target as HTMLInputElement).checked);
    });

    (document.getElementById('toggle-messier') as HTMLInputElement).addEventListener('change', (e) => {
      solarSystem.setMessierVisible((e.target as HTMLInputElement).checked);
    });

    (document.getElementById('toggle-dso-stylized') as HTMLInputElement).addEventListener('change', (e) => {
      solarSystem.setMessierStylized((e.target as HTMLInputElement).checked);
    });

    // Realism / visual layer toggles. Single source of truth lives in
    // solarSystem.realism; checkboxes both write to and read from it so
    // preset buttons stay in sync.
    const realismKeys: Array<{ id: string; key: keyof RealismSettings }> = [
      { id: 'realism-extinction',     key: 'extinction' },
      { id: 'realism-moon-glow',      key: 'moonGlow' },
      { id: 'realism-bv-color',       key: 'bvColor' },
      { id: 'realism-sat-shadow',     key: 'satShadow' },
      { id: 'realism-dso-realsize',   key: 'dsoRealSize' },
      { id: 'realism-deep-stars',     key: 'deepStars' },
      { id: 'realism-sharpless2',     key: 'sharpless2' },
      { id: 'realism-ngc-full',       key: 'ngcFull' },
      { id: 'vfx-milkyway',           key: 'milkyway' },
      { id: 'vfx-belt-of-venus',      key: 'beltOfVenus' },
      { id: 'vfx-zodiacal',           key: 'zodiacal' },
      { id: 'vfx-airglow',            key: 'airglow' },
      { id: 'vfx-meteors',            key: 'meteors' },
    ];
    for (const { id, key } of realismKeys) {
      const cb = document.getElementById(id) as HTMLInputElement | null;
      if (!cb) continue;
      cb.addEventListener('change', () => {
        solarSystem.realism.set(key, cb.checked);
      });
    }
    const presetButtons: Array<{ id: string; preset: RealismPreset }> = [
      { id: 'preset-stylized',  preset: 'stylized' },
      { id: 'preset-balanced',  preset: 'balanced' },
      { id: 'preset-realistic', preset: 'realistic' },
    ];
    for (const { id, preset } of presetButtons) {
      const btn = document.getElementById(id);
      if (!btn) continue;
      btn.addEventListener('click', () => {
        solarSystem.realism.setPreset(preset);
        for (const b of presetButtons) {
          document.getElementById(b.id)?.classList.toggle('active', b.id === id);
        }
      });
    }
    // Re-sync checkboxes whenever state changes (preset clicks, programmatic).
    // Dispatch a change event after each flip so the generic UI-persistence
    // helper in main.ts also picks up the new state and writes localStorage.
    solarSystem.realism.subscribe((s) => {
      for (const { id, key } of realismKeys) {
        const cb = document.getElementById(id) as HTMLInputElement | null;
        if (cb && cb.checked !== s[key]) {
          cb.checked = s[key];
          cb.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }
    });

    // Celestial grids — 4 independent toggles.
    for (const kind of ['equatorial', 'ecliptic', 'galactic', 'horizontal'] as const) {
      const cb = document.getElementById(`grid-${kind}`) as HTMLInputElement | null;
      if (!cb) continue;
      cb.addEventListener('change', () => {
        solarSystem.setGridVisible(kind, cb.checked);
      });
    }
    const lm = document.getElementById('toggle-lunar-mansions') as HTMLInputElement | null;
    lm?.addEventListener('change', () => solarSystem.setLunarMansionsVisible(lm.checked));

    (document.getElementById('toggle-iau-bounds') as HTMLInputElement).addEventListener('change', (e) => {
      solarSystem.setIAUBoundariesVisible((e.target as HTMLInputElement).checked);
    });

    // Sync initial layer visibility with the (possibly unchecked) checkboxes.
    solarSystem.setConstellationsVisible((document.getElementById('toggle-constellations') as HTMLInputElement).checked);
    solarSystem.setStarLabelsVisible((document.getElementById('toggle-star-labels') as HTMLInputElement).checked);
    solarSystem.setSpacecraftVisible((document.getElementById('toggle-spacecraft') as HTMLInputElement).checked);
    {
      const lg = document.getElementById('toggle-lagrange') as HTMLInputElement | null;
      if (lg) solarSystem.setLagrangePointsVisible(lg.checked);
    }
    solarSystem.setIAUBoundariesVisible((document.getElementById('toggle-iau-bounds') as HTMLInputElement).checked);

    this.wireObserverPanel(cameraCtl, scaleCtl, cameraMode, followBody, skyPanel, infoPanel, solarSystem);
    this.wireCalcPanel(calcPanel, calcVectors, infoPanel);
    this.wireEventsPanel(clock, cameraCtl, infoPanel, cameraMode, followBody);
    this.wireNBodyToggle(solarSystem, clock);
    this.wireOpticsPreset(cameraCtl, solarSystem);

    document.getElementById('auto-events-toggle')!.addEventListener('click', () => {
      if (eventsPanel.isOpen()) eventsPanel.hide();
      else eventsPanel.show();
      infoPanel.updateCompactState();
    });
    document.getElementById('auto-events-close')!.addEventListener('click', () => {
      infoPanel.updateCompactState();
    });
  }

  private wireOpticsPreset(cameraCtl: CameraController, solarSystem: SolarSystem): void {
    interface OpticsPreset {
      fovDeg: number;
      magLimit: number;
      magnification: string;
      vignette: 'circle' | 'binocular' | 'none';
    }
    // Limiting magnitude approx: 5 + 5·log10(D/7) where D = aperture in mm
    // (assumes trained dark-adapted eye, transparent sky).
    //
    // Smart-telescope entries use the DIAGONAL FOV (so the value we feed
    // to setObserverFov is the angle of the longer-than-horizontal viewing
    // cone). magLimit is the practical reach after a ~30 min stack with
    // the device's own optics + sensor — Seestar S50 has hit mag 15.5 in
    // suburban skies per published reviews, and the others are scaled by
    // aperture × integration time.
    const presets: Record<string, OpticsPreset> = {
      naked:           { fovDeg: 50,   magLimit: 6.5,  magnification: '1×',  vignette: 'none' },
      binocular7x50:   { fovDeg: 7.5,  magLimit: 9.8,  magnification: '7×',  vignette: 'binocular' },
      binocular10x50:  { fovDeg: 5.0,  magLimit: 9.8,  magnification: '10×', vignette: 'binocular' },
      '80mm-25mm':     { fovDeg: 1.56, magLimit: 10.3, magnification: '32×', vignette: 'circle' },
      '8inch-25mm':    { fovDeg: 0.625, magLimit: 12.5, magnification: '80×', vignette: 'circle' },
      '8inch-10mm':    { fovDeg: 0.25,  magLimit: 12.5, magnification: '200×', vignette: 'circle' },
      // Smart telescopes — sensor-based, no eyepiece vignette.
      // Specs from manufacturer datasheets cross-checked with Cloudy
      // Nights reviews (2024-25).
      'seestar-s30':   { fovDeg: 1.84, magLimit: 14.5, magnification: '30min stack', vignette: 'none' },
      'seestar-s50':   { fovDeg: 1.46, magLimit: 15.5, magnification: '30min stack', vignette: 'none' },
      'vespera-pro':   { fovDeg: 2.91, magLimit: 16.0, magnification: '30min stack', vignette: 'none' },
      'dwarf-3':       { fovDeg: 3.61, magLimit: 15.0, magnification: '30min stack', vignette: 'none' },
    };

    const sel = document.getElementById('optics-preset') as HTMLSelectElement;
    const info = document.getElementById('optics-info') as HTMLElement;
    const vignette = document.getElementById('optics-vignette') as HTMLElement;

    const apply = () => {
      const p = presets[sel.value] ?? presets.naked;
      cameraCtl.setObserverFov(p.fovDeg);
      info.innerHTML =
        `${t('optics.fov')} <b style="color:var(--accent);">${p.fovDeg}°</b> · ` +
        `${t('optics.mag')} <b>${p.magnification}</b><br>` +
        `${t('optics.magLimit')} <b>${p.magLimit.toFixed(1)}</b>`;
      if (p.vignette === 'none') {
        vignette.style.display = 'none';
      } else {
        vignette.style.display = '';
        vignette.classList.toggle('binocular', p.vignette === 'binocular');
      }
      // BSC tops out at mag 6.5; the optional HYG-extended catalog reaches
      // mag 9. When the user picks an optics preset that benefits from
      // deeper stars (binoculars / telescopes), kick off the lazy fetch
      // and raise the rendered magnitude limit accordingly.
      const stars = solarSystem.getRealStarfield();
      if (p.magLimit > 6.5 && stars && !stars.isExtendedLoaded()) {
        stars.loadExtendedCatalog().catch(() => {});
      }
      solarSystem.setStarfieldMagnitudeLimit(Math.min(p.magLimit, 9.0));
    };

    sel.addEventListener('change', apply);
    apply();

    // Bortle scale slider — labels are i18n-keyed.
    const bortleSlider = document.getElementById('bortle-slider') as HTMLInputElement;
    const bortleVal = document.getElementById('bortle-val') as HTMLElement;
    const bortleDesc = document.getElementById('bortle-desc') as HTMLElement;
    if (bortleSlider) {
      const applyBortle = () => {
        const v = parseInt(bortleSlider.value, 10);
        bortleVal.textContent = String(v);
        bortleDesc.textContent = t(`optics.bortle.${v}`);
        solarSystem.setBortleScale(v);
      };
      bortleSlider.addEventListener('input', applyBortle);
      applyBortle();
      onLanguageChange(applyBortle); // re-render labels when language changes
    }
  }

  private wireNBodyToggle(solarSystem: SolarSystem, clock: SimulationClock): void {
    const btn = document.getElementById('nbody-toggle') as HTMLButtonElement;
    const yoshida = document.getElementById('nbody-yoshida4') as HTMLInputElement | null;
    const relativ = document.getElementById('nbody-relativistic') as HTMLInputElement | null;
    const updateLabel = () => {
      const on = solarSystem.isNBodyEnabled();
      btn.textContent = on ? t('nbody.toKepler') : t('nbody.toNbody');
      btn.classList.toggle('active', on);
      // Sub-toggles only meaningful when N-body is on; don't disable them
      // outright (so the user can pre-select) but indicate visual state.
      if (yoshida) yoshida.parentElement!.style.opacity = on ? '1' : '0.5';
      if (relativ) relativ.parentElement!.style.opacity = on ? '1' : '0.5';
    };
    onLanguageChange(updateLabel);
    btn.addEventListener('click', () => {
      if (solarSystem.isNBodyEnabled()) solarSystem.disableNBody();
      else solarSystem.enableNBody(clock.getJd());
      // Re-apply pending integrator / GR settings on enable.
      if (solarSystem.isNBodyEnabled()) {
        if (yoshida?.checked) solarSystem.setNBodyIntegrator('yoshida4');
        if (relativ?.checked) solarSystem.setNBodyRelativistic(true);
      }
      updateLabel();
    });
    yoshida?.addEventListener('change', () => {
      solarSystem.setNBodyIntegrator(yoshida.checked ? 'yoshida4' : 'verlet');
    });
    relativ?.addEventListener('change', () => {
      solarSystem.setNBodyRelativistic(relativ.checked);
    });
    updateLabel();
  }

  private wireEventsPanel(
    clock: SimulationClock,
    cameraCtl: CameraController,
    infoPanel: InfoPanel,
    cameraModeSelect: HTMLSelectElement,
    followBodySelect: HTMLSelectElement,
  ): void {
    const sel = document.getElementById('event-select') as HTMLSelectElement;
    for (const e of ASTRO_EVENTS) {
      const opt = document.createElement('option');
      opt.value = e.id;
      opt.textContent = `${e.iso === 'now' ? t('lp.now') : e.iso.slice(0, 10)} · ${e.name}`;
      sel.appendChild(opt);
    }
    sel.addEventListener('change', () => {
      const e = ASTRO_EVENTS.find(x => x.id === sel.value);
      if (!e) return;
      const date = e.iso === 'now' ? new Date() : new Date(e.iso);
      clock.setDate(date);
      if (e.followBody) {
        cameraCtl.setFollow(e.followBody);
        infoPanel.show(e.followBody);
        cameraModeSelect.value = 'follow';
        followBodySelect.value = e.followBody;
      }
      // Reset selector so the same event can be re-triggered.
      setTimeout(() => { sel.value = ''; }, 200);
    });
  }

  private wireCalcPanel(calcPanel: CalcPanel, calcVectors: CalcVectors, infoPanel: InfoPanel): void {
    const toggle = document.getElementById('calc-toggle') as HTMLButtonElement;
    const showVec = document.getElementById('calc-show-vectors') as HTMLInputElement;

    const updateBtnState = () => {
      const open = calcPanel.isOpen();
      toggle.textContent = open ? t('calc.disable') : t('calc.enable');
      toggle.classList.toggle('active', open);
      calcVectors.setVisible(open && showVec.checked);
      infoPanel.updateCompactState();
    };
    onLanguageChange(updateBtnState);

    toggle.addEventListener('click', () => {
      if (calcPanel.isOpen()) calcPanel.hide();
      else calcPanel.show();
      updateBtnState();
    });
    showVec.addEventListener('change', () => updateBtnState());
    updateBtnState();
  }

  private wireObserverPanel(
    cameraCtl: CameraController,
    scaleCtl: ScaleController,
    cameraModeSelect: HTMLSelectElement,
    followBodySelect: HTMLSelectElement,
    skyPanel: SkyPanel,
    infoPanel: InfoPanel,
    solarSystem: SolarSystem,
  ): void {
    const presetSel = document.getElementById('observer-preset') as HTMLSelectElement;
    const latInput = document.getElementById('observer-lat') as HTMLInputElement;
    const lonInput = document.getElementById('observer-lon') as HTMLInputElement;
    const elevInput = document.getElementById('observer-elev') as HTMLInputElement | null;
    const enterBtn = document.getElementById('observer-enter') as HTMLButtonElement;
    const exitBtn = document.getElementById('observer-exit') as HTMLButtonElement;
    const lockHorizon = document.getElementById('observer-lock-horizon') as HTMLInputElement;

    cameraCtl.setObserverLockHorizon(lockHorizon.checked);
    lockHorizon.addEventListener('change', () => {
      cameraCtl.setObserverLockHorizon(lockHorizon.checked);
    });

    // Pick a preset's display name in the active UI language. Falls
    // back along nameEn/name so missing localizations don't render
    // empty.
    const localizedPresetName = (p: { name: string; nameEn?: string; nameJa?: string }): string => {
      const lang = getLang();
      if (lang === 'en') return p.nameEn ?? p.name;
      if (lang === 'ja') return p.nameJa ?? p.nameEn ?? p.name;
      return p.name;
    };

    // (Re)build the city + observatory <optgroup>s. Called on init and on
    // language change so option text + group labels follow the active
    // language. We preserve the currently-selected value across rebuilds.
    const buildPresetGroups = (): void => {
      const previousValue = presetSel.value;
      // Clear any previously-built optgroups (keeps any other static
      // options the markup may carry).
      presetSel.querySelectorAll('optgroup').forEach(g => g.remove());

      const cityGroup = document.createElement('optgroup');
      cityGroup.label = t('lp.cityGroup');
      for (const p of OBSERVER_CITIES) {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = localizedPresetName(p);
        cityGroup.appendChild(opt);
      }
      presetSel.appendChild(cityGroup);

      const obsGroup = document.createElement('optgroup');
      obsGroup.label = t('lp.observatoryGroup');
      for (const p of OBSERVER_OBSERVATORIES) {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = localizedPresetName(p);
        obsGroup.appendChild(opt);
      }
      presetSel.appendChild(obsGroup);

      const dspGroup = document.createElement('optgroup');
      dspGroup.label = t('lp.darkSkyGroup');
      for (const p of DARK_SKY_PLACES) {
        const opt = document.createElement('option');
        opt.value = p.id;
        // Surface the Bortle class right in the option text so the user
        // can pick visually ("oh, that one's Bortle 1") without having
        // to commit and then read the SiteInfo card.
        opt.textContent = p.bortle != null
          ? `${localizedPresetName(p)} · B${p.bortle}`
          : localizedPresetName(p);
        dspGroup.appendChild(opt);
      }
      presetSel.appendChild(dspGroup);

      if (previousValue) presetSel.value = previousValue;
    };
    buildPresetGroups();
    onLanguageChange(buildPresetGroups);

    // Default to Kaohsiung
    presetSel.value = 'kaohsiung';
    const defaultLoc = findPreset('kaohsiung')!;
    latInput.value = String(defaultLoc.lat);
    lonInput.value = String(defaultLoc.lon);

    const updatePin = () => {
      const lat = parseFloat(latInput.value);
      const lon = parseFloat(lonInput.value);
      if (!Number.isNaN(lat) && !Number.isNaN(lon) && cameraCtl.getMode() !== 'observer') {
        solarSystem.setLocationPin(lat, lon);
      }
    };

    presetSel.addEventListener('change', () => {
      const p = findPreset(presetSel.value);
      if (p) {
        latInput.value = String(p.lat);
        lonInput.value = String(p.lon);
        // Auto-populate the elevation input if the preset carries one;
        // cities default to 0 (sea level). User can still override.
        if (elevInput) elevInput.value = String(p.elevationM ?? 0);
        if (cameraCtl.getMode() === 'observer') {
          cameraCtl.setObserverLocation(p.lat, p.lon, p.elevationM ?? 0);
          // Refresh LocalTerrain to match the new location — without this,
          // switching presets while in observer mode leaves the previous
          // site's DEM stranded at the new lat/lon, causing visible
          // clipping through the new terrain.
          solarSystem.getLocalTerrain()?.loadForLocation(p.lat, p.lon);
          // Also refresh atmospheric pressure for the new altitude.
          const pInput = document.getElementById('atmo-pressure') as HTMLInputElement | null;
          if (pInput) {
            const pp = Math.round(1013 * Math.exp(-(p.elevationM ?? 0) / 8400));
            pInput.value = String(pp);
            pInput.dispatchEvent(new Event('change', { bubbles: true }));
          }
          // Update timezone offset so the displayed clock matches the new longitude.
          const offsetMin = Math.round((p.lon / 15) * 60);
          window.dispatchEvent(new CustomEvent('sim:tz-override', { detail: { offsetMin } }));
        } else {
          solarSystem.setLocationPin(p.lat, p.lon);
        }
        if (p.description) showSiteInfo(p);
        else hideSiteInfo();
        // Auto-set Bortle scale to match the location's typical light pollution.
        if (p.bortle != null) {
          const bSlider = document.getElementById('bortle-slider') as HTMLInputElement | null;
          if (bSlider && bSlider.value !== String(p.bortle)) {
            bSlider.value = String(p.bortle);
            bSlider.dispatchEvent(new Event('input'));
          }
        }
      } else {
        hideSiteInfo();
        solarSystem.hideLocationPin();
      }
      infoPanel.updateCompactState();
    });

    // Live-update pin when user types lat/lon manually.
    latInput.addEventListener('input', updatePin);
    lonInput.addEventListener('input', updatePin);
    // Initial pin at the default Kaohsiung location.
    setTimeout(() => updatePin(), 100);

    // Live-apply elevation changes while already in observer mode. Without
    // this, typing a new value into the elevation field had no effect —
    // the field was only sampled on observer-enter / preset-change / GPS
    // / map-pick, so users would type "8000" expecting Mt. Whitney height
    // and see no change. Now any input event re-positions the camera.
    if (elevInput) {
      elevInput.addEventListener('input', () => {
        if (cameraCtl.getMode() !== 'observer') return;
        const lat = parseFloat(latInput.value);
        const lon = parseFloat(lonInput.value);
        const elev = parseFloat(elevInput.value);
        if (Number.isNaN(lat) || Number.isNaN(lon) || Number.isNaN(elev)) return;
        cameraCtl.setObserverLocation(lat, lon, elev);
        // Also refresh atmospheric pressure to match the new altitude
        // (barometric formula). Keeps Bennett refraction physically
        // consistent with the rendered viewpoint.
        const pInput = document.getElementById('atmo-pressure') as HTMLInputElement | null;
        if (pInput) {
          pInput.value = String(Math.round(1013 * Math.exp(-elev / 8400)));
          pInput.dispatchEvent(new Event('input', { bubbles: true }));
        }
      });
    }

    // Browser Geolocation: fill lat/lon from device GPS / IP. Falls through
    // the same code path as map-pick / preset selection so terrain reloads,
    // pin updates, and observer-mode camera follows.
    const gpsBtn = document.getElementById('observer-gps') as HTMLButtonElement;
    const gpsStatus = document.getElementById('observer-gps-status')!;
    gpsBtn.addEventListener('click', () => {
      if (!('geolocation' in navigator)) {
        gpsStatus.textContent = t('gps.unsupported');
        return;
      }
      gpsStatus.textContent = t('gps.fetching');
      gpsBtn.disabled = true;
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          gpsBtn.disabled = false;
          const newLat = pos.coords.latitude;
          const newLon = pos.coords.longitude;
          const acc = pos.coords.accuracy;
          latInput.value = newLat.toFixed(4);
          lonInput.value = newLon.toFixed(4);
          presetSel.value = '';
          hideSiteInfo();
          updatePin();
          gpsStatus.textContent = `±${acc < 1000 ? acc.toFixed(0) + ' m' : (acc/1000).toFixed(1) + ' km'}`;
          if (cameraCtl.getMode() === 'observer') {
            cameraCtl.setObserverLocation(newLat, newLon);
            solarSystem.getLocalTerrain()?.loadForLocation(newLat, newLon);
          }
        },
        (err) => {
          gpsBtn.disabled = false;
          const map: Record<number, string> = { 1: 'gps.denied', 2: 'gps.unavailable', 3: 'gps.timeout' };
          gpsStatus.textContent = t(map[err.code] ?? 'gps.unavailable');
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
      );
    });

    // "Find nearest dark sky" — distance + Bortle-weighted top match
    // from DARK_SKY_PLACES, jumps the observer there. If the current
    // lat/lon inputs are valid we use those; otherwise we ask the
    // browser for a quick geolocation read (the user may not have
    // pinned a location yet — common entry path is "I just opened
    // the simulator, where can I go observe?").
    const findDarkSkyBtn = document.getElementById('observer-find-dark-sky') as HTMLButtonElement | null;
    findDarkSkyBtn?.addEventListener('click', () => {
      const useLocation = (lat: number, lon: number): void => {
        const results = nearestDarkSkyPlaces(lat, lon, 1);
        if (results.length === 0) {
          toast.warn(t('darkSky.empty'));
          return;
        }
        const top = results[0];
        // Apply the same path as preset-select: update lat/lon inputs,
        // jump the preset dropdown to the matching entry, and (if in
        // observer mode) move the camera + reload local terrain.
        latInput.value = top.place.lat.toFixed(4);
        lonInput.value = top.place.lon.toFixed(4);
        if (elevInput) elevInput.value = String(top.place.elevationM ?? 0);
        presetSel.value = top.place.id;
        updatePin();
        if (cameraCtl.getMode() === 'observer') {
          cameraCtl.setObserverLocation(top.place.lat, top.place.lon, top.place.elevationM ?? 0);
          solarSystem.getLocalTerrain()?.loadForLocation(top.place.lat, top.place.lon);
        }
        // Auto-apply the Bortle slider if the place has one.
        if (top.place.bortle != null) {
          const bortleSlider = document.getElementById('bortle-slider') as HTMLInputElement | null;
          if (bortleSlider) {
            bortleSlider.value = String(top.place.bortle);
            bortleSlider.dispatchEvent(new Event('input', { bubbles: true }));
          }
        }
        const localName = localizedPresetName(top.place);
        const distStr = top.distanceKm < 100
          ? `${top.distanceKm.toFixed(0)} km`
          : `${top.distanceKm.toFixed(0)} km`;
        const bortleStr = top.place.bortle != null ? ` · Bortle ${top.place.bortle}` : '';
        toast.info(`${t('darkSky.found')}: ${localName} (${distStr}${bortleStr})`);
      };

      const fromInputs = (): boolean => {
        const lat = parseFloat(latInput.value);
        const lon = parseFloat(lonInput.value);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) return false;
        useLocation(lat, lon);
        return true;
      };

      if (fromInputs()) return;
      if (!('geolocation' in navigator)) {
        toast.warn(t('gps.unsupported'));
        return;
      }
      toast.info(t('gps.fetching'));
      navigator.geolocation.getCurrentPosition(
        (pos) => useLocation(pos.coords.latitude, pos.coords.longitude),
        () => toast.warn(t('gps.unavailable')),
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
      );
    });

    // OSM map picker integration. Lazy-loaded: MapPicker brings in Leaflet
    // (~30 KB gz), so we don't pay that cost until the user actually clicks
    // "select on map". Cached in `mapPicker` after first instantiation.
    let mapPicker: import('./MapPicker').MapPicker | null = null;
    document.getElementById('observer-map-pick')!.addEventListener('click', async () => {
      const lat = parseFloat(latInput.value);
      const lon = parseFloat(lonInput.value);
      if (!mapPicker) {
        const { MapPicker } = await import('./MapPicker');
        mapPicker = new MapPicker();
      }
      mapPicker.open(
        Number.isNaN(lat) ? 22.6273 : lat,
        Number.isNaN(lon) ? 120.3014 : lon,
        (newLat, newLon) => {
          latInput.value = newLat.toFixed(4);
          lonInput.value = newLon.toFixed(4);
          presetSel.value = '';
          hideSiteInfo();
          updatePin();
          if (cameraCtl.getMode() === 'observer') {
            cameraCtl.setObserverLocation(newLat, newLon);
            solarSystem.getLocalTerrain()?.loadForLocation(newLat, newLon);
          }
        }
      );
    });

    // Gyroscope (mobile AR mode) — only show buttons on touch-capable devices
    // that ship the DeviceOrientationEvent API.
    const gyroBtn = document.getElementById('observer-gyro') as HTMLButtonElement;
    const gyroCalBtn = document.getElementById('observer-gyro-calibrate') as HTMLButtonElement;
    if ('DeviceOrientationEvent' in window && ('ontouchstart' in window || navigator.maxTouchPoints > 0)) {
      gyroBtn.style.display = '';
      gyroBtn.addEventListener('click', async () => {
        const wasOn = cameraCtl.isGyroEnabled();
        const result = await cameraCtl.setGyroEnabled(!wasOn);
        if (result === 'granted') {
          gyroBtn.textContent = t(wasOn ? 'observer.gyroOn' : 'observer.gyroOff');
          gyroBtn.classList.toggle('active', !wasOn);
          gyroCalBtn.style.display = wasOn ? 'none' : '';
        } else if (result === 'denied') {
          toast.warn(t('toast.gyroDenied'));
        } else {
          toast.warn(t('toast.gyroUnsupported'));
        }
      });
      gyroCalBtn.addEventListener('click', () => {
        cameraCtl.calibrateGyroNorth();
      });
    }

    document.getElementById('site-info-close')!.addEventListener('click', () => {
      hideSiteInfo();
      infoPanel.updateCompactState();
    });

    const orbitsToggle = document.getElementById('toggle-orbits') as HTMLInputElement;
    const beltsToggle = document.getElementById('toggle-belts') as HTMLInputElement;
    let savedOrbits = true, savedBelts = true;

    enterBtn.addEventListener('click', () => {
      const lat = parseFloat(latInput.value);
      const lon = parseFloat(lonInput.value);
      if (Number.isNaN(lat) || Number.isNaN(lon)) return;
      // Force real scale so 1 AU is preserved — observer offsets are
      // only a few thousand km, geometry is degenerate in compressed scales.
      scaleCtl.setMode('real');
      document.querySelectorAll('.scale-toggle button').forEach(b => {
        b.classList.toggle('active', (b as HTMLElement).dataset.scale === 'real');
      });

      // Hide orbit lines / belts — visually noisy and unphysical from a surface viewpoint.
      savedOrbits = orbitsToggle.checked;
      savedBelts = beltsToggle.checked;
      if (orbitsToggle.checked) { orbitsToggle.checked = false; orbitsToggle.dispatchEvent(new Event('change')); }
      if (beltsToggle.checked) { beltsToggle.checked = false; beltsToggle.dispatchEvent(new Event('change')); }

      // Resolve elevation, in priority order:
      //   1. Manual elevation input — user can type their actual altitude
      //      (e.g. own home / observation site not in preset list).
      //   2. Matched preset's elevationM (Mauna Kea 4205, Paranal 2635, …).
      //   3. 0 (sea level) as final fallback.
      const matchedPreset = findPreset(presetSel.value);
      const manualElev = elevInput ? parseFloat(elevInput.value) : NaN;
      const elevationM = !Number.isNaN(manualElev)
        ? manualElev
        : (matchedPreset?.elevationM ?? 0);
      cameraCtl.setObserverLocation(lat, lon, elevationM);
      cameraCtl.resetObserverLook();
      cameraCtl.setMode('observer');
      // Auto-set atmospheric pressure from the barometric formula
      // (P = P0 · exp(−h / 8400 m)). 4205 m → ~615 mbar, 2635 m → ~735 mbar,
      // sea level → 1013 mbar. Refraction (Bennett) consumes this via the
      // P/T inputs; the user can still override the value manually.
      const pInput = document.getElementById('atmo-pressure') as HTMLInputElement | null;
      if (pInput) {
        const press = Math.round(1013 * Math.exp(-elevationM / 8400));
        pInput.value = String(press);
        pInput.dispatchEvent(new Event('change', { bubbles: true }));
      }
      // Switch the time display to the observer's nominal solar offset
      // (lon / 15° per hour). Off from civil time by up to ~30 min, which is
      // fine for visualisation; we don't ship a full IANA tz database.
      const offsetMin = Math.round((lon / 15) * 60);
      window.dispatchEvent(new CustomEvent('sim:tz-override', { detail: { offsetMin } }));
      // Kick off DEM + satellite imagery fetch (async; mesh swaps in when ready,
      // procedural fallback shows in the meantime).
      solarSystem.getLocalTerrain()?.loadForLocation(lat, lon);
      cameraModeSelect.value = 'free'; // observer is not in dropdown
      followBodySelect.value = '';
      enterBtn.style.display = 'none';
      exitBtn.style.display = '';
      skyPanel.show();
      document.getElementById('left-panel')!.classList.add('observing');
      document.body.classList.add('observing');
      // The observation tab is where exit / lock-horizon / gyro / optics
      // controls live — auto-jump there so the user doesn't have to hunt
      // for the "exit observation" button after switching mode.
      window.dispatchEvent(new CustomEvent('ui:left-tab', { detail: { tab: 'observe' } }));
      // Pin is no longer needed (we ARE at that location now); leaving it on
      // makes a visible cone protruding from the horizon in the sky view.
      solarSystem.hideLocationPin();
    });

    exitBtn.addEventListener('click', () => {
      // Restore display toggles
      if (savedOrbits !== orbitsToggle.checked) {
        orbitsToggle.checked = savedOrbits;
        orbitsToggle.dispatchEvent(new Event('change'));
      }
      if (savedBelts !== beltsToggle.checked) {
        beltsToggle.checked = savedBelts;
        beltsToggle.dispatchEvent(new Event('change'));
      }

      cameraCtl.setMode('free');
      cameraModeSelect.value = 'free';
      enterBtn.style.display = '';
      exitBtn.style.display = 'none';
      skyPanel.hide();
      // Restore the surface pin at the lat/lon we were observing from.
      const lat = parseFloat(latInput.value);
      const lon = parseFloat(lonInput.value);
      if (!Number.isNaN(lat) && !Number.isNaN(lon)) {
        solarSystem.setLocationPin(lat, lon);
      }
      document.getElementById('left-panel')!.classList.remove('observing');
      document.body.classList.remove('observing');
      // Restore browser-local timezone display.
      window.dispatchEvent(new CustomEvent('sim:tz-override', { detail: { offsetMin: null } }));

      // Reset optics to naked-eye and hide eyepiece vignette.
      const opticsSel = document.getElementById('optics-preset') as HTMLSelectElement;
      if (opticsSel.value !== 'naked') {
        opticsSel.value = 'naked';
        opticsSel.dispatchEvent(new Event('change'));
      } else {
        // Always make sure vignette is off after exit, even if it was already 'naked'.
        (document.getElementById('optics-vignette') as HTMLElement).style.display = 'none';
      }
    });
  }
}

function escapeForDescription(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function showSiteInfo(loc: ReturnType<typeof finder>): void {
  const panel = document.getElementById('site-info')!;
  panel.style.display = '';

  // Title in current language (or fall back to zh-Hant), with subtitle
  // showing the alternate spelling so cross-language observers can
  // still recognise it.
  const lang = (typeof window !== 'undefined' && window.localStorage.getItem('solarSysLang')) || 'zh-Hant';
  const title = lang === 'en' ? (loc.nameEn ?? loc.name)
              : lang === 'ja' ? (loc.nameJa ?? loc.nameEn ?? loc.name)
              : loc.name;
  // Subtitle: show the "other" language only if it differs from title.
  const altOptions = [loc.name, loc.nameEn ?? '', loc.nameJa ?? ''].filter(s => s && s !== title);
  document.getElementById('site-name')!.textContent = title;
  document.getElementById('site-subtitle')!.textContent = altOptions[0] ?? '';

  const lat = Math.abs(loc.lat).toFixed(4) + (loc.lat >= 0 ? '°N' : '°S');
  const lon = Math.abs(loc.lon).toFixed(4) + (loc.lon >= 0 ? '°E' : '°W');
  const elev = loc.elevationM != null ? ` · ${t('lp.elevation')} ${loc.elevationM.toLocaleString()} m` : '';
  document.getElementById('site-meta')!.textContent = `${lat}, ${lon}${elev}`;
  // Observatory descriptions are only authored in zh-Hant for now —
  // every entry has a paragraph of dense astro-history that we
  // haven't translated. Render with a small notice when the user
  // language differs, so non-Chinese readers know the prose is in CJK.
  const descEl = document.getElementById('site-description')!;
  const desc = loc.description ?? '';
  if (lang !== 'zh-Hant' && desc) {
    descEl.innerHTML = `<span style="color:var(--text-dim);font-style:italic;font-size:11px;">[Description in 繁體中文 only — translation TBD]</span><br>${escapeForDescription(desc)}`;
  } else {
    descEl.textContent = desc;
  }

  // Image: hide first, then attempt load. If the URL 404s (or any other
  // error from Wikimedia Commons / a custom CDN) we leave the slot
  // hidden so the card just falls back to text-only.
  const img = document.getElementById('site-image') as HTMLImageElement;
  img.style.display = 'none';
  img.removeAttribute('src');
  if (loc.imageUrl) {
    img.alt = loc.nameEn ?? loc.name;
    img.onload = () => { img.style.display = ''; };
    img.onerror = () => { img.style.display = 'none'; };
    img.src = loc.imageUrl;
  }

  // Website link: clickable text reading the link's hostname for trust
  // (so users can see where the click goes before tapping). Opens in new
  // tab via the target=_blank rel=noopener attributes already in HTML.
  const link = document.getElementById('site-link') as HTMLAnchorElement;
  if (loc.website) {
    link.href = loc.website;
    try {
      const host = new URL(loc.website).hostname.replace(/^www\./, '');
      link.textContent = `🔗 ${host}`;
    } catch {
      link.textContent = `🔗 ${loc.website}`;
    }
    link.style.display = 'inline-block';
  } else {
    link.style.display = 'none';
  }
}

function hideSiteInfo(): void {
  document.getElementById('site-info')!.style.display = 'none';
}

// Type helper so showSiteInfo's parameter type is sourced from the data file.
const finder = (id: string) => findPreset(id)!;

/**
 * Resolve a preset id across all three pools — cities, observatories,
 * and Dark Sky Places. Used everywhere the LeftPanel previously did a
 * plain `OBSERVER_PRESETS.find()`; that lookup missed the DSP entries
 * because they live in a separate `data/` module to keep the physics
 * layer free of curated lists.
 */
function findPreset(id: string) {
  return OBSERVER_PRESETS.find(p => p.id === id)
      ?? DARK_SKY_PLACES.find(p => p.id === id);
}
