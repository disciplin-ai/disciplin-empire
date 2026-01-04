// src/lib/fighterSummary.ts

// Kept generic so it works with whatever you store in profile_json
type AnyProfile = {
  name?: string;
  age?: string;
  height?: string;
  walkAroundWeight?: string;

  baseArt?: string;
  secondaryArts?: string[];
  stance?: string;

  overallLevel?: string;
  yearsTraining?: string;
  competitionLevel?: string;
  currentGym?: string;

  bodyType?: string;
  paceStyle?: string;
  pressurePreference?: string;

  campGoal?: string;
  boundariesNotes?: string;
  scheduleNotes?: string;
};

/**
 * Turn the saved fighter profile into a clean text block
 * that we can feed directly into the Sensei system prompt.
 */
export function buildFighterSummary(p: AnyProfile = {}): string {
  return `
FIGHTER PROFILE
---------------
Name: ${p.name || "Not set"}
Age: ${p.age || "Not set"}
Height: ${p.height || "Not set"}
Walk-around weight: ${p.walkAroundWeight || "Not set"}

Base art: ${p.baseArt || "Not set"}
Secondary arts: ${p.secondaryArts?.join(", ") || "None"}
Stance: ${p.stance || "Not set"}

Overall skill: ${p.overallLevel || "Not rated"}
Years training: ${p.yearsTraining || "Not set"}
Competition level: ${p.competitionLevel || "Not set"}
Current gym: ${p.currentGym || "None"}

Body type: ${p.bodyType || "Not set"}
Pace style: ${p.paceStyle || "Not set"}
Pressure preference: ${p.pressurePreference || "Not set"}

Camp goal: ${p.campGoal || "Not set"}
Boundaries: ${p.boundariesNotes || "None"}
Schedule load: ${p.scheduleNotes || "Not set"}
`.trim();
}
