import { randomUUID } from "node:crypto";
import {
  claimCountdownStart,
  completeCountdownStart,
  failCountdownStart,
  readPersistedCountdownStart,
  type CountdownStartSource,
  type CountdownStartClaim,
} from "./db";
import {
  DailyRoomError,
  startRoomCountdown,
  type RoomStatus,
} from "./daily-rooms";

const PENDING_DELAYS_MS = [25, 50, 100, 200, 400, 800, 1000, 1000];

function defaultWait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type CountdownStarterDependencies = {
  claim: (options: {
    roomName: string;
    durationSeconds: number;
    source: CountdownStartSource;
    attemptId: string;
  }) => Promise<CountdownStartClaim>;
  read: (
    roomName: string
  ) => Promise<{ exp: number | null; pending: boolean } | null>;
  complete: typeof completeCountdownStart;
  fail: typeof failCountdownStart;
  startProvider: typeof startRoomCountdown;
  attemptId: () => string;
  wait: (ms: number) => Promise<void>;
  pendingDelaysMs: readonly number[];
};

/**
 * Database single-flight around the provider PATCH. Daily remains the hard
 * expiry authority; persistence only chooses which concurrent request may set
 * it and lets every other request reuse the exact accepted value.
 */
export function createAuthoritativeCountdownStarter(
  dependencies: CountdownStarterDependencies
): (
  roomName: string,
  durationSeconds: number,
  source: CountdownStartSource,
  mayRetryClaim?: boolean
) => Promise<RoomStatus> {
  const start = async (
    roomName: string,
    durationSeconds: number,
    source: CountdownStartSource,
    mayRetryClaim = true
  ): Promise<RoomStatus> => {
    const attemptId = dependencies.attemptId();
    const claim = await dependencies.claim({
      roomName,
      durationSeconds,
      source,
      attemptId,
    });

    if (claim.kind === "unavailable") {
      // Preserves the existing graceful degradation when DATABASE_URL is
      // absent (local mock mode) or Neon is temporarily unreachable. Daily
      // still owns and enforces the expiry; only race protection is absent.
      return dependencies.startProvider(roomName, durationSeconds);
    }
    if (claim.kind === "started") {
      return { exp: claim.exp, started: true };
    }
    if (claim.kind === "pending") {
      for (const delay of dependencies.pendingDelaysMs) {
        await dependencies.wait(delay);
        const persisted = await dependencies.read(roomName);
        if (persisted?.exp !== null && persisted?.exp !== undefined) {
          return { exp: persisted.exp, started: true };
        }
        if (persisted && !persisted.pending && mayRetryClaim) {
          return start(roomName, durationSeconds, source, false);
        }
      }
      throw new DailyRoomError(
        "The countdown is already starting. Try again in a moment.",
        409
      );
    }

    try {
      const status = await dependencies.startProvider(
        roomName,
        durationSeconds
      );
      await dependencies.complete({
        roomName,
        attemptId: claim.attemptId,
        source,
        exp: status.exp,
      });
      return status;
    } catch (error) {
      await dependencies.fail({
        roomName,
        attemptId: claim.attemptId,
        errorCategory:
          error instanceof DailyRoomError
            ? `daily_${error.status}`
            : "unexpected",
      });
      throw error;
    }
  };
  return start;
}

export const startAuthoritativeCountdown =
  createAuthoritativeCountdownStarter({
    claim: claimCountdownStart,
    read: readPersistedCountdownStart,
    complete: completeCountdownStart,
    fail: failCountdownStart,
    startProvider: startRoomCountdown,
    attemptId: randomUUID,
    wait: defaultWait,
    pendingDelaysMs: PENDING_DELAYS_MS,
  });
