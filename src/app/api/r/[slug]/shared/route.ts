import { NextRequest, NextResponse } from "next/server";
import {
  sessionFromRequest,
  setSessionCookie,
  trafficClassFromRequest,
  trustedTrafficClassFromRequest,
} from "@/lib/attribution";
import { appendEvent, getRoom, type ShareChannel } from "@/lib/db";
import { isPlausibleRoomSlug } from "@/lib/rooms";

export const dynamic = "force-dynamic";

const CHANNELS = new Set<ShareChannel>(["native", "copy", "email"]);

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  if (!isPlausibleRoomSlug(slug)) {
    return NextResponse.json({ error: "Invalid room address." }, { status: 400 });
  }

  let body: { via?: unknown } = {};
  try {
    body = (await request.json()) as { via?: unknown };
  } catch {
    // Invalid JSON has the same bounded validation response as a missing via.
  }
  if (typeof body.via !== "string" || !CHANNELS.has(body.via as ShareChannel)) {
    return NextResponse.json({ error: "Invalid share channel." }, { status: 400 });
  }

  const room = await getRoom(slug);
  if (!room) {
    return NextResponse.json(
      { error: "This room is no longer available." },
      { status: 404 }
    );
  }

  const via = body.via as ShareChannel;
  const { sessionId } = sessionFromRequest(request);
  const trafficClass =
    trustedTrafficClassFromRequest(request) ?? trafficClassFromRequest(request);
  await appendEvent({
    kind: "room.shared",
    roomId: room.id,
    payload: { slug, sessionId, trafficClass, via },
    dedupeKey: `room.shared:${room.id}:${sessionId}:${via}`,
  });

  const response = NextResponse.json({ accepted: true }, { status: 200 });
  setSessionCookie(response, sessionId);
  return response;
}
