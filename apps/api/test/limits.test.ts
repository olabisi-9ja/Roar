import assert from "node:assert/strict";
import { test } from "node:test";
import { resetBuckets, take } from "../src/limits.js";

test("a bucket drains to capacity and then reports a retry delay", () => {
  resetBuckets();
  assert.equal(take("probe", 2, 0).ok, true);
  assert.equal(take("probe", 2, 0).ok, true);
  const blocked = take("probe", 2, 0);
  assert.equal(blocked.ok, false);
  assert.ok(blocked.retryAfter >= 1);
});

test("a refilling bucket lets the next attempt through", async () => {
  resetBuckets();
  assert.equal(take("refill", 1, 1).ok, true);
  // refillPerMs = 1 adds a token every millisecond; wait long enough that the refill is certain.
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(take("refill", 1, 1).ok, true);
});

test("buckets are independent per key", () => {
  resetBuckets();
  assert.equal(take("a", 1, 0).ok, true);
  assert.equal(take("a", 1, 0).ok, false);
  assert.equal(take("b", 1, 0).ok, true);
});
