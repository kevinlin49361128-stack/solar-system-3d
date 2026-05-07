// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import {
  markObserved, unmarkObserved, isObserved, getEntry,
  updateNotes, updateRating, listEntries,
  exportJson, importJson, clearAll, totalCount, makeKey,
} from './observationLog';

describe('observationLog', () => {
  beforeEach(() => {
    clearAll();
  });

  it('makeKey produces stable composite identifier', () => {
    expect(makeKey('messier', 'M31')).toBe('messier:M31');
    expect(makeKey('body', 'saturn')).toBe('body:saturn');
  });

  it('isObserved is false before any mark, true after', () => {
    expect(isObserved('messier', 'M31')).toBe(false);
    markObserved('messier', 'M31', '仙女座星系');
    expect(isObserved('messier', 'M31')).toBe(true);
  });

  it('first markObserved creates entry with sessionCount=1', () => {
    const e = markObserved('star', 'vega', '織女星');
    expect(e.sessionCount).toBe(1);
    expect(e.firstObservedAt).toBe(e.lastObservedAt);
    expect(e.rating).toBeNull();
    expect(e.notes).toBe('');
  });

  it('second mark on same target bumps sessionCount + lastObservedAt', async () => {
    markObserved('star', 'vega', '織女星');
    // small delay so timestamps differ
    await new Promise(r => setTimeout(r, 5));
    const e2 = markObserved('star', 'vega', '織女星');
    expect(e2.sessionCount).toBe(2);
    expect(e2.lastObservedAt).toBeGreaterThan(e2.firstObservedAt);
  });

  it('unmarkObserved removes the entry entirely', () => {
    markObserved('messier', 'M42', '獵戶座大星雲');
    expect(isObserved('messier', 'M42')).toBe(true);
    unmarkObserved('messier', 'M42');
    expect(isObserved('messier', 'M42')).toBe(false);
  });

  it('updateNotes auto-creates entry if not yet marked', () => {
    expect(isObserved('messier', 'M13')).toBe(false);
    updateNotes('messier', 'M13', '武仙座球狀星團', '今晚看到一團毛茸茸');
    expect(isObserved('messier', 'M13')).toBe(true);
    const e = getEntry('messier', 'M13');
    expect(e?.notes).toBe('今晚看到一團毛茸茸');
  });

  it('updateRating clamps to entry + persists', () => {
    markObserved('body', 'saturn', '土星');
    updateRating('body', 'saturn', '土星', 5);
    expect(getEntry('body', 'saturn')?.rating).toBe(5);
    updateRating('body', 'saturn', '土星', null);
    expect(getEntry('body', 'saturn')?.rating).toBeNull();
  });

  it('listEntries returns newest-first by lastObservedAt', async () => {
    markObserved('star', 'a', 'A');
    await new Promise(r => setTimeout(r, 5));
    markObserved('star', 'b', 'B');
    await new Promise(r => setTimeout(r, 5));
    markObserved('star', 'c', 'C');
    const list = listEntries();
    expect(list.map(e => e.id)).toEqual(['c', 'b', 'a']);
  });

  it('totalCount tracks entry count', () => {
    expect(totalCount()).toBe(0);
    markObserved('messier', 'M1', '蟹狀');
    markObserved('messier', 'M2', 'M2');
    expect(totalCount()).toBe(2);
    unmarkObserved('messier', 'M1');
    expect(totalCount()).toBe(1);
  });

  it('exportJson + importJson round-trips entries', () => {
    markObserved('messier', 'M31', '仙女座');
    updateRating('messier', 'M31', '仙女座', 4);
    updateNotes('messier', 'M31', '仙女座', 'spiral pattern visible');
    const json = exportJson();

    clearAll();
    expect(totalCount()).toBe(0);

    const imported = importJson(json);
    expect(imported).toBe(1);
    const e = getEntry('messier', 'M31');
    expect(e?.rating).toBe(4);
    expect(e?.notes).toBe('spiral pattern visible');
  });

  it('importJson rejects malformed input', () => {
    expect(() => importJson('not json')).toThrow();
    expect(() => importJson('{}')).toThrow();
    expect(() => importJson('{"version":99,"entries":{}}')).toThrow();
  });

  it('clearAll empties the log', () => {
    markObserved('star', 'a', 'A');
    markObserved('star', 'b', 'B');
    clearAll();
    expect(totalCount()).toBe(0);
    expect(listEntries()).toEqual([]);
  });

  it('refreshes displayName on re-mark (translation may change)', () => {
    markObserved('star', 'vega', '織女星');
    markObserved('star', 'vega', 'Vega');
    expect(getEntry('star', 'vega')?.displayName).toBe('Vega');
  });
});
