import { NextRequest, NextResponse } from "next/server";
import { recordLinkShared, type ShareChannel } from "@/lib/db";
import {
  sessionFromRequest,
  trafficClassFromRequest,
} from "@/lib/attribution";

/**
 * Stats-only: the link was deliberately sent somewhere.
 *
 * Closes the one gap the server cannot see for itself. Room creation, opening,
 * starting and ending all leave server-side traces; whether the link was
 * actually passed to another human does not.
 *
 * Unauthenticated, same trust model as the rest of this stateless app. The
 * blast radius is a timestamp, and `recordLinkShared` keeps only the first
 * report, so a replayed request cannot inflate anything beyond one call
 * appearing shared.
 */
export const dynamic = "force-dynamic";

type SharedBody = { via?: unknown };

const CHANNELS: readonly ShareChannel[] = ["native", "copy", "email"];

function isChannel(value: unknown): value is ShareChannel {
  return (
    typeof value === "string" && (CHANNELS as readonly string[]).includes(value)
  );
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ room: string }> }
) {
  const { room } = await params;

  let body: SharedBody = {};
  try {
    body = (await request.json()) as SharedBody;
  } catch {
    // Tolerate a missing body — this is a best-effort ping, and the channel
    // check below rejects anything unusable anyway.
  }

  if (!isChannel(body.via)) {
    return NextResponse.json(
      { error: `"via" must be one of: ${CHANNELS.join(", ")}.` },
      { status: 400 }
    );
  }

  const { sessionId } = sessionFromRequest(request);
  await recordLinkShared(room, body.via, {
    sessionId,
    trafficClass: trafficClassFromRequest(request),
  });
  return NextResponse.json({ ok: true }, { status: 200 });
}
