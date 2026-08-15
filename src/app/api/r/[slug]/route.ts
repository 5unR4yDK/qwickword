import { NextRequest, NextResponse } from "next/server";
import { closeRoom, renameRoom, setRoomDefaultDuration } from "@/lib/db";
import {
  isPlausibleRoomSlug,
  isValidDefaultDuration,
  loadRoomView,
  normalizeRoomName,
} from "@/lib/rooms";
import { OWNER_KEY_HEADER, verifyOwnerKey } from "@/lib/room-keys";
import { MAX_DURATION_SECONDS, MIN_DURATION_SECONDS } from "@/lib/duration";
import {
  sessionFromRequest,
  setSessionCookie,
  trafficClassFromRequest,
  trustedTrafficClassFromRequest,
} from "@/lib/attribution";

/**
 * Read, rename, re-length or retire one room.
 *
 * A room carries two capabilities and therefore two credentials:
 *
 *   - the **slug** is public. It grants GET here, and starting a call. It goes
 *     in an email signature.
 *   - the **owner key** grants PATCH and DELETE. It is returned once at
 *     creation and never again.
 *
 * Before this split, being sent a room link meant being able to close the
 * room.
 *
 * What GET returns is deliberately unremarkable: a name, a default length and
 * a list of past calls. No files, no participant identities, nothing that
 * would make the share link worth stealing.
 */
export const dynamic = "force-dynamic";

function badSlug() {
  return NextResponse.json({ error: "Invalid room address." }, { status: 400 });
}

/**
 * One response for a missing key, a wrong key, and a room that does not exist.
 *
 * Distinguishing them would turn this endpoint into an oracle for which slugs
 * are real, and would tell someone probing with a guessed key that they had
 * found a live room.
 */
function notOwner() {
  return NextResponse.json(
    { error: "This needs the room's owner key." },
    { status: 403 }
  );
}

function ownerKeyFrom(request: NextRequest): string | null {
  // A header, never a query parameter: parameters reach server logs, `Referer`
  // headers and analytics. The key does not belong in any of them.
  return request.headers.get(OWNER_KEY_HEADER);
}

function gone() {
  // One response for "never existed", "closed" and "idle past 90 days". A
  // caller can act on none of them differently, and distinguishing them would
  // confirm whether a given slug was ever real.
  return NextResponse.json(
    { error: "This room is no longer available." },
    { status: 404 }
  );
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  if (!isPlausibleRoomSlug(slug)) return badSlug();

  const view = await loadRoomView(slug);
  return view ? NextResponse.json(view, { status: 200 }) : gone();
}

type PatchBody = {
  name?: unknown;
  defaultDurationSeconds?: unknown;
};

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  if (!isPlausibleRoomSlug(slug)) return badSlug();
  if (!(await verifyOwnerKey(slug, ownerKeyFrom(request)))) return notOwner();

  let body: PatchBody;
  try {
    body = (await request.json()) as PatchBody;
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON." },
      { status: 400 }
    );
  }

  // Both fields are optional, but a PATCH that changes nothing is a mistake
  // worth naming rather than a silent success.
  const wantsRename = "name" in body;
  const wantsDuration = "defaultDurationSeconds" in body;
  if (!wantsRename && !wantsDuration) {
    return NextResponse.json(
      { error: 'Provide "name", "defaultDurationSeconds", or both.' },
      { status: 400 }
    );
  }

  if (wantsDuration && !isValidDefaultDuration(body.defaultDurationSeconds)) {
    return NextResponse.json(
      {
        error:
          `"defaultDurationSeconds" must be a whole number of seconds between ` +
          `${MIN_DURATION_SECONDS} and ${MAX_DURATION_SECONDS}.`,
      },
      { status: 400 }
    );
  }

  if (wantsRename) {
    // An explicit null clears the name; anything unusable is rejected rather
    // than quietly ignored.
    const cleared = body.name === null || body.name === "";
    const name = cleared ? null : normalizeRoomName(body.name);
    if (!cleared && name === null) {
      return NextResponse.json(
        { error: '"name" must be a non-empty string, or null to clear it.' },
        { status: 400 }
      );
    }
    if (!(await renameRoom(slug, name))) return gone();
  }

  if (wantsDuration) {
    const applied = await setRoomDefaultDuration(
      slug,
      body.defaultDurationSeconds as number
    );
    if (!applied) return gone();
  }

  const view = await loadRoomView(slug);
  return view ? NextResponse.json(view, { status: 200 }) : gone();
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  if (!isPlausibleRoomSlug(slug)) return badSlug();
  if (!(await verifyOwnerKey(slug, ownerKeyFrom(request)))) return notOwner();

  // Closing is not deleting. The row stays, so the calls and events that
  // reference it keep their history, and a later visitor is told the room is
  // over rather than that it never existed.
  const { sessionId } = sessionFromRequest(request);
  const trafficClass =
    trustedTrafficClassFromRequest(request) ?? trafficClassFromRequest(request);
  await closeRoom(slug, { sessionId, trafficClass });
  const response = NextResponse.json({ closed: true }, { status: 200 });
  setSessionCookie(response, sessionId);
  return response;
}
