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

/** How a link was deliberately sent. */
export type ShareChannel = "copy" | "email";

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
  via: ShareChannel
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
export async function recordCallFirstJoined(roomName: string): Promise<void> {
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
  } catch (err) {
    console.error("[Qwickword] Failed to record call-ended stats:", err);
  }
}
