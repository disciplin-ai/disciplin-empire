"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { User } from "@supabase/supabase-js";
import { supabaseBrowser } from "../lib/supabase/browser";

export type FighterProfile = {
  name?: string;
  age?: string;
  height?: string;
  walkAroundWeight?: string;
  baseArt?: string;
  stance?: string;
  secondaryArts?: string[];

  yearsTraining?: string;
  competitionLevel?: string;
  recentCamp?: string;
  campGoal?: string;

  bodyType?: string;
  paceStyle?: string;
  pressurePreference?: string;
  strengths?: string;
  weaknesses?: string;

  availability?: string;
  injuryHistory?: string;
  hardBoundaries?: string;
  lifeLoad?: string;

  // ✅ Added for athleteClassifier
  scheduleNotes?: string;
  boundariesNotes?: string;
};

type SaveResult = { ok: true } | { ok: false; error: string };

type ProfileContextValue = {
  user: User | null;
  loading: boolean;
  profile: FighterProfile | null;
  saveProfile: (next: FighterProfile) => Promise<SaveResult>;
  refresh: () => Promise<void>;
};

const ProfileContext = createContext<ProfileContextValue | null>(null);

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const supabase = useMemo(() => supabaseBrowser(), []);

  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<FighterProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    setLoading(true);

    const { data: userRes } = await supabase.auth.getUser();
    const u = userRes.user ?? null;
    setUser(u);

    if (!u) {
      setProfile(null);
      setLoading(false);
      return;
    }

    // profiles table MUST have: user_id uuid pk, data jsonb
    const { data, error } = await supabase
      .from("profiles")
      .select("data")
      .eq("user_id", u.id)
      .maybeSingle();

    if (error) {
      console.warn("[profiles] load error:", error.message);
      setProfile(null);
      setLoading(false);
      return;
    }

    setProfile((data?.data as FighterProfile) ?? {});
    setLoading(false);
  };

  useEffect(() => {
    refresh();

    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      refresh();
    });

    return () => {
      sub.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveProfile = async (next: FighterProfile): Promise<SaveResult> => {
    const { data: userRes } = await supabase.auth.getUser();
    const u = userRes.user ?? null;

    if (!u) return { ok: false, error: "Not logged in." };

    const { error } = await supabase.from("profiles").upsert(
      {
        user_id: u.id,
        data: next,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

    if (error) return { ok: false, error: error.message };

    setProfile(next);
    return { ok: true };
  };

  return (
    <ProfileContext.Provider
      value={{ user, loading, profile, saveProfile, refresh }}
    >
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error("useProfile must be used within ProfileProvider");
  return ctx;
}
