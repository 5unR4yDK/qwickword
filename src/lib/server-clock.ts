// Projects an authoritative server expiry onto a monotonic client clock.
//
// Device wall time is deliberately absent from all lifecycle arithmetic. It is
// accepted only as a diagnostic sample so a fast/slow device can be identified
// without being allowed to shorten or extend a Qwickword.

export type ServerTimePayload = {
  exp: number;
  serverReceivedAtMs: number;
  serverNowMs: number;
};

export type ClientTimeSample = {
  requestStartedMonotonicMs: number;
  responseReceivedMonotonicMs: number;
  clientWallAtReceiptMs: number;
};

export type ServerClockAnchor = {
  authoritativeExpMs: number;
  monotonicAtReceiptMs: number;
  estimatedServerAtReceiptMs: number;
  rttMs: number;
  serverProcessingMs: number;
  clockOffsetMs: number;
};

export function parseServerTimePayload(raw: unknown): ServerTimePayload | null {
  if (typeof raw !== "object" || raw === null) return null;
  const value = raw as Record<string, unknown>;
  if (
    typeof value.exp !== "number" ||
    typeof value.serverReceivedAtMs !== "number" ||
    typeof value.serverNowMs !== "number"
  ) {
    return null;
  }
  return {
    exp: value.exp,
    serverReceivedAtMs: value.serverReceivedAtMs,
    serverNowMs: value.serverNowMs,
  };
}

export function monotonicNowMs(): number {
  return globalThis.performance?.now?.() ?? Date.now();
}

function finite(value: number): boolean {
  return Number.isFinite(value);
}

export function createServerClockAnchor(
  payload: ServerTimePayload,
  sample: ClientTimeSample
): ServerClockAnchor | null {
  if (
    !finite(payload.exp) ||
    payload.exp <= 0 ||
    !finite(payload.serverReceivedAtMs) ||
    payload.serverReceivedAtMs <= 0 ||
    !finite(payload.serverNowMs) ||
    payload.serverNowMs < payload.serverReceivedAtMs ||
    !finite(sample.requestStartedMonotonicMs) ||
    !finite(sample.responseReceivedMonotonicMs) ||
    sample.responseReceivedMonotonicMs < sample.requestStartedMonotonicMs ||
    !finite(sample.clientWallAtReceiptMs)
  ) {
    return null;
  }

  const rttMs =
    sample.responseReceivedMonotonicMs - sample.requestStartedMonotonicMs;
  const serverProcessingMs = Math.max(
    0,
    payload.serverNowMs - payload.serverReceivedAtMs
  );
  const estimatedNetworkRttMs = Math.max(0, rttMs - serverProcessingMs);
  const estimatedServerAtReceiptMs =
    payload.serverNowMs + estimatedNetworkRttMs / 2;

  return {
    authoritativeExpMs: payload.exp * 1000,
    monotonicAtReceiptMs: sample.responseReceivedMonotonicMs,
    estimatedServerAtReceiptMs,
    rttMs,
    serverProcessingMs,
    clockOffsetMs: sample.clientWallAtReceiptMs - estimatedServerAtReceiptMs,
  };
}

/**
 * Initial server-rendered fallback. `remainingMs` was calculated on the
 * server, so this preserves a ticking, wall-clock-independent countdown while
 * the client performs its first live status synchronization.
 */
export function createInitialServerClockAnchor(
  authoritativeExpMs: number,
  remainingMs: number,
  monotonicAtReceiptMs: number
): ServerClockAnchor | null {
  if (
    !finite(authoritativeExpMs) ||
    authoritativeExpMs <= 0 ||
    !finite(remainingMs) ||
    !finite(monotonicAtReceiptMs)
  ) {
    return null;
  }
  const boundedRemainingMs = Math.max(0, remainingMs);
  return {
    authoritativeExpMs,
    monotonicAtReceiptMs,
    estimatedServerAtReceiptMs: authoritativeExpMs - boundedRemainingMs,
    rttMs: 0,
    serverProcessingMs: 0,
    clockOffsetMs: 0,
  };
}

export function serverNowFromAnchor(
  anchor: ServerClockAnchor,
  monotonicNow: number
): number {
  return (
    anchor.estimatedServerAtReceiptMs +
    Math.max(0, monotonicNow - anchor.monotonicAtReceiptMs)
  );
}

export function remainingFromAnchor(
  anchor: ServerClockAnchor,
  monotonicNow: number
): number {
  return Math.max(
    0,
    anchor.authoritativeExpMs - serverNowFromAnchor(anchor, monotonicNow)
  );
}
