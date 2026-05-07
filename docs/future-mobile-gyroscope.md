# Mobile gyroscope (AR sky)

> Status: **shipped (basic)**. Tilt-to-aim works on iOS (via `webkitCompassHeading`)
> and Android (via `deviceorientationabsolute` / `alpha` fallback). Calibration
> button + smoothing implemented.
>
> **Deferred: WMM magnetic-declination correction.** Tested a centred-dipole
> approximation (n=1 terms only, no data file): error magnitude is ±5–15°
> globally, which is *worse* than the typical sensor bias on a phone. Useless.
> Proper degree-12 WMM 2025 needs the full .COF coefficient table (~12 KB,
> 168 hand-typed coefficients) — the implementation is straightforward but
> the typing is error-prone without the source data file. **Manual
> calibration via "Recalibrate North" remains the recommended path until
> WMM-12 lands.**
>
> Real-device validation across multiple iPhone / Android models also
> pending.
>
> Original notes preserved below as reference for the WMM follow-up and
> remaining edge cases.

## Goal

In observer mode on a mobile device, let the user **point the phone at the sky and have the camera mirror that direction in real time**. Effectively turns the simulator into a planetarium AR overlay — useful for "what star is that?" identification.

## API surface

- **`DeviceOrientationEvent`** — alpha (compass / azimuth, 0–360°), beta (front-back tilt, −180–180°), gamma (left-right tilt, −90–90°). Available on both iOS and Android.
- **`deviceorientationabsolute`** — same shape but guaranteed referenced to true north. Only Chrome/Android. iOS Safari uses the regular `deviceorientation` event with a non-standard `webkitCompassHeading` field that *is* true north.
- **`DeviceOrientationEvent.requestPermission()`** — iOS 13+ requires this, must be called from a user gesture (tap). Returns 'granted' / 'denied'.

## Mapping device → observer

Phone held with screen toward user, top edge pointed at sky:

| Device value | Maps to | Notes |
| --- | --- | --- |
| alpha (or `webkitCompassHeading`) | `observerAz` | iOS: use `webkitCompassHeading` directly (true north). Android: `360 - alpha` if `absolute=true`, else needs manual N calibration. |
| beta | `observerAlt` via `90 - beta` | beta=0 (flat, screen up) → zenith. beta=90 (vertical) → horizon. beta=180 (flat, screen down) → nadir. |
| gamma | (ignored for now) | Could be used for camera roll, but most users hold phone upright; rolling the world is disorienting. |

## UX considerations

1. **Toggle button**, not auto-on. Some users will want manual drag in observer mode even on phones.
2. **Permission flow**: button labeled "🧭 啟用陀螺儀" → tap → request permission → if granted, attach listener and switch into gyro-driven mode. Show "（需點擊授權）" hint on iOS so users understand the prompt is normal.
3. **Smoothing**: raw events are 60Hz and noisy. Apply low-pass filter — exponential smoothing with α ≈ 0.15 is enough to kill jitter without lag.
4. **Drag suppression**: while gyro mode is active, set `observerDragging = false` and ignore pointermove for camera control. Drag should re-enable instantly when toggle goes off.
5. **Sleep / focus loss**: stop listening when document.hidden becomes true; resume on visibility. Otherwise readings continue draining battery silently.
6. **Calibration offset**: provide a "重新校準北方" button. After permission grant, take 1 second of readings and use the median compass heading as zero, with offset adjustable by drag. Some Android devices report compass relative to last-known-orientation rather than true north.

## Edge cases / pitfalls

- iOS: `requestPermission` rejects with `NotAllowedError` if not called inside a user gesture. Wrap the toggle handler in a synchronous click handler — don't await anything before calling `requestPermission`.
- iOS Safari does **not** support the `deviceorientationabsolute` event at all. Fallback to `deviceorientation` + `webkitCompassHeading`.
- Some Android browsers fire events but with `alpha === null` until the user moves the device. Show a "請左右搖動手機讓感應器校正" hint if first 2 seconds give null.
- Magnetic vs true north differs by the **magnetic declination** at the observer's location (±5–15° in most populated areas). Long-term: compute declination from World Magnetic Model (WMM) and correct. Short-term: ignore — visual alignment is good enough and the user can dead-reckon by clicking a known star to verify.
- Pinch-zoom (already implemented for FOV) should still work. Don't disable pointer events globally — only suppress the drag-to-aim handler.
- When user briefly tilts phone past beta = ±90 (e.g. lying down looking up), the alpha value can flip 180° due to gimbal lock. Detect and bridge — common trick: when beta crosses ±90, snapshot az and ignore alpha for ~200ms while the values restabilise.

## Why deferred

- Need a real iPhone + Android device to test the dual-API quirks; can't fully validate from desktop.
- Magnetic declination correction needs WMM data shipped (~10 KB, refresh every 5 years).
- HTTPS requirement: same as GPS, deployment-side concern.
- Layered on top of mobile layout (already done) and GPS (just added) — those should ship and bake first.

## Wiring sketch

```ts
// CameraController.ts
private gyroEnabled = false;
private gyroOffsetAz = 0; // calibration

setGyroEnabled(on: boolean): void {
  this.gyroEnabled = on;
  if (!on) this.detachGyro();
}

private async requestAndAttachGyro() {
  const D = window.DeviceOrientationEvent as any;
  if (D?.requestPermission) {
    const result = await D.requestPermission();
    if (result !== 'granted') throw new Error('permission denied');
  }
  window.addEventListener('deviceorientation', this.onGyro, true);
}

private onGyro = (e: DeviceOrientationEvent) => {
  if (!this.gyroEnabled) return;
  const ev = e as DeviceOrientationEvent & { webkitCompassHeading?: number };
  const azDeg = ev.webkitCompassHeading ?? (ev.alpha ?? 0);
  const altDeg = 90 - (ev.beta ?? 0);
  // Low-pass filter (member fields _smoothAz, _smoothAlt)
  this._smoothAz  = lerp(this._smoothAz,  azDeg,  0.15);
  this._smoothAlt = lerp(this._smoothAlt, altDeg, 0.15);
  this.observerAz  = (this._smoothAz - this.gyroOffsetAz) * Math.PI / 180;
  this.observerAlt = clamp(this._smoothAlt * Math.PI / 180, -π/2 + 0.02, π/2 - 0.02);
};
```

Plus a UI button with iOS-aware permission prompt, and a "calibrate north" affordance (one-tap snapshot of current az → offset).

## Test devices needed

- iPhone (any iOS 13+) — must verify the `requestPermission` flow and `webkitCompassHeading` accuracy
- Android (Chrome) — verify `deviceorientationabsolute` and that alpha wraps correctly
- Tablet (iPad / Android tablet) — verify gimbal-lock heuristic when held horizontally over face
