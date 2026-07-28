"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useProfile } from "@/components/ProfileProvider";
import { hasCompletedOnboarding } from "@/lib/onboarding/contracts";

export default function AppAccessGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { loading, error, user, profile, refresh } = useProfile();
  const developmentPreview =
    process.env.NODE_ENV !== "production" && !user && Boolean(profile);

  useEffect(() => {
    if (loading || developmentPreview) return;
    if (!user) {
      router.replace("/?auth=required");
      return;
    }
    if (!hasCompletedOnboarding(profile as Record<string, unknown> | null)) {
      router.replace("/onboarding");
    }
  }, [developmentPreview, loading, profile, router, user]);

  if (loading) {
    return (
      <section
        className="app-surface mx-auto min-h-[55vh] max-w-5xl p-6"
        aria-busy="true"
        aria-label="Loading your workspace"
      >
        <div className="app-skeleton h-3 w-28" />
        <div className="app-skeleton mt-6 h-10 max-w-md" />
        <div className="app-skeleton mt-4 h-4 max-w-xl" />
      </section>
    );
  }

  if (error) {
    return (
      <section className="app-card mx-auto max-w-xl p-7" role="alert">
        <p className="app-label text-amber-200/70">Connection interrupted</p>
        <h1 className="app-title-section mt-3">Your workspace could not load.</h1>
        <p className="app-body-secondary mt-3">{error}</p>
        <button className="app-button-primary mt-6" onClick={() => void refresh()}>
          Try again
        </button>
      </section>
    );
  }

  if (!developmentPreview && (!user || !hasCompletedOnboarding(profile as Record<string, unknown> | null))) {
    return (
      <section className="min-h-[45vh]" aria-label="Preparing navigation" />
    );
  }

  return children;
}
