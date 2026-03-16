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
import { getSupabaseBrowser } from "../lib/supabase/browser";

export type NutritionSettings = {
  goalType: string;
  timeframeWeeks: number;
  mealsPerDay: number;
  dietStyle: string;
  budgetLevel: string;
  notes: string;
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
  const supabase = useMemo(() => getSupabaseBrowser(), []);

  const [settings, setSettings] = useState<NutritionSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);

  const settingsRef = useRef<NutritionSettings>(defaultSettings);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  const refresh = async () => {
    try {
      setLoading(true);

      const {
        data: { user },
        error: userErr,
      } = await supabase.auth.getUser();

      if (userErr || !user) {
        setSettings(defaultSettings);
        return;
      }

      const { data, error } = await supabase
        .from("nutrition_settings")
        .select(
          "goal_type, timeframe_weeks, meals_per_day, diet_style, budget_level, notes"
        )
        .eq("user_id", user.id)
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
    void refresh();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void refresh();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase]);

  const saveSettings = async (updates: Partial<NutritionSettings>) => {
    setSettings((prev) => ({ ...prev, ...updates }));

    try {
      const {
        data: { user },
        error: userErr,
      } = await supabase.auth.getUser();

      if (userErr || !user) {
        console.warn("[nutrition_settings] save attempted without logged-in user");
        return;
      }

      const nextState: NutritionSettings = {
        ...settingsRef.current,
        ...updates,
      };

      const row = {
        user_id: user.id,
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

      if (error) {
        console.warn("[nutrition_settings] upsert error:", error.message);
      }
    } catch (err) {
      console.error("[nutrition_settings] failed to save:", err);
    }
  };

  return (
    <NutritionContext.Provider
      value={{ settings, loading, saveSettings, refresh }}
    >
      {children}
    </NutritionContext.Provider>
  );
}

export function useNutritionSettings() {
  const ctx = useContext(NutritionContext);
  if (!ctx) {
    throw new Error("useNutritionSettings must be used inside NutritionProvider");
  }
  return ctx;
}