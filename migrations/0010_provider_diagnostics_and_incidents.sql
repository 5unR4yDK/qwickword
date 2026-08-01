-- 0010_provider_diagnostics_and_incidents.sql
--
-- Client-only evidence cannot distinguish a device-clock or lifecycle defect
-- from what Daily actually observed. These tables add a deliberately narrow,
-- short-lived provider timeline, a user-visible incident reference, and an
-- observable retention heartbeat. No webhook body, participant name, user ID,
-- room slug, contact data, or permanent device identifier is stored here.

CREATE TABLE IF NOT EXISTS call_provider_events (
  provider_event_id          text PRIMARY KEY,
  call_id                    bigint NOT NULL REFERENCES calls(id),
  event_type                 text NOT NULL CHECK (
    event_type IN ('participant.joined', 'participant.left', 'meeting.ended')
  ),
  provider_timestamp         timestamptz NOT NULL,
  provider_session_hash      text,
  joined_at                  timestamptz,
  left_at                    timestamptz,
  duration_seconds           double precision,
  scheduled_eject_at         timestamptz,
  meeting_started_at         timestamptz,
  meeting_ended_at           timestamptz,
  received_at                timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS call_provider_events_call_time_idx
  ON call_provider_events (call_id, provider_timestamp);

CREATE INDEX IF NOT EXISTS call_provider_events_retention_idx
  ON call_provider_events (received_at);

CREATE TABLE IF NOT EXISTS call_incident_references (
  reference                   text PRIMARY KEY,
  call_id                     bigint NOT NULL REFERENCES calls(id),
  client_call_session_id      uuid NOT NULL,
  surface                     text NOT NULL CHECK (surface IN ('web', 'ios')),
  app_version                 text,
  created_at                  timestamptz NOT NULL DEFAULT now(),
  expires_at                  timestamptz NOT NULL DEFAULT (now() + interval '14 days')
);

CREATE INDEX IF NOT EXISTS call_incident_references_expiry_idx
  ON call_incident_references (expires_at);

CREATE TABLE IF NOT EXISTS diagnostic_retention_state (
  singleton_id                smallint PRIMARY KEY CHECK (singleton_id = 1),
  last_started_at             timestamptz,
  last_succeeded_at           timestamptz,
  last_failed_at              timestamptz,
  last_error_category         text,
  last_client_events_deleted  integer NOT NULL DEFAULT 0,
  last_provider_events_deleted integer NOT NULL DEFAULT 0,
  last_start_attempts_deleted integer NOT NULL DEFAULT 0,
  last_incident_refs_deleted  integer NOT NULL DEFAULT 0
);

INSERT INTO diagnostic_retention_state (singleton_id)
VALUES (1)
ON CONFLICT (singleton_id) DO NOTHING;
