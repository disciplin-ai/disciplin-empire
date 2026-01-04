// src/components/FuelClient.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type FuelMsg = { id: string; from: "user" | "fuel"; text: string };

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
  confidence: "low" | "med" | "high";
  report: string;
  questions: string[];
  followups_id: string;
};

function uid(prefix = "m") {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function Dots() {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-300/80 animate-bounce [animation-delay:-0.2s]" />
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-300/80 animate-bounce [animation-delay:-0.1s]" />
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-300/80 animate-bounce" />
    </span>
  );
}

async function callJSON(url: string, body: any) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok && data?.ok !== false, status: res.status, data };
}

export default function FuelClient() {
  // Fighter
  const [age, setAge] = useState("");
  const [currentWeight, setCurrentWeight] = useState("");
  const [targetWeight, setTargetWeight] = useState("");
  const [bodyType, setBodyType] = useState("");
  const [paceStyle, setPaceStyle] = useState("");

  // Training
  const [session, setSession] = useState("MMA");
  const [intensity, setIntensity] = useState("Standard");
  const [goal, setGoal] = useState("Maintain");
  const [fightWeek, setFightWeek] = useState(false);

  // Meals + photo
  const [mealsText, setMealsText] = useState("");
  const [mealFile, setMealFile] = useState<File | null>(null);

  // Output
  const [report, setReport] = useState<string>("");
  const [score, setScore] = useState<number | null>(null);
  const [rating, setRating] = useState<"CLEAN" | "MID" | "TRASH" | null>(null);
  const [confidence, setConfidence] = useState<"low" | "med" | "high" | null>(null);
  const [macros, setMacros] = useState<FuelOutput["macros"] | null>(null);
  const [questions, setQuestions] = useState<string[]>([]);
  const [followupsId, setFollowupsId] = useState<string | null>(null);

  // Chat
  const [chat, setChat] = useState<FuelMsg[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [thinking, setThinking] = useState(false);

  // History
  const [history, setHistory] = useState<{ created_at: string; score: number; rating: string }[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");

  const canAnalyse = useMemo(() => mealsText.trim().length > 0, [mealsText]);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat, thinking]);

  async function refreshHistory() {
    const r = await callJSON("/api/fuel", { mode: "history", limit: 8 });
    if (r.ok) setHistory(r.data.rows ?? []);
  }

  useEffect(() => {
    refreshHistory();
  }, []);

  async function analyseTextOnly() {
    const r = await callJSON("/api/fuel", {
      mode: "analyze",
      meals: mealsText.trim(),
      fighter: { age, currentWeight, targetWeight, bodyType, paceStyle },
      training: { session, intensity, goal, fightWeek },
    });

    if (!r.ok) throw new Error(r.data?.error ?? "Fuel failed.");

    const out = r.data as FuelOutput;
    applyFuelOutput(out);
  }

  async function analyseWithPhoto() {
    if (!mealFile) return analyseTextOnly();

    const fd = new FormData();
    fd.append("image", mealFile);
    fd.append("ingredients", mealsText.trim() + (fightWeek ? "\nFight week: YES" : ""));

    const res = await fetch("/api/fuelPhoto", { method: "POST", body: fd });
    const data = await res.json().catch(() => ({}));

    if (!res.ok || data?.ok === false) {
      throw new Error(data?.error ?? `FuelPhoto HTTP ${res.status}`);
    }

    applyFuelOutput(data as FuelOutput);
  }

  function applyFuelOutput(out: FuelOutput) {
    setRating(out.rating);
    setScore(out.score);
    setConfidence(out.confidence);
    setMacros(out.macros);
    setReport(out.report);
    setQuestions(out.questions ?? []);
    setFollowupsId(out.followups_id);

    // Push Fuel questions into chat (like Sensei)
    const qText = (out.questions ?? []).map((q, i) => `${i + 1}) ${q}`).join("\n");
    if (qText.trim()) {
      setChat((prev) => [
        ...prev,
        { id: uid("fuel"), from: "fuel", text: `Questions:\n${qText}` },
      ]);
    }
  }

  async function handleAnalyse() {
    setError("");
    setLoading(true);
    try {
      if (mealFile) await analyseWithPhoto();
      else await analyseTextOnly();

      await refreshHistory();
    } catch (e: any) {
      setError(e?.message ?? "Fuel failed.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSend() {
    const msg = chatInput.trim();
    if (!msg) return;
    if (!followupsId) {
      setError("Analyse first — Fuel needs a followups thread to refine.");
      return;
    }

    setChat((prev) => [...prev, { id: uid("u"), from: "user", text: msg }]);
    setChatInput("");
    setThinking(true);
    setError("");

    try {
      // Map the user message to the last question (simple version):
      // You can improve: show question picker UI. For now, we store as "freeform".
      const r = await callJSON("/api/fuel", {
        mode: "refine",
        followups_id: followupsId,
        answers: { freeform: msg },
      });

      if (!r.ok) throw new Error(r.data?.error ?? "Refine failed.");

      const out = r.data as FuelOutput;
      applyFuelOutput(out);

      setChat((prev) => [
        ...prev,
        { id: uid("fuel"), from: "fuel", text: out.report },
      ]);

      await refreshHistory();
    } catch (e: any) {
      setError(e?.message ?? "Refine failed.");
    } finally {
      setThinking(false);
    }
  }

  function resetAll() {
    setAge("");
    setCurrentWeight("");
    setTargetWeight("");
    setBodyType("");
    setPaceStyle("");
    setSession("MMA");
    setIntensity("Standard");
    setGoal("Maintain");
    setFightWeek(false);
    setMealsText("");
    setMealFile(null);

    setReport("");
    setScore(null);
    setRating(null);
    setConfidence(null);
    setMacros(null);
    setQuestions([]);
    setFollowupsId(null);

    setChat([]);
    setChatInput("");
    setError("");
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 px-6 py-12 md:px-16">
      <div className="max-w-6xl mx-auto space-y-10">
        <section className="space-y-3">
          <div className="flex items-center gap-3">
            <span className="text-emerald-400 text-sm">⚡</span>
            <p className="text-xs font-semibold tracking-[0.25em] text-emerald-400">FUEL AI</p>
          </div>
          <h1 className="text-3xl md:text-4xl font-semibold">Precision nutrition for fighters.</h1>
          <p className="text-sm text-slate-300">Meal text is required. Photo is optional.</p>
        </section>

        <section className="grid gap-6 md:grid-cols-[minmax(0,1.15fr)_minmax(0,1.05fr)] items-start">
          {/* LEFT */}
          <div className="rounded-3xl border border-slate-800 bg-slate-900/40 p-6 md:p-8 space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="block text-xs font-medium text-slate-300">Age</label>
                <input className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none focus:border-emerald-400" value={age} onChange={(e) => setAge(e.target.value)} placeholder="e.g. 16" />
              </div>
              <div className="space-y-2">
                <label className="block text-xs font-medium text-slate-300">Current weight</label>
                <input className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none focus:border-emerald-400" value={currentWeight} onChange={(e) => setCurrentWeight(e.target.value)} placeholder="e.g. 75 kg" />
              </div>
              <div className="space-y-2">
                <label className="block text-xs font-medium text-slate-300">Target weight</label>
                <input className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none focus:border-emerald-400" value={targetWeight} onChange={(e) => setTargetWeight(e.target.value)} placeholder="e.g. 74 kg" />
              </div>
              <div className="space-y-2">
                <label className="block text-xs font-medium text-slate-300">Body type</label>
                <input className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none focus:border-emerald-400" value={bodyType} onChange={(e) => setBodyType(e.target.value)} placeholder="stocky, explosive, lanky…" />
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-medium text-slate-300">Pace style (Merab / Ilia / patient / counter)</label>
              <input className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none focus:border-emerald-400" value={paceStyle} onChange={(e) => setPaceStyle(e.target.value)} placeholder="pressure, high pace, controlled…" />
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <label className="block text-xs font-medium text-slate-300">Session</label>
                <select className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none focus:border-emerald-400" value={session} onChange={(e) => setSession(e.target.value)}>
                  <option>MMA</option><option>Wrestling</option><option>BJJ</option><option>Boxing</option><option>Strength</option><option>Rest</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="block text-xs font-medium text-slate-300">Intensity</label>
                <select className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none focus:border-emerald-400" value={intensity} onChange={(e) => setIntensity(e.target.value)}>
                  <option>Light</option><option>Standard</option><option>Hard</option><option>Fight week</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="block text-xs font-medium text-slate-300">Goal</label>
                <select className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none focus:border-emerald-400" value={goal} onChange={(e) => setGoal(e.target.value)}>
                  <option>Maintain</option><option>Cut</option><option>Lean bulk</option><option>Performance</option>
                </select>
              </div>
            </div>

            <label className="flex items-center gap-2 text-xs text-slate-300">
              <input type="checkbox" checked={fightWeek} onChange={(e) => setFightWeek(e.target.checked)} />
              Fight week mode
            </label>

            <textarea
              className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-3 py-3 text-sm outline-none focus:border-emerald-400 min-h-[160px]"
              value={mealsText}
              onChange={(e) => setMealsText(e.target.value)}
              placeholder="Write what you ate + portions + oils/sauces + cooked vs dry if possible."
            />

            <div className="space-y-2">
              <label className="block text-xs font-medium text-slate-300">Meal photo (optional)</label>
              <div className="flex items-center gap-3">
                <input type="file" accept="image/*" onChange={(e) => setMealFile(e.target.files?.[0] ?? null)} className="text-xs text-slate-300" />
                {mealFile && (
                  <button type="button" onClick={() => setMealFile(null)} className="text-xs px-3 py-1 rounded-full border border-slate-700 hover:border-slate-500 text-slate-200">
                    Remove
                  </button>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 pt-2">
              <button
                onClick={handleAnalyse}
                disabled={loading || !canAnalyse}
                className="w-full rounded-full bg-emerald-400 px-6 py-3 text-sm font-semibold text-slate-950 disabled:opacity-50"
              >
                {loading ? "Analysing…" : "Analyse"}
              </button>

              <button type="button" onClick={resetAll} className="shrink-0 rounded-full border border-slate-700 px-4 py-3 text-xs font-medium text-slate-300 hover:border-slate-500">
                Reset
              </button>
            </div>

            {error && <p className="text-xs text-red-400 mt-1">Fuel error: {error}</p>}
          </div>

          {/* RIGHT */}
          <div className="rounded-3xl border border-slate-800 bg-slate-900/40 p-6 md:p-8 flex flex-col gap-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">Fuel report</h2>
                <p className="mt-1 text-sm text-slate-300">Fuel produces: score + macro ranges + 1–3 questions.</p>
              </div>
              <span className="text-[11px] px-3 py-1 rounded-full border border-slate-700 text-slate-300">
                {loading ? "Running" : report ? "Updated" : "Idle"}
              </span>
            </div>

            <div className="flex flex-wrap gap-2 text-xs">
              <span className="px-3 py-1 rounded-full border border-slate-700">
                Score: <span className="text-slate-100">{score ?? "—"}</span>
              </span>
              <span className="px-3 py-1 rounded-full border border-slate-700">
                Rating: <span className="text-slate-100">{rating ?? "—"}</span>
              </span>
              <span className="px-3 py-1 rounded-full border border-slate-700">
                Confidence: <span className="text-slate-100">{confidence ?? "—"}</span>
              </span>
              {macros && (
                <span className="px-3 py-1 rounded-full border border-slate-700">
                  Macros: kcal {macros.calories_kcal_range[0]}–{macros.calories_kcal_range[1]} | P {macros.protein_g_range[0]}–{macros.protein_g_range[1]}g | C {macros.carbs_g_range[0]}–{macros.carbs_g_range[1]}g | F {macros.fat_g_range[0]}–{macros.fat_g_range[1]}g
                </span>
              )}
            </div>

            <div className="rounded-2xl bg-slate-950/40 border border-slate-800 px-4 py-4 overflow-auto max-h-[320px]">
              {!report ? (
                <p className="text-xs text-slate-500">Generate a report first.</p>
              ) : (
                <pre className="whitespace-pre-wrap text-xs md:text-sm text-slate-100 font-mono">{report}</pre>
              )}
            </div>

            <div className="pt-2">
              <h3 className="text-xs font-semibold tracking-[0.25em] text-slate-300">SCORE HISTORY</h3>
              <div className="mt-3 space-y-2">
                {history.length === 0 ? (
                  <p className="text-xs text-slate-500">No history yet (requires login + Supabase table).</p>
                ) : (
                  history.map((h, i) => (
                    <div key={i} className="rounded-2xl border border-slate-800 bg-slate-950/30 px-4 py-2 flex items-center justify-between">
                      <div className="text-xs text-slate-300">{new Date(h.created_at).toLocaleString()}</div>
                      <div className="text-xs text-slate-100">{h.rating} • {h.score}</div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="mt-4 border-t border-slate-800 pt-4">
              <h3 className="text-xs font-semibold tracking-[0.25em] text-slate-300">CHAT</h3>
              <p className="mt-2 text-xs text-slate-400">Answer Fuel’s questions → Fuel refines score/macros/report.</p>

              <div className="mt-3 rounded-2xl border border-slate-800 bg-slate-950/35 px-3 py-3 max-h-[240px] overflow-auto space-y-2">
                {chat.map((m) => (
                  <div
                    key={m.id}
                    className={`rounded-2xl px-3 py-2 text-xs md:text-sm ${
                      m.from === "user"
                        ? "bg-slate-800 text-slate-100 ml-auto max-w-[90%]"
                        : "bg-emerald-500/10 text-emerald-200 border border-emerald-500/30 mr-auto max-w-[90%]"
                    }`}
                  >
                    <div className="text-[10px] uppercase tracking-wide opacity-70 mb-1">{m.from === "user" ? "You" : "Fuel"}</div>
                    <div className="whitespace-pre-wrap">{m.text}</div>
                  </div>
                ))}

                {thinking && (
                  <div className="rounded-2xl px-3 py-2 text-xs md:text-sm bg-emerald-500/10 text-emerald-200 border border-emerald-500/30 mr-auto max-w-[90%]">
                    <div className="text-[10px] uppercase tracking-wide opacity-70 mb-1">Fuel</div>
                    <Dots />
                  </div>
                )}

                <div ref={chatEndRef} />
              </div>

              <div className="mt-3 space-y-2">
                <textarea
                  className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs md:text-sm outline-none focus:border-emerald-400"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder={!followupsId ? "Analyse first — Fuel will create questions." : "Answer the questions (portion sizes, oils, cooked vs dry, training time)."}
                  rows={3}
                />
                <div className="flex items-center justify-end">
                  <button
                    type="button"
                    onClick={handleSend}
                    disabled={!followupsId || thinking || !chatInput.trim()}
                    className="rounded-full bg-slate-100 text-slate-900 px-5 py-2 text-xs font-semibold disabled:opacity-40"
                  >
                    {thinking ? "Fuel…" : "Send"}
                  </button>
                </div>
              </div>
            </div>

          </div>
        </section>
      </div>
    </main>
  );
}
