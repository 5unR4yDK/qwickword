-- 0002_room_owner_keys.sql
--
-- Splits a room's one link into two capabilities.
--
-- Until now `/r/{slug}` meant "open this room and start a call in it" AND
-- "rename it, change its length, close it forever". Those are not one
-- permission, and conflating them meant anyone sent a room link could retire
-- the room. The fix needs no accounts: the slug keeps granting the first set,
-- and a separate high-entropy key grants the second.
--
-- Only a hash is stored. A leak of this table reveals which rooms exist —
-- already true of any slug — but grants nobody the ability to close one.
--
-- The key is returned once at creation and never again; only its hash is here.

ALTER TABLE rooms ADD COLUMN IF NOT EXISTS owner_key_hash text;

-- Exactly one room exists at the time of writing, a closed test room, and
-- nobody holds a key for it. An empty hash matches no key, so it becomes
-- permanently unmanageable — which is the correct outcome, not a loss.
UPDATE rooms SET owner_key_hash = '' WHERE owner_key_hash IS NULL;

ALTER TABLE rooms ALTER COLUMN owner_key_hash SET NOT NULL;
