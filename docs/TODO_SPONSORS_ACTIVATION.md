# GitHub Sponsors — activation checklist

**Status**: waiting on GitHub Sponsors approval email for
`kevinlin49361128-stack`.

When the approval email arrives, work through this file top-to-bottom.
Everything that follows is pre-written and validated; the activation
is a copy + commit + push, ~30 minutes total.

---

## Decided plan

**Tier ladder (5× geometric)**

| Tier | Monthly | One-time |
|---|---|---|
| 🌟 Stargazer | $1 | $5 |
| 🔭 Observer | $5 | $25 |
| 🏛️ Observatory | $25 | $100 |

Rationale: $1 monthly is GitHub Sponsors' floor and maximises
"click without thinking" small donations. 5× geometric jumps are
intuitive ("each tier is meaningfully more"). $25/mo top ($300/yr)
is comfortable for hobby observers; $100 one-time fits schools /
astronomy clubs without pretending to be an enterprise sponsor.

**No exclusive features per tier.** All sponsors get the same MIT-
licensed app. Rewards are recognition-only — protects the open-
source story and avoids fragmenting users.

---

## Step 1 — Create `.github/FUNDING.yml` (5 min)

Create the file `/Users/kevinlin/太陽系模擬/.github/FUNDING.yml`
with exactly this content:

```yaml
# Enables the 💜 Sponsor button on the GitHub repo page and on
# Issues / PRs. Once committed, GitHub auto-renders the button
# linking to https://github.com/sponsors/kevinlin49361128-stack
github: [kevinlin49361128-stack]
```

Verify after pushing: visit
https://github.com/kevinlin49361128-stack/solar-system-3d and
confirm the "Sponsor" button appears at the top of the repo.

---

## Step 2 — Update `SUPPORT.md` (5 min)

Replace the `## ☕ 小額贊助` section's placeholder text with:

```markdown
## ☕ 小額贊助

[![GitHub Sponsors](https://img.shields.io/github/sponsors/kevinlin49361128-stack?style=flat-square&logo=github&logoColor=white&label=Sponsor&color=ea4aaa)](https://github.com/sponsors/kevinlin49361128-stack)

如果這個專案對你有用、且你的預算允許，可以透過
[GitHub Sponsors](https://github.com/sponsors/kevinlin49361128-stack)
小額贊助。三種等級：

| Tier | 月 | 一次性 |
|---|---|---|
| 🌟 Stargazer | $1 | $5 |
| 🔭 Observer | $5 | $25 |
| 🏛️ Observatory | $25 | $100 |

**沒有任何付費限定功能** —— 所有贊助者跟所有免費使用者拿到完全
相同的 MIT 授權版本。贊助回饋是純粹的「致謝」: CONTRIBUTORS.md
留名 / About 面板列名 / release notes 致謝 / issue 優先回覆。

也歡迎不贊助 — `Star` + 分享給天文社群朋友就是對作者很棒的支持。
```

And in the English section at the bottom, replace the `donation
link will be added` line with:

```markdown
Donations welcome (but never required) via
[GitHub Sponsors](https://github.com/sponsors/kevinlin49361128-stack).
Three tiers: Stargazer ($1/mo), Observer ($5/mo), Observatory
($25/mo). No paywalled features — sponsors and free users get the
same MIT-licensed build, always. Sponsorship rewards are
recognition-only: name in CONTRIBUTORS, listing in the About
panel, acknowledgement in major release notes.
```

---

## Step 3 — Add Sponsor badge to README (3 min)

Edit the top of `README.md`, immediately after the `> 🇹🇼 中文 ·
🇺🇸 English · 🇯🇵 日本語` line, add:

```markdown
[![GitHub Sponsors](https://img.shields.io/github/sponsors/kevinlin49361128-stack?style=flat-square&logo=github&logoColor=white&label=Sponsor&color=ea4aaa)](https://github.com/sponsors/kevinlin49361128-stack)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](https://opensource.org/licenses/MIT)
[![Tests](https://img.shields.io/badge/tests-236%20passed-success?style=flat-square)](https://github.com/kevinlin49361128-stack/solar-system-3d/actions)
```

---

## Step 4 — Configure tiers on github.com/sponsors (15 min)

This is done in the GitHub web UI, not in code. Go to:
https://github.com/sponsors/kevinlin49361128-stack/dashboard/tiers

### Tier 1 — 🌟 Stargazer

- **Monthly**: $1
- **One-time**: $5 (configure as a separate one-time tier)
- **Description** (paste verbatim):

```
☕ Thank you! Your name goes in CONTRIBUTORS.md, and your GitHub
avatar appears in the README's supporters wall.

The simulator stays MIT-licensed, all features remain free for
everyone — this tier is recognition, not access.
```

### Tier 2 — 🔭 Observer

- **Monthly**: $5
- **One-time**: $25
- **Description**:

```
Everything in Stargazer, plus:
  • Your name listed in the in-app About / Credits panel
  • Priority response on GitHub issues — tagged "sponsor" and
    triaged before the general queue

Same MIT-licensed app, no exclusive features.
```

### Tier 3 — 🏛️ Observatory

- **Monthly**: $25
- **One-time**: $100
- **Description**:

```
Everything in Observer, plus:
  • Acknowledged by name in major release notes
  • Direct email line for support / consultation
  • For schools / astronomy clubs / educators: I'm happy to
    discuss customisation needs (translation, kiosk modes,
    specific events) — please reach out directly.

The simulator core remains MIT-licensed and free; customised
variants for institutional use can be discussed separately.
```

### Welcome message (sent automatically on new sponsor)

```
Thank you for sponsoring 太陽系模擬 / Solar System 3D!

This is a weekend hobby project — your support means I can keep
spending evenings on real Kepler propagators, galactic flythroughs,
and the next 12 exoplanet systems instead of feeling guilty about
the Vercel bill. 🙏

A few practical things:
1. I'll add you to CONTRIBUTORS.md within a few days.
2. If you sponsored at Observer ($5/mo) or higher, your name will
   appear in the in-app About panel on the next release.
3. If you have GitHub issues open, ping me on them — they'll get
   priority triage.
4. If you sponsored at Observatory ($25/mo) and want to discuss a
   specific feature or customisation, reply to this thread.

The project will always stay MIT-licensed and free. Donations are
welcome but never required — feel free to cancel anytime.

— Kevin
kevin.lin.49361128@gmail.com
```

---

## Step 5 — Create `CONTRIBUTORS.md` (2 min)

Create `/Users/kevinlin/太陽系模擬/CONTRIBUTORS.md` with the
template:

```markdown
# Contributors

Thank you to the following people who have supported this project
through code, bug reports, design feedback, or
[GitHub Sponsors](https://github.com/sponsors/kevinlin49361128-stack).

## Sponsors

_(Sponsors added here as they come in. Order: month of first
sponsorship.)_

## Bug reports / feature suggestions

_(Names + GitHub handles + one-line on what they reported)_

## Code contributors

See [GitHub's contributor graph](https://github.com/kevinlin49361128-stack/solar-system-3d/graphs/contributors).
```

---

## Step 6 — Update `docs/show-hn.md` (3 min)

In the first-comment text, just before the existing roadmap
paragraph, add a single line:

> Built on weekends. MIT licensed; donations via [GitHub Sponsors](https://github.com/sponsors/kevinlin49361128-stack) welcome but never required — no paywalled features, ever.

The "never required + no paywalled features" framing is the HN-
culture-friendly version of an open-source donation pitch.

---

## Step 7 — Smoke test (2 min)

1. Repo page shows 💜 Sponsor button at top
2. README badge renders (not broken image)
3. Click ★ Star link in app footer — lands at correct repo (no 404)
4. Click Support link in app footer — lands at updated `SUPPORT.md`
5. `https://github.com/sponsors/kevinlin49361128-stack` shows the
   three tiers with the descriptions above
6. Send yourself a $1 sponsorship from a second GitHub account (if
   you have one) — verify the welcome message lands as expected

---

## Step 8 — Single commit (3 min)

```bash
git add .github/FUNDING.yml SUPPORT.md README.md CONTRIBUTORS.md docs/show-hn.md
git commit -m "$(cat <<'EOF'
chore: enable GitHub Sponsors

GitHub Sponsors application was approved; activate the program:

- .github/FUNDING.yml enables the 💜 Sponsor button on repo + Issues
- SUPPORT.md replaces 「贊助連結建置中」 placeholder with live tier
  table + GitHub Sponsors link
- README badge surfaces the link prominently
- CONTRIBUTORS.md scaffold ready to populate as sponsors come in
- docs/show-hn.md picks up the "MIT, donations welcome but never
  required, no paywalled features" framing for the HN post

Tier ladder: Stargazer $1/mo, Observer $5/mo, Observatory $25/mo.
No exclusive features per tier — same MIT-licensed app for everyone.
EOF
)"
git push
```

Then remove this file (its job is done):

```bash
git rm docs/TODO_SPONSORS_ACTIVATION.md
git commit -m "docs: remove sponsors activation checklist (done)"
git push
```

---

## Notes for future-me

- **Don't go retroactive.** If you decide to add a new tier later,
  add it at the top of the ladder; never restructure existing tiers
  (sponsors get downgrade notifications and it feels bad).
- **Don't mention specific $ amounts in app UI text.** Only put $
  in `SUPPORT.md` / `README.md` / GitHub Sponsors page. The app
  itself just says "❤ Sponsor" → link out. This way you can change
  pricing later without touching the app.
- **Tax: W-8BEN form due to GitHub.** You're in Taiwan; GitHub will
  ask for a W-8BEN within ~30 days of first sponsorship payout.
  Sponsors stops paying out until it's filed.
- **Stripe Connect / Wise.** GitHub Sponsors uses Stripe for fiat.
  You already started Wise setup — finish that before the W-8BEN
  flow asks for an account number.
