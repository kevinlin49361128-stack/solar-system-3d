# Donation activation checklist — Lemon Squeezy

**Status**: platform decided → **Lemon Squeezy**. No approval wait.
Activation is split into Part A (你在 Lemon Squeezy 後台做，~15 min)
and Part B (repo 變更，拿到商品 URL 後 ~10 min copy + commit + push).

---

## Why Lemon Squeezy (not GitHub Sponsors / Ko-fi)

Both GitHub Sponsors and Ko-fi require the creator to hold their **own
Stripe Connect account**, which means passing Stripe's KYC for the
creator's country. For a Taiwan-based individual that path stalls —
GitHub Sponsors never approved, and Ko-fi's Stripe Connect onboarding
froze mid-flow (the "選擇帳戶" page hung).

Lemon Squeezy is a **Merchant of Record**: it is the legal seller, it
runs payments on *its own* US Stripe entity, handles end-customer tax /
VAT / compliance, and pays the net amount to you as a "supplier". The
creator's country never touches Stripe's regional limits. That is the
decisive difference — it is the only one of the three that actually
works from Taiwan without fighting a KYC wall.

Trade-offs accepted (and why they don't matter here):
- **~5 % fee** — irrelevant; the project's goal is portfolio, not income.
- **Store-shaped, not donate-shaped** — the in-app button only says
  "❤ Support" → links out; <1 % of users ever see the destination's
  shape. Naming the product clearly as a donation closes the gap.
- **Owned by Stripe since 2024** — if it's ever sunset, swapping the
  one `custom:` URL in FUNDING.yml is a 5-minute change.

---

## Decided plan — ONE pay-what-you-want product

The earlier GitHub-Sponsors plan had 3 tiers × (monthly + one-time) =
6 price points. On GitHub Sponsors tiers are a native feature; on
Lemon Squeezy every price point is a separate product/variant to
maintain. Six products for a project whose goal is *not income* is
wasted operational surface.

**Instead: a single one-time "pay what you want" product.**

- The buyer names their own price. Suggested amounts double as the
  "tier" UX without any extra products:

  | | 建議金額 | 適合 |
  |---|---|---|
  | 🌟 Stargazer  | $5   | 「這個有幫到我」 |
  | 🔭 Observer   | $25  | 課堂 / 長期使用 |
  | 🏛️ Observatory | $100 | 學校 / 天文社團 / 機構 |

- **One-time only, no subscription.** Recurring donations to a hobby
  project are rare and add tax / renewal complexity for ~no return.
  If recurring is ever wanted, a Lemon Squeezy subscription variant is
  a 10-minute add later.
- **No exclusive features, ever.** Every sponsor gets the exact same
  MIT-licensed app as every free user. Rewards are recognition-only:
  CONTRIBUTORS.md listing, About-panel credit, release-note thanks,
  priority issue replies. This protects the open-source story.

---

## Part A — Lemon Squeezy dashboard (你做)

1. **Store** — confirm you have a store (you already opened an account).
   Store name something neutral like `Kevin Lin` or `Solar System 3D`.

2. **Create a product**:
   - Pricing model: **Pay what you want** (single payment / one-time —
     NOT subscription).
   - Minimum price: `$1` (or `$3` — low floor maximises "click without
     thinking" small donations).
   - Suggested / default price: `$5`.
   - Name: something that reads as a donation, e.g.
     `Support Solar System 3D` / `贊助 太陽系模擬`.
   - Short description: one line + a link back to the GitHub repo.

3. **Turn OFF license-key generation** for this product. Lemon Squeezy
   can auto-issue software license keys per order — this is a donation,
   not a licensed product, so disable it (Product → Settings).

4. **Publish** the product.

5. **Tax form** — Settings → fill the seller tax form. As a non-US
   individual you'll complete a **W-8BEN**-equivalent. Lemon Squeezy
   handles end-customer VAT itself; this form is just so it can pay
   *you*. Lighter than the GitHub→Stripe direct path but still required.

6. **Payout** — connect your payout method (Wise or PayPal). You
   already started Wise setup; finish it here. Lemon Squeezy → Wise
   works for Taiwan.

7. **Copy the product's public checkout URL.** It looks like
   `https://<store>.lemonsqueezy.com/buy/<uuid>` (or a custom checkout
   link). **Give this URL to Claude** — Part B needs it. Until then,
   Part B stays staged below.

---

## Part B — repo activation (拿到 URL 後)

Everything below is pre-written. When the Lemon Squeezy URL is known,
replace every `<<LEMONSQUEEZY_URL>>` with it, then apply + commit + push.

### B1 — Create `.github/FUNDING.yml`

```yaml
# The 💜 Sponsor button on the repo + Issues/PRs links here.
# Lemon Squeezy (Merchant of Record) was chosen because it sidesteps
# the Taiwan Stripe Connect KYC wall that blocks GitHub Sponsors + Ko-fi.
custom: ['<<LEMONSQUEEZY_URL>>']
```

Verify after push: the "Sponsor" button appears on the repo page.

### B2 — Replace the `## ☕ 小額贊助` section in `SUPPORT.md`

```markdown
## ☕ 小額贊助

如果這個專案對你有用、且你的預算允許，可以透過
[Lemon Squeezy 贊助頁面](<<LEMONSQUEEZY_URL>>)小額支持。

頁面採「**自訂金額**」(pay what you want) — 你決定給多少。建議參考：

| | 金額 | 適合 |
|---|---|---|
| 🌟 Stargazer  | $5   | 「這個有幫到我」 |
| 🔭 Observer   | $25  | 課堂 / 長期使用 |
| 🏛️ Observatory | $100 | 學校 / 天文社團 / 機構 |

**沒有任何付費限定功能** — 所有贊助者跟所有免費使用者拿到完全相同的
MIT 授權版本。贊助回饋是純粹的「致謝」：CONTRIBUTORS.md 留名 /
About 面板列名 / release notes 致謝 / issue 優先回覆。

也歡迎不贊助 — `Star` + 分享給天文社群朋友就是對作者很棒的支持。
```

And in the English section, replace
`A donation link will be added later — for now there's nothing to pay
for and nothing being asked.` with:

```markdown
If the project is useful to you, an optional pay-what-you-want
donation is available via [Lemon Squeezy](<<LEMONSQUEEZY_URL>>).
There are no paywalled features — every sponsor gets the same
MIT-licensed app. Starring and sharing the repo helps just as much.
```

### B3 — Update `README.md`

Line ~157, replace:

```markdown
- ☕ [小額贊助](SUPPORT.md) — Buy Me a Coffee / GitHub Sponsors
```

with:

```markdown
- ☕ [小額贊助](SUPPORT.md) — Lemon Squeezy（自訂金額，無付費限定功能）
```

### B4 — Commit + push

```bash
git add .github/FUNDING.yml SUPPORT.md README.md CONTRIBUTORS.md
git commit -m "feat: activate Lemon Squeezy donations (pay-what-you-want)"
git push
```

Then delete this checklist (its job is done):

```bash
git rm docs/TODO_SPONSORS_ACTIVATION.md
git commit -m "docs: remove donation activation checklist (done)"
git push
```

---

## Notes for future-me

- **CONTRIBUTORS.md is already created** (platform-independent scaffold).
  Populate the Supporters section as donations come in — ask each donor,
  at donation time, what display name they want (or anonymous).
- **Don't mention specific $ amounts in app UI text.** The app only
  shows "❤ Support" → links out. $ figures live only in SUPPORT.md /
  README / the Lemon Squeezy page, so pricing can change without
  touching the app build.
- **One-time only by design.** If you later want recurring, add a
  Lemon Squeezy *subscription* variant — don't restructure the
  existing one-time product.
- **Tax**: the W-8BEN-equivalent is filed inside Lemon Squeezy, not
  with GitHub. Lemon Squeezy remits end-customer VAT itself.
- **Payout**: Lemon Squeezy → Wise (or PayPal). Finish Wise setup.
- **If Lemon Squeezy is ever sunset** (it's Stripe-owned now): the only
  load-bearing repo reference is the single `custom:` URL in
  FUNDING.yml + the links in SUPPORT.md/README. Swapping platforms is
  a find-replace, not a rebuild.
