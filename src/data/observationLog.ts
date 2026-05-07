/**
 * Observation log: persistent record of "what I've seen and when".
 *
 * Design principles
 * -----------------
 * - **Pure data + storage**, no UI dependencies. The `ObservationLogPanel`
 *   class consumes this; tests + future export tools also consume it.
 * - **localStorage as primary store** (~5 MB quota, plenty for thousands of
 *   entries). No server-side anything — this is a personal log, kept on
 *   the device.
 * - **Stable target keys**: identify a target by `<category>:<id>`, e.g.
 *   `body:saturn`, `messier:M31`, `star:vega`, `unnamed:6.7525_-16.7161`.
 *   This way the same Saturn observation merges across sessions even if
 *   the body's display name is translated differently.
 * - **Versioned schema**: `{ version: 1, entries: [...] }` so we can
 *   migrate later without breaking old saves.
 * - **No PII**: no GPS lat/lon stored unless user explicitly attaches it
 *   (future feature). Just target id + timestamp + rating + free text.
 */

const STORAGE_KEY = 'solarSysObservationLog';
const SCHEMA_VERSION = 1;

export type ObservationCategory = 'body' | 'messier' | 'star' | 'unnamed';

export interface ObservationEntry {
  /** Stable composite key: `<category>:<id>` */
  key: string;
  category: ObservationCategory;
  /** Original target id (e.g. "saturn", "M31", "vega"). */
  id: string;
  /** Display name (cached at mark-time so the log stays readable even if
   *  catalogue display strings change later). */
  displayName: string;
  /** Unix ms when first marked observed. */
  firstObservedAt: number;
  /** Unix ms of the most recent observation. */
  lastObservedAt: number;
  /** Number of separate observation sessions logged. */
  sessionCount: number;
  /** 1–5 star rating, or null if not rated. */
  rating: number | null;
  /** Free-text notes (markdown OK; renderer is text-only for now). */
  notes: string;
}

interface ObservationLogStore {
  version: number;
  entries: Record<string, ObservationEntry>;
}

/** Read+parse the log from localStorage. Defaults to empty if missing/corrupt. */
function load(): ObservationLogStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { version: SCHEMA_VERSION, entries: {} };
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && parsed.version === SCHEMA_VERSION && parsed.entries) {
      return parsed as ObservationLogStore;
    }
  } catch { /* corrupt JSON → start fresh */ }
  return { version: SCHEMA_VERSION, entries: {} };
}

function save(store: ObservationLogStore): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch (err) {
    // Quota exceeded → silent failure; UI can prompt a backup-and-clear.
    console.warn('ObservationLog: save failed', err);
  }
}

/** Build the composite key from category + id. */
export function makeKey(category: ObservationCategory, id: string): string {
  return `${category}:${id}`;
}

/** Look up an entry. Returns null if not in the log. */
export function getEntry(category: ObservationCategory, id: string): ObservationEntry | null {
  const store = load();
  return store.entries[makeKey(category, id)] ?? null;
}

/** True if a target has been observed at least once. Cheap check for badges. */
export function isObserved(category: ObservationCategory, id: string): boolean {
  return getEntry(category, id) !== null;
}

/**
 * Mark a target as observed *now*, creating or updating its log entry.
 * If the target already has an entry, this:
 *   - bumps `lastObservedAt` to now
 *   - increments `sessionCount`
 *   - keeps existing notes / rating untouched (use `updateNotes` /
 *     `updateRating` to change those)
 */
export function markObserved(
  category: ObservationCategory,
  id: string,
  displayName: string,
): ObservationEntry {
  const store = load();
  const key = makeKey(category, id);
  const now = Date.now();
  const existing = store.entries[key];
  const entry: ObservationEntry = existing
    ? {
        ...existing,
        lastObservedAt: now,
        sessionCount: existing.sessionCount + 1,
        // Refresh display name in case translation has updated.
        displayName,
      }
    : {
        key,
        category,
        id,
        displayName,
        firstObservedAt: now,
        lastObservedAt: now,
        sessionCount: 1,
        rating: null,
        notes: '',
      };
  store.entries[key] = entry;
  save(store);
  return entry;
}

/** Remove a target from the log (e.g. user un-checks "observed"). */
export function unmarkObserved(category: ObservationCategory, id: string): void {
  const store = load();
  delete store.entries[makeKey(category, id)];
  save(store);
}

/** Update free-text notes for a target (creates entry if not yet observed). */
export function updateNotes(
  category: ObservationCategory,
  id: string,
  displayName: string,
  notes: string,
): void {
  const store = load();
  const key = makeKey(category, id);
  if (!store.entries[key]) {
    // Auto-mark when notes added — observers may want to type a note
    // BEFORE clicking "observed", treating typing itself as observation.
    markObserved(category, id, displayName);
  }
  const fresh = load();
  fresh.entries[key].notes = notes;
  save(fresh);
}

/** Update star rating (1–5, null = unrated). */
export function updateRating(
  category: ObservationCategory,
  id: string,
  displayName: string,
  rating: number | null,
): void {
  const store = load();
  const key = makeKey(category, id);
  if (!store.entries[key]) markObserved(category, id, displayName);
  const fresh = load();
  fresh.entries[key].rating = rating;
  save(fresh);
}

/** All entries, newest-first by lastObservedAt. */
export function listEntries(): ObservationEntry[] {
  const store = load();
  return Object.values(store.entries).sort((a, b) => b.lastObservedAt - a.lastObservedAt);
}

/** Count total entries (for badge display). */
export function totalCount(): number {
  return Object.keys(load().entries).length;
}

/**
 * Export the entire log as JSON (string). Caller wraps it in a Blob +
 * download. Includes schema version so re-import can migrate.
 */
export function exportJson(): string {
  return JSON.stringify(load(), null, 2);
}

/**
 * Replace the log from a JSON string (e.g. user-uploaded backup). Returns
 * the count of entries imported. Throws if the JSON is invalid or wrong
 * schema version.
 */
export function importJson(json: string): number {
  const parsed = JSON.parse(json);
  if (!parsed || parsed.version !== SCHEMA_VERSION || !parsed.entries) {
    throw new Error(`Invalid observation log (expected version ${SCHEMA_VERSION})`);
  }
  save(parsed as ObservationLogStore);
  return Object.keys(parsed.entries).length;
}

/** Wipe the log entirely. UI should confirm before calling. */
export function clearAll(): void {
  save({ version: SCHEMA_VERSION, entries: {} });
}
