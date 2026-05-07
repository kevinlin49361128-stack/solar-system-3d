import { t } from '../i18n';

/**
 * First-time-visitor onboarding tour. Shows a spotlight overlay with a
 * tooltip card that walks new users through 4–5 key features (time
 * controls, view modes, click-to-inspect, auto-event scanning).
 *
 * Behaviour
 * ---------
 * - Auto-runs on first load. Persistence: localStorage key
 *   `solarSysOnboarding.v1` set to `'completed'` (finished naturally) or
 *   `'skipped'` (user dismissed). Either value suppresses future
 *   auto-runs. Bumping the version suffix re-shows the tour to all users
 *   after major UI changes.
 * - Each step has an anchor selector (CSS) plus a tooltip card. When the
 *   anchor is offscreen or display:none, the card centres itself and
 *   skips the spotlight cutout.
 * - Side effects per step: some steps dispatch `ui:left-tab` events to
 *   switch the user to the right panel/tab so the anchor is actually
 *   visible (e.g. step 5 jumps to the "observe" tab).
 * - Re-trigger via the `OnboardingTour.replay()` method, hooked to a
 *   button in LeftPanel.
 *
 * The class manages all DOM creation itself — no need to add markup to
 * index.html. This keeps the feature self-contained: deleting this file
 * removes the entire tour with no leftovers.
 */

export interface TourStep {
  /** i18n key for title (translated via t()). */
  titleKey: string;
  /** i18n key for body. */
  bodyKey: string;
  /** CSS selector for the element to highlight. Empty/null = centred modal. */
  anchor: string | null;
  /** Optional pre-step side-effect (e.g. open a tab so anchor is visible). */
  beforeShow?: () => void;
  /** Padding around spotlight rect, in CSS px. Default 8. */
  pad?: number;
}

const STEPS: TourStep[] = [
  {
    titleKey: 'tour.welcome.title',
    bodyKey: 'tour.welcome.body',
    anchor: null,
  },
  {
    titleKey: 'tour.time.title',
    bodyKey: 'tour.time.body',
    anchor: '#time-controls',
    pad: 6,
  },
  {
    titleKey: 'tour.viewmode.title',
    bodyKey: 'tour.viewmode.body',
    anchor: '#camera-mode',
    pad: 8,
    // Make sure the Scene tab (where #camera-mode lives) is active.
    beforeShow: () => {
      window.dispatchEvent(new CustomEvent('ui:left-tab', { detail: { tab: 'scene' } }));
      ensureLeftPanelVisible();
    },
  },
  {
    titleKey: 'tour.click.title',
    bodyKey: 'tour.click.body',
    // Anchor at the canvas center: spotlight a circular zone in the
    // middle of the viewport rather than the whole canvas.
    anchor: '#center-spot',
  },
  {
    titleKey: 'tour.events.title',
    bodyKey: 'tour.events.body',
    anchor: '#auto-events-toggle',
    pad: 6,
    // Pre-step: open Advanced tab (where the auto-events button lives) and
    // make sure the panel itself is uncollapsed on narrow viewports.
    beforeShow: () => {
      window.dispatchEvent(new CustomEvent('ui:left-tab', { detail: { tab: 'advanced' } }));
      ensureLeftPanelVisible();
      // Scroll the auto-events button into view inside the panel.
      requestAnimationFrame(() => {
        const btn = document.getElementById('auto-events-toggle');
        btn?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      });
    },
  },
];

/** On narrow viewports, the left panel may be collapsed by class — open it. */
function ensureLeftPanelVisible(): void {
  if (document.body.classList.contains('left-panel-collapsed')) {
    const btn = document.getElementById('left-panel-toggle') as HTMLButtonElement | null;
    btn?.click();
  }
}

const STORAGE_KEY = 'solarSysOnboarding.v1';

export class OnboardingTour {
  private overlay: HTMLElement | null = null;
  private spotlight: HTMLElement | null = null;
  private card: HTMLElement | null = null;
  private centerSpot: HTMLElement | null = null;
  private stepIdx = 0;
  private resizeHandler: (() => void) | null = null;
  private active = false;

  /** True if the user has previously completed or skipped the tour. */
  static hasSeenTour(): boolean {
    try { return !!localStorage.getItem(STORAGE_KEY); }
    catch { return false; }
  }

  /** Auto-show the tour on first visit, ~600ms after load to let layout settle. */
  maybeAutoStart(): void {
    if (OnboardingTour.hasSeenTour()) return;
    setTimeout(() => this.start(), 600);
  }

  /** Force-show the tour (called by re-trigger button). Clears the seen flag. */
  replay(): void {
    try { localStorage.removeItem(STORAGE_KEY); }
    catch { /* private mode */ }
    this.start();
  }

  start(): void {
    if (this.active) return;
    this.active = true;
    this.stepIdx = 0;
    this.buildDom();
    this.showStep();
    this.resizeHandler = () => this.layoutCurrentStep();
    window.addEventListener('resize', this.resizeHandler);
  }

  private buildDom(): void {
    // A central "center-spot" anchor — invisible 1×1 element at viewport
    // centre, used by the click-to-inspect step to draw a spotlight circle
    // pointing at where bodies are most likely visible.
    if (!document.getElementById('center-spot')) {
      const cs = document.createElement('div');
      cs.id = 'center-spot';
      cs.style.cssText = `
        position: fixed; left: 50%; top: 50%;
        width: 1px; height: 1px; pointer-events: none;
      `;
      document.body.appendChild(cs);
      this.centerSpot = cs;
    }

    const overlay = document.createElement('div');
    overlay.id = 'onboarding-overlay';
    overlay.innerHTML = `
      <div class="ob-spotlight" id="ob-spotlight"></div>
      <div class="ob-card" id="ob-card">
        <div class="ob-step-num" id="ob-step-num"></div>
        <div class="ob-title" id="ob-title"></div>
        <div class="ob-body" id="ob-body"></div>
        <div class="ob-actions">
          <button class="ob-btn ob-skip" id="ob-skip">${t('tour.skip')}</button>
          <div class="ob-spacer"></div>
          <button class="ob-btn ob-prev" id="ob-prev">${t('tour.prev')}</button>
          <button class="ob-btn ob-next ob-primary" id="ob-next">${t('tour.next')}</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    this.overlay = overlay;
    this.spotlight = overlay.querySelector('#ob-spotlight');
    this.card = overlay.querySelector('#ob-card');

    overlay.querySelector('#ob-skip')?.addEventListener('click', () => this.dismiss('skipped'));
    overlay.querySelector('#ob-prev')?.addEventListener('click', () => this.prev());
    overlay.querySelector('#ob-next')?.addEventListener('click', () => this.next());
    // Click on the dim backdrop (outside card) does nothing — prevents
    // accidental dismissal while the user reads. Esc dismisses.
    document.addEventListener('keydown', this.onKey);
  }

  private onKey = (e: KeyboardEvent): void => {
    if (!this.active) return;
    if (e.key === 'Escape') this.dismiss('skipped');
    else if (e.key === 'ArrowRight' || e.key === 'Enter') this.next();
    else if (e.key === 'ArrowLeft') this.prev();
  };

  private showStep(): void {
    const step = STEPS[this.stepIdx];
    step.beforeShow?.();
    // Update text content
    const title = this.overlay?.querySelector('#ob-title');
    const body = this.overlay?.querySelector('#ob-body');
    const num = this.overlay?.querySelector('#ob-step-num');
    if (title) title.textContent = t(step.titleKey);
    if (body) body.textContent = t(step.bodyKey);
    if (num) num.textContent = `${this.stepIdx + 1} / ${STEPS.length}`;

    // Update buttons
    const prev = this.overlay?.querySelector('#ob-prev') as HTMLButtonElement | null;
    const next = this.overlay?.querySelector('#ob-next') as HTMLButtonElement | null;
    if (prev) prev.disabled = this.stepIdx === 0;
    if (next) next.textContent = this.stepIdx === STEPS.length - 1
      ? t('tour.done')
      : t('tour.next');

    // Defer layout until next frame so beforeShow side-effects (tab
    // switches, panel opens) have time to flush.
    requestAnimationFrame(() => this.layoutCurrentStep());
  }

  /** Position spotlight + card based on current step's anchor. */
  private layoutCurrentStep(): void {
    const step = STEPS[this.stepIdx];
    const spot = this.spotlight as HTMLElement;
    const card = this.card as HTMLElement;
    if (!spot || !card) return;

    if (!step.anchor) {
      // No anchor → centred card, hide spotlight.
      spot.style.display = 'none';
      card.style.left = `50%`;
      card.style.top = `50%`;
      card.style.transform = 'translate(-50%, -50%)';
      return;
    }

    const target = document.querySelector(step.anchor) as HTMLElement | null;
    if (!target || !this.isVisible(target)) {
      // Fallback: centre the card without spotlight.
      spot.style.display = 'none';
      card.style.left = `50%`;
      card.style.top = `50%`;
      card.style.transform = 'translate(-50%, -50%)';
      return;
    }

    const r = target.getBoundingClientRect();
    const pad = step.pad ?? 8;
    spot.style.display = '';
    spot.style.left = `${r.left - pad}px`;
    spot.style.top = `${r.top - pad}px`;
    spot.style.width = `${r.width + pad * 2}px`;
    spot.style.height = `${r.height + pad * 2}px`;

    // Position card: try below, then above, then to the side, then centre.
    // Card needs to fit in viewport without overlapping the spotlight.
    const cardRect = card.getBoundingClientRect();
    const cardW = cardRect.width || 320;
    const cardH = cardRect.height || 180;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const gap = 14;

    let left: number, top: number;
    const spaceBelow = vh - r.bottom - gap - 16;
    const spaceAbove = r.top - gap - 16;

    if (spaceBelow >= cardH) {
      // Place below the anchor
      top = r.bottom + gap;
      left = clamp(r.left + r.width / 2 - cardW / 2, 16, vw - cardW - 16);
    } else if (spaceAbove >= cardH) {
      // Place above
      top = r.top - cardH - gap;
      left = clamp(r.left + r.width / 2 - cardW / 2, 16, vw - cardW - 16);
    } else {
      // Centre fallback
      top = clamp(vh / 2 - cardH / 2, 16, vh - cardH - 16);
      left = clamp(vw / 2 - cardW / 2, 16, vw - cardW - 16);
    }

    card.style.left = `${left}px`;
    card.style.top = `${top}px`;
    card.style.transform = '';
  }

  /** Element exists, has non-zero size, and isn't display:none. */
  private isVisible(el: HTMLElement): boolean {
    if (!el.offsetParent && getComputedStyle(el).position !== 'fixed') return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }

  next(): void {
    if (this.stepIdx >= STEPS.length - 1) {
      this.dismiss('completed');
      return;
    }
    this.stepIdx++;
    this.showStep();
  }

  prev(): void {
    if (this.stepIdx === 0) return;
    this.stepIdx--;
    this.showStep();
  }

  private dismiss(reason: 'skipped' | 'completed'): void {
    try { localStorage.setItem(STORAGE_KEY, reason); }
    catch { /* private mode */ }
    this.teardown();
  }

  private teardown(): void {
    this.active = false;
    document.removeEventListener('keydown', this.onKey);
    if (this.resizeHandler) {
      window.removeEventListener('resize', this.resizeHandler);
      this.resizeHandler = null;
    }
    this.overlay?.remove();
    this.centerSpot?.remove();
    this.overlay = null;
    this.spotlight = null;
    this.card = null;
    this.centerSpot = null;
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}
