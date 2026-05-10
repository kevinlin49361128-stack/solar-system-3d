# Show HN — submission draft

Final version after the Lagrange / Trojans / physics-transparency / i18n
sweeps. Save and tweak before posting.

---

## Title (≤ 80 chars)

**Recommended (70 chars):**
```
Show HN: 3D solar system that visualizes why Trojan asteroids cluster where they do
```

**Alternative — technical hook:**
```
Show HN: Solar system simulator with real Kepler dynamics and live Lagrange points
```

**Alternative — narrative hook:**
```
Show HN: I built a solar system that lets you watch JWST drift around L2
```

---

## First comment (post immediately after the submission)

> Hi HN, this started as a frustration that almost every "interactive
> solar system" online either fakes the orbital mechanics (planets in
> perfect circles) or hides the actual physics behind a polished UI.
> So I built one where everything is real, exposed, and clickable.
>
> Highlights:
>
> - All 9 bodies + major moons + Halley + Trojans use J2000 Keplerian
>   elements straight from NASA JPL, with Kepler's equation solved by
>   Newton–Raphson each frame (so perihelion really is faster — not a
>   hand-tuned constant).
> - One-click switch from the analytic Kepler propagator to a Velocity
>   Verlet / Yoshida 4th-order symplectic N-body integrator, so you can
>   watch perturbations build up over centuries.
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
>   catalogues (~160k stars), three scale modes, helio/geocentric
>   frame switch.
> - Fully trilingual UI: 繁體中文 / English / 日本語 — including all
>   data-row labels, eclipse-contact times, propagator descriptions,
>   and per-body notes.
>
> Stack is plain Three.js + TypeScript + Vite. The orbit math is
> deliberately not abstracted to a black box — see `src/physics/*` if
> you want to read how Kepler's equation, the J2000 transforms, the
> Yoshida4 symplectic step, or the Lagrange Newton–Raphson solver
> are wired up. MIT licensed.
>
> Demo: https://solar-system-3d-pi.vercel.app/  (PWA-installable)
> Repo: https://github.com/kevinlin49361128-stack/solar-system-3d
>
> Built on weekends. Roadmap is just whatever I'm curious about next —
> recently shipped Lagrange points and physics transparency, eyeing
> planet-on-planet shadows and historical event time-jumps next.
> Feedback / nitpicks / "you got the Trojan inclination wrong" all
> welcome.

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
| "Why Yoshida4 over RK4?" | Symplectic — preserves energy / phase-space volume over long integrations. RK4 drifts visibly after a few centuries on Mercury. |
| "How accurate is the JPL Approximate Positions data?" | Quoted as < 600 km position error over 1800–2050. The README has the citation. |
| "Are the Lagrange points instantaneous or averaged?" | Recomputed every frame from the current two-body separation, so the L4/L5 markers actually orbit with the secondary. |
| "Where did you get the textures?" | Solar System Scope, CC BY 4.0 — attributed in the README and the LICENSE file. |
| "Does it handle non-Earth observer modes?" | Right now observer mode is locked to Earth. Mars / Moon observer is on the roadmap but is not trivial because the atmospheric extinction and twilight code is Earth-specific. |
| "Performance on integrated GPUs?" | Solid 60 fps on M1 Air. On older Intel integrated GPUs you may want to disable the asteroid belt instancing (toggle in the Display panel) and the zodiacal light overlay. |

---

## Companion images for the comment

Three screenshots to attach (recommend [imgur](https://imgur.com)):

1. **Jupiter follow view with Lagrange overlay on** — L4 / L5 visible
   60° leading and trailing, with the Trojan dots clustered around
   them. This is the showpiece — most demos don't have this at all.
2. **JWST tracking Sun–Earth L2** — recognisable to a wide audience.
3. **2024-04-08 total solar eclipse path map** — visually striking,
   establishes "this app does real geometry".

Re-run the og-image pipeline (`npm run og:capture`) with the
Lagrange overlay enabled to refresh the OpenGraph thumbnail before
posting — the link unfurl in HN's inline preview matters.

---

## Cross-posts (after HN, in order of likely engagement)

1. **r/threejs** — they appreciate clean Three.js code; link the repo.
2. **r/space** — visual / educational, broad audience. Lead with a GIF.
3. **r/spaceporn** — pure visual. Ideal companion: an Earth–Moon L1
   close-up still.
4. **Twitter / X** — tag `@nasa` `@esa` `@brunosimonzz` (Three.js)
   and at least one astronomy popularizer (Phil Plait / Dr. Becky).
5. **Bluesky** — astronomy academia has migrated here; less noise
   than Twitter.
6. **Mastodon** (`mastodon.social`, `astrodon.social`) — also where a
   lot of pro astronomers ended up.
7. **PTT NASA / sci** — Taiwan astronomy community; small but engaged.
   Repost in zh-Hant since the UI is fully translated.

Wait at least 24 h between platforms so trickle traffic doesn't blow
out the Vercel free tier (which is 100 GB / month).
