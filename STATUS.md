# Quick Word — Status Log

**How to use this file:** At the start of every run, read this file top to bottom to learn the
current state. At the end of every run, update the "Current state" block and append a dated entry
to the "Run history" log. Keep it honest — record what actually works, not what was attempted.

---

## Current state
- **Phase:** M0 (scaffold) — done. Phase 0, item 1 of ROADMAP.md complete.
- **Repo:** initialised, `main` branch, first commit made.
- **App runs locally:** yes (verified) — `npm install && npm run dev` boots Next.js 16.2.10
  (App Router, TypeScript, Tailwind, ESLint, `src/` dir) and serves the default placeholder page
  at `/` with HTTP 200 and no errors. `node_modules` is NOT committed (standard practice) and is
  not present in this folder either — see the platform note below before running `npm install` here.
- **Platform note — read this before any future npm/git work in this folder:** this project folder
  is bridged into the build sandbox over a FUSE mount, which has two quirks discovered tonight:
  (1) files/dirs can be *renamed* but never *deleted* (`rm`/`unlink` fails with "Operation not
  permitted"; `mv`/rename succeeds) — so cleanup means renaming cruft out of the way and
  `.gitignore`-ing it, not deleting it; (2) atomic lock-file-then-rename writes (what `git init` /
  `git config` / `git commit` use internally to write `.git/config`, refs, etc.) land as a
  correctly-sized file full of NUL bytes instead of real content — i.e. **git does not reliably
  work when run directly inside this mounted folder**. Workaround used tonight and recommended for
  future runs: do `npm install`, `next dev`/`build`, and all `git` operations (`init`, `add`,
  `commit`) in a scratch directory on the sandbox's native disk (e.g. `/sessions/<id>/scratch/...`,
  NOT under `mnt/`), then copy the resulting source files and the finished `.git` directory back
  into this folder with plain `cp` (plain copy writes are fine on this mount; it's specifically the
  lock+rename pattern that breaks, and outright deletes that are blocked). Two harmless leftover
  artifacts from tonight's false starts were renamed to `.trash-broken-scaffold-2026-07-13/` and
  a few similarly-named `.trash-broken-git-*` folders from repeated attempts (all gitignored) —
  safe for Andreas to delete by hand from Windows whenever convenient; they cost disk space but
  nothing else. Also found: the `Read`/`Write`/`Edit` file tools and the `bash` tool's view of this
  same folder can disagree for a while after an edit — `bash cat`/`wc` may show stale content even
  though `Read`/`Write`/`Edit` (the Andreas-visible, authoritative side) already has the update.
  If a bash script needs a just-edited file's content, rewrite it directly from bash too rather
  than trusting a bash read of an Edit-tool change.
- **Daily.co:** account created; domain `quickword.daily.co`; API key present in `.env.local`
  (`DAILY_API_KEY`, `DAILY_DOMAIN`). Proceed with real Daily video integration (M1 / Phase 0 item 3).
- **Hard-expiry design (locked):** create rooms with `exp = now + duration`,
  `eject_at_room_exp: true`, and `eject_after_elapsed = duration` as a per-participant backstop.
  Validate exact property names against the live Daily API on first keyed run; log any correction.
- **Deployed:** no.
- **Blockers waiting on Andreas:** none blocking (see ASKS.md for the low-urgency key-rotation note
  and the later Vercel deploy approval).

## Next actions (for the next run)
The build is now driven by ROADMAP.md. Work the first unchecked, non-gated item in order.
Currently that is Phase 0, item 2: read `DAILY_API_KEY` / `DAILY_DOMAIN` from `.env.local` with a
mock fallback so the app runs without a key. Before doing any `npm install` or `git` work, re-read
the platform note above and build/verify in a scratch dir first, then sync source + `.git` back in.

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
  Tailwind, ESLint, `src/` dir) via `create-next-app`. Discovered this folder's FUSE mount blocks
  deletes and corrupts git's lock-file writes (see the platform note in "Current state" above);
  worked around it by building/verifying/git-initing in a sandbox scratch dir and copying the
  finished source + `.git` into this folder. Verified `npm run dev` → "Ready" in ~300ms and
  `GET /` → HTTP 200 with the default placeholder page, no errors. Repo initialised on `main` with
  an initial commit. Two harmless renamed-not-deleted artifacts left in the folder root (gitignored,
  see platform note). Next: Phase 0 item 2 (env var + mock-mode fallback).
