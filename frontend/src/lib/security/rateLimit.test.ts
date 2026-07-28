import assert from "node:assert/strict";
import test from "node:test";
import {
  acquireExpensiveRequest,
  resetRateLimitsForTests,
} from "./rateLimit";

test("limits concurrent expensive work per authenticated user", () => {
  resetRateLimitsForTests();
  const first = acquireExpensiveRequest({ route: "vision", userId: "account-a" });
  const second = acquireExpensiveRequest({ route: "vision", userId: "account-a" });
  const third = acquireExpensiveRequest({ route: "vision", userId: "account-a" });
  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.equal(third.ok, false);
  if (first.ok) first.release();
  if (second.ok) second.release();
});

test("does not share a user's rate bucket with another account", () => {
  resetRateLimitsForTests();
  const leases = [
    acquireExpensiveRequest({ route: "vision", userId: "account-a" }),
    acquireExpensiveRequest({ route: "vision", userId: "account-a" }),
  ];
  const other = acquireExpensiveRequest({ route: "vision", userId: "account-b" });
  assert.equal(other.ok, true);
  for (const lease of leases) if (lease.ok) lease.release();
  if (other.ok) other.release();
});

test("returns a retry interval after the minute burst is exhausted", () => {
  resetRateLimitsForTests();
  for (let index = 0; index < 10; index += 1) {
    const lease = acquireExpensiveRequest({
      route: "vision",
      userId: "account-a",
      now: 1_000,
    });
    assert.equal(lease.ok, true);
    if (lease.ok) lease.release();
  }
  const blocked = acquireExpensiveRequest({
    route: "vision",
    userId: "account-a",
    now: 1_001,
  });
  assert.equal(blocked.ok, false);
  if (!blocked.ok) assert.ok(blocked.retryAfterSeconds > 0);
});
