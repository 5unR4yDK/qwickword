# Qwickword — Things I need from Andreas

The nightly build task appends here whenever it hits something it can't (or shouldn't) do on its own.
Check this each morning. Clearing these unblocks the next night's progress.

## Open
- [ ] **(Recommended, low urgency) Rotate the Daily API key.** The current key was pasted into a
      chat transcript on 2026-07-12, so best practice is to regenerate it in the Daily dashboard
      (Developers) and replace the value in `.env.local`. One-line swap. Not blocking the build.
- [ ] **Stray uncommitted work found in the project folder (2026-07-22), needs a decision.**
      `src/components/create-link-form.tsx` and `src/lib/duration.ts` have an uncommitted,
      well-written change (a manual minutes field replacing the duration-preset dropdown, "Max 30m")
      that reads like real interactive work but has no matching STATUS.md entry or ROADMAP.md
      checkbox — tonight's run left it untouched rather than guessing whether to finish, verify, or
      discard it. Please take a look at `git diff` in the project folder and either say "finish that"
      or "discard it" so a future run can act on it cleanly.

## Done
- 2026-07-22 (interactive) — Andreas granted access to the parent `C:\Users\acnic\ClaudeCoding` folder
  (the `QuickWord` folder alone doesn't include it), which is where `secrets.local.txt`
  (`QWICKWORD_GITHUB_PAT`) and `secrets.blackstart.local.txt` (`VERCEL_TOKEN`) actually live — this is
  what had blocked the nightly run from pushing/deploying earlier the same night. Pushed and deployed
  from there; see STATUS.md.
- 2026-07-12 — Daily.co account created, domain `quickword.daily.co`, API key added to `.env.local`.
- 2026-07-20 — Vercel deploy approved in chat ("ok to deploy ok to make new vercel project"); Andreas
  pointed the run at the folder holding his Vercel account token. Deployed to a brand-new project,
  `quickword`, live at **https://quickword.vercel.app**. Used the same `DAILY_API_KEY`/`DAILY_DOMAIN`
  values already in `.env.local` (no rotation) and the default `*.vercel.app` domain (no custom domain
  set up). See STATUS.md/ROADMAP.md item 9 for full detail.
- 2026-07-21 — `qwickword.com` DNS corrected and saved by Andreas at GoDaddy (fixed the `www` CNAME
  target and added the missing apex `A` record per the exact values worked out together in chat) and
  propagated fast. Confirmed via Vercel's domain-config API: `misconfigured: false`. Live-smoke-tested
  `https://qwickword.com/` directly (home page, and a real create-room round-trip against the live
  site, room deleted after). See ROADMAP.md's domain-connect item, now `[x]`, for full detail.
