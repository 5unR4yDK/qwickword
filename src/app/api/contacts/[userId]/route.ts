import { NextRequest, NextResponse } from "next/server";
import { forgetContact, listContacts } from "@/lib/contacts";
import { callerFrom, signInRequired } from "@/lib/require-user";

/**
 * Forgets one contact.
 *
 * Removes them from the caller's list only. Their own list is untouched and
 * they are not told — the same asymmetry that makes keeping someone private
 * makes dropping them private too.
 *
 * Idempotent: forgetting someone who was never kept is a success, because the
 * desired state is "not in my list".
 */
export const dynamic = "force-dynamic";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const user = await callerFrom(request);
  if (!user) return signInRequired();

  const { userId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(userId)) {
    return NextResponse.json({ error: "Invalid person." }, { status: 400 });
  }

  await forgetContact(user.id, userId);
  return NextResponse.json(
    { contacts: await listContacts(user.id) },
    { status: 200 }
  );
}
