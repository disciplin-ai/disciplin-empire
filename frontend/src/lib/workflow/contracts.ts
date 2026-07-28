export type WorkflowStatus =
  | "needs_evidence"
  | "needs_context"
  | "awaiting_coach"
  | "mission_ready"
  | "in_session"
  | "evidence_submitted"
  | "complete";

export type WorkflowSource = "backend" | "local" | "development_simulator";

export type AthleteWorkflow = {
  version: 1;
  status: WorkflowStatus;
  observation: string | null;
  athleteContext: string | null;
  correction: string | null;
  correctionId: string | null;
  coach: { name: string; approvedAt: string } | null;
  fuelLimits: string[];
  evidence: { fileName: string; recordedAt: string } | null;
  updatedAt: string;
  source: WorkflowSource;
};

export const WORKFLOW_STORAGE_KEY = "disciplin_athlete_workflow_v1";
export const WORKFLOW_EVENT = "disciplin:workflow-updated";

export function emptyWorkflow(): AthleteWorkflow {
  return {
    version: 1,
    status: "needs_evidence",
    observation: null,
    athleteContext: null,
    correction: null,
    correctionId: null,
    coach: null,
    fuelLimits: [],
    evidence: null,
    updatedAt: new Date(0).toISOString(),
    source: "local",
  };
}

export function mergeWorkflow(userId: string | null | undefined, patch: Partial<AthleteWorkflow>) {
  if (typeof window === "undefined" || !userId) return;
  let current = emptyWorkflow();
  const stored = readUserJson<AthleteWorkflow>(userId, WORKFLOW_STORAGE_KEY);
  if (stored) current = { ...current, ...stored };
  const next = { ...current, ...patch, version: 1 as const, updatedAt: new Date().toISOString() };
  writeUserJson(userId, WORKFLOW_STORAGE_KEY, next);
  window.dispatchEvent(new Event(WORKFLOW_EVENT));
}

export function nextActionFor(state: AthleteWorkflow) {
  switch (state.status) {
    case "needs_evidence": return { label: "Add Vision evidence", href: "/sensei-vision" };
    case "needs_context": return { label: "Add athlete context", href: "/sensei-vision" };
    case "awaiting_coach": return { label: "Review coach handoff", href: "/dashboard" };
    case "mission_ready": return { label: "Open today’s mission", href: "/sensei" };
    case "in_session": return { label: "Record session evidence", href: "/sensei" };
    case "evidence_submitted": return { label: "Check evidence status", href: "/dashboard" };
    case "complete": return { label: "Review completed session", href: "/dashboard" };
  }
}
import { readUserJson, writeUserJson } from "@/lib/userScopedStorage";
