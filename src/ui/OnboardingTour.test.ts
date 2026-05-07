// @vitest-environment happy-dom
/**
 * OnboardingTour smoke tests. Runs in happy-dom for real DOM interaction:
 * starting the tour, advancing steps, dismissing, and persistence.
 *
 * These are SMOKE tests — they verify the public API contract and that
 * the DOM gets created/torn down without errors. They don't deeply
 * inspect spotlight positioning math (that depends on real layout that
 * happy-dom only approximates).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { OnboardingTour } from './OnboardingTour';

const STORAGE_KEY = 'solarSysOnboarding.v1';

describe('OnboardingTour', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    localStorage.removeItem(STORAGE_KEY);
  });

  afterEach(() => {
    // Tear down anything left behind so the next test starts clean.
    document.getElementById('onboarding-overlay')?.remove();
    document.getElementById('center-spot')?.remove();
  });

  it('hasSeenTour returns false on a fresh visit', () => {
    expect(OnboardingTour.hasSeenTour()).toBe(false);
  });

  it('hasSeenTour returns true once a flag is set', () => {
    localStorage.setItem(STORAGE_KEY, 'completed');
    expect(OnboardingTour.hasSeenTour()).toBe(true);
  });

  it('start() creates the overlay DOM with title, body, and action buttons', () => {
    const tour = new OnboardingTour();
    tour.start();

    const overlay = document.getElementById('onboarding-overlay');
    expect(overlay).not.toBeNull();
    expect(document.getElementById('ob-title')?.textContent).toBeTruthy();
    expect(document.getElementById('ob-body')?.textContent).toBeTruthy();
    expect(document.getElementById('ob-skip')).not.toBeNull();
    expect(document.getElementById('ob-prev')).not.toBeNull();
    expect(document.getElementById('ob-next')).not.toBeNull();
  });

  it('next() advances steps; the step number indicator updates', () => {
    const tour = new OnboardingTour();
    tour.start();
    expect(document.getElementById('ob-step-num')?.textContent).toMatch(/^1 \//);
    tour.next();
    expect(document.getElementById('ob-step-num')?.textContent).toMatch(/^2 \//);
    tour.next();
    expect(document.getElementById('ob-step-num')?.textContent).toMatch(/^3 \//);
  });

  it('first step has Back button disabled', () => {
    const tour = new OnboardingTour();
    tour.start();
    const prev = document.getElementById('ob-prev') as HTMLButtonElement;
    expect(prev.disabled).toBe(true);
  });

  it('Back button enables after advancing', () => {
    const tour = new OnboardingTour();
    tour.start();
    tour.next();
    const prev = document.getElementById('ob-prev') as HTMLButtonElement;
    expect(prev.disabled).toBe(false);
  });

  it('prev() goes back; cannot go before step 0', () => {
    const tour = new OnboardingTour();
    tour.start();
    tour.next();
    tour.next();
    expect(document.getElementById('ob-step-num')?.textContent).toMatch(/^3 \//);
    tour.prev();
    expect(document.getElementById('ob-step-num')?.textContent).toMatch(/^2 \//);
    tour.prev();
    expect(document.getElementById('ob-step-num')?.textContent).toMatch(/^1 \//);
    tour.prev(); // no-op
    expect(document.getElementById('ob-step-num')?.textContent).toMatch(/^1 \//);
  });

  it('next() on the final step dismisses + writes "completed" flag', () => {
    const tour = new OnboardingTour();
    tour.start();
    // 5 steps — call next() 5 times to traverse + dismiss
    tour.next(); // 1→2
    tour.next(); // 2→3
    tour.next(); // 3→4
    tour.next(); // 4→5
    tour.next(); // 5→done (dismisses)

    expect(document.getElementById('onboarding-overlay')).toBeNull();
    expect(localStorage.getItem(STORAGE_KEY)).toBe('completed');
  });

  it('Skip button writes "skipped" flag and tears down overlay', () => {
    const tour = new OnboardingTour();
    tour.start();
    const skipBtn = document.getElementById('ob-skip') as HTMLButtonElement;
    skipBtn.click();
    expect(document.getElementById('onboarding-overlay')).toBeNull();
    expect(localStorage.getItem(STORAGE_KEY)).toBe('skipped');
  });

  it('Esc key dismisses the tour as "skipped"', () => {
    const tour = new OnboardingTour();
    tour.start();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(document.getElementById('onboarding-overlay')).toBeNull();
    expect(localStorage.getItem(STORAGE_KEY)).toBe('skipped');
  });

  it('replay() clears the flag and re-runs the tour', () => {
    localStorage.setItem(STORAGE_KEY, 'completed');
    expect(OnboardingTour.hasSeenTour()).toBe(true);

    const tour = new OnboardingTour();
    tour.replay();

    // Flag is cleared while running; tour DOM exists
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(document.getElementById('onboarding-overlay')).not.toBeNull();
  });

  it('maybeAutoStart() does NOT show on a returning visit', () => {
    localStorage.setItem(STORAGE_KEY, 'completed');
    const tour = new OnboardingTour();
    tour.maybeAutoStart();
    // No overlay exists immediately or after a frame.
    expect(document.getElementById('onboarding-overlay')).toBeNull();
  });
});
