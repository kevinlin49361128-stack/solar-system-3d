import { PRECISION_INFO } from '../data/precisionInfo';
import { langPick, t } from '../i18n';

/**
 * Modal showing the full precision-and-limits table. Triggered by an
 * "ⓘ 模型精度" button (in the Advanced tab and inline buttons elsewhere).
 *
 * Self-contained: builds DOM on first show, reuses across opens. Closed
 * via × button, click-on-backdrop, or Esc.
 *
 * The content comes from `data/precisionInfo.ts` — to add a new entry,
 * extend that file; this panel renders whatever's there.
 */
export class PrecisionInfoPanel {
  private overlay: HTMLElement | null = null;

  open(): void {
    if (this.overlay) {
      this.overlay.style.display = '';
      this.render();
      return;
    }
    const overlay = document.createElement('div');
    overlay.id = 'precision-info-overlay';
    overlay.innerHTML = `
      <div class="pi-card" id="pi-card">
        <div class="pi-header">
          <div class="pi-title">${t('precision.title')}</div>
          <button class="pi-close" id="pi-close" aria-label="Close">×</button>
        </div>
        <div class="pi-intro">${t('precision.intro')}</div>
        <div class="pi-list" id="pi-list"></div>
        <div class="pi-footer">${t('precision.footer')}</div>
      </div>
    `;
    document.body.appendChild(overlay);
    this.overlay = overlay;

    overlay.querySelector('#pi-close')?.addEventListener('click', () => this.close());
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) this.close();
    });
    document.addEventListener('keydown', this.onKey);

    this.render();
  }

  close(): void {
    if (this.overlay) this.overlay.style.display = 'none';
  }

  private onKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape' && this.overlay && this.overlay.style.display !== 'none') {
      this.close();
    }
  };

  private render(): void {
    const list = this.overlay?.querySelector('#pi-list');
    if (!list) return;
    list.innerHTML = PRECISION_INFO.map(entry => `
      <div class="pi-entry">
        <div class="pi-entry-label">${escape(langPick(entry.label))}</div>
        <dl class="pi-entry-fields">
          <dt>${t('precision.source')}</dt>
          <dd>${escape(langPick(entry.source))}</dd>
          <dt>${t('precision.accuracy')}</dt>
          <dd>${escape(langPick(entry.accuracy))}</dd>
          <dt>${t('precision.validRange')}</dt>
          <dd>${escape(langPick(entry.validRange))}</dd>
          ${entry.notIncluded ? `
            <dt>${t('precision.notIncluded')}</dt>
            <dd class="pi-not-included">${escape(langPick(entry.notIncluded))}</dd>
          ` : ''}
        </dl>
      </div>
    `).join('');
  }
}

function escape(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
