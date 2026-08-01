import { NextRequest, NextResponse } from "next/server";
import {
  DailyRoomError,
  getRoomStatus,
  isPlausibleRoomName,
} from "@/lib/daily-rooms";
import { getDailyConfig } from "@/lib/daily-config";
import { getRecordedDurationSeconds } from "@/lib/db";

/**
 * Everything a non-browser client needs to open a link, in one request.
 *
 * The native app receives an ordinary `qwickword.com/<slug>` link and has no
 * server-rendered page to read it from: it needs the Daily join URL and the
 * agreed length before it can show a pre-join screen. `GET
 * /api/rooms/[room]/status` deliberately answers a narrower question — has the
 * countdown started, and what is `exp` right now — and adding join details to
 * it would change a contract two clients already poll every few seconds.
 *
 * So this route exists, and it is deliberately a *rearrangement*, not a new
 * capability. Every field it returns is something src/app/[room]/page.tsx
 * already computes and hands to the public call page:
 *
 *  - `joinUrl`     — `https://${DAILY_DOMAIN}/${room}`, the same string the
 *                    page passes to CallRoom. The room is `privacy: "public"`,
 *                    so this URL is exactly as sensitive as the link itself:
 *                    whoever holds the link can already join.
 *  - `durationSeconds` — the row written at creation, same lookup the page does.
 *  - `exp`/`started`   — the room's live state from Daily, same call.
 *
 * What it must never return: the Daily API key, any database credential, a raw
 * Daily response, or anything identifying who is present. It returns none of
 * those. It is unauthenticated for the same reason the rest of this app is:
 * the link is the bearer token, and this route tells the holder of a link
 * nothing the browser would not have shown them.
 *
 * 404 semantics match the call page exactly, because a divergence would mean
 * the app and the browser disagree about whether a link is dead:
 *  - unknown to Daily *and* unknown to the database -> "gone", `existed: false`
 *  - unknown to Daily but recorded -> "gone", `existed: true` (it was real once)
 */
export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ room: string }> }
) {
  const serverReceivedAtMs = Date.now();
  const { room } = await params;

  if (!isPlausibleRoomName(room)) {
    return NextResponse.json(
      { error: "Invalid room name." },
      { status: 400 }
    );
  }

  const { mockMode, domain } = getDailyConfig();
  if (mockMode) {
    // Mock rooms are never persisted, so there is nothing to resolve. Say so
    // plainly rather than fabricating a join URL that would fail at connect
    // time with a far more confusing error.
    return NextResponse.json(
      {
        error: "Qwickword is in mock mode; this link can only be opened in a browser.",
      },
      { status: 503 }
    );
  }

  // Read the duration first: it is what distinguishes "this call is over" from
  // "this link was never real", and it must be known even when the Daily
  // lookup 404s below.
  const durationSeconds = await getRecordedDurationSeconds(room);

  try {
    // `fallbackExp: 0` is the same value the call page passes for a clean link
    // with no `exp` in the query string. Live mode never uses it.
    const status = await getRoomStatus(room, 0);
    return NextResponse.json(
      {
        room,
        joinUrl: `https://${domain}/${room}`,
        durationSeconds,
        started: status.started,
        exp: status.exp,
        serverReceivedAtMs,
        serverNowMs: Date.now(),
      },
      { status: 200 }
    );
  } catch (err) {
    if (err instanceof DailyRoomError && err.status === 404) {
      return NextResponse.json(
        {
          error: "This Qwickword is over.",
          // Lets the client choose between "the call ended or the link
          // expired" and "this link isn't valid" without guessing — the same
          // distinction the browser's invalid-link screen draws.
          existed: durationSeconds !== null,
        },
        { status: 404 }
      );
    }
    console.error("[Qwickword] Failed to resolve room for a client:", err);
    return NextResponse.json(
      { error: "Couldn't load this Qwickword." },
      { status: 502 }
    );
  }
}
