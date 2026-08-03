import { NextRequest, NextResponse } from "next/server";
import { resolveReinforcement } from "@/lib/authority/reinforcement";
import OpenAI from "openai";
import {
  getLockState,
  isAdvancedPrompt,
  normalizeDirectiveProgress,
  type DirectiveProgress,
} from "@/lib/disciplin/types";
import {
  buildPressureDisciplineCard,
  type PressureDisciplineCard,
} from "@/lib/disciplin/pressureDiscipline";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { acquireExpensiveRequest, requestIp, type RateLimitLease } from "@/lib/security/rateLimit";
import { logServerError, rateLimited, requestId, safeServerError, unauthorized } from "@/lib/security/responses";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

type Section =
  | "all"
  | "overview"
  | "training"
  | "nutrition"
  | "recovery"
  | "decisions";

type Intent =
  | "gym_decision"
  | "fuel_decision"
  | "recovery_decision"
  | "injury_decision"
  | "weight_cut_decision"
  | "pressure_discipline"
  | "psychology_decision"
  | "training_decision"
  | "advanced_request"
  | "proof_decision"
  | "system_navigation"
  | "overview_decision"
  | "out_of_scope"
  | "general_decision";

type IntentCategory =
  | "Technical"
  | "Psychology"
  | "Recovery"
  | "Injury"
  | "Nutrition"
  | "Weight Cut"
  | "Progression"
  | "Proof"
  | "Out of Scope"
  | "System Navigation";

type ClassifiedIntent = {
  category: IntentCategory;
  intent: Intent;
  route: string;
  confidence: "high" | "medium" | "low";
  reason: string;
};

type PressureCase =
  | "missed_entry"
  | "panic_tempo"
  | "taunt_rush"
  | "got_hit"
  | "ego_pull"
  | "crowd_pressure"
  | "fatigue_collapse"
  | "action_addiction"
  | "fear_response"
  | "urgency_collapse"
  | "unknown";

type PressureLeak =
  | "Revenge Exchange"
  | "Ego Exchange"
  | "Panic Action"
  | "Crowd Pressure"
  | "Fatigue Abandonment"
  | "Action Addiction"
  | "Fear Response"
  | "Urgency Collapse";

type TacticalConcept =
  | "opening_ownership"
  | "opponent_intent"
  | "exchange_ownership"
  | "process_vs_outcome"
  | "none";

type CoachingResponseMode =
  | "Command"
  | "Refusal"
  | "Approval"
  | "Proof Demand"
  | "Pressure Command"
  | "Tactical Challenge"
  | "Redirect";

type SenseiGym = {
  id?: string;
  name?: string;
  location?: string;
  compatibility?: number;
  disciplineMatch?: string[];
  styleMatch?: string[];
  watchOut?: string[];
  href?: string;
  verified?: boolean;
};

type SenseiCampContext = {
  nextFight?: string | null;
  fightDate?: string | null;
  opponent?: string | null;
  daysOut?: number | null;
  currentCorrectionLock?: string | null;
  repeatedIssue?: string | null;
  forceCue?: string | null;
  seeCue?: string | null;
  goCue?: string | null;
};

type SenseiHistoryContext = {
  recurringMistakes?: string[];
  pressureLeaks?: string[];
  retainedCorrections?: string[];
  failedCorrections?: string[];
  recentSessions?: string[];
};

type SenseiFighterReality = {
  injuries?: string[];
  restrictions?: string[];
  recoveryStatus?: string | null;
  trainingFrequency?: number | null;
  equipmentAccess?: string[];
};

type SenseiMemoryBucket =
  | "repeatedQuestions"
  | "pressureLeaks"
  | "emotionalTriggers"
  | "activeCorrections"
  | "habits"
  | "repeatedBehaviors"
  | "avoidedCorrections"
  | "refusedProgressionAttempts"
  | "confidenceTrends"
  | "injuryFears"
  | "fightCampConcerns"
  | "repeatedExcuses"
  | "successfulInterventions";

type SenseiMemoryItem = {
  key: string;
  label: string;
  count: number;
  firstSeen: string;
  lastSeen: string;
  lastQuestion?: string;
  examples?: string[];
};

type SenseiMemory = Record<SenseiMemoryBucket, SenseiMemoryItem[]> & {
  summary?: string;
  lastUpdated?: string;
};

type SenseiOperatingDecision = {
  readiness: "GREEN" | "AMBER" | "RED" | "UNKNOWN";
  campPhase: "FIGHT_WEEK" | "PRESSURE_TEST" | "CAMP" | "BUILD" | "UNKNOWN";
  action:
    | "RETAIN"
    | "PRESSURE_TEST"
    | "TECHNICAL_ONLY"
    | "RECOVER"
    | "UNLOCK_NEXT_LAYER";
  correction: string;
  whyFixing: string;
  sessionGoal: string;
  drill: string;
  pressureTest: string;
  proofNeeded: string;
  restrictions: string[];
  pathwayAdjusted: boolean;
  adjustmentReason: string | null;
  reason: string;
  unlocksNext: string;
};

type SenseiConnected = {
  vision?: {
    present?: boolean;
    correction?: string | null;
    severity?: string | null;
    fix_next_rep?: string | null;
    repeated_issue?: string | null;
    force?: string | null;
    see?: string | null;
    go?: string | null;
    drill?: string | null;
    pressure_test?: string | null;
    proof_required?: number | null;
  };
  fuel?: {
    present?: boolean;
    score?: number | null;
    rating?: string | null;
    decision?: string | null;
    recoveryStatus?: string | null;
    sleepHours?: number | null;
    sleepQuality?: string | null;
    weightCutStatus?: string | null;
    currentWeight?: number | null;
    targetWeight?: number | null;
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
    experienceLevel?: string;
    goal?: string;
    preferredStyle?: string;
    avoidedStyle?: string;
    fightingStyle?: string;
    primaryStyle?: string;
    aGame?: string;
    preferredPositions?: string;
    bestAttacks?: string;
    winConditions?: string;
    commonPressureBreaks?: string;
    commonEmotionalTriggers?: string;
    commonPressureMistakes?: string;
    currentGameplan?: string;
  };
  camp?: SenseiCampContext;
  history?: SenseiHistoryContext;
  fighterReality?: SenseiFighterReality;
  memory?: SenseiMemory;
  gyms?: SenseiGym[];
};

type SenseiSession = {
  lastDecision?: string;
  lastCommand?: string;
  lastWhy?: string;
  lastUpdated?: string;
  awaitingPsychologyAnswer?: boolean;
  psychologyTopic?: string;
  previousQuestion?: string;
};

type SenseiResponse = {
  mode: "STRICT" | "FALLBACK" | "ENFORCEMENT";
  answer: string;
  intent?: IntentCategory;
  responseMode?: CoachingResponseMode;
  pressureLeak?: PressureLeak | null;
  operatingDecision?: SenseiOperatingDecision;
  connected: SenseiConnected;
  session: SenseiSession;
  directiveState: DirectiveProgress;
  pressureCard?: PressureDisciplineCard;
  memory?: SenseiMemory;
};

const DUBAI_FALLBACK_GYMS: SenseiGym[] = [
  {
    id: "dagestan-top-team-dubai",
    name: "Dagestan Top Team Dubai",
    location: "Al Joud Center, Al Quoz Industrial First, Dubai",
    compatibility: 96,
    disciplineMatch: ["Wrestling", "Grappling", "MMA"],
    styleMatch: [
      "pressure room",
      "entry punishment",
      "grappling resistance",
      "wrestling exposure",
      "pace punishment",
    ],
    watchOut: [
      "May expose weak entries immediately",
      "Do not judge it by comfort",
      "Use it as a one-week trial",
    ],
    verified: false,
  },
  {
    id: "kuma-team-dubai",
    name: "Kuma Team Dubai",
    location: "Dubai",
    compatibility: 82,
    disciplineMatch: ["MMA", "Grappling", "Striking"],
    styleMatch: ["mixed training", "familiar option", "general MMA room"],
    watchOut: [
      "May feel easier or more familiar",
      "Do not choose it if it hides the wrestling flaw",
    ],
    verified: false,
  },
  {
    id: "tk-mma-dubai",
    name: "TK MMA",
    location: "Dubai",
    compatibility: 78,
    disciplineMatch: ["MMA", "Striking", "Grappling"],
    styleMatch: ["MMA structure", "competitive room", "general pressure"],
    watchOut: [
      "Good MMA environment, but judge wrestling resistance specifically",
    ],
    verified: false,
  },
];

function cleanText(input: unknown) {
  return String(input ?? "").replace(/\s+/g, " ").trim();
}

function cleanMultiline(input: unknown) {
  return String(input ?? "")
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function clampChars(input: unknown, max = 500) {
  const text = cleanText(input);
  if (!text) return "";
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trim()}…`;
}

function hasWord(text: string, word: string) {
  return new RegExp(`\\b${word}\\b`, "i").test(text);
}

function includesAny(text: string, words: string[]) {
  const t = text.toLowerCase();
  return words.some((word) => t.includes(word.toLowerCase()));
}

function formatDirective(input: string) {
  const text = cleanText(input);
  if (!text) return "";

  const rawCommands = text
    .replace(/\s+/g, " ")
    .replace(/\band then\b/gi, ".")
    .replace(/\bthen\b/gi, ".")
    .split(/(?<=[.!?])\s+|;\s+/)
    .map((line) =>
      line
        .replace(/[.!?]+$/g, "")
        .replace(/^Do this:\s*/i, "")
        .replace(/^Directive:\s*/i, "")
        .trim()
    )
    .filter(Boolean);

  const commands = rawCommands.flatMap((line) => {
    const compact = line
      .replace(/\breturn to the command\b/gi, "Return to command")
      .replace(/\bbreath down\b/gi, "Breathe down")
      .replace(/\bbreathe down\b/gi, "Breathe down")
      .replace(/\bexhale\b/gi, "Exhale")
      .replace(/\brebuild stance\b/gi, "Rebuild stance")
      .replace(/\bguard returns first\b/gi, "Guard first")
      .replace(/\bguard first\b/gi, "Guard first")
      .replace(/\bfeet under you\b/gi, "Feet under you")
      .replace(/\bone clean action only\b/gi, "One clean action")
      .replace(/\bone clean re-entry only\b/gi, "One clean re-entry")
      .replace(/\bno extra exchange\b/gi, "No extra exchange")
      .replace(/\bno extra speed\b/gi, "No extra speed")
      .replace(/\bno revenge exchange\b/gi, "No revenge exchange")
      .replace(/\bcomplete clean proof reps\b/gi, "Complete proof reps")
      .replace(/\bunder resistance\b/gi, "Under resistance")
      .replace(/\bupload image, video, or metrics proof\b/gi, "Upload accepted proof")
      .replace(/\bproof must be image, video, or metrics\b/gi, "Upload accepted proof")
      .replace(/\bresistance must be on\b/gi, "Resistance on")
      .replace(/\bresistance on\b/gi, "Resistance on")
      .replace(/\bstop when the cue breaks\b/gi, "Stop on cue break")
      .replace(/\bstop when form breaks\b/gi, "Stop on form break")
      .replace(/\bif speed rises from fear, reset\b/gi, "Reset if speed rises")
      .replace(/\bif pain changes movement, stop\b/gi, "Stop if pain changes movement")
      .trim();

    if (compact.includes(". ")) {
      return compact.split(". ").map((part) => part.trim()).filter(Boolean);
    }

    return compact;
  });

  return commands
    .map((command) => command.replace(/[.!?]+$/g, "").trim())
    .filter(Boolean)
    .slice(0, 8)
    .join("\n");
}

function formatAnswer(parts: {
  decision: string;
  why: string;
  fixes: string;
  ignored: string;
  instruction: string;
}) {
  return [
    `Decision: ${clampChars(parts.decision, 160)}`,
    "",
    `Why: ${clampChars(parts.why, 420)}`,
    "",
    `Fix: ${clampChars(parts.fixes, 320)}`,
    "",
    `If ignored: ${clampChars(parts.ignored, 280)}`,
    "",
    "Directive:",
    formatDirective(parts.instruction),
  ].join("\n");
}

function formatLines(lines: Array<string | false | null | undefined>) {
  return lines.map(cleanText).filter(Boolean).join("\n");
}

function fullDecision(parts: {
  decision: string;
  why: string;
  fixes: string;
  ignored: string;
  instruction: string;
}) {
  return formatAnswer(parts);
}

function shortCorrection(...lines: string[]) {
  return formatLines(lines.slice(0, 4));
}

function interruption(...lines: string[]) {
  return formatLines(lines.slice(0, 4));
}

function proofDemand(...lines: string[]) {
  return formatLines(lines.slice(0, 5));
}

function pressureCommand(...lines: string[]) {
  return formatLines(lines.slice(0, 6));
}

function pickLine(seed: string, lines: string[]) {
  if (!lines.length) return "";
  const total = seed
    .split("")
    .reduce((sum, char) => sum + char.charCodeAt(0), 0);

  return lines[total % lines.length];
}

function approval(...lines: string[]) {
  return formatLines(lines.slice(0, 4));
}

function isAnalysisModePrompt(message: string) {
  const q = message.toLowerCase();

  return includesAny(q, [
    "why",
    "what happened",
    "what caused",
    "break down",
    "review",
    "film",
    "after training",
    "post session",
    "post-session",
    "explain",
    "understand",
    "pattern",
    "keep doing",
    "keep repeating",
  ]);
}

function correctionHandle(correction: string) {
  const normalized = cleanText(correction).toLowerCase();

  if (!normalized || normalized === "the correction") return "the correction";
  if (normalized.includes("head") && normalized.includes("outside")) {
    return "head position";
  }
  if (normalized.includes("head")) return "head position";
  if (normalized.includes("guard")) return "guard position";
  if (normalized.includes("foot") || normalized.includes("stance")) {
    return "your stance";
  }
  if (normalized.includes("hip")) return "hip position";
  if (normalized.includes("entry") || normalized.includes("shot")) {
    return "the entry";
  }

  return "the correction";
}

function memorableCommand(correction: string, fallback = "Fix the position. The finish will come.") {
  const normalized = cleanText(correction).toLowerCase();

  if (normalized.includes("head") && normalized.includes("outside")) {
    return "Win the position. Reset. Re-enter.";
  }
  if (normalized.includes("setup") || normalized.includes("opening")) {
    return "Do not chase the finish. Win the setup.";
  }
  if (normalized.includes("panic") || normalized.includes("rush")) {
    return "Calm first. Action second.";
  }

  return fallback;
}

function coachFacingAnswer(input: string) {
  return cleanMultiline(input)
    .replace(/\bCamp context unavailable\s*\|\s*/gi, "")
    .replace(/\s*\|\s*Lock:\s*/gi, "\nStay on ")
    .replace(/\s*\|\s*Next:\s*(PRESSURE_TEST|TECHNICAL_ONLY|RETAIN|UNLOCK_NEXT_LAYER|RECOVER)\b/gi, "")
    .replace(/\s*\|\s*Proof:\s*/gi, "\nShow ")
    .replace(/\s*\|\s*GO:\s*/gi, "\n")
    .replace(/\bPRESSURE_TEST\b/g, "pressure work")
    .replace(/\bTECHNICAL_ONLY\b/g, "technical work")
    .replace(/\bUNLOCK_NEXT_LAYER\b/g, "progression")
    .replace(/\bRETAIN\b/g, "retention")
    .replace(/\bRECOVER\b/g, "recovery")
    .replace(/\bHead dumped outside on shot\b/gi, "head position")
    .replace(/\bexecuting head position\b/gi, "executing the correction")
    .replace(/^Pressure leak:\s*/gim, "")
    .replace(/^Trigger:\s*/gim, "")
    .replace(/^Consequence:\s*/gim, "")
    .replace(/^Directive:\s*/gim, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function wantsGymDecision(q: string) {
  return (
    hasWord(q, "gym") ||
    hasWord(q, "gyms") ||
    q.includes("where should i train") ||
    q.includes("where do i train") ||
    q.includes("which gym") ||
    q.includes("pick a gym") ||
    q.includes("choose a gym")
  );
}

function wantsFuelDecision(q: string) {
  return (
    hasWord(q, "food") ||
    hasWord(q, "fuel") ||
    hasWord(q, "meal") ||
    hasWord(q, "eat") ||
    hasWord(q, "protein") ||
    hasWord(q, "carb") ||
    hasWord(q, "carbs") ||
    hasWord(q, "calories") ||
    hasWord(q, "nutrition") ||
    hasWord(q, "shawarma") ||
    hasWord(q, "fries") ||
    hasWord(q, "hydration") ||
    hasWord(q, "electrolytes") ||
    hasWord(q, "water") ||
    q.includes("low energy")
  );
}

function wantsWeightCutDecision(q: string) {
  return (
    q.includes("weight cut") ||
    q.includes("cut weight") ||
    q.includes("make weight") ||
    q.includes("making weight") ||
    q.includes("weigh in") ||
    q.includes("weigh-in") ||
    q.includes("water load") ||
    q.includes("water loading") ||
    q.includes("sauna") ||
    q.includes("sweat out") ||
    q.includes("dehydrate") ||
    q.includes("dehydrated") ||
    q.includes("rehydrate") ||
    q.includes("rehydration") ||
    q.includes("miss weight") ||
    q.includes("missed weight")
  );
}

function wantsInjuryDecision(q: string) {
  return (
    hasWord(q, "injury") ||
    hasWord(q, "injured") ||
    hasWord(q, "pain") ||
    hasWord(q, "hurts") ||
    hasWord(q, "hurt") ||
    hasWord(q, "tweak") ||
    hasWord(q, "tweaked") ||
    hasWord(q, "sprain") ||
    hasWord(q, "strained") ||
    hasWord(q, "strain") ||
    hasWord(q, "swollen") ||
    hasWord(q, "swelling") ||
    hasWord(q, "sharp") ||
    hasWord(q, "limping") ||
    hasWord(q, "limp") ||
    hasWord(q, "knee") ||
    hasWord(q, "ankle") ||
    hasWord(q, "shoulder") ||
    hasWord(q, "elbow") ||
    hasWord(q, "wrist") ||
    hasWord(q, "neck") ||
    hasWord(q, "back") ||
    q.includes("during shots") ||
    q.includes("when i shoot") ||
    q.includes("when shooting") ||
    q.includes("can't plant") ||
    q.includes("cannot plant")
  );
}

function wantsRecoveryDecision(q: string) {
  return (
    hasWord(q, "sleep") ||
    hasWord(q, "slept") ||
    hasWord(q, "recovery") ||
    hasWord(q, "fatigue") ||
    hasWord(q, "rest") ||
    hasWord(q, "sore") ||
    hasWord(q, "soreness") ||
    hasWord(q, "drained") ||
    hasWord(q, "tired") ||
    hasWord(q, "burnout") ||
    hasWord(q, "burned") ||
    hasWord(q, "exhausted") ||
    hasWord(q, "cns") ||
    q.includes("4 hours") ||
    q.includes("four hours") ||
    q.includes("5 hours") ||
    q.includes("five hours") ||
    q.includes("bad sleep") ||
    q.includes("barely slept") ||
    q.includes("should i train today") ||
    q.includes("train today") && includesAny(q, ["sleep", "slept", "tired", "sore", "fatigue", "drained", "exhausted"])
  );
}

function wantsProofDecision(q: string) {
  return (
    q.includes("uploaded proof") ||
    q.includes("upload proof") ||
    q.includes("submit proof") ||
    q.includes("submitted proof") ||
    q.includes("show proof") ||
    q.includes("proof reps") ||
    q.includes("proof video") ||
    q.includes("proof image") ||
    q.includes("proof metrics") ||
    q.includes("count as proof") ||
    q.includes("counts as proof") ||
    q.includes("does that count") ||
    q.includes("logged reps") ||
    q.includes("log reps") ||
    q.includes("verified reps") ||
    q.includes("under resistance") ||
    q.includes("i fixed it") ||
    q.includes("fixed it") ||
    q.includes("i did it") ||
    q.includes("completed the reps") ||
    q.includes("finished the reps")
  );
}

function wantsProgressionDecision(q: string) {
  return (
    q.includes("move to the next correction") ||
    q.includes("move on to the next correction") ||
    q.includes("next correction") ||
    q.includes("can i move on") ||
    q.includes("can i advance") ||
    q.includes("unlock") ||
    q.includes("progress to") ||
    q.includes("new correction") ||
    q.includes("next layer") ||
    q.includes("new technique") ||
    q.includes("learn something new")
  );
}

function wantsSystemNavigation(q: string) {
  return (
    q.includes("where is") ||
    q.includes("how do i open") ||
    q.includes("how do i use") ||
    q.includes("show me") ||
    q.includes("take me to") ||
    q.includes("go to") ||
    q.includes("open ") ||
    q.includes("navigate") ||
    q.includes("tab") ||
    q.includes("screen") ||
    q.includes("page") ||
    q.includes("button") ||
    q.includes("dashboard") ||
    q.includes("vision") ||
    q.includes("fuel screen") ||
    q.includes("recovery screen") ||
    q.includes("profile screen")
  );
}

function wantsPsychologyDecision(q: string) {
  return includesAny(q, [
    "get into my head",
    "gets into my head",
    "got into my head",
    "opponent get into my head",
    "opponent gets into my head",
    "in my head",
    "head games",
    "mental game",
    "mentally",
    "composure",
    "lose composure",
    "lost composure",
    "confidence",
    "lose confidence",
    "lost confidence",
    "doubt",
    "self doubt",
    "fear",
    "scared",
    "afraid",
    "nervous",
    "anxiety",
    "anxious",
    "panic",
    "panicked",
    "anger",
    "angry",
    "mad",
    "emotional",
    "emotion",
    "emotions",
    "ego",
    "pride",
    "trash talk",
    "trash talked",
    "taunts me",
    "taunted me",
    "he taunts",
    "mocking",
    "mocked",
    "disrespect",
    "disrespected",
    "crowd",
    "people watching",
    "everyone was watching",
    "pressure discipline",
    "emotional control",
    "control my emotions",
    "calm down",
    "stay calm",
    "wanted revenge",
    "wanted to prove",
    "prove myself",
    "stillness feels like losing",
    "forced to attack",
    "need to attack",
    "can't stop attacking",
    "cannot stop attacking",
    "action addiction",
    "froze",
    "hesitated",
    "scared to shoot",
    "afraid to shoot",
    "time running out",
    "clock was running out",
    "forced a bad shot",
    "down on points",
    "behind on points",
  ]);
}
function wantsPressureDiscipline(q: string) {
  return includesAny(q, [
    "started rushing",
    "rushing entries",
    "rushed entries",
    "so i rush",
    "i rush",
    "rushed",
    "panicked",
    "panic",
    "anxiety",
    "anxious",
    "got hit",
    "got clipped",
    "countered me",
    "started swinging",
    "swinging back",
    "trash talk",
    "trash talked",
    "taunts me",
    "taunted me",
    "he taunts",
    "mocking",
    "mocked",
    "disrespect",
    "disrespected",
    "opponent get into my head",
    "gets into my head",
    "get into my head",
    "in my head",
    "head games",
    "mental game",
    "mentally",
    "composure",
    "lose composure",
    "lost composure",
    "confidence",
    "lose confidence",
    "lost confidence",
    "doubt",
    "self doubt",
    "fear",
    "scared",
    "afraid",
    "nervous",
    "anger",
    "angry",
    "mad",
    "emotional",
    "emotion",
    "emotions",
    "ego",
    "pride",
    "pressure discipline",
    "emotional control",
    "control my emotions",
    "calm down",
    "stay calm",
    "wanted revenge",
    "wanted to prove",
    "prove myself",
    "everyone was watching",
    "people watching",
    "crowd",
    "lost the exchange",
    "failed exchange",
    "gassed",
    "gas out",
    "fatigue",
    "exhausted",
    "breathing heavy",
  ]);
}

function wantsPerformanceContext(q: string) {
  return includesAny(q, [
    "coach",
    "coaching",
    "corner",
    "game plan",
    "gameplan",
    "next session",
    "next practice",
    "next fight",
    "fight camp",
    "competition",
    "opponent",
    "match",
    "bout",
    "round",
    "performance",
    "warm up",
    "jiu jitsu",
    "bjj",
    "grappling",
    "kickboxing",
    "muay thai",
    "clinch",
    "punch",
    "kick",
    "submission",
    "body lock",
    "what should i do next",
    "what do i do next",
    "what should i focus on",
    "what matters today",
    "what should i carry",
    "what should i bring back",
    "what did i do wrong",
    "how do i fix this",
  ]);
}

function wantsGeneralAssistantTask(q: string) {
  return includesAny(q, [
    "tell me a joke",
    "write me a poem",
    "write a poem",
    "write me a story",
    "write a story",
    "debug this code",
    "debug this function",
    "javascript function",
    "python script",
    "capital of",
    "recommend a movie",
    "movie recommendation",
    "solve my homework",
    "write my essay",
  ]);
}

function outOfScopeDecision() {
  return [
    "That falls outside Disciplin.",
    "Disciplin prepares you for training, competition, recovery, and your next coaching conversation.",
    "",
    "Ask instead:",
    "What should I carry into my next session?",
    "How should recovery change today's work?",
    "What should I take back to my coach?",
  ].join("\n");
}

function classifySenseiIntent(message: string, section?: Section): ClassifiedIntent {
  const q = message.toLowerCase();

  if (wantsSystemNavigation(q)) {
    return {
      category: "System Navigation",
      intent: "system_navigation",
      route: "strictSystemNavigationDecision",
      confidence: "medium",
      reason: "The prompt asks how to move through the app instead of asking for coaching.",
    };
  }

  if (wantsGeneralAssistantTask(q)) {
    return {
      category: "Out of Scope",
      intent: "out_of_scope",
      route: "outOfScopeDecision",
      confidence: "high",
      reason: "The request is a general-assistant task, not athlete preparation.",
    };
  }

  if (wantsProofDecision(q)) {
    return {
      category: "Proof",
      intent: "proof_decision",
      route: "strictProofDecision",
      confidence: "high",
      reason: "The prompt claims or submits proof, reps, verification, or resistance.",
    };
  }

  if (wantsProgressionDecision(q) || isAdvancedPrompt(message)) {
    return {
      category: "Progression",
      intent: "advanced_request",
      route: "strictProgressionDecision",
      confidence: "high",
      reason: "The prompt asks to unlock, advance, move on, or add a new layer.",
    };
  }

  if (wantsWeightCutDecision(q)) {
    return {
      category: "Weight Cut",
      intent: "weight_cut_decision",
      route: "strictWeightCutDecision",
      confidence: "high",
      reason: "The prompt mentions weigh-ins, cutting, dehydration, or making weight.",
    };
  }

  if (section === "nutrition" || wantsFuelDecision(q)) {
    return {
      category: "Nutrition",
      intent: "fuel_decision",
      route: "strictFuelDecision",
      confidence: section === "nutrition" ? "medium" : "high",
      reason: "The prompt asks about food, fuel, hydration, calories, protein, or carbs.",
    };
  }

  if (wantsInjuryDecision(q)) {
    return {
      category: "Injury",
      intent: "injury_decision",
      route: "strictInjuryDecision",
      confidence: "high",
      reason: "The prompt names pain, a joint, a movement limitation, or injury signal.",
    };
  }

  if (section === "recovery" || wantsRecoveryDecision(q)) {
    return {
      category: "Recovery",
      intent: "recovery_decision",
      route: "strictRecoveryDecision",
      confidence: section === "recovery" ? "medium" : "high",
      reason: "The prompt asks about sleep, fatigue, soreness, rest, burnout, or readiness.",
    };
  }

  if (wantsPsychologyDecision(q)) {
    return {
      category: "Psychology",
      intent: "psychology_decision",
      route: "strictPressureDisciplineDecision",
      confidence: "high",
      reason: "The prompt asks about fear, anger, confidence, panic, trash talk, or composure.",
    };
  }

  if (wantsPressureDiscipline(q)) {
    return {
      category: "Psychology",
      intent: "pressure_discipline",
      route: "strictPressureDisciplineDecision",
      confidence: "medium",
      reason: "The prompt describes pressure behavior that can collapse execution.",
    };
  }

  if (wantsGymDecision(q)) {
    return {
      category: "System Navigation",
      intent: "gym_decision",
      route: "buildGymDecision",
      confidence: "medium",
      reason: "The prompt asks where to train or which gym to choose.",
    };
  }

  if (
    section === "training" ||
    hasWord(q, "drill") ||
    hasWord(q, "rep") ||
    hasWord(q, "session") ||
    hasWord(q, "train") ||
    hasWord(q, "training") ||
    hasWord(q, "fix") ||
    hasWord(q, "wrestle") ||
    hasWord(q, "wrestling") ||
    hasWord(q, "boxing") ||
    hasWord(q, "spar") ||
    hasWord(q, "shot") ||
    hasWord(q, "sprawled") ||
    hasWord(q, "sprawl") ||
    hasWord(q, "takedown") ||
    hasWord(q, "counter") ||
    hasWord(q, "guard") ||
    hasWord(q, "stance") ||
    hasWord(q, "grapple") ||
    hasWord(q, "grappling") ||
    hasWord(q, "bjj") ||
    hasWord(q, "clinch") ||
    hasWord(q, "punch") ||
    hasWord(q, "kick") ||
    hasWord(q, "submission") ||
    hasWord(q, "sweep") ||
    q.includes("jiu jitsu") ||
    q.includes("kickboxing") ||
    q.includes("muay thai") ||
    q.includes("what should i train")
  ) {
    return {
      category: "Technical",
      intent: "training_decision",
      route: "strictTrainingDecision",
      confidence: section === "training" ? "medium" : "high",
      reason: "The prompt asks about technique, drills, sparring, shots, stance, or training.",
    };
  }

  if (section === "overview") {
    return {
      category: "System Navigation",
      intent: "overview_decision",
      route: "overviewDecision",
      confidence: "medium",
      reason: "The prompt is scoped to overview.",
    };
  }

  if (!wantsPerformanceContext(q)) {
    return {
      category: "Out of Scope",
      intent: "out_of_scope",
      route: "outOfScopeDecision",
      confidence: "high",
      reason: "The request does not prepare the athlete for training, competition, recovery, coaching, or performance.",
    };
  }

  return {
    category: "Technical",
    intent: "general_decision",
    route: "runAi",
    confidence: "low",
    reason: "No strong domain signal matched; default to technical coaching.",
  };
}

function inferIntent(message: string, section?: Section): Intent {
  return classifySenseiIntent(message, section).intent;
}

function finiteNumber(value: unknown): number | null {
  if (value === null || value === undefined || cleanText(value) === "") {
    return null;
  }
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : null;
}

function stringList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(cleanText).filter(Boolean);

  const text = cleanText(value);
  if (!text) return [];

  return text
    .split(/\r?\n|,|;/)
    .map(cleanText)
    .filter(Boolean);
}

const MEMORY_BUCKETS: SenseiMemoryBucket[] = [
  "repeatedQuestions",
  "pressureLeaks",
  "emotionalTriggers",
  "activeCorrections",
  "habits",
  "repeatedBehaviors",
  "avoidedCorrections",
  "refusedProgressionAttempts",
  "confidenceTrends",
  "injuryFears",
  "fightCampConcerns",
  "repeatedExcuses",
  "successfulInterventions",
];

function slugMemoryKey(input: string) {
  return cleanText(input)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function normalizeMemoryItem(input: any, now: string): SenseiMemoryItem | null {
  const label = cleanText(input?.label || input?.name || input?.text);
  if (!label) return null;

  return {
    key: cleanText(input?.key) || slugMemoryKey(label),
    label,
    count: Math.max(1, finiteNumber(input?.count) || 1),
    firstSeen: cleanText(input?.firstSeen) || now,
    lastSeen: cleanText(input?.lastSeen) || now,
    lastQuestion: cleanText(input?.lastQuestion) || undefined,
    examples: Array.isArray(input?.examples)
      ? input.examples.map(cleanText).filter(Boolean).slice(-4)
      : [],
  };
}

function normalizeSenseiMemory(input: any): SenseiMemory {
  const now = new Date().toISOString();
  const memory = MEMORY_BUCKETS.reduce((acc, bucket) => {
    const items = Array.isArray(input?.[bucket]) ? input[bucket] : [];
    acc[bucket] = items
      .map((item: any) => normalizeMemoryItem(item, now))
      .filter(Boolean)
      .slice(-24) as SenseiMemoryItem[];
    return acc;
  }, {} as SenseiMemory);

  memory.summary = cleanText(input?.summary) || undefined;
  memory.lastUpdated = cleanText(input?.lastUpdated) || undefined;
  return memory;
}

function cloneSenseiMemory(memory: SenseiMemory): SenseiMemory {
  const clone = MEMORY_BUCKETS.reduce((acc, bucket) => {
    acc[bucket] = [...(memory[bucket] || [])].map((item) => ({
      ...item,
      examples: [...(item.examples || [])],
    }));
    return acc;
  }, {} as SenseiMemory);

  clone.summary = memory.summary;
  clone.lastUpdated = memory.lastUpdated;
  return clone;
}

function rememberMemoryItem(args: {
  memory: SenseiMemory;
  bucket: SenseiMemoryBucket;
  label: string;
  question: string;
  now: string;
}) {
  const key = slugMemoryKey(args.label);
  const items = args.memory[args.bucket] || [];
  const existing = items.find((item) => item.key === key);

  if (existing) {
    existing.count += 1;
    existing.lastSeen = args.now;
    existing.lastQuestion = args.question;
    existing.examples = [
      ...(existing.examples || []).filter((example) => example !== args.question),
      args.question,
    ].slice(-4);
    return;
  }

  items.push({
    key,
    label: args.label,
    count: 1,
    firstSeen: args.now,
    lastSeen: args.now,
    lastQuestion: args.question,
    examples: args.question ? [args.question] : [],
  });

  args.memory[args.bucket] = items.slice(-24);
}

function memoryAgeLine(item: SenseiMemoryItem) {
  const first = Date.parse(item.firstSeen);
  const last = Date.parse(item.lastSeen);
  if (!Number.isFinite(first) || !Number.isFinite(last)) return "";

  const days = Math.max(0, Math.round((last - first) / 86_400_000));
  if (days >= 42) return "This has been around for six weeks.";
  if (days >= 28) return "This has been around for a month.";
  if (days >= 14) return "This has been around for two weeks.";
  if (days >= 7) return "This has been around all week.";
  if (item.count >= 3) return "This isn't new.";
  if (item.count >= 2) return "You've done this before.";
  return "";
}

function strongestMemory(memory: SenseiMemory, bucket: SenseiMemoryBucket) {
  return [...(memory[bucket] || [])].sort((a, b) => b.count - a.count)[0] || null;
}

function memoryPatternLine(memory: SenseiMemory, label: string) {
  const key = slugMemoryKey(label);
  const allItems = MEMORY_BUCKETS.flatMap((bucket) => memory[bucket] || []);
  const item = allItems.find((entry) => entry.key === key);
  if (!item || item.count < 2) return "";

  const age = memoryAgeLine(item);
  if (age) return age;
  return "This is not today's problem.";
}

function strongestMemoryLine(memory: SenseiMemory | undefined, bucket: SenseiMemoryBucket) {
  if (!memory) return "";
  const item = strongestMemory(memory, bucket);
  if (!item || item.count < 2) return "";

  const age = memoryAgeLine(item);
  if (age) return age;
  return "You've done this before.";
}

function questionMemoryLabel(message: string, intent: Intent) {
  const q = message.toLowerCase();

  if (intent === "psychology_decision" || intent === "pressure_discipline") {
    if (includesAny(q, ["taunt", "trash talk", "in my head", "head games"])) {
      return "Asks why taunts pull him out of the plan";
    }
    if (includesAny(q, ["emotional", "angry", "mad", "revenge", "ego"])) {
      return "Asks why emotion takes over after resistance";
    }
    if (includesAny(q, ["confidence", "doubt", "scared", "afraid", "nervous"])) {
      return "Asks why confidence drops under pressure";
    }
    return "Asks why pressure changes the decision";
  }

  if (intent === "recovery_decision") return "Asks whether readiness should change training";
  if (intent === "injury_decision") return "Asks how pain should change training";
  if (intent === "fuel_decision") return "Asks whether fuel supports today's work";
  if (intent === "advanced_request") return "Asks to move on before proof";
  if (intent === "proof_decision") return "Asks whether proof is enough";

  return cleanText(message).slice(0, 120);
}

function repeatedBehaviorLabel(message: string, pressureCase: PressureCase) {
  const q = message.toLowerCase();

  if (
    pressureCase === "taunt_rush" ||
    includesAny(q, ["taunt", "trash talk", "in my head", "head games"])
  ) {
    return "Usually loses the plan after taunts or mockery";
  }

  if (
    pressureCase === "missed_entry" ||
    pressureCase === "panic_tempo" ||
    includesAny(q, ["stuffed", "defended", "sprawled", "first shot", "missed shot"])
  ) {
    return "Usually rushes after the first shot gets stopped";
  }

  if (pressureCase === "got_hit") return "Usually trades position for payback after contact";
  if (pressureCase === "fatigue_collapse") return "Usually drops the standard when tired";
  if (pressureCase === "crowd_pressure") return "Usually changes behavior when people are watching";
  if (pressureCase === "fear_response") return "Usually hesitates when the correct action feels risky";
  if (pressureCase === "action_addiction") return "Usually attacks because stillness feels wrong";

  return pressureHabitLabel(pressureCase);
}

function updateSenseiMemory(args: {
  memory: SenseiMemory;
  message: string;
  intent: Intent;
  activeCorrection: string;
  pressureCase: PressureCase;
  pressureLeak: PressureLeak;
  progress: DirectiveProgress;
  operatingDecision: SenseiOperatingDecision;
}) {
  if (args.intent === "out_of_scope") {
    return cloneSenseiMemory(args.memory);
  }

  const now = new Date().toISOString();
  const next = cloneSenseiMemory(args.memory);
  const q = args.message.toLowerCase();
  const question = cleanText(args.message);
  const correction = correctionHandle(args.activeCorrection || "the correction");
  const questionLabel = questionMemoryLabel(question, args.intent);

  if (question) {
    rememberMemoryItem({
      memory: next,
      bucket: "repeatedQuestions",
      label: questionLabel,
      question,
      now,
    });
  }

  if (args.activeCorrection) {
    rememberMemoryItem({
      memory: next,
      bucket: "activeCorrections",
      label: `Working on ${correction}`,
      question,
      now,
    });
  }

  if (args.intent === "advanced_request") {
    rememberMemoryItem({
      memory: next,
      bucket: "refusedProgressionAttempts",
      label: args.activeCorrection
        ? `Asked to progress before ${correction} was proven`
        : "Asked to progress before proof existed",
      question,
      now,
    });
    rememberMemoryItem({
      memory: next,
      bucket: "avoidedCorrections",
      label: args.activeCorrection
        ? `Tries to leave ${correction} when it gets hard`
        : "Tries to leave the current correction when it gets hard",
      question,
      now,
    });
  }

  if (args.intent === "psychology_decision" || args.intent === "pressure_discipline") {
    rememberMemoryItem({
      memory: next,
      bucket: "pressureLeaks",
      label: args.pressureLeak,
      question,
      now,
    });

    rememberMemoryItem({
      memory: next,
      bucket: "habits",
      label: pressureHabitLabel(args.pressureCase),
      question,
      now,
    });

    rememberMemoryItem({
      memory: next,
      bucket: "repeatedBehaviors",
      label: repeatedBehaviorLabel(question, args.pressureCase),
      question,
      now,
    });
  }

  if (includesAny(q, ["emotional", "angry", "mad", "revenge", "trash talk", "taunt", "in my head"])) {
    rememberMemoryItem({
      memory: next,
      bucket: "emotionalTriggers",
      label: includesAny(q, ["taunt", "trash talk", "in my head"])
        ? "Taunts pull emotion into the next decision"
        : "Defended exchanges pull emotion into the next decision",
      question,
      now,
    });
  }

  if (includesAny(q, ["confidence", "doubt", "self doubt", "scared", "afraid", "nervous"])) {
    rememberMemoryItem({
      memory: next,
      bucket: "confidenceTrends",
      label: "Confidence drops when resistance appears",
      question,
      now,
    });
  }

  if (args.intent === "injury_decision" || wantsInjuryDecision(q)) {
    rememberMemoryItem({
      memory: next,
      bucket: "injuryFears",
      label: "Worries the body will not support the correction",
      question,
      now,
    });
  }

  if (includesAny(q, ["fight", "camp", "opponent", "weight cut", "weigh", "days out"])) {
    rememberMemoryItem({
      memory: next,
      bucket: "fightCampConcerns",
      label: "Camp pressure changes decision quality",
      question,
      now,
    });
  }

  if (includesAny(q, ["tired", "sleep", "slept", "sore", "busy", "no time", "can't", "cannot"])) {
    rememberMemoryItem({
      memory: next,
      bucket: "repeatedExcuses",
      label: "Uses readiness or life stress to negotiate the standard",
      question,
      now,
    });
  }

  const proofVerified =
    args.progress.repsCompleted >= args.progress.repsRequired &&
    args.progress.underResistance === true &&
    ["image", "video", "metrics"].includes(String(args.progress.proofType));

  if (proofVerified || args.operatingDecision.action === "UNLOCK_NEXT_LAYER") {
    rememberMemoryItem({
      memory: next,
      bucket: "successfulInterventions",
      label: args.activeCorrection
        ? `Proved ${correction} by staying with the process`
        : "Solved the problem by staying with the process",
      question,
      now,
    });
  }

  next.lastUpdated = now;
  const strongestHabit = strongestMemory(next, "habits");
  const strongestLeak = strongestMemory(next, "pressureLeaks");
  const strongestBehavior = strongestMemory(next, "repeatedBehaviors");
  next.summary = [
    strongestHabit ? `Habit: ${strongestHabit.label}` : "",
    strongestLeak ? `Pressure: ${strongestLeak.label}` : "",
    strongestBehavior ? `Behavior: ${strongestBehavior.label}` : "",
  ].filter(Boolean).join(" | ") || next.summary;

  return next;
}

function daysUntil(dateValue: unknown): number | null {
  const value = cleanText(dateValue);
  if (!value) return null;

  const time = Date.parse(value);
  if (!Number.isFinite(time)) return null;

  const difference = time - Date.now();
  if (difference < -86_400_000) return null;

  return Math.max(0, Math.ceil(difference / 86_400_000));
}

function buildContextInput(body: any) {
  const fighter = body?.fighterContext || {};
  const visionContext = body?.visionContext || {};
  const connected = body?.connected || {};

  return {
    ...body,
    ...fighter,
    ...visionContext,
    ...connected,
    vision: {
      ...(fighter?.vision || {}),
      ...(visionContext?.vision || {}),
      ...(body?.vision || {}),
      ...(connected?.vision || {}),
    },
    fuel: {
      ...(fighter?.fuel || {}),
      ...(visionContext?.fuel || {}),
      ...(body?.fuel || {}),
      ...(connected?.fuel || {}),
    },
    psychology: {
      ...(fighter?.psychology || {}),
      ...(visionContext?.psychology || {}),
      ...(body?.psychology || {}),
      ...(connected?.psychology || {}),
    },
    profile: {
      ...(fighter?.profile || {}),
      ...(visionContext?.profile || {}),
      ...(body?.profile || {}),
      ...(connected?.profile || {}),
    },
    history: {
      ...(fighter?.history || {}),
      ...(visionContext?.history || {}),
      ...(body?.history || {}),
      ...(connected?.history || {}),
    },
    fighterReality: {
      ...(fighter?.fighterReality || fighter?.reality || {}),
      ...(visionContext?.fighterReality || visionContext?.reality || {}),
      ...(body?.fighterReality || body?.reality || {}),
      ...(connected?.fighterReality || connected?.reality || {}),
    },
    memory:
      body?.senseiMemory ||
      body?.memory ||
      fighter?.senseiMemory ||
      fighter?.memory ||
      visionContext?.senseiMemory ||
      visionContext?.memory ||
      connected?.senseiMemory ||
      connected?.memory ||
      {},
    camp: {
      ...(fighter?.camp || {}),
      ...(visionContext?.camp || {}),
      ...(body?.camp || {}),
      ...(connected?.camp || {}),
    },
  };
}

function normalizeConnected(input: any): SenseiConnected {
  const gyms = Array.isArray(input?.gyms) ? input.gyms : [];
  const fightDate =
    cleanText(
      input?.camp?.fightDate ||
        input?.camp?.fight_date ||
        input?.fightDate ||
        input?.fight_date ||
        input?.vision?.fightDate ||
        input?.vision?.fight_date
    ) || null;
  const explicitDaysOut = finiteNumber(
    input?.camp?.daysOut ??
      input?.camp?.days_out ??
      input?.daysOut ??
      input?.days_out ??
      input?.vision?.daysOut ??
      input?.vision?.days_out
  );

  return {
    vision: {
      present:
        input?.vision?.present === true ||
        !!cleanText(input?.vision?.correction),
      correction: cleanText(input?.vision?.correction) || null,
      severity: cleanText(input?.vision?.severity) || null,
      fix_next_rep: cleanText(input?.vision?.fix_next_rep) || null,
      repeated_issue:
        cleanText(
          input?.vision?.repeated_issue || input?.vision?.repeatedIssue
        ) || null,
      force:
        cleanText(input?.vision?.force || input?.vision?.forceCue) || null,
      see: cleanText(input?.vision?.see || input?.vision?.seeCue) || null,
      go: cleanText(input?.vision?.go || input?.vision?.goCue) || null,
      drill: cleanText(input?.vision?.drill) || null,
      pressure_test:
        cleanText(
          input?.vision?.pressure_test || input?.vision?.pressureTest
        ) || null,
      proof_required: finiteNumber(
        input?.vision?.proof_required ?? input?.vision?.proofRequired
      ),
    },
    fuel: {
      present: input?.fuel?.present === true,
      score:
        typeof input?.fuel?.score === "number" &&
        Number.isFinite(input.fuel.score)
          ? input.fuel.score
          : null,
      rating: cleanText(input?.fuel?.rating) || null,
      decision: cleanText(input?.fuel?.decision) || null,
      recoveryStatus:
        cleanText(
          input?.fuel?.recoveryStatus ||
            input?.fuel?.recovery_status ||
            input?.recovery?.status ||
            input?.recoveryStatus
        ) || null,
      sleepHours: finiteNumber(
        input?.fuel?.sleepHours ??
          input?.fuel?.sleep_hours ??
          input?.sleep?.hours ??
          input?.sleepHours
      ),
      sleepQuality:
        cleanText(
          input?.fuel?.sleepQuality ||
            input?.fuel?.sleep_quality ||
            input?.sleep?.quality ||
            input?.sleepQuality
        ) || null,
      weightCutStatus:
        cleanText(
          input?.fuel?.weightCutStatus ||
            input?.fuel?.weight_cut_status ||
            input?.weightCut?.status ||
            input?.weight_cut_status
        ) || null,
      currentWeight: finiteNumber(
        input?.fuel?.currentWeight ??
          input?.fuel?.current_weight ??
          input?.weightCut?.currentWeight
      ),
      targetWeight: finiteNumber(
        input?.fuel?.targetWeight ??
          input?.fuel?.target_weight ??
          input?.weightCut?.targetWeight
      ),
    },
    fighterReality: {
      injuries: stringList(
        input?.fighterReality?.injuries ||
          input?.injuries ||
          input?.medical?.injuries ||
          input?.health?.injuries
      ),
      restrictions: stringList(
        input?.fighterReality?.restrictions ||
          input?.restrictions ||
          input?.medical?.restrictions ||
          input?.health?.restrictions
      ),
      recoveryStatus:
        cleanText(
          input?.fighterReality?.recoveryStatus ||
            input?.fighterReality?.recovery_status ||
            input?.recovery?.status ||
            input?.fuel?.recoveryStatus ||
            input?.fuel?.recovery_status
        ) || null,
      trainingFrequency: finiteNumber(
        input?.fighterReality?.trainingFrequency ??
          input?.fighterReality?.training_frequency ??
          input?.trainingFrequency ??
          input?.training_frequency ??
          input?.schedule?.sessionsPerWeek
      ),
      equipmentAccess: stringList(
        input?.fighterReality?.equipmentAccess ||
          input?.fighterReality?.equipment_access ||
          input?.equipmentAccess ||
          input?.equipment_access ||
          input?.equipment
      ),
    },
    psychology: {
      present: input?.psychology?.present === true,
      summary: cleanText(input?.psychology?.summary),
      commandStyle: cleanText(input?.psychology?.commandStyle),
    },
    profile: {
      present: input?.profile?.present === true,
      baseArt: cleanText(input?.profile?.baseArt),
      paceStyle: cleanText(input?.profile?.paceStyle),
      weaknesses: cleanText(input?.profile?.weaknesses),
      experienceLevel: cleanText(input?.profile?.experienceLevel),
      goal: cleanText(input?.profile?.goal),
      preferredStyle: cleanText(input?.profile?.preferredStyle),
      avoidedStyle: cleanText(input?.profile?.avoidedStyle),
      fightingStyle:
        cleanText(input?.profile?.fightingStyle || input?.profile?.fighting_style),
      primaryStyle:
        cleanText(input?.profile?.primaryStyle || input?.profile?.primary_style),
      aGame: cleanText(input?.profile?.aGame || input?.profile?.a_game),
      preferredPositions:
        cleanText(
          input?.profile?.preferredPositions ||
            input?.profile?.preferred_positions
        ),
      bestAttacks:
        cleanText(input?.profile?.bestAttacks || input?.profile?.best_attacks),
      winConditions:
        cleanText(input?.profile?.winConditions || input?.profile?.win_conditions),
      commonPressureBreaks:
        cleanText(
          input?.profile?.commonPressureBreaks ||
            input?.profile?.common_pressure_breaks
        ),
      commonEmotionalTriggers:
        cleanText(
          input?.profile?.commonEmotionalTriggers ||
            input?.profile?.common_emotional_triggers
        ),
      commonPressureMistakes:
        cleanText(
          input?.profile?.commonPressureMistakes ||
            input?.profile?.common_pressure_mistakes
        ),
      currentGameplan:
        cleanText(input?.profile?.currentGameplan || input?.profile?.current_gameplan),
    },
    camp: {
      nextFight:
        cleanText(
          input?.camp?.nextFight ||
            input?.camp?.next_fight ||
            input?.nextFight ||
            input?.next_fight ||
            input?.vision?.nextFight ||
            input?.vision?.next_fight
        ) || null,
      fightDate,
      opponent:
        cleanText(
          input?.camp?.opponent || input?.opponent || input?.vision?.opponent
        ) || null,
      daysOut: explicitDaysOut ?? daysUntil(fightDate),
      currentCorrectionLock:
        cleanText(
          input?.camp?.currentCorrectionLock ||
            input?.camp?.current_correction_lock ||
            input?.currentCorrectionLock ||
            input?.current_correction_lock ||
            input?.vision?.currentCorrectionLock ||
            input?.vision?.current_correction_lock
        ) || null,
      repeatedIssue:
        cleanText(
          input?.camp?.repeatedIssue ||
            input?.camp?.repeated_issue ||
            input?.repeatedIssue ||
            input?.repeated_issue ||
            input?.vision?.repeatedIssue ||
            input?.vision?.repeated_issue
        ) || null,
      forceCue:
        cleanText(
          input?.camp?.forceCue ||
            input?.camp?.force ||
            input?.vision?.forceCue ||
            input?.vision?.force
        ) || null,
      seeCue:
        cleanText(
          input?.camp?.seeCue ||
            input?.camp?.see ||
            input?.vision?.seeCue ||
            input?.vision?.see
        ) || null,
      goCue:
        cleanText(
          input?.camp?.goCue ||
            input?.camp?.go ||
            input?.vision?.goCue ||
            input?.vision?.go
        ) || null,
    },
    history: {
      recurringMistakes: stringList(
        input?.history?.recurringMistakes ||
          input?.history?.recurring_mistakes ||
          input?.vision?.recurringMistakes ||
          input?.vision?.recurring_mistakes
      ),
      pressureLeaks: stringList(
        input?.history?.pressureLeaks ||
          input?.history?.pressure_leaks ||
          input?.psychology?.pressureLeaks ||
          input?.psychology?.pressure_leaks
      ),
      retainedCorrections: stringList(
        input?.history?.retainedCorrections ||
          input?.history?.retained_corrections ||
          input?.vision?.retainedCorrections ||
          input?.vision?.retained_corrections
      ),
      failedCorrections: stringList(
        input?.history?.failedCorrections ||
          input?.history?.failed_corrections ||
          input?.vision?.failedCorrections ||
          input?.vision?.failed_corrections
      ),
      recentSessions: stringList(
        input?.history?.recentSessions ||
          input?.history?.recent_sessions ||
          input?.trainingHistory ||
          input?.training_history
      ),
    },
    memory: normalizeSenseiMemory(input?.memory || input?.senseiMemory || {}),
    gyms: gyms.map((gym: any) => ({
      id: cleanText(gym?.id),
      name: cleanText(gym?.name),
      location: cleanText(gym?.location),
      compatibility:
        typeof gym?.compatibility === "number" &&
        Number.isFinite(gym.compatibility)
          ? gym.compatibility
          : 0,
      disciplineMatch: Array.isArray(gym?.disciplineMatch)
        ? gym.disciplineMatch.map(cleanText).filter(Boolean)
        : [],
      styleMatch: Array.isArray(gym?.styleMatch)
        ? gym.styleMatch.map(cleanText).filter(Boolean)
        : [],
      watchOut: Array.isArray(gym?.watchOut)
        ? gym.watchOut.map(cleanText).filter(Boolean)
        : [],
      href: cleanText(gym?.href),
      verified: gym?.verified === true,
          })),
  };
}

function normalizeSession(input: any): SenseiSession {
  return {
    lastDecision: cleanText(input?.lastDecision),
    lastCommand: cleanText(input?.lastCommand),
    lastWhy: cleanText(input?.lastWhy),
    lastUpdated: cleanText(input?.lastUpdated),
    awaitingPsychologyAnswer: input?.awaitingPsychologyAnswer === true,
    psychologyTopic: cleanText(input?.psychologyTopic),
    previousQuestion: cleanText(input?.previousQuestion),
  };
}

function shouldContinuePsychologySession(session: SenseiSession, message: string) {
  if (session.awaitingPsychologyAnswer !== true) return false;

  const q = message.toLowerCase();
  if (!q) return false;

  if (
    wantsSystemNavigation(q) ||
    wantsProofDecision(q) ||
    wantsProgressionDecision(q) ||
    wantsWeightCutDecision(q) ||
    wantsFuelDecision(q) ||
    wantsInjuryDecision(q) ||
    wantsRecoveryDecision(q) ||
    wantsGymDecision(q)
  ) {
    return false;
  }

  return true;
}

function isPsychologyFollowupAnswer(message: string) {
  const q = message.toLowerCase();

  if (
    includesAny(q, [
      "i hated getting mocked",
      "hated getting mocked",
      "i hated being mocked",
      "hated being mocked",
      "i hated the mocking",
      "i hated the disrespect",
      "hated the disrespect",
      "it was the disrespect",
      "it was respect",
      "it was no respect",
      "no respect",
      "got no respect",
      "i got no respect",
      "i hated the fact i got no respect",
      "i hated getting no respect",
      "i hated no respect",
      "being disrespected",
      "getting disrespected",
      "getting mocked",
      "being mocked",
      "he mocked me",
      "he was mocking me",
      "he disrespected me",
      "mocked me",
      "disrespected me",
    ])
  ) {
    return true;
  }

  return false;
}

function psychologyTopicFromAnswer(message: string, pressureCase: PressureCase) {
  const q = message.toLowerCase();

  if (includesAny(q, ["mocking", "mocked", "disrespect", "disrespected", "no respect", "respect"])) {
    return "mocked";
  }
  if (includesAny(q, ["stopped", "stuffed", "sprawled", "defended"])) {
    return "stopped";
  }
  if (includesAny(q, ["taunt", "trash talk", "in my head", "head games"])) {
    return "taunt";
  }
  if (includesAny(q, ["angry", "mad", "revenge", "prove"])) {
    return "ego";
  }
  if (includesAny(q, ["discomfort", "uncomfortable", "wanted out", "escape"])) {
    return "discomfort";
  }
  if (includesAny(q, ["urgency", "rush", "rushed", "fast", "hurry"])) {
    return "urgency";
  }
  if (pressureCase === "taunt_rush") return "taunt";
  if (pressureCase === "ego_pull") return "ego";

  return "pressure";
}

function athleteStyleText(connected?: SenseiConnected) {
  const profile = connected?.profile || {};
  return [
    profile.primaryStyle,
    profile.fightingStyle,
    profile.aGame,
    profile.preferredPositions,
    profile.bestAttacks,
    profile.winConditions,
    profile.commonEmotionalTriggers,
    profile.commonPressureMistakes,
    profile.currentGameplan,
    profile.preferredStyle,
    profile.baseArt,
    profile.paceStyle,
  ]
    .map(cleanText)
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function styleBasedCommand(connected?: SenseiConnected, fallback = "Back to your game.") {
  const style = athleteStyleText(connected);
  const gameplan = cleanText(connected?.profile?.currentGameplan);
  const aGame = cleanText(connected?.profile?.aGame);
  const winCondition = cleanText(connected?.profile?.winConditions);

  if (gameplan) return `Don't play his game. Back to the plan: ${gameplan}.`;
  if (aGame) return `Don't play his game. Back to your A-game: ${aGame}.`;
  if (winCondition) return `Don't play his game. Make him fight yours: ${winCondition}.`;

  if (
    includesAny(style, [
      "pressure wrestler",
      "chain wrestler",
      "wrestling",
      "wrestler",
      "front foot",
      "pressure",
    ])
  ) {
    return "Don't play his game. Make him defend. Chain again.";
  }

  if (
    includesAny(style, [
      "counter striker",
      "counter",
      "striker",
      "boxing",
      "kickboxing",
      "patient",
      "make him lead",
    ])
  ) {
    return "Don't play his game. Make him lead. Punish the mistake.";
  }

  if (
    includesAny(style, [
      "bjj",
      "jiu jitsu",
      "grappler",
      "guard",
      "top control",
      "back take",
      "submission",
    ])
  ) {
    return "Don't play his game. Rebuild control. Position first.";
  }

  return `Don't play his game. ${fallback}`;
}

function styleReturnLine(connected?: SenseiConnected) {
  return styleBasedCommand(connected, "Back to your game.");
}

function buildPendingPsychologyAnswer(args: {
  message: string;
  session: SenseiSession;
  activeCorrection: string;
  memory: SenseiMemory;
  connected?: SenseiConnected;
}) {
  const topic = psychologyTopicFromAnswer(
    args.message,
    inferPressureCase(args.message)
  );
  const previousQuestion = cleanText(args.session.previousQuestion);
  const seed = `${args.message}|${previousQuestion}`;

  if (topic === "mocked" || topic === "taunt") {
    return pressureCommand(
      pickLine(seed, ["That is the trigger.", "Good. That is the trigger.", "There it is."]),
      pickLine(seed + "a", [
        "He made it personal.",
        "He wanted it personal.",
        "He pulled you into his game.",
      ]),
      pickLine(seed + "b", [
        "You played his game.",
        "You followed him there.",
        "You left your work to answer him.",
      ]),
      pickLine(seed + "c", [
        "You gave his words the next decision.",
        "You stopped working and started answering.",
        "You stopped solving the fight and started solving the disrespect.",
      ]),
      pickLine(seed + "d", ["Don't answer him.", "No revenge.", "No receipt."]),
      pickLine(seed + "e", [styleReturnLine(args.connected), "Make him fight yours.", "Back to your game."])
    );
  }

  if (topic === "stopped") {
    return pressureCommand(
      pickLine(seed, ["Good.", "There it is.", "That tells me enough."]),
      pickLine(seed + "a", [
        "Getting stopped felt like losing.",
        "The stop got bigger than the work.",
        "One defense changed your behavior.",
      ]),
      pickLine(seed + "b", [
        "You tried to win the exchange back.",
        "You chased the next moment.",
        "You let the defense choose your pace.",
      ]),
      pickLine(seed + "c", ["Do not chase.", "Stay there.", "No rush."]),
      pickLine(seed + "d", [styleReturnLine(args.connected), "Position first.", "Again."])
    );
  }

  if (topic === "ego") {
    return pressureCommand(
      pickLine(seed, ["Good.", "There it is.", "Now we know."]),
      pickLine(seed + "a", [
        "That was pride asking for a receipt.",
        "You made the exchange personal.",
        "You wanted the moment back.",
      ]),
      pickLine(seed + "b", [
        "That is how he gets you to leave the work.",
        "That is where the plan gets dropped.",
        "That is the habit trying to take over.",
      ]),
      pickLine(seed + "c", ["No receipt.", "No ego round.", "No payback."]),
      pickLine(seed + "d", ["Calm first. Action second.", styleReturnLine(args.connected), "Again."])
    );
  }

  if (topic === "discomfort") {
    return pressureCommand(
      pickLine(seed, ["Good.", "That is the answer.", "Now we know."]),
      pickLine(seed + "a", [
        "The stop made you uncomfortable.",
        "The discomfort chose the next move.",
        "You wanted out of the moment.",
      ]),
      pickLine(seed + "b", [
        "That is why you abandoned the work.",
        "That is where the plan got dropped.",
        "That is where you stopped trusting the position.",
      ]),
      pickLine(seed + "c", [
        "Do not escape the rep.",
        "Stay in the work.",
        "Hold the position.",
      ]),
      pickLine(seed + "d", ["Again.", "Position first.", styleReturnLine(args.connected)])
    );
  }

  if (topic === "urgency") {
    return pressureCommand(
      pickLine(seed, ["Good.", "There it is.", "That tells me enough."]),
      pickLine(seed + "a", [
        "Urgency took the decision.",
        "You felt late, so you rushed.",
        "You tried to win the moment back too fast.",
      ]),
      pickLine(seed + "b", [
        "That is how the correction disappears.",
        "That is where clean work becomes chasing.",
        "That is where the old habit gets back in.",
      ]),
      pickLine(seed + "c", [
        "Do not let urgency pick the pace.",
        "Slow the next decision.",
        "Reset before speed.",
      ]),
      pickLine(seed + "d", [styleReturnLine(args.connected), "Again.", "Win the position."])
    );
  }

  return pressureCommand(
    pickLine(seed, ["Good.", "There it is.", "That answers it."]),
    previousQuestion ? "That answers the question." : "That is the pressure point.",
    pickLine(seed + "a", [
      "Name it before it owns the next rep.",
      "See it before it takes the next exchange.",
      "Catch it before it chooses for you.",
    ]),
    pickLine(seed + "b", [
      "Do not answer emotion with speed.",
      "Do not let feeling pick the pace.",
      "Do not let the reaction become the plan.",
    ]),
    pickLine(seed + "c", [styleReturnLine(args.connected), "Again.", "Return to your game."])
  );
}

function buildPressureAnalysisAnswer(args: {
  message: string;
  pressureCase: PressureCase;
  directive: string;
  memory?: SenseiMemory;
  habitLabel?: string;
}) {
  const rememberedLine = args.habitLabel && args.memory
    ? memoryPatternLine(args.memory, args.habitLabel)
    : "";
  const behaviorLine = args.memory
    ? strongestMemoryLine(args.memory, "repeatedBehaviors")
    : "";
  const memoryLine = rememberedLine || behaviorLine;

  if (args.pressureCase === "taunt_rush" || args.pressureCase === "ego_pull") {
    return formatLines([
      "Here, the words changed the exchange.",
      "You stopped solving the position and started solving the disrespect.",
      memoryLine,
      "You gave his words the next decision.",
      `Once attention left the task, ${args.directive} stopped leading the decision.`,
      "Next time, let the words pass and return to your game.",
      "No revenge. Back to your game.",
    ]);
  }

  if (args.pressureCase === "missed_entry" || args.pressureCase === "panic_tempo") {
    return formatLines([
      "Here, the first defended shot changed your tempo.",
      "The stop became bigger than the position.",
      memoryLine,
      "Because the tempo changed, the next entry became a chase instead of a setup.",
      `That is where ${args.directive} disappears.`,
      "Next time, reset before the second attack.",
      "Position first. Again.",
    ]);
  }

  if (args.pressureCase === "fatigue_collapse") {
    return formatLines([
      "Here, fatigue changed the standard before you noticed it.",
      "Tired reps became loose reps.",
      memoryLine,
      `Once the standard dropped, ${args.directive} stopped surviving the round.`,
      "The answer is not more volume.",
      "Keep the reps clean.",
    ]);
  }

  if (args.pressureCase === "fear_response") {
    return formatLines([
      "Here, risk slowed the decision.",
      "You saw the opening, then asked for permission twice.",
      memoryLine,
      `That delay gave the exchange back before ${args.directive} could matter.`,
      "Next time, name the risk and take the position once.",
      "Do not ask twice.",
    ]);
  }

  return formatLines([
    "Here, pressure changed the decision.",
    "The problem was not that pressure appeared.",
    "The problem was that it pulled attention away from the task.",
    memoryLine,
    `Once attention moved, ${args.directive} stopped controlling the exchange.`,
    "Next time, return to the position before adding speed.",
    "Back to work.",
  ]);
}

function nextPsychologySessionState(args: {
  session: SenseiSession;
  answer: string;
  intent: Intent;
  message: string;
}) {
  const shouldWait =
    (args.intent === "psychology_decision" ||
      args.intent === "pressure_discipline") &&
    /\?\s*$|\?/.test(args.answer);

  return {
    awaitingPsychologyAnswer: shouldWait,
    psychologyTopic: shouldWait
      ? psychologyTopicFromAnswer(args.message, inferPressureCase(args.message))
      : "",
    previousQuestion: shouldWait
      ? args.answer
          .split("\n")
          .map(cleanText)
          .filter((line) => line.includes("?"))
          .slice(-1)[0] || cleanText(args.answer)
      : "",
  };
}

function fallbackNoDirective(): string {
  return interruption(
    "Run Vision first.",
    "No correction loaded.",
    "Upload one frame.",
    "Then ask again."
  );
}

function fallbackLocked(lockMessage: string): string {
  const raw = cleanMultiline(lockMessage);

  if (/Decision:/i.test(raw) && /Directive:/i.test(raw)) {
    return raw
      .replace(/\bFix:/gi, "Fix:")
      .replace(/\bDirective:/gi, "Directive:");
  }

  return proofDemand(
    "Do not move on.",
    raw || "The correction is still locked.",
    "Show proof.",
    "No proof, no unlock.",
    "Return to the correction."
  );
}

function inferTacticalConcept(message: string): TacticalConcept {
  const q = message.toLowerCase();

  if (
    includesAny(q, [
      "opening",
      "open",
      "space was there",
      "space appeared",
      "looked open",
      "bait",
      "trap",
      "stable opponent",
      "created a reaction",
      "reaction first",
      "set it up",
      "setup",
      "set up",
    ])
  ) {
    return "opening_ownership";
  }

  if (
    includesAny(q, [
      "what was he trying",
      "what is he trying",
      "made me chase",
      "wanted me to chase",
      "panic shoot",
      "head hunt",
      "overcommit",
      "force urgency",
      "enter a trap",
      "walked into",
      "drew me in",
    ])
  ) {
    return "opponent_intent";
  }

  if (
    includesAny(q, [
      "i landed but",
      "i scored but",
      "i won the exchange but",
      "he controlled",
      "controlled the exchange",
      "dictated",
      "i reacted",
      "he forced",
      "he made me",
    ])
  ) {
    return "exchange_ownership";
  }

  if (
    includesAny(q, [
      "i finished",
      "i scored",
      "i won",
      "got the takedown",
      "landed the shot",
      "but it felt wrong",
      "but sloppy",
      "ugly",
      "bad rep",
    ])
  ) {
    return "process_vs_outcome";
  }

  return "none";
}

function tacticalChallenge(concept: TacticalConcept, activeCorrection: string) {
  const directive = activeCorrection || "the command";

  if (concept === "opening_ownership") {
    return pressureCommand(
      "Answer the opening first.",
      "Did you create it?",
      "Did he offer it?",
      "Was it bait?",
      `If the opening was his, return to ${directive}.`,
      "Do not attack space you did not earn."
    );
  }

  if (concept === "opponent_intent") {
    return pressureCommand(
      "Name what he wanted from you.",
      "Chase.",
      "Panic shoot.",
      "Overcommit.",
      "Head hunt.",
      "Attack the reason the space exists."
    );
  }

  if (concept === "exchange_ownership") {
    return pressureCommand(
      "The result is not ownership.",
      "You may have landed.",
      "He still dictated the decision.",
      "Do not count a reaction as control.",
      `Own the next exchange through ${directive}.`
    );
  }

  if (concept === "process_vs_outcome") {
    return pressureCommand(
      "Separate outcome from proof.",
      "A finish can hide a broken decision.",
      "A failed attack can still prove the correction.",
      "Judge whether the cue survived.",
      "Then count the rep."
    );
  }

  return "";
}

function pressureLeakFromCase(pressureCase: PressureCase): PressureLeak {
  if (pressureCase === "got_hit") return "Revenge Exchange";
  if (pressureCase === "taunt_rush" || pressureCase === "ego_pull") {
    return "Ego Exchange";
  }
  if (pressureCase === "crowd_pressure") return "Crowd Pressure";
  if (pressureCase === "fatigue_collapse") return "Fatigue Abandonment";
  if (pressureCase === "action_addiction") return "Action Addiction";
  if (pressureCase === "fear_response") return "Fear Response";
  if (pressureCase === "urgency_collapse") return "Urgency Collapse";
  return "Panic Action";
}

function pressureHabitLabel(pressureCase: PressureCase) {
  if (pressureCase === "ego_pull") {
    return "Stops trusting the position when the opponent fights back";
  }
  if (pressureCase === "panic_tempo" || pressureCase === "missed_entry") {
    return "Rushes the next decision after the first entry fails";
  }
  if (pressureCase === "got_hit") {
    return "Trades position for payback after getting touched";
  }
  if (pressureCase === "fatigue_collapse") {
    return "Drops the correction when tired";
  }
  if (pressureCase === "fear_response") {
    return "Lets risk delay the correct action";
  }
  if (pressureCase === "action_addiction") {
    return "Manufactures action when stillness feels uncomfortable";
  }
  if (pressureCase === "crowd_pressure") {
    return "Performs for the room instead of holding the plan";
  }
  return "Leaves the correction when pressure shows up";
}

function buildPressureLeakAnswer(args: {
  leak: PressureLeak;
  trigger: string;
  consequence: string;
  directive: string;
  camp?: string;
  memory?: SenseiMemory;
  habitLabel?: string;
  connected?: SenseiConnected;
}) {
  const memoryLine = args.habitLabel && args.memory
    ? memoryPatternLine(args.memory, args.habitLabel)
    : "";
  const behaviorLine = args.memory
    ? strongestMemoryLine(args.memory, "repeatedBehaviors")
    : "";
  const rememberedLine = memoryLine || behaviorLine;

  if (args.leak === "Ego Exchange") {
    if (/taunt|provocation|words/i.test(args.trigger)) {
      if (!rememberedLine) {
        return pressureCommand(
          "He wanted a reaction. He got one.",
          "What bothered you more: getting stopped or getting mocked?",
          `Know that. ${styleReturnLine(args.connected)}`
        );
      }

      return pressureCommand(
        "He wanted a reaction.",
        "You gave his words the next decision.",
        rememberedLine,
        "You stopped solving the position and started solving the disrespect.",
        "No revenge.",
        styleReturnLine(args.connected)
      );
    }

    if (!rememberedLine) {
      return pressureCommand(
        "He fought back. You reacted.",
        "Did that feel like losing?",
        `Know that. ${styleBasedCommand(args.connected, "Position first.")}`
      );
    }

    return pressureCommand(
      "He fought back.",
      "You left the position.",
      rememberedLine,
      "You stop wrestling and start chasing.",
      "Position first.",
      styleReturnLine(args.connected)
    );
  }

  if (args.leak === "Action Addiction") {
    if (!rememberedLine) {
      return pressureCommand(
        "Nothing was there. You still moved.",
        "Did stillness feel like losing?",
        "Earn the finish."
      );
    }

    return pressureCommand(
      "Nothing was there.",
      "You attacked anyway.",
      rememberedLine,
      "Wait for the reaction.",
      "Earn the finish."
    );
  }

  if (args.leak === "Panic Action") {
    if (!rememberedLine) {
      return pressureCommand(
        "The first miss changed your tempo.",
        "Did getting stopped make you rush?",
        "Stay there."
      );
    }

    return pressureCommand(
      "The first miss changed your tempo.",
      "You rushed the next decision.",
      rememberedLine,
      "Slow down.",
      "Stay there."
    );
  }

  if (args.leak === "Revenge Exchange") {
    if (!rememberedLine) {
      return pressureCommand(
        "He touched you. You wanted it back.",
        "Did payback come before position?",
        "Then wrestle."
      );
    }

    return pressureCommand(
      "He touched you.",
      "You tried to answer before you rebuilt.",
      rememberedLine,
      "You trade position for payback.",
      "Guard first.",
      "Then wrestle."
    );
  }

  if (args.leak === "Fear Response") {
    if (!rememberedLine) {
      return pressureCommand(
        "The opening was there. You waited.",
        "Did risk make you ask twice?",
        "Take the position."
      );
    }

    return pressureCommand(
      "The opening was there.",
      "You waited.",
      rememberedLine,
      "Take the position.",
      "Do not ask twice."
    );
  }

  if (args.leak === "Fatigue Abandonment") {
    if (!rememberedLine) {
      return pressureCommand(
        "You got tired. The standard moved.",
        "Did fatigue make ugly work acceptable?",
        "Do not leave."
      );
    }

    return pressureCommand(
      "You got tired.",
      "Your standard dropped.",
      rememberedLine,
      "Slow the rep.",
      "Do not leave."
    );
  }

  if (!rememberedLine) {
    return pressureCommand(
      "The pressure showed up. You left the answer.",
      "Was it discomfort or urgency?",
      "Win the position."
    );
  }

  return pressureCommand(
    "The pressure showed up.",
    "You left the answer.",
    rememberedLine,
    "Win the position.",
    "Again."
  );
}

function finalPressureCommand(correction: string, fallback: string) {
  const normalized = correction.toLowerCase();

  if (normalized.includes("head") && normalized.includes("outside")) {
    return "Win the position.";
  }

  if (correction && correction !== "the correction") {
    return memorableCommand(correction, "Position first.");
  }

  return fallback;
}

function inferPressureCase(message: string): PressureCase {
  const q = message.toLowerCase();

  if (
    includesAny(q, [
      "time running out",
      "clock",
      "last minute",
      "last seconds",
      "down on points",
      "behind on points",
      "needed to score",
      "forced action",
      "rushed because time",
    ])
  ) {
    return "urgency_collapse";
  }

  if (
    includesAny(q, [
      "afraid",
      "scared",
      "fear",
      "hesitated",
      "hesitate",
      "didn't pull the trigger",
      "would not shoot",
      "wouldn't shoot",
      "froze",
    ])
  ) {
    return "fear_response";
  }

  if (
    includesAny(q, [
      "forced to attack",
      "need to attack",
      "always attacking",
      "can't stop attacking",
      "cannot stop attacking",
      "action addiction",
      "i keep forcing",
      "forced the attack",
      "attacked just to attack",
    ])
  ) {
    return "action_addiction";
  }

  if (
    includesAny(q, [
      "taunts me",
      "taunts",
      "taunt",
      "taunted me",
      "he taunts",
      "trash talk",
      "trash talked",
      "talks trash",
      "talking trash",
      "mocking",
      "mocked",
      "mocked me",
      "disrespect",
      "disrespected",
      "disrespected me",
      "gets in my head",
      "get into my head",
      "letting my opponent get into my head",
    ])
  ) {
    return "taunt_rush";
  }

  if (
    includesAny(q, [
      "missed my first shot",
      "missed first shot",
      "first shot",
      "missed shot",
      "missed entry",
      "failed shot",
      "failed entry",
      "miss takedowns",
      "miss a takedown",
      "missed takedown",
      "missed takedowns",
      "stuffed",
      "sprawled on",
    ])
  ) {
    if (
      includesAny(q, [
        "rushing",
        "rushed",
        "rush",
        "panic",
        "panicked",
        "speed",
      ])
    ) {
      return "panic_tempo";
    }

    return "missed_entry";
  }

  if (
    includesAny(q, [
      "started rushing",
      "rushing entries",
      "rushed entries",
      "so i rush",
      "i rush",
      "rushed",
      "panicked",
      "panic",
    ])
  ) {
    return "panic_tempo";
  }

  if (
    includesAny(q, [
      "got hit",
      "got clipped",
      "countered me",
      "started swinging",
      "swinging back",
    ])
  ) {
    return "got_hit";
  }

  if (
    includesAny(q, [
      "trash talk",
      "trash talked",
      "wanted revenge",
      "prove myself",
      "wanted to prove",
      "taunts me",
      "taunts",
      "taunt",
      "he taunts",
      "opponent get into my head",
      "gets into my head",
      "get into my head",
      "in my head",
      "head games",
      "mental game",
      "mentally",
      "ego",
      "pride",
      "anger",
      "angry",
      "mad",
      "emotional",
      "emotion",
      "emotions",
      "confidence",
      "lose confidence",
      "lost confidence",
      "doubt",
      "self doubt",
    ])
  ) {
    return "ego_pull";
  }

  if (
    includesAny(q, [
      "fear",
      "scared",
      "afraid",
      "nervous",
      "anxiety",
      "anxious",
      "panic",
      "panicked",
      "composure",
      "lose composure",
      "lost composure",
      "calm down",
      "stay calm",
      "emotional control",
      "control my emotions",
    ])
  ) {
    return "panic_tempo";
  }

  if (includesAny(q, ["everyone was watching", "people watching", "crowd"])) {
    return "crowd_pressure";
  }

  if (
    includesAny(q, [
      "gassed",
      "gas out",
      "fatigue",
      "exhausted",
      "breathing heavy",
      "legs heavy",
    ])
  ) {
    return "fatigue_collapse";
  }

  return "unknown";
}

function pressureStateFromProgress(progress: DirectiveProgress) {
  const proofVerified =
    progress.repsCompleted >= progress.repsRequired &&
    progress.underResistance === true &&
    (progress.proofType === "image" ||
      progress.proofType === "video" ||
      progress.proofType === "metrics");

  if (!progress.underResistance || progress.repeatedFailureCount >= 2) {
    return "LOCK" as const;
  }

  if (proofVerified) return "LIVE" as const;

  return "LIVE" as const;
}

function messageWantsCompetitiveWrestling(message: string) {
  const q = message.toLowerCase();
  return (
    hasWord(q, "wrestle") ||
    hasWord(q, "wrestling") ||
    q.includes("competitive wrestling") ||
    q.includes("wrestle competitively")
  );
}

function correctionCategory(correction: string) {
  const c = correction.toLowerCase();

  if (
    includesAny(c, [
      "hip",
      "hips",
      "entry",
      "shot",
      "snap",
      "knee",
      "sprawl",
      "penetration",
      "level",
    ])
  ) {
    return "wrestling_entry";
  }

  if (
    includesAny(c, [
      "jab",
      "cross",
      "guard",
      "lead hand",
      "rear hand",
      "chin",
      "counter",
      "punch",
      "kick",
    ])
  ) {
    return "striking_defense";
  }

  if (
    includesAny(c, [
      "panic",
      "pressure",
      "pace",
      "gas",
      "fatigue",
      "shell",
      "freeze",
    ])
  ) {
    return "pressure_response";
  }

  if (
    includesAny(c, [
      "scramble",
      "underhook",
      "body lock",
      "clinch",
      "head position",
      "wall",
    ])
  ) {
    return "grappling_position";
  }

  return "general";
}

function scoreGymForUser(args: {
  gym: SenseiGym;
  message: string;
  activeCorrection: string;
  connected: SenseiConnected;
}) {
  const { gym, message, activeCorrection, connected } = args;

  let score =
    typeof gym.compatibility === "number" && Number.isFinite(gym.compatibility)
      ? gym.compatibility
      : 0;

  const gymText = [
    gym.name,
    gym.location,
    ...(gym.disciplineMatch || []),
    ...(gym.styleMatch || []),
    ...(gym.watchOut || []),
  ]
    .join(" ")
    .toLowerCase();

  const profile = connected.profile;
  const baseArt = cleanText(profile?.baseArt).toLowerCase();
  const paceStyle = cleanText(profile?.paceStyle).toLowerCase();
  const weaknesses = cleanText(profile?.weaknesses).toLowerCase();
  const preferredStyle = cleanText(profile?.preferredStyle).toLowerCase();
  const avoidedStyle = cleanText(profile?.avoidedStyle).toLowerCase();
  const goal = cleanText(profile?.goal).toLowerCase();
  const experience = cleanText(profile?.experienceLevel).toLowerCase();

  const wantsWrestling = messageWantsCompetitiveWrestling(message);
  const category = correctionCategory(activeCorrection);

  if (wantsWrestling || goal.includes("wrest")) {
    if (gymText.includes("wrestling")) score += 24;
    if (gymText.includes("grappling")) score += 12;
    if (gymText.includes("mma")) score += 6;
    if (gymText.includes("striking") && !gymText.includes("wrestling")) {
      score -= 8;
    }
  }

  if (baseArt.includes("wrest") && gymText.includes("wrestling")) score += 16;
  if (baseArt.includes("mma") && gymText.includes("mma")) score += 10;
  if (baseArt.includes("boxing") && gymText.includes("striking")) score += 8;
  if (baseArt.includes("bjj") && gymText.includes("grappling")) score += 10;

  if (category === "wrestling_entry") {
    if (gymText.includes("wrestling")) score += 22;
    if (gymText.includes("entry punishment")) score += 20;
    if (gymText.includes("wrestling exposure")) score += 16;
    if (gymText.includes("pressure room")) score += 12;
    if (gymText.includes("grappling resistance")) score += 10;
    if (gymText.includes("familiar option")) score -= 10;
  }

  if (category === "striking_defense") {
    if (gymText.includes("striking")) score += 18;
    if (gymText.includes("mma")) score += 8;
    if (gymText.includes("wrestling") && !gymText.includes("striking")) {
      score -= 6;
    }
  }

  if (category === "pressure_response") {
    if (gymText.includes("pressure")) score += 18;
    if (gymText.includes("pace punishment")) score += 16;
    if (gymText.includes("competitive room")) score += 10;
  }

  if (category === "grappling_position") {
    if (gymText.includes("grappling")) score += 16;
    if (gymText.includes("wrestling")) score += 12;
    if (gymText.includes("mma")) score += 8;
  }

  if (weaknesses) {
    if (weaknesses.includes("entry") && gymText.includes("entry")) score += 18;
    if (weaknesses.includes("hips") && gymText.includes("wrestling")) {
      score += 14;
    }
    if (weaknesses.includes("pace") && gymText.includes("pace")) score += 14;
    if (weaknesses.includes("pressure") && gymText.includes("pressure")) {
      score += 14;
    }
    if (weaknesses.includes("grip") && gymText.includes("grappling")) {
      score += 10;
    }
    if (weaknesses.includes("confidence") && gymText.includes("pressure")) {
      score += 10;
    }
  }

  if (paceStyle.includes("high") || paceStyle.includes("pressure")) {
    if (gymText.includes("pressure")) score += 12;
    if (gymText.includes("pace")) score += 10;
  }

  if (preferredStyle && gymText.includes(preferredStyle)) score += 6;
  if (avoidedStyle && gymText.includes(avoidedStyle)) score += 10;

  if (experience.includes("beginner")) {
    if (gymText.includes("coaching")) score += 10;
    if (gymText.includes("pressure room")) score += 4;
  }

  if (
    gymText.includes("familiar option") ||
    gymText.includes("comfort") ||
    gymText.includes("easier")
  ) {
    score -= 12;
  }

  return score;
}

function buildGymWhy(args: {
  connected: SenseiConnected;
  message: string;
  activeCorrection: string;
  pick: SenseiGym;
  usedFallback: boolean;
}) {
  const { connected, message, activeCorrection, pick, usedFallback } = args;

  const goal = cleanText(connected.profile?.goal);
  const weaknesses = cleanText(connected.profile?.weaknesses);
  const wantsWrestling = messageWantsCompetitiveWrestling(message);
  const pickText = [
    pick.name,
    ...(pick.disciplineMatch || []),
    ...(pick.styleMatch || []),
  ]
    .join(" ")
    .toLowerCase();

  const opening =
    wantsWrestling || goal
      ? `You want ${goal || "competitive wrestling"}.`
      : "This is the honest call.";

  const flaw = activeCorrection
    ? `Your current break is ${activeCorrection}.`
    : weaknesses
      ? `Your weak point is ${weaknesses}.`
      : "Your weak point needs pressure, not comfort.";

  const room = pickText.includes("wrestling")
    ? "Late hips, lazy steps, and weak entries should show up fast there."
    : "The room should expose whether the flaw survives real resistance.";

  const consequence = "If you are late, better grapplers will make you feel it.";

  const fallback = usedFallback
    ? "No custom gym table is loaded, so this is judged from the Dubai shortlist."
    : "This is based on your loaded gym data.";

  return [opening, flaw, room, consequence, fallback].join(" ");
}

function buildGymDecision(args: {
  message: string;
  connected: SenseiConnected;
  activeCorrection: string;
}) {
  const loadedGyms = Array.isArray(args.connected.gyms)
    ? args.connected.gyms
    : [];

  const gyms = loadedGyms.length ? loadedGyms : DUBAI_FALLBACK_GYMS;
  const usedFallback = loadedGyms.length === 0;

  const ranked = [...gyms].sort((a, b) => {
    const av = scoreGymForUser({
      gym: a,
      message: args.message,
      activeCorrection: args.activeCorrection,
      connected: args.connected,
    });

    const bv = scoreGymForUser({
      gym: b,
      message: args.message,
      activeCorrection: args.activeCorrection,
      connected: args.connected,
    });

    return bv - av;
  });

  const pick = ranked[0];
  const name = cleanText(pick.name) || "Dagestan Top Team Dubai";
  const location = cleanText(pick.location);

  const why = buildGymWhy({
    connected: args.connected,
    message: args.message,
    activeCorrection: args.activeCorrection,
    pick,
    usedFallback,
  });

  return formatAnswer({
    decision: `Pick ${name}.`,
    why: [why, location ? `Address: ${location}.` : ""]
      .filter(Boolean)
      .join(" "),
    fixes:
      "It stops you choosing the clean, easy, familiar room. You need the room where the mistake gets punished quickly.",
    ignored: "You will pick comfort and keep the same flaw alive.",
    instruction:
      "Test it for one week. Judge only live wrestling resistance, coaching quality, and whether better grapplers punish your entry. If those three are missing, leave.",
  });
}

function strictFuelDecision(args: {
  message: string;
  connected: SenseiConnected;
  activeCorrection: string;
  progress: DirectiveProgress;
}) {
  const q = args.message.toLowerCase();
  const directive = args.activeCorrection || "the current correction";
  const operating = buildOperatingDecision({
    connected: args.connected,
    activeCorrection: args.activeCorrection,
    fixNextRep: cleanText(args.connected.vision?.fix_next_rep),
    progress: args.progress,
  });

  if (operating.action === "TECHNICAL_ONLY") {
    return formatAnswer({
      decision: `Recovery status is ${operating.readiness}. Do not pressure test today.`,
      why: operating.reason,
      fixes: `Keep the technical target: ${operating.sessionGoal}.`,
      ignored: "Hard rounds will turn fatigue into false correction data.",
      instruction: `${operating.drill}. No hard rounds. Stop on the first cue break.`,
    });
  }

  if (operating.action === "RETAIN") {
    return pressureCommand(
      campLabel(args.connected),
      "Fuel supports retention, not complexity.",
      `Keep ${operating.correction}.`,
      "No new corrections.",
      operating.drill
    );
  }

  const isPreTraining = includesAny(q, [
    "before training",
    "before wrestling",
    "before sparring",
    "pre training",
    "pre-training",
    "eat before",
    "what should i eat",
  ]);

  const isGreasy = includesAny(q, [
    "shawarma",
    "fries",
    "burger",
    "pizza",
    "fried",
    "fast food",
    "junk",
    "greasy",
  ]);

  const isLowEnergy = includesAny(q, [
        "low energy",
    "flat",
    "weak",
    "tired",
    "no energy",
    "heavy",
    "sluggish",
  ]);

  if (isPreTraining && isGreasy) {
    return formatAnswer({
      decision: "Do not take greasy fuel into wrestling.",
      why:
        "Shawarma and fries may give calories, but the fat load slows digestion. In wrestling, that shows up on the second and third entry: slower level change, heavier hips, weaker re-shot.",
      fixes:
        "It protects repeated entries, hip recovery, and breathing rhythm. The goal is not fullness. The goal is fast usable fuel.",
      ignored:
        "You may feel full, hit one decent first effort, then fade when chain wrestling starts.",
      instruction:
        "90–150 minutes before training: simple carb + lean protein + water + salt. Example: rice, banana, bread, potato, or oats with chicken, turkey, eggs, or yogurt. Keep fat low. Save greasy food for after training.",
    });
  }

  if (isPreTraining) {
    return formatAnswer({
      decision: "Fuel the repeat entries, not just the first burst.",
      why:
        "For wrestling, the fuel target is repeated level changes, grip fighting, and re-shots. Heavy meals slow the hips. No fuel makes the second effort disappear.",
      fixes:
        `It keeps ${directive} alive after the first failed attempt, when most sloppy entries begin.`,
      ignored:
        "You will blame cardio when the real issue is bad timing and bad fuel.",
      instruction:
        "90–150 minutes before: carb base + lean protein. 30–45 minutes before: only light carb if needed. Water plus salt or electrolytes. No heavy fat before live rounds.",
    });
  }

  if (isGreasy) {
    return formatAnswer({
      decision: "Move greasy calories after the session.",
      why:
        "Greasy food before training delays digestion and makes wrestling feel heavier. It does not support clean repeat shots.",
      fixes:
        "It separates calorie intake from performance fuel. Eating enough is not the same as fueling correctly.",
      ignored:
        "You will enter rounds with food sitting in your stomach and call it bad cardio.",
      instruction:
        "Before training: clean carb, lean protein, water, salt. After training: bigger meal if needed. If you eat shawarma, skip fries before training.",
    });
  }

  if (isLowEnergy) {
    return formatAnswer({
      decision: "Add fast fuel before you add intensity.",
      why:
        "Low energy changes decision-making. You shoot late, accept bad grips, and rush resets because the body does not want another exchange.",
      fixes:
        `It keeps ${directive} technical instead of turning it into survival reps.`,
      ignored:
        "You will mistake under-fueling for weak discipline.",
      instruction:
        "Take a light carb source, water, and salt. Start with technical reps. Do not go live until foot speed and stance feel awake.",
    });
  }

  if (!args.connected.fuel?.present) {
    return formatAnswer({
      decision: "Keep the session technical until Fuel is logged.",
      why:
        "Fuel is missing, so Sensei cannot judge whether you can absorb volume. Unknown fuel means unknown repeat-output.",
      fixes:
        "It stops you using intensity when readiness is unproven.",
      ignored:
        "You may turn a correction session into fatigue practice and blame technique.",
      instruction:
        "Log Fuel first. Until then: low-volume technical reps, no conditioning finish, no hard ego rounds.",
    });
  }

  const score = args.connected.fuel.score ?? 0;
  const rating = args.connected.fuel.rating || "unknown";

  if (score < 50 || rating === "TRASH") {
    return formatAnswer({
      decision: "Cut volume. Keep only clean proof reps.",
      why:
        `Fuel score is ${score}. Rating is ${rating}. That does not support hard wrestling volume or repeated high-quality entries.`,
      fixes:
        `It protects ${directive} from breaking under low readiness.`,
      ignored:
        "You will confuse tired mechanics with technical failure.",
      instruction:
        "Warm up longer. Run clean reps only. No hard sparring. Stop the moment stance, breath, or hips degrade.",
    });
  }

  return approval(
    "Correct.",
    "Fuel is usable.",
    `Spend it on ${directive}.`,
    "Add volume only if the cue holds."
  );
}

function strictRecoveryDecision(args: {
  message: string;
  connected: SenseiConnected;
  activeCorrection: string;
  fixNextRep: string;
  progress: DirectiveProgress;
}) {
  const q = args.message.toLowerCase();
  const operating = buildOperatingDecision(args);

  if (operating.readiness === "RED") {
    return formatAnswer({
      decision: "Do not pressure test today.",
      why: operating.reason,
      fixes: "Keep the reps clean while the body is not ready for resistance.",
      ignored: "Tired reps become bad reps, and the old habit comes back.",
      instruction: `${operating.drill}. Focus on ${operating.sessionGoal}. No hard rounds.`,
    });
  }

  if (operating.action === "RETAIN") {
    return pressureCommand(
      campLabel(args.connected),
      "Retain. Do not expand.",
      `Current correction: ${operating.correction}.`,
      `Drill: ${operating.drill}.`,
      "No new complexity."
    );
  }

  const sleptPoorly = includesAny(q, [
    "slept 5 hours",
    "5 hours",
    "4 hours",
    "bad sleep",
    "barely slept",
    "couldn't sleep",
    "woke up tired",
  ]);

  const drained = includesAny(q, [
    "drained",
    "exhausted",
    "fried",
    "cns",
    "dead",
    "heavy legs",
    "legs heavy",
    "no pop",
    "slow",
  ]);

  const soreOrPain = includesAny(q, [
    "sore",
    "pain",
    "hurts",
    "knee",
    "back",
    "neck",
    "shoulder",
    "injury",
    "injured",
  ]);

  if (sleptPoorly) {
    return formatAnswer({
      decision: "Lower the session ceiling. Do not chase live intensity.",
      why:
        "Four hours of sleep changes decisions before you feel it. In wrestling, that means late entries, rushed resets, and lazy hip recovery.",
      fixes:
        "It protects the position and keeps the reps clean.",
      ignored:
        "You will go back to the old habit and call it hard work.",
      instruction:
        "Warm up until foot speed improves. Do positional drilling, hand-fighting, stance motion, and clean entries. No hard sparring unless movement sharpens. No conditioning finisher.",
    });
  }

  if (drained) {
    return formatAnswer({
      decision: "Remove intensity before it corrupts the correction.",
      why:
        "A drained nervous system turns wrestling into survival. Your shots become late, your hips stay back, and your resets get emotional.",
      fixes:
        "It stops tired reps from being counted as progress.",
      ignored:
        "You will build bad reps and call it toughness.",
      instruction:
        "Do low-speed technical reps, mobility, light hand-fighting, and leave. Stop before form drops. Recovery is the work today.",
    });
  }

  if (soreOrPain) {
    return formatAnswer({
      decision: "Protect the joint. Train position, not chaos.",
      why:
        "Pain changes mechanics. You will subconsciously avoid positions, shorten entries, and compensate somewhere else.",
      fixes:
        "It stops one small issue from changing your whole movement pattern.",
      ignored:
        "You may protect the sore area and create a worse technical habit.",
      instruction:
        "No hard live rounds. Use controlled drilling, range-limited reps, and mobility. If pain changes your stance or entry, stop.",
    });
  }

  const hasFuel = args.connected.fuel?.present === true;
  const score = args.connected.fuel?.score ?? null;

  if (!hasFuel) {
    return formatAnswer({
      decision: "Do not increase load without readiness data.",
      why:
        "Readiness is unclear. A real coach does not add pressure when the body is unknown.",
      fixes:
        "It stops blind volume increases.",
      ignored:
        "You may train hard while the body is not ready, and the old habit will look like the truth.",
      instruction:
        "Keep today technical. Add Fuel before raising intensity. If movement sharpens after warm-up, add controlled resistance only.",
    });
  }

  if (typeof score === "number" && score < 55) {
    return formatAnswer({
      decision: "Technical session only.",
      why:
        `Fuel readiness is ${score}. That is not enough for hard wrestling volume. Low readiness makes the second and third effort sloppy.`,
      fixes:
        "It protects the position before fatigue pulls you back to the old habit.",
      ignored:
        "The same mistake will return once tired, and you will think the correction failed.",
      instruction:
        "Slow reps. Light-to-moderate resistance. No hard sparring. Stop when stance, breath, or hips degrade.",
    });
  }

  return approval(
    "Correct.",
    "Readiness is usable.",
    "Keep the correction central.",
    "Raise pace only if cue holds."
  );
}

function strictInjuryDecision(args: {
  message: string;
  connected: SenseiConnected;
  activeCorrection: string;
  fixNextRep: string;
  progress: DirectiveProgress;
}) {
  const q = args.message.toLowerCase();
  const operating = buildOperatingDecision(args);
  const bodyPart =
    ["knee", "ankle", "shoulder", "elbow", "wrist", "neck", "back"].find((part) =>
      hasWord(q, part)
    ) || "joint";

  const duringShots =
    q.includes("during shots") ||
    q.includes("when i shoot") ||
    q.includes("when shooting") ||
    q.includes("shot");

  return formatAnswer({
    decision: `${operating.correction} remains. The training pathway changes around the ${bodyPart}.`,
    why: duringShots
      ? "Pain during shots changes level change, foot plant, and hip position. That makes the entry dishonest and can turn one injury signal into a new technical flaw."
      : "Pain changes movement before the fighter admits it. Compensation turns training into bad data.",
    fixes: args.activeCorrection
      ? `It protects ${args.activeCorrection} from being trained around pain instead of corrected cleanly. Mission: ${operating.sessionGoal}.`
      : "It keeps the session from rewarding compensation.",
    ignored:
      "You may protect the painful side, shorten the entry, and build a worse habit while the joint gets more irritated.",
    instruction:
      `${operating.drill}. ${operating.pressureTest}. Show ${operating.proofNeeded}. ${operating.restrictions.join("; ") || "Stop any rep that changes mechanics"}. If pain is sharp, swelling, unstable, or worsening, stop and get medical evaluation.`,
  });
}

function strictWeightCutDecision(args: {
  message: string;
  activeCorrection: string;
}) {
  const q = args.message.toLowerCase();
  const mentionsDehydration = includesAny(q, [
    "dehydrate",
    "dehydrated",
    "sauna",
    "sweat out",
    "water load",
    "water loading",
  ]);

  if (mentionsDehydration) {
    return formatAnswer({
      decision: "Do not trade brain speed for the scale.",
      why:
        "Dehydration hurts reaction time, grip patience, and decision-making. In fight camp, that makes every correction harder to execute under pressure.",
      fixes: args.activeCorrection
        ? `It protects ${args.activeCorrection} from collapsing because the body is flat and late.`
        : "It keeps the cut from damaging training quality.",
      ignored:
        "You may make the number and arrive with worse timing, worse chin safety, and worse recovery.",
      instruction:
        "Use a qualified coach or clinician for any real cut. Keep training technical while cutting. Do not add hard sparring when hydration is compromised.",
    });
  }

  return formatAnswer({
    decision: "Treat weight cut as readiness, not discipline theater.",
    why:
      "Making weight matters, but the cut cannot steal the work that wins rounds. Low fuel and low fluid make clean mechanics unstable.",
    fixes: args.activeCorrection
      ? `It keeps ${args.activeCorrection} measurable while body weight is moving.`
      : "It separates body-weight management from random suffering.",
    ignored:
      "You will confuse cut fatigue with technical failure and make bad training decisions.",
    instruction:
      "Keep protein steady, time carbs around training, monitor hydration, and reduce session load when weight-cut stress rises. No extreme cut without supervision.",
  });
}

function strictProofDecision(args: {
  message?: string;
  activeCorrection: string;
  progress: DirectiveProgress;
}) {
  if (!args.activeCorrection) return fallbackNoDirective();

  const q = String(args.message || "").toLowerCase();
  const outcomeClaim = includesAny(q, [
    "won",
    "beat him",
    "beat a better",
    "finished",
    "scored",
    "got the takedown",
    "landed",
    "submitted",
    "knocked",
  ]);

  const verified =
    args.progress.repsCompleted >= args.progress.repsRequired &&
    args.progress.underResistance === true &&
    (args.progress.proofType === "image" ||
      args.progress.proofType === "video" ||
      args.progress.proofType === "metrics");

  if (verified) {
    return approval(
      "Proof accepted.",
      `${args.progress.repsCompleted}/${args.progress.repsRequired} correction reps survived under resistance.`,
      "Process is verified.",
      "Load the next correction."
    );
  }

  if (outcomeClaim) {
    return proofDemand(
      "Outcome is not proof.",
      "Winning the exchange can hide a broken decision.",
      `Show ${args.activeCorrection} surviving under resistance.`,
      `${args.progress.repsCompleted}/${args.progress.repsRequired} accepted reps logged.`,
      "Upload image, video, or metrics proof."
    );
  }

  return proofDemand(
    "Proof is not complete.",
    `${args.progress.repsCompleted}/${args.progress.repsRequired} reps logged.`,
    `Count only reps where ${args.activeCorrection} survives.`,
    "Proof must be image, video, or metrics.",
    "Return with accepted proof before unlock."
  );
}

function strictProgressionDecision(args: {
  connected: SenseiConnected;
  activeCorrection: string;
  progress: DirectiveProgress;
  lockMessage?: string;
}) {
  if (!args.activeCorrection) return fallbackNoDirective();
  const avoidedCorrection = strongestMemory(args.connected.memory || normalizeSenseiMemory({}), "avoidedCorrections");
  const refusedProgression = strongestMemory(args.connected.memory || normalizeSenseiMemory({}), "refusedProgressionAttempts");
  const progressionPattern =
    (avoidedCorrection && avoidedCorrection.count > 1) ||
    (refusedProgression && refusedProgression.count > 1)
      ? "You keep asking for a new answer when the old one gets hard."
      : "";

  const operating = buildOperatingDecision({
    connected: args.connected,
    activeCorrection: args.activeCorrection,
    fixNextRep: cleanText(args.connected.vision?.fix_next_rep),
    progress: args.progress,
  });

  if (operating.pathwayAdjusted) {
    return proofDemand(
      "No progression through adapted proof.",
      operating.adjustmentReason || "An active restriction changes the training pathway.",
      `${operating.correction} remains active.`,
      `Safe proof today: ${operating.proofNeeded}.`,
      "Clear the restriction, then complete standard proof before unlock."
    );
  }

  if (operating.readiness === "RED") {
    return proofDemand(
      "No expansion today.",
      operating.reason,
      `Keep ${operating.correction}.`,
      `Drill: ${operating.drill}.`,
      "No pressure test. No new correction."
    );
  }

  const phase = campWindow(args.connected);
  if (phase === "FIGHT_WEEK" || phase === "PRESSURE_TEST") {
    return proofDemand(
      campLabel(args.connected),
      "No new techniques.",
      `Keep ${args.activeCorrection} locked.`,
      "Pressure test it under fight pace.",
      "Proof is correction survival, not novelty."
    );
  }

  if (operating.action === "UNLOCK_NEXT_LAYER") {
    return approval(
      "Unlock approved.",
      `${operating.correction} is retained.`,
      "Load one next-layer correction.",
      `Increase resistance while retaining ${operating.correction}.`
    );
  }

  const verified =
    args.progress.repsCompleted >= args.progress.repsRequired &&
    args.progress.underResistance === true &&
    (args.progress.proofType === "image" ||
      args.progress.proofType === "video" ||
      args.progress.proofType === "metrics");

  if (verified) {
    return approval(
      "Unlock approved.",
      "The correction is proven under resistance.",
      "Move to the next layer.",
      "Keep the old cue warm in live rounds."
    );
  }

  return formatAnswer({
    decision: "No unlock yet.",
    why:
      progressionPattern ||
      args.lockMessage ||
      `${args.activeCorrection} is still unverified. New layers before proof create camp drift.`,
    fixes:
      "It forces the current mistake to become observable, repeatable, and corrected under resistance.",
    ignored:
      "You will add a new correction while the old flaw is still available to opponents.",
    instruction: `Complete ${args.progress.repsRequired} clean proof reps under resistance. Upload image, video, or metrics proof. Then ask for the next correction.`,
  });
}

function strictSystemNavigationDecision(args: { message: string }) {
  const q = args.message.toLowerCase();

  if (wantsGymDecision(q)) {
    return "Open Decisions. Use the gym card. Choose the room that exposes the current flaw fastest.";
  }

  if (q.includes("fuel")) {
    return "Open Fuel. Log the meal, hydration, and readiness before asking for session load.";
  }

  if (q.includes("recovery")) {
    return "Open Recovery. Log sleep, soreness, and readiness before raising intensity.";
  }

  if (q.includes("vision")) {
    return "Open Vision. Upload the frame or clip. Sensei needs one visible correction before enforcing camp focus.";
  }

  return "Use the command dock for decisions. Use Vision for corrections, Fuel for readiness, Recovery for load, and Decisions for gym or camp choices.";
}

function strictTrainingDecision(args: {
  message: string;
  connected: SenseiConnected;
  activeCorrection: string;
  fixNextRep: string;
  progress: DirectiveProgress;
}) {
  if (!args.activeCorrection) return fallbackNoDirective();

  const q = args.message.toLowerCase();
  const tacticalConcept = inferTacticalConcept(args.message);
  const sequence = forceSeeGo(args);
  const operating = buildOperatingDecision(args);
  const claimsProgress = includesAny(q, [
    "i fixed it",
    "fixed it",
    "i did it",
    "did it",
    "done",
    "finished",
    "completed",
    "i completed",
    "i got it",
    "can i unlock",
    "unlock now",
    "move on",
    "next correction",
  ]);

  if (claimsProgress) {
    return proofDemand(
      "Show process proof.",
      `${args.progress.repsCompleted}/${args.progress.repsRequired} reps logged.`,
      "The question is not whether you won.",
      `The question is whether ${args.activeCorrection} survived.`,
      "Upload accepted proof."
    );
  }

  const tacticalAnswer = tacticalChallenge(
    tacticalConcept,
    args.activeCorrection
  );
  if (tacticalAnswer) return tacticalAnswer;

  if (includesAny(q, ["what should i train", "train today", "next 45 minutes"])) {
    if (operating.action === "UNLOCK_NEXT_LAYER") {
      return approval(
        "Correction retained.",
        "Unlock the next layer.",
        `Increase resistance while keeping ${operating.correction}.`,
        operating.unlocksNext
      );
    }

    if (operating.action === "RETAIN") {
      return pressureCommand(
        campLabel(args.connected),
        "No new techniques.",
        `Retain ${operating.correction}.`,
        `FORCE: ${sequence.force}.`,
        `SEE: ${sequence.see}.`,
        `GO: ${sequence.go}.`
      );
    }

    if (operating.action === "TECHNICAL_ONLY") {
      return pressureCommand(
        `Recovery status: ${operating.readiness}.`,
        "Do not pressure test today.",
        `Drill: ${operating.drill}.`,
        `Focus: ${operating.sessionGoal}.`,
        "No hard rounds.",
        operating.restrictions[0] || "Stop on cue break."
      );
    }

    if (operating.action === "PRESSURE_TEST") {
      return pressureCommand(
        readinessLine(operating.readiness),
        `Test ${operating.correction} today.`,
        operating.drill,
        operating.pressureTest,
        `Show ${operating.proofNeeded}.`
      );
    }

    return fullDecision({
      decision: operating.reason,
      why: `The repeated issue is ${operating.correction}.`,
      fixes: operating.sessionGoal,
      ignored: "A session that ignores condition turns correction work into bad data.",
      instruction: `${operating.drill}. ${operating.proofNeeded}.`,
    });
  }

  if (includesAny(q, ["spar", "sparring"])) {
    return shortCorrection(
      "Spar only if the correction holds.",
      "Start controlled.",
      "Two cue breaks, stop sparring.",
      "Return to proof reps."
    );
  }

  if (
    includesAny(q, [
      "why do i keep",
      "why am i",
      "why does this happen",
      "why do they",
      "how do i stop",
      "how do i fix",
      "keep getting sprawled",
      "getting sprawled",
      "sprawled on",
      "stuffed",
      "countered",
      "opening",
      "bait",
      "trap",
      "overcommit",
      "chase",
    ])
  ) {
    return pressureCommand(
      "Wrong layer if you only ask technique.",
      "First ask who owned the opening.",
      "Did you create a reaction, or attack a stable opponent?",
      `FORCE: ${sequence.force}.`,
      `SEE: ${sequence.see}.`,
      `GO: ${sequence.go}.`
    );
  }

  return interruption(
    "Wrong question.",
    `Fix ${args.activeCorrection} first.`,
    args.fixNextRep || "Return to the current cue.",
    "Proof unlocks the next layer."
  );
}

function strictPressureDisciplineDecision(args: {
  message: string;
  connected: SenseiConnected;
  activeCorrection: string;
  fixNextRep: string;
  progress: DirectiveProgress;
  memory: SenseiMemory;
}) {
  if (isPsychologyFollowupAnswer(args.message)) {
    const pressureCard = buildPressureDisciplineCard({
      activeDirective: args.activeCorrection,
      latestVisionCorrection: args.activeCorrection,
      userMessage: args.message,
      repeatedFailureCount: args.progress.repeatedFailureCount,
      proofVerified: false,
      underResistance: args.progress.underResistance,
    });

    return {
      answer: buildPendingPsychologyAnswer({
        message: args.message,
        session: {},
        activeCorrection: args.activeCorrection,
        memory: args.memory,
        connected: args.connected,
      }),
      pressureCard,
      pressureLeak: "Ego Exchange" as PressureLeak,
    };
  }

  const pressureCase = inferPressureCase(args.message);
  const rawCorrection = args.activeCorrection || "the correction";
  const directive = correctionHandle(rawCorrection);
  const habitLabel = pressureHabitLabel(pressureCase);
  const state = pressureStateFromProgress(args.progress);
  const leak = pressureLeakFromCase(pressureCase);
  const sequence = forceSeeGo(args);
  const operating = buildOperatingDecision(args);
  const operatingLimit =
    operating.action === "TECHNICAL_ONLY"
      ? "No hard rounds"
      : operating.action === "RETAIN"
        ? "No new complexity"
        : `Show ${operating.proofNeeded}`;
  const campContext = pressureCampLine({
    connected: args.connected,
    directive,
    operating,
    operatingLimit,
    go: sequence.go,
  });

  let pressureCard: PressureDisciplineCard;
  let answer: string;

  if (isAnalysisModePrompt(args.message)) {
    pressureCard = buildPressureDisciplineCard({
      activeDirective: args.activeCorrection,
      latestVisionCorrection: args.activeCorrection,
      userMessage: args.message,
      repeatedFailureCount: args.progress.repeatedFailureCount,
      proofVerified: false,
      underResistance: args.progress.underResistance,
    });

    answer = buildPressureAnalysisAnswer({
      message: args.message,
      pressureCase,
      directive,
      memory: args.memory,
      habitLabel,
    });

    return { answer, pressureCard, pressureLeak: leak };
  }

  if (pressureCase === "urgency_collapse") {
    pressureCard = {
      present: true,
      trigger: "Clock pressure forced action.",
      risk: `Urgency makes you abandon ${directive} and attack time instead of position.`,
      stopCommand: "Do not let the clock choose the attack.",
      resetCue: "Score the next correct decision. Create reaction first.",
      ifIgnored:
        "You will force the opening, enter a trap, and call it urgency.",
      state,
      signal: "missed_entry",
    };

    answer = buildPressureLeakAnswer({
      camp: campContext,
      leak,
      trigger: "Time running out.",
      consequence: `Forces action before ${directive} is available.`,
      directive: "Do not chase the finish. Win the setup.",
      memory: args.memory,
      habitLabel,
      connected: args.connected,
    });

    return { answer, pressureCard, pressureLeak: leak };
  }

  if (pressureCase === "fear_response") {
    pressureCard = {
      present: true,
      trigger: "Risk made you avoid the correct action.",
      risk: `Fear protects comfort and leaves ${directive} unused.`,
      stopCommand: "Do not let fear veto the correct action.",
      resetCue: "Name the risk. Take the correct cue once.",
      ifIgnored:
        "You will avoid the right decision until the opponent owns the exchange.",
      state,
      signal: "ego_exchange",
    };

    answer = buildPressureLeakAnswer({
      camp: campContext,
      leak,
      trigger: "The correct action felt risky.",
      consequence: `Avoids ${directive} and gives control away.`,
      directive: "Calm first. Action second.",
      memory: args.memory,
      habitLabel,
      connected: args.connected,
    });

    return { answer, pressureCard, pressureLeak: leak };
  }

  if (pressureCase === "action_addiction") {
    pressureCard = {
      present: true,
      trigger: "Discomfort made you force activity.",
      risk: `Action addiction turns ${directive} into noise.`,
      stopCommand: "Do not attack just to feel active.",
      resetCue: "Hold position. Make him react. Then enter.",
      ifIgnored:
        "You will feed counters because stillness felt uncomfortable.",
      state,
      signal: "missed_entry",
    };

    answer = buildPressureLeakAnswer({
      camp: campContext,
      leak,
      trigger: "Stillness felt like losing.",
      consequence: `Forces attacks before ${directive} is available.`,
      directive: "Do not chase the finish. Win the setup.",
      memory: args.memory,
      habitLabel,
      connected: args.connected,
    });

    return { answer, pressureCard, pressureLeak: leak };
  }

  if (pressureCase === "taunt_rush") {
    pressureCard = {
      present: true,
      trigger: "Taunt after missed takedown.",
      risk: `His words make you rush, and ${directive} disappears.`,
      stopCommand: "Do not answer taunts with speed.",
      resetCue: "Blank face. Exhale. Rebuild stance. Snap, step deep.",
      ifIgnored:
        "He will not need to defend well. He will make you rush yourself out of position.",
      state,
      signal: "ego_exchange",
    };

    answer = buildPressureLeakAnswer({
      camp: campContext,
      leak,
      trigger: "Taunt after failed entry.",
      consequence: `${directive} disappears because you answer words with speed.`,
      directive: "Calm first. Action second.",
      memory: args.memory,
      habitLabel,
      connected: args.connected,
    });

    return { answer, pressureCard, pressureLeak: leak };
  }

  if (pressureCase === "missed_entry" || pressureCase === "panic_tempo") {
    pressureCard = {
      present: true,
      trigger: "Missed entry created panic tempo.",
      risk: `One failed shot becomes rushed entries, and ${directive} disappears.`,
      stopCommand: "Do not speed up after the first failed shot.",
      resetCue: "Exhale. Rebuild stance. Snap, step deep, hips under shoulders.",
      ifIgnored: "You will train the panic reaction instead of the correction.",
      state,
      signal: "missed_entry",
    };

    answer = buildPressureLeakAnswer({
      camp: campContext,
      leak,
      trigger: "Missed entry or discomfort.",
      consequence: `${directive} gets replaced by escape speed.`,
      directive: finalPressureCommand(
        rawCorrection,
        "Exhale. Rebuild stance. One clean re-entry."
      ),
      memory: args.memory,
      habitLabel,
      connected: args.connected,
    });

    return { answer, pressureCard, pressureLeak: leak };
  }

  if (pressureCase === "got_hit") {
    pressureCard = {
      present: true,
      trigger: "Got hit and tried to answer back.",
      risk: `Emotion replaces structure, and ${directive} disappears.`,
      stopCommand: "Do not answer damage with volume.",
      resetCue: "Guard returns first. Feet under you. Re-enter clean.",
      ifIgnored: "You will fight angry and give away clean mechanics.",
      state,
      signal: "got_hit",
    };

    answer = buildPressureLeakAnswer({
      camp: campContext,
      leak,
      trigger: "Got hit.",
      consequence: `${directive} gets abandoned for immediate revenge.`,
      directive: "Calm first. Action second.",
      memory: args.memory,
      habitLabel,
      connected: args.connected,
    });

    return { answer, pressureCard, pressureLeak: leak };
  }

  if (pressureCase === "ego_pull") {
    pressureCard = {
      present: true,
      trigger: "Provocation pulled you toward ego fighting.",
      risk: `You start fighting to prove something instead of holding ${directive}.`,
      stopCommand: "Do not fight to prove a point.",
      resetCue: "Face blank. Breath down. Return to the command.",
      ifIgnored: "The opponent controls your tempo before contact.",
      state,
      signal: "ego_exchange",
    };

    answer = buildPressureLeakAnswer({
      camp: campContext,
      leak,
      trigger: "Need to prove something.",
      consequence: `You fight his reaction instead of winning ${directive}.`,
      directive: finalPressureCommand(
        rawCorrection,
        "Face blank. Breathe down. Return to command."
      ),
      memory: args.memory,
      habitLabel,
      connected: args.connected,
    });

    return { answer, pressureCard, pressureLeak: leak };
  }
    if (pressureCase === "crowd_pressure") {
    pressureCard = {
      present: true,
      trigger: "People watching changed your behavior.",
      risk: `You perform for the room instead of holding ${directive}.`,
      stopCommand: "Do not perform for witnesses.",
      resetCue: "Eyes on target. Ignore the room. Execute the cue.",
      ifIgnored: "You will become performative and lose the plan.",
      state,
      signal: "crowd_pressure",
    };

    answer = buildPressureLeakAnswer({
      camp: campContext,
      leak,
      trigger: "People watching.",
      consequence: `Performance replaces ${directive}.`,
      directive: "Win the position. Ignore the room.",
      memory: args.memory,
      habitLabel,
      connected: args.connected,
    });

    return { answer, pressureCard, pressureLeak: leak };
  }

  if (pressureCase === "fatigue_collapse") {
    pressureCard = {
      present: true,
      trigger: "Fatigue made the correction collapse.",
      risk: `${directive} disappears when the body gets tired.`,
      stopCommand: "Do not add intensity when form breaks.",
      resetCue: "Slow the rep. Short breath. Clean position first.",
      ifIgnored: "You will mistake fatigue failure for technical failure.",
      state,
      signal: "fatigue_spike",
    };

    answer = buildPressureLeakAnswer({
      camp: campContext,
      leak,
      trigger: "Fatigue spike.",
      consequence: `${directive} disappears when tired and the rep becomes false proof.`,
      directive: "Fix the position. The finish will come.",
      memory: args.memory,
      habitLabel,
      connected: args.connected,
    });

    return { answer, pressureCard, pressureLeak: leak };
  }

  pressureCard = buildPressureDisciplineCard({
    activeDirective: args.activeCorrection,
    latestVisionCorrection: args.activeCorrection,
    userMessage: args.message,
    repeatedFailureCount: args.progress.repeatedFailureCount,
    proofVerified:
      args.progress.repsCompleted >= args.progress.repsRequired &&
      args.progress.underResistance === true &&
      (args.progress.proofType === "image" ||
        args.progress.proofType === "video" ||
        args.progress.proofType === "metrics"),
    underResistance: args.progress.underResistance,
  });

  answer = pressureCommand(
    campContext,
    "Do not take the mental exchange.",
    "Break eye contact.",
    "Breathe down.",
    "Return to command.",
    "No revenge exchange.",
    "If it came from trash talk, crowd, fatigue, damage, or fear, name it."
  );

  return { answer, pressureCard, pressureLeak: leak };
}

function overviewDecision(args: {
  activeCorrection: string;
  connected: SenseiConnected;
  progress: DirectiveProgress;
}) {
  return formatAnswer({
    decision: args.activeCorrection
      ? `The camp is locked on ${args.activeCorrection}.`
      : "Run Vision first.",
    why: args.activeCorrection
      ? "The system has one active technical problem. Everything else is support."
      : "There is no loaded correction.",
    fixes: "It stops the app becoming a motivation feed.",
    ignored: "You will collect information without changing behavior.",
    instruction: args.activeCorrection
      ? `Complete ${args.progress.repsRequired} verified reps under resistance before expanding scope.`
      : "Upload one Vision frame and load a correction.",
  });
}

function formatMemoryItems(memory: SenseiMemory | undefined, bucket: SenseiMemoryBucket) {
  const items = [...(memory?.[bucket] || [])]
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  if (!items.length) return "none";

  return items
    .map((item) => `${item.label} (${item.count}x, first ${item.firstSeen.slice(0, 10)})`)
    .join(" | ");
}

function buildSystemPrompt(args: {
  connected: SenseiConnected;
  activeCorrection: string;
  fixNextRep: string;
  intent: Intent;
  progress: DirectiveProgress;
}) {
  const gyms = args.connected.gyms?.length
    ? args.connected.gyms
    : DUBAI_FALLBACK_GYMS;
  const sequence = forceSeeGo(args);
  const phase = campWindow(args.connected);
  const operating = buildOperatingDecision(args);

  return `
You are Sensei inside Disciplin.

Voice:
- experienced corner coach
- calm
- disciplined
- practical
- slightly cold
- do not invent or infer the user's name
- do not repeat the user's name

Forbidden phrases:
- "not X, but Y"
- "it's not about"
- "your profile says"
- "the pressure matters because"
- "unlock your potential"
- "optimize"
- "confidence is key"
- "believe in yourself"
- "mindset"

Rules:
- Choose the response shape from the user's question.
- Use ANALYSIS MODE for post-session review, film review, why questions, and reflection.
- ANALYSIS MODE teaches causality: what happened, what caused it, what changed, what consequence followed, what happens next.
- Use COACHING MODE for training, sparring, competition, fatigue, and quick decisions.
- COACHING MODE is short, memorable, and command-based.
- Do not always use the same structure.
- Do not always use headings.
- Generate line by line.
- In coaching mode, do not explain when an observation is stronger.
- In analysis mode, explain causality without turning it into an essay.
- Never state only what the athlete already knows.
- Bad: "You got emotional." Better: "You reacted to being mocked, not to being stopped."
- Bad: "You slept badly." Better: "Four hours of sleep changes decisions before you feel it."
- Bad: "Your head left position." Better: "Your head leaves after the first defended shot."
- Every response should answer why it happened, why it happened there, what caused it, what pattern is emerging, and what happens next.
- Micro detail matters only when it changes the next decision.
- Never dump measurements.
- Turn biomechanical detail into coaching.
- Every technical detail must answer: what broke, why it keeps breaking, what to do next.
- Use the chain: micro detail -> pattern -> decision -> improvement.
- Prefer: what you saw, the habit, the decision, the command.
- For psychology, prefer: observation, one question, command.
- Never stack multiple long psychology questions.
- The response should sound like ten seconds between rounds.
- The coach has watched thousands of this fighter's reps.
- Identify habits before the fighter notices them.
- The final line must be a mat command the fighter can remember mid-round.
- Every line must correct, deny, approve, or command.
- Every line must be observable, technical, or enforceable.
- No vague advice.
- No hype.
- No therapy language.
- No self-help language.
- No motivational speeches.
- No essays.
- No documentation tone.
- No chatbot language.
- Short sentences.
- Every extra sentence reduces impact.
- Answer the exact prompt, not a generic model answer.
- If the user describes panic, rushing, taunts, trash talk, ego, crowd pressure, getting hit, fatigue collapse, or missed entries, answer as pressure discipline.
- Sensei is a decision engine, not a chatbot.
- Identify the broken decision.
- Issue the next decision.
- Demand proof when progress is claimed.
- Track progression through correction survival, not outcome.
- Answer the user's category first. The active correction may influence the answer, but it must not replace the answer.
- Read camp context before judging the question.
- Never answer as if this is an isolated prompt.
- Mention camp context only when it changes the decision.

Camp rules:
- At 14 days out or less, deny new techniques.
- At 14 days out or less, pressure test the current correction lock.
- Repeated issues outrank novelty.
- Fuel state changes session load, not the technical target.
- Psychology answers must name the pressure leak first, then connect it to the current correction.
- Technical answers must use FORCE -> SEE -> GO.

Head coach allocation checklist:
1. What is the active correction?
2. Has this correction been retained, failed, or left unproven?
3. Can the current recovery, sleep, and weight-cut state support pressure?
4. Which pressure leak can break the correction?
5. Has process proof been earned under resistance?
6. Allocate the next session. Do not summarize the past.

Every decision must answer:
- What are we fixing?
- Why does it still matter?
- What is today's decision?
- What proof is required?
- What unlocks next?

Psychology rules:
- Psychology is decision breakdown under pressure, not therapy.
- Never use therapy language.
- Do not diagnose the athlete's inner state with certainty on the first signal.
- If memory does not support the pattern, investigate with one or two sharp questions.
- Strong statements require repeated pattern, athlete memory, or previous conversation support.
- Prefer: "What bothered you more: getting stopped or getting mocked?"
- Prefer one question, not a paragraph of questions.
- If the athlete answers a psychology question, continue that thread. Do not route back to technical advice.
- Psychology follow-ups must identify the emotional trigger, connect it to behavior, and give one command.
- Name the pressure leak when visible.
- Do not say "you got emotional" if the habit can be named.
- Say what pattern repeated.
- Say what standard dropped.
- Sound disappointed when the fighter leaves the answer, not angry.
- Valid pressure leaks: Revenge Exchange, Ego Exchange, Panic Action, Crowd Pressure, Fatigue Abandonment, Action Addiction, Fear Response, Urgency Collapse.
- Track Trigger, Pressure Leak, Technical Consequence, Directive.

Opening rules:
- Do not only judge technique.
- Ask whether the opening existed.
- Ask who created the opening.
- Ask whether the opening was bait.
- If the opening belonged to the opponent, do not attack the space. Attack the reason it exists.

Technical detail rules:
- Do not overwhelm the athlete with angles, measurements, or biomechanics.
- If mentioning a detail, translate it into a pattern.
- If naming a pattern, issue the next decision.
- If issuing a decision, give the next rep.
- Bad: "Your head angle is outside by X degrees."
- Good: "Your head leaves the ribs when resistance appears. Win head position first. Again."
- Vision can identify what happened. Sensei must turn it into what changes next.

Opponent intent rules:
- Reason about what the opponent is trying to make the fighter do.
- Common traps: chase, panic shoot, head hunt, overcommit, force urgency, enter a trap.
- If the opponent dictated the decision, say so.

Exchange ownership rules:
- Landing does not prove control.
- Scoring does not prove ownership.
- If the opponent forced the reaction, he owned the exchange.
- Separate result from decision quality.

Response modes:
- FULL_DECISION: use only when the user needs a complete ruling.
- SHORT_CORRECTION: use when the answer is obvious.
- INTERRUPTION: use when the user is chasing the wrong thing.
- PROOF_DEMAND: use when the user claims progress or unlock.
- PRESSURE_COMMAND: use for psychology, fear, anger, taunts, panic, ego, and composure.
- APPROVAL: use when the user is on the right path.
- REFUSAL: use when unlock or progression is denied.
- REDIRECT: use when the user is on the wrong layer.
- TACTICAL_CHALLENGE: use when the fighter must answer who owned the opening or exchange.

Line rules:
- Missing information must never replace the ruling.
- Ask for missing detail only after a useful command.
- If using a clarification, put it on the last line.
- Prefer two to five lines.
- Use the full Decision / Why / Fix / If ignored / Directive shape only for FULL_DECISION.
- Do not repeat the same response structure every time.
- The fighter should not be able to predict the structure before reading it.
- Every answer must make the fighter feel the question was understood, the pressure was identified, and the next decision is clear.

Authority rules:
- You are responsible for camp focus.
- New techniques are denied if the active correction is not proven.
- Do not negotiate with unfinished corrections.
- If a mistake is still appearing in rounds, deny requests for variety.
- Speak like a head coach protecting a fighter's next fight, not a tutor answering questions.
- If the fighter asks for a new skill while an active mistake remains unresolved, explain the cost to the camp.
- Use plain fight language. No abstract phrases.
- Explain consequences in rounds, sparring, competition, or camp time.

Proof rules:
- Proof measures whether the correction survived.
- Proof does not measure whether the fighter won.
- Good outcome can hide bad process.
- Bad outcome can still contain correct process.
- Count only reps where the correction survives under resistance.

Memory rules:
- Use Sensei memory as lived coaching history.
- Do not say "memory says" or expose storage language.
- If a habit count is above 1, speak like you have seen it before.
- Useful phrases: "This is not today's problem." "You solved this once before." "You keep asking for a new answer when the old one gets hard."
- Call out repeated questions, active corrections, repeated behaviors, avoided corrections, emotional triggers, and repeated excuses directly.
- Keep memory references short. One line is enough.
- The athlete should feel recognized, not analyzed.
- Never invent memory. If the pattern is not repeated yet, ask a sharp question before making the diagnosis.

Recovery language:
- Avoid software language.
- Do not say "fatigue-distorted reps."
- Do not say "rehearse the failed version of the correction."
- Prefer: "Tired reps become bad reps."
- Prefer: "You'll go back to the old habit."
- Prefer: "Protect the position."
- Prefer: "Keep the reps clean."

Active directive:
${args.activeCorrection || "None"}

Fix next rep:
${args.fixNextRep || "None"}

Intent:
${args.intent}

Camp context:
- nextFight: ${args.connected.camp?.nextFight || "unknown"}
- fightDate: ${args.connected.camp?.fightDate || "unknown"}
- opponent: ${args.connected.camp?.opponent || "unknown"}
- daysOut: ${args.connected.camp?.daysOut ?? "unknown"}
- phase: ${phase}
- currentCorrectionLock: ${args.activeCorrection || "none"}
- repeatedIssue: ${args.connected.camp?.repeatedIssue || args.connected.vision?.repeated_issue || "none"}
- repeatedFailureCount: ${args.progress.repeatedFailureCount}
- force: ${sequence.force}
- see: ${sequence.see}
- go: ${sequence.go}

Athlete memory:
- recurringMistakes: ${(args.connected.history?.recurringMistakes || []).join(" | ") || "none"}
- pressureLeaks: ${(args.connected.history?.pressureLeaks || []).join(" | ") || "none"}
- retainedCorrections: ${(args.connected.history?.retainedCorrections || []).join(" | ") || "none"}
- failedCorrections: ${(args.connected.history?.failedCorrections || []).join(" | ") || "none"}
- recentSessions: ${(args.connected.history?.recentSessions || []).join(" | ") || "none"}

Sensei memory:
- summary: ${args.connected.memory?.summary || "none"}
- repeatedQuestions: ${formatMemoryItems(args.connected.memory, "repeatedQuestions")}
- pressureLeaks: ${formatMemoryItems(args.connected.memory, "pressureLeaks")}
- emotionalTriggers: ${formatMemoryItems(args.connected.memory, "emotionalTriggers")}
- activeCorrections: ${formatMemoryItems(args.connected.memory, "activeCorrections")}
- habits: ${formatMemoryItems(args.connected.memory, "habits")}
- repeatedBehaviors: ${formatMemoryItems(args.connected.memory, "repeatedBehaviors")}
- avoidedCorrections: ${formatMemoryItems(args.connected.memory, "avoidedCorrections")}
- refusedProgressionAttempts: ${formatMemoryItems(args.connected.memory, "refusedProgressionAttempts")}
- confidenceTrends: ${formatMemoryItems(args.connected.memory, "confidenceTrends")}
- injuryFears: ${formatMemoryItems(args.connected.memory, "injuryFears")}
- fightCampConcerns: ${formatMemoryItems(args.connected.memory, "fightCampConcerns")}
- repeatedExcuses: ${formatMemoryItems(args.connected.memory, "repeatedExcuses")}
- successfulInterventions: ${formatMemoryItems(args.connected.memory, "successfulInterventions")}

Operating decision:
- readiness: ${operating.readiness}
- action: ${operating.action}
- correction: ${operating.correction}
- whyFixing: ${operating.whyFixing}
- sessionGoal: ${operating.sessionGoal}
- drill: ${operating.drill}
- pressureTest: ${operating.pressureTest}
- proofNeeded: ${operating.proofNeeded}
- restrictions: ${operating.restrictions.join(" | ") || "none"}
- pathwayAdjusted: ${operating.pathwayAdjusted}
- adjustmentReason: ${operating.adjustmentReason || "none"}
- reason: ${operating.reason}
- unlocksNext: ${operating.unlocksNext}

Profile:
- baseArt: ${args.connected.profile?.baseArt || "none"}
- paceStyle: ${args.connected.profile?.paceStyle || "none"}
- weaknesses: ${args.connected.profile?.weaknesses || "none"}
- goal: ${args.connected.profile?.goal || "none"}
- preferredStyle: ${args.connected.profile?.preferredStyle || "none"}
- avoidedStyle: ${args.connected.profile?.avoidedStyle || "none"}
- fightingStyle: ${args.connected.profile?.fightingStyle || "none"}
- aGame: ${args.connected.profile?.aGame || "none"}
- preferredPositions: ${args.connected.profile?.preferredPositions || "none"}
- winConditions: ${args.connected.profile?.winConditions || "none"}
- commonPressureBreaks: ${args.connected.profile?.commonPressureBreaks || "none"}
- currentGameplan: ${args.connected.profile?.currentGameplan || "none"}

Fuel:
- present: ${args.connected.fuel?.present === true}
- score: ${args.connected.fuel?.score ?? "none"}
- rating: ${args.connected.fuel?.rating ?? "none"}
- decision: ${args.connected.fuel?.decision ?? "none"}
- recoveryStatus: ${args.connected.fuel?.recoveryStatus ?? "none"}
- sleepHours: ${args.connected.fuel?.sleepHours ?? "none"}
- sleepQuality: ${args.connected.fuel?.sleepQuality ?? "none"}
- weightCutStatus: ${args.connected.fuel?.weightCutStatus ?? "none"}
- currentWeight: ${args.connected.fuel?.currentWeight ?? "none"}
- targetWeight: ${args.connected.fuel?.targetWeight ?? "none"}

Fighter reality:
- injuries: ${(args.connected.fighterReality?.injuries || []).join(" | ") || "none reported"}
- restrictions: ${(args.connected.fighterReality?.restrictions || []).join(" | ") || "none reported"}
- recoveryStatus: ${args.connected.fighterReality?.recoveryStatus || "unknown"}
- trainingFrequency: ${args.connected.fighterReality?.trainingFrequency ?? "unknown"}
- equipmentAccess: ${(args.connected.fighterReality?.equipmentAccess || []).join(" | ") || "unknown"}

Progress:
- repsCompleted: ${args.progress.repsCompleted}
- repsRequired: ${args.progress.repsRequired}
- underResistance: ${args.progress.underResistance}
- proofType: ${args.progress.proofType}
- repeatedFailureCount: ${args.progress.repeatedFailureCount}

Directive enforcement:
- activeCorrection: ${args.activeCorrection || "none"}
- fixNextRep: ${args.fixNextRep || "none"}
- isVerified: ${
  args.progress.repsCompleted >= args.progress.repsRequired &&
  args.progress.underResistance === true &&
  ["image", "video", "metrics"].includes(String(args.progress.proofType))
}
- isLocked: ${
  !(
    args.progress.repsCompleted >= args.progress.repsRequired &&
    args.progress.underResistance === true &&
    ["image", "video", "metrics"].includes(String(args.progress.proofType))
  )
}
- proofProgress: ${args.progress.repsCompleted}/${args.progress.repsRequired}

ENFORCEMENT RULES:
- The active correction is the highest priority in camp.
- If the user asks for a new skill, new theme, or unrelated focus while the directive is locked, redirect back to the active correction.
- Do not recommend variety before proof.
- Do not let the user move on because they are bored.
- Every decision must either protect, support, or directly progress the active correction.
- If the user asks about gyms, choose the gym that punishes the active correction fastest.
- If the user asks about fuel, judge whether today's food supports the active correction under resistance.
- If the user asks about recovery, judge whether the body can execute the active correction cleanly.
- Vision owns correction discovery. Never invent or replace Vision's active correction.
- Injury never removes the correction. It changes drill, resistance, volume, and proof.
- Never prescribe work that violates an active restriction.
- Never unlock progression through injury-adapted or otherwise unsafe proof.
- If equipment is unavailable, replace the method rather than prescribing unavailable work.
- State the relationship clearly when adjusted: correction remains; training pathway adjusted.

CAMP AUTHORITY RULES:
- Sensei is responsible for fight preparation, not entertainment.
- Sensei does not reward boredom.
- Sensei does not negotiate with unfinished corrections.
- Every unfinished correction is treated as a live threat.
- If the fighter requests a new skill while the active correction is unverified:
  1. Identify it as a camp distraction.
  2. Explain the camp cost.
  3. Deny the focus change.
  4. Redirect to proof.
- Sensei prioritizes winning the next fight over satisfying curiosity.

FIGHT CONSEQUENCE RULE:
- When a fighter attempts to move away from an unfinished correction,
  assume the correction appears in the next fight.
- Explain the likely consequence.
- Be direct.
- Do not exaggerate.
- Do not motivate.
- Speak like a coach protecting a fighter from a repeat mistake.

Gym data:
${gyms
  .slice(0, 8)
  .map((gym, i) => {
    return `${i + 1}. ${gym.name || "Unnamed"} | ${
      gym.location || "No location"
    } | ${gym.compatibility ?? 0}% | discipline: ${
      (gym.disciplineMatch || []).join(", ") || "none"
    } | style: ${(gym.styleMatch || []).join(", ") || "none"} | risk: ${
      (gym.watchOut || []).join(", ") || "none"
    }`;
  })
  .join("\n")}

Return only JSON:
{
  "status": "APPROVED | DENIED | CONDITIONAL | LOCKED",
  "mode": "FULL_DECISION | SHORT_CORRECTION | INTERRUPTION | PROOF_DEMAND | PRESSURE_COMMAND | APPROVAL",
  "response": "final line-by-line response when headings are not needed",
  "decision": "short ruling",
  "why": "short fight reason",
  "fixes": "what this correction solves",
  "ignored": "likely consequence in rounds or camp",
  "instruction": "exact next action",
  "lastCommand": "short command",
  "lastWhy": "short reason"
}
`.trim();
}

function extractText(resp: any): string {
  const direct = cleanMultiline(resp?.output_text);
  if (direct) return direct;

  const output = Array.isArray(resp?.output) ? resp.output : [];
  for (const item of output) {
    const content = Array.isArray(item?.content) ? item.content : [];
    for (const block of content) {
      const text = cleanMultiline(block?.text);
      if (text) return text;
    }
  }

  return "";
}

function parseJson(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

function normalizeAiParts(raw: any) {
  return {
    status: cleanText(raw?.status) || "DENIED",
    mode: cleanText(raw?.mode) || "SHORT_CORRECTION",
    response: cleanMultiline(raw?.response),
    decision: cleanText(raw?.decision) || "Denied.",
    why:
      cleanText(raw?.why) ||
      cleanText(raw?.campCost) ||
      "This mistake is still getting you punished.",
    fixes:
      cleanText(raw?.fixes) ||
      "It removes the mistake before it costs you rounds.",
    ignored:
      cleanText(raw?.ignored) ||
      cleanText(raw?.fightConsequence) ||
      "You will spend time on new skills while this mistake remains.",
    instruction:
      cleanText(raw?.instruction) ||
      "Complete clean proof reps under resistance before moving on.",
    lastCommand:
      cleanText(raw?.lastCommand) ||
      cleanText(raw?.instruction) ||
      "Return with proof.",
    lastWhy:
      cleanText(raw?.lastWhy) ||
      cleanText(raw?.why) ||
      "This mistake is not fixed yet.",
  };
}

function forceSeeGo(args: {
  connected: SenseiConnected;
  activeCorrection: string;
  fixNextRep: string;
}) {
  const repeatedIssue =
    cleanText(args.connected.camp?.repeatedIssue) ||
    cleanText(args.connected.vision?.repeated_issue) ||
    args.activeCorrection ||
    "the repeated break";

  return {
    force:
      cleanText(args.connected.camp?.forceCue) ||
      cleanText(args.connected.vision?.force) ||
      `Force the reaction that exposes ${repeatedIssue}`,
    see:
      cleanText(args.connected.camp?.seeCue) ||
      cleanText(args.connected.vision?.see) ||
      "See the opening before committing",
    go:
      cleanText(args.connected.camp?.goCue) ||
      cleanText(args.connected.vision?.go) ||
      args.fixNextRep ||
      `Go only when ${args.activeCorrection || "the correction"} is available`,
  };
}

function campWindow(connected: SenseiConnected) {
  const daysOut = connected.camp?.daysOut;

  if (typeof daysOut !== "number") return "UNKNOWN" as const;
  if (daysOut <= 7) return "FIGHT_WEEK" as const;
  if (daysOut <= 14) return "PRESSURE_TEST" as const;
  if (daysOut <= 28) return "CAMP" as const;
  return "BUILD" as const;
}

function campLabel(connected: SenseiConnected) {
  const fight = cleanText(connected.camp?.nextFight);
  const opponent = cleanText(connected.camp?.opponent);
  const daysOut = connected.camp?.daysOut;

  const label = [
    fight,
    opponent ? `vs ${opponent}` : "",
    typeof daysOut === "number" ? `${daysOut} days out` : "",
  ]
    .filter(Boolean)
    .join(" | ");

  return label || "";
}

function readinessLine(readiness: SenseiOperatingDecision["readiness"]) {
  if (readiness === "RED") return "Your body is not cleared for pressure today.";
  if (readiness === "AMBER") return "Keep the work controlled today.";
  if (readiness === "GREEN") return "You can test this today.";
  return "Keep the work honest until readiness is clear.";
}

function actionLine(action: SenseiOperatingDecision["action"]) {
  if (action === "PRESSURE_TEST") return "Test it under pressure.";
  if (action === "TECHNICAL_ONLY") return "Keep it technical.";
  if (action === "RETAIN") return "Retain it. Do not add complexity.";
  if (action === "UNLOCK_NEXT_LAYER") return "Earn the next layer without losing this one.";
  return "Recover first.";
}

function pressureCampLine(args: {
  connected: SenseiConnected;
  directive: string;
  operating: SenseiOperatingDecision;
  operatingLimit: string;
  go: string;
}) {
  const label = campLabel(args.connected);
  const camp = label ? `${label}. ` : "";
  return `${camp}Stay on ${args.directive}. ${actionLine(args.operating.action)} ${args.operatingLimit}. ${args.go}.`;
}

function buildOperatingDecision(args: {
  connected: SenseiConnected;
  activeCorrection: string;
  fixNextRep: string;
  progress: DirectiveProgress;
}): SenseiOperatingDecision {
  const { connected, activeCorrection, progress } = args;
  const fuel = connected.fuel || {};
  const reality = connected.fighterReality || {};
  const phase = campWindow(connected);
  const sequence = forceSeeGo(args);
  const correction =
    activeCorrection ||
    cleanText(connected.camp?.currentCorrectionLock) ||
    "No correction loaded";
  const normalizedCorrection = correction.toLowerCase();
  const recoveryStatus = cleanText(
    reality.recoveryStatus || fuel.recoveryStatus
  ).toUpperCase();
  const rating = cleanText(fuel.rating).toUpperCase();
  const sleepQuality = cleanText(fuel.sleepQuality).toUpperCase();
  const cutStatus = cleanText(fuel.weightCutStatus).toUpperCase();
  const sleepHours = fuel.sleepHours;
  const score = fuel.score;
  const activeInjuries = (reality.injuries || []).filter((item) =>
    !/^(none|healthy|cleared|resolved|no injury|no injuries)$/i.test(item.trim())
  );
  const activeRestrictions = (reality.restrictions || []).filter((item) =>
    !/^(none|cleared|no restriction|no restrictions)$/i.test(item.trim())
  );
  const restrictionText = activeRestrictions.join(" | ").toLowerCase();
  const injuryAdjusted = activeInjuries.length > 0 || activeRestrictions.length > 0;
  const equipment = reality.equipmentAccess || [];
  const equipmentText = equipment.join(" | ").toLowerCase();
  const equipmentKnown = equipment.length > 0;
  const hasPartner = /partner|coach|team|class|gym/.test(equipmentText);
  const hasWall = /wall|cage|fence/.test(equipmentText);
  const trainingFrequency = reality.trainingFrequency;

  const redCondition =
    recoveryStatus === "RED" ||
    recoveryStatus === "STOP" ||
    rating === "RED" ||
    rating === "TRASH" ||
    (typeof score === "number" && score < 45) ||
    (typeof sleepHours === "number" && sleepHours < 6) ||
    ["POOR", "BAD", "TRASH"].includes(sleepQuality) ||
    ["CRITICAL", "DEHYDRATED", "STOP"].includes(cutStatus);

  const amberCondition =
    recoveryStatus === "AMBER" ||
    recoveryStatus === "YELLOW" ||
    rating === "AMBER" ||
    rating === "LOW" ||
    (typeof score === "number" && score < 65) ||
    (typeof sleepHours === "number" && sleepHours < 7) ||
    ["ACTIVE", "CUTTING", "BEHIND"].includes(cutStatus);

  const greenCondition =
    recoveryStatus === "GREEN" ||
    rating === "GREEN" ||
    rating === "CLEAN" ||
    (typeof score === "number" && score >= 65);

  const readiness: SenseiOperatingDecision["readiness"] = redCondition
    ? "RED"
    : amberCondition
      ? "AMBER"
      : greenCondition
        ? "GREEN"
        : "UNKNOWN";

  let drill = cleanText(connected.vision?.drill) || "Constraint drilling on the current correction";
  let pressureTest =
    cleanText(connected.vision?.pressure_test) ||
    "Partner adds controlled resistance while the correction stays intact";
  let sessionGoal = sequence.go;
  let proofNeeded = "";

  if (normalizedCorrection.includes("head") && normalizedCorrection.includes("outside")) {
    drill = cleanText(connected.vision?.drill) || "Wall doubles with ear inside the ribs";
    pressureTest =
      cleanText(connected.vision?.pressure_test) ||
      "Partner gives whizzer resistance after head position is won";
    sessionGoal = "Ear inside the ribs on every entry";
  }

  const requiredReps =
    connected.vision?.proof_required || progress.repsRequired || 5;
  proofNeeded = `${requiredReps} clean reps with ${correction} intact`;
  const repeatedIssue =
    cleanText(connected.camp?.repeatedIssue) ||
    cleanText(connected.vision?.repeated_issue) ||
    connected.history?.recurringMistakes?.[0] ||
    correction;
  const failedBefore = (connected.history?.failedCorrections || []).some(
    (item) => item.toLowerCase() === correction.toLowerCase()
  );
  const retained = connected.history?.retainedCorrections || [];
  const retainedCurrent = retained.some(
    (item) => item.toLowerCase() === correction.toLowerCase()
  );
  const proofVerified =
    progress.repsCompleted >= progress.repsRequired &&
    progress.underResistance === true &&
    ["image", "video", "metrics"].includes(String(progress.proofType));
  const whyFixing = failedBefore || progress.repeatedFailureCount > 0
    ? `${repeatedIssue} has failed before and remains available to the opponent.`
    : `${repeatedIssue} is the active technical break identified by Vision.`;

  let action: SenseiOperatingDecision["action"];
  let reason: string;
  let unlocksNext: string;
  const restrictions: string[] = [];
  let adjustmentReason: string | null = null;

  if (injuryAdjusted) {
    adjustmentReason = [
      activeInjuries.length
        ? `Active injury: ${activeInjuries.join(", ")}`
        : "",
      activeRestrictions.length
        ? `Restrictions: ${activeRestrictions.join(", ")}`
        : "",
    ]
      .filter(Boolean)
      .join(". ");

    action = "TECHNICAL_ONLY";
    reason = `${correction} remains active. Training pathway adjusted around the fighter's current restrictions.`;
    unlocksNext = "Medical clearance, safe recovery, and standard proof under resistance.";

    if (
      normalizedCorrection.includes("head") &&
      normalizedCorrection.includes("outside")
    ) {
      sessionGoal = "Win head position on every entry";
      drill = hasWall
        ? "Head-position entries against the wall; stop before the finish"
        : "Head-position entries from stance; stop before the drive or finish";
      pressureTest = hasPartner
        ? "Light partner pressure only; no finish and no hard drive"
        : "No partner pressure today; rehearse position and entry path only";
      proofNeeded = "10 clean head-position entries; no finish required";
    } else {
      drill = `Restricted-range correction reps for ${correction}`;
      pressureTest = hasPartner
        ? "Light partner pressure within every active restriction"
        : "No partner pressure; use controlled position rehearsals only";
      proofNeeded = `10 clean restricted-range reps with ${correction} intact`;
    }

    restrictions.push(...activeRestrictions);
    restrictions.push("No unsafe proof", "Adapt proof; do not remove the correction");

    if (/no live|no spar|no wrestling/.test(restrictionText)) {
      restrictions.push("No live wrestling");
    }
    if (/no finish|no finishing/.test(restrictionText)) {
      restrictions.push("No finish required");
    }
    if (/no hard drive|no drive|no explosive/.test(restrictionText)) {
      restrictions.push("No hard drive");
    }
    if (/light|low impact|controlled/.test(restrictionText)) {
      restrictions.push("Light controlled resistance only");
    }
  } else if (readiness === "RED") {
    action = "TECHNICAL_ONLY";
    reason = `Condition is red. Protect ${correction} from fatigue-distorted reps.`;
    unlocksNext = "Green recovery and accepted process proof.";
    restrictions.push("No pressure test", "No hard rounds", "No conditioning finisher");
  } else if (phase === "FIGHT_WEEK") {
    action = "RETAIN";
    reason = `${connected.camp?.daysOut ?? 0} days out. Retain proven decisions and remove complexity.`;
    unlocksNext = "Fight completion and the next development block.";
    restrictions.push("No new corrections", "No new techniques", "No unnecessary complexity");
  } else if (readiness === "GREEN" && (retainedCurrent || proofVerified)) {
    action = "UNLOCK_NEXT_LAYER";
    reason = `${correction} is retained and the body can support higher resistance.`;
    unlocksNext = "Load one next-layer correction and increase resistance.";
    pressureTest = `Increase resistance while retaining ${correction}`;
  } else if (readiness === "GREEN") {
    action = "PRESSURE_TEST";
    reason = `Condition is green. Test whether ${correction} survives resistance.`;
    unlocksNext = `Accepted proof: ${requiredReps} clean reps under resistance.`;
  } else {
    action = "TECHNICAL_ONLY";
    reason = `Condition is ${readiness.toLowerCase()}. Build clean process before adding pressure.`;
    unlocksNext = "Green recovery and accepted process proof.";
    restrictions.push("Controlled resistance only", "Stop on the first cue break");
  }

  if (failedBefore || progress.repeatedFailureCount > 0) {
    restrictions.push(`Do not move past the repeated issue: ${repeatedIssue}`);
  }

  if (phase === "FIGHT_WEEK" && retained.length) {
    restrictions.push(`Retain: ${retained.join(", ")}`);
  }

  if (equipmentKnown && !hasPartner) {
    pressureTest = "No partner pressure available; use solo constraint reps";
    restrictions.push("No partner-dependent mission");
  }

  if (equipmentKnown && !hasWall && /wall/i.test(drill)) {
    drill = `Stance-entry constraint reps for ${correction}`;
    restrictions.push("No wall-dependent drill");
  }

  if (typeof trainingFrequency === "number" && trainingFrequency > 0) {
    restrictions.push(
      `Dose proof across ${trainingFrequency} available session${trainingFrequency === 1 ? "" : "s"} per week`
    );
  }

  return {
    readiness,
    campPhase: phase,
    action,
    correction,
    whyFixing,
    sessionGoal,
    drill,
    pressureTest,
    proofNeeded,
    restrictions,
    pathwayAdjusted: injuryAdjusted,
    adjustmentReason,
    reason,
    unlocksNext,
  };
}

function coachingModeFromAi(mode: string): CoachingResponseMode {
  if (mode === "APPROVAL") return "Approval";
  if (mode === "PROOF_DEMAND") return "Proof Demand";
  if (mode === "PRESSURE_COMMAND") return "Pressure Command";
  if (mode === "INTERRUPTION") return "Redirect";
  if (mode === "REFUSAL") return "Refusal";
  if (mode === "TACTICAL_CHALLENGE") return "Tactical Challenge";
  return "Command";
}

async function runAi(args: {
  message: string;
  connected: SenseiConnected;
  activeCorrection: string;
  fixNextRep: string;
  intent: Intent;
  progress: DirectiveProgress;
}) {
  if (!openai) return null;

  try {
    const systemPrompt = buildSystemPrompt(args);

    const resp = await openai.responses.create({
      model: "gpt-5.1-mini",
      input: [
        {
          role: "system",
          content: [{ type: "input_text", text: systemPrompt }],
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: `User question: ${args.message}`,
            },
          ],
        },
      ],
      max_output_tokens: 500,
    } as any);

    const text = extractText(resp);
    const parsed = parseJson(text);
    if (!parsed) return null;

    return normalizeAiParts(parsed);
  } catch (err) {
    console.error("[sensei] ai failed:", err);
    return null;
  }
}

export async function POST(req: NextRequest) {
  const id = requestId(req);
  let lease: Extract<RateLimitLease, { ok: true }> | null = null;
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return unauthorized();
    }
    const acquired = acquireExpensiveRequest({
      route: "sensei",
      userId: user.id,
      ip: requestIp(req),
    });
    if (!acquired.ok) return rateLimited(acquired);
    lease = acquired;
    const body = await req.json().catch(() => null);

    const message = cleanText(body?.message || body?.question);
    const section = cleanText(body?.section) as Section;
    const connectedInput = normalizeConnected(buildContextInput(body || {}));
    const { data: currentPointer, error: currentError } = await supabase
      .from("current_coach_missions")
      .select("mission_version_id, relationship_id")
      .eq("athlete_user_id", user.id)
      .maybeSingle();
    if (currentError) {
      logServerError("sensei-authority-read", id, currentError);
      return safeServerError(id);
    }
    const { data: activeRelationship, error: relationshipError } = currentPointer
      ? await supabase
          .from("coach_relationships")
          .select("status, coach_user_id")
          .eq("id", currentPointer.relationship_id)
          .eq("athlete_user_id", user.id)
          .maybeSingle()
      : { data: null, error: null };
    if (relationshipError) {
      logServerError("sensei-relationship-read", id, relationshipError);
      return safeServerError(id);
    }
    const { data: approvedMission, error: missionError } =
      currentPointer &&
      activeRelationship?.status === "connected" &&
      activeRelationship.coach_user_id
      ? await supabase
          .from("mission_versions")
          .select("correction_text, practice_task, coach_user_id, coach_display_name, approved_at")
          .eq("id", currentPointer.mission_version_id)
          .eq("athlete_user_id", user.id)
          .eq("relationship_id", currentPointer.relationship_id)
          .maybeSingle()
      : { data: null, error: null };
    if (missionError) {
      logServerError("sensei-mission-read", id, missionError);
      return safeServerError(id);
    }
    /*
      One rule decides whether Sensei may reinforce anything, and it reads only
      rows this route fetched itself. The decision is a pure function so the
      boundary can be tested directly — see lib/authority/reinforcement.test.ts.
    */
    const reinforcement = resolveReinforcement(
      currentPointer ?? null,
      activeRelationship ?? null,
      approvedMission ?? null
    );

    if (!reinforcement.mayReinforce) {
      logServerError("sensei-reinforcement-refused", id, reinforcement.refusal);
    }

    const serverCorrection = reinforcement.mayReinforce
      ? reinforcement.correction
      : "";
    const connected = normalizeConnected({
      ...connectedInput,
      vision: {
        ...connectedInput.vision,
        present: Boolean(serverCorrection),
        correction: serverCorrection || null,
        fix_next_rep: reinforcement.mayReinforce ? reinforcement.practiceTask || null : null,
      },
      camp: {
        ...connectedInput.camp,
        currentCorrectionLock: serverCorrection || null,
      },
    });
    const session = normalizeSession(body?.session || {});
    const progress = normalizeDirectiveProgress(
      body?.directiveProgress || undefined
    );

    // Authority is resolved from the authenticated athlete's immutable current
    // mission pointer. Client-supplied directives can never unlock Sensei.
    const activeCorrection = serverCorrection;

    const fixNextRep = cleanText(connected.vision?.fix_next_rep);
    const pendingPsychologyAnswer =
      shouldContinuePsychologySession(session, message) ||
      isPsychologyFollowupAnswer(message);
    const classifiedIntent: ClassifiedIntent = pendingPsychologyAnswer
      ? {
          category: "Psychology",
          intent: "psychology_decision",
          route: "buildPendingPsychologyAnswer",
          confidence: "high",
          reason:
            "The previous Sensei response asked a psychology follow-up question.",
        }
      : classifySenseiIntent(message, section);
    const intent = classifiedIntent.intent;
    const operatingDecision = buildOperatingDecision({
      connected,
      activeCorrection,
      fixNextRep,
      progress,
    });
    const priorMemory = normalizeSenseiMemory(
      body?.senseiMemory || body?.memory || connected.memory || {}
    );
    const currentPressureCase = inferPressureCase(message);
    const currentPressureLeak = pressureLeakFromCase(currentPressureCase);
    const senseiMemory = updateSenseiMemory({
      memory: priorMemory,
      message,
      intent,
      activeCorrection,
      pressureCase: currentPressureCase,
      pressureLeak: currentPressureLeak,
      progress,
      operatingDecision,
    });
    const connectedWithMemory: SenseiConnected = {
      ...connected,
      memory: senseiMemory,
    };

    const pressureCard = buildPressureDisciplineCard({
      activeDirective: activeCorrection,
      latestVisionCorrection: activeCorrection,
      userMessage: message,
      repeatedFailureCount: progress.repeatedFailureCount,
      proofVerified:
        progress.repsCompleted >= progress.repsRequired &&
        progress.underResistance === true &&
        (progress.proofType === "image" ||
          progress.proofType === "video" ||
          progress.proofType === "metrics"),
      underResistance: progress.underResistance,
    });

    if (!message) {
      return NextResponse.json({
        mode: "FALLBACK",
        intent: classifiedIntent.category,
        responseMode: "Redirect",
        pressureLeak: null,
        operatingDecision,
        answer: coachFacingAnswer(formatAnswer({
          decision: "Ask one clear question.",
          why: "Empty questions cannot be enforced.",
          fixes: "It prevents vague output.",
          ignored: "The system will drift.",
          instruction: "Ask one direct decision question.",
        })),
        connected: connectedWithMemory,
        session,
        directiveState: progress,
        pressureCard,
        memory: senseiMemory,
      } satisfies SenseiResponse);
    }

    const lockState = getLockState({
      directive: {
        present: !!activeCorrection,
        correction: activeCorrection || null,
      },
      progress,
      fuel: {
        present: connected.fuel?.present === true,
        score: connected.fuel?.score ?? null,
        rating: connected.fuel?.rating ?? null,
        decision: connected.fuel?.decision ?? null,
      },
    });

    if (
      intent === "advanced_request" &&
      lockState.locked &&
      operatingDecision.action !== "UNLOCK_NEXT_LAYER"
    ) {
      return NextResponse.json({
        mode: "ENFORCEMENT",
        intent: classifiedIntent.category,
        responseMode: "Refusal",
        pressureLeak: null,
        operatingDecision,
        answer: coachFacingAnswer(strictProgressionDecision({
          connected: connectedWithMemory,
          activeCorrection,
          progress,
          lockMessage: lockState.userMessage,
        })),
        connected: connectedWithMemory,
        session: {
          ...session,
          lastDecision: "Blocked until verified.",
          lastCommand: "Prove the correction.",
          lastWhy: "Directive or Fuel is not verified.",
          lastUpdated: new Date().toISOString(),
        },
        directiveState: progress,
        pressureCard,
        memory: senseiMemory,
      } satisfies SenseiResponse);
    }

    if (intent === "gym_decision") {
      const answer = buildGymDecision({
        message,
        connected: connectedWithMemory,
        activeCorrection,
      });

      return NextResponse.json({
        mode: "STRICT",
        intent: classifiedIntent.category,
        responseMode: "Tactical Challenge",
        pressureLeak: null,
        operatingDecision,
        answer: coachFacingAnswer(answer),
        connected: {
          ...connectedWithMemory,
          gyms: connected.gyms?.length ? connected.gyms : DUBAI_FALLBACK_GYMS,
        },
        session: {
          ...session,
          lastDecision:
            coachFacingAnswer(answer).split("\n")[0]?.replace(/^Decision:\s*/i, "") || "",
          lastCommand: "Choose the room that exposes the flaw.",
          lastWhy: "Comfort keeps the mistake alive.",
          lastUpdated: new Date().toISOString(),
        },
        directiveState: {
          ...progress,
          activeDirective: activeCorrection || progress.activeDirective,
          updatedAt: new Date().toISOString(),
        },
        pressureCard,
        memory: senseiMemory,
      } satisfies SenseiResponse);
    }

    let answer: string;
    let lastCommand = "";
    let lastWhy = "";
    let mode: SenseiResponse["mode"] = "STRICT";
    let responseMode: CoachingResponseMode = "Command";
    let detectedPressureLeak: PressureLeak | null = null;
    let nextPressureCard: PressureDisciplineCard = pressureCard;

    if (intent === "out_of_scope") {
      answer = outOfScopeDecision();
      lastCommand = "Bring it back to performance.";
      lastWhy = classifiedIntent.reason;
      mode = "STRICT";
      responseMode = "Refusal";
    } else if (
      !activeCorrection &&
      intent !== "fuel_decision" &&
      intent !== "weight_cut_decision" &&
      intent !== "recovery_decision" &&
      intent !== "injury_decision" &&
      intent !== "pressure_discipline" &&
      intent !== "psychology_decision" &&
      intent !== "system_navigation"
    ) {
      answer = fallbackNoDirective();
      lastCommand = "Run Vision first.";
      lastWhy = "No active correction.";
      mode = "FALLBACK";
      responseMode = "Redirect";
    } else if (intent === "system_navigation") {
      answer = strictSystemNavigationDecision({ message });
      lastCommand = "Use the right module.";
      lastWhy = classifiedIntent.reason;
      mode = "STRICT";
      responseMode = "Redirect";
    } else if (intent === "proof_decision") {
      answer = strictProofDecision({
        message,
        activeCorrection,
        progress,
      });
      lastCommand = "Verify the correction.";
      lastWhy = "Proof controls unlocks.";
      mode = "ENFORCEMENT";
      responseMode =
        progress.repsCompleted >= progress.repsRequired &&
        progress.underResistance === true &&
        ["image", "video", "metrics"].includes(String(progress.proofType))
          ? "Approval"
          : "Proof Demand";
    } else if (intent === "advanced_request") {
      answer = strictProgressionDecision({
        connected: connectedWithMemory,
        activeCorrection,
        progress,
      });
      lastCommand = "Prove before progression.";
      lastWhy = "Progression requires verified proof.";
      mode = "ENFORCEMENT";
      responseMode =
        operatingDecision.action === "UNLOCK_NEXT_LAYER"
          ? "Approval"
          : "Refusal";
    } else if (intent === "psychology_decision") {
      if (pendingPsychologyAnswer) {
        answer = buildPendingPsychologyAnswer({
          message,
          session,
          activeCorrection,
          memory: senseiMemory,
          connected: connectedWithMemory,
        });
        detectedPressureLeak = currentPressureLeak;
        lastCommand = styleReturnLine(connectedWithMemory);
        lastWhy = "The fighter answered a pending psychology question.";
        mode = "STRICT";
        responseMode = "Pressure Command";
      } else {
        const pressureDecision = strictPressureDisciplineDecision({
          message,
          connected: connectedWithMemory,
          activeCorrection,
          fixNextRep,
          progress,
          memory: senseiMemory,
        });

        answer = pressureDecision.answer;
        nextPressureCard = pressureDecision.pressureCard;
        detectedPressureLeak = pressureDecision.pressureLeak;
        lastCommand = pressureDecision.pressureCard.stopCommand;
        lastWhy = pressureDecision.pressureCard.risk;
        mode = "STRICT";
        responseMode = "Pressure Command";
      }
    } else if (intent === "pressure_discipline") {
      const pressureDecision = strictPressureDisciplineDecision({
        message,
        connected: connectedWithMemory,
        activeCorrection,
        fixNextRep,
        progress,
        memory: senseiMemory,
      });

      answer = pressureDecision.answer;
      nextPressureCard = pressureDecision.pressureCard;
      detectedPressureLeak = pressureDecision.pressureLeak;
      lastCommand = pressureDecision.pressureCard.stopCommand;
      lastWhy = pressureDecision.pressureCard.risk;
      mode =
        pressureDecision.pressureCard.state === "LOCK"
          ? "ENFORCEMENT"
          : "STRICT";
      responseMode = "Pressure Command";
    } else if (intent === "fuel_decision") {
      answer = strictFuelDecision({
        message,
        connected: connectedWithMemory,
        activeCorrection,
        progress,
      });
      lastCommand = "Match volume to readiness.";
      lastWhy = "Fuel changes session load.";
      responseMode = "Command";
    } else if (intent === "weight_cut_decision") {
      answer = strictWeightCutDecision({
        message,
        activeCorrection,
      });
      lastCommand = "Protect readiness during the cut.";
      lastWhy = "Weight cut changes fight output.";
      responseMode = "Command";
    } else if (intent === "recovery_decision") {
      answer = strictRecoveryDecision({
        message,
        connected: connectedWithMemory,
        activeCorrection,
        fixNextRep,
        progress,
      });
      lastCommand = "Protect the correction.";
      lastWhy = "Fatigue hides technical truth.";
      responseMode = "Command";
    } else if (intent === "injury_decision") {
      answer = strictInjuryDecision({
        message,
        connected: connectedWithMemory,
        activeCorrection,
        fixNextRep,
        progress,
      });
      lastCommand = "Do not train through altered mechanics.";
      lastWhy = "Pain corrupts technical data.";
      responseMode = "Command";
    } else if (intent === "training_decision") {
      answer = strictTrainingDecision({
        message,
        connected: connectedWithMemory,
        activeCorrection,
        fixNextRep,
        progress,
      });
      lastCommand = "Stay on the correction.";
      lastWhy = "The directive is not verified yet.";
      responseMode =
        inferTacticalConcept(message) !== "none"
          ? "Tactical Challenge"
          : "Command";
    } else if (intent === "overview_decision") {
      answer = overviewDecision({
        activeCorrection,
        connected: connectedWithMemory,
        progress,
      });
      lastCommand = "Keep one camp focus.";
      lastWhy = "Overview should not create drift.";
      responseMode = "Redirect";
    } else {
      const ai = await runAi({
        message,
        connected: connectedWithMemory,
        activeCorrection,
        fixNextRep,
        intent,
        progress,
      });

      if (ai) {
        answer =
          ai.response ||
          formatAnswer({
            decision: ai.decision,
            why: ai.why,
            fixes: ai.fixes,
            ignored: ai.ignored,
            instruction: ai.instruction,
          });
        lastCommand = ai.lastCommand;
        lastWhy = ai.lastWhy;
        responseMode = coachingModeFromAi(ai.mode);
      } else {
        answer = strictTrainingDecision({
          message,
          connected: connectedWithMemory,
          activeCorrection,
          fixNextRep,
          progress,
        });
        lastCommand = "Stay on the correction.";
        lastWhy = "AI response failed. Fallback enforced.";
        mode = "FALLBACK";
        responseMode = "Redirect";
      }
    }

    const visibleAnswer = coachFacingAnswer(answer);
    const psychologySessionState = nextPsychologySessionState({
      session,
      answer: visibleAnswer,
      intent,
      message,
    });

    return NextResponse.json({
      mode,
      intent: classifiedIntent.category,
      responseMode,
      pressureLeak: detectedPressureLeak,
      operatingDecision,
      answer: visibleAnswer,
      connected: {
        ...connected,
        memory: senseiMemory,
        vision: {
          ...connected.vision,
          present: !!activeCorrection,
          correction: activeCorrection || connected.vision?.correction || null,
          fix_next_rep: fixNextRep || connected.vision?.fix_next_rep || null,
        },
        gyms: connected.gyms?.length ? connected.gyms : DUBAI_FALLBACK_GYMS,
      },
      session: {
        ...session,
        ...psychologySessionState,
        lastDecision:
          visibleAnswer.split("\n")[0]?.replace(/^Decision:\s*/i, "") || "",
        lastCommand,
        lastWhy,
        lastUpdated: new Date().toISOString(),
      },
      directiveState: {
        ...progress,
        activeDirective: activeCorrection || progress.activeDirective,
        updatedAt: new Date().toISOString(),
      },
      pressureCard: nextPressureCard,
      memory: senseiMemory,
    } satisfies SenseiResponse);
  } catch (err: unknown) {
    logServerError("sensei", id, err);

    const fallbackProgress = normalizeDirectiveProgress();
    const pressureCard = buildPressureDisciplineCard({
      userMessage: "",
      activeDirective: "",
      latestVisionCorrection: "",
      repeatedFailureCount: 0,
      proofVerified: false,
      underResistance: false,
    });

    return NextResponse.json({
      mode: "FALLBACK",
      answer: coachFacingAnswer(formatAnswer({
        decision: "Sensei route failed.",
        why: "The server broke before a clean decision came back.",
        fixes: "It prevents silent failure.",
        ignored: "Broken responses destroy trust.",
        instruction: "Retry the same question. If it repeats, check the route logs.",
      })),
      connected: {
        vision: {
          present: false,
          correction: null,
          severity: null,
          fix_next_rep: null,
        },
        fuel: {
          present: false,
          score: null,
          rating: null,
          decision: null,
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
          fightingStyle: "",
          aGame: "",
          preferredPositions: "",
          winConditions: "",
          commonPressureBreaks: "",
          currentGameplan: "",
        },
        gyms: DUBAI_FALLBACK_GYMS,
      },
      session: {
        lastDecision: "Sensei route failed.",
        lastCommand: "Check route logs.",
        lastWhy: "The request could not be completed.",
        lastUpdated: new Date().toISOString(),
      },
      directiveState: fallbackProgress,
      pressureCard,
    } satisfies SenseiResponse);
  } finally {
    lease?.release();
  }
}



