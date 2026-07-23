// Optional Postgres-backed call-stats store (2026-07-22, Andreas, interactive:
// "can you help me understand how we store memory of how many calls have been
// made and how many minutes have been done... I'd want to have that stored
// somewhere"). Backed by Neon, provisioned via the Vercel Marketplace
// integration — `DATABASE_URL` is set automatically in every Vercel
// environment once that integration is connected to this project; see
// STATUS.md for the setup story and the `calls` table schema.
//
// This is deliberately NOT part of the app's core state model. Everything
// else in this codebase (BUILD_PLAN.md, daily-rooms.ts) is built around "no
// datastore — Daily's own room `exp` is the single source of truth," and that
// stays true: a database outage here can never break creating, starting, or
// ending a call. Every function below is a fire-and-forget write, wrapped in
// try/catch, that only ever *records* what already happened via the real
// (Daily-backed) flow. `DATABASE_URL` being unset (e.g. local dev without a
// linked Neon database) is treated the same as a write failure: silently
// skip, don't throw.
import { Pool } from "pg";

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
 * `ON CONFLICT DO NOTHING` makes this safe to call more than once for the
 * same room name (shouldn't happen — Daily's own room names are unique per
 * create call — but costs nothing to guard against).
 */
export async function recordCallCreated(
  roomName: string,
  durationSeconds: number
): Promise<void> {
  const p = getPool();
  if (!p) return;
  try {
    await p.query(
      `INSERT INTO calls (room_name, duration_seconds)
       VALUES ($1, $2)
       ON CONFLICT (room_name) DO NOTHING`,
      [roomName, durationSeconds]
    );
  } catch (err) {
    console.error("[Qwickword] Failed to record call-created stats:", err);
  }
}

/**
 * Records that a room's real countdown has started. Called from
 * POST /api/rooms/[room]/start right after `startRoomCountdown` succeeds —
 * that route is called from two places (manual "Start now", and every
 * connected tab's own auto-start detection) and is itself idempotent, so
 * this mirrors that: `COALESCE(started_at, now())` only ever sets it once,
 * no matter how many times this is called for the same room.
 */
export async function recordCallStarted(roomName: string): Promise<void> {
  const p = getPool();
  if (!p) return;
  try {
    await p.query(
      `UPDATE calls SET started_at = COALESCE(started_at, now()) WHERE room_name = $1`,
      [roomName]
    );
  } catch (err) {
    console.error("[Qwickword] Failed to record call-started stats:", err);
  }
}

// recordCallEndedEarly (the "vote to end early" stats hook) was removed
// 2026-07-23 alongside the rest of that feature — see ROADMAP.md. The
// `end_reason`/`ended_at` columns stay in the `calls` table (harmless, no
// migration needed) in case the feature comes back later; nothing writes to
// them right now.
