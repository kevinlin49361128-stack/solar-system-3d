import type { SimulationClock } from '../time/SimulationClock';
import { getLang, setLang, t, onLanguageChange, type Lang } from '../i18n';

/**
 * Mobile-only chrome controller — wires the top bar, bottom toolbar,
 * and floating state chip that replace the desktop LeftPanel /
 * TimeControls when `body.mobile-ui` is active.
 *
 * Only constructs interactivity that's idempotent with desktop mode
 * (e.g. the toolbar buttons dispatch the same shared events the
 * LeftPanel uses). Layout-mode swap can therefore happen mid-session
 * without state desync.
 *
 * Phase B (this file): wires the **chrome itself**:
 *   - topbar: hamburger placeholder (until settings sheet lands in
 *     Phase D), title, language selector mirror
 *   - bottombar: buttons opening sheet placeholders (Phase D fills
 *     each sheet with real content)
 *   - statechip: pause toggle + rate display synced to clock
 *
 * Phase D will register actual sheet content for each toolbar item.
 */

type SheetId = 'scale' | 'time' | 'camera' | 'view' | 'find';

export class MobileUI {
  /**
   * Wire bottom toolbar buttons to a callback the parent supplies.
   * The parent (main.ts) decides what each sheet does. Until Phase D
   * lands, a placeholder toast tells the user the feature isn't here
   * yet — better than a no-op button.
   */
  private sheetHandlers = new Map<SheetId, () => void>();

  constructor(private clock: SimulationClock) {
    // Skip wiring entirely if we're not in mobile mode. Re-evaluate if
    // user toggles mid-session — that triggers a full reload (Phase D
    // will revisit if we ever support hot-swap).
    if (!document.body.classList.contains('mobile-ui')) return;

    this.wireTopBar();
    this.wireBottomBar();
    this.wireStateChip();
    onLanguageChange(() => this.applyLanguage());
    this.applyLanguage();
  }

  /** Register a handler for one of the 5 bottom-toolbar sheet ids.
   *  Called by main.ts in Phase D as each sheet's content gets built. */
  setSheetHandler(id: SheetId, fn: () => void): void {
    this.sheetHandlers.set(id, fn);
  }

  private wireTopBar(): void {
    // Hamburger → settings sheet. Currently contains the layout-mode
    // switcher; future settings (privacy, debug HUD, theme) plug in
    // here.
    document.getElementById('mt-menu')?.addEventListener('click', () => {
      void this.openSettingsSheet();
    });

    // Mirror the (now-hidden) #lang-select so language switches work
    // through the topbar. We dispatch through the i18n module so all
    // subscribers (panels, sprites, labels) refresh.
    const sel = document.getElementById('mt-lang') as HTMLSelectElement | null;
    if (sel) {
      sel.value = getLang();
      sel.addEventListener('change', () => setLang(sel.value as Lang));
      // Keep the mobile dropdown in sync if language is changed
      // elsewhere (e.g. via deep-link param or future settings).
      onLanguageChange(() => { sel.value = getLang(); });
    }
  }

  private wireBottomBar(): void {
    const bar = document.getElementById('mobile-bottombar');
    if (!bar) return;
    bar.querySelectorAll<HTMLButtonElement>('button[data-sheet]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.sheet as SheetId | undefined;
        if (!id) return;
        // Visual feedback: mark active until next tap on anything.
        bar.querySelectorAll('button.active').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const handler = this.sheetHandlers.get(id);
        if (handler) {
          handler();
        } else {
          // Phase D will register handlers; until then, soft feedback.
          void import('./toast').then(({ toast }) => {
            toast.info(t('mb.sheetStub').replace('{name}', t(`mb.${id}`)));
          });
        }
      });
    });
  }

  private wireStateChip(): void {
    const pauseBtn = document.getElementById('msc-pause') as HTMLButtonElement | null;
    const rateEl = document.getElementById('msc-rate');
    const refreshIcon = () => {
      if (pauseBtn) pauseBtn.textContent = this.clock.isPlaying() ? '⏸' : '▶';
    };
    if (pauseBtn) {
      pauseBtn.addEventListener('click', () => {
        this.clock.toggle();
        refreshIcon();
      });
      refreshIcon();
    }
    // Speed display — refresh on every clock tick via subscribe so
    // it's always in sync without a polling timer.
    if (rateEl) {
      const updateRate = () => {
        rateEl.textContent = this.formatRate(this.clock.getSpeed());
      };
      this.clock.subscribe(updateRate);
      updateRate();
    }
  }

  /**
   * Compact human-friendly rate string for the chip. The clock's
   * "speed" is sim-seconds-per-real-second. Match the desktop
   * TimeControls dropdown labels: 1× (real-time, 1 s/s) → 1 min/s
   * → 1 h/s → 1 day/s → 1 yr/s, with negative prefix for reverse.
   */
  private formatRate(secPerSec: number): string {
    if (Math.abs(secPerSec) < 0.5) return '⏸';
    const sign = secPerSec < 0 ? '-' : '';
    const abs = Math.abs(secPerSec);
    if (abs < 2)          return `${sign}1×`;
    if (abs < 120)        return `${sign}${abs.toFixed(0)}s/s`;
    if (abs < 7200)       return `${sign}${(abs / 60).toFixed(0)}m/s`;
    if (abs < 172800)     return `${sign}${(abs / 3600).toFixed(0)}h/s`;
    if (abs < 31_557_600) return `${sign}${(abs / 86400).toFixed(0)}d/s`;
    return `${sign}${(abs / 31_557_600).toFixed(0)}y/s`;
  }

  /** Refresh any topbar / statechip text that isn't covered by the
   *  global `data-i18n` applyLanguage pass (those are handled by
   *  i18n.ts). Currently no-op — kept for future use as we add
   *  dynamic text. */
  private applyLanguage(): void {
    // No-op for now; topbar i18n labels are handled by data-i18n.
  }

  /**
   * Cached settings sheet — created lazily on first hamburger tap.
   * Reusing the instance preserves any state (scroll position,
   * future expanded sections).
   */
  private settingsSheet: import('./BottomSheet').BottomSheet | null = null;

  private async openSettingsSheet(): Promise<void> {
    if (!this.settingsSheet) {
      const { BottomSheet, toolbarSheets } = await import('./BottomSheet');
      const { buildMobileLayoutSwitchPanel } = await import('./layoutSwitchUI');
      this.settingsSheet = new BottomSheet({
        id: 'settings',
        title: t('mb.settings'),
        initialSnap: 'closed',
      });
      this.settingsSheet.content.appendChild(buildMobileLayoutSwitchPanel());
      // Use the same toolbar SheetManager so other sheets dismiss when
      // settings opens (and vice versa) — only one sheet visible at a time.
      const ts = toolbarSheets;
      const openWith = () => ts.open(this.settingsSheet!, 'small');
      openWith();
      return;
    }
    const { toolbarSheets } = await import('./BottomSheet');
    toolbarSheets.open(this.settingsSheet, 'small');
  }
}
