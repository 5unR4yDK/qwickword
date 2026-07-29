import { expect, test } from "@playwright/test";
import {
  initialCallState,
  isInCall,
  reduceCallState,
  remainingMs,
  type CallEvent,
  type CallState,
} from "../../src/lib/call-state";

const run = (state: CallState, ...events: CallEvent[]) =>
  events.reduce(reduceCallState, state);

const fresh = () => initialCallState({ durationSeconds: 300 });

test("the happy path reaches a completed terminal state", () => {
  const state = run(
    fresh(),
    { type: "PREPARE" },
    { type: "MEDIA_READY" },
    { type: "JOIN" },
    { type: "JOINED" },
    { type: "COUNTDOWN_STARTING" },
    { type: "COUNTDOWN_STARTED", expiresAt: 310_000 },
    { type: "EXPIRED" },
    { type: "TEARDOWN_COMPLETE" }
  );

  expect(state.phase).toBe("ended");
  expect(state.endReason).toBe("completed");
});

test("late Daily events cannot resurrect a terminal call", () => {
  const ended = run(
    fresh(),
    { type: "PREPARE" },
    { type: "MEDIA_READY" },
    { type: "JOIN" },
    { type: "JOINED" },
    { type: "LEAVE" },
    { type: "TEARDOWN_COMPLETE" }
  );

  const afterLateEvents = run(
    ended,
    { type: "JOINED" },
    { type: "COUNTDOWN_STARTED", expiresAt: 999_999 },
    { type: "TRANSPORT_RECOVERED", at: 10 }
  );

  expect(afterLateEvents).toEqual(ended);
});

test("a failed join returns to ready and can be retried", () => {
  const ready = run(fresh(), { type: "PREPARE" }, { type: "MEDIA_READY" });
  const failed = run(
    ready,
    { type: "JOIN" },
    { type: "JOIN_FAILED", message: "not yet" }
  );
  expect(failed.phase).toBe("ready");
  expect(failed.error).toBe("not yet");

  const retried = run(failed, { type: "JOIN" }, { type: "JOINED" });
  expect(retried.phase).toBe("waiting");
  expect(retried.error).toBeNull();
});

test("a countdown started during prejoin becomes live after join", () => {
  const state = run(
    fresh(),
    { type: "PREPARE" },
    { type: "MEDIA_READY" },
    { type: "COUNTDOWN_STARTED", expiresAt: 50_000 },
    { type: "JOIN" },
    { type: "JOINED" }
  );

  expect(state.phase).toBe("live");
  expect(state.expiresAt).toBe(50_000);
});

test("recovery after server expiry ends instead of resuming", () => {
  const reconnecting = run(
    fresh(),
    { type: "PREPARE" },
    { type: "MEDIA_READY" },
    { type: "JOIN" },
    { type: "JOINED" },
    { type: "COUNTDOWN_STARTED", expiresAt: 1000 },
    { type: "TRANSPORT_LOST" }
  );

  const recovered = reduceCallState(reconnecting, {
    type: "TRANSPORT_RECOVERED",
    at: 1001,
  });
  expect(recovered.phase).toBe("ending");
  expect(recovered.endReason).toBe("completed");
});

test("a Daily eject just before the local clock reaches expiry is completed", () => {
  const live = initialCallState({
    durationSeconds: 60,
    expiresAt: 60_000,
    joined: true,
  });
  const ejected = reduceCallState(live, {
    type: "TRANSPORT_LEFT",
    at: 59_000,
  });
  expect(ejected.endReason).toBe("completed");
  expect(ejected.phase).toBe("ending");
});

test("leaving before start is abandoned and after start is early", () => {
  const waiting = initialCallState({
    durationSeconds: 60,
    joined: true,
  });
  expect(reduceCallState(waiting, { type: "LEAVE" }).endReason).toBe(
    "abandoned"
  );

  const live = reduceCallState(waiting, {
    type: "COUNTDOWN_STARTED",
    expiresAt: 60_000,
  });
  expect(reduceCallState(live, { type: "LEAVE" }).endReason).toBe(
    "left_early"
  );
});

test("remaining time is derived and never negative", () => {
  const live = initialCallState({
    durationSeconds: 60,
    expiresAt: 10_000,
    joined: true,
  });
  expect(remainingMs(live, 9000)).toBe(1000);
  expect(remainingMs(live, 11_000)).toBe(0);
  expect(isInCall(live)).toBe(true);
});
