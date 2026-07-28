import assert from "node:assert/strict";
import test from "node:test";
import { authorityLabel } from "@/lib/disciplin/sensei/contracts";
import { approvedMissionToCorrection } from "./sensei";
import type {
  CoachRelationshipRecord,
  MissionSubmissionRecord,
  MissionVersionRecord,
} from "./contracts";

const relationship = {
  id: "relationship",
  athlete_user_id: "athlete",
  coach_user_id: "coach",
  athlete_display_name: "Athlete",
  coach_display_name: "Coach",
  invited_email: "coach@example.com",
  academy_name: null,
  status: "connected",
  delivery_status: "development_available",
  delivery_updated_at: null,
  invited_at: "2026-07-26T00:00:00.000Z",
  accepted_at: "2026-07-26T01:00:00.000Z",
  declined_at: null,
  disconnected_at: null,
  revoked_at: null,
  created_at: "2026-07-26T00:00:00.000Z",
  updated_at: "2026-07-26T01:00:00.000Z",
} satisfies CoachRelationshipRecord;

const submission = {
  id: "submission",
  relationship_id: "relationship",
  athlete_user_id: "athlete",
  proposed_change_to_version_id: null,
  correction_text: "Original athlete wording",
  practice_task: "Original task",
  athlete_context: "Context",
  status: "approved",
  submitted_at: "2026-07-26T02:00:00.000Z",
  decided_at: "2026-07-26T03:00:00.000Z",
  decided_by: "coach",
  rejection_reason: null,
  created_at: "2026-07-26T02:00:00.000Z",
} satisfies MissionSubmissionRecord;

test("Sensei receives the immutable approved version and its approving coach", () => {
  const mission = {
    id: "version",
    submission_id: "submission",
    relationship_id: "relationship",
    athlete_user_id: "athlete",
    coach_user_id: "coach",
    coach_display_name: "Coach",
    version_number: 1,
    correction_text: "Coach-approved wording",
    practice_task: "Five controlled entries",
    athlete_context: "Context",
    approval_kind: "edited_and_approved",
    approved_at: "2026-07-26T03:00:00.000Z",
    created_at: "2026-07-26T03:00:00.000Z",
  } satisfies MissionVersionRecord;
  const correction = approvedMissionToCorrection({
    mission,
    relationship,
    originalSubmission: submission,
  });
  assert.equal(correction.coachExactCue, "Coach-approved wording");
  assert.equal(correction.practiceTask.athleteTask, "Five controlled entries");
  assert.equal(correction.provenance.approval.approvingCoach?.id, "coach");
  assert.equal(authorityLabel(correction.provenance), "coach_entered");
  assert.equal(correction.provenance.revisions[0]?.previousWording, "Original athlete wording");
});
