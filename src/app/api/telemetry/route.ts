import { NextRequest, NextResponse } from "next/server";
import { recordTimings, type TimingInput } from "@/lib/db";

/**
 * Reliability timing ingest.
 *
 * Stats only, and deliberately dumb: it validates shape, drops anything
 * implausible, and never tells a client that a measurement failed. A client
 * that retries telemetry on a bad network makes the very problem it is trying
 * to measure worse.
 *
 * Unauthenticated, same trust model as the rest of this stateless app. The
 * blast radius is a row in a stats table; bounds below stop it being a way to
 * write unbounded data.
 */
export const dynamic = "force-dynamic";

const METRICS = ["join_to_audio", "prejoin_to_join", "reconnect", "teardown"] as const;
const MAX_BATCH = 50;
const MAX_MS = 10 * 60 * 1000;

type Incoming = { timings?: unknown };

function valid(raw: unknown): TimingInput | null {
  if (typeof raw !== "object" || raw === null) return null;
  const t = raw as Record<string, unknown>;
  if (typeof t.callName !== "string" || t.callName.length === 0 || t.callName.length > 120) return null;
  if (typeof t.metric !== "string" || !(METRICS as readonly string[]).includes(t.metric)) return null;
  if (typeof t.ms !== "number" || !Number.isFinite(t.ms) || t.ms < 0 || t.ms > MAX_MS) return null;
  const surface = typeof t.surface === "string" ? t.surface.slice(0, 32) : "unknown";
  return { callName: t.callName, metric: t.metric, ms: Math.round(t.ms), surface };
}

export async function POST(request: NextRequest) {
  let body: Incoming = {};
  try {
    body = (await request.json()) as Incoming;
  } catch {
    // A malformed body is a dropped measurement, not an error worth surfacing.
    return NextResponse.json({ accepted: 0 }, { status: 200 });
  }

  const raw = Array.isArray(body.timings) ? body.timings.slice(0, MAX_BATCH) : [];
  const timings = raw.map(valid).filter((t): t is TimingInput => t !== null);
  if (timings.length > 0) await recordTimings(timings);

  return NextResponse.json({ accepted: timings.length }, { status: 200 });
}
