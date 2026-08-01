-- 0008_account_deletion.sql
--
-- Deleting an account removes contact rows where the person appears on either
-- side. The primary key already indexes owner_user_id; Postgres does not add an
-- index for contact_user_id merely because it is a foreign key.

CREATE INDEX IF NOT EXISTS contacts_contact_idx ON contacts (contact_user_id);
