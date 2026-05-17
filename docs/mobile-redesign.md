# Mobile Redesign — v0.4

Living spec for the touch-first UI overhaul. Updated as phases land.

## Why

Current `responsive: true` is literal: the LeftPanel collapses behind
a hamburger, but on a 375 × 812 iPhone the InfoPanel still slides in
from the right at 90 % width and pops the 3D canvas off the screen.
Tap targets are < 44pt. Time-controls overflow into two rows. Observer
mode dumps six controls onto an already-cramped portrait viewport.

The new direction is **two distinct UIs** picked by the user (with an
auto-detected default), not a single responsive layout trying to be
both.

## North-star reference apps

| App | What we copy | What we don't |
|---|---|---|
| Stellarium Mobile | Full-screen sky + 5-icon bottom toolbar + pull-up sheets | Skeuomorphic visual style |
| Star Walk 2 | Tap-object → full-width bottom card; gesture-first | AR-default (we keep flat canvas as default) |
| SkySafari | Time scrubber sheet, snap-points | Feature density of a paid app |
| Sky Tonight | "What's tonight" priority sort (already have this) | IAP flows |
| Google Earth | Top-left hamburger + top-right search + bottom HUD | Over-minimalism |

## Layout — portrait phone

```
┌──────────────────────────────────┐
│ ☰   太陽系 3D            🌐  ⓘ  │  44pt top bar
├──────────────────────────────────┤
│                                  │
│                                  │
│                                  │
│         FULL-SCREEN 3D           │
│       (pinch / drag / tap)       │
│                                  │
│   ┌───────────┐                  │
│   │ ⏯  1×    │  ← time chip     │
│   └───────────┘    (floating)    │
├──────────────────────────────────┤
│  🌐    🕐    🔭    🌌    🔍     │  44pt bottom toolbar
│ Scale  Time  Cam  View  Find     │  5 icons (thumb zone)
└──────────────────────────────────┘
```

Tap any toolbar icon → bottom sheet at 35 % height (drag handle to
50 % / 90 %). Tap a 3D body → InfoPanel slides up from bottom at 50 %
height (same sheet primitive).

## Phase plan

| Phase | Scope | Effort | Commit gate |
|---|---|---|---|
| A | Launch selector splash + localStorage + setting | 2h | green CI, manual verify both modes load |
| B | `body.mobile-ui` class + media query layer + hide LeftPanel on mobile | 3h | desktop unchanged, mobile shows blank canvas + working time chip |
| C | Generic `BottomSheet` component with drag handle, snap points (35/50/90/dismissed), backdrop, swipe-down-to-dismiss | 4h | unit storybook (test fixture) demonstrates all snap transitions |
| D | Wire 5 sheets: Scale / Time / Camera / Display / Search. Bottom toolbar icons each open the matching sheet. Re-host existing partial HTML from LeftPanel rather than rewriting | 4h | every existing left-panel control is reachable on mobile, behaviour parity verified |
| E | InfoPanel becomes a BottomSheet on mobile (50 %, draggable to 90 %). Desktop keeps the right-side slide-in | 2h | both layouts render correctly |
| F | Observer-mode mobile: gyroscope opt-in pitch on first entry; simplified controls (Bortle + atmo behind ⚙ icon); large crosshair; compass/alt readout strip | 3h | observer entry works without LeftPanel exposed |
| G | Tap-target audit — every interactive element ≥ 44pt² on mobile via mobile-only CSS; review onboarding tour anchors | 2h | Lighthouse mobile UX score ≥ 90 |
| H | Real-device verification: iPhone Safari, iPhone Chrome, Android Chrome, iPad Safari (split between phone and tablet layouts) | 2h | screenshots in `~/Desktop/mobile-verify/` |

**Total ≈ 22 hours.** Commits after every phase so each is reversible.

## Decisions locked

- **Launch selector**: appears on first visit, persists choice in
  `localStorage` under `sim:layoutMode` (`mobile` | `desktop`). Auto-
  default is `mobile` when `('ontouchstart' in window || width < 768)`.
  Setting reachable later via the ☰ menu's first item.

- **No responsive CSS swap.** When the user picks Desktop on a phone
  they get the cramped desktop layout — by their explicit choice.
  When they pick Mobile on a 27" display they get the touch-first
  layout. Removes ambiguity.

- **Landscape (mobile) = portrait layout rotated.** Same overlays in
  the same positions; the canvas just gets wider. No third codepath
  for landscape phones.

- **Tablet (768 ≤ width < 1280)** auto-defaults to Desktop. User can
  flip to Mobile in settings if they're holding it like a phone.

- **Gestures**: pinch-zoom owns the canvas; the browser's pinch is
  disabled via `touch-action: none` on the canvas. Pull-to-refresh
  disabled site-wide (already in place).

- **The bottom toolbar is fixed at 5 icons.** Scale / Time / Camera /
  Display / Search. Everything else lives in sheets reached through
  one of these (e.g. Search sheet has the bookmark list, Display
  sheet contains the Realism toggles).

- **Onboarding tour** gets a mobile-only variant (5 steps mapped to
  the bottom toolbar icons + the launch selector).

## Out of scope for v0.4

- AR-default observer mode (Stellarium Mobile / Star Walk style).
  Considered, deferred: too much engineering for an opinionated
  default that breaks the "open browser → see climax" demo flow.
- Native iOS / Android apps. PWA installable already covers 95 %.
- iPad-specific layout. Treats it as Desktop unless user picks
  Mobile. Pro users wanting Apple Pencil annotation are an
  imagined-not-real audience.
- Gesture shortcuts (swipe-up = Search, swipe-left = previous body).
  Worth exploring but adds discoverability problems we can't fix
  cheaply.
