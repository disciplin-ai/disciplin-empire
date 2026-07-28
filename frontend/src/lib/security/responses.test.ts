import assert from "node:assert/strict";
import test from "node:test";
import { logServerError } from "./responses";

test("production error logs contain only scope and correlation id", () => {
  const originalEnvironment = process.env.NODE_ENV;
  const originalError = console.error;
  const calls: unknown[][] = [];
  Reflect.set(process.env, "NODE_ENV", "production");
  console.error = (...args: unknown[]) => calls.push(args);
  try {
    logServerError("vision", "request_12345678", {
      email: "private@example.com",
      accessToken: "secret-token",
    });
    assert.equal(calls.length, 1);
    const serialized = String(calls[0][0]);
    assert.match(serialized, /request_12345678/);
    assert.doesNotMatch(serialized, /private@example\.com|secret-token/);
  } finally {
    console.error = originalError;
    if (originalEnvironment === undefined) Reflect.deleteProperty(process.env, "NODE_ENV");
    else Reflect.set(process.env, "NODE_ENV", originalEnvironment);
  }
});
