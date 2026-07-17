"use client";

import { useEffect, useState } from "react";

/** Formats a whole number of milliseconds as "M:SS", floored to whole seconds. */
function formatRemaining(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

/**
 * Renders a countdown to `exp` (a Unix timestamp in seconds), ticking every
 * second on the client. Two tabs given the same `exp` (the link's `?exp=`
 * query param — see create-link-form.tsx) show the same remaining time,
 * because both count down from the same shared anchor rather than from a
 * per-tab "duration since load" clock.
 *
 * This display is informational only. The actual hard end is enforced
 * server-side by Daily's `eject_at_room_exp` / `eject_after_elapsed` room
 * properties (set in src/lib/daily-rooms.ts) — this component cannot be
 * tricked into granting more call time by e.g. pausing JS execution.
 *
 * Renders a "--:--" placeholder until the first client tick so the server-
 * rendered HTML (which has no access to the client's clock) and the first
 * client render agree, avoiding a hydration mismatch warning.
 */
export default function CallCountdown({ exp }: { exp: number }) {
  const [remainingMs, setRemainingMs] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => setRemainingMs(exp * 1000 - Date.now());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [exp]);

  if (remainingMs === null) {
    return (
      <p
        aria-hidden
        className="text-4xl font-semibold tabular-nums text-zinc-400 dark:text-zinc-600"
      >
        --:--
      </p>
    );
  }

  const isOver = remainingMs <= 0;
  const isEnding = !isOver && remainingMs < 30_000;

  return (
    <p
      role="timer"
      aria-live="polite"
      className={`text-4xl font-semibold tabular-nums ${
        isOver
          ? "text-red-600 dark:text-red-400"
          : isEnding
            ? "text-amber-600 dark:text-amber-400"
            : "text-black dark:text-zinc-50"
      }`}
    >
      {isOver ? "Time's up" : formatRemaining(remainingMs)}
    </p>
  );
}
