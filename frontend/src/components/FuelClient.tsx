"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useProfile } from "../components/ProfileProvider";
import FuelScreen, { FuelDecisionOutput } from "./FuelScreen";
import type {
  FighterInput,
  TrainingInput,
} from "../lib/fuelTypes";
import type { FuelHistoryPoint } from "../components/FuelScoreChart";

type Mode = "text" | "photo";

async function postJson<T>(url: string, body: any): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.ok) throw new Error(json?.error || `Request failed (${res.status})`);
  return json as T;
}

async function postForm<T>(url: string, fd: FormData): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    credentials: "include",
    body: fd,
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.ok) throw new Error(json?.error || `Request failed (${res.status})`);
  return json as T;
}

function deriveNextMealTarget(training: TrainingInput, goal: string) {
  const isHard = String(training.intensity || "").toLowerCase().includes("hard");
  const isFightWeek = !!training.fightWeek;

  if (isFightWeek) {
    return "Aim: low GI + low bloat. Salt controlled. Protein steady. No risky new foods.";
  }

  if (goal.toLowerCase().includes("cut")) {
    return "Aim: protein each meal. Carbs timed to training only. Fats steady, no liquid calories.";
  }

  if (goal.toLowerCase().includes("lean bulk")) {
    return isHard
      ? "Aim: protein each meal + carbs matched to training. Add 1 clean carb bump if weight stalls."
      : "Aim: protein each meal. Small carb bump. Keep fats steady; avoid over-snacking.";
  }

  return isHard
    ? "Aim: protein each meal. Carbs matched to training output. Fats steady."
    : "Aim: protein each meal. Moderate carbs. Keep fats steady and portions clean.";
}

function toOptionalString(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined;
  const str = String(value).trim();
  return str.length ? str : undefined;
}

export default function FuelClient() {
  const { user, loading: authLoading, profile } = useProfile();

  const [mode, setMode] = useState<Mode>("text");
  const [mealText, setMealText] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);

  const [session, setSession] = useState("MMA");
  const [intensity, setIntensity] = useState("Standard");
  const [purpose, setPurpose] = useState("Maintain");
  const [fightWeek, setFightWeek] = useState(false);
  const [timeOfTraining, setTimeOfTraining] = useState("");

  const [out, setOut] = useState<FuelDecisionOutput | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  const [history, setHistory] = useState<FuelHistoryPoint[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const canRun = !!user && !authLoading && !running;
  const canAnalyze = canRun && mealText.trim().length > 0 && (mode === "text" || !!photo);

  const fighter: FighterInput = useMemo(() => {
    if (!profile) return {};

    return {
      age: toOptionalString((profile as any).age),
      currentWeight: toOptionalString(
        (profile as any).currentWeight ?? (profile as any).walkAroundWeight
      ),
      targetWeight: toOptionalString((profile as any).targetWeight),
      bodyType: toOptionalString((profile as any).bodyType),
      paceStyle: toOptionalString((profile as any).paceStyle),
    };
  }, [profile]);

  const training: TrainingInput = useMemo(
    () => ({
      session,
      intensity,
      goal: purpose,
      fightWeek,
      timeOfTraining,
    }),
    [session, intensity, purpose, fightWeek, timeOfTraining]
  );

  const profileLine = useMemo(() => {
    if (!profile) return "Using Profile: not set";
    const cw = (profile as any).currentWeight || (profile as any).walkAroundWeight || "";
    const base = (profile as any).baseArt || "";
    const lvl = (profile as any).competitionLevel || "";
    const pace = (profile as any).paceStyle || "";
    const campGoal = (profile as any).campGoal || "";
    const parts = [
      cw ? `${cw}` : "",
      base,
      lvl,
      pace,
      campGoal ? `Goal: ${campGoal}` : "",
    ].filter(Boolean);
    return parts.length ? `Using Profile: ${parts.join(" · ")}` : "Using Profile";
  }, [profile]);

  const nextMealTarget = useMemo(() => deriveNextMealTarget(training, purpose), [training, purpose]);

  async function refreshHistory() {
    if (!user) return;
    try {
      setHistoryLoading(true);
      const h = await postJson<{ ok: true; points: FuelHistoryPoint[] }>("/api/fuel", {
        mode: "history",
        limit: 10,
      });
      setHistory(h.points ?? []);
    } catch {
      // ignore
    } finally {
      setHistoryLoading(false);
    }
  }

  useEffect(() => {
    if (!user) {
      setHistory([]);
      return;
    }
    refreshHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  function setModeSafe(m: Mode) {
    setMode(m);
    setError(null);
    if (m === "text") setPhoto(null);
  }

  async function analyze() {
    if (!user) {
      setError("Sign in to use Fuel.");
      return;
    }
    if (!mealText.trim()) {
      setError("Meal text is required.");
      return;
    }
    if (mode === "photo" && !photo) {
      setError("Add a meal photo or switch to Text only.");
      return;
    }

    setRunning(true);
    setError(null);

    try {
      if (mode === "photo" && photo) {
        const fd = new FormData();
        fd.append("image", photo);
        fd.append("ingredients", mealText);
        fd.append("fighter", JSON.stringify(fighter));
        fd.append("training", JSON.stringify(training));
        const resp = await postForm<FuelDecisionOutput & { ok: true }>("/api/fuelPhoto", fd);
        setOut(resp as any);
      } else {
        const resp = await postJson<FuelDecisionOutput & { ok: true }>("/api/fuel", {
          mode: "analyze",
          meals: mealText,
          fighter,
          training,
        });
        setOut(resp as any);
      }

      setAnswers({});
      await refreshHistory();
    } catch (e: any) {
      setError(e?.message ?? "Fuel failed.");
    } finally {
      setRunning(false);
    }
  }

  async function refine() {
    if (!user) {
      setError("Sign in to refine.");
      return;
    }
    if (!out?.followups_id) {
      setError("Generate a report first.");
      return;
    }
    setRunning(true);
    setError(null);

    try {
      const resp = await postJson<FuelDecisionOutput & { ok: true }>("/api/fuel", {
        mode: "refine",
        followups_id: out.followups_id,
        answers,
      });
      setOut(resp as any);
      await refreshHistory();
    } catch (e: any) {
      setError(e?.message ?? "Fuel refine failed.");
    } finally {
      setRunning(false);
    }
  }

  function reset() {
    setMealText("");
    setPhoto(null);
    setOut(null);
    setAnswers({});
    setError(null);
    setMode("text");
    setSession("MMA");
    setIntensity("Standard");
    setPurpose("Maintain");
    setFightWeek(false);
    setTimeOfTraining("");
  }

  const statusPill = running ? "Working" : out ? "Updated" : "Idle";

  return (
    <FuelScreen
      authLoading={authLoading}
      hasUser={!!user}
      profileLine={profileLine}
      purpose={purpose}
      session={session}
      timeOfTraining={timeOfTraining}
      mode={mode}
      fightWeek={fightWeek}
      nextMealTarget={nextMealTarget}
      statusPill={statusPill}
      mealText={mealText}
      setMealText={setMealText}
      photo={photo}
      setPhoto={setPhoto}
      modeValue={mode}
      setModeSafe={setModeSafe}
      sessionValue={session}
      setSession={setSession}
      intensity={intensity}
      setIntensity={setIntensity}
      purposeValue={purpose}
      setPurpose={setPurpose}
      fightWeekValue={fightWeek}
      setFightWeek={setFightWeek}
      timeOfTrainingValue={timeOfTraining}
      setTimeOfTraining={setTimeOfTraining}
      canAnalyze={canAnalyze}
      canRun={canRun}
      running={running}
      analyze={analyze}
      refine={refine}
      reset={reset}
      error={error}
      out={out}
      answers={answers}
      setAnswers={setAnswers}
      history={history}
      historyLoading={historyLoading}
      refreshHistory={refreshHistory}
    />
  );
}