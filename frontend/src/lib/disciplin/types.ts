// src/lib/disciplin/types.ts

export type UUID = string;

export type Severity = "low" | "medium" | "high" | "critical";

export type BaseArt =
  | "mma"
  | "boxing"
  | "kickboxing"
  | "muay-thai"
  | "wrestling"
  | "bjj"
  | "judo"
  | "sambo"
  | "other";

export type Stance = "orthodox" | "southpaw" | "switch" | "unknown";

export type CompetitionLevel =
  | "beginner"
  | "intermediate"
  | "amateur"
  | "semi-pro"
  | "pro";

export type CampGoal =
  | "general-improvement"
  | "fight-prep"
  | "weight-cut"
  | "skill-correction"
  | "conditioning"
  | "return-from-injury";

export type FighterProfile = {
  fighterId: UUID;
  name?: string;
  age?: number | null;
  heightCm?: number | null;
  walkAroundWeightKg?: number | null;
  targetFightWeightKg?: number | null;

  baseArt?: BaseArt;
  stance?: Stance;
  secondaryArts?: string[];

  yearsTraining?: number | null;
  competitionLevel?: CompetitionLevel | null;
  campGoal?: CampGoal | null;

  bodyType?: string | null;
  paceStyle?: string | null;
  pressurePreference?: string | null;

  strengths?: string[];
  weaknesses?: string[];

  availability?: string | null;
  injuryHistory?: string | null;
  hardBoundaries?: string | null;
  lifeLoad?: string | null;

  updatedAt?: string | null;
};

export type VisionFinding = {
  id: UUID;
  fighterId: UUID;
  sourceType: "image" | "video-frame";
  sport: string | null;
  technique: string | null;
  finding: string;
  correction: string;
  severity: Severity;
  createdAt: string;
};

export type FuelLog = {
  id: UUID;
  fighterId: UUID;
  mealText: string;
  calories?: number | null;
  proteinG?: number | null;
  carbsG?: number | null;
  fatsG?: number | null;
  fuelScore?: number | null;
  report?: string | null;
  createdAt: string;
};

export type WeightLog = {
  id: UUID;
  fighterId: UUID;
  weightKg: number;
  loggedAt: string;
};

export type GymRecommendation = {
  id: UUID;
  fighterId: UUID;
  gymId: UUID;
  gymName: string;
  reason: string;
  score: number;
  createdAt: string;
};

export type CampAlert = {
  id: UUID;
  fighterId: UUID;
  type:
    | "weight-warning"
    | "training-warning"
    | "recovery-warning"
    | "vision-warning"
    | "fuel-warning"
    | "system-warning";
  severity: Severity;
  message: string;
  createdAt: string;
};

export type SessionBlock = {
  title: string;
  durationMin?: number | null;
  notes?: string | null;
};

export type DailySession = {
  title: string;
  objective: string;
  blocks: SessionBlock[];
};

export type WeightStatus = {
  latestWeightKg: number | null;
  targetWeightKg: number | null;
  deltaKg: number | null;
  weeklyTrendKg: number | null;
  projection: "on-track" | "off-track" | "unknown";
};

export type CampState = {
  fighterId: UUID;

  directive: string;
  correction: string;
  drill: string;

  priorityFocus: string[];
  dailyChecklist: string[];
  todaysSession: DailySession | null;

  lastCorrections: VisionFinding[];
  latestFuelLog: FuelLog | null;
  latestWeightLog: WeightLog | null;
  weightStatus: WeightStatus;

  gymRecommendations: GymRecommendation[];
  alerts: CampAlert[];

  generatedAt: string;
};

export type SenseiIntent =
  | "why-directive"
  | "generate-session"
  | "mobility-session"
  | "why-gym"
  | "weight-check"
  | "vision-followup"
  | "fuel-followup"
  | "general";

export type SenseiResponse = {
  directive: string;
  correction: string;
  drill: string;
  explanation?: string;
  optionalGymSupport?: string;
  session?: DailySession | null;
};