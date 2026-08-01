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

/**
 * The browser's session cookie.
 *
 * The same credential the app keeps in the Keychain, carried differently. A
 * browser cannot hold a bearer token safely — anything JavaScript can read,
 * injected JavaScript can steal — so on the web it lives in an HttpOnly cookie
 * that scripts never see.
 */
export const SESSION_COOKIE = "qw_session_token";

export function bearerToken(request: NextRequest): string | null {
  const header = request.headers.get("authorization");
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match ? match[1] : null;
}

/**
 * The signed-in caller, or null.
 *
 * Accepts either transport. The header wins, because a native client sending
 * one is being explicit, and a stale cookie from the same browser session
 * should not override it.
 */
export async function callerFrom(request: NextRequest): Promise<User | null> {
  const token =
    bearerToken(request) ?? request.cookies.get(SESSION_COOKIE)?.value ?? null;
  return userForToken(token);
}

/** Thirty days. A session is per-device and revocable, so this can be long. */
const SESSION_MAX_AGE = 30 * 24 * 60 * 60;

export function setSessionCookie(response: NextResponse, token: string): void {
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    // `lax` rather than `strict`: someone following a Qwickword link from an
    // email should arrive already signed in, and this cookie authorises
    // nothing destructive on a GET.
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

export function clearSessionCookie(response: NextResponse): void {
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

/** The 401 used by every route that needs an account. One wording, no detail. */
export function signInRequired() {
  return NextResponse.json(
    { error: "Sign in to do that." },
    { status: 401 }
  );
}
