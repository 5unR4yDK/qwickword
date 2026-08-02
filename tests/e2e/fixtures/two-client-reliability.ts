import {
  CallDiagnostics,
  type CallDiagnosticEvent,
} from "../../../src/lib/call-diagnostics";
import {
  initialCallState,
  reduceCallState,
  type CallState,
} from "../../../src/lib/call-state";
import { createAuthoritativeCountdownStarter } from "../../../src/lib/countdown-start";
import type { CountdownStartClaim } from "../../../src/lib/db";
import {
  createServerClockAnchor,
  remainingFromAnchor,
  serverNowFromAnchor,
  type ServerClockAnchor,
} from "../../../src/lib/server-clock";

const NETWORK_ONE_WAY_MS = 80;
const SERVER_PROCESSING_MS = 20;
const SYNC_ROUND_TRIP_MS = NETWORK_ONE_WAY_MS * 2 + SERVER_PROCESSING_MS;

type SyncEvent = "countdown.sync_applied" | "countdown.sync_changed";

export class SimulatedCallClient {
  readonly diagnosticEvents: CallDiagnosticEvent[] = [];
  state: CallState;
  monotonicMs = 0;
  wallSkewMs: number;
  private anchor: ServerClockAnchor | null = null;
  private readonly diagnostics: CallDiagnostics;

  constructor(options: {
    room: string;
    durationSeconds: number;
    serverEpochMs: number;
    wallSkewMs: number;
    sessionId: string;
  }) {
    this.wallSkewMs = options.wallSkewMs;
    this.state = initialCallState({ durationSeconds: options.durationSeconds });
    this.diagnostics = new CallDiagnostics(
      options.room,
      (event) => this.diagnosticEvents.push(event),
      "two-client-reliability-test",
      () => options.serverEpochMs + this.monotonicMs + this.wallSkewMs,
      () => this.monotonicMs,
      () => options.sessionId
    );
  }

  get sessionId(): string {
    return this.diagnostics.sessionId;
  }

  get clockOffsetMs(): number | null {
    return this.anchor?.clockOffsetMs ?? null;
  }

  get remainingMs(): number | null {
    return this.anchor
      ? remainingFromAnchor(this.anchor, this.monotonicMs)
      : null;
  }

  prepareAndJoin(): void {
    this.diagnostics.record("call.opened", { phase: this.state.phase });
    this.state = reduceCallState(this.state, { type: "PREPARE" });
    this.state = reduceCallState(this.state, { type: "MEDIA_READY" });
    this.diagnostics.record("media.join_requested", {
      phase: this.state.phase,
    });
    this.state = reduceCallState(this.state, { type: "JOIN" });
    this.state = reduceCallState(this.state, { type: "JOINED" });
    this.state = reduceCallState(this.state, {
      type: "PARTICIPANT_COUNT",
      count: 2,
    });
    this.diagnostics.record("media.joined", {
      phase: this.state.phase,
      participantCount: 2,
    });
  }

  requestCountdown(): void {
    this.state = reduceCallState(this.state, { type: "COUNTDOWN_STARTING" });
    this.diagnostics.record("countdown.start_requested", {
      phase: this.state.phase,
      participantCount: 2,
      source: "second_participant",
    });
  }

  applyCountdown(expiryMs: number): void {
    this.state = reduceCallState(this.state, {
      type: "COUNTDOWN_STARTED",
      expiresAt: expiryMs,
    });
  }

  sync(options: {
    eventName: SyncEvent;
    expirySeconds: number;
    serverAtRequestMs: number;
    source: string;
  }): number {
    const requestStartedMonotonicMs = this.monotonicMs;
    const responseReceivedMonotonicMs =
      requestStartedMonotonicMs + SYNC_ROUND_TRIP_MS;
    const serverReceivedAtMs =
      options.serverAtRequestMs + NETWORK_ONE_WAY_MS;
    const serverNowMs = serverReceivedAtMs + SERVER_PROCESSING_MS;
    const clientWallAtReceiptMs =
      options.serverAtRequestMs +
      SYNC_ROUND_TRIP_MS +
      this.wallSkewMs;
    const anchor = createServerClockAnchor(
      {
        exp: options.expirySeconds,
        serverReceivedAtMs,
        serverNowMs,
      },
      {
        requestStartedMonotonicMs,
        responseReceivedMonotonicMs,
        clientWallAtReceiptMs,
      }
    );
    if (!anchor) throw new Error("The deterministic server sample was rejected.");

    this.monotonicMs = responseReceivedMonotonicMs;
    this.anchor = anchor;
    this.diagnostics.recordClockSync(options.eventName, anchor, {
      phase: this.state.phase,
      source: options.source,
      participantCount: this.state.participantCount,
      serverReceivedAtMs,
      serverNowMs,
    });
    return SYNC_ROUND_TRIP_MS;
  }

  advance(ms: number): void {
    this.monotonicMs += ms;
  }

  background(): void {
    this.diagnostics.record("app.backgrounded", { phase: this.state.phase });
    this.state = reduceCallState(this.state, { type: "TRANSPORT_LOST" });
    this.diagnostics.record("transport.reconnecting", {
      phase: this.state.phase,
    });
  }

  foreground(): void {
    this.diagnostics.record("app.foregrounded", { phase: this.state.phase });
  }

  recoverTransport(): void {
    if (!this.anchor) throw new Error("Cannot recover before a server sync.");
    this.state = reduceCallState(this.state, {
      type: "TRANSPORT_RECOVERED",
      at: serverNowFromAnchor(this.anchor, this.monotonicMs),
    });
    this.diagnostics.record("transport.recovered", {
      phase: this.state.phase,
    });
    if (this.state.phase === "ending") {
      this.recordDeadlineEnd("foreground_resync");
    }
  }

  finishAtDeadline(): void {
    if (this.remainingMs !== 0) {
      throw new Error("Cannot finish a client before its authoritative deadline.");
    }
    this.state = reduceCallState(this.state, { type: "EXPIRED" });
    this.recordDeadlineEnd("monotonic_deadline");
  }

  completeTeardown(): void {
    this.state = reduceCallState(this.state, { type: "TEARDOWN_COMPLETE" });
    this.diagnostics.record("call.teardown_completed", {
      phase: this.state.phase,
      endTrigger: "server_deadline",
    });
  }

  private recordDeadlineEnd(source: string): void {
    this.diagnostics.record("countdown.local_zero", {
      phase: this.state.phase,
      source,
      authoritativeExpMs: this.state.expiresAt ?? undefined,
    });
    this.diagnostics.record("call.end_requested", {
      phase: this.state.phase,
      endTrigger: "server_deadline",
    });
  }
}

export class TwoClientReliabilityHarness {
  readonly clients: readonly [SimulatedCallClient, SimulatedCallClient];
  readonly durationSeconds: number;
  readonly room: string;
  readonly serverEpochMs: number;
  serverElapsedMs = 0;
  providerStartCount = 0;
  expirySeconds: number | null = null;

  constructor(options?: {
    durationSeconds?: number;
    room?: string;
    serverEpochMs?: number;
    wallSkewsMs?: readonly [number, number];
  }) {
    this.durationSeconds = options?.durationSeconds ?? 60;
    this.room = options?.room ?? "reliability-test";
    this.serverEpochMs = options?.serverEpochMs ?? 2_000_000_000_000;
    const wallSkewsMs = options?.wallSkewsMs ?? [6 * 60 * 60_000, -4 * 60 * 60_000];
    this.clients = [
      new SimulatedCallClient({
        room: this.room,
        durationSeconds: this.durationSeconds,
        serverEpochMs: this.serverEpochMs,
        wallSkewMs: wallSkewsMs[0],
        sessionId: "11111111-1111-4111-8111-111111111111",
      }),
      new SimulatedCallClient({
        room: this.room,
        durationSeconds: this.durationSeconds,
        serverEpochMs: this.serverEpochMs,
        wallSkewMs: wallSkewsMs[1],
        sessionId: "22222222-2222-4222-8222-222222222222",
      }),
    ];
  }

  async start(): Promise<number> {
    for (const client of this.clients) {
      client.prepareAndJoin();
      client.requestCountdown();
    }

    let activeAttempt: string | null = null;
    let persistedExp: number | null = null;
    let nextAttempt = 0;
    let releaseProvider!: () => void;
    const providerGate = new Promise<void>((resolve) => {
      releaseProvider = resolve;
    });
    const acceptedExpiry =
      (this.serverEpochMs + this.durationSeconds * 1000) / 1000;
    const starter = createAuthoritativeCountdownStarter({
      claim: async ({ attemptId }): Promise<CountdownStartClaim> => {
        if (persistedExp !== null) return { kind: "started", exp: persistedExp };
        if (activeAttempt !== null) return { kind: "pending" };
        activeAttempt = attemptId;
        return { kind: "winner", attemptId };
      },
      read: async () => ({ exp: persistedExp, pending: activeAttempt !== null }),
      complete: async ({ attemptId, exp }) => {
        if (attemptId !== activeAttempt) throw new Error("Wrong winning attempt.");
        persistedExp = exp;
        activeAttempt = null;
      },
      fail: async () => {
        activeAttempt = null;
      },
      startProvider: async () => {
        this.providerStartCount += 1;
        await providerGate;
        return { exp: acceptedExpiry, started: true };
      },
      attemptId: () =>
        `00000000-0000-4000-8000-${String(nextAttempt++).padStart(12, "0")}`,
      wait: () => new Promise((resolve) => setTimeout(resolve, 0)),
      pendingDelaysMs: [0, 0, 0],
    });

    const firstStart = starter(
      this.room,
      this.durationSeconds,
      "second_participant"
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
    const secondStart = starter(
      this.room,
      this.durationSeconds,
      "second_participant"
    );
    releaseProvider();
    const [firstStatus, secondStatus] = await Promise.all([
      firstStart,
      secondStart,
    ]);
    if (firstStatus.exp !== secondStatus.exp) {
      throw new Error("The clients received different provider deadlines.");
    }

    this.expirySeconds = firstStatus.exp;
    const expiryMs = firstStatus.exp * 1000;
    for (const client of this.clients) client.applyCountdown(expiryMs);
    this.syncClient(this.clients[0], "countdown.sync_applied", "start_response");
    this.syncClient(this.clients[1], "countdown.sync_applied", "start_response");
    return expiryMs;
  }

  advanceTo(serverElapsedMs: number): void {
    if (serverElapsedMs < this.serverElapsedMs) {
      throw new Error("The reliability harness cannot move backwards in time.");
    }
    const delta = serverElapsedMs - this.serverElapsedMs;
    for (const client of this.clients) client.advance(delta);
    this.serverElapsedMs = serverElapsedMs;
  }

  resyncClient(client: SimulatedCallClient, source: string): void {
    this.syncClient(client, "countdown.sync_changed", source);
  }

  private syncClient(
    client: SimulatedCallClient,
    eventName: SyncEvent,
    source: string
  ): void {
    if (this.expirySeconds === null) {
      throw new Error("Cannot synchronize before the countdown starts.");
    }
    const elapsed = client.sync({
      eventName,
      expirySeconds: this.expirySeconds,
      serverAtRequestMs: this.serverEpochMs + this.serverElapsedMs,
      source,
    });
    for (const peer of this.clients) {
      if (peer !== client) peer.advance(elapsed);
    }
    this.serverElapsedMs += elapsed;
  }
}
