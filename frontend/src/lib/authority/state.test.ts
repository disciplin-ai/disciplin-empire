import assert from "node:assert/strict";
import test from "node:test";
import { emptyWorkflow } from "@/lib/workflow/contracts";
import { authorityViewFor } from "./state";

const pending = {
  ...emptyWorkflow(),
  source: "backend" as const,
  status: "awaiting_coach" as const,
  observation: "Lead hand drops on exit.",
  athleteContext: "After the second exchange.",
};

const approved = {
  ...pending,
  status: "mission_ready" as const,
  correction: "Exit with the lead hand home.",
  correctionId: "correction-1",
  coach: { name: "Coach", approvedAt: "2026-07-23T00:00:00.000Z" },
};

test("coach-connected athlete without a mission is not waiting for coach", () => {
  const view = authorityViewFor({
    coachRelationship: "coach_connected",
    coachConnectionStatus: "connected",
    workflow: emptyWorkflow(),
  });
  assert.equal(view.authorityState, "HAS_COACH_NO_MISSION");
  assert.equal(view.dashboard.status, "No active mission");
  assert.equal(view.primaryCta.label, "Record coach correction");
  assert.equal(view.senseiAvailable, false);
  assert.equal(view.visionEvidenceLabel, "Observation only");
});

test("only an explicitly submitted review creates waiting-for-coach state", () => {
  const view = authorityViewFor({
    coachRelationship: "coach_connected",
    coachConnectionStatus: "connected",
    workflow: pending,
  });
  assert.equal(view.authorityState, "HAS_COACH_PENDING_REVIEW");
  assert.equal(view.dashboard.status, "Review pending");
  assert.equal(view.sensei.title, "Waiting for your coach’s decision.");
  assert.equal(view.senseiAvailable, false);
  assert.equal(view.visionEvidenceLabel, "Review pending");
});

test("a complete coach approval unlocks Sensei", () => {
  const view = authorityViewFor({
    coachRelationship: "coach_connected",
    coachConnectionStatus: "connected",
    workflow: approved,
  });
  assert.equal(view.authorityState, "COACH_APPROVED_MISSION");
  assert.equal(view.missionAvailable, true);
  assert.equal(view.senseiAvailable, true);
  assert.equal(view.fuel.authorityLabel, "Coach approved");
  assert.equal(view.visionEvidenceLabel, "Coach approved");
});

test("athlete-directed profile overrides stale approved workflow state", () => {
  const view = authorityViewFor({
    coachRelationship: "athlete_directed",
    workflow: approved,
  });
  assert.equal(view.authorityState, "ATHLETE_DIRECTED");
  assert.equal(view.dashboard.status, "Athlete directed");
  assert.equal(view.primaryCta.label, "Add athlete-directed evidence");
  assert.equal(view.senseiAvailable, false);
  assert.equal(view.visionEvidenceLabel, "Athlete directed");
});

test("an incomplete local correction cannot unlock Sensei", () => {
  const view = authorityViewFor({
    coachRelationship: "coach_connected",
    coachConnectionStatus: "connected",
    workflow: {
      ...emptyWorkflow(),
      status: "mission_ready",
      correction: "Typed by athlete",
    },
  });
  assert.equal(view.authorityState, "HAS_COACH_NO_MISSION");
  assert.equal(view.senseiAvailable, false);
});

test("local storage cannot manufacture pending coach authority", () => {
  const view = authorityViewFor({
    coachRelationship: "coach_connected",
    coachConnectionStatus: "connected",
    workflow: {
      ...pending,
      source: "local",
    },
  });
  assert.equal(view.authorityState, "HAS_COACH_NO_MISSION");
  assert.equal(view.dashboard.status, "No active mission");
});

test("typing a coach name without an accepted relationship grants no authority", () => {
  const view = authorityViewFor({
    coachRelationship: "coach_connected",
    coachConnectionStatus: "none",
    workflow: approved,
  });
  assert.equal(view.authorityState, "NO_COACH_CONNECTED");
  assert.equal(view.senseiAvailable, false);
  assert.equal(view.primaryCta.action, "OPEN_COACH_CONNECTION");
  assert.equal(view.sensei.title, "Connect a coach to use Sensei.");
});

test("a created invitation grants no authority", () => {
  const view = authorityViewFor({
    coachRelationship: "coach_connected",
    coachConnectionStatus: "invited",
    workflow: approved,
  });
  assert.equal(view.authorityState, "COACH_INVITATION_PENDING");
  assert.equal(view.senseiAvailable, false);
  assert.equal(view.dashboard.status, "Invitation pending");
});

test("an accepted server relationship supersedes an old athlete-directed preference", () => {
  const view = authorityViewFor({
    coachRelationship: "athlete_directed",
    coachConnectionStatus: "connected",
    workflow: emptyWorkflow(),
  });
  assert.equal(view.authorityState, "HAS_COACH_NO_MISSION");
  assert.equal(view.primaryCta.action, "RECORD_COACH_CORRECTION");
});

test("a complete localStorage-shaped approval cannot unlock a connected workspace", () => {
  const view = authorityViewFor({
    coachRelationship: "coach_connected",
    coachConnectionStatus: "connected",
    workflow: {
      ...approved,
      source: "local",
    },
  });
  assert.equal(view.authorityState, "HAS_COACH_NO_MISSION");
  assert.equal(view.senseiAvailable, false);
});

test("an unavailable coach backend fails closed without offering coach actions", () => {
  const view = authorityViewFor({
    coachRelationship: "coach_connected",
    coachConnectionStatus: "unavailable",
    workflow: approved,
  });
  assert.equal(view.authorityState, "COACH_BACKEND_UNAVAILABLE");
  assert.equal(view.senseiAvailable, false);
  assert.equal(view.missionAvailable, false);
  assert.equal(view.primaryCta.action, "OPEN_VISION");
  assert.equal(view.allowedNextActions.includes("RECORD_COACH_CORRECTION"), false);
  assert.equal(view.allowedNextActions.includes("OPEN_COACH_CONNECTION"), false);
});
