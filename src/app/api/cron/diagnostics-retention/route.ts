import { NextRequest, NextResponse } from "next/server";
import { pruneExpiredDiagnostics } from "@/lib/db";

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
    const deleted = await pruneExpiredDiagnostics();
    return NextResponse.json({ ok: true, deleted }, { status: 200 });
  } catch (err) {
    console.error("[Qwickword] Diagnostic retention run failed:", err);
    return NextResponse.json({ error: "retention_failed" }, { status: 500 });
  }
}
