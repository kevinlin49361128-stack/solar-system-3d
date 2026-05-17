# Future: Horizon profile with labelled peaks

**Target release**: v0.4 (post Show-HN polish round)
**Estimated effort**: 4–6 hours
**Status**: deferred from v0.3 pre-HN; spec captured here so the
design decisions don't have to be re-derived.

---

## Why this exists

Observation planning isn't just "is the sky clear" — it's "is the
sky visible from where I'm standing". A 3500 m peak 30 km south of
the user blocks every planet that transits below ~5° altitude in
that azimuth band, which means **Mercury and Venus disappear for
hours** on either side of inferior conjunction, **a southern-sky
DSO might never clear the horizon at all**.

The existing LocalTerrain DEM already renders the silhouette
correctly in observer mode — what's missing is the **label**.
When the user sees a black-outlined mountain blocking Jupiter,
they should know which mountain it is and how tall.

Comparable apps (Stellarium, Star Walk, SkySafari Plus) all show
horizon silhouettes but **none label the peaks**. This is a real
differentiation point.

---

## What ships

A new toggle in the Realism panel: **"Label nearby peaks"** (default
ON in observer mode). When enabled:

1. **Peak markers in 3D**: every named peak within ~50 km of the
   observer that rises above ~3° apparent altitude gets a small
   Sprite label floating just above its silhouette, with name +
   elevation. Click → opens an info popup with prominence, distance,
   azimuth from observer, and "blocks the sky from {altDeg}° to
   {altDeg}°" range.

2. **Horizon strip overlay** (optional): a faint band along the
   bottom of the viewport showing the silhouette flattened to a
   horizontal panorama, with tick marks at every 30° azimuth and
   labelled peaks. Toggleable separately from the 3D markers since
   it can be visually busy.

3. **Body-vs-peak warnings in InfoPanel**: when the user clicks a
   body and that body's current path tonight will pass behind any
   labelled peak, surface a single row:
   *"Will be hidden behind Mt Hehuan from 22:14 to 23:46"*

---

## Data flow

```
User picks observation site
  ↓
LocalTerrain loads DEM tiles for ±30 km
  ↓
Background worker: detect local maxima in the DEM
  - threshold by prominence (e.g. > 50 m relative to surrounding ring)
  - threshold by elevation gain over a 1 km radius
  ↓
Query Overpass API for `natural=peak` within bbox
  - 30-day localStorage cache keyed on (bbox, resolution)
  ↓
Spatial join: match each detected DEM maximum to nearest OSM peak
within 200 m. Unmatched maxima keep their elevation but show as
"Unnamed peak X m".
  ↓
Project each peak to observer-local (alt, az) using existing
topocentric.ts machinery (with EARTH_RADIUS_AU + Bennett refraction
for the apparent silhouette).
  ↓
Render Sprite labels at the projected positions, billboarded to
the camera, fading with apparent altitude.
```

---

## Why DEM local maxima + OSM, not OSM alone

OSM's `natural=peak` coverage is uneven:
- Western Europe / North America / Taiwan: dense
- Africa / Siberia / Pacific Islands: sparse to nonexistent

DEM local maxima covers the gap. A peak in Sichuan with no OSM
entry but a clear DEM signal still gets a "Unnamed 4820 m" label
instead of nothing.

OSM provides the **names** for known peaks; DEM provides the
**discovery** of every prominent feature.

---

## Edge cases

- **Polar / open ocean**: no DEM maxima → silently render nothing
  (no toast spam).
- **City urban canyons**: buildings aren't `natural=peak`. The
  silhouette renders correctly from DEM but we don't try to label
  buildings (out of scope for "horizon profile").
- **Behind-the-observer peaks**: clip to the forward 270° azimuth
  fan around the camera's compass direction, so the panorama
  strip doesn't have peaks "behind" the user.
- **Performance**: the peak detection runs once per location-change
  in a Web Worker (DEM is up to ~5 MB of float32). The result is a
  list of ~10–30 peaks per 50 km radius — trivial render cost.
- **Stale OSM cache**: trig points get re-surveyed and renamed
  rarely; a 30-day cache is fine.

---

## Risks / footguns

1. **Overpass API rate limits.** Open-Meteo-style: opt-in (driven by
   the Realism toggle), 30-day per-bbox cache, no fetch if the user
   never toggled it on.
2. **Mismatched DEM tiles vs OSM bounding box.** LocalTerrain's
   tile grid doesn't align with arbitrary bboxes — query Overpass
   with the full tile-grid extent, not the user's pin radius.
3. **Label clustering in mountainous areas.** Yosemite has dozens
   of named peaks in a 10 km radius. Cap to top-N by prominence;
   group sub-peaks under their parent.
4. **Apparent altitude calculation.** Don't forget refraction. A
   peak 100 km away at 1° geometric altitude is at 1.4° apparent —
   the difference matters for "does it block Jupiter".

---

## Out of scope (for v0.4)

- Peak photos / Wikipedia integration (nice but adds 20 KB JS for a
  feature that 1% of users will use)
- Climbing route data
- 360° panorama photographs
- Light-pollution direction indicator (separate feature; tracked
  in the Realism panel's existing Bortle slider)

---

## Acceptance criteria

The feature ships when:

1. From 合歡山 IDA Park, the user can see "北二段山 3622 m" labelled
   on the southern horizon, and clicking it shows
   "blocks sky between alt 0° and 2° in az 175°–195°".
2. From the South Pole preset, no peak labels render and no console
   noise appears.
3. From Taipei (mid-city, surrounded by mountains), the labels
   render but cluster gracefully — no more than 8 visible at once.
4. From the middle of the Pacific Ocean, the toggle is silently a
   no-op.
5. Overpass API failure (network drop, rate limit) degrades to
   "DEM maxima only, no names" rather than blocking the feature.
6. No `localStorage` write happens if the toggle is OFF.

---

## Implementation order

1. **Peak detector module** (`src/physics/peakDetection.ts`).
   Pure-function: DEM float32 → list of (lat, lon, elevM, prominence).
   Unit tests with synthetic mountain ranges.
2. **Overpass client + cache** (`src/physics/osmPeaks.ts`). Same
   shape as `openMeteoWeather.ts`: explicit consent flag, in-memory
   + localStorage cache, fail-silent on network errors.
3. **Spatial join + naming** (`src/physics/horizonProfile.ts`).
   Combines #1 + #2.
4. **3D rendering layer** (`src/scene/PeakLabels.ts`). Sprite
   billboards, fade-with-altitude opacity, click handlers.
5. **InfoPanel hint** — single row "will be hidden behind…".
6. **Realism panel toggle** + i18n.

Step 1 is the highest-leverage; steps 2–6 are mechanical once the
detector works.
