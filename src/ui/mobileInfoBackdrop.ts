/**
 * Mobile InfoPanel backdrop wiring.
 *
 * The InfoPanel itself is the existing #info-panel element (Phase E
 * just re-styles it as a bottom sheet via CSS). This module:
 *   - Mirrors the panel's open/closed state onto the backdrop's
 *     `.visible` class via a MutationObserver on the panel.
 *   - Wires backdrop tap → click the existing #info-close button,
 *     reusing whatever dismiss logic InfoPanel has installed.
 *
 * Only attaches when body.mobile-ui is set; on desktop the backdrop
 * stays hidden via CSS and this listener is never installed.
 */

export function attachMobileInfoBackdrop(): void {
  if (!document.body.classList.contains('mobile-ui')) return;
  const panel = document.getElementById('info-panel');
  const backdrop = document.getElementById('mobile-info-backdrop');
  if (!panel || !backdrop) return;

  // Sync backdrop visibility to panel's `.visible` class.
  const sync = () => {
    backdrop.classList.toggle('visible', panel.classList.contains('visible'));
  };
  const observer = new MutationObserver(sync);
  observer.observe(panel, { attributes: true, attributeFilter: ['class'] });
  sync();

  // Tap-to-dismiss: route through the existing close button so the
  // panel's own teardown (subscriptions, observation-log autosave,
  // currentId reset) runs.
  backdrop.addEventListener('click', () => {
    document.getElementById('info-close')?.click();
  });
}
