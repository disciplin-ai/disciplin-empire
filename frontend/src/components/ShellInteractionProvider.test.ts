import assert from "node:assert/strict";
import test from "node:test";
import { panelForHref } from "./ShellInteractionProvider";

test("major module links resolve to shell panels", () => {
  assert.equal(panelForHref("/sensei-vision"), "vision");
  assert.equal(panelForHref("/sensei"), "sensei");
  assert.equal(panelForHref("/fuel"), "fuel");
  assert.equal(panelForHref("/profile"), "profile");
});

test("dashboard and legal links remain routes", () => {
  assert.equal(panelForHref("/dashboard"), null);
  assert.equal(panelForHref("/legal/safety"), null);
});
