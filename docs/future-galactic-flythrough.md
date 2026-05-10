# Galactic flythrough + featured exoplanet systems

> Status: **in progress (v0.3.0 target)**. Combines what was originally
> two milestones (A: zoom-out, B: exoplanet systems) into one coherent
> release because the second depends on infrastructure built for the
> first, and the marketing story is much stronger together.
>
> Timeline target: 10–14 days of focused work, post-Show-HN of v0.2.0.

## Goal

In one fluid sequence:

1. User clicks **🔭 Zoom out** (or hits a key).
2. Camera dollies back smoothly across **5 orders of magnitude** — from
   AU scale to ~50 light-years (the local stellar neighbourhood).
3. The HYG point cloud (~120k stars with parallax-derived 3D positions)
   becomes visible as you cross ~5 ly.
4. ~12 named **exoplanet host stars** are highlighted with subtle
   coloured halos and clickable hit-spheres.
5. Click any host → camera flies to the system → smooth scale transition
   to AU-scale view of that system → host star + planets + orbit lines
   render with exactly the same physics pipeline used for our Sun.
6. **Trappist-1 is the showcase**: 7 Earth-sized planets all packed
   inside an orbit smaller than Mercury's, around a 0.09 M☉ red dwarf.
7. Continued zoom-out (from neighbourhood scale) reveals the **3D Milky
   Way disk model** with spiral arms + central bar + bulge.
8. Click anywhere → smooth dolly-in returns to the starting frame.

## Visual / physics audit (current state, May 2026)

Before designing v0.3.0 we audited the existing `MilkyWay.ts`
visualisation against real observation. Findings:

| Aspect              | Score   | Notes |
|---------------------|--------:|-------|
| Texture realism     | 4/10    | Procedural Gaussian noise — random dust lanes / knots don't match real Cygnus rift, Coalsack, H II regions |
| Resolution          | 5/10    | 2048×1024 = 6.3 arcmin/px; soft when zoomed |
| Colour              | 5/10    | Simple blue-warm gradient; no interstellar reddening |
| Galactic frame math | 3/10    | `rotation.set(0.515, 1.082, 0.345)` is empirically tuned, not derived |
| Physics depth       | 2/10    | No dust extinction, no 3D, no SgrA*-region structure |
| Andromeda / LMC / SMC | 0/10  | In `messier.json` as catalogue entries only — never rendered as visible billboards |
| 3D galactic model   | 0/10    | Doesn't exist — current MW is a sphere-interior backdrop, not a disk-from-outside |

The audit makes clear that v0.3.0 needs both a **texture upgrade** for
the existing observer-mode view *and* a **brand-new 3D model** for the
flythrough — these are different assets serving different views.

## Architecture

### Three "scale tiers" in a single camera state machine

The simulator already has three scale modes (real / log / schematic)
and two reference frames (heliocentric / geocentric). Galactic
flythrough adds a third dimension: **distance scale tier**.

```ts
type ScaleTier =
  | 'system'        // ≤ 100 AU      — current default
  | 'neighbourhood' // 1 ly – 100 ly — HYG cloud + named exoplanet hosts
  | 'galactic';     // > 100 ly      — Milky Way disk model
```

Camera transitions are continuous Catmull-Rom splines through these
tiers; a single update loop swaps which layers are visible based on
camera distance from origin.

### Layer visibility table

| Layer                | system | neighbourhood | galactic |
|---------------------:|:------:|:-------------:|:--------:|
| Sun + planets + moons| ✅     | ⚠️ fade out   | ❌       |
| Asteroid belt        | ✅     | ❌            | ❌       |
| Spacecraft / Halley  | ✅     | ❌            | ❌       |
| Lagrange overlay     | ✅     | ❌            | ❌       |
| HYG 3D point cloud   | ⚠️ dim | ✅            | ⚠️ fade  |
| Exoplanet host halos | ❌     | ✅            | ⚠️ fade  |
| Andromeda / LMC      | ✅ (background) | ✅    | ✅       |
| 3D Milky Way disk    | ❌     | ⚠️ fade in    | ✅       |
| Sky-projected MW     | ❌ (it's the inside view; only valid in observer mode) | | |

### Key new files

```
src/
  scene/
    GalacticDisk.ts          # NEW — 3D Milky Way disk + spiral arms + bulge
    HygCloud.ts              # NEW — point cloud of HYG stars in 3D
    AndromedaBillboard.ts    # NEW — M31 / LMC / SMC textured billboards
    ExoplanetHost.ts         # NEW — host-star halo + click target
  data/
    exoplanetSystems.ts      # NEW — Trappist-1, Proxima b, Kepler-186, etc.
  controls/
    ScaleTierController.ts   # NEW — system / neighbourhood / galactic
  physics/
    galacticFrame.ts         # NEW — J2000 ↔ galactic rotation matrix
public/
  textures/
    milkyway-eso-4k.jpg      # NEW — ESO Brunier panorama, CC BY 4.0
    milkyway-disk.png        # NEW — top-down disk, NASA art
    m31-galex.jpg            # NEW — Andromeda billboard
    lmc.jpg / smc.jpg        # NEW — Magellanic clouds
  stars-hyg-3d.json          # NEW — HYG with parallax → x/y/z
```

### HYG 3D upgrade

Current `stars-hyg.json`: 4 fields per star — `[raHours, decDeg, mag, packedColor]`. **No distance.**

For 3D positioning we need parallax. The original [HYG database
v3.51](https://github.com/astronexus/HYG-Database) has ~119k stars
with parallax → distance, plus spectral type. Add 2 fields:

```ts
[raHours, decDeg, mag, packedColor, distanceLy, spectralTypeId]
```

Estimated size: ~4.5 MB (vs current 2.5 MB). Acceptable for a one-time
fetch on `'neighbourhood'` tier entry, lazy-loaded.

For 3D position (in galactic-frame parsecs):

```ts
const dPc = distanceLy * 0.30660;
const raRad = raHours * 15 * DEG2RAD;
const decRad = decDeg * DEG2RAD;
const x = dPc * Math.cos(decRad) * Math.cos(raRad);
const y = dPc * Math.cos(decRad) * Math.sin(raRad);
const z = dPc * Math.sin(decRad);
// Then rotate equatorial → ecliptic via existing frame.ts
```

### Camera state machine

```ts
class ScaleTierController {
  current: ScaleTier;
  setTier(target: ScaleTier, durationSec = 4): void;
  // Animates camera position + zoom along a spline; updates layer
  // visibility from the table above based on interpolated distance.
}
```

Single transition curve (Catmull-Rom, 4 control points):

| Tier             | Camera distance | Camera FoV |
|-----------------:|----------------:|-----------:|
| system           | 5 AU            | 45° |
| neighbourhood    | 80 ly           | 60° |
| galactic         | 100 kly         | 75° |

Animation duration target: 4–6 s for full out-trip, with ease-in-out
cubic on distance. User can interrupt at any point.

## Featured exoplanet systems (~12 to start)

Curated for visual / educational impact. All elements from
[NASA Exoplanet Archive](https://exoplanetarchive.ipac.caltech.edu/).

| Host star        | Distance | Planets | Why it's here |
|:-----------------|:--------:|:--------|:--------------|
| Trappist-1       | 40.7 ly  | 7       | **Showcase** — 7 Earth-sized inside Mercury's orbit; resonance chain |
| Proxima Centauri | 4.24 ly  | 3       | Closest exoplanet host to Sol |
| α Centauri A/B   | 4.37 ly  | (1)     | Binary system; Toliman target |
| Kepler-186       | 580 ly   | 5       | First Earth-sized in habitable zone |
| Kepler-90        | 2,840 ly | 8       | Tied with Sol for most planets |
| Kepler-452       | 1,400 ly | 1       | "Earth's older cousin" |
| TOI-700          | 100 ly   | 4       | TOI-700e habitable zone, TESS discovery |
| 51 Pegasi        | 50 ly    | 1       | First confirmed exoplanet (1995) |
| HD 209458        | 154 ly   | 1       | First transit detection |
| WASP-12          | 1,400 ly | 1       | Hot Jupiter being shredded |
| LHS 1140         | 49 ly    | 2       | Two super-Earths, JWST target |
| GJ 1214          | 47 ly    | 1       | First mini-Neptune characterised |

Each system shares the existing `BodyDescriptor` schema:

```ts
const TRAPPIST_1: BodyDescriptor = {
  id: 'trappist-1',
  name: 'TRAPPIST-1',
  nameEn: 'TRAPPIST-1',
  parentId: null,        // top-level (its own system)
  category: 'star',
  physical: {
    radiusKm: 84_300,    // 0.121 R☉
    massKg: 1.79e29,     // 0.0898 M☉
    rotationPeriodDays: 3.295,
    axialTiltDeg: 0,
  },
  propagator: null,      // host doesn't move at this view
  appearance: { color: 0xff5b3a, emissive: true /* M-dwarf */ },
  // … plus distance + RA/Dec from the system metadata
};

const TRAPPIST_1_b: BodyDescriptor = {
  id: 'trappist-1-b',
  parentId: 'trappist-1',
  category: 'planet',
  physical: { radiusKm: 7_148, massKg: 8.21e24, ... },
  propagator: new KeplerPropagator({
    a: 0.01154, e: 0.00622, iDeg: 89.728,
    LDeg: 0, LDotDeg: (360 / 1.5108) * 36525, // P = 1.5108 d
    varpiDeg: 336.86, OmegaDeg: 0,
    periodDays: 1.5108,
  }, NASA_EXOPLANET_ARCHIVE),
  appearance: { color: 0x9ba3b0 },
};
// … b/c/d/e/f/g/h
```

The existing renderer / orbit-line / N-body / Lagrange code paths all
"just work" for any `BodyDescriptor` — they don't care that the parent
is a star other than the Sun.

## Texture sourcing & licensing

| Asset | Source | Licence | Notes |
|-------|--------|---------|-------|
| ESO Brunier MW panorama | [eso0932a](https://www.eso.org/public/images/eso0932a/) | CC BY 4.0 | Resample to 4096×2048 (~6 MB JPG) |
| MW disk top-down art | [NASA SVS](https://svs.gsfc.nasa.gov/30587) or [ESA / GAIA](https://sci.esa.int/web/gaia) | Public domain / CC BY | Used as the spiral disc texture |
| M31 GALEX UV | [NASA GALEX](https://www.galex.caltech.edu) | Public domain | ~3°×1° billboard |
| LMC / SMC | [ESO La Silla photos](https://www.eso.org) | CC BY 4.0 | Visible from southern hemisphere only |

All attributions go into `README.md` and `LICENSE` under the
"Third-party assets" table — same pattern as our existing texture
credits.

## Performance budget

Currently 60 fps on M-series Macs at full quality. New layer cost:

| Layer | Add cost |
|------:|----------|
| HYG 3D cloud (~120k points, instanced sprite) | ~4 ms / frame on M1 |
| 3D MW disk (single mesh, 2K texture) | ~0.5 ms |
| Exoplanet system scene (12 systems × ~7 bodies) | only one active at a time → negligible |

Total expected: **+5 ms / frame at neighbourhood tier**, no impact at
system tier (HYG cloud invisible / culled).

## Risk register

| Risk | Likelihood | Mitigation |
|------|:----------:|-----------|
| HYG 3D recompile is slow / large | Medium | Lazy-load on first `setTier('neighbourhood')` |
| Exoplanet inclination data sparse | High | Default to 90° if unknown (most are transit detections — face-on impossible by definition) |
| Trappist-1 visual cluttered (7 orbits in tiny range) | Medium | Special-case: zoom in to 0.1 AU on system entry |
| Galactic disk artistic vs scientific | Low | Use NASA artist concept (Robert Hurt 2008 or newer); everyone in the field uses this |
| Camera "lost" between tiers | Medium | Always offer a "🏠 home" key (`H`) that snaps back to system tier on Earth |

## Implementation order (rough)

1. ✅ Tier 1 visual polish (texture + galactic frame math) — 1 day
2. Camera scale-tier controller + transitions — 2 days
3. HYG 3D point cloud (data recompile + render) — 2 days
4. 3D Milky Way disk model — 2 days
5. Exoplanet system data file (12 systems) — 2 days
6. ExoplanetHost halo + click-to-fly handler — 1 day
7. Andromeda + LMC + SMC billboards — 1 day
8. Polish, i18n keys for new UI strings, integration test — 2 days

Total: **~13 days** (with buffer for Trappist-1 visual tuning and
HYG download UX).

## Out of scope (deferred)

- Real interstellar dust extinction maps (Schlegel-Finkbeiner-Davis)
- Gaia DR3 full catalogue (1.8 billion sources) — way too big for web
- Galactic rotation simulation (would need dark-matter halo physics)
- Exoplanet transit visualisation (light-curve overlay)
- Habitable-zone shading per host star
- "Land on planet" surface view

These are good v0.4.0+ topics if the project keeps building momentum.
