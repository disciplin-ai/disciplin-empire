"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useProfile } from "@/components/ProfileProvider";
import { hasCompletedOnboarding } from "@/lib/onboarding/contracts";
import { useCoach } from "@/components/CoachProvider";

export default function AuthenticatedHomeRedirect() {
  const router = useRouter();
  const { loading, user, profile } = useProfile();
  const { state: coachState, loading: coachLoading } = useCoach();

  useEffect(() => {
    if (loading || coachLoading || !user) return;
    if (coachState.coachedRelationships.length > 0) {
      router.replace("/coach");
      return;
    }
    router.replace(
      hasCompletedOnboarding(profile as Record<string, unknown> | null)
        ? "/dashboard"
        : "/onboarding",
    );
  }, [coachLoading, coachState.coachedRelationships.length, loading, profile, router, user]);

  return null;
}
