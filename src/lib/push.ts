// Push notification storage and delivery.
//
// There is intentionally no "send to user id" export here. The only send
// function starts from the signed-in caller, proves the two people shared a
// call and kept each other, and only then selects the recipient's devices.
// That query is the spam boundary; route code cannot bypass it.
import { Pool } from "pg";
import { hashSessionToken } from "./identity-core";
import {
  callStartedMessage,
  isExpoPushReceiptId,
  isExpoPushToken,
  pushReceiptOutcome,
  type PushPlatform,
} from "./push-core";

let pool: Pool | null = null;

function getPool(): Pool | null {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) return null;
  if (!pool) pool = new Pool({ connectionString, max: 1 });
  return pool;
}

export async function registerPushToken(input: {
  userId: string;
  sessionToken: string;
  token: string;
  platform: PushPlatform;
  deviceLabel: string | null;
}): Promise<boolean> {
  const p = getPool();
  if (!p) return false;
  const client = await p.connect();
  try {
    await client.query("BEGIN");
    const session = await client.query<{ id: string }>(
      `SELECT id FROM sessions
        WHERE token_hash = $1 AND user_id = $2 AND revoked_at IS NULL
        FOR UPDATE`,
      [hashSessionToken(input.sessionToken), input.userId]
    );
    const sessionId = session.rows[0]?.id;
    if (!sessionId) {
      await client.query("ROLLBACK");
      return false;
    }

    // Token rotation replaces the live route but keeps the old row as revoked.
    // The same physical token changing accounts also retires its former owner.
    await client.query(
      `UPDATE push_tokens
          SET revoked_at = COALESCE(revoked_at, now())
        WHERE revoked_at IS NULL
          AND (session_id = $1 OR token = $2)
          AND NOT (session_id = $1 AND token = $2)`,
      [sessionId, input.token]
    );

    const current = await client.query<{ id: string }>(
      `SELECT id FROM push_tokens
        WHERE session_id = $1 AND token = $2 AND revoked_at IS NULL`,
      [sessionId, input.token]
    );
    if (current.rows[0]) {
      await client.query(
        `UPDATE push_tokens SET platform = $2, device_label = $3 WHERE id = $1`,
        [current.rows[0].id, input.platform, input.deviceLabel]
      );
    } else {
      await client.query(
        `INSERT INTO push_tokens
           (user_id, session_id, token, platform, device_label)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          input.userId,
          sessionId,
          input.token,
          input.platform,
          input.deviceLabel,
        ]
      );
    }
    await client.query("COMMIT");
    return true;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("[Qwickword] Failed to register a push token:", err);
    return false;
  } finally {
    client.release();
  }
}

export async function revokePushTokensForSession(
  userId: string,
  sessionToken: string
): Promise<void> {
  const p = getPool();
  if (!p) return;
  try {
    await p.query(
      `UPDATE push_tokens pt
          SET revoked_at = COALESCE(pt.revoked_at, now())
         FROM sessions s
        WHERE pt.session_id = s.id
          AND pt.user_id = $1
          AND s.token_hash = $2
          AND pt.revoked_at IS NULL`,
      [userId, hashSessionToken(sessionToken)]
    );
  } catch (err) {
    console.error("[Qwickword] Failed to revoke push tokens:", err);
  }
}

type Target = { id: string; token: string };

type ExpoPushTicket = {
  status?: string;
  id?: string;
  details?: { error?: string };
};

async function savePushReceipts(
  targets: Target[],
  tickets: ExpoPushTicket[]
): Promise<void> {
  const p = getPool();
  if (!p) return;
  const accepted = tickets.flatMap((ticket, index) =>
    ticket.status === "ok" && isExpoPushReceiptId(ticket.id) && targets[index]
      ? [{ receiptId: ticket.id, pushTokenId: targets[index].id }]
      : []
  );
  if (accepted.length === 0) return;
  try {
    await p.query(
      `INSERT INTO push_receipts (receipt_id, push_token_id)
       SELECT * FROM unnest($1::text[], $2::bigint[])
       ON CONFLICT (receipt_id) DO NOTHING`,
      [
        accepted.map((item) => item.receiptId),
        accepted.map((item) => item.pushTokenId),
      ]
    );
  } catch (err) {
    console.error("[Qwickword] Failed to store Expo push receipts:", err);
  }
}

async function drainMaturePushReceipts(): Promise<void> {
  const p = getPool();
  if (!p) return;
  try {
    // Expo recommends checking around fifteen minutes after send and clears
    // receipts after twenty-four hours. Missing receipts remain pending until
    // a later send retries them; old ones are closed honestly as expired.
    await p.query(
      `UPDATE push_receipts
          SET checked_at = now(), status = 'expired'
        WHERE checked_at IS NULL
          AND created_at <= now() - interval '24 hours'`
    );
    const pending = await p.query<{
      receipt_id: string;
      push_token_id: string;
    }>(
      `SELECT receipt_id, push_token_id::text
         FROM push_receipts
        WHERE checked_at IS NULL
          AND created_at <= now() - interval '15 minutes'
        ORDER BY created_at
        LIMIT 1000`
    );
    if (pending.rows.length === 0) return;

    const response = await fetch(
      "https://exp.host/--/api/v2/push/getReceipts",
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ids: pending.rows.map((row) => row.receipt_id),
        }),
        signal: AbortSignal.timeout(10_000),
      }
    );
    if (!response.ok) {
      console.error(
        `[Qwickword] Expo receipt request failed (${response.status}).`
      );
      return;
    }
    const body = (await response.json()) as {
      data?: Record<string, unknown>;
    };
    const receipts = body.data ?? {};
    const resolved = pending.rows.flatMap((row) => {
      const outcome = pushReceiptOutcome(receipts[row.receipt_id]);
      return outcome ? [{ ...row, ...outcome }] : [];
    });
    if (resolved.length === 0) return;

    const client = await p.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `UPDATE push_receipts AS receipt
            SET checked_at = now(),
                status = incoming.status,
                error_code = incoming.error_code
           FROM unnest($1::text[], $2::text[], $3::text[])
             AS incoming(receipt_id, status, error_code)
          WHERE receipt.receipt_id = incoming.receipt_id
            AND receipt.checked_at IS NULL`,
        [
          resolved.map((item) => item.receipt_id),
          resolved.map((item) => item.status),
          resolved.map((item) => item.errorCode),
        ]
      );
      const deadTokenIds = resolved
        .filter((item) => item.errorCode === "DeviceNotRegistered")
        .map((item) => item.push_token_id);
      if (deadTokenIds.length > 0) {
        await client.query(
          `UPDATE push_tokens
              SET revoked_at = COALESCE(revoked_at, now())
            WHERE id = ANY($1::bigint[])`,
          [deadTokenIds]
        );
      }
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("[Qwickword] Failed to check Expo push receipts:", err);
  }
}

async function sendExpoPushRequest(
  messages: Array<ReturnType<typeof callStartedMessage>>
): Promise<Response> {
  let firstError: unknown = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(messages),
        signal: AbortSignal.timeout(10_000),
      });
      const transient = response.status === 429 || response.status >= 500;
      if (!transient || attempt === 1) return response;
    } catch (err) {
      if (attempt === 1) throw err;
      firstError = err;
    }
    // One bounded retry for the transient cases Expo documents. collapseId
    // and tag ensure an accepted first attempt cannot become two visible call
    // invitations if its response was lost in transit.
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw firstError ?? new Error("Expo push request did not return a response.");
}

async function targetsForMutualCallContact(input: {
  callerId: string;
  recipientId: string;
  callName: string;
}): Promise<Target[]> {
  const p = getPool();
  if (!p || input.callerId === input.recipientId) return [];
  try {
    const result = await p.query<Target>(
      `SELECT pt.id::text, pt.token
         FROM push_tokens pt
         JOIN users recipient
           ON recipient.id = pt.user_id AND recipient.deleted_at IS NULL
        WHERE pt.user_id = $2
          AND pt.revoked_at IS NULL
          -- Both people chose to keep the other.
          AND EXISTS (
            SELECT 1 FROM contacts forward
             WHERE forward.owner_user_id = $1
               AND forward.contact_user_id = $2
          )
          AND EXISTS (
            SELECT 1 FROM contacts back
             WHERE back.owner_user_id = $2
               AND back.contact_user_id = $1
          )
          -- Contacts can gain more sources later; ringing still requires a
          -- call the two people genuinely shared.
          AND EXISTS (
            SELECT 1
              FROM call_participants a
              JOIN call_participants b ON b.call_name = a.call_name
             WHERE a.user_id = $1 AND b.user_id = $2
          )
          -- Someone already in this call does not need a notification about it.
          AND NOT EXISTS (
            SELECT 1 FROM call_participants present
             WHERE present.call_name = $3 AND present.user_id = $2
          )`,
      [input.callerId, input.recipientId, input.callName]
    );
    return result.rows.filter((row) => isExpoPushToken(row.token));
  } catch (err) {
    console.error("[Qwickword] Failed to resolve push recipients:", err);
    return [];
  }
}

export async function notifyMutualCallContact(input: {
  callerId: string;
  callerName: string;
  recipientId: string;
  callName: string;
  durationSeconds: number;
}): Promise<number> {
  await drainMaturePushReceipts();
  const targets = await targetsForMutualCallContact(input);
  if (targets.length === 0) return 0;

  const messages = targets.map((target) =>
    callStartedMessage({
      to: target.token,
      callerName: input.callerName,
      room: input.callName,
      durationSeconds: input.durationSeconds,
    })
  );

  try {
    const response = await sendExpoPushRequest(messages);
    if (!response.ok) {
      console.error(`[Qwickword] Expo push request failed (${response.status}).`);
      return 0;
    }
    const body = (await response.json()) as { data?: ExpoPushTicket[] };
    const tickets = Array.isArray(body.data) ? body.data : [];
    const deadIds = tickets.flatMap((ticket, index) =>
      ticket.status === "error" && ticket.details?.error === "DeviceNotRegistered"
        ? [targets[index]?.id]
        : []
    ).filter((id): id is string => typeof id === "string");
    if (deadIds.length > 0) {
      const p = getPool();
      await p?.query(
        `UPDATE push_tokens SET revoked_at = COALESCE(revoked_at, now())
          WHERE id = ANY($1::bigint[])`,
        [deadIds]
      );
    }
    await savePushReceipts(targets, tickets);
    return tickets.filter((ticket) => ticket.status === "ok").length;
  } catch (err) {
    console.error("[Qwickword] Failed to send call push notifications:", err);
    return 0;
  }
}
