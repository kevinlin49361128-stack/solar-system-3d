/**
 * localStorage persistence for the observation queue. Same shape +
 * pattern as `data/observationLog.ts`: pure functions returning the
 * in-memory store, save() flushes; no DOM, no UI dependencies.
 *
 * The queue is shared across the whole app (not per-device, per-night,
 * etc. — that scope would need a sync backend). One queue at a time
 * is the right MVP — most amateur astronomers plan one session at a
 * time and tomorrow's queue is built from scratch.
 */
import type { QueueTarget } from '../physics/observationQueue';

const STORAGE_KEY = 'solarSysObservationQueue';

interface Store {
  version: 1;
  targets: QueueTarget[];
}

function load(): Store {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { version: 1, targets: [] };
    const parsed = JSON.parse(raw) as Store;
    if (parsed?.version === 1 && Array.isArray(parsed.targets)) {
      return parsed;
    }
  } catch (err) {
    console.warn('ObservationQueue: load failed', err);
  }
  return { version: 1, targets: [] };
}

function save(store: Store): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch (err) {
    console.warn('ObservationQueue: save failed', err);
  }
}

let cached: Store | null = null;
function get(): Store {
  if (!cached) cached = load();
  return cached;
}

export function listQueue(): QueueTarget[] {
  return [...get().targets];
}

export function addToQueue(target: QueueTarget): void {
  const s = get();
  // Replace any existing entry with the same id (re-add with new scope).
  const i = s.targets.findIndex(t => t.id === target.id);
  if (i >= 0) s.targets[i] = target;
  else s.targets.push(target);
  save(s);
}

export function removeFromQueue(id: string): void {
  const s = get();
  s.targets = s.targets.filter(t => t.id !== id);
  save(s);
}

export function reorderQueue(orderedIds: string[]): void {
  const s = get();
  const byId = new Map(s.targets.map(t => [t.id, t]));
  const reordered: QueueTarget[] = [];
  for (const id of orderedIds) {
    const t = byId.get(id);
    if (t) reordered.push(t);
  }
  // Append any targets not in the orderedIds (defensive).
  for (const t of s.targets) {
    if (!orderedIds.includes(t.id)) reordered.push(t);
  }
  s.targets = reordered;
  save(s);
}

export function updateQueueTarget(id: string, patch: Partial<QueueTarget>): void {
  const s = get();
  const i = s.targets.findIndex(t => t.id === id);
  if (i < 0) return;
  s.targets[i] = { ...s.targets[i], ...patch, id: s.targets[i].id };
  save(s);
}

export function clearQueue(): void {
  cached = { version: 1, targets: [] };
  save(cached);
}

export function isInQueue(id: string): boolean {
  return get().targets.some(t => t.id === id);
}
