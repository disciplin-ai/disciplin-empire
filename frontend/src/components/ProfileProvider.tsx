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
import { normalizeCoachRelationship, type CoachRelationship } from "@/lib/onboarding/authority";
import {
  announceIdentityChange,
  clearUserStorage,
  clearLegacyUserStorage,
  developmentPreviewAllowed,
} from "@/lib/userScopedStorage";

export type DietType =
  | "none"
  | "halal"
  | "kosher"
  | "vegan"
  | "vegetarian"
  | "pescatarian"
  | "keto";

export type CoachingStyle = "Direct" | "Tactical" | "Encouraging" | "Brutal";

export type FighterProfile = {
  role?: "athlete" | "coach" | "organization";
  name?: string;
  age?: string;
  height?: string;
  walkAroundWeight?: string;
  baseArt?: string;
  stance?: string;
  secondaryArts?: string[];

  yearsTraining?: string;
  competitionLevel?: string;
  competitionStatus?: string;
  currentPhase?: string;
  recentCamp?: string;
  campGoal?: string;

  bodyType?: string;
  paceStyle?: string;
  pressurePreference?: string;
  fighterArchetype?: string;
  strengths?: string;
  weaknesses?: string;

  currentFocus?: string;
  activeConstraints?: string[];
  coachingStyle?: CoachingStyle;

  currentCorrection?: string;
  currentLock?: string;
  completedCorrections?: string[];
  progressionHistory?: string[];

  availability?: string;
  injuryHistory?: string;
  hardBoundaries?: string;
  lifeLoad?: string;

  gym?: string;
  trainingFrequency?: string;
  mainPartners?: string[];
  competitionGoals?: string;

  scheduleNotes?: string;
  boundariesNotes?: string;

  fightDate?: string;
  weightClass?: string;
  currentWeight?: number;
  targetWeight?: number;
  sleep?: string;
  readiness?: string;
  currentStatus?: string;

  dietType?: DietType;
  allergies?: string[];
  intolerances?: string[];
  foodDislikes?: string[];
  favoriteFoods?: string[];
  avoidFoods?: string[];
  religiousDietNotes?: string;
  coachRelationship?: CoachRelationship;
  coachName?: string;
  correctionRecordingMethod?: "coach_records" | "athlete_records_exact_words" | "review_together";
  targetSource?: "athlete" | "coach" | "qualified_practitioner";
  nutritionSupport?: "qualified_practitioner" | "coach_guidance" | "self_guided";
  preparationPriorities?: string[];
  selectedPlan?: "trial" | "standard" | "pro";
  onboardingVersion?: number;
  onboardingSetupCheckpoint?: number;
  onboardingStage?: string;
  onboardingCompletedAt?: string;
  dashboardRevealPending?: boolean;
};

type SaveResult = { ok: true } | { ok: false; error: string };

type ProfileContextValue = {
  user: User | null;
  loading: boolean;
  error: string | null;
  profile: FighterProfile | null;
  saveProfile: (next: FighterProfile) => Promise<SaveResult>;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};

const ProfileContext = createContext<ProfileContextValue | null>(null);
const DEVELOPMENT_ONBOARDING_KEY = "disciplin_onboarding_development_preview_v1";
export const DEVELOPMENT_PREVIEW_UPDATED_EVENT = "disciplin:development-preview-updated";

function developmentPreviewProfile() {
  if (process.env.NODE_ENV === "production" || typeof window === "undefined") return null;
  if (!developmentPreviewAllowed(null, window.location.search, document.cookie)) return null;
  try {
    const raw = window.sessionStorage.getItem(DEVELOPMENT_ONBOARDING_KEY);
    return raw ? normalizeProfile(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

function clearDevelopmentPreview() {
  if (typeof window === "undefined") return;
  document.cookie = "disciplin_onboarding_preview=; path=/; max-age=0; SameSite=Lax";
  window.sessionStorage.removeItem(DEVELOPMENT_ONBOARDING_KEY);
}

async function withTimeout<T>(
  operation: PromiseLike<T>,
  timeoutMs: number,
  message: string,
): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve(operation),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error(message)), timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

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

function normalizeCoachingStyle(value: unknown): CoachingStyle | undefined {
  const allowed: CoachingStyle[] = ["Direct", "Tactical", "Encouraging", "Brutal"];
  if (typeof value !== "string") return undefined;
  return allowed.includes(value as CoachingStyle)
    ? (value as CoachingStyle)
    : undefined;
}

function normalizeChoice<T extends string>(value: unknown, allowed: readonly T[]): T | undefined {
  return typeof value === "string" && allowed.includes(value as T) ? (value as T) : undefined;
}

function normalizeOptionalBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function normalizeProfile(raw: unknown): FighterProfile {
  const input = (raw ?? {}) as Record<string, unknown>;

  return {
    role: normalizeChoice(input.role, ["athlete", "coach", "organization"] as const),
    name: normalizeOptionalString(input.name),
    age: normalizeOptionalString(input.age),
    height: normalizeOptionalString(input.height),
    walkAroundWeight: normalizeOptionalString(input.walkAroundWeight),
    baseArt: normalizeOptionalString(input.baseArt),
    stance: normalizeOptionalString(input.stance),
    secondaryArts: normalizeStringArray(input.secondaryArts),

    yearsTraining: normalizeOptionalString(input.yearsTraining),
    competitionLevel: normalizeOptionalString(input.competitionLevel),
    competitionStatus: normalizeOptionalString(input.competitionStatus),
    currentPhase: normalizeOptionalString(input.currentPhase),
    recentCamp: normalizeOptionalString(input.recentCamp),
    campGoal: normalizeOptionalString(input.campGoal),

    bodyType: normalizeOptionalString(input.bodyType),
    paceStyle: normalizeOptionalString(input.paceStyle),
    pressurePreference: normalizeOptionalString(input.pressurePreference),
    fighterArchetype: normalizeOptionalString(input.fighterArchetype),
    strengths: normalizeOptionalString(input.strengths),
    weaknesses: normalizeOptionalString(input.weaknesses),

    currentFocus: normalizeOptionalString(input.currentFocus),
    activeConstraints: normalizeStringArray(input.activeConstraints),
    coachingStyle: normalizeCoachingStyle(input.coachingStyle),

    currentCorrection: normalizeOptionalString(input.currentCorrection),
    currentLock: normalizeOptionalString(input.currentLock),
    completedCorrections: normalizeStringArray(input.completedCorrections),
    progressionHistory: normalizeStringArray(input.progressionHistory),

    availability: normalizeOptionalString(input.availability),
    injuryHistory: normalizeOptionalString(input.injuryHistory),
    hardBoundaries: normalizeOptionalString(input.hardBoundaries),
    lifeLoad: normalizeOptionalString(input.lifeLoad),

    gym: normalizeOptionalString(input.gym),
    trainingFrequency: normalizeOptionalString(input.trainingFrequency),
    mainPartners: normalizeStringArray(input.mainPartners),
    competitionGoals: normalizeOptionalString(input.competitionGoals),

    scheduleNotes: normalizeOptionalString(input.scheduleNotes),
    boundariesNotes: normalizeOptionalString(input.boundariesNotes),

    fightDate: normalizeOptionalString(input.fightDate),
    weightClass: normalizeOptionalString(input.weightClass),
    currentWeight: normalizeOptionalNumber(input.currentWeight),
    targetWeight: normalizeOptionalNumber(input.targetWeight),
    sleep: normalizeOptionalString(input.sleep),
    readiness: normalizeOptionalString(input.readiness),
    currentStatus: normalizeOptionalString(input.currentStatus),

    dietType: normalizeDietType(input.dietType),
    allergies: normalizeStringArray(input.allergies),
    intolerances: normalizeStringArray(input.intolerances),
    foodDislikes: normalizeStringArray(input.foodDislikes),
    favoriteFoods: normalizeStringArray(input.favoriteFoods),
    avoidFoods: normalizeStringArray(input.avoidFoods),
    religiousDietNotes: normalizeOptionalString(input.religiousDietNotes),
    coachRelationship: normalizeCoachRelationship(input.coachRelationship),
    coachName: normalizeOptionalString(input.coachName),
    correctionRecordingMethod: normalizeChoice(input.correctionRecordingMethod, ["coach_records", "athlete_records_exact_words", "review_together"] as const),
    targetSource: normalizeChoice(input.targetSource, ["athlete", "coach", "qualified_practitioner"] as const),
    nutritionSupport: normalizeChoice(input.nutritionSupport, ["qualified_practitioner", "coach_guidance", "self_guided"] as const),
    preparationPriorities: normalizeStringArray(input.preparationPriorities),
    selectedPlan: normalizeChoice(input.selectedPlan, ["trial", "standard", "pro"] as const),
    onboardingVersion: normalizeOptionalNumber(input.onboardingVersion),
    onboardingSetupCheckpoint: normalizeOptionalNumber(input.onboardingSetupCheckpoint),
    onboardingStage: normalizeOptionalString(input.onboardingStage),
    onboardingCompletedAt: normalizeOptionalString(input.onboardingCompletedAt),
    dashboardRevealPending: normalizeOptionalBoolean(input.dashboardRevealPending),
  };
}

const EMPTY_PROFILE: FighterProfile = {
  role: "athlete",
  secondaryArts: [],
  activeConstraints: [],
  completedCorrections: [],
  progressionHistory: [],
  mainPartners: [],
  allergies: [],
  intolerances: [],
  foodDislikes: [],
  favoriteFoods: [],
  avoidFoods: [],
  dietType: "none",
  coachingStyle: "Direct",
  preparationPriorities: [],
};

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const supabase = useMemo(() => getSupabaseBrowser(), []);

  const mountedRef = useRef(true);
  const activeUserIdRef = useRef<string | null>(null);

  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<FighterProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    let requestUserId: string | null = null;
    const run = (async () => {
      try {
        if (!mountedRef.current) return;

        setLoading(true);
        setError(null);

        const {
          data: { session },
          error: sessionError,
        } = await withTimeout(
          supabase.auth.getSession(),
          4_000,
          "Session request timed out.",
        );

        if (sessionError) {
          if (mountedRef.current) {
            setUser(null);
            setProfile(null);
            setError("Your session could not be restored. Check your connection and try again.");
            setLoading(false);
          }
          return;
        }

        const u = session?.user ?? null;
        requestUserId = u?.id ?? null;

        if (!mountedRef.current) return;

        if (!u) {
          const developmentProfile = developmentPreviewProfile();
          if (developmentProfile) {
            activeUserIdRef.current = null;
            setUser(null);
            setProfile(developmentProfile);
            setLoading(false);
            return;
          }
        }

        if (activeUserIdRef.current !== (u?.id ?? null)) {
          clearUserStorage(activeUserIdRef.current);
          activeUserIdRef.current = u?.id ?? null;
          clearLegacyUserStorage();
          announceIdentityChange();
          setProfile(null);
        }

        setUser(u);

        if (!u) {
          setProfile(null);
          setLoading(false);
          return;
        }

        const profileRequest = supabase
          .from("profiles")
          .select("data")
          .eq("user_id", u.id)
          .maybeSingle();
        const { data, error } = await withTimeout(
          profileRequest,
          8_000,
          "Profile request timed out.",
        );

        if (!mountedRef.current || activeUserIdRef.current !== u.id) return;

        if (error) {
          setProfile(null);
          setError("Your profile could not be loaded. Try again.");
          setLoading(false);
          return;
        }

        const nextProfile = data?.data
          ? normalizeProfile(data.data)
          : { ...EMPTY_PROFILE };

        setProfile(nextProfile);
        setError(null);
        setLoading(false);
      } catch (error) {
        if (process.env.NODE_ENV !== "production") {
          console.error("[profiles] refresh failed:", error);
        }

        if (mountedRef.current && activeUserIdRef.current === requestUserId) {
          setProfile(null);
          setError("Disciplin could not reach your profile. Check your connection and retry.");
          setLoading(false);
        }
      }
    })();

    return run;
  }, [supabase]);

  useEffect(() => {
    mountedRef.current = true;

    void refresh();

    const handleDevelopmentPreviewUpdate = () => {
      if (process.env.NODE_ENV !== "production") void refresh();
    };
    window.addEventListener(DEVELOPMENT_PREVIEW_UPDATED_EVENT, handleDevelopmentPreviewUpdate);

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mountedRef.current) return;

      const nextUser = session?.user ?? null;
      const nextUserId = nextUser?.id ?? null;
      if (event === "INITIAL_SESSION") return;

      if (nextUser && event === "SIGNED_IN") clearDevelopmentPreview();

      if (!nextUser) {
        const developmentProfile = developmentPreviewProfile();
        if (developmentProfile) {
          activeUserIdRef.current = null;
          setUser(null);
          setProfile(developmentProfile);
          setLoading(false);
          return;
        }
      }

      const identityChanged = activeUserIdRef.current !== nextUserId;
      if (identityChanged) {
        clearUserStorage(activeUserIdRef.current);
        activeUserIdRef.current = nextUserId;
        clearLegacyUserStorage();
        announceIdentityChange();
        setProfile(null);
        setLoading(true);
      }
      setUser(nextUser);

      if (!nextUser) {
        setProfile(null);
        setError(null);
        setLoading(false);
        return;
      }

      if (identityChanged || event === "USER_UPDATED") queueMicrotask(() => {
        if (mountedRef.current) {
          void refresh();
        }
      });
    });

    return () => {
      mountedRef.current = false;
      window.removeEventListener(DEVELOPMENT_PREVIEW_UPDATED_EVENT, handleDevelopmentPreviewUpdate);
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
          return {
            ok: false,
            error: "Your session could not be verified. Sign in again and retry.",
          };
        }

        const u = session?.user ?? null;

        if (!u) {
          if (developmentPreviewProfile()) {
            const normalizedDevelopmentProfile = normalizeProfile(next);
            window.sessionStorage.setItem(DEVELOPMENT_ONBOARDING_KEY, JSON.stringify(normalizedDevelopmentProfile));
            if (mountedRef.current) setProfile(normalizedDevelopmentProfile);
            return { ok: true };
          }
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
          return {
            ok: false,
            error: "Your profile could not be saved. Check your connection and retry.",
          };
        }

        if (mountedRef.current) {
          setProfile(normalizedNext);
        }

        return { ok: true };
      } catch (error) {
        console.error("[profiles] saveProfile failed:", error);
        return { ok: false, error: "We couldn’t save your profile. Try again." };
      }
    },
    [supabase]
  );

  const signOut = useCallback(async () => {
    try {
      const signingOutUserId = activeUserIdRef.current;
      clearUserStorage(signingOutUserId);
      clearLegacyUserStorage();
      clearDevelopmentPreview();
      activeUserIdRef.current = null;
      setUser(null);
      setProfile(null);
      setError(null);
      setLoading(true);
      announceIdentityChange();
      await supabase.auth.signOut();

      if (!mountedRef.current) return;

      setLoading(false);
    } catch (error) {
      console.error("[profiles] signOut failed:", error);
    }
  }, [supabase]);

  const value = useMemo<ProfileContextValue>(
    () => ({
      user,
      loading,
      error,
      profile,
      saveProfile,
      refresh,
      signOut,
    }),
    [user, loading, error, profile, saveProfile, refresh, signOut]
  );

  return (
    <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>
  );
}

export function useProfile() {
  const ctx = useContext(ProfileContext);
  if (!ctx) {
    throw new Error("useProfile must be used within ProfileProvider");
  }
  return ctx;
}
