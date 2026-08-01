import { expect, test } from "@playwright/test";
import {
  createInitialServerClockAnchor,
  createServerClockAnchor,
  remainingFromAnchor,
  serverNowFromAnchor,
} from "../../src/lib/server-clock";

const payload = {
  exp: 1_060,
  serverReceivedAtMs: 999_900,
  serverNowMs: 1_000_000,
};

test("fast and slow device wall clocks produce the same countdown", () => {
  const base = {
    requestStartedMonotonicMs: 10_000,
    responseReceivedMonotonicMs: 10_300,
  };
  const correct = createServerClockAnchor(payload, {
    ...base,
    clientWallAtReceiptMs: 1_000_100,
  });
  const fast = createServerClockAnchor(payload, {
    ...base,
    clientWallAtReceiptMs: 1_300_100,
  });
  const slow = createServerClockAnchor(payload, {
    ...base,
    clientWallAtReceiptMs: 700_100,
  });

  expect(correct).not.toBeNull();
  expect(fast).not.toBeNull();
  expect(slow).not.toBeNull();
  expect(remainingFromAnchor(correct!, 10_300)).toBe(59_900);
  expect(remainingFromAnchor(fast!, 10_300)).toBe(59_900);
  expect(remainingFromAnchor(slow!, 10_300)).toBe(59_900);
  expect(fast!.clockOffsetMs - correct!.clockOffsetMs).toBe(300_000);
  expect(slow!.clockOffsetMs - correct!.clockOffsetMs).toBe(-300_000);
});

test("server processing time is excluded from the network estimate", () => {
  const anchor = createServerClockAnchor(payload, {
    requestStartedMonotonicMs: 2_000,
    responseReceivedMonotonicMs: 2_300,
    clientWallAtReceiptMs: 1_000_100,
  });

  expect(anchor).not.toBeNull();
  expect(anchor!.rttMs).toBe(300);
  expect(anchor!.serverProcessingMs).toBe(100);
  expect(anchor!.estimatedServerAtReceiptMs).toBe(1_000_100);
  expect(serverNowFromAnchor(anchor!, 2_800)).toBe(1_000_600);
});

test("the server-rendered fallback ticks without consulting wall time", () => {
  const anchor = createInitialServerClockAnchor(1_060_000, 60_000, 5_000);
  expect(anchor).not.toBeNull();
  expect(remainingFromAnchor(anchor!, 5_250)).toBe(59_750);
  expect(remainingFromAnchor(anchor!, 65_500)).toBe(0);
});

test("invalid server samples are rejected rather than trusted", () => {
  expect(
    createServerClockAnchor(
      { ...payload, serverNowMs: payload.serverReceivedAtMs - 1 },
      {
        requestStartedMonotonicMs: 0,
        responseReceivedMonotonicMs: 1,
        clientWallAtReceiptMs: 1,
      }
    )
  ).toBeNull();
});
