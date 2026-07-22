# Qwickword — Product Roadmap

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
timer hits zero the call ends, server-enforced. If you need more time, you schedule another Qwickword.

## Positioning (keep this in mind while building)
Every competitor sells "no time limit." Qwickword sells the opposite: short by design. It is an
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
- [x] API route `POST /api/rooms` that creates a Daily room with `exp = now + duration`,
      `eject_at_room_exp: true`, and `eject_after_elapsed = duration`. Validate the exact property
      names against the live Daily API and correct BUILD_PLAN.md if any differ; log the check.
      *Done when:* calling the route returns a real room URL whose config shows the expiry set.
      *(2026-07-15: done — `src/lib/daily-rooms.ts` + `src/app/api/rooms/route.ts`. Property names
      (`exp`, `eject_at_room_exp`, `eject_after_elapsed`) validated against the live Daily REST API
      docs and confirmed by calling the route with a real key: created a live room, then fetched it
      back from `GET /rooms/:name` on Daily's own API and saw `exp`/`eject_at_room_exp`/
      `eject_after_elapsed` all set exactly as requested. Room deleted after the check. No correction
      to BUILD_PLAN.md needed — it already had the right property names. See STATUS.md for full
      detail including mock-mode behaviour and validation bounds.)*
- [x] Create-link page: choose a duration, click "Create Quick Word", get a shareable link.
      *Done when:* the link is generated and copyable.
      *(2026-07-16: done — `src/components/create-link-form.tsx` (Client Component) embedded in
      `src/app/page.tsx` (Server Component). Duration picker is a minimal preset row (1/2/5/10/15/30
      min) calling `POST /api/rooms`; on success shows a copyable link built as
      `{origin}/{room.name}` (this app's own future `/[room]` route, not the raw Daily URL — see
      next roadmap item). Verified via production build (clean lint/build/TypeScript) plus curl
      end-to-end in both mock mode and live mode (real Daily room created, config confirmed, deleted
      after). Real click-through browser testing (Playwright) was attempted but blocked by a sandbox
      limitation (Chromium needs system libraries only installable via `sudo`, which isn't available
      here) — see STATUS.md for the honest limitation and what was verified instead. Also pulled
      `MIN_DURATION_SECONDS`/`MAX_DURATION_SECONDS` out of `daily-rooms.ts` into a new
      `src/lib/duration.ts` (no server-only deps) so the client-side picker can safely import the
      same bounds without pulling the Daily fetch/API-key logic into the browser bundle.)*
- [x] Call page `/[room]`: join the Daily room (prebuilt UI is fine for MVP) and show a countdown
      synced to the room's `exp`. *Done when:* two browser tabs can connect and see the same countdown.
      *(2026-07-17: done — `src/app/[room]/page.tsx` (Server Component) + `src/components/
      call-countdown.tsx` (Client Component). Stateless design: `exp` rides in the link's query
      string (`create-link-form.tsx` now generates `/{room.name}?exp={room.exp}`), so both tabs
      count down from the same shared timestamp with no server lookup or database needed. Live mode
      embeds an iframe at the real Daily room URL (`https://{domain}/{room}`, Daily's own prebuilt
      call UI) plus an "open in new tab" fallback; mock mode shows a placeholder box (no real Daily
      call exists to join). Verified end to end against both modes — see STATUS.md for detail.
      Deliberately out of scope for tonight (next two roadmap items): verifying the room still
      exists before rendering, and a polished hard "Time's up" no-rejoin screen — today the
      countdown just displays "Time's up" while Daily's server-side `eject_at_room_exp` /
      `eject_after_elapsed` (already live since item 3) does the actual enforcement.)*
- [x] Hard-end experience: at expiry the participant is ejected and lands on a "Time's up" screen
      with **no rejoin and no extend** control anywhere. *Done when:* the call cannot be continued.
      *(2026-07-18: done — `src/components/call-room.tsx` (new Client Component) now owns the call
      page's ticking clock and swaps the entire call area (Daily iframe or mock box, plus the "open in
      new tab" link) for a plain "This Quick Word has ended." screen the moment `exp` passes — no
      rejoin, no extend, no link back into the same room anywhere on the page. `CallCountdown` was
      slimmed to a pure display component (no more clock of its own); the iframe/mock-box markup moved
      into a new shared `src/components/call-media.tsx` so both the timed path and the existing
      "missing exp" fallback in `page.tsx` render it identically. See STATUS.md for full detail,
      including a design refinement made while verifying tonight (computing the initial remaining time
      server-side, in `src/lib/time.ts`, rather than starting every load from an unknown placeholder)
      and the `eslint-plugin-react-hooks` "purity" rule that motivated it.)*
- [x] Invalid/expired-link handling: a friendly screen instead of a crash. *Done when:* opening a
      dead or malformed link shows a clear message and a "Create a new one" button.
      *(2026-07-19: done — `src/app/[room]/page.tsx` now gates entry to the call with a syntax check
      (plausible room name + numeric `exp`, `isPlausibleRoomName` in `src/lib/daily-rooms.ts`) and, in
      live mode for a link that still claims to be active, a real existence check against Daily
      (`checkDailyRoomExists`). Either failure renders the new `src/components/invalid-link-screen.tsx`
      with a clear message and a "Create a new one" button. An already-expired-but-real link still goes
      through item 6's "This Quick Word has ended" screen in `call-room.tsx`, which also gained its own
      "Create a new one" button tonight. See STATUS.md for full detail, including mock-mode's documented
      "nothing to check existence against" decision and tonight's discovery that item 6's work had never
      actually been committed.)*
- [x] Write a short README explaining how to run it locally.
      *Done when:* `npm install`, `.env.local`/mock-mode behaviour, `npm run dev`, `npm run lint`,
      and `npm run build` are all documented accurately.
      *(2026-07-20: done — `README.md` rewritten from the `create-next-app` placeholder: what Quick
      Word is, the stack, `npm install`/`npm run dev`, the two `.env.local` vars and mock-mode
      fallback behaviour, `lint`/`build`/`start`, a short project-layout map, and a one-line
      deployment note pointing at the still-open Vercel gate below. Verified by actually running
      `npm run lint` and `npm run build` clean, and booting the dev server in both mock mode (no
      `.env.local`) and live mode (real `.env.local` copied into a scratch dir only, never
      committed) and confirming the home page's banner text matches what the README says. See
      STATUS.md for full detail, including tonight's discovery and recovery of items 6+7's
      never-committed work.)*
- [x] `[needs-andreas]` `[gate]` Deploy the MVP to a NEW, dedicated Vercel project (never an existing
      one). Queue this in ASKS.md with the exact steps Andreas needs to approve.
      *(2026-07-20: done — Andreas approved in chat ("ok to deploy ok to make new vercel project")
      and directed the run to the folder holding his Vercel account token. Created a brand-new
      project, `quickword` (id `prj_JS71RabWYJSg6h4Jw4H0sBE1mXpL`), via the Vercel API — confirmed
      via `GET /v9/projects` first that no `quickword`/`quick-word` project already existed, and that
      the token's only other projects (`blackstart-voting`, `pk-datarooms`, `pk-exo`,
      `powerkyiv-investors`) were untouched. Set `DAILY_API_KEY`/`DAILY_DOMAIN` as encrypted env vars
      (production/preview/development) using the same values as `.env.local`, then linked and deployed
      via the Vercel CLI (`vercel link` + `vercel deploy --prod`). Live at
      **https://quickword.vercel.app**. See STATUS.md for full verification detail and how the token
      was sourced/scoped.)*

## Phase 1 — Usable: make it not annoying
Goal: something you'd actually send to a colleague without wincing.

- [x] Pre-join screen: name entry + camera/mic check before connecting.
      *(2026-07-21: done — rooms are now created with `enable_prejoin_ui: true`
      (`src/lib/daily-rooms.ts`), which turns on Daily Prebuilt's own lobby:
      a name-entry form, then a camera/mic check, before the participant
      actually joins. Build choice: reuse Daily's own lobby (validated
      against `docs.daily.co/reference/rest-api/rooms/config`) rather than
      write a custom `getUserMedia`-based screen — same rationale as Phase 0
      item 5's choice to embed Daily's whole prebuilt call UI. No new
      component/route needed for live mode; mock mode (no real Daily embed to
      show a lobby in) got a short explanatory note added to the mock call
      box instead (`src/components/call-media.tsx`). See STATUS.md for full
      verification detail, including the Daily API round-trip confirming
      `config.enable_prejoin_ui: true` on a real room.)*
      **2026-07-21, later same day (Andreas, interactive, testing the live app):** flagged a real
      product bug this item's design didn't account for — see the new item immediately below, which
      supersedes the fixed-schedule-from-creation assumption this item and Phase 0 item 3 both built
      on. Andreas has already approved building it as a normal nightly item — not gated, not
      `[needs-andreas]`, nothing further to ask him for. Not a revert of tonight's work (Daily's
      `enable_prejoin_ui` lobby is still correct and still wanted) — just built on top of an
      assumption about *when the clock starts* that turned out to be wrong.
- [x] **Anchor the countdown to first join, not link creation.** Right now `exp` is fixed the moment
      `POST /api/rooms` is called (Phase 0 item 3), so if the second person takes 90 seconds to open
      the link, they've already lost 90 seconds of, say, a 2-minute call before ever connecting.
      Andreas caught this testing the live app on 2026-07-21 (see the note on the item above). Fix:
      - Detect the *first* real join event. The call page currently embeds a raw `<iframe
        src="...">` (Phase 0 item 5) with no code on our side that knows when someone's joined —
        switching to Daily's JS SDK (`daily-js`, wrapping the iframe with a call object) is needed
        to get a `joined-meeting` event to key off of.
      - The moment that fires, compute the *real* `exp = now + duration` and push it to Daily's room
        config (`POST /rooms/:room`, updating `exp` / `eject_at_room_exp` / `eject_after_elapsed` —
        same properties Phase 0 item 3 already sets at creation, just updated on first join instead).
        This keeps the server-side hard cutoff — the whole point of the product — anchored to the
        same moment as the UI, not just a client-side display change.
      - Both tabs need to agree on the same real end time. **No new datastore needed for this:**
        Daily's own room object can stay the single source of truth — have the call page re-fetch
        the room's live `config.exp` (extending `checkDailyRoomExists`'s existing Daily API call
        rather than adding a new one) instead of trusting the timestamp baked into the shareable
        link at creation time. This is consistent with — and should inform — the still-open backend
        item further below.
      - Until the first join happens, replace the ticking countdown with a waiting state (this
        merges the separate "Waiting for the other person" item that used to be here — do not build
        that as a second, separate item; it's the same UI state this item needs anyway).
      - **Updated 2026-07-21 (Andreas, interactive, alongside the one-click create-flow redesign
        below):** the countdown should start on *either* of two triggers, not just the first join —
        also add a manual "Start now" button the creator can press themselves (e.g. useful if they've
        confirmed the other person is ready some other way — a phone call, a chat message — and don't
        want to wait on Daily's own join-detection). Whichever trigger fires first wins; once the timer
        has started via one path, the other becomes moot (a manual start shouldn't be re-triggerable by
        a join arriving after, and vice versa). This is an extension of the same underlying mechanism —
        both triggers end in the same "compute real `exp`, push it to Daily's room config" step above —
        not a second, separate feature; build them together, not the join-detection now and the manual
        button as a future add-on.
      *Done when:* two tabs opening the same link at very different times both see a countdown that
      starts from whichever of (a) one of them joining or (b) the creator pressing "Start now" happens
      first, not from link-creation time, and Daily's own room config confirms the server-side `exp`
      was actually updated, not just the client display.
      **Built and deployed 2026-07-21 (interactive, "can we implement now please..."):**
      - `src/lib/daily-rooms.ts`: room creation now sets `exp = now + PRE_START_BUFFER_SECONDS` (24h)
        instead of `now + durationSeconds` — a generous "how long can this link sit unopened" buffer,
        not the real call length; `eject_after_elapsed` matches it so nobody waiting in the pre-join
        lobby gets ejected early. New `isCountdownStarted(exp, now)` derives "started or not" purely
        from comparing the room's live `exp` against that buffer — still no new datastore, exactly as
        this item specified; Daily's own room object stays the single source of truth. New
        `startRoomCountdown(name, durationSeconds)` re-fetches the room's live config and, only if not
        already started, sets `exp = now + durationSeconds` — the real hard cutoff; if already started
        (by the other trigger), it's a no-op that echoes the existing `exp` back, which is what makes
        "whichever fires first wins" safe against a race between the two triggers. New
        `getRoomStatus(name, fallbackExp)` is a read-only version of the same check.
      - Two new routes: `POST /api/rooms/[room]/start` (called by both triggers below) and
        `GET /api/rooms/[room]/status` (polled by a waiting tab to pick up a start triggered from a
        *different* tab).
      - `src/components/call-media.tsx` became a Client Component and now wraps the existing iframe
        with `daily-js` (`DailyIframe.wrap()` — keeps Daily Prebuilt's own UI, including the pre-join
        lobby, rather than swapping in a custom call surface) and reports live participant counts up
        via a new `onParticipantCountChange` prop — this is how every connected tab detects "a second
        person has joined" straight from the call itself, no server round-trip needed for that path.
      - `src/components/call-room.tsx`: new waiting state ("Waiting to start" + a description of what
        starts it) shown instead of the ticking countdown until `started` is true; a "Start now" button
        and the participant-count callback both call the same `triggerStart`; a status-poll effect
        (every 4s, only while waiting) picks up a start from another tab. CallMedia (the actual call)
        still renders throughout the wait — people already in the lobby/call are genuinely waiting
        together, not blocked from connecting.
      - `src/app/[room]/page.tsx`: links now carry `d` (durationSeconds) alongside `exp`; when `d` is
        present, this page re-fetches the room's *live* status from Daily rather than trusting the
        link's own `exp` (source-of-truth requirement above) and passes `durationSeconds`/`started` down
        to CallRoom. **Backward compatible:** a link minted before this feature (`d` missing) is treated
        as already-started, using its `exp` exactly as before — no existing shared link breaks.
      - `src/components/create-link-form.tsx`: generated links now include `&d=${durationSeconds}`.
      - Verified: `npm run lint`/`npm run build` clean. Full round-trip tested via curl in both mock
        mode and against the real Daily API (locally and again against production after deploy):
        create → page shows "Waiting to start"/"Start now" → status returns `started:false` with the
        buffer `exp` → start returns `started:true` with `exp ≈ now + duration` → calling start again
        with a *different* duration is a no-op (proves the idempotency/race guarantee) → status after
        start confirms `started:true`. Also verified an old-style link (`exp` only, no `d`) still shows
        an immediate ticking countdown, and an already-expired legacy link still shows the ended screen
        — both exactly as before. Test rooms created against the live Daily API were deleted afterward.
        No real second-participant/live-video test was possible in this sandbox (still no working
        headless browser — see STATUS.md), so the join-triggered auto-start path is verified by code
        review and the shared `triggerStart` path (identical to the manual-button path once called) —
        not by an actual two-person call.
- [x] **Vote to end early.** *(Added 2026-07-21, Andreas, interactive: "add to roadmap an option for
      meeting participants to vote for meeting to end, if over 50% vote for it to end it ends
      immediately".)* **Built 2026-07-22 (nightly):** the mirror image of "Start now" above, built
      exactly the way this item's own notes anticipated. `src/lib/daily-rooms.ts` gained
      `endRoomNow(name)` — only ever moves a room's `exp` earlier (never later), idempotent once the
      room is already over. New `POST /api/rooms/[room]/end` route (unauthenticated, same trust model
      as the rest of this stateless app). The vote tally itself is never persisted anywhere: each
      connected tab broadcasts its own vote to every other tab via daily-js's own `sendAppMessage`
      (`src/components/call-media.tsx`), and keeps a live tally by session ID, pruned against who's
      actually still in the room — same "Daily/daily-js state is the single source of truth, no new
      datastore" principle as the rest of Phase 1. A late joiner is caught up by every currently-"yes"
      tab re-broadcasting on `participant-joined`. `src/components/call-room.tsx` renders an
      "End for everyone" toggle (visible once the call has actually `started` — ending a call that
      hasn't started yet isn't a meaningful action) plus a live "N of M want to end early" count, and
      calls the end endpoint itself, exactly once, the instant the tally crosses a **strict majority**
      (`votesToEnd * 2 > participantCount` — resolves the two open decisions from this item's original
      notes: a single participant *can* un-vote, by clicking the toggle again; and yes, exactly 2 of 2
      is required for two participants, not 1 of 2, per Andreas's own "over 50%" phrasing). Mock mode
      has no real daily-js call to tally votes over, so its version of the button ("End call") ends the
      call directly instead of toggling a vote that could never reach a real tally — documented
      limitation, consistent with mock mode's existing participant-count limitation.
      Verified: `npm run lint` / `tsc --noEmit` clean. Full create → start → end round trip via curl
      against a running server in both mock mode and live mode (real Daily API, test rooms deleted
      after) — this caught a real bug live: Daily's REST API rejects an `exp` that isn't strictly in
      the future ("exp was '...', which is in the past rather than in the future"), so a bare `now`
      patch failed with a 400. Fixed by asking for `now + 1` second instead (still "immediately" to a
      human — Daily's own `eject_at_room_exp` enforcement and this page's own 1-second-granularity
      countdown already mean nobody perceives the difference); re-verified with both the full app and
      a standalone script hitting the live Daily API directly, both green. `npm run build` also
      succeeded once, cleanly, before a since-reverted local verification workaround (redirecting the
      build output to work around this session's near-zero sandbox disk space) confused a later lint
      pass by pointing it at generated build output instead of source — not a real code issue, and the
      workaround was never part of the committed change. No real multi-tab vote-broadcast test was
      possible in this sandbox (still no working headless browser) — that part is verified by code
      review and the same defensive try/catch pattern already used elsewhere in this file for
      daily-js-related code, consistent with how every other daily-js feature in this app has been
      verified to date. Deployed: not yet — see STATUS.md/ASKS.md for why (no GitHub push credentials
      present in this session, so this landed as a local commit only; deploy is next).
- [x] Rotating slogan/subtitle on the home page. *(Andreas, 2026-07-21, interactive: first asked for a
      slogan brainstorm, then a review pass to cut the unfunny ones — see `SLOGANS.md` — then "lets
      deploy all the slogans, have them land at random for users.")* `src/lib/slogans.ts` holds the 35
      lines that survived the second review pass, plus `pickRandomSlogan()`; `src/app/page.tsx` renders
      the pick as an italic tagline under the "Qwickword" h1, above the existing explainer paragraph
      (kept — several slogans are pure jokes with no mechanism explanation, and a first-time visitor
      still needs the plain description of what the product does). Route forced to
      `dynamic = "force-dynamic"` so Next.js actually re-picks per request instead of freezing one
      random line in at build time (same purity-driven pattern as `src/lib/time.ts`: the random pick
      lives in a plain named function, not an inline `Math.random()` call in the Server Component's
      render body). Verified: `npm run lint`/`npm run build` clean, build output confirms `/` switched
      from static (`○`) to dynamic (`ƒ`), and curl-tested repeated requests against both a local dev
      server and the live production site got distinct slogans back nearly every time — genuine
      per-request randomness, not a frozen build-time value. Deployed same session; live on
      `https://qwickword.com`. `SLOGANS.md` stays the editable source list going forward.
- [ ] Duration presets (1, 2, 5, 10 min) plus a custom value with a sane maximum.
- [x] Countdown polish: large shared timer, colour shift and a subtle cue at T-30s and T-10s.
      *(Note added 2026-07-21, Andreas, interactive: wants a friendly, non-onerous audio cue in the
      last seconds, not just visual — a very soft/low-volume tick starting around T-10s, becoming a
      little more audible from T-5s down to zero. Keep it gentle and friendly in character, matching
      the product's overall tone, not an alarm. For later: build both the visual and audio cue
      together as this one item.)*
      **Built 2026-07-21, same day, interactive ("also shift to gentle reddish by t-minus 10"):**
      `src/components/call-countdown.tsx` — the existing amber "ending" colour (T-30s to T-11s) is
      unchanged; a new, softer `rose` colour stage (Tailwind's `rose`, not `red` — deliberately gentler
      than the harsher red used once the call has actually ended) now covers T-10s down to T-1s. A
      plain Web Audio API oscillator plays one short, soft tick per whole second across that same
      T-10s-to-T-1s window — no audio file asset needed — quietly louder each second as it approaches
      zero (volume ramps ~0.04 to ~0.14), wrapped in try/catch since a blocked/unsupported
      `AudioContext` should degrade silently, never break the visual countdown. Became a Client
      Component (`"use client"`) to hold the small amount of state this needs (which second was last
      ticked, the `AudioContext` instance itself), but is otherwise still a stateless renderer reacting
      to the `remainingMs` CallRoom passes it — no clock of its own. Verified: `npm run lint`/`npm run
      build` clean; curl-checked a countdown at 8s remaining renders the new `rose` class and one at
      20s remaining still renders the existing `amber` class, confirming the two visual stages don't
      collide. The audio side can't be verified via curl (it's a client-side Web Audio effect with no
      DOM trace) — verified by code review and the same defensive try/catch pattern used elsewhere in
      this app for anything audio/daily-js related, not by an actual browser test (still no working
      headless browser in this sandbox).
- [ ] Fully responsive layout; verify the call works on a phone browser.
- [~] **Basic brand pass, including the rename to "Qwickword."** *(Andreas, 2026-07-21, interactive:
      "We're changing the name to Qwickword.com." He already owns the `qwickword.com` domain.)*
      **Text rename done 2026-07-21, later the same day (interactive — "lets just run the renaming now
      and redoing of banner text etc," done on the spot, not queued):** every user-facing "Quick Word"
      string renamed to "Qwickword" across the app — `src/app/layout.tsx` (page title), the home page
      and call page headings/links, the create-link form's button/label/ready-text, the "ended" and
      invalid-link screens' headings and messages, the Daily iframe's `title`, both `console.log`/
      `console.warn`/`console.error` prefixes, `src/lib/duration.ts`'s comment, and `package.json`'s
      `name` field (`quick-word` → `qwickword`). Also renamed throughout the living docs —
      `README.md`, `BUILD_PLAN.md`, `REVENUE.md`, and this file's own title/positioning/still-open
      item text — but **deliberately left every already-dated `[x]`/`[~]` "done" annotation and every
      STATUS.md/ASKS.md historical run-history entry untouched**, since those are an honest record of
      what the app actually said and did on those past dates, not living copy — rewriting them to
      retroactively say "Qwickword" would misrepresent the history. Used "Qwickword," one word,
      capital Q, matching how Andreas has written it every time — not separately re-confirmed
      letter-for-letter, flagging in case that's not quite right. One phrasing case worth his eyes:
      "This Qwickword has ended." (the call-room end screen) reads slightly less naturally than the
      old "This Quick Word has ended.", since the two-word name doubled as the English idiom "have a
      quick word" and that wordplay doesn't carry over to the new one-word name — happy to rephrase
      (e.g. "This call has ended.") if he'd rather.
      **Favicon done too, same session (Andreas: "update the navicon to a Q"):** generated
      `src/app/favicon.ico` (black rounded square, bold white "Q", 5 embedded sizes) and
      `src/app/icon.svg` (crisp modern-browser version), replacing the leftover default Next.js
      placeholder icon. Live-verified both serve correctly on `qwickword.com`.
      **Still not done — separate follow-up, not attempted tonight:** an actual logo (beyond the
      favicon's simple letterform), a considered colour palette, and Open Graph / meta tags so a
      pasted link shows a nice preview (e.g. "A 2-minute Qwickword"). This needs real visual design
      work, not a text find-and-replace — keeping it as its own follow-up.
      Verified: `npm run lint`/`npm run build` clean, curl-tested both modes (mock and live) against a
      live dev server confirming zero remaining "Quick Word" occurrences anywhere in a rendered page,
      then **deployed to production** and re-verified live on both `https://qwickword.com` and
      `https://quickword.vercel.app` — see STATUS.md for the full verification detail.
- [x] Dark mode vs. default/light mode toggle. *(Added 2026-07-21, Andreas, interactive — "add to the
      pipeline of features," not built that night.)* **Built 2026-07-22 (interactive: "introduce the
      toggle top left corner... to dark mode so basically I'd say the default is dark mode and then...
      someone who doesn't like dark mode can switch it off").** Went with the opposite default from
      this item's original framing — dark by default, light as the opt-out — per Andreas's explicit
      instruction this time, not the "light default" reading guessed at below when this was first
      queued. Mechanics landed exactly as anticipated: `src/app/globals.css` switched from
      `@media (prefers-color-scheme: dark)` to Tailwind v4's `@custom-variant dark
      (&:where(.dark, .dark *));`, keyed off a `.dark` class on `<html>` (`src/app/layout.tsx`) rather
      than the OS setting alone. `src/components/theme-toggle.tsx` (new) is the switch — toggles the
      class and remembers the choice in `localStorage` (`qwickword-theme`), per-browser, no accounts,
      matching Andreas's standing "no login/account system for this or anything else" stance from earlier
      dark-mode/settings-menu discussions. A small blocking inline `<script>`
      in `layout.tsx`'s `<head>` (runs before paint, only ever *removes* the server-rendered dark
      default when `localStorage` says "light") avoids a flash-of-wrong-theme on repeat visits who'd
      chosen light. Verified: `npm run lint`/`tsc --noEmit`/`npm run build` clean as part of the same
      day's larger call-UI-rebuild verification pass (see the item below) — see STATUS.md.
- [ ] Settings menu on the home page: a small icon in a corner (hamburger or gear — Andreas said
      "like a hamburger," not necessarily literally one) opening a panel to pre-set camera/microphone
      and sound preferences *before* joining a call. *(Added 2026-07-21, Andreas, interactive: "add to
      roadmap... ability to set sound and video there so you dont do it while the clock is ticking."
      Not built tonight.)* Motivation, in his words: fiddling with device/audio settings should happen
      here, ahead of time, not burn seconds of the countdown once a call has actually started — the
      same "don't waste the clock on setup" concern behind the "anchor countdown to first join" item
      above and behind item 1's `enable_prejoin_ui` lobby (Daily's own camera/mic check, which already
      happens *inside* the call once someone joins — this item is the equivalent choice made earlier,
      from the home page, before a link is even created). One term worth clarifying at build time
      rather than guessing: "sound" could mean which speaker/output device to use, or could mean
      on/off and volume for the T-10s/T-5s countdown audio cue from the "Countdown polish" item above
      — plausibly both belong in the same panel, but confirm with Andreas rather than assume only one.
      Likely mechanics for actually applying a chosen camera/mic to the call itself: the call embed is
      currently a plain `<iframe src="...">` with no `daily-js` call object (Phase 0 item 5's choice),
      so passing a pre-selected device through to Daily's own prejoin lobby will need investigating —
      Daily either supports this via specific URL query params or requires switching to the `daily-js`
      SDK (same tooling gap already flagged in the "anchor countdown to first join" item above);
      validate against Daily's live docs before assuming either way, per this project's standing habit.
      **Persistence — Andreas asked "still just attached to your session cookie if we have that":** to
      be clear for whoever builds this, there is no session/cookie mechanism in the app today — it's
      fully stateless (Phase 0's design, reaffirmed by the still-open "decide the backend" item further
      below). This should use the same lightweight, no-account approach just established for dark mode
      (`localStorage` or a plain non-auth cookie, remembered per-browser, zero server-side state) —
      not a real user "session" in the account/login sense. No new datastore, no login, consistent with
      Andreas's explicit "no accounts right now" stance from the dark-mode discussion above.
- [x] `[needs-andreas]` Connect the `qwickword.com` domain to the live Vercel deployment.
      **Done 2026-07-21 (interactive).** Andreas saved the corrected DNS records in GoDaddy and they
      propagated fast — confirmed via `GET /v6/domains/qwickword.com/config`: `misconfigured: false`.
      Live-smoke-tested `https://qwickword.com/` directly: home page `200`, no stale banner text (see
      the banner-removal entry in STATUS.md, deployed in the same push), and a real `POST
      /api/rooms` round-trip against the live site (room created on Daily, confirmed, then deleted —
      no debris left). `https://www.qwickword.com/` also resolves (`200`, redirects to the apex per
      the redirect setting chosen when the domain was attached). `https://quickword.vercel.app` still
      works too. **The Daily.co video subdomain rename noted below remains open/optional** — not part
      of what "done" means for this item.
      **2026-07-21, earlier the same day (interactive):** Andreas was already live in his GoDaddy DNS panel
      about to add a (subtly wrong — a URL, not a hostname, as the CNAME value) `www` record, so this
      was done on the spot rather than left for the nightly run. Requested access to
      `C:\Users\acnic\ClaudeCoding` again (same folder as Phase 0 item 9), read only the
      `VERCEL_TOKEN` line from `secrets.blackstart.local.txt` again, and via the Vercel API: confirmed
      the `quickword` project (`prj_JS71RabWYJSg6h4Jw4H0sBE1mXpL`, same dedicated project as always —
      no new/shared infra touched) currently had only `quickword.vercel.app` attached; added
      `qwickword.com` (canonical) and `www.qwickword.com` (set to redirect to the apex — Andreas's
      call to revisit if he'd rather `www` be canonical) via `POST /v10/projects/quickword/domains`;
      then fetched Vercel's actual required DNS config for this specific domain via
      `GET /v6/domains/{domain}/config` rather than assume generic/legacy values. Result:
      `misconfigured: true` (expected — GoDaddy's DNS hasn't been changed yet) with Vercel's exact
      recommended records — apex A record(s) (`76.76.21.21` as the simple/legacy option, still fully
      supported, or the pair `216.198.79.1` / `64.29.17.1` as Vercel's newest top recommendation) and
      a **project-specific** CNAME target for `www` (`c2efecf6f5ce6b0c.vercel-dns-017.com` — this is
      unique to this domain/project, not a generic Vercel hostname, which is exactly why generating it
      via the API mattered instead of writing down a guessed value). Gave Andreas the exact corrected
      values directly in chat (not just queued in ASKS.md, since he was live) along with what to
      delete (GoDaddy's default parking `A @ → WebsiteBuilder Site` record, which would otherwise
      conflict with the apex A record). **Still needs Andreas — did not touch DNS itself, only the
      Vercel-side domain attachment**, consistent with BUILD_PLAN.md's guardrail against touching any
      registrar/DNS zone without his own hands on it: he needs to actually save the corrected records
      in GoDaddy, then wait for propagation (usually minutes, can be a couple hours). (This is what the
      "Done" note above records completing, later the same day.) **Not in this item's scope, flagging as a separate,
      lower-priority decision for Andreas to make whenever:** whether to also rename the Daily.co video
      subdomain (currently `quickword.daily.co`, set in `.env.local`'s `DAILY_DOMAIN`) — it's visible to
      end users via the "open the call in a new tab" fallback link, so it'll read as a small
      inconsistency post-rename, but changing it is an account-level Daily setting (may need contacting
      Daily support) and isn't required for the product to work correctly under the new name.
- [ ] Decide and document the backend: start with no database (stateless rooms encoded in the link),
      and only add a datastore when a feature actually needs one. Record the decision in STATUS.md.
      *(Note added 2026-07-21: the "anchor countdown to first join" item above already found a way to
      do this without a datastore, by re-reading Daily's own room object instead of adding one — this
      item should record that as the actual decision once built, not treat it as still open.)*
- [ ] Privacy-friendly, cookie-light analytics (e.g. self-host Plausible-style events) capturing the
      core funnel: link_created → link_opened → call_started → call_completed → cta_clicked.
      *Done when:* those five events fire and are queryable.
- [x] **Our own "Leave call" button, outside the Daily iframe, instead of relying only on Daily
      Prebuilt's own in-frame Leave button.** **Superseded and delivered 2026-07-22, same day, by the
      call-object-mode rebuild below**, which was built the very same session — rather than adding a
      "our own Leave button" onto the still-iframe-based UI as originally scoped, that whole UI was
      replaced. `src/components/call-controls.tsx`'s `handleLeave` calls the call object's own
      `.leave()` directly (no iframe, no bridge to find out after the fact — the exact mechanism this
      item asked for) and immediately swaps `call-room.tsx` to the "You've left this call" screen, no
      dependency on any event firing back. The presence-based backstop poll from earlier the same day
      (Daily's `GET /rooms/:name/presence`, still in `call-room.tsx`) remains in place underneath it,
      exactly as this item anticipated, for any other way a tab can stop being in the call (losing
      connection, being ejected at `exp`, etc.) — not replaced, just no longer the *only* path for the
      common "clicked Leave on purpose" case. *(Original ask, 2026-07-22, Andreas, interactive: "Instead of
      relying on the daily app to provide us the exit button to leave a meeting can we instead have
      our own button that sits outside of the frame... in such a way that we are in control and we
      understand when a meeting has been ended because at the moment it seems like when we end a
      meeting the main page that contains the frame is not informed that the meeting has ended and so
      the countdown just keeps going.")* Same day, earlier: this exact symptom (countdown/"Waiting to
      start" UI stuck after a real leave) was fixed with a server-side presence backstop (Daily's own
      `GET /rooms/:name/presence`, polled from `/api/rooms/[room]/status` — see STATUS.md and
      `src/components/call-room.tsx`) plus a retry around `DailyIframe.wrap()`, because every existing
      signal depended on that one wrap() bridge working. This item is a complementary, more direct fix
      for the specific case of *leaving on purpose*: right now the only Leave control a participant
      sees lives inside Daily Prebuilt's own iframe UI, so our page has to *find out* the call ended —
      via an event (`left-meeting`) or a poll — rather than *knowing* it, because our own code didn't
      initiate the leave.
      **The fix:** render our own "Leave call" button in `src/components/call-room.tsx`, in the same
      row/area as the existing "End for everyone" vote toggle (Phase 1's "Vote to end early" item) —
      both are per-tab call-management controls that belong in our own chrome, not inside Daily's
      iframe, so they should live together, visually distinct from each other (leaving is personal —
      the call may keep running for whoever's left; ending is for everyone). On click: call the wrapped
      `daily-js` call object's `.leave()` directly (the same `callObjectRef` `call-media.tsx` already
      holds internally — this needs a new prop, e.g. exposing a `leave()` callback up through
      `onLeftMeeting`'s sibling, or lifting a ref, since `callObjectRef` is currently private to that
      component). Because our own code initiates the leave, it can set `hasLeft` the moment the
      `.leave()` promise resolves — no dependency on any event firing back from the iframe for this
      specific path, unlike today's `left-meeting` listener.
      **Loading/error handling, matching the pattern already used for Start/End:** disable the button
      and show a brief "Leaving…" state while the promise is in flight (same shape as `triggerStart`'s
      `starting` state and `triggerEnd`'s `endingRef` guard); if `.leave()` rejects (should be rare —
      network hiccup, or the call was already over), fall back to the existing detection paths rather
      than getting stuck — don't leave the user with a button that silently does nothing.
      **Open question to validate at build time, not assume:** whether Daily Prebuilt's own in-frame
      Leave button can be hidden via a room/token config option, so there's exactly one Leave control
      on the page instead of two doing the same thing. Check Daily's current REST API docs for a
      `properties`/prejoin-UI flag that suppresses it (Daily has iterated on Prebuilt's customization
      surface before, so don't assume today's docs match this project's earlier research). If there's
      no such flag, that's fine — a redundant second Leave button inside the iframe isn't harmful, just
      a little inelegant, and can be left alone until the call-object-mode rebuild (below) replaces
      Prebuilt's iframe entirely and removes the redundancy for good.
      **Mobile placement:** needs to sit somewhere that survives the mobile viewport fix already shipped
      for the `/test` v2 preview (`fixed`/`h-dvh`, no scroll-to-reach-controls) — today's production
      `/[room]` page doesn't yet use that pattern (it's a scrollable page with the iframe as one block,
      not the v2 preview's full-viewport lock), so this button just needs normal responsive placement in
      that existing layout, not a new fixed-positioning scheme of its own.
      This doesn't replace the event listener/backstop poll/presence check already in place (Daily
      Prebuilt's own in-frame Leave button, if it can't be hidden, still needs those, and so does any
      other way a tab can stop being in the call — losing connection, being ejected at `exp`, etc.) —
      it's an additional, more direct path for the common case of a participant clicking "Leave" on
      purpose. The call-object-mode rebuild's `/test` prototype already has exactly this pattern for
      reference (`src/components/call-v2/call-controls.tsx`'s `handleLeave`, which calls
      `daily.leave()` directly since that whole UI is already built outside any Daily-hosted iframe).
      *Done when:* clicking Qwickword's own Leave button ends the call for that tab and shows the
      "You've left this call" screen immediately (not within the presence-poll backstop's ~20s window),
      the button correctly disables/re-enables around the in-flight `.leave()` call, a rejected
      `.leave()` doesn't strand the UI, and — noted honestly, consistent with how every other daily-js
      feature in this project has been verified — this sandbox still has no working headless browser, so
      final confirmation needs an actual two-tab click-through, not just code review.
- [x] Rebuild the call UI on Daily's call-object mode (full custom UI, `@daily-co/daily-react`),
      replacing today's Daily Prebuilt iframe embed, styled to look and feel like Google Meet:
      full-bleed video, a small floating control pill instead of a full-width bar, self-view as a
      corner PIP, "Qwickword" + the live countdown as a translucent overlay on the video instead of a
      banner above it. Andreas, interactive, 2026-07-22: after asking whether the call window could be
      maximized and Daily Prebuilt's own banners shrunk (answer: only partially — Daily Prebuilt's own
      chrome isn't ours to resize past color theming), he chose the full rebuild: "i like the rebuild
      full control... We want it to look very similar to Google Meets." Full spec in
      `CALL_UI_REBUILD_SPEC.md`.
      **Built as a parallel `/test` preview first** (this same day, then iterated on over several
      follow-up sessions — mobile viewport fix, prejoin device-select alignment, never-crop video
      fix, cursor-pointer sweep — see this file's other entries and STATUS.md), **then promoted to be
      the production default and the preview route deleted, 2026-07-22 (Andreas, interactive: "the
      test setup as now being the default setup... at least as it relates to the video view... that is
      now the standard").** In the same pass: the "Start now" button moved off its own floating
      top-right pill and into the same control bar as mic/camera/share/leave
      (`src/components/call-controls.tsx`, equal `h-11` height, matching format); the countdown timer
      grew to `sm:text-4xl` on desktop (`src/components/call-overlay.tsx`); the camera-off avatar
      fallback for the main tile gained a bordered aspect-video box instead of a flat black fill, so
      the outline of where video would normally render stays visible
      (`src/components/call-video-grid.tsx`'s `MainAvatarFallback`). Every reliability feature the old
      iframe-based flow had earned through real production bugs was ported onto the call-object
      lifecycle rather than dropped: the cross-tab waiting poll, the clock-skew resync poll, the
      presence-based leave/empty-room backstop (all still in `src/components/call-room.tsx`), the T-10s
      audio tick (folded into `call-overlay.tsx`), and vote-to-end-early (re-homed to
      `src/components/call-end-vote.tsx`, using `useDaily()` instead of wrapping an iframe, same
      app-message broadcast/tally mechanism). `src/app/[room]/page.tsx` dropped its old light
      `PageShell` header/footer wrapper for a full-bleed black `fixed inset-0 h-dvh w-dvw` layout
      matching the new UI; `src/components/invalid-link-screen.tsx` restyled to match.
      `src/app/test/` and `src/components/call-v2/` (the preview scaffolding), plus the old
      iframe-based `src/components/call-media.tsx` and `src/components/call-countdown.tsx`, were all
      deleted the same day the promotion shipped — see STATUS.md for the full verification detail.

## Phase 2 — Shareable: build the growth loop
Goal: every call quietly recruits the next user.

- [ ] Zero-friction creation: a first-time user can make a link without signing up.
- [ ] "Powered by Qwickword" mark on the call and on the "Time's up" screen, linking to create-your-own.
- [ ] Post-call CTA screen: "Create your own Qwickword" as the primary action.
- [ ] Rich share: OG image that renders the chosen duration; native share sheet on mobile.
- [ ] Optional lightweight accounts via magic-link email, so a user can save and reuse links.
      *(Add a datastore here if not already added.)*
- [ ] Reusable personal link (e.g. `quickword.co/andreas`) that always opens a fresh capped room.
- [ ] Calendar hooks: "Add to Google/Outlook Calendar" and an .ics download for a scheduled Qwickword.
- [ ] Opener notification: email the creator when someone opens or joins their link.
- [ ] Feedback mechanism: a lightweight way for users to tell us what they'd want to see next (e.g. a
      simple in-app form, or even just a `mailto:`/typeform-style link on the "time's up" or post-call
      screen — doesn't need to be fancy for a first version). *(Added 2026-07-21, Andreas, interactive.)*
- [ ] **A literal 2-minute survey, hard-capped like every other Qwickword.** *(Added 2026-07-21,
      Andreas, interactive: "a 2-minute survey about who you are and why you use qwickword... so that
      we can literally close the survey at exactly 2 minutes (The joke is obviously that we meant 2
      minutes!)".)* The joke only lands if it's mechanically real: build the survey as an actual
      Qwickword-style timed session (reuse the existing countdown/hard-end components and the same
      "no extend, ever" enforcement, not a separate fake-timer widget) — everyone who's ever said
      "quick 2-minute survey" was lying, so this one should actually, verifiably end at 2:00.
      - **Data must survive the cutoff — this is the part that actually needs a datastore.** Andreas
        was explicit: "each response is logged as soon as the checkbox is checked," not batched into
        one submit at the end, specifically so a respondent who's mid-survey when the clock hits zero
        doesn't lose what they'd already answered. This means a real, persistent backend for the first
        time in this project — ties directly into the still-open "Decide and document the backend"
        item above. Likely mechanics: a lightweight anonymous session token (generated client-side when
        the survey loads, no login — consistent with Andreas's standing "no accounts right now" stance
        from the dark-mode/settings-menu discussions above) that per-answer writes get tagged with, so
        incremental answers land as one respondent's row rather than orphaned fragments.
      - **Question order matters because of the cutoff, not despite it.** Andreas: "the most important
        data should be upfront... industry and role and other valuable marketing info" — front-load
        whatever's most valuable to lose least if someone runs out of clock partway through. Concretely:
        identity/context questions (industry, role, why they use Qwickword) before anything exploratory
        or open-ended.
      - **Needs a response counter.** Andreas asked for one explicitly; not yet specified whether it's
        admin-only (a simple count Andreas can check) or shown publicly (e.g. "312 people told us who
        they are" as social proof) — confirm which at build time rather than assume.
      - **Not yet decided, worth a quick check with Andreas before building:** where this survey is
        linked from (the "This Qwickword has ended" screen? A standalone link? Both?) — it overlaps
        with the "Post-call CTA screen" item above; may be worth building as one of that item's CTAs
        rather than a fully separate flow.

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
- [ ] Admin "reclaimed" dashboard driven by REAL usage: count of Qwickwords held, estimated
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
- [ ] `[needs-andreas]` Donate / support-the-project option: a simple, low-pressure way for users to
      chip in toward running costs (Daily's API isn't free once real usage shows up), separate from
      the Pro/Stripe billing plan above — think a single "Support Qwickword" link/button, not a full
      payment flow. Needs Andreas to pick and set up the actual mechanism (e.g. a Stripe Payment Link,
      Buy Me a Coffee, Ko-fi, GitHub Sponsors) since that means creating/connecting a real account —
      per BUILD_PLAN.md's guardrails, that's not something to do autonomously. *(Added 2026-07-21,
      Andreas, interactive — motivation noted verbatim: he'll be paying for the Daily API himself to
      keep the video calls running, and wants a way for users who like the tool to help cover that.)*

## Phase 4 — Fantastic: feature-rich and delightful
Goal: the version people evangelize. Re-prioritize this phase based on what Phase 2–3 data shows.

- [ ] Agenda field per link ("the one thing to discuss"), shown to both parties before the call.
- [ ] Timer modes: hard-stop (default), soft-warning-then-stop, and a per-speaker time split.
- [ ] Meeting-cost estimator: optional live "$ spent so far" based on attendee count — a marketing hook
      that reinforces the "time is money, keep it short" story.
- [ ] AI post-call summary / action items (respecting the short format; opt-in; storage-light).
- [ ] In-call extras kept deliberately minimal: text chat, reactions, short screen-share.
- [ ] Slack app + Chrome extension: create a Qwickword link from where you already are.
- [ ] Embeddable widget / public API so others can drop timed calls into their product (Whereby-style;
      this is also a second revenue line — see REVENUE.md).
- [ ] Recurring Qwickwords and "micro office-hours" scheduling.
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
