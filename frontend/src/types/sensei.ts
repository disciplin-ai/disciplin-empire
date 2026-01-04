// src/types/sensei.ts

// What you choose for this particular session
export type SenseiGoal = "pressure" | "speed" | "power" | "recovery" | "mixed";

export interface SenseiContext {
  goal: SenseiGoal;
  daysToNextFight?: number;
  lastSessionFocus?: string;
  lastSessionRPE?: number;
}

// This is the payload we send to the API.
// profile = your fighter profile
// context = session-specific choices
export interface SenseiPlanRequest {
  profile: { [key: string]: any };
  context: SenseiContext;
}

// You can expand this later – this is just a solid v1.
export interface SenseiRound {
  round: number;
  durationSeconds: number;
  focus: string;
  drill: string;
  coachingCues: string[];
  intensity: "easy" | "moderate" | "hard" | "war";
}

export interface SenseiPlan {
  warmup: string[];
  mainRounds: SenseiRound[];
  finisher: string;
  notes: string[];
  safety: string[];
}
