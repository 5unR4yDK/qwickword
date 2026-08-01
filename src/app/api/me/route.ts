import { NextRequest, NextResponse } from "next/server";
import { revokeSession } from "@/lib/identity";
import {
  bearerToken,
  callerFrom,
  clearSessionCookie,
  SESSION_COOKIE,
} from "@/lib/require-user";

/**
 * Who the caller is, and signing out.
 *
 * The session travels as a bearer header from the app and as an HttpOnly
 * cookie in a browser — the same credential, carried the way each surface can
 * hold it safely. Neither has to declare which it is.
 *
 * GET returns 200 with `user: null` for an absent or dead session rather than
 * 401. Not being signed in is the normal state of this product, not an error —
 * every call still works without an account — and a 401 on the first request
 * of every anonymous visit is noise in the logs and in the client.
 */
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const user = await callerFrom(request);
  const response = NextResponse.json(
    { user: user ? { id: user.id, displayName: user.displayName } : null },
    { status: 200 }
  );
  // A cookie that no longer resolves is worse than no cookie: it makes every
  // later request look signed in until one of them fails.
  if (!user && request.cookies.get(SESSION_COOKIE)) {
    clearSessionCookie(response);
  }
  return response;
}

export async function DELETE(request: NextRequest) {
  const token =
    bearerToken(request) ?? request.cookies.get(SESSION_COOKIE)?.value ?? null;
  // Idempotent: signing out twice, or with a token that is already dead, is a
  // success. The desired state is "not signed in on this device".
  if (token) await revokeSession(token);
  const response = NextResponse.json({ signedOut: true }, { status: 200 });
  clearSessionCookie(response);
  return response;
}
