/**
 * Layout-mode selector — the user's "desktop vs mobile UI" choice.
 *
 * We make it an explicit choice rather than a responsive CSS swap
 * because the two layouts have qualitatively different interaction
 * models (left panel vs bottom toolbar; right-edge InfoPanel vs
 * bottom-sheet InfoPanel; keyboard shortcuts vs gesture-only). A
 * single responsive layout trying to be both ends up cramming the
 * desktop UI onto a phone — exactly the problem this overhaul is
 * fixing.
 *
 * Default is auto-detected on first visit; once the user picks, the
 * choice persists in localStorage and is reachable later via the
 * settings menu.
 */

export type LayoutMode = 'desktop' | 'mobile';

const STORAGE_KEY = 'sim:layoutMode';

/**
 * Read the user's saved choice, or null if they haven't picked yet.
 * Defensive against localStorage being disabled (Safari private mode
 * — returns null, treated as "first visit").
 */
export function getStoredLayoutMode(): LayoutMode | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'desktop' || v === 'mobile') return v;
    return null;
  } catch {
    return null;
  }
}

/**
 * Persist the user's choice. Best-effort; localStorage failures
 * (private mode, quota) are silent — the choice still applies for the
 * current session via `applyLayoutMode`, just won't survive a reload.
 */
export function setStoredLayoutMode(mode: LayoutMode): void {
  try { localStorage.setItem(STORAGE_KEY, mode); } catch { /* ignore */ }
}

/** Clear stored preference. Used by the "show picker again" debug path. */
export function clearStoredLayoutMode(): void {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
}

/**
 * Auto-detect what the new visitor probably wants. Touch + narrow
 * viewport → mobile. Anything else → desktop. iPads and other
 * mid-width tablets default to desktop; users on a tablet who prefer
 * a phone-style UI can flip via settings.
 */
export function autoDetectLayoutMode(): LayoutMode {
  const hasTouch = 'ontouchstart' in window
    || (navigator.maxTouchPoints != null && navigator.maxTouchPoints > 0);
  const narrow = window.innerWidth < 768;
  return (hasTouch && narrow) ? 'mobile' : 'desktop';
}

/**
 * Apply the chosen layout to the DOM via a body class. CSS in
 * index.html (and future mobile-only stylesheets) keys off
 * `body.mobile-ui` to toggle which overlays show. Returns the
 * effective mode after application.
 */
export function applyLayoutMode(mode: LayoutMode): LayoutMode {
  document.body.classList.toggle('mobile-ui', mode === 'mobile');
  document.body.classList.toggle('desktop-ui', mode === 'desktop');
  return mode;
}

/**
 * Show the launch-time picker modal. Returns a Promise that resolves
 * with the user's choice (and whether they ticked "remember me"). The
 * modal element is in index.html; we just wire its buttons + reveal
 * it. Caller is responsible for hiding it after applying the choice.
 */
export function showLayoutPicker(): Promise<{ mode: LayoutMode; remember: boolean }> {
  return new Promise((resolve) => {
    const modal = document.getElementById('layout-picker');
    if (!modal) {
      // Hard fail-safe — if the markup somehow isn't there, just
      // auto-detect and proceed so the app still boots.
      resolve({ mode: autoDetectLayoutMode(), remember: true });
      return;
    }
    modal.style.display = 'flex';
    const remember = document.getElementById('layout-pick-remember') as HTMLInputElement | null;

    const pick = (mode: LayoutMode) => {
      modal.style.display = 'none';
      resolve({ mode, remember: remember?.checked ?? true });
    };

    document.getElementById('layout-pick-desktop')?.addEventListener(
      'click', () => pick('desktop'), { once: true });
    document.getElementById('layout-pick-mobile')?.addEventListener(
      'click', () => pick('mobile'), { once: true });
  });
}
