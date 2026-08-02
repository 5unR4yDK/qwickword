import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DURATION_PRESETS_SECONDS,
  formatDuration,
  formatDurationAdjective,
  formatDurationLong,
  MAX_DURATION_SECONDS,
  MIN_DURATION_MINUTES,
  MIN_DURATION_SECONDS,
} from "../../src/lib/duration.ts";

test("the temporary 30-second preset is valid without changing custom minutes", () => {
  assert.equal(MIN_DURATION_SECONDS, 30);
  assert.equal(MAX_DURATION_SECONDS, 1800);
  assert.equal(MIN_DURATION_MINUTES, 1);
  assert.deepEqual(
    [...DURATION_PRESETS_SECONDS],
    [30, 60, 120, 300, 600, 900, 1200]
  );
});

test("thirty seconds is never rounded up to one minute in product copy", () => {
  assert.equal(formatDuration(30), "30 sec");
  assert.equal(formatDurationAdjective(30), "30 second");
  assert.equal(formatDurationLong(30), "30 seconds");
  assert.equal(formatDurationAdjective(300), "5 minute");
});
