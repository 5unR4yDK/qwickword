import { expect, test } from "@playwright/test";
import { createAuthoritativeCountdownStarter } from "../../src/lib/countdown-start";
import type { CountdownStartClaim } from "../../src/lib/db";

test("concurrent starts make one provider change and return one expiry", async () => {
  let activeAttempt: string | null = null;
  let persistedExp: number | null = null;
  let providerCalls = 0;
  let nextId = 0;
  let releaseProvider!: () => void;
  const providerGate = new Promise<void>((resolve) => {
    releaseProvider = resolve;
  });

  const starter = createAuthoritativeCountdownStarter({
    claim: async ({ attemptId }): Promise<CountdownStartClaim> => {
      if (persistedExp !== null) return { kind: "started", exp: persistedExp };
      if (activeAttempt !== null) return { kind: "pending" };
      activeAttempt = attemptId;
      return { kind: "winner", attemptId };
    },
    read: async () => ({ exp: persistedExp, pending: activeAttempt !== null }),
    complete: async ({ attemptId, exp }) => {
      expect(attemptId).toBe(activeAttempt);
      persistedExp = exp;
      activeAttempt = null;
    },
    fail: async () => {
      activeAttempt = null;
    },
    startProvider: async () => {
      providerCalls += 1;
      await providerGate;
      return { exp: 1_234_567, started: true };
    },
    attemptId: () => `00000000-0000-4000-8000-${String(nextId++).padStart(12, "0")}`,
    wait: () => new Promise((resolve) => setTimeout(resolve, 0)),
    pendingDelaysMs: [0, 0, 0],
  });

  const first = starter("quiet-test", 60, "manual_start");
  await new Promise((resolve) => setTimeout(resolve, 0));
  const second = starter("quiet-test", 60, "second_participant");
  releaseProvider();

  const [a, b] = await Promise.all([first, second]);
  expect(a.exp).toBe(1_234_567);
  expect(b.exp).toBe(1_234_567);
  expect(providerCalls).toBe(1);

  const reused = await starter("quiet-test", 60, "status_backstop");
  expect(reused.exp).toBe(1_234_567);
  expect(providerCalls).toBe(1);
});

test("a failed winner releases the claim for a later retry", async () => {
  let activeAttempt: string | null = null;
  let attempts = 0;
  let providerCalls = 0;
  const starter = createAuthoritativeCountdownStarter({
    claim: async ({ attemptId }) => {
      activeAttempt = attemptId;
      return { kind: "winner" as const, attemptId };
    },
    read: async () => ({ exp: null, pending: activeAttempt !== null }),
    complete: async () => {
      activeAttempt = null;
    },
    fail: async ({ attemptId }) => {
      expect(attemptId).toBe(activeAttempt);
      activeAttempt = null;
    },
    startProvider: async () => {
      providerCalls += 1;
      if (providerCalls === 1) throw new Error("provider unavailable");
      return { exp: 99_999, started: true };
    },
    attemptId: () => `00000000-0000-4000-8000-${String(attempts++).padStart(12, "0")}`,
    wait: async () => {},
    pendingDelaysMs: [],
  });

  await expect(starter("quiet-test", 60, "manual_start")).rejects.toThrow(
    "provider unavailable"
  );
  expect(activeAttempt).toBeNull();
  await expect(starter("quiet-test", 60, "manual_start")).resolves.toEqual({
    exp: 99_999,
    started: true,
  });
});
