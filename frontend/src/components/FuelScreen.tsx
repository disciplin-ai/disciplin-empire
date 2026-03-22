"use client";

import React from "react";
import Link from "next/link";
import FuelScoreChart, { FuelHistoryPoint } from "../components/FuelScoreChart";
import type { FuelOutput } from "../lib/fuelTypes";

type Mode = "text" | "photo";
type Conf = "low" | "med" | "high";

type FuelDecisionLayer = {
  assessment: string;
  impact: string;
  decision: string;
  next_steps: string[];
};

export type FuelDecisionOutput = FuelOutput & FuelDecisionLayer;

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

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

function compactSentence(text?: string, max = 220) {
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  if (!clean) return "Not generated yet.";
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1).trim()}…`;
}

type FuelScreenProps = {
  authLoading: boolean;
  hasUser: boolean;
  profileLine: string;
  purpose: string;
  session: string;
  timeOfTraining: string;
  mode: Mode;
  fightWeek: boolean;
  nextMealTarget: string;
  statusPill: string;

  mealText: string;
  setMealText: (v: string) => void;

  photo: File | null;
  setPhoto: (f: File | null) => void;

  modeValue: Mode;
  setModeSafe: (m: Mode) => void;

  sessionValue: string;
  setSession: (v: string) => void;

  intensity: string;
  setIntensity: (v: string) => void;

  purposeValue: string;
  setPurpose: (v: string) => void;

  fightWeekValue: boolean;
  setFightWeek: (v: boolean) => void;

  timeOfTrainingValue: string;
  setTimeOfTraining: (v: string) => void;

  canAnalyze: boolean;
  canRun: boolean;
  running: boolean;
  analyze: () => void;
  refine: () => void;
  reset: () => void;

  error: string | null;

  out: FuelDecisionOutput | null;
  answers: Record<string, string>;
  setAnswers: React.Dispatch<React.SetStateAction<Record<string, string>>>;

  history: FuelHistoryPoint[];
  historyLoading: boolean;
  refreshHistory: () => void;
};

export default function FuelScreen({
  authLoading,
  hasUser,
  profileLine,
  purpose,
  session,
  timeOfTraining,
  mode,
  fightWeek,
  nextMealTarget,
  statusPill,
  mealText,
  setMealText,
  photo,
  setPhoto,
  modeValue,
  setModeSafe,
  sessionValue,
  setSession,
  intensity,
  setIntensity,
  purposeValue,
  setPurpose,
  fightWeekValue,
  setFightWeek,
  timeOfTrainingValue,
  setTimeOfTraining,
  canAnalyze,
  canRun,
  running,
  analyze,
  refine,
  reset,
  error,
  out,
  answers,
  setAnswers,
  history,
  historyLoading,
  refreshHistory,
}: FuelScreenProps) {
  return (
    <main className="min-h-screen bg-[#020810] px-6 py-10 text-white">
      <div className="mx-auto max-w-6xl space-y-6">
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
                <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[11px] text-white/70">
                  Goal: <span className="text-white">{purpose}</span>
                </span>
                <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[11px] text-white/70">
                  Training: <span className="text-white">{timeOfTraining ? timeOfTraining : "Not set"}</span>
                </span>
                <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[11px] text-white/70">
                  Session: <span className="text-white">{session}</span>
                </span>
                <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[11px] text-white/70">
                  Mode: <span className="text-white">{mode === "photo" ? "Text + Photo" : "Text only"}</span>
                </span>
                {fightWeek && (
                  <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-[11px] text-amber-100">
                    Fight week
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-col items-end gap-2">
              <span className={ratingBadge(out?.rating)}>{out?.rating ?? "NO REPORT"}</span>
              <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[11px] text-white/70">
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

          {!authLoading && !hasUser && (
            <p className="mt-4 text-xs text-rose-200/90">
              Sign in to use Fuel.{" "}
              <Link className="underline decoration-white/20 underline-offset-4" href="/auth/login">
                Login
              </Link>
            </p>
          )}

          <div className="mt-5 rounded-2xl border border-emerald-400/15 bg-emerald-500/10 p-4">
            <p className="text-[11px] font-semibold tracking-[0.25em] text-emerald-200">
              NEXT MEAL TARGET
            </p>
            <p className="mt-2 text-sm text-emerald-100/90">{nextMealTarget}</p>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-[1.05fr_1fr]">
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 shadow-[0_20px_70px_rgba(0,0,0,0.4)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] tracking-[0.25em] text-white/55">CAPTURE</p>
                <p className="mt-1 text-sm text-white/80">
                  Log the meal like a fighter: portions, oils, sauces.
                </p>
              </div>
              <span className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1 text-[11px] text-emerald-100">
                Safety-first
              </span>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setModeSafe("text")}
                className={cn(
                  "rounded-2xl border p-4 text-left transition",
                  modeValue === "text"
                    ? "border-emerald-400/40 bg-emerald-500/10"
                    : "border-white/10 bg-white/[0.02] hover:border-emerald-400/20"
                )}
              >
                <p className={cn("text-sm font-semibold", modeValue === "text" && "text-emerald-200")}>
                  Text only
                </p>
                <p className="mt-1 text-xs text-white/55">Fast. Best if you know portions.</p>
              </button>

              <button
                type="button"
                onClick={() => setModeSafe("photo")}
                className={cn(
                  "rounded-2xl border p-4 text-left transition",
                  modeValue === "photo"
                    ? "border-emerald-400/40 bg-emerald-500/10"
                    : "border-white/10 bg-white/[0.02] hover:border-emerald-400/20"
                )}
              >
                <p className={cn("text-sm font-semibold", modeValue === "photo" && "text-emerald-200")}>
                  Text + photo
                </p>
                <p className="mt-1 text-xs text-white/55">Cross-checks your text. More accurate.</p>
              </button>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-[11px] text-white/60">Purpose of this meal</label>
                <select
                  value={purposeValue}
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
                    checked={fightWeekValue}
                    onChange={(e) => setFightWeek(e.target.checked)}
                    className="h-4 w-4 rounded border-white/20 bg-black/40"
                  />
                  Fight week mode
                  <span className="text-[11px] text-white/45">(stricter warnings)</span>
                </label>
              </div>

              <div>
                <label className="mb-1 block text-[11px] text-white/60">Session</label>
                <select
                  value={sessionValue}
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
                <label className="mb-1 block text-[11px] text-white/60">Intensity</label>
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
                <label className="mb-1 block text-[11px] text-white/60">Training time (optional)</label>
                <input
                  value={timeOfTrainingValue}
                  onChange={(e) => setTimeOfTraining(e.target.value)}
                  placeholder="e.g. 6pm / post-sparring / AM"
                  className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-emerald-400/60"
                />
              </div>
            </div>

            <div className="mt-5">
              <label className="mb-1 block text-[11px] text-white/60">Meal text (required)</label>
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

            <div className="mt-5 rounded-2xl border border-white/10 bg-black/25 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-white">Meal photo</p>
                  <p className="mt-1 text-[11px] text-white/55">
                    Optional. Switch to <span className="font-semibold text-white/80">Text + photo</span> for cross-checking.
                  </p>
                </div>
                <span className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] text-white/60">
                  {photo ? "Ready" : "None"}
                </span>
              </div>

              <div className="mt-3">
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  disabled={modeValue !== "photo"}
                  onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
                  className={cn("text-xs text-white/70", modeValue !== "photo" && "opacity-40")}
                />
                {photo && <p className="mt-2 text-[11px] text-white/55">Selected: {photo.name}</p>}
                {modeValue !== "photo" && (
                  <p className="mt-2 text-[11px] text-white/45">
                    Switch to <span className="text-white/70">Text + photo</span> to enable upload.
                  </p>
                )}
              </div>
            </div>

            <div className="mt-5 flex items-center gap-3">
              <button
                disabled={!canAnalyze}
                onClick={analyze}
                className={cn(
                  "flex-1 rounded-full py-3 text-sm font-semibold transition shadow-[0_18px_50px_rgba(16,185,129,0.2)]",
                  canAnalyze
                    ? "bg-emerald-400 text-[#041026] hover:bg-emerald-300"
                    : "cursor-not-allowed bg-white/10 text-white/40"
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

            <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
              <p className="text-[11px] tracking-[0.25em] text-white/55">STANDARD</p>
              <p className="mt-2 text-xs text-white/70">
                Fuel returns: <span className="font-semibold text-white/90">Score</span>,{" "}
                <span className="font-semibold text-white/90">Macro ranges</span>,{" "}
                <span className="font-semibold text-white/90">ONE decision</span>, and{" "}
                <span className="font-semibold text-white/90">3 next steps</span>.
              </p>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 shadow-[0_20px_70px_rgba(0,0,0,0.4)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">Fuel decision</h2>
                <p className="text-xs text-white/60">Score → decision → 3 actions.</p>
              </div>

              <div className="flex items-center gap-2">
                <span className={ratingBadge(out?.rating)}>{out?.rating ?? "—"}</span>
                <span
                  className={
                    out
                      ? confPill(out.confidence)
                      : "rounded-full border border-white/10 px-2.5 py-1 text-[11px] text-white/60"
                  }
                >
                  Conf: {out?.confidence ?? "—"}
                </span>
              </div>
            </div>

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

                <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[11px] text-white/70">
                  {statusPill}
                </span>
              </div>

              <div className="mt-4 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-4">
                <p className="text-[11px] font-semibold tracking-[0.25em] text-emerald-200">
                  DECISION
                </p>
                <p className="mt-2 text-sm text-emerald-100/90">
                  {out?.decision?.trim()
                    ? out.decision
                    : "Run an analysis to get a nutrition decision."}
                </p>
                {fightWeek && (
                  <p className="mt-2 text-xs text-emerald-100/70">
                    Fight week is enabled → Fuel prioritizes weigh-in + GI risk warnings.
                  </p>
                )}
              </div>
            </div>

            <div className="mt-5 grid gap-3">
              <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                <p className="text-[11px] tracking-[0.22em] text-white/55">ASSESSMENT</p>
                <p className="mt-2 text-sm text-white/85">{compactSentence(out?.assessment, 240)}</p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                <p className="text-[11px] tracking-[0.22em] text-white/55">IMPACT</p>
                <p className="mt-2 text-sm leading-7 text-white/85">{compactSentence(out?.impact, 320)}</p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                <p className="text-[11px] tracking-[0.22em] text-white/55">NEXT STEPS</p>
                {out?.next_steps?.length ? (
                  <ul className="mt-2 space-y-2 text-sm text-white/85">
                    {out.next_steps.map((step, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-300/80" />
                        <span>{step}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-sm text-white/50">No next steps yet.</p>
                )}
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-white/10 bg-black/25 p-4">
              <p className="mb-3 text-xs text-white/60">Macro ranges</p>
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

            <div className="mt-5 rounded-2xl border border-white/10 bg-black/25 p-4">
              <p className="mb-2 text-xs text-white/60">Report</p>
              <div className="max-h-[260px] overflow-auto pr-1 text-xs leading-relaxed whitespace-pre-wrap text-white/80">
                {out?.report ?? "Run an analysis to generate the report."}
              </div>
            </div>

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
                        : "cursor-not-allowed bg-white/10 text-white/40"
                    )}
                  >
                    Refine
                  </button>
                </div>
              ) : (
                <p className="mt-3 text-xs text-white/50">No questions.</p>
              )}
            </div>

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

        {out?.followups_id ? (
          <div className="text-[11px] text-white/35">
            followups_id: <span className="text-white/45">{out.followups_id}</span>
          </div>
        ) : null}
      </div>
    </main>
  );
}