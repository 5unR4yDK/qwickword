export type PushPlatform = "ios" | "android";

export type CallStartedPayload = {
  type: "call-started";
  callerName: string;
  room: string;
  durationSeconds: number;
  url: string;
};

/** Expo currently issues both spellings; accept no other opaque token shape. */
export function isExpoPushToken(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length <= 512 &&
    /^(Expo(nent)?PushToken)\[[A-Za-z0-9_-]+\]$/.test(value)
  );
}

export function isPushPlatform(value: unknown): value is PushPlatform {
  return value === "ios" || value === "android";
}

export function isUserId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value
    )
  );
}

export function isExpoPushReceiptId(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 200;
}

export type PushReceiptOutcome =
  | { status: "ok"; errorCode: null }
  | { status: "error"; errorCode: string | null };

export function pushReceiptOutcome(value: unknown): PushReceiptOutcome | null {
  if (typeof value !== "object" || value === null) return null;
  const receipt = value as {
    status?: unknown;
    details?: { error?: unknown };
  };
  if (receipt.status === "ok") return { status: "ok", errorCode: null };
  if (receipt.status !== "error") return null;
  return {
    status: "error",
    errorCode:
      typeof receipt.details?.error === "string"
        ? receipt.details.error.slice(0, 100)
        : null,
  };
}

/**
 * The complete actionable payload. It deliberately contains no identity
 * address, contact label, analytics id, or owner credential.
 */
export function callStartedPayload(input: {
  callerName: string;
  room: string;
  durationSeconds: number;
}): CallStartedPayload {
  const callerName = input.callerName.trim().slice(0, 80);
  return {
    type: "call-started",
    callerName,
    room: input.room,
    durationSeconds: input.durationSeconds,
    url: `https://qwickword.com/${encodeURIComponent(input.room)}`,
  };
}

export function callStartedMessage(input: {
  to: string;
  callerName: string;
  room: string;
  durationSeconds: number;
}) {
  const data = callStartedPayload(input);
  const duration =
    input.durationSeconds > 0 && input.durationSeconds % 60 === 0
      ? `${input.durationSeconds / 60} min`
      : `${input.durationSeconds}s`;
  return {
    to: input.to,
    sound: "default" as const,
    channelId: "qwickword-calls",
    priority: "high" as const,
    ttl: input.durationSeconds,
    collapseId: input.room,
    tag: input.room,
    title: `${data.callerName} is starting a Qwickword`,
    body: `${duration} · tap to join`,
    data,
  };
}
