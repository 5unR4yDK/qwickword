-- 0001_baseline.sql
--
-- The schema as it already exists in Neon on 31 July 2026, captured so the
-- database can be rebuilt from this repository. Everything before this point
-- was applied by hand and existed nowhere in version control.
--
-- This file is a RECORD, not a change. Running it against the production
-- database is a no-op by design: every statement is guarded with IF NOT EXISTS.
-- Its purpose is to give migration 0002 and everything after it a known
-- starting point, and to let a fresh environment be created from scratch.
--
-- Read out of `information_schema` rather than reconstructed from the queries
-- in src/lib/db.ts, so the column order, defaults and index definitions are
-- what Postgres actually reports.

-- ---------------------------------------------------------------------------
-- rooms — a persistent place with a stable URL, a name and a default length.
--
-- The table exists but has never held a row: it was created ahead of the UI
-- that would use it. A room is a persistent place with a stable URL; the calls
-- held inside one are ordinary Qwickwords, unchanged.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rooms (
  id                       bigserial PRIMARY KEY,
  slug                     text NOT NULL UNIQUE,
  name                     text,
  default_duration_seconds integer NOT NULL,
  created_at               timestamptz NOT NULL DEFAULT now(),
  last_used_at             timestamptz,
  -- Set when a room is retired. Rooms are never deleted, so their calls and
  -- events keep their foreign keys.
  closed_at                timestamptz
);

CREATE INDEX IF NOT EXISTS rooms_last_used_idx
  ON rooms (last_used_at DESC NULLS LAST);

-- ---------------------------------------------------------------------------
-- calls — one row per Qwickword, whether or not anybody turned up.
--
-- `room_name` is the Daily room slug and is the natural key clients use; `id`
-- is only for joins. A call may belong to a persistent room (`room_id`) or
-- stand alone, which is what keeps one-off links working exactly as before.
--
-- The nullable timestamps are the funnel, and each answers a different
-- question: created but never sent, sent but never opened, opened but nobody
-- came, started, finished.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS calls (
  id               bigserial PRIMARY KEY,
  room_name        text NOT NULL,
  duration_seconds integer NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  started_at       timestamptz,
  ended_at         timestamptz,
  end_reason       text,
  first_joined_at  timestamptz,
  abandoned_at     timestamptz,
  link_shared_at   timestamptz,
  shared_via       text,
  room_id          bigint REFERENCES rooms(id)
);

CREATE INDEX IF NOT EXISTS calls_created_at_idx ON calls (created_at);
CREATE INDEX IF NOT EXISTS calls_room_idx ON calls (room_id, created_at DESC);
CREATE INDEX IF NOT EXISTS calls_room_name_created_at_idx
  ON calls (room_name, created_at DESC);

-- ---------------------------------------------------------------------------
-- events — append-only fact log.
--
-- `server_seq` is a separate sequence from `id` so a consumer can resume from
-- a position without depending on insertion order of the primary key.
--
-- `dedupe_key` plus the partial unique index below is what makes every write
-- idempotent: each tab in a call reports independently, and the first report
-- wins rather than the last.
-- ---------------------------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS events_server_seq;

CREATE TABLE IF NOT EXISTS events (
  id         bigserial PRIMARY KEY,
  server_seq bigint NOT NULL DEFAULT nextval('events_server_seq'),
  room_id    bigint REFERENCES rooms(id),
  call_name  text,
  kind       text NOT NULL,
  payload    jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  dedupe_key text
);

CREATE UNIQUE INDEX IF NOT EXISTS events_seq_idx ON events (server_seq);
CREATE UNIQUE INDEX IF NOT EXISTS events_dedupe_idx
  ON events (dedupe_key) WHERE dedupe_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS events_room_idx ON events (room_id, server_seq);
CREATE INDEX IF NOT EXISTS events_call_idx ON events (call_name, server_seq);
CREATE INDEX IF NOT EXISTS events_kind_idx ON events (kind, created_at DESC);

-- ---------------------------------------------------------------------------
-- call_timings — the reliability numbers, and nothing identifying.
--
-- `call_name` is a generated slug, not a person. There is no session, device
-- or user column here and there should not be one.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS call_timings (
  id          bigserial PRIMARY KEY,
  call_name   text NOT NULL,
  metric      text NOT NULL,
  ms          integer NOT NULL,
  surface     text,
  recorded_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS call_timings_metric_idx
  ON call_timings (metric, recorded_at DESC);
