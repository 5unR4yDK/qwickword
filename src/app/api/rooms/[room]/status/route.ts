import { NextRequest, NextResponse } from "next/server";
import {
  DailyRoomError,
  getRoomPresence,
  getRoomStatus,
  startRoomCountdown,
} from "@/lib/daily-rooms";
import { MAX_DURATION_SECONDS, MIN_DURATION_SECONDS } from "@/lib/duration";

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
 * Extended 2026-07-22 (Andreas, interactive, live production bug report):
 * "I joined the call from my mobile phone... the timer didn't start... this
 * is the second time I've seen it... what is the way that we can enforce
 * this so it always happens?" — the client-side auto-start
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

    try {
      presentCount = await getRoomPresence(room);
    } catch (err) {
      // Non-fatal: presence is a supplementary signal on top of the
      // existing exp-based status, not a replacement for it. A failed
      // presence read shouldn't take down the whole status poll a waiting
      // tab depends on to pick up a manual "Start now" from elsewhere.
      console.error("[Qwickword] Failed to read room presence (non-fatal):", err);
    }

    if (!status.started && hasValidDuration && presentCount !== null && presentCount >= 2) {
      // Server-side auto-start fallback — see this file's top comment.
      // startRoomCountdown is itself idempotent/race-safe (re-checks the
      // room's live exp before patching), so it's safe to call here even if
      // a client-side trigger fires in the same instant.
      status = await startRoomCountdown(room, durationSeconds);
    }

    return NextResponse.json({ ...status, presentCount }, { status: 200 });
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
