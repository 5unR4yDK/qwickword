import { NextRequest, NextResponse } from "next/server";
import {
  deriveBase64HmacSecret,
  normalizeDailyLifecycleEvent,
  verifyDailyWebhookSignature,
} from "@/lib/daily-webhook";
import { recordProviderLifecycleEvent } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_BODY_BYTES = 64 * 1024;

export async function POST(request: NextRequest) {
  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "payload_too_large" }, { status: 413 });
  }

  const rawBody = await request.text();
  if (Buffer.byteLength(rawBody, "utf8") > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "payload_too_large" }, { status: 413 });
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody) as unknown;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  // Daily verifies a new webhook URL with this harmless unsigned probe.
  if (
    typeof body === "object" &&
    body !== null &&
    (body as Record<string, unknown>).test === "test"
  ) {
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  const webhookSecret =
    process.env.DAILY_WEBHOOK_HMAC_SECRET?.trim() ||
    (process.env.DAILY_API_KEY
      ? deriveBase64HmacSecret(
          process.env.DAILY_API_KEY,
          "qwickword/daily-webhook/v1"
        )
      : "");
  const diagnosticsSecret =
    process.env.DIAGNOSTICS_HMAC_SECRET?.trim() ||
    (process.env.IDENTITY_HMAC_SECRET
      ? deriveBase64HmacSecret(
          process.env.IDENTITY_HMAC_SECRET,
          "qwickword/provider-diagnostics/v1"
        )
      : "");
  if (!webhookSecret || Buffer.from(diagnosticsSecret, "base64").length < 32) {
    console.error("[Qwickword] Daily webhook secrets are not configured.");
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }

  if (
    !verifyDailyWebhookSignature({
      event: body,
      timestamp: request.headers.get("x-webhook-timestamp"),
      signature: request.headers.get("x-webhook-signature"),
      base64Secret: webhookSecret,
    })
  ) {
    return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
  }

  const event = normalizeDailyLifecycleEvent(body);
  if (!event) {
    // A valid but irrelevant or newer event must not trip Daily's retry circuit.
    return NextResponse.json({ accepted: false }, { status: 200 });
  }

  const outcome = await recordProviderLifecycleEvent(event, diagnosticsSecret);
  if (outcome === "unavailable") {
    return NextResponse.json({ error: "temporarily_unavailable" }, { status: 503 });
  }
  return NextResponse.json(
    { accepted: outcome === "stored", duplicate: outcome === "duplicate" },
    { status: 200 }
  );
}
