import { NextRequest, NextResponse } from "next/server";
import { verifyChallenge } from "@/lib/identity";
import { usesBrowserCookieTransport } from "@/lib/identity-core";
import { setSessionCookie } from "@/lib/require-user";

/**
 * Completes a sign-in.
 *
 * A correct code here both creates the account (if it is the first time) and
 * issues a session, which is what makes "sign in" and "sign up" one action.
 * There is no separate registration flow to build, explain, or get stuck in.
 *
 * The iPhone receives the session token for Keychain storage. The first-party
 * browser receives only its HttpOnly cookie; browser JavaScript never sees the
 * bearer credential.
 */
export const dynamic = "force-dynamic";

type Body = { code?: unknown; deviceLabel?: unknown };

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON." },
      { status: 400 }
    );
  }

  // Digits only, exactly six. Trimmed and stripped of the spaces people paste
  // in from an email, because rejecting "123 456" would be pedantry.
  const code =
    typeof body.code === "string" ? body.code.replace(/\s+/g, "") : "";
  if (!/^\d{6}$/.test(code)) {
    return NextResponse.json(
      { error: "That code doesn't look right. It's six digits." },
      { status: 400 }
    );
  }

  const deviceLabel =
    typeof body.deviceLabel === "string" && body.deviceLabel.trim()
      ? body.deviceLabel.trim().slice(0, 60)
      : null;

  const result = await verifyChallenge(id, code, deviceLabel);

  if (!result.ok) {
    switch (result.reason) {
      case "expired":
        return NextResponse.json(
          { error: "That code has expired. Ask for a new one." },
          { status: 410 }
        );
      case "too-many":
        return NextResponse.json(
          { error: "Too many attempts. Ask for a new code." },
          { status: 429 }
        );
      case "invalid":
        // Deliberately says nothing about how close it was, or whether the
        // challenge exists at all.
        return NextResponse.json(
          { error: "That code isn't right." },
          { status: 401 }
        );
      default:
        return NextResponse.json(
          { error: "Couldn't sign you in just now. Try again in a moment." },
          { status: 503 }
        );
    }
  }

  const browserCookieTransport = usesBrowserCookieTransport({
    secFetchSite: request.headers.get("sec-fetch-site"),
    origin: request.headers.get("origin"),
    requestOrigin: request.nextUrl.origin,
  });
  const response = NextResponse.json(
    {
      ...(browserCookieTransport ? {} : { token: result.token }),
      user: { id: result.user.id, displayName: result.user.displayName },
      isNew: result.isNew,
    },
    { status: 200 }
  );

  // The cookie is harmless to native clients and keeps one verification path.
  // Only native transport receives the body token above.
  setSessionCookie(response, result.token);
  return response;
}
