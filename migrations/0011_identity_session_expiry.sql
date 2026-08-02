-- 0011_identity_session_expiry.sql
--
-- The browser cookie has always expired after 30 days, but the matching
-- server session did not. A copied mobile token could therefore outlive the
-- product's stated session lifetime indefinitely. Backfill existing rows from
-- their creation time and make expiry part of every authorization decision.

ALTER TABLE sessions ADD COLUMN IF NOT EXISTS expires_at timestamptz;

UPDATE sessions
   SET expires_at = created_at + interval '30 days'
 WHERE expires_at IS NULL;

-- Keep the migration deploy-safe while the previous application version may
-- still create sessions between this migration and the new deployment.
ALTER TABLE sessions
  ALTER COLUMN expires_at SET DEFAULT (now() + interval '30 days');

ALTER TABLE sessions ALTER COLUMN expires_at SET NOT NULL;

CREATE INDEX IF NOT EXISTS sessions_expiry_idx ON sessions (expires_at);
