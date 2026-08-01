// Read-only support lookup for an opaque QW-... reference. It intentionally
// emits no room slug, account/contact data, provider identifier, or raw payload.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const HERE = dirname(fileURLToPath(import.meta.url));
const reference = process.argv[2]?.trim().toUpperCase();
if (!reference || !/^QW-[0-9A-F]{12}$/.test(reference)) {
  throw new Error("Usage: npm run incident -- QW-XXXXXXXXXXXX");
}

function databaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const env = readFileSync(join(HERE, "..", ".env.local"), "utf8");
  const line = env.split(/\r?\n/).find((item) => item.startsWith("DATABASE_URL="));
  if (!line) throw new Error("DATABASE_URL is not configured.");
  return line.slice("DATABASE_URL=".length).replace(/^["']|["']$/g, "");
}

const client = new pg.Client({ connectionString: databaseUrl() });
await client.connect();
try {
  const incident = await client.query(
    `SELECT r.reference, r.call_id::text, r.client_call_session_id,
            r.surface, r.app_version, r.created_at, r.expires_at,
            c.duration_seconds, c.created_at AS call_created_at,
            c.started_at, c.ended_at, c.end_reason, c.first_joined_at,
            c.abandoned_at, c.authoritative_exp_seconds,
            c.countdown_started_at, c.countdown_start_source,
            c.winning_countdown_attempt_id
       FROM call_incident_references r
       JOIN calls c ON c.id = r.call_id
      WHERE r.reference = $1 AND r.expires_at > now()`,
    [reference]
  );
  const summary = incident.rows[0];
  if (!summary) throw new Error("Reference not found or its 14-day window expired.");

  const [clients, starts, provider] = await Promise.all([
    client.query(
      `SELECT client_call_session_id, sequence, event_name, surface,
              app_version, client_wall_time_ms::text,
              client_monotonic_ms, server_received_at_ms::text,
              server_now_ms::text, rtt_ms, server_processing_ms,
              clock_offset_ms, authoritative_exp_ms::text, phase, source,
              participant_count, end_trigger, error_category, received_at
         FROM call_diagnostic_events
        WHERE call_id = $1
        ORDER BY received_at, client_call_session_id, sequence`,
      [summary.call_id]
    ),
    client.query(
      `SELECT attempt_id, source, requested_duration_seconds, outcome,
              accepted_exp_seconds::text, error_category, created_at, completed_at
         FROM call_countdown_attempts
        WHERE call_id = $1
        ORDER BY created_at`,
      [summary.call_id]
    ),
    client.query(
      `SELECT provider_event_id, event_type, provider_timestamp,
              provider_session_hash, joined_at, left_at, duration_seconds,
              scheduled_eject_at, meeting_started_at, meeting_ended_at, received_at
         FROM call_provider_events
        WHERE call_id = $1
        ORDER BY provider_timestamp, provider_event_id`,
      [summary.call_id]
    ),
  ]);

  const participantCount = new Set(
    provider.rows
      .filter((row) => row.event_type === "participant.joined")
      .map((row) => row.provider_session_hash)
      .filter(Boolean)
  ).size;
  console.log(
    JSON.stringify(
      {
        incident: summary,
        serverStartAttempts: starts.rows,
        clientTimeline: clients.rows,
        providerTimeline: provider.rows,
        providerParticipantCount: participantCount,
      },
      null,
      2
    )
  );
} finally {
  await client.end();
}
