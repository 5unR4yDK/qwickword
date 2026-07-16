# Quick Word — Status Log

**How to use this file:** At the start of every run, read this file top to bottom to learn the
current state. At the end of every run, update the "Current state" block and append a dated entry
to the "Run history" log. Keep it honest — record what actually works, not what was attempted.

---

## Current state
- **Phase:** M1 (Daily integration) — `POST /api/rooms` built and verified live. Phase 0, items 1–3
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
- **Deployed:** no.
- **Blockers waiting on Andreas:** none blocking (see ASKS.md for the low-urgency key-rotation note
  and the later Vercel deploy approval).

## Next actions (for the next run)
The build is now driven by ROADMAP.md. Work the first unchecked, non-gated item in order.
Currently that is Phase 0, item 4: the create-link page (choose a duration, click "Create Quick
Word", get a shareable link) — the first real consumer of `POST /api/rooms` from a browser, calling
it with a `durationSeconds` chosen via UI rather than curl. The 60–3600s validation bounds on the
route (see above) aren't a locked product decision — feel free to revisit them when building the
duration picker.
Before doing any `npm install` or `git` work, re-read the platform note above and build/verify in a
scratch dir first, then sync source + `.git` back in — and re-verify any file this note flags with
`Read` before trusting a bash view of it.

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
