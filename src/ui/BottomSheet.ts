/**
 * Generic drag-from-bottom sheet component used by every mobile
 * overlay in the v0.4 redesign (Scale / Time / Camera / View / Find
 * sheets, plus InfoPanel-on-mobile and the Observer-mode controls).
 *
 * Three snap points:
 *   - 'small'   ≈ 35 vh — quick-glance height; default open state
 *   - 'medium'  ≈ 55 vh — most expanded interactions live here
 *   - 'large'   ≈ 92 vh — full-screen; for long content (Search,
 *                          InfoPanel with all the physics rows open)
 *   - 'closed'  = 0       — dismissed
 *
 * Drag the handle (or anywhere in the header strip) to resize between
 * snap points. Swipe-down past `small` dismisses to closed. Backdrop
 * is a faint blur overlay that's tap-to-dismiss.
 *
 * Design choices:
 *   - Pure DOM + CSS — no React / Solid / framework deps. Keeps the
 *     bundle small and matches the rest of the codebase.
 *   - One BottomSheet instance per concurrent sheet (the 5 toolbar
 *     sheets share a singleton "manager" higher up to enforce
 *     "only one open at a time"; InfoPanel-on-mobile gets its own).
 *   - Pointer events (works for mouse, touch, and pen) over
 *     touch-specific so desktop debugging in mobile viewport is
 *     identical to phone behaviour.
 *   - Snap transitions are CSS transform + opacity, GPU-accelerated.
 *     Drag-in-progress disables the transition for 1:1 finger
 *     tracking; release re-enables for the snap animation.
 */

export type SnapPoint = 'closed' | 'small' | 'medium' | 'large';

const SNAP_VH: Record<Exclude<SnapPoint, 'closed'>, number> = {
  small: 35,
  medium: 55,
  large: 92,
};

const DISMISS_THRESHOLD_VH = 15;   // drag below 'small' by this much → closed
const VELOCITY_DISMISS = 0.6;      // px/ms swipe-down velocity → closed

export interface BottomSheetOptions {
  /** Stable id used for CSS hooks + analytics. */
  id: string;
  /** Initial title shown in the header. Can be updated via setTitle. */
  title: string;
  /** Initial snap point when first opened. Defaults to 'small'. */
  initialSnap?: SnapPoint;
  /** Optional callback when the sheet is fully dismissed. */
  onDismiss?: () => void;
}

export class BottomSheet {
  readonly root: HTMLElement;
  private readonly headerEl: HTMLElement;
  private readonly titleEl: HTMLElement;
  private readonly bodyEl: HTMLElement;
  private readonly backdropEl: HTMLElement;
  private snap: SnapPoint = 'closed';
  private dragState: { startY: number; startSnapVh: number; lastY: number; lastT: number } | null = null;
  private readonly onDismiss?: () => void;

  constructor(opts: BottomSheetOptions) {
    this.onDismiss = opts.onDismiss;

    // Backdrop — tap to dismiss. z-index just below the sheet itself.
    this.backdropEl = document.createElement('div');
    this.backdropEl.className = 'bs-backdrop';
    this.backdropEl.dataset.sheetId = opts.id;
    this.backdropEl.addEventListener('click', () => this.dismiss());
    document.body.appendChild(this.backdropEl);

    // Sheet root — fixed bottom; transform: translateY for snap positioning.
    this.root = document.createElement('div');
    this.root.className = 'bs-root';
    this.root.dataset.sheetId = opts.id;

    this.headerEl = document.createElement('div');
    this.headerEl.className = 'bs-header';

    const handle = document.createElement('div');
    handle.className = 'bs-handle';
    this.headerEl.appendChild(handle);

    this.titleEl = document.createElement('div');
    this.titleEl.className = 'bs-title';
    this.titleEl.textContent = opts.title;
    this.headerEl.appendChild(this.titleEl);

    const closeBtn = document.createElement('button');
    closeBtn.className = 'bs-close';
    closeBtn.setAttribute('aria-label', 'Close');
    closeBtn.textContent = '✕';
    closeBtn.addEventListener('click', () => this.dismiss());
    this.headerEl.appendChild(closeBtn);

    this.bodyEl = document.createElement('div');
    this.bodyEl.className = 'bs-body';

    this.root.appendChild(this.headerEl);
    this.root.appendChild(this.bodyEl);
    document.body.appendChild(this.root);

    this.wireDrag();
    this.applySnap(opts.initialSnap ?? 'closed', false);  // no animation on init
  }

  /** Where to render the sheet's body content. */
  get content(): HTMLElement { return this.bodyEl; }

  setTitle(s: string): void {
    this.titleEl.textContent = s;
  }

  open(snap: SnapPoint = 'small'): void {
    if (snap === 'closed') { this.dismiss(); return; }
    this.applySnap(snap, true);
  }

  dismiss(): void {
    this.applySnap('closed', true);
    if (this.onDismiss) this.onDismiss();
  }

  isOpen(): boolean { return this.snap !== 'closed'; }

  /**
   * Apply a snap point: update the transform + backdrop + dataset.
   * `animate=true` keeps the CSS transition; `animate=false` jumps
   * (used on init so we don't flash an opening animation when the
   * page first loads with snap='closed').
   */
  private applySnap(snap: SnapPoint, animate: boolean): void {
    this.snap = snap;
    this.root.dataset.snap = snap;
    this.backdropEl.dataset.snap = snap;
    if (!animate) {
      this.root.style.transition = 'none';
      this.backdropEl.style.transition = 'none';
      // Force a reflow so the no-transition state applies before
      // the next style write below.
      void this.root.offsetWidth;
    }
    if (snap === 'closed') {
      this.root.style.transform = 'translateY(100%)';
      this.backdropEl.style.opacity = '0';
      this.backdropEl.style.pointerEvents = 'none';
    } else {
      const vh = SNAP_VH[snap];
      // Sheet height = vh of viewport; translate by (100% - vh) so
      // the bottom edge sits at the bottom of the viewport.
      this.root.style.height = `${vh}vh`;
      this.root.style.transform = `translateY(0)`;
      this.backdropEl.style.opacity = '1';
      this.backdropEl.style.pointerEvents = 'auto';
    }
    if (!animate) {
      // Re-enable transitions on the next tick.
      requestAnimationFrame(() => {
        this.root.style.transition = '';
        this.backdropEl.style.transition = '';
      });
    }
  }

  /**
   * Pointer-down on the header begins a drag; pointer-move resizes
   * the sheet by adjusting its height live; pointer-up snaps to the
   * nearest valid point (or dismisses on a fast swipe-down / drag
   * past the threshold).
   */
  private wireDrag(): void {
    const onDown = (e: PointerEvent) => {
      // Only handle primary pointer; ignore right-click / multi-touch.
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      // Don't start a drag if user tapped a button inside the header.
      if ((e.target as HTMLElement).closest('button')) return;
      const currentVh = this.snap === 'closed' ? 0 : SNAP_VH[this.snap];
      this.dragState = {
        startY: e.clientY,
        startSnapVh: currentVh,
        lastY: e.clientY,
        lastT: performance.now(),
      };
      this.root.style.transition = 'none';
      this.headerEl.setPointerCapture(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      if (!this.dragState) return;
      const dyVh = ((this.dragState.startY - e.clientY) / window.innerHeight) * 100;
      const targetVh = Math.max(0, Math.min(SNAP_VH.large + 5, this.dragState.startSnapVh + dyVh));
      this.root.style.height = `${targetVh}vh`;
      this.dragState.lastY = e.clientY;
      this.dragState.lastT = performance.now();
    };
    const onUp = (e: PointerEvent) => {
      if (!this.dragState) return;
      try { this.headerEl.releasePointerCapture(e.pointerId); } catch { /* already released */ }
      const currentVh = ((100 - parseFloat(this.root.style.height || '0')) >= 0)
        ? parseFloat(this.root.style.height || '0')
        : 0;
      const dt = performance.now() - this.dragState.lastT + 1;
      const velocity = (this.dragState.startY - this.dragState.lastY) / Math.max(dt, 1);  // px/ms upward = positive
      this.dragState = null;
      // Re-enable transitions for the snap animation.
      this.root.style.transition = '';

      // Fast swipe-down → dismiss regardless of position.
      if (velocity < -VELOCITY_DISMISS) { this.dismiss(); return; }
      // Dragged below small by enough → dismiss.
      if (currentVh < SNAP_VH.small - DISMISS_THRESHOLD_VH) { this.dismiss(); return; }
      // Otherwise snap to nearest point.
      const dSmall = Math.abs(currentVh - SNAP_VH.small);
      const dMedium = Math.abs(currentVh - SNAP_VH.medium);
      const dLarge = Math.abs(currentVh - SNAP_VH.large);
      const min = Math.min(dSmall, dMedium, dLarge);
      const next: SnapPoint = min === dSmall ? 'small' : min === dMedium ? 'medium' : 'large';
      this.applySnap(next, true);
    };
    this.headerEl.addEventListener('pointerdown', onDown);
    this.headerEl.addEventListener('pointermove', onMove);
    this.headerEl.addEventListener('pointerup', onUp);
    this.headerEl.addEventListener('pointercancel', onUp);
  }
}

/**
 * Singleton manager — enforces "only one toolbar sheet open at a
 * time". Opening a new sheet dismisses any open one. Used by
 * MobileUI's toolbar bindings; InfoPanel-on-mobile uses its own
 * BottomSheet instance because it can coexist with a toolbar sheet
 * (e.g. user opens Scale, then taps Mars in the canvas).
 */
class SheetManager {
  private current: BottomSheet | null = null;

  open(sheet: BottomSheet, snap?: SnapPoint): void {
    if (this.current && this.current !== sheet && this.current.isOpen()) {
      this.current.dismiss();
    }
    this.current = sheet;
    sheet.open(snap);
  }
  closeAll(): void {
    if (this.current?.isOpen()) this.current.dismiss();
    this.current = null;
  }
}
export const toolbarSheets = new SheetManager();
