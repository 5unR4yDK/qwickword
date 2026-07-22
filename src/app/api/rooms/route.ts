import { NextRequest, NextResponse } from "next/server";
import {
  createHardExpiryRoom,
  DailyRoomError,
  MAX_DURATION_SECONDS,
  MIN_DURATION_SECONDS,
} from "@/lib/daily-rooms";
import { recordCallCreated } from "@/lib/db";

/** Never cache: every call must mint a fresh room. */
export const dynamic = "force-dynamic";

type CreateRoomBody = {
  durationSeconds?: unknown;
};

export async function POST(request: NextRequest) {
  let body: CreateRoomBody;
  try {
    body = (await request.json()) as CreateRoomBody;
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
    const room = await createHardExpiryRoom(durationSeconds);
    // Stats logging (see src/lib/db.ts) — fire-and-forget, never blocks or
    // fails the actual room creation. Skipped for mock rooms: they're not
    // real calls, and mock room names aren't unique/stable enough to be
    // meaningful stats rows.
    if (!room.mockMode) {
      void recordCallCreated(room.name, room.durationSeconds);
    }
    return NextResponse.json(room, { status: 200 });
  } catch (err) {
    if (err instanceof DailyRoomError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[Qwickword] Unexpected error creating room:", err);
    return NextResponse.json(
      { error: "Unexpected error creating the room." },
      { status: 500 }
    );
  }
}
