import assert from "node:assert/strict";
import test from "node:test";
import {
  createInvitationSecret,
  hashInvitationSecret,
  isPlausibleInvitationSecret,
} from "./invitation";

test("coach invitation secrets are random, hashed and never stored raw", () => {
  const first = createInvitationSecret();
  const second = createInvitationSecret();
  assert.notEqual(first.token, second.token);
  assert.notEqual(first.token, first.tokenHash);
  assert.equal(first.tokenHash, hashInvitationSecret(first.token));
  assert.match(first.tokenHash, /^[0-9a-f]{64}$/);
  assert.equal(isPlausibleInvitationSecret(first.token), true);
});

test("malformed invitation secrets are rejected before an RPC call", () => {
  assert.equal(isPlausibleInvitationSecret("short"), false);
  assert.equal(isPlausibleInvitationSecret("a".repeat(41) + "!"), false);
  assert.equal(isPlausibleInvitationSecret(null), false);
});

