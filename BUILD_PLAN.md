# Quick Word — Build Plan

## What it is
A conference-call tool where the call duration is set in advance and **cannot be extended**.
You create a "Quick Word" link with a fixed max duration (e.g. 2 minutes). Both parties open
the link, they're connected, a countdown runs, and when it hits zero the call ends. There is no
"extend" button anywhere. If people want more time, they schedule a new Quick Word.

## MVP scope (what we're building first)
Link-based version:
1. A page to generate a Quick Word link with a chosen max duration.
2. Opening the link connects both parties in a video/audio call.
3. A visible countdown timer.
4. A **hard, server-enforced** end: the call is force-terminated at expiry, not just a client clock.

## Explicitly OUT of MVP scope (v2+)
- The "at 14:45 it opens on your screen unprompted and connects you" behaviour. That needs a
  native desktop app or calendar + notification permissions. Note it, don't build it yet.

## Chosen stack (decided; change only with good reason, log the reason in STATUS.md)
- **Framework:** Next.js (App Router, TypeScript).
- **Video:** Daily.co. Rationale: managed WebRTC, prebuilt call UI, and — critically — Daily rooms
  support a server-side `exp` (expiry timestamp) plus `eject_at_room_exp: true`. That makes the
  hard, non-extendable end an enforced server property, not a client-side timer someone can bypass.
- **Room/token creation:** a Next.js API route calling the Daily REST API, setting `exp = now + duration`
  and `eject_at_room_exp = true`.
- **Deploy target (later):** a NEW, dedicated Vercel project. Never an existing/shared project.

## Milestones
- **M0 — Scaffold.** Next.js app runs locally. Link generator + call page exist in "mock mode"
  (no real video, placeholder for API key) so the flow is demonstrable offline.
- **M1 — Daily integration.** API route creates a room with hard `exp` + `eject_at_room_exp`.
  Join flow works. (Needs a Daily API key — see ASKS.md.)
- **M2 — Timer + hard-end UX.** Countdown UI, clean "time's up" screen, no extend/rejoin path.
- **M3 — Deploy.** Push to a fresh Vercel project. (Needs Andreas to approve/create — see ASKS.md.)
- **M4 — v2 ideas.** Auto-open/native/calendar. Later, deliberately.

## Guardrails — non-negotiable for the autonomous nightly runs
1. Work ONLY inside this folder (C:\Users\acnic\ClaudeCoding\QuickWord).
2. NEVER touch any pre-existing / shared / production infrastructure (existing Vercel projects,
   Cloudflare zones, or the shared database). Quick Word gets its own fresh resources only.
3. NEVER enter payment details, spend money, or commit Andreas financially.
4. Do NOT create third-party accounts that require Andreas's email/phone verification. When a
   signup or key is needed, add it to ASKS.md and stop on that thread — keep building everything else.
5. Everything reversible and inspectable in the morning: commit to git, update STATUS.md, list any
   blockers in ASKS.md.
