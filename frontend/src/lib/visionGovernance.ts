export type DecisionAuthority =
  | "QUALIFIED_RESTRICTION"
  | "COACH_DECISION"
  | "ATHLETE_CONTEXT"
  | "VISION_INTERPRETATION"
  | "VISION_HYPOTHESIS";

export type EvidenceStrength =
  | "MULTIPLE_SUPPORTING_CLIPS"
  | "LONGER_SEQUENCE"
  | "SHORT_CLIP"
  | "SINGLE_FRAME"
  | "ATHLETE_RECOLLECTION"
  | "VISION_HYPOTHESIS";

export type VisionClaimKind =
  | "OBSERVATION"
  | "INFERENCE"
  | "ALTERNATIVE"
  | "UNCERTAINTY"
  | "COACH_DECISION";

export type EvidenceAdequacy =
  | "ADEQUATE_FOR_DIRECT_OBSERVATION"
  | "ADEQUATE_FOR_LIMITED_INTERPRETATION"
  | "INSUFFICIENT_TO_IDENTIFY_CAUSE"
  | "REQUIRES_EARLIER_SEQUENCE"
  | "REQUIRES_ANOTHER_ANGLE"
  | "REQUIRES_CLEARER_FOOTAGE";

export type CoachReviewOutcome =
  | "CONFIRMED"
  | "MODIFIED"
  | "REJECTED"
  | "WITHDRAWN";

export type CoachReviewStatus =
  | "ACTIVE"
  | "SUPERSEDED"
  | "WITHDRAWN";

export type MediaKind =
  | "SINGLE_FRAME"
  | "SHORT_CLIP"
  | "LONGER_CLIP";

export type VisionMediaEvidence = {
  id: string;
  name: string;
  kind: MediaKind;
  mimeType: string;
  capturedAt: string;
  sha256?: string;
  durationSeconds?: number | null;
  quality: "CLEAR" | "LIMITED" | "POOR";
  obstructed: boolean;
  angleAdequate: boolean;
  showsSetup: boolean;
  showsOpponentReaction: boolean;
  showsOutcome: boolean;
  footageContext: "TRAINING" | "COMPETITION" | "UNKNOWN";
};

export type VisionProvenance = {
  source:
    | "VISION_OBSERVATION"
    | "VISION_INTERPRETATION"
    | "VISION_HYPOTHESIS"
    | "ATHLETE_CONTEXT"
    | "COACH_OBSERVATION"
    | "COACH_DECISION"
    | "QUALIFIED_RESTRICTION";
  mediaId?: string;
  timestampStart?: string | null;
  timestampEnd?: string | null;
  frameReference?: string | null;
  athleteContextAttached: boolean;
  coachReviewed: boolean;
  createdAt: string;
};

export type VisionClaim = {
  id: string;
  kind: VisionClaimKind;
  statement: string;
  decisionAuthority: DecisionAuthority;
  evidenceStrength: EvidenceStrength;
  confidence: "LOW" | "MEDIUM" | "HIGH";
  uncertainty?: string;
  provenance: VisionProvenance;
};

export type AthleteContext = {
  id: string;
  statement: string;
  question?: string;
  createdAt: string;
};

export type EvidenceAssessment = {
  adequacy: EvidenceAdequacy;
  canObserve: boolean;
  canInfer: boolean;
  evidenceStrength: EvidenceStrength;
  supports: string[];
  cannotEstablish: string[];
  request?: string;
};

export type CoachReviewVersion = {
  id: string;
  packageId: string;
  coachId: string;
  createdAt: string;
  outcome: CoachReviewOutcome;
  status: CoachReviewStatus;
  observationDecision: string;
  priorityCorrection?: string;
  relevantReaction?: string;
  nextDecision?: string;
  rationale?: string;
  supersedes?: string;
  supersededBy?: string;
};

export type VisionReviewPackage = {
  id: string;
  createdAt: string;
  media: VisionMediaEvidence;
  evidenceAssessment: EvidenceAssessment;
  athleteContext?: AthleteContext;
  claims: VisionClaim[];
  coachReviews: CoachReviewVersion[];
  authorityState:
    | "NO_COACH_CONNECTED"
    | "COACH_BACKEND_UNAVAILABLE"
    | "COACH_INVITATION_PENDING"
    | "HAS_COACH_NO_MISSION"
    | "HAS_COACH_PENDING_REVIEW"
    | "COACH_APPROVED_MISSION"
    | "ATHLETE_DIRECTED";
  evidenceAuthority:
    | "COACH_APPROVED"
    | "COACH_REVIEW_PENDING"
    | "ATHLETE_DIRECTED"
    | "OBSERVATION_ONLY";
  reviewState:
    | "NOT_SUBMITTED"
    | "REVIEW_PENDING"
    | "COACH_REVIEWED";
};

export type VisionModelOutput = {
  observation: string;
  inference: string;
  alternative: string;
  uncertainty: string;
  timestampStart?: string | null;
  timestampEnd?: string | null;
  confidence: "LOW" | "MEDIUM" | "HIGH";
};

const FORBIDDEN_VISION_FIELDS = [
  "coach_command",
  "correction",
  "primary_mistake",
  "fix_next_rep",
  "next_correction",
  "decision",
  "drill",
  "drills",
  "train",
  "training_plan",
  "mission",
  "proof_status",
  "required_proof",
  "retention_status",
  "mastery",
  "progression",
  "force_see_go",
] as const;

const INSTRUCTION_QUESTION =
  /\b(what should i train|what drill|game ?plan|what correction|what should i do under pressure|did i master|should i progress)\b/i;

function nonEmpty(value: unknown) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function nowIso() {
  return new Date().toISOString();
}

function makeId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

export function evidenceStrengthFor(
  media: VisionMediaEvidence
): EvidenceStrength {
  if (media.kind === "LONGER_CLIP") {
    return "LONGER_SEQUENCE";
  }

  if (media.kind === "SHORT_CLIP") {
    return "SHORT_CLIP";
  }

  return "SINGLE_FRAME";
}

export function assessEvidence(
  media: VisionMediaEvidence
): EvidenceAssessment {
  const strength = evidenceStrengthFor(media);

  if (media.quality === "POOR") {
    return {
      adequacy: "REQUIRES_CLEARER_FOOTAGE",
      canObserve: false,
      canInfer: false,
      evidenceStrength: strength,
      supports: [],
      cannotEstablish: [
        "Position",
        "Timing",
        "Cause",
      ],
      request:
        "Upload clearer footage with both athletes visible.",
    };
  }

  if (media.obstructed || !media.angleAdequate) {
    return {
      adequacy: "REQUIRES_ANOTHER_ANGLE",
      canObserve: true,
      canInfer: false,
      evidenceStrength: strength,
      supports: [
        "Visible portions of the position",
      ],
      cannotEstablish: [
        "The obscured position",
        "Cause",
      ],
      request:
        "Upload an angle that shows the relevant position clearly.",
    };
  }

  if (media.kind === "SINGLE_FRAME") {
    return {
      adequacy: "INSUFFICIENT_TO_IDENTIFY_CAUSE",
      canObserve: true,
      canInfer: false,
      evidenceStrength: "SINGLE_FRAME",
      supports: [
        "Posture",
        "Alignment",
        "Grip",
        "Visible spatial relationship",
      ],
      cannotEstablish: [
        "Timing",
        "Reaction sequence",
        "Causation",
      ],
      request:
        "Upload the sequence before this frame to examine why it happened.",
    };
  }

  if (
    !media.showsSetup ||
    !media.showsOpponentReaction
  ) {
    return {
      adequacy: "REQUIRES_EARLIER_SEQUENCE",
      canObserve: true,
      canInfer: false,
      evidenceStrength: strength,
      supports: [
        "Visible action inside the uploaded segment",
      ],
      cannotEstablish: [
        "Setup",
        "Opponent reaction",
        "Decision timing",
      ],
      request:
        "Upload the sequence before commitment so the setup and reaction are visible.",
    };
  }

  return {
    adequacy:
      media.quality === "LIMITED"
        ? "ADEQUATE_FOR_LIMITED_INTERPRETATION"
        : "ADEQUATE_FOR_DIRECT_OBSERVATION",
    canObserve: true,
    canInfer: media.quality === "CLEAR",
    evidenceStrength: strength,
    supports: [
      "Setup",
      "Opponent reaction",
      "Visible decision",
      "Outcome",
    ],
    cannotEstablish: [
      "Internal intention",
      "Mastery",
      "Retention",
    ],
  };
}

export function validateVisionModelOutput(
  raw: Record<string, unknown>
): VisionModelOutput {
  for (const field of FORBIDDEN_VISION_FIELDS) {
    if (
      field in raw &&
      raw[field] != null &&
      raw[field] !== ""
    ) {
      throw new Error(
        `Vision crossed its authority boundary: ${field}`
      );
    }
  }

  const observation = nonEmpty(raw.observation);
  const uncertainty = nonEmpty(raw.uncertainty);

  if (!observation) {
    throw new Error(
      "Vision must return one direct observation."
    );
  }

  if (!uncertainty) {
    throw new Error(
      "Vision must state what the evidence cannot establish."
    );
  }

  const confidence = nonEmpty(
    raw.confidence
  ).toUpperCase();

  if (
    !new Set([
      "LOW",
      "MEDIUM",
      "HIGH",
    ]).has(confidence)
  ) {
    throw new Error(
      "Vision confidence must be LOW, MEDIUM, or HIGH."
    );
  }

  return {
    observation,
    inference: nonEmpty(raw.inference),
    alternative: nonEmpty(raw.alternative),
    uncertainty,
    timestampStart:
      nonEmpty(raw.timestampStart) || null,
    timestampEnd:
      nonEmpty(raw.timestampEnd) || null,
    confidence:
      confidence as VisionModelOutput["confidence"],
  };
}

export function buildReviewPackage(args: {
  media: VisionMediaEvidence;
  output: VisionModelOutput;
  athleteContext?: AthleteContext;
  authorityState?: VisionReviewPackage["authorityState"];
  evidenceAuthority?: VisionReviewPackage["evidenceAuthority"];
}): VisionReviewPackage {
  const evidenceAssessment = assessEvidence(
    args.media
  );

  if (!evidenceAssessment.canObserve) {
    throw new Error(
      evidenceAssessment.request ||
        "Evidence is insufficient."
    );
  }

  const createdAt = nowIso();

  const baseProvenance: VisionProvenance = {
    mediaId: args.media.id,
    timestampStart:
      args.output.timestampStart || null,
    timestampEnd:
      args.output.timestampEnd || null,
    frameReference:
      args.media.kind === "SINGLE_FRAME"
        ? args.media.id
        : null,
    athleteContextAttached:
      Boolean(args.athleteContext),
    coachReviewed: false,
    createdAt,
    source: "VISION_OBSERVATION",
  };

  const claims: VisionClaim[] = [
    {
      id: makeId("claim"),
      kind: "OBSERVATION",
      statement: args.output.observation,
      decisionAuthority:
        "VISION_INTERPRETATION",
      evidenceStrength:
        evidenceAssessment.evidenceStrength,
      confidence: args.output.confidence,
      provenance: baseProvenance,
    },
  ];

  if (
    evidenceAssessment.canInfer &&
    args.output.inference
  ) {
    claims.push({
      id: makeId("claim"),
      kind: "INFERENCE",
      statement: args.output.inference,
      decisionAuthority:
        "VISION_INTERPRETATION",
      evidenceStrength:
        evidenceAssessment.evidenceStrength,
      confidence: args.output.confidence,
      uncertainty: args.output.uncertainty,
      provenance: {
        ...baseProvenance,
        source: "VISION_INTERPRETATION",
      },
    });
  }

  if (
    evidenceAssessment.canInfer &&
    args.output.alternative
  ) {
    claims.push({
      id: makeId("claim"),
      kind: "ALTERNATIVE",
      statement: args.output.alternative,
      decisionAuthority:
        "VISION_HYPOTHESIS",
      evidenceStrength:
        "VISION_HYPOTHESIS",
      confidence: "LOW",
      uncertainty: args.output.uncertainty,
      provenance: {
        ...baseProvenance,
        source: "VISION_HYPOTHESIS",
      },
    });
  }

  claims.push({
    id: makeId("claim"),
    kind: "UNCERTAINTY",
    statement: args.output.uncertainty,
    decisionAuthority:
      "VISION_HYPOTHESIS",
    evidenceStrength:
      evidenceAssessment.evidenceStrength,
    confidence: "HIGH",
    provenance: {
      ...baseProvenance,
      source: "VISION_HYPOTHESIS",
    },
  });

  return {
    id: makeId("vision_review"),
    createdAt,
    media: args.media,
    evidenceAssessment,
    athleteContext: args.athleteContext,
    claims,
    coachReviews: [],
    authorityState: args.authorityState || "HAS_COACH_NO_MISSION",
    evidenceAuthority: args.evidenceAuthority || "OBSERVATION_ONLY",
    reviewState: "NOT_SUBMITTED",
  };
}

export function appendCoachReview(
  reviewPackage: VisionReviewPackage,
  input: Omit<
    CoachReviewVersion,
    | "id"
    | "packageId"
    | "createdAt"
    | "status"
    | "supersedes"
  >
): VisionReviewPackage {
  const active =
    activeCoachReview(reviewPackage);

  const nextReview: CoachReviewVersion = {
    ...input,
    id: makeId("coach_review"),
    packageId: reviewPackage.id,
    createdAt: nowIso(),
    status:
      input.outcome === "WITHDRAWN"
        ? "WITHDRAWN"
        : "ACTIVE",
    supersedes: active?.id,
  };

  return {
    ...reviewPackage,
    coachReviews: [
      ...reviewPackage.coachReviews,
      nextReview,
    ],
    reviewState: "COACH_REVIEWED",
    claims: reviewPackage.claims,
  };
}

export function activeCoachReview(
  reviewPackage: VisionReviewPackage
) {
  const superseded = new Set(
    reviewPackage.coachReviews
      .map((review) => review.supersedes)
      .filter(
        (id): id is string => Boolean(id)
      )
  );

  return (
    [...reviewPackage.coachReviews]
      .reverse()
      .find(
        (review) =>
          review.status === "ACTIVE" &&
          !superseded.has(review.id)
      ) || null
  );
}

export function coachReviewStatus(
  reviewPackage: VisionReviewPackage,
  reviewId: string
): CoachReviewStatus {
  const review =
    reviewPackage.coachReviews.find(
      (item) => item.id === reviewId
    );

  if (
    !review ||
    review.status === "WITHDRAWN"
  ) {
    return "WITHDRAWN";
  }

  return reviewPackage.coachReviews.some(
    (item) => item.supersedes === reviewId
  )
    ? "SUPERSEDED"
    : "ACTIVE";
}

export function canVisionAnswer(
  question: string
) {
  const value = nonEmpty(question);

  if (!value) {
    return {
      allowed: false,
      reason:
        "Ask about the active evidence.",
    };
  }

  if (INSTRUCTION_QUESTION.test(value)) {
    return {
      allowed: false,
      reason:
        "That requires a coach decision. Vision can prepare the relevant evidence for review.",
    };
  }

  return {
    allowed: true,
    reason: "",
  };
}

export const VISION_SYSTEM_INSTRUCTION = `
Vision is a film-room evidence system, not a coach.
Answer only: What happened in this evidence, and what should the coach review?

Return exactly:
- observation: one directly visible statement without causal language
- inference: one possible explanation, only when the sequence supports it
- alternative: one credible alternative explanation
- uncertainty: the most important fact the evidence cannot establish
- timestampStart and timestampEnd when available
- confidence: LOW, MEDIUM, or HIGH

Never create a correction, command, drill, tactic, game plan, mission, proof result,
retention judgement, mastery judgement, or progression decision.
Never present athlete context as visible evidence.
Never present interpretation as observation.
For a single frame, do not infer timing or causation.
When evidence is insufficient, request the exact missing sequence or angle.
Coach review is always required before a technical priority changes.
`.trim();
