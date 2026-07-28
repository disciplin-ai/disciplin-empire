import assert from "node:assert/strict";
import test from "node:test";
import { senseiCtaDestination } from "./senseiNavigation";

test("coach connection actions open Profile instead of correction capture", () => {
  assert.equal(senseiCtaDestination("OPEN_COACH_CONNECTION"), "profile");
});

test("Sensei routes each unavailable-state action to its intended workflow", () => {
  assert.equal(senseiCtaDestination("OPEN_VISION"), "vision");
  assert.equal(senseiCtaDestination("VIEW_COACH_REVIEW"), "coach_review");
  assert.equal(senseiCtaDestination("RECORD_COACH_CORRECTION"), "correction_capture");
});
