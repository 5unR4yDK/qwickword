import { monotonicNowMs, type ServerClockAnchor } from "./server-clock";

export const DIAGNOSTIC_EVENT_NAMES = [
  "call.opened",
  "media.join_requested",
  "media.joined",
  "countdown.start_requested",
  "countdown.sync_applied",
  "countdown.sync_changed",
  "countdown.local_zero",
  "transport.reconnecting",
  "transport.recovered",
  "transport.left",
  "app.backgrounded",
  "app.foregrounded",
  "call.end_requested",
  "call.teardown_completed",
  "call.failed",
  "problem_report.requested",
] as const;

export type DiagnosticEventName = (typeof DIAGNOSTIC_EVENT_NAMES)[number];

export const DIAGNOSTIC_END_TRIGGERS = [
  "server_deadline",
  "provider_eject",
  "manual_leave",
  "remote_end",
  "transport_failure",
  "fatal_error",
  "abandoned_before_start",
  "unknown",
] as const;

export type DiagnosticEndTrigger = (typeof DIAGNOSTIC_END_TRIGGERS)[number];

export type DiagnosticDetails = {
  appVersion?: string;
  serverReceivedAtMs?: number;
  serverNowMs?: number;
  rttMs?: number;
  serverProcessingMs?: number;
  clockOffsetMs?: number;
  authoritativeExpMs?: number;
  phase?: string;
  source?: string;
  participantCount?: number;
  endTrigger?: DiagnosticEndTrigger;
  errorCategory?: string;
};

export type CallDiagnosticEvent = DiagnosticDetails & {
  schemaVersion: 1;
  eventId: string;
  room: string;
  clientCallSessionId: string;
  sequence: number;
  eventName: DiagnosticEventName;
  surface: "web";
  clientWallTimeMs: number;
  clientMonotonicMs: number;
};

export type DiagnosticSink = (event: CallDiagnosticEvent) => void;

function randomId(): string {
  return globalThis.crypto.randomUUID();
}

export class CallDiagnostics {
  private sequence = 0;
  private readonly clientCallSessionId: string;

  constructor(
    private readonly room: string,
    private readonly sink: DiagnosticSink,
    private readonly appVersion: string = "development",
    private readonly wallNow: () => number = Date.now,
    private readonly monotonicNow: () => number = monotonicNowMs,
    idFactory: () => string = randomId
  ) {
    this.clientCallSessionId = idFactory();
  }

  get sessionId(): string {
    return this.clientCallSessionId;
  }

  record(eventName: DiagnosticEventName, details: DiagnosticDetails = {}): void {
    try {
      this.sink({
        schemaVersion: 1,
        eventId: randomId(),
        room: this.room,
        clientCallSessionId: this.clientCallSessionId,
        sequence: this.sequence++,
        eventName,
        surface: "web",
        appVersion: this.appVersion,
        clientWallTimeMs: this.wallNow(),
        clientMonotonicMs: this.monotonicNow(),
        ...details,
      });
    } catch {
      // Diagnostics must never escape into call control.
    }
  }

  recordClockSync(
    eventName: "countdown.sync_applied" | "countdown.sync_changed",
    anchor: ServerClockAnchor,
    details: Pick<DiagnosticDetails, "phase" | "source" | "participantCount"> & {
      serverReceivedAtMs: number;
      serverNowMs: number;
    }
  ): void {
    this.record(eventName, {
      ...details,
      rttMs: anchor.rttMs,
      serverProcessingMs: anchor.serverProcessingMs,
      clockOffsetMs: anchor.clockOffsetMs,
      authoritativeExpMs: anchor.authoritativeExpMs,
    });
  }
}

export type HttpDiagnosticSink = DiagnosticSink & {
  flush: () => void;
  discard: () => void;
};

export function createHttpDiagnosticSink(options: {
  endpoint: string;
  maxBatch?: number;
  flushAfterMs?: number;
}): HttpDiagnosticSink {
  const maxBatch = options.maxBatch ?? 20;
  const flushAfterMs = options.flushAfterMs ?? 5000;
  let batch: CallDiagnosticEvent[] = [];
  let scheduled: ReturnType<typeof setTimeout> | null = null;

  const flush = () => {
    if (scheduled !== null) {
      clearTimeout(scheduled);
      scheduled = null;
    }
    if (batch.length === 0) return;
    const events = batch;
    batch = [];
    void fetch(options.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ events }),
      keepalive: true,
    }).catch(() => {
      // No retry loop. A weak connection must not be made worse by its own
      // diagnostic traffic.
    });
  };

  const sink = ((event: CallDiagnosticEvent) => {
    batch.push(event);
    if (batch.length >= maxBatch) {
      flush();
      return;
    }
    if (scheduled === null) scheduled = setTimeout(flush, flushAfterMs);
  }) as HttpDiagnosticSink;

  sink.flush = flush;
  sink.discard = () => {
    if (scheduled !== null) clearTimeout(scheduled);
    scheduled = null;
    batch = [];
  };
  return sink;
}
