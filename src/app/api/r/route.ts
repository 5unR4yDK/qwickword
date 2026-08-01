import { NextRequest, NextResponse } from "next/server";
import { createRoom } from "@/lib/db";
import { generateRoomSlug } from "@/lib/room-names";
import {
  isValidDefaultDuration,
  normalizeRoomName,
  toRoomView,
} from "@/lib/rooms";
import { generateOwnerKey, hashOwnerKey } from "@/lib/room-keys";
import { MAX_DURATION_SECONDS, MIN_DURATION_SECONDS } from "@/lib/duration";

/**
 * Creates a persistent room.
 *
 * A room is not a call. It has a stable URL that keeps working, a name, and a
 * default length — and entering it starts nothing. Calls held inside it are
 * unchanged: each still mints a fresh Daily room with a hard server-enforced
 * expiry that cannot be extended.
 *
 * The `/api/r` namespace is separate from `/api/rooms/[room]`, which despite
 * the name operates on *calls* — its `[room]` segment is a Daily room name.
 * Keeping them apart is what makes it impossible for a room slug to be
 * mistaken for a call slug.
 */
export const dynamic = "force-dynamic";

type CreateRoomBody = {
  name?: unknown;
  defaultDurationSeconds?: unknown;
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

  const { defaultDurationSeconds } = body;
  if (!isValidDefaultDuration(defaultDurationSeconds)) {
    return NextResponse.json(
      {
        error:
          `"defaultDurationSeconds" is required and must be a whole number of ` +
          `seconds between ${MIN_DURATION_SECONDS} and ${MAX_DURATION_SECONDS}.`,
      },
      { status: 400 }
    );
  }

  const name = normalizeRoomName(body.name);

  // The key is generated here, hashed before it touches the database, and
  // returned exactly once in this response. There is no endpoint that can
  // reproduce it — losing it is permanent by design, because any recovery path
  // would be a way to seize a room by asking.
  const ownerKey = generateOwnerKey();

  // The slug namespace only has to be unique among rooms, and two-word slugs
  // collide rarely — but a room is durable, so a collision here would be
  // permanent rather than a transient annoyance. Retry a few times.
  const MAX_ATTEMPTS = 5;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const room = await createRoom(
      generateRoomSlug(),
      defaultDurationSeconds,
      name ?? undefined,
      hashOwnerKey(ownerKey)
    );
    if (room) {
      return NextResponse.json(
        { ...toRoomView(room, []), ownerKey },
        { status: 201 }
      );
    }
  }

  // `createRoom` returns null both for a slug collision and for an
  // unreachable database, and the caller can act on neither differently.
  return NextResponse.json(
    { error: "Couldn't create the room. Try again." },
    { status: 503 }
  );
}
