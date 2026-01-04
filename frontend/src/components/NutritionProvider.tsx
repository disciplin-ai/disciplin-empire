"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  ReactNode,
} from "react";
import { supabaseBrowser } from "../lib/supabase/browser";

export type NutritionSettings = {
  goalType: string;       // 'cut' | 'slow_cut' | 'maintain' | 'bulk' | ...
  timeframeWeeks: number; // 4, 6, 8, etc.
  mealsPerDay: number;    // 3 / 4 / 5
  dietStyle: string;      // 'omnivore', 'vegetarian', 'no_pork', ...
  budgetLevel: string;    // 'low', 'normal', 'high'
  notes: string;          // free text
};

const defaultSettings: NutritionSettings = {
  goalType: "maintain",
  timeframeWeeks: 4,
  mealsPerDay: 3,
  dietStyle: "omnivore",
  budgetLevel: "normal",
  notes: "",
};

type NutritionContextType = {
  settings: NutritionSettings;
  loading: boolean;
  saveSettings: (updates: Partial<NutritionSettings>) => Promise<void>;
  refresh: () => Promise<void>;
};

const NutritionContext = createContext<NutritionContextType | null>(null);

export function NutritionProvider({ children }: { children: ReactNode }) {
  const supabase = useMemo(() => supabaseBrowser(), []);

  const [settings, setSettings] = useState<NutritionSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);

  // Keep a ref to the latest settings to avoid stale closures in async functions
  const settingsRef = useRef<NutritionSettings>(defaultSettings);
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  const refresh = async () => {
    try {
      setLoading(true);

      const { data: userRes, error: userErr } = await supabase.auth.getUser();
      if (userErr || !userRes?.user) {
        setSettings(defaultSettings);
        return;
      }

      const userId = userRes.user.id;

      const { data, error } = await supabase
        .from("nutrition_settings")
        .select("goal_type, timeframe_weeks, meals_per_day, diet_style, budget_level, notes")
        .eq("user_id", userId)
        .maybeSingle();

      if (error) {
        console.warn("[nutrition_settings] load error:", error.message);
        setSettings(defaultSettings);
        return;
      }

      if (!data) {
        setSettings(defaultSettings);
        return;
      }

      const loaded: NutritionSettings = {
        goalType: data.goal_type ?? "maintain",
        timeframeWeeks: data.timeframe_weeks ?? 4,
        mealsPerDay: data.meals_per_day ?? 3,
        dietStyle: data.diet_style ?? "omnivore",
        budgetLevel: data.budget_level ?? "normal",
        notes: data.notes ?? "",
      };

      setSettings(loaded);
    } catch (err) {
      console.error("[nutrition_settings] failed to load:", err);
      setSettings(defaultSettings);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();

    // Keep it in sync if user logs in/out
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      refresh();
    });

    return () => {
      sub.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveSettings = async (updates: Partial<NutritionSettings>) => {
    // Update local state immediately
    setSettings((prev) => ({ ...prev, ...updates }));

    try {
      const { data: userRes, error: userErr } = await supabase.auth.getUser();
      if (userErr || !userRes?.user) {
        console.warn("[nutrition_settings] save attempted without logged-in user");
        return;
      }

      const userId = userRes.user.id;

      // ✅ use the latest state from ref + updates
      const nextState: NutritionSettings = {
        ...settingsRef.current,
        ...updates,
      };

      const row = {
        user_id: userId,
        goal_type: nextState.goalType,
        timeframe_weeks: nextState.timeframeWeeks,
        meals_per_day: nextState.mealsPerDay,
        diet_style: nextState.dietStyle,
        budget_level: nextState.budgetLevel,
        notes: nextState.notes?.trim() ? nextState.notes.trim() : null,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from("nutrition_settings")
        .upsert(row, { onConflict: "user_id" });

      if (error) console.warn("[nutrition_settings] upsert error:", error.message);
    } catch (err) {
      console.error("[nutrition_settings] failed to save:", err);
    }
  };

  return (
    <NutritionContext.Provider value={{ settings, loading, saveSettings, refresh }}>
      {children}
    </NutritionContext.Provider>
  );
}

export function useNutritionSettings() {
  const ctx = useContext(NutritionContext);
  if (!ctx) throw new Error("useNutritionSettings must be used inside NutritionProvider");
  return ctx;
}
