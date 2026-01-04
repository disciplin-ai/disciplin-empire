// src/hooks/useSenseiPlan.ts
"use client";

import { useState } from "react";
import { useProfile } from "../components/ProfileProvider";
import type {
  SenseiPlan,
  SenseiPlanRequest,
  SenseiContext,
} from "../types/sensei";

export function useSenseiPlan() {
  const { profile } = useProfile(); // ← your saved fighter profile
  const [plan, setPlan] = useState<SenseiPlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * You only pass the session context (goal, daysToNextFight, etc.).
   * This hook automatically injects the stored profile,
   * so Sensei sees the full fighter picture without you retyping anything.
   */
  const askSensei = async (context: SenseiContext) => {
    if (!profile) {
      setError("No profile found. Complete your fighter profile first.");
      return null;
    }

    const payload: SenseiPlanRequest = {
      profile, // full fighter profile from context
      context,
    };

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/sensei/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Sensei failed with status ${res.status}`);
      }

      const data = (await res.json()) as SenseiPlan;
      setPlan(data);
      return data;
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Unknown error talking to Sensei.";
      setError(msg);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const resetPlan = () => {
    setPlan(null);
    setError(null);
  };

  return {
    plan,
    loading,
    error,
    askSensei,
    resetPlan,
  };
}
