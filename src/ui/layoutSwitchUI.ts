/**
 * Layout-mode switch UI — wires both the desktop LeftPanel button and
 * the mobile hamburger sheet to the same flow:
 *   1. Confirm with the user (the switch requires a page reload to
 *      cleanly re-init all the panels / observers).
 *   2. Persist the new mode via setStoredLayoutMode.
 *   3. Reload.
 *
 * Both entry points reuse one `triggerSwitch()` helper so the
 * behaviour stays identical and future settings additions only
 * touch this module.
 */

import {
  applyLayoutMode, getStoredLayoutMode, setStoredLayoutMode,
  type LayoutMode,
} from './layoutMode';
import { t, onLanguageChange } from '../i18n';

function currentMode(): LayoutMode {
  return getStoredLayoutMode()
    ?? (document.body.classList.contains('mobile-ui') ? 'mobile' : 'desktop');
}

function otherMode(m: LayoutMode): LayoutMode {
  return m === 'mobile' ? 'desktop' : 'mobile';
}

/**
 * Apply the new mode + reload. We reload because many panels
 * (LeftPanel, TimeControls, InfoPanel, MobileUI) read body class
 * once at construction; toggling mid-session leaves DOM in a
 * tangled state. A reload is unambiguous and fast (the bundle is
 * already cached).
 */
function triggerSwitch(): void {
  const cur = currentMode();
  const next = otherMode(cur);
  const confirmMsg = t('layout.confirmSwitch')
    .replace('{from}', t(`picker.${cur}.title`))
    .replace('{to}', t(`picker.${next}.title`));
  // Use a vanilla confirm — toast wouldn't give us a yes/no.
  if (!window.confirm(confirmMsg)) return;
  setStoredLayoutMode(next);
  applyLayoutMode(next);
  // Soft visual feedback before the reload — the modal-less confirm
  // dismiss + immediate reload feels sudden otherwise.
  document.body.style.opacity = '0.7';
  setTimeout(() => location.reload(), 100);
}

/** Render the current-mode status + button label inside a given
 *  scope (works for both the desktop LeftPanel section and the
 *  mobile settings sheet). */
function refreshUI(statusEl: HTMLElement | null, btnEl: HTMLButtonElement | null): void {
  const cur = currentMode();
  const next = otherMode(cur);
  if (statusEl) {
    statusEl.textContent = t('layout.currentLabel')
      .replace('{mode}', t(`picker.${cur}.title`));
  }
  if (btnEl) {
    btnEl.textContent = t('layout.switchTo')
      .replace('{mode}', t(`picker.${next}.title`));
  }
}

/**
 * Attach handlers to the desktop LeftPanel's layout-mode section
 * (advanced tab). Idempotent — re-callable on language change to
 * refresh the rendered labels.
 */
export function attachDesktopLayoutSwitch(): void {
  const statusEl = document.getElementById('layout-mode-current');
  const btnEl = document.getElementById('layout-mode-switch') as HTMLButtonElement | null;
  if (!btnEl) return;
  refreshUI(statusEl, btnEl);
  btnEl.addEventListener('click', triggerSwitch);
  onLanguageChange(() => refreshUI(statusEl, btnEl));
}

/**
 * Build + return a DOM fragment usable inside the mobile settings
 * sheet. Same content as the desktop section, but produced
 * imperatively so MobileUI can `appendChild` it without depending
 * on the LeftPanel's exact markup.
 */
export function buildMobileLayoutSwitchPanel(): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'section';
  const label = document.createElement('div');
  label.className = 'label';
  label.textContent = t('left.layoutMode');
  wrap.appendChild(label);
  const status = document.createElement('div');
  status.style.cssText = 'font-size:11px;color:var(--text-dim);margin-bottom:6px;line-height:1.4;';
  wrap.appendChild(status);
  const btn = document.createElement('button');
  btn.style.cssText = 'width:100%;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);color:var(--text);padding:8px;border-radius:6px;cursor:pointer;font-size:14px;min-height:44px;';
  wrap.appendChild(btn);
  refreshUI(status, btn);
  btn.addEventListener('click', triggerSwitch);
  onLanguageChange(() => {
    label.textContent = t('left.layoutMode');
    refreshUI(status, btn);
  });
  return wrap;
}
