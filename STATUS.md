# Qwickword — Status Log

**How to use this file:** At the start of every run, read this file top to bottom to learn the
current state. At the end of every run, update the "Current state" block and append a dated entry
to the "Run history" log. Keep it honest — record what actually works, not what was attempted.

---

## Current state
- **Phase:** Phase 0 (MVP) is fully complete, deployed, and verified. All 9 ROADMAP.md items are
  done. Phase 1 ("Usable") is now underway — item 1 (pre-join screen) and the rotating-slogan item
  both done 2026-07-21, see below.
- **Vote to end early (Phase 1, built 2026-07-22, nightly; not yet deployed):** once a call has
  `started`, an "End for everyone" toggle plus a live "N of M want to end early" count let
  participants cut a call short — the instant a strict majority (>50%) has voted, the room's `exp` is
  set to right now (well, `now + 1s` — see below) and the existing hard-end screen takes over, same
  mechanism as the timer running out naturally. New `POST /api/rooms/[room]/end`
  (`src/lib/daily-rooms.ts`'s `endRoomNow`); the vote tally itself is never persisted anywhere — it
  lives in daily-js `sendAppMessage` broadcasts between connected tabs
  (`src/components/call-media.tsx`), pruned against who's actually still in the room. Caught and fixed
  a real bug while verifying against the live Daily API: `exp` must be strictly in the future, so a
  bare `now` got rejected with a 400 — fixed by asking for `now + 1` second instead. **Not deployed
  yet** — this session had no GitHub push credentials available (`secrets.local.txt` with
  `QWICKWORD_GITHUB_PAT` wasn't present in this run's environment), so the change is a local commit
  only for now; see ASKS.md/the run-history entry below for full detail and what unblocks the deploy.
  **Update, later the same day (interactive): now deployed.** See the interactive run-history entry
  below — Andreas granted access to the parent `C:\Users\acnic\ClaudeCoding` folder, which is where
  `secrets.local.txt`/`secrets.blackstart.local.txt` actually live (outside the `QuickWord` folder
  itself, which is why the nightly run couldn't reach them). Pushed to GitHub and deployed to
  production. Live on `https://qwickword.com`.
- **One-click duration preset buttons reinstated (2026-07-22, interactive, deployed to production):**
  Andreas: "Reinstate the buttons, so you can still click a duration and get taken straight to the
  confirmation with link added to clipboard. We want 1, 2, 5, 10, 15, 20 minutes. and keep the manual
  entry as well and the max of 30 minutes." This closed out a stray uncommitted change already sitting
  in the project folder (see ASKS.md, now resolved) that had replaced the preset buttons with a
  manual-only minutes field. Merged both: `src/components/create-link-form.tsx` now shows a row of
  preset buttons (`DURATION_PRESETS_SECONDS`, `src/lib/duration.ts`) that call `handleCreate()`
  directly with no separate submit step, plus the manual minutes field below it (own "Create" button,
  bounded 1–30 min via `MIN_/MAX_DURATION_MINUTES`) for anything the presets don't cover. Removed the
  now-unused `CUSTOM_DURATION_MINUTES_OPTIONS` export from `duration.ts` (was for a dropdown that no
  longer exists). Verified: `eslint src` / `tsc --noEmit` / `next build` all clean (run from a synced
  `/tmp` scratch copy, since this sandbox's `node_modules/.bin` symlinks are broken over the mount).
  Live-smoke-tested: home page 200s, and a real `POST /api/rooms` with the 1-minute preset's payload
  against `https://qwickword.com` created a room successfully. Live on `https://qwickword.com`.
- **v2 preview follow-up: identity/labeling, countdown bug, page parity, pin+drag self-view, screen
  share (2026-07-22, interactive, deployed to production):** Andreas tried the first version of `/test`
  and came back with a real punch list rather than a general impression:
  1. "it refers back to itself as a test which defeats the purpose" — removed the "v2 preview"
     badge/link from the call page entirely; every error screen now uses production's exact copy
     instead of saying "preview."
  2. "the landing page didn't look in any way like the original... those two pages should be completely
     identical" — extracted the real home page's markup into `src/components/home-content.tsx`; `/test`
     now renders that exact same component, `basePath="/test"` the only difference (feeds into
     `CreateLinkForm`'s new `basePath` prop, which points generated links at `/test/[room]`).
  3. "the number counter went wrong again so it started at 1400" — the overlay was rendering the
     pre-start-buffer `exp` as a ticking number before the countdown had actually started, same failure
     shape as the earlier "1400.56 seconds" bug in a new component. Now shows "Waiting to start" until
     `started`, matching production.
  4. "for the self view it should be possible to pin myself... it was impossible for me to see how big
     the screen actually was unless I had someone else join" — solo now auto-shows the local participant
     as the full main tile, not a tiny PIP next to an empty placeholder; added an explicit pin/unpin
     control for after a second person joins.
  5. "the card... was very close to the edge of the browser Also I couldn't move it around" — the
     self-view PIP is now draggable (pointer events, clamped to the video container's bounds via a
     bounds calculation at drag-start) and starts further from the edge.
  6. "there's no monogram or any indication... the video is off" — camera-off now shows a generic avatar
     circle instead of plain black, on both the main tile and the PIP.
  7. "we also need to be able to share screen like in Google Meet" — added via `useScreenShare`; an
     active share takes the main spotlight (Meet's own convention), both camera feeds drop to a small
     strip.
  8. "the settings... were not properly centered under the video... same width" — the prejoin's video,
     device pickers, and Join button now share one width-controlling wrapper instead of three separately
     declared `max-w-xl` elements that could drift apart.
  Verified `eslint`/`tsc --noEmit`/`next build` clean; live-smoke-tested `/test` vs `/` (confirmed
  structurally identical rendered markup aside from the `basePath` value), a real room create + `/test/[room]`
  round trip (200, no "preview" text anywhere in the response).
- **v2 call UI prototype built and deployed under /test (2026-07-22, interactive, deployed to
  production):** Andreas: "Can we build this in parallel to the existing quick word just under a folder
  like '/test' Just to see what it looks like before we start overriding the current view." Built the
  spec's first several steps as a real, working preview — live on `https://qwickword.com/test`,
  completely separate from the production `/[room]` flow (different route tree, own components under
  `src/components/call-v2/`), so nothing here can affect a real call. New dependencies:
  `@daily-co/daily-react` (its state peer dep is `jotai`, not `recoil` — the npm page's sample text was
  stale; confirmed the actual peerDependencies via `npm info`) and `lucide-react` for control icons.
  Built: a custom prejoin screen (camera preview via `startCamera()`, device pickers, mic/camera
  toggles), full-bleed video with self-view as a corner PIP, a floating bottom control pill
  (mic/camera/leave), and the countdown + "Qwickword" as a translucent overlay on the video — reusing
  `formatRemaining` (newly exported from `call-countdown.tsx`) so the countdown math itself stays
  identical to production. `/test` rooms are real Daily rooms via the same `POST /api/rooms`/`start`
  routes production uses (real hard expiry, real auto-start-on-second-join), so this is a genuine
  preview of the call, not a static mockup — the trade-off is `/test` rooms also land as real rows in
  the Neon stats table (low volume, accepted as harmless test data rather than building a skip-stats
  flag for a throwaway route). Deliberately reduced scope vs. production, per the spec's suggested build
  order: no "End for everyone" vote, no leave-detection backstop poll, no clock-skew resync poll yet —
  those port over in a later pass once the visual direction is confirmed. Verified
  `eslint`/`tsc --noEmit`/`next build` clean; live-smoke-tested `/test` (200, renders), a real room
  create via `POST /api/rooms`, and `/test/[room]` with that room's real `exp`/`d` (200, renders). Not
  yet live-tested with a real second participant/two browsers (same sandbox limitation noted throughout
  this file) — next step is Andreas trying it live and giving a read on the visual direction before any
  more of the spec gets built out or the production route gets touched.
- **Call UI rebuild spec written, not yet built (2026-07-22, interactive, docs only — no deploy):**
  Andreas asked whether the call window could be maximized further and Daily Prebuilt's own banners
  shrunk or overlaid with our branding. Researched Daily's actual customization tiers (color theming +
  CSS injection into Prebuilt via `createFrame()`, vs. full "call-object mode" where we render every
  pixel ourselves via `@daily-co/daily-react`) and laid out three options by effort. Andreas picked the
  full rebuild: "i like the rebuild full control... We want it to look very similar to Google Meets."
  Wrote `CALL_UI_REBUILD_SPEC.md` — screen-by-screen breakdown (prejoin, in-call, ended/left), Meet
  conventions to borrow (full-bleed video, floating control pill, self-view PIP, branding as a video
  overlay not a banner, dark by default, zero decorative chrome during the call), the daily-react
  architecture, a component map (today's files → their replacements), what's explicitly out of scope,
  and an honest effort/risk section — this is a multi-session rebuild, not a quick tweak, and this
  sandbox still has no way to run a real two-browser live test, which matters more here than for any
  prior daily-js change since it touches rendering, not just event wiring. Logged as a new (unchecked)
  Phase 1 ROADMAP.md item pointing at the spec. Nothing has been built yet — next step is the prejoin
  screen (see the spec's suggested build order), pending Andreas's answers to the spec's open questions
  (layout for two participants, self-view PIP behaviour, whether `enable_prejoin_ui` is still needed,
  how literally to match Meet's own icon/colour language).
- **Create button color, corrected once more (2026-07-22, interactive, deployed to production):**
  Andreas rejected the previous attempt at this same complaint: "That's not exactly a solution since we
  already have two minutes as an option and I don't want that field to be pre filled... the button
  should just be 1 color and should never change color... leave the field empty and make sure that
  that button never changes color it just stays white all the time." Reverted the `minutesInput`
  pre-fill from the previous commit — back to starting blank. The actual fix is on the button itself:
  dropped `disabled:opacity-60` and scoped the hover colour change to `:enabled`
  (`hover:enabled:bg-zinc-800`/`dark:hover:enabled:bg-zinc-200`), so the "Create Qwickword" button is
  always solid black (white in dark mode) regardless of whether the field currently holds a valid
  value — invalid input still can't submit (`disabled` + `cursor-not-allowed` + the existing hint text),
  it just no longer looks different when it can't. Verified `eslint`/`tsc --noEmit`/`next build` clean;
  live-smoke-tested the deployed HTML directly — confirmed `value=""` on the field and no
  `disabled:opacity-60` anywhere in the submit button's class list.
- **Create button starting disabled/greyed on load, same-day follow-up (2026-07-22, interactive,
  deployed to production):** Andreas: "you didnt fix the button still beying greyed out. and i know its
  greyed out because it still goes white when i type in a manual number in the manual minutes box." Real
  root cause, distinct from the earlier `bg-foreground` colour fix: the manual minutes field
  (`minutesInput`) started empty as part of today's earlier preset-buttons redesign, so `isValidDuration`
  was false on first render — the "Create Qwickword" submit button was genuinely `disabled`, and
  `disabled:opacity-60` on a solid white background renders as grey. Andreas's own diagnosis (typing a
  number turns it white) was exactly right. Pre-filled `minutesInput` with a default (`2`, matching the
  original pre-preset-redesign default) so the button is enabled — full white/black, no dimming — the
  moment the page loads. Verified `eslint`/`tsc --noEmit`/`next build` clean; live-smoke-tested the
  deployed HTML for the pre-filled `value="2"`.
- **Homepage polish + real fix for countdown surviving a left call (2026-07-22, interactive, deployed
  to production):** four quick items in one pass. (1) CTA buttons (Copy link, Join the meeting now,
  Create Qwickword) switched from `bg-foreground`/`text-background` — a near-white gray (#ededed) in
  dark mode, not solid white, per Andreas: "i dont like that the button is not white by default" — to
  explicit solid black/white with a dark-mode flip, matching the rest of the app. (2) The "Link copied to
  clipboard!" toast was conditionally rendered, so it reserved zero space while hidden and the whole
  success screen visibly jumped when its 2.5s timer unmounted it — Andreas: "the green clipboard message
  pushes down the content... when it disappears it makes the content reorient back up." Now always
  rendered, faded via opacity instead of mounted/unmounted, so its height stays permanently reserved.
  (3) Trimmed the homepage tagline per "Remove the 'There is no extend button' text. and it should be
  When the *timer* hits zero, no when *it*." (4) A real bug: "Its still counting down after I leave the
  call. the countdown should disappear after I leave the call" — the `left-meeting` listener from the
  earlier same-day fix was confirmed present in the live production bundle (checked directly against the
  deployed JS chunks) but didn't fire for him in practice. Same shape of problem as the earlier auto-start
  bug: don't trust a single daily-js event. Added a `meetingState()` backstop poll piggybacking the
  existing 2s interval in `call-media.tsx` — an independent, direct read of daily-js's own state that
  fires the same `onLeftMeeting` callback if the event was missed. Verified `eslint`/`tsc --noEmit`/
  `next build` clean; live-smoke-tested the homepage copy changes directly against the deployed HTML.
  The left-meeting backstop itself is, like the auto-start backstop before it, verified by code review
  rather than a real two-browser reproduction (still no headless browser in this sandbox) — worth
  confirming with Andreas on his next real call.
- **Call-stats persistence via Neon Postgres (2026-07-22, interactive, deployed to production):**
  Andreas: "can you help me understand how we store memory of how many calls have been made and how
  many minutes have been done and statistics on calls... I'd want to have that stored somewhere." This
  app has no datastore by design (BUILD_PLAN.md/daily-rooms.ts — Daily's own room `exp` is the single
  source of truth), so the honest answer was: nothing is recorded today. Andreas asked to add one.
  Tried Supabase first (already connected via MCP) but the account was out of free projects; switched to
  **Neon Postgres provisioned through the Vercel Marketplace integration** — a separate free-tier quota
  from Supabase, and it wires `DATABASE_URL` (plus `POSTGRES_*` aliases) directly into every Vercel
  environment for this project with no manual env-var copying. One step needed a human: accepting Neon's
  marketplace terms in a browser (`vercel integration add neon` can't do this non-interactively) —
  Andreas did that, then the CLI install/provisioning completed on retry.
  - New `calls` table (migration run directly against Neon): `room_name` (unique), `duration_seconds`
    (requested length), `created_at`, `started_at`, `ended_at`, `end_reason`.
  - New `src/lib/db.ts`: `recordCallCreated`/`recordCallStarted`/`recordCallEndedEarly`, each a
    fire-and-forget write wrapped in try/catch — a DB hiccup (or `DATABASE_URL` simply being unset, e.g.
    local dev) can never break creating/starting/ending a call. This keeps the "no datastore drives the
    actual call flow" design intact; the DB is purely an observability side-channel.
  - Wired into `POST /api/rooms` (insert on create, skipped for mock rooms), `POST /api/rooms/[room]/start`
    (sets `started_at` once), `POST /api/rooms/[room]/end` (sets `ended_at`/`end_reason='vote_early'`,
    since that route is currently only reachable via the vote-to-end-early feature). A call that simply
    runs its full requested duration has no explicit "ended" write — there's no server hook for that
    (Daily's own `eject_at_room_exp` needs no server involvement) — so `duration_seconds` is the source of
    truth for a call's length unless `end_reason` is set.
  - New dependency: `pg` (+ `@types/pg` dev). Verified `eslint`/`tsc --noEmit`/`next build` clean.
    Live-smoke-tested: created a real 2-minute room against `https://qwickword.com`, confirmed the row
    landed in Neon (`room_name`, `duration_seconds`, `created_at` populated, `started_at`/`ended_at` null
    as expected for a room nobody joined) via a direct query against the same `DATABASE_URL`.
  - **Known pre-existing edge case, not from today's work:** calling `POST /api/rooms/[room]/end` on a
    room that's still in its pre-start buffer (never started) currently 400s — Daily's API rejects the
    `exp` patch as "in the past" even though the room's actual `exp` is ~24h out. Reproduced consistently
    while smoke-testing; not something the stats work touches (`endRoomNow` in `daily-rooms.ts` predates
    this session's stats change). Left as a known issue rather than scope-creeping into a fix — worth its
    own investigation later.
- **Call window overflow bug, same-day follow-up (2026-07-22, interactive, deployed to production):**
  the desktop-wide call window from earlier the same day introduced a real regression — Andreas: "making
  the window larger introduced a new UI bug. we get a window that doesnt fit the browser." Screenshot
  showed the pre-join card pushed far down an oversized empty box, forcing a page scroll. Root cause:
  that fix drove the box's *width* from the browser window (`w-full`) and let *height* follow the 16:9
  ratio (`sm:aspect-video`) — on a wide monitor that produces a box taller than the viewport (e.g. a
  2500px-wide window → a ~1400px-tall box). Fixed in `src/components/call-media.tsx` by flipping which
  dimension drives the ratio: height is now fixed at `70vh` (fits the viewport by construction), width
  follows 16:9 from that, capped at `sm:max-w-full` so it still shrinks on narrow windows. Verified
  `eslint` / `tsc --noEmit` / `next build` clean, home page live-smoke-tested 200 on
  `https://qwickword.com` post-deploy.
- **Live bug fixes + "leave the call" fix + bigger call window (2026-07-22, interactive, deployed to
  production):** Andreas used the app live after the vote-to-end-early build and reported three real
  bugs plus two feature requests in quick succession:
  1. **Countdown flash ("1400.56 seconds"):** right when a call started, the display briefly showed a
     huge stale number (the ~24h pre-start-buffer value, rendered by the M:SS formatter as something
     like "1400:56") before snapping to the real countdown. Root cause: `remainingMs` only recomputed
     once a second on its own `setInterval`, not synchronously the instant `currentExp` itself changed.
     Fixed in `src/components/call-room.tsx` by also firing an immediate zero-delay `setTimeout`
     recompute alongside the regular interval — both live inside the same effect's callbacks (not
     synchronously in the effect body), so this stays clear of `react-hooks/set-state-in-effect`.
  2. **Auto-start unreliable:** the countdown didn't start automatically when his friend joined; he had
     to click "Start now" manually. No definitive root cause found (couldn't reproduce with a real
     two-person browser session in this sandbox — see below), but added a defensive fix: a 2s backstop
     poll of `daily-js`'s `participants()` in `src/components/call-media.tsx`, alongside the existing
     event-driven `participant-joined` listener, so a single missed/delayed event can no longer silently
     block the auto-start.
  3. **Ending ~2 seconds early:** Daily's own server-side `eject_at_room_exp` enforcement was cutting the
     call slightly before the client's own displayed countdown reached 0:00 — client/server clock skew.
     Added a 10s periodic resync of `currentExp` against Daily's own live room status
     (`src/components/call-room.tsx`, reusing the existing `GET /api/rooms/[room]/status` route) once
     `started`, so a long-running countdown keeps re-anchoring to the authoritative source instead of
     drifting further from it.
  4. **"Time to wrap!" text at T-10s:** added alongside the existing rose colour stage and audio tick in
     `src/components/call-countdown.tsx` — same window, same trigger.
  5. **Call window too small vs. Google Meet:** Andreas compared a screenshot; the `max-w-6xl` (1152px)
     cap on the call area (`src/components/call-media.tsx`) left a large gap on any monitor wider than
     that. Dropped to `sm:max-w-none` — the call area now scales with the actual browser width, with
     `PageShell`'s own horizontal padding as the only thing keeping it off the literal window edge.
  6. **"the timer also should go away after we have left the call, no more countdown":** added a new
     `onLeftMeeting` callback to `CallMedia` (daily-js's `left-meeting` event, fired specifically for the
     *local* participant leaving — distinct from `participant-left`, which covers others). `CallRoom`
     now tracks `hasLeft` and swaps to a dedicated "You've left this call" screen in place of the
     countdown/call area/buttons entirely once true — independent of the room's own `isOver`, since the
     call may still be running for whoever else is left in it.
  Verified: `npm run lint` / `tsc --noEmit` / `npm run build` all clean for every change above. The
  auto-start backstop and clock-skew resync are defensive/redundancy improvements verified by code
  review (same standard as other daily-js work in this app) — no real two-tab browser reproduction was
  possible in this sandbox (still no working headless browser). Deployed via the Vercel CLI (installed
  into a sibling directory per the established pattern, token read from `secrets.blackstart.local.txt`
  in the now-accessible `ClaudeCoding` parent folder) after pushing to GitHub (`QWICKWORD_GITHUB_PAT`
  from `secrets.local.txt`, same folder). Live-smoke-tested a real create → start → end round trip
  against `https://qwickword.com` directly after deploying — all green. Live on `https://qwickword.com`.
- **Large decorative "Q" watermark (Phase 1, done 2026-07-21, interactive, deployed to
  production):** Andreas sketched a big Q-sized shape over a screenshot of the create-flow card and
  asked for a large serif Q as part of the design, "same font type as Times New Roman or similar
  typefont maybe more unique." Loaded Playfair Display (`next/font/google`, `src/app/layout.tsx`) — a
  serif in the same family as Times but a more distinctive, editorial letterform with a nicer tail on
  the Q — and rendered it as a single large, low-opacity, `aria-hidden` "Q" glyph behind the card on
  the home page (`src/app/page.tsx`), sized with `clamp()` so it scales with viewport width. Live on
  `https://qwickword.com`.
- **Home page visual pass, second round (Phase 1, done 2026-07-21, interactive, deployed to
  production):** after seeing the Q watermark live, Andreas said it was "hardly visible" and asked for
  the design to be "still minimalist but maybe a little bit more inspiring." Rather than only turning
  up the Q's opacity, made three coordinated changes in `src/app/page.tsx`: the Q's opacity went from
  0.06/0.07 to 0.18/0.22 and picked up an indigo tint (was flat zinc); the page background changed from
  a flat `bg-zinc-50`/`bg-black` to a soft radial gradient (pale indigo glow in light mode, deep
  indigo-to-black glow in dark mode); and the card content now sits in a translucent, blurred glass
  panel (rounded corners, faint border, soft shadow) rather than floating directly on the page
  background. Same components, copy, and layout — no structural or dependency changes. Live on
  `https://qwickword.com`.
- **Home page visual pass, third round (Phase 1, done 2026-07-21, interactive, deployed to
  production):** after the second-round redesign, Andreas said the Q looked "weird" because the part
  poking out below the glass card was sharp/more visible than the part sitting behind the card (which
  the card's own `backdrop-blur` had already softened) — he said he likes the blur and the glow
  overall, just not that mismatch. Fix: added a `blur-md` filter directly to the Q `<span>` in
  `src/app/page.tsx` so the whole glyph is uniformly soft everywhere, not only where it happens to sit
  behind the glass; opacity nudged up slightly (0.18/0.22 -> 0.22/0.26) to compensate for the blur
  visually diluting it. No other changes. Live on `https://qwickword.com`.
- **Home page visual pass, fourth round (Phase 1, done 2026-07-21, interactive, deployed to
  production):** Andreas said the radial-gradient page background from the second round read as a
  "weird square" and asked for it gone. Reverted `src/app/page.tsx`'s outer wrapper to a flat
  `bg-zinc-50`/`dark:bg-black`, same as before that round. Kept the indigo-tinted, blurred Q watermark
  and the glass card — those two are what he'd said he liked. Live on `https://qwickword.com`.
- **Countdown T-10s audio cue + gentle reddish colour (Phase 1, done 2026-07-21, interactive, deployed
  to production):** the last 10 seconds now get a softer `rose` colour stage (distinct from the
  existing `amber` T-30s warning and the harsher solid red used once the call has actually ended), plus
  a quiet Web Audio tick once per second, quietly louder as it approaches zero — no audio file asset,
  just a synthesized tone with a fast attack/decay envelope, wrapped in try/catch so a blocked/
  unsupported `AudioContext` degrades silently. `src/components/call-countdown.tsx` became a Client
  Component to hold this. Live on `https://qwickword.com`.
- **Larger call video window (done 2026-07-21, interactive, deployed to production):** Andreas said the
  call window felt small next to Google Meet/Teams; his friend on mobile independently described it as
  "cropped." `src/components/call-media.tsx`: desktop max-width widened `max-w-3xl` (768px) ->
  `max-w-6xl` (1152px); on mobile (below Tailwind's `sm` breakpoint) the fixed 16:9 landscape aspect
  ratio is dropped in favor of `h-[70vh]` — a 16:9 box on a narrow portrait phone screen is a short,
  wide strip with a lot of empty space above/below, almost certainly what "cropped" meant on his
  friend's end. `src/app/[room]/page.tsx`'s `PageShell` padding/gap also trimmed on mobile only, to
  give the call area more of the available screen. Live on `https://qwickword.com`.
- **"Join meeting now" crash fix + app-wide error boundary (done 2026-07-21, interactive, deployed to
  production):** Andreas hit a browser-level crash page ("This page couldn't load. Reload to try
  again, or go back.") clicking "Join the meeting now" right after creating a link; a retry worked.
  Root cause: `src/components/call-media.tsx`'s daily-js cleanup never called `callObject.destroy()`
  (a since-corrected assumption that removing the `<iframe>` from the DOM was enough) — daily-js only
  allows one `DailyCall` instance per page at a time, so a leftover undestroyed instance from an
  earlier client-side navigation could make the *next* `DailyIframe.wrap()` call throw, and with no
  error boundary anywhere in the app, that uncaught exception surfaced as the browser's own generic
  crash UI instead of anything from this app. Fixed both ends: `destroy()` now actually runs on
  cleanup (wrapped in try/catch, since it can itself throw), `DailyIframe.wrap()` and the
  participant-count read are both wrapped in try/catch too, and a new `src/app/error.tsx` gives any
  future uncaught render error a friendly "Something went wrong" screen with a "Try again"/reset button
  instead of leaking to the browser. Live on `https://qwickword.com`.
- **Dynamic link-preview text per room (done 2026-07-21, interactive, deployed to production):**
  Andreas shared a link in WhatsApp and got the generic site title/description back; asked for
  something more inviting, tied to the actual link. `src/app/[room]/page.tsx` now exports
  `generateMetadata`, building "Someone wants a Qwickword. Click to start your N minute(s) meeting."
  from the link's own `d` (durationSeconds) — no name is included (confirmed with Andreas rather than
  guessing; a "your name" field was considered and explicitly deferred, so this reads the same for
  everyone, not just him). A link with no valid `d` (pre-this-feature or mistyped) falls back to the
  original site description, unchanged. New `formatMinutesPhrase` in `src/lib/duration.ts` handles the
  singular/plural wording. Live on `https://qwickword.com`.
- **Anchor the countdown to first join, not link creation (Phase 1, done 2026-07-21, interactive,
  deployed to production):** the countdown no longer starts the instant a link is created. Rooms are
  now created with a generous 24h "pre-start buffer" `exp` (not the real call length); the real,
  server-enforced countdown starts only once someone presses a new "Start now" button, or daily-js
  (`@daily-co/daily-js`, newly added) detects a second participant has joined — whichever happens
  first. New `POST /api/rooms/[room]/start` and `GET /api/rooms/[room]/status` routes;
  `src/lib/daily-rooms.ts` gained `startRoomCountdown`/`getRoomStatus`/`isCountdownStarted`, all
  deriving "started or not" purely from the room's own live `exp` (no new datastore). Links now carry
  `&d=<durationSeconds>`; `src/app/[room]/page.tsx` re-fetches the room's live status rather than
  trusting the link's own `exp`. Old links (no `d`) keep behaving exactly as before. See the run-history
  entry below for full build/verify detail. Live on `https://qwickword.com`.
- **Copied-link toast fix (Phase 1, done 2026-07-21, interactive, deployed to production):** the green
  "Link copied to clipboard!" toast was `fixed` to the viewport top, independent of where the
  create-flow card actually sits, so on shorter viewports it landed on top of the page's own
  "Qwickword" heading above the card. `src/components/create-link-form.tsx` now renders it in normal
  document flow, as the first item inside the success panel, right above the "Your X min Qwickword is
  ready" line — near the action that triggered it, never able to overlap unrelated content again. Live
  on `https://qwickword.com`.
- **One-click create flow (Phase 1, done 2026-07-21, interactive, deployed to production):** the home
  page no longer has a separate "Create" button — clicking a duration preset or picking a value from
  the new custom 1–60-minute dropdown creates the room immediately. The 30-minute preset was replaced
  with 20 minutes. On success the link auto-copies to the clipboard (best-effort, with a green
  auto-dismissing toast confirming it) and a "Join the meeting now" button takes the creator straight
  into the call. `src/lib/duration.ts` and `src/components/create-link-form.tsx`; see the run-history
  entry below for full build/verify detail. Live on `https://qwickword.com`. The related countdown-
  timing request (start on manual "Start now" press, not just first join) was folded into the existing
  ROADMAP.md "Anchor the countdown to first join" item instead of being built tonight — see ROADMAP.md.
- **Manifesto easter egg (2026-07-21, interactive, deployed to production):** Andreas provided the
  full text of "The Qwickword Manifesto" and asked for a discreet way to expose it. Published at
  `/manifesto` (`src/app/manifesto/page.tsx`, styled as an essay — serif type, generous spacing, its
  own page title/description) with a single fixed-position, low-contrast "manifesto" text link tucked
  in a corner of the home page — not a real nav item, deliberately easy to miss. Not a ROADMAP.md item
  (an ad hoc creative request, not a product feature); logged here instead. Live on `qwickword.com`.
- **Rotating slogan (Phase 1, done 2026-07-21, interactive, deployed to production):** the home page
  now shows a random line from `src/lib/slogans.ts` (35 lines, see `SLOGANS.md` for the full working
  list and the reasoning behind what got cut) under the "Qwickword" h1, picked fresh on every request
  (`export const dynamic = "force-dynamic"` on `src/app/page.tsx` — otherwise Next.js would freeze one
  random line in at build time). Verified via repeated curl requests against both a local dev server
  and the live site returning distinct lines almost every time. Live on `https://qwickword.com`.
- **Live URLs (as of 2026-07-21, later same day):** **https://qwickword.com** is now the primary
  live URL — custom domain DNS confirmed correctly configured (Vercel's `misconfigured: false`),
  smoke-tested directly (home page, a real create-room round-trip). `https://quickword.vercel.app`
  still works too (same deployment, both point at the same Vercel project). The in-app product name
  is now "Qwickword" everywhere user-facing — see the text-rename entry further down for full detail;
  logo/favicon/colours are the one part of the brand pass still outstanding.
- **Home page banner fix (2026-07-21, interactive, deployed to production):** removed the
  `Live mode (domain: quickword.daily.co)` text that showed on the home page whenever real Daily
  credentials were configured — Andreas asked for it gone now that the site is live on
  `qwickword.com`, since surfacing the video vendor's internal domain to real visitors was a dev
  leftover with no value to an end user. `src/app/page.tsx`: the status pill now only renders in mock
  mode (still useful there, for local dev without credentials); live mode shows nothing. Removed the
  now-unused `domain` destructure. `README.md`'s description of this behaviour updated to match.
  Verified: `npm run lint`/`npm run build` clean; curl-tested both modes against a live dev server
  (mock mode still shows its banner; live mode shows zero occurrences of "Live mode", "Mock mode", or
  the raw `quickword.daily.co` string anywhere on the page; room creation itself unaffected — a real
  test room was created and deleted). **Deployed to production the same session** (Vercel CLI,
  `vercel deploy --prod`) rather than left for the nightly run, since it directly affects what's
  visible on the now-live site right now. Live-verified after deploy: `https://quickword.vercel.app/`
  and `https://qwickword.com/` both return `200` with zero occurrences of the removed text; a real
  room create/delete round-trip against `https://qwickword.com/api/rooms` confirmed the fix didn't
  break anything functional.
- **Pre-join screen (Phase 1 item 1, done 2026-07-21):** rooms are now created with
  `enable_prejoin_ui: true` (`src/lib/daily-rooms.ts`, property validated against
  `docs.daily.co/reference/rest-api/rooms/config`), which turns on Daily Prebuilt's own lobby —
  a name-entry form, then a camera/mic check — before a participant actually joins the call. This
  reuses Daily's own lobby rather than a hand-built `getUserMedia` screen, consistent with Phase 0
  item 5's choice to embed Daily's whole prebuilt call UI rather than build a custom call surface.
  Practical consequence: the lobby renders **inside** the iframe already on the call page, so no
  new component or route was needed for live mode; time spent in the lobby still counts against
  the room's shared `exp` (dawdling there is not a loophole around the hard-end design). Mock mode
  has no real Daily embed to show a lobby inside, so it got a one-line addition instead: the mock
  call placeholder box (`src/components/call-media.tsx`) now explains that live mode shows Daily's
  own pre-join lobby here.
  - **Verified:** `npm run lint` and `npm run build` both clean. Mock mode — curl-created a mock
    room, then `GET /{name}?exp={exp}` showed the new explanatory note text in the mock call box,
    and room creation itself unaffected. Live mode — curl-created a real Daily room via
    `POST /api/rooms`, confirmed `GET /{name}?exp={exp}` returns the real
    `<iframe src="https://quickword.daily.co/{name}">` unchanged, then independently re-fetched the
    room from Daily's own `GET /rooms/:name` and confirmed `config` shows
    `enable_prejoin_ui: true` alongside item 3's pre-existing `exp` / `eject_at_room_exp` /
    `eject_after_elapsed` (120), all correct and unaffected by tonight's change. Test room deleted
    afterward (Daily confirmed `{"deleted":true}`), no debris left.
  - **Not independently verified — same honest limitation as every night so far:** an actual
    real-browser click-through of Daily's lobby UI itself (name field, live camera/mic preview).
    Playwright remains blocked in this sandbox (no `sudo` for Chromium/Firefox system deps, per the
    2026-07-16 entry) — this run's confidence rests on the documented, verified room *config*
    (`enable_prejoin_ui: true`, which is Daily's own well-documented trigger for that lobby) rather
    than a first-hand look at the rendered lobby screen. If Andreas gets a chance to open a real
    link once, that would be good confirmation.
  - **New platform issue found and worked around tonight:** the fixed scratch path used every prior
    night (`/tmp/qwbuild`) now has debris left over from a previous night's run owned by a different
    Linux user (`nobody:nogroup`, not this run's own `modest-epic-pasteur` user) that this run's
    `rm -rf` couldn't delete (`Permission denied` on ~1000+ files, mostly `node_modules` and a stale
    `.git`). Worked around by using a fresh, dated directory name instead
    (`/tmp/qwbuild-20260721`) rather than fighting the permissions. **Note for future runs:** don't
    assume a fixed scratch path name is safe to reuse/`rm -rf` across nights on this platform — if
    `rm -rf` on the usual scratch path fails with permission errors, use a new uniquely-named
    directory (e.g. date-stamped) rather than spending time debugging the ownership mismatch.
- **Deployed (Phase 0 item 9, done 2026-07-20):** Andreas approved deployment in chat ("ok to deploy
  ok to make new vercel project") and, when told there's no Vercel MCP connector available, directed
  the run to a folder (`C:\Users\acnic\ClaudeCoding`, requested fresh via
  `request_cowork_directory` — not previously accessible in this session) holding his Vercel account
  token, per `SEPARATION_CHARTER.md`'s note that GitHub/Vercel/Supabase are one account shared across
  his BlackStart and PowerKyiv projects with company-prefixed project names. Read only the
  `VERCEL_TOKEN` line out of `secrets.blackstart.local.txt` (the charter confirms the same
  account-level token value is legitimately duplicated in both companies' secrets files — not a
  mixing violation) rather than viewing the rest of either secrets file's contents.
  - **Guardrail check before writing anything:** called `GET /v9/projects` with the token first and
    confirmed the account's only existing projects were `blackstart-voting`, `pk-datarooms`, `pk-exo`,
    `powerkyiv-investors` — no `quickword`/`quick-word` project already existed, and none of those
    four were touched at any point below.
  - **New project:** created via `POST /v10/projects` with `{"name":"quickword","framework":"nextjs"}`
    — a brand-new, dedicated project (id `prj_JS71RabWYJSg6h4Jw4H0sBE1mXpL`), never linked to or
    overlapping any existing one.
  - **Env vars:** set `DAILY_API_KEY` and `DAILY_DOMAIN` as encrypted env vars (production, preview,
    and development targets) via `POST /v10/projects/:id/env`, using the same values already in
    `.env.local` — Andreas didn't ask for key rotation, so none was done (the low-urgency rotation
    suggestion in ASKS.md is still open, unrelated to tonight's work).
  - **Deploy:** installed the Vercel CLI into a scratch prefix (`npm install --prefix
    /tmp/qwbuild/global vercel@latest` — global install failed with `EACCES` first, this sandbox user
    can't write to the system `node_modules`), then from the same `/tmp` scratch build used for
    tonight's earlier work: `vercel link --yes --project=quickword --scope=acnicolet-1663s-projects`
    (linked cleanly, no prompts), then `vercel deploy --prod --yes`. Build succeeded (`npm run build`
    inside Vercel's build environment, same clean output as every local run tonight, correctly logged
    "Daily: live mode (domain: quickword.daily.co)" — confirming the env vars were picked up), and
    Vercel aliased the production deployment to **https://quickword.vercel.app**.
  - **Verified against the live public URL** (not just the deploy log): `GET /` → HTTP 200, banner
    reads "Live mode (domain: quickword.daily.co)"; `POST /api/rooms {"durationSeconds":60}` → a real
    Daily room (`mockMode:false`); `GET /{room}?exp={exp}` on that real room → response contains the
    real `https://quickword.daily.co/{room}` iframe target. No Vercel deployment-protection/SSO wall
    blocking public access (checked, since the project's default `ssoProtection` setting could have
    implied one). Test room deleted afterward via Daily's own API (`{"deleted":true}` confirmed) — no
    debris left on Daily or on Vercel (only the one real, intended production deployment exists).
  - **Not yet done, not asked for tonight:** a custom domain (Andreas didn't request one; the
    `*.vercel.app` subdomain is live and working) and Daily API key rotation (separate, low-urgency,
    still open in ASKS.md).
  - **Access note:** this was a live, interactive exchange with Andreas mid-scheduled-task-run, not
    an autonomous decision — he explicitly approved the new project and pointed at the token source
    himself before any of the above was built. Also: he asked mid-task not to be prompted for file
    deletion permission in future when a plain `rm` fails; noted for future runs.
- **Repo:** initialised, `main` branch, first commit made.
- **App runs locally:** yes (verified) — `npm install && npm run dev` boots Next.js 16.2.10
  (App Router, TypeScript, Tailwind, ESLint, `src/` dir) and serves the default placeholder page
  at `/` with HTTP 200 and no errors. `node_modules` is NOT committed (standard practice) and is
  not present in this folder either — see the platform note below before running `npm install` here.
- **Platform note — read this before any future npm/git work in this folder (corrected 2026-07-13
  after Andreas caught an error in an earlier version of this note):** this project folder
  is bridged into the build sandbox over a FUSE mount, which has real, documented bugs — but file
  deletion is NOT one of them, contrary to what an earlier version of this note said. Two things:
  (1) Deletion needs a one-time permission grant: `rm` from bash fails with "Operation not
  permitted" until the `allow_cowork_file_delete` tool is called once for the folder; after that,
  `rm` works normally. Do not conclude a file cannot be deleted — call that tool first. (Known
  related bug: it can return "Permission denied" without showing the confirmation dialog it is
  supposed to — see anthropics/claude-code issue 46788.) (2) Git's internal writes are genuinely
  broken on this mount, independent of the delete permission — retested and reconfirmed after
  enabling deletion. `git init` / `git config` / `git commit` write via a temp-file-then-rename
  pattern, and on this Windows FUSE bridge that pattern lands as a correctly-sized file full of NUL
  bytes instead of real content (`fatal: bad config line 1`). This matches known open issues:
  anthropics/claude-code 55206, 62932, 38993, 40264, 69866, 42520, 45433 — stale caching and
  null-byte padding on the Windows sandbox-to-host FUSE bridge, not something specific to this repo.
  Workaround (still needed, still recommended): do `npm install`, `next dev`/`build`, and all `git`
  operations (`init`, `add`,
  `commit`) in a scratch directory on the sandbox's native disk (e.g. `/sessions/<id>/scratch/...`,
  NOT under `mnt/`), then copy the resulting source files and the finished `.git` directory back
  into this folder with plain `cp` (plain copy writes are fine on this mount; it is specifically the
  lock+rename pattern that breaks). The same stale-cache bug can make `bash cat`/`wc` show old
  content for a file just edited via `Read`/`Write`/`Edit` — those tools are the authoritative,
  Andreas-visible side; if a bash script needs a just-edited file's content, rewrite it directly
  from bash too rather than trusting a bash read of an Edit-tool change. Tonight's leftover
  `.trash-broken-*` folders from before this was understood have been deleted via
  `allow_cowork_file_delete` — nothing left to clean up.
  **2026-07-14 addendum:** confirmed a second, distinct symptom of the same underlying bug: it isn't
  only git's internal lock+rename writes that can land corrupted — regular file writes made to this
  mount (via a prior run's copy-back step) can also end up with the tail silently NUL-padded, or
  truncated mid-sentence in the copy that `bash` reads (via `cat`, `cp`, or `git diff`), even though
  the `Read`/`Write`/`Edit` tools show the correct, complete, Andreas-visible content the whole time.
  Concretely tonight: `.gitignore`, `ROADMAP.md`, and `STATUS.md` all showed as "modified" against
  HEAD when `git status` ran directly against this folder — but the real corruption was in what HEAD
  had recorded (ROADMAP.md's HEAD blob and STATUS.md's working copy, inconsistently) plus NUL-padding
  on `.gitignore`. Fix applied: re-derived each file's true content from the `Read` tool (the
  Andreas-visible ground truth) and rewrote all three from a bash heredoc directly in the scratch
  build dir before committing, rather than trusting any `cp`/`cat` of the mount for these files.
  Lesson for future runs: **never** trust `git diff`/`git status` output against files in this folder
  at face value if the diff looks like mid-word truncation or a "binary files differ" surprise on a
  text file — re-verify the true content with `Read` first. Separately (harmless but noisy): the FUSE
  bridge presents every file as mode 755 regardless of its real Windows permissions, which made
  `git status` show a spurious mode-only diff on a freshly-added file tonight. Fixed by setting
  `core.fileMode = false` in this repo's `.git/config` (done tonight) — future runs shouldn't see this.
  **2026-07-16 addendum — this is worse than "just-edited files can look stale," it's non-deterministic
  across separate bash calls:** tonight, after editing three files via the `Edit`/`Write` tools, I
  rewrote them again directly in the scratch dir via bash heredoc (matching the `Read`-tool-verified
  true content exactly), and a `md5sum` comparison between that scratch copy and this mount showed
  them **matching**. Minutes later, with no edits by me in between, I re-ran the exact same
  `md5sum`/`tail`/`xxd` check against this mount and got **NUL-padded, mid-word-truncated garbage** —
  the same corruption pattern as before, on files a `Read` tool call had just confirmed were correct.
  So a bash read of this mount can flip between correct and corrupted from one call to the next, with
  no edit in between, not just immediately after a write. **Practical rule for future runs:** never
  trust a bash read of this mount for anything that needs to be correct byte-for-byte (especially
  `git add`/commit content) — not even a bash read that "matched" a moment ago. The only two reliable
  operations on this mount are: (1) reading file content via the `Read` tool, and (2) writing file
  content via the `Write`/`Edit` tools. For git commits: don't `cp`/`rsync` source files from this
  mount into the scratch dir and trust that copy. Instead, write the exact content directly into the
  scratch dir via a bash heredoc (quoted delimiter, e.g. `<<'EOF'`, so `$`/backticks in the code
  aren't shell-expanded), using the content you already have from a `Write`/`Edit` tool call or a
  fresh `Read`, and commit that. The one exception is `.git` itself: copying the *existing, historical*
  `.git` directory from this mount into scratch with `cp -r` (before this run's new commit) has been
  reliable across all runs so far — it's a read of long-settled object files, not something just
  written this session.
  **2026-07-17 addendum — a near-incident, root cause confirmed, and a hard new rule:** tonight,
  after successfully swapping in a freshly-committed `.git` via `rm -rf .git && mv .git.new .git`
  (itself fine — plain copy/rename, not git's internal write path), I then ran `git remote remove
  origin` **with cwd on the mount** to tidy up a harmless leftover `origin` pointing at the scratch
  clone path. That single command broke everything: it failed with `fatal: bad config line 1`, and
  every subsequent `git` command (even read-only ones — `git log`, `git status`) failed with
  `fatal: unknown error occurred while reading the configuration files`, while `cat .git/config`
  from bash reported "No such file or directory". This is `git commit`'s exact documented failure
  mode (temp-file-then-rename landing corrupted on this FUSE bridge) — `git remote remove` uses the
  same internal config-rewrite mechanism, so it is just as unsafe to run against the mount as
  `git commit`/`git config` already were known to be. **Tried to fix it with the `Write` tool**
  (the normally-reliable side of this mount) by writing `.git/config` directly — **blocked**: the
  `Write` tool refuses paths under `.git`, reporting it as a protected location. So `.git` cannot be
  hand-repaired via `Write`/`Edit` at all; the only fix is to discard it and re-copy a known-good
  `.git` from a scratch clone via plain `cp -r`/`rm -rf`/`mv` (which is exactly what fixed it
  tonight — re-cloned from the scratch dir, which was untouched by the bad command). **New hard
  rule for all future runs:** on this mount, run genuinely *zero* `git` commands with `cwd` inside
  this folder beyond the specific read-only ones already proven to work right after a fresh `.git`
  copy-in (`git log`, `git show HEAD:<path>`, `git status` — but still treat their working-tree-diff
  output with the existing skepticism, not their HEAD-object output). Every mutating git operation —
  `commit`, `add`, `config`, `remote`, `checkout`, everything — belongs in the scratch clone only,
  never against the mount, with no exceptions for "small" or "just tidying up" operations like the
  one that caused this.
- **Daily.co:** account created; domain `quickword.daily.co`; API key present in `.env.local`
  (`DAILY_API_KEY`, `DAILY_DOMAIN`). Proceed with real Daily video integration (M1 / Phase 0 item 3).
- **Hard-expiry design (locked):** create rooms with `exp = now + duration`,
  `eject_at_room_exp: true`, and `eject_after_elapsed = duration` as a per-participant backstop.
  Validate exact property names against the live Daily API on first keyed run; log any correction.
- **Env config / mock mode (Phase 0 item 2, done 2026-07-14):** `src/lib/daily-config.ts` reads
  `DAILY_API_KEY` / `DAILY_DOMAIN` from `process.env` once, server-side. If either is missing or
  empty, the app runs in **mock mode** (`mockMode: true`) instead of throwing — a warning is logged
  once to the server console, and nothing crashes. With both present (the current `.env.local`),
  it runs in **live mode**. The home page shows a small status line reflecting whichever mode is
  active, so the mode is visible without reading logs.
- **`POST /api/rooms` (Phase 0 item 3, done 2026-07-15):** `src/lib/daily-rooms.ts` exports
  `createHardExpiryRoom(durationSeconds)`; `src/app/api/rooms/route.ts` is the route handler
  (`export const dynamic = "force-dynamic"` so it's never statically cached — confirmed in the
  build output as `ƒ /api/rooms`, dynamic). Property names validated against the live Daily REST
  API docs (`docs.daily.co/reference/rest-api/rooms/create-room` and `.../rooms/config`, fetched
  2026-07-15): request body is `{ privacy, properties: { exp, eject_at_room_exp,
  eject_after_elapsed, ... } }`, auth is `Authorization: Bearer <key>`, endpoint is
  `POST https://api.daily.co/v1/rooms`. These exactly match what BUILD_PLAN.md already said — no
  correction needed there. Room names are left to Daily to auto-generate (unique/unguessable, no
  `name` sent) rather than derived from anything guessable.
  - **Validation bounds (my call, not yet reviewed by Andreas):** `durationSeconds` must be an
    integer in `[60, 3600]` (1–60 min). Phase 1's duration-presets item will likely replace/tighten
    this; flagging so it isn't mistaken for a deliberate product decision.
  - **Verified live (not just against docs):** with the real key in `.env.local`, called the route
    with `durationSeconds: 120`, got back a real `https://quickword.daily.co/<name>` URL, then
    independently called Daily's own `GET /rooms/:name` with the API key and confirmed the room's
    `config` showed `exp` (matching what was requested), `eject_at_room_exp: true`, and
    `eject_after_elapsed: 120`. Deleted the test room afterward via `DELETE /rooms/:name` (Daily
    confirmed `{"deleted":true}`) so no test debris is left in the Daily account.
  - **Verified mock mode:** with `.env.local` temporarily renamed aside, the same route returned a
    fabricated `https://mock.daily.co/mock-<random>` result with no network call and no crash;
    invalid input (`durationSeconds` missing, non-numeric, too short, too long, or malformed JSON
    body) returns `400` with a clear error message in both modes.
  - `npm run lint` and `npm run build` both clean; `/api/rooms` shows as dynamic (`ƒ`) in the build
    route table, `/` still prerenders static (`○`) as before.
  - **Platform note:** this run's bash tool runs each call in its own isolated process — a `next dev`
    server started with `&` in one call is gone by the next call (confirmed: a follow-up `curl` got
    connection-refused, and `ps aux` showed no next process). Worked around by starting the server
    and running every curl test against it inside a single bash call. Noting this for future runs
    doing any dev-server testing.
- **Create-link page (Phase 0 item 4, done 2026-07-16):** `src/app/page.tsx` (Server Component) now
  renders the real product page instead of the create-next-app placeholder: the mock/live mode
  banner (unchanged from item 2/3), a short positioning line, and `<CreateLinkForm />`.
  `src/components/create-link-form.tsx` (Client Component, `"use client"`) is the interactive piece:
  a row of duration presets (1/2/5/10/15/30 min, from a new `DURATION_PRESETS_SECONDS` — see below),
  a "Create Quick Word" button that `POST`s to `/api/rooms`, a loading state, an error state (network
  failure, non-JSON response, or a `{error}` body all handled distinctly), and on success a readonly
  input with the link plus a "Copy link" button (`navigator.clipboard`) and a "Create another" reset.
  - **Link shape (a design call, not yet reviewed by Andreas):** the shareable link is
    `{window.location.origin}/{room.name}` — this app's own future `/[room]` path — not the raw
    Daily room URL (`https://quickword.daily.co/...`) that `POST /api/rooms` returns in `url`. This
    is forward-compatible with the very next roadmap item ("Call page `/[room]`"), which is what
    will actually render the join UI and the hard "Time's up" screen — Daily's own prebuilt room UI
    wouldn't give us that custom hard-end experience. **Consequence:** a link created tonight will
    404 if opened, because `/[room]` doesn't exist yet. That's expected — it's exactly what the next
    roadmap item builds. Flagging so this isn't mistaken for a bug if Andreas clicks a test link
    before then.
  - **New file `src/lib/duration.ts`:** `MIN_DURATION_SECONDS`/`MAX_DURATION_SECONDS` moved here out
    of `daily-rooms.ts` (which re-exports them for backwards compatibility with
    `src/app/api/rooms/route.ts`), plus the new `DURATION_PRESETS_SECONDS` list and a
    `formatDuration()` helper. Rationale: this file has zero server-only dependencies (no `fetch`,
    no env var access), so the duration-picker UI (a Client Component, code that ships to the
    browser) can safely import the same bounds/presets the API route validates against, without
    pulling `daily-rooms.ts`'s Daily API key / fetch logic into the client bundle. Confirmed this is
    the idiomatic Next.js 16 pattern against `node_modules/next/dist/docs/01-app/01-getting-started/
    05-server-and-client-components.md` ("Preventing environment poisoning") before writing it this
    way, per AGENTS.md's instruction to check the bundled docs rather than assume App Router
    behaviour from training data.
  - **Duration presets (my call, not yet reviewed by Andreas):** 1/2/5/10/15/30 min is a minimal
    working set, not the polished picker. Phase 1's dedicated "Duration presets (1, 2, 5, 10 min)
    plus a custom value" item will revisit/replace this.
  - **Verified:** `npm run lint` and `npm run build` both clean (TypeScript included in `next build`
    — no type errors). Production build still shows `/` as static (`○`) and `/api/rooms` as dynamic
    (`ƒ`), unchanged from item 3. Ran the dev server and drove it with real HTTP requests in both
    modes: **mock mode** — `GET /` shows "Mock mode", "Create Quick Word", and the preset labels;
    `POST /api/rooms {"durationSeconds":300}` returns a fabricated `mock.daily.co` room; an
    out-of-range duration still correctly 400s. **Live mode** — `GET /` shows "Live mode
    (domain: quickword.daily.co)"; `POST /api/rooms {"durationSeconds":120}` created a real Daily
    room, which I independently re-fetched from Daily's own API and confirmed `config.exp` set,
    `eject_at_room_exp: true`, `eject_after_elapsed: 120` — then deleted the test room. This
    re-confirms item 3's route still works correctly after today's `duration.ts` refactor.
  - **Not verified — honest limitation:** I could not click-test the actual button-press → fetch →
    render-link flow in a real browser. I installed Playwright and downloaded a Chromium binary, but
    launching it segfaults immediately (`Host system is missing dependencies... sudo npx playwright
    install-deps` — no `sudo` available in this environment; confirmed the same for Firefox too, same
    root cause). What I verified instead: the API endpoint the component calls returns exactly the
    response shape (`url`, `name`, `exp`, `durationSeconds`, `mockMode`) the component's TypeScript
    types expect (and `next build`'s TypeScript pass would have caught a mismatch); the SSR'd initial
    HTML contains all the interactive elements (preset buttons, the Create button); and a careful
    manual trace of the `fetch`/`useState` logic in `create-link-form.tsx`. This is materially weaker
    than an actual click-through test — if Andreas gets a chance to open the page and click through
    once, that would be good confirmation this run's confidence is warranted.
- **Call page `/[room]` (Phase 0 item 5, done 2026-07-17):** `src/app/[room]/page.tsx` (Server
  Component, async — this Next.js version has `params`/`searchParams` as Promises, confirmed
  against `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/dynamic-routes.md`
  and `.../page.md` before writing it, per AGENTS.md) plus a new Client Component,
  `src/components/call-countdown.tsx`.
  - **Stateless design (my call, consistent with Phase 1's not-yet-formalised "no database" item):**
    rather than looking up the room from Daily or a datastore, the shareable link now carries the
    room's `exp` (Unix seconds) as a query param — `create-link-form.tsx` generates
    `/{room.name}?exp={room.exp}` instead of last night's bare `/{room.name}`. Both tabs opening the
    same link get the same `exp`, so `CallCountdown` (each tab computes `exp*1000 - Date.now()`
    independently, ticking every second) shows the same remaining time in both without any server
    push channel. If `exp` is missing/malformed, the page shows a small inline note instead of
    crashing (the polished "invalid/expired link" screen is next roadmap item, not this one).
  - **Join UI:** in live mode, an `<iframe>` embeds the real Daily room URL
    (`https://{domain}/{room}`, i.e. Daily's own prebuilt call UI — no new npm dependency added) with
    `allow="camera; microphone; fullscreen; display-capture; autoplay"`, plus an "open in new tab"
    link as a fallback. In mock mode (no Daily key), there's no real room to join, so the iframe is
    replaced with a plain placeholder box naming the room. This page does not yet verify the room
    still exists on Daily before rendering — that check belongs to the next roadmap item.
  - **Hydration note:** `CallCountdown` renders a "--:--" placeholder until its first `useEffect`
    tick, specifically so the server-rendered HTML (no access to the client's clock) matches the
    first client render — avoids a React hydration-mismatch warning from using `Date.now()` during
    render.
  - **Verified:** `npm run lint` and `npm run build` both clean (TypeScript included); build output
    shows `/[room]` as dynamic (`ƒ`), as expected since it reads `searchParams`. Ran the dev server
    and curl-tested both modes end to end: **mock mode** — created a room via `POST /api/rooms`, then
    `GET /{name}?exp={exp}` returned HTTP 200 with the "Mock call" placeholder and the correct room
    name; `GET /{name}` (no `exp`) correctly showed the missing-timing-info fallback instead of
    crashing. **Live mode** — created a real Daily room, then `GET /{name}?exp={exp}` returned HTTP
    200 with an `<iframe src="https://quickword.daily.co/{name}">` matching the real room exactly,
    plus the "open in new tab" link; deleted the test room afterward via Daily's own API (confirmed
    `{"deleted":true}`), no debris left. **Not independently verified:** an actual two-tab
    click-through in a real browser — blocked by the same Playwright/Chromium sandbox limitation
    logged on 2026-07-16 (no `sudo` to install system deps). What's verified instead: the countdown
    logic is a pure function of a shared `exp` plus each tab's own `Date.now()`, so two tabs given the
    same link are guaranteed to compute the same remaining time by construction, not just by having
    been observed to do so once.
- **Hard-end experience (Phase 0 item 6, done 2026-07-18):** the call page's ticking clock and "is
  this call over" decision now live in a new Client Component, `src/components/call-room.tsx`, which
  replaces last night's `CallCountdown`-drives-the-page approach. `CallCountdown`
  (`src/components/call-countdown.tsx`) is now a pure, stateless display component — given
  `remainingMs`, it renders the "M:SS" text (or "Time's up") with the same colour thresholds as
  before (black → amber under 30s → red at zero), but no longer owns a clock or any interval itself.
  The call area (Daily iframe or mock placeholder, plus the "open in new tab" fallback link) moved
  into a new shared component, `src/components/call-media.tsx`, so it renders identically from the
  two places that need it: `CallRoom`'s normal timed path, and `page.tsx`'s existing "missing/invalid
  `exp`" fallback (unchanged in behaviour tonight — see the note on that below).
  - **The actual hard-end swap:** `CallRoom` tracks `remainingMs` in state. The moment it reaches
    zero, it stops rendering `CallMedia` at all — the `<iframe>` is removed from the DOM, not just
    hidden — and renders a plain "This Quick Word has ended." message instead, with no rejoin
    button, no extend control, and no "open in new tab" link (that link pointed at the same,
    now-dead room). The only interactive element left anywhere on the call page is the pre-existing
    "Create your own Quick Word" link back to `/`, which makes a brand-new room rather than
    continuing this one. This is a client-side belt to the server-side suspenders already in place
    since Phase 0 item 3 (Daily's `eject_at_room_exp` / `eject_after_elapsed`, reconfirmed live and
    unaffected by tonight's change — see the verification note below).
  - **Design refinement made while verifying tonight — computing the initial value server-side:**
    the first version tracked `remainingMs` as `null` until the client's first `useEffect` tick, so
    every page load (even for an already-dead link) briefly rendered a neutral placeholder before
    the real state was known. Replaced that with `src/lib/time.ts`'s `remainingMsUntil(expSeconds)`,
    called once in `page.tsx` (a Server Component, so this runs on *its own* clock at request time)
    and passed into `CallRoom` as `initialRemainingMs`. Consequence: an already-expired link now
    renders the "ended" screen directly in the very first server-rendered HTML — the Daily iframe is
    never sent to the browser at all for a dead link, not even for a flash — and this is provable
    with `curl` alone, not just reasoned about (see the verification note below). The client's own
    `setInterval` (in `CallRoom`, using the client's clock) takes over ticking every second after
    that first render, same as before.
  - **A real lint failure worth knowing about for future runs:** calling `Date.now()` directly inside
    `page.tsx`'s component body (even assigned to a local `const` before the `return`, and even
    though this is a Server Component computing legitimate request-time data — the same category as
    Next's own `cookies()`/`headers()`) is rejected by `npm run lint` as `react-hooks/purity` ("Cannot
    call impure function during render"), a rule eslint-config-next now bundles via
    eslint-plugin-react-hooks as part of the React Compiler rule set. It does not appear to do
    interprocedural analysis — moving the actual `Date.now()` call behind a plain named function in
    a separate file (`remainingMsUntil()` in `src/lib/time.ts`) and calling *that* from the component
    satisfies it. Worth remembering next time any future item needs the server's clock in a Server
    Component.
  - **Verified — mock mode:** created a 60s mock room, then curl-tested four cases against a live
    dev server: (1) `GET /{name}?exp={realFutureExp}` → mock call box present, no "ended" text, timer
    showing `0:59`; (2) same room with a **fabricated already-past** `exp` → "This Quick Word has
    ended." present exactly once, mock call box present zero times — confirms the hard-end swap
    fires correctly even though no real Daily room enforces mock-mode expiry (mock rooms were never
    persisted anywhere, so this UI-level check is the only enforcement that exists for them, and
    that's fine — see ROADMAP item 7's job of making this path more explicit); (3) `GET /{name}` (no
    `exp`, the pre-existing fallback) → unchanged, still shows the "missing timing info" message and
    the mock call box; (4) `exp` 5 seconds out → amber "ending soon" class present, confirming the
    colour-threshold logic still works from the new server-computed initial value.
  - **Verified — live mode:** created a real 60s Daily room, then: (1) `GET /{name}?exp={realExp}`
    while still valid → response contains a real `<iframe src="https://quickword.daily.co/{name}">`
    plus the "open in new tab" link; (2) same room with a fabricated past `exp` → "This Quick Word has
    ended." present, **zero** `<iframe>` elements, **zero** "open in new tab" links; (3)
    independently re-fetched the room from Daily's own `GET /rooms/:name` and confirmed
    `config.exp`/`eject_at_room_exp`/`eject_after_elapsed` are exactly as item 3 set them — tonight's
    UI-only change didn't touch or weaken the server-side enforcement. Test room deleted afterward
    (Daily confirmed `{"deleted":true}`), no debris left.
  - **`npm run lint` and `npm run build` both clean** (after the `react-hooks/purity` fix above).
    `/[room]` still shows dynamic (`ƒ`) in the build output, unchanged.
  - **Not independently verified — honest limitation, same as every night so far:** an actual
    real-browser click-through watching the on-screen swap happen live (Playwright is still blocked
    in this sandbox — no `sudo` to install Chromium/Firefox system deps, see the 2026-07-16 entry).
    What's verified instead this time is stronger than previous nights' equivalent gaps: because the
    initial-state design change makes the ended screen appear in server-rendered HTML itself (not
    only after client JS runs), the curl tests above are direct proof of the hard-end swap's *result*
    for the already-expired case, not just a trace of the logic that should produce it. The one thing
    curl genuinely cannot observe is the *live, mid-call* transition — a tab open with a real
    countdown ticking down to zero and watching the iframe disappear in front of you — which still
    rests on: `CallRoom`'s `isOver` check (`remainingMs <= 0`) is the same condition whether
    `remainingMs` arrived via the initial server-computed prop or a later client tick, so the two
    paths are the same code, not two different implementations that could disagree.
  - **Scope note:** the "missing/invalid `exp`" fallback in `page.tsx` is unchanged tonight — it has
    no known expiry to drive a hard-end swap from, so it still just shows the call area
    indefinitely with an inline note. Making that a real "invalid link" screen (detecting a malformed
    room name or a room that no longer exists on Daily, per the item's own wording) is next up,
    ROADMAP item 7.
- **Found at the start of tonight's run — item 6 was never actually committed:** `git status` showed
  `page.tsx`/`call-countdown.tsx` modified and `call-media.tsx`/`call-room.tsx`/`time.ts` untracked,
  even though last night's entry below claimed a commit. Confirmed via `git log` (HEAD stopped at
  2026-07-17's doc-only commit) that this was real, not the mount's read corruption — the same failure
  mode already seen once before, on item 3 (2026-07-16 entry). Fixed by cloning `.git` into a scratch
  dir, re-deriving all five files' true content from the `Read` tool (byte-for-byte matching what
  STATUS.md already documented as done), and committing them as their own commit (`f78e689`, "Phase 0
  item 6: hard-end experience...") before starting any new work tonight, so item 6 and item 7 stay as
  distinct, honest commits. Also had to set `git config user.email`/`user.name` in the fresh scratch
  clone (git refused to commit with an unset identity) — used Andreas's name/email, matching every
  prior commit's author. **Lesson for future runs:** the "committed in the scratch dir and synced back"
  claim in a run's own history entry is not sufficient evidence a commit landed — the safest habit is
  to check `git log --oneline` against what ROADMAP.md/STATUS.md claim is done, every run, before
  trusting it.
- **Invalid/expired-link handling (Phase 0 item 7, done 2026-07-19):** `src/app/[room]/page.tsx` now
  gates entry to the call behind two checks instead of the old single "missing exp" inline-note
  fallback:
  1. **Syntax check (no network call):** `isPlausibleRoomName()` (new, `src/lib/daily-rooms.ts`) — a
     deliberately permissive `^[a-zA-Z0-9_-]{1,80}$` pattern that matches both this app's own mock
     names (`mock-xxxxxxxx`) and Daily's auto-generated names, while rejecting genuinely malformed input
     (empty, whitespace, stray characters from a mangled/truncated URL) — plus the existing numeric-`exp`
     check. Either failure renders the call page's new `src/components/invalid-link-screen.tsx`
     ("This link isn't valid" + a "Create a new one" button to `/`), no Daily lookup needed.
  2. **Existence check (live mode only, `checkDailyRoomExists()`, new, `src/lib/daily-rooms.ts`):** a
     `GET /rooms/:name` call to Daily's REST API. Only runs when the link is syntactically fine *and*
     its own `exp` claims to still be in the future — an already-expired link skips this entirely and
     goes straight to item 6's "This Quick Word has ended" screen, since that's already the correct
     outcome regardless of whether the room object still exists on Daily, and skipping the extra network
     call avoids any regression risk to item 6's already-verified expired-link behaviour. A 404 from
     Daily renders `InvalidLinkScreen` with "This Quick Word doesn't exist"; any other outcome (200, a
     5xx, or a network error) **fails open** — treated as "exists" — on the reasoning that an ambiguous
     Daily-side hiccup is not evidence a real link is dead, and wrongly telling someone their working
     link is gone is worse than occasionally letting a truly-dead edge case through to Daily's own
     in-iframe error.
  - **Mock-mode decision (documented per last night's "Next actions" prompt to decide this
    explicitly):** mock mode skips the existence check entirely — `checkDailyRoomExists()` short-circuits
    to `true` in mock mode as a defensive fallback, but the real guard is that `page.tsx` never calls it
    when `mockMode` is true. Rationale: mock rooms are never persisted anywhere (confirmed again
    tonight), so there is nothing to check existence against; a syntactically valid mock link is trusted
    as-is, and its own `exp` is still enforced by `CallRoom` once it passes, exactly like any other link.
    This was a judgment call, not reviewed by Andreas — flagging in case he'd rather mock mode show some
    explicit "can't verify this against anything real" messaging instead.
  - **Also added:** a "Create a new one" button directly inside `CallRoom`'s "This Quick Word has ended"
    card (`src/components/call-room.tsx`) — previously the only way back from a call that ended
    mid-session was the page's small persistent footer link, not a button matching this item's own
    wording. `InvalidLinkScreen` and this button share the same visual style, so a dead link looks
    consistent whether it died from being malformed, from the room being gone, or from simply running
    out of time.
  - **Design call worth flagging (a scope decision, not yet reviewed by Andreas):** a link with a
    syntactically fine room name but a *missing* `exp` query param — previously handled by a soft inline
    note plus an attempt to still join the call with no visible countdown — now renders the same
    "This link isn't valid" screen as a malformed link, full stop, in both mock and live mode. Reasoning:
    Quick Word's whole positioning is "you can see it end"; silently allowing a call with no visible
    timer contradicts that more than a clear "make a new link" message does, and the "Done when" wording
    for this item ("a clear message ... instead of a crash") reads as covering this case too. If Andreas
    disagrees (e.g. wants a real Daily call still joinable without a shown countdown, relying only on
    Daily's server-side `eject_after_elapsed`/`eject_at_room_exp` from create time), this is a one-line
    revert of the `!hasValidExp` branch back to a softer fallback.
  - **Verified — mock mode:** created a real mock room via `POST /api/rooms`, then curl-tested against a
    live dev server: (1) valid link, not yet expired → mock call box shown, no invalid-link text;
    (2) malformed room name (`bad name!!`) → "This link isn't valid"; (3) missing `exp` → "This link
    isn't valid"; (4) non-numeric `exp` → "This link isn't valid"; (5) valid room, already-expired `exp`
    → "This Quick Word has ended" plus "Create a new one" (item 6's screen, not the new invalid-link
    screen — confirms the skip-existence-check-when-expired logic routes correctly); (6) the invalid-link
    screen's button is a real `href="/"` link labelled "Create a new one".
  - **Verified — live mode, including the real Daily existence check:** created a real Daily room via
    `POST /api/rooms`, then: (1) that real, unexpired room → response contains a real `<iframe>`, no
    invalid-link text; (2) a syntactically valid but never-created room name
    (`this-room-never-existed-xyz123`) → "This Quick Word doesn't exist" (the existence check correctly
    called Daily's real API and got a real 404); (3) malformed room name → "This link isn't valid", no
    Daily call attempted; (4) missing `exp` on the real, existing room → "This link isn't valid";
    (5) the same real room with a fabricated past `exp` → "This Quick Word has ended" (confirms the
    existence check is genuinely skipped for an expired link, not just coincidentally passing). Test room
    deleted afterward via Daily's own API (`{"deleted":true}` confirmed), no debris left.
  - **`npm run lint` and `npm run build` both clean** in both mock and live `.env.local` configurations
    (TypeScript included in `next build`). `/[room]` still shows dynamic (`ƒ`) in the build output.
  - **Not independently verified — same honest limitation as every night so far:** an actual
    real-browser click-through (Playwright still blocked in this sandbox, no `sudo` for Chromium/Firefox
    system deps — see the 2026-07-16 entry). Everything above was verified with real HTTP requests
    (curl) against a live dev server in both modes, including a real Daily API round-trip for the
    existence check, not just code-traced.
- **Deployed:** yes, since 2026-07-20 — see the Phase 0 item 9 entry near the top of "Current state"
  for full detail. (This bullet previously said "no" and was left stale after item 9 shipped; the
  Vercel-deploy blocker below is likewise resolved. Corrected 2026-07-21 rather than left
  contradicting the summary at the top of this file.)
- **Blockers waiting on Andreas:** none blocking right now. The low-urgency Daily API key rotation
  note is still open in ASKS.md, not blocking.
- **README (Phase 0 item 8, done 2026-07-20):** `README.md` rewritten from the `create-next-app`
  placeholder into real project docs — what Quick Word is, the stack (Next.js + Daily.co), `npm
  install`/`npm run dev`, the two `.env.local` vars (`DAILY_API_KEY`, `DAILY_DOMAIN`) and the
  mock-mode fallback behaviour when they're absent, `npm run lint`/`build`/`start`, a short
  project-layout map (`src/app`, `src/lib`, `src/components`), and a one-line deployment note
  pointing at the still-gated Vercel item. Content is transcribed from BUILD_PLAN.md/STATUS.md, not
  a new product decision, per the item's own scope.
  - **Verified:** ran `npm install`, `npm run lint`, and `npm run build` clean in the scratch build
    dir. Booted the dev server twice — once with no `.env.local` (mock mode: home page banner reads
    "Mock mode — no Daily API key configured", matching the README) and once with the real
    `.env.local` copied in *only for this local test* (never committed — it's gitignored throughout;
    live mode: banner reads "Live mode (domain: quickword.daily.co)", also matching the README).
    Both confirm the README's mock/live mode description is accurate, not just plausible.

## Next actions (for the next run)
**Read this before picking the next ROADMAP.md item — the priority order changed today.** Phase 0 is
fully complete and deployed. Phase 1 item 1 (pre-join screen) is done as of 2026-07-21. Later the same
day, Andreas tested the live app and caught a real product bug: the countdown starts at link-creation
time, not when the other person actually joins, so a slow-to-open link burns real call time before
anyone's connected. He asked for this to be queued for the nightly build (not built interactively) —
see the new ROADMAP.md item, "Anchor the countdown to first join, not link creation," inserted
immediately after item 1 (now the first unchecked, non-gated item — build this one next, not duration
presets). Full design is written out in that ROADMAP.md entry; short version: switch the call embed
from a raw iframe to Daily's JS SDK to get a real join event, push the recomputed `exp` to Daily's room
config on first join (not just the client display), and have the call page re-fetch the room's live
`exp` from Daily instead of trusting the value baked into the link — no new datastore needed, this also
answers Phase 1's still-open "decide the backend" item. This will also naturally absorb the separate
"Waiting for the other person" item, which was removed from the list as a standalone item (merged in)
to avoid double-building the same UI state. This is very likely more than a one-night item; if it's not
finished in one run, mark it `[~]` with a clear note on exactly how far it got, per the roadmap's own
partial-completion convention, rather than checking it off early. No open `ASKS.md` blockers otherwise.
**New scratch-path note (2026-07-21):** don't reuse a fixed scratch directory name (e.g.
`/tmp/qwbuild`) across nights without checking it's actually removable first — see tonight's run-history
entry below for what happened when it wasn't (files owned by a different Linux user than this run's).
If `rm -rf` on the usual scratch path errors with permission denials, stop trying to clear it and use a
fresh, uniquely-named directory instead (a date-stamped name worked fine tonight).
**Before doing any git work, run `git log --oneline` against the mount and compare it to what this
file and ROADMAP.md claim is done** — tonight's run repeated this check and again found a gap: items
6 and 7 (both claimed committed by their respective run-history entries below) were still missing
from `git log` on the mount, exactly the same silent-drop failure already seen on item 3
(2026-07-16) and on item 6 itself the first time (2026-07-19's entry describes recovering it as
`f78e689` — that commit *also* never made it back to the mount). Recovered again tonight (see run
history below) as a single commit, `8007f12`. **This has now happened three separate times**
(items 3, 6, and — despite an explicit same-night recovery attempt — 6+7 together), always at the
"copy the finished `.git` back onto the mount" step, which every prior run believed had worked.
**Given the pattern, do not trust this step to have worked just because it completed without an
error** — the check worth Andreas doing some morning (from a normal Windows shell, not this
sandbox) is `git log --oneline` inside `C:\Users\acnic\ClaudeCoding\QuickWord`, compared against
this file's run history. If it's ever more than one commit behind what STATUS.md claims, that's this
same bug recurring, not a one-off.
Before doing any `npm install` or `git` work, re-read the platform note above (**and its 2026-07-16
addendum**) and build/verify in a scratch dir first, then sync source + `.git` back in — and
re-verify any file this note flags with `Read` before trusting a bash view of it. One more thing
confirmed working tonight (2026-07-17, reused successfully again 2026-07-19): a **local `git clone` of
the mount's own `.git` directory into the scratch dir**
(`git clone /path/to/mount/QuickWord/.git scratch/quickword`) reconstructs a byte-correct working tree
entirely from git's object store and native-disk writes — no bash `cat`/`cp` of the mount's
working-tree files involved at all. This is a cleaner variant of the existing "heredoc known-good
content into scratch" workaround and worth using as the default way to start a scratch build; verified
by checking the cloned `page.tsx` was exactly 1318 bytes (matching the `Read`-tool-verified true
content), vs. a corrupted 3445-byte NUL-padded read of the same file directly off the mount in the same
run (see run history below for the full detail). **New note from tonight:** a fresh scratch clone has
no git identity configured — `git commit` fails with "Please tell me who you are" until
`git config user.email "acnicolet@gmail.com"` and `git config user.name "Andreas Nicolet"` are set in
that scratch clone (matches every prior commit's author; safe, this is local-only config in a
throwaway scratch dir, not touching the mount).

---

## Run history
- 2026-07-12 (setup, interactive): Project brief written (BUILD_PLAN.md), guardrails set, status +
  ask files created, nightly 2am build task scheduled. Andreas created the Daily.co account
  (domain `quickword.daily.co`); API key still pending in `.env.local`. `.gitignore` added. No code yet.
- 2026-07-12 (roadmap, interactive): Added ROADMAP.md (ordered MVP→fantastic backlog, one item/night)
  and REVENUE.md (freemium + per-seat Pro recommended; validation experiments defined). Daily key now
  present in `.env.local`. Nightly task re-pointed to execute ROADMAP.md item by item, skipping
  `[needs-andreas]`/`[gate]` items to ASKS.md. Ready to start building Phase 0.
- 2026-07-12 (B2B, interactive): Elevated the B2B/teams play in REVENUE.md as the primary monetization
  wedge (PLG into B2B) with savings math, market stat, and the honest counterfactual caveat. Added
  Phase 3 items (B2B landing, team workspace, real-usage "reclaimed hours & cost" admin dashboard) and
  a Phase 4 SSO/SAML item to ROADMAP.md.
- 2026-07-13 (nightly): Built Phase 0 item 1 — scaffolded Next.js 16.2.10 (App Router, TypeScript,
  Tailwind, ESLint, `src/` dir) via `create-next-app`. Hit corrupted git writes on this folder's
  FUSE mount (see the platform note in "Current state" above); worked around it by
  building/verifying/git-initing in a sandbox scratch dir and copying the finished source + `.git`
  into this folder. Verified `npm run dev` → "Ready" in ~300ms and `GET /` → HTTP 200 with the
  default placeholder page, no errors. Repo initialised on `main` with an initial commit.
  Next: Phase 0 item 2 (env var + mock-mode fallback).
- 2026-07-13 (correction, interactive): Andreas caught an error in the platform note above — it had
  wrongly claimed files in this folder can never be deleted. Verified against the actual
  `allow_cowork_file_delete` tool and a fresh test: deletion just needs a one-time permission grant,
  not a hard block; called it and deleted the leftover `.trash-broken-*` folders. Re-tested the git
  corruption in isolation (a throwaway `.git` in a scratch subfolder) to confirm it is a real,
  separate bug and not a side effect of the delete restriction — it is; matches several open
  anthropics/claude-code GitHub issues on the Windows FUSE bridge. Platform note rewritten to be
  accurate; no change to the actual app code from this correction.
- 2026-07-14 (nightly): Found `.gitignore`, `ROADMAP.md`, and `STATUS.md` all corrupted at rest on
  this folder's mount (NUL-padding and mid-sentence truncation — see the platform note addendum
  above) before doing any new work; re-derived true content from the `Read` tool and rewrote all
  three cleanly. Then built Phase 0 item 2 — `src/lib/daily-config.ts` reads `DAILY_API_KEY` /
  `DAILY_DOMAIN` with a mock-mode fallback (see "Current state" above). Verified by running
  `npm run dev` twice in the scratch dir: once with `.env.local` present (logs "Daily: live mode",
  home page shows "Live mode (domain: quickword.daily.co)") and once with it renamed aside (logs a
  one-time "Daily: mock mode" warning, home page shows "Mock mode — no Daily API key configured"),
  both booting with `GET /` → HTTP 200 and no errors. `npm run lint` and `npm run build` both clean.
  Committed in the scratch dir and synced back. Next: Phase 0 item 3 (real `POST /api/rooms`).
- 2026-07-15 (nightly): Built Phase 0 item 3 — real `POST /api/rooms` (`src/lib/daily-rooms.ts` +
  `src/app/api/rooms/route.ts`). Validated `exp` / `eject_at_room_exp` / `eject_after_elapsed`
  against the live Daily REST API docs first (no BUILD_PLAN.md correction needed — it was already
  right), then proved it end to end against Daily's real API: created a live room via the route,
  independently fetched it back with Daily's own `GET /rooms/:name`, confirmed the config matched
  exactly what was requested, and deleted the test room afterward. Also verified mock mode (fabricated
  room, no network call, no crash) and input validation (bad/missing/out-of-range `durationSeconds`,
  malformed JSON all return clean `400`s). `npm run lint` and `npm run build` both clean; `/api/rooms`
  correctly shows as dynamic in the build output. Learned this run's bash tool kills background
  processes between calls (a `next dev &` from one call is gone by the next) — worked around by
  keeping server start + all curl tests inside one bash call; noted for future runs. Built/tested in
  the scratch dir per the platform note, then synced back and committed. Next: Phase 0 item 4
  (create-link page — the first browser-side caller of this route).
- 2026-07-16 (nightly): Found last night's item-3 work (`src/lib/daily-rooms.ts`,
  `src/app/api/rooms/route.ts`, plus the ROADMAP.md/STATUS.md edits) present on disk (correct per the
  `Read` tool) but **never actually committed** — `git log` still stopped at item 2. The prior run's
  "committed in the scratch dir and synced back" claim didn't happen or didn't land; the `.git`
  copy-back step is exactly the kind of write this mount can silently drop. Committed it properly
  first (commit `0d7fee1`) before starting anything new, so tonight's diff wouldn't be tangled up with
  last night's. Then built Phase 0 item 4 — the create-link page (see "Current state" above for full
  detail): `src/app/page.tsx` rewritten from the `create-next-app` placeholder into the real product
  page, new `src/components/create-link-form.tsx` (duration picker + create button + copyable link),
  new `src/lib/duration.ts` (client-safe shared constants), `src/lib/daily-rooms.ts` updated to
  source its bounds from there, and a minimal `layout.tsx` title/description fix (full branding stays
  Phase 1's job). Hit the FUSE mount's stale/corrupted-bash-read bug harder than previous nights — see
  the platform note's 2026-07-16 addendum above for what changed and the new rule (never trust a bash
  read of this mount for git content, always heredoc known-good content directly into the scratch
  dir). Verified: clean `npm run lint` and `npm run build` (TypeScript included); curl-driven
  end-to-end test of the full create-room flow in both mock mode and live mode (the live-mode room
  was independently re-verified against Daily's own API and deleted after). Attempted real
  browser click-through testing with Playwright; blocked by a sandbox limitation (no `sudo` to install
  Chromium's/Firefox's system dependencies) — documented as an honest gap above rather than claimed as
  verified. Committed to git tonight (last night's overdue item-3 commit first, then item 4).
  Next: Phase 0 item 5 (call page `/[room]` — join the Daily room and show a synced countdown; also
  what makes tonight's links resolve instead of 404ing).
- 2026-07-17 (nightly): Before starting, found `git status` against this folder showing `ROADMAP.md`,
  `STATUS.md`, `layout.tsx`, `page.tsx`, and `daily-rooms.ts` all "modified" against HEAD — investigated
  before trusting it, per the standing platform-note rule. Confirmed it was the known bash-read
  corruption, not a real diff: `git show HEAD:src/app/page.tsx` (reads git's object store) was exactly
  1318 bytes and byte-identical to the correct content; a plain `cat`/`wc` of the same file directly on
  the mount showed 3445 bytes, NUL-padded after the correct content ends. So HEAD was fine; only bash's
  live view of the mount's working tree was corrupted. No fix needed for that — moved on to tonight's
  build. Built Phase 0 item 5 — the call page (see "Current state" above for full detail):
  `src/app/[room]/page.tsx` (Server Component) + `src/components/call-countdown.tsx` (Client Component),
  and updated `create-link-form.tsx` so generated links carry `?exp=` for a stateless, shared countdown
  anchor. Checked the bundled Next.js docs for the `params`/`searchParams`-as-Promise convention before
  writing the route, per AGENTS.md. Verified: clean `npm run lint` and `npm run build`; curl-driven
  end-to-end test of the create → join flow in both mock mode (placeholder box, correct room name, and
  a working missing-`exp` fallback) and live mode (real Daily room, iframe pointing at the exact
  `quickword.daily.co` URL, test room deleted after via Daily's own API, `{"deleted":true}` confirmed).
  Two-tab synced-countdown behaviour verified by construction (both tabs derive remaining time from the
  same shared `exp` and their own clock) rather than by an actual two-tab browser test, since Playwright
  is still blocked in this sandbox (same root cause as 2026-07-16). Built/tested this run's changes in a
  scratch dir cloned directly from the mount's `.git` (see "Next actions" above for why this is a
  cleaner variant of the existing workaround), then wrote the final files to the mount via the
  `Write`/`Edit` tools (the reliable side of this mount) and committed from the scratch clone before
  copying `.git` back. After that swap, made the mistake of running `git remote remove origin`
  directly against the mount to tidy up a harmless leftover remote — this corrupted `.git/config`
  and broke every git command, including read-only ones (see the platform note's 2026-07-17
  addendum for the full detail and the new hard rule this produced: no git commands of any kind
  against the mount beyond the already-proven-safe read-only ones). Fixed by discarding `.git` again
  and re-copying a known-good one from the still-intact scratch clone; no source-code changes were
  needed, this was purely a self-inflicted git-plumbing mistake, now corrected and documented so it
  doesn't repeat. Next: Phase 0 item 6 (invalid/expired-link handling).
- 2026-07-18 (nightly): Built Phase 0 item 6 — the hard-end experience (see "Current state" above for
  full detail): new `src/components/call-room.tsx` (Client Component, owns the ticking clock and the
  call-area/ended-screen swap), `src/components/call-media.tsx` (new, the shared iframe/mock-box
  markup), `src/lib/time.ts` (new, wraps `Date.now()` for server-side use), `src/components/
  call-countdown.tsx` (slimmed to a pure display component), and `src/app/[room]/page.tsx` (wires
  `CallRoom` in for the normal timed path, computes `initialRemainingMs` server-side). Refined the
  design mid-run after the first version left every page load starting from an unknown placeholder:
  moved to computing the initial remaining time from the server's own clock at request time and
  passing it down, so an already-expired link now renders the ended screen directly in the
  server-rendered HTML — provable with `curl`, not just reasoned about. Hit a new lint rule along the
  way, `react-hooks/purity` (via eslint-config-next's bundled eslint-plugin-react-hooks), which
  rejects a direct `Date.now()` call inside a Server Component's render body even for legitimate
  request-time data; worked around by moving the call behind a plain function in its own module
  (`src/lib/time.ts`) rather than disabling the rule — noted in "Current state" for future runs that
  hit the same thing. Verified end to end with curl against a live dev server in both modes: mock mode
  (fresh link shows the mock call box and a ticking timer; a fabricated already-past `exp` on the same
  room shows the ended screen with zero copies of the mock call box); live mode (fresh link shows a
  real Daily iframe plus the "open in new tab" link; past `exp` shows the ended screen with zero
  iframes and zero "open in new tab" links; independently re-fetched the room from Daily's own API
  afterward and confirmed item 3's `exp`/`eject_at_room_exp`/`eject_after_elapsed` enforcement is
  untouched; test room deleted, no debris left). `npm run lint` and `npm run build` both clean.
  Real-browser click-through of the live, mid-call transition is still not verified — Playwright
  remains blocked in this sandbox (same root cause logged 2026-07-16) — but this run's server-computed
  initial-value design means the *already-expired* case is now curl-provable rather than resting only
  on code-tracing, which is a strictly stronger verification than previous nights had for the
  equivalent gap. Built/tested in a scratch dir cloned from the mount's `.git`, wrote final files to
  the mount via `Write`/`Edit`, committed from the scratch clone, copied `.git` back — no mutating git
  commands run against the mount itself, per the 2026-07-17 hard rule. Next: Phase 0 item 7
  (invalid/expired-link handling — the room-existence/malformed-name check this item's fallback still
  doesn't do, plus a real "Create a new one" button).
- 2026-07-19 (nightly): Before starting, found item 6's work present and correct on disk (per `Read`)
  but, per `git log`, never actually committed — HEAD still stopped at 2026-07-17's doc-only commit,
  the same failure mode already seen once before on item 3 (2026-07-16 entry). Fixed first: cloned
  `.git` into a fresh scratch dir, re-derived all five of item 6's files from the `Read` tool (matching
  what STATUS.md already documented byte-for-byte), and committed them as their own commit (`f78e689`)
  before touching anything new, so tonight's diff wouldn't be tangled up with last night's overdue work
  — same recovery pattern as the 2026-07-16 entry. Then built Phase 0 item 7 — invalid/expired-link
  handling (see "Current state" above for full detail): new `src/lib/daily-rooms.ts` exports
  `isPlausibleRoomName()` (syntax check) and `checkDailyRoomExists()` (live Daily existence check,
  fails open on ambiguous errors, skipped entirely once a link already claims to be expired), new
  `src/components/invalid-link-screen.tsx` (the friendly "dead link" card with a "Create a new one"
  button), `src/app/[room]/page.tsx` rewritten to gate entry through both checks before reaching
  `CallRoom`, and `src/components/call-room.tsx` gained its own "Create a new one" button on the
  "ended" screen. Made one scope call worth Andreas's eyes: a link with a syntactically fine room name
  but a missing `exp` now shows the same "invalid link" screen rather than the old soft fallback that
  still let you join with no visible countdown — reasoning and an easy revert path are in "Current
  state" above. Verified end to end with curl against a live dev server in both modes: mock mode (5
  cases — valid/not-yet-expired, malformed name, missing exp, non-numeric exp, and already-expired
  correctly routing to item 6's screen instead of the new one) and live mode, including a real Daily
  API round-trip for the existence check (created a real room, confirmed a genuinely nonexistent room
  name gets a real 404-driven "doesn't exist" screen, confirmed the real existing room still joins
  normally, confirmed an expired real room skips the existence check and shows item 6's screen; test
  room deleted after, `{"deleted":true}` confirmed). `npm run lint` and `npm run build` both clean in
  both mock and live `.env.local` configurations. Real-browser click-through remains unverified
  (Playwright still blocked, same root cause as every prior night). Also hit a new one-time snag: a
  freshly cloned scratch `.git` has no commit identity configured, so `git commit` refused until
  `user.email`/`user.name` were set locally in that scratch clone (Andreas's identity, matching every
  prior commit) — noted in "Next actions" for future runs. Built/tested in the scratch clone, wrote
  final files to the mount via `Write`/`Edit`, committed from the scratch clone, copied `.git` back —
  no mutating git commands run against the mount itself. Next: Phase 0 item 8 (a short README).
- 2026-07-20 (nightly): Before starting, ran the standing `git log` vs. STATUS.md/ROADMAP.md check
  and found items 6 and 7 both missing from the mount's git history again — `git log` stopped at
  2026-07-17's doc-only commit, despite last night's entry claiming a recovery commit (`f78e689`) for
  item 6 and a further commit for item 7. The files themselves were present and correct on disk (per
  `Read`), so nothing was lost, but the "copy `.git` back to the mount" step has now silently dropped
  a commit three separate times (item 3 on 2026-07-16, item 6 on 2026-07-19, and item 6 again plus
  item 7 tonight). Recovered by cloning `.git` into a scratch dir on `/tmp` (not `/sessions`, which
  turned out to be at 100% disk usage tonight — see below), copying in the mount's working-tree files
  for the 9 affected paths, verifying each one byte-for-byte (`wc -c` matched the sizes already
  confirmed via `Read`, zero NUL bytes in any of them — the mount's read-corruption bug did not
  reproduce tonight), re-running `npm install`/`lint`/`build` plus a mock-mode curl smoke test (valid
  link, expired link, malformed name — all matched documented behaviour) to confirm the recovered code
  actually still works, then committing as `8007f12`. Then built Phase 0 item 8 — the README (see
  "Current state" above for full detail): rewrote `README.md` from the `create-next-app` placeholder,
  verified its `npm install`/`lint`/`build`/mock-vs-live-mode claims by actually running them (live
  mode tested by copying the real `.env.local` into the scratch dir only, never committed). Committed
  as its own commit, then this documentation update (ROADMAP.md item 8 checked off and item 9
  annotated, STATUS.md, ASKS.md's Vercel-deploy entry rewritten with three specific, concrete asks) as
  a third commit. **New platform issue found and worked around tonight:** `/sessions` (where the
  scratch dir has lived every prior night, per the platform note above) was at 100% disk usage,
  and `npm install` failed with `ENOSPC` until the scratch build was moved to `/tmp` instead (which
  had headroom) and a stale 141 MB `~/.npm` cache under `/sessions` was cleared. Noting this in case
  `/tmp` isn't persistent/large enough on some future night — if so, clearing `/sessions` scratch
  debris from prior nights is the first thing to check before assuming the disk itself is out of room.
  Phase 0 is now complete except item 9, which is gated on Andreas — appended a specific three-part
  ask to ASKS.md (new dedicated Vercel project, the two env vars, a domain preference) rather than
  crossing the gate. Made a scope call, documented in "Next actions" above and open to being
  overridden: read "one item per night" as taking priority over "don't stall" once at least one item
  (item 8) had actually been built this run, so did not also start Phase 1 tonight.
- 2026-07-20 (later same day, interactive): Andreas came into the session live and approved the
  Vercel deploy ("ok to deploy ok to make new vercel project"). No Vercel MCP connector exists, so
  asked how he wanted to authenticate; he said to request access to the folder holding his Vercel
  tokens. Requested and got `C:\Users\acnic\ClaudeCoding` (the parent of this folder). Found
  `VERCEL_TOKEN` in `secrets.blackstart.local.txt` — read only that one line, not the rest of the
  file — after checking `SEPARATION_CHARTER.md`, which confirmed Vercel is one account shared across
  his BlackStart/PowerKyiv projects and that the same account-level token is expected to appear in
  both companies' secrets files (not a mixing violation). Verified via the Vercel API which projects
  already existed before creating anything, then built Phase 0 item 9 end to end (see "Current state"
  above for full detail): new dedicated project `quickword`, `DAILY_API_KEY`/`DAILY_DOMAIN` env vars
  set to the same `.env.local` values, deployed via the Vercel CLI, and verified against the live
  public URL (home page, room creation, call page all correct; no SSO wall; test room cleaned up on
  Daily afterward). **Live at https://quickword.vercel.app.** ROADMAP.md item 9 checked off, ASKS.md's
  entry moved to Done. Phase 0 is now fully complete. Also: Andreas asked not to be prompted for file
  deletion permission in future when `rm` fails on this mount — noted for future runs, don't ask, just
  call `allow_cowork_file_delete` directly.
- 2026-07-21 (nightly): Before starting, ran the standing `git log` vs. STATUS.md/ROADMAP.md check —
  clean this time, HEAD matched item 9 as claimed, no recovery needed. Built Phase 1 item 1 — the
  pre-join screen (see "Current state" above for full detail): set `enable_prejoin_ui: true` on room
  creation (`src/lib/daily-rooms.ts`), which turns on Daily Prebuilt's own lobby (name entry, then a
  camera/mic check) inside the existing call-page iframe — validated the property against
  `docs.daily.co/reference/rest-api/rooms/config` first, same discipline as every previous Daily
  property this project has added. Added a short explanatory note to the mock-mode call box
  (`src/components/call-media.tsx`) for parity, since mock mode has no real Daily embed to show a
  lobby inside. Verified: `npm run lint` and `npm run build` both clean; curl-tested mock mode (note
  text present, room creation unaffected) and live mode (real iframe unchanged, then independently
  re-fetched the room from Daily's own `GET /rooms/:name` and confirmed `config.enable_prejoin_ui:
  true` alongside item 3's `exp`/`eject_at_room_exp`/`eject_after_elapsed`, all intact; test room
  deleted after, `{"deleted":true}` confirmed). Real-browser click-through of the rendered lobby
  itself remains unverified — Playwright is still blocked in this sandbox (no `sudo` for
  Chromium/Firefox system deps, same root cause logged 2026-07-16) — this run's confidence rests on
  the verified room config rather than a first-hand look at Daily's lobby screen. Also fixed two
  stale lines in "Current state" left over from before item 9 shipped ("Deployed: no" and a
  "blockers waiting on Andreas" bullet that both contradicted the accurate summary at the top of this
  file) — small honest correction, not part of tonight's actual feature work. **New platform issue
  found and worked around:** the fixed scratch path used every prior night (`/tmp/qwbuild`) had
  debris left over from a previous run, owned by a different Linux user (`nobody:nogroup`) than this
  run's own user — `rm -rf` failed with ~1000+ permission-denied errors instead of clearing it. Used a
  fresh, date-stamped directory (`/tmp/qwbuild-20260721`) instead of fighting the ownership mismatch;
  noted in "Next actions" for future runs. Built/tested in that scratch clone (cloned from the mount's
  `.git`, source files heredoc'd in to match this run's `Edit`-tool changes exactly, per the standing
  platform note), committed there, then wrote the doc updates to the mount via `Write`/`Edit` and
  copied the finished `.git` back — no mutating git commands run against the mount itself. Originally
  logged "Next: Phase 1 item 2" here — superseded a few hours later the same day, see the entry
  immediately below.
- 2026-07-21 (later same day, interactive): Andreas tested the live app and reported a real product
  bug: the countdown starts at link-creation time (`POST /api/rooms`, Phase 0 item 3), not when the
  other person actually joins, so a link that takes a while to open burns real call time before
  anyone's connected — exactly the kind of thing this product is supposed to prevent, just misapplied
  to the wrong starting instant. Explained the fix requires a real architecture change (detecting an
  actual join event needs Daily's JS SDK, not the current raw `<iframe src>`; the server-side `exp`
  needs to move with the first join, not just the UI; both tabs need to agree on the same real end
  time) and asked whether to build it now interactively or queue it for the nightly run. Andreas chose
  to queue it. Rewrote the relevant ROADMAP.md Phase 1 section: added a new item, "Anchor the
  countdown to first join, not link creation," immediately after item 1 (now the first unchecked,
  non-gated item — ahead of duration presets), with the full design written into the item itself
  (switch to `daily-js`, push the recomputed `exp` to Daily's room config on first join, have the call
  page re-fetch Daily's own live `exp` as the source of truth instead of trusting the link's baked-in
  value — no new datastore needed), a note on item 1 above it explaining what's superseded and why
  tonight's `enable_prejoin_ui` work still stands, removal of the now-redundant standalone "Waiting for
  the other person" item (merged into the new item, since it's the same UI state), and a note on the
  "decide the backend" item pointing at the no-new-datastore answer the new item already provides.
  Updated "Next actions" above to point at the new item explicitly rather than item 2, and flagged that
  it's likely more than one night's work — if the next run doesn't finish it, mark `[~]` with a clear
  note rather than checking it off early. No code changed in this exchange, planning/roadmap only.
- 2026-07-21 (later still, interactive): Andreas added three more items while chatting, explicitly for
  a future nightly run, not tonight: (1) a friendly, gentle audio cue in the countdown's last seconds —
  very soft starting around T-10s, a bit more audible from T-5s to zero, not alarm-like — folded into
  the existing "Countdown polish" Phase 1 item rather than made a separate one, since it's the same UI
  moment. (2) A user feedback mechanism (lightweight — a form or even just a `mailto:` link is fine for
  a first version) — added as a new Phase 2 item. (3) A donate/support-the-project option to help cover
  his own Daily API costs once real usage shows up — added as a new `[needs-andreas]` Phase 3 item
  (creating the actual donation account is a real third-party signup, not autonomous per BUILD_PLAN.md's
  guardrails) and cross-referenced into REVENUE.md as a new "model 6," distinct from the Pro/Stripe plan.
  All three are planning-only edits to ROADMAP.md/REVENUE.md; no code changed, no priority order changed
  for what the next run should actually build (still the "anchor countdown to first join" item).
- 2026-07-21 (later still, interactive): Andreas announced the product is being renamed to
  "Qwickword" (domain `qwickword.com`, which he confirmed he already owns). Asked whether to do the
  in-app rename now or queue it — he chose to queue it for the nightly build, same as the countdown-fix
  and feature-idea items earlier tonight. Rewrote ROADMAP.md's Phase 1 "Basic brand pass" item to fold
  in the rename with a concrete scope list (UI copy, README/BUILD_PLAN/ROADMAP/REVENUE.md,
  `package.json`, judgement on code comments; confirm exact capitalization with Andreas if genuinely
  ambiguous — used "Qwickword," one word, based on how he wrote it, not yet explicitly confirmed
  letter-for-letter) and added a new, separate `[needs-andreas]` item for connecting the `qwickword.com`
  domain to the live Vercel deployment, since DNS changes at whatever registrar/zone the domain
  actually lives at need his explicit go-ahead (BUILD_PLAN.md's standing guardrail against touching any
  pre-existing/shared DNS zone without approval) — that item's job for a run that can't get Andreas's
  DNS approval in the moment is to generate the exact records Vercel wants and put them in ASKS.md, not
  guess and proceed. Also flagged, as a separate lower-priority decision for Andreas: whether to rename
  the Daily.co video subdomain (`quickword.daily.co`), which is visible to end users via the "open in a
  new tab" fallback link and will look inconsistent post-rename, but is an account-level Daily setting
  outside this item's scope. Deliberately did NOT reorder Phase 1 — the rename item stays in its
  existing list position (after duration presets / countdown polish / responsive layout), since Andreas
  didn't ask for it to jump the queue ahead of the countdown-start-time fix already at the top. No app
  code or other doc changed in this exchange beyond the ROADMAP.md edit described here.
- 2026-07-21 (later still, interactive): Andreas was live in his GoDaddy DNS panel, mid-way through
  adding a `www` CNAME record for `qwickword.com`, and asked whether his entry was correct. It wasn't —
  the Value field held a full URL (`https://quickword.vercel.app/`) instead of a bare hostname, which
  isn't valid CNAME syntax regardless of anything else, and even a corrected bare hostname would have
  been a guess rather than what Vercel actually wants for this specific domain. Rather than leave this
  for the nightly run (per the ROADMAP.md domain-connect item's original plan of generating records and
  logging them in ASKS.md), did it on the spot since he was already there making changes: requested
  `C:\Users\acnic\ClaudeCoding` access again (same folder/token as Phase 0 item 9), read only the
  `VERCEL_TOKEN` line again, and used the Vercel API to add `qwickword.com` and `www.qwickword.com` to
  the existing `quickword` project (same dedicated project, no new/shared infra — the guardrail
  exception already established for this project still applies), then fetched Vercel's actual
  domain-specific DNS requirements via `GET /v6/domains/{domain}/config` instead of assuming generic
  values. Gave Andreas the exact corrected records directly in chat: fix the in-progress `www` CNAME to
  `c2efecf6f5ce6b0c.vercel-dns-017.com` (project-specific, not a generic Vercel hostname), delete
  GoDaddy's default `A @ → WebsiteBuilder Site` parking record, add `A @ → 76.76.21.21` (simplest,
  still fully supported) or Vercel's newer two-IP recommendation. Also flagged one judgement call made
  along the way — set `www` to redirect to the apex `qwickword.com` rather than the reverse — as
  Andreas's to revisit if he'd rather `www` be canonical. **Did not touch DNS itself** — that's still
  his action to take in GoDaddy, consistent with the standing guardrail against touching any
  registrar/DNS zone without his own hands on it; only the Vercel-side domain attachment was done via
  API. Updated ROADMAP.md's domain-connect item to `[~]` with the full detail, and added an ASKS.md
  entry (not really "open" in the blocked sense since he's actively working it, but recorded per the
  standing convention) with the exact records so nothing has to be re-derived. Next run: once he's
  saved the DNS changes, re-check `misconfigured` via the same Vercel config endpoint and smoke-test
  the live `qwickword.com` URL once it clears, per the ROADMAP.md item's updated "Next run" note.
- 2026-07-21 (later still, interactive): Andreas asked to "just run the renaming now and redoing of
  banner text etc" — did the full text rename to "Qwickword" across the app and living docs on the
  spot (see the ROADMAP.md brand-pass item, now `[~]`, and the STATUS.md "Current state" entries above
  for full detail), then, mid-way through, he separately asked to "update the navicon to a Q." Handled
  that in the same pass: generated a new `favicon.ico` (Pillow, five embedded sizes 16–64px, a black
  rounded square with a bold white "Q") replacing the leftover default Next.js placeholder icon, plus
  a hand-authored `src/app/icon.svg` for crisp rendering on modern/high-DPI browsers — rendered a PNG
  preview first and looked at it before shipping, rather than trusting the generation blind. One
  real self-inflicted snag while syncing changes into the scratch build for commit: `package.json`'s
  renamed `"name"` field was copied from the mount into scratch correctly, but `package-lock.json` was
  regenerated (`npm install --package-lock-only`) *only inside the scratch dir* and never written back
  to the mount before committing — so after copying the finished `.git` back, `git status` on the
  mount showed `package-lock.json` as modified (working tree had the old pre-rename lockfile, HEAD had
  the new one). Caught it via the routine `git status` check immediately after the `.git` swap (per
  the standing "always check clean after copying .git back" habit), fixed with a plain `cp` from the
  scratch dir's correct copy (verified matching `md5sum` after), consistent with the platform note that
  plain copies to this mount are reliable for generated/binary artifacts like a lockfile or a `.ico`
  file — it's specifically git's own lock+rename write pattern that isn't. Deployed to production
  (`vercel deploy --prod`) and re-verified live: `https://qwickword.com`'s `<title>` reads "Qwickword",
  zero "Quick Word" occurrences anywhere on the home page, `favicon.ico`/`icon.svg` both serve `200`
  with correct content types, and a real room's "ended" screen reads "This Qwickword has ended."
  (room created, tested, then deleted — no debris). `https://quickword.vercel.app` confirmed clean too.
  Everything (code, docs, favicon, package-lock.json fix) committed via the standard scratch-clone
  workflow. **Still open, not attempted tonight:** an actual logo, a considered colour palette beyond
  the current black/white, and Open Graph meta tags/image — the favicon fix covers the browser-tab
  icon only, not the rest of the "Basic brand pass" item's scope.
- 2026-07-21 (later still, interactive): Andreas asked for a DNS status check (his `www` CNAME was
  still pointing at the bare `qwickword.com` instead of Vercel's project-specific target, and no A
  record existed at all for the apex after he'd deleted GoDaddy's parking record) — gave him the exact
  two-step fix directly in chat (edit `www`'s CNAME value to `c2efecf6f5ce6b0c.vercel-dns-017.com`, add
  a new `A @ → 76.76.21.21` record), re-verified against Vercel's live config endpoint first rather than
  reuse the values from the earlier exchange without checking they hadn't changed. No doc/code changes
  from that exchange (pure chat troubleshooting, nothing to commit). Then Andreas asked to add "dark
  mode vs. default/light mode" to the feature pipeline — added as a new Phase 1 ROADMAP.md item
  (currently the app only has automatic OS-driven dark mode via Tailwind's `media` strategy, no
  in-app toggle) — then clarified persistence should be a simple per-visitor mechanism ("probably a
  cookie") with explicitly no login/account system, for this or anything else, right now. Updated the
  item to record that either `localStorage` or a plain non-auth cookie satisfies it, with a brief note
  on when a cookie would actually be the better call (only if a later build wants the server to know
  the preference before first paint) rather than picking one dogmatically now. Planning-only.
- 2026-07-21 (later still, interactive): Andreas asked to remove the `Live mode (domain:
  quickword.daily.co)` banner text now that the site is live on `qwickword.com`. Fixed and deployed to
  production in the same exchange (see "Current state" above for full detail) rather than queued,
  since this directly affects the live site's appearance right now — a different judgement call than
  the earlier feature requests he explicitly asked to queue. Two platform snags hit while getting the
  Vercel CLI installed for the deploy, both worked around: (1) the first `npm install` attempt for the
  CLI segfaulted inside `esbuild`'s postinstall (`SIGSEGV`, no clear cause) — a bare retry of the same
  command succeeded, so this looks like a transient sandbox hiccup, not a real problem, but worth
  knowing a retry is the right first move if it recurs. (2) Installed the CLI into a subdirectory
  (`vercel-cli/`) *inside* the app's own scratch build dir without first giving that subdirectory its
  own `package.json` — npm walked up and found the app's `package.json` instead, silently installing
  `vercel` as a dependency of the actual Qwickword/Quick Word app (polluting `package.json` and
  `package-lock.json` with `"vercel": "^56.4.1"`) rather than into the intended subfolder, which is why
  `vercel-cli/node_modules` kept turning up empty on every check. Caught it via `git status` before
  committing anything (both files showed modified, diff showed the injected dependency), reverted with
  `git checkout -- package.json package-lock.json`, and re-installed correctly using `npm install
  --prefix <separate-directory> vercel@latest` (a sibling directory entirely outside the app's own
  folder tree, not a subdirectory of it) — the same pattern already proven safe on 2026-07-20 for
  Phase 0 item 9's deploy, and the one to use again on any future run that needs the Vercel CLI.
  Nothing was ever committed with the pollution present, so no cleanup needed on the mount side.
  Deployed via `vercel deploy --prod`; confirmed the fix live on both URLs afterward (see "Current
  state"). While verifying, also checked whether Andreas's DNS fix from earlier tonight had propagated
  — it had (`misconfigured: false`) — so did the "Next run" check from the domain-connect item's own
  instructions immediately rather than waiting for a future run, and marked that ROADMAP.md item `[x]`
  with the live smoke-test result, moved its ASKS.md entry to Done. Both code changes (banner fix) and
  all doc updates (ROADMAP.md, ASKS.md, STATUS.md) committed via the standard scratch-clone workflow.
- 2026-07-21 (later still, interactive): Andreas gave a real GitHub repo,
  `https://github.com/5unR4yDK/qwickword.git`, and pointed at `QWICKWORD_GITHUB_PAT` in
  `secrets.local.txt` (a top-level file, distinct from the BlackStart/PowerKyiv company-specific
  secrets files already used earlier tonight). Read only that one line. Confirmed the repo was empty
  first (`git ls-remote` returned nothing), so no risk of clobbering anything, then pushed all local
  history (`main`, 14 commits) via a one-off authenticated push URL rather than saving the token into
  the repo's stored remote config, then pointed `origin` at the plain (token-free)
  `https://github.com/5unR4yDK/qwickword.git` and set upstream tracking — future runs should read the
  token fresh from `secrets.local.txt` when they need to push, same pattern already used for the
  Vercel token, rather than one sitting in `.git/config` on disk indefinitely. This is the first time
  this project has had a real, non-ephemeral remote — everything before tonight only ever lived in
  this local repo (the previous `origin`, pointing at an old ephemeral scratch-session path from a
  different night, was stale/meaningless and is now replaced). All of this was done in the scratch
  clone, per the standing hard rule against mutating git commands with `cwd` on the mount; only the
  resulting, already-correct `.git` was copied back onto the mount.
- 2026-07-21 (later still, interactive): Andreas asked for a brainstormed list of slogans/subtitles —
  meeting-culture humor, the developer/standup-fatigue angle, and the manager-facing "know your team
  isn't stuck in back-to-backs" angle — to review before any rotation feature gets built. Wrote ~40
  candidates across six loose categories, both directly in chat and to a new `SLOGANS.md` in the repo
  root, each as a `[ ]` checkbox for him to mark up. Deliberately not added to ROADMAP.md yet — he
  said to wait for his approval first; `SLOGANS.md`'s own closing note is what queues the actual
  build-the-rotation ROADMAP.md item once he's picked favorites. Then, before that was finished,
  Andreas separately asked to add a home-page settings menu (hamburger/gear icon, pre-set camera/mic
  and sound preferences before joining) to the roadmap — added as a new Phase 1 item, right after the
  dark-mode toggle, since both share the same "no accounts, remember the choice per-browser" shape.
  Noted for whoever builds it: there's no session/cookie mechanism in the app today (it's fully
  stateless, per Phase 0's design) — Andreas asked "still just attached to your session cookie if we
  have that," so the item records plainly that this should reuse the same `localStorage`-or-plain-
  cookie approach just established for dark mode, not a real account-linked session, since one doesn't
  exist. Also flagged a term worth confirming at build time rather than guessing: whether "sound"
  means the speaker/output device or the countdown's audio cue (or both), and that actually applying a
  pre-chosen camera/mic to the call itself needs research, since the call embed is a plain iframe with
  no `daily-js` call object today — same tooling gap already noted in the "anchor countdown to first
  join" item. Planning-only; no app code changed by either of these two requests.
- 2026-07-21 (later still, interactive): Andreas gave a second, more critical pass over the slogan
  list ("determine if you think they're actually funny... those that are not funny you can take them
  out and try to create some new ones"). Rewrote `SLOGANS.md`: cut roughly 20 lines that were
  positioning-flavored filler rather than actual jokes (kept a full list of what got cut at the bottom
  of the file, in case any call is disputed), reworked a couple of near-misses (the seatbelt line,
  which didn't logically end anything, became an ejector seat; the standup line got tightened), and
  added new lines built around a concrete comic mechanism — a named nuisance ("Dave has one more
  slide," "even Kevin"), a specific recognizable meeting moment (the screen-sharer who doesn't notice
  the call ended, "let's go around the room"), or a twist on an existing phrase (Parkinson's Law
  repealed, the hard stop that's finally true). Then, before that landed, Andreas said "lets deploy all
  the slogans, have them land at random for users" — treated as blanket approval of the current list
  (no per-line checkbox needed) and shipped it same session: see "Current state" above and the new
  ROADMAP.md item for full build/verification detail. `SLOGANS.md` updated to reflect it's live, not
  pending approval.
- 2026-07-21 (later still, interactive): Andreas asked for a "2-minute survey about who you are and
  why you use qwickword," explicitly for the roadmap, not built tonight — added as a new Phase 2 item.
  The concept: build the survey as an actual Qwickword (reusing the countdown/hard-end mechanic itself)
  so the "quick 2-minute survey" joke is mechanically real, not just a name. Two requirements make this
  the first item that genuinely can't stay stateless: each answer must be logged the moment a checkbox
  is checked, not batched into a final submit, specifically so a respondent cut off by the 2:00 hard
  end doesn't lose what they'd already answered — and there needs to be a response counter. Recorded
  Andreas's own framing for question order directly in the item: front-load whatever's most valuable
  (industry, role, why they use the product) precisely because the hard cutoff means later questions
  are the ones most likely to go unanswered. Flagged two open decisions for build time rather than
  guessing: whether the counter is admin-only or shown publicly, and where the survey link actually
  lives (ties into the existing "Post-call CTA screen" item). Cross-referenced the still-open "decide
  the backend" item, since this is the concrete feature that finally justifies a real datastore.
  Planning-only.
- 2026-07-21 (later still, interactive): Andreas provided the full text of "The Qwickword Manifesto"
  and asked for a discreet way to expose it, styled like a blog post. Built and deployed same session:
  new `src/app/manifesto/page.tsx` (plain static Server Component — an essay layout, serif type,
  centered title/subtitle header, the closing line set apart, its own page metadata) and a single
  fixed-position link on the home page reading just "manifesto," styled in very low contrast
  (`text-zinc-300`/`text-zinc-800` dark) so it reads as an easter egg rather than a nav item. Verified:
  `npm run lint`/`npm run build` clean (prerenders static, as expected for fixed content), curl-tested
  the home page for the link and `/manifesto` for a `200`, the correct `<title>`, a spot-checked
  distinctive line ("Kevin"), and the "Back to Qwickword" link. Deployed to production and re-verified
  live on `https://qwickword.com/manifesto`. Not a ROADMAP.md item — an ad hoc creative request, not a
  product feature — logged in "Current state" instead.
- 2026-07-21 (later still, interactive): Andreas asked for a one-click create flow — each duration
  control creates the room immediately on click/select instead of a separate pick-then-Create step,
  swap the 30-minute preset for 20 minutes, add a custom 1–60-minute dropdown, auto-copy the link to
  the clipboard with a green confirmation toast, and a "Join the meeting now" button — plus a change to
  when the countdown starts (manual start button OR second join, not just second join). Split this into
  two parts via a clarifying question (first attempt failed with a tool error, recovered by explaining
  the same split in plain text next turn); Andreas answered "1": build the create-flow/UI part now,
  fold the countdown-timing part into the already-queued "Anchor the countdown to first join, not link
  creation" item rather than building it as a separate feature.
  - **Built and deployed tonight:** `src/lib/duration.ts` — `DURATION_PRESETS_SECONDS` changed from
    `[60, 120, 300, 600, 900, 1800]` to `[60, 120, 300, 600, 900, 1200]` (20 min replaces 30 min), new
    `CUSTOM_DURATION_MINUTES_OPTIONS` (1–60). `src/components/create-link-form.tsx` rewritten:
    `handleCreate(durationSeconds)` fires directly from each preset button's `onClick` and the custom
    `<select>`'s `onChange` — no more separate "Create" submit button. On success, best-effort
    `navigator.clipboard.writeText()` in a try/catch (can silently fail, e.g. in Safari, without being
    fatal — the link stays visible and the manual "Copy link" button still works), a green
    `role="status"` toast auto-dismissing after 2.5s confirms the copy, and a new "Join the meeting now"
    link takes the creator straight into the call. Heading changed to "Click to have a quick word:".
  - **Verified:** `npm run lint` and `npm run build` both clean. Curl-tested in mock mode (each preset
    button and the custom dropdown create distinct rooms with the right `exp`) and against live Daily
    rooms (a real custom-duration create, confirmed via Daily's API, then deleted). Checked the
    rendered `<option>` list has all 60 entries (`value="1"` through `value="60"`) — had to adjust the
    check partway through because React SSR inserts `<!-- -->` comment nodes between adjacent JSX text
    expressions, which broke an initial exact-string grep.
  - Deployed to production via the Vercel CLI, re-verified live on both `https://qwickword.com` and
    `https://quickword.vercel.app`, pushed to GitHub (`5unR4yDK/qwickword`), mount's `.git` re-synced,
    `git status --porcelain` confirmed clean.
  - **Countdown-timing part folded into ROADMAP.md, not built tonight:** the existing "Anchor the
    countdown to first join, not link creation" item now also covers a manual "Start now" button as an
    alternative trigger to the first join — whichever fires first wins, and the "Done when" criteria
    were updated to cover both triggers. This stays one item, not two, since both triggers end in the
    same "compute real `exp`, push it to Daily's room config" mechanism; it should be built as a single
    piece of work in a future nightly run, not split into join-detection now and a manual-start bolt-on
    later.
- 2026-07-21 (later still, interactive): Andreas sent a screenshot of the live home page with a big Q
  shape drawn in red over the create-flow card, roughly the size of the card, and asked for a large
  serif Q as part of the design — "same font type as Times New Roman or similar typefont mmayhbe more
  unique." Built and deployed same session:
  - `src/app/layout.tsx`: added `Playfair_Display` via `next/font/google` as a new CSS variable
    (`--font-playfair-display`), used only for this glyph — not for body text, which stays on Geist.
    Picked Playfair over literal Times New Roman because Andreas explicitly asked for "more unique";
    it's a serif in the same broad family but with a more sculpted, editorial letterform and a longer,
    more distinctive tail on the Q specifically.
  - `src/app/page.tsx`: the home page's outer wrapper became `relative overflow-hidden`; a single
    `aria-hidden`, `pointer-events-none`, `select-none` `<span>Q</span>` sits absolutely centered
    behind the card, sized with `text-[clamp(16rem,42vw,30rem)]` so it scales with viewport width
    rather than being a fixed pixel size, at very low opacity (`text-zinc-900/[0.06]` light,
    `text-zinc-50/[0.07]` dark) so it reads as a watermark rather than competing with the actual
    copy/buttons. The card content (`<main>`) got `relative z-10` to sit above it; the existing fixed
    "manifesto" corner link needed no z-index change since `fixed` already escapes the local stacking
    context.
  - Verified: `npm run lint` and `npm run build` both clean. Tried to get an actual visual
    screenshot via Playwright before shipping — `npx playwright install chromium --with-deps` failed
    because the sandbox has no root/sudo (same limitation documented earlier this session for
    Playwright/real-browser testing generally) — so verification stayed to curl-checking the rendered
    HTML for the new markup (the Playfair class string, the `>Q<` text node) and a `200` on both a
    local production server and the live site, consistent with how every other UI change has had to be
    verified this session in the absence of a working headless browser.
  - Deployed via the Vercel CLI (token read from the single `VERCEL_TOKEN` line in
    `secrets.blackstart.local.txt` — Andreas's personal Vercel account token, already used this way
    earlier in the session for the domain setup; read only that one line, not the rest of the file),
    re-verified live on `https://qwickword.com` and `https://quickword.vercel.app`. Pushed to GitHub,
    mount's `.git` re-synced, `git status --porcelain` confirmed clean.
- 2026-07-21 (later still, interactive): after seeing the Q watermark live, Andreas said "can you make
  the design still minimalist but maybe a little bit more inspiring? The Q is hardly visible." Rather
  than treating this as one opacity slider, made three coordinated changes in `src/app/page.tsx`:
  - The Q's opacity went from 0.06/0.07 to 0.18/0.22 and switched from flat zinc to an indigo tint
    (`text-indigo-500/[0.18]` light, `text-indigo-300/[0.22]` dark).
  - The page background changed from a flat `bg-zinc-50`/`bg-black` to a soft radial gradient — a pale
    indigo glow in light mode, a deeper indigo-to-black glow in dark mode — centered slightly above the
    card, giving the page some atmosphere without adding any imagery or texture.
  - The card content (previously floating directly on the page background) now sits inside a
    translucent, backdrop-blurred glass panel — rounded corners, a faint border, a soft shadow — so the
    Q reads as sitting behind glass rather than bleeding straight through flat color.
  No new dependencies, no layout/structural changes, no copy changes — same components throughout.
  Verified: `npm run lint` and `npm run build` both clean; curl-checked the live page for the new
  gradient string and the updated Q opacity class. Deployed via the Vercel CLI (same
  `secrets.blackstart.local.txt` `VERCEL_TOKEN` line as the first Q build), re-verified live on
  `https://qwickword.com`, pushed to GitHub, mount's `.git` re-synced, `git status --porcelain`
  confirmed clean.
- 2026-07-21 (later still, interactive): Andreas sent a screenshot of the redesigned home page and
  said "it looks weird that part of the q sticks out and is more visible... I like the blurryness
  though and I like the glow." Diagnosed the mismatch: the part of the Q behind the glass card was
  already soft (from the card's own `backdrop-blur-sm`), but the tail extending below the card's bottom
  edge rendered directly against the plain page background, sharp and higher-contrast, so it read as a
  separate stray shape rather than part of the same ambient glow. Fix, in `src/app/page.tsx`: added a
  `blur-md` filter to the Q `<span>` itself, so the whole glyph is uniformly soft wherever it sits, not
  only behind the glass; bumped opacity slightly (0.18/0.22 -> 0.22/0.26) to compensate for the blur
  visually thinning it out. This preserves exactly what Andreas said he liked (the blur, the glow) while
  fixing only the inconsistency. Verified: `npm run lint`/`npm run build` clean, curl-checked the live
  page for the `blur-md` class and the updated opacity value. Deployed via the Vercel CLI (same
  `secrets.blackstart.local.txt` `VERCEL_TOKEN` line), re-verified live on `https://qwickword.com`,
  pushed to GitHub, mount's `.git` re-synced, `git status --porcelain` confirmed clean.
- 2026-07-21 (later still, interactive): Andreas sent another screenshot and said "can we not do the
  background square it makes it weird" — referring to the radial-gradient page background added in the
  second visual pass. Reverted `src/app/page.tsx`'s outer wrapper from the gradient back to a flat
  `bg-zinc-50`/`dark:bg-black`. Left the Q watermark (indigo tint, `blur-md`) and the glass card
  untouched, since those were the two things he'd said he liked in the prior message. Verified:
  `npm run lint`/`npm run build` clean, curl-checked the live page had zero occurrences of
  `radial-gradient` and confirmed the flat `bg-zinc-50` class was back. Deployed via the Vercel CLI
  (same `secrets.blackstart.local.txt` `VERCEL_TOKEN` line), re-verified live on
  `https://qwickword.com`, pushed to GitHub, mount's `.git` re-synced, `git status --porcelain`
  confirmed clean.
- 2026-07-21 (later still, interactive): Andreas sent a screenshot showing the green "Link copied to
  clipboard!" toast overlapping the "Qwickword" heading and said "the green link copied shouldnt
  overlap our main text." Root cause: the toast was `fixed top-6 left-1/2 -translate-x-1/2` in
  `src/components/create-link-form.tsx` — pinned to the viewport's top edge regardless of where the
  create-flow card actually sat on the page, so on a short enough viewport it landed directly on the
  page heading sitting above the card (a sibling element in `src/app/page.tsx`, outside this
  component's own layout). Fix: dropped the `fixed`/`top-6`/`left-1/2`/`-translate-x-1/2` classes
  entirely and let the toast render as a normal in-flow element, the first child inside the success
  panel, sitting just above the "Your X min Qwickword is ready" line. It now always appears right next
  to the action that triggered it and can't overlap anything outside this component's own box, at any
  viewport size. Verified: `npm run lint`/`npm run build` clean, curl-checked the live page for zero
  occurrences of the old `fixed top-6` class. Deployed via the Vercel CLI (same
  `secrets.blackstart.local.txt` `VERCEL_TOKEN` line), re-verified live on `https://qwickword.com`,
  pushed to GitHub, mount's `.git` re-synced, `git status --porcelain` confirmed clean.
- 2026-07-21 (later still, interactive): Andreas asked to build the queued "anchor countdown to first
  join, not link creation" item now ("can we implement now lpease..."), including the manual-start
  extension folded into it earlier this session. Built and deployed:
  - `src/lib/daily-rooms.ts`: `createHardExpiryRoom` now sets `exp = now + PRE_START_BUFFER_SECONDS`
    (24h) instead of `now + durationSeconds` — a generous "how long can this link sit unopened" buffer,
    not the real call length (`eject_after_elapsed` matches it, so nobody waiting in the pre-join lobby
    gets ejected early by that per-participant backstop). New `isCountdownStarted(exp, now)` derives
    "started or not" by comparing the room's live `exp` against that buffer, with a 5-minute margin to
    absorb latency/clock skew — still no new datastore, Daily's own room object stays the single source
    of truth, per the original design note. New `startRoomCountdown(name, durationSeconds)` re-fetches
    the room's live config and, only if not already started, sets `exp = now + durationSeconds`; if
    already started (by the other trigger), it's a no-op that echoes the existing `exp` back — this is
    what makes "whichever trigger fires first wins" safe against a race between the manual button and
    join-detection. New `getRoomStatus(name, fallbackExp)` is the read-only version, used for polling.
  - Two new routes: `POST /api/rooms/[room]/start` (called by both triggers) and
    `GET /api/rooms/[room]/status` (polled by a waiting tab to detect a start triggered elsewhere).
  - `src/components/call-media.tsx` became a Client Component and now wraps the existing iframe with
    `@daily-co/daily-js` (`DailyIframe.wrap()` — keeps Daily Prebuilt's own UI, including the pre-join
    lobby, rather than swapping in a custom call surface) via a new `onParticipantCountChange` prop,
    which is how every connected tab detects "a second person has joined" directly from the call
    itself, no server round-trip needed for that trigger.
  - `src/components/call-room.tsx`: new waiting state ("Waiting to start" + explanation) shown instead
    of the ticking countdown until `started` is true; a "Start now" button and the participant-count
    callback both call the same `triggerStart`; a status-poll effect (every 4s, only while waiting)
    picks up a start triggered from a different tab. CallMedia (the actual call) still renders
    throughout the wait, so people already in the lobby/call are genuinely waiting together, not
    blocked from connecting. Hit one ESLint `react-hooks/set-state-in-effect` error along the way (an
    extra synchronous `setState` call in the ticking effect's body, added while trying to make the
    display update instantly on start) — fixed by dropping back to the original single-setState-inside-
    setInterval-callback shape, same pattern the pre-existing countdown effect already used, accepting
    up to a 1-second display lag after a start rather than fighting the lint rule.
  - `src/app/[room]/page.tsx`: links now carry `d` (durationSeconds) alongside `exp`; when `d` is
    present, this page re-fetches the room's *live* status from Daily rather than trusting the link's
    own `exp`, and passes `durationSeconds`/`started` down to CallRoom. **Backward compatible:** a link
    minted before this feature (`d` missing) is treated as already-started, using its `exp` exactly as
    before — verified no existing shared link breaks (see below).
  - `src/components/create-link-form.tsx`: generated links now include `&d=${durationSeconds}`.
  - Added `@daily-co/daily-js` as a new dependency (`npm install` in the scratch build dir, then
    `package.json`/`package-lock.json` copied back to the mount — this is the first new runtime
    dependency added since the original Next.js scaffold).
  - Verified: `npm run lint`/`npm run build` clean. Full round-trip tested via curl, in one shell
    invocation per test (this sandbox's bash tool runs each call in an isolated process with no
    cwd/background-process carryover between calls, discovered mid-verification when an earlier
    nohup'd dev server from a prior call turned out not to be reachable in the next one — worth noting
    for future runs), in both mock mode and against the real Daily API (once locally, once again
    against production after deploying): create → page shows "Waiting to start"/"Start now" → status
    returns `started:false` with the buffer `exp` → start returns `started:true` with
    `exp ≈ now + duration` → calling start again with a *different* duration is a no-op, proving the
    idempotency/race guarantee → status after start confirms `started:true`. Also verified an old-style
    link (`exp` only, no `d`) still shows an immediate ticking countdown (`role="timer"`, a real `1:59`),
    and an already-expired legacy link still shows the ended screen — both exactly as before. Test
    rooms created against the live Daily API (once locally, once in production) were deleted afterward
    via the Daily API. No real second-participant/live-video test was possible in this sandbox (still no
    working headless browser, confirmed again this session — Playwright's browser install still needs
    root), so the join-triggered auto-start path is verified by code review and the shared
    `triggerStart` function (identical code path to the manual-button trigger once called) rather than
    by an actual two-person call.
  - Deployed via the Vercel CLI (same `secrets.blackstart.local.txt` `VERCEL_TOKEN` line), pushed to
    GitHub, mount's `.git` re-synced, `git status --porcelain` confirmed clean.
  - Also added a new ROADMAP.md Phase 1 item, roadmap-only per Andreas's own framing ("add to
    roadmap..."): "Vote to end early" — participants vote to end a call in progress, ends immediately
    once over 50% agree. Designed to reuse this same build's mechanism (setting `exp` directly, no new
    datastore, participant count already visible via the same daily-js wrapping) rather than invent a
    second one — see the ROADMAP.md entry for the open questions flagged for build time (un-voting,
    exact-50%-with-2-participants edge case).
- 2026-07-21 (later still, interactive): Andreas shared a real link in WhatsApp and asked for the link
  preview to say something more inviting than the generic site title/description — proposed "Andreas
  wants a Qwickword. Click to start your X minute meeting." Asked whether the name should be
  hardcoded, come from a new "your name" input, or be dropped entirely rather than guess; Andreas
  answered "Just use 'Someone' wants a." Built and deployed: `src/app/[room]/page.tsx` now exports
  `generateMetadata`, reading the link's `d` (durationSeconds) query param and building "Someone wants
  a Qwickword. Click to start your N minute(s) meeting." — falls back to the original site description
  for a link with no valid `d` (pre-this-feature or mistyped, same fallback used elsewhere in this
  page). Extracted a shared `parseDurationParam` helper so `generateMetadata` and the page component
  can't quietly drift on what counts as a valid duration. New `formatMinutesPhrase` in
  `src/lib/duration.ts` handles singular/plural ("1 minute" vs. "5 minutes"). Verified: `npm run
  lint`/`npm run build` clean; curl-checked both `<meta name="description">` and
  `<meta property="og:description">` for a valid-duration link (plural and singular cases both
  checked), and confirmed a legacy no-`d` link still gets the original fallback text.
- 2026-07-21 (later still, interactive): mid-verification of the above, Andreas reported clicking
  "Join the meeting now" right after creating a link showed a browser-level crash page ("This page
  couldn't load. Reload to try again, or go back.") rather than anything from this app — a retry with
  the same link worked. Root cause found in `src/components/call-media.tsx`: the daily-js cleanup
  effect never called `callObject.destroy()`, on the assumption (stated in this file's own comment)
  that React removing the `<iframe>` from the DOM was enough to end the call. That's true for the call
  itself, but daily-js separately enforces a page-wide singleton — only one `DailyCall` instance is
  allowed to exist at a time — and that instance survives the DOM node's removal if never destroyed.
  In a client-routed SPA (no full page reload between navigations), a later `DailyIframe.wrap()` call
  in the same tab could then throw ("Duplicate DailyIframe instances are not supported"), and since
  there was no error boundary anywhere in the app at any level, that uncaught exception had nowhere to
  land except the browser's own generic crash UI — which is exactly what the screenshot showed. Fixed
  both ends: `destroy()` now actually runs on cleanup (itself wrapped in try/catch, since it can throw
  if the call was never fully connected); `DailyIframe.wrap()` and the participant-count read are both
  wrapped in try/catch too, so a daily-js failure degrades gracefully (participant-based auto-start
  just doesn't fire; the manual "Start now" button and the call itself are unaffected) instead of
  crashing the component; and a new `src/app/error.tsx` (Next.js's App Router error-boundary
  convention — a Client Component exporting `error`/`reset` props) gives any future uncaught render
  error a friendly "Something went wrong" screen with a "Try again" (calls `reset()`, no full reload)
  and a "Back to Qwickword" link, instead of leaking to the browser. Verified: `npm run lint`/`npm run
  build` clean; a full create → room-page-loads-with-waiting-state round trip against the live Daily
  API and production (`https://qwickword.com`) showed no crash on the same flow Andreas hit. Could not
  reproduce the exact "duplicate instance" browser crash directly in this sandbox — still no working
  headless browser (Playwright's install still needs root, confirmed again this session) — so this fix
  is verified by identifying and correcting the specific incorrect assumption in the code (documented
  in `call-media.tsx`'s own comment at the time) plus the general safety net of the new error boundary,
  not by reproducing the exact crash and watching it not recur.
  Deployed via the Vercel CLI (same `secrets.blackstart.local.txt` `VERCEL_TOKEN` line), pushed to
  GitHub, mount's `.git` re-synced, `git status --porcelain` confirmed clean.
- 2026-07-21 (later still, interactive): Andreas asked two questions after using the app live with a
  friend.
  1. **Facebook Messenger link disappearing.** He pasted a qwickword.com link into Messenger on
     desktop three times; each time the link (and its preview) vanished from his own chat view shortly
     after sending, but the friend on the other end did receive it. Asked whether this was a DNS or
     domain-blocking issue on our side. Researched rather than guessed: confirmed via a direct test
     that the server side is fine — curled a real room link with Facebook's own crawler user agent
     (`facebookexternalhit/1.1`) and got a clean `200` in under a second with correct `og:title`/
     `og:description` tags, so this isn't a broken page, a DNS problem, or a slow/failing response to
     Facebook's crawler. Web search turned up Meta's "Advanced Browsing Protection" (ABP) — an
     on-device link-safety check in Messenger that scans links locally against a continually-updated
     malicious-site watchlist and can act on a match, plus general awareness that very new/unindexed
     domains (qwickword.com was only connected to this project a few days ago) tend to get flagged
     more readily by automated safety systems than domains with an established history. The most
     likely explanation given the reported pattern (message removed from the sender's own view, still
     delivered to the recipient) is exactly that shape of client-side, sender-local intervention,
     though this couldn't be confirmed with certainty from public documentation — told Andreas plainly
     that this is the most likely explanation, not a confirmed mechanism, and suggested he could check
     Facebook's own Sharing Debugger tool (developers.facebook.com/tools/debug/) against a real link
     for anything Facebook itself flags. Not a code issue, no fix to make on this one — informational
     only, but a real, sourced answer rather than a guess.
  2. **Call video window feels small vs. Google Meet/Teams; friend on mobile called it "cropped."**
     See the video-window-size entry above — this is the fix for that second question.
- 2026-07-21 (later still, interactive): Andreas asked "whats the next natural small build" —
  recommended the T-10s countdown audio cue over dark mode/settings menu (both bigger, needing new
  persistence and UI chrome) since the audio cue was already fully spec'd by Andreas earlier this
  session and just hadn't been built yet, and is small and self-contained. He confirmed by immediately
  adding one more piece: "also shift to gentle reddish by t-minus 10." Built and deployed both together:
  `src/components/call-countdown.tsx` gained a `rose`-coloured stage for the last 10 seconds (kept
  gentler than the harsher red used once the call has ended, and distinct from the existing amber T-30s
  stage) and a per-second Web Audio tick across that same window, quietly louder as it nears zero
  (volume ~0.04 to ~0.14). No audio file asset — a plain oscillator with a fast attack/decay envelope —
  wrapped in try/catch so a blocked or unsupported `AudioContext` never breaks the visual countdown.
  Became a Client Component to hold the small bit of state this needs (last-ticked second, the
  `AudioContext` instance), otherwise unchanged: still a stateless renderer of whatever `remainingMs`
  CallRoom passes it. Verified: `npm run lint`/`npm run build` clean; curl-checked a real, live room
  (created and later deleted via the Daily API) at 8s remaining renders the new `rose` class, and one at
  20s remaining still renders the existing `amber` class — confirms the two stages don't collide. The
  audio side has no DOM trace to curl-check — verified by code review and the same defensive try/catch
  pattern used elsewhere in this app for daily-js/audio-adjacent code, not by an actual browser test
  (still no working headless browser in this sandbox). Deployed via the Vercel CLI (same
  `secrets.blackstart.local.txt` `VERCEL_TOKEN` line), pushed to GitHub, mount's `.git` re-synced,
  `git status --porcelain` confirmed clean. ROADMAP.md's "Countdown polish" item marked `[x]`.
- 2026-07-22 (nightly): Read STATUS.md/ROADMAP.md/BUILD_PLAN.md/ASKS.md per the standing run
  instructions; no open ASKS.md blockers to act on. Found the mount's working tree already had an
  uncommitted, unlogged diff touching `src/components/create-link-form.tsx` and `src/lib/duration.ts`
  (a manual-minutes-field redesign of the duration picker, well-commented, reads like real interactive
  work — "instead of the selector, a manual field. Max 30m" — but with no matching STATUS.md entry and
  no ROADMAP.md item marked for it) plus a stray `.git/index.lock` left over from some earlier
  interrupted process. Left both alone rather than guessing at intent: didn't commit, revert, or build
  on top of unverified work that wasn't mine and wasn't logged. **This still needs a look**: someone
  (a future run, or Andreas) should check `git diff` in the working folder before doing anything else
  git-related there, and either finish/verify/commit that duration-field change or intentionally
  discard it. The `index.lock` file blocks any git *write* directly on the mount (matches this file's
  existing "Platform note" above) — read-only git commands still work fine against it, which is how
  this was even discovered.
  Picked the first unchecked, non-gated ROADMAP.md item — "Vote to end early" — and built it. See the
  ROADMAP.md entry (now `[x]`) for full detail; summary: `src/lib/daily-rooms.ts` gained `endRoomNow`,
  a new `POST /api/rooms/[room]/end` route, and `src/components/call-media.tsx` /
  `src/components/call-room.tsx` gained the vote-broadcast/tally/threshold/UI machinery. Reused the
  exact "Daily/daily-js state is the only source of truth, no new datastore" principle the
  anchor-countdown-to-first-join feature already established, per this item's own notes.
  **Sandbox disk space was a real, load-bearing problem tonight**, worth a permanent note for future
  runs: this session's local sandbox disk (`/`, ~9.6G) started essentially full (shared with other
  sessions' leftover files under `/tmp`, mostly owned by `nobody`/other UIDs and therefore not
  something this session could clean up) — `npm install` inside this folder's usual `mnt/` path failed
  outright with `ENOSPC`. Worked around it by moving the whole scratch build (`npm install`, lint,
  `tsc --noEmit`, `next build`, `next start` + curl verification, and the actual git commit) into
  `/tmp/qwickword` on the sandbox's own disk rather than the FUSE mount (consistent with this file's
  existing platform note), and by pointing `npm install`'s cache at `/dev/shm` (tmpfs, a separate
  device from `/`) rather than the default `~/.npm` cache, which is what let the install actually
  finish. Even so, disk hovered at single-digit megabytes free for most of the session; a `next build`
  succeeded once cleanly (confirmed the new route registers correctly:
  `ƒ /api/rooms/[room]/end` in the route table) before a since-abandoned attempt to redirect *that*
  build's output to `/dev/shm` via a temporary `distDir` override (to protect the last few MB of disk)
  landed the output inside the project directory instead of tmpfs and briefly confused a lint run by
  pointing it at generated build artifacts instead of source — caught immediately (the lint output was
  full of `require()`/`@ts-ignore` warnings from `next`'s own generated JS, an obvious tell), the
  `next.config.ts` override was reverted before anything was committed, and a plain `eslint src` (as
  opposed to `eslint .`) confirmed the actual source was always clean throughout. Never touched
  `next.config.ts`, `tsconfig.json`, or any other tracked file as a lasting result of this — those
  diffs were reverted (`git checkout --`) before staging anything.
  **Verification, given the above:** `npm run lint` (`eslint src`) and `tsc --noEmit` both clean. One
  full `next build` succeeded, confirming the app compiles and the new route registers. Full
  create → start → end round trip via curl against a real running server, in both mock mode and live
  mode against the real Daily API (test room created, started, ended, and cleaned up) — this is what
  caught a genuine bug: Daily's REST API rejects a PATCH whose `exp` isn't strictly in the future
  (`"exp was '...', which is in the past rather than in the future"`), so the first version's bare
  `now` failed with a 400 on the *second* attempt to end a call (the very first end succeeded by
  chance, before the clock ticked over during the request). Fixed by asking for `now + 1` second
  instead; re-verified two ways — the full app's `/end` route, and a small standalone Node script
  hitting the live Daily API directly with the exact same `now + 1` value — both green, plus the delete
  cleanup afterward confirmed. No real multi-tab vote-broadcast test was possible (still no working
  headless browser in this sandbox) — that part (the `sendAppMessage` broadcast/tally logic in
  `call-media.tsx`) is verified by code review and the same defensive try/catch pattern already used
  throughout this file for daily-js-related code, same standard this app has held to for every
  daily-js feature so far.
  **Committed locally, not deployed.** This session had no GitHub push credentials — `secrets.local.txt`
  (which a previous session used to read a `QWICKWORD_GITHUB_PAT` line, per the 2026-07-21 entry above)
  wasn't present anywhere in this session's accessible filesystem, and neither was
  `secrets.blackstart.local.txt` (used for the separate Vercel deploy token). Committed the change in a
  scratch git clone under `/tmp/qwickword` (per this file's standing platform note) and copied the
  finished `.git` back onto the mount; did not attempt to push to GitHub or deploy to Vercel without
  the tokens to do so safely. See ASKS.md for what unblocks this next.
  ROADMAP.md's "Vote to end early" item marked `[x]`.
- 2026-07-22 (later, interactive): the sandbox VM this run had been using reset mid-session (a fresh
  `/tmp`, disk usage back down from 100% full to 68%) — the scratch git clone from the nightly portion
  above was lost, but the mount's working tree (edited via the `Write`/`Edit` tools, which target the
  Windows-side mount directly, not the ephemeral Linux sandbox) was untouched. Rebuilt the scratch
  environment fresh; this time `git commit` worked directly on the mount without the corruption
  documented in the platform note above (tested carefully — staged, committed, then verified with
  `git show`/`git fsck` that the result wasn't NUL-padded or otherwise corrupted) — the earlier session's
  corruption may have been specific to that session's degraded disk state rather than a permanent
  block; worth a future run re-testing this rather than assuming the scratch-clone workaround is always
  required.
  Andreas then used the app live and reported three real bugs plus two feature/design requests, handled
  in order as they came in — see "Live bug fixes + 'leave the call' fix + bigger call window" in
  "Current state" above for full detail on each: the countdown-flash bug, the unreliable auto-start, the
  early-end clock skew, a T-10s "Time to wrap!" text cue, and (in a follow-up message) a much wider call
  window to match Google Meet's. Root-caused the countdown flash precisely (a genuine synchronous-state
  timing bug, fixed and confirmed via code review of the exact render/effect sequence); the auto-start
  and clock-skew fixes are defensive redundancy rather than confirmed root-cause fixes, since no real
  two-tab browser session was reproducible in this sandbox to pin down the exact failure — told Andreas
  this distinction honestly rather than claiming more certainty than the verification actually supports.
  Then Andreas asked for one more behavior change: "the timer also should go away after we have left the
  call, no more countdown" — added `left-meeting` detection (daily-js's event for the *local*
  participant leaving) and a dedicated "You've left this call" screen, replacing the countdown/call
  area/buttons entirely once left, independent of whether the room itself has actually ended for anyone
  else still in it.
  All of the above verified the same way as the rest of tonight's work (`npm run lint` / `tsc --noEmit`
  / `npm run build`, all clean at every step) and committed directly on the mount (four separate commits,
  one per logical change, matching this project's usual granularity).
  **Deploy blocker, then resolved:** this session had no path to `secrets.local.txt`
  (`QWICKWORD_GITHUB_PAT`) or `secrets.blackstart.local.txt` (`VERCEL_TOKEN`) — both live in the parent
  `C:\Users\acnic\ClaudeCoding` folder, one level above the `QuickWord` folder this session was scoped
  to, so they were invisible no matter where inside `QuickWord` was searched. Asked Andreas directly
  (interactive, not an ASKS.md entry, since he was present) rather than guessing or working around it;
  he granted access to the parent folder via `request_cowork_directory`. Read both tokens (one line
  each, same pattern as every previous session that's used them), pushed all of tonight's commits to
  GitHub with a one-off authenticated push URL (token not saved into `.git/config`), installed the
  Vercel CLI into a sibling directory (`/tmp/vercel-cli`, outside the app's own folder tree — the
  established pattern for avoiding the `package.json` pollution bug documented earlier in this file),
  linked the existing `quickword` Vercel project (confirmed by listing projects first — `quickword`,
  live at `qwickword.com`, was already there; didn't create a new one), and deployed
  (`vercel deploy --prod`). `vercel link` appended a `VERCEL_OIDC_TOKEN` line to `.env.local` — checked
  it didn't disturb the existing `DAILY_API_KEY`/`DAILY_DOMAIN` lines, which it didn't. Live-smoke-tested
  a full create → start → end round trip directly against `https://qwickword.com` after deploying — all
  three calls succeeded. Live on `https://qwickword.com`. ASKS.md's now-resolved credentials-access item
  moved to Done; the separate stray-uncommitted-duration-field-WIP item from earlier tonight is still
  open (unrelated, not touched).
- 2026-07-22 (interactive, v2 preview mobile follow-up): Andreas tried `/test` on his phone.
  Reported (with a screenshot): "the image didnt fit inside my mobile screen, so in order to toggle any
  of the buttons I had to swipe down which then would make the timer disappear at the top." Root cause:
  `src/app/test/[room]/page.tsx`'s outer wrapper used `h-screen w-screen` (`100vh`) — on mobile Safari
  `100vh` is measured with the browser chrome (address bar) *hidden*, so while the chrome is showing
  (the normal state on load) the page was actually taller than the visible viewport, making it
  scrollable. Scrolling down to reach the bottom control pill dragged the top countdown overlay out of
  view with it, since both lived in the same scrollable flow. Fixed by switching the wrapper to
  `fixed inset-0 h-dvh w-dvw touch-none overscroll-none` — `fixed` takes it out of document flow
  entirely (nothing to scroll, so there's no way to hide the timer to reach the buttons), `h-dvh`
  tracks the actual current visible height as the chrome shows/hides instead of assuming the
  chrome-hidden maximum. Also added explicit `env(safe-area-inset-top/bottom)` padding to
  `call-overlay.tsx` and `call-controls.tsx` so the timer and control pill clear the notch/home-indicator
  on phones like the one in Andreas's screenshot, rather than relying on the fixed `pt-4`/`bottom-6`
  Tailwind classes.
  **Also reported, not a code fix:** "I took a screenshot and then suddenly the video view on my main
  screen on the desktop was super zoomed in on the other persons face. This persisted even after
  leaving the qwickword on mobile and rejoining." This is very unlikely to be a Qwickword bug —
  `CallVideoGrid`'s `DailyVideo` renders whatever the incoming WebRTC track actually looks like;
  `fit="cover"` recomputes automatically from the track's real dimensions, it isn't a stale-CSS state
  that could get "stuck" across a leave/rejoin. The most plausible explanation is iOS's own camera
  auto-framing (Center Stage / continuity camera reframing) engaging on the phone's front camera —
  something outside this app's control, since Daily/the browser only sees the frames the OS hands it.
  Told Andreas this directly rather than guessing at a fake in-app fix; suggested toggling the camera
  off/on as a workaround if it recurs, and flagged it as worth watching for a pattern (e.g. does it
  only happen right after a phone screenshot specifically) if it keeps happening.
  Verified (`eslint`, `tsc --noEmit`, `next build`, all clean) in the `/tmp/qwickword` scratch clone,
  committed and pushed, deployed to Vercel production, confirmed `Ready` and aliased to
  `qwickword.com`.
- 2026-07-22 (interactive, live production bug report): Andreas hit two bugs on the real
  `qwickword.com/[room]` flow (not `/test`), with screenshots — "I joined the call from my mobile
  phone... as a second participant the timer didn't start this is the second time I've seen it... The
  timer of course has to start as soon as the second person joins what is the way that we can enforce
  this so it always happens" and "once I leave the call I still have the text at the top that says
  waiting to start and the button to start now... is there a hook or is there a connector that can send
  a message back from daily to let me know that I've left the call."
  **Root cause (both bugs, one shape):** every existing signal for "who's in the call" and "did I
  leave" — the daily-js `participant-joined`/`left-meeting` events AND the 2s client-side backstop
  poll added earlier this session for the same class of bug — all live inside ONE browser tab's
  `DailyIframe.wrap()` bridge. If that bridge glitches for any tab (a stale call-object race is a
  previously-seen failure mode in this exact file's own history; cross-iframe postMessage flakiness is
  also a known class of issue for embedded video especially on mobile Safari), every dependent signal
  fails together silently — which fits both bugs showing up in the same session, and fits "the second
  time I've seen it" (intermittent, not every call).
  **Fix — moved the enforcement server-side, independent of any browser tab's daily-js:** Daily's own
  `GET /rooms/:name/presence` REST endpoint (verified live against a real Daily room —
  `total_count`/`data` shape confirmed, not just docs) reports who's actually connected, computed by
  Daily's own server, with zero dependency on any client's JS. Added `getRoomPresence()` to
  `src/lib/daily-rooms.ts`. `/api/rooms/[room]/status/route.ts` (already polled by every waiting tab
  every 4s, and by every "in-call" tab every 10s) now: (1) accepts an optional `durationSeconds` param
  and, if the room hasn't started and Daily reports 2+ people present, calls `startRoomCountdown`
  itself — server-side auto-start that works even if every connected tab's own daily-js is completely
  broken; (2) always returns `presentCount` when live. `call-room.tsx`'s waiting-poll now sends
  `durationSeconds`; its 10s in-call resync poll now treats `presentCount === 0` (for two consecutive
  polls, so a propagation-delay blip right after joining can't false-trigger) as "nobody's actually
  still connected" and swaps to the left-call screen, regardless of whether `left-meeting`/`meetingState()`
  fired for this tab. Both are additive — the existing client-side triggers still fire first in the
  normal case; these are now a genuinely independent backstop, not a duplicate of the same broken path.
  Also added a 3-attempt retry (0/250/750ms backoff) around `DailyIframe.wrap()` itself in
  `call-media.tsx`, restructured into a `attemptWrap`/`setUp` split so the retry chain doesn't need
  async/await inside the effect body — directly targets the single-root-cause theory (a transient
  "Duplicate DailyIframe instances" race leaving that tab's whole event/backstop system unwired from
  the start) without changing behavior when wrap() succeeds first try, which is the common case.
  Told Andreas honestly that the exact original trigger can't be confirmed without live telemetry from
  his actual failing session — this is the strongest fix available without that, and it removes the
  single-point-of-failure the previous fix (client-only backstop poll) still had.
  Verified (`eslint`, `tsc --noEmit`, `next build` clean; also live-tested `getRoomPresence` against a
  real throwaway Daily room — `total_count: 0` confirmed, deleted after) in `/tmp/qwickword`, committed,
  pushed, deployed to Vercel production, confirmed `Ready` and aliased to `qwickword.com`.
- 2026-07-22 (interactive): Andreas asked whether the app tracks who's visiting the site and how, since
  the existing Neon Postgres table only logs actual call activity (created/started/ended), not homepage
  traffic. Presented four options (Vercel Web Analytics, Plausible/Fathom, Google Analytics, or logging
  pageviews into the existing Neon DB) with the cookie-consent/cost/effort tradeoffs of each — he picked
  Vercel Web Analytics. Installed `@vercel/analytics`, added `<Analytics />` to
  `src/app/layout.tsx`'s body — cookieless, no consent banner needed, free tier (2,500 events/month)
  plenty for current traffic. Shows up in the Vercel dashboard for the `quickword` project once live
  traffic starts hitting it.
  Same message, Andreas also asked for "SEO optimization... and AI search optimization so AIs will find
  it": added `metadataBase`/`keywords`/`openGraph`/`twitter`/explicit `robots` metadata to
  `layout.tsx` (title/description text unchanged, just made discoverable to crawlers and link
  previews); `src/app/robots.ts` (explicit allow-all + sitemap pointer — traditional and AI crawlers,
  e.g. GPTBot/ClaudeBot/PerplexityBot, mostly read the same robots.txt convention; deliberately doesn't
  try to pattern-block room links, since robots.txt has no real regex support and those links are
  unguessable/unlinked anyway — see the file's own note); `src/app/sitemap.ts` (just `/` and
  `/manifesto` — the site's only two permanent, indexable pages); `public/llms.txt` (an emerging
  convention — a plain-language "what is this site" doc some AI crawlers/agents check, separate from
  robots.txt); and a `WebApplication` schema.org JSON-LD block on `src/app/page.tsx` only (not the
  shared `HomeContent` component, so `/test` doesn't carry the same structured data as the real
  product page).
  Verified (`eslint`, `tsc --noEmit`, `next build` — confirmed `/robots.txt` and `/sitemap.xml` both
  generate as static routes) in `/tmp/qwickword`. Note: `npm install` doesn't work directly on the
  FUSE-mounted project folder (`ENOTEMPTY` renaming `node_modules/acorn` — a known limitation of this
  mount type with npm's install process, not specific to this package) — installed in the scratch
  clone instead and copied the resulting `package.json`/`package-lock.json` back, same workaround
  pattern used for git operations on this project all session.
