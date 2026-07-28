export type Id = string;
export type IsoDateTime = string;

export type SenseiOperatingMode = "coach_connected" | "athlete_only";

export type CorrectionOrigin =
  | "coach"
  | "disciplin"
  | "athlete"
  | "sensei";

export type CorrectionSourceType =
  | "vision_observation"
  | "coach_observation"
  | "coach_conversation"
  | "competition_review"
  | "athlete_reflection"
  | "live_coaching"
  | "training_note";

export type ApprovalStatus =
  | "not_requested"
  | "pending"
  | "approved"
  | "rejected";

export type AuthorityLabel =
  | "coach_entered"
  | "coach_approved"
  | "disciplin_suggested"
  | "athlete_entered"
  | "sensei_inference";

export type ActorRef = {
  id: Id;
  name: string;
  role: "coach" | "athlete" | "staff" | "system";
};

export type ApprovalRecord = {
  status: ApprovalStatus;
  approvingCoach: ActorRef | null;
  decidedAt: IsoDateTime | null;
  note: string | null;
};

export type RevisionRecord = {
  id: Id;
  editor: ActorRef;
  editedAt: IsoDateTime;
  previousWording: string;
  nextWording: string;
  reason: string | null;
};

export type Provenance = {
  origin: CorrectionOrigin;
  sourceType?: CorrectionSourceType;
  originalAuthor: ActorRef;
  originalWording: string;
  createdAt: IsoDateTime;
  approval: ApprovalRecord;
  supportingEvidenceIds: Id[];
  revisions: RevisionRecord[];
  applicableContext: string[];
  confidence: "unknown" | "low" | "medium" | "high";
  limitations: string[];
};

export type ResistanceLevel =
  | "cooperative"
  | "prescribed_reaction"
  | "variable_reaction"
  | "live_resistance";

export type CorrectionStatus =
  | "draft"
  | "pending_coach_approval"
  | "active"
  | "closed"
  | "superseded";

export type BreakType =
  | "perception"
  | "decision"
  | "timing"
  | "execution"
  | "composure"
  | "conditioning"
  | "unknown";

export type DecisionRule = {
  id: Id;
  information: string;
  ifObserved: string;
  thenDecision: string;
  otherwise: string | null;
};

export type PracticeTask = {
  setup: string;
  athleteTask: string;
  partnerTask: string;
  attemptsRequested: number | null;
  permittedResistance: ResistanceLevel;
  restrictions: string[];
};

export type EvidenceSource =
  | "athlete_reported"
  | "video_attached"
  | "partner_confirmed"
  | "coach_observed"
  | "coach_reviewed";

export type EvidenceState =
  | "planned"
  | "practised"
  | "evidence_submitted"
  | "awaiting_coach_review"
  | "continue_current_correction"
  | "progression_approved"
  | "correction_reopened";

export type EvidenceRequest = {
  sourcesRequested: EvidenceSource[];
  practiceTaskRequired: string;
  resistanceRequired: ResistanceLevel;
  attemptsRequested: number | null;
  questionForCoach: string | null;
};

export type PracticeEvidence = {
  id: Id;
  correctionId: Id;
  athleteId: Id;
  practisedAt: IsoDateTime;
  practiceTask: string;
  resistanceLevel: ResistanceLevel;
  attempts: number | null;
  athleteReport: string | null;
  sources: EvidenceSource[];
  attachmentIds: Id[];
  partnerConfirmation: string | null;
  observedBreak: BreakType;
  whatBroke: string | null;
  unresolvedQuestion: string | null;
  state: EvidenceState;
  coachReview: {
    reviewedBy: ActorRef | null;
    reviewedAt: IsoDateTime | null;
    decision:
      | "not_reviewed"
      | "continue"
      | "modify_cue"
      | "change_constraint"
      | "increase_resistance"
      | "approve_progression"
      | "reopen";
    note: string | null;
  };
};

export type ActiveCorrection = {
  id: Id;
  athleteId: Id;
  status: CorrectionStatus;
  coachExactCue: string;
  performanceProblem: string;
  whyItMatters: string;
  informationToRecognise: string[];
  decisionRules: DecisionRule[];
  practiceTask: PracticeTask;
  successCondition: string;
  failureCondition: string;
  evidenceRequested: EvidenceRequest;
  provenance: Provenance;
  introducedAt: IsoDateTime;
  closedAt: IsoDateTime | null;
  reopenedFromCorrectionId: Id | null;
};

export type IdentityClaimKind =
  | "how_athlete_wins"
  | "how_athlete_loses"
  | "pressure_break"
  | "preferred_position"
  | "position_to_avoid"
  | "priority_chain"
  | "coach_language"
  | "emotional_trigger";

export type IdentityClaim = {
  id: Id;
  athleteId: Id;
  kind: IdentityClaimKind;
  statement: string;
  provenance: Provenance;
  status: "hypothesis" | "established" | "retired";
  supportingSessionIds: Id[];
  lastObservedAt: IsoDateTime | null;
};

export type FuelPracticeConstraint = {
  assessment: "not_assessed" | "assessed";
  assessedAt: IsoDateTime | null;
  maximumResistance: ResistanceLevel | null;
  restrictions: string[];
  reason: string | null;
  sourceEvidenceIds: Id[];
};

export type SenseiConstitutionState = {
  operatingMode: SenseiOperatingMode;
  activeCorrection: ActiveCorrection | null;
  suggestedCorrection: ActiveCorrection | null;
  evidenceState: EvidenceState;
  fuelConstraint: FuelPracticeConstraint;
};

export type AuthorityDecision = {
  canBecomeActive: boolean;
  label: AuthorityLabel;
  reason: string;
};

export function authorityLabel(provenance: Provenance): AuthorityLabel {
  if (provenance.origin === "coach") return "coach_entered";
  if (provenance.approval.status === "approved") return "coach_approved";
  if (provenance.origin === "disciplin") return "disciplin_suggested";
  if (provenance.origin === "athlete") return "athlete_entered";
  return "sensei_inference";
}

export function correctionAuthorityDecision(
  correction: ActiveCorrection,
  mode: SenseiOperatingMode
): AuthorityDecision {
  const label = authorityLabel(correction.provenance);

  if (correction.provenance.approval.status === "rejected") {
    return {
      canBecomeActive: false,
      label,
      reason: "A rejected correction cannot become active.",
    };
  }

  if (correction.provenance.origin === "coach") {
    return {
      canBecomeActive: true,
      label,
      reason: "The correction was entered directly by a coach.",
    };
  }

  if (
    correction.provenance.approval.status === "approved" &&
    correction.provenance.approval.approvingCoach?.role === "coach" &&
    Boolean(correction.provenance.approval.decidedAt)
  ) {
    return {
      canBecomeActive: true,
      label,
      reason: "A coach reviewed and approved the correction.",
    };
  }

  if (correction.provenance.approval.status === "approved") {
    return {
      canBecomeActive: false,
      label,
      reason: "Approval is incomplete without an approving coach and decision date.",
    };
  }

  if (
    mode === "athlete_only" &&
    (correction.provenance.origin === "disciplin" ||
      correction.provenance.origin === "athlete")
  ) {
    return {
      canBecomeActive: true,
      label,
      reason:
        "Athlete-only mode permits this correction, but its non-coach authority must remain visible.",
    };
  }

  return {
    canBecomeActive: false,
    label,
    reason:
      correction.provenance.origin === "sensei"
        ? "Sensei inferences cannot become active corrections."
        : "This correction requires coach approval before activation.",
  };
}

export function assertSingleActiveCorrection(
  corrections: ActiveCorrection[]
): ActiveCorrection | null {
  const active = corrections.filter((item) => item.status === "active");

  if (active.length > 1) {
    throw new Error("Sensei constitution violation: more than one active correction.");
  }

  return active[0] ?? null;
}

export function evidenceStateFromRecord(
  evidence: PracticeEvidence | null
): EvidenceState {
  if (!evidence) return "planned";
  return evidence.state;
}

export function progressionWasCoachApproved(
  evidence: PracticeEvidence
): boolean {
  return (
    evidence.sources.includes("coach_reviewed") &&
    evidence.coachReview.decision === "approve_progression" &&
    evidence.coachReview.reviewedBy?.role === "coach" &&
    Boolean(evidence.coachReview.reviewedAt)
  );
}

const resistanceOrder: ResistanceLevel[] = [
  "cooperative",
  "prescribed_reaction",
  "variable_reaction",
  "live_resistance",
];

export function constrainResistance(
  requested: ResistanceLevel,
  fuel: FuelPracticeConstraint
): ResistanceLevel {
  if (fuel.assessment === "not_assessed" || !fuel.maximumResistance) {
    return requested;
  }

  const requestedIndex = resistanceOrder.indexOf(requested);
  const maximumIndex = resistanceOrder.indexOf(fuel.maximumResistance);
  return resistanceOrder[Math.min(requestedIndex, maximumIndex)];
}

