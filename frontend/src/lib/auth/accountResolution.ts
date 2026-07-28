import { hasCompletedOnboarding } from "@/lib/onboarding/contracts";

export type ResolvedAccountProfile = Record<string, unknown> | null | undefined;

export function accountResolutionLabel(profile: ResolvedAccountProfile) {
  const hasStartedSetup = Boolean(
    profile?.onboardingVersion ||
    profile?.onboardingStage ||
    profile?.name,
  );

  if (!hasStartedSetup) return "Preparing your profile";
  if (!hasCompletedOnboarding(profile)) return "Restoring your setup";
  return profile?.role === "athlete"
    ? "Loading your athlete workspace"
    : "Loading your workspace";
}
