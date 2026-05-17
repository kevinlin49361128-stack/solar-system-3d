import type { CameraController } from '../controls/CameraController';
import { t } from '../i18n';
import { formatDMS } from './formatAngles';
import { toast } from './toast';

/**
 * Mobile observer HUD:
 *   - Top strip (just under the mobile-topbar) showing the centred
 *     direction's alt / az / cardinal, refreshed 4× per second.
 *   - Centre crosshair: a faint plus + degree-circle overlay so the
 *     user knows what they're "pointing at" through the canvas.
 *   - First-entry gyro nudge: a one-time toast the first time the
 *     user enters observer mode on mobile, suggesting they enable
 *     gyroscope mode from the Camera sheet.
 *
 * All elements are hidden on desktop via the body.mobile-ui scope
 * (added by CSS in index.html). Toggle visibility by listening for
 * sim:mode-change events that CameraController already dispatches.
 *
 * Why a separate module instead of putting this in MobileUI:
 *   MobileUI's job is the always-visible chrome (topbar/bottombar/
 *   statechip). The observer HUD is mode-specific and may grow more
 *   complex (compass tick marks, magnetic-vs-true-north toggle,
 *   etc.). Splitting keeps each module focused.
 */

const GYRO_NUDGED_KEY = 'sim:mobileGyroNudged';

export class MobileObserverHUD {
  private readonly hudStrip: HTMLElement;
  private readonly crosshair: HTMLElement;
  private rafId: number | null = null;
  private lastUpdate = 0;

  constructor(private cameraCtl: CameraController) {
    // Build the DOM once — show/hide via class toggles.
    this.hudStrip = this.makeHudStrip();
    this.crosshair = this.makeCrosshair();
    document.body.appendChild(this.hudStrip);
    document.body.appendChild(this.crosshair);

    // Show/hide on camera-mode change. CameraController already
    // dispatches 'sim:mode-change' when setMode is called.
    window.addEventListener('sim:mode-change', (e) => {
      const mode = (e as CustomEvent<{ mode: string }>).detail?.mode;
      const isObserver = mode === 'observer';
      this.hudStrip.classList.toggle('visible', isObserver);
      this.crosshair.classList.toggle('visible', isObserver);
      if (isObserver) {
        this.maybeNudgeGyro();
        this.startTick();
      } else {
        this.stopTick();
      }
    });
  }

  private makeHudStrip(): HTMLElement {
    const el = document.createElement('div');
    el.id = 'mobile-observer-hud';
    el.className = 'mobile-observer-hud';
    el.innerHTML = `
      <span class="moh-cardinal" id="moh-cardinal">—</span>
      <span class="moh-sep">·</span>
      <span class="moh-az" id="moh-az">Az —</span>
      <span class="moh-sep">·</span>
      <span class="moh-alt" id="moh-alt">Alt —</span>
    `;
    return el;
  }

  private makeCrosshair(): HTMLElement {
    const el = document.createElement('div');
    el.id = 'mobile-observer-crosshair';
    el.className = 'mobile-observer-crosshair';
    // A simple SVG plus sign + small circle. Kept inline so no
    // network round-trip on first observer entry.
    el.innerHTML = `
      <svg width="48" height="48" viewBox="0 0 48 48">
        <circle cx="24" cy="24" r="14" fill="none"
                stroke="rgba(93,177,255,0.45)" stroke-width="1"/>
        <line x1="24" y1="6"  x2="24" y2="18" stroke="rgba(93,177,255,0.7)" stroke-width="1.5"/>
        <line x1="24" y1="30" x2="24" y2="42" stroke="rgba(93,177,255,0.7)" stroke-width="1.5"/>
        <line x1="6"  y1="24" x2="18" y2="24" stroke="rgba(93,177,255,0.7)" stroke-width="1.5"/>
        <line x1="30" y1="24" x2="42" y2="24" stroke="rgba(93,177,255,0.7)" stroke-width="1.5"/>
      </svg>
    `;
    return el;
  }

  /** Frame loop — only runs while in observer mode. 4 Hz is plenty
   *  for the alt/az readout; pinning to rAF keeps it in sync with
   *  the canvas. */
  private startTick(): void {
    if (this.rafId != null) return;
    const tick = () => {
      const now = performance.now();
      if (now - this.lastUpdate > 250) {
        this.lastUpdate = now;
        this.updateReadout();
      }
      this.rafId = requestAnimationFrame(tick);
    };
    tick();
  }

  private stopTick(): void {
    if (this.rafId != null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  private updateReadout(): void {
    // CameraController exposes the observer's current look direction
    // via getObserverLookDeg(); fall back to "—" if observer mode
    // isn't active or the API drifts.
    const dirAny = (this.cameraCtl as unknown as {
      getObserverLookDeg?: () => { azDeg: number; altDeg: number };
    });
    const dir = dirAny.getObserverLookDeg?.();
    if (!dir) return;
    const cardEl = document.getElementById('moh-cardinal');
    const azEl   = document.getElementById('moh-az');
    const altEl  = document.getElementById('moh-alt');
    if (cardEl) cardEl.textContent = cardinal16(dir.azDeg);
    if (azEl)   azEl.textContent   = 'Az ' + formatDMS(dir.azDeg);
    if (altEl)  altEl.textContent  = 'Alt ' + (dir.altDeg >= 0 ? '+' : '') + formatDMS(dir.altDeg);
  }

  /** One-time toast on first observer entry on mobile. We don't
   *  auto-enable gyroscope because iOS needs an explicit user
   *  gesture for permission, and silently dropping into AR can
   *  disorient users. */
  private maybeNudgeGyro(): void {
    try {
      if (localStorage.getItem(GYRO_NUDGED_KEY) === 'true') return;
      localStorage.setItem(GYRO_NUDGED_KEY, 'true');
    } catch { /* private mode — show it anyway, just don't persist */ }
    // toast.info uses a fixed 3 s duration; that's enough for a
    // gentle suggestion (not a blocking dialog).
    toast.info(t('mb.gyroNudge'));
  }
}

/** 16-point compass from azimuth in degrees (0 = N, 90 = E). */
function cardinal16(azDeg: number): string {
  const labels = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
                  'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const az = ((azDeg % 360) + 360) % 360;
  return labels[Math.round(az / 22.5) % 16];
}
