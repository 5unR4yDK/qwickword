import { NextRequest, NextResponse } from "next/server";
import { isPlausibleRoomName } from "@/lib/daily-rooms";
import { peersInCall, recordParticipant } from "@/lib/contacts";
import { callerFrom, signInRequired } from "@/lib/require-user";

/**
 * Who was in a call, among people with accounts.
 *
 * POST records that the caller was there. GET lists the others — but only for
 * someone who was in that call themselves. Without that check, holding a call
 * slug would be enough to enumerate who had been in it, and call slugs travel
 * in links, so they are not secret.
 *
 * A guest is never recorded and never appears. Joining without an account
 * leaves no trace here, which is what keeps guest-first honest: turning up
 * costs nothing and is not quietly logged against a person.
 *
 * Both verbs need an account. A caller without one is not an error to be
 * fixed — it is the normal case for most of this product — so nothing else
 * depends on these routes.
 */
export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;
  if (!isPlausibleRoomName(name)) {
    return NextResponse.json({ error: "Invalid call name." }, { status: 400 });
  }

  const user = await callerFrom(request);
  if (!user) return signInRequired();

  await recordParticipant(name, user.id);
  return NextResponse.json({ recorded: true }, { status: 200 });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;
  if (!isPlausibleRoomName(name)) {
    return NextResponse.json({ error: "Invalid call name." }, { status: 400 });
  }

  const user = await callerFrom(request);
  if (!user) return signInRequired();

  // Empty for a call the caller was not in, which is the same answer as a call
  // where nobody else had an account. Deliberately indistinguishable.
  return NextResponse.json(
    { peers: await peersInCall(name, user.id) },
    { status: 200 }
  );
}
