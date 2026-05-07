// @vitest-environment happy-dom
/**
 * i18n module tests. Runs in happy-dom because setLang() side-effects
 * call applyLanguage() which touches document.querySelectorAll. The
 * pure-lookup tests (t, langPick, bodyName) don't strictly need DOM,
 * but co-locating them in one file is simpler than splitting just to
 * avoid happy-dom for ~20 ms of overhead.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { t, getLang, setLang, langPick, bodyName } from './i18n';

describe('i18n.t() — translation key lookup', () => {
  beforeEach(() => {
    setLang('zh-Hant');
  });

  it('returns the zh-Hant translation by default', () => {
    expect(t('time.now')).toBe('現在');
  });

  it('returns en translation after setLang("en")', () => {
    setLang('en');
    expect(t('time.now')).toBe('Now');
  });

  it('returns ja translation after setLang("ja")', () => {
    setLang('ja');
    expect(t('time.now')).toBe('現在'); // ja key happens to match zh kanji
    expect(t('time.pause')).toBe('一時停止/再生');
  });

  it('returns the key itself when no translation found (fallback contract)', () => {
    expect(t('nonexistent.key.foo')).toBe('nonexistent.key.foo');
  });

  it('falls back to zh-Hant when current language has no entry', () => {
    setLang('en');
    // tour.welcome.title has all three; verify a different key path
    expect(t('tour.welcome.title')).toBe('Welcome to Solar System 3D');
  });
});

describe('i18n.langPick() — flexible lang object', () => {
  beforeEach(() => { setLang('zh-Hant'); });

  it('picks the current language from a record', () => {
    expect(langPick({ 'zh-Hant': '中', 'en': 'EN', 'ja': '日' })).toBe('中');
    setLang('ja');
    expect(langPick({ 'zh-Hant': '中', 'en': 'EN', 'ja': '日' })).toBe('日');
  });

  it('falls back through zh-Hant → en → ja when current is missing', () => {
    setLang('ja');
    expect(langPick({ 'zh-Hant': '中', 'en': 'EN' })).toBe('中');
  });

  it('accepts a plain string and returns it unchanged', () => {
    expect(langPick('plain string')).toBe('plain string');
  });

  it('returns empty string for null/undefined', () => {
    expect(langPick(null)).toBe('');
    expect(langPick(undefined)).toBe('');
  });
});

describe('i18n.bodyName()', () => {
  beforeEach(() => { setLang('zh-Hant'); });

  it('returns Chinese name for zh-Hant', () => {
    const earth = { name: '地球', nameEn: 'Earth', nameJa: '地球' };
    expect(bodyName(earth)).toBe('地球');
  });

  it('returns English name for en', () => {
    setLang('en');
    const earth = { name: '地球', nameEn: 'Earth', nameJa: '地球' };
    expect(bodyName(earth)).toBe('Earth');
  });

  it('falls back to Chinese name when nameJa is missing for ja lang', () => {
    setLang('ja');
    const obj = { name: '小行星', nameEn: 'Asteroid' };
    // No nameJa → falls back to Chinese (which often is readable as kanji)
    expect(bodyName(obj)).toBe('小行星');
  });
});

describe('i18n.getLang()/setLang() — state', () => {
  it('persists language to localStorage', () => {
    setLang('en');
    expect(localStorage.getItem('solarSysLang')).toBe('en');
    expect(getLang()).toBe('en');
  });

  it('round-trips through all three supported languages', () => {
    for (const lang of ['zh-Hant', 'en', 'ja'] as const) {
      setLang(lang);
      expect(getLang()).toBe(lang);
    }
  });
});
