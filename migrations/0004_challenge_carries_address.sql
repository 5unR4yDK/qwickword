-- 0004_challenge_carries_address.sql
--
-- A challenge has to carry the encrypted address, not just its lookup hash.
--
-- The account is created at *verify* time, not when the code is sent — that is
-- what stops the send endpoint being an account-existence oracle. But at verify
-- time the only thing on hand was `lookup_hash`, which is one-way. There was no
-- way to recover the address in order to store it against the new user, so
-- every first-time account would have been created with no address and a
-- display name of "Someone".
--
-- Carrying `value_enc` on the challenge closes that: the row is short-lived,
-- already holds a code hash, and is deleted or consumed within ten minutes.
--
-- The table is empty, so this is added NOT NULL with no backfill.

ALTER TABLE auth_challenges ADD COLUMN IF NOT EXISTS value_enc text;

-- No rows exist; the guard is here so a re-run cannot fail on a stray one.
DELETE FROM auth_challenges WHERE value_enc IS NULL;

ALTER TABLE auth_challenges ALTER COLUMN value_enc SET NOT NULL;
