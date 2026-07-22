"use client";

// v2 call UI preview — CALL_UI_REBUILD_SPEC.md. Owns the call object
// lifecycle (Daily's "call-object mode" — createCallObject(), no iframe),
// the prejoin/in-call/left state machine, and just enough of the real
// countdown/auto-start behaviour (POST /api/rooms/[room]/start, the same
// route the production flow uses) to make this feel like a real Qwickword,
// not just a static mockup — see src/app/test/[room]/page.tsx for how this
// gets its props.
//
// Deliberately reduced scope vs. the production src/components/call-room.tsx
// (documented in CALL_UI_REBUILD_SPEC.md section 6 and STATUS.md): no
// "End for everyone" vote, no leave-detection backstop poll, no clock-skew
// resync poll. This is a preview to judge the Meet-style visual design
// before porting the rest of the call's behaviour over — see the spec's
// suggested build order.

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import DailyIframe, { type DailyCall } from "@daily-co/daily-js";
import { DailyAudio, DailyProvider, useParticipantCounts } from "@daily-co/daily-react";
import CallPrejoin from "./call-prejoin";
import CallVideoGrid from "./call-video-grid";
import CallControls from "./call-controls";
import CallOverlay from "./call-overlay";

type Props = {
  room: string;
  joinUrl: string;
  exp: number;
  durationSeconds: number;
  initialStarted: boolean;
};

/**
 * Lives inside DailyProvider so it can use daily-react's participant-count
 * hook — mirrors the production flow's "second participant joined, start the
 * countdown" auto-start (src/components/call-media.tsx's
 * onParticipantCountChange), just re-homed to a hook instead of a raw
 * daily-js event listener. Renders nothing; it's a side-effect-only watcher.
 */
function AutoStartWatcher({ onSecondParticipant }: { onSecondParticipant: () => void }) {
  const counts = useParticipantCounts();
  useEffect(() => {
    if (counts.present >= 2) onSecondParticipant();
  }, [counts.present, onSecondParticipant]);
  return null;
}

export default function TestCallRoom({
  room,
  joinUrl,
  exp,
  durationSeconds,
  initialStarted,
}: Props) {
  const [callObject, setCallObject] = useState<DailyCall | null>(null);
  const [phase, setPhase] = useState<"prejoin" | "in-call" | "left">("prejoin");
  const [currentExp, setCurrentExp] = useState(exp);
  const [started, setStarted] = useState(initialStarted);
  const [remainingMs, setRemainingMs] = useState(() => currentExp * 1000 - Date.now());
  const [starting, setStarting] = useState(false);

  const startedRef = useRef(started);
  useEffect(() => {
    startedRef.current = started;
  }, [started]);
  const startingRef = useRef(false);

  // Call-object mode: create the call object directly, no <iframe> to wrap
  // (contrast with production's DailyIframe.wrap() in call-media.tsx) — see
  // CALL_UI_REBUILD_SPEC.md section 4. The setCallObject call is deferred via
  // a zero-delay setTimeout, same pattern used in production's
  // call-room.tsx ticking effect, so this stays clear of
  // react-hooks/set-state-in-effect (that rule targets setState calls made
  // unconditionally and synchronously as the effect body runs, not ones
  // deferred into a callback like this).
  useEffect(() => {
    const co = DailyIframe.createCallObject();
    const id = setTimeout(() => setCallObject(co), 0);
    return () => {
      clearTimeout(id);
      co.destroy().catch((err) => {
        console.error("[Qwickword v2] Failed to destroy the call object:", err);
      });
    };
  }, []);

  const triggerStart = useCallback(async () => {
    if (startingRef.current || startedRef.current) return;
    startingRef.current = true;
    setStarting(true);
    try {
      const response = await fetch(`/api/rooms/${room}/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ durationSeconds }),
      });
      const data = await response.json();
      if (response.ok && typeof data.exp === "number") {
        setCurrentExp(data.exp);
        setStarted(true);
      }
    } catch (err) {
      console.error("[Qwickword v2] Failed to start the countdown:", err);
    } finally {
      startingRef.current = false;
      setStarting(false);
    }
  }, [room, durationSeconds]);

  // Same immediate-tick + interval pattern as production's call-room.tsx —
  // see that file's comment for why the immediate setTimeout(tick, 0) matters
  // (closes the gap that caused the "1400.56 seconds" bug fixed earlier this
  // session).
  useEffect(() => {
    const tick = () => setRemainingMs(currentExp * 1000 - Date.now());
    const immediateId = setTimeout(tick, 0);
    const intervalId = setInterval(tick, 1000);
    return () => {
      clearTimeout(immediateId);
      clearInterval(intervalId);
    };
  }, [currentExp]);

  const isOver = remainingMs <= 0;

  if (!callObject) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-black text-sm text-zinc-500">
        Loading…
      </div>
    );
  }

  if (phase === "left") {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-black text-center text-white">
        <p className="text-lg font-medium">You&apos;ve left this call.</p>
        <Link
          href="/test"
          className="rounded-full bg-white px-5 py-2 text-sm font-medium text-black transition-colors hover:bg-zinc-200"
        >
          Back to the v2 preview
        </Link>
      </div>
    );
  }

  if (phase === "in-call" && isOver) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-black text-center text-white">
        <p className="text-lg font-medium">This Qwickword has ended.</p>
        <Link
          href="/test"
          className="rounded-full bg-white px-5 py-2 text-sm font-medium text-black transition-colors hover:bg-zinc-200"
        >
          Back to the v2 preview
        </Link>
      </div>
    );
  }

  return (
    <DailyProvider callObject={callObject}>
      <DailyAudio />
      {phase === "prejoin" && (
        <CallPrejoin joinUrl={joinUrl} onJoined={() => setPhase("in-call")} />
      )}
      {phase === "in-call" && (
        <>
          <AutoStartWatcher onSecondParticipant={() => void triggerStart()} />
          <CallVideoGrid />
          <CallOverlay remainingMs={remainingMs} started={started} />
          <CallControls onLeave={() => setPhase("left")} />
          {!started && (
            <button
              type="button"
              onClick={() => void triggerStart()}
              disabled={starting}
              className="absolute top-4 right-4 cursor-pointer rounded-full bg-white px-4 py-2 text-sm font-medium text-black transition-colors hover:enabled:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {starting ? "Starting…" : "Start now"}
            </button>
          )}
        </>
      )}
    </DailyProvider>
  );
}
