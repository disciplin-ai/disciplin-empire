"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import type { FuelHistoryPoint } from "./FuelScoreChart";
import type { FuelOutput } from "@/lib/fuelTypes";
import type { AuthorityView } from "@/lib/authority/state";
import {
  fuelAuthorityContract,
  type FuelAuthorityContract,
} from "@/lib/fuelAuthority";

type Mode = "text" | "photo";
type Tone = "clean" | "optimal" | "caution" | "low" | "trash" | "locked" | "neutral";
type TrainingConditionState = "NOT_ASSESSED" | "NO_CONSTRAINT" | "REDUCED" | "LIVE_RESTRICTED" | "STOP";
type DecisionSource = "Practitioner set" | "Coach set" | "Safety rule" | "Athlete reported" | "Fuel suggestion" | "Insufficient information";

type ConditionEnvelope = {
  intensity: string;
  resistance: string;
  unpredictability: string;
  volume: string;
  liveExposure: string;
};

type TrainingConditionDecision = {
  state: TrainingConditionState;
  title: string;
  source: DecisionSource;
  trainingAnswer: string;
  reason: string;
  known: string[];
  unknowns: string[];
  constraints: ConditionEnvelope;
  productiveBoundary: string;
  nextAction: string;
  handoff: string;
  tone: Tone;
};

type PreparationSignal = {
  id: "meal" | "hydration" | "recovery" | "restriction" | "plan";
  label: string;
  evidence: string;
  action: string;
  tone: Tone;
};

export type NextSessionPreparation = {
  session: string;
  status: "ON_TRACK" | "ADJUST" | "STOP";
  title: string;
  action: string;
  signals: PreparationSignal[];
};

type FuelDecisionLayer = {
  assessment: string;
  impact: string;
  decision: string;
  next_steps: string[];
  pattern_line?: string;
};

export type FuelDecisionOutput = FuelOutput & FuelDecisionLayer;

type FuelScreenProps = {
  embedded?: boolean;
  authority: AuthorityView;
  authLoading: boolean;
  hasUser: boolean;
  profileLine: string;
  purpose: string;
  session: string;
  timeOfTraining: string;
  mode: Mode;
  fightWeek: boolean;
  nextMealTarget: string;
  statusPill: string;

  mealText: string;
  setMealText: (v: string) => void;

  photo: File | null;
  setPhoto: (f: File | null) => void;

  modeValue: Mode;
  setModeSafe: (m: Mode) => void;

  sessionValue: string;
  setSession: (v: string) => void;

  intensity: string;
  setIntensity: (v: string) => void;

  purposeValue: string;
  setPurpose: (v: string) => void;

  fightWeekValue: boolean;
  setFightWeek: (v: boolean) => void;

  timeOfTrainingValue: string;
  setTimeOfTraining: (v: string) => void;

  canAnalyze: boolean;
  canRun: boolean;
  running: boolean;
  analyze: () => void;
  refine: () => void;
  reset: () => void;

  error: string | null;

  out: FuelDecisionOutput | null;
  answers: Record<string, string>;
  setAnswers: React.Dispatch<React.SetStateAction<Record<string, string>>>;

  history: FuelHistoryPoint[];
  historyLoading: boolean;
  refreshHistory: () => void;
};

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function cleanSentence(text?: string | null) {
  return String(text || "").replace(/\s+/g, " ").trim();
}

function palette(tone: Tone) {
  if (tone === "clean") {
    return {
      color: "#34d399",
      border: "border-emerald-300/40",
      borderSoft: "border-emerald-300/22",
      bg: "bg-emerald-400/12",
      text: "text-emerald-100",
      muted: "text-emerald-200/68",
      glow: "shadow-[0_20px_70px_rgba(52,211,153,0.14)]",
      wash: "bg-[radial-gradient(circle_at_50%_0%,rgba(52,211,153,0.16),transparent_52%)]",
    };
  }

  if (tone === "optimal") {
    return {
      color: "#6ee7b7",
      border: "border-emerald-200/55",
      borderSoft: "border-emerald-200/28",
      bg: "bg-emerald-300/16",
      text: "text-emerald-50",
      muted: "text-emerald-100/72",
      glow: "shadow-[0_22px_76px_rgba(110,231,183,0.16)]",
      wash: "bg-[radial-gradient(circle_at_50%_0%,rgba(110,231,183,0.18),transparent_52%)]",
    };
  }

  if (tone === "caution") {
    return {
      color: "#fbbf24",
      border: "border-amber-400/30",
      borderSoft: "border-amber-400/16",
      bg: "bg-amber-400/10",
      text: "text-amber-200",
      muted: "text-amber-200/58",
      glow: "shadow-[0_20px_70px_rgba(251,191,36,0.10)]",
      wash: "bg-[radial-gradient(circle_at_50%_0%,rgba(251,191,36,0.12),transparent_52%)]",
    };
  }

  if (tone === "low") {
    return {
      color: "#fb7185",
      border: "border-rose-400/35",
      borderSoft: "border-rose-400/18",
      bg: "bg-rose-400/10",
      text: "text-rose-200",
      muted: "text-rose-200/58",
      glow: "shadow-[0_20px_70px_rgba(251,113,133,0.11)]",
      wash: "bg-[radial-gradient(circle_at_50%_0%,rgba(251,113,133,0.13),transparent_52%)]",
    };
  }

  if (tone === "trash") {
    return {
      color: "#fb7185",
      border: "border-rose-400/35",
      borderSoft: "border-rose-400/18",
      bg: "bg-rose-400/10",
      text: "text-rose-200",
      muted: "text-rose-200/58",
      glow: "shadow-[0_20px_70px_rgba(251,113,133,0.11)]",
      wash: "bg-[radial-gradient(circle_at_50%_0%,rgba(251,113,133,0.13),transparent_52%)]",
    };
  }

  if (tone === "locked") {
    return {
      color: "#f59e0b",
      border: "border-yellow-400/35",
      borderSoft: "border-yellow-400/18",
      bg: "bg-yellow-400/10",
      text: "text-yellow-100",
      muted: "text-yellow-100/58",
      glow: "shadow-[0_20px_70px_rgba(245,158,11,0.11)]",
      wash: "bg-[radial-gradient(circle_at_50%_0%,rgba(245,158,11,0.13),transparent_52%)]",
    };
  }

  return {
    color: "#34d399",
    border: "border-emerald-400/18",
    borderSoft: "border-emerald-400/10",
    bg: "bg-emerald-400/[0.045]",
    text: "text-emerald-100/76",
    muted: "text-emerald-100/42",
    glow: "shadow-[0_22px_80px_rgba(52,211,153,0.10)]",
    wash: "bg-[radial-gradient(circle_at_50%_0%,rgba(52,211,153,0.12),transparent_46%)]",
  };
}

const STOP_TERMS = [
  "chest pain",
  "chest / breathing",
  "breathing difficulty",
  "cannot breathe",
  "dizziness",
  "dizzy",
  "dizzy / confused",
  "confusion",
  "confused",
  "numbness",
  "numb / confused",
  "unstable",
  "unstable / swollen",
  "instability",
  "sharp",
  "concussion",
  "passed out",
  "fainted",
];

function includesStopSignal(value?: string | null) {
  const normalized = cleanSentence(value).toLowerCase();
  return STOP_TERMS.some((term) => normalized.includes(term));
}

function restrictionStopsTraining(value?: string | null) {
  const normalized = cleanSentence(value).toLowerCase();
  return ["no training", "do not train", "stop training", "rest only"].some((term) => normalized.includes(term));
}

export function buildTrainingConditionDecision({
  answers,
  session,
  intensity,
  authority,
}: {
  answers: Record<string, string>;
  session: string;
  intensity: string;
  authority: FuelAuthorityContract;
}): TrainingConditionDecision {
  const progress = getBodyCheckProgress(answers, session, intensity);
  const sleep = answerValue(answers, "sleep");
  const hydration = answerValue(answers, "hydration");
  const mealTiming = answerValue(answers, "meal_timing");
  const mealSize = answerValue(answers, "meal_size");
  const soreness = answerValue(answers, "soreness");
  const recovery = answerValue(answers, "recovery");
  const movementAffected = answerValue(answers, "movement_affected");
  const stomachIssue = answerValue(answers, "gi_discomfort");
  const practitionerRestriction = cleanSentence(answers.practitioner_restriction);
  const coachRestriction = authority.connectedCoach
    ? cleanSentence(answers.coach_restriction)
    : "";
  const authorityBoundary = authority.reviewPending
    ? "Coach review pending. The recorded correction is not approved yet."
    : authority.approvedMission
      ? "The approved correction remains unchanged."
      : authority.connectedCoach
        ? "No mission has been approved."
        : "This does not approve technical work.";
  const injuryRestriction = cleanSentence(answers.injury_restriction);
  const known = [
    `Athlete reported sleep: ${sleep}.`,
    `Athlete reported current state: ${recovery}.`,
    `Athlete reported fluids: ${hydration}.`,
    `Athlete reported pain or soreness: ${soreness}.`,
    `Planned demand entered as ${intensity.toLowerCase()} ${session.toLowerCase()}.`,
  ];
  const noConstraint: ConditionEnvelope = {
    intensity: "No additional Fuel constraint",
    resistance: "No additional Fuel constraint",
    unpredictability: "No additional Fuel constraint",
    volume: "No additional Fuel constraint",
    liveExposure: "Not assessed as clearance",
  };
  const stoppedEnvelope: ConditionEnvelope = {
    intensity: "Stop",
    resistance: "Stop",
    unpredictability: "Stop",
    volume: "Stop",
    liveExposure: "Stop",
  };

  if (progress.completed < progress.total) {
    const missing = progress.steps.filter((step) => !step.complete).map((step) => step.label);
    return {
      state: "NOT_ASSESSED",
      title: "Finish your body check",
      source: "Insufficient information",
      trainingAnswer: "Complete the check to see today’s limits.",
      reason: `Missing: ${missing.join(", ")}. Missing information is not evidence of poor condition.`,
      known: [],
      unknowns: missing.map((label) => `${label} has not been assessed.`),
      constraints: {
        intensity: "Not assessed",
        resistance: "Not assessed",
        unpredictability: "Not assessed",
        volume: "Not assessed",
        liveExposure: "Not assessed",
      },
      productiveBoundary: "No preparation limit has been set yet.",
      nextAction: "Complete the body check.",
      handoff: "Body check incomplete. No preparation limit has been set.",
      tone: "neutral",
    };
  }

  const safetyText = [
    answers.current_symptoms,
    answers.hydration_symptoms,
    answers.pain_quality,
    injuryRestriction,
  ].filter(Boolean).join(" ");

  if (includesStopSignal(safetyText)) {
    const reported = cleanSentence(answers.current_symptoms || answers.hydration_symptoms || answers.pain_quality || injuryRestriction) || "a defined safety concern";
    return {
      state: "STOP",
      title: "Stop and seek qualified support",
      source: "Safety rule",
      trainingAnswer: "No. Stop training.",
      reason: `You reported ${reported.toLowerCase()}. Fuel cannot assess or clear this symptom.`,
      known,
      unknowns: ["The cause and severity are unknown.", "Get qualified advice before returning to training."],
      constraints: stoppedEnvelope,
      productiveBoundary: "Stop the session. Do not substitute other training.",
      nextAction: "Stop training and seek appropriate qualified assessment.",
      handoff: `Safety escalation: athlete reported ${reported.toLowerCase()}. No training alternative suggested. Qualified review required.`,
      tone: "locked",
    };
  }

  if (practitionerRestriction) {
    if (restrictionStopsTraining(practitionerRestriction)) {
      return {
        state: "STOP",
        title: "Do not train",
        source: "Practitioner set",
        trainingAnswer: "No. A practitioner-set restriction stops training.",
        reason: practitionerRestriction,
        known: [`Practitioner-set restriction: ${practitionerRestriction}.`, ...known],
        unknowns: ["Fuel cannot determine when this restriction should change."],
        constraints: stoppedEnvelope,
        productiveBoundary: "Do not train until the practitioner changes the restriction.",
        nextAction: "Follow the practitioner restriction until the practitioner changes it.",
        handoff: `Practitioner restriction stops training: ${practitionerRestriction}`,
        tone: "locked",
      };
    }
    return {
      state: "REDUCED",
      title: "Practitioner restriction active",
      source: "Practitioner set",
      trainingAnswer: "Only inside the practitioner-set limits.",
      reason: practitionerRestriction,
      known: [`Practitioner-set restriction: ${practitionerRestriction}.`, ...known],
      unknowns: ["Fuel cannot interpret or expand the practitioner restriction."],
      constraints: {
        intensity: "Within practitioner restriction",
        resistance: "Within practitioner restriction",
        unpredictability: "Within practitioner restriction",
        volume: "Within practitioner restriction",
        liveExposure: "Only within the practitioner restriction",
      },
      productiveBoundary: "Keep intended work inside the practitioner’s restriction. Fuel cannot expand it.",
      nextAction: authority.reducedAction,
      handoff: `Practitioner restriction active: ${practitionerRestriction}. Fuel supplied no training content.`,
      tone: "caution",
    };
  }

  if (coachRestriction) {
    if (restrictionStopsTraining(coachRestriction)) {
      return {
        state: "STOP",
        title: "Do not train",
        source: "Coach set",
        trainingAnswer: "No. The coach-set restriction stops training.",
        reason: coachRestriction,
        known: [`Coach-set restriction: ${coachRestriction}.`, ...known],
        unknowns: ["Fuel cannot determine when the coach restriction should change."],
        constraints: stoppedEnvelope,
        productiveBoundary: "Do not train until your coach changes the restriction.",
        nextAction: "Follow the coach-set restriction until your connected coach changes it.",
        handoff: `Coach restriction stops training: ${coachRestriction}`,
        tone: "locked",
      };
    }
    return {
      state: "REDUCED",
      title: "Coach restriction active",
      source: "Coach set",
      trainingAnswer: "Only inside the coach-set limits.",
      reason: coachRestriction,
      known: [`Coach-set restriction: ${coachRestriction}.`, ...known],
      unknowns: ["Fuel cannot expand or replace the coach-set restriction."],
      constraints: {
        intensity: "Coach-set limit",
        resistance: "Coach-set limit",
        unpredictability: "Coach-set limit",
        volume: "Coach-set limit",
        liveExposure: "Coach-set limit",
      },
      productiveBoundary: "Only follow work your coach has approved inside the existing restriction.",
      nextAction: "Follow the existing coach-set limits and recheck if your condition changes.",
      handoff: `Coach restriction active: ${coachRestriction}. Fuel supplied no training content.`,
      tone: "caution",
    };
  }

  const hardDemand = intensity === "Hard" || ["Sparring", "Wrestling", "MMA"].includes(session);
  const limitations: string[] = [];

  if (injuryRestriction) limitations.push(`reported restriction: ${injuryRestriction}`);
  if (soreness === "High" && movementAffected !== "No") limitations.push("significant soreness that may alter movement");
  if (recovery === "Drained") limitations.push("a drained current physical state");
  if (sleep === "Poor" && hardDemand) limitations.push("poor sleep before a high-demand session");
  if (hydration === "Behind" && hardDemand) limitations.push("a fluid concern before a high-demand session");
  if (mealTiming === "Recent" && mealSize !== "Light" && hardDemand) limitations.push("a substantial meal too close to high-demand work");
  if (["Discomfort", "Nausea"].includes(stomachIssue)) limitations.push("current stomach discomfort that may disrupt the planned session");

  if ((injuryRestriction || soreness === "High") && ["Unsure", "Not checked"].includes(movementAffected)) {
    limitations.unshift("pain or soreness with an uncertain effect on movement");
  }

  if (limitations.length > 0) {
    const primary = limitations[0];
    const liveRestricted =
      Boolean(injuryRestriction) ||
      soreness === "High" ||
      movementAffected === "Yes" ||
      movementAffected === "Unsure";
    return {
      state: liveRestricted ? "LIVE_RESTRICTED" : "REDUCED",
      title: liveRestricted ? "Avoid live resistance today" : "Reduce today’s session",
      source: "Athlete reported",
      trainingAnswer: liveRestricted
        ? "Keep live resistance out and reduce the intended session."
        : "Adjust the intended session around today’s preparation limits.",
      reason: `Adjustment recommended because you reported ${primary} ahead of planned ${intensity.toLowerCase()} ${session.toLowerCase()}.`,
      known,
      unknowns: [
        "This decision is based on your answers only.",
        "This is not medical clearance or approval of technical work.",
      ],
      constraints: {
        intensity: "Reduce from planned level",
        resistance: liveRestricted ? "Controlled only" : "Reduce from planned level",
        unpredictability: "Reduce from planned level",
        volume: "Shorten from planned volume",
        liveExposure: liveRestricted ? "Avoid today" : "Do not increase",
      },
      productiveBoundary: authority.productiveBoundary,
      nextAction: authority.reducedAction,
      handoff: `Preparation adjustment: ${primary}. Reduce intensity, unpredictability, and volume${liveRestricted ? "; avoid live resistance" : ""}. ${authorityBoundary}`,
      tone: "caution",
    };
  }

  return {
    state: "NO_CONSTRAINT",
    title: "Train within today’s limits",
    source: "Fuel suggestion",
    trainingAnswer: "Yes. No preparation limit needs to change.",
    reason: "Your body check didn’t identify any preparation concerns for today’s session.",
    known,
    unknowns: [
      "This is based on your answers only.",
      "It is not medical clearance or approval for live training.",
    ],
    constraints: noConstraint,
    productiveBoundary: authority.productiveBoundary,
    nextAction: authority.readyAction,
    handoff: `No additional preparation limit was identified from today’s check-in. This is not medical clearance. ${authorityBoundary}`,
    tone: "clean",
  };
}

export function buildNextSessionPreparation({
  answers,
  session,
  intensity,
  authority,
}: {
  answers: Record<string, string>;
  session: string;
  intensity: string;
  authority: FuelAuthorityContract;
}): NextSessionPreparation {
  const decision = buildTrainingConditionDecision({ answers, session, intensity, authority });
  const hardDemand = intensity === "Hard" || ["Sparring", "Wrestling", "MMA"].includes(session);
  const mealTiming = answerValue(answers, "meal_timing");
  const mealSize = answerValue(answers, "meal_size");
  const stomach = answerValue(answers, "gi_discomfort");
  const hydration = answerValue(answers, "hydration");
  const recovery = answerValue(answers, "recovery");
  const sleep = answerValue(answers, "sleep");
  const soreness = answerValue(answers, "soreness");
  const signals: PreparationSignal[] = [];

  if (["Discomfort", "Nausea"].includes(stomach)) {
    signals.push({
      id: "meal",
      label: "Meal readiness",
      evidence: `Current stomach status: ${stomach.toLowerCase()}.`,
      action: "Do not begin hard or live work while symptoms are active. Seek appropriate support if they persist or worsen.",
      tone: "caution",
    });
  } else if (mealTiming === "Recent" && mealSize !== "Light" && hardDemand) {
    signals.push({
      id: "meal",
      label: "Meal readiness",
      evidence: "A substantial meal was reported close to high-demand work.",
      action: "Allow the meal to settle before hard or live work.",
      tone: "caution",
    });
  }

  if (hydration === "Behind") {
    signals.push({
      id: "hydration",
      label: "Fluids",
      evidence: "Fluids were reported behind before the planned session.",
      action: "Follow your existing hydration plan and recheck before training. Stop and seek qualified support if concerning symptoms appear.",
      tone: "caution",
    });
  }

  if (recovery === "Drained" || (sleep === "Poor" && hardDemand)) {
    signals.push({
      id: "recovery",
      label: "Recovery",
      evidence: recovery === "Drained" ? "You reported feeling drained." : "Poor sleep was reported before high-demand work.",
      action: "Use reduced conditions and reassess before increasing demand.",
      tone: "caution",
    });
  }

  if (soreness === "High" || cleanSentence(answers.injury_restriction)) {
    signals.push({
      id: "restriction",
      label: "Restriction",
      evidence: cleanSentence(answers.injury_restriction) || "High pain or soreness was reported.",
      action: decision.state === "STOP"
        ? decision.nextAction
        : "Keep resistance controlled and avoid live work until the concern is appropriately assessed.",
      tone: decision.state === "STOP" ? "locked" : "caution",
    });
  }

  if (!signals.length && decision.state !== "NOT_ASSESSED") {
    signals.push({
      id: "plan",
      label: "Preparation",
      evidence: "No reported preparation issue changes the current decision.",
      action: authority.readyAction,
      tone: "clean",
    });
  }

  const status: NextSessionPreparation["status"] = decision.state === "STOP"
    ? "STOP"
    : ["REDUCED", "LIVE_RESTRICTED"].includes(decision.state)
        ? "ADJUST"
        : "ON_TRACK";

  return {
    session: `${intensity} ${session}`,
    status,
    title: status === "STOP"
      ? "Preparation stopped"
      : status === "ADJUST"
          ? "Preparation needs an adjustment"
          : "Preparation is on track",
    action: decision.nextAction,
    signals:
      decision.state === "STOP"
        ? signals.map((signal) => ({
            ...signal,
            action: decision.nextAction,
            tone: "locked" as const,
          }))
        : signals,
  };
}

function answerValue(answers: Record<string, string>, key: string) {
  return cleanSentence(answers[key]) || "Not checked";
}

const bodyCheckSteps = [
  { key: "sleep", label: "Sleep" },
  { key: "recovery", label: "Current state" },
  { key: "hydration", label: "Fluids" },
  { key: "meal_timing", label: "Meal timing" },
  { key: "soreness", label: "Pain / soreness" },
  { key: "session_load", label: "Session Load" },
] as const;

const BODY_CHECK_OPEN_EVENT = "fuel:open-body-check";

function getBodyCheckProgress(answers: Record<string, string>, session = "", intensity = "") {
  const steps = bodyCheckSteps.map((step) => ({
    ...step,
    complete: (() => {
      const value = answerValue(answers, step.key);
      if (step.key === "session_load") {
        return Boolean(session && intensity);
      }
      if (value === "Not checked") return false;
      if (step.key === "recovery" && ["Drained", "Flat"].includes(value)) {
        return answerValue(answers, "current_symptoms") !== "Not checked";
      }
      if (step.key === "hydration" && value === "Behind") {
        return answerValue(answers, "hydration_symptoms") !== "Not checked";
      }
      if (step.key === "meal_timing") {
        const stomachChecked = answerValue(answers, "gi_discomfort") !== "Not checked";
        const sizeChecked = value !== "Recent" || answerValue(answers, "meal_size") !== "Not checked";
        return stomachChecked && sizeChecked;
      }
      if (step.key === "soreness" && ["High", "Moderate"].includes(value)) {
        return answerValue(answers, "movement_affected") !== "Not checked";
      }
      return true;
    })(),
  }));

  return {
    steps,
    completed: steps.filter((step) => step.complete).length,
    total: steps.length,
  };
}

function openBodyCheckFlow() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(BODY_CHECK_OPEN_EVENT));
}

function Surface({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-[22px] border border-white/[0.075] bg-[#121c2b]/92 backdrop-blur-xl transition-all duration-200 ease-app",
        className
      )}
    >
      {children}
    </div>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <p className="text-[12px] font-semibold tracking-[0.035em] text-white/70">{children}</p>;
}

function MissionHero({
  running,
  answers,
  session,
  intensity,
  authority,
}: {
  running: boolean;
  answers: Record<string, string>;
  session: string;
  intensity: string;
  authority: AuthorityView;
}) {
  const authorityContract = fuelAuthorityContract(authority.authorityState);
  const decision = buildTrainingConditionDecision({
    answers,
    session,
    intensity,
    authority: authorityContract,
  });
  const p = palette(decision.tone);
  const assessed = decision.state !== "NOT_ASSESSED";
  const [copied, setCopied] = useState(false);
  const sourceLabel = decision.source === "Fuel suggestion" ? "Based on your check-in" : decision.source;
  const checkInSummary = [
    `Sleep: ${answerValue(answers, "sleep")}`,
    `Body: ${answerValue(answers, "recovery")}`,
    `Fluids: ${answerValue(answers, "hydration")}`,
    `Pain / soreness: ${answerValue(answers, "soreness")}`,
    `${intensity} ${session}`,
  ].join(" · ");

  const copyHandoff = async () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      await navigator.clipboard.writeText(decision.handoff);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    }
  };

  if (!assessed) {
    return (
      <Surface className={cn("relative overflow-hidden p-6 sm:p-8", p.glow)}>
        <div className={cn("pointer-events-none absolute inset-0", p.wash)} />
        <div className="relative grid gap-7 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              <Eyebrow>Before training</Eyebrow>
            </div>
            <h1 className="mt-3 max-w-3xl text-[32px] font-semibold leading-[1.02] tracking-[-.035em] text-white sm:text-[40px]">
              {authority.fuel.heading}
            </h1>
            <p className="mt-4 max-w-2xl text-base font-medium leading-7 text-white/66">
              {authority.fuel.body}
            </p>
            <p className="mt-5 text-sm font-semibold text-white/42">{authority.fuel.supportingCopy}</p>
            <span className="mt-4 inline-flex rounded-full border border-white/[0.08] bg-white/[0.035] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.04em] text-white/52">
              {authorityContract.authorityDetail}
            </span>
          </div>
          <button type="button" onClick={openBodyCheckFlow} className="app-button-accent group min-h-12 px-6">
            Start body check
            <span className="text-xl transition-transform duration-200 group-hover:translate-x-0.5">›</span>
          </button>
        </div>
      </Surface>
    );
  }

  return (
    <Surface className={cn("relative overflow-hidden p-6 sm:p-8", p.glow)}>
      <div className={cn("pointer-events-none absolute inset-0", p.wash)} />
      <div className="relative">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color }} />
            <Eyebrow>{running ? "Assessing conditions" : "Today’s training condition"}</Eyebrow>
          </div>
          <span className={cn("rounded-full border px-3 py-1.5 text-[11px] font-semibold tracking-[0.04em]", p.border, p.bg, p.text)}>{sourceLabel}</span>
        </div>

        <h1 className="mt-4 max-w-4xl text-[32px] font-semibold leading-[1.02] tracking-[-.035em] text-white sm:text-[40px]">{decision.title}</h1>
        <p className="mt-5 max-w-3xl text-base font-medium leading-7 text-white/74">{decision.reason}</p>

        <div className={cn("mt-7 rounded-[22px] border p-5", p.borderSoft, p.bg)}>
          <p className={cn("text-[10px] font-semibold uppercase tracking-[0.04em]", p.text)}>Can I train?</p>
          <p className="mt-3 text-xl font-semibold leading-8 text-white">{decision.trainingAnswer}</p>
        </div>

        <div className="mt-4 rounded-[22px] border border-white/[0.07] bg-[#0a1421]/72 p-5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.04em] text-white/36">What to do next</p>
          <p className="mt-2 text-base font-bold leading-6 text-white/84">{decision.nextAction}</p>
        </div>

        <details className="group mt-4 overflow-hidden rounded-[22px] border border-white/[0.07] bg-black/10">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 transition hover:bg-white/[0.025]">
            <div>
              <p className="text-sm font-bold text-white">Decision details</p>
              <p className="mt-1 text-xs font-medium text-white/42">See today&apos;s limits, your check-in, and the preparation note</p>
            </div>
            <span className="text-xl text-white/42 transition-transform duration-200 group-open:rotate-90">›</span>
          </summary>

        <div className="overflow-hidden border-t border-white/[0.06]">
          <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
            <div>
              <p className="text-sm font-bold text-white">Today&apos;s limits</p>
              <p className="mt-1 text-xs font-medium text-white/42">{authority.fuel.body}</p>
            </div>
            <span className="text-[10px] font-semibold uppercase tracking-[0.04em] text-white/36">{sourceLabel}</span>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-5">
            {([
              ["Intensity", decision.constraints.intensity],
              ["Resistance", decision.constraints.resistance],
              ["Unplanned resistance", decision.constraints.unpredictability],
              ["Volume", decision.constraints.volume],
              ["Live work", decision.constraints.liveExposure],
            ] as const).map(([label, value]) => (
              <div key={label} className="border-b border-white/[0.06] px-4 py-4 last:border-b-0 sm:border-r lg:border-b-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.04em] text-white/34">{label}</p>
                <p className="mt-2 text-sm font-semibold leading-5 text-white/72">{value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-3 border-t border-white/[0.06] p-4 lg:grid-cols-3">
          <div className="rounded-2xl border border-white/[0.07] bg-[#0a1421]/72 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.04em] text-white/36">What you can do</p>
            <p className="mt-2 text-sm font-medium leading-6 text-white/66">{decision.productiveBoundary}</p>
          </div>
          <div className="rounded-2xl border border-white/[0.07] bg-[#0a1421]/72 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.04em] text-white/36">Your check-in</p>
            <p className="mt-2 text-sm font-medium leading-6 text-white/66">{checkInSummary}</p>
          </div>
          <div className="rounded-2xl border border-white/[0.07] bg-[#0a1421]/72 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.04em] text-white/36">What remains unknown</p>
            <p className="mt-2 text-sm font-medium leading-6 text-white/66">{decision.unknowns.join(" ")}</p>
          </div>
        </div>

        <div className="flex flex-col gap-4 border-t border-white/[0.06] bg-[#0a1421]/72 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.04em] text-white/36">{authorityContract.handoffLabel} · {sourceLabel}</p>
            <p className="mt-2 text-sm font-medium leading-6 text-white/66">{decision.handoff}</p>
          </div>
          <div className="flex shrink-0 gap-2">
            <button type="button" onClick={copyHandoff} className="rounded-xl border border-white/[0.08] bg-white/[0.045] px-4 py-3 text-xs font-bold text-white/64 transition hover:bg-white/[0.08] hover:text-white">{copied ? "Copied" : authorityContract.copyLabel}</button>
            <button type="button" onClick={openBodyCheckFlow} className="rounded-xl border border-white/[0.08] bg-white/[0.045] px-4 py-3 text-xs font-bold text-white/64 transition hover:bg-white/[0.08] hover:text-white">Edit check-in</button>
          </div>
        </div>
        </details>
      </div>
    </Surface>
  );
}

function PreparationBrief({
  answers,
  session,
  intensity,
  authority,
}: {
  answers: Record<string, string>;
  session: string;
  intensity: string;
  authority: AuthorityView;
}) {
  const authorityContract = fuelAuthorityContract(authority.authorityState);
  const decision = buildTrainingConditionDecision({
    answers,
    session,
    intensity,
    authority: authorityContract,
  });
  if (decision.state === "NOT_ASSESSED") return null;

  const brief = buildNextSessionPreparation({
    answers,
    session,
    intensity,
    authority: authorityContract,
  });
  const statusTone: Tone = brief.status === "STOP"
    ? "locked"
    : brief.status === "ADJUST"
      ? "caution"
      : "clean";
  const p = palette(statusTone);
  const statusLabel = brief.status === "ON_TRACK"
    ? "On track"
    : brief.status === "ADJUST"
      ? "Adjust"
      : "Stop";

  return (
    <section aria-labelledby="next-session-preparation">
      <Surface className="overflow-hidden">
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6">
          <div>
            <Eyebrow>{authorityContract.authorityLabel} · {brief.session}</Eyebrow>
            <h2 id="next-session-preparation" className="mt-2 text-xl font-semibold text-white">{brief.title}</h2>
            <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-white/58">{brief.action}</p>
          </div>
          <span className={cn("w-fit rounded-full border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.04em]", p.border, p.bg, p.text)}>{statusLabel}</span>
        </div>

        <div className="border-t border-white/[0.06]">
          {brief.signals.map((signal) => {
            const signalPalette = palette(signal.tone);
            return (
              <div key={signal.id} className="grid gap-2 border-b border-white/[0.06] px-5 py-4 last:border-b-0 sm:grid-cols-[150px_1fr_1.35fr] sm:gap-5 sm:px-6">
                <p className={cn("text-xs font-bold", signalPalette.text)}>{signal.label}</p>
                <p className="text-sm font-medium leading-6 text-white/48">{signal.evidence}</p>
                <p className="text-sm font-semibold leading-6 text-white/76">{signal.action}</p>
              </div>
            );
          })}
        </div>
      </Surface>
    </section>
  );
}

function Modules({
  session,
  intensity,
  answers,
}: {
  session: string;
  intensity: string;
  answers: Record<string, string>;
}) {
  const progress = getBodyCheckProgress(answers, session, intensity);
  const progressPercent = Math.round((progress.completed / progress.total) * 100);

  return (
    <section>
      <Surface className="overflow-hidden p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-lg font-semibold text-white">Body check</h2>
              <p className="text-xs font-semibold text-white/46">{progress.completed}/{progress.total}</p>
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-emerald-400 transition-all duration-200 ease-app" style={{ width: `${progressPercent}%` }} />
            </div>
          </div>
          <button
            type="button"
            onClick={openBodyCheckFlow}
            className="app-button-secondary min-h-11 px-5"
          >
            {progress.completed === 0 ? "Begin check-in" : progress.completed === progress.total ? "Review check-in" : "Continue check-in"}
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {progress.steps.map((step, index) => (
            <button
              key={step.key}
              type="button"
              onClick={openBodyCheckFlow}
              className={cn(
                "flex min-h-10 items-center gap-2 rounded-xl border px-3 text-left text-xs font-semibold transition-all duration-200",
                step.complete
                  ? "border-emerald-300/18 bg-emerald-400/[0.07] text-emerald-100/80"
                  : "border-white/[0.07] bg-black/10 text-white/42 hover:bg-white/[0.04] hover:text-white/68"
              )}
            >
              <span className={cn("flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px]", step.complete ? "bg-emerald-400 text-[#03100a]" : "bg-white/[0.07] text-white/48")}>{step.complete ? "✓" : index + 1}</span>
              <span className="truncate">{step.label}</span>
            </button>
          ))}
        </div>
      </Surface>
    </section>
  );
}

function CommandDock({
  sessionValue,
  setSession,
  intensity,
  setIntensity,
  answers,
  setAnswers,
  authority,
}: {
  sessionValue: string;
  setSession: (v: string) => void;
  intensity: string;
  setIntensity: (v: string) => void;
  answers: Record<string, string>;
  setAnswers: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  authority: AuthorityView;
}) {
  const [open, setOpen] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const progress = getBodyCheckProgress(answers, sessionValue, intensity);
  const progressSignature = progress.steps.map((step) => step.complete ? "1" : "0").join("");

  useEffect(() => {
    const openFlow = () => {
      const firstIncomplete = progressSignature.indexOf("0");
      setActiveStep(firstIncomplete === -1 ? progress.total - 1 : firstIncomplete);
      setOpen(true);
    };

    window.addEventListener(BODY_CHECK_OPEN_EVENT, openFlow);
    return () => window.removeEventListener(BODY_CHECK_OPEN_EVENT, openFlow);
  }, [progressSignature, progress.total]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return (
    <div id="fuel-command-dock">
      {open && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-[#020813]/80 p-0 backdrop-blur-md sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label="Pre-training body check" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
          <div className="max-h-[94vh] w-full overflow-y-auto rounded-t-[28px] border border-white/[0.10] bg-[#0b1523] shadow-[0_32px_100px_rgba(0,0,0,0.55)] sm:max-w-2xl sm:rounded-[28px]">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/[0.07] bg-[#0b1523]/95 px-5 py-4 backdrop-blur-xl sm:px-6">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.04em] text-emerald-300/70">Pre-training</p>
                <h2 className="mt-1 text-xl font-extrabold text-white">Body check</h2>
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close body check" className="flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.06] text-xl text-white/60 transition hover:bg-white/[0.10] hover:text-white">×</button>
            </div>

            <div className="space-y-4 p-5 sm:p-6">
              <ReadinessCheckIn
                answers={answers}
                setAnswers={setAnswers}
                session={sessionValue}
                setSession={setSession}
                intensity={intensity}
                setIntensity={setIntensity}
                activeStep={activeStep}
                setActiveStep={setActiveStep}
                authority={authority}
              />

          <div className="sticky bottom-0 -mx-5 -mb-5 border-t border-white/[0.07] bg-[#0b1523]/96 px-5 py-4 backdrop-blur-xl sm:-mx-6 sm:-mb-6 sm:px-6">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-semibold text-white/46">{progress.completed} of {progress.total} complete</p>
              <button
                type="button"
                onClick={() => {
                  if (progress.completed < progress.total) {
                    const firstIncomplete = progress.steps.findIndex((step) => !step.complete);
                    setActiveStep(Math.max(0, firstIncomplete));
                    return;
                  }
                  setOpen(false);
                }}
                className={cn("app-button min-h-12 px-6", progress.completed === progress.total ? "bg-emerald-400 text-[#03100a] hover:bg-emerald-300" : "bg-white/[0.07] text-white/58 hover:bg-white/[0.10]")}
              >
                {progress.completed < progress.total ? "Continue check-in" : "Set today’s conditions"}
              </button>
            </div>
          </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ContextInput({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  className,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: "text" | "date" | "number";
  placeholder?: string;
  className?: string;
}) {
  return (
    <label className={className}>
      <span className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.04em] text-white/36">{label}</span>
      <input
        type={type}
        value={value}
        min={type === "number" ? "0" : undefined}
        step={type === "number" ? "0.1" : undefined}
        inputMode={type === "number" ? "decimal" : undefined}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-white/[0.08] bg-[#0c1624] px-3 py-3 text-sm font-medium text-white outline-none transition placeholder:text-white/24 focus:border-emerald-400/35"
      />
    </label>
  );
}

const readinessChecks = [
  { key: "sleep", label: "Sleep", question: "How did you sleep?", reason: "Poor sleep can lower the limit for hard or live work.", options: ["Poor", "Fair", "Good"] },
  { key: "recovery", label: "Current state", question: "How much do you have right now?", reason: "A drained state reduces today’s intensity and volume.", options: ["Drained", "Flat", "Ready"] },
  { key: "hydration", label: "Fluids", question: "Are your fluids on track?", reason: "Being behind can delay or reduce high-demand work.", options: ["Behind", "On track", "Loaded"] },
  { key: "meal_timing", label: "Meal timing", question: "Is your last meal settled?", reason: "A recent substantial meal or stomach issue can constrain high-demand work.", options: ["Empty", "Recent", "Settled"] },
  { key: "soreness", label: "Pain / soreness", question: "How much pain or soreness is present?", reason: "Only note whether it changes movement or today’s session.", options: ["High", "Moderate", "Low"] },
] as const;

function ReadinessCheckIn({
  answers,
  setAnswers,
  session,
  setSession,
  intensity,
  setIntensity,
  activeStep,
  setActiveStep,
  authority,
}: {
  answers: Record<string, string>;
  setAnswers: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  session: string;
  setSession: (value: string) => void;
  intensity: string;
  setIntensity: (value: string) => void;
  activeStep: number;
  setActiveStep: React.Dispatch<React.SetStateAction<number>>;
  authority: AuthorityView;
}) {
  const progress = getBodyCheckProgress(answers, session, intensity);
  const authorityContract = fuelAuthorityContract(authority.authorityState);
  const checks = readinessChecks;
  const activeCheck = checks[Math.min(activeStep, checks.length - 1)];
  const advance = () => setActiveStep((current) => Math.min(current + 1, progress.total - 1));

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-black/10 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-white">Today’s body check</p>
          <p className="mt-1 text-xs font-medium text-white/42">
            Question {Math.min(activeStep + 1, progress.total)} of {progress.total}
          </p>
        </div>
        <span className="rounded-full border border-emerald-400/15 bg-emerald-400/[0.06] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.04em] text-emerald-200/70">
          Pre-session
        </span>
      </div>

      <div className="mt-4 flex gap-1.5">
        {progress.steps.map((step, index) => (
          <button
            key={step.key}
            type="button"
            onClick={() => setActiveStep(index)}
            aria-label={`Open ${step.label}`}
            className={cn(
              "h-1.5 flex-1 rounded-full transition-all duration-200 ease-app",
              step.complete ? "bg-emerald-400" : index === activeStep ? "bg-white/45" : "bg-white/10"
            )}
          />
        ))}
      </div>

      <div key={activeStep} className="mt-5 animate-[fuelDecisionIn_350ms_cubic-bezier(0.2,0.8,0.2,1)_both]">
        {activeStep < checks.length && activeCheck ? (
          <div>
            <p className="text-lg font-semibold text-white">{activeCheck.question}</p>
            <p className="mt-1 text-sm font-medium text-white/44">{activeCheck.reason}</p>
            <div className="mt-5">
              <CheckInControl
                label={activeCheck.label}
                options={activeCheck.options}
                value={answers[activeCheck.key] || ""}
                onChange={(value) => {
                  setAnswers((current) => ({ ...current, [activeCheck.key]: value }));
                  const needsFollowUp =
                    (activeCheck.key === "recovery" && ["Drained", "Flat"].includes(value)) ||
                    (activeCheck.key === "hydration" && value === "Behind") ||
                    activeCheck.key === "meal_timing" ||
                    (activeCheck.key === "soreness" && ["High", "Moderate"].includes(value));
                  if (!needsFollowUp) window.setTimeout(advance, 180);
                }}
              />
              {activeCheck.key === "recovery" && ["Drained", "Flat"].includes(answers.recovery || "") && (
                <div className="mt-5 rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
                  <CheckInControl
                    label="Any concerning symptom right now?"
                    options={["None", "Chest / breathing", "Numb / confused"]}
                    value={answers.current_symptoms || ""}
                    onChange={(value) => {
                      setAnswers((current) => ({ ...current, current_symptoms: value }));
                      window.setTimeout(advance, 180);
                    }}
                  />
                </div>
              )}
              {activeCheck.key === "hydration" && answers.hydration === "Behind" && (
                <div className="mt-5 rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
                  <CheckInControl
                    label="Is there a symptom with it?"
                    options={["No symptom", "Headache", "Dizzy / confused"]}
                    value={answers.hydration_symptoms || ""}
                    onChange={(value) => {
                      setAnswers((current) => ({ ...current, hydration_symptoms: value }));
                      window.setTimeout(advance, 180);
                    }}
                  />
                </div>
              )}
              {activeCheck.key === "meal_timing" && Boolean(answers.meal_timing) && (
                <div className="mt-5 rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
                  <div className="space-y-4">
                    {answers.meal_timing === "Recent" && (
                      <CheckInControl
                        label="How substantial was it?"
                        options={["Light", "Substantial", "Not sure"]}
                        value={answers.meal_size || ""}
                        onChange={(value) => {
                          setAnswers((current) => ({ ...current, meal_size: value }));
                          if (answers.gi_discomfort) window.setTimeout(advance, 180);
                        }}
                      />
                    )}
                    <CheckInControl
                      label="Any stomach issue now?"
                      options={["None", "Discomfort", "Nausea"]}
                      value={answers.gi_discomfort || ""}
                      onChange={(value) => {
                        setAnswers((current) => ({ ...current, gi_discomfort: value }));
                        if (answers.meal_timing !== "Recent" || answers.meal_size) window.setTimeout(advance, 180);
                      }}
                    />
                  </div>
                </div>
              )}
              {activeCheck.key === "soreness" && ["High", "Moderate"].includes(answers.soreness || "") && (
                <div className="mt-5 rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
                  <CheckInControl
                    label="Does it alter movement or today’s session?"
                    options={["No", "Unsure", "Yes"]}
                    value={answers.movement_affected || ""}
                    onChange={(value) => {
                      setAnswers((current) => ({ ...current, movement_affected: value }));
                      window.setTimeout(advance, 180);
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        ) : (
          <div>
            <p className="text-lg font-semibold text-white">What do you plan to do today?</p>
            <p className="mt-1 text-sm font-medium text-white/44">Choose the session and effort you have planned.</p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <Field label="Session today">
                <Select value={session} onChange={setSession} options={["MMA", "Wrestling", "Boxing", "Padwork", "Sparring", "Strength", "Run", "Rest"]} />
              </Field>
              <Field label="Intensity">
                <Select value={intensity} onChange={setIntensity} options={["Easy", "Standard", "Hard"]} />
              </Field>
            </div>
            <div className="mt-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.04em] text-white/38">Coach approval</p>
                <p className="mt-2 rounded-xl border border-white/[0.07] bg-[#091321] px-4 py-3 text-sm font-semibold text-white/72">
                  {authorityContract.authorityDetail}
                </p>
              </div>
            </div>
            <p className="mt-3 text-xs font-medium text-emerald-200/70">
              Fuel can limit today&apos;s session. It cannot select or change technical work.
            </p>
          </div>
        )}
      </div>

      <div className="mt-5 flex items-center justify-between border-t border-white/[0.06] pt-4">
        <button type="button" disabled={activeStep === 0} onClick={() => setActiveStep((current) => Math.max(0, current - 1))} className="rounded-xl px-3 py-2 text-sm font-bold text-white/48 transition hover:bg-white/[0.05] hover:text-white disabled:cursor-not-allowed disabled:opacity-25">Back</button>
        <button type="button" disabled={activeStep >= progress.total - 1} onClick={advance} className="rounded-xl px-3 py-2 text-sm font-bold text-white/70 transition hover:bg-white/[0.05] hover:text-white disabled:cursor-not-allowed disabled:opacity-25">Next</button>
      </div>

      <details className="mt-3 border-t border-white/[0.06] pt-3">
        <summary className="cursor-pointer list-none text-xs font-semibold text-white/42 transition hover:text-white/70">
          {authorityContract.connectedCoach
            ? "Add a restriction set by you, your coach, or a practitioner"
            : "Add a restriction set by you or a practitioner"}
        </summary>
        <div className="mt-4 space-y-4">
          <ContextInput label="Athlete-reported restriction" value={answers.injury_restriction || ""} placeholder="e.g. right knee pain, no sprawls" onChange={(value) => setAnswers((current) => ({ ...current, injury_restriction: value }))} />
          {cleanSentence(answers.injury_restriction) && (
            <div className="space-y-4 rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
              <CheckInControl label="What best describes it?" options={["Dull / expected", "Sharp", "Unstable / swollen"]} value={answers.pain_quality || ""} onChange={(value) => setAnswers((current) => ({ ...current, pain_quality: value }))} />
            </div>
          )}
          {authorityContract.connectedCoach ? (
            <ContextInput label="Coach-set restriction" value={answers.coach_restriction || ""} placeholder="e.g. no live rounds, six sets maximum" onChange={(value) => setAnswers((current) => ({ ...current, coach_restriction: value }))} />
          ) : null}
          <ContextInput label="Practitioner-set restriction" value={answers.practitioner_restriction || ""} placeholder="Use the practitioner’s exact restriction" onChange={(value) => setAnswers((current) => ({ ...current, practitioner_restriction: value }))} />
        </div>
      </details>
    </div>
  );
}

function CheckInControl({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly string[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.04em] text-white/38">{label}</p>
      <div className="grid grid-cols-3 gap-1 rounded-xl border border-white/[0.06] bg-[#091321] p-1">
        {options.map((option) => {
          const active = value === option;
          return (
            <button
              key={option}
              type="button"
              onClick={() => onChange(option)}
              className={cn(
                "min-h-9 rounded-lg px-2 text-xs font-semibold transition-all duration-200 active:scale-[0.98]",
                active
                  ? "bg-emerald-400/14 text-emerald-100 shadow-[0_6px_18px_rgba(52,211,153,0.10)]"
                  : "text-white/42 hover:bg-white/[0.05] hover:text-white/72"
              )}
            >
              {option}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.04em] text-white/36">{label}</label>
      {children}
    </div>
  );
}

function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-2xl border border-white/[0.08] bg-[#0c1624] px-4 py-3 text-sm font-medium text-white outline-none transition focus:border-emerald-400/35"
    >
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  );
}

export default function FuelScreen({
  embedded = false,
  authority,
  authLoading,
  hasUser,
  sessionValue,
  setSession,
  intensity,
  setIntensity,
  running,
  error,
  answers,
  setAnswers,
}: FuelScreenProps) {
  const authorityContract = fuelAuthorityContract(authority.authorityState);
  const conditionDecision = buildTrainingConditionDecision({
    answers,
    session: sessionValue,
    intensity,
    authority: authorityContract,
  });
  const p = palette(conditionDecision.tone);

  return (
    <main className={cn(embedded ? "min-h-0 bg-transparent text-white" : "min-h-screen bg-[#07111e] text-white")}>
      <style jsx global>{`
        @keyframes fuelDecisionIn {
          from { opacity: 0; transform: translateY(8px) scale(0.99); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
      <div className={cn("pointer-events-none inset-0", embedded ? "absolute" : "fixed")}>
        <div className={cn("absolute inset-0 transition-all duration-200 ease-app", p.wash)} />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.022)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.014)_1px,transparent_1px)] bg-[size:48px_48px] opacity-20" />
      </div>

      <div className={cn("relative mx-auto max-w-[1180px] px-4 py-6", embedded ? "pb-5" : "pb-24")}>
        <div className="space-y-5">
          <MissionHero
            running={running}
            answers={answers}
            session={sessionValue}
            intensity={intensity}
            authority={authority}
          />

          <PreparationBrief
            answers={answers}
            session={sessionValue}
            intensity={intensity}
            authority={authority}
          />

          {!authLoading && !hasUser && (
            <Surface className="border-rose-400/20 bg-rose-400/[0.05] p-4">
              <p className="text-sm font-medium leading-6 text-rose-100/80">
                Sign in to use Fuel.{" "}
                <Link
                  href="/auth/login"
                  className="font-semibold text-rose-200 underline decoration-rose-400/40 underline-offset-4"
                >
                  Login
                </Link>
              </p>
            </Surface>
          )}

          {error && (
            <Surface className="border-rose-400/20 bg-rose-400/[0.05] p-4">
              <p className="text-sm font-medium leading-6 text-rose-100/80">{error}</p>
            </Surface>
          )}

          <Modules
            session={sessionValue}
            intensity={intensity}
            answers={answers}
          />

          <CommandDock
            sessionValue={sessionValue}
            setSession={setSession}
            intensity={intensity}
            setIntensity={setIntensity}
            answers={answers}
            setAnswers={setAnswers}
            authority={authority}
          />
        </div>
      </div>
    </main>
  );
}





