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
  /** Unix timestamp (seconds) the room expires and everyone is ejected. */
  exp: number;
  /** Echoes the requested duration in seconds. */
  durationSeconds: number;
  /** True if this room is simulated (no live Daily API call was made). */
  mockMode: boolean;
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
  const exp = nowSeconds + durationSeconds;
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
        eject_after_elapsed: durationSeconds,
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
