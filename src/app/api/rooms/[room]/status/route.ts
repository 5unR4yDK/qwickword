import { NextRequest, NextResponse } from "next/server";
import {
  DailyRoomError,
  getRoomPresence,
  getRoomStatus,
} from "@/lib/daily-rooms";
import { startAuthoritativeCountdown } from "@/lib/countdown-start";
import { MAX_DURATION_SECONDS, MIN_DURATION_SECONDS } from "@/lib/duration";
import { recordCallFirstJoined, recordCallStarted } from "@/lib/db";
import {
  CREATED_ROOM_COOKIE,
  PARENT_ROOM_COOKIE,
  sessionFromRequest,
  setRoomCookie,
  setSessionCookie,
  trafficClassFromRequest,
} from "@/lib/attribution";

/**
 * Status poll: has this room's countdown started yet, and what's its
 * current live `exp`? Polled by a tab that's waiting for someone else's
 * manual "Start now" click to take effect — see the doc comment on
 * getRoomStatus in src/lib/daily-rooms.ts for why the join-triggered path
 * doesn't need this in the common case (each tab detects that itself via
 * daily-js).
 *
 * `fallbackExp` (the pre-start buffer `exp` originally in the link, carried
 * as a query param) is only used in mock mode, where there's no real room to
 * check — see getRoomStatus's doc comment.
 *
 * Extended to cover a real failure mode seen in production: the countdown
 * occasionally not auto-starting when a second participant joined from
 * mobile. The client-side auto-start
 * (call-media.tsx's daily-js `participant-joined` listener, plus its own 2s
 * backstop poll of the SAME wrapped call object) turned out not to be
 * enough: both paths depend on that one browser tab's `DailyIframe.wrap()`
 * bridge working, so a glitch there disables the event *and* its backstop
 * together. This route now also accepts `durationSeconds` and, if the room
 * hasn't started yet, checks Daily's own authoritative
 * `/rooms/:name/presence` count (see getRoomPresence's doc comment) — a
 * signal that comes straight from Daily's server, not from any client's JS.
 * If 2+ people are genuinely present and nobody's client-side trigger has
 * started it, THIS poll starts it. Every tab already polls this endpoint
 * every 4s while waiting, so this doesn't need a new polling loop — it's the
 * same request now doing more.
 *
 * Also returns `presentCount` unconditionally (when live and not mock mode)
 * so CallRoom can use it for the mirror-image problem: "the countdown kept
 * counting after I left the call" / the UI staying on the waiting state
 * after Daily's own iframe showed the call had ended for this tab. If the
 * room's live presence count is 0, nobody (including this tab) is actually
 * still connected — see call-room.tsx for how that's used as a backstop for
 * `hasLeft`, independent of the same daily-js `left-meeting` event that
 * apparently didn't fire reliably in that report.
 */
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ room: string }> }
) {
  const serverReceivedAtMs = Date.now();
  const { room } = await params;
  const fallbackExpParam = request.nextUrl.searchParams.get("fallbackExp");
  const fallbackExp = fallbackExpParam ? Number(fallbackExpParam) : NaN;
  const durationSecondsParam = request.nextUrl.searchParams.get("durationSeconds");
  const durationSeconds = durationSecondsParam ? Number(durationSecondsParam) : NaN;
  const hasValidDuration =
    Number.isFinite(durationSeconds) &&
    Number.isInteger(durationSeconds) &&
    durationSeconds >= MIN_DURATION_SECONDS &&
    durationSeconds <= MAX_DURATION_SECONDS;

  if (!Number.isFinite(fallbackExp)) {
    return NextResponse.json(
      { error: '"fallbackExp" query param is required and must be a number.' },
      { status: 400 }
    );
  }

  try {
    let status = await getRoomStatus(room, fallbackExp);
    let presentCount: number | null = null;
    const { sessionId } = sessionFromRequest(request);
    const createdRoom =
      request.cookies.get(CREATED_ROOM_COOKIE)?.value ?? null;

    try {
      presentCount = await getRoomPresence(room);
    } catch (err) {
      // Non-fatal: presence is a supplementary signal on top of the
      // existing exp-based status, not a replacement for it. A failed
      // presence read shouldn't take down the whole status poll a waiting
      // tab depends on to pick up a manual "Start now" from elsewhere.
      console.error("[Qwickword] Failed to read room presence (non-fatal):", err);
    }

    if (presentCount !== null && presentCount >= 1) {
      const role = createdRoom === room ? "creator" : "recipient";
      // Stats (see src/lib/db.ts) — fire-and-forget, first write wins, so the
      // repeated poll and every participant's own tab all collapse to one
      // timestamp. Keyed off Daily's authoritative presence rather than the
      // poll itself: link previewers (WhatsApp, Slack, iMessage) fetch the
      // page HTML for their preview cards but never run JS and never appear
      // in presence, so a pasted link can't masquerade as someone turning up.
      void recordCallFirstJoined(room, {
        sessionId,
        trafficClass: trafficClassFromRequest(request),
        role,
      });
    }

    if (!status.started && hasValidDuration && presentCount !== null && presentCount >= 2) {
      // Server-side auto-start fallback — see this file's top comment. The
      // database claim chooses one provider PATCH even when this races a
      // participant-triggered or manual start request.
      status = await startAuthoritativeCountdown(
        room,
        durationSeconds,
        "status_backstop"
      );
      await recordCallStarted(room);
    }

    const response = NextResponse.json(
      {
        ...status,
        presentCount,
        serverReceivedAtMs,
        serverNowMs: Date.now(),
      },
      { status: 200 }
    );
    if (presentCount !== null && presentCount >= 1) {
      setSessionCookie(response, sessionId);
      if (createdRoom !== room) {
        setRoomCookie(response, PARENT_ROOM_COOKIE, room);
      }
    }
    return response;
  } catch (err) {
    if (err instanceof DailyRoomError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[Qwickword] Unexpected error fetching room status:", err);
    return NextResponse.json(
      { error: "Unexpected error fetching room status." },
      { status: 500 }
    );
  }
}
