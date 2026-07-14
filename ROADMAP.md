# Quick Word — Product Roadmap

This is the master backlog. It is ordered by priority, top to bottom. The nightly build task works
it **one item at a time**: pick the first unchecked `[ ]` item that is not tagged `[needs-andreas]`,
build it, verify it against its acceptance criteria, check it off, log the result in STATUS.md, then stop.

## Legend
- `[ ]` not started · `[~]` in progress (partial, see STATUS.md) · `[x]` done and verified
- `[needs-andreas]` — cannot be completed autonomously (money, legal, account signup, or an approval).
  When the next item is gated, DO NOT stall: append it to ASKS.md and skip to the next buildable item.
- `[gate]` — a phase boundary that should not be crossed without Andreas's explicit go-ahead
  (recorded in ASKS.md). Everything before the gate can be built freely.

## The one-sentence product
A meeting tool where you set the maximum length in advance and it **cannot be extended** — when the
timer hits zero the call ends, server-enforced. If you need more time, you schedule another Quick Word.

## Positioning (keep this in mind while building)
Every competitor sells "no time limit." Quick Word sells the opposite: short by design. It is an
anti-meeting-bloat tool for people who value their time. Every design choice should reinforce
"this will be quick" — not apologize for it.

---

## Phase 0 — MVP: make it work (core loop, end to end)
Goal: a person can create a link, both parties join, a countdown runs, the call is force-ended at zero.

- [x] Scaffold a Next.js (App Router, TypeScript) app in this folder; it runs locally with `npm run dev`.
      *Done when:* the dev server starts and serves a placeholder home page with no errors.
      *(2026-07-13: done — Next.js 16.2.10, App Router, TypeScript, Tailwind, ESLint, `src/` dir.
      Verified: `next dev` → "Ready" in ~300ms, `GET /` → HTTP 200, default placeholder page, no
      errors. See STATUS.md for a platform note on where this was built/verified.)*
- [x] Read `DAILY_API_KEY` / `DAILY_DOMAIN` from `.env.local`; add a mock fallback so the app runs
      without a key. *Done when:* app boots in both keyed and mock modes.
      *(2026-07-14: done — `src/lib/daily-config.ts` reads both vars once server-side; falls back to
      `mockMode: true` with a one-time console warning when either is missing, instead of throwing.
      Verified: `npm run dev` booted clean with `.env.local` present (HTTP 200, "Daily: live mode"
      logged, home page shows a live-mode banner) and with it temporarily renamed aside (HTTP 200,
      "Daily: mock mode" warning logged, home page shows a mock-mode banner). `npm run lint` and
      `npm run build` both clean.)*
- [ ] API route `POST /api/rooms` that creates a Daily room with `exp = now + duration`,
      `eject_at_room_exp: true`, and `eject_after_elapsed = duration`. Validate the exact property
      names against the live Daily API and correct BUILD_PLAN.md if any differ; log the check.
      *Done when:* calling the route returns a real room URL whose config shows the expiry set.
- [ ] Create-link page: choose a duration, click "Create Quick Word", get a shareable link.
      *Done when:* the link is generated and copyable.
- [ ] Call page `/[room]`: join the Daily room (prebuilt UI is fine for MVP) and show a countdown
      synced to the room's `exp`. *Done when:* two browser tabs can connect and see the same countdown.
- [ ] Hard-end experience: at expiry the participant is ejected and lands on a "Time's up" screen
      with **no rejoin and no extend** control anywhere. *Done when:* the call cannot be continued.
- [ ] Invalid/expired-link handling: a friendly screen instead of a crash. *Done when:* opening a
      dead or malformed link shows a clear message and a "Create a new one" button.
- [ ] Write a short README explaining how to run it locally.
- [ ] `[needs-andreas]` `[gate]` Deploy the MVP to a NEW, dedicated Vercel project (never an existing
      one). Queue this in ASKS.md with the exact steps Andreas needs to approve.

## Phase 1 — Usable: make it not annoying
Goal: something you'd actually send to a colleague without wincing.

- [ ] Pre-join screen: name entry + camera/mic check before connecting.
- [ ] Duration presets (1, 2, 5, 10 min) plus a custom value with a sane maximum.
- [ ] Countdown polish: large shared timer, colour shift and a subtle cue at T-30s and T-10s.
- [ ] Fully responsive layout; verify the call works on a phone browser.
- [ ] Basic brand pass: name, logo, favicon, colours, and Open Graph / meta tags so a pasted link
      shows a nice preview ("A 2-minute Quick Word").
- [ ] "Waiting for the other person" state with the copyable link shown again.
- [ ] Decide and document the backend: start with no database (stateless rooms encoded in the link),
      and only add a datastore when a feature actually needs one. Record the decision in STATUS.md.
- [ ] Privacy-friendly, cookie-light analytics (e.g. self-host Plausible-style events) capturing the
      core funnel: link_created → link_opened → call_started → call_completed → cta_clicked.
      *Done when:* those five events fire and are queryable.

## Phase 2 — Shareable: build the growth loop
Goal: every call quietly recruits the next user.

- [ ] Zero-friction creation: a first-time user can make a link without signing up.
- [ ] "Powered by Quick Word" mark on the call and on the "Time's up" screen, linking to create-your-own.
- [ ] Post-call CTA screen: "Create your own Quick Word" as the primary action.
- [ ] Rich share: OG image that renders the chosen duration; native share sheet on mobile.
- [ ] Optional lightweight accounts via magic-link email, so a user can save and reuse links.
      *(Add a datastore here if not already added.)*
- [ ] Reusable personal link (e.g. `quickword.co/andreas`) that always opens a fresh capped room.
- [ ] Calendar hooks: "Add to Google/Outlook Calendar" and an .ics download for a scheduled Quick Word.
- [ ] Opener notification: email the creator when someone opens or joins their link.

## Phase 3 — Marketable & monetizable: make it a business
Goal: a pricing page, a free tier that converts, and the first paid features.
**Read `REVENUE.md` in this folder before building this phase.** Several items here are gated.

- [ ] Harden auth and accounts (sessions, rate limits, abuse protection on room creation).
- [ ] Build the Pro feature gates behind a feature flag so they can be turned on when billing is live:
      remove branding, custom personal slug, custom domain, longer max durations, team seats, analytics.
- [ ] Marketing site: landing page, the positioning above, a pricing page, and a few SEO pages
      (e.g. "the 2-minute meeting", "stop meetings running over").
- [ ] B2B landing page + the "reclaimed hours & cost" story (see REVENUE.md "B2B wedge"), with the
      savings math clearly labelled as an estimate. Sell prevention + evidence, not a guaranteed ROI.
- [ ] Team workspace: shared link library, member roles/permissions, org-level settings.
- [ ] Admin "reclaimed" dashboard driven by REAL usage: count of Quick Words held, estimated
      meeting-minutes and dollars reclaimed (configurable loaded-cost assumption), per-team breakdown.
      *Done when:* the numbers come from actual logged calls, not hardcoded figures.
- [ ] `[needs-andreas]` Fake-door pricing test: publish 2–3 tiers, measure click-to-intent before any
      real billing exists. Instrument it; the *conclusion* needs real traffic, so report the numbers,
      don't guess them. (Needs Andreas to approve going live / driving any traffic.)
- [ ] `[needs-andreas]` `[gate]` Stripe billing integration. Requires Andreas to create/connect the
      Stripe account and provide keys. Until then, build everything against Stripe **test mode** only.
- [ ] `[needs-andreas]` Free-tier limits chosen from the pricing test (Calendly-style: generous on the
      core utility, gated on identity/branding/team). Enforce limits in-app.
- [ ] Email capture + waitlist for anything not yet shipped.

## Phase 4 — Fantastic: feature-rich and delightful
Goal: the version people evangelize. Re-prioritize this phase based on what Phase 2–3 data shows.

- [ ] Agenda field per link ("the one thing to discuss"), shown to both parties before the call.
- [ ] Timer modes: hard-stop (default), soft-warning-then-stop, and a per-speaker time split.
- [ ] Meeting-cost estimator: optional live "$ spent so far" based on attendee count — a marketing hook
      that reinforces the "time is money, keep it short" story.
- [ ] AI post-call summary / action items (respecting the short format; opt-in; storage-light).
- [ ] In-call extras kept deliberately minimal: text chat, reactions, short screen-share.
- [ ] Slack app + Chrome extension: create a Quick Word link from where you already are.
- [ ] Embeddable widget / public API so others can drop timed calls into their product (Whereby-style;
      this is also a second revenue line — see REVENUE.md).
- [ ] Recurring Quick Words and "micro office-hours" scheduling.
- [ ] Custom themes / white-label for Pro and teams.
- [ ] `[needs-andreas]` SSO / SAML for larger B2B buyers (enterprise gating).
- [ ] Accessibility pass and internationalization.
- [ ] `[needs-andreas]` Native mobile apps — much later, only if web usage justifies it.

---

## How the nightly task should use this file
1. Read STATUS.md, then this file. Find the first `[ ]` item that is not `[needs-andreas]` and is not
   past an uncrossed `[gate]`.
2. Build exactly that item. Keep scope to the one item; resist wandering.
3. Verify against the item's "Done when" criteria where given. Commit to git.
4. Mark it `[x]` (or `[~]` with a note if only partly done) and record what works in STATUS.md.
5. If the only remaining items are `[needs-andreas]` or gated, write a clear ASKS.md entry and stop
   for the night rather than crossing a gate.
