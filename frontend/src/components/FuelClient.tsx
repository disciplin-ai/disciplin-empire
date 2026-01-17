"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useProfile } from "../components/ProfileProvider";
import FuelScoreChart, { FuelHistoryPoint } from "../components/FuelScoreChart";

type FuelOutput = {
  rating: "CLEAN" | "MID" | "TRASH";
  score: number;
  score_reason: string;
  macros: {
    calories_kcal_range: [number, number];
    protein_g_range: [number, number];
    carbs_g_range: [number, number];
    fat_g_range: [number, number];
  };
  macro_confidence: {
    calories: "low" | "med" | "high";
    protein: "low" | "med" | "high";
    carbs: "low" | "med" | "high";
    fat: "low" | "med" | "high";
  };
  confidence: "low" | "med" | "high";
  report: string;
  questions: string[];
  followups_id: string;
};

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

function confPill(c: "low" | "med" | "high") {
  const base = "px-2 py-1 rounded-full border text-[11px]";
  if (c === "high") return `${base} border-emerald-500/30 bg-emerald-500/10 text-emerald-200`;
  if (c === "med") return `${base} border-amber-500/30 bg-amber-500/10 text-amber-200`;
  return `${base} border-red-500/30 bg-red-500/10 text-red-200`;
}

export default function FuelClient() {
  const { user, loading: authLoading, profile } = useProfile();

  // Inputs
  const [mealText, setMealText] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);

  const [session, setSession] = useState("MMA");
  const [intensity, setIntensity] = useState("Standard");
  const [goal, setGoal] = useState("Maintain");
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

  // Profile summary line
  const profileLine = useMemo(() => {
    if (!profile) return "Using Profile: not set";
    const cw = (profile as any).currentWeight || profile.walkAroundWeight || "";
    const tw = (profile as any).targetWeight || "";
    const base = profile.baseArt || "";
    const lvl = profile.competitionLevel || "";
    const pace = profile.paceStyle || "";
    const campGoal = profile.campGoal || "";
    const parts = [
      cw && tw ? `${cw} → ${tw}` : cw ? cw : "",
      base,
      lvl,
      pace,
      campGoal ? `Goal: ${campGoal}` : "",
    ].filter(Boolean);
    return parts.length ? `Using Profile: ${parts.join(" · ")}` : "Using Profile";
  }, [profile]);

  async function refreshHistory() {
    if (!user) return;
    try {
      setHistoryLoading(true);
      const h = await postJson<{ ok: true; points: FuelHistoryPoint[] }>("/api/fuel", {
        mode: "history",
        limit: 8,
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

  async function analyze() {
    if (!user) {
      setError("Sign in to use Fuel.");
      return;
    }
    if (!mealText.trim()) {
      setError("Meal text is required.");
      return;
    }

    setRunning(true);
    setError(null);

    try {
      const training = { session, intensity, goal, fightWeek, timeOfTraining };

      if (photo) {
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
  }

  return (
    <main className="min-h-screen bg-[#020810] text-white px-6 py-10">
      <div className="mx-auto max-w-6xl grid gap-6 md:grid-cols-[1.1fr_1fr]">
        {/* LEFT */}
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 space-y-4">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.3em] text-emerald-400">FUEL AI</p>
            <h1 className="mt-1 text-2xl font-semibold">Precision nutrition for fighters.</h1>
            <p className="mt-2 text-xs text-white/60">{profileLine}</p>

            {!authLoading && !user && (
              <p className="mt-2 text-xs text-red-300">
                Sign in to use Fuel. <a className="underline" href="/auth/login">Login</a>
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] text-white/60 mb-1">Session</label>
              <select
                value={session}
                onChange={(e) => setSession(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none"
              >
                {["MMA", "Wrestling", "Boxing", "Padwork", "Sparring", "Strength"].map((x) => (
                  <option key={x} value={x}>{x}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] text-white/60 mb-1">Intensity</label>
              <select
                value={intensity}
                onChange={(e) => setIntensity(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none"
              >
                {["Easy", "Standard", "Hard"].map((x) => (
                  <option key={x} value={x}>{x}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] text-white/60 mb-1">Goal</label>
              <select
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none"
              >
                {["Maintain", "Lean bulk", "Cut"].map((x) => (
                  <option key={x} value={x}>{x}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] text-white/60 mb-1">Training time</label>
              <input
                value={timeOfTraining}
                onChange={(e) => setTimeOfTraining(e.target.value)}
                placeholder="e.g. 6pm"
                className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-xs text-white/60">
            <input type="checkbox" checked={fightWeek} onChange={(e) => setFightWeek(e.target.checked)} />
            Fight week mode
          </label>

          <div>
            <label className="block text-[11px] text-white/60 mb-1">Meal text (required)</label>
            <textarea
              value={mealText}
              onChange={(e) => setMealText(e.target.value)}
              rows={6}
              className="w-full rounded-2xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none"
            />
          </div>

          <div>
            <label className="block text-[11px] text-white/60 mb-1">Meal photo (optional)</label>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
              className="text-xs text-white/70"
            />
            {photo && <p className="mt-1 text-[11px] text-white/50">Selected: {photo.name}</p>}
          </div>

          <div className="flex items-center gap-3">
            <button
              disabled={!canRun}
              onClick={analyze}
              className={cn(
                "flex-1 rounded-full py-3 text-sm font-semibold transition",
                canRun ? "bg-emerald-400 text-black hover:bg-emerald-300" : "bg-white/10 text-white/40 cursor-not-allowed"
              )}
            >
              {running ? "Analysing…" : "Analyse"}
            </button>

            <button
              type="button"
              onClick={reset}
              className="rounded-full border border-white/10 px-5 py-3 text-sm text-white/70 hover:border-white/20"
            >
              Reset
            </button>
          </div>

          {error && <p className="text-xs text-red-300">Fuel error: {error}</p>}
        </div>

        {/* RIGHT */}
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Fuel report</h2>
              <p className="text-xs text-white/60">Score + macro ranges + questions → refine.</p>
            </div>
            <span className="text-[11px] px-3 py-1 rounded-full border border-white/10 text-white/70">
              {running ? "Working" : out ? "Updated" : "Idle"}
            </span>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
            <div className="flex flex-wrap gap-2 items-center">
              <span className="text-sm font-semibold">Score: {out ? Math.round(out.score) : "—"}</span>
              <span className={out ? confPill(out.confidence) : "px-2 py-1 rounded-full border border-white/10 text-[11px] text-white/60"}>
                Confidence: {out?.confidence ?? "—"}
              </span>
            </div>
            {out?.score_reason && <p className="mt-2 text-xs text-white/70">{out.score_reason}</p>}
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
            <p className="text-xs text-white/60 mb-2">Report</p>
            <div className="text-xs text-white/80 whitespace-pre-wrap leading-relaxed max-h-[260px] overflow-auto">
              {out?.report ?? "Generate a report first."}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/30 p-4 space-y-3">
            <p className="text-xs text-white/60">Questions</p>

            {out?.questions?.length ? (
              <div className="space-y-3">
                {out.questions.map((q, i) => (
                  <div key={i} className="space-y-1">
                    <p className="text-xs text-emerald-200">Q{i + 1}: {q}</p>
                    <input
                      value={answers[String(i + 1)] ?? ""}
                      onChange={(e) => setAnswers((a) => ({ ...a, [String(i + 1)]: e.target.value }))}
                      placeholder="Your answer…"
                      className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs outline-none"
                    />
                  </div>
                ))}

                <button
                  disabled={!canRun}
                  onClick={refine}
                  className={cn(
                    "w-full rounded-full py-2 text-sm font-semibold transition",
                    canRun ? "bg-white text-black hover:bg-white/90" : "bg-white/10 text-white/40 cursor-not-allowed"
                  )}
                >
                  Refine
                </button>
              </div>
            ) : (
              <p className="text-xs text-white/50">No questions.</p>
            )}
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
            <p className="text-xs text-white/60 mb-2">Score history</p>
            {historyLoading ? (
              <p className="text-xs text-white/50">Loading…</p>
            ) : history.length ? (
              <FuelScoreChart data={history} />
            ) : (
              <p className="text-xs text-white/50">No history yet.</p>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
