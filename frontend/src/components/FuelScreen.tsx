// src/components/FuelScreen.tsx
"use client";

import { useEffect, useMemo, useState } from "react";

type FuelOutput = {
  ok: true;
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

type Err = { ok: false; error: string };

type HistoryPoint = { day: string; fuel_score: number | null };

export default function FuelScreen() {
  const [age, setAge] = useState("");
  const [currentWeight, setCurrentWeight] = useState("");
  const [targetWeight, setTargetWeight] = useState("");
  const [bodyType, setBodyType] = useState("");
  const [paceStyle, setPaceStyle] = useState("");

  const [session, setSession] = useState("MMA");
  const [intensity, setIntensity] = useState("Standard");
  const [goal, setGoal] = useState("Maintain");
  const [fightWeek, setFightWeek] = useState(false);
  const [timeOfTraining, setTimeOfTraining] = useState("");

  const [meals, setMeals] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);

  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<"Idle" | "Running" | "Complete">("Idle");
  const [error, setError] = useState("");

  const [fuel, setFuel] = useState<FuelOutput | null>(null);

  // refine
  const [answersText, setAnswersText] = useState("");
  const [refining, setRefining] = useState(false);

  // history
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const canAnalyze = useMemo(() => meals.trim().length > 0, [meals]);

  async function loadHistory() {
    setHistoryLoading(true);
    try {
      const res = await fetch("/api/fuel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "history", limit: 8 }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; points?: HistoryPoint[]; error?: string };
      if (!res.ok || data.ok === false) return;
      setHistory(Array.isArray(data.points) ? data.points : []);
    } finally {
      setHistoryLoading(false);
    }
  }

  useEffect(() => {
    loadHistory();
  }, []);

  function buildPayload() {
    return {
      fighter: { age, currentWeight, targetWeight, bodyType, paceStyle },
      training: { session, intensity, goal, fightWeek, timeOfTraining },
    };
  }

  async function analyzeText(): Promise<FuelOutput | Err> {
    const res = await fetch("/api/fuel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: "analyze",
        meals: meals.trim(),
        ...buildPayload(),
      }),
    });

    const data = (await res.json().catch(() => ({}))) as any;
    if (!res.ok || data?.ok === false) return { ok: false, error: data?.error ?? `HTTP ${res.status}` };
    return data as FuelOutput;
  }

  async function analyzePhoto(): Promise<FuelOutput | Err> {
    if (!imageFile) return { ok: false, error: "Missing image file." };

    const fd = new FormData();
    fd.append("image", imageFile);
    fd.append("ingredients", meals.trim());
    fd.append("fighter", JSON.stringify(buildPayload().fighter));
    fd.append("training", JSON.stringify(buildPayload().training));

    const res = await fetch("/api/fuelPhoto", { method: "POST", body: fd });
    const data = (await res.json().catch(() => ({}))) as any;
    if (!res.ok || data?.ok === false) return { ok: false, error: data?.error ?? `HTTP ${res.status}` };
    return data as FuelOutput;
  }

  async function onAnalyze() {
    setError("");
    setFuel(null);
    setAnswersText("");
    setStatus("Running");

    const trimmed = meals.trim();
    if (!trimmed) {
      setError("Missing meals text — write what you ate first.");
      setStatus("Idle");
      return;
    }

    setLoading(true);
    try {
      const result = imageFile ? await analyzePhoto() : await analyzeText();
      if (!result.ok) {
        setError(result.error);
        setStatus("Idle");
        return;
      }
      setFuel(result);
      setStatus("Complete");
      loadHistory();
    } catch (e: any) {
      setError(e?.message ?? "Fuel failed.");
      setStatus("Idle");
    } finally {
      setLoading(false);
    }
  }

  function parseAnswersBlock(text: string, questions: string[]) {
    // Simple: user writes numbered answers or "Q: ... A: ..."
    // We map in order if they just write lines.
    const lines = text
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

    const out: Record<string, string> = {};

    // If they wrote "1) answer", map to question 1, etc.
    const numbered = lines.filter((l) => /^\d+[\).\]]\s+/.test(l));
    if (numbered.length > 0) {
      for (let i = 0; i < Math.min(numbered.length, questions.length); i++) {
        out[questions[i]] = numbered[i].replace(/^\d+[\).\]]\s+/, "").trim();
      }
      return out;
    }

    // Otherwise map line-by-line
    for (let i = 0; i < Math.min(lines.length, questions.length); i++) {
      out[questions[i]] = lines[i];
    }
    return out;
  }

  async function onRefine() {
    if (!fuel) return;
    if (!fuel.followups_id) return;
    if (!fuel.questions || fuel.questions.length === 0) return;

    setError("");
    setRefining(true);
    try {
      const answers = parseAnswersBlock(answersText, fuel.questions);
      const res = await fetch("/api/fuel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "refine",
          followups_id: fuel.followups_id,
          answers,
        }),
      });

      const data = (await res.json().catch(() => ({}))) as any;
      if (!res.ok || data?.ok === false) {
        setError(data?.error ?? `HTTP ${res.status}`);
        return;
      }
      setFuel(data as FuelOutput);
      loadHistory();
    } catch (e: any) {
      setError(e?.message ?? "Refine failed.");
    } finally {
      setRefining(false);
    }
  }

  const scorePill =
    fuel?.rating === "CLEAN"
      ? "border-emerald-500/40 text-emerald-200 bg-emerald-500/10"
      : fuel?.rating === "MID"
      ? "border-yellow-500/40 text-yellow-200 bg-yellow-500/10"
      : "border-red-500/40 text-red-200 bg-red-500/10";

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="mb-8">
          <div className="text-xs tracking-[0.25em] text-emerald-300/80">FUEL AI</div>
          <h1 className="mt-2 text-4xl font-semibold">Precision nutrition for fighters.</h1>
          <p className="mt-3 max-w-2xl text-slate-300">
            Meal text required. Photo optional. Output: strict report + score + 1–3 questions if needed.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* LEFT */}
          <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-6">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-300">Age</label>
                <input value={age} onChange={(e) => setAge(e.target.value)} placeholder="e.g. 16"
                  className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-emerald-500/70" />
              </div>
              <div>
                <label className="text-xs text-slate-300">Current weight</label>
                <input value={currentWeight} onChange={(e) => setCurrentWeight(e.target.value)} placeholder="e.g. 75 kg"
                  className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-emerald-500/70" />
              </div>
              <div>
                <label className="text-xs text-slate-300">Target weight</label>
                <input value={targetWeight} onChange={(e) => setTargetWeight(e.target.value)} placeholder="e.g. 74 kg"
                  className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-emerald-500/70" />
              </div>
              <div>
                <label className="text-xs text-slate-300">Body type</label>
                <input value={bodyType} onChange={(e) => setBodyType(e.target.value)} placeholder="stocky, lanky..."
                  className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-emerald-500/70" />
              </div>
            </div>

            <div className="mt-3">
              <label className="text-xs text-slate-300">Pace style (Merab / Ilia / patient / counter)</label>
              <input value={paceStyle} onChange={(e) => setPaceStyle(e.target.value)} placeholder="pressure, controlled..."
                className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-emerald-500/70" />
            </div>

            <div className="mt-5 grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-slate-300">Session</label>
                <select value={session} onChange={(e) => setSession(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-emerald-500/70">
                  <option>MMA</option>
                  <option>Boxing</option>
                  <option>Lifting</option>
                  <option>Run</option>
                  <option>Rest</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-300">Intensity</label>
                <select value={intensity} onChange={(e) => setIntensity(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-emerald-500/70">
                  <option>Light</option>
                  <option>Standard</option>
                  <option>Hard</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-300">Goal</label>
                <select value={goal} onChange={(e) => setGoal(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-emerald-500/70">
                  <option>Maintain</option>
                  <option>Cut</option>
                  <option>Lean bulk</option>
                  <option>Performance</option>
                </select>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950 px-4 py-3">
              <div>
                <div className="text-sm font-semibold text-slate-200">Fight week</div>
                <div className="text-xs text-slate-400">Enables weigh-in / GI-risk logic.</div>
              </div>
              <button
                type="button"
                onClick={() => setFightWeek((v) => !v)}
                className={[
                  "h-9 w-14 rounded-full border transition",
                  fightWeek ? "border-emerald-500/50 bg-emerald-500/15" : "border-slate-700 bg-slate-950",
                ].join(" ")}
              >
                <div
                  className={[
                    "h-7 w-7 rounded-full transition",
                    fightWeek ? "translate-x-6 bg-emerald-400" : "translate-x-1 bg-slate-600",
                  ].join(" ")}
                />
              </button>
            </div>

            <div className="mt-3">
              <label className="text-xs text-slate-300">Time of training (optional)</label>
              <input value={timeOfTraining} onChange={(e) => setTimeOfTraining(e.target.value)} placeholder="AM / PM / post-sparring..."
                className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-emerald-500/70" />
            </div>

            <div className="mt-5">
              <label className="text-xs text-slate-300">Today’s meals</label>
              <textarea
                className="mt-2 h-44 w-full resize-none rounded-xl border border-slate-800 bg-slate-950 p-4 text-sm outline-none focus:border-emerald-500/70"
                placeholder="Chicken tinga bowl: shredded chicken in tomato+chipotle, onions/garlic. White rice + avocado + lime. Portions..."
                value={meals}
                onChange={(e) => setMeals(e.target.value)}
              />
            </div>

            <div className="mt-4">
              <label className="text-xs text-slate-300">Meal photo (optional)</label>
              <div className="mt-2 flex items-center gap-3">
                <input type="file" accept="image/*" onChange={(e) => setImageFile(e.target.files?.[0] || null)} className="text-xs text-slate-300" />
                {imageFile && (
                  <button type="button" onClick={() => setImageFile(null)}
                    className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-200 hover:border-emerald-400/60">
                    Remove
                  </button>
                )}
              </div>
            </div>

            <div className="mt-6 flex items-center gap-3">
              <button
                type="button"
                onClick={onAnalyze}
                disabled={!canAnalyze || loading}
                className={[
                  "h-12 flex-1 rounded-full text-sm font-semibold transition",
                  !canAnalyze || loading
                    ? "bg-emerald-500/30 text-emerald-100/50"
                    : "bg-emerald-500 text-slate-950 hover:bg-emerald-400",
                ].join(" ")}
              >
                {loading ? "Analyzing..." : "Analyse"}
              </button>

              <button
                type="button"
                onClick={() => {
                  setMeals("");
                  setImageFile(null);
                  setFuel(null);
                  setAnswersText("");
                  setError("");
                  setStatus("Idle");
                }}
                className="h-12 rounded-full border border-slate-800 px-5 text-sm text-slate-200 hover:border-emerald-400/60"
              >
                Reset
              </button>
            </div>

            {error && <div className="mt-4 text-sm text-red-300">Fuel error: {error}</div>}
          </div>

          {/* RIGHT */}
          <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold tracking-wide text-slate-200">Fuel report</h2>
              <span className="rounded-full border border-slate-800 px-3 py-1 text-xs text-slate-300">{status}</span>
            </div>

            {!fuel ? (
              <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950 p-4 text-sm text-slate-400">
                Generate a report first. Fuel will output score + macro ranges + questions if needed.
              </div>
            ) : (
              <>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className={["rounded-xl border p-4", scorePill].join(" ")}>
                    <div className="text-xs opacity-80">Score</div>
                    <div className="mt-1 text-2xl font-semibold">{Math.round(fuel.score)}</div>
                    <div className="mt-2 text-xs opacity-80">{fuel.rating} — {fuel.score_reason}</div>
                  </div>

                  <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                    <div className="text-xs text-slate-400">Macros (range) + confidence</div>
                    <div className="mt-2 text-sm text-slate-100 space-y-1">
                      <div>Calories: {fuel.macros.calories_kcal_range[0]}–{fuel.macros.calories_kcal_range[1]} ({fuel.macro_confidence.calories})</div>
                      <div>Protein: {fuel.macros.protein_g_range[0]}–{fuel.macros.protein_g_range[1]}g ({fuel.macro_confidence.protein})</div>
                      <div>Carbs: {fuel.macros.carbs_g_range[0]}–{fuel.macros.carbs_g_range[1]}g ({fuel.macro_confidence.carbs})</div>
                      <div>Fat: {fuel.macros.fat_g_range[0]}–{fuel.macros.fat_g_range[1]}g ({fuel.macro_confidence.fat})</div>
                      <div className="pt-1 text-xs text-slate-400">Overall confidence: {fuel.confidence}</div>
                    </div>
                  </div>
                </div>

                <pre className="mt-4 whitespace-pre-wrap rounded-xl border border-slate-800 bg-slate-950 p-4 text-sm text-slate-100">
                  {fuel.report}
                </pre>

                {/* QUESTIONS + REFINE */}
                <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950 p-4">
                  <div className="text-xs text-slate-400">Chat</div>

                  {fuel.questions.length === 0 ? (
                    <div className="mt-2 text-sm text-slate-300">
                      No follow-up questions needed. If you want to refine anyway, add missing details (portions, oils, sauces, training time) and re-run.
                    </div>
                  ) : (
                    <>
                      <div className="mt-2 space-y-2">
                        {fuel.questions.map((q, i) => (
                          <div key={i} className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-200">
                            <span className="text-slate-400 mr-2">Q{i + 1}.</span>{q}
                          </div>
                        ))}
                      </div>

                      <textarea
                        className="mt-3 h-28 w-full resize-none rounded-xl border border-slate-800 bg-slate-950 p-3 text-sm outline-none focus:border-emerald-500/70"
                        placeholder={`Answer like:
1) ...
2) ...
3) ...`}
                        value={answersText}
                        onChange={(e) => setAnswersText(e.target.value)}
                      />

                      <div className="mt-3 flex items-center gap-3">
                        <button
                          type="button"
                          onClick={onRefine}
                          disabled={refining || answersText.trim().length === 0}
                          className={[
                            "h-10 rounded-full px-5 text-sm font-semibold transition",
                            refining || answersText.trim().length === 0
                              ? "bg-slate-800 text-slate-400"
                              : "bg-emerald-500 text-slate-950 hover:bg-emerald-400",
                          ].join(" ")}
                        >
                          {refining ? "Refining..." : "Refine"}
                        </button>

                        <div className="text-xs text-slate-500">
                          followups_id: <span className="text-slate-300">{fuel.followups_id}</span>
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* HISTORY quick list */}
                <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950 p-4">
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-slate-400">Score history</div>
                    <button
                      type="button"
                      onClick={loadHistory}
                      className="text-xs text-slate-300 hover:text-emerald-300"
                      disabled={historyLoading}
                    >
                      {historyLoading ? "Loading..." : "Refresh"}
                    </button>
                  </div>

                  {history.length === 0 ? (
                    <div className="mt-2 text-sm text-slate-500">No history yet.</div>
                  ) : (
                    <div className="mt-2 space-y-1 text-sm">
                      {history.map((p, i) => (
                        <div key={i} className="flex items-center justify-between text-slate-200">
                          <span className="text-slate-400">{p.day}</span>
                          <span className="font-semibold">{p.fuel_score ?? "—"}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
