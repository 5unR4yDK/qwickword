import { NextRequest, NextResponse } from "next/server";
import { createHardExpiryRoom, DailyRoomError } from "@/lib/daily-rooms";
import {
  getActiveRoomCall,
  getRoom,
  recordCallCreated,
  touchRoom,
} from "@/lib/db";
import {
  isPlausibleRoomSlug,
  isValidDefaultDuration,
} from "@/lib/rooms";
import { MAX_DURATION_SECONDS, MIN_DURATION_SECONDS } from "@/lib/duration";
import {
  attributionFromRequest,
  CREATED_ROOM_COOKIE,
  sessionFromRequest,
  setRoomCookie,
  setSessionCookie,
  trafficClassFromRequest,
  trustedTrafficClassFromRequest,
} from "@/lib/attribution";

/**
 * Starts a call inside a room.
 *
 * This is the one place the two namespaces meet, and the distinction it keeps
 * is the whole design: the **room** persists, the **call** does not. Each call
 * here is an ordinary Qwickword — a fresh Daily room with a hard,
 * server-enforced expiry that no client can extend. Holding calls in a room
 * changes nothing about how they end.
 *
 * Deliberately needs NO owner key. The slug alone is enough, because the whole
 * claim of the product is that a stranger can be talking in one tap with
 * nothing installed and no account. Rename and close are gated; joining is
 * not, and must never become so. There is a test pinning this.
 *
 * The returned payload is deliberately identical in shape to POST /api/rooms,
 * so every client already knows how to handle it and the pre-join, countdown
 * and ending code paths are shared rather than duplicated.
 */
export const dynamic = "force-dynamic";

type StartCallBody = {
  /** Optional override; the room's default is used when absent. */
  durationSeconds?: unknown;
};

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  if (!isPlausibleRoomSlug(slug)) {
    return NextResponse.json({ error: "Invalid room address." }, { status: 400 });
  }

  const room = await getRoom(slug);
  if (!room) {
    return NextResponse.json(
      { error: "This room is no longer available." },
      { status: 404 }
    );
  }

  let body: StartCallBody = {};
  try {
    body = (await request.json()) as StartCallBody;
  } catch {
    // A body is optional here: starting a call at the room's default length is
    // the common case and should not require one.
  }

  // The room proposes a length; the caller may pick another for this one call
  // without changing what the room proposes next time.
  const requested = body.durationSeconds;
  const durationSeconds =
    requested === undefined || requested === null
      ? room.defaultDurationSeconds
      : requested;

  if (!isValidDefaultDuration(durationSeconds)) {
    return NextResponse.json(
      {
        error:
          `"durationSeconds" must be a whole number of seconds between ` +
          `${MIN_DURATION_SECONDS} and ${MAX_DURATION_SECONDS}.`,
      },
      { status: 400 }
    );
  }

  // A stable room is a rendezvous point. If one call is already open, every
  // visitor must be handed that same call rather than silently creating a
  // second conversation under the same room link.
  const activeCall = await getActiveRoomCall(room.id);
  if (activeCall) {
    const { sessionId } = sessionFromRequest(request);
    const response = NextResponse.json(
      {
        url: `https://qwickword.com/${activeCall.callName}`,
        name: activeCall.callName,
        exp: activeCall.exp,
        durationSeconds: activeCall.durationSeconds,
        mockMode: false,
        clean: true,
        roomSlug: room.slug,
        reused: true,
      },
      { status: 200 }
    );
    setSessionCookie(response, sessionId);
    setRoomCookie(response, CREATED_ROOM_COOKIE, activeCall.callName);
    return response;
  }

  try {
    const call = await createHardExpiryRoom(durationSeconds);
    const { sessionId } = sessionFromRequest(request);

    // Linking the call to the room is what builds the timeline. Awaited,
    // because `clean` depends on the row having landed: without it the shared
    // link has to carry exp and duration in its query string.
    const recorded = call.mockMode
      ? false
      : await recordCallCreated(call.name, call.durationSeconds, room.id, {
          sessionId,
          trafficClass:
            trustedTrafficClassFromRequest(request) ??
            trafficClassFromRequest(request),
          ...attributionFromRequest(request),
          parentCallName: null,
        });

    // A room is alive because calls happen in it. This is what holds off the
    // 90-day idle expiry.
    void touchRoom(room.id);

    const response = NextResponse.json(
      { ...call, clean: recorded, roomSlug: room.slug },
      { status: 201 }
    );
    setSessionCookie(response, sessionId);
    setRoomCookie(response, CREATED_ROOM_COOKIE, call.name);
    return response;
  } catch (err) {
    if (err instanceof DailyRoomError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[Qwickword] Unexpected error starting a room call:", err);
    return NextResponse.json(
      { error: "Unexpected error starting the call." },
      { status: 500 }
    );
  }
}
