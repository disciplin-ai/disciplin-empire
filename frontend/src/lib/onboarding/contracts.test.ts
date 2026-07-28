import assert from "node:assert/strict";
import test from "node:test";
import { hasCompletedOnboarding, onboardingReducer, resumeStep, validateStep, type OnboardingState } from "./contracts";
import { normalizeCoachRelationship } from "./authority";

const initial: OnboardingState = { step: "ROLE", phase: "READY", direction: 1, error: null, draft: {}, personalizationIndex: 0 };

test("onboarding advances and returns without discarding state", () => {
  const next = onboardingReducer(initial, { type: "NEXT" });
  assert.equal(next.step, "ATHLETE_IDENTITY");
  assert.equal(onboardingReducer(next, { type: "BACK" }).step, "ROLE");
});

test("saved stage resumes from the secure profile", () => {
  assert.equal(resumeStep({ onboardingStage: "COACH_RELATIONSHIP" }), "COACH_RELATIONSHIP");
  assert.equal(resumeStep({ onboardingStage: "UNKNOWN" }), "ROLE");
});

test("completed and established authenticated athletes bypass onboarding", () => {
  assert.equal(hasCompletedOnboarding({ onboardingCompletedAt: "2026-07-22T00:00:00.000Z" }), true);
  assert.equal(hasCompletedOnboarding({ name: "Legacy athlete", baseArt: "Wrestling", competitionLevel: "Intermediate" }), true);
  assert.equal(hasCompletedOnboarding({ name: "Incomplete athlete" }), false);
});

test("coach authority and plan choice are required explicitly", () => {
  assert.ok(validateStep("COACH_RELATIONSHIP", {}));
  assert.ok(validateStep("PLAN_SELECTION", {}));
  assert.equal(validateStep("COACH_RELATIONSHIP", { coachRelationship: "coach_connected" }), null);
});

test("legacy temporary coach states migrate to athlete-directed development state", () => {
  assert.equal(normalizeCoachRelationship("between_coaches"), "athlete_directed");
  assert.equal(normalizeCoachRelationship("no_consistent_coach"), "athlete_directed");
  assert.equal(normalizeCoachRelationship("consistent_coach"), "coach_connected");
  assert.equal(normalizeCoachRelationship("unknown"), undefined);
});
