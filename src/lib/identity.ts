// Identity, where it meets the database.
//
// The pure half — normalising, hashing, code generation, rate limits — is in
// identity-core.ts and is tested without any of this. What is left here is the
// queries, kept deliberately dull.
//
// Two rules run through every function:
//
//  1. **Never confirm whether an address has an account.** Requesting a code
//     for an unknown address must be indistinguishable from requesting one for
//     a known address, or this endpoint becomes a way to ask "is this person a
//     user". That is why an account is created lazily at *verify*, not at
//     challenge time.
//  2. **Fail closed.** An unreachable database denies a sign-in; it never
//     grants one.
import { Pool } from "pg";
import {
  CHALLENGE_TTL_MS,
  MAX_ATTEMPTS,
  SESSION_TTL_MS,
  codeMatches,
  defaultDisplayName,
  generateCode,
  generateSessionToken,
  hashCode,
  hashSessionToken,
  lookupHash,
  newId,
  rateDecision,
  type IdentityKind,
  type RateDecision,
} from "./identity-core";
import { decryptValue, encryptValue } from "./identity-crypto";

let pool: Pool | null = null;

function getPool(): Pool | null {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) return null;
  if (!pool) pool = new Pool({ connectionString, max: 1 });
  return pool;
}

function secret(): string {
  const value = process.env.IDENTITY_HMAC_SECRET?.trim();
  if (!value) {
    throw new Error(
      "IDENTITY_HMAC_SECRET is not configured. Sign-in cannot work without it."
    );
  }
  return value;
}

export type User = {
  id: string;
  displayName: string;
};

export type StartResult =
  | { ok: true; challengeId: string; expiresAt: string }
  | { ok: false; reason: "rate-limited"; retryAfterMs: number }
  | { ok: false; reason: "unavailable" };

/**
 * Begins a sign-in. Sends a code and returns the challenge to verify against.
 *
 * Creates no user. The account is made at verify time, so this endpoint's
 * behaviour is identical for an address that has an account and one that does
 * not — which is what stops it being an account-existence oracle.
 */
export async function startChallenge(
  kind: IdentityKind,
  value: string,
  send: (to: string, code: string) => Promise<{ ok: boolean; detail?: string }>
): Promise<StartResult> {
  const p = getPool();
  if (!p) return { ok: false, reason: "unavailable" };

  const hash = lookupHash(kind, value, secret());
  const now = Date.now();

  try {
    // The rate window: one hour is enough for both limits in identity-core.
    const recent = await p.query<{ created_at: Date }>(
      `SELECT created_at FROM auth_challenges
        WHERE lookup_hash = $1 AND created_at > now() - interval '1 hour'
        ORDER BY created_at DESC`,
      [hash]
    );
    const decision: RateDecision = rateDecision(
      recent.rows.map((r) => new Date(r.created_at).getTime()),
      now
    );
    if (!decision.allowed) {
      return {
        ok: false,
        reason: "rate-limited",
        retryAfterMs: decision.retryAfterMs,
      };
    }

    const challengeId = newId();
    const code = generateCode();
    const expiresAt = new Date(now + CHALLENGE_TTL_MS);

    await p.query(
      `INSERT INTO auth_challenges
         (id, kind, lookup_hash, code_hash, expires_at, value_enc)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        challengeId,
        kind,
        hash,
        hashCode(code, challengeId),
        expiresAt,
        // Carried here because the account is created at verify time, and by
        // then `lookup_hash` alone cannot give the address back.
        encryptValue(value),
      ]
    );

    const sent = await send(value, code);
    if (!sent.ok) {
      // Retire the challenge rather than leave a code nobody received sitting
      // in the rate-limit window.
      await p.query(`DELETE FROM auth_challenges WHERE id = $1`, [challengeId]);
      console.error("[Qwickword] Failed to send a sign-in code:", sent.detail);
      return { ok: false, reason: "unavailable" };
    }

    return { ok: true, challengeId, expiresAt: expiresAt.toISOString() };
  } catch (err) {
    console.error("[Qwickword] Failed to start a sign-in challenge:", err);
    return { ok: false, reason: "unavailable" };
  }
}

export type VerifyResult =
  | { ok: true; user: User; token: string; isNew: boolean }
  | { ok: false; reason: "invalid" | "expired" | "too-many" | "unavailable" };

/**
 * Completes a sign-in: checks the code, finds or creates the account, and
 * issues a session.
 *
 * The account is created here, on first successful verification, which is what
 * makes "sign in" and "sign up" the same action with no separate flow to build
 * or explain.
 */
export async function verifyChallenge(
  challengeId: string,
  code: string,
  deviceLabel: string | null
): Promise<VerifyResult> {
  const p = getPool();
  if (!p) return { ok: false, reason: "unavailable" };

  const client = await p.connect();
  try {
    await client.query("BEGIN");

    // Locked for the duration so two racing verifies cannot both consume it.
    const found = await client.query<{
      kind: IdentityKind;
      lookup_hash: string;
      code_hash: string;
      attempts: number;
      expires_at: Date;
      consumed_at: Date | null;
      value_enc: string;
    }>(
      `SELECT kind, lookup_hash, code_hash, attempts, expires_at, consumed_at,
              value_enc
         FROM auth_challenges WHERE id = $1 FOR UPDATE`,
      [challengeId]
    );

    const challenge = found.rows[0];
    // An unknown id and a wrong code are the same answer: neither tells the
    // caller whether they are close.
    if (!challenge) {
      await client.query("ROLLBACK");
      return { ok: false, reason: "invalid" };
    }
    if (challenge.consumed_at) {
      await client.query("ROLLBACK");
      return { ok: false, reason: "expired" };
    }
    if (new Date(challenge.expires_at).getTime() <= Date.now()) {
      await client.query("ROLLBACK");
      return { ok: false, reason: "expired" };
    }
    if (challenge.attempts >= MAX_ATTEMPTS) {
      await client.query("ROLLBACK");
      return { ok: false, reason: "too-many" };
    }

    if (!codeMatches(code, challengeId, challenge.code_hash)) {
      // Counted inside the transaction, so guesses cannot be raced past the
      // limit by firing them in parallel.
      await client.query(
        `UPDATE auth_challenges SET attempts = attempts + 1 WHERE id = $1`,
        [challengeId]
      );
      await client.query("COMMIT");
      return {
        ok: false,
        reason: challenge.attempts + 1 >= MAX_ATTEMPTS ? "too-many" : "invalid",
      };
    }

    await client.query(
      `UPDATE auth_challenges SET consumed_at = now() WHERE id = $1`,
      [challengeId]
    );

    // Find the account, or make one. This is the moment "sign in" and "sign up"
    // stop being different things.
    const existing = await client.query<{ user_id: string; display_name: string }>(
      `SELECT ui.user_id, u.display_name
         FROM user_identities ui
         JOIN users u ON u.id = ui.user_id
        WHERE ui.lookup_hash = $1 AND u.deleted_at IS NULL`,
      [challenge.lookup_hash]
    );

    let user: User;
    let isNew = false;

    if (existing.rows[0]) {
      user = {
        id: existing.rows[0].user_id,
        displayName: existing.rows[0].display_name,
      };
    } else {
      // The address, recovered from the challenge that carried it. Stored
      // against the new identity so it can later be shown back masked and
      // used to deliver a code — nothing else reads it.
      const address = decryptValue(challenge.value_enc);
      if (!address) {
        // The only way here is a tampered or undecryptable row, which is not
        // something to guess past.
        await client.query("ROLLBACK");
        return { ok: false, reason: "unavailable" };
      }
      const displayName = defaultDisplayName(challenge.kind, address);
      const userId = newId();
      await client.query(
        `INSERT INTO users (id, display_name) VALUES ($1, $2)`,
        [userId, displayName]
      );
      await client.query(
        `INSERT INTO user_identities (user_id, kind, lookup_hash, value_enc)
         VALUES ($1, $2, $3, $4)`,
        [userId, challenge.kind, challenge.lookup_hash, challenge.value_enc]
      );
      user = { id: userId, displayName };
      isNew = true;
    }

    const token = generateSessionToken();
    await client.query(
      `INSERT INTO sessions
         (id, user_id, token_hash, device_label, expires_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        newId(),
        user.id,
        hashSessionToken(token),
        deviceLabel,
        new Date(Date.now() + SESSION_TTL_MS),
      ]
    );

    await client.query("COMMIT");
    return { ok: true, user, token, isNew };
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("[Qwickword] Failed to verify a sign-in code:", err);
    return { ok: false, reason: "unavailable" };
  } finally {
    client.release();
  }
}

/** The signed-in user for a session token, or null. */
export async function userForToken(token: string | null): Promise<User | null> {
  if (!token) return null;
  const p = getPool();
  if (!p) return null;
  try {
    const found = await p.query<{ id: string; display_name: string }>(
      `SELECT u.id, u.display_name
         FROM sessions s
         JOIN users u ON u.id = s.user_id
        WHERE s.token_hash = $1
          AND s.revoked_at IS NULL
          AND s.expires_at > now()
          AND u.deleted_at IS NULL`,
      [hashSessionToken(token)]
    );
    const row = found.rows[0];
    if (!row) return null;
    // Best-effort; a failed touch must not deny an otherwise valid session.
    void p
      .query(`UPDATE sessions SET last_seen_at = now() WHERE token_hash = $1`, [
        hashSessionToken(token),
      ])
      .catch(() => {});
    return { id: row.id, displayName: row.display_name };
  } catch (err) {
    console.error("[Qwickword] Failed to resolve a session:", err);
    return null;
  }
}

/** Signs out one device. Other sessions for the same person are untouched. */
export async function revokeSession(token: string): Promise<void> {
  const p = getPool();
  if (!p) return;
  try {
    await p.query(
      `WITH revoked_session AS (
         UPDATE sessions SET revoked_at = COALESCE(revoked_at, now())
          WHERE token_hash = $1
          RETURNING id
       )
       UPDATE push_tokens
          SET revoked_at = COALESCE(revoked_at, now())
        WHERE session_id IN (SELECT id FROM revoked_session)
          AND revoked_at IS NULL`,
      [hashSessionToken(token)]
    );
  } catch (err) {
    console.error("[Qwickword] Failed to revoke a session:", err);
  }
}

export type DeleteAccountResult = "deleted" | "unauthorized" | "unavailable";

/**
 * Permanently deletes the account authenticated by this session token.
 *
 * The caller is resolved and locked inside the same transaction as the
 * deletion. That closes the gap where a session could be revoked between an
 * authorization check and a destructive query, and makes every linked record
 * disappear together or not at all.
 */
export async function deleteAccount(
  token: string | null
): Promise<DeleteAccountResult> {
  if (!token) return "unauthorized";
  const p = getPool();
  if (!p) return "unavailable";

  const client = await p.connect();
  try {
    await client.query("BEGIN");

    const found = await client.query<{ id: string }>(
      `SELECT u.id
         FROM sessions s
         JOIN users u ON u.id = s.user_id
        WHERE s.token_hash = $1
          AND s.revoked_at IS NULL
          AND s.expires_at > now()
          AND u.deleted_at IS NULL
        FOR UPDATE OF u`,
      [hashSessionToken(token)]
    );
    const userId = found.rows[0]?.id;
    if (!userId) {
      await client.query("ROLLBACK");
      return "unauthorized";
    }

    // A challenge carries the encrypted address but has no user foreign key,
    // so remove it before deleting the identity rows that map it to this user.
    await client.query(
      `DELETE FROM auth_challenges
        WHERE lookup_hash IN (
          SELECT lookup_hash FROM user_identities WHERE user_id = $1
        )`,
      [userId]
    );

    // Delete leaf records first. Existing foreign keys intentionally predate
    // account deletion and do not cascade, so the order is explicit here.
    await client.query(
      `DELETE FROM push_receipts
        WHERE push_token_id IN (
          SELECT id FROM push_tokens WHERE user_id = $1
        )`,
      [userId]
    );
    await client.query(`DELETE FROM push_tokens WHERE user_id = $1`, [userId]);
    await client.query(`DELETE FROM sessions WHERE user_id = $1`, [userId]);
    await client.query(
      `DELETE FROM contacts
        WHERE owner_user_id = $1 OR contact_user_id = $1`,
      [userId]
    );
    await client.query(`DELETE FROM call_participants WHERE user_id = $1`, [
      userId,
    ]);
    await client.query(`DELETE FROM user_identities WHERE user_id = $1`, [
      userId,
    ]);
    await client.query(`DELETE FROM users WHERE id = $1`, [userId]);

    await client.query("COMMIT");
    return "deleted";
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("[Qwickword] Failed to delete an account:", err);
    return "unavailable";
  } finally {
    client.release();
  }
}

export type IdentityRetentionResult = {
  challenges: number;
  sessions: number;
};

/**
 * Removes expired authentication material after a short support window.
 *
 * Revoked/expired sessions are retained for 30 days so an incident can be
 * investigated without keeping credentials indefinitely. Challenges need only
 * one day beyond expiry to diagnose delivery or replay problems.
 */
export async function pruneExpiredIdentityData(): Promise<IdentityRetentionResult> {
  const p = getPool();
  if (!p) throw new Error("DATABASE_URL is not configured.");
  const client = await p.connect();
  try {
    await client.query("BEGIN");
    const challenges = await client.query(
      `DELETE FROM auth_challenges
        WHERE expires_at < now() - interval '1 day'`
    );
    await client.query(
      `DELETE FROM push_receipts
        WHERE push_token_id IN (
          SELECT pt.id
            FROM push_tokens pt
            JOIN sessions s ON s.id = pt.session_id
           WHERE s.expires_at < now() - interval '30 days'
              OR s.revoked_at < now() - interval '30 days'
        )`
    );
    await client.query(
      `DELETE FROM push_tokens pt
        USING sessions s
        WHERE pt.session_id = s.id
          AND (s.expires_at < now() - interval '30 days'
            OR s.revoked_at < now() - interval '30 days')`
    );
    const sessions = await client.query(
      `DELETE FROM sessions
        WHERE expires_at < now() - interval '30 days'
           OR revoked_at < now() - interval '30 days'`
    );
    await client.query("COMMIT");
    return {
      challenges: challenges.rowCount ?? 0,
      sessions: sessions.rowCount ?? 0,
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}
