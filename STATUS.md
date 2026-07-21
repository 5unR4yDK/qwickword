# Quick Word — Status Log

**How to use this file:** At the start of every run, read this file top to bottom to learn the
current state. At the end of every run, update the "Current state" block and append a dated entry
to the "Run history" log. Keep it honest — record what actually works, not what was attempted.

---

## Current state
- **Phase:** Phase 0 (MVP) is fully complete, deployed, and verified. All 9 ROADMAP.md items are
  done. **Live at https://quickword.vercel.app.** Phase 1 ("Usable") is now underway — item 1
  (pre-join screen) done 2026-07-21, see below.
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
