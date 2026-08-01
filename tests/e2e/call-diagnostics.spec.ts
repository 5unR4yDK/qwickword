import { expect, test } from "@playwright/test";
import {
  CallDiagnostics,
  type CallDiagnosticEvent,
} from "../../src/lib/call-diagnostics";

const SESSION_ID = "11111111-1111-4111-8111-111111111111";

test("diagnostics use one anonymous per-call session and ordered events", () => {
  const events: CallDiagnosticEvent[] = [];
  const diagnostics = new CallDiagnostics(
    "quiet-test",
    (event) => events.push(event),
    "test-build",
    () => 1_800_000_000_000,
    () => 1234.5,
    () => SESSION_ID
  );

  diagnostics.record("call.opened", { phase: "idle" });
  diagnostics.record("media.join_requested", { phase: "ready" });

  expect(events).toHaveLength(2);
  expect(events.map((event) => event.sequence)).toEqual([0, 1]);
  expect(events.every((event) => event.clientCallSessionId === SESSION_ID)).toBe(true);
  expect(events.every((event) => event.room === "quiet-test")).toBe(true);
  expect(events.every((event) => event.surface === "web")).toBe(true);
  expect(events.every((event) => event.appVersion === "test-build")).toBe(true);
  expect(events[0].clientWallTimeMs).toBe(1_800_000_000_000);
  expect(events[0].clientMonotonicMs).toBe(1234.5);
});

test("a diagnostic sink failure never escapes into call control", () => {
  const diagnostics = new CallDiagnostics(
    "quiet-test",
    () => {
      throw new Error("offline");
    },
    "test-build",
    Date.now,
    () => 1,
    () => SESSION_ID
  );

  expect(() => diagnostics.record("call.opened")).not.toThrow();
});
