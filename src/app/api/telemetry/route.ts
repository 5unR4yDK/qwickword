import { NextRequest, NextResponse } from "next/server";
import {
  recordDiagnosticEvents,
  recordTimings,
  type DiagnosticEventInput,
  type TimingInput,
} from "@/lib/db";
import {
  DIAGNOSTIC_END_TRIGGERS,
  DIAGNOSTIC_EVENT_NAMES,
} from "@/lib/call-diagnostics";

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

const METRICS = ["join_to_audio", "reconnect", "teardown"] as const;
const MAX_BATCH = 50;
const MAX_MS = 10 * 60 * 1000;

type Incoming = { timings?: unknown; events?: unknown };

function valid(raw: unknown): TimingInput | null {
  if (typeof raw !== "object" || raw === null) return null;
  const t = raw as Record<string, unknown>;
  if (typeof t.callName !== "string" || t.callName.length === 0 || t.callName.length > 120) return null;
  if (typeof t.metric !== "string" || !(METRICS as readonly string[]).includes(t.metric)) return null;
  if (typeof t.ms !== "number" || !Number.isFinite(t.ms) || t.ms < 0 || t.ms > MAX_MS) return null;
  const surface = typeof t.surface === "string" ? t.surface.slice(0, 32) : "unknown";
  return { callName: t.callName, metric: t.metric, ms: Math.round(t.ms), surface };
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ROOM_PATTERN = /^[a-zA-Z0-9_-]{1,80}$/;
const PHASES = [
  "idle",
  "preparing",
  "ready",
  "joining",
  "waiting",
  "live",
  "reconnecting",
  "ending",
  "ended",
  "failed",
] as const;
const SOURCES = [
  "initial_render",
  "start_response",
  "status_poll",
  "foreground",
  "reconnect",
  "second_participant",
  "manual_start",
  "status_backstop",
  "provider_event",
  "unknown",
] as const;
const MIN_PLAUSIBLE_EPOCH_MS = 946_684_800_000; // 2000-01-01
const MAX_PLAUSIBLE_EPOCH_MS = 4_102_444_800_000; // 2100-01-01

function optionalString(raw: unknown, max: number): string | null {
  return typeof raw === "string" && raw.length > 0 && raw.length <= max
    ? raw
    : null;
}

function optionalNumber(
  raw: unknown,
  min: number,
  max: number,
  integer = true
): number | null {
  if (
    typeof raw !== "number" ||
    !Number.isFinite(raw) ||
    raw < min ||
    raw > max ||
    (integer && !Number.isInteger(raw))
  ) {
    return null;
  }
  return raw;
}

function validDiagnostic(raw: unknown): DiagnosticEventInput | null {
  if (typeof raw !== "object" || raw === null) return null;
  const event = raw as Record<string, unknown>;
  if (event.schemaVersion !== 1) return null;
  if (typeof event.eventId !== "string" || !UUID_PATTERN.test(event.eventId)) return null;
  if (typeof event.room !== "string" || !ROOM_PATTERN.test(event.room)) return null;
  if (
    typeof event.clientCallSessionId !== "string" ||
    !UUID_PATTERN.test(event.clientCallSessionId)
  ) return null;
  if (
    typeof event.sequence !== "number" ||
    !Number.isInteger(event.sequence) ||
    event.sequence < 0 ||
    event.sequence > 100_000
  ) return null;
  if (
    typeof event.eventName !== "string" ||
    !(DIAGNOSTIC_EVENT_NAMES as readonly string[]).includes(event.eventName)
  ) return null;
  if (event.surface !== "web" && event.surface !== "ios") return null;

  const clientWallTimeMs = optionalNumber(
    event.clientWallTimeMs,
    MIN_PLAUSIBLE_EPOCH_MS,
    MAX_PLAUSIBLE_EPOCH_MS
  );
  const clientMonotonicMs = optionalNumber(
    event.clientMonotonicMs,
    0,
    1_000_000_000_000,
    false
  );
  if (clientWallTimeMs === null || clientMonotonicMs === null) return null;

  const phase = optionalString(event.phase, 32);
  if (phase !== null && !(PHASES as readonly string[]).includes(phase)) return null;
  const source = optionalString(event.source, 32);
  if (source !== null && !(SOURCES as readonly string[]).includes(source)) return null;
  const endTrigger = optionalString(event.endTrigger, 32);
  if (
    endTrigger !== null &&
    !(DIAGNOSTIC_END_TRIGGERS as readonly string[]).includes(endTrigger)
  ) return null;
  const errorCategory = optionalString(event.errorCategory, 48);
  if (errorCategory !== null && !/^[a-z0-9_.-]+$/i.test(errorCategory)) return null;

  return {
    eventId: event.eventId,
    room: event.room,
    clientCallSessionId: event.clientCallSessionId,
    sequence: event.sequence,
    eventName: event.eventName,
    surface: event.surface,
    appVersion: optionalString(event.appVersion, 64),
    clientWallTimeMs,
    clientMonotonicMs,
    serverReceivedAtMs: optionalNumber(
      event.serverReceivedAtMs,
      MIN_PLAUSIBLE_EPOCH_MS,
      MAX_PLAUSIBLE_EPOCH_MS
    ),
    serverNowMs: optionalNumber(
      event.serverNowMs,
      MIN_PLAUSIBLE_EPOCH_MS,
      MAX_PLAUSIBLE_EPOCH_MS
    ),
    rttMs: optionalNumber(event.rttMs, 0, MAX_MS),
    serverProcessingMs: optionalNumber(event.serverProcessingMs, 0, MAX_MS),
    clockOffsetMs: optionalNumber(
      event.clockOffsetMs,
      -365 * 24 * 60 * 60 * 1000,
      365 * 24 * 60 * 60 * 1000
    ),
    authoritativeExpMs: optionalNumber(
      event.authoritativeExpMs,
      MIN_PLAUSIBLE_EPOCH_MS,
      MAX_PLAUSIBLE_EPOCH_MS
    ),
    phase,
    source,
    participantCount: optionalNumber(event.participantCount, 0, 10),
    endTrigger,
    errorCategory,
  };
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
  const rawEvents = Array.isArray(body.events)
    ? body.events.slice(0, MAX_BATCH)
    : [];
  const events = rawEvents
    .map(validDiagnostic)
    .filter((event): event is DiagnosticEventInput => event !== null);
  if (timings.length > 0) await recordTimings(timings);
  if (events.length > 0) await recordDiagnosticEvents(events);

  return NextResponse.json(
    {
      accepted: timings.length + events.length,
      timingsAccepted: timings.length,
      eventsAccepted: events.length,
    },
    { status: 200 }
  );
}
