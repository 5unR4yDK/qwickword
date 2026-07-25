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
  durationSeconds: number
): Promise<boolean> {
  const p = getPool();
  if (!p) return false;
  try {
    await p.query(
      `INSERT INTO calls (room_name, duration_seconds) VALUES ($1, $2)`,
      [roomName, durationSeconds]
    );
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
 * this mirrors that: `COALESCE(started_at, now())` only ever sets it once,
 * no matter how many times this is called for the same room.
 */
export async function recordCallStarted(roomName: string): Promise<void> {
  const p = getPool();
  if (!p) return;
  try {
    // Scoped to the latest row for the name — with per-call rows, an old
    // call that once used the same (reused) slug must not be touched.
    await p.query(
      `UPDATE calls SET started_at = COALESCE(started_at, now())
       WHERE id = (
         SELECT id FROM calls WHERE room_name = $1
         ORDER BY created_at DESC LIMIT 1
       )`,
      [roomName]
    );
  } catch (err) {
    console.error("[Qwickword] Failed to record call-started stats:", err);
  }
}

// recordCallEndedEarly (the "vote to end early" stats hook) was removed
// alongside the rest of that feature. The `end_reason`/`ended_at` columns
// stay in the `calls` table (harmless, no migration needed) in case the
// feature comes back later; nothing writes to them right now.
