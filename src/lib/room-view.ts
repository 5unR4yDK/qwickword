// What a room looks like on the wire, and the rules for validating one.
//
// Deliberately free of any server-only import. `rooms.ts` next door reaches the
// database and therefore drags `pg` behind it; anything a Client Component
// touches has to live here instead, or Postgres ends up in the browser bundle.
// That is not hypothetical — it is what happened, and the build refused.
//
// Same reasoning as duration.ts, which was split out of daily-rooms.ts for
// exactly this reason.
import { MAX_DURATION_SECONDS, MIN_DURATION_SECONDS } from "./duration";

/** Rooms live in their own namespace at /r/, separate from call slugs. */
const ROOM_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isPlausibleRoomSlug(slug: string): boolean {
  return slug.length >= 3 && slug.length <= 80 && ROOM_SLUG_PATTERN.test(slug);
}

export function isValidDefaultDuration(seconds: unknown): seconds is number {
  return (
    typeof seconds === "number" &&
    Number.isInteger(seconds) &&
    seconds >= MIN_DURATION_SECONDS &&
    seconds <= MAX_DURATION_SECONDS
  );
}

/** A name is a label, not a document. Long enough to be useful, bounded. */
export function normalizeRoomName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (!trimmed) return null;
  return trimmed.slice(0, 60);
}

export type RoomCall = {
  callName: string;
  durationSeconds: number;
  createdAt: string;
  /** Null when the countdown never started — nobody arrived. */
  startedAt: string | null;
  /** "completed" | "left_early" | "abandoned" | "error", or null if unknown. */
  endReason: string | null;
  /** True only while the provider room should still be joinable. */
  active: boolean;
  /** Provider-room expiry, in Unix seconds, for active-call handoff. */
  exp: number;
};

export type RoomView = {
  slug: string;
  name: string | null;
  defaultDurationSeconds: number;
  createdAt: string;
  lastUsedAt: string | null;
  /** Newest first, bounded. The room's timeline. */
  calls: RoomCall[];
};

/**
 * How a past call reads in the timeline. Plain language, and deliberately
 * honest about the one that matters: a call nobody joined says so rather than
 * being quietly omitted, because that is the number worth acting on.
 */
export function callOutcome(call: RoomCall): string {
  if (call.active) return "open now";
  if (!call.startedAt) return "never started";
  switch (call.endReason) {
    case "completed":
      return "completed";
    case "left_early":
      return "left early";
    case "abandoned":
      return "never started";
    case "error":
      return "dropped";
    default:
      return "completed";
  }
}
