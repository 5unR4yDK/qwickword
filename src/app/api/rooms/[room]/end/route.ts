import { NextResponse } from "next/server";
import { DailyRoomError, endRoomNow } from "@/lib/daily-rooms";
import { recordCallEndedEarly } from "@/lib/db";

/**
 * Ends a room's call immediately (ROADMAP.md "Vote to end early", built
 * 2026-07-22, nightly). Called by any client tab whose own vote tally
 * (daily-js participant list + app-message broadcasts — see
 * src/components/call-media.tsx) has crossed the ">50% of current
 * participants want to end" threshold. No body needed: unlike
 * POST /api/rooms/[room]/start, there is no duration to pass — "end now"
 * means exactly that, always. Same trust model as the rest of this
 * stateless app (whoever has the room name can act on it, same as joining
 * the call itself); `endRoomNow` is itself what makes repeated/concurrent
 * calls safe (idempotent no-op once the room is already over).
 */
export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ room: string }> }
) {
  const { room } = await params;

  try {
    const status = await endRoomNow(room);
    // Stats logging (see src/lib/db.ts) — fire-and-forget.
    void recordCallEndedEarly(room);
    return NextResponse.json(status, { status: 200 });
  } catch (err) {
    if (err instanceof DailyRoomError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[Qwickword] Unexpected error ending room early:", err);
    return NextResponse.json(
      { error: "Unexpected error ending the call." },
      { status: 500 }
    );
  }
}
