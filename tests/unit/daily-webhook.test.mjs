import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import {
  deriveBase64HmacSecret,
  normalizeDailyLifecycleEvent,
  verifyDailyWebhookSignature,
} from "../../src/lib/daily-webhook.ts";

const SECRET = Buffer.alloc(32, 7).toString("base64");

test("derived provider secrets are stable and separated by purpose", () => {
  const webhook = deriveBase64HmacSecret("root-secret", "daily-webhook");
  const diagnostics = deriveBase64HmacSecret(
    "root-secret",
    "provider-diagnostics"
  );
  assert.equal(webhook, deriveBase64HmacSecret("root-secret", "daily-webhook"));
  assert.notEqual(webhook, diagnostics);
  assert.equal(Buffer.from(webhook, "base64").length, 32);
});

test("Daily webhook HMAC authenticates the timestamp and canonical event", () => {
  const event = {
    version: "1.0.0",
    type: "participant.joined",
    id: "ptcpt-join-1",
    payload: {
      room: "quiet-test",
      session_id: "provider-session",
      joined_at: 1_800_000_000.25,
    },
    event_ts: 1_800_000_000.3,
  };
  const timestamp = "1800000000300";
  const signature = createHmac("sha256", Buffer.from(SECRET, "base64"))
    .update(`${timestamp}.${JSON.stringify(event)}`)
    .digest("base64");

  assert.equal(
    verifyDailyWebhookSignature({
      event,
      timestamp,
      signature,
      base64Secret: SECRET,
    }),
    true
  );
  assert.equal(
    verifyDailyWebhookSignature({
      event: { ...event, id: "changed" },
      timestamp,
      signature,
      base64Secret: SECRET,
    }),
    false
  );
});

test("participant evidence is allowlisted and derives the leave timestamp", () => {
  const normalized = normalizeDailyLifecycleEvent({
    version: "1.0.0",
    type: "participant.left",
    id: "ptcpt-left-1",
    payload: {
      room: "quiet-test",
      session_id: "provider-session",
      user_id: "must-not-survive",
      user_name: "Must Not Survive",
      networkQualityState: "bad",
      joined_at: 1_800_000_000.25,
      will_eject_at: 1_800_000_060,
      duration: 11.5,
    },
    event_ts: 1_800_000_011.75,
  });

  assert.deepEqual(normalized, {
    providerEventId: "ptcpt-left-1",
    eventType: "participant.left",
    room: "quiet-test",
    providerTimestampMs: 1_800_000_011_750,
    providerSessionId: "provider-session",
    joinedAtMs: 1_800_000_000_250,
    leftAtMs: 1_800_000_011_750,
    durationSeconds: 11.5,
    scheduledEjectAtMs: 1_800_000_060_000,
    meetingStartedAtMs: null,
    meetingEndedAtMs: null,
  });
  assert.equal(JSON.stringify(normalized).includes("Must Not Survive"), false);
  assert.equal(JSON.stringify(normalized).includes("must-not-survive"), false);
  assert.equal(JSON.stringify(normalized).includes("networkQualityState"), false);
});

test("meeting end evidence carries duration but no raw meeting metadata", () => {
  assert.deepEqual(
    normalizeDailyLifecycleEvent({
      version: "1.0.0",
      type: "meeting.ended",
      id: "met-end-1",
      payload: {
        room: "quiet-test",
        meeting_id: "meeting-session",
        start_ts: 1_800_000_000,
        end_ts: 1_800_000_045.5,
      },
      event_ts: 1_800_000_046,
    }),
    {
      providerEventId: "met-end-1",
      eventType: "meeting.ended",
      room: "quiet-test",
      providerTimestampMs: 1_800_000_046_000,
      providerSessionId: "meeting-session",
      joinedAtMs: null,
      leftAtMs: null,
      durationSeconds: 45.5,
      scheduledEjectAtMs: null,
      meetingStartedAtMs: 1_800_000_000_000,
      meetingEndedAtMs: 1_800_000_045_500,
    }
  );
});

test("unsupported event types and malformed lifecycle records are dropped", () => {
  assert.equal(
    normalizeDailyLifecycleEvent({
      type: "recording.ready-to-download",
      id: "recording-1",
      payload: { room: "quiet-test" },
      event_ts: 1_800_000_000,
    }),
    null
  );
  assert.equal(
    normalizeDailyLifecycleEvent({
      type: "participant.joined",
      id: "participant-1",
      payload: { room: "../../bad", joined_at: 1_800_000_000 },
      event_ts: 1_800_000_000,
    }),
    null
  );
});
