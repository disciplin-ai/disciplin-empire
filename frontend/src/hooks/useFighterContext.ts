// src/hooks/useFighterContext.ts
"use client";

import { useMemo } from "react";
import { useProfile } from "@/components/ProfileProvider";
import { toFighterContext } from "@/lib/profile/toFighterContext";

export function useFighterContext() {
  const { user, loading, profile, saveProfile, refresh, signOut } = useProfile();

  const fighterContext = useMemo(() => toFighterContext(profile), [profile]);

  return {
    user,
    loading,
    profile,
    fighterContext,
    saveProfile,
    refresh,
    signOut,
  };
}