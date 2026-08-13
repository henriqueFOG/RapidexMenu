import assert from "node:assert/strict";
import test from "node:test";
import { retryDelayMs } from "../lib/job-queue-policy";

test("job retry uses bounded exponential backoff", () => {
  assert.equal(retryDelayMs(1), 30_000);
  assert.equal(retryDelayMs(2), 60_000);
  assert.equal(retryDelayMs(3), 120_000);
  assert.ok(retryDelayMs(8) > retryDelayMs(4));
  assert.ok(retryDelayMs(99) <= 6 * 60 * 60_000);
});
