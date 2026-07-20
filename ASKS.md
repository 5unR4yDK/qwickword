# Quick Word — Things I need from Andreas

The nightly build task appends here whenever it hits something it can't (or shouldn't) do on its own.
Check this each morning. Clearing these unblocks the next night's progress.

## Open
- [ ] **(Recommended, low urgency) Rotate the Daily API key.** The current key was pasted into a
      chat transcript on 2026-07-12, so best practice is to regenerate it in the Daily dashboard
      (Developers) and replace the value in `.env.local`. One-line swap. Not blocking the build.

- [ ] **Vercel deploy approval (Phase 0 item 9 — the last MVP item, blocked on this).** Phase 0 is
      now otherwise complete (items 1–8 all done and verified — see STATUS.md). The only thing
      standing between tonight and a live MVP is your go-ahead to deploy. To unblock the next run,
      reply here (or just tell me) with:
      1. **Confirm a brand-new, dedicated Vercel project** — not an existing one. I'll create it
         under whatever Vercel account/team you specify (if you have a preference, name it here;
         otherwise I'll ask which account to use when this comes up).
      2. **The two env vars to set on Vercel** (`DAILY_API_KEY`, `DAILY_DOMAIN`) — same values as
         `.env.local`, or new ones if you'd rather rotate the key first (see the item below).
      3. **A domain preference**, if any — a Vercel-provided `*.vercel.app` subdomain is fine for
         a first deploy; say the word if you'd rather point a real domain at it later.
      Once confirmed, the next run will create the new project, set the env vars, deploy, and
      smoke-test the live URL before reporting back.

## Done
- 2026-07-12 — Daily.co account created, domain `quickword.daily.co`, API key added to `.env.local`.
