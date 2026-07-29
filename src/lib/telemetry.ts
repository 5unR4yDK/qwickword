// Client-side reliability timing for the production web call.
//
// Measurements are deliberately best-effort: they never block media, never
// retry, and never let a telemetry failure affect the call being measured.

export type ReliabilityMetric = "join_to_audio" | "reconnect" | "teardown";

export type Timing = {
  callName: string;
  metric: ReliabilityMetric;
  ms: number;
  surface: "web";
};

export type TimingSink = (timing: Timing) => void;

export class Timings {
  private readonly open = new Map<ReliabilityMetric, number>();
  private readonly callName: string;
  private readonly sink: TimingSink;
  private readonly now: () => number;

  constructor(callName: string, sink: TimingSink, now: () => number = Date.now) {
    this.callName = callName;
    this.sink = sink;
    this.now = now;
  }

  /** First start wins until the span ends or is cancelled. */
  start(metric: ReliabilityMetric): void {
    if (!this.open.has(metric)) this.open.set(metric, this.now());
  }

  cancel(metric: ReliabilityMetric): void {
    this.open.delete(metric);
  }

  end(metric: ReliabilityMetric): number | null {
    const startedAt = this.open.get(metric);
    if (startedAt === undefined) return null;
    this.open.delete(metric);

    const ms = this.now() - startedAt;
    // Backgrounded tabs can resume much later. Those are not useful network
    // timings and would poison the percentile, so discard them.
    if (ms < 0 || ms > 10 * 60 * 1000) return null;

    try {
      this.sink({ callName: this.callName, metric, ms, surface: "web" });
    } catch {
      // A metrics failure must never escape into call control.
    }
    return ms;
  }

  discard(): void {
    this.open.clear();
  }

  /** Test seam and duplicate-event guard visibility. */
  pending(): ReliabilityMetric[] {
    return [...this.open.keys()];
  }
}

export type HttpTimingSink = TimingSink & {
  flush: () => void;
  discard: () => void;
};

export function createHttpTimingSink(options: {
  endpoint: string;
  maxBatch?: number;
  flushAfterMs?: number;
}): HttpTimingSink {
  const maxBatch = options.maxBatch ?? 20;
  const flushAfterMs = options.flushAfterMs ?? 5000;
  let batch: Timing[] = [];
  let scheduled: ReturnType<typeof setTimeout> | null = null;

  const flush = () => {
    if (scheduled !== null) {
      clearTimeout(scheduled);
      scheduled = null;
    }
    if (batch.length === 0) return;

    const payload = batch;
    batch = [];
    void fetch(options.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ timings: payload }),
      keepalive: true,
    }).catch(() => {
      // No retry. Losing one sample is cheaper than adding work to a weak
      // connection while measuring that same weak connection.
    });
  };

  const sink = ((timing: Timing) => {
    batch.push(timing);
    if (batch.length >= maxBatch) {
      flush();
      return;
    }
    if (scheduled === null) scheduled = setTimeout(flush, flushAfterMs);
  }) as HttpTimingSink;

  sink.flush = flush;
  sink.discard = () => {
    if (scheduled !== null) clearTimeout(scheduled);
    scheduled = null;
    batch = [];
  };
  return sink;
}
