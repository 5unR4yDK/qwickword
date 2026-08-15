import { NextRequest, NextResponse } from "next/server";
import {
  attributionFromRequest,
  sessionFromRequest,
  setAttributionCookies,
  setSessionCookie,
  trafficClassFromRequest,
  trustedTrafficClassFromRequest,
} from "@/lib/attribution";
import { appendEvent, getRoom } from "@/lib/db";
import { isPlausibleRoomSlug } from "@/lib/rooms";
import { OWNER_KEY_HEADER, verifyOwnerKey } from "@/lib/room-keys";

export const dynamic = "force-dynamic";

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

  const { sessionId } = sessionFromRequest(request);
  const attribution = attributionFromRequest(request);
  const trafficClass =
    trustedTrafficClassFromRequest(request) ?? trafficClassFromRequest(request);
  const role = (await verifyOwnerKey(
    slug,
    request.headers.get(OWNER_KEY_HEADER)
  ))
    ? "owner"
    : "recipient";

  await appendEvent({
    kind: "room.opened",
    roomId: room.id,
    payload: { slug, sessionId, trafficClass, role, ...attribution },
    dedupeKey: `room.opened:${room.id}:${sessionId}`,
  });

  const response = NextResponse.json({ accepted: true, role }, { status: 200 });
  setSessionCookie(response, sessionId);
  setAttributionCookies(response, attribution, trafficClass);
  return response;
}
