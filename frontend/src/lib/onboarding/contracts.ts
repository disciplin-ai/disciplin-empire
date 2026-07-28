import type { FighterProfile } from "@/components/ProfileProvider";

export const ONBOARDING_VERSION = 1;

export const ONBOARDING_STEPS = [
  "ROLE",
  "ATHLETE_IDENTITY",
  "DISCIPLINES",
  "EXPERIENCE",
  "COACH_RELATIONSHIP",
  "COMPETITION_CONTEXT",
  "PREPARATION_CONTEXT",
  "PROFILE_REVIEW",
  "PLAN_SELECTION",
  "PERSONALIZING",
  "DASHBOARD_READY",
] as const;

export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];
export type OnboardingPhase = "READY" | "SAVING" | "ERROR" | "RESUMED" | "COMPLETE";

export type OnboardingState = {
  step: OnboardingStep;
  phase: OnboardingPhase;
  direction: 1 | -1;
  error: string | null;
  draft: FighterProfile;
  personalizationIndex: number;
};

export type OnboardingEvent =
  | { type: "NEXT" }
  | { type: "BACK" }
  | { type: "GO_TO"; step: OnboardingStep }
  | { type: "SAVE_START" }
  | { type: "SAVE_SUCCESS" }
  | { type: "SAVE_ERROR"; error: string }
  | { type: "PATCH"; patch: Partial<FighterProfile> }
  | { type: "PERSONALIZATION_PROGRESS"; index: number }
  | { type: "RESUME"; step: OnboardingStep }
  | { type: "COMPLETE" };

export function isOnboardingStep(value: unknown): value is OnboardingStep {
  return typeof value === "string" && ONBOARDING_STEPS.includes(value as OnboardingStep);
}

export function onboardingReducer(state: OnboardingState, event: OnboardingEvent): OnboardingState {
  const index = ONBOARDING_STEPS.indexOf(state.step);
  switch (event.type) {
    case "NEXT":
      return { ...state, step: ONBOARDING_STEPS[Math.min(index + 1, ONBOARDING_STEPS.length - 1)], phase: "READY", direction: 1, error: null };
    case "BACK":
      return { ...state, step: ONBOARDING_STEPS[Math.max(index - 1, 0)], phase: "READY", direction: -1, error: null };
    case "GO_TO":
      return { ...state, step: event.step, phase: "READY", direction: ONBOARDING_STEPS.indexOf(event.step) >= index ? 1 : -1, error: null };
    case "SAVE_START":
      return { ...state, phase: "SAVING", error: null };
    case "SAVE_SUCCESS":
      return { ...state, phase: "READY", error: null };
    case "SAVE_ERROR":
      return { ...state, phase: "ERROR", error: event.error };
    case "PATCH":
      return { ...state, draft: { ...state.draft, ...event.patch }, error: null };
    case "PERSONALIZATION_PROGRESS":
      return { ...state, personalizationIndex: event.index };
    case "RESUME":
      return { ...state, step: event.step, phase: "RESUMED", direction: 1, error: null };
    case "COMPLETE":
      return { ...state, phase: "COMPLETE", step: "DASHBOARD_READY", direction: 1, error: null };
  }
}

export function onboardingProgress(step: OnboardingStep) {
  const index = ONBOARDING_STEPS.indexOf(step);
  return Math.round((index / (ONBOARDING_STEPS.length - 1)) * 100);
}

export function hasCompletedOnboarding(data: Record<string, unknown> | null | undefined) {
  if (!data) return false;
  if (typeof data.onboardingCompletedAt === "string" && data.onboardingCompletedAt) return true;
  // Existing athletes with a meaningful fighter file are grandfathered in.
  return Boolean(data.name && (data.baseArt || data.primaryArt) && (data.competitionLevel || data.experience));
}

export function resumeStep(profile: FighterProfile | null): OnboardingStep {
  return isOnboardingStep(profile?.onboardingStage) ? profile.onboardingStage : "ROLE";
}

export function validateStep(step: OnboardingStep, profile: FighterProfile): string | null {
  switch (step) {
    case "ROLE": return profile.role === "athlete" ? null : "Choose Athlete to continue. Coach and Organization onboarding are not available yet.";
    case "ATHLETE_IDENTITY":
      if (!profile.name?.trim()) return "Enter the name you want Disciplin to use.";
      if (!profile.age?.trim() || Number(profile.age) < 13 || Number(profile.age) > 100) return "Enter a valid age. Age supports future safeguarding rules.";
      return null;
    case "DISCIPLINES": return profile.baseArt ? null : "Choose your primary discipline.";
    case "EXPERIENCE":
      if (!profile.competitionLevel) return "Choose your experience level.";
      if (!profile.trainingFrequency) return "Choose how often you train.";
      return null;
    case "COACH_RELATIONSHIP": return profile.coachRelationship ? null : "Choose the coaching relationship that is true today.";
    case "COMPETITION_CONTEXT": return profile.competitionStatus ? null : "Choose your current competition context.";
    case "PREPARATION_CONTEXT": return profile.nutritionSupport ? null : "Choose who guides your nutrition preparation.";
    case "PLAN_SELECTION": return profile.selectedPlan ? null : "Choose a plan preference to continue.";
    default: return null;
  }
}
