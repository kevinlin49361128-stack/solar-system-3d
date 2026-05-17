import { BottomSheet, toolbarSheets, type SnapPoint } from './BottomSheet';
import { t, onLanguageChange } from './../i18n';

/**
 * Phase D — fill each of the 5 mobile-toolbar sheets with content.
 *
 * Strategy: rather than rewriting the LeftPanel sections / TimeControls
 * bar / SearchBar input as fresh mobile components (which would
 * duplicate event-wiring + state-keeping that already works on
 * desktop), we **reparent the existing DOM nodes** into the sheet's
 * body on first open. The desktop LeftPanel is CSS-hidden on mobile;
 * its child sections retain their event listeners + dataset state
 * after a `node.appendChild()` reparent — pure DOM, no re-binding
 * needed.
 *
 * On sheet close we leave the nodes in the sheet body (no point
 * shuttling them back to a hidden LeftPanel). If the user toggles to
 * desktop mid-session we ask them to reload — captured in the
 * settings sheet's hamburger flow (Phase F).
 *
 * Mapping toolbar id → DOM sections to reparent:
 *
 *   scale  → #left-panel .scale-toggle (scale + frame) + bookmarks
 *   time   → #time-controls children except the language select +
 *            screenshot/share buttons
 *   camera → #camera-mode + #follow-body selects + observer entry
 *   view   → #left-tab-bar[data-tab=display] panel content +
 *            realism toggles
 *   find   → #search-input + bookmarks list + tonight-plan open
 *
 * If any of these sections are missing (e.g. a future refactor moves
 * them) we silently fall back to an info message in the sheet rather
 * than crashing.
 */

type SheetId = 'scale' | 'time' | 'camera' | 'view' | 'find';

const sheets = new Map<SheetId, BottomSheet>();

interface SheetSpec {
  id: SheetId;
  title: string;
  initialSnap: SnapPoint;
  /**
   * DOM sources to migrate into the sheet, in order. Each entry is a
   * CSS selector resolved against `document`; the matched node is
   * appended (reparenting) into the sheet body. Missing selectors
   * are silently skipped.
   */
  sources: string[];
  /** Optional inline-rendered hint shown above the migrated DOM. */
  hint?: string;
}

function makeSheet(spec: SheetSpec): BottomSheet {
  const sheet = new BottomSheet({
    id: spec.id,
    title: spec.title,
    initialSnap: 'closed',
  });
  // Lazy-populate on first open. Cheap subsequent opens reuse the
  // already-migrated DOM.
  let populated = false;
  const populate = () => {
    if (populated) return;
    populated = true;
    if (spec.hint) {
      const hintEl = document.createElement('div');
      hintEl.className = 'bs-hint';
      hintEl.textContent = spec.hint;
      sheet.content.appendChild(hintEl);
    }
    for (const sel of spec.sources) {
      const node = document.querySelector(sel);
      if (node) {
        // Force any "display:none" inherited from the parent's hidden
        // state — once reparented into the visible sheet, the child
        // should render.
        (node as HTMLElement).style.display = '';
        sheet.content.appendChild(node);
      }
    }
    if (sheet.content.childElementCount === 0) {
      const empty = document.createElement('div');
      empty.className = 'bs-empty';
      empty.textContent = t('mb.empty');
      sheet.content.appendChild(empty);
    }
  };
  // Re-localise the title on language change so "Scale" / "尺度" / "スケール"
  // updates live.
  onLanguageChange(() => sheet.setTitle(t(`mb.${spec.id}`)));
  // Wire the open hook from the bottombar handler:
  (sheet as unknown as { populate?: () => void }).populate = populate;
  return sheet;
}

/**
 * Build all 5 toolbar sheets and return the handler map for
 * MobileUI.setSheetHandler. Called once from main.ts at startup
 * when body.mobile-ui is set.
 */
export function buildMobileSheets(): Record<SheetId, () => void> {
  const specs: SheetSpec[] = [
    {
      id: 'scale',
      title: t('mb.scale'),
      initialSnap: 'small',
      sources: [
        '#left-panel .tab-panel[data-tab-panel="scene"] .section:has(.scale-toggle)',
        '#left-panel .tab-panel[data-tab-panel="scene"] .section:has([data-frame])',
      ],
    },
    {
      id: 'time',
      title: t('mb.time'),
      initialSnap: 'medium',
      // Wraps the desktop time-controls bar in its entirety. The
      // language select + screenshot/share buttons inside are still
      // present but visually less prominent; mobile users mostly use
      // pause / speed / scrubber / "now" + step buttons.
      sources: ['#time-controls'],
    },
    {
      id: 'camera',
      title: t('mb.camera'),
      initialSnap: 'small',
      sources: [
        '#left-panel .tab-panel[data-tab-panel="scene"] .section:has(#camera-mode)',
        '#left-panel .tab-panel[data-tab-panel="scene"] .section:has(#follow-body)',
        '#left-panel .tab-panel[data-tab-panel="observe"]',
      ],
    },
    {
      id: 'view',
      title: t('mb.view'),
      initialSnap: 'medium',
      sources: [
        '#left-panel .tab-panel[data-tab-panel="display"]',
        '#left-panel .tab-panel[data-tab-panel="realism"]',
      ],
    },
    {
      id: 'find',
      title: t('mb.find'),
      initialSnap: 'medium',
      sources: [
        '#search-bar',
        '#left-panel .tab-panel[data-tab-panel="scene"] .section:has(#bookmark-list)',
        '#tonight-plan-panel',
      ],
    },
  ];

  const handlers: Partial<Record<SheetId, () => void>> = {};
  for (const spec of specs) {
    const sheet = makeSheet(spec);
    sheets.set(spec.id, sheet);
    handlers[spec.id] = () => {
      (sheet as unknown as { populate?: () => void }).populate?.();
      toolbarSheets.open(sheet, spec.initialSnap);
    };
  }
  return handlers as Record<SheetId, () => void>;
}

/** Expose for debugging / future settings menu. */
export function dismissAllToolbarSheets(): void {
  toolbarSheets.closeAll();
}
