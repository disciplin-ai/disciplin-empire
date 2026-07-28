"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import SenseiScreen from "./SenseiScreen";
import { useProfile } from "@/components/ProfileProvider";
import { useShellInteraction } from "@/components/ShellInteractionProvider";
import { useWorkflow } from "@/components/WorkflowProvider";
import { useCoach } from "@/components/CoachProvider";
import { approvedMissionToCorrection } from "@/lib/coach/sensei";
import { readUserJson, writeUserJson } from "@/lib/userScopedStorage";

import {
  isAdvancedPrompt,
  normalizeDirectiveProgress,
  type DirectiveProgress,
} from "@/lib/disciplin/types";

import {
  buildPressureDisciplineCard,
  defaultPressureDisciplineCard,
  type PressureDisciplineCard,
} from "@/lib/disciplin/pressureDiscipline";

import {
  authorityLabel,
  type ActiveCorrection,
  type EvidenceState,
  type FuelPracticeConstraint,
  type SenseiConstitutionState,
  type SenseiOperatingMode,
} from "@/lib/disciplin/sensei/contracts";

export type MessageSection =
  | "all"
  | "overview"
  | "training"
  | "nutrition"
  | "recovery"
  | "decisions";

export type ChatMessage = {
  id: string;
  role: "user" | "sensei" | "system";
  text: string;
  pending?: boolean;
  section?: MessageSection;
  deliveryMode?: "analysis" | "coaching";
  responseMode?: string;
  stateUpdate?: {
    psychologicalTrigger?: string;
    gameplanFocus?: string;
    activeCorrection?: string;
    nextDecision?: string;
    proofStatus?: string;
    correctionSource?: string;
    coachApproved?: boolean;
  };
};

export type SenseiGym = {
  id: string;
  name: string;
  location: string;
  compatibility: number;
  disciplineMatch: string[];
  styleMatch: string[];
  watchOut: string[];
  href?: string;
  verified: boolean;
};

export type SenseiConnected = {
  vision?: {
    present?: boolean;
    correction?: string;
    severity?: string;
    fix_next_rep?: string;
  };
  fuel?: {
    present?: boolean;
    score?: number;
    rating?: string;
    decision?: string;
  };
  psychology?: {
    present?: boolean;
    summary?: string;
    commandStyle?: string;
  };
  profile?: {
    present?: boolean;
    baseArt?: string;
    paceStyle?: string;
    weaknesses?: string;
    primaryStyle?: string;
    aGame?: string;
    winCondition?: string;
    preferredPositions?: string;
    bestAttacks?: string;
    currentGameplan?: string;
    commonEmotionalTriggers?: string;
    coachConnected?: boolean;
    coachId?: string;
    coachName?: string;
  };
  gyms?: SenseiGym[];
};

type SenseiSessionState = {
  lastDecision?: string;
  lastCommand?: string;
  lastWhy?: string;
  lastUpdated?: string;
  awaitingPsychologyAnswer?: boolean;
  psychologyTopic?: string;
  previousQuestion?: string;
};

const SENSEI_STATE_KEY = "disciplin_sensei_state_v2";
const DIRECTIVE_PROGRESS_KEY = "disciplin_directive_progress";
const VISION_DIRECTIVE_KEY = "disciplin_vision_directive";
const LATEST_VISION_KEY = "disciplin_latest_vision";
const SENSEI_GYMS_KEY = "disciplin_connected_gyms";
const LATEST_FUEL_KEY = "disciplin_latest_fuel";
const PRESSURE_CARD_KEY = "disciplin_pressure_card_v1";
const SENSEI_CONSTITUTION_KEY = "disciplin_sensei_constitution_v1";

const MIN_SENSEI_DELAY_MS = 1750;
const LOCK_DELAY_MS = 900;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function holdPremiumDelay(startedAt: number, minMs = MIN_SENSEI_DELAY_MS) {
  const elapsed = Date.now() - startedAt;
  if (elapsed < minMs) await sleep(minMs - elapsed);
}

function makeId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function cleanInput(input: unknown) {
  return String(input ?? "").replace(/\s+/g, " ").trim();
}

function cleanMultiline(input: unknown) {
  return String(input ?? "")
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function hasWord(text: string, word: string) {
  return new RegExp(`\\b${word}\\b`, "i").test(text);
}

function wantsGymDecision(q: string) {
  return (
    hasWord(q, "gym") ||
    hasWord(q, "gyms") ||
    q.includes("which gym") ||
    q.includes("pick a gym") ||
    q.includes("choose a gym") ||
    q.includes("where should i train") ||
    q.includes("where do i train")
  );
}

function wantsUnlockDecision(q: string) {
  return (
    q.includes("move to the next correction") ||
    q.includes("move on to the next correction") ||
    q.includes("next correction") ||
    q.includes("can i move on") ||
    q.includes("can i advance") ||
    q.includes("unlock") ||
    q.includes("progress to")
  );
}

function inferSectionFromText(text: string): MessageSection {
  const q = text.toLowerCase().trim();
  const has = (...terms: string[]) => terms.some((term) => q.includes(term));

  if (
    has(
      "taunt",
      "taunts",
      "taunted",
      "trash talk",
      "trash talked",
      "ego",
      "panic",
      "panicked",
      "rush",
      "rushing",
      "rushed",
      "angry",
      "emotion",
      "emotional",
      "desperate",
      "revenge",
      "embarrassed",
      "mocked",
      "pressure",
      "tilt",
      "frustrated",
      "nervous",
      "fear",
      "prove myself",
      "wanted to prove",
      "makes me rush",
      "so i rush",
      "got desperate",
      "abandoned my",
      "abandon my",
      "lost composure",
      "lost discipline"
    )
  ) {
    return "decisions";
  }

  if (
    has(
      "nutrition",
      "fuel",
      "meal",
      "food",
      "protein",
      "carb",
      "carbs",
      "calories",
      "hydration",
      "diet",
      "bulk",
      "shawarma",
      "burger",
      "fries",
      "junk food"
    )
  ) {
    return "nutrition";
  }

  if (
    has(
      "recovery",
      "sleep",
      "rest",
      "fatigue",
      "sore",
      "injury",
      "pain",
      "drained",
      "exhausted",
      "burnout",
      "overtrained",
      "tired",
      "mobility",
      "stiff"
    )
  ) {
    return "recovery";
  }

  if (wantsGymDecision(q) || wantsUnlockDecision(q)) {
    return "decisions";
  }

  if (
    has(
      "training",
      "train",
      "drill",
      "rep",
      "stance",
      "shot",
      "double leg",
      "single leg",
      "takedown",
      "takedowns",
      "wrestling",
      "boxing",
      "grappling",
      "spar",
      "jab",
      "kick",
      "guard",
      "scramble",
      "underhook",
      "hips",
      "entry",
      "technique",
      "mechanics",
      "footwork",
    "overtraining",
"training load",
"lower body",
"wrestling",
"same day",
"too much volume",
    )
  ) {
    return "training";
  }

  if (has("overview", "summary", "big picture", "roadmap", "system")) {
    return "overview";
  }

  return "decisions";
}

function defaultConnected(): SenseiConnected {
  return {
    vision: {
      present: false,
      correction: "",
      severity: "",
      fix_next_rep: "",
    },
    fuel: {
      present: false,
      score: 0,
      rating: "",
      decision: "",
    },
    psychology: {
      present: false,
      summary: "",
      commandStyle: "",
    },
    profile: {
      present: false,
      baseArt: "",
      paceStyle: "",
      weaknesses: "",
    },
    gyms: [],
  };
}

function defaultSessionState(): SenseiSessionState {
  return {
    lastDecision: "",
    lastCommand: "",
    lastWhy: "",
    lastUpdated: "",
  };
}

function extractConnectedGyms(userId: string | null): SenseiGym[] {
  const gyms = readUserJson<SenseiGym[]>(userId, SENSEI_GYMS_KEY);
  return Array.isArray(gyms) ? gyms : [];
}

function extractFuelMemory(userId: string | null): SenseiConnected["fuel"] {
  const fuel = readUserJson<{
    present?: boolean;
    score?: number;
    rating?: string;
    decision?: string;
  }>(userId, LATEST_FUEL_KEY);

  if (!fuel) return defaultConnected().fuel;

  return {
    present: true,
    score: typeof fuel.score === "number" ? fuel.score : 0,
    rating: cleanInput(fuel.rating),
    decision: cleanInput(fuel.decision),
  };
}

function extractVisionDirective(userId: string | null): SenseiConnected["vision"] {
  const direct = readUserJson<{
    correction?: string;
    severity?: string;
    fix_next_rep?: string;
  }>(userId, VISION_DIRECTIVE_KEY);

  const correction = cleanInput(direct?.correction);

  if (correction) {
    return {
      present: true,
      correction,
      severity: cleanInput(direct?.severity) || "HIGH",
      fix_next_rep: cleanMultiline(direct?.fix_next_rep),
    };
  }

  const latest = readUserJson<any>(userId, LATEST_VISION_KEY);
  const finding = Array.isArray(latest?.findings) ? latest.findings[0] : null;
  const title = cleanInput(finding?.title);

  if (!title) return defaultConnected().vision;

  return {
    present: true,
    correction: title,
    severity: cleanInput(finding?.severity) || "HIGH",
    fix_next_rep: cleanMultiline(finding?.fix_next_rep),
  };
}

function fuelPracticeConstraint(
  fuel: SenseiConnected["fuel"]
): FuelPracticeConstraint {
  if (!fuel?.present) {
    return {
      assessment: "not_assessed",
      assessedAt: null,
      maximumResistance: null,
      restrictions: [],
      reason: null,
      sourceEvidenceIds: [],
    };
  }

  const score = typeof fuel.score === "number" ? fuel.score : null;
  const rating = cleanInput(fuel.rating).toUpperCase();

  if (rating === "RED" || rating === "TRASH" || (score !== null && score < 45)) {
    return {
      assessment: "assessed",
      assessedAt: new Date().toISOString(),
      maximumResistance: "prescribed_reaction",
      restrictions: ["No live resistance", "Stop when the correction loses shape"],
      reason: "Today: controlled technical work only. No live resistance.",
      sourceEvidenceIds: [],
    };
  }

  if (rating === "AMBER" || rating === "LOW" || (score !== null && score < 65)) {
    return {
      assessment: "assessed",
      assessedAt: new Date().toISOString(),
      maximumResistance: "variable_reaction",
      restrictions: ["Keep resistance controlled"],
      reason: "Today: controlled resistance only.",
      sourceEvidenceIds: [],
    };
  }

  return {
    assessment: "assessed",
    assessedAt: new Date().toISOString(),
    maximumResistance: "live_resistance",
    restrictions: [],
    reason: "Today: no additional practice restriction.",
    sourceEvidenceIds: [],
  };
}

function evidenceStateFromProgress(progress: DirectiveProgress): EvidenceState {
  if (
    progress.proofType === "image" ||
    progress.proofType === "video" ||
    progress.proofType === "metrics" ||
    progress.proofType === "self_report"
  ) {
    return "evidence_submitted";
  }

  if (progress.repsCompleted > 0) return "practised";
  return "planned";
}

function visionSuggestion(
  vision: SenseiConnected["vision"]
): ActiveCorrection | null {
  const problem = cleanInput(vision?.correction);
  if (!vision?.present || !problem) return null;

  const cue = cleanInput(vision.fix_next_rep) || problem;
  const createdAt = new Date().toISOString();

  return {
    id: `vision:${problem.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    athleteId: "current-athlete",
    status: "draft",
    coachExactCue: cue,
    performanceProblem: problem,
    whyItMatters: "Not yet established by the coach.",
    informationToRecognise: [],
    decisionRules: [],
    practiceTask: {
      setup: "Not yet specified.",
      athleteTask: "Review the observation before treating it as instruction.",
      partnerTask: "Not yet specified.",
      attemptsRequested: null,
      permittedResistance: "cooperative",
      restrictions: [],
    },
    successCondition: "Not yet specified.",
    failureCondition: "Not yet specified.",
    evidenceRequested: {
      sourcesRequested: ["athlete_reported"],
      practiceTaskRequired: "Clarify the correction and practice task.",
      resistanceRequired: "cooperative",
      attemptsRequested: null,
      questionForCoach: "Is this the correction you want me carrying?",
    },
    provenance: {
      origin: "disciplin",
      originalAuthor: {
        id: "disciplin-vision",
        name: "Vision",
        role: "system",
      },
      originalWording: problem,
      createdAt,
      approval: {
        status: "not_requested",
        approvingCoach: null,
        decidedAt: null,
        note: null,
      },
      supportingEvidenceIds: [],
      revisions: [],
      applicableContext: [],
      confidence: "unknown",
      limitations: ["Vision observation has not been coach reviewed."],
    },
    introducedAt: createdAt,
    closedAt: null,
    reopenedFromCorrectionId: null,
  };
}

function isCoachAuthoritative(correction: ActiveCorrection | null) {
  if (!correction) return false;
  const label = authorityLabel(correction.provenance);
  return label === "coach_entered" || label === "coach_approved";
}

function correctionSourceLabel(correction: ActiveCorrection | null) {
  if (!correction) return "Not recorded";

  const sourceType = (
    correction.provenance as typeof correction.provenance & {
      sourceType?: string;
    }
  ).sourceType;
  const sourceLabels: Record<string, string> = {
    vision_observation: "Vision observation",
    coach_observation: "Coach observation",
    coach_conversation: "Coach conversation",
    competition_review: "Competition review",
    athlete_reflection: "Athlete reflection",
    live_coaching: "Live coaching",
    training_note: "Training note",
  };
  if (sourceType && sourceLabels[sourceType]) return sourceLabels[sourceType];

  const context = correction.provenance.applicableContext
    .join(" ")
    .toLowerCase();
  const origin = correction.provenance.origin;

  if (origin === "disciplin") return "Vision observation";
  if (origin === "athlete") return "Athlete reflection";
  if (origin === "sensei") return "Sensei hypothesis";
  if (context.includes("competition")) return "Competition review";
  if (context.includes("conversation")) return "Coach conversation";
  if (context.includes("live") || context.includes("corner")) return "Live coaching";
  if (context.includes("note")) return "Training note";
  if (context.includes("sparring")) return "Coach observation after sparring";
  return "Coach observation";
}

function buildConstitutionState(args: {
  connected: SenseiConnected;
  progress: DirectiveProgress;
  saved?: SenseiConstitutionState | null;
  serverCorrection?: ActiveCorrection | null;
  serverAuthorityResolved?: boolean;
}): SenseiConstitutionState {
  const operatingMode: SenseiOperatingMode = args.serverAuthorityResolved
    ? args.serverCorrection
      ? "coach_connected"
      : "athlete_only"
    : args.saved?.operatingMode ||
      (args.connected.profile?.coachConnected ? "coach_connected" : "athlete_only");
  const visionCandidate = visionSuggestion(args.connected.vision);
  const savedActive = args.serverAuthorityResolved
    ? args.serverCorrection || null
    : args.saved?.activeCorrection || null;
  const savedSuggestion = args.saved?.suggestedCorrection || null;
  const unapprovedSavedActive =
    savedActive && !isCoachAuthoritative(savedActive) ? savedActive : null;
  const suggestion =
    savedSuggestion || unapprovedSavedActive || visionCandidate;
  const protectedEvidenceStates: EvidenceState[] = [
    "awaiting_coach_review",
    "continue_current_correction",
    "progression_approved",
    "correction_reopened",
  ];
  const evidenceState =
    args.saved?.evidenceState &&
    protectedEvidenceStates.includes(args.saved.evidenceState)
      ? args.saved.evidenceState
      : evidenceStateFromProgress(args.progress);

  return {
    operatingMode,
    activeCorrection: isCoachAuthoritative(savedActive) ? savedActive : null,
    suggestedCorrection: suggestion,
    evidenceState,
    fuelConstraint: fuelPracticeConstraint(args.connected.fuel),
  };
}

function emptyConstitutionState(): SenseiConstitutionState {
  return {
    operatingMode: "athlete_only",
    activeCorrection: null,
    suggestedCorrection: null,
    evidenceState: "planned",
    fuelConstraint: fuelPracticeConstraint(undefined),
  };
}

function frontendFallbackAnswer() {
  return [
    "Decision: The answer did not come through clean.",
    "",
    "Why: The route returned no usable response.",
    "",
    "What this fixes: It prevents silent failure.",
    "",
    "If ignored: Broken responses destroy trust.",
    "",
    "Instruction: Ask again directly.",
  ].join("\n");
}

function timeoutAnswer() {
  return [
    "Decision: The answer took too long.",
    "",
    "Why: Sensei timed out before returning a clean call.",
    "",
    "What this fixes: It prevents the screen from hanging.",
    "",
    "If ignored: The user loses trust.",
    "",
    "Instruction: Retry the same question.",
  ].join("\n");
}

export default function SenseiClient({ embedded = false }: { embedded?: boolean } = {}) {
  const { user, profile } = useProfile();
  const { openPanel } = useShellInteraction();
  const { authority } = useWorkflow();
  const { state: coachState, loading: coachLoading } = useCoach();
  const serverCorrection = useMemo(() => {
    const mission = coachState.currentMission;
    const relationship = coachState.athleteRelationship;
    if (!mission || !relationship || relationship.status !== "connected") return null;
    return approvedMissionToCorrection({
      mission,
      relationship,
      originalSubmission:
        coachState.submissions.find((submission) => submission.id === mission.submission_id) ?? null,
    });
  }, [coachState]);
  const userId = user?.id ?? (
    process.env.NODE_ENV !== "production" && profile
      ? "development-preview"
      : null
  );
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [pendingQuestion, setPendingQuestion] = useState("");
  const [busy, setBusy] = useState(false);

  const [connected, setConnected] =
    useState<SenseiConnected>(defaultConnected());

  const [decisionMode, setDecisionMode] = useState<"STRICT" | "FALLBACK">(
    "FALLBACK"
  );

  const [activeDirective, setActiveDirective] = useState("");
  const [sessionState, setSessionState] =
    useState<SenseiSessionState>(defaultSessionState());

  const [pressureCard, setPressureCard] =
    useState<PressureDisciplineCard>(defaultPressureDisciplineCard());

  const [directiveProgress, setDirectiveProgress] = useState<DirectiveProgress>(() => normalizeDirectiveProgress({}));

  const [constitution, setConstitution] = useState<SenseiConstitutionState>(emptyConstitutionState);
  const [hydratedOwnerId, setHydratedOwnerId] = useState<string | null>(null);

  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    setHydratedOwnerId(null);
    setChatMessages([]);
    setConnected(defaultConnected());
    setDecisionMode("FALLBACK");
    setActiveDirective("");
    setSessionState(defaultSessionState());
    setPressureCard(defaultPressureDisciplineCard());
    const nextProgress = normalizeDirectiveProgress(readUserJson<Partial<DirectiveProgress>>(userId, DIRECTIVE_PROGRESS_KEY) || {});
    setDirectiveProgress(nextProgress);

    const saved = readUserJson<{
      chatMessages?: ChatMessage[];
      connected?: SenseiConnected;
      decisionMode?: "STRICT" | "FALLBACK";
      activeDirective?: string;
      sessionState?: SenseiSessionState;
    }>(userId, SENSEI_STATE_KEY);

    if (saved?.chatMessages) setChatMessages(saved.chatMessages);
    if (saved?.connected) setConnected(saved.connected);
    if (saved?.decisionMode) setDecisionMode(saved.decisionMode);
    if (saved?.sessionState) setSessionState(saved.sessionState);

    const vision = extractVisionDirective(userId);
    const fuel = extractFuelMemory(userId);
    const gyms = extractConnectedGyms(userId);

    const nextConnected: SenseiConnected = {
      ...(saved?.connected || defaultConnected()),
      vision,
      fuel,
      gyms,
    };
    const savedConstitution = readUserJson<SenseiConstitutionState>(userId, SENSEI_CONSTITUTION_KEY);
    const nextConstitution = buildConstitutionState({
      connected: nextConnected,
      progress: nextProgress,
      saved: savedConstitution,
      serverCorrection,
      serverAuthorityResolved: !coachLoading,
    });

    setConnected(nextConnected);
    setConstitution(nextConstitution);
    setActiveDirective(nextConstitution.activeCorrection?.coachExactCue || "");

    const savedPressure = readUserJson<PressureDisciplineCard>(userId, PRESSURE_CARD_KEY);
    if (savedPressure) setPressureCard(savedPressure);
    queueMicrotask(() => setHydratedOwnerId(userId));
  }, [coachLoading, serverCorrection, userId]);

  useEffect(() => {
    if (hydratedOwnerId !== userId) return;
    writeUserJson(userId, SENSEI_STATE_KEY, {
      chatMessages: chatMessages.filter((m) => !m.pending),
      connected,
      decisionMode,
      activeDirective,
      sessionState,
    });
  }, [chatMessages, connected, decisionMode, activeDirective, sessionState, hydratedOwnerId, userId]);

  useEffect(() => {
    if (hydratedOwnerId !== userId) return;
    writeUserJson(userId, SENSEI_CONSTITUTION_KEY, constitution);
  }, [constitution, hydratedOwnerId, userId]);

  useEffect(() => {
    if (hydratedOwnerId !== userId) return;
    writeUserJson(userId, DIRECTIVE_PROGRESS_KEY, directiveProgress);
  }, [directiveProgress, hydratedOwnerId, userId]);

  useEffect(() => {
    if (hydratedOwnerId !== userId) return;
    writeUserJson(userId, PRESSURE_CARD_KEY, pressureCard);
  }, [pressureCard, hydratedOwnerId, userId]);

  useEffect(() => {
    setConstitution((previous) => {
      return buildConstitutionState({
        connected,
        progress: directiveProgress,
        saved: previous,
        serverCorrection,
        serverAuthorityResolved: !coachLoading,
      });
    });
  }, [
    connected.vision?.present,
    connected.vision?.correction,
    connected.vision?.fix_next_rep,
    connected.fuel?.present,
    connected.fuel?.score,
    connected.fuel?.rating,
    connected.fuel?.decision,
    connected.profile?.coachConnected,
    directiveProgress.repsCompleted,
    directiveProgress.proofType,
    coachLoading,
    serverCorrection,
  ]);

  useEffect(() => {
    setActiveDirective(constitution.activeCorrection?.coachExactCue || "");
  }, [constitution.activeCorrection]);

  const rawLockState = useMemo(() => {
    const verified = constitution.evidenceState === "progression_approved";
    const hasCorrection = Boolean(constitution.activeCorrection);

    return {
      verified,
      locked: hasCorrection && !verified,
      userMessage: verified
        ? "Your coach approved progression."
        : hasCorrection
          ? "Practice evidence can be submitted. Only coach review can approve progression."
          : "No active correction is available in the current operating mode.",
    };
  }, [constitution.activeCorrection, constitution.evidenceState]);

  const screenLockState = {
    hasDirective: !!constitution.activeCorrection,
    verified: rawLockState?.verified === true,
    locked: rawLockState?.locked === true,
    reason:
      rawLockState?.verified === true
        ? ("unlocked" as const)
        : constitution.activeCorrection
          ? ("directive_unverified" as const)
          : ("no_directive" as const),
    userMessage:
      typeof rawLockState?.userMessage === "string"
        ? rawLockState.userMessage
        : "One correction controls the session.",
  };

  async function sendQuestion(rawQuestion: string) {
    const question = cleanMultiline(rawQuestion);
    if (!question || busy || !authority.senseiAvailable) return;

    const startedAt = Date.now();
    const section = inferSectionFromText(question);

    const userMessage: ChatMessage = {
      id: makeId("user"),
      role: "user",
      text: question,
      section,
    };

    const pendingId = makeId("sensei_pending");

    const pendingMessage: ChatMessage = {
      id: pendingId,
      role: "sensei",
      text: "Sensei is thinking.",
      pending: true,
      section,
    };

    setBusy(true);
    setPendingQuestion(question);
    setChatMessages((prev) => [...prev, userMessage, pendingMessage]);

    const pressure = buildPressureDisciplineCard({
      userMessage: question,
      activeDirective,
      latestVisionCorrection: connected.vision?.correction || "",
      underResistance: directiveProgress.underResistance === true,
      proofVerified: rawLockState?.verified === true,
      repeatedFailureCount: Number(directiveProgress.repsCompleted || 0),
    });

    setPressureCard(pressure);

    if (isAdvancedPrompt(question) && screenLockState.locked) {
      await holdPremiumDelay(startedAt, LOCK_DELAY_MS);

      setChatMessages((prev) =>
        prev.map((msg) =>
          msg.id === pendingId
            ? {
                ...msg,
                pending: false,
                text: screenLockState.userMessage,
              }
            : msg
        )
      );

      setBusy(false);
      setPendingQuestion("");
      return;
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20000);

      const res = await fetch("/api/sensei", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        signal: controller.signal,
        body: JSON.stringify({
          message: question,
          question,
          section,
          activeDirective,
          activeCorrection: constitution.activeCorrection,
          suggestedCorrection: constitution.suggestedCorrection,
          senseiOperatingMode: constitution.operatingMode,
          evidenceState: constitution.evidenceState,
          fuelPracticeConstraint: constitution.fuelConstraint,
          connected,
          pressureCard: pressure,
          session: sessionState,
          directiveProgress,
          deliveryMode: inferDeliveryMode(question),
        }),
      });

      clearTimeout(timeout);

      const data = await res.json().catch(() => null);

      await holdPremiumDelay(startedAt);

      const answer = cleanMultiline(data?.answer) || frontendFallbackAnswer();
      const nextDirective =
        constitution.activeCorrection?.coachExactCue || "";
      const nextDecision =
        cleanInput(data?.operatingDecision?.sessionGoal) ||
        cleanInput(data?.session?.lastCommand) ||
        answer.split("\n")[0]?.replace(/^Decision:\s*/i, "") ||
        "";
      const psychologyTrigger =
        cleanInput(data?.session?.psychologyTopic) ||
        cleanInput(data?.pressureLeak);
      const gameplanFocus =
        cleanInput(data?.connected?.profile?.currentGameplan) ||
        cleanInput(data?.connected?.profile?.aGame) ||
        cleanInput(data?.connected?.profile?.winCondition);
      const messageCorrection =
        constitution.activeCorrection || constitution.suggestedCorrection;
      const messageCoachApproved = isCoachAuthoritative(
        constitution.activeCorrection
      );

      setChatMessages((prev) =>
        prev.map((msg) =>
          msg.id === pendingId
            ? {
                id: makeId("sensei"),
                role: "sensei",
                text: answer,
                section,
                deliveryMode: inferDeliveryMode(question),
                responseMode: cleanInput(data?.responseMode),
                stateUpdate: {
                  psychologicalTrigger: psychologyTrigger,
                  gameplanFocus,
                  activeCorrection: nextDirective,
                  nextDecision,
                  proofStatus: proofStatusFromResponse(data),
                  correctionSource: correctionSourceLabel(messageCorrection),
                  coachApproved: messageCoachApproved,
                },
              }
            : msg
        )
      );

      if (data?.connected) {
        setConnected((prev) => ({
          ...prev,
          ...data.connected,
          psychology: {
            ...prev.psychology,
            ...data.connected.psychology,
            ...(psychologyTrigger
              ? {
                  present: true,
                  summary: psychologyTrigger,
                }
              : {}),
          },
        }));
      }

      if (data?.mode === "STRICT" || data?.mode === "ENFORCEMENT") {
        setDecisionMode("STRICT");
      }

      if (data?.mode === "FALLBACK") {
        setDecisionMode("FALLBACK");
      }

      if (data?.directiveState) {
        setDirectiveProgress(normalizeDirectiveProgress(data.directiveState));
      }

      if (data?.pressureCard) {
        setPressureCard(data.pressureCard);
      }

      setSessionState((prev) => ({
        ...prev,
        ...(data?.session || {}),
        lastDecision: nextDecision,
        lastCommand: cleanInput(data?.session?.lastCommand),
        lastWhy: cleanInput(data?.session?.lastWhy),
        lastUpdated: new Date().toISOString(),
      }));
    } catch (err: any) {
      await holdPremiumDelay(startedAt, LOCK_DELAY_MS);

      setChatMessages((prev) =>
        prev.map((msg) =>
          msg.id === pendingId
            ? {
                id: makeId("sensei_error"),
                role: "sensei",
                text:
                  err?.name === "AbortError"
                    ? timeoutAnswer()
                    : frontendFallbackAnswer(),
                section,
              }
            : msg
        )
      );
    } finally {
      setBusy(false);
      setPendingQuestion("");
      inputRef.current?.focus();
    }
  }

  function onSendChat() {
    const next = cleanMultiline(chatInput);
    if (!next || busy) return;

    setChatInput("");
    void sendQuestion(next);
  }

  function onChatKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSendChat();
    }
  }

  return (
    <SenseiScreen
      embedded={embedded}
      chatMessages={chatMessages}
      chatInput={chatInput}
      setChatInput={setChatInput}
      onSendChat={onSendChat}
      busy={busy}
      pendingQuestion={pendingQuestion}
      inputRef={inputRef}
      onChatKeyDown={onChatKeyDown}
      connected={connected}
      decisionMode={decisionMode}
      directiveProgress={directiveProgress}
      lockState={screenLockState}
      pressureCard={pressureCard}
      constitution={constitution}
      authority={authority}
      onOpenVision={(opener) => openPanel("vision", opener)}
      onOpenProfile={(opener) => openPanel("profile", opener)}
    />
  );
}

function inferDeliveryMode(question: string): "analysis" | "coaching" {
  const q = question.toLowerCase();
  return /\b(why|how did|what caused|what happened|review|film|analyse|analyze|understand)\b/.test(
    q
  )
    ? "analysis"
    : "coaching";
}

function proofStatusFromResponse(data: {
  directiveState?: {
    repsCompleted?: number;
    repsRequired?: number;
    underResistance?: boolean;
    proofType?: string;
  };
}) {
  const state = data.directiveState;
  if (!state) return "";

  const completed = Number(state.repsCompleted || 0);
  if (state.proofType && state.proofType !== "none") {
    return "Evidence submitted — awaiting coach review";
  }
  if (completed > 0) return "Practised — no evidence submitted";
  return "Planned";
}
