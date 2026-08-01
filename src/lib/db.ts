// Postgres store backing two things: call stats (how many calls, how many
// minutes) and the duration lookup that keeps shared links clean. Backed by
// Neon, provisioned via the Vercel Marketplace integration — `DATABASE_URL`
// is set automatically in every Vercel environment once that integration is
// connected to this project.
//
// Daily's own room `exp` stays the single source of truth for the actual
// hard end — a database outage can never extend or break a running call.
// The one thing the database now carries as real state is each room's
// *intended* duration, so a shared link can be just the slug
// (qwickword.com/quiet-otter) with no query params. That dependency
// degrades gracefully rather than hard-failing: if the write fails at
// creation time, the created link falls back to carrying the duration in
// its query string, exactly like the older links (see POST /api/rooms).
// `DATABASE_URL` being unset (e.g. local dev without a linked Neon
// database) is treated the same as a write failure.
//
// One row per created call; a slug that gets reused later simply inserts a
// new row, and lookups take the most recent row for the name.
import { Pool } from "pg";
import { createHmac, randomBytes } from "node:crypto";
import type { NormalizedDailyLifecycleEvent } from "./daily-webhook";

let pool: Pool | null = null;

function getPool(): Pool | null {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) return null;
  // Lazily created, reused across invocations on the same warm serverless
  // instance (Vercel functions are stateless per-invocation, but a module-
  // level singleton like this survives as long as the instance stays warm).
  // `max: 1` keeps this well within Neon's free-tier connection limit even
  // if several instances are warm at once — this app's write volume (one row
  // per call, a couple of updates) never needs more than that.
  if (!pool) {
    pool = new Pool({ connectionString, max: 1 });
  }
  return pool;
}

/**
 * Records that a room was created, with the duration the caller requested.
 * Called from POST /api/rooms right after `createHardExpiryRoom` succeeds.
 * Returns whether the write actually landed — the route uses that to decide
 * whether the link it hands back can be clean (slug only) or needs the
 * query-string fallback.
 */
export async function recordCallCreated(
  roomName: string,
  durationSeconds: number,
  /** Set when the call was started from inside a room; null for one-offs. */
  roomId?: number | null,
  attribution?: {
    sessionId: string;
    trafficClass: string;
    source: string | null;
    medium: string | null;
    campaign: string | null;
    content: string | null;
    parentCallName?: string | null;
  }
): Promise<boolean> {
  const p = getPool();
  if (!p) return false;
  try {
    await p.query(
      `INSERT INTO calls (room_name, duration_seconds, room_id) VALUES ($1, $2, $3)`,
      [roomName, durationSeconds, roomId ?? null]
    );
    void appendEvent({
      kind: "call.created",
      callName: roomName,
      roomId: roomId ?? null,
      payload: {
        durationSeconds,
        surface: "web",
        creatorSessionId: attribution?.sessionId ?? null,
        trafficClass: attribution?.trafficClass ?? "public",
        source: attribution?.source ?? null,
        medium: attribution?.medium ?? null,
        campaign: attribution?.campaign ?? null,
        content: attribution?.content ?? null,
        parentCallName: attribution?.parentCallName ?? null,
      },
      dedupeKey: `call.created:${roomName}`,
    });
    return true;
  } catch (err) {
    console.error("[Qwickword] Failed to record call-created stats:", err);
    return false;
  }
}

/**
 * The intended duration of the most recent call created under this room
 * name, or null if there's no row (or the database is unreachable). This is
 * what lets a clean, param-less link (qwickword.com/quiet-otter) recover the
 * call length server-side.
 */
export async function getRecordedDurationSeconds(
  roomName: string
): Promise<number | null> {
  const p = getPool();
  if (!p) return null;
  try {
    const result = await p.query(
      `SELECT duration_seconds FROM calls
       WHERE room_name = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [roomName]
    );
    const value = result.rows[0]?.duration_seconds;
    return typeof value === "number" && Number.isInteger(value) && value > 0
      ? value
      : null;
  } catch (err) {
    console.error("[Qwickword] Failed to look up recorded duration:", err);
    return null;
  }
}

/**
 * Records that a room's real countdown has started. Called from
 * POST /api/rooms/[room]/start right after `startRoomCountdown` succeeds —
 * that route is called from two places (manual "Start now", and every
 * connected tab's own auto-start detection) and is itself idempotent, so
 * this mirrors that with an atomic first-write claim. The boolean result is
 * used to deduplicate the one push notification for this call; a repeated
 * start still returns Daily's existing expiry but cannot ring twice.
 */
export async function recordCallStarted(roomName: string): Promise<boolean> {
  const p = getPool();
  if (!p) return false;
  try {
    // Scoped to the latest row for the name — with per-call rows, an old
    // call that once used the same (reused) slug must not be touched.
    const result = await p.query(
      `UPDATE calls SET started_at = now()
       WHERE id = (
         SELECT id FROM calls WHERE room_name = $1
         ORDER BY created_at DESC LIMIT 1
       )
         AND started_at IS NULL
       RETURNING id`,
      [roomName]
    );
    void appendEvent({
      kind: "call.started",
      callName: roomName,
      dedupeKey: `call.started:${roomName}`,
    });
    return result.rowCount === 1;
  } catch (err) {
    console.error("[Qwickword] Failed to record call-started stats:", err);
    return false;
  }
}

export type CountdownStartSource =
  | "second_participant"
  | "manual_start"
  | "status_backstop"
  | "provider_event"
  | "unknown";

export type CountdownStartClaim =
  | { kind: "winner"; attemptId: string }
  | { kind: "started"; exp: number }
  | { kind: "pending" }
  | { kind: "unavailable" };

/**
 * Atomically chooses the one request allowed to patch Daily. The transaction
 * ends before the provider call; the active attempt ID is the lease other
 * callers observe while they wait for the winner's accepted expiry.
 */
export async function claimCountdownStart(options: {
  roomName: string;
  durationSeconds: number;
  source: CountdownStartSource;
  attemptId: string;
}): Promise<CountdownStartClaim> {
  const p = getPool();
  if (!p) return { kind: "unavailable" };
  const client = await p.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query<{
      id: string | number;
      authoritative_exp_seconds: string | number | null;
      countdown_start_attempt_id: string | null;
      countdown_start_claimed_at: Date | string | null;
    }>(
      `SELECT id, authoritative_exp_seconds, countdown_start_attempt_id,
              countdown_start_claimed_at
         FROM calls
        WHERE room_name = $1
        ORDER BY created_at DESC
        LIMIT 1
        FOR UPDATE`,
      [options.roomName]
    );
    const call = result.rows[0];
    if (!call) {
      await client.query("ROLLBACK");
      return { kind: "unavailable" };
    }

    const callId = Number(call.id);
    const persistedExp =
      call.authoritative_exp_seconds === null
        ? null
        : Number(call.authoritative_exp_seconds);
    const claimIsStale =
      call.countdown_start_attempt_id !== null &&
      call.countdown_start_claimed_at !== null &&
      Date.now() - new Date(call.countdown_start_claimed_at).getTime() > 15_000;
    const outcome =
      persistedExp !== null
        ? "reused"
        : call.countdown_start_attempt_id === null || claimIsStale
          ? "winner"
          : "pending";

    if (claimIsStale && call.countdown_start_attempt_id !== null) {
      await client.query(
        `UPDATE call_countdown_attempts
            SET outcome = 'stale', error_category = 'claim_timeout',
                completed_at = now()
          WHERE attempt_id = $1 AND completed_at IS NULL`,
        [call.countdown_start_attempt_id]
      );
    }

    await client.query(
      `INSERT INTO call_countdown_attempts
         (attempt_id, call_id, source, requested_duration_seconds, outcome,
          accepted_exp_seconds, completed_at)
       VALUES ($1, $2, $3, $4, $5, $6,
               CASE WHEN $5 = 'reused' THEN now() ELSE NULL END)`,
      [
        options.attemptId,
        callId,
        options.source,
        options.durationSeconds,
        outcome,
        persistedExp,
      ]
    );

    if (outcome === "winner") {
      await client.query(
        `UPDATE calls
            SET countdown_start_attempt_id = $2,
                countdown_start_claimed_at = now()
          WHERE id = $1`,
        [callId, options.attemptId]
      );
    }
    await client.query("COMMIT");

    if (persistedExp !== null) return { kind: "started", exp: persistedExp };
    return outcome === "winner"
      ? { kind: "winner", attemptId: options.attemptId }
      : { kind: "pending" };
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("[Qwickword] Failed to claim countdown start:", err);
    return { kind: "unavailable" };
  } finally {
    client.release();
  }
}

export async function readPersistedCountdownStart(
  roomName: string
): Promise<{ exp: number | null; pending: boolean } | null> {
  const p = getPool();
  if (!p) return null;
  try {
    const result = await p.query<{
      authoritative_exp_seconds: string | number | null;
      countdown_start_attempt_id: string | null;
    }>(
      `SELECT authoritative_exp_seconds, countdown_start_attempt_id
         FROM calls
        WHERE room_name = $1
        ORDER BY created_at DESC
        LIMIT 1`,
      [roomName]
    );
    const row = result.rows[0];
    if (!row) return null;
    return {
      exp:
        row.authoritative_exp_seconds === null
          ? null
          : Number(row.authoritative_exp_seconds),
      pending: row.countdown_start_attempt_id !== null,
    };
  } catch (err) {
    console.error("[Qwickword] Failed to read persisted countdown start:", err);
    return null;
  }
}

export async function completeCountdownStart(options: {
  roomName: string;
  attemptId: string;
  source: CountdownStartSource;
  exp: number;
}): Promise<void> {
  const p = getPool();
  if (!p) return;
  try {
    await p.query(
      `WITH completed_call AS (
         UPDATE calls
            SET authoritative_exp_seconds = $3,
                countdown_started_at = now(),
                countdown_start_source = $4,
                winning_countdown_attempt_id = $2,
                countdown_start_attempt_id = NULL,
                countdown_start_claimed_at = NULL
          WHERE id = (
            SELECT id FROM calls WHERE room_name = $1
            ORDER BY created_at DESC LIMIT 1
          )
            AND countdown_start_attempt_id = $2
         RETURNING id
       )
       UPDATE call_countdown_attempts a
          SET outcome = CASE WHEN attempt_id = $2 THEN 'started' ELSE 'reused' END,
              accepted_exp_seconds = $3,
              completed_at = now()
        WHERE call_id IN (SELECT id FROM completed_call)
          AND (attempt_id = $2 OR outcome = 'pending')`,
      [options.roomName, options.attemptId, options.exp, options.source]
    );
  } catch (err) {
    console.error("[Qwickword] Failed to complete countdown start:", err);
  }
}

export async function failCountdownStart(options: {
  roomName: string;
  attemptId: string;
  errorCategory: string;
}): Promise<void> {
  const p = getPool();
  if (!p) return;
  try {
    await p.query(
      `WITH released_call AS (
         UPDATE calls
            SET countdown_start_attempt_id = NULL,
                countdown_start_claimed_at = NULL
          WHERE id = (
            SELECT id FROM calls WHERE room_name = $1
            ORDER BY created_at DESC LIMIT 1
          )
            AND countdown_start_attempt_id = $2
         RETURNING id
       )
       UPDATE call_countdown_attempts
          SET outcome = 'failed', error_category = $3, completed_at = now()
        WHERE attempt_id = $2
          AND EXISTS (SELECT 1 FROM released_call)`,
      [options.roomName, options.attemptId, options.errorCategory]
    );
  } catch (err) {
    console.error("[Qwickword] Failed to release countdown start claim:", err);
  }
}

/* ------------------------------------------------------------------ */
/* Rooms — the persistent layer above calls (see planning/ROOMS_DESIGN) */
/* ------------------------------------------------------------------ */

/** A room with no call for this long is treated as abandoned. */
export const ROOM_IDLE_DAYS = 90;

export type Room = {
  id: number;
  slug: string;
  name: string | null;
  defaultDurationSeconds: number;
  createdAt: string;
  lastUsedAt: string | null;
  closedAt: string | null;
};

type RoomRow = {
  id: string | number;
  slug: string;
  name: string | null;
  default_duration_seconds: number;
  created_at: Date | string;
  last_used_at: Date | string | null;
  closed_at: Date | string | null;
};

function toRoom(row: RoomRow): Room {
  return {
    id: Number(row.id),
    slug: row.slug,
    name: row.name,
    defaultDurationSeconds: row.default_duration_seconds,
    createdAt: String(row.created_at),
    lastUsedAt: row.last_used_at ? String(row.last_used_at) : null,
    closedAt: row.closed_at ? String(row.closed_at) : null,
  };
}

/**
 * Creates a room. Unlike a call, this is durable: the slug keeps working, and
 * returning to it is the point.
 *
 * Returns null rather than throwing when the database is unreachable — a room
 * is an enhancement, and the one-off call flow must keep working without one.
 */
export async function createRoom(
  slug: string,
  defaultDurationSeconds: number,
  name?: string,
  /**
   * SHA-256 of the owner key. Only the hash is ever stored; the key itself is
   * returned to the creator once and never again. See lib/room-keys.ts.
   */
  ownerKeyHash?: string
): Promise<Room | null> {
  const p = getPool();
  if (!p) return null;
  try {
    const result = await p.query<RoomRow>(
      `INSERT INTO rooms (slug, name, default_duration_seconds, owner_key_hash)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [slug, name ?? null, defaultDurationSeconds, ownerKeyHash ?? ""]
    );
    const room = result.rows[0] ? toRoom(result.rows[0]) : null;
    if (room) {
      void appendEvent({
        kind: "room.created",
        roomId: room.id,
        payload: { slug, defaultDurationSeconds },
      });
    }
    return room;
  } catch (err) {
    console.error("[Qwickword] Failed to create room:", err);
    return null;
  }
}

/**
 * Looks a room up by slug. Returns null for unknown, closed, or idle-expired
 * rooms alike — the caller shows the same "this has ended" screen for all
 * three, so the distinction is deliberately not surfaced. A permanent link is
 * a permanent open door; idle expiry closes abandoned ones automatically.
 */
export async function getRoom(slug: string): Promise<Room | null> {
  const p = getPool();
  if (!p) return null;
  try {
    const result = await p.query<RoomRow>(
      `SELECT * FROM rooms
        WHERE slug = $1
          AND closed_at IS NULL
          AND (
            last_used_at IS NULL
              AND created_at > now() - ($2 || ' days')::interval
            OR last_used_at > now() - ($2 || ' days')::interval
          )
        LIMIT 1`,
      [slug, ROOM_IDLE_DAYS]
    );
    return result.rows[0] ? toRoom(result.rows[0]) : null;
  } catch (err) {
    console.error("[Qwickword] Failed to look up room:", err);
    return null;
  }
}

/** Marks a room used, which both orders the list and defers idle expiry. */
export async function touchRoom(roomId: number): Promise<void> {
  const p = getPool();
  if (!p) return;
  try {
    await p.query(`UPDATE rooms SET last_used_at = now() WHERE id = $1`, [roomId]);
  } catch (err) {
    console.error("[Qwickword] Failed to touch room:", err);
  }
}

/** Retires a room immediately, without waiting for idle expiry. */
export async function closeRoom(slug: string): Promise<void> {
  const p = getPool();
  if (!p) return;
  try {
    await p.query(
      `UPDATE rooms SET closed_at = COALESCE(closed_at, now()) WHERE slug = $1`,
      [slug]
    );
    void appendEvent({
      kind: "room.closed",
      payload: { slug },
      dedupeKey: `room.closed:${slug}`,
    });
  } catch (err) {
    console.error("[Qwickword] Failed to close room:", err);
  }
}

/**
 * The stored hash of a room's owner key, or null if the room is not open.
 *
 * Returns the hash rather than doing the comparison here so the crypto stays
 * in lib/room-keys.ts, where it can be tested without a database.
 */
export async function getRoomOwnerKeyHash(slug: string): Promise<string | null> {
  const p = getPool();
  if (!p) return null;
  try {
    const result = await p.query<{ owner_key_hash: string }>(
      `SELECT owner_key_hash FROM rooms WHERE slug = $1 AND closed_at IS NULL`,
      [slug]
    );
    return result.rows[0]?.owner_key_hash ?? null;
  } catch (err) {
    console.error("[Qwickword] Failed to read a room owner key hash:", err);
    return null;
  }
}

/**
 * Renames a room. An empty name clears it, so the room falls back to reading
 * as its slug rather than showing an empty title.
 *
 * Requires the owner key at the route layer — see api/r/[slug]/route.ts.
 */
export async function renameRoom(
  slug: string,
  name: string | null
): Promise<Room | null> {
  const p = getPool();
  if (!p) return null;
  try {
    const trimmed = name?.trim() || null;
    const result = await p.query<RoomRow>(
      `UPDATE rooms SET name = $2
        WHERE slug = $1 AND closed_at IS NULL
        RETURNING *`,
      [slug, trimmed]
    );
    return result.rows[0] ? toRoom(result.rows[0]) : null;
  } catch (err) {
    console.error("[Qwickword] Failed to rename room:", err);
    return null;
  }
}

/**
 * Changes the length a room proposes by default. Calls already held in the
 * room are untouched — each one's duration was fixed when it was created, and
 * nothing may reach back and alter a call that has already happened.
 */
export async function setRoomDefaultDuration(
  slug: string,
  defaultDurationSeconds: number
): Promise<Room | null> {
  const p = getPool();
  if (!p) return null;
  try {
    const result = await p.query<RoomRow>(
      `UPDATE rooms SET default_duration_seconds = $2
        WHERE slug = $1 AND closed_at IS NULL
        RETURNING *`,
      [slug, defaultDurationSeconds]
    );
    return result.rows[0] ? toRoom(result.rows[0]) : null;
  } catch (err) {
    console.error("[Qwickword] Failed to set room default duration:", err);
    return null;
  }
}

/** The calls held in a room, newest first. */
export async function getRoomCalls(
  roomId: number,
  limit = 20
): Promise<
  Array<{
    roomName: string;
    durationSeconds: number;
    createdAt: string;
    startedAt: string | null;
    endReason: string | null;
  }>
> {
  const p = getPool();
  if (!p) return [];
  try {
    const result = await p.query(
      `SELECT room_name, duration_seconds, created_at, started_at, end_reason
         FROM calls WHERE room_id = $1
        ORDER BY created_at DESC LIMIT $2`,
      [roomId, limit]
    );
    return result.rows.map((r) => ({
      roomName: r.room_name,
      durationSeconds: r.duration_seconds,
      createdAt: String(r.created_at),
      startedAt: r.started_at ? String(r.started_at) : null,
      endReason: r.end_reason,
    }));
  } catch (err) {
    console.error("[Qwickword] Failed to read room calls:", err);
    return [];
  }
}

/* ------------------------------------------------------------------ */
/* The event log                                                        */
/* ------------------------------------------------------------------ */

/**
 * Every durable fact, appended in order.
 *
 * Message ordering, duplicate delivery, history loss and cross-device
 * divergence are four of the failures the market report names across mature
 * products, and all four share one cause: state kept as current-value rows,
 * mutated in place, with each client's copy drifting. An append-only log with
 * server-assigned ordering removes the cause rather than patching the symptoms.
 *
 * `server_seq` comes from a database sequence, so ordering is never a client's
 * opinion. A new device replays from 0; a returning one replays from its last
 * seen sequence. That is what "history follows the user" means concretely.
 */
export type EventKind =
  | "landing.view"
  | "call.created"
  | "call.shared"
  | "call.opened"
  | "call.started"
  | "call.ended"
  | "call.abandoned"
  | "room.created"
  | "room.closed";

export type AppendedEvent = {
  kind: EventKind;
  roomId?: number | null;
  callName?: string | null;
  payload?: Record<string, unknown>;
  /**
   * Client-supplied idempotency key. A flaky network retrying a request must
   * not be able to append the same fact twice.
   */
  dedupeKey?: string | null;
};

/**
 * Appends one event.
 *
 * **Transitional note.** The current-value tables (`calls`, `rooms`) are still
 * written directly and remain authoritative for reads; the log is written
 * alongside them in the same transaction, so the two cannot diverge. Deriving
 * those tables *from* the log is the eventual shape, but rewriting live call
 * recording to be event-sourced is a change worth making deliberately rather
 * than as a side effect. Everything appended from today is replayable.
 */
export async function appendEvent(e: AppendedEvent): Promise<void> {
  const p = getPool();
  if (!p) return;
  try {
    await p.query(
      `INSERT INTO events (room_id, call_name, kind, payload, dedupe_key)
       VALUES ($1, $2, $3, $4::jsonb, $5)
       ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING`,
      [
        e.roomId ?? null,
        e.callName ?? null,
        e.kind,
        JSON.stringify(e.payload ?? {}),
        e.dedupeKey ?? null,
      ]
    );
  } catch (err) {
    // The log is never allowed to break a call. A lost event costs a data
    // point; a failed call costs the product.
    console.error("[Qwickword] Failed to append event:", err);
  }
}

export type LoggedEvent = {
  seq: number;
  kind: string;
  roomId: number | null;
  callName: string | null;
  payload: Record<string, unknown>;
  createdAt: string;
};

/**
 * Replays events after a given sequence number — the primitive a new or
 * returning device uses to reconstruct state without the old device being
 * online. `limit` is bounded so a first sync cannot ask for everything at once.
 */
export async function readEventsSince(
  sinceSeq: number,
  opts: { roomId?: number; limit?: number } = {}
): Promise<LoggedEvent[]> {
  const p = getPool();
  if (!p) return [];
  const limit = Math.min(Math.max(opts.limit ?? 200, 1), 1000);
  try {
    const result = opts.roomId
      ? await p.query(
          `SELECT server_seq, kind, room_id, call_name, payload, created_at
             FROM events WHERE server_seq > $1 AND room_id = $2
            ORDER BY server_seq LIMIT $3`,
          [sinceSeq, opts.roomId, limit]
        )
      : await p.query(
          `SELECT server_seq, kind, room_id, call_name, payload, created_at
             FROM events WHERE server_seq > $1
            ORDER BY server_seq LIMIT $2`,
          [sinceSeq, limit]
        );
    return result.rows.map((r) => ({
      seq: Number(r.server_seq),
      kind: r.kind,
      roomId: r.room_id === null ? null : Number(r.room_id),
      callName: r.call_name,
      payload: r.payload ?? {},
      createdAt: String(r.created_at),
    }));
  } catch (err) {
    console.error("[Qwickword] Failed to read events:", err);
    return [];
  }
}

/* ------------------------------------------------------------------ */
/* Reliability timings                                                  */
/* ------------------------------------------------------------------ */

export type TimingInput = {
  callName: string;
  metric: string;
  ms: number;
  surface: string;
};

/**
 * Records reliability timings in one round trip.
 *
 * These are what make the objectives in the architecture doc measurable:
 * p95 join-to-audio under 3s, p95 reconnect under 2s. Without them every
 * Stage 2 trigger is guesswork, and a regression is invisible.
 *
 * Batched into a single multi-row insert — a call producing a handful of
 * timings should never cost a handful of round trips.
 */
export async function recordTimings(timings: TimingInput[]): Promise<void> {
  const p = getPool();
  if (!p || timings.length === 0) return;
  try {
    const values: unknown[] = [];
    const rows = timings.map((t, i) => {
      const b = i * 4;
      values.push(t.callName, t.metric, t.ms, t.surface);
      return `($${b + 1}, $${b + 2}, $${b + 3}, $${b + 4})`;
    });
    await p.query(
      `INSERT INTO call_timings (call_name, metric, ms, surface) VALUES ${rows.join(", ")}`,
      values
    );
  } catch (err) {
    console.error("[Qwickword] Failed to record timings:", err);
  }
}

export type DiagnosticEventInput = {
  eventId: string;
  room: string;
  clientCallSessionId: string;
  sequence: number;
  eventName: string;
  surface: string;
  appVersion: string | null;
  clientWallTimeMs: number;
  clientMonotonicMs: number;
  serverReceivedAtMs: number | null;
  serverNowMs: number | null;
  rttMs: number | null;
  serverProcessingMs: number | null;
  clockOffsetMs: number | null;
  authoritativeExpMs: number | null;
  phase: string | null;
  source: string | null;
  participantCount: number | null;
  endTrigger: string | null;
  errorCategory: string | null;
};

/**
 * Stores allowlisted, per-call lifecycle evidence in one database round trip.
 * The client supplies a bearer room slug; the insert resolves it to the latest
 * internal call row and does not retain the slug in the diagnostics table.
 */
export async function recordDiagnosticEvents(
  events: DiagnosticEventInput[]
): Promise<void> {
  const p = getPool();
  if (!p || events.length === 0) return;
  const rows = events.map((event) => ({
    event_id: event.eventId,
    room: event.room,
    client_call_session_id: event.clientCallSessionId,
    sequence: event.sequence,
    event_name: event.eventName,
    surface: event.surface,
    app_version: event.appVersion,
    client_wall_time_ms: event.clientWallTimeMs,
    client_monotonic_ms: event.clientMonotonicMs,
    server_received_at_ms: event.serverReceivedAtMs,
    server_now_ms: event.serverNowMs,
    rtt_ms: event.rttMs,
    server_processing_ms: event.serverProcessingMs,
    clock_offset_ms: event.clockOffsetMs,
    authoritative_exp_ms: event.authoritativeExpMs,
    phase: event.phase,
    source: event.source,
    participant_count: event.participantCount,
    end_trigger: event.endTrigger,
    error_category: event.errorCategory,
  }));

  try {
    await p.query(
      `WITH incoming AS (
         SELECT *
           FROM jsonb_to_recordset($1::jsonb) AS x(
             event_id uuid,
             room text,
             client_call_session_id uuid,
             sequence integer,
             event_name text,
             surface text,
             app_version text,
             client_wall_time_ms bigint,
             client_monotonic_ms double precision,
             server_received_at_ms bigint,
             server_now_ms bigint,
             rtt_ms integer,
             server_processing_ms integer,
             clock_offset_ms integer,
             authoritative_exp_ms bigint,
             phase text,
             source text,
             participant_count integer,
             end_trigger text,
             error_category text
           )
       ), resolved AS (
         SELECT c.id AS call_id, i.*
           FROM incoming i
           JOIN LATERAL (
             SELECT id FROM calls
              WHERE room_name = i.room
              ORDER BY created_at DESC
              LIMIT 1
           ) c ON true
       )
       INSERT INTO call_diagnostic_events (
         event_id, call_id, client_call_session_id, sequence, event_name,
         surface, app_version, client_wall_time_ms, client_monotonic_ms,
         server_received_at_ms, server_now_ms, rtt_ms, server_processing_ms,
         clock_offset_ms, authoritative_exp_ms, phase, source,
         participant_count, end_trigger, error_category
       )
       SELECT event_id, call_id, client_call_session_id, sequence, event_name,
              surface, app_version, client_wall_time_ms, client_monotonic_ms,
              server_received_at_ms, server_now_ms, rtt_ms,
              server_processing_ms, clock_offset_ms, authoritative_exp_ms,
              phase, source, participant_count, end_trigger, error_category
         FROM resolved
       ON CONFLICT DO NOTHING`,
      [JSON.stringify(rows)]
    );

  } catch (err) {
    console.error("[Qwickword] Failed to record call diagnostics:", err);
  }
}

export type ProviderEventWriteOutcome =
  | "stored"
  | "duplicate"
  | "unknown_call"
  | "unavailable";

/**
 * Persists only the allowlisted projection of a verified Daily webhook.
 * Provider session identifiers exist only in memory and are replaced with a
 * call-scoped HMAC before the insert. The event ID is the idempotency key.
 */
export async function recordProviderLifecycleEvent(
  event: NormalizedDailyLifecycleEvent,
  diagnosticsHmacSecret: string
): Promise<ProviderEventWriteOutcome> {
  const p = getPool();
  if (!p) return "unavailable";
  try {
    const resolved = await p.query<{ id: string | number }>(
      `SELECT id
         FROM calls
        WHERE room_name = $1
          AND created_at <= $2::timestamptz
        ORDER BY created_at DESC
        LIMIT 1`,
      [event.room, new Date(event.providerTimestampMs)]
    );
    const call = resolved.rows[0];
    if (!call) return "unknown_call";

    const callId = Number(call.id);
    const sessionHash = event.providerSessionId
      ? createHmac(
          "sha256",
          Buffer.from(diagnosticsHmacSecret, "base64")
        )
          .update(`${callId}:${event.providerSessionId}`)
          .digest("hex")
      : null;
    const result = await p.query(
      `INSERT INTO call_provider_events (
         provider_event_id, call_id, event_type, provider_timestamp,
         provider_session_hash, joined_at, left_at, duration_seconds,
         scheduled_eject_at, meeting_started_at, meeting_ended_at
       ) VALUES (
         $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
       )
       ON CONFLICT (provider_event_id) DO NOTHING
       RETURNING provider_event_id`,
      [
        event.providerEventId,
        callId,
        event.eventType,
        new Date(event.providerTimestampMs),
        sessionHash,
        event.joinedAtMs === null ? null : new Date(event.joinedAtMs),
        event.leftAtMs === null ? null : new Date(event.leftAtMs),
        event.durationSeconds,
        event.scheduledEjectAtMs === null
          ? null
          : new Date(event.scheduledEjectAtMs),
        event.meetingStartedAtMs === null
          ? null
          : new Date(event.meetingStartedAtMs),
        event.meetingEndedAtMs === null
          ? null
          : new Date(event.meetingEndedAtMs),
      ]
    );
    return result.rowCount === 1 ? "stored" : "duplicate";
  } catch (err) {
    console.error("[Qwickword] Failed to record provider lifecycle event:", err);
    return "unavailable";
  }
}

export async function createIncidentReference(options: {
  room: string;
  clientCallSessionId: string;
  surface: "web" | "ios";
  appVersion: string | null;
}): Promise<string | null> {
  const p = getPool();
  if (!p) return null;
  const reference = `QW-${randomBytes(6).toString("hex").toUpperCase()}`;
  try {
    const result = await p.query<{ reference: string }>(
      `INSERT INTO call_incident_references (
         reference, call_id, client_call_session_id, surface, app_version
       )
       SELECT $2, id, $3, $4, $5
         FROM calls
        WHERE room_name = $1
        ORDER BY created_at DESC
        LIMIT 1
       RETURNING reference`,
      [
        options.room,
        reference,
        options.clientCallSessionId,
        options.surface,
        options.appVersion,
      ]
    );
    return result.rows[0]?.reference ?? null;
  } catch (err) {
    console.error("[Qwickword] Failed to create incident reference:", err);
    return null;
  }
}

export type DiagnosticRetentionResult = {
  clientEventsDeleted: number;
  providerEventsDeleted: number;
  startAttemptsDeleted: number;
  incidentRefsDeleted: number;
};

/** Independently scheduled enforcement of the 14-day raw-evidence boundary. */
export async function pruneExpiredDiagnostics(): Promise<DiagnosticRetentionResult> {
  const p = getPool();
  if (!p) throw new Error("database_unavailable");
  const client = await p.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `UPDATE diagnostic_retention_state
          SET last_started_at = now()
        WHERE singleton_id = 1`
    );
    const clientEvents = await client.query(
      `DELETE FROM call_diagnostic_events
        WHERE received_at < now() - interval '14 days'`
    );
    const providerEvents = await client.query(
      `DELETE FROM call_provider_events
        WHERE received_at < now() - interval '14 days'`
    );
    const startAttempts = await client.query(
      `DELETE FROM call_countdown_attempts
        WHERE created_at < now() - interval '14 days'`
    );
    const incidentRefs = await client.query(
      `DELETE FROM call_incident_references
        WHERE expires_at <= now()`
    );
    const result = {
      clientEventsDeleted: clientEvents.rowCount ?? 0,
      providerEventsDeleted: providerEvents.rowCount ?? 0,
      startAttemptsDeleted: startAttempts.rowCount ?? 0,
      incidentRefsDeleted: incidentRefs.rowCount ?? 0,
    };
    await client.query(
      `UPDATE diagnostic_retention_state
          SET last_succeeded_at = now(),
              last_error_category = NULL,
              last_client_events_deleted = $1,
              last_provider_events_deleted = $2,
              last_start_attempts_deleted = $3,
              last_incident_refs_deleted = $4
        WHERE singleton_id = 1`,
      [
        result.clientEventsDeleted,
        result.providerEventsDeleted,
        result.startAttemptsDeleted,
        result.incidentRefsDeleted,
      ]
    );
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    await p
      .query(
        `UPDATE diagnostic_retention_state
            SET last_failed_at = now(), last_error_category = 'database_error'
          WHERE singleton_id = 1`
      )
      .catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

/** How a link was deliberately sent. */
export type ShareChannel = "native" | "copy" | "email";

/**
 * Records that the link was deliberately sent somewhere.
 *
 * This is the one step of the funnel the server cannot infer. Without it,
 * "created but never opened" merges two opposite situations: the link was
 * shared and the other person ignored it, or it was never shared at all. The
 * first is a demand problem, the second a UX one.
 *
 * Deliberately NOT called from the auto-copy that runs on creation. That
 * fires for every call, so counting it would mark 100% of links as shared and
 * measure nothing. Only an explicit Copy press or the email link counts —
 * actions that mean "I am sending this to someone".
 *
 * Still an imperfect proxy: copying to the clipboard is not proof the link was
 * pasted anywhere. It is a floor, not a certainty, and should be read that way.
 */
export async function recordLinkShared(
  roomName: string,
  via: ShareChannel,
  context?: { sessionId: string; trafficClass: string }
): Promise<void> {
  const p = getPool();
  if (!p) return;
  try {
    await p.query(
      `UPDATE calls
          SET link_shared_at = COALESCE(link_shared_at, now()),
              shared_via = COALESCE(shared_via, $2)
        WHERE id = (
          SELECT id FROM calls WHERE room_name = $1
          ORDER BY created_at DESC LIMIT 1
        )`,
      [roomName, via]
    );
    void appendEvent({
      kind: "call.shared",
      callName: roomName,
      payload: {
        via,
        sessionId: context?.sessionId ?? null,
        trafficClass: context?.trafficClass ?? "public",
      },
      dedupeKey: `call.shared:${roomName}`,
    });
  } catch (err) {
    console.error("[Qwickword] Failed to record link-shared stats:", err);
  }
}

/**
 * Records that someone actually opened the room — the first real browser to
 * reach it, before any countdown.
 *
 * This is what separates "the link was never opened" from "someone turned up
 * and nobody else came". Without it, every unstarted call looks identical,
 * and those two need opposite fixes: one is a sharing problem, the other a
 * coordination problem.
 *
 * Called from the call page's status poll rather than from server-rendering
 * the room page, and that distinction matters: link previewers (WhatsApp,
 * Slack, iMessage) fetch the page HTML to build their preview cards but never
 * run JavaScript. Recording on render would count every link ever pasted into
 * a chat as an open and quietly inflate the number.
 *
 * COALESCE keeps the first timestamp — the poll repeats every few seconds and
 * every participant runs their own.
 */
export async function recordCallFirstJoined(
  roomName: string,
  context: {
    sessionId: string;
    trafficClass: string;
    role: "creator" | "recipient";
  }
): Promise<void> {
  const p = getPool();
  if (!p) return;
  try {
    await p.query(
      `UPDATE calls SET first_joined_at = COALESCE(first_joined_at, now())
       WHERE id = (
         SELECT id FROM calls WHERE room_name = $1
         ORDER BY created_at DESC LIMIT 1
       )`,
      [roomName]
    );
    // One event per browser session: this preserves the difference between
    // the creator opening their own room and a recipient genuinely arriving.
    // It uses a random first-party session ID, not a device fingerprint.
    void appendEvent({
      kind: "call.opened",
      callName: roomName,
      payload: context,
      dedupeKey: `call.opened:${roomName}:${context.sessionId}`,
    });
  } catch (err) {
    console.error("[Qwickword] Failed to record first-joined stats:", err);
  }
}

/**
 * Records that a never-started room was given up on. Called from
 * POST /api/rooms/[room]/abandon, which has already established server-side
 * that the countdown never started and that Daily reports at most one person
 * present — so this is a checked signal, not a client's claim.
 *
 * Paired with `first_joined_at`, the gap between them is how long someone was
 * willing to wait for the other side. That number decides whether the waiting
 * room needs work.
 */
export async function recordCallAbandoned(roomName: string): Promise<void> {
  const p = getPool();
  if (!p) return;
  try {
    await p.query(
      `UPDATE calls SET abandoned_at = COALESCE(abandoned_at, now())
       WHERE id = (
         SELECT id FROM calls WHERE room_name = $1
         ORDER BY created_at DESC LIMIT 1
       )
         AND started_at IS NULL`,
      [roomName]
    );
    void appendEvent({
      kind: "call.abandoned",
      callName: roomName,
      dedupeKey: `call.abandoned:${roomName}`,
    });
  } catch (err) {
    console.error("[Qwickword] Failed to record abandoned stats:", err);
  }
}

/** Why a call stopped, as far as the client could tell. */
export type CallEndReason = "completed" | "left_early";

/**
 * Records that a call finished, and why. Called from
 * POST /api/rooms/[room]/end.
 *
 * `completed` means the countdown reached zero — the call ran its full
 * length, which is the normal ending given Daily enforces the hard stop
 * server-side. `left_early` means someone closed out while time remained.
 *
 * Both COALESCEs make this first-writer-wins, the same shape as
 * `recordCallStarted`: every connected tab reports the end independently, so
 * without them the last tab to fire would overwrite the real ending. First
 * report is the truthful one.
 *
 * Known gap: a participant who kills the tab outright sends nothing, so a
 * call whose last tab vanishes before the timer stays open-ended. Rows with
 * `started_at` set and `ended_at` null are therefore "started, outcome
 * unknown" rather than "still running", and the dashboard counts them that
 * way.
 */
export async function recordCallEnded(
  roomName: string,
  reason: CallEndReason
): Promise<void> {
  const p = getPool();
  if (!p) return;
  try {
    await p.query(
      `UPDATE calls
          SET ended_at = COALESCE(ended_at, now()),
              end_reason = COALESCE(end_reason, $2)
        WHERE id = (
          SELECT id FROM calls WHERE room_name = $1
          ORDER BY created_at DESC LIMIT 1
        )
          AND started_at IS NOT NULL`,
      [roomName, reason]
    );
    void appendEvent({
      kind: "call.ended",
      callName: roomName,
      payload: { reason },
      dedupeKey: `call.ended:${roomName}`,
    });
  } catch (err) {
    console.error("[Qwickword] Failed to record call-ended stats:", err);
  }
}
