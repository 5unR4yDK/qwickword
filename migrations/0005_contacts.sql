-- 0005_contacts.sql
--
-- People you can call, built from calls you have actually had.
--
-- The rule this encodes: **if you have had a Qwickword with someone, you may
-- keep them.** No address book upload, no discovery, no asking the server "is
-- this phone number a user". The graph is built from things that already
-- happened between two people rather than from a list of everyone one of them
-- knows.
--
-- PRODUCT_REQUIREMENTS I10 dropped address-book upload on the stated grounds
-- that "phone verification does not silently become contact discovery". This
-- is the version of a contact list that does not reverse that decision.

-- ---------------------------------------------------------------------------
-- call_participants — who was in a call, among people with accounts.
--
-- Written only for signed-in participants. A guest joining from a link is not
-- recorded, has no row here, and cannot be kept as a contact — which is the
-- whole point of guest-first: turning up needs no account and leaves no trace.
--
-- `call_name` is the Daily slug rather than a foreign key to `calls`, because a
-- call row may not exist yet when someone joins and this must not depend on
-- ordering.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS call_participants (
  call_name text NOT NULL,
  user_id   uuid NOT NULL REFERENCES users(id),
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (call_name, user_id)
);

CREATE INDEX IF NOT EXISTS call_participants_user_idx
  ON call_participants (user_id, joined_at DESC);

-- ---------------------------------------------------------------------------
-- contacts — one person's list. Deliberately NOT symmetric.
--
-- Keeping someone does not add you to their list and does not notify them.
-- Mutuality is derived (`a→b AND b→a`) rather than stored, which removes the
-- three things that make social products feel like paperwork: a pending queue,
-- an accept/decline decision, and a request that can be left unanswered.
--
-- `display_name` is this owner's own label for the person — "Sarah from Acme" —
-- and is null when they are happy with whatever the person calls themselves.
-- One person's label is never visible to anyone else.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS contacts (
  owner_user_id   uuid NOT NULL REFERENCES users(id),
  contact_user_id uuid NOT NULL REFERENCES users(id),
  display_name    text,
  -- 'link'       — we were in a call together. The only source built today.
  -- 'discovered' — found via a contact-book lookup. Not built; see I10.
  -- 'manual'     — typed in. Not built.
  source          text NOT NULL CHECK (source IN ('link', 'discovered', 'manual')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_user_id, contact_user_id),
  -- Keeping yourself is not a thing.
  CONSTRAINT contacts_not_self CHECK (owner_user_id <> contact_user_id)
);

CREATE INDEX IF NOT EXISTS contacts_owner_idx
  ON contacts (owner_user_id, created_at DESC);
