import { NextRequest, NextResponse } from "next/server";
import {
  DailyRoomError,
  MAX_DURATION_SECONDS,
  MIN_DURATION_SECONDS,
  startRoomCountdown,
} from "@/lib/daily-rooms";
import { recordCallStarted } from "@/lib/db";

/**
 * Starts the real countdown for a room (see the design note above
 * `PRE_START_BUFFER_SECONDS` in src/lib/daily-rooms.ts). Called from two
 * places on the call page, both harmless to call more than once or
 * concurrently: a manual "Start now" button press, and each connected
 * client's own daily-js detecting that a second participant has joined.
 * `startRoomCountdown` itself is the one place that decides whether the
 * countdown is already running — this route is a thin, unauthenticated
 * wrapper (same trust model as the rest of this stateless app: whoever has
 * the room name can act on it, same as joining the call itself).
 */
export const dynamic = "force-dynamic";

type StartRoomBody = {
  durationSeconds?: unknown;
};

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ room: string }> }
) {
  const { room } = await params;

  let body: StartRoomBody;
  try {
    body = (await request.json()) as StartRoomBody;
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON." },
      { status: 400 }
    );
  }

  const durationSeconds = body.durationSeconds;
  if (typeof durationSeconds !== "number") {
    return NextResponse.json(
      {
        error: `"durationSeconds" is required and must be a number of seconds ` +
          `(between ${MIN_DURATION_SECONDS} and ${MAX_DURATION_SECONDS}).`,
      },
      { status: 400 }
    );
  }

  try {
    const status = await startRoomCountdown(room, durationSeconds);
    // Stats logging (see src/lib/db.ts) — fire-and-forget. No-op if this
    // room was never recorded in the first place (mock rooms), since the
    // UPDATE simply matches zero rows.
    void recordCallStarted(room);
    return NextResponse.json(status, { status: 200 });
  } catch (err) {
    if (err instanceof DailyRoomError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[Qwickword] Unexpected error starting room countdown:", err);
    return NextResponse.json(
      { error: "Unexpected error starting the countdown." },
      { status: 500 }
    );
  }
}
