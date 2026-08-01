import { NextRequest, NextResponse } from "next/server";
import { revokeSession, userForToken } from "@/lib/identity";

/**
 * Who the caller is, and signing out.
 *
 * The token arrives as a bearer header rather than a cookie so the app and the
 * browser use the same contract. The browser client is free to keep it in a
 * cookie of its own; the server does not need to know which.
 *
 * GET returns 200 with `user: null` for an absent or dead session rather than
 * 401. Not being signed in is the normal state of this product, not an error —
 * every call still works without an account — and a 401 on the very first
 * request of every anonymous visit is noise in the logs and in the client.
 */
export const dynamic = "force-dynamic";

function tokenFrom(request: NextRequest): string | null {
  const header = request.headers.get("authorization");
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match ? match[1] : null;
}

export async function GET(request: NextRequest) {
  const user = await userForToken(tokenFrom(request));
  return NextResponse.json(
    { user: user ? { id: user.id, displayName: user.displayName } : null },
    { status: 200 }
  );
}

export async function DELETE(request: NextRequest) {
  const token = tokenFrom(request);
  // Idempotent: signing out twice, or with a token that is already dead, is a
  // success. The desired state is "not signed in on this device".
  if (token) await revokeSession(token);
  return NextResponse.json({ signedOut: true }, { status: 200 });
}
