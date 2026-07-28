"use client";

import React, { useEffect, useMemo, useState } from "react";
import { FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision";
import SenseiVisionScreen from "@/components/SenseiVisionScreen";
import type { VisionAnalysis } from "@/lib/senseiVisionTypes";
import {
  buildReviewPackage,
  canVisionAnswer,
  validateVisionModelOutput,
  VISION_SYSTEM_INSTRUCTION,
  type AthleteContext,
  type VisionMediaEvidence,
  type VisionReviewPackage,
} from "@/lib/visionGovernance";
import { mergeWorkflow } from "@/lib/workflow/contracts";
import { useProfile } from "@/components/ProfileProvider";
import { readUserJson, removeUserValue, writeUserJson } from "@/lib/userScopedStorage";
import { validateClientImage } from "@/lib/security/imagePolicy";
import { useWorkflow } from "@/components/WorkflowProvider";

export type VisionBuildStage =
  | "IDLE"
  | "UPLOADING_FRAME"
  | "FRAME_LOCKED"
  | "READING_FRAME"
  | "SKELETON_DETECTED"
  | "CORRECTION_FOUND"
  | "BREAK_POINT_IDENTIFIED"
  | "MISSION_UPDATED"
  | "BUILDING_CORRECTION"
  | "DONE"
  | "ERROR";

type VisionCommunicationMode = "ANALYSIS" | "COACHING";

export type VisionChatMessage = {
  id: string;
  role: "user" | "vision" | "system";
  text: string;
  ts: number;
};

type VisionSkeletonReport = {
  detected: boolean;
  landmarkCount: number;
  confidence: "LOW" | "MEDIUM" | "HIGH";
  flags: string[];
  readable: string;
};

type FighterMemorySignal = {
  repeatedIssue: string;
  occurrences: number;
  status: string;
  journeyState: string;
  journeyMessage: string;
  proofStatus: string;
  recurringPatterns: string[];
  previousCorrection: string;
  currentCorrection: string;
  openingPattern: string;
};

type VisionTimelineContext = {
  nextCompetition: string;
  daysOut: number | null;
  weightClass: string;
  currentCorrectionLock: string;
  repeatedIssueCount: number;
};

type FighterConstraintContext = {
  injuryStatus: string;
  movementRestrictions: string[];
  painFlags: string[];
  clearance: string;
  campPhase: string;
  recoveryState: string;
  limited: boolean;
};

type VisionTrainingContext = "Training" | "Competition";

type VisionMemoryTrend = "improving" | "stagnant" | "worsening";

type VisionMemoryRecord = {
  id: string;
  analysisId: string;
  correction: string;
  correctionKey: string;
  breakPoint: string;
  openingMissed: string;
  openingCreated: string;
  positionLost: string;
  proofResult: string;
  drillPrescribed: string;
  firstSeen: string;
  lastSeen: string;
  totalOccurrences: number;
  successRate: number;
  sport: string;
  context: VisionTrainingContext;
  round: number | null;
  clipLabel: string;
  severity: string;
  openingStatus: string;
  createdAt: string;
};

type VisionMemoryStore = {
  version: 1;
  records: VisionMemoryRecord[];
};

type VisionMemoryProfile = {
  store: VisionMemoryStore;
  activeRecord: VisionMemoryRecord | null;
  totalFrames: number;
  totalOccurrences: number;
  successRate: number;
  trend: VisionMemoryTrend;
  trendLine: string;
  roundSignal: string;
  drillingSignal: string;
  openingSignal: string;
  sameBreakPointLine: string;
  memoryLine: string;
  instruction: string;
  recurringCorrections: string[];
};

type VisionPlanUpdate = {
  updatedAt: string;
  mode: VisionCommunicationMode;
  activeCorrection: string;
  proofStatus: string;
  nextDrill: string;
  senseiHandoff: string;
  fuelRelevance: string;
  timestamp: string;
};

const OPENING_CREATION_CATEGORIES = [
  "Opening Created",
  "Opening Missed",
  "Opening Lost",
  "No Opening Created",
  "Finished Despite Flaw",
  "Opponent Trap",
] as const;

const OPENING_NEEDS = [
  "Weight Shift",
  "Defensive Step",
  "Posture Break",
  "Hand Reaction",
  "Guard Reaction",
  "Ribs Exposed",
  "Lead Leg Heavy",
  "Stance Square",
  "Level Change Reaction",
  "Fence Pressure",
  "Retreat",
  "Overcommitment",
  "Win head position",
] as const;

function combatFamily(f: any) {
  const sport = cleanText(f?.sport || f?.discipline || "").toUpperCase();
  if (sport.includes("BOXING")) return "BOXING";
  if (sport.includes("KICKBOX")) return "KICKBOXING";
  if (sport.includes("MUAY")) return "MUAY_THAI";
  if (sport.includes("MMA")) return "MMA";
  if (sport.includes("BJJ") || sport.includes("JUDO") || sport.includes("SAMBO")) {
    return "GRAPPLING";
  }
  return "WRESTLING";
}

type VisionApiResponse =
  | {
      ok: true;
      analysis: VisionAnalysis;
      skeleton?: VisionSkeletonReport;
    }
  | { ok: false; error?: string };

let poseLandmarker: PoseLandmarker | null = null;

async function getPoseLandmarker() {
  if (poseLandmarker) return poseLandmarker;

  const vision = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
  );

  poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath:
        "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task",
    },
    runningMode: "IMAGE",
    numPoses: 1,
  });

  return poseLandmarker;
}

function uid() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function cleanText(text?: string | null) {
  return String(text || "").replace(/\s+/g, " ").trim();
}

function cleanMultiline(text?: string | null) {
  return String(text || "")
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function compact(text?: string | null, max = 520) {
  const value = cleanText(text);
  if (!value) return "";
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1).trim()}…`;
}

function coachLanguage(text?: string | null) {
  return String(text || "")
    .replace(/Head Position Win/gi, "win head position")
    .replace(/No Opening Created/gi, "you went too early")
    .replace(/Opening Created/gi, "you got the reaction")
    .replace(/Opening Missed/gi, "you saw it late")
    .replace(/Opening Lost/gi, "you waited too long")
    .replace(/Finished Despite Flaw/gi, "it worked, but it was wrong")
    .replace(/Opponent Trap/gi, "he baited the shot")
    .replace(/Required Opening/gi, "reaction you need")
    .replace(/Better Opponent/gi, "opponent")
    .replace(/Attack Window/gi, "time to go")
    .replace(/State Change/gi, "reaction")
    .replace(/Exchange/gi, "position")
    .replace(/Generated/gi, "ready")
    .replace(/\bwindow\b/gi, "moment")
    .replace(/\bopportunity\b/gi, "chance")
    .replace(/\b(?:likely|potentially|generally|often|typically)\b/gi, "")
    .replace(/\bmay\b/gi, "will")
    .replace(/\bcould\b/gi, "will")
    .replace(/high[- ]level opponent/gi, "opponent")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function normalizeKey(text?: string | null) {
  return cleanText(text)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\b(the|a|an|to|too|far|your|you|is|are|with|under)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getPrimaryFinding(analysis?: VisionAnalysis | null) {
  const findings = Array.isArray((analysis as any)?.findings)
    ? ((analysis as any).findings as any[])
    : [];

  return findings[0] || null;
}

function getFindingTitle(analysis?: VisionAnalysis | null) {
  return cleanText(getPrimaryFinding(analysis)?.title || "");
}

function getOpeningStatusFromFinding(finding: any) {
  return cleanText(finding?.opening_status || finding?.opening_creation || "");
}

function getBestOpeningFromFinding(finding: any) {
  return cleanText(
    finding?.required_opening ||
      finding?.best_opening ||
      finding?.opening_needed ||
      finding?.reaction_required ||
      ""
  );
}

function getProofStatusFromFinding(finding: any) {
  const severity = cleanText(finding?.severity || "").toUpperCase();

  if (severity === "HIGH" || severity === "MEDIUM") {
    return "Progression locked";
  }

  if (severity === "LOW") {
    return "Watch";
  }

  return "Unknown";
}

function readVisionMemoryStore(userId?: string | null): VisionMemoryStore {
  try {
    const parsed = readUserJson<unknown>(userId, "disciplin_vision_memory");
    if (!parsed) return { version: 1, records: [] };
    const parsedRecord = parsed as { records?: unknown };
    const records = Array.isArray(parsedRecord.records)
      ? parsedRecord.records
      : Array.isArray(parsed)
        ? parsed
        : [];

    return {
      version: 1,
      records: records
        .map((record: any) => ({
          id: cleanText(record.id) || uid(),
          analysisId: cleanText(record.analysisId || record.analysis_id || ""),
          correction: cleanText(record.correction || "Unknown correction"),
          correctionKey:
            cleanText(record.correctionKey) ||
            normalizeKey(record.correction || "Unknown correction"),
          breakPoint: cleanMultiline(record.breakPoint || ""),
          openingMissed: cleanMultiline(record.openingMissed || ""),
          openingCreated: cleanMultiline(record.openingCreated || ""),
          positionLost: cleanMultiline(record.positionLost || ""),
          proofResult: cleanText(record.proofResult || "Unknown"),
          drillPrescribed: cleanMultiline(record.drillPrescribed || ""),
          firstSeen: cleanText(record.firstSeen || record.createdAt || ""),
          lastSeen: cleanText(record.lastSeen || record.createdAt || ""),
          totalOccurrences: Number(record.totalOccurrences || 1),
          successRate: Number(record.successRate || 0),
          sport: cleanText(record.sport || "Unknown"),
          context: (
            cleanText(record.context).toLowerCase() === "competition"
              ? "Competition"
              : "Training") as VisionTrainingContext,
          round: Number.isFinite(Number(record.round)) ? Number(record.round) : null,
          clipLabel: cleanText(record.clipLabel || ""),
          severity: cleanText(record.severity || "Unknown"),
          openingStatus: cleanText(record.openingStatus || ""),
          createdAt: cleanText(record.createdAt || record.lastSeen || ""),
        }))
        .filter((record: VisionMemoryRecord) => Boolean(record.correctionKey))
        .slice(0, 500),
    };
  } catch {
    return { version: 1, records: [] };
  }
}

function writeVisionMemoryStore(store: VisionMemoryStore, userId?: string | null) {
  writeUserJson(userId, "disciplin_vision_memory", {
      version: 1,
      records: store.records.slice(0, 500),
    });
}

function ordinalSuffix(value: number) {
  const mod100 = value % 100;
  if (mod100 >= 11 && mod100 <= 13) return "th";
  const mod10 = value % 10;
  if (mod10 === 1) return "st";
  if (mod10 === 2) return "nd";
  if (mod10 === 3) return "rd";
  return "th";
}

function ordinalWord(value: number) {
  const words: Record<number, string> = {
    1: "first",
    2: "second",
    3: "third",
    4: "fourth",
    5: "fifth",
    6: "sixth",
    7: "seventh",
    8: "eighth",
    9: "ninth",
    10: "tenth",
  };

  return words[value] || `${value}${ordinalSuffix(value)}`;
}

function inferTrainingContext(analysis: VisionAnalysis): VisionTrainingContext {
  const text = cleanText(
    [
      (analysis as any)?.clipLabel,
      (analysis as any)?.context,
      (analysis as any)?.notes,
      getPrimaryFinding(analysis)?.process,
    ]
      .filter(Boolean)
      .join(" ")
  );

  return /fight|competition|compete|match|bout|tournament|final|semi|quarter/i.test(
    text
  )
    ? "Competition"
    : "Training";
}

function inferRound(analysis: VisionAnalysis): number | null {
  const text = cleanText(
    [
      (analysis as any)?.clipLabel,
      (analysis as any)?.context,
      (analysis as any)?.notes,
    ]
      .filter(Boolean)
      .join(" ")
  );
  const match = text.match(/\b(?:round|r)\s*([1-9]\d?)\b/i);
  return match ? Number(match[1]) : null;
}

function inferProofResult(finding: any) {
  const explicit = cleanText(
    finding?.proof_result ||
      finding?.proof_status ||
      finding?.retention_status ||
      finding?.correction_journey_state ||
      ""
  );
  if (explicit) return explicit;

  const severity = cleanText(finding?.severity).toUpperCase();
  const openingStatus = getOpeningStatusFromFinding(finding);

  if (severity === "LOW" || openingStatus === "Opening Created") return "Held";

  if (
    severity === "HIGH" ||
    severity === "MEDIUM" ||
    /No Opening Created|Opening Lost|Finished Despite Flaw|Opponent Trap/i.test(
      openingStatus
    )
  ) {
    return "Failed";
  }

  return "Unproven";
}

function proofSucceeded(record: VisionMemoryRecord) {
  return /held|retained|surviving|clean|passed|verified/i.test(record.proofResult);
}

function buildVisionMemoryRecord(
  analysis: VisionAnalysis,
  store: VisionMemoryStore
): VisionMemoryRecord | null {
  const finding = getPrimaryFinding(analysis);
  if (!finding) return null;

  const correction = cleanText(finding.decision || finding.title || "Unknown correction");
  const correctionKey = normalizeKey(correction || finding.title);
  if (!correctionKey) return null;

  const now = new Date().toISOString();
  const previous = store.records.filter((record) => record.correctionKey === correctionKey);
  const proofResult = inferProofResult(finding);
  const previousSuccesses = previous.filter(proofSucceeded).length;
  const currentSuccess = /held|retained|surviving|clean|passed|verified/i.test(
    proofResult
  )
    ? 1
    : 0;
  const totalOccurrences = previous.length + 1;
  const successRate = Math.round(
    ((previousSuccesses + currentSuccess) / totalOccurrences) * 100
  );
  const train = Array.isArray(finding.train) ? finding.train : [];

  return {
    id: uid(),
    analysisId: cleanText((analysis as any)?.analysis_id || ""),
    correction,
    correctionKey,
    breakPoint: cleanMultiline(
      finding.exchange_break || finding.where_exchange_broke || finding.break_point || ""
    ),
    openingMissed: cleanMultiline(
      finding.missing_reaction ||
        finding.required_opening ||
        finding.best_opening ||
        finding.opening_needed ||
        ""
    ),
    openingCreated: cleanMultiline(
      finding.opening_status === "Opening Created"
        ? finding.required_opening || finding.best_opening || finding.exchange_opening || ""
        : finding.exchange_opening || ""
    ),
    positionLost: cleanMultiline(
      finding.position_lost ||
        finding.opponent_punishment ||
        finding.better_opponent_counter ||
        finding.if_ignored ||
        ""
    ),
    proofResult,
    drillPrescribed: cleanMultiline(
      finding.todays_proof || train.join("\n") || finding.fix_next_rep || ""
    ),
    firstSeen: previous[0]?.firstSeen || now,
    lastSeen: now,
    totalOccurrences,
    successRate,
    sport: cleanText((analysis as any)?.sport || finding.sport || "Unknown"),
    context: inferTrainingContext(analysis),
    round: inferRound(analysis),
    clipLabel: cleanText((analysis as any)?.clipLabel || ""),
    severity: cleanText(finding.severity || "Unknown"),
    openingStatus: getOpeningStatusFromFinding(finding),
    createdAt: now,
  };
}

function rememberVisionFrame(
  analysis: VisionAnalysis,
  userId?: string | null,
  store = readVisionMemoryStore(userId)
) {
  const record = buildVisionMemoryRecord(analysis, store);
  if (!record) return store;

  const records = [
    record,
    ...store.records.filter((item) => item.analysisId !== record.analysisId),
  ].slice(0, 500);
  const nextStore = { version: 1 as const, records };
  writeVisionMemoryStore(nextStore, userId);
  return nextStore;
}

function memoryTrend(records: VisionMemoryRecord[]): VisionMemoryTrend {
  if (records.length < 4) return "stagnant";

  const recent = records.slice(0, Math.min(5, records.length));
  const older = records.slice(recent.length, recent.length + 5);
  if (!older.length) return "stagnant";

  const recentRate = recent.filter(proofSucceeded).length / Math.max(1, recent.length);
  const olderRate = older.filter(proofSucceeded).length / Math.max(1, older.length);
  const recentFailures = recent.filter((record) => !proofSucceeded(record)).length;
  const olderFailures = older.filter((record) => !proofSucceeded(record)).length;

  if (recentRate > olderRate + 0.2 || recentFailures < olderFailures - 1) {
    return "improving";
  }

  if (recentRate < olderRate - 0.2 || recentFailures > olderFailures + 1) {
    return "worsening";
  }

  return "stagnant";
}

function buildVisionMemoryProfile(
  active: VisionAnalysis | null,
  userId?: string | null,
  store = readVisionMemoryStore(userId)
): VisionMemoryProfile {
  const activeRecord = active ? buildVisionMemoryRecord(active, store) : null;
  const correctionKey = activeRecord?.correctionKey || "";
  const storedRecords = activeRecord
    ? store.records.filter(
        (record) =>
          !activeRecord.analysisId || record.analysisId !== activeRecord.analysisId
      )
    : store.records;
  const related = correctionKey
    ? [activeRecord, ...storedRecords].filter(
        (record): record is VisionMemoryRecord =>
          Boolean(record && record.correctionKey === correctionKey)
      )
    : storedRecords.slice(0, 20);
  const previousRelated = activeRecord
    ? storedRecords.filter((record) => record.correctionKey === activeRecord.correctionKey)
    : related.slice(1);
  const totalOccurrences = related.length;
  const successRate = totalOccurrences
    ? Math.round(
        (related.filter(proofSucceeded).length / Math.max(1, totalOccurrences)) * 100
      )
    : 0;
  const trend = memoryTrend(related);
  const roundCounts = new Map<string, number>();
  const openingCounts = new Map<string, number>();
  const correctionCounts = new Map<string, number>();
  const drilling = related.filter((record) => record.context === "Training");
  const competition = related.filter((record) => record.context === "Competition");

  store.records.forEach((record) => {
    pushCount(correctionCounts, record.correction);
    if (record.round) pushCount(roundCounts, `round ${record.round}`);
    if (record.openingMissed) pushCount(openingCounts, record.openingMissed);
  });

  const [topRound, topRoundCount] = mostFrequent(roundCounts);
  const [topOpening, topOpeningCount] = mostFrequent(openingCounts);
  const recurringCorrections = Array.from(correctionCounts.entries())
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([correction, count]) => `${correction} (${count})`);
  const drillingRate = drilling.length
    ? Math.round((drilling.filter(proofSucceeded).length / drilling.length) * 100)
    : null;
  const competitionRate = competition.length
    ? Math.round(
        (competition.filter(proofSucceeded).length / competition.length) * 100
      )
    : null;
  const trendLine =
    trend === "improving"
      ? "This correction is improving."
      : trend === "worsening"
        ? "This correction is slipping."
        : "This correction is not changing yet.";
  const roundSignal =
    topRound && topRoundCount > 1
      ? `This shows up most in ${topRound}.`
      : "No round pattern yet.";
  const drillingSignal =
    drillingRate !== null && competitionRate !== null && drillingRate > competitionRate
      ? "You solve it in drilling and lose it under resistance."
      : drillingRate !== null
        ? `Training proof rate: ${drillingRate}%.`
        : "No drilling proof yet.";
  const openingSignal =
    topOpening && topOpeningCount > 1
      ? `${topOpening} keeps appearing. You rarely take it clean.`
      : "No repeated opening pattern yet.";
  const sameBreakPoint = Boolean(
    activeRecord?.breakPoint &&
      previousRelated[0]?.breakPoint &&
      normalizeKey(activeRecord.breakPoint) === normalizeKey(previousRelated[0].breakPoint)
  );
  const sameBreakPointLine = sameBreakPoint
    ? "Same break point as last session."
    : "";
  const memoryLine =
    activeRecord && totalOccurrences > 1
      ? `This is not new. This is the ${ordinalWord(totalOccurrences)} occurrence.`
      : activeRecord
        ? "First time Vision has tagged this correction."
        : "No active correction yet.";

  return {
    store,
    activeRecord,
    totalFrames: store.records.length,
    totalOccurrences,
    successRate,
    trend,
    trendLine,
    roundSignal,
    drillingSignal,
    openingSignal,
    sameBreakPointLine,
    memoryLine,
    recurringCorrections,
    instruction: [
      "VISION MEMORY: Remember the athlete across frames.",
      "Use the memory as coaching evidence, not extra clutter.",
      activeRecord ? `Active correction: ${activeRecord.correction}.` : "",
      activeRecord ? `Total occurrences: ${totalOccurrences}.` : "",
      activeRecord ? `Success rate: ${successRate}%.` : "",
      trendLine,
      sameBreakPointLine,
      roundSignal,
      drillingSignal,
      openingSignal,
      recurringCorrections.length
        ? `Recurring corrections: ${recurringCorrections.join(" | ")}.`
        : "",
      "If this is repeating, say it plainly. If it improves, say what is holding. If it worsens, lock the proof.",
      "Never let the memory create a second correction. Use it to sharpen the current correction.",
    ]
      .filter(Boolean)
      .join("\n"),
  };
}

function applyVisionMemoryProfile(
  analysis: VisionAnalysis,
  profile: VisionMemoryProfile
) {
  const findings = Array.isArray((analysis as any)?.findings)
    ? ((analysis as any).findings as any[])
    : [];

  if (!findings.length) return analysis;

  return {
    ...analysis,
    vision_memory: {
      totalFrames: profile.totalFrames,
      activeRecord: profile.activeRecord,
      totalOccurrences: profile.totalOccurrences,
      successRate: profile.successRate,
      trend: profile.trend,
      trendLine: profile.trendLine,
      roundSignal: profile.roundSignal,
      drillingSignal: profile.drillingSignal,
      openingSignal: profile.openingSignal,
      sameBreakPointLine: profile.sameBreakPointLine,
      recurringCorrections: profile.recurringCorrections,
    },
    findings: findings.map((finding, index) =>
      index === 0
        ? {
            ...finding,
            vision_memory_signal: [
              profile.memoryLine,
              profile.trendLine,
              profile.sameBreakPointLine,
              profile.roundSignal,
              profile.drillingSignal,
              profile.openingSignal,
            ]
              .filter(Boolean)
              .join("\n"),
            memory_total_occurrences: profile.totalOccurrences,
            memory_success_rate: profile.successRate,
            memory_trend: profile.trend,
            memory_same_break_point: profile.sameBreakPointLine,
            memory_round_signal: profile.roundSignal,
            memory_drilling_signal: profile.drillingSignal,
            memory_opening_signal: profile.openingSignal,
          }
        : finding
    ),
  } as VisionAnalysis;
}

function findTimelineValue(
  source: unknown,
  keys: string[],
  depth = 0
): unknown {
  if (!source || typeof source !== "object" || depth > 4) return undefined;

  const normalizedKeys = keys.map((key) => key.replace(/[^a-z0-9]/gi, "").toLowerCase());

  for (const [key, value] of Object.entries(source as Record<string, unknown>)) {
    const normalizedKey = key.replace(/[^a-z0-9]/gi, "").toLowerCase();
    if (normalizedKeys.includes(normalizedKey) && value !== "" && value != null) {
      return value;
    }
  }

  for (const value of Object.values(source as Record<string, unknown>)) {
    const nested = findTimelineValue(value, keys, depth + 1);
    if (nested !== undefined) return nested;
  }

  return undefined;
}

function readFighterConstraints(userId?: string | null): FighterConstraintContext {
  const sources: unknown[] = [];
  const storageKeys = [
    "disciplin_profile",
    "disciplin_fighter_profile",
    "disciplin_camp_state",
    "disciplin_build_camp",
    "disciplin_recovery",
    "disciplin_fighter_context",
  ];

  storageKeys.forEach((key) => {
    const value = readUserJson<unknown>(userId, key);
    if (value) sources.push(value);
  });

  const read = (keys: string[]) => {
    for (const source of sources) {
      const value = findTimelineValue(source, keys);
      if (value !== undefined) return value;
    }
    return undefined;
  };
  const list = (value: unknown) =>
    (Array.isArray(value) ? value : value ? [value] : [])
      .map((item) => cleanText(String(item)))
      .filter((item) => item && !/^(none|no restrictions|no pain|clear|healthy)$/i.test(item));

  const injuryStatus = cleanText(String(read(["injuryStatus", "injury", "injuries"]) || ""));
  const movementRestrictions = list(
    read(["movementRestrictions", "movementRestriction", "restrictions", "restrictedMovements"])
  );
  const painFlags = list(read(["painFlags", "painFlag", "pain", "painAreas"]));
  const clearance = cleanText(
    String(read(["clearance", "contactStatus", "trainingClearance", "medicalClearance"]) || "Cleared")
  );
  const campPhase = cleanText(String(read(["campPhase", "phase", "trainingPhase"]) || ""));
  const recoveryState = cleanText(
    String(read(["recoveryState", "recoveryStatus", "readiness", "recovery"]) || "")
  );
  const activeInjury =
    Boolean(injuryStatus) && !/^(none|clear|cleared|healthy|resolved|recovered)$/i.test(injuryStatus);
  const clearanceLimited = /limited|no contact|not cleared|restricted/i.test(clearance);
  const recoveryLimited = /poor|low|recovering|fatigue|depleted/i.test(recoveryState);
  const limited =
    activeInjury ||
    movementRestrictions.length > 0 ||
    painFlags.length > 0 ||
    clearanceLimited ||
    recoveryLimited;

  return {
    injuryStatus,
    movementRestrictions,
    painFlags,
    clearance,
    campPhase,
    recoveryState,
    limited,
  };
}

function buildConstraintInstruction(context: FighterConstraintContext) {
  return [
    "FIGHTER CONSTRAINTS: The correction never changes. The proof pathway can change.",
    `Injury status: ${context.injuryStatus || "None reported"}.`,
    `Movement restrictions: ${context.movementRestrictions.join(" | ") || "None reported"}.`,
    `Pain flags: ${context.painFlags.join(" | ") || "None reported"}.`,
    `Clearance: ${context.clearance || "Unknown"}.`,
    `Camp phase: ${context.campPhase || "Not set"}.`,
    `Recovery state: ${context.recoveryState || "Not set"}.`,
    context.limited
      ? "Keep the main correction and FORCE-SEE-GO unchanged. Remove drills, finishes, contact, resistance, pivots, penetration steps, or ranges that conflict with the listed constraints. Return correction_stays, proof_changes, todays_proof, and proof_fail."
      : "Use the normal proof pathway. Do not invent a limitation.",
  ].join("\n");
}

function applyFighterConstraints(
  analysis: VisionAnalysis,
  context: FighterConstraintContext
) {
  const findings = Array.isArray((analysis as any)?.findings)
    ? ((analysis as any).findings as any[])
    : [];

  if (!context.limited || !findings.length) {
    return { ...analysis, fighter_constraints: context } as VisionAnalysis;
  }

  const evidence = [
    context.injuryStatus,
    ...context.movementRestrictions,
    ...context.painFlags,
    context.clearance,
    context.recoveryState,
  ].join(" ").toLowerCase();
  const noContact = /no contact|not cleared/.test(evidence);
  const lowerBody = /knee|ankle|foot|hip|leg|pivot|penetration/.test(evidence);
  const correction = cleanText(
    findings[0]?.required_opening || findings[0]?.best_opening || findings[0]?.title
  );
  const reason = [
    context.injuryStatus,
    context.movementRestrictions.join(", "),
    context.painFlags.join(", "),
    context.clearance,
  ].filter(Boolean).join(". ");
  const family = combatFamily(findings[0]);
  const grappling = family === "WRESTLING" || family === "GRAPPLING" || family === "MMA";
  const todaysProof = lowerBody
    ? grappling
      ? "10 controlled entries from a stable stance. No finish, penetration step, pivot, or live resistance."
      : "10 stationary setup-and-reaction reps. No pivot, impact, or live resistance."
    : noContact
      ? "10 clean technical reps with no contact or live resistance."
      : "10 controlled technical reps inside the listed movement limits.";
  const safeTrain = lowerBody
    ? ["Stationary setup reps", "Position-only entries", "Reset when the correction breaks"]
    : ["Controlled setup reps", "Reaction recognition reps", "Reset when the correction breaks"];

  return {
    ...analysis,
    fighter_constraints: context,
    findings: findings.map((finding, index) =>
      index === 0
        ? {
            ...finding,
            constraint_active: true,
            constraint_reason: reason,
            correction_stays: correction,
            proof_changes: lowerBody
              ? "No live finishes or lower-body loading while restricted."
              : noContact
                ? "No contact or live resistance while restricted."
                : "Proof stays inside the current movement limits.",
            todays_proof: todaysProof,
            proof_fail: "The correction breaks or pain/restriction appears.",
            train: safeTrain,
          }
        : finding
    ),
  } as VisionAnalysis;
}

function readTimelineContext(
  userId?: string | null,
  history: VisionAnalysis[] = [],
  active?: VisionAnalysis | null
): VisionTimelineContext {
  const sources: unknown[] = [];
  const storageKeys = [
    "disciplin_profile",
    "disciplin_fighter_profile",
    "disciplin_camp_state",
    "disciplin_build_camp",
    "disciplin_next_fight",
    "disciplin_fighter_context",
  ];

  storageKeys.forEach((key) => {
    const value = readUserJson<unknown>(userId, key);
    if (value) sources.push(value);
  });

  const read = (keys: string[]) => {
    for (const source of sources) {
      const value = findTimelineValue(source, keys);
      if (value !== undefined) return value;
    }
    return undefined;
  };

  const nextCompetition = cleanText(
    String(
      read(["nextFight", "nextCompetition", "fightName", "competitionName", "eventName"]) ||
        ""
    )
  );
  const competitionDate = read([
    "nextFightDate",
    "nextCompetitionDate",
    "fightDate",
    "competitionDate",
    "eventDate",
  ]);
  const explicitDays = Number(read(["daysOut", "daysUntilFight", "daysUntilCompetition"]));
  const parsedDate = competitionDate ? new Date(String(competitionDate)) : null;
  const calculatedDays =
    parsedDate && !Number.isNaN(parsedDate.getTime())
      ? Math.max(0, Math.ceil((parsedDate.getTime() - Date.now()) / 86400000))
      : null;
  const daysOut = Number.isFinite(explicitDays) ? Math.max(0, explicitDays) : calculatedDays;
  const weightClass = cleanText(
    String(read(["weightClass", "fightWeight", "competitionWeight", "targetWeightClass"]) || "")
  );
  const activeFinding = getPrimaryFinding(active);
  const memorySignal = activeFinding
    ? buildFighterMemorySignal(activeFinding, history)
    : null;

  return {
    nextCompetition,
    daysOut,
    weightClass,
    currentCorrectionLock: getFindingTitle(active) || "None",
    repeatedIssueCount: memorySignal?.occurrences || 0,
  };
}

function buildTimelineInstruction(context: VisionTimelineContext) {
  return [
    "FIGHTER TIMELINE: Use this context to set urgency without adding extra corrections.",
    `Next fight or competition: ${context.nextCompetition || "Not set"}.`,
    `Days out: ${context.daysOut ?? "Not set"}.`,
    `Weight class: ${context.weightClass || "Not set"}.`,
    `Current correction lock: ${context.currentCorrectionLock || "None"}.`,
    `Repeated issue count: ${context.repeatedIssueCount}.`,
    context.daysOut != null && context.daysOut <= 21
      ? "Competition is close. Do not add new chains. Fix this one correction and demand proof."
      : "Keep the correction narrow and appropriate to the available timeline.",
    context.repeatedIssueCount >= 2
      ? "Use the repeat count as evidence for the correction journey. Never lead visible coaching with the number."
      : "Do not call the issue recurring unless history proves it.",
  ].join("\n");
}

function applyTimelineUrgency(
  analysis: VisionAnalysis,
  context: VisionTimelineContext
) {
  const findings = Array.isArray((analysis as any)?.findings)
    ? ((analysis as any).findings as any[])
    : [];
  const primaryFinding = findings[0] || {};
  const journeyState = cleanText(primaryFinding.correction_journey_state || "");
  const journeyMessage = cleanText(primaryFinding.correction_journey_message || "");
  const urgency = [
    context.daysOut != null && context.daysOut <= 21
      ? `${context.daysOut} days out. No new chains. Fix this one correction.`
      : "",
    journeyState && journeyMessage ? `${journeyState}. ${journeyMessage}` : "",
  ]
    .filter(Boolean)
    .join(" ");

  return {
    ...analysis,
    timeline_context: context,
    findings: findings.map((finding, index) =>
      index === 0
        ? { ...finding, timeline_context: context, urgency_line: urgency }
        : finding
    ),
  } as VisionAnalysis;
}

function pushCount(map: Map<string, number>, key?: string | null) {
  const value = cleanText(key);
  if (!value) return;
  map.set(value, (map.get(value) || 0) + 1);
}

function mostFrequent(map: Map<string, number>) {
  return [...map.entries()].sort((a, b) => b[1] - a[1])[0] || ["", 0];
}

function normalizeOpeningCategory(value?: string | null) {
  const raw = cleanText(value).toUpperCase();

  if (!raw) return "";

  const exact = OPENING_CREATION_CATEGORIES.find(
    (category) => category.toUpperCase() === raw
  );

  if (exact) return exact;

  if (
    raw.includes("OPPONENT TRAP") ||
    raw.includes("TRAP") ||
    raw.includes("BAIT")
  ) {
    return "Opponent Trap";
  }

  if (
    raw.includes("NO OPENING CREATED") ||
    raw.includes("NOT CREATED") ||
    raw.includes("NO OPENING") ||
    raw.includes("NONE")
  ) {
    return "No Opening Created";
  }

  if (
    raw.includes("WORKED THIS TIME") ||
    raw.includes("FINISHED DESPITE FLAW") ||
    raw.includes("SUCCESS HID MISTAKE") ||
    raw.includes("BAD PROCESS") ||
    raw.includes("RESULT HID PROBLEM") ||
    raw.includes("OUTCOME HID") ||
    raw.includes("OUTCOME HIDE") ||
    raw.includes("OUTCOME") ||
    raw.includes("HIDES") ||
    raw.includes("HID PROCESS") ||
    raw.includes("FORCED")
  ) {
    return "Finished Despite Flaw";
  }

  if (raw.includes("LOST")) {
    return "Opening Lost";
  }

  if (raw.includes("MISSED")) {
    return "Opening Missed";
  }

  if (raw.includes("CREATED")) {
    return "Opening Created";
  }

  return cleanText(value);
}

function normalizeOpeningNeed(value?: string | null) {
  const raw = cleanText(value).toUpperCase();

  if (!raw) return "";

  const exact = OPENING_NEEDS.find((need) => need.toUpperCase() === raw);

  if (exact) return exact;

  if (raw.includes("HEAD")) return "Win head position";
  if (raw.includes("RIB") || raw.includes("ELBOW")) return "Ribs Exposed";
  if (raw.includes("LEAD LEG") || raw.includes("HEAVY LEG")) return "Lead Leg Heavy";
  if (raw.includes("SQUARE") || raw.includes("FEET STOP")) return "Stance Square";
  if (raw.includes("GUARD") || raw.includes("SHELL") || raw.includes("REAR HAND")) return "Guard Reaction";
  if (raw.includes("POSTURE") || raw.includes("SNAP")) return "Posture Break";
  if (raw.includes("DEFENSIVE STEP") || raw.includes("STEP")) return "Defensive Step";
  if (raw.includes("HAND") || raw.includes("GRIP") || raw.includes("POST")) return "Hand Reaction";
  if (raw.includes("LEVEL")) return "Level Change Reaction";
  if (raw.includes("FENCE") || raw.includes("CAGE") || raw.includes("WALL")) return "Fence Pressure";
  if (raw.includes("RETREAT") || raw.includes("BACK")) return "Retreat";
  if (raw.includes("OVERCOMMIT") || raw.includes("REACH") || raw.includes("LUNGE")) return "Overcommitment";
  if (raw.includes("WEIGHT") || raw.includes("SHIFT")) return "Weight Shift";

  return cleanText(value);
}

function inferOpeningStatus(f: any) {
  const text = [
    f?.title,
    f?.severity,
    f?.result,
    f?.process,
    f?.good,
    f?.unstable,
    f?.break_point,
    f?.dashboard_detail,
    f?.cost_of_delay,
    f?.if_ignored,
    f?.short_detail,
    f?.pattern_line,
    f?.fix_next_rep,
    f?.interrupt,
  ]
    .map((x) => cleanText(x))
    .filter(Boolean)
    .join(" ")
    .toUpperCase();

  if (
    text.includes("TRAP") ||
    text.includes("BAIT") ||
    text.includes("GUILLOTINE") ||
    text.includes("COUNTER") ||
    text.includes("PUNISH")
  ) {
    return "Opponent Trap";
  }

  if (
    text.includes("OUTCOME") ||
    text.includes("HIDES") ||
    text.includes("FORCED")
  ) {
    return "Finished Despite Flaw";
  }

  if (
    text.includes("FINISH") ||
    text.includes("WORKED") ||
    text.includes("SUCCESS") ||
    text.includes("GOT CLOSE") ||
    text.includes("COMPLETED")
  ) {
    if (
      text.includes("NO SETUP") ||
      text.includes("WEAK ENTRY") ||
      text.includes("STABLE") ||
      text.includes("SPEED") ||
      text.includes("STRENGTH") ||
      text.includes("LOW-QUALITY")
    ) {
      return "Finished Despite Flaw";
    }
  }

  if (
    text.includes("DELAY") ||
    text.includes("LATE") ||
    text.includes("HESITAT") ||
    text.includes("LOST")
  ) {
    return "Opening Lost";
  }

  if (
    text.includes("MISSED") ||
    text.includes("DID NOT TAKE") ||
    text.includes("AVAILABLE OPENING") ||
    text.includes("OPENING WAS THERE")
  ) {
    return "Opening Missed";
  }

  if (
    text.includes("FORCED REACTION") ||
    text.includes("FORCED A REACTION") ||
    text.includes("POSTURE BREAK") ||
    text.includes("BROKE POSTURE") ||
    text.includes("WEIGHT SHIFT") ||
    text.includes("LEVEL FAKE") ||
    text.includes("SNAP") ||
    text.includes("ANGLE CHANGE") ||
    text.includes("HAND FIGHT")
    || text.includes("GUARD MOVED")
    || text.includes("GUARD REACTION")
    || text.includes("ELBOWS LIFT")
    || text.includes("LEAD LEG HEAVY")
    || text.includes("STANCE SQUARE")
  ) {
    return "Opening Created";
  }

  return "No Opening Created";
}

function inferMissingReaction(f: any, openingStatus: string) {
  const existing = cleanMultiline(
    f?.missing_reaction || f?.missingReaction || f?.reaction_missing || ""
  );

  if (existing) return existing;

  const text = [
    f?.title,
    f?.process,
    f?.unstable,
    f?.break_point,
    f?.dashboard_detail,
    f?.fix_next_rep,
    f?.missing_setup,
  ]
    .map((x) => cleanText(x))
    .filter(Boolean)
    .join(" ")
    .toUpperCase();

  if (openingStatus === "Opening Created") {
    return "Reaction was created. The next rep must attack before it disappears.";
  }

  if (openingStatus === "Opening Missed") {
    return "You saw the reaction but went too late.";
  }

  if (openingStatus === "Opening Lost") {
    return "You made him react, then waited too long.";
  }

  if (openingStatus === "Opponent Trap") {
    return "He stayed set and you walked into his counter.";
  }

  if (text.includes("ANGLE")) return "No angle change was forced before the attack.";
  if (text.includes("POSTURE") || text.includes("SNAP")) {
    return "No posture break was forced before the attack.";
  }
  if (text.includes("LEVEL") || text.includes("WEIGHT")) {
    return "No weight shift was forced before the attack.";
  }
  if (text.includes("REACTION") || text.includes("DEFEND")) {
    return "No defensive reaction was forced before the attack.";
  }

  const family = combatFamily(f);
  if (family === "BOXING") return "His guard never moved.";
  if (family === "KICKBOXING") return "His elbows stayed home.";
  if (family === "MUAY_THAI") return "His weight never settled on the lead leg.";
  if (family === "MMA") return "His stance never squared up.";

  return "Opponent stayed stable. No posture break or weight shift was forced.";
}

function isViabilityAnswer(value?: string | null) {
  const text = cleanText(value).toUpperCase();

  return (
    !text ||
    text.startsWith("YES") ||
    text.startsWith("NO") ||
    text.startsWith("LIKELY") ||
    text.includes("REQUIRED OPENING FIRST") ||
    text.includes("WOULD THIS STILL WORK")
  );
}

function inferOpponentPunishment(f: any, openingStatus: string) {
  const direct = cleanMultiline(
    f?.opponent_punishment ||
      f?.better_opponent_counter ||
      f?.opponent_counter ||
      ""
  );

  if (direct && !isViabilityAnswer(direct)) return direct;

  const legacy = cleanMultiline(
    f?.better_opponent_test || f?.betterOpponentTest || f?.better_opponent || ""
  );

  if (legacy && !isViabilityAnswer(legacy)) return legacy;

  const evidence = [
    f?.title,
    f?.process,
    f?.break_point,
    f?.exchange_entry,
    f?.attacked_instead,
    f?.missing_setup,
    f?.fix_next_rep,
  ]
    .map((value) => cleanText(value))
    .filter(Boolean)
    .join(" ")
    .toUpperCase();

  if (
    (evidence.includes("HEAD") && evidence.includes("OUTSIDE")) ||
    evidence.includes("HEAD TOO FAR")
  ) {
    return "He crossfaces, digs the whizzer, circles off, and kills the finish.";
  }

  if (
    evidence.includes("OVERCOMMIT") ||
    evidence.includes("RUNNING ON") ||
    evidence.includes("RUN ON") ||
    evidence.includes("COUNTER")
  ) {
    return "He stays balanced, lets you enter, then counters as you overcommit.";
  }

  if (
    evidence.includes("SHOT") ||
    evidence.includes("TAKEDOWN") ||
    evidence.includes("DOUBLE LEG") ||
    evidence.includes("SINGLE LEG")
  ) {
    return "He sprawls, stuffs the head, and circles behind.";
  }

  if (
    evidence.includes("PUNCH") ||
    evidence.includes("JAB") ||
    evidence.includes("CROSS") ||
    evidence.includes("HOOK")
  ) {
    return "He stays balanced, slips the attack, and counters while you recover.";
  }

  if (openingStatus === "Opening Missed" || openingStatus === "Opening Lost") {
    return "He resets and counters your late attack.";
  }

  if (openingStatus === "Opponent Trap") {
    return "He lets you enter, keeps his balance, and counters your commitment.";
  }

  const family = combatFamily(f);
  if (family === "BOXING") return "He reads it, slips, and counters while you reset.";
  if (family === "KICKBOXING") return "He sees it, checks or blocks, then fires back.";
  if (family === "MUAY_THAI") return "He checks, stays balanced, and returns immediately.";
  if (family === "MMA") return "He stays balanced, circles off, and counters your entry.";

  return "He stays balanced, stops the attack, and counters as you recover.";
}

function inferMissingSetup(f: any) {
  const existing = cleanMultiline(
    f?.missing_setup || f?.missingSetup || f?.setup_missing || ""
  );

  if (existing) return existing;

  const fix = cleanMultiline(f?.fix_next_rep || f?.next_setup_to_create_opening || "");

  if (fix) return fix;

  const family = combatFamily(f);
  if (family === "BOXING") return "Touch the guard or feint first.";
  if (family === "KICKBOXING") return "Draw the guard high first.";
  if (family === "MUAY_THAI") return "Shift his weight before you kick.";
  if (family === "MMA") return "Make him react upstairs before changing level.";
  return "Move his head, hands, feet, or weight first.";
}

function inferOpeningNeed(f: any) {
  const existing = cleanText(
    f?.required_opening ||
      f?.best_opening ||
      f?.opening_needed ||
      f?.reaction_required ||
      f?.opening_hierarchy ||
      ""
  );

  if (existing) return existing;

  const text = [
    f?.title,
    f?.result,
    f?.process,
    f?.good,
    f?.unstable,
    f?.break_point,
    f?.dashboard_detail,
    f?.cost_of_delay,
    f?.if_ignored,
    f?.fix_next_rep,
    f?.missing_reaction,
    f?.missing_setup,
  ]
    .map((x) => cleanText(x))
    .filter(Boolean)
    .join(" ")
    .toUpperCase();

  const family = combatFamily(f);

  if (text.includes("RIB") || text.includes("BODY OPEN") || text.includes("ELBOW")) {
    return "Ribs Exposed";
  }

  if (text.includes("LEAD LEG") || text.includes("HEAVY LEG") || text.includes("CHECK")) {
    return "Lead Leg Heavy";
  }

  if (text.includes("SQUARE") || text.includes("FEET STOP")) {
    return "Stance Square";
  }

  if (text.includes("GUARD") || text.includes("SHELL") || text.includes("REAR HAND")) {
    return "Guard Reaction";
  }

  if (text.includes("HEAD") || text.includes("FOREHEAD") || text.includes("POSITION")) {
    return "Win head position";
  }

  if (text.includes("POSTURE") || text.includes("SNAP") || text.includes("PULL")) {
    return "Posture Break";
  }

  if (text.includes("ANGLE") || text.includes("STEP")) {
    return "Defensive Step";
  }

  if (text.includes("HAND") || text.includes("GRIP") || text.includes("POST")) {
    return "Hand Reaction";
  }

  if (text.includes("LEVEL")) {
    return "Level Change Reaction";
  }

  if (text.includes("FENCE") || text.includes("CAGE") || text.includes("WALL")) {
    return "Fence Pressure";
  }

  if (text.includes("RETREAT") || text.includes("BACK UP")) {
    return "Retreat";
  }

  if (text.includes("OVERCOMMIT") || text.includes("REACH") || text.includes("LUNGE")) {
    return "Overcommitment";
  }

  if (family === "BOXING") return "Guard Reaction";
  if (family === "KICKBOXING") return "Ribs Exposed";
  if (family === "MUAY_THAI") return "Lead Leg Heavy";
  if (family === "MMA") return "Stance Square";
  return "Weight Shift";
}

function inferOpeningWhy(f: any, openingNeed: string) {
  const existing = cleanMultiline(
    f?.opening_why || f?.why_opening_matters || f?.best_opening_why || ""
  );

  if (existing) return existing;

  const missingReaction = cleanMultiline(f?.missing_reaction || "");

  if (missingReaction) {
    return missingReaction;
  }

  if (openingNeed === "Win head position") {
    return "You shot before you got your head inside.";
  }

  if (openingNeed === "Posture Break") {
    return "Opponent posture is stable, so their hips and frames can defend first.";
  }

  if (openingNeed === "Defensive Step") {
    return "Opponent stance is stable. You need their feet moving before the attack.";
  }

  if (openingNeed === "Hand Reaction") {
    return "Opponent hands are free to frame, post, or counter the entry.";
  }

  if (openingNeed === "Guard Reaction") return "His guard stayed set and saw the attack.";
  if (openingNeed === "Ribs Exposed") return "His elbows stayed tight to his ribs.";
  if (openingNeed === "Lead Leg Heavy") return "His weight stayed free to check or move.";
  if (openingNeed === "Stance Square") return "His feet stayed ready to circle or sprawl.";

  if (openingNeed === "Level Change Reaction") {
    return "Opponent is not reacting to level yet, so the entry is readable.";
  }

  if (openingNeed === "Fence Pressure") {
    return "Opponent still has space to sprawl, circle, or reset balance.";
  }

  if (openingNeed === "Retreat") {
    return "Opponent is not moving backward, so the attack hits a planted base.";
  }

  if (openingNeed === "Overcommitment") {
    return "He has not reached past his stance yet.";
  }

  return "Opponent hips are centered, so the entry meets balance instead of a reaction.";
}

function inferOpeningHow(f: any, openingNeed: string) {
  const existing = cleanMultiline(
    f?.create_it ||
      f?.opening_how ||
      f?.how_to_create_it ||
      f?.create_opening_with ||
      f?.next_setup_to_create_opening ||
      f?.missing_setup ||
      ""
  );

  if (existing) return existing;

  if (openingNeed === "Win head position") {
    return "Ear in ribs first.";
  }

  if (openingNeed === "Posture Break") {
    return "Snap first.";
  }

  if (openingNeed === "Defensive Step") {
    return "Make him step.";
  }

  if (openingNeed === "Hand Reaction") {
    return "Clear his hands.";
  }

  if (openingNeed === "Guard Reaction") {
    return "Touch or feint at the guard.";
  }

  if (openingNeed === "Ribs Exposed") {
    return "Make him defend upstairs.";
  }

  if (openingNeed === "Lead Leg Heavy") {
    return "Make his weight settle on the lead leg.";
  }

  if (openingNeed === "Stance Square") {
    return "Back him up or make him shell.";
  }

  if (openingNeed === "Level Change Reaction") {
    return "Level fake first.";
  }

  if (openingNeed === "Fence Pressure") {
    return "Pin him to the fence.";
  }

  if (openingNeed === "Retreat") {
    return "Make him step back.";
  }

  if (openingNeed === "Overcommitment") {
    return "Make him reach.";
  }

  return "Move his weight first.";
}

function inferReactionToForce(f: any, openingNeed: string) {
  const existing = cleanMultiline(
    f?.reaction_to_force ||
      f?.reaction_to_see ||
      f?.required_reaction ||
      f?.desired_reaction ||
      ""
  );

  if (existing) return existing;

  if (openingNeed === "Win head position") {
    return "Turn his head.";
  }

  if (openingNeed === "Posture Break") {
    return "Posture comes up.";
  }

  if (openingNeed === "Defensive Step") {
    return "He steps.";
  }

  if (openingNeed === "Hand Reaction") {
    return "His hands leave.";
  }

  if (openingNeed === "Guard Reaction") {
    return "His guard moves.";
  }

  if (openingNeed === "Ribs Exposed") {
    return "His elbows lift.";
  }

  if (openingNeed === "Lead Leg Heavy") {
    return "His weight settles on the lead leg.";
  }

  if (openingNeed === "Stance Square") {
    return "His feet square up.";
  }

  if (openingNeed === "Level Change Reaction") {
    return "His hands drop.";
  }

  if (openingNeed === "Fence Pressure") {
    return "His feet square up.";
  }

  if (openingNeed === "Retreat") {
    return "He steps back.";
  }

  if (openingNeed === "Overcommitment") {
    return "He reaches.";
  }

  return "His weight shifts.";
}

function inferAttackAfterReaction(f: any, openingNeed: string) {
  const existing = cleanMultiline(
    f?.attack_after ||
      f?.attack_after_reaction ||
      f?.attack_after_opening ||
      f?.attack_timing ||
      ""
  );

  if (existing) return existing;

  if (openingNeed === "Win head position") {
    return "Go before he squares up.";
  }

  if (openingNeed === "Posture Break") {
    return "Go when his posture comes up.";
  }

  if (openingNeed === "Defensive Step") {
    return "Go on the step.";
  }

  if (openingNeed === "Hand Reaction") {
    return "Go when his hands leave.";
  }

  if (openingNeed === "Guard Reaction") {
    return "Throw as the guard moves.";
  }

  if (openingNeed === "Ribs Exposed") {
    return "Kick the body as his elbows lift.";
  }

  if (openingNeed === "Lead Leg Heavy") {
    return "Kick as his weight settles.";
  }

  if (openingNeed === "Stance Square") {
    return "Change level when his feet square up.";
  }

  if (openingNeed === "Level Change Reaction") {
    return "Go when his hands drop.";
  }

  if (openingNeed === "Fence Pressure") {
    return "Go when his feet square up.";
  }

  if (openingNeed === "Retreat") {
    return "Go as he steps back.";
  }

  if (openingNeed === "Overcommitment") {
    return "Go when he reaches.";
  }

  if (openingNeed === "Weight Shift") {
    return "Go as his weight shifts.";
  }

  return cleanMultiline(f?.fix_next_rep || "Attack as soon as the reaction appears.");
}

function inferExchangeReaction(f: any, openingStatus: string, openingNeed: string) {
  const existing = cleanMultiline(
    f?.exchange_reaction ||
      f?.reaction_observed ||
      f?.reaction_created ||
      f?.opponent_reaction ||
      ""
  );

  if (existing) return existing;

  const missingReaction = cleanMultiline(f?.missing_reaction || "");

  if (openingStatus === "No Opening Created") {
    return missingReaction || "No usable reaction occurred. The opponent stayed stable.";
  }

  if (openingStatus === "Opening Missed") {
    return "A reaction was available, but the attack did not connect to it in time.";
  }

  if (openingStatus === "Opening Lost") {
    return "The reaction appeared, then disappeared before the entry arrived.";
  }

  if (openingStatus === "Finished Despite Flaw") {
    return "The result looked close, but the opponent reaction was not clean enough to justify the entry.";
  }

  if (openingStatus === "Opponent Trap") {
    return "That reaction was bait. He was waiting to counter.";
  }

  if (openingNeed === "Defensive Step") {
    return "Attack when the defensive step starts and the stance is between bases.";
  }

  if (openingNeed === "Posture Break") {
    return "Attack as posture folds, rises, or the head line is pulled out of stance.";
  }

  if (openingNeed === "Weight Shift") {
    return "Attack as weight transfers and the hips cannot sprawl immediately.";
  }

  return "A reaction must appear before the entry commits.";
}

function inferExchangeEntry(f: any) {
  const existing = cleanMultiline(
    f?.exchange_entry ||
      f?.entry_action ||
      f?.entry_sequence ||
      f?.process ||
      ""
  );

  if (existing) return existing;

  return "Entry committed before the opponent state was changed enough.";
}

function inferExchangeBreak(f: any, openingStatus: string) {
  const existing = cleanMultiline(
    f?.exchange_break ||
      f?.where_exchange_broke ||
      f?.break_point ||
      f?.dashboard_detail ||
      ""
  );

  if (existing) return existing;

  if (openingStatus === "No Opening Created") {
    return "You attacked before you made him react. He stayed set. The attack stalled.";
  }

  if (openingStatus === "Opening Missed") {
    return "You got the reaction. Then you waited. He recovered posture. The reaction disappeared.";
  }

  if (openingStatus === "Opening Lost") {
    return "You got the reaction. Then you waited. He squared up before you went.";
  }

  if (openingStatus === "Opponent Trap") {
    return "He let you enter. You chased the finish. He won the counter.";
  }

  return "You got the reaction but did not go. He reset. You lost the position.";
}

function normalizeTimestamp(value?: string | number | null) {
  if (typeof value === "number" && Number.isFinite(value)) {
    const minutes = Math.floor(value / 60);
    const seconds = Math.floor(value % 60);
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  const text = cleanText(value == null ? "" : String(value));
  if (!text) return "";

  const timeMatch = text.match(/\b(?:(\d{1,2}):)?([0-5]?\d):([0-5]\d)\b/);
  if (timeMatch) {
    const hoursOrMinutes = timeMatch[1];
    const minutes = timeMatch[2];
    const seconds = timeMatch[3];
    return hoursOrMinutes
      ? `${hoursOrMinutes.padStart(2, "0")}:${minutes.padStart(2, "0")}:${seconds}`
      : `${minutes.padStart(2, "0")}:${seconds}`;
  }

  const shortMatch = text.match(/\b([0-5]?\d):([0-5]\d)\b/);
  if (shortMatch) {
    return `${shortMatch[1].padStart(2, "0")}:${shortMatch[2]}`;
  }

  return text.length <= 12 ? text : "";
}

function inferTimestamp(f: any) {
  return (
    normalizeTimestamp(
      f?.timestamp ||
        f?.timecode ||
        f?.clip_time ||
        f?.time ||
        f?.at ||
        f?.session_timestamp
    ) || "Frame"
  );
}

function inferTimestampObservation(f: any) {
  const existing = cleanMultiline(
    f?.observation || f?.timestamp_observation || f?.what_happened || ""
  );
  if (existing) return existing;

  return cleanMultiline(
    f?.exchange_break ||
      f?.where_exchange_broke ||
      f?.process ||
      f?.exchange_entry ||
      f?.title ||
      "The position breaks before the correction is owned."
  );
}

function inferTimestampConsequence(f: any) {
  const existing = cleanMultiline(
    f?.consequence || f?.timestamp_consequence || f?.what_it_caused || ""
  );
  if (existing) return existing;

  return cleanMultiline(
    f?.position_lost ||
      f?.opponent_punishment ||
      f?.better_opponent_counter ||
      f?.if_ignored ||
      f?.cost_of_delay ||
      "The opponent wins the next position."
  );
}

function inferTimestampReason(f: any) {
  const existing = cleanMultiline(
    f?.reason || f?.timestamp_reason || f?.why_it_failed || ""
  );
  if (existing) return existing;

  return cleanMultiline(
    f?.opening_why ||
      f?.why_it_matters ||
      f?.missing_reaction ||
      f?.dashboard_detail ||
      "The position breaks before the attack can work."
  );
}

function inferTimestampCorrection(f: any) {
  const existing = cleanMultiline(
    f?.correction || f?.timestamp_correction || f?.what_next_time || ""
  );
  if (existing) return existing;

  return cleanMultiline(
    f?.decision ||
      f?.fix_next_rep ||
      f?.attack_after ||
      f?.attack_after_reaction ||
      "Fix the break point before chasing the finish."
  );
}

function inferDidCreateIt(f: any, openingStatus: string) {
  const existing = cleanText(
    f?.did_i_create_it || f?.opening_created_answer || f?.created_opening || ""
  );

  if (existing) return existing;

  if (openingStatus === "Opening Created") {
    return "Yes. The opponent reacted before the attack.";
  }

  if (openingStatus === "Opening Missed") {
    return "No. The opening appeared, but you did not take it.";
  }

  if (openingStatus === "Opening Lost") {
    return "Yes, then you lost it before the entry.";
  }

  if (openingStatus === "Finished Despite Flaw") {
    return "No. The finish covered up the missing setup.";
  }

  if (openingStatus === "Opponent Trap") {
    return "No. You attacked the opponent's trap instead.";
  }

  return "No. The opponent stayed stable.";
}

function inferAttackedInstead(f: any) {
  const existing = cleanMultiline(
    f?.attacked_instead ||
      f?.what_attacked_instead ||
      f?.exchange_entry ||
      f?.entry_action ||
      f?.process ||
      ""
  );

  if (existing) return existing;

  return "You attacked the opponent's stable position instead of a reaction.";
}

function inferExchangeDecision(f: any, openingStatus: string, openingNeed: string) {
  const existing = cleanMultiline(
    f?.decision || f?.exchange_decision || f?.decision_next_rep || ""
  );

  if (existing) return existing;

  if (openingNeed === "Win head position") {
    return "Do not go before you win head position.";
  }

  if (openingNeed === "Guard Reaction") return "Move his guard before you throw.";
  if (openingNeed === "Ribs Exposed") return "Open his ribs before you kick.";
  if (openingNeed === "Lead Leg Heavy") return "Load his lead leg before you kick.";
  if (openingNeed === "Stance Square") return "Square his feet before you change level.";

  if (openingStatus === "Opening Created") {
    return `Go as soon as you get ${openingNeed.toLowerCase()}.`;
  }

  if (openingStatus === "Opening Missed" || openingStatus === "Opening Lost") {
    return `See ${openingNeed.toLowerCase()} and go before he resets.`;
  }

  return `Do not go before you ${openingNeed.toLowerCase()}.`;
}

function inferReactionDecision(f: any, openingStatus: string) {
  const reactionHappened = cleanText(f?.reaction_happened) ||
    (openingStatus === "Opening Created" || openingStatus === "Opening Missed" || openingStatus === "Opening Lost"
      ? "Yes. The reaction appeared."
      : "No. The opponent stayed set.");
  const reactionRecognized = cleanText(f?.reaction_recognized) ||
    (openingStatus === "Opening Created"
      ? "Yes. You saw it."
      : openingStatus === "Opening Missed" || openingStatus === "Opening Lost"
        ? "Late. You saw it after he started recovering."
        : "No reaction was there to read.");
  const reactionAttacked = cleanText(f?.reaction_attacked) ||
    (openingStatus === "Opening Created"
      ? "Yes. You attacked the reaction."
      : openingStatus === "Opening Missed" || openingStatus === "Opening Lost"
        ? "No. You attacked after it disappeared."
        : "No. You attacked a stable position.");
  const attackTiming = cleanText(f?.attack_timing_verdict || f?.timing_verdict) ||
    (openingStatus === "Opening Created"
      ? "On time."
      : openingStatus === "Opening Missed" || openingStatus === "Opening Lost"
        ? "Too late."
        : "Too early.");

  return { reactionHappened, reactionRecognized, reactionAttacked, attackTiming };
}

function withOpeningAnalysis(f: any) {
  const openingStatus =
    normalizeOpeningCategory(
      f?.opening_status ||
        f?.openingStatus ||
        f?.opening_creation ||
        f?.openingCreation ||
        f?.opening_category
    ) || inferOpeningStatus(f);
  const missingReaction = inferMissingReaction(f, openingStatus);
  const missingSetup = inferMissingSetup(f);
  const bestOpening = inferOpeningNeed(f);
  const openingWhy = inferOpeningWhy({ ...f, missing_reaction: missingReaction }, bestOpening);
  const openingHow = inferOpeningHow(
    { ...f, missing_setup: missingSetup },
    bestOpening
  );
  const reactionToForce = inferReactionToForce(f, bestOpening);
  const attackAfterReaction = inferAttackAfterReaction(f, bestOpening);
  const exchangeReaction = inferExchangeReaction(
    { ...f, missing_reaction: missingReaction },
    openingStatus,
    bestOpening
  );
  const exchangeEntry = inferExchangeEntry(f);
  const exchangeBreak = inferExchangeBreak(f, openingStatus);
  const didCreateIt = inferDidCreateIt(f, openingStatus);
  const attackedInstead = inferAttackedInstead({ ...f, exchange_entry: exchangeEntry });
  const decision = inferExchangeDecision(f, openingStatus, bestOpening);
  const reactionDecision = inferReactionDecision(f, openingStatus);
  const opponentPunishment = inferOpponentPunishment(f, openingStatus);
  const timestamp = inferTimestamp(f);
  const observation = inferTimestampObservation({
    ...f,
    exchange_break: exchangeBreak,
    exchange_entry: exchangeEntry,
  });
  const consequence = inferTimestampConsequence({
    ...f,
    opponent_punishment: opponentPunishment,
  });
  const reason = inferTimestampReason({
    ...f,
    opening_why: openingWhy,
    missing_reaction: missingReaction,
  });
  const correction = inferTimestampCorrection({
    ...f,
    decision,
    fix_next_rep: f?.fix_next_rep,
    attack_after: attackAfterReaction,
  });
  const viabilityTest = cleanMultiline(
    f?.better_opponent_test || f?.betterOpponentTest || ""
  );

  return {
    ...f,
    timestamp,
    timecode: timestamp,
    observation,
    consequence,
    reason,
    correction,
    opening_status: openingStatus,
    opening_creation: openingStatus,
    missing_reaction: missingReaction,
    best_opening: bestOpening,
    required_opening: bestOpening,
    opening_needed: bestOpening,
    reaction_required: bestOpening,
    opening_why: openingWhy,
    why_it_matters: openingWhy,
    opening_how: openingHow,
    create_it: openingHow,
    how_to_create_it: openingHow,
    reaction_to_force: reactionToForce,
    reaction_to_see: reactionToForce,
    required_reaction: reactionToForce,
    attack_after_reaction: attackAfterReaction,
    attack_after: attackAfterReaction,
    exchange_opening: bestOpening,
    exchange_reaction: exchangeReaction,
    exchange_entry: exchangeEntry,
    exchange_break: exchangeBreak,
    where_exchange_broke: exchangeBreak,
    did_i_create_it: didCreateIt,
    attacked_instead: attackedInstead,
    what_attacked_instead: attackedInstead,
    decision,
    exchange_decision: decision,
    reaction_happened: reactionDecision.reactionHappened,
    reaction_recognized: reactionDecision.reactionRecognized,
    reaction_attacked: reactionDecision.reactionAttacked,
    attack_timing_verdict: reactionDecision.attackTiming,
    better_opponent_test: viabilityTest,
    opponent_punishment: opponentPunishment,
    better_opponent_counter: opponentPunishment,
    risk_against_better_opponent: cleanMultiline(
      f?.risk_against_better_opponent ||
        f?.better_opponent_risk ||
        opponentPunishment
    ),
    missing_setup: missingSetup,
    next_setup_to_create_opening: cleanMultiline(
      f?.next_setup_to_create_opening ||
        f?.next_setup ||
        f?.setup_next_rep ||
        missingSetup
    ),
  };
}

function buildFighterMemorySignal(
  currentFinding: any,
  history: VisionAnalysis[] = []
): FighterMemorySignal {
  const currentCorrection = cleanText(currentFinding?.title || "Unknown correction");
  const currentKey = normalizeKey(currentCorrection);
  const currentOpeningStatus = getOpeningStatusFromFinding(currentFinding);
  const currentBestOpening = getBestOpeningFromFinding(currentFinding);
  const previousCorrection = getFindingTitle(history[0]) || "None";

  let occurrences = 1;
  const recurringPatterns: string[] = [];
  const openingStatusCounts = new Map<string, number>();
  const openingNeedCounts = new Map<string, number>();
  const issueCounts = new Map<string, number>();
  const pressureLeakCounts = new Map<string, number>();
  const psychologyCounts = new Map<string, number>();

  history.forEach((analysis) => {
    const finding = getPrimaryFinding(analysis);
    if (!finding) return;

    const title = cleanText(finding.title || "");
    const key = normalizeKey(title);
    const openingStatus = getOpeningStatusFromFinding(finding);
    const bestOpening = getBestOpeningFromFinding(finding);

    if (key) {
      pushCount(issueCounts, title);
    }

    if (
      currentKey &&
      key &&
      (key === currentKey ||
        key.includes(currentKey) ||
        currentKey.includes(key))
    ) {
      occurrences += 1;
    }

    pushCount(openingStatusCounts, openingStatus);
    pushCount(openingNeedCounts, bestOpening);

    const pressureLeak = cleanText(
      finding.if_ignored || finding.cost_of_delay || finding.break_point || ""
    );
    if (
      /chase|retreat|stable|force|panic|rush|delay|overcommit|abandon/i.test(
        pressureLeak
      )
    ) {
      pushCount(pressureLeakCounts, pressureLeak);
    }

    const psychologyLine = cleanText(
      finding.pattern_line || finding.short_detail || finding.dashboard_detail || ""
    );
    if (/chase|rush|panic|hesitat|force|abandon|freeze/i.test(psychologyLine)) {
      pushCount(psychologyCounts, psychologyLine);
    }
  });

  const [topIssue, topIssueCount] = mostFrequent(issueCounts);
  const [topOpeningStatus, topOpeningStatusCount] = mostFrequent(openingStatusCounts);
  const [topOpeningNeed, topOpeningNeedCount] = mostFrequent(openingNeedCounts);
  const [topPressureLeak, topPressureLeakCount] = mostFrequent(pressureLeakCounts);
  const [topPsychologyLeak, topPsychologyLeakCount] = mostFrequent(psychologyCounts);

  if (occurrences > 1) {
    recurringPatterns.push(`Repeated correction: ${currentCorrection}`);
  }

  if (topOpeningStatus && topOpeningStatusCount > 1) {
    recurringPatterns.push(`Repeated opening status: ${topOpeningStatus}`);
  }

  if (topOpeningNeed && topOpeningNeedCount > 1) {
    recurringPatterns.push(`Repeated opening needed: ${topOpeningNeed}`);
  }

  if (topPressureLeak && topPressureLeakCount > 1) {
    recurringPatterns.push(`Repeated pressure leak: ${topPressureLeak}`);
  }

  if (topPsychologyLeak && topPsychologyLeakCount > 1) {
    recurringPatterns.push(`Repeated psychology leak: ${topPsychologyLeak}`);
  }

  const proofStatus = getProofStatusFromFinding(currentFinding);
  const explicitRetention = cleanText(
    currentFinding?.retention_status || currentFinding?.retention || ""
  ).toUpperCase();
  const pressureEvidence = cleanText(
    [
      currentFinding?.process,
      currentFinding?.break_point,
      currentFinding?.dashboard_detail,
      currentFinding?.if_ignored,
      currentFinding?.pattern_line,
    ]
      .filter(Boolean)
      .join(" ")
  );
  const severity = cleanText(currentFinding?.severity).toUpperCase();
  const resultHidFlaw = currentOpeningStatus === "Finished Despite Flaw";
  const breaksUnderPressure =
    occurrences > 1 && /pressure|resistance|spar|live|round/i.test(pressureEvidence);
  const startingToHold =
    occurrences > 1 &&
    (severity === "LOW" || /surviv|holding|clean rep/i.test(explicitRetention));

  const journeyState = explicitRetention.includes("RETAINED") &&
    !explicitRetention.includes("NOT")
    ? "RETAINED"
    : resultHidFlaw
      ? "RESULT HIDING FLAW"
      : startingToHold
        ? "SURVIVING"
        : breaksUnderPressure
          ? "BREAKS UNDER PRESSURE"
          : occurrences >= 3
            ? "NOT RETAINED"
            : occurrences === 2
              ? "REPEATING"
              : "NEW BREAK";

  const journeyMessage: Record<string, string> = {
    "NEW BREAK": "First time this showed up. Fix it now.",
    REPEATING: "This is showing up again. The cue is not holding yet.",
    "NOT RETAINED": "You know the correction. You still lose it under pressure.",
    "RESULT HIDING FLAW": "You finished anyway. The correction still failed.",
    "BREAKS UNDER PRESSURE": "Clean without pressure. Gone when resistance rises.",
    SURVIVING: "The correction is starting to hold. Keep the same cue.",
    RETAINED: "The correction is holding in recent pressure reps.",
  };
  const status = journeyState;
  const openingPattern =
    currentOpeningStatus || topOpeningStatus || currentBestOpening || topOpeningNeed;

  return {
    repeatedIssue: occurrences > 1 ? currentCorrection : topIssue || currentCorrection,
    occurrences: Math.max(occurrences, topIssueCount || 1),
    status,
    journeyState,
    journeyMessage: journeyMessage[journeyState],
    proofStatus,
    recurringPatterns,
    previousCorrection,
    currentCorrection,
    openingPattern,
  };
}

function serializeFighterMemory(
  history: VisionAnalysis[] = [],
  active?: VisionAnalysis | null
) {
  const source = active ? [active, ...history] : history;
  const normalized = source
    .map((analysis) => ({
      correction: getFindingTitle(analysis),
      finding: getPrimaryFinding(analysis),
      clipLabel: cleanText((analysis as any)?.clipLabel || ""),
    }))
    .filter((item) => item.finding);

  const latest = normalized[0];
  const signal = latest
    ? buildFighterMemorySignal(latest.finding, source.slice(1))
    : null;
  const recentCorrections = normalized.slice(0, 8).map((item, index) => ({
    index: index + 1,
    correction: cleanText(item.correction || "Unknown correction"),
    severity: cleanText(item.finding?.severity || "Unknown"),
    opening_status: getOpeningStatusFromFinding(item.finding),
    best_opening: getBestOpeningFromFinding(item.finding),
    proof_status: getProofStatusFromFinding(item.finding),
    clipLabel: item.clipLabel,
  }));

  return {
    signal,
    recentCorrections,
    totalVisionAnalyses: history.length,
    instruction: [
      "FIGHTER MEMORY: Do not treat this frame like a new person.",
      "Compare the active frame against current correction, previous corrections, previous proof gates, previous Vision findings, and recurring mistakes.",
      "Track the reactions the fighter keeps missing or fails to force.",
      "If the same correction appears again, say recurring correction detected and judge whether it is retained under resistance.",
      "Notice when the fighter keeps shooting on a set stance, misses weight shifts, bites on retreat bait, or goes before the reaction.",
      "When sending to Sensei, include active correction, previous correction, recurring patterns, retention status, and proof status.",
    ].join("\n"),
  };
}

function enrichAnalysisWithFighterMemory(
  analysis: VisionAnalysis,
  history: VisionAnalysis[] = []
) {
  const findings = Array.isArray((analysis as any)?.findings)
    ? ((analysis as any).findings as any[])
    : [];

  if (!findings.length) return analysis;

  const signal = buildFighterMemorySignal(findings[0], history);
  const historySignalText = [
    signal.journeyState,
    signal.journeyMessage,
    `Proof: ${signal.proofStatus}`,
    signal.openingPattern ? `Reaction pattern: ${signal.openingPattern}` : "",
    signal.recurringPatterns.length
      ? `Patterns: ${signal.recurringPatterns.join(" | ")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  return {
    ...analysis,
    fighter_memory: serializeFighterMemory(history, analysis),
    findings: findings.map((finding, index) =>
      index === 0
        ? {
            ...finding,
            history_signal: historySignalText,
            repeated_issue: signal.repeatedIssue,
            history_occurrences: signal.occurrences,
            retention_status: signal.status,
            correction_journey_state: signal.journeyState,
            correction_journey_message: signal.journeyMessage,
            proof_status: signal.proofStatus,
            previous_correction: signal.previousCorrection,
            recurring_patterns: signal.recurringPatterns,
          }
        : finding
    ),
  } as VisionAnalysis;
}

function buildOpeningCreationInstruction({
  sport,
  notes,
  poseData,
}: {
  sport: string;
  notes: string;
  poseData: any | null;
}) {
  return [
    "Write like a real combat-sports coach between rounds.",
    `Sport: ${cleanText(sport) || "Unknown"}.`,
    `Context: ${cleanText(notes) || "None"}.`,
    poseData?.detected
      ? `Pose evidence: ${poseData.landmarkCount} landmarks detected.`
      : "Pose evidence: image-only if landmarks are unavailable.",
    "Do not use these phrases in visible copy: Opening Created, Better Opponent, Attack Window, Exchange Analysis, Punishable Sequence, Outcome Hid Process.",
    "No motivational language, sports psychology, AI language, corporate language, or long explanations.",
    "Use short direct sentences about position, reaction, timing, consequence, and the next drill. Every coaching cue must be eight words or fewer.",
    "Every answer must clearly mean: WHAT HAPPENED, WHAT YOU MISSED, FORCE FIRST, GO WHEN, IF YOU MISS IT, TRAIN THIS.",
    "Use two coaching layers without adding more topics. decision is the main correction. interrupt is the Coach Command: four words or fewer. process, missing_reaction, opening_why, and opponent_punishment form the single-frame read: one specific criticism sentence each.",
    "Coach Command examples: Head outside. Reset. Ear to ribs first. You shot before he reacted.",
    "Frame read examples: His posture never changed. You attacked a stable position. You tried to finish before you owned head position.",
    "exchange_break must name the exact point the rep failed. Use three or four short cause-and-effect sentences: what the fighter did, where he hesitated or lost position, how the opponent recovered, and what happened next.",
    "Cause-and-effect example: You attacked before head position was won. He crossfaced, dug the whizzer, then circled off.",
    "Never use these hedge words: likely, potentially, may, could, generally, often, typically, better opponent, high level opponent.",
    "Do not reward a finish if the fighter attacked a stable opponent without forcing a reaction.",
    "Lead with what the fighter should have done instead, not a body-position diagnosis.",
    "Prefer: You attacked before winning head position. You never forced the reaction. You attacked too early. The finish worked anyway. That is why it is punishable.",
    "Avoid leading with isolated labels such as head too far outside. Connect every visible mistake to the decision that created it.",
    "A successful technique can still be low-quality when speed, strength, or opponent weakness hides poor setup.",
    "Read the whole sequence before naming the mistake: FORCE, SEE, GO.",
    "FORCE is the action used to draw a response. SEE is the exact visible response and whether the fighter recognized it. GO is the attack tied to that response.",
    "For every correction decide what reaction was forced, whether it happened, whether it was recognized, whether it was attacked, and whether the attack came early, on time, or late.",
    "Answer: What happened? What did he miss? What reaction should he force? When should he go? What comes back if he is late?",
    "Coach in this order: opponent position, action used to force a response, visible response, recognition, attack, timing, consequence.",
    "For post-session analysis, every correction must be tied to a timestamp or frame marker.",
    "Populate timestamp, observation, consequence, reason, and correction for the primary finding.",
    "timestamp is the exact clip time when available, for example 01:14. If no clip time is visible, use Frame.",
    "observation answers: What happened at that time? Use one concrete sentence.",
    "consequence answers: What did it cause? Use one concrete sentence.",
    "reason answers: Why did that consequence happen? Use one concrete sentence.",
    "correction answers: What should happen next time? Use one concrete next-rep instruction.",
    "Timestamp chain example: 01:14 | Observation: Your head leaves the ribs before your feet move. Consequence: Your hips separate from the position. Reason: The position breaks first, so the whizzer wins. Correction: Keep the ear inside while stepping the trail foot.",
    `Opening hierarchy must classify best_opening as one of: ${OPENING_NEEDS.join(", ")}.`,
    "Populate required_opening, create_it, reaction_to_force, and attack_after for the primary finding. Also populate the existing compatible fields best_opening, opening_why, opening_how, and attack_after_reaction.",
    "required_opening names the opening that must exist. create_it gives one short ordered setup sequence. reaction_to_force names the visible opponent reaction the fighter is waiting for. attack_after names the attack and exact reaction cue that triggers it.",
    "Sport examples: Wrestling: head pressure -> posture lifts -> double leg. Boxing: touch or feint the guard -> rear hand rises -> left hook. Kickboxing: attack high -> elbows lift -> body kick. Muay Thai: hand pressure or feint -> weight settles on lead leg -> low kick. MMA: striking pressure -> stance squares -> level change.",
    "Do not give wrestling setups to a striking frame. Use the selected sport's positions, reactions, attacks, and counters.",
    "Populate exchange_opening, exchange_reaction, exchange_entry, and exchange_break for the primary finding.",
    "exchange_opening names the opening or opponent state. exchange_reaction names the reaction that occurred or failed to occur. exchange_entry names the attack/entry choice. exchange_break names the exact point where the sequence failed.",
    "best_opening names the exact reaction to create before attacking. opening_why explains the opponent state. opening_how gives the smallest setup actions. attack_after_reaction tells when to attack after the reaction appears.",
    "Exchange Read is required. opening_status must be exactly one of: Opening Created, Opening Missed, Opening Lost, No Opening Created, Finished Despite Flaw, Opponent Trap.",
    "Exchange Read meanings: Opening Created means fighter forced a reaction before attacking. Opening Missed means opponent gave an opening and fighter did not take it. Opening Lost means fighter created it but delayed, entered poorly, or moved after the window closed. No Opening Created means fighter attacked a stable opponent without setup. Finished Despite Flaw means the technique finished, but speed, strength, or opponent weakness covered up a bad setup. Opponent Trap means the opponent's stable shape or bait made the attack a counter opportunity.",
    "Exchange Analysis must populate required_opening, did_i_create_it, create_it, reaction_to_force, attack_after, attacked_instead, opponent_punishment, and decision. Each field must contain one concise tactical idea tied to the frame.",
    "Every result must answer: What opening was required? Did I create it? If not, what should I force first? What reaction am I looking for? When should I attack?",
    "Use plain fighter and coach language. Never use a term unless a fighter or coach in the selected sport would immediately understand and use it. Do not invent system language, abstract labels, or unexplained jargon.",
    "For boxing, Muay Thai, kickboxing, or MMA striking, name the visible guard, foot, weight shift, stance, shell, reach, check, counter, or fence reaction. Do not fall back to generic tactical language.",
    "Do not give a menu. Choose one setup, one reaction, and one moment to go.",
    "Missing Reaction is required. Use a concise evidence-tied sentence such as: No weight shift forced, No posture break, No defensive reaction, No angle change, or Opponent stayed stable.",
    "opponent_punishment is required. It describes the actual counter that comes back. Never answer yes/no. Use short fighter language and active actions, for example: He sprawls, stuffs the head, and circles behind.",
    "better_opponent_test is a separate optional viability field and must never be displayed as opponent_punishment.",
    "Never leave opening_status, missing_reaction, opponent_punishment, required_opening, create_it, reaction_to_force, attack_after, did_i_create_it, reaction_happened, reaction_recognized, reaction_attacked, attack_timing_verdict, attacked_instead, decision, best_opening, opening_why, opening_how, attack_after_reaction, exchange_opening, exchange_reaction, exchange_entry, or exchange_break empty when a correction is returned. If the frame is incomplete, make the narrowest tactical read supported by the visible position.",
    "Return one primary correction only. decision must be one memorable rule the fighter can repeat while tired. Keep every field short and specific to the frame.",
    "For the primary finding, include these fields: timestamp, observation, consequence, reason, correction, result, process, opening_status, opening_creation, missing_reaction, required_opening, create_it, reaction_to_force, attack_after, did_i_create_it, reaction_happened, reaction_recognized, reaction_attacked, attack_timing_verdict, attacked_instead, decision, best_opening, opening_why, opening_how, attack_after_reaction, exchange_opening, exchange_reaction, exchange_entry, exchange_break, opponent_punishment, better_opponent_test, risk_against_better_opponent, missing_setup, next_setup_to_create_opening.",
    "Use next_setup_to_create_opening for the smallest setup cue, for example level fake, snap, angle change, hand fight, weight shift, or forced reaction.",
  ].join("\n");
}

function wait(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms));
}

function inferCommunicationMode(
  file: File | null,
  clipLabel: string,
  notes: string
): VisionCommunicationMode {
  const context = `${clipLabel} ${notes}`.toLowerCase();
  const analysisContext =
    Boolean(file?.type?.startsWith("video/")) ||
    /film|review|post.session|post session|competition|fight review|round/.test(
      context
    );

  return analysisContext ? "ANALYSIS" : "COACHING";
}

function communicationInstruction(mode: VisionCommunicationMode) {
  return mode === "ANALYSIS"
    ? [
        "COMMUNICATION MODE: ANALYSIS.",
        "Teach with a short causal chain.",
        "Use timestamp, observation, consequence, reason, and correction.",
        "Explain exactly where the rep broke and what happens next time.",
      ].join(" ")
    : [
        "COMMUNICATION MODE: COACHING.",
        "Lead with short commands that survive fatigue.",
        "No analytical paragraph.",
        "Use Coach Command and FORCE, SEE, GO.",
      ].join(" ");
}

function writeVisionPlanUpdate(
  analysis: VisionAnalysis,
  mode: VisionCommunicationMode,
  userId?: string | null
) {
  const finding = ((analysis as any)?.findings || [])[0] || {};
  const train = Array.isArray(finding.train)
    ? finding.train.map((item: unknown) => cleanText(String(item))).filter(Boolean)
    : [];
  const activeCorrection = cleanText(
    finding.decision ||
      finding.correction ||
      finding.fix_next_rep ||
      finding.title ||
      ""
  );
  const nextDrill = cleanText(
    finding.todays_proof || train[0] || finding.drill_prescribed || ""
  );
  const proofStatus = cleanText(
    finding.proof_status || finding.retention_status || "Proof required"
  );
  const fuelRelevance = cleanText(
    finding.fuel_relevance ||
      finding.recovery_relevance ||
      ((analysis as any)?.fighter_constraints?.recoveryState || "")
  );
  const timestamp = cleanText(finding.timestamp || finding.timecode || "");
  const senseiHandoff = [
    activeCorrection,
    nextDrill ? `Next drill: ${nextDrill}` : "",
    proofStatus ? `Proof: ${proofStatus}` : "",
  ]
    .filter(Boolean)
    .join(" ");

  const update: VisionPlanUpdate = {
    updatedAt: new Date().toISOString(),
    mode,
    activeCorrection,
    proofStatus,
    nextDrill,
    senseiHandoff,
    fuelRelevance,
    timestamp,
  };

  writeUserJson(userId, "disciplin_vision_plan_update", update);
  writeUserJson(userId, "disciplin_active_correction", activeCorrection);
  writeUserJson(userId, "disciplin_vision_proof_status", proofStatus);
  writeUserJson(userId, "disciplin_next_drill", nextDrill);
  writeUserJson(userId, "disciplin_sensei_handoff", senseiHandoff);

  if (fuelRelevance) {
    writeUserJson(userId, "disciplin_vision_fuel_relevance", fuelRelevance);
  }

  window.dispatchEvent(
    new CustomEvent("disciplin:vision-plan-updated", { detail: update })
  );
}

function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const result = String(reader.result || "");
      resolve(result.includes(",") ? result.split(",")[1] : result);
    };

    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function fileToImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not load image for pose detection."));
    };

    img.src = url;
  });
}

async function detectPoseFromFile(file: File) {
  const img = await fileToImage(file);

  try {
    await img.decode();
  } catch {
    // Image is already loaded.
  }

  const originalError = console.error;
  const originalWarn = console.warn;
  const originalInfo = console.info;
  const originalLog = console.log;

  const shouldMute = (args: any[]) => {
    const message = args.map((x) => String(x)).join(" ");
    return (
      message.includes("TensorFlow Lite") ||
      message.includes("XNNPACK") ||
      message.includes("delegate for CPU")
    );
  };

  console.error = (...args: any[]) => {
    if (shouldMute(args)) return;
    originalError(...args);
  };

  console.warn = (...args: any[]) => {
    if (shouldMute(args)) return;
    originalWarn(...args);
  };

  console.info = (...args: any[]) => {
    if (shouldMute(args)) return;
    originalInfo(...args);
  };

  console.log = (...args: any[]) => {
    if (shouldMute(args)) return;
    originalLog(...args);
  };

  try {
    const landmarker = await getPoseLandmarker();
    const result = landmarker.detect(img);

    const landmarks = result.landmarks?.[0] || [];
    const worldLandmarks = result.worldLandmarks?.[0] || [];

    return {
      detected: landmarks.length > 0,
      landmarkCount: landmarks.length,
      landmarks,
      worldLandmarks,
    };
  } finally {
    console.error = originalError;
    console.warn = originalWarn;
    console.info = originalInfo;
    console.log = originalLog;
  }
}

function normalizeVisionAnalysis(raw: any, selectedSport = ""): VisionAnalysis {
  if (!raw || typeof raw !== "object") {
    return {
      analysis_id: uid(),
      clipLabel: "Evidence",
      summary:
        "Vision couldn’t find a clear observation. Choose a clearer image and try again.",
      findings: [],
    } as VisionAnalysis;
  }

  const findings = Array.isArray(raw.findings)
    ? raw.findings.map((f: any) =>
        withOpeningAnalysis({
          ...f,
          sport: cleanText(f?.sport || raw?.sport || selectedSport),
          title: cleanText(f?.title || "Unknown issue"),
          severity: cleanText(f?.severity || "LOW"),
          interrupt: cleanText(f?.interrupt || "Position lost. Reset."),
          fix_next_rep: cleanMultiline(
            f?.fix_next_rep || "Fix the break point on the next rep."
          ),
          shot_verdict: cleanText(f?.shot_verdict || ""),
          finish_verdict: cleanText(f?.finish_verdict || ""),
          position_verdict: cleanText(f?.position_verdict || ""),
          good: cleanMultiline(f?.good || ""),
          unstable: cleanMultiline(f?.unstable || ""),
          break_point: cleanMultiline(f?.break_point || ""),
          dashboard_detail: cleanMultiline(f?.dashboard_detail || ""),
          cost_of_delay: cleanMultiline(f?.cost_of_delay || ""),
          if_ignored: cleanMultiline(f?.if_ignored || ""),
          short_detail: cleanMultiline(f?.short_detail || ""),
          pattern_line: cleanMultiline(f?.pattern_line || ""),
          result: cleanMultiline(f?.result || f?.technique_result || ""),
          process: cleanMultiline(f?.process || f?.entry_process || ""),
          repeat_offense_count:
            typeof f?.repeat_offense_count === "number"
              ? f.repeat_offense_count
              : 0,
          live_rounds: Array.isArray(f?.live_rounds)
            ? f.live_rounds.map((x: any) => cleanText(String(x))).filter(Boolean)
            : [],
          train: Array.isArray(f?.train)
            ? f.train.map((x: any) => cleanText(String(x))).filter(Boolean)
            : [],
        })
      )
    : [];

  return {
    ...raw,
    analysis_id: cleanText(raw.analysis_id || uid()),
    clipLabel: cleanText(raw.clipLabel || "Evidence"),
    summary: cleanMultiline(raw.summary || "No clear observation."),
    findings,
  } as VisionAnalysis;
}

function buildVisionContext(analysis: VisionAnalysis) {
  const findings = Array.isArray((analysis as any)?.findings)
    ? ((analysis as any).findings as any[])
    : [];

  const top = findings[0];
  const parts: string[] = [];

  parts.push(`Clip label: ${cleanText((analysis as any)?.clipLabel || "Unknown")}`);
  parts.push(`Summary: ${cleanMultiline((analysis as any)?.summary || "None")}`);

  if (top) {
    const timeline = top.timeline_context || (analysis as any)?.timeline_context;

    if (timeline) {
      parts.push(`Next fight or competition: ${cleanText(timeline.nextCompetition || "Not set")}`);
      parts.push(`Days out: ${timeline.daysOut ?? "Not set"}`);
      parts.push(`Weight class: ${cleanText(timeline.weightClass || "Not set")}`);
      parts.push(`Current correction lock: ${cleanText(timeline.currentCorrectionLock || "None")}`);
      parts.push(`Repeated issue count: ${Number(timeline.repeatedIssueCount || 0)}`);
    }

    if (top.urgency_line) {
      parts.push(`Urgency: ${cleanMultiline(top.urgency_line)}`);
    }

    parts.push(`Primary correction: ${cleanText(top.title || "Unknown")}`);
    parts.push(`Severity: ${cleanText(top.severity || "Unknown")}`);
    parts.push(`Stop command: ${cleanText(top.interrupt || "None")}`);
    parts.push(`Fix next rep: ${cleanMultiline(top.fix_next_rep || "None")}`);

    if (top.timestamp || top.timecode) {
      parts.push(`Timestamp: ${cleanText(top.timestamp || top.timecode)}`);
    }

    if (top.observation) {
      parts.push(`Observation: ${cleanMultiline(top.observation)}`);
    }

    if (top.consequence) {
      parts.push(`Consequence: ${cleanMultiline(top.consequence)}`);
    }

    if (top.reason) {
      parts.push(`Reason: ${cleanMultiline(top.reason)}`);
    }

    if (top.correction) {
      parts.push(`Correction: ${cleanMultiline(top.correction)}`);
    }

    if (top.shot_verdict) {
      parts.push(`Shot verdict: ${cleanText(top.shot_verdict)}`);
    }

    if (top.finish_verdict) {
      parts.push(`Finish verdict: ${cleanText(top.finish_verdict)}`);
    }

    if (top.position_verdict) {
      parts.push(`Position verdict: ${cleanText(top.position_verdict)}`);
    }

    if (top.result) {
      parts.push(`Result: ${cleanMultiline(top.result)}`);
    }

    if (top.process) {
      parts.push(`Process: ${cleanMultiline(top.process)}`);
    }

    if (top.opening_status || top.opening_creation) {
      parts.push(
        `Exchange read: ${cleanText(
          top.opening_status || top.opening_creation
        )}`
      );
    }

    if (top.missing_reaction) {
      parts.push(`Missing reaction: ${cleanMultiline(top.missing_reaction)}`);
    }

    if (top.opponent_punishment || top.better_opponent_counter) {
      parts.push(
        `Opponent punishment: ${cleanMultiline(
          top.opponent_punishment || top.better_opponent_counter
        )}`
      );
    }

    if (top.risk_against_better_opponent) {
      parts.push(
        `Risk against better opponent: ${cleanMultiline(
          top.risk_against_better_opponent
        )}`
      );
    }

    if (top.missing_setup) {
      parts.push(`Missing setup: ${cleanMultiline(top.missing_setup)}`);
    }

    if (top.required_opening || top.best_opening || top.opening_needed || top.reaction_required) {
      parts.push(
        `Required opening: ${cleanText(
          top.required_opening || top.best_opening || top.opening_needed || top.reaction_required
        )}`
      );
    }

    if (top.opening_why || top.why_it_matters) {
      parts.push(
        `Why opening matters: ${cleanMultiline(
          top.opening_why || top.why_it_matters
        )}`
      );
    }

    if (top.create_it || top.opening_how || top.how_to_create_it) {
      parts.push(
        `Create it: ${cleanMultiline(
          top.create_it || top.opening_how || top.how_to_create_it
        )}`
      );
    }

    if (top.reaction_to_force || top.reaction_to_see || top.required_reaction) {
      parts.push(
        `Reaction to force: ${cleanMultiline(
          top.reaction_to_force || top.reaction_to_see || top.required_reaction
        )}`
      );
    }

    if (top.attack_after || top.attack_after_reaction) {
      parts.push(
        `Attack after: ${cleanMultiline(top.attack_after || top.attack_after_reaction)}`
      );
    }

    if (top.did_i_create_it) {
      parts.push(`Did I create it: ${cleanMultiline(top.did_i_create_it)}`);
    }

    if (top.attacked_instead || top.what_attacked_instead) {
      parts.push(
        `Attacked instead: ${cleanMultiline(
          top.attacked_instead || top.what_attacked_instead
        )}`
      );
    }

    if (top.decision || top.exchange_decision) {
      parts.push(
        `Decision: ${cleanMultiline(top.decision || top.exchange_decision)}`
      );
    }

    if (top.exchange_opening) {
      parts.push(`Exchange opening: ${cleanMultiline(top.exchange_opening)}`);
    }

    if (top.exchange_reaction) {
      parts.push(`Exchange reaction: ${cleanMultiline(top.exchange_reaction)}`);
    }

    if (top.exchange_entry) {
      parts.push(`Exchange entry: ${cleanMultiline(top.exchange_entry)}`);
    }

    if (top.exchange_break || top.where_exchange_broke) {
      parts.push(
        `Exchange break: ${cleanMultiline(
          top.exchange_break || top.where_exchange_broke
        )}`
      );
    }

    if (top.next_setup_to_create_opening) {
      parts.push(
        `Next setup to create opening: ${cleanMultiline(
          top.next_setup_to_create_opening
        )}`
      );
    }

    if (top.history_signal) {
      parts.push(`History signal: ${cleanMultiline(top.history_signal)}`);
    }

    if (top.vision_memory_signal) {
      parts.push(`Vision memory: ${cleanMultiline(top.vision_memory_signal)}`);
    }

    if (top.memory_total_occurrences) {
      parts.push(`Memory occurrences: ${Number(top.memory_total_occurrences)}`);
    }

    if (top.memory_success_rate != null) {
      parts.push(`Memory success rate: ${Number(top.memory_success_rate)}%`);
    }

    if (top.memory_trend) {
      parts.push(`Memory trend: ${cleanText(top.memory_trend)}`);
    }

    if (top.memory_same_break_point) {
      parts.push(`Same break point: ${cleanMultiline(top.memory_same_break_point)}`);
    }

    if (top.memory_round_signal) {
      parts.push(`Round pattern: ${cleanMultiline(top.memory_round_signal)}`);
    }

    if (top.memory_drilling_signal) {
      parts.push(`Drilling vs resistance: ${cleanMultiline(top.memory_drilling_signal)}`);
    }

    if (top.memory_opening_signal) {
      parts.push(`Opening memory: ${cleanMultiline(top.memory_opening_signal)}`);
    }

    if (top.retention_status) {
      parts.push(`Retention status: ${cleanText(top.retention_status)}`);
    }

    if (top.proof_status) {
      parts.push(`Proof status: ${cleanText(top.proof_status)}`);
    }

    if (Array.isArray(top.recurring_patterns) && top.recurring_patterns.length) {
      parts.push(`Recurring patterns: ${top.recurring_patterns.join(" | ")}`);
    }

    parts.push(`Keep: ${cleanMultiline(top.good || "None")}`);
    parts.push(`Unstable: ${cleanMultiline(top.unstable || "None")}`);
    parts.push(`Break point: ${cleanMultiline(top.break_point || "None")}`);
    parts.push(`Why it matters: ${cleanMultiline(top.dashboard_detail || "None")}`);
    parts.push(`Cost of delay: ${cleanMultiline(top.cost_of_delay || "None")}`);
    parts.push(`If ignored: ${cleanMultiline(top.if_ignored || "None")}`);

    const liveRounds = Array.isArray(top.live_rounds)
      ? top.live_rounds.map((x: any) => cleanText(String(x))).filter(Boolean)
      : [];

    if (liveRounds.length) {
      parts.push(`Live rounds: ${liveRounds.join(" | ")}`);
    }

    const train = Array.isArray(top.train)
      ? top.train.map((x: any) => cleanText(String(x))).filter(Boolean)
      : [];

    if (train.length) {
      parts.push(`Train today: ${train.join(" | ")}`);
    }
  }

  return parts.join("\n");
}

function formatVisionChatReply(raw: string) {
  let value = cleanMultiline(raw);
  if (!value) return "No clear answer from this frame.";

  if (value.startsWith("{") || value.startsWith("[")) {
    try {
      const parsed = JSON.parse(value);
      const answer =
        parsed?.answer ||
        parsed?.response ||
        parsed?.message ||
        parsed?.text ||
        parsed?.data?.answer ||
        parsed?.data?.response;

      value = cleanMultiline(answer || "");
    } catch {
      return "Vision can’t answer that from this evidence. Ask what is visible or uncertain.";
    }
  }

  if (!value || value === "[object Object]") {
    return "Vision can’t answer that from this evidence. Ask what is visible or uncertain.";
  }

  return compact(coachLanguage(value), 520);
}

function shapeReplyForMode(
  value: string,
  mode: VisionCommunicationMode
) {
  const cleaned = cleanMultiline(value);
  if (!cleaned || mode === "ANALYSIS") return cleaned;

  return cleaned
    .split(/\n+|(?<=[.!?])\s+/)
    .map((line) => cleanText(line.replace(/^[A-Z ]+:\s*/, "")))
    .filter(Boolean)
    .map((line) => line.split(/\s+/).slice(0, 8).join(" "))
    .slice(0, 4)
    .join("\n");
}

function buildQuickReply(prompt: string, analysis: VisionAnalysis): string | null {
  const findings = Array.isArray((analysis as any)?.findings)
    ? ((analysis as any).findings as any[])
    : [];

  const top = findings[0];

  if (!top) return "No clear observation is attached to this evidence.";

  const p = cleanText(prompt).toLowerCase();

  if (
    p.includes("memory") ||
    p.includes("keep happening") ||
    p.includes("keeps happening") ||
    p.includes("same mistake") ||
    p.includes("trend") ||
    p.includes("improving") ||
    p.includes("worse") ||
    p.includes("rounds")
  ) {
    const occurrences = Number(
      top.memory_total_occurrences || top.history_occurrences || 0
    );
    const successRate = Number(top.memory_success_rate || 0);
    const trend = cleanText(top.memory_trend || "");
    const memorySignal = cleanMultiline(
      top.vision_memory_signal || top.history_signal || ""
    );
    const sameBreakPoint = cleanMultiline(top.memory_same_break_point || "");
    const roundSignal = cleanMultiline(top.memory_round_signal || "");
    const drillingSignal = cleanMultiline(top.memory_drilling_signal || "");
    const openingSignal = cleanMultiline(top.memory_opening_signal || "");

    return [
      "PAST EVIDENCE",
      occurrences > 1
        ? `This is rep ${occurrences}.`
        : "First time Vision tagged this correction.",
      trend ? `Trend: ${trend}.` : "",
      successRate ? `Proof rate: ${successRate}%.` : "",
      memorySignal,
      sameBreakPoint,
      roundSignal,
      drillingSignal,
      openingSignal,
    ]
      .filter(Boolean)
      .join("\n");
  }

  if (
    p.includes("how do i force the opening") ||
    p.includes("how do i force this opening") ||
    p.includes("how do i make him react")
  ) {
    const requiredOpening = cleanText(
      top.required_opening || top.best_opening || top.opening_needed || "Create a visible reaction"
    );
    const createIt = cleanText(
      top.create_it || top.opening_how || top.how_to_create_it || "Move him before you enter."
    );
    const reaction = cleanText(
      top.reaction_to_force || top.reaction_to_see || top.missing_reaction || "Wait until his stance changes."
    );

    return [
      `WHAT YOU MISSED\n${requiredOpening}`,
      `FORCE FIRST\n${createIt}`,
      `GO WHEN\n${reaction}`,
    ].join("\n\n");
  }

  if (p.includes("what reaction am i waiting for")) {
    return [
      "GO WHEN",
      cleanText(
        top.reaction_to_force ||
          top.reaction_to_see ||
          top.required_reaction ||
          top.missing_reaction ||
          "A visible change in stance, posture, or balance."
      ),
    ].join("\n");
  }

  if (p.includes("when do i attack")) {
    return [
      "GO WHEN",
      cleanText(
        top.attack_after ||
          top.attack_after_reaction ||
          top.attack_timing ||
          "The reaction appears, before he resets."
      ),
    ].join("\n");
  }

  if (p.includes("what do i drill today")) {
    const train = Array.isArray(top.train)
      ? top.train.map((item: unknown) => cleanText(String(item))).filter(Boolean).slice(0, 3)
      : [];

    return ["TRAIN THIS", ...(train.length ? train : [cleanText(top.fix_next_rep)])]
      .filter(Boolean)
      .join("\n");
  }

  if (
    p.includes("how do i create the required opening") ||
    p.includes("create the required opening")
  ) {
    const requiredOpening = cleanText(
      top.required_opening ||
        top.best_opening ||
        top.opening_needed ||
        top.reaction_required ||
        "Reaction not identified"
    );
    const createIt = cleanText(
      top.create_it ||
        top.opening_how ||
        top.how_to_create_it ||
        "Create the required reaction before entering."
    );
    const reactionToForce = cleanText(
      top.reaction_to_force ||
        top.reaction_to_see ||
        top.required_reaction ||
        top.missing_reaction ||
        "Force a visible reaction before entering."
    );
    const attackWindow = cleanText(
      top.attack_after ||
        top.attack_after_reaction ||
        "Attack as soon as the reaction appears."
    );
    const failurePoint = cleanText(
      top.exchange_break ||
        top.where_exchange_broke ||
        top.break_point ||
        "The entry started before the opening existed."
    );

    return [
      `WHAT YOU MISSED\n${requiredOpening}`,
      `FORCE FIRST\n${createIt}`,
      `GO WHEN\n${attackWindow}`,
      `IF YOU MISS IT\n${failurePoint}. ${reactionToForce}`,
    ].join("\n\n");
  }

  if (p.includes("did i create an opening")) {
    const didCreateIt = cleanText(
      top.did_i_create_it || "No. The opponent stayed stable."
    );
    const requiredOpening = cleanText(
      top.required_opening || top.best_opening || "Reaction not identified"
    );
    const createIt = cleanText(
      top.create_it || top.opening_how || "Force a reaction before entering."
    );
    const reactionToForce = cleanText(
      top.reaction_to_force ||
        top.reaction_to_see ||
        top.required_reaction ||
        top.missing_reaction ||
        "Make the opponent react before you attack."
    );
    const attackWindow = cleanText(
      top.attack_after ||
        top.attack_after_reaction ||
        "Attack as soon as the reaction appears."
    );

    return [
      `WHAT HAPPENED\n${didCreateIt}`,
      `WHAT YOU MISSED\n${requiredOpening}`,
      `FORCE FIRST\n${createIt}`,
      `GO WHEN\n${reactionToForce}`,
      `THROW\n${attackWindow}`,
    ].join("\n\n");
  }

  if (p.includes("send this to sensei")) {
    return [
      top.timestamp || top.timecode
        ? `TIMESTAMP\n${cleanText(top.timestamp || top.timecode)}`
        : "",
      top.observation
        ? `OBSERVATION\n${cleanMultiline(top.observation)}`
        : "",
      top.consequence
        ? `CONSEQUENCE\n${cleanMultiline(top.consequence)}`
        : "",
      top.reason ? `REASON\n${cleanMultiline(top.reason)}` : "",
      top.correction ? `CORRECTION\n${cleanMultiline(top.correction)}` : "",
      `WHAT HAPPENED\n${cleanText(top.title)}`,
      top.missing_reaction
        ? `WHAT YOU MISSED\n${cleanText(top.missing_reaction)}`
        : "",
      top.create_it || top.opening_how || top.how_to_create_it
        ? `FORCE FIRST\n${cleanText(top.create_it || top.opening_how || top.how_to_create_it)}`
        : "",
      top.attack_after || top.attack_after_reaction
        ? `GO WHEN\n${cleanText(top.attack_after || top.attack_after_reaction)}`
        : "",
      top.opponent_punishment || top.better_opponent_counter
        ? `IF YOU MISS IT\n${cleanText(top.opponent_punishment || top.better_opponent_counter)}`
        : "",
      Array.isArray(top.train) && top.train.length
        ? `TRAIN THIS\n${top.train.join("\n")}`
        : `TRAIN THIS\n${cleanText(top.fix_next_rep)}`,
      top.history_signal
        ? `THIS KEEPS HAPPENING\n${cleanMultiline(top.history_signal)}`
        : "",
      top.proof_status ? `PROOF\n${cleanText(top.proof_status)}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");
  }

  if (p.includes("what breaks first")) {
    return cleanMultiline(top.break_point || "No clear break point is visible.");
  }

  if (p.includes("what should i keep")) {
    return cleanMultiline(top.good || "No clear strength is visible.");
  }

  if (p.includes("smallest fix next rep")) {
    return cleanMultiline(top.fix_next_rep || "No next step is supported by this evidence.");
  }

  if (
    p.includes("opening") ||
    p.includes("setup") ||
    p.includes("better opponent") ||
    p.includes("better wrestler")
  ) {
    const result = cleanMultiline(top.result || "");
    const process = cleanMultiline(top.process || "");
    const opening = cleanText(top.opening_status || top.opening_creation || "");
    const missingReaction = cleanMultiline(top.missing_reaction || "");
    const opponentPunishment = cleanMultiline(
      top.opponent_punishment || top.better_opponent_counter || ""
    );
    const risk = cleanMultiline(top.risk_against_better_opponent || "");
    const missingSetup = cleanMultiline(top.missing_setup || "");
    const bestOpening = cleanText(
      top.required_opening || top.best_opening || top.opening_needed || top.reaction_required || ""
    );
    const openingWhy = cleanMultiline(top.opening_why || top.why_it_matters || "");
    const openingHow = cleanMultiline(
      top.create_it || top.opening_how || top.how_to_create_it || ""
    );
    const attackAfterReaction = cleanMultiline(
      top.attack_after || top.attack_after_reaction || ""
    );
    const historySignal = cleanMultiline(top.history_signal || "");
    const retentionStatus = cleanText(top.retention_status || "");
    const proofStatus = cleanText(top.proof_status || "");
    const nextSetup = cleanMultiline(top.next_setup_to_create_opening || "");
    const nextCorrection = cleanMultiline(top.fix_next_rep || "");

    const lines = [
      result ? `Result: ${result}` : "",
      process ? `Process: ${process}` : "",
      opening ? `What happened: ${opening}` : "",
      missingReaction ? `What you missed: ${missingReaction}` : "",
      bestOpening ? `Force first: ${bestOpening}` : "",
      openingWhy ? `Why: ${openingWhy}` : "",
      openingHow ? `Make it happen: ${openingHow}` : "",
      attackAfterReaction ? `Go when: ${attackAfterReaction}` : "",
      top.exchange_opening ? `Position: ${cleanMultiline(top.exchange_opening)}` : "",
      top.exchange_reaction ? `Reaction: ${cleanMultiline(top.exchange_reaction)}` : "",
      top.exchange_entry ? `You threw: ${cleanMultiline(top.exchange_entry)}` : "",
      top.exchange_break || top.where_exchange_broke
        ? `It broke here: ${cleanMultiline(top.exchange_break || top.where_exchange_broke)}`
        : "",
      opponentPunishment ? `If you miss it: ${opponentPunishment}` : "",
      historySignal ? `This keeps happening: ${historySignal}` : "",
      retentionStatus ? `Is it fixed: ${retentionStatus}` : "",
      proofStatus ? `Proof: ${proofStatus}` : "",
      risk && risk !== opponentPunishment ? `What comes back: ${risk}` : "",
      missingSetup ? `Set it up with: ${missingSetup}` : "",
      nextSetup || nextCorrection
        ? `Next rep: ${nextSetup || nextCorrection}`
        : "",
    ].filter(Boolean);

    return lines.length
      ? lines.join("\n")
      : "No clear observation is available for this image.";
  }

  if (p.includes("live rounds") || p.includes("ignore this")) {
    const liveRounds = Array.isArray(top.live_rounds) ? top.live_rounds : [];
    const ignored = cleanMultiline(top.if_ignored || "");

    if (liveRounds.length || ignored) {
      return [
        liveRounds.length ? `In live rounds:\n- ${liveRounds.join("\n- ")}` : "",
        ignored ? `If ignored:\n${ignored}` : "",
      ]
        .filter(Boolean)
        .join("\n\n");
    }

    return "This evidence does not show the live-round consequence.";
  }

  if (p.includes("train today")) {
    const train = Array.isArray(top.train) ? top.train : [];

    if (train.length) {
      return `Train this today:\n- ${train.join("\n- ")}`;
    }

    return "No training task is supported by this evidence.";
  }

  return null;
}

function buildEvidenceReply(
  prompt: string,
  reviewPackage: VisionReviewPackage
): string | null {
  const question = cleanText(prompt).toLowerCase();
  const claim = (kind: string) =>
    reviewPackage.claims.find((item) => item.kind === kind);
  const observation = claim("OBSERVATION");
  const inference = claim("INFERENCE");
  const uncertainty = claim("UNCERTAINTY");

  if (/where|which frame|timestamp|timecode/.test(question)) {
    const reference =
      observation?.provenance.timestampStart ||
      observation?.provenance.frameReference ||
      reviewPackage.media.name;
    return `Evidence: ${reference}.\nObservation: ${observation?.statement || "No clear observation."}`;
  }

  if (/uncertain|cannot know|limit/.test(question)) {
    return uncertainty?.statement || reviewPackage.evidenceAssessment.cannotEstablish.join(". ");
  }

  if (/before|react|why|matter/.test(question)) {
    return inference?.statement || reviewPackage.evidenceAssessment.request ||
      "This evidence supports observation, but not a causal explanation.";
  }

  return null;
}

export default function SenseiVisionClient({ embedded = false }: { embedded?: boolean } = {}) {
  const { user } = useProfile();
  const { authority } = useWorkflow();
  const [sport, setSport] = useState("Wrestling");
  const [clipLabel, setClipLabel] = useState("");
  const [notes, setNotes] = useState("");

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedFileName, setSelectedFileName] = useState("");
const [previewUrl, setPreviewUrl] = useState<string | null>(null);
const [posePreview, setPosePreview] = useState<any | null>(null);
  const [running, setRunning] = useState(false);
  const [buildStage, setBuildStage] = useState<VisionBuildStage>("IDLE");
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<VisionAnalysis | null>(null);
  const [reviewPackage, setReviewPackage] = useState<VisionReviewPackage | null>(null);
  const [chatInput, setChatInput] = useState("");
  const [chatSending, setChatSending] = useState(false);

  const [chatMessages, setChatMessages] = useState<VisionChatMessage[]>([
    {
      id: uid(),
      role: "system",
      text: "Vision only answers questions supported by the active evidence.",
      ts: Date.now(),
    },
  ]);

  useEffect(() => {
    setReviewPackage(readUserJson<VisionReviewPackage>(user?.id, "disciplin_latest_vision_review"));
    setAnalysis(null);
    setSelectedFile(null);
    setSelectedFileName("");
  }, [user?.id]);
  const quickPrompts = useMemo(
    () => [
      "Where does the position begin to change?",
      "What is visible before the opponent reacts?",
      "What part of this is uncertain?",
      "Which frame supports this observation?",
    ],
    []
  );

  function pushSystemMessage(text: string) {
    setChatMessages((prev) => [
      ...prev,
      {
        id: uid(),
        role: "system",
        text,
        ts: Date.now(),
      },
    ]);
  }

  function pushVisionMessage(text: string) {
    setChatMessages((prev) => [
      ...prev,
      {
        id: uid(),
        role: "vision",
        text,
        ts: Date.now(),
      },
    ]);
  }

  function pushUserMessage(text: string) {
    setChatMessages((prev) => [
      ...prev,
      {
        id: uid(),
        role: "user",
        text,
        ts: Date.now(),
      },
    ]);
  }

  async function onFileChange(file: File | null) {
  if (file) {
    const validationError = await validateClientImage(file);
    if (validationError) {
      setSelectedFile(null);
      setSelectedFileName("");
      setPreviewUrl(null);
      setError(validationError);
      return;
    }
  }
  setSelectedFile(file);
  setSelectedFileName(file?.name || "");
  setError(null);
  setPosePreview(null);
  setReviewPackage(null);

  if (previewUrl) {
    URL.revokeObjectURL(previewUrl);
  }

  if (file) {
    setPreviewUrl(URL.createObjectURL(file));
  } else {
    setPreviewUrl(null);
  }
}
  function onReset() {
    setSelectedFile(null);
    setSelectedFileName("");
    setRunning(false);
    setBuildStage("IDLE");
    setError(null);
    setAnalysis(null);
    setReviewPackage(null);
    setChatInput("");
    setChatSending(false);

    setChatMessages([
      {
        id: uid(),
        role: "system",
        text: "Ready for new evidence.",
        ts: Date.now(),
      },
    ]);

    removeUserValue(user?.id, "disciplin_latest_vision_review");
  }

  async function onAnalyze() {
    if (!selectedFile) {
      setError("Choose an image first.");
      return;
    }

    setRunning(true);
    setBuildStage("UPLOADING_FRAME");
    setError(null);

    try {
      const imageBase64 = await fileToBase64(selectedFile);

      setBuildStage("FRAME_LOCKED");
      pushSystemMessage("Image ready.");
      await wait(260);
      setBuildStage("READING_FRAME");

      let poseData: any = null;

      try {
        poseData = await detectPoseFromFile(selectedFile);
        setPosePreview(poseData);

        pushSystemMessage(
          poseData.detected
            ? "Body position is clear enough to review."
            : "Body position is unclear. Vision will use the image only."
        );
        setBuildStage("SKELETON_DETECTED");
        await wait(320);
      } catch (poseErr: any) {
        console.warn("Pose detection failed:", poseErr);

        pushSystemMessage(
          "Body position could not be read. Vision will use the image only."
        );
      }

      setBuildStage("READING_FRAME");

      const res = await fetch("/api/sensei-vision", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          imageBase64,
          mimeType: selectedFile.type || "image/png",
          clipLabel,
          context: notes,
          sport,
          poseLandmarks: poseData,
          analysisMode: "EVIDENCE_REVIEW",
          communicationInstruction: VISION_SYSTEM_INSTRUCTION,
          openingCreationInstruction: VISION_SYSTEM_INSTRUCTION,
          requiredFields: [
            "observation",
            "inference",
            "alternative",
            "uncertainty",
            "timestampStart",
            "timestampEnd",
            "confidence",
            "evidence_quality",
            "evidence_obstructed",
            "angle_adequate",
            "shows_setup",
            "shows_opponent_reaction",
            "shows_outcome",
          ],
        }),
      });

      const data = (await res.json()) as VisionApiResponse;

      if (!res.ok || !data || data.ok === false) {
        throw new Error(
          res.status === 401
            ? "Sign in to continue."
            : "Vision couldn’t review this image. Try again.",
        );
      }

      const normalized = normalizeVisionAnalysis(data.analysis, sport);
      const primaryFinding = ((data.analysis as any)?.findings || [])[0] || {};
      const modelOutput = validateVisionModelOutput({
        ...primaryFinding,
        observation:
          primaryFinding.direct_observation ||
          primaryFinding.observation ||
          primaryFinding.title ||
          "",
        inference:
          primaryFinding.interpretation ||
          primaryFinding.reason ||
          primaryFinding.consequence ||
          "",
        alternative:
          primaryFinding.alternative_interpretation ||
          primaryFinding.alternative_explanation ||
          "",
        uncertainty:
          primaryFinding.uncertainty ||
          primaryFinding.evidence_limitation ||
          (selectedFile.type.startsWith("video/")
            ? "The clip cannot establish the athlete's internal intention or the coach's priority."
            : "A single frame cannot establish timing, reaction sequence, or cause."),
        timestampStart: primaryFinding.timestamp || primaryFinding.timecode || null,
        timestampEnd: primaryFinding.timestamp_end || null,
        confidence: primaryFinding.confidence || "LOW",
      });
      const media: VisionMediaEvidence = {
        id: uid(),
        name: selectedFile.name,
        kind: selectedFile.type.startsWith("video/") ? "SHORT_CLIP" : "SINGLE_FRAME",
        mimeType: selectedFile.type || "application/octet-stream",
        capturedAt: new Date().toISOString(),
        durationSeconds: null,
        quality:
          primaryFinding.evidence_quality === "POOR"
            ? "POOR"
            : primaryFinding.evidence_quality === "LIMITED"
              ? "LIMITED"
              : "CLEAR",
        obstructed: primaryFinding.evidence_obstructed === true,
        angleAdequate: primaryFinding.angle_adequate !== false,
        showsSetup: primaryFinding.shows_setup === true,
        showsOpponentReaction: primaryFinding.shows_opponent_reaction === true,
        showsOutcome: primaryFinding.shows_outcome !== false,
        footageContext: /competition|fight|bout/i.test(`${clipLabel} ${notes}`)
          ? "COMPETITION"
          : "TRAINING",
      };
      const athleteContext: AthleteContext | undefined = cleanText(notes)
        ? {
            id: uid(),
            statement: cleanText(notes),
            question: "What were you trying to do or notice?",
            createdAt: new Date().toISOString(),
          }
        : undefined;
      const nextReviewPackage = buildReviewPackage({
        media,
        output: modelOutput,
        athleteContext,
        authorityState: authority.authorityState,
        evidenceAuthority: authority.evidenceAuthority,
      });

      setBuildStage("CORRECTION_FOUND");
      pushSystemMessage("Visible evidence separated from interpretation.");
      await wait(320);

      setBuildStage("BREAK_POINT_IDENTIFIED");
      pushSystemMessage("What remains uncertain is marked.");
      await wait(320);

      setAnalysis(normalized);
      setReviewPackage(nextReviewPackage);
      writeUserJson(user?.id, "disciplin_latest_vision_review", nextReviewPackage);
      const observedClaim = nextReviewPackage.claims.find(
        (claim) => claim.kind === "OBSERVATION"
      );
      mergeWorkflow(user?.id, {
        status: "needs_context",
        observation: observedClaim?.statement || normalized.summary || "Vision observation ready",
        athleteContext: athleteContext?.statement || null,
        correction: null,
        correctionId: null,
        coach: null,
        evidence: null,
        source: "local",
      });
      setBuildStage("MISSION_UPDATED");
      pushSystemMessage(
        authority.authorityState === "ATHLETE_DIRECTED"
          ? "Athlete-directed observation saved. It cannot enter Sensei."
          : "Observation saved. It has not been sent to your coach.",
      );
      await wait(360);
      setBuildStage("DONE");

      pushSystemMessage(
        "Observation ready. Your coach still decides the correction and practice."
      );
    } catch (err: any) {
      setBuildStage("ERROR");
      setError(err?.message || "Vision couldn’t review this image. Try again.");
      pushSystemMessage("Vision stopped. Check the image and try again.");
    } finally {
      setRunning(false);
    }
  }

  function onQuickPrompt(prompt: string) {
    if (!analysis || !reviewPackage) {
      pushSystemMessage(
        "Add evidence first. Vision only answers questions about the active media."
      );
      return;
    }

    const boundary = canVisionAnswer(prompt);
    if (!boundary.allowed) {
      pushUserMessage(prompt);
      pushSystemMessage(boundary.reason);
      return;
    }

    const directReply = buildEvidenceReply(prompt, reviewPackage);

    pushUserMessage(prompt);

    if (directReply) {
      pushVisionMessage(directReply);
      setChatInput("");
      return;
    }

    setChatInput(prompt);
  }

  function onChatKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();

      if (!chatSending) {
        void onSendChat();
      }
    }
  }

  async function onSendChat() {
    const question = cleanText(chatInput);

    if (!question) return;

    const boundary = canVisionAnswer(question);
    if (!boundary.allowed) {
      pushUserMessage(question);
      pushSystemMessage(boundary.reason);
      setChatInput("");
      return;
    }

    if (!analysis || !reviewPackage) {
      pushSystemMessage(
        "Add evidence first. Vision only answers questions about the active media."
      );
      setChatInput("");
      return;
    }

    pushUserMessage(question);
    setChatInput("");
    setChatSending(true);

    try {
      const directReply = buildEvidenceReply(question, reviewPackage);

      if (directReply) {
        pushVisionMessage(directReply);
        return;
      }

      const context = {
        media: reviewPackage.media,
        evidenceAssessment: reviewPackage.evidenceAssessment,
        claims: reviewPackage.claims,
        athleteContext: reviewPackage.athleteContext,
      };

      const res = await fetch("/api/sensei-vision/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          question,
          context,
          analysisMode: "EVIDENCE_REVIEW",
          answerRules: `${VISION_SYSTEM_INSTRUCTION}\nAnswer only the athlete's question about the active evidence.`,
          analysis_id: (analysis as any)?.analysis_id || null,
          clipLabel: (analysis as any)?.clipLabel || clipLabel,
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(
          res.status === 401
            ? "Sign in to continue."
            : "Vision couldn’t answer that. Try again.",
        );
      }

      const reply = formatVisionChatReply(
          data?.answer ||
            data?.response ||
            data?.message ||
            "Vision couldn’t answer that from this evidence."
        );

      pushVisionMessage(reply);
    } catch (err: any) {
      pushSystemMessage(err?.message || "Vision couldn’t answer that. Try again.");
    } finally {
      setChatSending(false);
    }
  }

  return (
    <SenseiVisionScreen
      embedded={embedded}
      sport={sport}
      setSport={setSport}
      clipLabel={clipLabel}
      setClipLabel={setClipLabel}
      notes={notes}
      setNotes={setNotes}
      selectedFileName={selectedFileName}
     previewUrl={previewUrl}
posePreview={posePreview}
      onFileChange={onFileChange}
      onAnalyze={onAnalyze}
      onReset={onReset}
      running={running}
      buildStage={buildStage}
      error={error}
      analysis={analysis}
      reviewPackage={reviewPackage}
      chatInput={chatInput}
      setChatInput={setChatInput}
      chatSending={chatSending}
      chatMessages={chatMessages}
      onSendChat={onSendChat}
      onChatKeyDown={onChatKeyDown}
      quickPrompts={quickPrompts}
      onQuickPrompt={onQuickPrompt}
    />
  );
}
