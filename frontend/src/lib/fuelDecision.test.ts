import assert from "node:assert/strict";
import test from "node:test";
import { buildTrainingConditionDecision } from "@/components/FuelScreen";
import { fuelAuthorityContract } from "./fuelAuthority";

const readyAnswers = {
  sleep: "Good",
  recovery: "Ready",
  hydration: "On track",
  meal_timing: "Settled",
  gi_discomfort: "None",
  soreness: "Low",
};

function decision(
  authorityState: Parameters<typeof fuelAuthorityContract>[0],
  answers: Record<string, string> = readyAnswers,
) {
  return buildTrainingConditionDecision({
    answers,
    session: "MMA",
    intensity: "Hard",
    authority: fuelAuthorityContract(authorityState),
  });
}

function combinedCopy(value: ReturnType<typeof decision>) {
  return [
    value.title,
    value.trainingAnswer,
    value.reason,
    value.productiveBoundary,
    value.nextAction,
    value.handoff,
    ...Object.values(value.constraints),
  ].join(" ");
}

test("no coach and ready preparation produces no coach-dependent instruction", () => {
  const result = decision("NO_COACH_CONNECTED");
  assert.equal(result.state, "NO_CONSTRAINT");
  assert.equal(result.title, "Train within today’s limits");
  assert.doesNotMatch(combinedCopy(result), /\bcoach\b/i);
});

test("no coach and reduced preparation provides exact limits without coach dependency", () => {
  const result = decision("NO_COACH_CONNECTED", {
    ...readyAnswers,
    sleep: "Poor",
  });
  assert.equal(result.state, "REDUCED");
  assert.equal(result.title, "Reduce today’s session");
  assert.equal(result.constraints.intensity, "Reduce from planned level");
  assert.doesNotMatch(combinedCopy(result), /\bcoach\b/i);
});

test("no coach safety stop overrides readiness without inventing authority", () => {
  const result = decision("NO_COACH_CONNECTED", {
    ...readyAnswers,
    recovery: "Drained",
    current_symptoms: "Chest / breathing",
  });
  assert.equal(result.state, "STOP");
  assert.match(result.title, /stop/i);
  assert.match(result.nextAction, /qualified assessment/i);
  assert.doesNotMatch(result.nextAction, /\bcoach\b/i);
});

test("connected no mission remains distinct from real review pending", () => {
  const connected = decision("HAS_COACH_NO_MISSION");
  const pending = decision("HAS_COACH_PENDING_REVIEW");
  assert.match(connected.nextAction, /record the coach correction/i);
  assert.match(pending.nextAction, /coach reviews the correction/i);
  assert.notEqual(connected.nextAction, pending.nextAction);
});

test("pending review is not represented as approved", () => {
  const result = decision("HAS_COACH_PENDING_REVIEW");
  assert.doesNotMatch(combinedCopy(result), /coach-approved plan/i);
  assert.match(result.handoff, /coach review pending/i);
});

test("Fuel decisions cannot mutate approved mission content", () => {
  const mission = Object.freeze({
    correction: "Keep the lead hand home",
    practiceTask: "Technical rounds only",
  });
  const before = { ...mission };
  const result = decision("COACH_APPROVED_MISSION", {
    ...readyAnswers,
    hydration: "Behind",
    hydration_symptoms: "No symptom",
  });

  assert.deepEqual(mission, before);
  assert.equal("correction" in result, false);
  assert.equal("practiceTask" in result, false);
  assert.match(result.nextAction, /keep the approved correction unchanged/i);
});
