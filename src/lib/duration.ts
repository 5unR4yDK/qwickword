// Shared duration bounds/presets for Quick Word rooms. Deliberately has no
// side effects, no environment access, and no network calls, so it is safe to
// import from both server code (src/lib/daily-rooms.ts, API validation) and
// client code (the duration picker on the home page) without pulling
// server-only logic (fetch calls, the Daily API key) into the client bundle.

/** Hard bounds enforced by POST /api/rooms — see src/lib/daily-rooms.ts. */
export const MIN_DURATION_SECONDS = 60; // 1 minute
export const MAX_DURATION_SECONDS = 60 * 60; // 60 minutes

/**
 * Minimal preset options for the duration picker (Phase 0 item 4). Phase 1's
 * dedicated "Duration presets" roadmap item will revisit this list and add a
 * custom-value input; treat this set as a working placeholder, not a locked
 * product decision.
 */
export const DURATION_PRESETS_SECONDS = [60, 120, 300, 600, 900, 1800] as const;

/** Formats a whole number of seconds as "N min" (or "Ns" for odd values). */
export function formatDuration(seconds: number): string {
  if (seconds > 0 && seconds % 60 === 0) {
    return `${seconds / 60} min`;
  }
  return `${seconds}s`;
}
