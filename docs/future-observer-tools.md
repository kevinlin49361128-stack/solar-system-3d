# Future: observer tools + rendering ideas (post-v0.8.0)

**Status**: captured, deferred. Decided after v0.8.0 shipped — the user
wants all four, but is pausing new feature work until the Lemon Squeezy
donation store clears its review (see `TODO_SPONSORS_ACTIVATION.md`).
Pick these up once that's unblocked.

Listed roughly in recommended build order (value ÷ effort).

---

## 1. ISS / satellite visible-pass predictor  ⭐ recommended first

"Next visible ISS pass from your location: tonight 21:43, rises NW,
peaks mag −3.1, visible 6 min."

- **Why it fits**: the single most-wanted feature for real amateur
  observers. Physics-traceable (it's just orbital geometry + lighting).
- **Leverages**: `SatelliteLayer` already runs SGP4 via satellite.js —
  the orbit propagation is done. What's missing is the *search*: scan
  forward in time for windows where the satellite is simultaneously
  (a) above the observer's horizon, (b) sunlit, and (c) the observer's
  sky is dark enough (sun sufficiently below horizon).
- **Output**: a panel listing the next N visible passes — time, rise/
  set azimuth, peak altitude, peak magnitude, duration.
- **Effort**: low–medium. The hard part (SGP4) exists; this is a
  visibility scan + a UI panel.

## 2. Retrograde motion tracer

Plot the apparent looping path a planet traces against the background
stars — the iconic "knot" of a Mars retrograde.

- **Why it fits**: very high educational value — it's literally why
  ancient astronomers needed epicycles; one visualisation makes it
  click. On-brand for the "explain the physics" ethos.
- **Leverages**: existing `OrbitPropagator`s. Sample a planet's
  *apparent* (geocentric) position over a multi-month window, project
  to RA/Dec, draw the path as a polyline on the celestial sphere.
- **Output**: a toggle that overlays the selected planet's apparent
  path over ±N months, with date ticks along the loop.
- **Effort**: medium. Mostly a new scene overlay + a date-range control.

## 3. Analemma (+ equation of time)

The figure-8 the Sun traces over a year when observed at the same
clock time each day.

- **Why it fits**: a classic, bounded, beautiful astronomy
  visualisation. Naturally surfaces the equation of time.
- **Leverages**: existing solar-position + observer-frame math. Sample
  the Sun's alt/az at a fixed civil time across 365 days.
- **Output**: an observer-mode overlay drawing the analemma curve;
  optionally a small equation-of-time graph.
- **Effort**: low–medium. Self-contained.

## 4. Comet dual tails (rendering refinement)

Split a comet's tail into the two physically-distinct tails:
- **Ion tail** — straight, points anti-solar (solar wind driven).
- **Dust tail** — curved, lags along the orbital path (radiation
  pressure on slower dust grains).

- **Why it fits**: the current `CometTails` renders a single tail;
  two tails pointing in different directions is real physics and
  visibly more correct (matches any photo of Hale-Bopp / NEOWISE).
- **Leverages**: `CometTails.ts` already exists — this is a refinement
  of that layer, not a new system.
- **Effort**: low. Two tail geometries instead of one, with the dust
  tail curved by orbital velocity.

---

## Notes

- Items 1–3 are observer-mode tools; they pair well with the existing
  event scanner and Tonight-plan panel.
- None of these need new external data — all four reuse machinery the
  simulator already has (SGP4, propagators, solar position, comet
  layer).
- When picking these up, also bump the README roadmap + cut the next
  release once a meaningful batch lands.
