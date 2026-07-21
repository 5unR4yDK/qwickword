# Qwickword

A meeting tool where you set the maximum call length in advance and it **cannot be extended**.
When the timer hits zero, the call ends — server-enforced by Daily.co, not just a client-side
clock. If you need more time, you schedule another Qwickword.

See `BUILD_PLAN.md` for the full design, `ROADMAP.md` for what's built vs. planned, and
`STATUS.md` for a detailed log of what's been verified so far.

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
`.gitignore`):

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
its own dedicated Vercel project — never an existing/shared one (see `BUILD_PLAN.md`'s guardrails).
