# Quick Word — Status Log

**How to use this file:** At the start of every run, read this file top to bottom to learn the
current state. At the end of every run, update the "Current state" block and append a dated entry
to the "Run history" log. Keep it honest — record what actually works, not what was attempted.

---

## Current state
- **Phase:** M2 (Timer + call UX) under way — call page built and verified. Phase 0, items 1–5
  of ROADMAP.md complete.
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
- **Deployed:** no.
- **Blockers waiting on Andreas:** none blocking (see ASKS.md for the low-urgency key-rotation note
  and the later Vercel deploy approval).

## Next actions (for the next run)
The build is now driven by ROADMAP.md. Work the first unchecked, non-gated item in order.
Currently that is Phase 0, item 6: invalid/expired-link handling — a friendly screen instead of a
crash when a link is dead or malformed. Tonight's `/[room]` page already has a minimal inline
fallback for a missing `exp` param, but does not yet check whether the room actually still exists on
Daily (live mode) or handle a malformed room name — that's this next item's job. Also worth
considering while there: what should happen when a mock-mode link is opened after tonight's window
(mock rooms aren't persisted anywhere, so "expired" has no real meaning for them yet — decide and
document rather than leaving it implicit).
Before doing any `npm install` or `git` work, re-read the platform note above (**and its 2026-07-16
addendum**) and build/verify in a scratch dir first, then sync source + `.git` back in — and
re-verify any file this note flags with `Read` before trusting a bash view of it. One more thing
confirmed working tonight (2026-07-17): a **local `git clone` of the mount's own `.git` directory
into the scratch dir** (`git clone /path/to/mount/QuickWord/.git scratch/quickword`) reconstructs a
byte-correct working tree entirely from git's object store and native-disk writes — no bash `cat`/`cp`
of the mount's working-tree files involved at all. This is a cleaner variant of the existing
"heredoc known-good content into scratch" workaround and worth using as the default way to start a
scratch build; verified by checking the cloned `page.tsx` was exactly 1318 bytes (matching the
`Read`-tool-verified true content), vs. a corrupted 3445-byte NUL-padded read of the same file
directly off the mount in the same run (see run history below for the full detail).

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
