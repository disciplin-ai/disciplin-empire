import assert from "node:assert/strict";
import test from "node:test";
import {
  FUEL_AUTHORITY_MATRIX,
  fuelAuthorityContract,
} from "./fuelAuthority";

const coachDependent = /\bcoach\b/i;

test("no-coach Fuel authority never generates a coach-dependent action", () => {
  const contract = fuelAuthorityContract("NO_COACH_CONNECTED");
  assert.equal(contract.connectedCoach, false);
  assert.equal(coachDependent.test(contract.readyAction), false);
  assert.equal(coachDependent.test(contract.reducedAction), false);
  assert.equal(coachDependent.test(contract.productiveBoundary), false);
  assert.equal(contract.headerStatus, "Athlete directed");
});

test("an invitation does not grant connected-coach authority", () => {
  const contract = fuelAuthorityContract("COACH_INVITATION_PENDING");
  assert.equal(contract.connectedCoach, false);
  assert.equal(contract.approvedMission, false);
  assert.equal(contract.reviewPending, false);
});

test("an unavailable coach backend keeps Fuel preparation-only", () => {
  const contract = fuelAuthorityContract("COACH_BACKEND_UNAVAILABLE");
  assert.equal(contract.connectedCoach, false);
  assert.equal(contract.approvedMission, false);
  assert.equal(contract.reviewPending, false);
  assert.match(contract.authorityDetail, /unavailable/i);
  assert.doesNotMatch(contract.readyAction, /coach/i);
});

test("connected without a mission remains distinct from review pending", () => {
  const connected = fuelAuthorityContract("HAS_COACH_NO_MISSION");
  const pending = fuelAuthorityContract("HAS_COACH_PENDING_REVIEW");
  assert.equal(connected.connectedCoach, true);
  assert.equal(connected.reviewPending, false);
  assert.equal(pending.reviewPending, true);
  assert.notEqual(connected.headerStatus, pending.headerStatus);
});

test("pending review never becomes approved authority", () => {
  const pending = fuelAuthorityContract("HAS_COACH_PENDING_REVIEW");
  assert.equal(pending.approvedMission, false);
  assert.equal(pending.authorityLabel, "Review pending");
});

test("only the approved state carries an approved mission", () => {
  for (const [state, contract] of Object.entries(FUEL_AUTHORITY_MATRIX)) {
    assert.equal(
      contract.approvedMission,
      state === "COACH_APPROVED_MISSION",
    );
  }
});

test("disconnected and athlete-directed states remove active coach language", () => {
  const contract = fuelAuthorityContract("ATHLETE_DIRECTED");
  assert.equal(contract.connectedCoach, false);
  assert.equal(coachDependent.test(contract.readyAction), false);
  assert.equal(coachDependent.test(contract.reducedAction), false);
});
