// src/components/FuelClient.tsx
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
  const base = "px-2.5 py-1 rounded-full border text-[11px] tracking-wide";
  if (c === "high") return `${base} border-emerald-400/35 bg-emerald-400/10 text-emerald-100`;
  if (c === "med") return `${base} border-amber-400/30 bg-amber-400/10 text-amber-100`;
  return `${base} border-rose-400/30 bg-rose-400/10 text-rose-100`;
}

function ratingBadge(r?: FuelOutput["rating"]) {
  const base = "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold tracking-[0.18em]";
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
  confidence: "low" | "med" | "high";
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

  const toneStrip = useMemo(() => {
    // Subtle “real app” header strip that matches your emerald/deep-blue vibe
    return (
      <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#041026] via-[#030b18] to-[#020810] p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.32em] text-emerald-300">
              FUEL AI
            </p>
            <h1 className="mt-1 text-2xl font-semibold text-white">
              Precision nutrition for fighters.
            </h1>
            <p className="mt-2 text-xs text-white/60">{profileLine}</p>
          </div>

          <div className="flex flex-col items-end gap-2">
            <span className={ratingBadge(out?.rating)}>
              {out?.rating ?? "NO REPORT"}
            </span>
            <span className="text-[11px] px-3 py-1 rounded-full border border-white/10 bg-white/[0.03] text-white/70">
              {running ? "Working" : out ? "Updated" : "Idle"}
            </span>
          </div>
        </div>

        {!authLoading && !user && (
          <p className="mt-3 text-xs text-rose-200/90">
            Sign in to use Fuel.{" "}
            <a className="underline decoration-white/20 underline-offset-4" href="/auth/login">
              Login
            </a>
          </p>
        )}
      </div>
    );
  }, [authLoading, out?.rating, out, profileLine, running, user]);

  return (
    <main className="min-h-screen text-white px-6 py-10 bg-[#020810]">
      <div className="mx-auto max-w-6xl space-y-6">
        {toneStrip}

        <div className="grid gap-6 md:grid-cols-[1.1fr_1fr]">
          {/* LEFT: Inputs */}
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 space-y-5 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] tracking-[0.25em] text-white/55">INPUTS</p>
                <p className="mt-1 text-sm text-white/80">
                  Be specific. Fuel is strict.
                </p>
              </div>
              <span className="text-[11px] px-3 py-1 rounded-full border border-emerald-400/25 bg-emerald-400/10 text-emerald-100">
                Safety-first
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] text-white/60 mb-1">Session</label>
                <select
                  value={session}
                  onChange={(e) => setSession(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-emerald-400/60"
                >
                  {["MMA", "Wrestling", "Boxing", "Padwork", "Sparring", "Strength"].map((x) => (
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

              <div>
                <label className="block text-[11px] text-white/60 mb-1">Goal</label>
                <select
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-emerald-400/60"
                >
                  {["Maintain", "Lean bulk", "Cut"].map((x) => (
                    <option key={x} value={x}>
                      {x}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] text-white/60 mb-1">Training time</label>
                <input
                  value={timeOfTraining}
                  onChange={(e) => setTimeOfTraining(e.target.value)}
                  placeholder="e.g. 6pm"
                  className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-emerald-400/60"
                />
              </div>
            </div>

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

            <div>
              <label className="block text-[11px] text-white/60 mb-1">Meal text (required)</label>
              <textarea
                value={mealText}
                onChange={(e) => setMealText(e.target.value)}
                rows={6}
                placeholder='Example: "2 eggs, 1 zaatar manakish, 500ml low fat milk"'
                className="w-full rounded-2xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-emerald-400/60"
              />
              <p className="mt-2 text-[11px] text-white/45">
                Tip: list quantities. “chicken” vs “250g chicken” changes the output.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-white">Meal photo (optional)</p>
                  <p className="mt-1 text-[11px] text-white/55">
                    If you upload, Fuel cross-checks the text.
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
                  onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
                  className="text-xs text-white/70"
                />
                {photo && <p className="mt-2 text-[11px] text-white/55">Selected: {photo.name}</p>}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                disabled={!canRun}
                onClick={analyze}
                className={cn(
                  "flex-1 rounded-full py-3 text-sm font-semibold transition shadow-[0_12px_40px_rgba(16,185,129,0.18)]",
                  canRun
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
              <div className="rounded-2xl border border-rose-400/30 bg-rose-400/10 p-3 text-xs text-rose-100">
                Fuel error: <span className="font-semibold">{error}</span>
              </div>
            )}
          </div>

          {/* RIGHT: Output */}
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 space-y-5 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">Fuel report</h2>
                <p className="text-xs text-white/60">
                  Score + macro ranges + questions → refine.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className={ratingBadge(out?.rating)}>
                  {out?.rating ?? "—"}
                </span>
                <span className={out ? confPill(out.confidence) : "px-2.5 py-1 rounded-full border border-white/10 text-[11px] text-white/60"}>
                  Conf: {out?.confidence ?? "—"}
                </span>
              </div>
            </div>

            {/* Score card */}
            <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#061535] via-[#030b18] to-[#020810] p-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="text-sm font-semibold">
                  Fuel Score:{" "}
                  <span className="text-emerald-200">
                    {out ? Math.round(out.score) : "—"}
                  </span>
                  <span className="text-white/50"> / 100</span>
                </div>
                <span className="text-[11px] px-3 py-1 rounded-full border border-white/10 bg-white/[0.03] text-white/70">
                  {running ? "Working" : out ? "Updated" : "Idle"}
                </span>
              </div>
              {out?.score_reason && (
                <p className="mt-2 text-xs text-white/70">{out.score_reason}</p>
              )}
            </div>

            {/* Macros */}
            <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
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
                <p className="text-xs text-white/50">Generate a report first.</p>
              )}
            </div>

            {/* Report */}
            <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
              <p className="text-xs text-white/60 mb-2">Report</p>
              <div className="text-xs text-white/80 whitespace-pre-wrap leading-relaxed max-h-[260px] overflow-auto pr-1">
                {out?.report ?? "Generate a report first."}
              </div>
            </div>

            {/* Questions + refine */}
            <div className="rounded-2xl border border-white/10 bg-black/25 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-white/60">Questions</p>
                <span className="text-[11px] text-white/45">
                  {out?.questions?.length ? `${out.questions.length} pending` : "—"}
                </span>
              </div>

              {out?.questions?.length ? (
                <div className="space-y-3">
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
                        placeholder="Your answer…"
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
                <p className="text-xs text-white/50">No questions.</p>
              )}
            </div>

            {/* History */}
            <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
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
      </div>
    </main>
  );
}