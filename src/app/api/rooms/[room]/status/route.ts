import { NextRequest, NextResponse } from "next/server";
import { DailyRoomError, getRoomStatus } from "@/lib/daily-rooms";

/**
 * Read-only status poll: has this room's countdown started yet, and what's
 * its current live `exp`? Polled by a tab that's waiting for someone else's
 * manual "Start now" click to take effect — see the doc comment on
 * getRoomStatus in src/lib/daily-rooms.ts for why the join-triggered path
 * doesn't need this (each tab detects that itself via daily-js).
 *
 * `fallbackExp` (the pre-start buffer `exp` originally in the link, carried
 * as a query param) is only used in mock mode, where there's no real room to
 * check — see getRoomStatus's doc comment.
 */
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ room: string }> }
) {
  const { room } = await params;
  const fallbackExpParam = request.nextUrl.searchParams.get("fallbackExp");
  const fallbackExp = fallbackExpParam ? Number(fallbackExpParam) : NaN;

  if (!Number.isFinite(fallbackExp)) {
    return NextResponse.json(
      { error: '"fallbackExp" query param is required and must be a number.' },
      { status: 400 }
    );
  }

  try {
    const status = await getRoomStatus(room, fallbackExp);
    return NextResponse.json(status, { status: 200 });
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
