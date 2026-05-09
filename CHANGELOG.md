# Changelog

All notable changes to this project are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/);
versions roughly follow [SemVer](https://semver.org/) once we hit 1.0.

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
