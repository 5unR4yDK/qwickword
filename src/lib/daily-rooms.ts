// Server-only helper for creating hard-expiring Daily rooms. This is the first
// real caller of daily-config.ts's mock-mode fallback: in live mode it calls the
// real Daily REST API, in mock mode it fabricates an equivalent response so the
// rest of the app (link generator, call page) can be built and tested without a
// live key.
//
// Property names below (`exp`, `eject_at_room_exp`, `eject_after_elapsed`) were
// validated on 2026-07-15 against the live Daily REST API reference
// (https://docs.daily.co/reference/rest-api/rooms/create-room and
// https://docs.daily.co/reference/rest-api/rooms/config). They match what
// BUILD_PLAN.md already specified — no correction needed there.
//
// `enable_prejoin_ui` (added 2026-07-21, ROADMAP.md Phase 1 item 1 — "Pre-join
// screen: name entry + camera/mic check before connecting") was validated the
// same way against https://docs.daily.co/reference/rest-api/rooms/config:
// "Determines whether participants enter a waiting room with a camera, mic,
// and browser check before joining a call." That IS Daily Prebuilt's own
// lobby screen — confirmed via docs.daily.co/guides/products/prebuilt/
// customizing-daily-prebuilt and Daily's own blog that it also collects a
// display name first ("the name form will show, which requires a name to be
// entered, and submitting this form will bring the user to the prejoin UI").
// Deliberate build choice: rather than writing a custom getUserMedia-based
// name/device screen, this reuses Daily Prebuilt's own lobby — same rationale
// as Phase 0 item 5's choice to embed Daily's whole prebuilt call UI rather
// than build a custom call surface. Consequence worth knowing: the lobby is
// rendered *inside* the iframe already embedded on the call page, so no new
// component/route was needed here, and it counts against the room's shared
// `exp` like any other time spent on the page (consistent with "the timer
// hits zero and it ends" — dawdling in the lobby is not a loophole).
//
// Hard-expiry design (per STATUS.md, locked): `exp = now + duration`,
// `eject_at_room_exp: true` (ejects anyone still in the room at `exp`), and
// `eject_after_elapsed = duration` as a per-participant backstop (ejects a
// participant `duration` seconds after *they* joined, even if that's before the
// room-level `exp` — e.g. a latecomer). Both are enforced server-side by Daily,
// so there is no client-side "extend" bypass.
//
// "Anchor the countdown to first join, not link creation" (ROADMAP.md, built
// 2026-07-21, interactive): the real countdown no longer begins the instant
// `POST /api/rooms` is called. Instead:
//  1. `createHardExpiryRoom` sets the room's *initial* `exp` to a generous
//     `PRE_START_BUFFER_SECONDS` (24h) buffer, not `now + durationSeconds` —
//     this is purely "how long the link can sit unopened before it rots,"
//     not the actual call length. `eject_after_elapsed` is set to the same
//     generous buffer, so nobody waiting in the pre-join lobby gets ejected
//     early by that per-participant backstop.
//  2. `startRoomCountdown` is the one place that starts the *real* clock: it
//     re-fetches the room's live config from Daily, and if the room hasn't
//     already been started (see `isCountdownStarted`'s heuristic below), sets
//     `exp = now + durationSeconds` — the real, server-enforced hard cutoff.
//     If it's already started, it's a no-op that just echoes the existing
//     `exp` back — this is what makes "whichever trigger fires first wins"
//     safe to call from both paths (a manual "Start now" click, and every
//     connected client's own daily-js detecting a second participant) without
//     a race resetting the clock.
//  3. There is still no datastore. "Started or not" is derived entirely from
//     the room's own live `exp` versus `PRE_START_BUFFER_SECONDS` — Daily's
//     room object stays the single source of truth, exactly as ROADMAP.md
//     specified, rather than adding a database for one boolean.
const PRE_START_BUFFER_SECONDS = 24 * 60 * 60; // 24 hours

// How far below PRE_START_BUFFER_SECONDS the remaining time has to be before
// we call the countdown "started." Real countdowns are at most
// MAX_DURATION_SECONDS (30 minutes) away, so anything meaningfully less than
// the 24h buffer is unambiguously a real countdown, not the pre-start buffer
// — this margin just absorbs request latency/clock skew, not actual
// ambiguity between the two.
const STARTED_DETECTION_MARGIN_SECONDS = 5 * 60;

/**
 * True if `exp` (the room's current live expiry, in Unix seconds) reflects a
 * real, started countdown rather than the generous pre-start buffer set at
 * creation. See the design note above `PRE_START_BUFFER_SECONDS`.
 */
export function isCountdownStarted(exp: number, nowSeconds: number): boolean {
  return exp - nowSeconds < PRE_START_BUFFER_SECONDS - STARTED_DETECTION_MARGIN_SECONDS;
}

import { getDailyConfig } from "./daily-config";
import { MAX_DURATION_SECONDS, MIN_DURATION_SECONDS } from "./duration";

const DAILY_API_BASE = "https://api.daily.co/v1";

// Re-exported so existing callers (e.g. src/app/api/rooms/route.ts) can keep
// importing the bounds from here. The values themselves now live in
// ./duration.ts, which has no server-only dependencies (no fetch, no env
// access), so the duration picker UI (a Client Component) can import the same
// constants without pulling this file's Daily API/fetch logic into the
// client bundle. See src/lib/duration.ts for the rationale.
export { MAX_DURATION_SECONDS, MIN_DURATION_SECONDS };

export type CreateRoomResult = {
  /** The full joinable room URL, e.g. https://quickword.daily.co/abc123 */
  url: string;
  /** The Daily room name (last path segment of `url`). */
  name: string;
  /**
   * Unix timestamp (seconds) the room's *pre-start* buffer expires — i.e. how
   * long the link can sit unopened before it rots (see
   * `PRE_START_BUFFER_SECONDS` above), NOT when the actual call ends. The
   * real, started countdown is a separate `exp` set later by
   * `startRoomCountdown`, once someone presses "Start now" or a second
   * participant joins.
   */
  exp: number;
  /** Echoes the requested duration in seconds. */
  durationSeconds: number;
  /** True if this room is simulated (no live Daily API call was made). */
  mockMode: boolean;
};

export type RoomStatus = {
  /** The room's current live `exp` (Unix seconds), whatever it is right now. */
  exp: number;
  /** True if the real countdown has started (see `isCountdownStarted`). */
  started: boolean;
};

export class DailyRoomError extends Error {
  status: number;
  constructor(message: string, status = 502) {
    super(message);
    this.name = "DailyRoomError";
    this.status = status;
  }
}

/**
 * Creates a Daily room whose max lifetime is exactly `durationSeconds`, hard
 * enforced server-side. In mock mode (no Daily credentials configured), returns
 * a fabricated result with the same shape and no network call.
 */
export async function createHardExpiryRoom(
  durationSeconds: number
): Promise<CreateRoomResult> {
  if (
    !Number.isFinite(durationSeconds) ||
    !Number.isInteger(durationSeconds) ||
    durationSeconds < MIN_DURATION_SECONDS ||
    durationSeconds > MAX_DURATION_SECONDS
  ) {
    throw new DailyRoomError(
      `durationSeconds must be an integer between ${MIN_DURATION_SECONDS} and ${MAX_DURATION_SECONDS}.`,
      400
    );
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  // Pre-start buffer, not the real call length — see the design note above
  // PRE_START_BUFFER_SECONDS. eject_after_elapsed matches it so nobody
  // waiting in the pre-join lobby before "start" gets ejected by that
  // per-participant backstop.
  const exp = nowSeconds + PRE_START_BUFFER_SECONDS;
  const { apiKey, domain, mockMode } = getDailyConfig();

  if (mockMode) {
    const name = `mock-${Math.random().toString(36).slice(2, 10)}`;
    return {
      url: `https://mock.daily.co/${name}`,
      name,
      exp,
      durationSeconds,
      mockMode: true,
    };
  }

  const response = await fetch(`${DAILY_API_BASE}/rooms`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      privacy: "public",
      properties: {
        exp,
        eject_at_room_exp: true,
        eject_after_elapsed: PRE_START_BUFFER_SECONDS,
        enable_prejoin_ui: true,
      },
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new DailyRoomError(
      `Daily API returned ${response.status} creating a room: ${detail.slice(0, 500)}`,
      response.status >= 400 && response.status < 500 ? 400 : 502
    );
  }

  const data = (await response.json()) as {
    name: string;
    url: string;
    config?: { exp?: number };
  };

  return {
    // Prefer the domain from env (DAILY_DOMAIN is already the full host, e.g.
    // "quickword.daily.co") over whatever Daily returns, in case they ever
    // differ; Daily's own `url` is the fallback if `domain` is somehow unset
    // (shouldn't happen here since mockMode is false only when both are set).
    url: domain ? `https://${domain}/${data.name}` : data.url,
    name: data.name,
    exp: data.config?.exp ?? exp,
    durationSeconds,
    mockMode: false,
  };
}

/**
 * Starts the real countdown for a room: re-fetches the room's live config
 * from Daily and, if it hasn't already been started (see
 * `isCountdownStarted`), sets `exp = now + durationSeconds` — the actual,
 * server-enforced hard cutoff. If it's already started, this is a no-op that
 * echoes the existing `exp` back, which is what makes it safe to call from
 * both triggers (manual "Start now", and every connected client's own
 * daily-js detecting a second participant) without a race resetting the
 * clock — whichever trigger fires first wins.
 *
 * Mock mode has no persisted room to check, so it always "starts" fresh —
 * documented limitation, consistent with mock mode never having a real
 * second participant to detect in the first place.
 */
export async function startRoomCountdown(
  name: string,
  durationSeconds: number
): Promise<RoomStatus> {
  if (
    !Number.isFinite(durationSeconds) ||
    !Number.isInteger(durationSeconds) ||
    durationSeconds < MIN_DURATION_SECONDS ||
    durationSeconds > MAX_DURATION_SECONDS
  ) {
    throw new DailyRoomError(
      `durationSeconds must be an integer between ${MIN_DURATION_SECONDS} and ${MAX_DURATION_SECONDS}.`,
      400
    );
  }

  const { apiKey, mockMode } = getDailyConfig();
  const nowSeconds = Math.floor(Date.now() / 1000);

  if (mockMode) {
    return { exp: nowSeconds + durationSeconds, started: true };
  }

  const getResponse = await fetch(
    `${DAILY_API_BASE}/rooms/${encodeURIComponent(name)}`,
    { headers: { Authorization: `Bearer ${apiKey}` } }
  );
  if (!getResponse.ok) {
    throw new DailyRoomError(
      `Daily API returned ${getResponse.status} fetching room "${name}".`,
      getResponse.status === 404 ? 404 : 502
    );
  }
  const current = (await getResponse.json()) as { config?: { exp?: number } };
  const currentExp = current.config?.exp;

  if (typeof currentExp === "number" && isCountdownStarted(currentExp, nowSeconds)) {
    // Already started by the other trigger — don't reset the clock.
    return { exp: currentExp, started: true };
  }

  const newExp = nowSeconds + durationSeconds;
  const patchResponse = await fetch(
    `${DAILY_API_BASE}/rooms/${encodeURIComponent(name)}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ properties: { exp: newExp } }),
    }
  );
  if (!patchResponse.ok) {
    const detail = await patchResponse.text().catch(() => "");
    throw new DailyRoomError(
      `Daily API returned ${patchResponse.status} starting room "${name}": ${detail.slice(0, 500)}`,
      patchResponse.status >= 400 && patchResponse.status < 500 ? 400 : 502
    );
  }
  const updated = (await patchResponse.json()) as { config?: { exp?: number } };

  return { exp: updated.config?.exp ?? newExp, started: true };
}

/**
 * Ends a room's call immediately: sets `exp` to right now, so Daily's own
 * `eject_at_room_exp` enforcement (already on since Phase 0 item 3) ejects
 * everyone within the next moment, and this page's own client-side "ended"
 * screen (CallRoom, driven purely by `exp` vs. the clock) takes over — the
 * exact same hard-end mechanism Phase 0 already built, just triggered early
 * instead of by the original duration running out. This is the mirror image
 * of `startRoomCountdown` above: that function only ever moves `exp` later
 * (starting the real countdown); this one only ever moves it earlier
 * (ending the call), and never un-ends a call that's already over.
 *
 * ROADMAP.md "Vote to end early" (built 2026-07-22, nightly): reuses this
 * one function for both triggers a client could have — there is no separate
 * per-vote state on the server. The vote *tally itself* lives entirely on
 * the client side, in daily-js's own live participant list plus app-message
 * broadcasts between connected tabs (see src/components/call-media.tsx) —
 * consistent with this whole app's "no new datastore" design (BUILD_PLAN.md,
 * ROADMAP.md Phase 1). Once any client's own tally crosses the >50%
 * threshold, it calls this same endpoint; if two tabs happen to cross the
 * threshold within moments of each other, both calls land on the same
 * idempotent no-op path below.
 *
 * Idempotent and safe to call more than once, including after the room has
 * already ended (naturally or via an earlier end-vote): if the room's
 * current live `exp` is already at or before now, this is a no-op that
 * echoes the existing `exp` back rather than re-patching Daily with a
 * (pointless, and pointlessly noisy) second "end it now" write.
 */
export async function endRoomNow(name: string): Promise<RoomStatus> {
  const { apiKey, mockMode } = getDailyConfig();
  const nowSeconds = Math.floor(Date.now() / 1000);
  // Daily's REST API rejects a PATCH whose `exp` is not strictly in the
  // future ("exp was '...', which is in the past rather than in the
  // future") — caught live while verifying this function, not something the
  // docs called out up front. A bare `nowSeconds` is often *already* in the
  // past by the time the request reaches Daily (network latency, or just the
  // clock ticking over between computing it and Daily receiving it), so this
  // asks for one second from now instead — still "essentially immediately"
  // for a human (Daily's own `eject_at_room_exp` enforcement, plus this
  // page's own 1-second-granularity countdown, already mean nobody perceives
  // the difference), while staying safely on the "future" side of Daily's
  // validation.
  const endExp = nowSeconds + 1;

  if (mockMode) {
    // No persisted room to patch — echoing "ended as of now" is enough for
    // CallRoom's own exp-vs-clock check to show the ended screen.
    return { exp: nowSeconds, started: true };
  }

  const getResponse = await fetch(
    `${DAILY_API_BASE}/rooms/${encodeURIComponent(name)}`,
    { headers: { Authorization: `Bearer ${apiKey}` } }
  );
  if (!getResponse.ok) {
    throw new DailyRoomError(
      `Daily API returned ${getResponse.status} fetching room "${name}".`,
      getResponse.status === 404 ? 404 : 502
    );
  }
  const current = (await getResponse.json()) as { config?: { exp?: number } };
  const currentExp = current.config?.exp;

  if (typeof currentExp === "number" && currentExp <= endExp) {
    // Already over, or already ending within the same second (naturally, or
    // from an earlier end-vote/patch that beat this call to it) — don't push
    // exp any further (and don't risk re-sending a now-in-the-past value),
    // just report what's already there.
    return { exp: currentExp, started: true };
  }

  const patchResponse = await fetch(
    `${DAILY_API_BASE}/rooms/${encodeURIComponent(name)}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ properties: { exp: endExp } }),
    }
  );
  if (!patchResponse.ok) {
    const detail = await patchResponse.text().catch(() => "");
    throw new DailyRoomError(
      `Daily API returned ${patchResponse.status} ending room "${name}": ${detail.slice(0, 500)}`,
      patchResponse.status >= 400 && patchResponse.status < 500 ? 400 : 502
    );
  }
  const updated = (await patchResponse.json()) as { config?: { exp?: number } };

  return { exp: updated.config?.exp ?? endExp, started: true };
}

/**
 * Read-only status check: re-fetches the room's live config from Daily and
 * reports its current `exp` plus whether the countdown has started. Used for
 * polling by a tab that's waiting for someone else's manual "Start now"
 * click to take effect (a joined-meeting-triggered start is instead detected
 * directly by each tab's own daily-js participant count — see
 * src/components/call-media.tsx — so polling is only needed for the
 * cross-tab manual-start case).
 *
 * Mock mode has no persisted room to check — returns `started: false` with
 * the original buffer `exp` unchanged (documented limitation: mock mode's
 * "waiting" state doesn't sync across tabs, since there is nothing to poll).
 */
export async function getRoomStatus(
  name: string,
  fallbackExp: number
): Promise<RoomStatus> {
  const { apiKey, mockMode } = getDailyConfig();
  const nowSeconds = Math.floor(Date.now() / 1000);

  if (mockMode) {
    return { exp: fallbackExp, started: false };
  }

  const response = await fetch(
    `${DAILY_API_BASE}/rooms/${encodeURIComponent(name)}`,
    { headers: { Authorization: `Bearer ${apiKey}` } }
  );
  if (!response.ok) {
    throw new DailyRoomError(
      `Daily API returned ${response.status} fetching room "${name}".`,
      response.status === 404 ? 404 : 502
    );
  }
  const data = (await response.json()) as { config?: { exp?: number } };
  const exp = data.config?.exp ?? fallbackExp;

  return { exp, started: isCountdownStarted(exp, nowSeconds) };
}

// Matches both this app's mock room names ("mock-xxxxxxxx") and Daily's own
// auto-generated names (alphanumeric, sometimes with hyphens). Deliberately
// permissive — this is a syntax sanity check to reject garbage that could
// never be a real room name (empty, whitespace, slashes, control characters,
// wildly long strings from a mistyped/mangled URL), not a strict format
// validator against Daily's exact generator. See src/app/[room]/page.tsx
// (Phase 0 item 7, "Invalid/expired-link handling") for where this is used.
const ROOM_NAME_PATTERN = /^[a-zA-Z0-9_-]{1,80}$/;

export function isPlausibleRoomName(name: string): boolean {
  return ROOM_NAME_PATTERN.test(name);
}

/**
 * Checks whether a room with this name currently exists on Daily. Live mode
 * only — mock mode has nothing to check against, since mock rooms are never
 * persisted anywhere (see daily-config.ts); callers should skip calling this
 * in mock mode rather than rely on the `mockMode: true` short-circuit below,
 * which exists as a defensive fallback, not the primary guard.
 *
 * Fails "open" (returns true, i.e. assume it exists) on anything other than
 * an unambiguous 404 from Daily. A transient network error or a 5xx from
 * Daily is not evidence the room is invalid — treating it as invalid would
 * incorrectly tell the owner of a perfectly real link that it's dead. A 404
 * is the one clear "this room does not exist" signal Daily's API gives.
 */
export async function checkDailyRoomExists(name: string): Promise<boolean> {
  const { apiKey, mockMode } = getDailyConfig();
  if (mockMode) return true;

  try {
    const response = await fetch(
      `${DAILY_API_BASE}/rooms/${encodeURIComponent(name)}`,
      { headers: { Authorization: `Bearer ${apiKey}` } }
    );
    if (response.status === 404) return false;
    return true;
  } catch {
    return true;
  }
}
