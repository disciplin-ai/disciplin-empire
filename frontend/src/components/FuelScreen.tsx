"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Inter_Tight } from "next/font/google";
import FuelScoreChart, { FuelHistoryPoint } from "./FuelScoreChart";
import type { FuelOutput } from "@/lib/fuelTypes";

const interTight = Inter_Tight({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800", "900"],
  display: "swap",
});

type Mode = "text" | "photo";
type Conf = "low" | "med" | "high";
type FuelState = "CLEAN" | "LOW" | "TRASH" | "LOCKED" | "NO DATA";
type Tone = "clean" | "optimal" | "caution" | "low" | "trash" | "locked" | "neutral";

type FuelDecisionLayer = {
  assessment: string;
  impact: string;
  decision: string;
  next_steps: string[];
  pattern_line?: string;
};

export type FuelDecisionOutput = FuelOutput & FuelDecisionLayer;

type FuelMemoryEntry = {
  id: string;
  date: string;
  mealText: string;
  foodSignals: string[];
  score: number | null;
  state: FuelState;
  sleep: string;
  hydration: string;
  recovery: string;
  soreness: string;
  mealTiming: string;
  injury: string;
  session: string;
  intensity: string;
  timeOfTraining: string;
  campPhase: string;
  daysOut: number | null;
  weightRisk: string;
  limiter: string;
  decision: string;
  recoveryDecision: string;
  trainingCeiling: string;
  senseiImpact: string;
  visionImpact: string;
  outcome: "works" | "hurts" | "neutral";
};

type FuelMemory = {
  entries: FuelMemoryEntry[];
  sleepStreak: number;
  fatigueTrend: string;
  recoveryTrend: string;
  injuryRestriction: string;
  poorReadinessDays: number;
  highOutputDays: number;
  correctionFailures: number;
  foodsThatWork: string;
  foodsThatHurt: string;
  mealTimingPattern: string;
  hydrationPattern: string;
  sleepPattern: string;
  readinessPattern: string;
  hydrationTrend: string;
  mealTimingMemory: string;
  recoveryDecision: string;
  trainingCeilingHistory: string;
  technicalQualityImpact: string;
  routineMemory: string;
  osImpact: string;
  personalAnswer: string;
  coachRead: string;
  senseiHandoff: string;
  action: string;
  tone: Tone;
};

type FuelScreenProps = {
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

function compact(text?: string | null, max = 170) {
  const value = cleanSentence(text);
  if (!value) return "Awaiting pre-training body check.";
  return value.length <= max ? value : `${value.slice(0, max - 1).trim()}...`;
}

function clampScore(score?: number | null) {
  if (typeof score !== "number" || Number.isNaN(score)) return null;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function fmtRange(value?: [number, number] | number[]) {
  if (!Array.isArray(value) || value.length < 2) return "--";
  const lo = Math.round(Number(value[0] || 0));
  const hi = Math.round(Number(value[1] || 0));
  return `${lo}-${hi}`;
}

function deriveFuelState(out: FuelDecisionOutput | null): FuelState {
  if (!out) return "NO DATA";

  const rating = String(out.rating || "").toUpperCase();
  const decision = cleanSentence(out.decision).toUpperCase();
  const score = clampScore(out.score);

  if (rating === "LOCKED" || decision.includes("DO NOT PUSH")) return "LOCKED";
  if (rating === "CLEAN") return "CLEAN";
  if (rating === "TRASH") return "TRASH";
  if (rating === "LOW" || rating === "MID") return "LOW";

  if (score === null) return "NO DATA";
  if (score >= 75) return "CLEAN";
  if (score >= 45) return "LOW";
  return "TRASH";
}

function toneForState(state: FuelState): Tone {
  if (state === "CLEAN") return "clean";
  if (state === "LOW") return "low";
  if (state === "TRASH") return "trash";
  if (state === "LOCKED") return "locked";
  return "neutral";
}

function readinessTone(state: FuelState, score?: number | null): Tone {
  if (state === "CLEAN" && typeof score === "number" && score >= 90) return "optimal";
  return toneForState(state);
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
      glow: "shadow-[0_22px_90px_rgba(52,211,153,0.28)]",
      wash: "bg-[radial-gradient(circle_at_50%_0%,rgba(52,211,153,0.28),transparent_46%)]",
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
      glow: "shadow-[0_24px_110px_rgba(110,231,183,0.34)]",
      wash: "bg-[radial-gradient(circle_at_50%_0%,rgba(110,231,183,0.34),transparent_46%)]",
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
      glow: "shadow-[0_22px_80px_rgba(251,191,36,0.15)]",
      wash: "bg-[radial-gradient(circle_at_50%_0%,rgba(251,191,36,0.18),transparent_46%)]",
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
      glow: "shadow-[0_22px_90px_rgba(251,113,133,0.18)]",
      wash: "bg-[radial-gradient(circle_at_50%_0%,rgba(251,113,133,0.20),transparent_46%)]",
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
      glow: "shadow-[0_22px_90px_rgba(251,113,133,0.18)]",
      wash: "bg-[radial-gradient(circle_at_50%_0%,rgba(251,113,133,0.20),transparent_46%)]",
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
      glow: "shadow-[0_22px_90px_rgba(245,158,11,0.18)]",
      wash: "bg-[radial-gradient(circle_at_50%_0%,rgba(245,158,11,0.20),transparent_46%)]",
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

type FightContext = {
  daysOut: number | null;
  phase: string;
  guidance: string;
  weightRisk: string;
  tone: Tone;
  weightRiskTone: Tone;
};

function getFightContext(answers: Record<string, string>): FightContext {
  const rawDate = cleanSentence(answers.fight_date);
  const currentWeight = Number(answers.current_weight);
  const targetWeight = Number(answers.target_weight);
  let daysOut: number | null = null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
    const [year, month, day] = rawDate.split("-").map(Number);
    const fightDate = new Date(year, month - 1, day);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    fightDate.setHours(0, 0, 0, 0);
    daysOut = Math.max(0, Math.ceil((fightDate.getTime() - today.getTime()) / 86_400_000));
  }

  let phase = "NO FIGHT SET";
  let guidance = "Set the next competition to activate camp control.";
  let tone: Tone = "neutral";

  if (daysOut !== null && daysOut <= 3) {
    phase = "SAFETY FIRST";
    guidance = "No aggressive cut or fueling advice. Protect the fighter and follow the cut team.";
    tone = "locked";
  } else if (daysOut !== null && daysOut <= 14) {
    phase = "CUT CONTROL";
    guidance = "No stupid fatigue. Manage weight and preserve sharpness.";
    tone = "caution";
  } else if (daysOut !== null && daysOut <= 42) {
    phase = "PERFORMANCE BUILD";
    guidance = "Build performance while keeping weight direction controlled.";
    tone = "clean";
  } else if (daysOut !== null) {
    phase = "BASE BUILD";
    guidance = "Build capacity and establish a sustainable weight trend.";
    tone = "neutral";
  }

  let weightRisk = "SET CURRENT + TARGET WEIGHT";
  let weightRiskTone: Tone = "neutral";
  if (Number.isFinite(currentWeight) && Number.isFinite(targetWeight) && currentWeight > 0 && targetWeight > 0) {
    const gap = Math.max(0, currentWeight - targetWeight);
    if (gap === 0) {
      weightRisk = "ON TARGET";
      weightRiskTone = "clean";
    } else if (daysOut === null) {
      weightRisk = `${gap.toFixed(1)} KG OVER · SET FIGHT DATE`;
      weightRiskTone = "caution";
    } else if (daysOut <= 3) {
      weightRisk = `HIGH · ${gap.toFixed(1)} KG OVER`;
      weightRiskTone = "locked";
    } else {
      const weeklyRate = gap / Math.max(daysOut / 7, 0.5);
      const weeklyPercent = (weeklyRate / currentWeight) * 100;
      weightRisk = weeklyPercent >= 1
        ? `HIGH · ${weeklyPercent.toFixed(1)}% / WEEK`
        : weeklyPercent >= 0.5
          ? `WATCH · ${weeklyPercent.toFixed(1)}% / WEEK`
          : `CONTROLLED · ${weeklyPercent.toFixed(1)}% / WEEK`;
      weightRiskTone = weeklyPercent >= 1 ? "low" : weeklyPercent >= 0.5 ? "caution" : "clean";
    }
  }

  return { daysOut, phase, guidance, weightRisk, tone, weightRiskTone };
}

function readinessDecision(state: FuelState, daysOut: number | null = null) {
  if (state === "CLEAN") {
    if (daysOut !== null && daysOut <= 3) {
      return {
        headline: "FIGHT WEEK",
        train: "TRAIN",
        push: "BACK OFF",
        stateLabel: "SAFETY FIRST",
        session: "No strength work. Sharp technical movement only.",
        adjustment: "Protect the fighter. No aggressive cut, no strength work, no unnecessary live damage.",
        empty: false,
      };
    }

    if (daysOut !== null && daysOut <= 14) {
      return {
        headline: "CONTROLLED OUTPUT",
        train: "TRAIN",
        push: "BACK OFF",
        stateLabel: "MANAGE LOAD",
        session: "Quality rounds only. No stupid fatigue.",
        adjustment: "Preserve sharpness, cap unnecessary volume, and keep weight moving safely.",
        empty: false,
      };
    }

    return {
      headline: "FULL OUTPUT",
      train: "TRAIN",
      push: "PUSH",
      stateLabel: "READY",
      session: "Hard rounds approved. Pressure test is open.",
      adjustment: "Full session. Live rounds and proof attempts are open if the coach wants pressure.",
      empty: false,
    };
  }

  if (state === "LOW") {
    return {
      headline: "TECHNICAL DAY",
      train: "TRAIN",
      push: "DO NOT PUSH",
      stateLabel: "LIMITED",
      session: "Technical rounds only. Do not turn it into a war.",
      adjustment: "Reduce intensity. Keep volume controlled, delay conditioning if hydration or timing is the limiter.",
      empty: false,
    };
  }

  if (state === "TRASH") {
    return {
      headline: "RECOVERY PRIORITY",
      train: "DO NOT TRAIN",
      push: "DO NOT PUSH",
      stateLabel: "RECOVERY",
      session: "Recovery first. No proof attempts today.",
      adjustment: "Replace the session with recovery work. Eat, hydrate, sleep, and move the pressure test.",
      empty: false,
    };
  }

  if (state === "LOCKED") {
    return {
      headline: "WEIGHT CUT MODE",
      train: "DO NOT TRAIN",
      push: "DO NOT PUSH",
      stateLabel: "LOCKED",
      session: "Session locked until the body can support it.",
      adjustment: "Correct the limiter first. No heroic training through a bad signal.",
      empty: false,
    };
  }

  return {
    headline: "PRE-TRAINING BODY CHECK",
    train: "BODY CHECK",
    push: "BODY CHECK",
    stateLabel: "NO DATA",
    session: "Start your body check to set today's training ceiling.",
    adjustment: "Takes under 60 seconds. Log sleep, hydration, meal timing, soreness, and today's session to get a train / push decision.",
    empty: true,
  };
}

function confidenceLabel(c?: Conf) {
  if (c === "high") return "High";
  if (c === "med") return "Med";
  return "Low";
}

function biggestLimiter(out: FuelDecisionOutput | null) {
  if (!out) return "No limiter identified. Complete the body check first.";
  const detail = compact(out.impact || out.assessment || out.score_reason, 150);
  const state = deriveFuelState(out);
  if (state === "TRASH") return `Recovery is red. You're not sharp today. ${detail}`;
  if (state === "LOCKED") return `Stop here. Correct the body signal before training. ${detail}`;
  if (state === "LOW") return `Your margin is thin. Keep today's work technical. ${detail}`;
  return `No major limiter. Use the green light while movement stays clean. ${detail}`;
}

function correctionInstruction(out: FuelDecisionOutput | null, nextMealTarget: string, daysOut: number | null = null) {
  if (!out) return "Log how you feel, meal timing, hydration, and today's session.";
  if (daysOut !== null && daysOut <= 3) {
    return "Safety first. No aggressive cut changes; follow the coach or qualified cut team.";
  }
  return out.next_steps?.[0] || nextMealTarget;
}

function sessionAdjustment(out: FuelDecisionOutput | null, daysOut: number | null = null) {
  const decision = readinessDecision(deriveFuelState(out), daysOut);
  if (daysOut !== null && daysOut <= 14) return decision.adjustment;
  return out ? compact(out.decision || decision.adjustment, 190) : decision.adjustment;
}

function answerValue(answers: Record<string, string>, key: string) {
  return cleanSentence(answers[key]) || "Not checked";
}

function signalTone(value: string, fallback: Tone): Tone {
  const normalized = value.toLowerCase();
  if (["poor", "behind", "high", "drained"].includes(normalized)) return "low";
  if (["fair", "moderate", "flat", "recent"].includes(normalized)) return "caution";
  return value === "Not checked" ? "neutral" : fallback;
}

function canTrainLine(out: FuelDecisionOutput | null, daysOut: number | null = null) {
  if (!out) return "Start your body check to set today's training ceiling.";
  const state = deriveFuelState(out);
  return readinessDecision(state, daysOut).session;
}

const bodyCheckSteps = [
  { key: "sleep", label: "Sleep" },
  { key: "hydration", label: "Hydration" },
  { key: "meal_timing", label: "Meal Timing" },
  { key: "soreness", label: "Soreness" },
  { key: "session_load", label: "Session Load" },
] as const;

const BODY_CHECK_OPEN_EVENT = "fuel:open-body-check";

function getBodyCheckProgress(answers: Record<string, string>, session = "", intensity = "") {
  const steps = bodyCheckSteps.map((step) => ({
    ...step,
    complete: step.key === "session_load"
      ? Boolean(session && intensity)
      : answerValue(answers, step.key) !== "Not checked",
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

const FUEL_MEMORY_KEY = "disciplin:fuel:body-memory:v1";

function readHistoryScore(point: FuelHistoryPoint) {
  const record = point as unknown as Record<string, unknown>;
  const raw = record.score ?? record.value ?? record.readiness ?? record.fuel_score;
  return typeof raw === "number" && Number.isFinite(raw) ? clampScore(raw) : null;
}

function loadFuelMemoryEntries() {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(FUEL_MEMORY_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.slice(0, 120) as FuelMemoryEntry[] : [];
  } catch {
    return [];
  }
}

function saveFuelMemoryEntries(entries: FuelMemoryEntry[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(FUEL_MEMORY_KEY, JSON.stringify(entries.slice(0, 120)));
}

const foodStopWords = new Set([
  "and",
  "with",
  "the",
  "for",
  "before",
  "after",
  "meal",
  "ate",
  "eat",
  "had",
  "large",
  "small",
  "training",
  "session",
  "practice",
  "water",
  "drink",
  "hydration",
  "protein",
  "carbs",
  "fat",
  "grams",
  "kcal",
  "calories",
  "mma",
  "wrestling",
  "boxing",
  "sparring",
  "rounds",
  "round",
  "hard",
  "technical",
  "live",
  "padwork",
  "strength",
  "running",
  "conditioning",
]);

function extractFoodSignals(text: string) {
  const words = cleanSentence(text)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2 && !foodStopWords.has(word));

  return Array.from(new Set(words)).slice(0, 8);
}

function mealFeltBad(entryText: string) {
  const text = entryText.toLowerCase();
  return text.includes("bloat") || text.includes("sluggish") || text.includes("heavy") || text.includes("cramp") || text.includes("nausea") || text.includes("gi ");
}

function decideMealOutcome(
  out: FuelDecisionOutput,
  answers: Record<string, string>,
  mealText: string
): "works" | "hurts" | "neutral" {
  const state = deriveFuelState(out);
  const score = clampScore(out.score);
  const recovery = answerValue(answers, "recovery");
  const mealTiming = answerValue(answers, "meal_timing");
  const text = `${mealText} ${out.impact || ""} ${out.decision || ""} ${out.score_reason || ""}`;

  if (mealFeltBad(text) || (mealTiming === "Recent" && state !== "CLEAN")) return "hurts";
  if (state === "CLEAN" && (score === null || score >= 75) && recovery !== "Drained") return "works";
  return "neutral";
}

function countSignals(entries: FuelMemoryEntry[], outcome: "works" | "hurts") {
  const counts = new Map<string, number>();

  entries
    .filter((entry) => entry.outcome === outcome)
    .forEach((entry) => {
      entry.foodSignals.forEach((signal) => {
        counts.set(signal, (counts.get(signal) || 0) + 1);
      });
    });

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .filter(([, count]) => count >= 1)
    .slice(0, 3)
    .map(([signal]) => signal);
}

function formatFoodList(signals: string[], fallback: string) {
  if (!signals.length) return fallback;
  if (signals.length === 1) return signals[0];
  if (signals.length === 2) return `${signals[0]} and ${signals[1]}`;
  return `${signals[0]}, ${signals[1]}, and ${signals[2]}`;
}

function formatOrdinal(value: number) {
  const words: Record<number, string> = {
    1: "First",
    2: "Second",
    3: "Third",
    4: "Fourth",
    5: "Fifth",
    6: "Sixth",
    7: "Seventh",
  };
  return words[value] || `${value}th`;
}

function makeFuelMemoryEntry(
  out: FuelDecisionOutput,
  answers: Record<string, string>,
  session: string,
  intensity: string,
  mealText: string,
  timeOfTraining: string
): FuelMemoryEntry {
  const fight = getFightContext(answers);
  const score = clampScore(out.score);
  const state = deriveFuelState(out);
  const now = new Date().toISOString();
  const mealSignals = extractFoodSignals(mealText);
  const outcome = decideMealOutcome(out, answers, mealText);
  const decision = cleanSentence(out.decision);
    const ceiling = readinessDecision(state, fight.daysOut);

  return {
    id: `${now}-${score ?? "scan"}`,
    date: now,
    mealText: cleanSentence(mealText),
    foodSignals: mealSignals,
    score,
    state,
    sleep: answerValue(answers, "sleep"),
    hydration: answerValue(answers, "hydration"),
    recovery: answerValue(answers, "recovery"),
    soreness: answerValue(answers, "soreness"),
    mealTiming: answerValue(answers, "meal_timing"),
    injury: answerValue(answers, "injury_restriction"),
    session,
    intensity,
    timeOfTraining,
    campPhase: fight.phase,
    daysOut: fight.daysOut,
    weightRisk: fight.weightRisk,
    limiter: biggestLimiter(out),
    decision,
    recoveryDecision: ceiling.session,
    trainingCeiling: ceiling.headline,
    senseiImpact: decision.toLowerCase().includes("proof") || state !== "CLEAN"
      ? "Fuel capped or delayed Sensei pressure."
      : "Fuel allowed Sensei pressure inside the ceiling.",
    visionImpact: state === "CLEAN"
      ? "Vision can test under resistance if movement quality holds."
      : "Vision should avoid treating fatigue errors as technical truth.",
    outcome,
  };
}

function entryHasFatigue(entry: FuelMemoryEntry) {
  const text = `${entry.sleep} ${entry.recovery} ${entry.soreness} ${entry.hydration} ${entry.limiter} ${entry.decision}`.toLowerCase();
  return text.includes("poor") || text.includes("drained") || text.includes("high") || text.includes("fatigue") || text.includes("sleep debt") || text.includes("dehydr");
}

function correctionFailedUnderFatigue(entry: FuelMemoryEntry) {
  const text = `${entry.limiter} ${entry.decision}`.toLowerCase();
  return entryHasFatigue(entry) && text.includes("correction") && (text.includes("fail") || text.includes("broke") || text.includes("lost"));
}

function buildFuelMemory(entries: FuelMemoryEntry[], history: FuelHistoryPoint[], out: FuelDecisionOutput | null): FuelMemory {
  const compatibleEntries = entries.map((entry) => ({
    ...entry,
    mealText: entry.mealText || "",
    foodSignals: Array.isArray(entry.foodSignals) ? entry.foodSignals : [],
    senseiImpact: entry.senseiImpact || "Sensei impact not logged.",
    visionImpact: entry.visionImpact || "Vision impact not logged.",
    recoveryDecision: entry.recoveryDecision || entry.decision || "Recovery decision not logged.",
    trainingCeiling: entry.trainingCeiling || entry.decision || "Training ceiling not logged.",
    outcome: entry.outcome || "neutral",
  }));
  const sorted = [...compatibleEntries].sort((a, b) => b.date.localeCompare(a.date));
  const recent = sorted.slice(0, 7);
  const longTerm = sorted.slice(0, 30);
  const latest = recent[0];
  const historyScores = history.map(readHistoryScore).filter((score): score is number => score !== null).slice(-7);
  const scoreBase = recent.map((entry) => entry.score).filter((score): score is number => score !== null);
  const scores = [...scoreBase, ...historyScores].slice(0, 7);
  const poorReadinessDays = recent.filter((entry) => entry.state === "TRASH" || entry.state === "LOCKED" || (entry.score !== null && entry.score < 45)).length
    || scores.filter((score) => score < 45).length;
  const highOutputDays = recent.filter((entry) => entry.state === "CLEAN" || (entry.score !== null && entry.score >= 75)).length
    || scores.filter((score) => score >= 75).length;
  const sleepStreak = recent.reduce((streak, entry) => {
    if (streak.done) return streak;
    const poor = entry.sleep === "Poor" || entry.limiter.toLowerCase().includes("sleep");
    return poor ? { count: streak.count + 1, done: false } : { count: streak.count, done: true };
  }, { count: 0, done: false }).count;
  const recoveryRedDays = recent.filter((entry) => entry.recovery === "Drained" || entry.state === "TRASH" || entry.state === "LOCKED").length;
  const fatigueDays = recent.filter(entryHasFatigue).length;
  const correctionFailures = recent.filter(correctionFailedUnderFatigue).length;
  const latestInjury = cleanSentence(latest?.injury);
  const injuryRestriction = latestInjury && latestInjury !== "Not checked" ? latestInjury : "None logged";
  const workingFoods = countSignals(longTerm, "works");
  const hurtingFoods = countSignals(longTerm, "hurts");
  const foodsThatWork = workingFoods.length
    ? `${formatFoodList(workingFoods, "")} works before output. Repeat it when the session needs quality.`
    : "No proven pre-training foods yet. Log meals and session feel after practice.";
  const foodsThatHurt = hurtingFoods.length
    ? `${formatFoodList(hurtingFoods, "")} has shown up on bad sessions. Avoid it before hard rounds.`
    : "No repeat food problem logged yet.";
  const recentMealBad = longTerm.filter((entry) => entry.mealTiming === "Recent" && entry.outcome === "hurts").length;
  const mealTimingPattern = recentMealBad >= 2
    ? `Large or recent meals hurt training ${recentMealBad} times. Eat about 3 hours before hard work.`
    : "No repeat timing problem yet. Keep logging how close meals are to training.";
  const lowHydrationEntries = longTerm.filter((entry) => entry.hydration === "Behind");
  const lowHydrationBad = lowHydrationEntries.filter((entry) => entry.recovery !== "Ready" || entry.state !== "CLEAN").length;
  const hydrationPattern = lowHydrationBad >= 2
    ? `The last ${lowHydrationBad} low-hydration flags lowered recovery or capped pressure. Add fluids before practice.`
    : "Hydration has not created a repeat limiter yet.";
  const sleepPattern = sleepStreak > 0
    ? `${formatOrdinal(sleepStreak)} poor sleep day. This usually affects your technical quality.`
    : "Sleep is not currently capping the session.";
  const latestScore = latest?.score;
  const previousScore = recent[1]?.score;
  const readinessPattern = latestScore !== null && latestScore !== undefined && previousScore !== null && previousScore !== undefined
    ? latestScore > previousScore + 8
      ? "Recovery has improved since the last check."
      : latestScore < previousScore - 8
        ? "Readiness has dropped since the last check. Back off early."
        : "Readiness is holding steady from the last check."
    : poorReadinessDays > 0
      ? `${poorReadinessDays} poor readiness day${poorReadinessDays === 1 ? "" : "s"} in the last 7.`
      : "Fuel needs a few more checks to read readiness movement.";
  const hydrationTrend = lowHydrationEntries.length > 0
    ? `Hydration was behind ${lowHydrationEntries.length} time${lowHydrationEntries.length === 1 ? "" : "s"} in the last 30 checks. Low fluids usually fade grip and pace first.`
    : "Hydration has not repeated as a limiter yet.";
  const mealTimingMemory = recentMealBad >= 2
    ? "Large meals too close to training have slowed you down before. Eat about 3 hours before hard rounds."
    : latest?.mealTiming === "Recent"
      ? "Meal is close to training. Watch for heaviness and delay pressure if needed."
      : "No personal meal-timing problem has repeated yet.";
  const latestDecision = latest
    ? readinessDecision(latest.state, latest.daysOut)
    : null;
  const recoveryDecision = latest?.recoveryDecision || latestDecision?.session || "Complete today's body check before Fuel decides recovery.";
  const trainingCeilingHistory = latest
    ? `Last ceiling: ${latest.trainingCeiling || latestDecision?.headline || "BODY CHECK"}. High-output days: ${highOutputDays} / 7.`
    : "No ceiling history yet. Run today's body check to start the log.";
  const matchingRoutine = latest
    ? longTerm.filter((entry) => entry.id !== latest.id && entry.session === latest.session && entry.intensity === latest.intensity)
    : [];
  const matchingGoodRoutine = matchingRoutine.find((entry) => entry.outcome === "works" || entry.state === "CLEAN" || (entry.score !== null && entry.score >= 75));
  const routineMemory = latest && matchingGoodRoutine
    ? `You've trained well on this ${latest.session} / ${latest.intensity} routine before. Repeat the parts that kept quality high.`
    : latest
      ? "Fuel is still learning which routine gives this body the cleanest work."
      : "Run a check, train, then log the result so Fuel learns your best routine.";
  const technicalQualityImpact = sleepStreak > 0 || lowHydrationBad > 0 || recoveryRedDays > 0
    ? "This usually affects your technical quality. Keep Sensei corrections slower and cleaner."
    : highOutputDays > 0
      ? "Your recent body signals have supported cleaner technical output."
      : "Technical-quality pattern not established yet.";
  const osImpact = longTerm.some((entry) => entry.senseiImpact.toLowerCase().includes("capped") || entry.senseiImpact.toLowerCase().includes("delayed"))
    ? "Fuel has already capped Sensei pressure when body signals were red. Keep technical proof away from fatigue noise."
    : "Fuel has not had to block Sensei or Vision repeatedly yet.";
  const personalAnswer = workingFoods.length
    ? `${formatFoodList(workingFoods, "")} is currently your strongest logged pre-training signal.`
    : hurtingFoods.length
      ? `Avoid ${formatFoodList(hurtingFoods, "")} before pressure until the log proves otherwise.`
      : "Fuel is still learning what works for this body.";
  const state = deriveFuelState(out);

  let coachRead = personalAnswer;
  let senseiHandoff = "Sensei: wait for Fuel proof before pressure testing.";
  let action = "Complete the body check, then log the meal and what limited the session.";
  let tone: Tone = "neutral";

  if (latest?.daysOut !== null && latest?.daysOut !== undefined && latest.daysOut <= 3) {
    coachRead = "Fight week. The body memory is in protection mode.";
    senseiHandoff = "Sensei: no pressure test. Keep corrections sharp and low damage.";
    action = "No strength work. No aggressive cut advice. Follow coach and cut team.";
    tone = "locked";
  } else if (injuryRestriction !== "None logged") {
    coachRead = `Restriction active: ${injuryRestriction}.`;
    senseiHandoff = "Sensei: technical entries only. Do not build the correction around the restricted area.";
    action = "Cap live resistance and route the session around the restriction.";
    tone = "low";
  } else if (sleepStreak >= 3) {
    coachRead = `${sleepPattern} Ceiling is capped.`;
    senseiHandoff = "Sensei: technical work only. No pressure test.";
    action = "Reduce live rounds and move hard proof to tomorrow.";
    tone = "caution";
  } else if (sleepStreak === 2) {
    coachRead = "Second poor sleep day. Push is available only if the warmup looks sharp.";
    senseiHandoff = "Sensei: technical quality may fade early. Keep resistance controlled.";
    action = "Start technical, then upgrade only if speed and posture stay clean.";
    tone = "caution";
  } else if (recoveryRedDays >= 2 || state === "TRASH" || state === "LOCKED") {
    coachRead = "Recovery red. Pushing today risks losing the correction.";
    senseiHandoff = "Sensei: recovery not sufficient. Delay pressure until recovery returns.";
    action = "Recovery session only. Eat, hydrate, sleep, and reassess.";
    tone = "low";
  } else if (correctionFailures >= 2) {
    coachRead = `Correction failed under fatigue ${correctionFailures} times this week.`;
    senseiHandoff = "Sensei: reduce live volume before the correction breaks again.";
    action = "Keep resistance controlled and stop before form decay.";
    tone = "caution";
  } else if (fatigueDays >= 3) {
    coachRead = "Fatigue trend is building. Output is available, but the margin is thin.";
    senseiHandoff = "Sensei: approve drilling, cap live resistance.";
    action = "Cut one hard block and prioritize retention quality.";
    tone = "caution";
  } else if (highOutputDays >= 2 && state === "CLEAN") {
    coachRead = "Recovery green. You've trained well on this routine before.";
    senseiHandoff = "Sensei: pressure test unlocked. Add resistance with a round cap.";
    action = "Open hard rounds, then stop while movement quality is still clean.";
    tone = "clean";
  } else if (latest) {
    coachRead = readinessPattern.includes("improved") ? "Recovery has improved. Build carefully from the current ceiling." : "Body memory stable. No repeating limiter is dominating the week.";
    senseiHandoff = "Sensei: normal correction work approved within today's Fuel ceiling.";
    action = "Train to the current decision and log the post-session limiter.";
    tone = toneForState(latest.state);
  }

  return {
    entries: recent,
    sleepStreak,
    fatigueTrend: fatigueDays >= 3 ? `${fatigueDays} fatigue flags / 7 days` : "No heavy fatigue trend",
    recoveryTrend: recoveryRedDays > 0 ? `${recoveryRedDays} red recovery days / 7 days` : "Recovery stable",
    injuryRestriction,
    poorReadinessDays,
    highOutputDays,
    correctionFailures,
    foodsThatWork,
    foodsThatHurt,
    mealTimingPattern,
    hydrationPattern,
    sleepPattern,
    readinessPattern,
    hydrationTrend,
    mealTimingMemory,
    recoveryDecision,
    trainingCeilingHistory,
    technicalQualityImpact,
    routineMemory,
    osImpact,
    personalAnswer,
    coachRead,
    senseiHandoff,
    action,
    tone,
  };
}

function useFuelContextMemory(
  out: FuelDecisionOutput | null,
  answers: Record<string, string>,
  history: FuelHistoryPoint[],
  session: string,
  intensity: string,
  mealText: string,
  timeOfTraining: string
) {
  const [entries, setEntries] = useState<FuelMemoryEntry[]>([]);
  const lastSavedSignature = useRef("");

  useEffect(() => {
    setEntries(loadFuelMemoryEntries());
  }, []);

  useEffect(() => {
    if (!out) return;
    const signature = JSON.stringify({
      score: clampScore(out.score),
      rating: out.rating,
      decision: out.decision,
      mealText,
      session,
      intensity,
      timeOfTraining,
      sleep: answers.sleep,
      hydration: answers.hydration,
      recovery: answers.recovery,
      soreness: answers.soreness,
      mealTiming: answers.meal_timing,
    });

    if (signature === lastSavedSignature.current) return;
    lastSavedSignature.current = signature;

    const entry = makeFuelMemoryEntry(out, answers, session, intensity, mealText, timeOfTraining);
    setEntries((current) => {
      const next = [entry, ...current].slice(0, 120);
      saveFuelMemoryEntries(next);
      return next;
    });
  }, [out, answers, session, intensity, mealText, timeOfTraining]);

  return buildFuelMemory(entries, history, out);
}

function IconFlash() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5 14.25 2.25 12 10.5h8.25L9.75 21.75 12 13.5H3.75Z" />
    </svg>
  );
}

function IconText() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625A3.375 3.375 0 0 0 16.125 8.25h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5A3.375 3.375 0 0 0 10.125 2.25H5.625A1.125 1.125 0 0 0 4.5 3.375v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V14.25Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 15h7.5M8.25 18H12" />
    </svg>
  );
}

function IconCamera() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18A2.25 2.25 0 0 0 4.5 20.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316A2.192 2.192 0 0 0 14.616 3.82a48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0Z" />
    </svg>
  );
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
        "rounded-[28px] border border-white/[0.075] bg-[#121c2b]/92 backdrop-blur-xl transition-all duration-300",
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

function StatePill({ state }: { state: FuelState }) {
  const p = palette(toneForState(state));

  return (
    <div className={cn("rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.04em]", p.border, p.bg, p.text)}>
      {state}
    </div>
  );
}

function ScoreProof({
  score,
  state,
  running,
  daysOut,
}: {
  score: number | null;
  state: FuelState;
  running: boolean;
  daysOut: number | null;
}) {
  const safe = score ?? 0;
  const readiness = readinessTone(state, score);
  const tone = state === "CLEAN" && daysOut !== null && daysOut <= 3
    ? "locked"
    : state === "CLEAN" && daysOut !== null && daysOut <= 14
      ? "caution"
      : readiness;
  const p = palette(tone);
  const radius = 48;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (safe / 100) * circumference;

  return (
    <div className="flex items-center gap-5">
      <div className="relative flex h-[126px] w-[126px] shrink-0 items-center justify-center rounded-[28px] bg-white/[0.055]">
        <div className={cn("absolute inset-3 rounded-full blur-xl", p.bg, running && "animate-pulse")} />
        <svg className="relative -rotate-90" width="108" height="108" viewBox="0 0 108 108">
          <circle cx="54" cy="54" r={radius} stroke="rgba(255,255,255,0.08)" strokeWidth="8" fill="transparent" />
          <circle
            cx="54"
            cy="54"
            r={radius}
            stroke={p.color}
            strokeWidth="8"
            fill="transparent"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={score === null ? circumference : offset}
            style={{
              transition: "stroke-dashoffset 800ms cubic-bezier(0.2, 0.8, 0.2, 1), stroke 300ms ease",
              filter: `drop-shadow(0 0 12px ${p.color})`,
            }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <p className="text-2xl font-black tabular-nums text-white">{score === null ? "--" : safe}</p>
          <p className="mt-1 text-[10px] font-semibold tracking-[0.04em] text-white/42">of 100</p>
        </div>
      </div>

      <div className="min-w-0 flex-1">
        <Eyebrow>Readiness proof</Eyebrow>
        <p className="mt-1 text-[34px] font-black leading-none tabular-nums text-white">{score === null ? "0%" : `${safe}%`}</p>
        <p className="mt-3 text-sm font-medium leading-5 text-white/72">
          {score === null ? "No pre-training body check logged yet." : readinessDecision(state, daysOut).session}
        </p>
        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${score === null ? 0 : safe}%`,
              backgroundColor: p.color,
            }}
          />
        </div>
        <p className="mt-3 text-xs font-medium text-white/32">Proof type: readiness</p>
      </div>
    </div>
  );
}

function MissionHero({
  out,
  running,
  statusPill,
  nextMealTarget,
  answers,
  memory,
}: {
  out: FuelDecisionOutput | null;
  running: boolean;
  statusPill: string;
  nextMealTarget: string;
  answers: Record<string, string>;
  memory: FuelMemory;
}) {
  const state = deriveFuelState(out);
  const score = clampScore(out?.score);
  const fight = getFightContext(answers);
  const readiness = readinessTone(state, score);
  const tone = state === "CLEAN" && fight.daysOut !== null && fight.daysOut <= 3
    ? "locked"
    : state === "CLEAN" && fight.daysOut !== null && fight.daysOut <= 14
      ? "caution"
      : readiness;
  const p = palette(tone);
  const decision = readinessDecision(state, fight.daysOut);
  return (
    <Surface className={cn("relative overflow-hidden p-7 sm:p-8", p.glow)}>
      <div className={cn("pointer-events-none absolute inset-0", p.wash)} />
      <div className="relative">
        <div className="flex items-center justify-between gap-4">
          <Eyebrow>Now</Eyebrow>
          <StatePill state={state} />
        </div>

        <h1 className="mt-3 text-[44px] font-black leading-[0.96] text-white sm:text-[58px]">
          {decision.headline}
        </h1>

        <div className="mt-7 grid gap-4 lg:grid-cols-[1fr_400px]">
          <div className="rounded-[22px] border border-white/[0.07] bg-[#101a28]/72 p-5">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color }} />
              <p className="text-xs font-semibold tracking-[0.025em] text-white/74">Today&apos;s ceiling</p>
            </div>
            <p className="mt-4 text-base font-medium leading-7 text-white/86">
              {decision.session}
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <StatusMetric label="Train" value={decision.train} tone={tone} />
              <StatusMetric label="Push" value={decision.push} tone={tone} />
              <StatusMetric label="State" value={decision.stateLabel} tone={tone} />
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <CommandLine label="Biggest limiter" value={biggestLimiter(out)} tone={tone} />
              <CommandLine label="Action before training" value={correctionInstruction(out, nextMealTarget, fight.daysOut)} tone={tone} />
              <CommandLine label="Body memory" value={memory.coachRead} tone={memory.tone} />
              <CommandLine label="Sensei handoff" value={memory.senseiHandoff} tone={memory.tone} />
              <CommandLine label="Camp phase" value={fight.daysOut === null ? fight.phase : `${fight.phase} · ${fight.daysOut} DAYS OUT`} tone={fight.tone} />
              <CommandLine label="Weight cut risk" value={fight.weightRisk} tone={fight.weightRiskTone} />
            </div>
          </div>

          <div className="rounded-[22px] border border-white/[0.07] bg-[#101a28]/72 p-4">
            <ScoreProof score={score} state={state} running={running} daysOut={fight.daysOut} />
          </div>
        </div>

        <p className="mt-4 text-xs font-semibold uppercase tracking-[0.04em] text-white/36">{running ? "Scanning" : statusPill}</p>
      </div>
    </Surface>
  );
}

function CommandLine({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: Tone;
}) {
  const p = palette(tone);

  return (
    <div className="rounded-2xl border border-white/[0.07] bg-black/10 px-4 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.04em] text-white/36">{label}</p>
      <p className={cn("mt-1 line-clamp-2 text-sm font-medium leading-5", tone === "neutral" ? "text-white/62" : p.text)}>
        {value}
      </p>
    </div>
  );
}

function StatusMetric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: Tone;
}) {
  const p = palette(tone);
  return (
    <div className={cn("rounded-2xl border px-3 py-3", tone === "neutral" ? "border-white/[0.07] bg-white/[0.03]" : cn(p.borderSoft, p.bg))}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.04em] text-white/36">{label}</p>
      <p className={cn("mt-1 truncate text-sm font-bold", tone === "neutral" ? "text-white/70" : p.text)}>{value}</p>
    </div>
  );
}

function ModuleCard({
  code,
  title,
  value,
  tone,
  action,
  complete = false,
}: {
  code: string;
  title: string;
  value: string;
  tone: Tone;
  action?: string;
  complete?: boolean;
}) {
  const p = palette(tone);
  return (
    <button
      type="button"
      onClick={openBodyCheckFlow}
      className="group flex min-h-[76px] w-full items-center justify-between rounded-[22px] border border-white/[0.075] bg-[#111b29]/92 p-4 text-left transition-all duration-300 hover:-translate-y-0.5 hover:border-emerald-300/20 hover:bg-[#162233] hover:shadow-[0_18px_40px_rgba(0,0,0,0.24)] active:scale-[0.99]"
    >
      <div className="flex min-w-0 items-center gap-3">
        <div className={cn("relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full border text-[12px] font-semibold tracking-[0.025em]", p.border, p.bg, p.text)}>
          {code}
          <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full" style={{ backgroundColor: p.color }} />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-bold text-white">{title}</p>
            {complete && <span className="text-xs font-semibold text-emerald-300">✓</span>}
          </div>
          <p className="mt-1 truncate text-xs font-medium text-white/58">{value}</p>
          {action && <p className={cn("mt-1 text-[11px] font-semibold tracking-[0.025em]", complete ? "text-emerald-300/72" : p.text)}>{action}</p>}
        </div>
      </div>
      <span className="text-lg text-white/68 transition-transform duration-300 group-hover:translate-x-0.5">›</span>
    </button>
  );
}

function Modules({
  purpose,
  session,
  intensity,
  timeOfTraining,
  mode,
  fightWeek,
  state,
  answers,
}: {
  purpose: string;
  session: string;
  intensity: string;
  timeOfTraining: string;
  mode: Mode;
  fightWeek: boolean;
  state: FuelState;
  answers: Record<string, string>;
}) {
  const tone = toneForState(state);
  const hydration = answerValue(answers, "hydration");
  const sleep = answerValue(answers, "sleep");
  const soreness = answerValue(answers, "soreness");
  const recovery = answerValue(answers, "recovery");
  const mealTiming = answerValue(answers, "meal_timing");
  const fight = getFightContext(answers);
  const progress = getBodyCheckProgress(answers, session, intensity);
  const progressPercent = Math.round((progress.completed / progress.total) * 100);

  return (
    <section>
      <Surface className="mb-4 overflow-hidden p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-emerald-200/70">
              New fighter start here
            </p>
            <h2 className="mt-2 text-2xl font-black leading-tight text-white">Start body check</h2>
            <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-white/62">
              Fuel needs sleep, hydration, meal timing, soreness, and today&apos;s session. Takes under 60 seconds. You get today&apos;s train / push ceiling.
            </p>
          </div>
          <button
            type="button"
            onClick={openBodyCheckFlow}
            className="rounded-2xl border border-emerald-300/24 bg-emerald-400 px-6 py-4 text-sm font-extrabold uppercase tracking-[0.04em] text-[#03100a] shadow-[0_18px_48px_rgba(52,211,153,0.18)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-emerald-300 active:scale-[0.98]"
          >
            Start body check
          </button>
        </div>

        <div className="mt-5">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs font-semibold tracking-[0.025em] text-white/58">
              Step {progress.completed} of {progress.total} completed
            </p>
            <p className="text-xs font-semibold tracking-[0.025em] text-emerald-200/70">
              {progress.completed === progress.total ? "Ready to scan" : "Tap a signal to log"}
            </p>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-emerald-400 transition-all duration-700"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-4">
            {progress.steps.map((step) => (
              <button
                key={step.key}
                type="button"
                onClick={openBodyCheckFlow}
                className={cn(
                  "rounded-full border px-3 py-2 text-xs font-semibold tracking-[0.025em] transition-all duration-300",
                  step.complete
                    ? "border-emerald-300/24 bg-emerald-400/10 text-emerald-200"
                    : "border-white/[0.08] bg-white/[0.035] text-white/48 hover:bg-white/[0.06] hover:text-white/72"
                )}
              >
                {step.label} {step.complete ? "✓" : "○"}
              </button>
            ))}
          </div>
        </div>
      </Surface>

      <div className="mb-3 flex items-center justify-between px-1">
        <h2 className="text-lg font-extrabold text-white">Readiness signals</h2>
        <p className="text-xs font-semibold tracking-[0.025em] text-white/72">8 connected inputs</p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <ModuleCard code="IN" title="Intake" value={mode === "photo" ? "Text + photo" : "Text command"} tone={tone} action="Tap to log meal or limiter" complete={mode === "photo" || mode === "text"} />
        <ModuleCard code="TM" title="Meal Timing" value={mealTiming === "Not checked" ? timeOfTraining || "Not checked" : mealTiming} tone={signalTone(mealTiming, tone)} action={mealTiming === "Not checked" ? "Tap to log" : "Logged"} complete={mealTiming !== "Not checked"} />
        <ModuleCard code="HY" title="Hydration" value={hydration} tone={signalTone(hydration, tone)} action={hydration === "Not checked" ? "Tap to log" : "Logged"} complete={hydration !== "Not checked"} />
        <ModuleCard code="SL" title="Session Load" value={`${session} · ${intensity}`} tone={tone} action="Tap to set session" complete={Boolean(session && intensity)} />
        <ModuleCard code="SP" title="Sleep" value={sleep} tone={signalTone(sleep, tone)} action={sleep === "Not checked" ? "Tap to log" : "Logged"} complete={sleep !== "Not checked"} />
        <ModuleCard code="SO" title="Soreness" value={soreness} tone={signalTone(soreness, tone)} action={soreness === "Not checked" ? "Tap to log" : "Logged"} complete={soreness !== "Not checked"} />
        <ModuleCard code="RC" title="Recovery State" value={recovery} tone={signalTone(recovery, tone)} action={recovery === "Not checked" ? "Tap to log" : "Logged"} complete={recovery !== "Not checked"} />
        <ModuleCard
          code="WC"
          title="Weight Cut / Fight Week"
          value={fight.daysOut === null ? (fightWeek ? "Strict mode" : purpose) : `${fight.daysOut} days · ${fight.weightRisk}`}
          tone={fightWeek ? "locked" : fight.weightRiskTone}
          action="Tap to set fight context"
          complete={fight.daysOut !== null || fightWeek}
        />
      </div>
    </section>
  );
}
function DecisionFeed({
  out,
  nextMealTarget,
  answers,
  memory,
}: {
  out: FuelDecisionOutput | null;
  nextMealTarget: string;
  answers: Record<string, string>;
  memory: FuelMemory;
}) {
  const state = deriveFuelState(out);
  const fight = getFightContext(answers);
  const baseTone = toneForState(state);
  const tone = state === "CLEAN" && fight.daysOut !== null && fight.daysOut <= 3
    ? "locked"
    : state === "CLEAN" && fight.daysOut !== null && fight.daysOut <= 14
      ? "caution"
      : baseTone;
  const p = palette(tone);
  const decision = readinessDecision(state, fight.daysOut);
  const proofApproved = state === "CLEAN" && (fight.daysOut === null || fight.daysOut > 3);
  const decisionSteps = out
    ? [
        { label: "Readiness calculated", value: `${clampScore(out.score) ?? 0}% · ${decision.stateLabel}` },
        { label: "Biggest limiter identified", value: biggestLimiter(out) },
        { label: "Training ceiling set", value: sessionAdjustment(out, fight.daysOut) },
        { label: "Sensei updated", value: memory.senseiHandoff },
        {
          label: proofApproved ? "Proof round approved" : "Proof round cancelled",
          value: proofApproved
            ? "Pressure is open inside today's round cap."
            : "Tired reps become bad reps. Keep proof out of today's work.",
        },
      ]
    : [];

  return (
    <aside className="space-y-6">
      <h2 className="px-1 text-lg font-extrabold text-white">Today&apos;s Decisions</h2>
      <Surface className="p-5">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[22px] bg-white/[0.045] text-sm font-semibold tracking-[0.025em] text-white/82">
          FU
        </div>
        <div className="mt-6 text-center">
          <h3 className="text-lg font-bold text-white">
            {decision.headline}
          </h3>
          <p className="mx-auto mt-3 max-w-sm text-sm font-medium leading-6 text-white/74">
            {canTrainLine(out, fight.daysOut)}
          </p>
        </div>

        <div className="mt-5 space-y-2">
          {decisionSteps.map((step, index) => (
            <div
              key={step.label}
              className="animate-[fuelDecisionIn_500ms_cubic-bezier(0.2,0.8,0.2,1)_both] rounded-2xl border border-white/[0.07] bg-white/[0.035] px-4 py-3"
              style={{ animationDelay: `${index * 110}ms` }}
            >
              <div className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full border border-emerald-300/20 bg-emerald-400/10 text-[10px] font-bold text-emerald-200">
                  {index + 1}
                </span>
                <p className="text-xs font-semibold tracking-[0.025em] text-white/78">{step.label}</p>
              </div>
              <p className="mt-2 text-xs font-medium leading-5 text-white/52">{step.value}</p>
            </div>
          ))}
          <FeedItem label="Train" value={decision.train} tone={tone} />
          <FeedItem label="Push" value={decision.push} tone={tone} />
          <FeedItem label="Reason" value={biggestLimiter(out)} tone={tone} />
          <FeedItem label="Next action" value={correctionInstruction(out, nextMealTarget, fight.daysOut)} tone={tone} />
          <FeedItem label="Session adjustment" value={sessionAdjustment(out, fight.daysOut)} tone={tone} />
          <FeedItem label="Works for you" value={memory.personalAnswer} tone={memory.tone} />
          <FeedItem label="Body memory" value={memory.action} tone={memory.tone} />
          <FeedItem label="Sensei" value={memory.senseiHandoff} tone={memory.tone} />
          <FeedItem label="Weight cut risk" value={fight.weightRisk} tone={fight.weightRiskTone} />
        </div>

        {out?.pattern_line && (fight.daysOut === null || fight.daysOut > 3) && (
          <div className={cn("mt-4 rounded-2xl border p-3 text-xs font-medium leading-5", p.borderSoft, p.bg, p.text)}>
            {out.pattern_line}
          </div>
        )}
      </Surface>
    </aside>
  );
}

function FeedItem({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: Tone;
}) {
  const p = palette(tone);
  return (
    <div className="rounded-full border border-white/[0.06] bg-white/[0.04] px-4 py-3 transition-all duration-300 hover:bg-white/[0.065]">
      <p className="truncate text-center text-xs font-semibold tracking-[0.025em] text-white/64">
        <span className={tone === "neutral" ? "text-white/40" : p.text}>{label}: </span>
        {value}
      </p>
    </div>
  );
}

function CommandDock({
  modeValue,
  setModeSafe,
  purposeValue,
  setPurpose,
  sessionValue,
  setSession,
  intensity,
  setIntensity,
  timeOfTrainingValue,
  setTimeOfTraining,
  fightWeekValue,
  setFightWeek,
  mealText,
  setMealText,
  photo,
  setPhoto,
  answers,
  setAnswers,
  canAnalyze,
  analyze,
  running,
  reset,
}: {
  modeValue: Mode;
  setModeSafe: (m: Mode) => void;
  purposeValue: string;
  setPurpose: (v: string) => void;
  sessionValue: string;
  setSession: (v: string) => void;
  intensity: string;
  setIntensity: (v: string) => void;
  timeOfTrainingValue: string;
  setTimeOfTraining: (v: string) => void;
  fightWeekValue: boolean;
  setFightWeek: (v: boolean) => void;
  mealText: string;
  setMealText: (v: string) => void;
  photo: File | null;
  setPhoto: (f: File | null) => void;
  answers: Record<string, string>;
  setAnswers: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  canAnalyze: boolean;
  analyze: () => void;
  running: boolean;
  reset: () => void;
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

  return (
    <div id="fuel-command-dock">
    <Surface className="overflow-hidden p-4">
      <textarea
        value={mealText}
        onChange={(e) => setMealText(e.target.value)}
        rows={3}
        placeholder="Log the meal, hydration issue, or limiter..."
        className="w-full resize-none border-0 bg-transparent text-base font-medium leading-7 text-white placeholder-white/34 outline-none"
      />

      <div className="mt-2 flex items-center justify-between gap-3">
        <p className="text-xs font-medium text-white/34">Return to body check</p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="rounded-full border border-white/[0.08] bg-white/[0.05] px-3 py-2 text-xs font-semibold tracking-[0.025em] text-white/60 transition-all duration-300 hover:bg-white/[0.08] hover:text-white"
          >
            {open ? "Hide layers" : "Layers"}
          </button>
          <button
            type="button"
            onClick={reset}
            className="rounded-full border border-white/[0.08] bg-white/[0.05] px-3 py-2 text-xs font-medium text-white/50 transition-all duration-300 hover:bg-white/[0.08] hover:text-white"
          >
            Reset
          </button>
          <button
            disabled={!canAnalyze}
            type="button"
            onClick={analyze}
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-full transition-all duration-300 active:scale-95",
              canAnalyze
                ? "bg-white/14 text-white shadow-[0_12px_28px_rgba(255,255,255,0.08)] hover:bg-emerald-400 hover:text-[#03100a]"
                : "cursor-not-allowed bg-white/[0.06] text-white/25"
            )}
          >
            {running ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            ) : (
              <IconFlash />
            )}
          </button>
        </div>
      </div>

      <div className={cn("grid overflow-hidden transition-all duration-500", open ? "mt-4 grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0")}>
        <div className="min-h-0 space-y-4">
          <FightContextPanel answers={answers} setAnswers={setAnswers} />
          <ReadinessCheckIn
            answers={answers}
            setAnswers={setAnswers}
            session={sessionValue}
            setSession={setSession}
            intensity={intensity}
            setIntensity={setIntensity}
            activeStep={activeStep}
            setActiveStep={setActiveStep}
          />

          <div className="grid grid-cols-2 gap-2">
            <ModeButton active={modeValue === "text"} icon={<IconText />} label="Text" onClick={() => setModeSafe("text")} />
            <ModeButton active={modeValue === "photo"} icon={<IconCamera />} label="Photo" onClick={() => setModeSafe("photo")} />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Goal">
              <Select value={purposeValue} onChange={setPurpose} options={["Maintain", "Lean bulk", "Cut"]} />
            </Field>
            <Field label="Session today">
              <Select value={sessionValue} onChange={setSession} options={["MMA", "Wrestling", "Boxing", "Padwork", "Sparring", "Strength", "Run", "Rest"]} />
            </Field>
            <Field label="Intensity">
              <Select value={intensity} onChange={setIntensity} options={["Easy", "Standard", "Hard"]} />
            </Field>
            <Field label="Training time">
              <input
                value={timeOfTrainingValue}
                onChange={(e) => setTimeOfTraining(e.target.value)}
                placeholder="e.g. 6pm"
                className="w-full rounded-2xl border border-white/[0.08] bg-[#0c1624] px-4 py-3 text-sm font-medium text-white outline-none transition focus:border-emerald-400/35"
              />
            </Field>
          </div>

          <button
            type="button"
            onClick={() => setFightWeek(!fightWeekValue)}
            className={cn(
              "flex w-full items-center justify-between rounded-2xl border p-4 text-left transition-all duration-300",
              fightWeekValue ? "border-yellow-400/25 bg-yellow-400/10" : "border-white/[0.08] bg-white/[0.035] hover:bg-white/[0.055]"
            )}
          >
            <div>
              <p className="text-sm font-bold text-white">Weight Cut / Fight Week</p>
              <p className="mt-1 text-xs font-medium text-white/44">Strict warnings for GI risk, hydration, and bloat.</p>
            </div>
            <span className={cn("relative h-7 w-12 rounded-full transition", fightWeekValue ? "bg-yellow-400" : "bg-white/14")}>
              <span className={cn("absolute left-1 top-1 h-5 w-5 rounded-full bg-white transition-transform", fightWeekValue && "translate-x-5")} />
            </span>
          </button>

          {modeValue === "photo" && (
            <div className="rounded-2xl border border-dashed border-white/12 bg-white/[0.025] p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-bold text-white">Meal photo</p>
                  <p className="mt-1 text-xs font-medium text-white/42">{photo ? photo.name : "No image selected"}</p>
                </div>
                <div className={cn("rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.04em]", photo ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-300" : "border-white/10 bg-white/[0.035] text-white/36")}>
                  {photo ? "Ready" : "None"}
                </div>
              </div>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
                className="mt-4 w-full text-xs text-white/45 file:mr-4 file:rounded-xl file:border-0 file:bg-emerald-400/15 file:px-4 file:py-2 file:text-xs file:font-semibold file:text-emerald-300"
              />
            </div>
          )}
        </div>
      </div>
    </Surface>
    </div>
  );
}

function FightContextPanel({
  answers,
  setAnswers,
}: {
  answers: Record<string, string>;
  setAnswers: React.Dispatch<React.SetStateAction<Record<string, string>>>;
}) {
  const fight = getFightContext(answers);
  const p = palette(fight.tone);
  const riskPalette = palette(fight.weightRiskTone);
  const setAnswer = (key: string, value: string) => {
    setAnswers((current) => ({ ...current, [key]: value }));
  };

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-black/10 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-white">Fight context</p>
          <p className="mt-1 text-xs font-medium text-white/42">Camp phase controls load and cut warnings.</p>
        </div>
        <span className={cn("rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.04em]", p.border, p.bg, p.text)}>
          {fight.daysOut === null ? "Not set" : `${fight.daysOut} days`}
        </span>
      </div>

      <div className={cn("mt-4 rounded-xl border px-3 py-3", p.borderSoft, p.bg)}>
        <p className={cn("text-[10px] font-semibold uppercase tracking-[0.04em]", p.text)}>{fight.phase}</p>
        <p className="mt-1 text-xs font-medium leading-5 text-white/62">{fight.guidance}</p>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <ContextInput
          className="sm:col-span-2"
          label="Next fight / competition"
          value={answers.fight_name || ""}
          placeholder="Opponent, event, or competition"
          onChange={(value) => setAnswer("fight_name", value)}
        />
        <ContextInput
          label="Fight date"
          type="date"
          value={answers.fight_date || ""}
          onChange={(value) => setAnswer("fight_date", value)}
        />
        <ContextInput
          label="Weight class"
          value={answers.weight_class || ""}
          placeholder="e.g. Lightweight"
          onChange={(value) => setAnswer("weight_class", value)}
        />
        <ContextInput
          label="Current weight"
          type="number"
          value={answers.current_weight || ""}
          placeholder="kg"
          onChange={(value) => setAnswer("current_weight", value)}
        />
        <ContextInput
          label="Target weight"
          type="number"
          value={answers.target_weight || ""}
          placeholder="kg"
          onChange={(value) => setAnswer("target_weight", value)}
        />
      </div>

      <div className="mt-3 flex items-center justify-between rounded-xl border border-white/[0.06] bg-[#091321] px-3 py-2.5">
        <span className="text-[10px] font-semibold uppercase tracking-[0.04em] text-white/36">Weight cut risk</span>
        <span className={cn("text-[10px] font-semibold uppercase tracking-[0.04em]", riskPalette.text)}>{fight.weightRisk}</span>
      </div>
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
  { key: "sleep", label: "Sleep", options: ["Poor", "Fair", "Good"] },
  { key: "hydration", label: "Hydration", options: ["Behind", "On track", "Loaded"] },
  { key: "meal_timing", label: "Meal timing", options: ["Empty", "Recent", "Settled"] },
  { key: "soreness", label: "Soreness", options: ["High", "Moderate", "Low"] },
  { key: "recovery", label: "Recovery", options: ["Drained", "Flat", "Ready"] },
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
}: {
  answers: Record<string, string>;
  setAnswers: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  session: string;
  setSession: (value: string) => void;
  intensity: string;
  setIntensity: (value: string) => void;
  activeStep: number;
  setActiveStep: React.Dispatch<React.SetStateAction<number>>;
}) {
  const progress = getBodyCheckProgress(answers, session, intensity);
  const checks = readinessChecks.slice(0, 4);
  const activeCheck = checks[Math.min(activeStep, checks.length - 1)];
  const advance = () => setActiveStep((current) => Math.min(current + 1, progress.total - 1));

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-black/10 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-white">Readiness check-in</p>
          <p className="mt-1 text-xs font-medium text-white/42">
            Step {Math.min(activeStep + 1, progress.total)} of {progress.total}. One signal at a time.
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
              "h-1.5 flex-1 rounded-full transition-all duration-300",
              step.complete ? "bg-emerald-400" : index === activeStep ? "bg-white/45" : "bg-white/10"
            )}
          />
        ))}
      </div>

      <div key={activeStep} className="mt-5 animate-[fuelDecisionIn_350ms_cubic-bezier(0.2,0.8,0.2,1)_both]">
        {activeStep < checks.length && activeCheck ? (
          <CheckInControl
            label={activeCheck.label}
            options={activeCheck.options}
            value={answers[activeCheck.key] || ""}
            onChange={(value) => {
              setAnswers((current) => ({ ...current, [activeCheck.key]: value }));
              window.setTimeout(advance, 180);
            }}
          />
        ) : (
                    <div>
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.04em] text-white/38">Session load</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Session today">
                <Select value={session} onChange={setSession} options={["MMA", "Wrestling", "Boxing", "Padwork", "Sparring", "Strength", "Run", "Rest"]} />
              </Field>
              <Field label="Intensity">
                <Select value={intensity} onChange={setIntensity} options={["Easy", "Standard", "Hard"]} />
              </Field>
            </div>
            <p className="mt-3 text-xs font-medium text-emerald-200/70">
              Session set. Fuel can now calculate today&apos;s ceiling.
            </p>
          </div>
        )}
      </div>

      <div className="mt-5 border-t border-white/[0.06] pt-4">
        <CheckInControl
          label="Recovery state"
          options={readinessChecks[4].options}
          value={answers.recovery || ""}
          onChange={(value) => setAnswers((current) => ({ ...current, recovery: value }))}
        />
        <ContextInput
          className="mt-4"
          label="Injury restriction"
          value={answers.injury_restriction || ""}
          placeholder="e.g. right knee, no sprawls"
          onChange={(value) => setAnswers((current) => ({ ...current, injury_restriction: value }))}
        />
      </div>
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

function ModeButton({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-2xl border p-4 text-left transition-all duration-300 active:scale-[0.98]",
        active ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-300" : "border-white/[0.08] bg-white/[0.035] text-white/48 hover:bg-white/[0.055]"
      )}
    >
      <div className="flex items-center justify-between">
        {icon}
        <span className={cn("h-2 w-2 rounded-full", active ? "bg-emerald-400" : "bg-white/18")} />
      </div>
      <p className="mt-3 text-sm font-bold text-white">{label}</p>
    </button>
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

function TelemetryCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Surface className="p-5">
      <h3 className="text-base font-bold text-white">{title}</h3>
      <div className="mt-4">{children}</div>
    </Surface>
  );
}

function MacroCard({
  code,
  label,
  value,
  confidence,
  why,
}: {
  code: string;
  label: string;
  value: string;
  confidence?: Conf;
  why: string;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.075] bg-white/[0.035] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.04em] text-white/36">{code}</p>
          <p className="mt-2 text-xs font-semibold uppercase tracking-[0.04em] text-white/42">{label}</p>
          <p className="mt-2 text-xl font-bold tabular-nums text-white">{value}</p>
        </div>
        <div className="rounded-full border border-white/[0.08] bg-white/[0.035] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.04em] text-white/50">
          {confidenceLabel(confidence)}
        </div>
      </div>
      <p className="mt-3 text-xs font-medium leading-5 text-white/52">{why}</p>
    </div>
  );
}

function macroWhy(label: "calories" | "protein" | "carbs" | "fat", out: FuelDecisionOutput | null, answers: Record<string, string>) {
  const session = answerValue(answers, "session_today");
  const recovery = answerValue(answers, "recovery");
  const soreness = answerValue(answers, "soreness");
  const timing = answerValue(answers, "meal_timing");
  const state = deriveFuelState(out);

  if (label === "protein") {
    if (recovery === "Drained" || soreness === "High") return "Supports repair before the next hard exposure. Prioritize this before chasing extra work.";
    return "Keeps recovery online so today's technical correction can survive tomorrow.";
  }

  if (label === "carbs") {
    if (state === "CLEAN") return "Enough fuel means hard rounds can stay open without early grip fade.";
    return "If output is capped, carbs are still used to restore the engine for the next session.";
  }

  if (label === "fat") {
    if (timing === "Recent") return "Keep lower close to training so digestion does not steal output.";
    return "Useful away from practice; avoid making it the limiter before live work.";
  }

  if (session !== "Not checked") return `Sets the ceiling for ${session.toLowerCase()} today, not a calorie target.`;
  return "Sets today's output ceiling, not a diet score.";
}

function MemoryMetric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: Tone;
}) {
  const p = palette(tone);

  return (
    <div className={cn("rounded-2xl border p-4", tone === "neutral" ? "border-white/[0.075] bg-white/[0.035]" : cn(p.borderSoft, p.bg))}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.04em] text-white/36">{label}</p>
      <p className={cn("mt-2 text-sm font-medium leading-6", tone === "neutral" ? "text-white/62" : p.text)}>{value}</p>
    </div>
  );
}

function OutputPanel({
  out,
  answers,
  memory,
  history,
  historyLoading,
  refreshHistory,
}: {
  out: FuelDecisionOutput | null;
  answers: Record<string, string>;
  memory: FuelMemory;
  history: FuelHistoryPoint[];
  historyLoading: boolean;
  refreshHistory: () => void;
}) {
  const fight = getFightContext(answers);

  return (
    <div className="space-y-4">
      <TelemetryCard title="Why fuel matters today">
        <div className="grid gap-3 sm:grid-cols-2">
          <MacroCard code="KCAL" label="Output fuel" value={`${fmtRange(out?.macros?.calories_kcal_range)} kcal`} confidence={out?.macro_confidence?.calories} why={macroWhy("calories", out, answers)} />
          <MacroCard code="PRO" label="Recovery support" value={`${fmtRange(out?.macros?.protein_g_range)} g`} confidence={out?.macro_confidence?.protein} why={macroWhy("protein", out, answers)} />
          <MacroCard code="CARBS" label="Round fuel" value={`${fmtRange(out?.macros?.carbs_g_range)} g`} confidence={out?.macro_confidence?.carbs} why={macroWhy("carbs", out, answers)} />
          <MacroCard code="FAT" label="Digestion load" value={`${fmtRange(out?.macros?.fat_g_range)} g`} confidence={out?.macro_confidence?.fat} why={macroWhy("fat", out, answers)} />
        </div>
      </TelemetryCard>

      <TelemetryCard title="Decision rationale">
        {fight.daysOut !== null && fight.daysOut <= 3 ? (
          <div className="rounded-2xl border border-yellow-400/18 bg-yellow-400/[0.07] p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.04em] text-yellow-100/72">Fight-week safety lock</p>
            <p className="mt-2 text-sm font-medium leading-6 text-yellow-50/78">
              Aggressive cut and fueling recommendations are suppressed this close to competition. Follow the coach or qualified cut team.
            </p>
          </div>
        ) : (
          <ExpandableReport report={out?.report} />
        )}
      </TelemetryCard>

      <TelemetryCard title="Body memory">
        <div className="grid gap-3 sm:grid-cols-2">
          <MemoryMetric label="Coach read" value={memory.coachRead} tone={memory.tone} />
          <MemoryMetric label="Sensei handoff" value={memory.senseiHandoff} tone={memory.tone} />
          <MemoryMetric label="Sleep memory" value={memory.sleepPattern} tone={memory.sleepStreak >= 2 ? "caution" : "neutral"} />
          <MemoryMetric label="Readiness history" value={memory.readinessPattern} tone={memory.readinessPattern.includes("dropped") ? "caution" : memory.readinessPattern.includes("improved") ? "clean" : "neutral"} />
          <MemoryMetric label="Hydration trend" value={memory.hydrationTrend} tone={memory.hydrationTrend.includes("behind") ? "caution" : "neutral"} />
          <MemoryMetric label="Training ceiling" value={memory.trainingCeilingHistory} tone={memory.highOutputDays >= 2 ? "clean" : memory.poorReadinessDays > 0 ? "caution" : "neutral"} />
          <MemoryMetric label="Routine memory" value={memory.routineMemory} tone={memory.routineMemory.includes("trained well") ? "clean" : "neutral"} />
          <MemoryMetric label="Technical quality" value={memory.technicalQualityImpact} tone={memory.technicalQualityImpact.includes("affects") ? "caution" : "neutral"} />
          <MemoryMetric label="Works for you" value={memory.foodsThatWork} tone={memory.foodsThatWork.includes("No proven") ? "neutral" : "clean"} />
          <MemoryMetric label="Ruins training" value={memory.foodsThatHurt} tone={memory.foodsThatHurt.includes("No repeat") ? "neutral" : "low"} />
          <MemoryMetric label="Meal timing" value={memory.mealTimingMemory} tone={memory.mealTimingMemory.includes("slowed") || memory.mealTimingMemory.includes("close") ? "caution" : "neutral"} />
          <MemoryMetric label="Hydration pattern" value={memory.hydrationPattern} tone={memory.hydrationPattern.includes("lowered") ? "caution" : "neutral"} />
          <MemoryMetric label="Recovery decision" value={memory.recoveryDecision} tone={memory.tone} />
          <MemoryMetric label="Sensei / Vision impact" value={memory.osImpact} tone={memory.osImpact.includes("capped") ? "caution" : "neutral"} />
          <MemoryMetric label="Recovery trend" value={memory.recoveryTrend} tone={memory.recoveryTrend.includes("red") ? "low" : "neutral"} />
          <MemoryMetric label="Fatigue trend" value={memory.fatigueTrend} tone={memory.fatigueTrend.includes("fatigue flags") ? "caution" : "neutral"} />
          <MemoryMetric label="Correction failures" value={memory.correctionFailures > 0 ? `${memory.correctionFailures} under fatigue this week` : "None logged under fatigue"} tone={memory.correctionFailures >= 2 ? "caution" : "neutral"} />
          <MemoryMetric label="High output days" value={`${memory.highOutputDays} / 7 days`} tone={memory.highOutputDays >= 2 ? "clean" : "neutral"} />
          <MemoryMetric label="Injury restriction" value={memory.injuryRestriction} tone={memory.injuryRestriction === "None logged" ? "neutral" : "low"} />
        </div>
      </TelemetryCard>

      <TelemetryCard title="Readiness trend">
        <div className="mb-4 flex justify-end">
          <button
            type="button"
            onClick={refreshHistory}
            className="rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.04em] text-white/55 transition hover:bg-white/[0.065] hover:text-white"
          >
            {historyLoading ? "Loading" : "Refresh"}
          </button>
        </div>
        <FuelScoreChart data={history} />
      </TelemetryCard>
    </div>
  );
}

function ExpandableReport({ report }: { report?: string }) {
  const [expanded, setExpanded] = useState(false);
  const safe = cleanSentence(report);

  if (!safe) {
    return <p className="text-sm font-medium text-white/42">No report yet. Complete today&apos;s check-in.</p>;
  }

  const short = safe.length > 420 ? `${safe.slice(0, 420).trim()}...` : safe;

  return (
    <div>
      <div className="whitespace-pre-wrap text-sm font-medium leading-7 text-white/68">
        {expanded ? safe : short}
      </div>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="mt-4 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.04em] text-white/55 transition hover:bg-white/[0.065] hover:text-white"
      >
        {expanded ? "Collapse" : "Expand"}
      </button>
    </div>
  );
}

export default function FuelScreen({
  authLoading,
  hasUser,
  profileLine,
  purpose,
  session,
  timeOfTraining,
  mode,
  fightWeek,
  nextMealTarget,
  statusPill,
  mealText,
  setMealText,
  photo,
  setPhoto,
  modeValue,
  setModeSafe,
  sessionValue,
  setSession,
  intensity,
  setIntensity,
  purposeValue,
  setPurpose,
  fightWeekValue,
  setFightWeek,
  timeOfTrainingValue,
  setTimeOfTraining,
  canAnalyze,
  running,
  analyze,
  reset,
  error,
  out,
  answers,
  setAnswers,
  history,
  historyLoading,
  refreshHistory,
}: FuelScreenProps) {
  const state = deriveFuelState(out);
  const fight = getFightContext(answers);
  const memory = useFuelContextMemory(out, answers, history, sessionValue, intensity, mealText, timeOfTrainingValue);
  const baseTone = toneForState(state);
  const tone = state === "CLEAN" && fight.daysOut !== null && fight.daysOut <= 3
    ? "locked"
    : state === "CLEAN" && fight.daysOut !== null && fight.daysOut <= 14
      ? "caution"
      : baseTone;
  const p = palette(tone);

  return (
    <main className={cn(interTight.className, "min-h-screen bg-[#07111e] text-white")}>
      <style jsx global>{`
        @keyframes fuelDecisionIn {
          from { opacity: 0; transform: translateY(8px) scale(0.99); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
      <div className="pointer-events-none fixed inset-0">
        <div className={cn("absolute inset-0 transition-all duration-700", p.wash)} />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.022)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.014)_1px,transparent_1px)] bg-[size:48px_48px] opacity-20" />
      </div>

      <div className="relative mx-auto grid max-w-[1560px] gap-5 px-4 py-6 pb-24 xl:grid-cols-[1fr_430px]">
        <div className="space-y-5">
          <MissionHero
            out={out}
            running={running}
            statusPill={statusPill}
            nextMealTarget={nextMealTarget}
            answers={answers}
            memory={memory}
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
            purpose={purpose}
            session={session}
            intensity={intensity}
            timeOfTraining={timeOfTraining}
            mode={mode}
            fightWeek={fightWeek}
            state={state}
            answers={answers}
          />

          <OutputPanel
            out={out}
            answers={answers}
            memory={memory}
            history={history}
            historyLoading={historyLoading}
            refreshHistory={refreshHistory}
          />
        </div>

        <div className="space-y-6 xl:sticky xl:top-6 xl:self-start">
          <DecisionFeed out={out} nextMealTarget={nextMealTarget} answers={answers} memory={memory} />
          <CommandDock
            modeValue={modeValue}
            setModeSafe={setModeSafe}
            purposeValue={purposeValue}
            setPurpose={setPurpose}
            sessionValue={sessionValue}
            setSession={setSession}
            intensity={intensity}
            setIntensity={setIntensity}
            timeOfTrainingValue={timeOfTrainingValue}
            setTimeOfTraining={setTimeOfTraining}
            fightWeekValue={fightWeekValue}
            setFightWeek={setFightWeek}
            mealText={mealText}
            setMealText={setMealText}
            photo={photo}
            setPhoto={setPhoto}
            answers={answers}
            setAnswers={setAnswers}
            canAnalyze={canAnalyze}
            analyze={analyze}
            running={running}
            reset={reset}
          />
        </div>
      </div>
    </main>
  );
}