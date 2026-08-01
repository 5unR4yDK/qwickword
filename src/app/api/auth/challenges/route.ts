import { NextRequest, NextResponse } from "next/server";
import { normalizeEmail } from "@/lib/identity-core";
import { startChallenge } from "@/lib/identity";
import { getMailer } from "@/lib/mail";

/**
 * Asks for a sign-in code.
 *
 * The single most important property of this endpoint: **the response is
 * identical whether or not the address has an account.** No account is created
 * here and none is looked up, so there is no timing or wording difference to
 * read. Otherwise this becomes a way to ask "does this person use Qwickword",
 * which is exactly the question a login endpoint must refuse to answer.
 *
 * That is also why a rejected address and a rate-limited one are the only two
 * failures it distinguishes, and neither mentions an account.
 */
export const dynamic = "force-dynamic";

type Body = { email?: unknown };

export async function POST(request: NextRequest) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON." },
      { status: 400 }
    );
  }

  const email =
    typeof body.email === "string" ? normalizeEmail(body.email) : null;
  if (!email) {
    return NextResponse.json(
      { error: "Enter an email address." },
      { status: 400 }
    );
  }

  const mailer = getMailer();
  const result = await startChallenge("email", email, (to, code) =>
    mailer.sendCode(to, code)
  );

  if (!result.ok) {
    if (result.reason === "rate-limited") {
      const seconds = Math.ceil(result.retryAfterMs / 1000);
      return NextResponse.json(
        {
          error:
            seconds > 90
              ? "Too many codes requested for that address. Try again later."
              : `Wait ${seconds} seconds before asking for another code.`,
          retryAfterSeconds: seconds,
        },
        { status: 429, headers: { "Retry-After": String(seconds) } }
      );
    }
    return NextResponse.json(
      { error: "Couldn't send a code just now. Try again in a moment." },
      { status: 503 }
    );
  }

  // The challenge id is not a secret — it is useless without the code — so it
  // travels in the response rather than a cookie, which lets the same flow
  // work from the app and the browser without divergence.
  return NextResponse.json(
    { challengeId: result.challengeId, expiresAt: result.expiresAt },
    { status: 201 }
  );
}
