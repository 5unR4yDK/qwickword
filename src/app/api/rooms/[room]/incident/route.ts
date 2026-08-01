import { NextRequest, NextResponse } from "next/server";
import { createIncidentReference } from "@/lib/db";
import { isPlausibleRoomName } from "@/lib/daily-rooms";

export const dynamic = "force-dynamic";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type IncidentBody = {
  clientCallSessionId?: unknown;
  surface?: unknown;
  appVersion?: unknown;
};

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ room: string }> }
) {
  const { room } = await params;
  if (!isPlausibleRoomName(room)) {
    return NextResponse.json({ error: "invalid_room" }, { status: 400 });
  }
  let body: IncidentBody;
  try {
    body = (await request.json()) as IncidentBody;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (
    typeof body.clientCallSessionId !== "string" ||
    !UUID_PATTERN.test(body.clientCallSessionId) ||
    (body.surface !== "web" && body.surface !== "ios") ||
    (body.appVersion !== undefined &&
      (typeof body.appVersion !== "string" || body.appVersion.length > 64))
  ) {
    return NextResponse.json({ error: "invalid_incident" }, { status: 400 });
  }

  const reference = await createIncidentReference({
    room,
    clientCallSessionId: body.clientCallSessionId,
    surface: body.surface,
    appVersion: typeof body.appVersion === "string" ? body.appVersion : null,
  });
  if (!reference) {
    return NextResponse.json({ error: "incident_unavailable" }, { status: 503 });
  }
  return NextResponse.json({ reference, retainedDays: 14 }, { status: 201 });
}
