import assert from "node:assert/strict";
import test from "node:test";
import { coachRpcError } from "./server";

test("missing coach tables stay diagnosable without exposing schema language", () => {
  const failure = coachRpcError({
    code: "PGRST205",
    message:
      "Could not find the table 'public.coach_relationships' in the schema cache",
  });

  assert.equal(failure.code, "COACH_SCHEMA_UNAVAILABLE");
  assert.equal(failure.status, 503);
  assert.equal(failure.retryable, false);
  assert.equal(failure.diagnosticRef, "PGRST205");
  assert.equal(failure.message, "Coach connection is temporarily unavailable.");
});

test("missing coach RPCs are classified as a non-retryable schema failure", () => {
  const failure = coachRpcError({
    code: "PGRST202",
    message: "No matching function was found in the schema cache",
  });

  assert.equal(failure.code, "COACH_SCHEMA_UNAVAILABLE");
  assert.equal(failure.status, 503);
  assert.equal(failure.retryable, false);
});

test("unknown coach failures remain retryable without exposing database details", () => {
  const failure = coachRpcError({
    code: "XX000",
    message: "internal database detail",
  });

  assert.equal(failure.code, "COACH_REQUEST_FAILED");
  assert.equal(failure.status, 500);
  assert.equal(failure.retryable, true);
  assert.equal(failure.message, "We couldn’t complete this coach action. Try again.");
  assert.doesNotMatch(
    failure.message,
    /schema|PGRST|RPC|Supabase|migration|database/i,
  );
});
