-- 0007_push_receipts.sql
--
-- Expo first returns a ticket, then publishes the provider receipt later.
-- Keeping the ticket lets the next push send check mature receipts, retire a
-- device APNs/FCM has rejected, and expose credential failures without holding
-- a call-start request open for fifteen minutes.

CREATE TABLE IF NOT EXISTS push_receipts (
  receipt_id    text PRIMARY KEY,
  push_token_id bigint NOT NULL REFERENCES push_tokens(id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  checked_at    timestamptz,
  status        text CHECK (status IN ('ok', 'error', 'expired')),
  error_code    text
);

-- Postgres does not index foreign keys automatically.
CREATE INDEX IF NOT EXISTS push_receipts_push_token_idx
  ON push_receipts (push_token_id);

-- The normal drain reads only unchecked receipts in age order.
CREATE INDEX IF NOT EXISTS push_receipts_pending_idx
  ON push_receipts (created_at)
  WHERE checked_at IS NULL;
