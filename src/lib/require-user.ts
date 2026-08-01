// Resolving the caller for routes that genuinely need an account.
//
// Deliberately small, and deliberately not middleware. Only a handful of routes
// need a user — contacts and call participation — and everything else in this
// product must keep working for someone with no account at all. A global auth
// layer would make "signed in" the default and guest access the exception,
// which is backwards for a product whose whole claim is that a stranger can be
// talking in one tap.
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { userForToken, type User } from "./identity";

export function bearerToken(request: NextRequest): string | null {
  const header = request.headers.get("authorization");
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match ? match[1] : null;
}

/** The signed-in caller, or null. */
export async function callerFrom(request: NextRequest): Promise<User | null> {
  return userForToken(bearerToken(request));
}

/** The 401 used by every route that needs an account. One wording, no detail. */
export function signInRequired() {
  return NextResponse.json(
    { error: "Sign in to do that." },
    { status: 401 }
  );
}
