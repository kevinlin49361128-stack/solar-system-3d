# Show HN — submission draft

Updated for **v0.3.0** — galactic flythrough + click-to-land
exoplanet systems. Save and tweak before posting.

---

## Title (≤ 80 chars)

**Recommended (76 chars):**
```
Show HN: Solar system that flies you out to TRAPPIST-1 and back, real Kepler
```

**Alternative — galactic-zoom hook:**
```
Show HN: Click any of 12 exoplanet hosts in a 3D galaxy, land in real Kepler
```

**Alternative — Trojan / unique angle (if "TRAPPIST-1" feels too narrow):**
```
Show HN: Solar system simulator that scales out from AU to kly to galaxy
```

**Alternative — narrative hook:**
```
Show HN: I built a solar system you can fly out of and into other systems
```

I'd lead with **#1** — it's specific, names a recognisable target
(JWST has been all over the news for TRAPPIST-1), and the "real
Kepler" tag signals to the technical crowd this isn't a faked
animation.

---

## First comment (post immediately after the submission)

> Hi HN, this started as a frustration that almost every "interactive
> solar system" online either fakes the orbital mechanics (planets in
> perfect circles) or hides the actual physics behind a polished UI.
> So I built one where everything is real and exposed — and where you
> can fly out of the solar system entirely.
>
> The headline feature: hit `G` and the camera dollies out from the
> AU-scale solar system through the local 50-light-year neighbourhood
> (HYG catalogue, 15k stars in real 3D positions) to a 3D Milky Way
> disk model (~38k point sprites in a 4-arm log spiral). Twelve named
> exoplanet host stars surface as clickable halos along the way.
> Click TRAPPIST-1 and the scene swaps: 7 Earth-sized planets render
> around an M8 dwarf using the exact same Kepler-equation solver as
> our Sun's planets — orbital elements piped straight from NASA
> Exoplanet Archive. `↩` returns to the galaxy view, `H` snaps home.
>
> The rest:
>
> - All 9 of *our* bodies + major moons + Halley + Trojans use J2000
>   Keplerian elements straight from NASA JPL, with Kepler's equation
>   solved by Newton–Raphson each frame (so perihelion really is
>   faster — not a hand-tuned constant).
> - One-click switch from the analytic Kepler propagator to a Velocity
>   Verlet / Yoshida 4th-order symplectic N-body integrator, so you
>   can watch perturbations build up over centuries.
> - **Lagrange points L1–L5 computed live from current body positions**
>   for Sun–Earth, Sun–Jupiter, and Earth–Moon. Toggle them on, follow
>   Jupiter, and you can actually see Achilles / Hektor / Patroclus /
>   Eurybates parked at the L4 and L5 swarms.
> - **Click any body and a "Physics under the hood" panel reveals the
>   exact propagator, the J2000 elements (a, e, i, Ω, ω), the live
>   state vector at the current JD, and a link straight to the JPL
>   data source** — no magic numbers.
> - Eclipse maps (solar + lunar umbra/penumbra paths), spacecraft
>   trajectories sampled from JPL Horizons (JWST, Voyager 1, Parker
>   Solar Probe, New Horizons), comet tails, observer mode with
>   atmospheric extinction, IAU 88 boundaries, BSC + HYG star
>   catalogues, three scale modes, helio/geocentric frame switch.
> - Milky Way background uses the ESO Brunier photographic panorama
>   (CC BY 4.0) oriented from the IAU galactic-frame rotation matrix
>   — Cygnus rift, Sgr A\*, Carina nebula all line up properly.
> - Fully trilingual UI: 繁體中文 / English / 日本語 — including
>   data-row labels, eclipse-contact times, propagator descriptions,
>   per-body notes, and the scale-tier banner.
>
> Stack is plain Three.js + TypeScript + Vite. The orbit math is
> deliberately not abstracted to a black box — see `src/physics/*`
> for Kepler's equation, the J2000 transforms, the Yoshida4 step,
> the Lagrange Newton–Raphson solver, and the IAU galactic-frame
> matrix. MIT licensed.
>
> Demo: https://solar-system-3d-pi.vercel.app/  (PWA-installable)
> Repo: https://github.com/kevinlin49361128-stack/solar-system-3d
>
> Built on weekends. Roadmap is whatever I'm curious about next —
> recently shipped Lagrange points, click-through physics
> transparency, and the galactic flythrough; eyeing planet-on-planet
> shadows, Andromeda + Magellanic Cloud billboards, and a habitable-
> zone overlay for exoplanet hosts. Feedback / nitpicks / "you got
> the inclination wrong on Kepler-90 i" all welcome.

---

## Submission timing

Best window: **US-Eastern Tuesday/Wednesday/Thursday 7:00–9:00 AM**
(= **Taiwan 19:00–21:00**). Avoid weekends — front-page rotation is
much slower; even a strong post can get buried.

Don't double-submit; HN penalises rapid resubmissions.

---

## Likely follow-up questions and the answers

| Question | Short answer |
|---|---|
| "How accurate are the exoplanet orbits?" | Orbital periods, semi-major axes, and eccentricities are direct NASA Exoplanet Archive values. Inclination defaults to 89° for transit-detected planets (the discovery method requires near-edge-on geometry); ω/Ω default to 0 where unconstrained. |
| "Why Yoshida4 over RK4?" | Symplectic — preserves energy / phase-space volume over long integrations. RK4 drifts visibly after a few centuries on Mercury. |
| "How accurate is the JPL Approximate Positions data?" | Quoted as < 600 km position error over 1800–2050. Citation in the README. |
| "Are the Lagrange points instantaneous or averaged?" | Recomputed every frame from the current two-body separation, so the L4/L5 markers actually orbit with the secondary. |
| "How does the HYG cloud handle scale?" | 15 167 stars under mag 7 within 10 kly, positioned in light-years (1 scene unit = 1 ly at neighbourhood tier). The solar-system Group hides at this tier so AU-scale meshes don't fight the ly-scale star positions. |
| "Where did you get the textures?" | Solar System Scope (planets) and ESO/Brunier "GigaGalaxy Zoom" (Milky Way), both CC BY 4.0; attributed in `LICENSE-CONTENT.md` and the README. |
| "Performance on integrated GPUs?" | Solid 60 fps on M-series Macs at full quality. On older Intel iGPUs disable the asteroid belt instancing and the zodiacal light overlay; both are independent toggles in the Display panel. |
| "Why not a Gaia DR3 full catalogue?" | 1.8 billion sources is too big for a web demo; HYG's 15 k mag-7 selection is the actual visual content of the night sky. Gaia integration is on the longer roadmap if anyone is willing to host the LOD pyramid. |

---

## Companion images for the comment

Three screenshots to attach (recommend [imgur](https://imgur.com)):

1. **TRAPPIST-1 system close-up after the scene swap** — 7 planets in
   compact orbits around the red M-dwarf host. The narrative climax
   image: nothing else in the demo space looks like this.
2. **Galactic neighbourhood with the 12 host halos visible** — the
   "you didn't know your galaxy looked like this" shot.
3. **Jupiter follow view with Lagrange overlay on** — leans into the
   v0.2.0 Trojan-camp story for technical readers.

Re-run the og-image pipeline (`npm run og:capture`) to refresh the
OpenGraph thumbnail before posting — the link unfurl in HN's inline
preview matters disproportionately.

---

## Cross-posts (after HN, in order of likely engagement)

1. **r/threejs** — they appreciate clean Three.js code; link the
   repo. Lead with a 30-second screen recording of the G → land on
   TRAPPIST-1 → return flow.
2. **r/space** — visual / educational, broad audience. Lead with the
   TRAPPIST-1 close-up GIF.
3. **r/exoplanets** — small but extremely on-target.
4. **r/spaceporn** — pure visual. Best companion: an Earth–Moon L1
   close-up still or the spiral-arm galactic-tier still.
5. **Twitter / X** — tag `@nasa` `@esa` `@brunosimonzz`,
   `@JWSTObserver`, and at least one astronomy popularizer
   (Phil Plait / Dr. Becky / Sarafina El-Badry Nance).
6. **Bluesky** — astronomy academia has migrated here; less noise
   than Twitter. Tag `#exoplanets` `#astronomy`.
7. **Mastodon** (`mastodon.social`, `astrodon.social`) — also where
   a lot of professional astronomers ended up.
8. **PTT NASA / sci** — Taiwan astronomy community. Repost in
   zh-Hant since the UI is fully translated.

Wait at least 24 h between platforms so trickle traffic doesn't blow
out the Vercel free tier (which is 100 GB / month).
