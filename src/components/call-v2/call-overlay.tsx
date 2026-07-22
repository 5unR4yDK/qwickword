"use client";

// v2 call UI preview — CALL_UI_REBUILD_SPEC.md, section 2 ("Minimal top
// overlay for meeting identity/branding") and section 3b. "Qwickword" + the
// live countdown as a translucent overlay ON the video, replacing the
// production flow's separate CallCountdown block rendered ABOVE the video
// (src/components/call-countdown.tsx) — same countdown math (reuses
// formatRemaining from that file), just repositioned per the spec.

import { formatRemaining } from "@/components/call-countdown";

export default function CallOverlay({ remainingMs }: { remainingMs: number }) {
  const isOver = remainingMs <= 0;
  const remainingSeconds = Math.ceil(remainingMs / 1000);
  const isFinalCountdown = !isOver && remainingSeconds <= 10;

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-col items-center gap-0.5 bg-gradient-to-b from-black/70 to-transparent px-4 pt-4 pb-10 text-center">
      <p className="text-xs font-medium tracking-wide text-white/70">Qwickword</p>
      <p
        role="timer"
        aria-live="polite"
        className={`text-2xl font-semibold tabular-nums ${
          isFinalCountdown ? "text-rose-300" : "text-white"
        }`}
      >
        {isOver ? "Time's up" : formatRemaining(remainingMs)}
      </p>
      {isFinalCountdown && (
        <p className="text-xs font-medium text-rose-300">Time to wrap!</p>
      )}
    </div>
  );
}
