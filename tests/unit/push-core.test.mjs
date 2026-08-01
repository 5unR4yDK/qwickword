import { test } from "node:test";
import assert from "node:assert/strict";
import {
  callStartedMessage,
  isExpoPushToken,
  isPushPlatform,
  isUserId,
} from "../../src/lib/push-core.ts";

test("only Expo push tokens and supported app platforms register", () => {
  assert.equal(isExpoPushToken("ExpoPushToken[abc_DEF-123]"), true);
  assert.equal(isExpoPushToken("ExponentPushToken[abc_DEF-123]"), true);
  assert.equal(isExpoPushToken("abc_DEF-123"), false);
  assert.equal(isExpoPushToken("ExpoPushToken[]"), false);
  assert.equal(isPushPlatform("ios"), true);
  assert.equal(isPushPlatform("android"), true);
  assert.equal(isPushPlatform("web"), false);
  assert.equal(isUserId("40e8b7b8-8907-45c3-9a3d-8e3b9e313bd7"), true);
  assert.equal(isUserId("not-a-user"), false);
});

test("a call push is actionable and contains no identity address", () => {
  const message = callStartedMessage({
    to: "ExpoPushToken[abc]",
    callerName: "Alex Smith",
    room: "quiet-otter",
    durationSeconds: 300,
  });
  assert.equal(message.title, "Alex Smith is starting a Qwickword");
  assert.equal(message.body, "5 min · tap to join");
  assert.deepEqual(message.data, {
    type: "call-started",
    callerName: "Alex Smith",
    room: "quiet-otter",
    durationSeconds: 300,
    url: "https://qwickword.com/quiet-otter",
  });
  const serialized = JSON.stringify(message);
  assert.equal(serialized.includes("@"), false);
  assert.equal(serialized.includes("token_hash"), false);
});
