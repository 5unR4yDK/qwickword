"use client";

// v2 call UI preview — CALL_UI_REBUILD_SPEC.md, section 2 ("Minimal top
// overlay for meeting identity/branding") and section 3b. "Qwickword" + the
// live countdown as a translucent overlay ON the video, replacing the
// production flow's separate CallCountdown block rendered ABOVE the video
// (src/components/call-countdown.tsx) — same countdown math (reuses
// formatRemaining from that file), just repositioned per the spec.

import { formatRemaining } from "@/components/call-countdown";

export default function CallOverlay({
  remainingMs,
  started,
}: {
  remainingMs: number;
  /**
   * Whether the real countdown has started (production's call-room.tsx
   * "waiting to start" vs. ticking state — see that file's doc comment).
   * Fixed 2026-07-22 (Andreas, interactive: "the number counter went wrong
   * again so it started at 1400 or something"). Before this, the overlay
   * always rendered `remainingMs` as a ticking clock, including before
   * `started` — but `remainingMs` before start is derived from the ~24h
   * pre-start buffer (see PRE_START_BUFFER_SECONDS in
   * src/lib/daily-rooms.ts), which formats as something like "1439:41".
   * That's not a bug in the countdown math (same fix from earlier this
   * session for the exact "1400.56 seconds" report still holds) — it's this
   * component rendering a number it was never meant to show yet. Now shows
   * "Waiting to start" instead, matching production's waiting text, until
   * `started` is true.
   */
  started: boolean;
}) {
  const isOver = remainingMs <= 0;
  const remainingSeconds = Math.ceil(remainingMs / 1000);
  const isFinalCountdown = started && !isOver && remainingSeconds <= 10;

  return (
    <div
      className="pointer-events-none absolute inset-x-0 top-0 flex flex-col items-center gap-0.5 bg-gradient-to-b from-black/70 to-transparent px-4 pb-10 text-center"
      style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 1rem)" }}
    >
      {/* Explicit safe-area padding, not just pt-4 (2026-07-22, Andreas,
          interactive, mobile). The timer needs to stay clear of the notch
          on phones where the browser chrome overlaps the top of the
          viewport, on top of the h-dvh/fixed fix in the page route that
          keeps this overlay from being scrolled out of view at all. */}
      <p className="text-xs font-medium tracking-wide text-white/70">Qwickword</p>
      {started ? (
        <>
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
        </>
      ) : (
        <p className="text-sm font-medium text-white/80">Waiting to start</p>
      )}
    </div>
  );
}
