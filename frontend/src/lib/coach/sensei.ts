import type {
  CoachRelationshipRecord,
  MissionSubmissionRecord,
  MissionVersionRecord,
} from "@/lib/coach/contracts";
import type { ActiveCorrection } from "@/lib/disciplin/sensei/contracts";

export function approvedMissionToCorrection(input: {
  mission: MissionVersionRecord;
  relationship: CoachRelationshipRecord;
  originalSubmission?: MissionSubmissionRecord | null;
}): ActiveCorrection {
  const { mission, relationship, originalSubmission } = input;
  const coach = {
    id: mission.coach_user_id || `disconnected-coach:${relationship.id}`,
    name: mission.coach_display_name || relationship.coach_display_name,
    role: "coach" as const,
  };
  const coachEdited = mission.approval_kind === "edited_and_approved";
  return {
    id: mission.id,
    athleteId: mission.athlete_user_id,
    status: "active",
    coachExactCue: mission.correction_text,
    performanceProblem: mission.correction_text,
    whyItMatters: "This is the correction approved for the current mission.",
    informationToRecognise: [],
    decisionRules: [],
    practiceTask: {
      setup: "Use the conditions specified by your coach.",
      athleteTask: mission.practice_task,
      partnerTask: "Follow the approved practice task.",
      attemptsRequested: null,
      permittedResistance: "prescribed_reaction",
      restrictions: [],
    },
    successCondition: "Complete the approved practice task while retaining the correction.",
    failureCondition: "The approved correction is lost during the task.",
    evidenceRequested: {
      sourcesRequested: ["video_attached", "athlete_reported"],
      practiceTaskRequired: mission.practice_task,
      resistanceRequired: "prescribed_reaction",
      attemptsRequested: null,
      questionForCoach: "Did the approved correction hold during the task?",
    },
    provenance: {
      origin: coachEdited ? "coach" : "athlete",
      sourceType: "coach_conversation",
      originalAuthor: coachEdited
        ? coach
        : {
            id: mission.athlete_user_id,
            name: relationship.athlete_display_name,
            role: "athlete",
          },
      originalWording:
        originalSubmission?.correction_text || mission.correction_text,
      createdAt: originalSubmission?.submitted_at || mission.created_at,
      approval: {
        status: "approved",
        approvingCoach: coach,
        decidedAt: mission.approved_at,
        note: coachEdited
          ? "Coach edited and approved this immutable version."
          : "Coach approved the athlete’s exact submission.",
      },
      supportingEvidenceIds: [],
      revisions:
        coachEdited && originalSubmission
          ? [
              {
                id: `revision:${mission.id}`,
                editor: coach,
                editedAt: mission.approved_at,
                previousWording: originalSubmission.correction_text,
                nextWording: mission.correction_text,
                reason: null,
              },
            ]
          : [],
      applicableContext: mission.athlete_context ? [mission.athlete_context] : [],
      confidence: "high",
      limitations: [],
    },
    introducedAt: mission.approved_at,
    closedAt: null,
    reopenedFromCorrectionId: null,
  };
}
