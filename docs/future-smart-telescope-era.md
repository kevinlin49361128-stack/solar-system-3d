# Smart-telescope era — strategic positioning notes

Target reader: future-me when prioritising v0.5+ roadmap.

## The shift

Until ~2022 the amateur observer was visually limited (mag 5–7 naked
eye, mag 11–12 with a 4" refractor in a dark site). Catalogues built
for this audience — Messier (110), Caldwell (109) — emphasise large,
bright, visually-striking objects.

Smart telescopes (Seestar S50 / S30 Pro / S30, Vespera Pro / Vespera
II, Dwarf 3, Hestia, eVscope) flip that:

| Device         | Price     | Reach (30 min stack) | Plate scale  |
|----------------|-----------|----------------------|--------------|
| Seestar S30    | $350      | mag ~15.5            | 1.6° × 0.9°  |
| Seestar S50    | $500      | mag ~15.5            | 1.3° × 0.7°  |
| Vespera Pro    | $2,800    | mag ~16              | 2.5° × 1.5°  |
| Dwarf 3        | $500      | mag ~15              | 1.3° × 0.9°  |

A few consequences for an app that wants to be useful to this crowd:

1. **Bortle is less binding.** Live stacking + light-pollution filters
   (e.g. Optolong L-eXtreme, IDAS NBZ) defeat suburban skies for
   emission-line objects. Our current "is tonight a go" should keep
   Bortle as a slider but lead with **surface-brightness + altitude**
   for smart-scope planning.

2. **Messier is the wrong primary catalogue.** A Vespera user who's
   already imaged M31, M42, M51 wants NGC 7000, NGC 891, Sharpless
   nebulae, Abell galaxy clusters — objects mag 13–16 that traditional
   visual catalogues skip. **NGC (~7800 entries) + Sharpless 2 (~313)
   should join Messier + Caldwell at v0.5.**

3. **Apparent angular size matters more than magnitude.** The Veil
   Nebula NGC 6960 is huge (~3°) but its surface brightness is so
   low that visual observers need narrowband filters; smart scopes
   nail it in 20 min. The InfoPanel should surface
   **surface brightness in mag/arcsec²** + **apparent extent (arcmin
   × arcmin)** more prominently than visual magnitude alone.

4. **FOV matching.** "Is this object good for my Seestar tonight?"
   means "does it fit in 1.3° × 0.7°?". Our optical-presets section
   should grow a **Smart Telescope** group:
   - Seestar S30: 1.6° × 0.9° @ 150mm f/5
   - Seestar S50: 1.3° × 0.7° @ 250mm f/5
   - Vespera Pro: 2.5° × 1.5° @ 250mm f/5
   - Dwarf 3: 1.3° × 0.9° @ 100mm f/4

5. **Integration time as a planning unit.** Instead of just "tonight
   from 22:00 to 02:00", smart-scope users want
   *"M31 needs 40 min · NGC 891 needs 90 min · what fits in my window?"*
   This is the **"observation queue"** feature concept.

6. **Live data overlays.** Ambitious but doable: a "what does my
   Seestar see tonight" mode that pre-renders the stacked-preview-
   style appearance (RGB + Hα filter simulation) so users can plan
   targets without lugging the scope outside.

## v0.5+ feature ideas, sized

| Feature                              | Effort | ROI       | Notes |
|--------------------------------------|--------|-----------|-------|
| NGC catalogue overlay                | 5 h    | ⭐⭐⭐⭐⭐ | ~7800 obj; bundle ~600 KB JSON; cluster at low zoom |
| Sharpless 2 emission nebula catalogue| 3 h    | ⭐⭐⭐⭐   | 313 obj; smart-scope sweet spot |
| Abell galaxy / cluster catalogue     | 4 h    | ⭐⭐⭐    | 4073 clusters; for deep-imaging crowd |
| Surface brightness column in InfoPanel| 1 h   | ⭐⭐⭐⭐   | Mostly data; ~5 min UI |
| Smart-telescope FOV presets          | 2 h    | ⭐⭐⭐⭐⭐ | Match Seestar/Vespera/Dwarf rectangles to existing FOV overlay |
| Object's apparent size vs FOV preview| 2 h    | ⭐⭐⭐⭐   | "Will fit" / "won't fit" badge |
| Stacked-preview mode (RGB / Hα sim)  | 8 h    | ⭐⭐⭐    | Visual cred for the crowd; lots of asset work |
| Observation queue (tonight's plan)   | 6 h    | ⭐⭐⭐⭐   | Drag-order + per-target integration estimate |
| Filter wheel simulator               | 4 h    | ⭐⭐      | Niche; only Vespera Pro / paid filter users |
| Live INDI / ASCOM integration        | 12 h+  | ⭐⭐⭐    | Wire to actual scope; v0.6+ topic |

## Positioning lever

The repo's tagline is currently:
> "Click any of 12 exoplanet hosts in a 3D galaxy, land in real Kepler"

That's the climax / Show-HN hook. For v0.5+ we add a second tagline
that recognises the smart-scope crowd:

> "Plan your Seestar / Vespera session: NGC + Sharpless catalogues,
> per-device FOV, surface-brightness-first ranking, integration-time
> estimates."

The two audiences don't conflict — the "land on TRAPPIST-1" climax
sells to general HN; the smart-scope planner converts them into
returning users.

## Out of scope

- Becoming a competitor to Stellarium Plus / SkySafari Pro 8
  (paid apps with 10 years of catalogue work). We stay free, open,
  focused on the "explanatory" angle (you can always click into the
  physics) and the smart-scope era polish.
- Direct camera control (INDI / ASCOM): genuinely belongs in a
  desktop app, not the browser. We can mirror state via a small
  WebSocket bridge later but the imaging UI stays out.
- Stacking the user's own subs in-browser: WebGPU could do it but
  the engineering / colour-pipeline cost dwarfs the value.
