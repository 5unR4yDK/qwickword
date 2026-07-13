# Quick Word — Revenue Model

Honest framing up front: the single best monetization model cannot be *known* before there are real
users. This document narrows the field with reasoning and comparable-product data, states a
recommended starting model, and — most importantly — defines the experiments that turn a guess into
an answer. The nightly task builds the machinery and instrumentation; the conclusions come from real
traffic and must be reported as measured, not asserted.

## The economics that shape everything
Quick Word calls are short and hard-capped, so cost-of-goods per call is tiny and predictable.
Daily bills roughly **$0.004 per participant-minute** after a free tier. A capped 2-minute, 2-person
call is 4 participant-minutes ≈ **$0.016 of video**. Even a 10-minute, 4-person call is ~$0.16.

Two consequences:
1. A free tier is cheap to sustain, so it can double as the main growth channel.
2. There is little to monetize in the *call itself* — the margin is in identity, branding, teams, and
   integrations. Charging per call would tax the exact behavior we want to encourage.

## Candidate models
1. **Freemium + per-seat Pro (SaaS).** Free for personal use; paid for branding removal, custom
   slug/domain, longer caps, analytics, and team seats. This is how Calendly (link-based, ~$10–16/seat/mo,
   free tier deliberately limited to force upgrades) and Whereby (per-host ~$9–12/mo) monetize.
   **Recommended as the primary model.**
2. **Team / B2B "respect-your-time" plan.** Per-seat, sold to managers on meeting-cost reduction and
   culture. Natural expansion of model 1; likely the highest-value segment.
3. **Usage / API embedding (Whereby-style).** Let other products embed timed calls, priced on usage.
   Real, but a *second* line for later — not the wedge.
4. **Pay-per-link / credits.** Weak. Users treat a utility like this as free; per-use billing kills the
   growth loop. Avoid unless a test surprises us.
5. **White-label / enterprise.** High-touch, high-price, much later.

## Recommended starting position
Run product-led growth INTO B2B. The free individual tier is the **acquisition engine**; paid **teams**
are the **monetization engine** and the sharpest marketing story (see the B2B wedge below).

Lead with **freemium + per-seat Pro**, benchmarked to the $8–12/user/month band that Whereby and
Calendly occupy. Keep the free tier generous on the *core utility* (creating and joining capped calls)
and gate on **identity and scale**: remove the "Powered by Quick Word" badge, custom personal slug,
custom domain, team workspace and shared link library, opener notifications, analytics, and integrations.
The free tier's badge is the growth loop, so the free tier is a marketing cost, not a leak. Hold the
API/embedding line (model 3) as a deliberate second act once consumer traction exists.

## The B2B wedge (teams) — likely the primary monetization play
**Pitch:** "Stop paying for meetings that should have been a quick word." Encourage employees to reach
for a 5-minute capped call instead of defaulting to a 30- or 60-minute block. Sold to team leads,
ops/Chief-of-Staff, and RevOps; later to HR/culture owners.

**Why the number is big.** Credible reporting: unnecessary meetings cost large companies on the order of
$100M/year, ~$25,000 per employee, with ~50% of meeting time considered wasted (sources below).

**Illustrative math (put a version of this on the B2B landing page, clearly labelled as an estimate):**
| Scenario | People | Length | Loaded cost @ $80/hr/person |
|---|---|---|---|
| Default meeting | 5 | 30 min | **$200** |
| Quick Word instead | 5 | 5 min | **$33** |
| **Saved per meeting** | | | **~$167** |

One such swap per weekday for a 5-person team ≈ **~$3,300/month reclaimed** against ~$50/month in seats.

**The honest caveat (do not oversell this).** These savings are counterfactual and soft — you cannot
prove the meeting would have run long, and reclaimed time isn't always productively redeployed.
Sophisticated buyers discount ROI-calculator claims. So do NOT sell a guaranteed-ROI promise.

**What actually makes the B2B pitch defensible:**
1. Quick Word doesn't merely *measure* meeting waste (passive calculators already do that) — it
   *structurally prevents the overrun*: the cap can't be extended.
2. The admin dashboard converts the claim into evidence from real adoption: count of Quick Words held,
   estimated meeting-minutes and dollars reclaimed, team-by-team. Sell behavior change + a dashboard
   that proves it, not a hypothetical spreadsheet.
3. Culture angle: a lightweight "we have a quick-word culture here" signal that managers can champion.

**What to build for it** (see ROADMAP.md Phase 3–4): team workspace + shared link library, an admin
"reclaimed hours & cost" dashboard driven by real usage, org roles/permissions, SSO/SAML for larger
buyers, and per-team adoption reporting.

## How we actually find out (experiments the nightly task can build)
The build work is the instrumentation; the answers need real users.
- **Funnel instrumentation.** Track link_created → link_opened → call_completed → cta_clicked → signup.
  Without this, no pricing question can be answered. (Phase 1.)
- **Fake-door pricing page.** Publish 2–3 tiers with a "Subscribe" button that captures intent before
  billing exists; measure click-through per tier. (Phase 3, gated on Andreas approving live traffic.)
- **Locked-feature telemetry.** When a free user clicks a gated Pro feature, log which one. The
  most-clicked locks reveal what people will actually pay for.
- **Willingness-to-pay probe.** A light Van Westendorp-style question ("too cheap / too expensive")
  on the pricing page or in an onboarding survey.
- **Badge & CTA A/B tests.** Measure how much the "Powered by Quick Word" badge and the post-call CTA
  actually drive new link creation — this determines whether free-tier economics work.

## What needs Andreas (money & legal cannot be autonomous)
- A Stripe account and keys before any real billing (test mode is fine to build against).
- Approval before driving real traffic to a live pricing test.
- Any pricing actually charged, refunds, taxes/VAT, and terms — all his call.

## Sources
- Daily.co video API pricing (per participant-minute, free tier): https://www.daily.co/pricing/video-sdk/
- Whereby Embedded pricing: https://whereby.com/information/embedded/pricing
- Whereby Meetings per-host pricing: https://whereby.com/information/pricing
- Calendly pricing (freemium + per-seat, limited free tier): https://calendly.com/pricing
- Cost of unnecessary meetings (~$100M/yr for large firms, ~$25k/employee): https://www.cbsnews.com/news/unnecessary-meetings-cost-big-companies-100-million-annually/
