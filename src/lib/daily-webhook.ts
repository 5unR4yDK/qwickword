import { createHmac, timingSafeEqual } from "node:crypto";

export const DAILY_LIFECYCLE_EVENT_TYPES = [
  "participant.joined",
  "participant.left",
  "meeting.ended",
] as const;

export type DailyLifecycleEventType =
  (typeof DAILY_LIFECYCLE_EVENT_TYPES)[number];

export type NormalizedDailyLifecycleEvent = {
  providerEventId: string;
  eventType: DailyLifecycleEventType;
  room: string;
  providerTimestampMs: number;
  providerSessionId: string | null;
  joinedAtMs: number | null;
  leftAtMs: number | null;
  durationSeconds: number | null;
  scheduledEjectAtMs: number | null;
  meetingStartedAtMs: number | null;
  meetingEndedAtMs: number | null;
};

const ROOM_PATTERN = /^[a-zA-Z0-9_-]{1,80}$/;
const MAX_EVENT_ID_LENGTH = 200;
const MAX_SESSION_ID_LENGTH = 200;

/** Domain-separated secret derivation keeps diagnostics keys single-purpose. */
export function deriveBase64HmacSecret(rootSecret: string, purpose: string): string {
  return createHmac("sha256", rootSecret).update(purpose).digest("base64");
}

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function epochMs(seconds: unknown): number | null {
  const value = finiteNumber(seconds);
  return value !== null && value > 0 ? Math.round(value * 1000) : null;
}

function boundedString(value: unknown, max: number): string | null {
  return typeof value === "string" && value.length > 0 && value.length <= max
    ? value
    : null;
}

export function normalizeDailyLifecycleEvent(
  raw: unknown
): NormalizedDailyLifecycleEvent | null {
  if (typeof raw !== "object" || raw === null) return null;
  const event = raw as Record<string, unknown>;
  const eventType = event.type;
  if (
    typeof eventType !== "string" ||
    !(DAILY_LIFECYCLE_EVENT_TYPES as readonly string[]).includes(eventType)
  ) {
    return null;
  }
  const providerEventId = boundedString(event.id, MAX_EVENT_ID_LENGTH);
  const providerTimestampMs = epochMs(event.event_ts);
  if (
    providerEventId === null ||
    providerTimestampMs === null ||
    typeof event.payload !== "object" ||
    event.payload === null
  ) {
    return null;
  }
  const payload = event.payload as Record<string, unknown>;
  const room = boundedString(payload.room, 80);
  if (room === null || !ROOM_PATTERN.test(room)) return null;

  if (eventType === "meeting.ended") {
    const meetingStartedAtMs = epochMs(payload.start_ts);
    const meetingEndedAtMs = epochMs(payload.end_ts);
    const meetingId = boundedString(payload.meeting_id, MAX_SESSION_ID_LENGTH);
    if (
      meetingStartedAtMs === null ||
      meetingEndedAtMs === null ||
      meetingEndedAtMs < meetingStartedAtMs ||
      meetingId === null
    ) {
      return null;
    }
    return {
      providerEventId,
      eventType,
      room,
      providerTimestampMs,
      providerSessionId: meetingId,
      joinedAtMs: null,
      leftAtMs: null,
      durationSeconds: (meetingEndedAtMs - meetingStartedAtMs) / 1000,
      scheduledEjectAtMs: null,
      meetingStartedAtMs,
      meetingEndedAtMs,
    };
  }

  const providerSessionId = boundedString(
    payload.session_id,
    MAX_SESSION_ID_LENGTH
  );
  const joinedAtMs = epochMs(payload.joined_at);
  if (providerSessionId === null || joinedAtMs === null) return null;
  const durationSeconds = finiteNumber(payload.duration);
  const normalizedDuration =
    durationSeconds !== null && durationSeconds >= 0
      ? durationSeconds
      : null;

  return {
    providerEventId,
    eventType: eventType as DailyLifecycleEventType,
    room,
    providerTimestampMs,
    providerSessionId,
    joinedAtMs,
    leftAtMs:
      eventType === "participant.left" && normalizedDuration !== null
        ? Math.round(joinedAtMs + normalizedDuration * 1000)
        : null,
    durationSeconds: normalizedDuration,
    scheduledEjectAtMs: epochMs(payload.will_eject_at),
    meetingStartedAtMs: null,
    meetingEndedAtMs: null,
  };
}

export function verifyDailyWebhookSignature(options: {
  event: unknown;
  timestamp: string | null;
  signature: string | null;
  base64Secret: string;
}): boolean {
  if (!options.timestamp || !options.signature) return false;
  let secret: Buffer;
  try {
    secret = Buffer.from(options.base64Secret, "base64");
  } catch {
    return false;
  }
  if (secret.length < 32) return false;
  const expected = createHmac("sha256", secret)
    .update(`${options.timestamp}.${JSON.stringify(options.event)}`)
    .digest();
  let received: Buffer;
  try {
    received = Buffer.from(options.signature, "base64");
  } catch {
    return false;
  }
  return received.length === expected.length && timingSafeEqual(received, expected);
}
