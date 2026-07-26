import { NextRequest, NextResponse } from "next/server";
import { recordCallEnded, type CallEndReason } from "@/lib/db";

/**
 * Stats-only endpoint: records that a call finished, and why. It does not
 * end anything — Daily's room `exp` is the hard stop and stays the single
 * source of truth, exactly as with the countdown itself.
 *
 * Unauthenticated, matching the rest of this stateless app: whoever has the
 * room name can act on it, same as joining the call. The blast radius is a
 * stats row, and `recordCallEnded` only ever writes the first report for a
 * given call, so a replayed or forged request cannot rewrite a real outcome.
 *
 * Every connected tab calls this independently and more than once is
 * harmless — see the COALESCE note on `recordCallEnded`.
 */
export const dynamic = "force-dynamic";

type EndBody = { reason?: unknown };

const VALID_REASONS: readonly CallEndReason[] = ["completed", "left_early"];

function isValidReason(value: unknown): value is CallEndReason {
  return (
    typeof value === "string" &&
    (VALID_REASONS as readonly string[]).includes(value)
  );
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ room: string }> }
) {
  const { room } = await params;

  // sendBeacon posts a Blob with no useful content-type, so tolerate a
  // missing or unparseable body rather than 400-ing a best-effort ping.
  let body: EndBody = {};
  try {
    body = (await request.json()) as EndBody;
  } catch {
    // fall through to the reason check below
  }

  if (!isValidReason(body.reason)) {
    return NextResponse.json(
      { error: `"reason" must be one of: ${VALID_REASONS.join(", ")}.` },
      { status: 400 }
    );
  }

  await recordCallEnded(room, body.reason);
  return NextResponse.json({ ok: true }, { status: 200 });
}
