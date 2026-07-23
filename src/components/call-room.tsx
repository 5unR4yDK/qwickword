"use client";

// The call page's live, ticking core: the call-object lifecycle, the
// prejoin/in-call/left state machine, the countdown/auto-start mechanics,
// and the hard swap to a "Time's up" screen once the shared `exp`
// passes. Promoted to production 2026-07-22 (Andreas, interactive: "the test
// setup as now being the default setup... I think we have done good work on
// the test setup and it should be the standard") — this file used to wrap a
// Daily Prebuilt <iframe> (DailyIframe.wrap(), see the old
// src/components/call-media.tsx, deleted the same day); it now owns a
// call-object-mode call directly (DailyIframe.createCallObject(), no
// iframe — full custom UI via @daily-co/daily-react, see
// CALL_UI_REBUILD_SPEC.md) with a custom prejoin screen, video grid, overlay,
// and control bar (call-prejoin.tsx / call-video-grid.tsx / call-overlay.tsx /
// call-controls.tsx) instead of Daily's own hosted lobby + Prebuilt chrome.
//
// Everything the old iframe-based flow had earned through real production
// bugs is carried over unchanged, just re-homed onto the call-object
// lifecycle instead of an iframe:
//  - Cross-tab waiting poll (durationSeconds-aware server-side auto-start).
//  - Clock-skew resync poll, plus the presence-based leave/empty-room
//    backstop (Daily's own /rooms/:name/presence, independent of any single
//    tab's own daily-js state).
//  - mockMode's no-API-key fallback (no real Daily call to create at all).
//
// "Vote to end early" (the "End for everyone" toggle, call-end-vote.tsx,
// POST /api/rooms/[room]/end) was retired 2026-07-23 — Andreas: "can we
// retire the vote to end the call feature for now I don't like to have that
// feature." Removed entirely rather than just hidden: call-end-vote.tsx,
// the /api/rooms/[room]/end route, daily-rooms.ts's endRoomNow, and
// db.ts's recordCallEndedEarly are all gone. It's in git history (see the
// 2026-07-21/22 ROADMAP.md entries) if it comes back later.
//
// "The start now button... should feature down next to the toggle buttons
// for microphone and camera and sharing and ending call... equal height and
// same coloring format" (2026-07-22, Andreas, interactive): Start now is no
// longer a separate floating control — see call-controls.tsx, which now owns
// it. This file only supplies the `started`/`starting`/`onStart` it needs.

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import DailyIframe, { type DailyCall } from "@daily-co/daily-js";
import { DailyAudio, DailyProvider, useParticipantCounts } from "@daily-co/daily-react";
import CallPrejoin from "@/components/call-prejoin";
import CallVideoGrid from "@/components/call-video-grid";
import CallControls from "@/components/call-controls";
import CallOverlay from "@/components/call-overlay";

type Props = {
  room: string;
  /**
   * The room's current live `exp` (Unix seconds) as of the server's last
   * check — see src/app/[room]/page.tsx. Before the countdown has started,
   * this is the generous pre-start buffer, not the real call length.
   */
  exp: number;
  /**
   * The intended call length in seconds, from the link's `d` query param.
   * `null` for a link minted before this feature existed — those links have
   * no waiting state at all (see `initialStarted`'s doc below).
   */
  durationSeconds: number | null;
  /**
   * Whether the real countdown has already started, per the server's own
   * live check (src/lib/daily-rooms.ts's `isCountdownStarted`). `false` means
   * this page should show the waiting state until a manual "Start now" click
   * or a second participant joining starts it.
   */
  initialStarted: boolean;
  /**
   * Remaining milliseconds computed by the server (page.tsx), using the
   * server's own clock at request time — see the equivalent prop's doc on
   * the pre-promotion version of this file for why this avoids a
   * hydration-mismatch risk and lets an already-expired link render the
   * ended screen on the very first response.
   */
  initialRemainingMs: number;
  mockMode: boolean;
  joinUrl: string | null;
};

/**
 * Lives inside DailyProvider so it can use daily-react's participant-count
 * hook — mirrors the old iframe flow's "second participant joined, start the
 * countdown" auto-start. Renders nothing; it's a side-effect-only watcher.
 */
function AutoStartWatcher({ onSecondParticipant }: { onSecondParticipant: () => void }) {
  const counts = useParticipantCounts();
  useEffect(() => {
    if (counts.present >= 2) onSecondParticipant();
  }, [counts.present, onSecondParticipant]);
  return null;
}

function LeftScreen() {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-black px-6 text-center text-white">
      <p className="text-lg font-medium">You&apos;ve left this call.</p>
      <p className="max-w-sm text-sm text-white/60">
        It may still be running for anyone else still in it — there&apos;s no
        way back into this one.
      </p>
      <Link
        href="/"
        className="mt-2 cursor-pointer rounded-full bg-white px-5 py-2 text-sm font-medium text-black transition-colors hover:bg-zinc-200"
      >
        Create a new one
      </Link>
    </div>
  );
}

function EndedScreen() {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-black px-6 text-center text-white">
      <p className="text-lg font-medium">This Qwickword has ended.</p>
      <p className="max-w-sm text-sm text-white/60">
        It can&apos;t be rejoined or extended — that&apos;s the whole point.
      </p>
      <Link
        href="/"
        className="mt-2 cursor-pointer rounded-full bg-white px-5 py-2 text-sm font-medium text-black transition-colors hover:bg-zinc-200"
      >
        Create a new one
      </Link>
    </div>
  );
}

export default function CallRoom({
  room,
  exp,
  durationSeconds,
  initialStarted,
  initialRemainingMs,
  mockMode,
  joinUrl,
}: Props) {
  const [callObject, setCallObject] = useState<DailyCall | null>(null);
  const [phase, setPhase] = useState<"prejoin" | "in-call">("prejoin");
  const [currentExp, setCurrentExp] = useState<number>(exp);
  const [started, setStarted] = useState<boolean>(initialStarted);
  const [remainingMs, setRemainingMs] = useState<number>(initialRemainingMs);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  // "the timer also should go away after we have left the call, no more
  // countdown" — set either by CallControls's own Leave button (a click,
  // synchronous) or by the presence-based backstop poll below (this tab
  // silently dropped out without a clean click). Deliberately separate from
  // `isOver`: leaving early is a per-tab, personal thing, not the room-wide
  // hard end `isOver` represents.
  const [leftCall, setLeftCall] = useState(false);

  const startedRef = useRef(started);
  useEffect(() => {
    startedRef.current = started;
  }, [started]);
  const startingRef = useRef(false);

  // Call-object mode: create the call object directly, no <iframe> to wrap.
  // The setCallObject call is deferred via a zero-delay setTimeout so this
  // stays clear of react-hooks/set-state-in-effect (that rule targets
  // setState calls made unconditionally and synchronously as the effect body
  // runs, not ones deferred into a callback like this). Skipped entirely in
  // mock mode — there's no API key to actually create a call with.
  useEffect(() => {
    if (mockMode) return;
    const co = DailyIframe.createCallObject();
    const id = setTimeout(() => setCallObject(co), 0);
    return () => {
      clearTimeout(id);
      co.destroy().catch((err) => {
        console.error("[Qwickword] Failed to destroy the call object:", err);
      });
    };
  }, [mockMode]);

  const triggerStart = useCallback(async () => {
    if (startingRef.current || startedRef.current || !durationSeconds) return;
    startingRef.current = true;
    setStarting(true);
    setStartError(null);
    try {
      const response = await fetch(`/api/rooms/${room}/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ durationSeconds }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(
          typeof data?.error === "string" ? data.error : "Couldn't start the countdown."
        );
      }
      setCurrentExp(data.exp);
      setStarted(true);
    } catch (err) {
      setStartError(err instanceof Error ? err.message : "Couldn't start the countdown.");
    } finally {
      startingRef.current = false;
      setStarting(false);
    }
  }, [room, durationSeconds]);

  const handleSecondParticipant = useCallback(() => {
    void triggerStart();
  }, [triggerStart]);

  // Ticks the displayed remaining time off `currentExp` — see the
  // pre-promotion version of this file for why both an immediate zero-delay
  // setTimeout AND a 1s setInterval are needed (closes the gap that caused
  // the "1400.56 seconds" flash bug).
  useEffect(() => {
    const tick = () => setRemainingMs(currentExp * 1000 - Date.now());
    const immediateId = setTimeout(tick, 0);
    const intervalId = setInterval(tick, 1000);
    return () => {
      clearTimeout(immediateId);
      clearInterval(intervalId);
    };
  }, [currentExp]);

  // Picks up a start triggered from a *different* tab, and carries
  // `durationSeconds` so the status route can auto-start the room
  // server-side once Daily's own presence count hits 2, independent of
  // whether any tab's own daily-js detection worked. Skipped once `started`,
  // for a link with no duration, or in mock mode (no persisted room to poll).
  useEffect(() => {
    if (started || !durationSeconds || mockMode) return;
    const id = setInterval(async () => {
      try {
        const response = await fetch(
          `/api/rooms/${room}/status?fallbackExp=${exp}&durationSeconds=${durationSeconds}`
        );
        if (!response.ok) return;
        const data = await response.json();
        if (data.started) {
          setCurrentExp(data.exp);
          setStarted(true);
        }
      } catch {
        // Transient — the next poll gets another chance.
      }
    }, 4000);
    return () => clearInterval(id);
  }, [started, durationSeconds, mockMode, room, exp]);

  // Re-syncs `currentExp` against Daily's own live room status once the
  // countdown has started (corrects client-clock drift against Daily's own
  // server-side eject_at_room_exp enforcement), and doubles as the
  // presence-based leave/empty-room backstop: if Daily reports nobody
  // currently present, this tab can't still be genuinely connected either,
  // whatever its own local leave-detection thinks. `emptyPollStreakRef`
  // requires two consecutive 0-counts (20s) before acting, so a single
  // transient/propagation-delay reading right after joining can't cause a
  // false positive. Skipped in mock mode — no persisted room to poll.
  const emptyPollStreakRef = useRef(0);
  useEffect(() => {
    if (!started || mockMode) return;
    const id = setInterval(async () => {
      try {
        const response = await fetch(`/api/rooms/${room}/status?fallbackExp=${currentExp}`);
        if (!response.ok) return;
        const data = await response.json();
        if (typeof data.exp === "number" && data.exp !== currentExp) {
          setCurrentExp(data.exp);
        }
        if (data.presentCount === 0) {
          emptyPollStreakRef.current += 1;
          if (emptyPollStreakRef.current >= 2) {
            setLeftCall(true);
          }
        } else {
          emptyPollStreakRef.current = 0;
        }
      } catch {
        // Transient — the next poll gets another chance.
      }
    }, 10_000);
    return () => clearInterval(id);
  }, [started, mockMode, room, currentExp]);

  const isOver = remainingMs <= 0;

  if (leftCall) {
    return <LeftScreen />;
  }

  if (mockMode) {
    // No API key configured — there's no real Daily call to create, so this
    // renders a simplified stand-in that still exercises the countdown/
    // start mechanics (all server-route-driven, not dependent on a real
    // daily-js connection) without any camera/mic/video UI.
    return (
      <div className="relative h-full w-full bg-black">
        <CallOverlay remainingMs={remainingMs} started={started} />
        {isOver ? (
          <EndedScreen />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 px-6 text-center text-white">
            <p className="text-base font-medium">Mock call — no Daily API key configured</p>
            <p className="text-sm text-white/60">Room: {room}</p>
          </div>
        )}
        {!isOver && !started && durationSeconds && (
          <div
            className="absolute left-1/2 flex -translate-x-1/2 items-center gap-3 rounded-full bg-black/70 px-4 py-3 backdrop-blur"
            style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 1.5rem)" }}
          >
            <button
              type="button"
              onClick={() => void triggerStart()}
              disabled={starting}
              className="flex h-11 cursor-pointer items-center justify-center rounded-full bg-white px-4 text-sm font-medium text-black transition-colors hover:enabled:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {starting ? "Starting…" : "Start now"}
            </button>
          </div>
        )}
        {startError && (
          <p
            role="alert"
            className="absolute left-1/2 -translate-x-1/2 text-sm text-red-400"
            style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 5.5rem)" }}
          >
            {startError}
          </p>
        )}
      </div>
    );
  }

  if (!joinUrl) {
    // Shouldn't happen — page.tsx only ever passes a null joinUrl alongside
    // mockMode: true, handled above — but keeps this branch total rather
    // than letting CallPrejoin below receive a null join URL.
    return (
      <div className="flex h-full w-full items-center justify-center bg-black px-6 text-center text-sm text-white/60">
        Something went wrong setting up this call. Try reloading the page.
      </div>
    );
  }

  if (!callObject) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-black text-sm text-zinc-500">
        Loading…
      </div>
    );
  }

  if (phase === "in-call" && isOver) {
    return <EndedScreen />;
  }

  return (
    <DailyProvider callObject={callObject}>
      <DailyAudio />
      {phase === "prejoin" && (
        <CallPrejoin joinUrl={joinUrl} onJoined={() => setPhase("in-call")} />
      )}
      {phase === "in-call" && (
        <>
          <AutoStartWatcher onSecondParticipant={handleSecondParticipant} />
          <CallVideoGrid />
          <CallOverlay remainingMs={remainingMs} started={started} />
          <CallControls
            onLeave={() => setLeftCall(true)}
            started={started}
            starting={starting}
            onStart={() => void triggerStart()}
          />

          {startError && (
            <p
              role="alert"
              className="absolute left-1/2 -translate-x-1/2 text-sm text-red-400"
              style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 5.5rem)" }}
            >
              {startError}
            </p>
          )}
        </>
      )}
    </DailyProvider>
  );
}
