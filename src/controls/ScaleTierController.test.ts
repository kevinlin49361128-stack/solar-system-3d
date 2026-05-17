import { describe, it, expect } from 'vitest';
import { ScaleTierController } from './ScaleTierController';

describe('ScaleTierController', () => {
  it('starts at system tier with sane defaults', () => {
    const c = new ScaleTierController();
    expect(c.getTier()).toBe('system');
    expect(c.isAnimating()).toBe(false);
    const s = c.update(0);
    expect(s.cameraDistance).toBe(14);
    expect(s.layerWeights.solarSystem).toBe(1);
    expect(s.layerWeights.hygCloud).toBe(0);
  });

  it('animates to neighbourhood tier and settles after duration', () => {
    // Mock performance.now so setTier (which reads start = now())
    // and update(now) share a controllable clock. Without this the
    // test was flaky: `update(500)` was being interpreted as absolute
    // wall-clock 500ms, but setTier captured the real performance.now()
    // (~hundreds of ms after cold Node start), so elapsed went negative
    // on ~30% of runs and the easing produced cameraDistance < 14.
    const realNow = performance.now;
    let mockedNow = 1_000_000;
    performance.now = () => mockedNow;
    try {
      const c = new ScaleTierController();
      c.setTier('neighbourhood', 1.0); // 1 second for test speed
      expect(c.isAnimating()).toBe(true);

      // Halfway through (t=0.5 → eased=0.5 — symmetric ease curve)
      mockedNow += 500;
      const mid = c.update(mockedNow);
      expect(mid.cameraDistance).toBeGreaterThan(14);
      expect(mid.cameraDistance).toBeLessThan(80);
      expect(mid.layerWeights.solarSystem).toBeGreaterThan(0.15);
      expect(mid.layerWeights.solarSystem).toBeLessThan(1);
      expect(mid.layerWeights.hygCloud).toBeGreaterThan(0);
      expect(mid.layerWeights.hygCloud).toBeLessThan(1);

      // After full duration → settled at target
      mockedNow += 1000;
      const final = c.update(mockedNow);
      expect(c.isAnimating()).toBe(false);
      expect(c.getTier()).toBe('neighbourhood');
      expect(final.cameraDistance).toBe(80);
      expect(final.layerWeights.solarSystem).toBeCloseTo(0.15, 6);
      expect(final.layerWeights.hygCloud).toBe(1);
    } finally {
      performance.now = realNow;
    }
  });

  it('uses logarithmic interpolation for camera distance (3+ decades)', () => {
    const c = new ScaleTierController();
    c.snapTo('system'); // start at distance 14
    // performance.now used internally — we need to drive update(now) manually.
    // Setup: setTier and immediately drive to t=0.5 via known timeline.
    c.setTier('galactic', 1.0);
    const halfway = c.update(performance.now() + 500);
    // Geometric midpoint: sqrt(14 * 60_000) ≈ 916.5
    // Linear midpoint:     (14 + 60_000) / 2 = 30007
    // Easing curve gives t=0.5 → eased=0.5, so midpoint should be near 916.
    expect(halfway.cameraDistance).toBeGreaterThan(500);
    expect(halfway.cameraDistance).toBeLessThan(2000);
  });

  it('zoomOut advances tier; zoomIn retreats', () => {
    const c = new ScaleTierController();
    c.zoomOut();
    expect(c.getTargetTier()).toBe('neighbourhood');
    c.update(99999); // settle
    c.zoomOut();
    expect(c.getTargetTier()).toBe('galactic');
    c.update(99999);
    c.zoomOut(); // already at outermost
    expect(c.getTargetTier()).toBe('galactic');

    c.zoomIn();
    expect(c.getTargetTier()).toBe('neighbourhood');
    c.update(99999);
    c.zoomIn();
    expect(c.getTargetTier()).toBe('system');
    c.update(99999);
    c.zoomIn(); // already at innermost
    expect(c.getTargetTier()).toBe('system');
  });

  it('reparameterises from interpolated state if interrupted mid-animation', () => {
    // Mock performance.now so setTier and update share a controllable clock.
    const realNow = performance.now;
    let mockedNow = 1_000_000;
    performance.now = () => mockedNow;
    try {
      const c = new ScaleTierController();
      c.setTier('galactic', 4.0);
      mockedNow += 1000;
      const partway = c.update(mockedNow);
      const distAtInterrupt = partway.cameraDistance;
      expect(distAtInterrupt).toBeGreaterThan(14);
      expect(distAtInterrupt).toBeLessThan(60_000);

      // Interrupt: head back to system. New animation starts from the
      // interpolated state, not from the original tier target.
      c.setTier('system', 1.0);
      mockedNow += 1; // 1 ms into the new animation
      const justAfter = c.update(mockedNow);
      expect(justAfter.cameraDistance).toBeCloseTo(distAtInterrupt, 0);
    } finally {
      performance.now = realNow;
    }
  });

  it('snapTo() jumps without animation', () => {
    const c = new ScaleTierController();
    c.snapTo('galactic');
    expect(c.isAnimating()).toBe(false);
    expect(c.getTier()).toBe('galactic');
    expect(c.update(0).cameraDistance).toBe(60_000);
  });

  it('subscribers receive state during animation', () => {
    const c = new ScaleTierController();
    const samples: number[] = [];
    c.subscribe(s => samples.push(s.cameraDistance));
    c.setTier('neighbourhood', 1.0);
    c.update(0);
    c.update(250);
    c.update(500);
    c.update(750);
    c.update(1000);
    expect(samples.length).toBeGreaterThan(2);
    // Distance should monotonically increase through the animation.
    for (let i = 1; i < samples.length; i++) {
      expect(samples[i]).toBeGreaterThanOrEqual(samples[i - 1]);
    }
  });
});
