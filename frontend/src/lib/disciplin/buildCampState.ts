// src/lib/disciplin/buildCampState.ts

import type {
  CampAlert,
  CampState,
  DailySession,
  FighterProfile,
  FuelLog,
  GymRecommendation,
  VisionFinding,
  WeightLog,
  WeightStatus,
} from "./types";

type BuildCampStateInput = {
  profile: FighterProfile;
  visionFindings: VisionFinding[];
  fuelLogs: FuelLog[];
  weightLogs: WeightLog[];
  gymRecommendations: GymRecommendation[];
  alerts: CampAlert[];
};

function getLatestWeightLog(weightLogs: WeightLog[]): WeightLog | null {
  if (!weightLogs.length) return null;

  return [...weightLogs].sort(
    (a, b) => new Date(b.loggedAt).getTime() - new Date(a.loggedAt).getTime()
  )[0];
}

function getLatestFuelLog(fuelLogs: FuelLog[]): FuelLog | null {
  if (!fuelLogs.length) return null;

  return [...fuelLogs].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )[0];
}

function getLatestVisionFindings(
  visionFindings: VisionFinding[],
  limit = 3
): VisionFinding[] {
  return [...visionFindings]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, limit);
}

function calculateWeeklyTrend(weightLogs: WeightLog[]): number | null {
  if (weightLogs.length < 2) return null;

  const sorted = [...weightLogs].sort(
    (a, b) => new Date(a.loggedAt).getTime() - new Date(b.loggedAt).getTime()
  );

  const first = sorted[0];
  const last = sorted[sorted.length - 1];

  const days =
    (new Date(last.loggedAt).getTime() - new Date(first.loggedAt).getTime()) /
    (1000 * 60 * 60 * 24);

  if (days <= 0) return null;

  const delta = last.weightKg - first.weightKg;
  return Number(((delta / days) * 7).toFixed(2));
}

function buildWeightStatus(
  profile: FighterProfile,
  weightLogs: WeightLog[]
): WeightStatus {
  const latest = getLatestWeightLog(weightLogs);
  const target = profile.targetFightWeightKg ?? null;
  const trend = calculateWeeklyTrend(weightLogs);

  if (!latest || !target) {
    return {
      latestWeightKg: latest?.weightKg ?? null,
      targetWeightKg: target,
      deltaKg: null,
      weeklyTrendKg: trend,
      projection: "unknown",
    };
  }

  const deltaKg = Number((latest.weightKg - target).toFixed(2));

  let projection: WeightStatus["projection"] = "unknown";

  if (deltaKg <= 0.5) {
    projection = "on-track";
  } else if (trend !== null && trend < 0) {
    projection = Math.abs(trend) >= 0.3 ? "on-track" : "off-track";
  } else {
    projection = "off-track";
  }

  return {
    latestWeightKg: latest.weightKg,
    targetWeightKg: target,
    deltaKg,
    weeklyTrendKg: trend,
    projection,
  };
}

function deriveDirective(
  profile: FighterProfile,
  latestFindings: VisionFinding[],
  weightStatus: WeightStatus
) {
  const topFinding = latestFindings[0];

  if (topFinding) {
    return {
      directive: `Fix ${topFinding.finding}.`,
      correction: topFinding.correction,
      drill: `3 rounds focused only on ${topFinding.finding.toLowerCase()} correction.`,
      priorityFocus: [
        topFinding.technique ?? "technical correction",
        "repetition under control",
      ],
    };
  }

  if (weightStatus.projection === "off-track") {
    return {
      directive: "Bring weight back under control.",
      correction: "Nutrition and recovery are not aligned with the target trajectory.",
      drill: "Log weight daily, clean up meals, and reduce unplanned intake immediately.",
      priorityFocus: ["weight management", "nutrition discipline"],
    };
  }

  if (profile.campGoal === "conditioning") {
    return {
      directive: "Raise work capacity.",
      correction: "Your camp priority is conditioning, not technical drift.",
      drill: "Complete structured conditioning without sacrificing technical quality.",
      priorityFocus: ["conditioning", "pace control"],
    };
  }

  return {
    directive: "Sharpen your base game.",
    correction: "No dominant technical issue detected. Tighten fundamentals.",
    drill: "3 focused rounds on stance, balance, and clean entries.",
    priorityFocus: [profile.baseArt ?? "base art", "fundamentals"],
  };
}

function buildChecklist(
  latestFindings: VisionFinding[],
  weightStatus: WeightStatus,
  latestFuelLog: FuelLog | null
): string[] {
  const list: string[] = [];

  if (latestFindings[0]) {
    list.push(`Correct: ${latestFindings[0].finding}`);
  }

  list.push("Complete today’s primary session");

  if (weightStatus.targetWeightKg !== null) {
    list.push("Log today’s bodyweight");
  }

  if (!latestFuelLog) {
    list.push("Log at least one meal");
  }

  return list;
}

function buildDailySession(
  directive: string,
  correction: string,
  priorityFocus: string[]
): DailySession {
  return {
    title: "Today’s Camp Session",
    objective: directive,
    blocks: [
      {
        title: "Technical warm-up",
        durationMin: 10,
        notes: "Move lightly. Prime the exact pattern you are fixing.",
      },
      {
        title: "Correction rounds",
        durationMin: 15,
        notes: correction,
      },
      {
        title: `Primary focus: ${priorityFocus[0] ?? "technical work"}`,
        durationMin: 20,
        notes: "Work at controlled intensity. Prioritize precision.",
      },
      {
        title: "Cooldown review",
        durationMin: 5,
        notes: "Write down what still breaks under fatigue.",
      },
    ],
  };
}

export function buildCampState(input: BuildCampStateInput): CampState {
  const latestFindings = getLatestVisionFindings(input.visionFindings, 3);
  const latestFuelLog = getLatestFuelLog(input.fuelLogs);
  const latestWeightLog = getLatestWeightLog(input.weightLogs);
  const weightStatus = buildWeightStatus(input.profile, input.weightLogs);

  const derived = deriveDirective(input.profile, latestFindings, weightStatus);
  const todaysSession = buildDailySession(
    derived.directive,
    derived.correction,
    derived.priorityFocus
  );

  return {
    fighterId: input.profile.fighterId,
    directive: derived.directive,
    correction: derived.correction,
    drill: derived.drill,
    priorityFocus: derived.priorityFocus,
    dailyChecklist: buildChecklist(latestFindings, weightStatus, latestFuelLog),
    todaysSession,
    lastCorrections: latestFindings,
    latestFuelLog,
    latestWeightLog,
    weightStatus,
    gymRecommendations: input.gymRecommendations.slice(0, 3),
    alerts: input.alerts.slice(0, 5),
    generatedAt: new Date().toISOString(),
  };
}