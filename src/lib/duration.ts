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

/**
 * Formats a whole number of seconds as a natural-language minutes phrase —
 * "1 minute", "5 minutes" — for use in prose rather than a compact UI label
 * (that's what formatDuration above is for). Used by the call page's link
 * preview text (src/app/[room]/page.tsx's generateMetadata), which every
 * duration in this app is already a whole number of minutes for (see
 * MIN_DURATION_SECONDS/DURATION_PRESETS_SECONDS/CUSTOM_DURATION_MINUTES_OPTIONS
 * above), so rounding here is just a defensive fallback, not expected to
 * actually trim anything in practice.
 */
export function formatMinutesPhrase(seconds: number): string {
  const minutes = Math.max(1, Math.round(seconds / 60));
  return `${minutes} minute${minutes === 1 ? "" : "s"}`;
}
