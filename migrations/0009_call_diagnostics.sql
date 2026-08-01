-- 0009_call_diagnostics.sql
--
-- A real asymmetric early-ending incident could be narrowed to clock skew but
-- not proved because the existing aggregate timing table has no per-client
-- clock sample, authoritative expiry, lifecycle transition, or end trigger.
-- This table is deliberately narrow and short-lived: one random session per
-- call opening, no permanent device/user identifier, and no free-form payload.

CREATE TABLE IF NOT EXISTS call_diagnostic_events (
  event_id                  uuid PRIMARY KEY,
  call_id                   bigint NOT NULL REFERENCES calls(id),
  client_call_session_id    uuid NOT NULL,
  sequence                  integer NOT NULL,
  event_name                text NOT NULL,
  surface                   text NOT NULL,
  app_version               text,
  client_wall_time_ms       bigint NOT NULL,
  client_monotonic_ms       double precision NOT NULL,
  server_received_at_ms     bigint,
  server_now_ms             bigint,
  rtt_ms                    integer,
  server_processing_ms      integer,
  clock_offset_ms           integer,
  authoritative_exp_ms      bigint,
  phase                     text,
  source                    text,
  participant_count         integer,
  end_trigger               text,
  error_category            text,
  received_at               timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_call_session_id, sequence)
);

CREATE INDEX IF NOT EXISTS call_diagnostic_events_call_time_idx
  ON call_diagnostic_events (call_id, received_at);

CREATE INDEX IF NOT EXISTS call_diagnostic_events_retention_idx
  ON call_diagnostic_events (received_at);

-- A database claim chooses one start request before any caller patches Daily.
-- The active attempt is cleared on success/failure; the winning attempt and
-- accepted expiry remain as the incident record.
ALTER TABLE calls
  ADD COLUMN IF NOT EXISTS authoritative_exp_seconds bigint,
  ADD COLUMN IF NOT EXISTS countdown_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS countdown_start_source text,
  ADD COLUMN IF NOT EXISTS countdown_start_attempt_id uuid,
  ADD COLUMN IF NOT EXISTS countdown_start_claimed_at timestamptz,
  ADD COLUMN IF NOT EXISTS winning_countdown_attempt_id uuid;

CREATE TABLE IF NOT EXISTS call_countdown_attempts (
  attempt_id                 uuid PRIMARY KEY,
  call_id                    bigint NOT NULL REFERENCES calls(id),
  source                     text NOT NULL,
  requested_duration_seconds integer NOT NULL,
  outcome                    text NOT NULL,
  accepted_exp_seconds       bigint,
  error_category             text,
  created_at                 timestamptz NOT NULL DEFAULT now(),
  completed_at               timestamptz
);

CREATE INDEX IF NOT EXISTS call_countdown_attempts_call_time_idx
  ON call_countdown_attempts (call_id, created_at);
