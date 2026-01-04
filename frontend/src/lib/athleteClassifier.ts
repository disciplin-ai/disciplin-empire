// src/lib/athleteClassifier.ts

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
  | "Wrestling"
  | "BJJ"
  | "MuayThai"
  | "Boxing"
  | "KarateTKD"
  | "MMA"
  | "None";

export type AthleteClass = {
  ageBand: AgeBand;
  level: LevelBand;
  discipline: Discipline;
  planType: PlanType;
};

/**
 * Classify age into bands.
 */
export function classifyAge(ageRaw: string | number | undefined | null): AgeBand {
  const age = Number(ageRaw || 0);
  if (!age || Number.isNaN(age)) return "Prime";

  if (age < 18) return "Youth";
  if (age <= 30) return "Prime";
  if (age <= 40) return "Mature";
  if (age <= 55) return "Masters";
  return "Senior";
}

/**
 * Classify level from years training + competition level text.
 */
export function classifyLevel(
  yearsTrainingRaw: string | number | undefined | null,
  competitionLevelRaw: string | undefined | null
): LevelBand {
  const years = Number(yearsTrainingRaw || 0);
  const competitionLevel = (competitionLevelRaw || "").toLowerCase();

  if (years < 1) return "Beginner";
  if (years < 2 && !/comp|tournament|fight/.test(competitionLevel))
    return "Hobbyist";

  if (/pro|professional/.test(competitionLevel)) return "Professional";

  if (/amat|tournament|comp/.test(competitionLevel)) {
    if (years <= 5) return "Amateur";
    return "AdvancedAmateur";
  }

  if (years < 3) return "Hobbyist";
  if (years < 7) return "Amateur";
  if (years < 10) return "AdvancedAmateur";
  return "Professional";
}

/**
 * Rough discipline inference from baseArt + secondaryArts.
 */
export function inferDiscipline(profile: FighterProfile): Discipline {
  const base = (profile.baseArt || "").toLowerCase();
  const secondaries = (profile.secondaryArts || []).join(" ").toLowerCase();
  const text = `${base} ${secondaries}`;

  if (/wrestl/.test(text)) return "Wrestling";
  if (/bjj|jiu[-\s]?jitsu/.test(text)) return "BJJ";
  if (/muay|thai/.test(text)) return "MuayThai";
  if (/box/.test(text)) return "Boxing";
  if (/karate|tae ?kwon ?do|tkd/.test(text)) return "KarateTKD";
  if (/mma|mixed martial/.test(text)) return "MMA";

  return "None";
}

/**
 * Choose high-level plan type based on age, level, injuries, and goal text.
 * This is the safety net that prevents reckless pro-style programming.
 */
export function choosePlanType(profile: FighterProfile): PlanType {
  const ageBand = classifyAge(profile.age);
  const level = classifyLevel(profile.yearsTraining, (profile as any).competitionLevel);

  const notes = `
${profile.scheduleNotes || ""}
${profile.boundariesNotes || ""}
${profile.campGoal || ""}
${profile.bodyType || ""}
`.toLowerCase();

  const hasSeriousInjury =
    /menisc|acl|shoulder|rotator|back|spine|disc|neck|surgery|torn|fracture/.test(
      notes
    );

  const shortNotice =
    /short notice|10[-\s]?day|1[-\s]?week|2[-\s]?week/.test(
      profile.campGoal?.toLowerCase() || ""
    );

  if (ageBand === "Youth") return "YouthSafety";
  if (hasSeriousInjury) return "InjuryReturn";
  if (shortNotice && ["Amateur", "AdvancedAmateur", "Professional"].includes(level))
    return "EmergencyCamp";

  if (ageBand === "Masters" || ageBand === "Senior") return "LongevityTechnique";
  if (["Beginner", "Hobbyist"].includes(level)) return "HybridLearning";
  if (level === "Professional" && ageBand === "Prime") return "HighPerformanceCamp";

  // Default for most “normal” competitors
  return "BalancedAmateurCamp";
}

/**
 * Produce a short text block explaining the athlete class to Sensei.
 */
export function describeAthleteClass(
  profile: FighterProfile
): { athleteClass: AthleteClass; textBlock: string } {
  const ageBand = classifyAge(profile.age);
  const level = classifyLevel(profile.yearsTraining, (profile as any).competitionLevel);
  const discipline = inferDiscipline(profile);
  const planType = choosePlanType(profile);

  const athleteClass: AthleteClass = {
    ageBand,
    level,
    discipline,
    planType,
  };

  const text = `
ATHLETE CLASSIFICATION (FOR SAFETY & INTENSITY)
-----------------------------------------------
Age band: ${ageBand}
Level: ${level}
Primary discipline: ${discipline}
Assigned plan type: ${planType}

Safety constraints:
- NEVER prescribe professional-level volume to anyone except a young, cleared Professional.
- Masters and Senior athletes MUST prioritize longevity, joint health, and controlled intensity.
- Youth athletes (<18) MUST NOT receive hard head sparring or brutal conditioning.
- Injury flags (meniscus, ACL, shoulder, back, neck, surgery) override everything: treat them as InjuryReturn.
`.trim();

  return { athleteClass, textBlock: text };
}
