// The web call lifecycle as one explicit, pure state machine.
//
// Before this module, phase, countdown-started, leave state, errors, and
// teardown were independent React values in call-room.tsx. That allowed
// combinations such as "left but still live" or "expired but still joining."
// Keeping every transition here makes those combinations unrepresentable and
// lets late/duplicate Daily events be absorbed safely.

export type CallPhase =
  | "idle"
  | "preparing"
  | "ready"
  | "joining"
  | "waiting"
  | "live"
  | "reconnecting"
  | "ending"
  | "ended"
  | "failed";

export type CallEndReason = "completed" | "left_early" | "abandoned" | "error";

export type CallState = {
  phase: CallPhase;
  /** Server-enforced expiry, in epoch milliseconds. Null before start. */
  expiresAt: number | null;
  /** Agreed duration. Fixed for the lifetime of this call. */
  durationSeconds: number;
  participantCount: number;
  countdownStarting: boolean;
  endReason: CallEndReason | null;
  error: string | null;
};

export type CallEvent =
  | { type: "PREPARE" }
  | { type: "MEDIA_READY" }
  | { type: "MEDIA_DENIED"; message: string }
  | { type: "JOIN" }
  | { type: "JOINED" }
  | { type: "JOIN_FAILED"; message: string }
  | { type: "PARTICIPANT_COUNT"; count: number }
  | { type: "COUNTDOWN_STARTING" }
  | { type: "COUNTDOWN_STARTED"; expiresAt: number }
  | { type: "COUNTDOWN_FAILED"; message: string }
  | { type: "TRANSPORT_LOST" }
  | { type: "TRANSPORT_RECOVERED"; at: number }
  | { type: "TRANSPORT_LEFT"; at: number }
  | { type: "EXPIRED" }
  | { type: "LEAVE" }
  | { type: "TEARDOWN_COMPLETE" }
  | { type: "FATAL"; message: string };

// Daily's server eject and the browser's wall clock can differ slightly. A
// forced left event arriving within this window of the authoritative expiry
// is still the normal completed ending, not a participant walking out early.
const EXPIRY_EJECT_TOLERANCE_MS = 1500;

export function isTerminal(phase: CallPhase): boolean {
  return phase === "ended" || phase === "failed";
}

export function isInCall(state: CallState): boolean {
  return (
    state.phase === "waiting" ||
    state.phase === "live" ||
    state.phase === "reconnecting"
  );
}

export function initialCallState(options: {
  durationSeconds: number;
  expiresAt?: number | null;
  joined?: boolean;
  alreadyEnded?: boolean;
}): CallState {
  const expiresAt = options.expiresAt ?? null;
  const alreadyEnded = options.alreadyEnded ?? false;
  const joined = options.joined ?? false;

  return {
    phase: alreadyEnded
      ? "ended"
      : joined
        ? expiresAt === null
          ? "waiting"
          : "live"
        : "idle",
    expiresAt,
    durationSeconds: options.durationSeconds,
    participantCount: joined ? 1 : 0,
    countdownStarting: false,
    endReason: alreadyEnded ? "completed" : null,
    error: null,
  };
}

/**
 * The single transition function. Invalid, duplicate, and out-of-order event
 * pairs return the current state unchanged. Daily can deliver late events
 * during teardown; they are normal transport noise, not a reason to crash or
 * resurrect a call.
 */
export function reduceCallState(state: CallState, event: CallEvent): CallState {
  if (isTerminal(state.phase)) return state;

  switch (event.type) {
    case "PREPARE":
      return state.phase === "idle"
        ? { ...state, phase: "preparing", error: null }
        : state;

    case "MEDIA_READY":
      return state.phase === "preparing"
        ? { ...state, phase: "ready", error: null }
        : state;

    case "MEDIA_DENIED":
      return state.phase === "preparing"
        ? { ...state, phase: "idle", error: event.message }
        : state;

    case "JOIN":
      return state.phase === "ready"
        ? { ...state, phase: "joining", error: null }
        : state;

    case "JOINED":
      return state.phase === "joining"
        ? {
            ...state,
            phase: state.expiresAt === null ? "waiting" : "live",
            participantCount: Math.max(1, state.participantCount),
            error: null,
          }
        : state;

    case "JOIN_FAILED":
      // A failed join remains retryable from the pre-join screen.
      return state.phase === "joining"
        ? { ...state, phase: "ready", error: event.message }
        : state;

    case "PARTICIPANT_COUNT":
      return state.phase === "ending"
        ? state
        : { ...state, participantCount: Math.max(0, event.count) };

    case "COUNTDOWN_STARTING":
      return state.phase === "waiting" && state.expiresAt === null
        ? { ...state, countdownStarting: true, error: null }
        : state;

    case "COUNTDOWN_STARTED": {
      if (!Number.isFinite(event.expiresAt) || event.expiresAt <= 0) return state;
      if (state.phase === "ending") return state;
      const phase =
        state.phase === "waiting"
          ? "live"
          : state.phase;
      return {
        ...state,
        phase,
        expiresAt: event.expiresAt,
        countdownStarting: false,
        error: null,
      };
    }

    case "COUNTDOWN_FAILED":
      return state.countdownStarting
        ? { ...state, countdownStarting: false, error: event.message }
        : state;

    case "TRANSPORT_LOST":
      return state.phase === "waiting" || state.phase === "live"
        ? { ...state, phase: "reconnecting" }
        : state;

    case "TRANSPORT_RECOVERED":
      if (state.phase !== "reconnecting") return state;
      if (state.expiresAt !== null && event.at >= state.expiresAt) {
        return {
          ...state,
          phase: "ending",
          endReason: "completed",
          countdownStarting: false,
        };
      }
      return {
        ...state,
        phase: state.expiresAt === null ? "waiting" : "live",
      };

    case "TRANSPORT_LEFT":
      if (
        state.phase !== "waiting" &&
        state.phase !== "live" &&
        state.phase !== "reconnecting"
      ) {
        return state;
      }
      return {
        ...state,
        phase: "ending",
        countdownStarting: false,
        endReason:
          state.expiresAt === null
            ? "abandoned"
            : event.at + EXPIRY_EJECT_TOLERANCE_MS >= state.expiresAt
              ? "completed"
              : "left_early",
      };

    case "EXPIRED":
      return state.expiresAt === null
        ? state
        : {
            ...state,
            phase: "ending",
            countdownStarting: false,
            endReason: "completed",
          };

    case "LEAVE":
      return {
        ...state,
        phase: "ending",
        countdownStarting: false,
        endReason: state.expiresAt === null ? "abandoned" : "left_early",
      };

    case "TEARDOWN_COMPLETE":
      if (state.phase !== "ending") return state;
      return {
        ...state,
        phase: state.endReason === "error" ? "failed" : "ended",
      };

    case "FATAL":
      return {
        ...state,
        phase: "ending",
        countdownStarting: false,
        endReason: "error",
        error: event.message,
      };

    default:
      return state;
  }
}

export function remainingMs(state: CallState, now: number): number | null {
  return state.expiresAt === null ? null : Math.max(0, state.expiresAt - now);
}
