# Qwickword — Things I need from Andreas

The nightly build task appends here whenever it hits something it can't (or shouldn't) do on its own.
Check this each morning. Clearing these unblocks the next night's progress.

## Open
- [ ] **(Recommended, low urgency) Rotate the Daily API key.** The current key was pasted into a
      chat transcript on 2026-07-12, so best practice is to regenerate it in the Daily dashboard
      (Developers) and replace the value in `.env.local`. One-line swap. Not blocking the build.
- [ ] **No GitHub/Vercel push-deploy credentials available tonight (2026-07-22).** Tonight's "Vote to
      end early" build (see STATUS.md) is committed locally but not pushed to GitHub or deployed to
      Vercel — this session couldn't find `secrets.local.txt` (`QWICKWORD_GITHUB_PAT`) or
      `secrets.blackstart.local.txt` (`VERCEL_TOKEN`) anywhere in its accessible filesystem, even
      though previous sessions read them successfully. If those files normally live outside the
      `QuickWord` folder itself (e.g. one level up), a future session working from this same folder
      won't be able to reach them either unless they're moved inside it or the session is given wider
      folder access — worth checking where they actually live. Not urgent (nothing is broken; the code
      is safe in a local commit), but the next run should push + deploy once it can.
- [ ] **Stray uncommitted work found in the project folder (2026-07-22), needs a decision.**
      `src/components/create-link-form.tsx` and `src/lib/duration.ts` have an uncommitted,
      well-written change (a manual minutes field replacing the duration-preset dropdown, "Max 30m")
      that reads like real interactive work but has no matching STATUS.md entry or ROADMAP.md
      checkbox — tonight's run left it untouched rather than guessing whether to finish, verify, or
      discard it. Please take a look at `git diff` in the project folder and either say "finish that"
      or "discard it" so a future run can act on it cleanly.

## Done
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
