// The contact graph, such as it is.
//
// One rule shapes every query here: **you may only learn about someone you have
// already been in a call with.** There is no lookup by address, no search, and
// no way to ask whether a given person has an account. The graph grows from
// things that happened between two people, never from a list one of them
// uploaded.
//
// A second rule follows from the first: keeping someone is private. It does not
// notify them, does not add you to their list, and is not visible to them.
// Mutuality is derived when both sides happen to have kept each other.
import { Pool } from "pg";

let pool: Pool | null = null;

function getPool(): Pool | null {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) return null;
  if (!pool) pool = new Pool({ connectionString, max: 1 });
  return pool;
}

export type Contact = {
  userId: string;
  /** What this owner calls them, or what they call themselves. */
  displayName: string;
  /** True when they have kept you too. Derived, never stored. */
  mutual: boolean;
  createdAt: string;
};

export type CallPeer = {
  userId: string;
  displayName: string;
  /** Whether they are already in the caller's contacts. */
  kept: boolean;
};

/**
 * Records that a signed-in person was in a call.
 *
 * Idempotent: every client reports independently and a rejoin is normal, so the
 * first write wins and the rest are no-ops. Guests are never recorded, because
 * this is only ever called with a resolved session.
 */
export async function recordParticipant(
  callName: string,
  userId: string
): Promise<void> {
  const p = getPool();
  if (!p) return;
  try {
    await p.query(
      `INSERT INTO call_participants (call_name, user_id)
       VALUES ($1, $2)
       ON CONFLICT (call_name, user_id) DO NOTHING`,
      [callName, userId]
    );
  } catch (err) {
    console.error("[Qwickword] Failed to record a call participant:", err);
  }
}

/**
 * The other signed-in people in a call.
 *
 * Returns nothing at all unless the asker was themselves in that call. Without
 * that check this endpoint would let anyone holding a call slug enumerate who
 * had been in it — and call slugs travel in links, so that is not a secret.
 *
 * Guests never appear. Someone who joined without an account was never
 * recorded, and cannot be kept.
 */
export async function peersInCall(
  callName: string,
  askerId: string
): Promise<CallPeer[]> {
  const p = getPool();
  if (!p) return [];
  try {
    const wasThere = await p.query(
      `SELECT 1 FROM call_participants WHERE call_name = $1 AND user_id = $2`,
      [callName, askerId]
    );
    if (wasThere.rowCount === 0) return [];

    const result = await p.query<{
      user_id: string;
      display_name: string;
      kept: boolean;
    }>(
      `SELECT cp.user_id,
              u.display_name,
              (c.owner_user_id IS NOT NULL) AS kept
         FROM call_participants cp
         JOIN users u ON u.id = cp.user_id
         LEFT JOIN contacts c
                ON c.owner_user_id = $2 AND c.contact_user_id = cp.user_id
        WHERE cp.call_name = $1
          AND cp.user_id <> $2
          AND u.deleted_at IS NULL
        ORDER BY cp.joined_at`,
      [callName, askerId]
    );
    return result.rows.map((r) => ({
      userId: r.user_id,
      displayName: r.display_name,
      kept: r.kept,
    }));
  } catch (err) {
    console.error("[Qwickword] Failed to read call peers:", err);
    return [];
  }
}

/**
 * Keeps someone.
 *
 * Refuses unless the two have shared a call, which is what stops this being a
 * way to attach yourself to an arbitrary user id. Returns false rather than
 * throwing so the caller can say "you can only keep people you have called"
 * without distinguishing that from "no such person" — the two must look the
 * same, or this becomes a way to test whether a user id exists.
 */
export async function keepContact(
  ownerId: string,
  contactId: string,
  displayName: string | null
): Promise<boolean> {
  if (ownerId === contactId) return false;
  const p = getPool();
  if (!p) return false;
  try {
    const shared = await p.query(
      `SELECT 1
         FROM call_participants a
         JOIN call_participants b ON b.call_name = a.call_name
        WHERE a.user_id = $1 AND b.user_id = $2
        LIMIT 1`,
      [ownerId, contactId]
    );
    if (shared.rowCount === 0) return false;

    await p.query(
      `INSERT INTO contacts (owner_user_id, contact_user_id, display_name, source)
       VALUES ($1, $2, $3, 'link')
       ON CONFLICT (owner_user_id, contact_user_id)
       DO UPDATE SET display_name = EXCLUDED.display_name`,
      [ownerId, contactId, displayName?.trim() || null]
    );
    return true;
  } catch (err) {
    console.error("[Qwickword] Failed to keep a contact:", err);
    return false;
  }
}

/** One person's list, newest first. */
export async function listContacts(ownerId: string): Promise<Contact[]> {
  const p = getPool();
  if (!p) return [];
  try {
    const result = await p.query<{
      contact_user_id: string;
      display_name: string | null;
      their_name: string;
      created_at: Date;
      mutual: boolean;
    }>(
      `SELECT c.contact_user_id,
              c.display_name,
              u.display_name AS their_name,
              c.created_at,
              EXISTS (
                SELECT 1 FROM contacts back
                 WHERE back.owner_user_id = c.contact_user_id
                   AND back.contact_user_id = $1
              ) AS mutual
         FROM contacts c
         JOIN users u ON u.id = c.contact_user_id
        WHERE c.owner_user_id = $1
          AND u.deleted_at IS NULL
        ORDER BY c.created_at DESC`,
      [ownerId]
    );
    return result.rows.map((r) => ({
      userId: r.contact_user_id,
      // The owner's own label wins. It is theirs, and nobody else sees it.
      displayName: r.display_name ?? r.their_name,
      mutual: r.mutual,
      createdAt: String(r.created_at),
    }));
  } catch (err) {
    console.error("[Qwickword] Failed to list contacts:", err);
    return [];
  }
}

/** Forgets someone. Their own list is untouched; they are not told. */
export async function forgetContact(
  ownerId: string,
  contactId: string
): Promise<void> {
  const p = getPool();
  if (!p) return;
  try {
    await p.query(
      `DELETE FROM contacts WHERE owner_user_id = $1 AND contact_user_id = $2`,
      [ownerId, contactId]
    );
  } catch (err) {
    console.error("[Qwickword] Failed to forget a contact:", err);
  }
}
