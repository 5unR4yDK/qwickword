import { expect, test } from "@playwright/test";
import {
  Timings,
  type ReliabilityMetric,
  type Timing,
} from "../../src/lib/telemetry";

function collector() {
  const seen: Timing[] = [];
  return {
    seen,
    sink: (timing: Timing) => seen.push(timing),
  };
}

test("a reliability span reports once with web attribution", () => {
  let now = 1000;
  const { seen, sink } = collector();
  const timings = new Timings("quiet-otter", sink, () => now);

  timings.start("join_to_audio");
  now = 2250;
  expect(timings.end("join_to_audio")).toBe(1250);
  expect(timings.end("join_to_audio")).toBeNull();
  expect(seen).toEqual([
    {
      callName: "quiet-otter",
      metric: "join_to_audio",
      ms: 1250,
      surface: "web",
    },
  ]);
});

test("duplicate transport events keep the first reconnect start", () => {
  let now = 100;
  const { seen, sink } = collector();
  const timings = new Timings("room", sink, () => now);

  timings.start("reconnect");
  now = 200;
  timings.start("reconnect");
  now = 350;
  expect(timings.end("reconnect")).toBe(250);
  expect(seen[0]?.ms).toBe(250);
});

test("cancelled and implausibly long spans do not report", () => {
  let now = 0;
  const { seen, sink } = collector();
  const timings = new Timings("room", sink, () => now);

  timings.start("join_to_audio");
  timings.cancel("join_to_audio");
  expect(timings.end("join_to_audio")).toBeNull();

  const metric: ReliabilityMetric = "reconnect";
  timings.start(metric);
  now = 11 * 60 * 1000;
  expect(timings.end(metric)).toBeNull();
  expect(seen).toHaveLength(0);
});

test("a throwing sink never escapes into call control", () => {
  let now = 0;
  const timings = new Timings(
    "room",
    () => {
      throw new Error("stats unavailable");
    },
    () => now
  );
  timings.start("teardown");
  now = 20;
  expect(() => timings.end("teardown")).not.toThrow();
});

