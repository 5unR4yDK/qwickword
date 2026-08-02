import { NextRequest, NextResponse } from "next/server";
import { pruneExpiredDiagnostics } from "@/lib/db";
import { pruneExpiredIdentityData } from "@/lib/identity";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (!cronSecret) {
    console.error("[Qwickword] CRON_SECRET is not configured.");
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }
  if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const [deleted, identity] = await Promise.all([
      pruneExpiredDiagnostics(),
      pruneExpiredIdentityData(),
    ]);
    return NextResponse.json({ ok: true, deleted, identity }, { status: 200 });
  } catch (err) {
    console.error("[Qwickword] Diagnostic retention run failed:", err);
    return NextResponse.json({ error: "retention_failed" }, { status: 500 });
  }
}
