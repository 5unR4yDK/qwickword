// Shared duration bounds/presets for Qwickword rooms. Deliberately has no
// side effects, no environment access, and no network calls, so it is safe to
// import from both server code (src/lib/daily-rooms.ts, API validation) and
// client code (the duration picker on the home page) without pulling
// server-only logic (fetch calls, the Daily API key) into the client bundle.

/** Hard bounds enforced by POST /api/rooms — see src/lib/daily-rooms.ts. */
export const MIN_DURATION_SECONDS = 30; // temporary test preset
export const MAX_DURATION_SECONDS = 30 * 60; // 30 minutes

/**
 * Convenience whole-minute bounds derived from the second-based bounds above,
 * for the manual minutes input on the home page (see
 * src/components/create-link-form.tsx). Kept in lockstep with
 * MIN_/MAX_DURATION_SECONDS so the client field and the API route's own bounds
 * check can never disagree. The 30-minute cap is a deliberate free-tier
 * ceiling — short enough to keep calls quick, with room to gate a longer or
 * premium tier behind it later.
 */
// Custom entry remains whole minutes even while the 30-second test preset is
// available as a one-tap option.
export const MIN_DURATION_MINUTES = 1;
export const MAX_DURATION_MINUTES = MAX_DURATION_SECONDS / 60; // 30

/**
 * One-click preset buttons on the home page. Clicking one of these creates
 * the room immediately — no separate "Create" step — alongside the manual
 * minutes field (src/components/create-link-form.tsx) for anyone who wants
 * a duration outside the presets, rather than the two competing with each
 * other. All presets stay within the MAX_DURATION_MINUTES cap above.
 */
export const DURATION_PRESETS_SECONDS = [30, 60, 120, 300, 600, 900, 1200] as const;

/** Formats a whole number of seconds as a compact picker label. */
export function formatDuration(seconds: number): string {
  if (seconds > 0 && seconds % 60 === 0) {
    return `${seconds / 60} min`;
  }
  return `${seconds} sec`;
}

/** Adjectival duration for copy such as "a 30 second Qwickword". */
export function formatDurationAdjective(seconds: number): string {
  return seconds > 0 && seconds % 60 === 0
    ? `${seconds / 60} minute`
    : `${seconds} second`;
}

/** Standalone duration for descriptions such as "30 seconds, hard stop". */
export function formatDurationLong(seconds: number): string {
  if (seconds > 0 && seconds % 60 === 0) {
    const minutes = seconds / 60;
    return `${minutes} ${minutes === 1 ? "minute" : "minutes"}`;
  }
  return `${seconds} ${seconds === 1 ? "second" : "seconds"}`;
}
