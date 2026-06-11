/**
 * localStorage-backed UI persistence, extracted from main.ts.
 *
 * Two concerns live here because they share the same mechanism
 * (restore on boot → replay events → save on change):
 *  - left-panel / global control values (setupUiPersistence)
 *  - side-panel collapse state (setupPanelToggles)
 *
 * Both touch only the DOM and localStorage — no scene or clock access —
 * which is what makes them safe to run at any point after the panels'
 * own event listeners are attached.
 */

// Persist user preferences for left-panel selections (checkboxes, selects,
// sliders, scale/frame button groups). Called after LeftPanel construction
// so initial event listeners exist before we replay stored values via
// dispatchEvent — that way every consumer sees the restored state as if
// the user had just clicked / typed it.
export function setupUiPersistence(): void {
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

type PanelToggle = {
  btnId: string; bodyClass: string; collapsedArrow: string; expandedArrow: string;
};
const PANEL_TOGGLES: PanelToggle[] = [
  { btnId: 'left-panel-toggle', bodyClass: 'left-panel-collapsed',  collapsedArrow: '▶', expandedArrow: '◀' },
  { btnId: 'info-panel-toggle', bodyClass: 'info-panel-collapsed',  collapsedArrow: '◀', expandedArrow: '▶' },
  { btnId: 'sky-panel-toggle',  bodyClass: 'sky-panel-collapsed',   collapsedArrow: '▶', expandedArrow: '◀' },
];

// Side-panel collapse toggles (chevron buttons that slide each panel
// off-screen). State persists in localStorage so the user's layout
// preference survives reloads.
export function setupPanelToggles(): void {
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
