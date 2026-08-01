-- 0006_push_tokens.sql
--
-- The signed-in devices where a person can be reached.
--
-- A push token belongs to one device session, not just to a user. That keeps
-- signing out local to the device: revoking one session also revokes only that
-- session's notification route, while the same person may remain reachable on
-- another phone. Tokens are retired rather than deleted so rotation, sign-out
-- and delivery failures leave an auditable history without keeping an old
-- token active.
--
-- Guest calls remain completely outside this table. Registration requires a
-- live session and nothing in call creation or joining consults push state.

CREATE TABLE IF NOT EXISTS push_tokens (
  id           bigserial PRIMARY KEY,
  user_id      uuid NOT NULL REFERENCES users(id),
  session_id   uuid NOT NULL REFERENCES sessions(id),
  token        text NOT NULL,
  platform     text NOT NULL CHECK (platform IN ('ios', 'android')),
  -- A model-class label chosen by the app, never a device fingerprint.
  device_label text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  revoked_at   timestamptz
);

-- A live Expo token routes to one signed-in device. Keeping this partial lets
-- a rotated token be registered again later without erasing its old row.
CREATE UNIQUE INDEX IF NOT EXISTS push_tokens_active_token_idx
  ON push_tokens (token) WHERE revoked_at IS NULL;

-- One Qwickword session is one app installation and has one current token.
CREATE UNIQUE INDEX IF NOT EXISTS push_tokens_active_session_idx
  ON push_tokens (session_id) WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS push_tokens_user_idx
  ON push_tokens (user_id, created_at DESC);
