# Quick Word — Things I need from Andreas

The nightly build task appends here whenever it hits something it can't (or shouldn't) do on its own.
Check this each morning. Clearing these unblocks the next night's progress.

## Open
- [ ] **(Recommended, low urgency) Rotate the Daily API key.** The current key was pasted into a
      chat transcript on 2026-07-12, so best practice is to regenerate it in the Daily dashboard
      (Developers) and replace the value in `.env.local`. One-line swap. Not blocking the build.
- [ ] **Save/apply the corrected `qwickword.com` DNS records at GoDaddy.** Andreas already owns the
      domain and was live in GoDaddy's DNS panel on 2026-07-21 when this was worked out together —
      full detail in ROADMAP.md's `[needs-andreas]` domain-connect item and STATUS.md's run history.
      Exact records (from Vercel's API for this specific project, not generic values): delete the
      default `A @ → WebsiteBuilder Site` parking record; add `A @ → 76.76.21.21` (or Vercel's newer
      pair, `216.198.79.1` and `64.29.17.1`, either works); fix the in-progress `www` CNAME to
      `c2efecf6f5ce6b0c.vercel-dns-017.com` (no `https://`, no trailing slash — that was the actual
      bug in what he was about to save). `qwickword.com`/`www.qwickword.com` are already attached to
      the `quickword` Vercel project (done via API tonight); only the DNS side is outstanding. Once
      saved, the next nightly run should re-check `misconfigured` via Vercel's domain-config API and
      smoke-test the live URL once it clears.

## Done
- 2026-07-12 — Daily.co account created, domain `quickword.daily.co`, API key added to `.env.local`.
- 2026-07-20 — Vercel deploy approved in chat ("ok to deploy ok to make new vercel project"); Andreas
  pointed the run at the folder holding his Vercel account token. Deployed to a brand-new project,
  `quickword`, live at **https://quickword.vercel.app**. Used the same `DAILY_API_KEY`/`DAILY_DOMAIN`
  values already in `.env.local` (no rotation) and the default `*.vercel.app` domain (no custom domain
  set up). See STATUS.md/ROADMAP.md item 9 for full detail.
