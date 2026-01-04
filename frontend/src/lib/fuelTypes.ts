// frontend/src/lib/fuelTypes.ts

export type MacroRange = [number, number];

export type FuelRating = "CLEAN" | "MID" | "TRASH";
export type Confidence = "low" | "med" | "high";

export type FuelMacros = {
  calories_kcal_range: MacroRange;
  protein_g_range: MacroRange;
  carbs_g_range: MacroRange;
  fat_g_range: MacroRange;
};

export type FuelMacroConfidence = {
  calories: Confidence;
  protein: Confidence;
  carbs: Confidence;
  fat: Confidence;
};

export type FuelOutput = {
  rating: FuelRating;
  score: number; // 0-100
  score_reason: string;

  macros: FuelMacros;
  macro_confidence: FuelMacroConfidence;
  confidence: Confidence;

  report: string;
  questions: string[]; // 0-3
  followups_id: string;
};

export type FighterInput = {
  age?: string;
  currentWeight?: string;
  targetWeight?: string;
  bodyType?: string;
  paceStyle?: string;
};

export type TrainingInput = {
  session?: string;
  intensity?: string;
  goal?: string;
  fightWeek?: boolean;
  timeOfTraining?: string;
};

export type FuelAnalyzeRequest = {
  mode: "analyze";
  meals: string;
  fighter?: FighterInput;
  training?: TrainingInput;
};

export type FuelRefineRequest = {
  mode: "refine";
  followups_id: string;
  answers: Record<string, string>;
};

export type FuelHistoryRequest = {
  mode: "history";
  limit?: number;
};

export type FuelRequest = FuelAnalyzeRequest | FuelRefineRequest | FuelHistoryRequest;

export type FuelAnalyzeResponse =
  | ({ ok: true } & FuelOutput)
  | { ok: false; error: string; raw?: string };

export type FuelHistoryPoint = { day: string; fuel_score: number | null };

export type FuelHistoryResponse =
  | { ok: true; points: FuelHistoryPoint[] }
  | { ok: false; error: string };
