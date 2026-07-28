"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { emptyWorkflow, WORKFLOW_EVENT, WORKFLOW_STORAGE_KEY, type AthleteWorkflow } from "@/lib/workflow/contracts";
import { useProfile } from "@/components/ProfileProvider";
import { IDENTITY_CHANGED_EVENT, readUserJson, writeUserJson } from "@/lib/userScopedStorage";
import { authorityViewFor, type AuthorityView } from "@/lib/authority/state";
import { useCoach } from "@/components/CoachProvider";

type WorkflowContextValue = {
  workflow: AthleteWorkflow;
  authority: AuthorityView;
  ready: boolean;
  update: (patch: Partial<AthleteWorkflow>) => void;
  reset: () => void;
  simulate: (status: AthleteWorkflow["status"]) => void;
};

const WorkflowContext = createContext<WorkflowContextValue | null>(null);

function readWorkflow(userId: string | null) {
  const stored = readUserJson<AthleteWorkflow>(userId, WORKFLOW_STORAGE_KEY);
  return stored ? { ...emptyWorkflow(), ...stored } : emptyWorkflow();
}

export function WorkflowProvider({ children }: { children: React.ReactNode }) {
  const { user, profile } = useProfile();
  const { state: coachState, loading: coachLoading, error: coachError } = useCoach();
  const storageOwnerId = user?.id ?? (
    process.env.NODE_ENV !== "production" &&
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("dev") === "1"
      ? "development-preview"
      : null
  );
  const [workflow, setWorkflow] = useState<AthleteWorkflow>(emptyWorkflow);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const sync = () => setWorkflow(readWorkflow(storageOwnerId));
    queueMicrotask(() => {
      sync();
      setReady(true);
    });
    window.addEventListener(WORKFLOW_EVENT, sync);
    window.addEventListener("storage", sync);
    window.addEventListener("disciplin:vision-plan-updated", sync);
    window.addEventListener("disciplin:fuel-updated", sync);
    window.addEventListener(IDENTITY_CHANGED_EVENT, sync);
    return () => {
      window.removeEventListener(WORKFLOW_EVENT, sync);
      window.removeEventListener("storage", sync);
      window.removeEventListener("disciplin:vision-plan-updated", sync);
      window.removeEventListener("disciplin:fuel-updated", sync);
      window.removeEventListener(IDENTITY_CHANGED_EVENT, sync);
    };
  }, [storageOwnerId]);

  const commit = useCallback((next: AthleteWorkflow) => {
    if (!writeUserJson(storageOwnerId, WORKFLOW_STORAGE_KEY, next)) return;
    setWorkflow(next);
    window.dispatchEvent(new Event(WORKFLOW_EVENT));
  }, [storageOwnerId]);

  const update = useCallback((patch: Partial<AthleteWorkflow>) => {
    const current = readWorkflow(storageOwnerId);
    commit({ ...current, ...patch, version: 1, updatedAt: new Date().toISOString() });
  }, [commit, storageOwnerId]);

  const reset = useCallback(() => commit(emptyWorkflow()), [commit]);
  const simulate = useCallback((status: AthleteWorkflow["status"]) => {
    if (process.env.NODE_ENV === "production") return;
    const now = new Date().toISOString();
    const hasObservation = status !== "needs_evidence";
    const hasContext = !["needs_evidence", "needs_context"].includes(status);
    const approved = ["mission_ready", "in_session", "evidence_submitted", "complete"].includes(status);
    const simulated = {
      ...emptyWorkflow(), status, source: "development_simulator", updatedAt: now,
      observation: hasObservation ? "Lead hand drops during the exit." : null,
      athleteContext: hasContext ? "This happens after the second exchange." : null,
      correction: approved ? "Exit with the lead hand home." : null,
      correctionId: approved ? "simulated-correction" : null,
      coach: approved ? { name: "Simulated coach", approvedAt: now } : null,
      evidence: ["evidence_submitted", "complete"].includes(status) ? { fileName: "simulated-session.mp4", recordedAt: now } : null,
    } satisfies AthleteWorkflow;
    commit(simulated);
    if (approved) {
      writeUserJson(storageOwnerId, "disciplin_sensei_constitution_v1", {
        operatingMode: "coach_connected",
        activeCorrection: {
          id: simulated.correctionId, athleteId: "current-athlete", status: "active",
          coachExactCue: simulated.correction, performanceProblem: simulated.observation,
          whyItMatters: "Approved by the coach for today’s practice.", informationToRecognise: [], decisionRules: [],
          practiceTask: { setup: "Coach-approved session", athleteTask: simulated.correction, partnerTask: "Provide controlled resistance", attemptsRequested: 5, permittedResistance: "prescribed_reaction", restrictions: simulated.fuelLimits },
          successCondition: "The correction holds under the approved resistance.", failureCondition: "The correction breaks under pressure.",
          evidenceRequested: { sourcesRequested: ["video_attached"], practiceTaskRequired: simulated.correction, resistanceRequired: "prescribed_reaction", attemptsRequested: 5, questionForCoach: "Did the correction hold?" },
          provenance: { origin: "coach", sourceType: "coach_observation", originalAuthor: { id: "dev-coach", name: "Simulated coach", role: "coach" }, originalWording: simulated.correction, createdAt: now, approval: { status: "approved", approvingCoach: { id: "dev-coach", name: "Simulated coach", role: "coach" }, decidedAt: now, note: "Development simulator only" }, supportingEvidenceIds: [], revisions: [], applicableContext: [], confidence: "high", limitations: ["Development simulator only"] },
          introducedAt: now, closedAt: null, reopenedFromCorrectionId: null,
        }, suggestedCorrection: null,
        evidenceState: status === "complete" ? "progression_approved" : status === "evidence_submitted" ? "awaiting_coach_review" : "planned",
        fuelConstraint: { assessment: "not_assessed", assessedAt: null, maximumResistance: null, restrictions: [], reason: null, sourceEvidenceIds: [] },
      });
    }
  }, [commit, storageOwnerId]);

  const effectiveWorkflow = useMemo<AthleteWorkflow>(() => {
    if (coachState.currentMission) {
      return {
        ...emptyWorkflow(),
        status: "mission_ready",
        source: "backend",
        correction: coachState.currentMission.correction_text,
        correctionId: coachState.currentMission.id,
        athleteContext: coachState.currentMission.athlete_context,
        coach: {
          name:
            coachState.athleteRelationship?.coach_display_name || "Connected coach",
          approvedAt: coachState.currentMission.approved_at,
        },
        updatedAt: coachState.currentMission.approved_at,
      };
    }
    const pendingSubmission = coachState.submissions.find(
      (submission) =>
        submission.athlete_user_id === user?.id && submission.status === "pending",
    );
    if (pendingSubmission) {
      return {
        ...emptyWorkflow(),
        status: "awaiting_coach",
        source: "backend",
        correction: pendingSubmission.correction_text,
        athleteContext: pendingSubmission.athlete_context,
        updatedAt: pendingSubmission.submitted_at,
      };
    }
    if (coachState.athleteRelationship?.status === "connected") {
      return {
        ...emptyWorkflow(),
        source: "backend",
      };
    }
    return workflow;
  }, [coachState, user?.id, workflow]);

  const authority = useMemo(
    () =>
      authorityViewFor({
        coachRelationship: profile?.coachRelationship,
        coachConnectionStatus: coachError
          ? "unavailable"
          : coachState.athleteRelationship?.status ?? "none",
        workflow: effectiveWorkflow,
      }),
    [
      coachError,
      coachState.athleteRelationship?.status,
      effectiveWorkflow,
      profile?.coachRelationship,
    ],
  );
  const value = useMemo(
    () => ({ workflow: effectiveWorkflow, authority, ready: ready && !coachLoading, update, reset, simulate }),
    [effectiveWorkflow, authority, ready, coachLoading, update, reset, simulate],
  );
  return <WorkflowContext.Provider value={value}>{children}</WorkflowContext.Provider>;
}

export function useWorkflow() {
  const value = useContext(WorkflowContext);
  if (!value) throw new Error("useWorkflow must be used inside WorkflowProvider");
  return value;
}
