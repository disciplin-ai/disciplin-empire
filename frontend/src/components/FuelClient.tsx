// src/components/FuelClient.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useProfile } from "../components/ProfileProvider";
import FuelScoreChart, { FuelHistoryPoint } from "../components/FuelScoreChart";
import type {
  FuelOutput,
  FighterInput,
  TrainingInput,
} from "../lib/fuelTypes";

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

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

type Conf = "low" | "med" | "high";

function confPill(c: Conf) {
  const base = "px-2.5 py-1 rounded-full border text-[11px] tracking-wide";
  if (c === "high") return `${base} border-emerald-400/35 bg-emerald-400/10 text-emerald-100`;
  if (c === "med") return `${base} border-amber-400/30 bg-amber-400/10 text-amber-100`;
  return `${base} border-rose-400/30 bg-rose-400/10 text-rose-100`;
}

function ratingBadge(r?: FuelOutput["rating"]) {
  const base =
    "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold tracking-[0.18em]";
  if (r === "CLEAN") return `${base} border-emerald-400/35 bg-emerald-400/10 text-emerald-100`;
  if (r === "MID") return `${base} border-amber-400/30 bg-amber-400/10 text-amber-100`;
  if (r === "TRASH") return `${base} border-rose-400/30 bg-rose-400/10 text-rose-100`;
  return `${base} border-white/10 bg-white/[0.03] text-white/70`;
}

function fmtRange([a, b]: [number, number]) {
  const lo = Math.round(a);
  const hi = Math.round(b);
  return `${lo}–${hi}`;
}

function MacroRow({
  label,
  value,
  confidence,
}: {
  label: string;
  value: string;
  confidence: Conf;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
      <div className="text-xs text-white/70">{label}</div>
      <div className="flex items-center gap-2">
        <div className="text-xs font-semibold text-white">{value}</div>
        <span className={confPill(confidence)}>{confidence}</span>
      </div>
    </div>
  );
}

function deriveNextMealTarget(training: TrainingInput, goal: string) {
  // Keep it simple, deterministic, and “fighter-like”.
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

  // Maintain / default
  return isHard
    ? "Aim: protein each meal. Carbs matched to training output. Fats steady."
    : "Aim: protein each meal. Moderate carbs. Keep fats steady and portions clean.";
}

export default function FuelClient() {
  const { user, loading: authLoading, profile } = useProfile();

  // Inputs
  const [mode, setMode] = useState<Mode>("text");
  const [mealText, setMealText] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);

  const [session, setSession] = useState("MMA");
  const [intensity, setIntensity] = useState("Standard");
  const [purpose, setPurpose] = useState("Maintain"); // “purpose of this meal”
  const [fightWeek, setFightWeek] = useState(false);
  const [timeOfTraining, setTimeOfTraining] = useState("");

  // Output
  const [out, setOut] = useState<FuelOutput | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  // History
  const [history, setHistory] = useState<FuelHistoryPoint[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const canRun = !!user && !authLoading && !running;
  const canAnalyze = canRun && mealText.trim().length > 0 && (mode === "text" || !!photo);

  const fighter: FighterInput = useMemo(() => {
    if (!profile) return {};
    return {
      age: (profile as any).age,
      currentWeight: (profile as any).currentWeight || (profile as any).walkAroundWeight,
      targetWeight: (profile as any).targetWeight,
      bodyType: (profile as any).bodyType,
      paceStyle: (profile as any).paceStyle,
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
    const cw = (profile as any).currentWeight || profile.walkAroundWeight || "";
    const base = profile.baseArt || "";
    const lvl = profile.competitionLevel || "";
    const pace = profile.paceStyle || "";
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
        fd.append("fighter", JSON.stringify(profile ?? {}));
        fd.append("training", JSON.stringify(training));
        const resp = await postForm<FuelOutput & { ok: true }>("/api/fuelPhoto", fd);
        setOut(resp as any);
      } else {
        const resp = await postJson<FuelOutput & { ok: true }>("/api/fuel", {
          mode: "analyze",
          meals: mealText,
          fighter: profile ?? {},
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
      const resp = await postJson<FuelOutput & { ok: true }>("/api/fuel", {
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
    <main className="min-h-screen text-white px-6 py-10 bg-[#020810]">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Top strip */}
        <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-[#05112a] via-[#030b18] to-[#020810] p-6 shadow-[0_30px_80px_rgba(0,0,0,0.45)]">
          <div className="flex items-start justify-between gap-6">
            <div>
              <p className="text-[11px] font-semibold tracking-[0.32em] text-emerald-300">
                FUEL AI
              </p>
              <h1 className="mt-1 text-3xl font-semibold text-white">
                Precision nutrition for fighters.
              </h1>
              <p className="mt-2 text-xs text-white/60">{profileLine}</p>

              <div className="mt-3 flex flex-wrap gap-2">
                <span className="text-[11px] px-3 py-1 rounded-full border border-white/10 bg-white/[0.03] text-white/70">
                  Goal: <span className="text-white">{purpose}</span>
                </span>
                <span className="text-[11px] px-3 py-1 rounded-full border border-white/10 bg-white/[0.03] text-white/70">
                  Training: <span className="text-white">{timeOfTraining ? timeOfTraining : "Not set"}</span>
                </span>
                <span className="text-[11px] px-3 py-1 rounded-full border border-white/10 bg-white/[0.03] text-white/70">
                  Session: <span className="text-white">{session}</span>
                </span>
                <span className="text-[11px] px-3 py-1 rounded-full border border-white/10 bg-white/[0.03] text-white/70">
                  Mode: <span className="text-white">{mode === "photo" ? "Text + Photo" : "Text only"}</span>
                </span>
                {fightWeek && (
                  <span className="text-[11px] px-3 py-1 rounded-full border border-amber-400/30 bg-amber-400/10 text-amber-100">
                    Fight week
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-col items-end gap-2">
              <span className={ratingBadge(out?.rating)}>{out?.rating ?? "NO REPORT"}</span>
              <span className="text-[11px] px-3 py-1 rounded-full border border-white/10 bg-white/[0.03] text-white/70">
                {statusPill}
              </span>
              <div className="mt-1 flex items-center gap-2">
                <Link
                  href="/dashboard"
                  className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-xs text-white/80 hover:border-emerald-400/30"
                >
                  Dashboard →
                </Link>
                <Link
                  href="/profile"
                  className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-xs text-white/80 hover:border-emerald-400/30"
                >
                  Profile →
                </Link>
              </div>
            </div>
          </div>

          {!authLoading && !user && (
            <p className="mt-4 text-xs text-rose-200/90">
              Sign in to use Fuel.{" "}
              <Link className="underline decoration-white/20 underline-offset-4" href="/auth/login">
                Login
              </Link>
            </p>
          )}

          {/* Next meal target */}
          <div className="mt-5 rounded-2xl border border-emerald-400/15 bg-emerald-500/10 p-4">
            <p className="text-[11px] font-semibold tracking-[0.25em] text-emerald-200">
              NEXT MEAL TARGET
            </p>
            <p className="mt-2 text-sm text-emerald-100/90">{nextMealTarget}</p>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-[1.05fr_1fr]">
          {/* LEFT: Capture */}
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 shadow-[0_20px_70px_rgba(0,0,0,0.4)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] tracking-[0.25em] text-white/55">CAPTURE</p>
                <p className="mt-1 text-sm text-white/80">
                  Log the meal like a fighter: portions, oils, sauces.
                </p>
              </div>
              <span className="text-[11px] px-3 py-1 rounded-full border border-emerald-400/25 bg-emerald-400/10 text-emerald-100">
                Safety-first
              </span>
            </div>

            {/* Mode */}
            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setModeSafe("text")}
                className={cn(
                  "rounded-2xl border p-4 text-left transition",
                  mode === "text"
                    ? "border-emerald-400/40 bg-emerald-500/10"
                    : "border-white/10 bg-white/[0.02] hover:border-emerald-400/20"
                )}
              >
                <p className={cn("text-sm font-semibold", mode === "text" && "text-emerald-200")}>
                  Text only
                </p>
                <p className="mt-1 text-xs text-white/55">
                  Fast. Best if you know portions.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setModeSafe("photo")}
                className={cn(
                  "rounded-2xl border p-4 text-left transition",
                  mode === "photo"
                    ? "border-emerald-400/40 bg-emerald-500/10"
                    : "border-white/10 bg-white/[0.02] hover:border-emerald-400/20"
                )}
              >
                <p className={cn("text-sm font-semibold", mode === "photo" && "text-emerald-200")}>
                  Text + photo
                </p>
                <p className="mt-1 text-xs text-white/55">
                  Cross-checks your text. More accurate.
                </p>
              </button>
            </div>

            {/* Context */}
            <div className="mt-5 grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] text-white/60 mb-1">Purpose of this meal</label>
                <select
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-emerald-400/60"
                >
                  {["Maintain", "Lean bulk", "Cut"].map((x) => (
                    <option key={x} value={x}>
                      {x}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-end justify-end">
                <label className="flex items-center gap-2 text-xs text-white/65">
                  <input
                    type="checkbox"
                    checked={fightWeek}
                    onChange={(e) => setFightWeek(e.target.checked)}
                    className="h-4 w-4 rounded border-white/20 bg-black/40"
                  />
                  Fight week mode
                  <span className="text-[11px] text-white/45">(stricter warnings)</span>
                </label>
              </div>

              <div>
                <label className="block text-[11px] text-white/60 mb-1">Session</label>
                <select
                  value={session}
                  onChange={(e) => setSession(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-emerald-400/60"
                >
                  {["MMA", "Wrestling", "Boxing", "Padwork", "Sparring", "Strength", "Run", "Rest"].map((x) => (
                    <option key={x} value={x}>
                      {x}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] text-white/60 mb-1">Intensity</label>
                <select
                  value={intensity}
                  onChange={(e) => setIntensity(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-emerald-400/60"
                >
                  {["Easy", "Standard", "Hard"].map((x) => (
                    <option key={x} value={x}>
                      {x}
                    </option>
                  ))}
                </select>
              </div>

              <div className="col-span-2">
                <label className="block text-[11px] text-white/60 mb-1">Training time (optional)</label>
                <input
                  value={timeOfTraining}
                  onChange={(e) => setTimeOfTraining(e.target.value)}
                  placeholder="e.g. 6pm / post-sparring / AM"
                  className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-emerald-400/60"
                />
              </div>
            </div>

            {/* Meal text */}
            <div className="mt-5">
              <label className="block text-[11px] text-white/60 mb-1">Meal text (required)</label>
              <textarea
                value={mealText}
                onChange={(e) => setMealText(e.target.value)}
                rows={7}
                placeholder='Example: "250g chicken tinga, 150g cooked rice, 40g avocado, 1 tbsp sour cream"'
                className="w-full rounded-2xl border border-white/10 bg-black/30 px-3 py-3 text-sm outline-none focus:border-emerald-400/60"
              />
              <p className="mt-2 text-[11px] text-white/45">
                Tip: include grams/tablespoons + oils/sauces. “chicken” vs “250g chicken” changes everything.
              </p>
            </div>

            {/* Photo */}
            <div className="mt-5 rounded-2xl border border-white/10 bg-black/25 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-white">Meal photo</p>
                  <p className="mt-1 text-[11px] text-white/55">
                    Optional. Switch to <span className="text-white/80 font-semibold">Text + photo</span> for cross-checking.
                  </p>
                </div>
                <span className="text-[11px] px-2.5 py-1 rounded-full border border-white/10 bg-white/[0.03] text-white/60">
                  {photo ? "Ready" : "None"}
                </span>
              </div>

              <div className="mt-3">
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  disabled={mode !== "photo"}
                  onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
                  className={cn("text-xs text-white/70", mode !== "photo" && "opacity-40")}
                />
                {photo && <p className="mt-2 text-[11px] text-white/55">Selected: {photo.name}</p>}
                {mode !== "photo" && (
                  <p className="mt-2 text-[11px] text-white/45">
                    Switch to <span className="text-white/70">Text + photo</span> to enable upload.
                  </p>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="mt-5 flex items-center gap-3">
              <button
                disabled={!canAnalyze}
                onClick={analyze}
                className={cn(
                  "flex-1 rounded-full py-3 text-sm font-semibold transition shadow-[0_18px_50px_rgba(16,185,129,0.2)]",
                  canAnalyze
                    ? "bg-emerald-400 text-[#041026] hover:bg-emerald-300"
                    : "bg-white/10 text-white/40 cursor-not-allowed"
                )}
              >
                {running ? "Analysing…" : "Analyse"}
              </button>

              <button
                type="button"
                onClick={reset}
                className="rounded-full border border-white/10 px-5 py-3 text-sm text-white/70 hover:border-white/20 hover:text-white"
              >
                Reset
              </button>
            </div>

            {error && (
              <div className="mt-4 rounded-2xl border border-rose-400/30 bg-rose-400/10 p-3 text-xs text-rose-100">
                Fuel error: <span className="font-semibold">{error}</span>
              </div>
            )}

            {/* Quiet “pro” note */}
            <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
              <p className="text-[11px] tracking-[0.25em] text-white/55">STANDARD</p>
              <p className="mt-2 text-xs text-white/70">
                Fuel always returns: <span className="text-white/90 font-semibold">Score</span>,{" "}
                <span className="text-white/90 font-semibold">Macro ranges</span>, and{" "}
                <span className="text-white/90 font-semibold">ONE fix</span>. If portions are unclear, it asks questions.
              </p>
            </div>
          </div>

          {/* RIGHT: Decision */}
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 shadow-[0_20px_70px_rgba(0,0,0,0.4)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">Fuel decision</h2>
                <p className="text-xs text-white/60">
                  Score → ONE fix → refine only if needed.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className={ratingBadge(out?.rating)}>{out?.rating ?? "—"}</span>
                <span
                  className={
                    out
                      ? confPill(out.confidence)
                      : "px-2.5 py-1 rounded-full border border-white/10 text-[11px] text-white/60"
                  }
                >
                  Conf: {out?.confidence ?? "—"}
                </span>
              </div>
            </div>

            {/* Big Score + ONE FIX */}
            <div className="mt-5 rounded-2xl border border-white/10 bg-gradient-to-br from-[#071a3b] via-[#030b18] to-[#020810] p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] tracking-[0.25em] text-white/55">FUEL SCORE</p>
                  <div className="mt-1 flex items-baseline gap-2">
                    <div className="text-4xl font-semibold text-emerald-200">
                      {out ? Math.round(out.score) : "—"}
                    </div>
                    <div className="text-sm text-white/50">/ 100</div>
                  </div>
                </div>

                <span className="text-[11px] px-3 py-1 rounded-full border border-white/10 bg-white/[0.03] text-white/70">
                  {statusPill}
                </span>
              </div>

              {/* ONE FIX = score_reason (promoted to “action”) */}
              <div className="mt-4 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-4">
                <p className="text-[11px] font-semibold tracking-[0.25em] text-emerald-200">
                  ONE FIX
                </p>
                <p className="mt-2 text-sm text-emerald-100/90">
                  {out?.score_reason?.trim()
                    ? out.score_reason
                    : "Run an analysis to get your ONE fix."}
                </p>
                {fightWeek && (
                  <p className="mt-2 text-xs text-emerald-100/70">
                    Fight week is enabled → Fuel prioritizes weigh-in + GI risk warnings.
                  </p>
                )}
              </div>
            </div>

            {/* Macro ranges */}
            <div className="mt-5 rounded-2xl border border-white/10 bg-black/25 p-4">
              <p className="text-xs text-white/60 mb-3">Macro ranges</p>
              {out ? (
                <div className="grid gap-2">
                  <MacroRow
                    label="Calories"
                    value={`${fmtRange(out.macros.calories_kcal_range)} kcal`}
                    confidence={out.macro_confidence.calories}
                  />
                  <MacroRow
                    label="Protein"
                    value={`${fmtRange(out.macros.protein_g_range)} g`}
                    confidence={out.macro_confidence.protein}
                  />
                  <MacroRow
                    label="Carbs"
                    value={`${fmtRange(out.macros.carbs_g_range)} g`}
                    confidence={out.macro_confidence.carbs}
                  />
                  <MacroRow
                    label="Fat"
                    value={`${fmtRange(out.macros.fat_g_range)} g`}
                    confidence={out.macro_confidence.fat}
                  />
                </div>
              ) : (
                <p className="text-xs text-white/50">Run an analysis to generate macro ranges.</p>
              )}
            </div>

            {/* Report */}
            <div className="mt-5 rounded-2xl border border-white/10 bg-black/25 p-4">
              <p className="text-xs text-white/60 mb-2">Report</p>
              <div className="text-xs text-white/80 whitespace-pre-wrap leading-relaxed max-h-[260px] overflow-auto pr-1">
                {out?.report ?? "Run an analysis to generate the report."}
              </div>
            </div>

            {/* Questions + refine */}
            <div className="mt-5 rounded-2xl border border-white/10 bg-black/25 p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs text-white/60">Questions</p>
                <span className="text-[11px] text-white/45">
                  {out?.questions?.length ? `${out.questions.length} pending` : "—"}
                </span>
              </div>

              {out?.questions?.length ? (
                <div className="mt-3 space-y-3">
                  {out.questions.map((q, i) => (
                    <div key={i} className="space-y-1">
                      <p className="text-xs text-emerald-200">
                        Q{i + 1}: {q}
                      </p>
                      <input
                        value={answers[String(i + 1)] ?? ""}
                        onChange={(e) =>
                          setAnswers((a) => ({ ...a, [String(i + 1)]: e.target.value }))
                        }
                        placeholder="Answer…"
                        className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs outline-none focus:border-emerald-400/60"
                      />
                    </div>
                  ))}

                  <button
                    disabled={!canRun}
                    onClick={refine}
                    className={cn(
                      "w-full rounded-full py-2.5 text-sm font-semibold transition",
                      canRun
                        ? "bg-white text-[#041026] hover:bg-white/90"
                        : "bg-white/10 text-white/40 cursor-not-allowed"
                    )}
                  >
                    Refine
                  </button>
                </div>
              ) : (
                <p className="mt-3 text-xs text-white/50">No questions.</p>
              )}
            </div>

            {/* History */}
            <div className="mt-5 rounded-2xl border border-white/10 bg-black/25 p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs text-white/60">Score history</p>
                <button
                  type="button"
                  onClick={refreshHistory}
                  disabled={historyLoading}
                  className="text-xs text-white/60 hover:text-emerald-200 disabled:opacity-40"
                >
                  {historyLoading ? "Loading…" : "Refresh"}
                </button>
              </div>

              <div className="mt-3">
                {historyLoading ? (
                  <p className="text-xs text-white/50">Loading…</p>
                ) : history.length ? (
                  <FuelScoreChart data={history} />
                ) : (
                  <p className="text-xs text-white/50">No history yet.</p>
                )}
              </div>
            </div>

            {/* Quick links */}
            <div className="mt-5 flex items-center justify-between">
              <Link className="text-xs text-white/60 underline hover:text-emerald-200" href="/sensei">
                Open Sensei →
              </Link>
              <Link className="text-xs text-white/60 underline hover:text-emerald-200" href="/dashboard">
                Back to Dashboard →
              </Link>
            </div>
          </div>
        </div>

        {/* Tiny internal debug: only shows followups id to YOU when report exists */}
        {out?.followups_id ? (
          <div className="text-[11px] text-white/35">
            followups_id: <span className="text-white/45">{out.followups_id}</span>
          </div>
        ) : null}
      </div>
    </main>
  );
}