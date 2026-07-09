export type ProofType =
  | "none"
  | "image"
  | "video"
  | "metrics"
  | "self_report";

export type VisionDirective = {
  present?: boolean;
  correction?: string | null;
  severity?: string | null;
  fix_next_rep?: string | null;
};

export type DirectiveProgress = {
  repsCompleted: number;
  repsRequired: number;
  underResistance: boolean;
  proofType: ProofType;
  repeatedFailureCount: number;
  activeDirective?: string;
  updatedAt?: string | null;
};

export type DirectiveState = DirectiveProgress & {
  hasDirective: boolean;
  verified: boolean;
  locked: boolean;
  reason: "no_directive" | "directive_unverified" | "unlocked";
  userMessage: string;
};

type FuelState = {
  present?: boolean;
  score?: number | null;
  rating?: string | null;
  decision?: string | null;
};

function cleanText(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

export function getAcceptedProofLabel(proofType?: ProofType | null) {
  if (proofType === "image") return "Image proof";
  if (proofType === "video") return "Video proof";
  if (proofType === "metrics") return "Performance metrics";
  if (proofType === "self_report") return "Self-report rejected";
  return "No proof";
}

export function normalizeDirectiveProgress(
  input?: Partial<DirectiveProgress> | null
): DirectiveProgress {
  const repsRequired =
    typeof input?.repsRequired === "number" && input.repsRequired > 0
      ? Math.floor(input.repsRequired)
      : 5;

  const repsCompleted =
    typeof input?.repsCompleted === "number" && input.repsCompleted > 0
      ? Math.min(Math.floor(input.repsCompleted), repsRequired)
      : 0;

  const proofType: ProofType =
    input?.proofType === "image" ||
    input?.proofType === "video" ||
    input?.proofType === "metrics" ||
    input?.proofType === "self_report"
      ? input.proofType
      : "none";

  return {
    repsCompleted,
    repsRequired,
    underResistance: input?.underResistance === true,
    proofType,
    repeatedFailureCount:
      typeof input?.repeatedFailureCount === "number" &&
      input.repeatedFailureCount > 0
        ? Math.floor(input.repeatedFailureCount)
        : 0,
    activeDirective: cleanText(input?.activeDirective),
    updatedAt:
      typeof input?.updatedAt === "string" && input.updatedAt
        ? input.updatedAt
        : null,
  };
}

export function resetProgressForDirective(
  activeDirective?: string | null
): DirectiveProgress {
  return normalizeDirectiveProgress({
    repsCompleted: 0,
    repsRequired: 5,
    underResistance: false,
    proofType: "none",
    repeatedFailureCount: 0,
    activeDirective: cleanText(activeDirective),
    updatedAt: new Date().toISOString(),
  });
}

export function buildDirectiveState(args?: {
  directive?: VisionDirective | null;
  progress?: Partial<DirectiveProgress> | null;
  fuel?: FuelState | null;
}): DirectiveState {
  const directiveText = cleanText(args?.directive?.correction);
  const hasDirective = args?.directive?.present === true || !!directiveText;

  const progress = normalizeDirectiveProgress(args?.progress);

  const proofAccepted =
    progress.proofType === "image" ||
    progress.proofType === "video" ||
    progress.proofType === "metrics";

  const verified =
    hasDirective &&
    progress.repsCompleted >= progress.repsRequired &&
    progress.underResistance === true &&
    proofAccepted;

  const reason: DirectiveState["reason"] = !hasDirective
    ? "no_directive"
    : verified
      ? "unlocked"
      : "directive_unverified";

  const locked = !verified;

  let userMessage = "";

  if (!hasDirective) {
    userMessage =
      "Decision: Run Vision first.\n\nWhy: No active correction is loaded.\n\nWhat this fixes: It stops random training.\n\nIf ignored: You will train around an unnamed flaw.\n\nInstruction: Upload one frame and load one correction.";
  } else if (verified) {
    userMessage =
      "Decision: Unlocked.\n\nWhy: The correction has proof under resistance.\n\nWhat this fixes: It allows progression without fake confidence.\n\nIf ignored: You may stay stuck after earning progression.\n\nInstruction: Move to the next correction.";
  } else {
    const remaining = Math.max(
      0,
      progress.repsRequired - progress.repsCompleted
    );

    userMessage =
      `Decision: Stay locked on ${directiveText}.\n\n` +
      `Why: The directive is not verified. ${remaining} clean reps still need proof under resistance.\n\n` +
      "What this fixes: It stops fake progress.\n\n" +
      "If ignored: The same flaw survives contact.\n\n" +
      "Instruction: Complete five clean reps under resistance. Upload image, video, or metrics proof. Self-report does not unlock.";
  }

  return {
    ...progress,
    hasDirective,
    verified,
    locked,
    reason,
    userMessage,
  };
}

export function getLockState(args?: {
  directive?: VisionDirective | null;
  progress?: Partial<DirectiveProgress> | null;
  fuel?: FuelState | null;
}) {
  return buildDirectiveState(args);
}

export function directiveEscalationLine(progress?: Partial<DirectiveProgress>) {
  const normalized = normalizeDirectiveProgress(progress);

  if (normalized.repeatedFailureCount <= 0) {
    return "Initial detection. Fix this now.";
  }

  if (normalized.repeatedFailureCount === 1) {
    return "Repeated failure detected. Slow down and prove the correction.";
  }

  if (normalized.repeatedFailureCount === 2) {
    return "The same flaw is surviving contact. Reduce scope.";
  }

  return "Hard lock. No new work until this correction holds under resistance.";
}

export function isAdvancedPrompt(input: string) {
  const q = cleanText(input).toLowerCase();

  return (
    q.includes("next correction") ||
    q.includes("move on") ||
    q.includes("move to the next") ||
    q.includes("unlock") ||
    q.includes("advance") ||
    q.includes("advanced") ||
    q.includes("new correction") ||
    q.includes("different correction") ||
    q.includes("what else") ||
    q.includes("another flaw") ||
    q.includes("secondary flaw") ||
    q.includes("progress to")
  );
}