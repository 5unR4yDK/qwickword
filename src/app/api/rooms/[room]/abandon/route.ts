import { NextRequest, NextResponse } from "next/server";
import {
  DailyRoomError,
  deleteRoom,
  getRoomPresence,
  getRoomStatus,
  isPlausibleRoomName,
} from "@/lib/daily-rooms";
import { getDailyConfig } from "@/lib/daily-config";

/** Never cache: this depends on the room's live state. */
export const dynamic = "force-dynamic";

/**
 * Retires an abandoned, never-started room. Called by the client when
 * someone leaves the call before the countdown has started — if they were
 * the only person there, the link is dead weight: whoever opens it later
 * would sit in a waiting room nobody is coming back to. Deleting the room
 * makes a later visit resolve to the "ended" screen instead
 * (src/app/[room]/page.tsx distinguishes a deleted-but-recorded room from a
 * never-existed one via the database row).
 *
 * Deliberately conservative — this only deletes when BOTH hold:
 *  - the countdown has not started (a started call is never touched: its
 *    hard end belongs to the timer, and leaving early is personal, not
 *    room-wide), and
 *  - Daily reports at most one person present (the leaver themselves may
 *    still be counted for a few seconds after leaving; anyone else present
 *    means the room is not abandoned).
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ room: string }> }
) {
  const { room } = await params;
  if (!isPlausibleRoomName(room)) {
    return NextResponse.json({ error: "Invalid room name." }, { status: 400 });
  }

  const { mockMode } = getDailyConfig();
  if (mockMode) {
    // Mock rooms aren't persisted anywhere — nothing to retire.
    return NextResponse.json({ retired: false }, { status: 200 });
  }

  try {
    const status = await getRoomStatus(room, 0);
    if (status.started) {
      return NextResponse.json({ retired: false }, { status: 200 });
    }

    const present = await getRoomPresence(room);
    // Unknown presence (null) fails safe: don't delete a room someone might
    // be sitting in.
    if (present === null || present > 1) {
      return NextResponse.json({ retired: false }, { status: 200 });
    }

    const deleted = await deleteRoom(room);
    return NextResponse.json({ retired: deleted }, { status: 200 });
  } catch (err) {
    if (err instanceof DailyRoomError && err.status === 404) {
      // Already gone — same outcome as a successful retire.
      return NextResponse.json({ retired: true }, { status: 200 });
    }
    console.error("[Qwickword] Failed to retire abandoned room:", err);
    return NextResponse.json(
      { error: "Couldn't retire the room." },
      { status: 502 }
    );
  }
}
