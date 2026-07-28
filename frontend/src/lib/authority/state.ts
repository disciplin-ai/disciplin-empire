import type { CoachRelationship } from "@/lib/onboarding/authority";
import type { AthleteWorkflow, WorkflowStatus } from "@/lib/workflow/contracts";

export type AuthorityState =
  | "COACH_BACKEND_UNAVAILABLE"
  | "NO_COACH_CONNECTED"
  | "COACH_INVITATION_PENDING"
  | "HAS_COACH_NO_MISSION"
  | "HAS_COACH_PENDING_REVIEW"
  | "COACH_APPROVED_MISSION"
  | "ATHLETE_DIRECTED";

export type AuthorityAction =
  | "RECORD_COACH_CORRECTION"
  | "PREPARE_COACH_REVIEW"
  | "VIEW_COACH_REVIEW"
  | "OPEN_SENSEI"
  | "OPEN_VISION"
  | "ADD_ATHLETE_EVIDENCE"
  | "SET_PREPARATION_LIMITS"
  | "RECORD_SESSION_EVIDENCE"
  | "OPEN_COACH_CONNECTION";

export type AuthorityCta = {
  label: string;
  action: AuthorityAction;
};

export type EvidenceAuthority =
  | "COACH_APPROVED"
  | "COACH_REVIEW_PENDING"
  | "ATHLETE_DIRECTED"
  | "OBSERVATION_ONLY";

export type AuthorityView = {
  authorityState: AuthorityState;
  label: string;
  missionAvailable: boolean;
  senseiAvailable: boolean;
  evidenceAuthority: EvidenceAuthority;
  visionEvidenceLabel: string;
  visionEvidenceDetail: string;
  dashboard: {
    title: string;
    body: string;
    status: string;
  };
  sensei: {
    title: string;
    body: string;
    primaryCta: AuthorityCta;
  };
  fuel: {
    heading: string;
    body: string;
    supportingCopy: string;
    authorityLabel: string;
  };
  primaryCta: AuthorityCta;
  allowedNextActions: AuthorityAction[];
};

const APPROVED_WORKFLOW_STATUSES: WorkflowStatus[] = [
  "mission_ready",
  "in_session",
  "evidence_submitted",
  "complete",
];

export function selectAuthorityState(input: {
  coachRelationship?: CoachRelationship;
  coachConnectionStatus?: "none" | "unavailable" | "invited" | "connected" | "declined" | "disconnected" | "revoked";
  workflow?: AthleteWorkflow | null;
}): AuthorityState {
  if (input.coachConnectionStatus === "unavailable") {
    return "COACH_BACKEND_UNAVAILABLE";
  }
  if (input.coachConnectionStatus === "invited") {
    return "COACH_INVITATION_PENDING";
  }
  if (
    input.coachConnectionStatus !== "connected" &&
    input.coachRelationship === "athlete_directed"
  ) {
    return "ATHLETE_DIRECTED";
  }
  if (input.coachConnectionStatus !== "connected") {
    return "NO_COACH_CONNECTED";
  }

  const workflow = input.workflow;
  const trustedWorkflow =
    workflow?.source === "backend" ||
    (process.env.NODE_ENV !== "production" &&
      workflow?.source === "development_simulator");
  if (
    trustedWorkflow &&
    workflow &&
    APPROVED_WORKFLOW_STATUSES.includes(workflow.status) &&
    Boolean(workflow.correction) &&
    Boolean(workflow.correctionId) &&
    Boolean(workflow.coach?.approvedAt)
  ) {
    return "COACH_APPROVED_MISSION";
  }

  if (trustedWorkflow && workflow?.status === "awaiting_coach") {
    return "HAS_COACH_PENDING_REVIEW";
  }

  return "HAS_COACH_NO_MISSION";
}

export function authorityViewFor(input: {
  coachRelationship?: CoachRelationship;
  coachConnectionStatus?: "none" | "unavailable" | "invited" | "connected" | "declined" | "disconnected" | "revoked";
  workflow?: AthleteWorkflow | null;
}): AuthorityView {
  const authorityState = selectAuthorityState(input);

  if (authorityState === "COACH_BACKEND_UNAVAILABLE") {
    return {
      authorityState,
      label: "Coach connection unavailable",
      missionAvailable: false,
      senseiAvailable: false,
      evidenceAuthority: "OBSERVATION_ONLY",
      visionEvidenceLabel: "Observation only",
      visionEvidenceDetail: "Vision can still record observation-only evidence.",
      dashboard: {
        title: "Coach connection unavailable",
        body: "You can still check your readiness and record observation-only evidence.",
        status: "Connection unavailable",
      },
      sensei: {
        title: "Sensei is unavailable right now.",
        body: "Your coach connection could not be confirmed. Vision is still available.",
        primaryCta: { label: "Open Vision", action: "OPEN_VISION" },
      },
      fuel: {
        heading: "Check today’s readiness",
        body: "A short body check turns how you feel into clear limits for today’s session.",
        supportingCopy:
          "Fuel adjusts preparation conditions, not technical work.",
        authorityLabel: "Connection unavailable",
      },
      primaryCta: { label: "Open Vision", action: "OPEN_VISION" },
      allowedNextActions: ["OPEN_VISION", "SET_PREPARATION_LIMITS"],
    };
  }

  if (authorityState === "NO_COACH_CONNECTED") {
    return {
      authorityState,
      label: "No coach connected",
      missionAvailable: false,
      senseiAvailable: false,
      evidenceAuthority: "OBSERVATION_ONLY",
      visionEvidenceLabel: "Observation only",
      visionEvidenceDetail: "Only a connected coach can approve this work.",
      dashboard: {
        title: "No approved mission yet",
        body: "Connect your coach when ready. You can still record observation-only evidence.",
        status: "No coach connected",
      },
      sensei: {
        title: "Connect a coach to use Sensei.",
        body: "Sensei only reinforces corrections your coach approves.",
        primaryCta: { label: "Connect coach", action: "OPEN_COACH_CONNECTION" },
      },
      fuel: {
        heading: "Check today’s readiness",
        body: "A short body check turns how you feel into clear limits for today’s session.",
        supportingCopy: "Fuel adjusts preparation conditions, not technical work.",
        authorityLabel: "Athlete directed",
      },
      primaryCta: { label: "Connect coach", action: "OPEN_COACH_CONNECTION" },
      allowedNextActions: ["OPEN_COACH_CONNECTION", "OPEN_VISION", "SET_PREPARATION_LIMITS"],
    };
  }

  if (authorityState === "COACH_INVITATION_PENDING") {
    return {
      authorityState,
      label: "Invitation pending",
      missionAvailable: false,
      senseiAvailable: false,
      evidenceAuthority: "OBSERVATION_ONLY",
      visionEvidenceLabel: "Observation only",
      visionEvidenceDetail: "Your coach must accept before they can approve work.",
      dashboard: {
        title: "Coach invitation pending",
        body: "Your coach has not accepted yet. Nothing can be approved.",
        status: "Invitation pending",
      },
      sensei: {
        title: "Waiting for your coach to accept.",
        body: "Sensei begins after your coach connects and approves a correction.",
        primaryCta: { label: "Manage invitation", action: "OPEN_COACH_CONNECTION" },
      },
      fuel: {
        heading: "Check today’s readiness",
        body: "A short body check turns how you feel into clear limits for today’s session.",
        supportingCopy: "Fuel adjusts preparation conditions, not technical work.",
        authorityLabel: "Invite pending",
      },
      primaryCta: { label: "Manage invitation", action: "OPEN_COACH_CONNECTION" },
      allowedNextActions: ["OPEN_COACH_CONNECTION", "OPEN_VISION", "SET_PREPARATION_LIMITS"],
    };
  }

  if (authorityState === "ATHLETE_DIRECTED") {
    return {
      authorityState,
      label: "Athlete directed",
      missionAvailable: false,
      senseiAvailable: false,
      evidenceAuthority: "ATHLETE_DIRECTED",
      visionEvidenceLabel: "Athlete directed",
      visionEvidenceDetail: "This evidence is not coach approved and cannot enter Sensei.",
      dashboard: {
        title: "No coach-approved mission",
        body: "Your work is athlete directed and clearly marked not coach approved.",
        status: "Athlete directed",
      },
      sensei: {
        title: "Sensei requires coach approval.",
        body: "Athlete-directed work stays outside Sensei.",
        primaryCta: { label: "Open Vision", action: "OPEN_VISION" },
      },
      fuel: {
        heading: "Check today’s readiness",
        body: "A short body check turns how you feel into clear limits for today’s session.",
        supportingCopy: "Fuel adjusts preparation conditions, not technical work.",
        authorityLabel: "Athlete directed",
      },
      primaryCta: {
        label: "Add athlete-directed evidence",
        action: "ADD_ATHLETE_EVIDENCE",
      },
      allowedNextActions: [
        "OPEN_VISION",
        "ADD_ATHLETE_EVIDENCE",
        "SET_PREPARATION_LIMITS",
      ],
    };
  }

  if (authorityState === "HAS_COACH_PENDING_REVIEW") {
    return {
      authorityState,
      label: "Review pending",
      missionAvailable: false,
      senseiAvailable: false,
      evidenceAuthority: "COACH_REVIEW_PENDING",
      visionEvidenceLabel: "Review pending",
      visionEvidenceDetail: "Your coach has not approved this correction yet.",
      dashboard: {
        title: "Coach review pending",
        body: "Your coach is reviewing the correction. Sensei remains locked.",
        status: "Review pending",
      },
      sensei: {
        title: "Waiting for your coach’s decision.",
        body: "Sensei stays locked until your coach approves the correction.",
        primaryCta: { label: "View review", action: "VIEW_COACH_REVIEW" },
      },
      fuel: {
        heading: "Check today’s readiness",
        body: "Your coach is reviewing the correction. You can still check today’s readiness.",
        supportingCopy: "Fuel changes preparation, not the correction.",
        authorityLabel: "Review pending",
      },
      primaryCta: { label: "View review", action: "VIEW_COACH_REVIEW" },
      allowedNextActions: [
        "VIEW_COACH_REVIEW",
        "SET_PREPARATION_LIMITS",
      ],
    };
  }

  if (authorityState === "COACH_APPROVED_MISSION") {
    return {
      authorityState,
      label: "Coach approved",
      missionAvailable: true,
      senseiAvailable: true,
      evidenceAuthority: "COACH_APPROVED",
      visionEvidenceLabel: "Coach approved",
      visionEvidenceDetail: "Review evidence against the approved mission.",
      dashboard: {
        title: input.workflow?.correction || "Coach-approved mission",
        body: "Follow the exact approved correction and practice task within today’s preparation limits.",
        status: "Mission active",
      },
      sensei: {
        title: input.workflow?.correction || "Coach-approved mission",
        body: "Sensei reinforces only the exact correction and practice task your coach approved.",
        primaryCta: { label: "Open Sensei", action: "OPEN_SENSEI" },
      },
      fuel: {
        heading: "Check readiness for today’s mission",
        body: "A short body check sets the conditions around the work your coach approved.",
        supportingCopy: "Fuel may narrow today’s conditions. It cannot change the approved correction or practice task.",
        authorityLabel: "Coach approved",
      },
      primaryCta: { label: "Open Sensei", action: "OPEN_SENSEI" },
      allowedNextActions: [
        "OPEN_SENSEI",
        "SET_PREPARATION_LIMITS",
        "RECORD_SESSION_EVIDENCE",
        "OPEN_VISION",
      ],
    };
  }

  return {
    authorityState,
    label: "No active mission",
    missionAvailable: false,
    senseiAvailable: false,
    evidenceAuthority: "OBSERVATION_ONLY",
      visionEvidenceLabel: "Observation only",
      visionEvidenceDetail: "Not yet coach approved.",
      dashboard: {
      title: "No approved mission yet",
      body: "Record the exact correction and practice task your coach gave you.",
      status: "No active mission",
    },
      sensei: {
      title: "Record your coach’s correction.",
      body: "Add your coach’s exact correction and practice task. Sensei begins after approval.",
      primaryCta: {
        label: "Record coach correction",
        action: "RECORD_COACH_CORRECTION",
      },
    },
    fuel: {
      heading: "Check today’s readiness",
      body: "A short body check turns how you feel into clear limits for today’s session.",
      supportingCopy: "Fuel adjusts preparation conditions, not technical work.",
      authorityLabel: "No approved mission",
    },
    primaryCta: {
      label: "Record coach correction",
      action: "RECORD_COACH_CORRECTION",
    },
    allowedNextActions: [
      "RECORD_COACH_CORRECTION",
      "OPEN_VISION",
      "SET_PREPARATION_LIMITS",
    ],
  };
}
