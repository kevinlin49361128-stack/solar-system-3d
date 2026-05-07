/**
 * Night-vision (red-light) mode toggle. Wraps the body in a CSS-filter
 * "red flashlight" effect to preserve the user's dark adaptation while
 * looking at a phone or laptop in the field.
 *
 * Toggled by:
 *   - clicking the 🌙 button next to the hamburger menu
 *   - pressing the `R` key (when not typing in an input)
 *
 * Persistence: localStorage `solarSysNightVision` = '1' | '0'. Restored
 * on page load so that re-opening the URL at the observation site
 * doesn't blast the user with white light again.
 *
 * The full-screen filter `brightness × sepia × hue-rotate` lands the
 * gamut in dim-red without losing UI structure (panel borders, button
 * states still distinguishable via brightness contrast). See the
 * `body.night-vision` rule in index.html for the exact recipe.
 */

const STORAGE_KEY = 'solarSysNightVision';

export function setupNightVision(): void {
  const btn = document.getElementById('night-vision-toggle');
  if (!btn) return;

  // Restore from previous session
  let active = false;
  try {
    active = localStorage.getItem(STORAGE_KEY) === '1';
  } catch { /* private mode — fall back to off */ }
  apply(active);

  const toggle = (): void => {
    active = !active;
    apply(active);
    try { localStorage.setItem(STORAGE_KEY, active ? '1' : '0'); }
    catch { /* private mode */ }
  };

  btn.addEventListener('click', toggle);

  // Keyboard shortcut: R. Suppress when focus is in a text input or
  // contenteditable so observers typing notes (future feature) don't
  // accidentally toggle.
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'r' && e.key !== 'R') return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    e.preventDefault();
    toggle();
  });
}

function apply(active: boolean): void {
  document.body.classList.toggle('night-vision', active);
  const btn = document.getElementById('night-vision-toggle');
  if (btn) {
    btn.textContent = active ? '☀️' : '🌙';
    btn.setAttribute('aria-pressed', active ? 'true' : 'false');
  }
}
