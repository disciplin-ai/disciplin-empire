import assert from "node:assert/strict";
import test from "node:test";
import {
  clearUserStorage,
  developmentPreviewAllowed,
  userScopedStorageKey,
} from "./userScopedStorage";

test("user storage keys are isolated by immutable auth user id", () => {
  const key = "disciplin_latest_vision";
  assert.notEqual(userScopedStorageKey("account-a", key), userScopedStorageKey("account-b", key));
  assert.equal(userScopedStorageKey("account-a", key), "disciplin:user:account-a:latest_vision");
});

test("a real authenticated identity always defeats development preview state", () => {
  const cookie = "disciplin_onboarding_preview=1";
  assert.equal(developmentPreviewAllowed("real-user-id", "?dev=1", cookie), false);
  assert.equal(developmentPreviewAllowed(null, "?dev=1", cookie), true);
  assert.equal(developmentPreviewAllowed(null, "", cookie), false);
});

test("logout clearing removes every cache for only the signing-out account", () => {
  const values = new Map<string, string>([
    ["disciplin:user:account-a:latest_vision", "{}"],
    ["disciplin:user:account-a:future_cache", "{}"],
    ["disciplin:user:account-b:latest_vision", "{}"],
  ]);
  const storage = {
    get length() {
      return values.size;
    },
    key(index: number) {
      return [...values.keys()][index] ?? null;
    },
    removeItem(key: string) {
      values.delete(key);
    },
  };
  const originalWindow = globalThis.window;
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { localStorage: storage },
  });
  try {
    clearUserStorage("account-a");
    assert.deepEqual([...values.keys()], [
      "disciplin:user:account-b:latest_vision",
    ]);
  } finally {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: originalWindow,
    });
  }
});
