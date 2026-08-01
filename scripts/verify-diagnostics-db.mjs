// Transactional production-schema check. Every test row is rolled back.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const HERE = dirname(fileURLToPath(import.meta.url));

function databaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const env = readFileSync(join(HERE, "..", ".env.local"), "utf8");
  const line = env.split(/\r?\n/).find((item) => item.startsWith("DATABASE_URL="));
  if (!line) throw new Error("DATABASE_URL is not configured.");
  return line.slice("DATABASE_URL=".length).replace(/^["']|["']$/g, "");
}

const client = new pg.Client({ connectionString: databaseUrl() });
await client.connect();
await client.query("BEGIN");
try {
  const room = `diagnostic-test-${randomUUID()}`;
  const call = await client.query(
    `INSERT INTO calls (room_name, duration_seconds)
     VALUES ($1, 60) RETURNING id`,
    [room]
  );
  const callId = call.rows[0].id;
  const sessionId = randomUUID();
  const now = Date.now();

  await client.query(
    `INSERT INTO call_diagnostic_events (
       event_id, call_id, client_call_session_id, sequence, event_name,
       surface, client_wall_time_ms, client_monotonic_ms, received_at
     ) VALUES
       ($1, $3, $4, 0, 'call.opened', 'web', $5, 1, now() - interval '15 days'),
       ($2, $3, $4, 1, 'call.opened', 'web', $5, 2, now())`,
    [randomUUID(), randomUUID(), callId, sessionId, now]
  );
  const providerId = `provider-${randomUUID()}`;
  await client.query(
    `INSERT INTO call_provider_events (
       provider_event_id, call_id, event_type, provider_timestamp,
       provider_session_hash, received_at
     ) VALUES
       ($1, $3, 'participant.joined', now() - interval '15 days', 'old', now() - interval '15 days'),
       ($2, $3, 'participant.joined', now(), 'new', now())`,
    [providerId, `provider-${randomUUID()}`, callId]
  );
  const duplicate = await client.query(
    `INSERT INTO call_provider_events (
       provider_event_id, call_id, event_type, provider_timestamp
     ) VALUES ($1, $2, 'participant.joined', now())
     ON CONFLICT (provider_event_id) DO NOTHING
     RETURNING provider_event_id`,
    [providerId, callId]
  );
  assert.equal(duplicate.rowCount, 0, "provider event ID must deduplicate");

  await client.query(
    `INSERT INTO call_countdown_attempts (
       attempt_id, call_id, source, requested_duration_seconds, outcome, created_at
     ) VALUES
       ($1, $3, 'unknown', 60, 'started', now() - interval '15 days'),
       ($2, $3, 'unknown', 60, 'started', now())`,
    [randomUUID(), randomUUID(), callId]
  );
  await client.query(
    `INSERT INTO call_incident_references (
       reference, call_id, client_call_session_id, surface, expires_at
     ) VALUES
       ($1, $3, $4, 'web', now() - interval '1 second'),
       ($2, $3, $4, 'web', now() + interval '14 days')`,
    [
      `QW-${randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase()}`,
      `QW-${randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase()}`,
      callId,
      sessionId,
    ]
  );

  const deleted = [];
  deleted.push(
    await client.query(
      `DELETE FROM call_diagnostic_events
        WHERE received_at < now() - interval '14 days'`
    )
  );
  deleted.push(
    await client.query(
      `DELETE FROM call_provider_events
        WHERE received_at < now() - interval '14 days'`
    )
  );
  deleted.push(
    await client.query(
      `DELETE FROM call_countdown_attempts
        WHERE created_at < now() - interval '14 days'`
    )
  );
  deleted.push(
    await client.query(
      `DELETE FROM call_incident_references WHERE expires_at <= now()`
    )
  );
  assert.deepEqual(
    deleted.map((result) => result.rowCount),
    [1, 1, 1, 1],
    "each expired raw-evidence class must be removed"
  );

  const survivors = await client.query(
    `SELECT
       (SELECT count(*) FROM call_diagnostic_events WHERE call_id = $1) AS clients,
       (SELECT count(*) FROM call_provider_events WHERE call_id = $1) AS provider,
       (SELECT count(*) FROM call_countdown_attempts WHERE call_id = $1) AS attempts,
       (SELECT count(*) FROM call_incident_references WHERE call_id = $1) AS incidents`,
    [callId]
  );
  assert.deepEqual(survivors.rows[0], {
    clients: "1",
    provider: "1",
    attempts: "1",
    incidents: "1",
  });
  console.log("diagnostics database contract passed; transaction rolled back");
} finally {
  await client.query("ROLLBACK").catch(() => {});
  await client.end();
}
