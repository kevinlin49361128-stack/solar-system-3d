# Hosek-Wilkie atmosphere shader — future work

> Status: deferred. Current implementation uses Three.js's vanilla Preetham
> Sky with sun-altitude-dependent turbidity / rayleigh tuning as a cheap
> approximation (see `AtmosphereSky.applyTwilightTuning`).

## What's missing

Three.js's `Sky` ships only the [Preetham 1999](https://www.cs.utah.edu/~shirley/papers/sunsky/sunsky.pdf) model. Its known weaknesses:

1. **Twilight band is too abrupt.** Real twilight has a smooth gradient from civil (0° to −6° sun altitude) through nautical (−6° to −12°) to astronomical (−12° to −18°). Preetham draws an oversaturated red band right around 0° altitude that disappears too quickly.
2. **Turbidity is poorly parameterised** — values that work at noon look murky at sunset and vice versa. Our `applyTwilightTuning` mitigates by remapping turbidity dynamically, but it's a workaround.
3. **No spectral extension** — Preetham uses 3-channel RGB internally; Hosek-Wilkie's 9-spectrum coefficients give better wide-gamut and HDR performance, especially relevant if we ever do photographic-style exposure simulation.

## Why deferred

Full Hosek-Wilkie is a large drop-in:

- **The data tables are big.** The official Hosek-Wilkie model ships hundreds of polynomial coefficients per channel. Implementations like [tomas-hubelbauer/hosek-wilkie-shader](https://github.com/cgapps/hosek-wilkie) or [SwiftShader's port](https://github.com/google/swiftshader) total ~500–1000 lines just for the LUT.
- **No mature WebGL Three.js port exists** with permissive license at the time of writing. The Mitsuba renderer's reference C++ implementation is GPL — we'd have to re-derive from the [paper](https://cgg.mff.cuni.cz/projects/SkylightModelling/) and CIE fits.
- **Diminishing returns vs effort.** Most of the visual improvement we wanted from Hosek-Wilkie came from the up-uniform fix (already done) and the dynamic turbidity tuning. Full HW would refine the twilight gradient further but isn't load-bearing for the educational / personal-observation use case.

## What would shipping it look like

1. Vendor or re-derive the HW polynomial coefficient tables (~3 KB).
2. Write a custom `ShaderMaterial` replacing Three's Sky shader. Vertex same; fragment uses HW evaluation: 9 spectral basis × dot(view, sun) × dot(view, up) → channel intensities → tone-mapped sRGB.
3. Sun disc rendering still done via mie scattering term; HW handles aureole correctly.
4. Hook `up` uniform identically to current Sky for arbitrary observer zenith.
5. Match outputs to current Three Sky scale so `setVisible` / `setCenter` / `setSunDirection` API unchanged — `AtmosphereSky` becomes a thin wrapper either way.

Estimated effort: ~1 day of focused implementation + ~half-day tweaking against reference photos at typical scenarios (golden hour, civil twilight, full moon night).

## Stop-gap that ships today

`AtmosphereSky.applyTwilightTuning(sunAltDeg)`:

- sun > +10°: vanilla daylight (turbidity 6, rayleigh 2.5)
- sun in [−6°, +10°]: blend toward dusk (turbidity 3, rayleigh 3.5 at horizon)
- sun < −6°: dim atmosphere (turbidity 2.5, rayleigh 1.5) so stars show

This is cheap (uniform updates, no shader change) and visually noticeably smoother than fixed parameters at twilight. Stays as the default until a proper HW implementation lands.
