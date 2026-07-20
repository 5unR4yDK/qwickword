/**
 * Formats a whole number of milliseconds as "M:SS", floored to whole seconds.
 * Not exported — only used inside this file.
 */
function formatRemaining(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

/**
 * Pure display of a remaining-time countdown, given `remainingMs` from the
 * caller. As of Phase 0 item 6 ("Hard-end experience"), the ticking clock and
 * the decision of what else to show (the call area vs. the ended screen) live
 * one level up in CallRoom (src/components/call-room.tsx) — that's the
 * single source of truth for "is this call over", so this component stays a
 * simple, stateless renderer with no hooks or clock access of its own.
 *
 * This display is informational only. The actual hard end is enforced
 * server-side by Daily's `eject_at_room_exp` / `eject_after_elapsed` room
 * properties (set in src/lib/daily-rooms.ts).
 */
export default function CallCountdown({ remainingMs }: { remainingMs: number }) {
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
