"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { User } from "@supabase/supabase-js";
import { getSupabaseBrowser } from "../lib/supabase/browser";

export type DietType =
  | "none"
  | "halal"
  | "kosher"
  | "vegan"
  | "vegetarian"
  | "pescatarian"
  | "keto";

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

  scheduleNotes?: string;
  boundariesNotes?: string;

  fightDate?: string;
  weightClass?: string;
  currentWeight?: number;
  targetWeight?: number;

  dietType?: DietType;
  allergies?: string[];
  intolerances?: string[];
  foodDislikes?: string[];
  favoriteFoods?: string[];
  avoidFoods?: string[];
  religiousDietNotes?: string;
};

type SaveResult = { ok: true } | { ok: false; error: string };

type ProfileContextValue = {
  user: User | null;
  loading: boolean;
  profile: FighterProfile | null;
  saveProfile: (next: FighterProfile) => Promise<SaveResult>;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};

const ProfileContext = createContext<ProfileContextValue | null>(null);

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
}

function normalizeOptionalString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeOptionalNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }

  return undefined;
}

function normalizeDietType(value: unknown): DietType | undefined {
  const allowed: DietType[] = [
    "none",
    "halal",
    "kosher",
    "vegan",
    "vegetarian",
    "pescatarian",
    "keto",
  ];

  if (typeof value !== "string") return undefined;
  return allowed.includes(value as DietType) ? (value as DietType) : undefined;
}

function normalizeProfile(raw: unknown): FighterProfile {
  const input = (raw ?? {}) as Record<string, unknown>;

  return {
    name: normalizeOptionalString(input.name),
    age: normalizeOptionalString(input.age),
    height: normalizeOptionalString(input.height),
    walkAroundWeight: normalizeOptionalString(input.walkAroundWeight),
    baseArt: normalizeOptionalString(input.baseArt),
    stance: normalizeOptionalString(input.stance),
    secondaryArts: normalizeStringArray(input.secondaryArts),

    yearsTraining: normalizeOptionalString(input.yearsTraining),
    competitionLevel: normalizeOptionalString(input.competitionLevel),
    recentCamp: normalizeOptionalString(input.recentCamp),
    campGoal: normalizeOptionalString(input.campGoal),

    bodyType: normalizeOptionalString(input.bodyType),
    paceStyle: normalizeOptionalString(input.paceStyle),
    pressurePreference: normalizeOptionalString(input.pressurePreference),
    strengths: normalizeOptionalString(input.strengths),
    weaknesses: normalizeOptionalString(input.weaknesses),

    availability: normalizeOptionalString(input.availability),
    injuryHistory: normalizeOptionalString(input.injuryHistory),
    hardBoundaries: normalizeOptionalString(input.hardBoundaries),
    lifeLoad: normalizeOptionalString(input.lifeLoad),

    scheduleNotes: normalizeOptionalString(input.scheduleNotes),
    boundariesNotes: normalizeOptionalString(input.boundariesNotes),

    fightDate: normalizeOptionalString(input.fightDate),
    weightClass: normalizeOptionalString(input.weightClass),
    currentWeight: normalizeOptionalNumber(input.currentWeight),
    targetWeight: normalizeOptionalNumber(input.targetWeight),

    dietType: normalizeDietType(input.dietType),
    allergies: normalizeStringArray(input.allergies),
    intolerances: normalizeStringArray(input.intolerances),
    foodDislikes: normalizeStringArray(input.foodDislikes),
    favoriteFoods: normalizeStringArray(input.favoriteFoods),
    avoidFoods: normalizeStringArray(input.avoidFoods),
    religiousDietNotes: normalizeOptionalString(input.religiousDietNotes),
  };
}

const EMPTY_PROFILE: FighterProfile = {
  secondaryArts: [],
  allergies: [],
  intolerances: [],
  foodDislikes: [],
  favoriteFoods: [],
  avoidFoods: [],
  dietType: "none",
};

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  console.log("[profiles] provider mounted");

  const supabase = useMemo(() => getSupabaseBrowser(), []);

  const mountedRef = useRef(true);
  const refreshPromiseRef = useRef<Promise<void> | null>(null);

  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<FighterProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (refreshPromiseRef.current) {
      return refreshPromiseRef.current;
    }

    const run = (async () => {
      try {
        if (!mountedRef.current) return;

        setLoading(true);

        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        console.log("[profiles] getSession error:", sessionError?.message ?? null);
        console.log("[profiles] session exists:", !!session);
        console.log("[profiles] user id:", session?.user?.id ?? null);
        console.log("[profiles] user email:", session?.user?.email ?? null);

        if (sessionError) {
          if (mountedRef.current) {
            setUser(null);
            setProfile(null);
            setLoading(false);
          }
          return;
        }

        const u = session?.user ?? null;

        if (!mountedRef.current) return;

        setUser(u);

        if (!u) {
          console.log("[profiles] no authenticated user");
          setProfile(null);
          setLoading(false);
          return;
        }

        const { data, error } = await supabase
          .from("profiles")
          .select("data")
          .eq("user_id", u.id)
          .maybeSingle();

        console.log("[profiles] profile query error:", error?.message ?? null);
        console.log("[profiles] profile row exists:", !!data);
        console.log("[profiles] raw profile row:", data ?? null);

        if (!mountedRef.current) return;

        if (error) {
          setProfile(null);
          setLoading(false);
          return;
        }

        const nextProfile = data?.data
          ? normalizeProfile(data.data)
          : { ...EMPTY_PROFILE };

        console.log("[profiles] normalized profile:", nextProfile);
        console.log("[profiles] final profile name:", nextProfile.name ?? null);

        setProfile(nextProfile);
        setLoading(false);
      } catch (error) {
        console.error("[profiles] refresh failed:", error);

        if (mountedRef.current) {
          setUser(null);
          setProfile(null);
          setLoading(false);
        }
      } finally {
        refreshPromiseRef.current = null;
      }
    })();

    refreshPromiseRef.current = run;
    return run;
  }, [supabase]);

  useEffect(() => {
    mountedRef.current = true;

    void refresh();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      console.log("[profiles] auth state change:", event);
      console.log("[profiles] auth state user:", session?.user?.email ?? null);

      if (!mountedRef.current) return;

      const nextUser = session?.user ?? null;
      setUser(nextUser);

      if (!nextUser) {
        setProfile(null);
        setLoading(false);
        return;
      }

      queueMicrotask(() => {
        if (mountedRef.current) {
          void refresh();
        }
      });
    });

    return () => {
      mountedRef.current = false;
      subscription.unsubscribe();
    };
  }, [refresh, supabase]);

  const saveProfile = useCallback(
    async (next: FighterProfile): Promise<SaveResult> => {
      try {
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError) {
          return { ok: false, error: sessionError.message };
        }

        const u = session?.user ?? null;

        if (!u) {
          return { ok: false, error: "Not logged in." };
        }

        const normalizedNext = normalizeProfile(next);

        const { error } = await supabase.from("profiles").upsert(
          {
            user_id: u.id,
            data: normalizedNext,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" }
        );

        if (error) {
          return { ok: false, error: error.message };
        }

        if (mountedRef.current) {
          setProfile(normalizedNext);
        }

        return { ok: true };
      } catch (error) {
        console.error("[profiles] saveProfile failed:", error);
        return { ok: false, error: "Failed to save profile." };
      }
    },
    [supabase]
  );

  const signOut = useCallback(async () => {
    try {
      await supabase.auth.signOut();

      if (!mountedRef.current) return;

      setUser(null);
      setProfile(null);
      setLoading(false);
    } catch (error) {
      console.error("[profiles] signOut failed:", error);
    }
  }, [supabase]);

  const value = useMemo<ProfileContextValue>(
    () => ({
      user,
      loading,
      profile,
      saveProfile,
      refresh,
      signOut,
    }),
    [user, loading, profile, saveProfile, refresh, signOut]
  );

  return (
    <ProfileContext.Provider value={value}>
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  const ctx = useContext(ProfileContext);
  if (!ctx) {
    throw new Error("useProfile must be used within ProfileProvider");
  }
  return ctx;
}