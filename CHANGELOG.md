# Changelog

All notable changes to this project are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/);
versions roughly follow [SemVer](https://semver.org/) once we hit 1.0.

## [0.9.0] – 2026-06-12

Hardening + correctness release. No new headline feature — instead a
broad pass on production-readiness, accessibility, supply-chain hygiene,
and the kind of "every number is traceable" honesty the project is about.

### Added
- **Live satellite TLEs**: the satellite layer now fetches each object's
  current element set from CelesTrak at runtime (`SatelliteLayer.refreshFromCelesTrak`)
  instead of drawing fabricated placeholders. Bundled real snapshots are
  the offline fallback.
- **Production API proxies**: Vercel edge functions `api/horizons.ts` +
  `api/tle.ts` so the JPL Horizons feature (dev-only Vite proxy before)
  and the TLE fetch work in production.
- **WebGL availability guard**: a browser/GPU without WebGL now shows an
  explained, localized message instead of hanging on the loader.
- **Accessibility**: `prefers-reduced-motion` support, keyboard-focusable
  `<button>` close controls, `role="dialog"` + Escape on the mobile sheet,
  a canvas `aria-label`, and localized tooltips on icon-only buttons.
- **SEO**: canonical link, JSON-LD `WebApplication`, `robots.txt`, `sitemap.xml`.
- **In-app CC BY attribution** for the planet textures + Milky Way panorama.
- **Tooling**: ESLint (flat config) + `npm run lint` in CI, Dependabot,
  `test:coverage`, CI least-privilege permissions, baseline security
  headers, and Subresource Integrity on the Leaflet CDN load.
- **Tests**: SimulationClock, jd↔date round-trip, eventScanner golden
  tests, exoplanet derivation, Bennett refraction, readout formatters,
  satellite.js contract (327 → 390).

### Changed
- Decomposed `main.ts` (2460 → ~1600 LOC) into `bootstrap/` modules
  (picking, readouts, atmosphericEffects, uiPersistence) + extracted pure
  helpers (readoutFormat, refraction).
- Deps: Three.js 0.170 → 0.184, Vite 5 → 8 (clears the esbuild dev-server
  advisory GHSA-67mh-4wv8-2f99), lil-gui 0.21, Vitest 4.1.8.
- Planet textures → WebP (−62%); HYG star positions rounded to 4dp
  (−176 KB gzip on the on-demand fetch).

### Fixed
- Lunar-position accuracy docstring corrected (~19″, not the claimed ~10″).
- Per-observer-frame `Matrix4.clone()` allocations removed.

## [0.8.0] – 2026-05-22

Observer-realism release. Makes the ground-based view physically faithful.

### Added
- **Hosek-Wilkie atmospheric scattering** sky shader (selectable vs Preetham),
  with coefficients interpolated across sun elevation.
- **Per-fragment planet-on-planet shadows** via sun-disc-vs-occluder
  geometry — real solar/lunar eclipse silhouettes, Galilean shadow transits.
- **Magnetic declination** (WMM to n=3) so the AR gyro compass shows true north.
- **Habitable-zone** classification + overlay (Kopparapu+2013) for exoplanet hosts.
- **IAU WGCCRE 2015 pole orientations** for all planets + Pluto (Saturn's
  rings now phase correctly).
- Meeus ch. 53 optical lunar libration, proper motion + annual aberration
  on named stars, solar + transit-penumbra limb darkening, chromatic
  stellar scintillation.

## [0.7.0] – 2026-05-17

Telescope + perturbation release.

### Added
- **INDI/ASCOM telescope bridge** (browser WS client): dome reticle +
  slew / sync / park with safety gates.
- **J2 oblateness** perturbation (Brouwer-Kozai secular decorator) wired
  into inner moons, with an N-body Sun-J2 toggle.

## [0.3.0] – 2026-05-10

Galactic flythrough release. Adds a smooth zoom-out from the solar
system through the local stellar neighbourhood to a 3D Milky Way disk
model, with 12 curated exoplanet host stars surfacing as clickable
halos along the way and a "land on TRAPPIST-1" scene-swap that drops
you into a real exoplanet system rendered with the same Kepler
mechanics as our own.

### Added
- **Scale-tier camera dolly** (`src/controls/ScaleTierController.ts`)
  with three nested distance scales (system / neighbourhood /
  galactic), logarithmic-time interpolation, mid-flight
  reparameterisation, and `G` / `Shift+G` / `H` keyboard shortcuts.
- **3D Milky Way disk** (`src/scene/GalacticDisk.ts`) — procedural
  4-arm logarithmic spiral + central bulge, ~38k point sprites,
  oriented from the IAU galactic-NP / galactic-centre vectors, the
  Sun placed at the actual 26 700 ly galactic radius.
- **HYG 3D point cloud** (`src/scene/HygCloud.ts`) — 15 167 stars
  within 10 000 ly and brighter than mag 7, in real 3D positions
  computed from HYG v4.1 parallax data. Lazy-loaded (~600 KB JSON).
- **12 curated exoplanet systems** (`src/data/exoplanetSystems.ts`) —
  Trappist-1, Proxima, α Centauri, Kepler-186/-90/-452, TOI-700,
  51 Pegasi, HD 209458, WASP-12, LHS 1140, GJ 1214 — full Kepler
  elements from NASA Exoplanet Archive + tri-lingual descriptions
  for every host and planet.
- **Exoplanet host halos** (`src/scene/ExoplanetHosts.ts`) —
  distance-tinted ring sprites + name labels, billboarded to the
  camera, clickable via the existing raycast pipeline.
- **Exoplanet scene swap** (`src/scene/ExoplanetSystemView.ts`) —
  click-to-land: hides the solar system and renders the chosen host
  + planets with real Kepler orbits using the moon-distance scale.
  Floating banner with "↩ Return to galaxy" reverses the swap.
- **ESO photographic Milky Way** — replaced the procedural
  Gaussian-noise dome with the ESO Brunier 4K panorama (CC BY 4.0).
  Procedural fallback retained for offline / texture-failed cases.
- **Real galactic frame math** (`src/physics/galacticFrame.ts`) —
  standard IAU rotation matrix replacing the previous
  empirically-tuned Euler triple. 8 unit tests.

### Changed
- OrbitControls maxDistance bumped 50 000 → 200 000 to support
  galactic-tier camera distance.
- Panel transparency: `--panel-bg` 0.82 → 0.55 with 20 px backdrop
  blur + saturate(140 %); panels lift back to 0.78 on hover for
  legibility.
- InfoPanel gains a "🔬 Physics under the hood" collapsible section
  showing each body's propagator type, J2000 elements, current
  state vector, and a link to the original NASA / JPL data source.

### Tests
- 236 passing (previously 221). New unit tests for galactic-frame
  rotations and scale-tier transitions.

## [0.2.0] – 2026-05-10

### Added
- **Lagrange point visualisation (L1–L5)** for three two-body systems:
  Sun–Earth (JWST / SOHO / DSCOVR home), Sun–Jupiter (Trojan camps),
  and Earth–Moon (Queqiao relay). Solver uses Newton–Raphson on Hill's
  collinear equations plus closed-form L4/L5 geometry. Toggle from
  顯示 (Display) panel.
- **Jupiter Trojan asteroids**: Achilles, Hektor (Lucy 2027 target),
  Patroclus (Lucy 2033 target), Eurybates — physically populating the
  L4 / L5 swarms.
- **Additional NEOs / interesting bodies**: Phaethon (Geminids parent,
  DESTINY+ target), Icarus, Ganymed (largest known near-Earth asteroid).
- **CHANGELOG.md** for traceable release history.

### Changed
- Removed Buy Me a Coffee link from footer and SUPPORT.md (Stripe
  Connect doesn't support Taiwan-resident creators without a US
  address). GitHub Sponsors application now in review as the
  replacement.

### Tests
- 8 new unit tests for `physics/lagrange.ts` covering Sun–Earth Hill
  radius, Sun–Jupiter Trojan geometry, and arbitrary frame orientation.
  Total: 221 → 229 passing.

## [0.1.0] – 2026-05-04

Initial public release.

### Highlights
- 3D solar system with Sun + 8 planets + 5 dwarfs + major moons +
  asteroid belt + Kuiper belt.
- J2000 Kepler propagation (`physics/keplerPropagator.ts`) with N-body
  Velocity-Verlet / Yoshida4 symplectic integrator alternative
  (`physics/nbody.ts`) for perturbation studies.
- Observer mode: tonight-plan, eclipse maps (solar + lunar), star
  catalogues (BSC + HYG), Messier objects, IAU 88 boundaries, meteor
  shower radiants, zodiacal light, Milky Way model, atmospheric
  scattering and extinction, Chinese 28 lunar mansions.
- Spacecraft trajectories: Voyager 1, JWST, New Horizons, Parker Solar
  Probe (sampled from JPL Horizons).
- LEO satellite layer (lazy-loaded) with TLE-driven SGP4 via
  satellite.js — ISS, Hubble, Tiangong, Starlink samples.
- Comet tails for Halley + others.
- Three scale modes (real / log / schematic) and two reference frames
  (heliocentric / geocentric).
- Time slider, event scanner (planet alignments, eclipses, peri-helia),
  historical-event jumps (Apollo 11, Voyager launch, Shoemaker-Levy 9,
  great conjunctions, etc.).
- PWA-installable; bilingual UI 繁中 / English / 日本語.
