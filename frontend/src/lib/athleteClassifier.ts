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

export type AthleteClassifierResult = {
  ageBand: AgeBand;
  levelBand: LevelBand;
  plan: PlanType;
  primaryDiscipline: Discipline;
  notes: string; // merged prompt notes
};

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

function isNonEmpty(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
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
  if (age === null) return "Prime";
  if (age <= 17) return "Youth";
  if (age <= 34) return "Prime";
  if (age <= 44) return "Mature";
  if (age <= 54) return "Masters";
  return "Senior";
}

function computeLevelBand(profile: FighterProfile): LevelBand {
  const yrs = toFloat(profile.yearsTraining);
  const comp = (profile.competitionLevel ?? "").toLowerCase();

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

function buildNotes(profile: FighterProfile): string {
  // ✅ Narrowing: do NOT assume these props exist on FighterProfile
  const scheduleNotes =
    "scheduleNotes" in profile ? (profile as any).scheduleNotes : undefined;

  const boundariesNotes =
    "boundariesNotes" in profile ? (profile as any).boundariesNotes : undefined;

  const hardBoundaries = profile.hardBoundaries;
  const campGoal = profile.campGoal;
  const bodyType = profile.bodyType;
  const injuryHistory = profile.injuryHistory;
  const availability = profile.availability;
  const lifeLoad = profile.lifeLoad;

  const lines = [
    isNonEmpty(scheduleNotes) && `Schedule notes: ${scheduleNotes}`,
    isNonEmpty(boundariesNotes) && `Boundaries notes: ${boundariesNotes}`,
    isNonEmpty(hardBoundaries) && `Hard boundaries: ${hardBoundaries}`,
    isNonEmpty(campGoal) && `Camp goal: ${campGoal}`,
    isNonEmpty(bodyType) && `Body type: ${bodyType}`,
    isNonEmpty(injuryHistory) && `Injury history: ${injuryHistory}`,
    isNonEmpty(availability) && `Availability: ${availability}`,
    isNonEmpty(lifeLoad) && `Life load: ${lifeLoad}`,
  ].filter(Boolean) as string[];

  return lines.join("\n");
}

function pickPlan(profile: FighterProfile, ageBand: AgeBand, levelBand: LevelBand): PlanType {
  const injury = (profile.injuryHistory ?? "").toLowerCase();
  const load = (profile.lifeLoad ?? "").toLowerCase();

  if (ageBand === "Youth") return "YouthSafety";

  if (injury.includes("knee") || injury.includes("shoulder") || injury.includes("back")) {
    return "InjuryReturn";
  }

  if (load.includes("busy") || load.includes("school") || load.includes("work")) {
    return "EmergencyCamp";
  }

  if (levelBand === "Beginner") return "LongevityTechnique";
  if (levelBand === "Hobbyist") return "BalancedAmateurCamp";
  if (levelBand === "Amateur") return "BalancedAmateurCamp";
  if (levelBand === "AdvancedAmateur") return "HighPerformanceCamp";
  return "HighPerformanceCamp";
}

export function classifyAthlete(profile: FighterProfile): AthleteClassifierResult {
  const ageBand = computeAgeBand(profile.age);
  const levelBand = computeLevelBand(profile);
  const primaryDiscipline = normalizeDiscipline(profile.baseArt);
  const notes = buildNotes(profile);
  const plan = pickPlan(profile, ageBand, levelBand);

  return { ageBand, levelBand, plan, primaryDiscipline, notes };
}
