// Shared duration bounds/presets for Qwickword rooms. Deliberately has no
// side effects, no environment access, and no network calls, so it is safe to
// import from both server code (src/lib/daily-rooms.ts, API validation) and
// client code (the duration picker on the home page) without pulling
// server-only logic (fetch calls, the Daily API key) into the client bundle.

/** Hard bounds enforced by POST /api/rooms — see src/lib/daily-rooms.ts. */
export const MIN_DURATION_SECONDS = 60; // 1 minute
export const MAX_DURATION_SECONDS = 30 * 60; // 30 minutes

/**
 * Convenience whole-minute bounds derived from the second-based bounds above,
 * for the manual minutes input on the home page (see
 * src/components/create-link-form.tsx). Kept in lockstep with
 * MIN_/MAX_DURATION_SECONDS so the client field and the API route's own bounds
 * check can never disagree. The 30-minute cap is deliberate — Andreas:
 * "Beyond 30 minutes would be a later premium feature I'd say" — so this is
 * also the natural free-tier ceiling to gate a future Pro plan behind
 * (REVENUE.md), not just a UI nicety.
 */
export const MIN_DURATION_MINUTES = MIN_DURATION_SECONDS / 60; // 1
export const MAX_DURATION_MINUTES = MAX_DURATION_SECONDS / 60; // 30

/**
 * One-click preset buttons on the home page (2026-07-22, Andreas,
 * interactive: "Reinstate the buttons... 1, 2, 5, 10, 15, 20 minutes... keep
 * the manual entry as well"). Clicking one of these creates the room
 * immediately — no separate "Create" step — same one-click behaviour
 * originally built 2026-07-21 and reinstated here alongside the manual
 * minutes field (src/components/create-link-form.tsx) added later that
 * night, rather than the two competing with each other. All presets stay
 * within the MAX_DURATION_MINUTES cap above.
 */
export const DURATION_PRESETS_SECONDS = [60, 120, 300, 600, 900, 1200] as const;

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
 * MIN_DURATION_SECONDS/DURATION_PRESETS_SECONDS above), so rounding here is
 * just a defensive fallback, not expected to actually trim anything in
 * practice.
 */
export function formatMinutesPhrase(seconds: number): string {
  const minutes = Math.max(1, Math.round(seconds / 60));
  return `${minutes} minute${minutes === 1 ? "" : "s"}`;
}
