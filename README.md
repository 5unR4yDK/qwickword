<img src="public/brand/qmark.png" width="72" height="72" alt="Qwickword icon" align="left" />

# Qwickword

[![CI](https://github.com/5unR4yDK/qwickword/actions/workflows/ci.yml/badge.svg)](https://github.com/5unR4yDK/qwickword/actions/workflows/ci.yml)

**Live at [qwickword.com](https://qwickword.com)**

A meeting tool where you set the maximum call length in advance and it **cannot be extended**.
When the timer hits zero, the call ends — server-enforced by Daily.co, not just a client-side
clock. If you need more time, you schedule another Qwickword.

## Stack

Next.js (App Router, TypeScript, Tailwind) for the app; [Daily.co](https://daily.co) for video,
using its server-enforced room expiry (`exp`, `eject_at_room_exp`, `eject_after_elapsed`) so the
hard end can't be bypassed client-side.

## Running it locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Live mode vs. mock mode

Real Daily video requires two environment variables in `.env.local` (not committed — see
`.gitignore`; a template is in `.env.example`):

```
DAILY_API_KEY=your-daily-api-key
DAILY_DOMAIN=your-subdomain.daily.co
```

If `.env.local` is missing or either variable is unset, the app runs in **mock mode**
automatically: room creation and the call UI are simulated, no real Daily API calls are made, and
nothing crashes. The home page shows a small "Mock mode" banner whenever that's the case, so it's
obvious when testing locally without credentials; in live mode (real credentials configured, as on
the deployed site) no banner is shown — visitors don't need to see the video provider's internal
domain. This means the app is fully runnable and testable without any credentials.

A third variable, `DATABASE_URL`, is entirely optional — it points at a Postgres database
(this project uses Neon) that records call-creation stats. Unset, every write is a silent no-op
(see `src/lib/db.ts`); nothing about running or testing the app depends on it.

### Other scripts

```bash
npm run lint    # ESLint
npm run build   # production build (also runs the TypeScript check)
npm run start   # serve the production build (run npm run build first)
```

## Project layout

- `src/app/page.tsx` — create-link page (choose a duration, get a shareable link).
- `src/app/[room]/page.tsx` — the call page: joins the room, shows a synced countdown, and
  handles invalid/expired links.
- `src/app/api/rooms/route.ts` — creates a Daily room with a hard `exp`.
- `src/lib/` — Daily API client, env/mock-mode config, and shared duration/time helpers.
- `src/components/` — the call UI (countdown, call media, hard-end and invalid-link screens).

## Deployment

Live at **https://qwickword.com** (also reachable at `https://quickword.vercel.app`), deployed to
its own dedicated Vercel project.
