/**
 * Vitest setup. Runs once per test file before specs.
 *
 * We intentionally do NOT force happy-dom here — most tests are pure
 * physics/math and run faster in plain node. UI tests opt in per-file
 * via the `// @vitest-environment happy-dom` pragma at the top of the
 * test file.
 *
 * Polyfills below are environment-agnostic so they're safe to run in
 * either node or happy-dom contexts. They cover real-world cases like:
 *   - localStorage access in i18n module's top-level code (would crash
 *     on node import without polyfill)
 *   - matchMedia / requestAnimationFrame used by lazy-load triggers
 */

import { afterEach, vi } from 'vitest';

// localStorage stub for node — safe no-op for happy-dom (which has its own).
if (typeof globalThis.localStorage === 'undefined') {
  const store = new Map<string, string>();
  globalThis.localStorage = {
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => { store.set(k, String(v)); },
    removeItem: (k) => { store.delete(k); },
    clear: () => { store.clear(); },
    key: (i) => Array.from(store.keys())[i] ?? null,
    get length() { return store.size; },
  } as Storage;
}

// requestAnimationFrame: stubbed to fire synchronously so layout-deferring
// code paths complete within tests. Use `vi.useFakeTimers()` in a spec to
// override if you need finer control.
if (typeof globalThis.requestAnimationFrame === 'undefined') {
  globalThis.requestAnimationFrame = ((cb: (t: number) => void) => {
    cb(performance.now());
    return 0;
  }) as typeof requestAnimationFrame;
  globalThis.cancelAnimationFrame = (() => { /* no-op */ }) as typeof cancelAnimationFrame;
}

// Reset mock state between tests so spies don't leak.
afterEach(() => {
  vi.restoreAllMocks();
});
