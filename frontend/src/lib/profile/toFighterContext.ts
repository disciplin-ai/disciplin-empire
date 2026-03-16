import type { FighterProfile } from "@/components/ProfileProvider";

export type FighterContext = {
  identity: {
    name: string | null;
    age: number | null;
    height: string | null;
    currentWeight: number | null;
    targetWeight: number | null;
    weightClass: string | null;
  };
  style: {
    baseArt: string | null;
    stance: string | null;
    secondaryArts: string[];
    paceStyle: string | null;
    pressurePreference: string | null;
    strengths: string | null;
    weaknesses: string | null;
  };
  camp: {
    fightDate: string | null;
    availability: string | null;
    injuryHistory: string | null;
    hardBoundaries: string | null;
    lifeLoad: string | null;
    scheduleNotes: string | null;
    boundariesNotes: string | null;
  };
  nutrition: {
    dietType: string | null;
    allergies: string[];
    intolerances: string[];
    foodDislikes: string[];
    favoriteFoods: string[];
    avoidFoods: string[];
    religiousDietNotes: string | null;
  };
};

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function toStringOrNull(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((v) => (typeof v === "string" ? v.trim() : ""))
    .filter(Boolean);
}

export function toFighterContext(profile: FighterProfile | null): FighterContext {
  const p = profile ?? {};

  return {
    identity: {
      name: toStringOrNull(p.name),
      age: toNumber(p.age),
      height: toStringOrNull(p.height),
      currentWeight: toNumber(p.currentWeight),
      targetWeight: toNumber(p.targetWeight),
      weightClass: toStringOrNull(p.weightClass),
    },
    style: {
      baseArt: toStringOrNull(p.baseArt),
      stance: toStringOrNull(p.stance),
      secondaryArts: toStringArray(p.secondaryArts),
      paceStyle: toStringOrNull(p.paceStyle),
      pressurePreference: toStringOrNull(p.pressurePreference),
      strengths: toStringOrNull(p.strengths),
      weaknesses: toStringOrNull(p.weaknesses),
    },
    camp: {
      fightDate: toStringOrNull(p.fightDate),
      availability: toStringOrNull(p.availability),
      injuryHistory: toStringOrNull(p.injuryHistory),
      hardBoundaries: toStringOrNull(p.hardBoundaries),
      lifeLoad: toStringOrNull(p.lifeLoad),
      scheduleNotes: toStringOrNull(p.scheduleNotes),
      boundariesNotes: toStringOrNull(p.boundariesNotes),
    },
    nutrition: {
      dietType: toStringOrNull(p.dietType),
      allergies: toStringArray(p.allergies),
      intolerances: toStringArray(p.intolerances),
      foodDislikes: toStringArray(p.foodDislikes),
      favoriteFoods: toStringArray(p.favoriteFoods),
      avoidFoods: toStringArray(p.avoidFoods),
      religiousDietNotes: toStringOrNull(p.religiousDietNotes),
    },
  };
}