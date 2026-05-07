/**
 * Lightweight toast notifier for non-blocking status messages.
 *
 * Usage:
 *   import { toast } from './toast';
 *   toast.warn('星表載入失敗，部分恆星不會顯示');
 *   toast.info('觀測點地形載入完成');
 *
 * Toasts stack at the bottom-left, auto-dismiss after 5s (warn/error) or 3s
 * (info). Click to dismiss early. The container is created lazily on first
 * use, so importing the module costs nothing if no toast ever fires.
 */

type Severity = 'info' | 'warn' | 'error';

let containerEl: HTMLDivElement | null = null;

function ensureContainer(): HTMLDivElement {
  if (containerEl) return containerEl;
  const c = document.createElement('div');
  c.id = 'toast-container';
  c.style.cssText = [
    'position: fixed',
    'bottom: 36px',
    'left: 16px',
    'z-index: 1500',
    'display: flex',
    'flex-direction: column',
    'gap: 6px',
    'pointer-events: none',
    'max-width: min(360px, calc(100vw - 32px))',
  ].join(';');
  document.body.appendChild(c);
  containerEl = c;
  return c;
}

function show(message: string, severity: Severity, durationMs: number): void {
  const container = ensureContainer();
  const t = document.createElement('div');
  const colors: Record<Severity, { bg: string; border: string; icon: string }> = {
    info:  { bg: 'rgba(20, 30, 48, 0.92)',  border: 'rgba(120, 160, 220, 0.5)', icon: 'ℹ︎' },
    warn:  { bg: 'rgba(48, 38, 12, 0.94)',  border: 'rgba(255, 196, 80, 0.6)',  icon: '⚠︎' },
    error: { bg: 'rgba(48, 14, 14, 0.94)',  border: 'rgba(255, 96, 96, 0.7)',   icon: '⊗' },
  };
  const c = colors[severity];
  t.style.cssText = [
    `background: ${c.bg}`,
    `border: 1px solid ${c.border}`,
    'border-radius: 8px',
    'padding: 8px 12px',
    'color: #e8eef7',
    'font-size: 12px',
    'line-height: 1.45',
    'pointer-events: auto',
    'cursor: pointer',
    'backdrop-filter: blur(12px)',
    '-webkit-backdrop-filter: blur(12px)',
    'opacity: 0',
    'transform: translateY(8px)',
    'transition: opacity 0.18s ease, transform 0.18s ease',
    'box-shadow: 0 4px 12px rgba(0,0,0,0.4)',
  ].join(';');
  t.textContent = `${c.icon}  ${message}`;
  container.appendChild(t);

  // Animate in.
  requestAnimationFrame(() => {
    t.style.opacity = '1';
    t.style.transform = 'translateY(0)';
  });

  const dismiss = () => {
    if (!t.parentNode) return;
    t.style.opacity = '0';
    t.style.transform = 'translateY(8px)';
    setTimeout(() => t.parentNode?.removeChild(t), 200);
  };

  t.addEventListener('click', dismiss);
  setTimeout(dismiss, durationMs);
}

export const toast = {
  info(message: string): void { show(message, 'info', 3000); },
  warn(message: string): void { show(message, 'warn', 5000); },
  error(message: string): void { show(message, 'error', 6000); },
};
