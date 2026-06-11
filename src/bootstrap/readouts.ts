/**
 * Observer-mode HUD readouts, extracted from main.ts: the FPS-style
 * compass tape + DMS readout, local mean-time clock, tracking-rate pill,
 * FOV/magnification pill, and the Stellarium-style selection marker.
 *
 * createReadouts() grabs its DOM elements once, builds the compass tape,
 * and returns the two per-frame entry points tick() needs:
 * updateObserverReticle() and updateSelectionMarker(). The other update
 * functions are internal — they only run as part of the reticle update.
 */
import { Vector3 } from 'three';
import type { WebGLRenderer } from 'three';
import type { SolarSystem } from '../scene/SolarSystem';
import type { CameraController } from '../controls/CameraController';
import type { SimulationClock } from '../time/SimulationClock';
import { NAMED_STARS } from '../data/stars';
import { raDecToEcliptic } from '../physics/topocentric';
import { eclipticToScene } from '../physics/frame';
import { t, getLang, bodyName } from '../i18n';
import { formatDMS } from '../ui/formatAngles';
import {
  cardinalLabel, paCardinal, formatRate, formatFov, formatFocal,
  formatLocalMeanTime,
} from '../ui/readoutFormat';

export interface ReadoutDeps {
  solarSystem: SolarSystem;
  cameraCtl: CameraController;
  clock: SimulationClock;
  renderer: WebGLRenderer;
}

export interface Readouts {
  /** Compass tape + az/alt DMS + (internally) clock, FOV and track pills. */
  updateObserverReticle(): void;
  /** Corner-bracket marker following the InfoPanel's current selection. */
  updateSelectionMarker(): void;
}

export function createReadouts({ solarSystem, cameraCtl, clock, renderer }: ReadoutDeps): Readouts {
  // ---- Observer-mode reticle ----------------------------------------------
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
  // avoids a tighter coupling between InfoPanel and this module. Each frame
  // we project the target's world direction to NDC → CSS pixels and update
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

  return { updateObserverReticle, updateSelectionMarker };
}
