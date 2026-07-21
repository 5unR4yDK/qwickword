// Shared duration bounds/presets for Qwickword rooms. Deliberately has no
// side effects, no environment access, and no network calls, so it is safe to
// import from both server code (src/lib/daily-rooms.ts, API validation) and
// client code (the duration picker on the home page) without pulling
// server-only logic (fetch calls, the Daily API key) into the client bundle.

/** Hard bounds enforced by POST /api/rooms — see src/lib/daily-rooms.ts. */
export const MIN_DURATION_SECONDS = 60; // 1 minute
export const MAX_DURATION_SECONDS = 60 * 60; // 60 minutes

/**
 * Preset options for the duration picker. Updated 2026-07-21 per Andreas
 * (interactive): "remove 30, add 20" — replaces the 30-minute preset from
 * Phase 0 item 4 with 20 minutes, alongside that same night's one-click
 * create flow (src/components/create-link-form.tsx) and the custom
 * 1–60-minute dropdown (see CUSTOM_DURATION_MINUTES_OPTIONS below).
 */
export const DURATION_PRESETS_SECONDS = [60, 120, 300, 600, 900, 1200] as const;

/**
 * The custom-duration dropdown's options (added 2026-07-21): every whole
 * minute from 1 to 60, matching MIN_DURATION_SECONDS/MAX_DURATION_SECONDS
 * exactly so nothing in this list can ever fail the API route's own bounds
 * check.
 */
export const CUSTOM_DURATION_MINUTES_OPTIONS: readonly number[] = Array.from(
  { length: 60 },
  (_, i) => i + 1
);

/** Formats a whole number of seconds as "N min" (or "Ns" for odd values). */
export function formatDuration(seconds: number): string {
  if (seconds > 0 && seconds % 60 === 0) {
    return `${seconds / 60} min`;
  }
  return `${seconds}s`;
}
