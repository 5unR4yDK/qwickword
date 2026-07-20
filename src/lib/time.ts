// Thin wrapper around Date.now(), used by Server Components that need the
// server's own clock at request time (e.g. src/app/[room]/page.tsx, computing
// how much time is left before a room's `exp` for Phase 0 item 6's hard-end
// screen). Kept in its own module, separate from any component function,
// because eslint-plugin-react-hooks's `react-hooks/purity` rule (bundled via
// eslint-config-next's core-web-vitals config) flags a direct call to a
// known-impure global like `Date.now()` written inside a component/hook
// body — even in a Server Component, which legitimately reads request-time
// data this way (the same category as Next's own `cookies()` / `headers()`).
// Routing the read through a plain named function in a separate file avoids
// that false positive without disabling the rule.

/** Milliseconds remaining until `expSeconds` (a Unix timestamp in seconds), as measured right now. */
export function remainingMsUntil(expSeconds: number): number {
  return expSeconds * 1000 - Date.now();
}
