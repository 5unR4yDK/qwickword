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
  // The app repository runs a real production contract probe. It still mints
  // and starts a genuine one-minute Daily room, but it must not look like a
  // human-created link in the product funnel. The room is started immediately
  // by the probe, so Daily's own hard expiry removes it after one minute.
  const isContractCheck =
    request.headers.get("x-qwickword-contract-check") === "1";

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
    // The database row is what lets the shared link be clean (slug only, no
    // query params) — the call page recovers the duration from it. Awaited,
    // because the response's `clean` flag depends on whether the write
    // landed: if it didn't (database down, DATABASE_URL unset), the client
    // falls back to a link that carries exp/d in the query string, which
    // works with no database at all. Mock rooms always use the fallback —
    // they aren't persisted anywhere a later request could look them up.
    const recorded = room.mockMode || isContractCheck
      ? false
      : await recordCallCreated(room.name, room.durationSeconds);
    return NextResponse.json({ ...room, clean: recorded }, { status: 200 });
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
