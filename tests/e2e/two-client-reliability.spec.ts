import { expect, test } from "@playwright/test";
import { TwoClientReliabilityHarness } from "./fixtures/two-client-reliability";

function expectOrderedDiagnostics(
  events: readonly { sequence: number }[]
): void {
  expect(events.map((event) => event.sequence)).toEqual(
    events.map((_, index) => index)
  );
}

test("two skewed clients stay aligned through foreground recovery and hard stop", async () => {
  const harness = new TwoClientReliabilityHarness();
  const [desktop, iphone] = harness.clients;

  const expiryMs = await harness.start();

  expect(harness.providerStartCount).toBe(1);
  expect(expiryMs).toBe(harness.serverEpochMs + 60_000);
  expect(desktop.state.phase).toBe("live");
  expect(iphone.state.phase).toBe("live");
  expect(desktop.remainingMs).toBe(iphone.remainingMs);
  expect(desktop.clockOffsetMs).toBe(6 * 60 * 60_000);
  expect(iphone.clockOffsetMs).toBe(-4 * 60 * 60_000);

  harness.advanceTo(20_000);
  iphone.background();
  harness.advanceTo(45_000);
  iphone.wallSkewMs = 8 * 60 * 60_000;
  iphone.foreground();
  harness.resyncClient(iphone, "foreground");
  iphone.recoverTransport();

  expect(iphone.state.phase).toBe("live");
  expect(iphone.clockOffsetMs).toBe(8 * 60 * 60_000);
  expect(desktop.remainingMs).toBe(iphone.remainingMs);
  expect(iphone.remainingMs).toBe(14_820);

  harness.advanceTo(60_000);
  expect(desktop.remainingMs).toBe(0);
  expect(iphone.remainingMs).toBe(0);
  desktop.finishAtDeadline();
  iphone.finishAtDeadline();
  desktop.completeTeardown();
  iphone.completeTeardown();

  expect(desktop.state).toMatchObject({
    phase: "ended",
    endReason: "completed",
  });
  expect(iphone.state).toMatchObject({
    phase: "ended",
    endReason: "completed",
  });
  expect(desktop.sessionId).not.toBe(iphone.sessionId);
  expectOrderedDiagnostics(desktop.diagnosticEvents);
  expectOrderedDiagnostics(iphone.diagnosticEvents);
  expect(
    iphone.diagnosticEvents.map((event) => event.eventName)
  ).toEqual(
    expect.arrayContaining([
      "app.backgrounded",
      "transport.reconnecting",
      "app.foregrounded",
      "countdown.sync_changed",
      "transport.recovered",
      "countdown.local_zero",
      "call.end_requested",
      "call.teardown_completed",
    ])
  );
  const resync = iphone.diagnosticEvents.find(
    (event) => event.eventName === "countdown.sync_changed"
  );
  expect(resync).toMatchObject({
    clockOffsetMs: 8 * 60 * 60_000,
    authoritativeExpMs: expiryMs,
    source: "foreground",
  });
});

test("a client returning after expiry ends instead of resurrecting", async () => {
  const harness = new TwoClientReliabilityHarness();
  const [desktop, iphone] = harness.clients;
  await harness.start();

  harness.advanceTo(50_000);
  iphone.background();
  harness.advanceTo(61_000);
  desktop.finishAtDeadline();
  desktop.completeTeardown();

  iphone.foreground();
  harness.resyncClient(iphone, "foreground_after_expiry");
  iphone.recoverTransport();
  iphone.completeTeardown();

  expect(desktop.state.phase).toBe("ended");
  expect(iphone.remainingMs).toBe(0);
  expect(iphone.state).toMatchObject({
    phase: "ended",
    endReason: "completed",
  });
  expect(
    iphone.diagnosticEvents.map((event) => event.eventName)
  ).toEqual(
    expect.arrayContaining([
      "countdown.sync_changed",
      "transport.recovered",
      "countdown.local_zero",
      "call.end_requested",
      "call.teardown_completed",
    ])
  );
  expectOrderedDiagnostics(iphone.diagnosticEvents);
});
