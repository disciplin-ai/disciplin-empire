export type ProofType = "image" | "video" | "metrics" | "self_report" | "none";

export type DirectiveProgress = {
  repsCompleted: number;
  repsRequired: number;
  underResistance: boolean;
  proofType: ProofType;
  repeatedFailureCount: number;
  activeDirective?: string;
  updatedAt?: string;
};


export type FighterProfile = {
  fighterId: string;
  name?: string;
  baseArt?: string;
  stance?: string;
  campGoal?: string;
  targetFightWeightKg?: number | null;
};

export type VisionFinding = {
  id: string;
  fighterId: string;
  sourceType?: string;
  sport?: string;
  technique?: string;
  finding: string;
  correction: string;
  severity?: "LOW" | "MEDIUM" | "HIGH" | "low" | "medium" | "high" | string;
  createdAt: string;
};

export type FuelLog = {
  id: string;
  fighterId: string;
  score?: number | null;
  fuelScore?: number | null;
  rating?: string | null;
  decision?: string | null;
  report?: string | null;
  createdAt: string;
};

export type WeightLog = {
  id: string;
  fighterId: string;
  weightKg: number;
  loggedAt: string;
};

export type GymRecommendation = {
  id: string;
  fighterId: string;
  gymId?: string;
  gymName: string;
  reason: string;
  score: number;
  createdAt: string;
};

export type CampAlert = {
  id: string;
  fighterId: string;
  type?: string;
  message: string;
  severity?: "LOW" | "MEDIUM" | "HIGH" | string;
  createdAt: string;
};

export type WeightStatus = {
  latestWeightKg: number | null;
  targetWeightKg: number | null;
  deltaKg: number | null;
  weeklyTrendKg: number | null;
  projection: "on-track" | "off-track" | "unknown";
};

export type DailySession = {
  title: string;
  objective: string;
  blocks: Array<{
    title: string;
    durationMin: number;
    notes: string;
  }>;
};


export type SenseiIntent =
  | "why-directive"
  | "generate-session"
  | "mobility-session"
  | "why-gym"
  | "weight-check"
  | "vision-followup"
  | "fuel-followup"
  | "general";

export type SenseiResponse = {
  directive: string;
  correction: string;
  drill: string;
  explanation?: string;
  session?: DailySession;
  optionalGymSupport?: string;
};export type CampState = {
  fighterId: string;
  directive: string;
  correction: string;
  drill: string;
  priorityFocus: string[];
  dailyChecklist: string[];
  todaysSession: DailySession;
  lastCorrections: VisionFinding[];
  latestFuelLog: FuelLog | null;
  latestWeightLog: WeightLog | null;
  weightStatus: WeightStatus;
  gymRecommendations: GymRecommendation[];
  alerts: CampAlert[];
  generatedAt: string;
};export type FuelLockInput = {
  present?: boolean;
  score?: number | null;
  rating?: string | null;
  decision?: string | null;
};

export type LockState = {
  locked: boolean;
  verified: boolean;
  label:
    | "NO DIRECTIVE"
    | "LOCKED"
    | "PROOF REQUIRED"
    | "FUEL LOCK"
    | "VERIFIED";
  repsRemaining: number;
  userMessage: string;
};

export function normalizeDirectiveProgress(
  input?: Partial<DirectiveProgress>
): DirectiveProgress {
  const repsRequired =
    typeof input?.repsRequired === "number" && input.repsRequired > 0
      ? input.repsRequired
      : 5;

  const repsCompleted =
    typeof input?.repsCompleted === "number"
      ? Math.max(0, Math.min(input.repsCompleted, repsRequired))
      : 0;

  const proofType: ProofType =
    input?.proofType === "image" ||
    input?.proofType === "video" ||
    input?.proofType === "metrics" ||
    input?.proofType === "self_report" ||
    input?.proofType === "none"
      ? input.proofType
      : "none";

  return {
    repsCompleted,
    repsRequired,
    underResistance: input?.underResistance === true,
    proofType,
    repeatedFailureCount:
      typeof input?.repeatedFailureCount === "number"
        ? Math.max(0, input.repeatedFailureCount)
        : 0,
    activeDirective: String(input?.activeDirective || "").trim(),
    updatedAt: input?.updatedAt || new Date().toISOString(),
  };
}

export function resetProgressForDirective(
  activeDirective?: string
): DirectiveProgress {
  return normalizeDirectiveProgress({
    repsCompleted: 0,
    repsRequired: 5,
    underResistance: false,
    proofType: "none",
    repeatedFailureCount: 0,
    activeDirective: String(activeDirective || "").trim(),
    updatedAt: new Date().toISOString(),
  });
}

export function proofIsAccepted(proofType: ProofType) {
  return proofType === "image" || proofType === "video" || proofType === "metrics";
}

export function directiveIsVerified(progress: DirectiveProgress) {
  return (
    progress.repsCompleted >= progress.repsRequired &&
    progress.underResistance === true &&
    proofIsAccepted(progress.proofType)
  );
}

function buildFuelLock(fuel?: FuelLockInput | null): LockState | null {
  if (!fuel?.present) return null;

  const score =
    typeof fuel.score === "number" && Number.isFinite(fuel.score)
      ? fuel.score
      : null;

  const rating = String(fuel.rating || "").toUpperCase();
  const decision = String(fuel.decision || "").trim();

  if (rating === "TRASH") {
    return {
      locked: true,
      verified: false,
      label: "FUEL LOCK",
      repsRemaining: 0,
      userMessage: [
        "Decision: Fuel lock.",
        "",
        "Why: Your fuel is too poor for hard training today.",
        "",
        "What this fixes: It stops you blaming technique when the real problem is preparation.",
        "",
        "If ignored: You will turn a correction session into tired, messy reps.",
        "",
        `Instruction: Fix the next meal first.${decision ? ` ${decision}` : ""}`,
      ].join("\n"),
    };
  }

  if (score !== null && score < 50) {
    return {
      locked: true,
      verified: false,
      label: "FUEL LOCK",
      repsRemaining: 0,
      userMessage: [
        "Decision: Fuel lock.",
        "",
        `Why: Fuel score is ${score}/100. You are not ready for hard rounds.`,
        "",
        "What this fixes: It keeps the correction clean instead of letting fatigue hide the mistake.",
        "",
        "If ignored: The same mistake will come back as soon as the pace rises.",
        "",
        "Instruction: Technical work only. No hard rounds. No advanced layer.",
      ].join("\n"),
    };
  }

  return null;
}

export function getLockState(args: {
  directive?: {
    present?: boolean;
    correction?: string | null;
  };
  progress: DirectiveProgress;
  fuel?: FuelLockInput | null;
}): LockState {
  const directive = String(args.directive?.correction || "").trim();
  const progress = normalizeDirectiveProgress(args.progress);

  const fuelLock = buildFuelLock(args.fuel);
  if (fuelLock) return fuelLock;

  const verified = directiveIsVerified(progress);
  const repsRemaining = Math.max(
    0,
    progress.repsRequired - progress.repsCompleted
  );

  if (!directive) {
    return {
      locked: false,
      verified: false,
      label: "NO DIRECTIVE",
      repsRemaining: progress.repsRequired,
      userMessage:
        "Decision: Run Vision first.\n\nWhy: There is no active correction to prove.\n\nInstruction: Upload one frame. Get one correction. Then prove it.",
    };
  }

  if (verified) {
    return {
      locked: false,
      verified: true,
      label: "VERIFIED",
      repsRemaining: 0,
      userMessage:
        "Decision: Approved.\n\nWhy: You completed clean reps with accepted proof.\n\nInstruction: You may open the next layer.",
    };
  }

  if (
    progress.repsCompleted >= progress.repsRequired &&
    !proofIsAccepted(progress.proofType)
  ) {
    return {
      locked: true,
      verified: false,
      label: "PROOF REQUIRED",
      repsRemaining: 0,
      userMessage:
        "Decision: Proof required.\n\nWhy: Reps mean nothing without proof.\n\nInstruction: Submit image, video, or metrics proof. Self-report does not unlock.",
    };
  }

  return {
    locked: true,
    verified: false,
    label: "LOCKED",
    repsRemaining,
    userMessage: `Decision: No.

Why: You are not ready to move on yet.

What this fixes: It keeps you from learning new skills while the same mistake is still showing up.

Instruction: Complete ${repsRemaining} more clean rep${
      repsRemaining === 1 ? "" : "s"
    } with a resisting partner, then submit image, video, or metrics proof.`,
  };
}

export function isAdvancedPrompt(text: string) {
  const q = String(text || "").toLowerCase();

  return (
    q.includes("next directive") ||
    q.includes("move on") ||
    q.includes("new correction") ||
    q.includes("advanced") ||
    q.includes("next layer") ||
    q.includes("unlock") ||
    q.includes("hard rounds") ||
    q.includes("full session") ||
    q.includes("go hard")
  );
}