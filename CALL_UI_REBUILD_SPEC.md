# Qwickword — Call UI Rebuild Spec (Daily call-object mode, Google Meet-style)

Status: **draft, not started.** Written 2026-07-22 after Andreas asked whether the call window could
be maximized and Daily Prebuilt's banners shrunk or overlaid — the honest answer was that Daily
Prebuilt's own chrome (header bar, control tray) isn't ours to resize past a point, only Daily's own
theme/CSS hooks. Andreas chose the full rebuild: "i like the rebuild full control... We want it to look
very similar to Google Meets." This document specifies that rebuild before any code is written.

## 1. What's changing and why

Today, `src/components/call-media.tsx` wraps a `<iframe src={joinUrl}>` pointed straight at Daily's
hosted Prebuilt call page (`DailyIframe.wrap()`). Everything inside that iframe — the pre-join lobby,
the "Waiting for others to join / Speaker view" header, the video tiles, the bottom control tray — is
Daily's own UI. We don't render any of it; we just give it a box. That box competes for vertical space
with our own surrounding chrome (title, waiting/countdown text, Start/End buttons), and Daily's own
internal chrome takes further space we can't touch beyond color theming.

This rebuild switches to Daily's **call-object mode**: Daily still handles all WebRTC (media
negotiation, tracks, network resilience) via the `@daily-co/daily-js` call object, but we render every
pixel of UI ourselves — video tiles, mic/camera controls, the prejoin screen, the leave/end
buttons — using the `@daily-co/daily-react` hooks library. Nothing about the underlying call mechanics
changes: same rooms, same hard-expiry `exp`, same `eject_at_room_exp`, same vote-to-end, same stats
logging. Only the *rendering* changes.

**End state:** the video fills the available viewport edge-to-edge, the way Meet's does. Qwickword's
own branding ("Qwickword" + the live countdown) sits as a translucent overlay on top of the video, not
as a separate banner pushing it down. Controls are a small floating pill at the bottom, matching Meet's
placement and weight, not a full-width bar.

## 2. Visual reference: what to borrow from Google Meet

Not a pixel-for-pixel clone — Qwickword keeps its own identity (the countdown is the whole point, Meet
has no equivalent) — but these specific Meet conventions are worth adopting directly:

- **Video is the entire canvas.** No card, no border, no padding around it — it's the full window
  (minus a slim reserved strip if the browser chrome demands it). Single-participant view fills the
  frame; a second participant splits it (Meet uses a simple 50/50 split for two people, tiled grid
  beyond that — Qwickword only ever has two participants by design, so a permanent 50/50 split, or
  active-speaker-large / other-small, both worth prototyping).
- **Floating bottom control bar**, not a full-width strip: a centered, rounded-pill cluster of a
  handful of icon buttons (mic, camera, leave) over a slight dark scrim so it stays legible over any
  video content. Meet keeps this minimal — no visible labels, just icon + tooltip on hover.
  Qwickword's "End for everyone" vote button and countdown live in/near this same cluster rather than
  as separate page furniture.
  Trigger for Andreas: this replaces today's `call-room.tsx` "Start now" / "End for everyone" buttons
  and their surrounding whitespace.
- **Self-view as a small corner tile**, not full-size — Meet shows your own camera as a small
  picture-in-picture tile (bottom-right by default), draggable, easy to ignore. The remote participant
  takes the large frame.
- **Minimal top overlay for meeting identity/branding.** Meet shows the meeting title/time subtly in a
  top corner, translucent, unobtrusive. This is where "Qwickword" and the live countdown belong instead
  of today's separate heading above the video — an overlay, top-center or top-left, small type, a soft
  dark gradient behind it so it's legible over bright video without needing an opaque bar.
- **Dark by default.** Meet's call surface is near-black regardless of system theme — video content
  looks best against black, and it makes the floating overlay/control-bar treatment read cleanly. Worth
  keeping the call screen dark even if the rest of Qwickword (home page, etc.) stays theme-aware.
- **No decorative chrome during the call.** Meet's in-call screen has zero non-functional elements —
  every pixel is either video, a control, or essential status (recording indicator, participant count).
  Qwickword's own footer links ("Create your own Qwickword," "manifesto") should NOT appear on the live
  call screen at all — they're pre-join/post-call furniture only.

## 3. Screen-by-screen breakdown

Each of these replaces (or substantially changes) a piece of `call-room.tsx` / `call-media.tsx` today.

### 3a. Prejoin (today: Daily Prebuilt's own lobby, via `enable_prejoin_ui`)
Custom-built (per Daily's own "Add a prejoin UI" guide): local camera preview, mic/camera toggle
buttons, a device picker (camera/mic/speaker `<select>`s, via `useDevices()`), and the single "Join"
action. Full-bleed like Meet's own prejoin (Meet shows your camera preview centered, large, dark
background, minimal chrome around it) rather than Daily Prebuilt's current boxed card-in-a-card look.
Qwickword-specific: the pre-start "Waiting to start" state (nobody's started the real countdown yet)
can be folded into this same screen — the prejoin IS the waiting room for a Qwickword, there's no need
for a separate "waiting to start" text block above a boxed video area like today.

### 3b. In-call (today: Daily Prebuilt's own call UI)
The core rebuild. Video tile(s) full-bleed, self-view corner PIP, floating bottom control pill, top
overlay for "Qwickword" + live countdown (replaces the separate `CallCountdown` component's current
placement above the video — same countdown logic, `call-room.tsx`'s existing `remainingMs` /
`isFinalCountdown` state, just rendered as an overlay instead of a block above the video). "End for
everyone" vote button and the "N of M want to end early" status move into/near the control pill.

### 3c. Ended / left screens (today: `call-room.tsx`'s `isOver`/`hasLeft` swaps)
These already work well and don't depend on Daily Prebuilt at all — they're plain Qwickword-branded
screens shown *after* the call area unmounts. Keep them essentially as-is; only the thing they replace
changes (a custom video UI instead of an iframe).

## 4. Architecture

- **New dependency:** `@daily-co/daily-react` (built on top of the `@daily-co/daily-js` already in use —
  no change to the underlying call object's config, room creation, or REST calls in
  `src/lib/daily-rooms.ts`).
- **`DailyProvider`** wraps the call page's client tree, given the same `DailyCall` object creation this
  app already does (`DailyIframe.wrap()` → change to `DailyIframe.createCallObject()`, since there's no
  longer an iframe to wrap — call-object mode creates the call object directly, no DOM element needed).
- **Video rendering:** `useParticipantIds()` for who's in the call, `<DailyVideo>` (or a thin wrapper
  around `useVideoTrack()` + a raw `<video>` element, for full styling control) per participant.
- **Local media controls:** `useLocalSessionId()`, `useAudioTrack()`/`useVideoTrack()` for the local
  participant's own mic/camera state, plus `daily.setLocalAudio()`/`setLocalVideo()` to toggle them.
- **Devices:** `useDevices()` for the prejoin camera/mic/speaker pickers.
- **Events this app already listens for** (`joined-meeting`, `participant-joined`, `participant-left`,
  `app-message`, `left-meeting`) all still exist in call-object mode via `useDailyEvent()` — the
  existing auto-start/vote-tally/leave-detection logic in `call-media.tsx` ports over close to
  unchanged, just re-homed into hooks instead of raw `callObject.on(...)`.
- **What does NOT change:** `src/lib/daily-rooms.ts` (room creation/exp/start/end), the `/api/rooms/**`
  routes, the Neon stats logging (`src/lib/db.ts`), the hard-expiry mechanism, the vote-to-end
  mechanism's server side. This is a rendering-layer rebuild, not a re-architecture of the call's
  actual rules.

## 5. New/changed components (rough map, not final file names)

| Today | Becomes |
|---|---|
| `call-media.tsx` (iframe wrap + all daily-js event wiring) | Split into a `DailyCallProvider` (sets up the call object + `DailyProvider`) and a handful of small presentational pieces below |
| *(Daily Prebuilt's own lobby, not our code)* | `CallPrejoin` — camera preview, device pickers, Join button |
| *(Daily Prebuilt's own video tiles, not our code)* | `CallVideoGrid` — full-bleed remote tile(s) + self-view PIP |
| *(Daily Prebuilt's own control tray, not our code)* | `CallControls` — floating pill: mic/camera toggle, leave, end-vote |
| `call-countdown.tsx` (rendered above the video) | Same countdown math, re-rendered as `CallOverlay` (top-center overlay: "Qwickword" + countdown + "Time to wrap!" at T-10s) |
| `call-room.tsx` (owns `exp`/vote/start state machine) | Same responsibilities, same hooks/effects (`triggerStart`, `triggerEnd`, `handleVoteTallyChange`, the resync polls) — only what it renders changes, not the state machine itself |

## 6. Explicitly out of scope for this rebuild

- **Screen share.** Meet has it, Qwickword doesn't today and nothing here requires adding it. Worth a
  separate ROADMAP.md item if wanted later — call-object mode supports it (`startScreenShare()`), just
  not part of this spec.
- **More than two participants.** Qwickword's whole model (one link, hard expiry, vote needs strict
  majority) is built around small calls. A tiled grid for 3+ is possible later but not designed here.
- **Chat / reactions / background blur.** Real Meet features, no signal Qwickword needs them yet.
- **Mobile-specific layout pass.** The existing responsive container logic (mobile: `h-[70vh]`, desktop:
  16:9-from-height) should carry over conceptually, but exact mobile control-pill sizing/placement needs
  its own look once the desktop version exists.

## 7. Effort and risk, honestly

This is a real rebuild, not a session-sized tweak. Rough shape of the work:

1. Prejoin screen (device picker, camera preview, Join) — new code, no equivalent exists in this repo.
2. Video tile rendering + self-view PIP — new code.
3. Control pill (mic/camera/leave/end-vote) — new code, though the *logic* (mute state, end-vote
   tally) already exists and mostly ports over.
4. Countdown overlay — mostly a re-skin of the existing `CallCountdown` component.
5. Porting the existing auto-start / vote-tally / leave-detection event wiring from raw `callObject.on()`
   calls to `daily-react` hooks — mechanical but needs care, since this session's earlier bug hunts
   (auto-start reliability, left-meeting detection) both live in that exact code.
6. No real two-browser testing available in this build sandbox (same limitation noted throughout
   STATUS.md for the existing daily-js work) — this rebuild raises the stakes on that gap, since it
   touches far more surface area (rendering, not just event wiring) than anything shipped so far.
   Recommend a real live test with two people (you + one other browser/device) before calling this done,
   not just code review.

Suggested build order: prejoin screen first (self-contained, easy to verify solo), then video tiles +
self-view, then the control pill wired to the existing state machine, then the countdown overlay
re-skin, then port the event-wiring, then a real two-person live test pass.

## 8. Open questions for Andreas before building

- Two-participant layout: permanent 50/50 split, or "active speaker large + other small" (needs simple
  audio-level detection to pick who's "active")?
- Self-view PIP: fixed position (Meet defaults bottom-right) or draggable (Meet allows dragging it
  anywhere)? Draggable is more Meet-authentic but more work.
- Keep Daily Prebuilt's `enable_prejoin_ui` room property at all, or is it now irrelevant (since we
  render our own prejoin and never send anyone to Daily's hosted page)?
- Does "look very similar to Google Meet" extend to matching Meet's actual icon set/colors closely, or
  just the *layout* conventions (full-bleed video, floating pill, minimal chrome) with Qwickword's own
  visual language (the Playfair "Q," the existing color palette)?
