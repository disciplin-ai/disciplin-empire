import assert from "node:assert/strict";
import test from "node:test";
import { emptyWorkflow, nextActionFor, type WorkflowStatus } from "./contracts";

test("new workflows begin with evidence and no invented correction", () => {
  const state = emptyWorkflow();
  assert.equal(state.status, "needs_evidence");
  assert.equal(state.correction, null);
  assert.equal(state.coach, null);
});

test("every workflow state exposes exactly one next action", () => {
  const states: WorkflowStatus[] = [
    "needs_evidence", "needs_context", "awaiting_coach", "mission_ready",
    "in_session", "evidence_submitted", "complete",
  ];
  for (const status of states) {
    const action = nextActionFor({ ...emptyWorkflow(), status });
    assert.ok(action.label);
    assert.match(action.href, /^\//);
  }
});
