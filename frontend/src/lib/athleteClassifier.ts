// frontend/src/lib/athleteClassifier.ts
import type { FighterProfile } from "../components/ProfileProvider";

export type AgeBand = "Youth" | "Prime" | "Mature" | "Masters" | "Senior";

export type LevelBand =
  | "Beginner"
  | "Hobbyist"
  | "Amateur"
  | "AdvancedAmateur"
  | "Professional";

export type PlanType =
  | "LongevityTechnique" // Plan A
  | "BalancedAmateurCamp" // Plan B
  | "HighPerformanceCamp" // Plan C
  | "EmergencyCamp" // Plan D
  | "HybridLearning" // Plan E
  | "InjuryReturn" // Plan F
  | "YouthSafety"; // Plan G

export type Discipline =
  | "MMA"
  | "Boxing"
  | "Wrestling"
  | "BJJ"
  | "Sambo"
  | "MuayThai"
  | "Kickboxing"
  | "Strength"
  | "Other";

/** Output returned to Sensei / UI */
export type AthleteClassifierResult = {
  ageBand: AgeBand;
  levelBand: LevelBand;
  plan: PlanType;
  primaryDiscipline: Discipline;
  notes: string; // clean merged notes used in prompts
};

/** -----------------------------
 * Helpers (defensive + build-safe)
 * ---------------------------- */
function toInt(v?: string): number | null {
  if (!v) return null;
  const n = parseInt(String(v).replace(/[^\d]/g, ""), 10);
  return Number.isFinite(n) ? n : null;
}

function toFloat(v?: string): number | null {
  if (!v) return null;
  const n = parseFloat(String(v).replace(/[^\d.]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function normalizeDiscipline(baseArt?: string): Discipline {
  const s = (baseArt ?? "").toLowerCase();

  if (s.includes("mma")) return "MMA";
  if (s.includes("boxing")) return "Boxing";
  if (s.includes("wrest")) return "Wrestling";
  if (s.includes("bjj") || s.includes("jiu")) return "BJJ";
  if (s.includes("sambo")) return "Sambo";
  if (s.includes("muay")) return "MuayThai";
  if (s.includes("kick")) return "Kickboxing";
  if (s.includes("strength") || s.includes("gym")) return "Strength";

  return "Other";
}

function computeAgeBand(ageStr?: string): AgeBand {
  const age = toInt(ageStr);
  if (age === null) return "Prime"; // default band if unknown
  if (age <= 17) return "Youth";
  if (age <= 34) return "Prime";
  if (age <= 44) return "Mature";
  if (age <= 54) return "Masters";
  return "Senior";
}

function computeLevelBand(profile: FighterProfile): LevelBand {
  const yrs = toFloat(profile.yearsTraining);
  const comp = (profile.competitionLevel ?? "").toLowerCase();

  // Quick heuristic (you can tune later)
  if (comp.includes("pro")) return "Professional";
  if (comp.includes("advanced")) return "AdvancedAmateur";
  if (comp.includes("amateur")) return "Amateur";

  if (yrs === null) return "Hobbyist";
  if (yrs < 1) return "Beginner";
  if (yrs < 3) return "Hobbyist";
  if (yrs < 6) return "Amateur";
  if (yrs < 10) return "AdvancedAmateur";
  return "Professional";
}

/**
 * Notes block used for prompts.
 * IMPORTANT: We read scheduleNotes/boundariesNotes defensively.
 * Even if the type is missing them somewhere, this file won't crash at runtime.
 */
function buildNotes(profile: FighterProfile): string {
  const p = profile as any; // <-- defensive bridge across older types

  const scheduleNotes = (p.scheduleNotes ?? "").toString();
  const boundariesNotes = (p.boundariesNotes ?? "").toString();

  const hardBoundaries = (profile.hardBoundaries ?? "").toString();
  const campGoal = (profile.campGoal ?? "").toString();
  const bodyType = (profile.bodyType ?? "").toString();
  const injuryHistory = (profile.injuryHistory ?? "").toString();
  const availability = (profile.availability ?? "").toString();
  const lifeLoad = (profile.lifeLoad ?? "").toString();

  // Keep it clean: remove empty lines
  const lines = [
    scheduleNotes && `Schedule notes: ${scheduleNotes}`,
    boundariesNotes && `Boundaries notes: ${boundariesNotes}`,
    hardBoundaries && `Hard boundaries: ${hardBoundaries}`,
    campGoal && `Camp goal: ${campGoal}`,
    bodyType && `Body type: ${bodyType}`,
    injuryHistory && `Injury history: ${injuryHistory}`,
    availability && `Availability: ${availability}`,
    lifeLoad && `Life load: ${lifeLoad}`,
  ].filter(Boolean);

  return lines.join("\n");
}

/**
 * Plan selection — simple rule set you can evolve.
 * (The key is stable output, not perfect sports science yet.)
 */
function pickPlan(profile: FighterProfile, ageBand: AgeBand, levelBand: LevelBand): PlanType {
  const injury = (profile.injuryHistory ?? "").toLowerCase();
  const lifeLoad = (profile.lifeLoad ?? "").toLowerCase();

  // If youth: safety first
  if (ageBand === "Youth") return "YouthSafety";

  // Injury heavy → injury return plan
  if (injury.includes("knee") || injury.includes("shoulder") || injury.includes("back")) {
    return "InjuryReturn";
  }

  // High life load + low availability → emergency plan
  if (lifeLoad.includes("busy") || lifeLoad.includes("school") || lifeLoad.includes("work")) {
    return "EmergencyCamp";
  }

  // Level-driven
  if (levelBand === "Beginner") return "LongevityTechnique";
  if (levelBand === "Hobbyist") return "BalancedAmateurCamp";
  if (levelBand === "Amateur") return "BalancedAmateurCamp";
  if (levelBand === "AdvancedAmateur") return "HighPerformanceCamp";
  return "HighPerformanceCamp";
}

/** -----------------------------
 * Main entry (what your app calls)
 * ---------------------------- */
export function classifyAthlete(profile: FighterProfile): AthleteClassifierResult {
  const ageBand = computeAgeBand(profile.age);
  const levelBand = computeLevelBand(profile);
  const primaryDiscipline = normalizeDiscipline(profile.baseArt);
  const notes = buildNotes(profile);
  const plan = pickPlan(profile, ageBand, levelBand);

  return {
    ageBand,
    levelBand,
    plan,
    primaryDiscipline,
    notes,
  };
}
