import { NextRequest, NextResponse } from "next/server";
import { keepContact, listContacts } from "@/lib/contacts";
import { callerFrom, signInRequired } from "@/lib/require-user";

/**
 * The caller's contact list.
 *
 * Keeping someone is private: it does not notify them, does not put you on
 * their list, and is not visible to them. `mutual` is derived when both sides
 * happen to have kept each other, which is why there is no request to accept
 * and no pending state to sit in.
 *
 * You may only keep someone you have shared a call with. That is enforced in
 * `keepContact`, and it is what stops this being a way to attach yourself to an
 * arbitrary user id.
 */
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const user = await callerFrom(request);
  if (!user) return signInRequired();
  return NextResponse.json(
    { contacts: await listContacts(user.id) },
    { status: 200 }
  );
}

type KeepBody = { userId?: unknown; displayName?: unknown };

export async function POST(request: NextRequest) {
  const user = await callerFrom(request);
  if (!user) return signInRequired();

  let body: KeepBody;
  try {
    body = (await request.json()) as KeepBody;
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON." },
      { status: 400 }
    );
  }

  const userId = typeof body.userId === "string" ? body.userId : "";
  if (!/^[0-9a-f-]{36}$/i.test(userId)) {
    return NextResponse.json({ error: "Invalid person." }, { status: 400 });
  }

  const displayName =
    typeof body.displayName === "string" && body.displayName.trim()
      ? body.displayName.trim().slice(0, 60)
      : null;

  const kept = await keepContact(user.id, userId, displayName);
  if (!kept) {
    // One answer for "no such person", "that is you", and "you have never
    // called them". Separating them would turn this into a way to test
    // whether a user id exists.
    return NextResponse.json(
      { error: "You can only keep people you've had a Qwickword with." },
      { status: 403 }
    );
  }

  return NextResponse.json(
    { contacts: await listContacts(user.id) },
    { status: 201 }
  );
}
