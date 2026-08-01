-- 0003_identity.sql
--
-- Accounts, so that a person can be reached rather than only sent a link.
--
-- Everything the product does today is bearer-credential: hold a call link and
-- you may join; hold a room's owner key and you may close it. That model has no
-- way to express "ring Sarah", because there is no Sarah — only URLs. Push
-- notifications, a contact list and an incoming-call screen all need a durable
-- record of a person and their devices. This is that record.
--
-- Guest calls are unaffected and must stay that way. A stranger opening a link
-- still needs no account, and nothing below is consulted on that path.
--
-- Shape follows BUILD_SPECS.md §B6. It deliberately does NOT extend the
-- platform's `qwickword_identity` schema, which lives in a different repository
-- and a different database and is hard-constrained to OIDC. Unifying the two is
-- a later migration and a decision that has not been made; see IDENTITY_SPEC.md
-- for what that would involve.

-- ---------------------------------------------------------------------------
-- users — a person. Nothing here identifies them.
--
-- `id` is an owned UUID, never derived from an email, phone number or any
-- provider's subject. Provider identifiers change; a user id must not.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id           uuid PRIMARY KEY,
  display_name text NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  -- Soft delete. A deleted user's rooms and calls keep their foreign keys,
  -- and the row stops matching any lookup.
  deleted_at   timestamptz
);

-- ---------------------------------------------------------------------------
-- user_identities — the ways in.
--
-- `lookup_hash` is an HMAC of the normalised value, and it is what the login
-- and (later) discovery paths query. The plaintext is never stored: a leak of
-- this table must not become a list of everyone's email address.
--
-- `value_enc` is reversibly encrypted, and exists for exactly two things:
-- showing someone their own masked address back, and delivering a code to it.
-- Nothing else may read it.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_identities (
  id          bigserial PRIMARY KEY,
  user_id     uuid NOT NULL REFERENCES users(id),
  kind        text NOT NULL CHECK (kind IN ('email', 'phone')),
  lookup_hash text NOT NULL UNIQUE,
  value_enc   text NOT NULL,
  verified_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_identities_user_idx ON user_identities (user_id);

-- ---------------------------------------------------------------------------
-- auth_challenges — a one-time code, in flight.
--
-- Short-lived and attempt-limited. `code_hash` rather than the code, for the
-- same reason a password is never stored: a leak of this table must not let
-- someone complete a login that is already in progress.
--
-- Rows are kept briefly after use rather than deleted, so a replayed verify
-- is refused as "already used" instead of silently issuing a second session.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS auth_challenges (
  id          uuid PRIMARY KEY,
  kind        text NOT NULL CHECK (kind IN ('email', 'phone')),
  lookup_hash text NOT NULL,
  code_hash   text NOT NULL,
  attempts    integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL,
  consumed_at timestamptz
);

-- Rate limiting reads by identity and by time, in that order.
CREATE INDEX IF NOT EXISTS auth_challenges_lookup_idx
  ON auth_challenges (lookup_hash, created_at DESC);
CREATE INDEX IF NOT EXISTS auth_challenges_expiry_idx ON auth_challenges (expires_at);

-- ---------------------------------------------------------------------------
-- sessions — one per signed-in device.
--
-- Per-device rather than per-user so a single phone can be signed out without
-- ending every other session, which is what makes "this device was lost" a
-- recoverable event.
--
-- `token_hash` again: the token itself lives only in the device's Keychain.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sessions (
  id           uuid PRIMARY KEY,
  user_id      uuid NOT NULL REFERENCES users(id),
  token_hash   text NOT NULL UNIQUE,
  -- Free text, shown in a future "your devices" list. Never a fingerprint.
  device_label text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  revoked_at   timestamptz
);

CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions (user_id, created_at DESC);
