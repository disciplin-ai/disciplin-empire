"use client";

import { useEffect, useMemo, useState } from "react";
import { useProfile } from "../../components/ProfileProvider";
import SenseiCards from "../../components/SenseiCards";
import type { SenseiResponse } from "../../lib/senseiTypes";

const SENSEI_STORAGE_KEY = "disciplin_sensei_last_camp_v5";

type SenseiSavedState = {
  style: string;
  favourites: string;
  week: string;
  weightGoal: string;
  scenario: string;
  lastResponse?: SenseiResponse | null;
};

type SenseiRequest =
  | { mode: "plan"; week: string; context: string }
  | { mode: "refine"; week: string; context: string; followups_id: string; answers: Record<string, string> };

async function callSensei(payload: SenseiRequest): Promise<SenseiResponse> {
  const res = await fetch("/api/sensei", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include", // ✅ fixes Not authenticated
    body: JSON.stringify(payload),
  });

  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.ok) {
    throw new Error(json?.error || `Sensei failed (${res.status})`);
  }

  return json as SenseiResponse; // { ok:true, followups_id, sections }
}

export default function SenseiPage() {
  const { user, loading: authLoading } = useProfile();

  const [style, setStyle] = useState("pressure wrestler, southpaw striker");
  const [favourites, setFavourites] = useState("Merab, Ilia, Khabib, Leon");
  const [week, setWeek] = useState("Week 1");
  const [weightGoal, setWeightGoal] = useState("");
  const [scenario, setScenario] = useState("");

  const [senseiData, setSenseiData] = useState<SenseiResponse | null>(null);
  const [answersText, setAnswersText] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(SENSEI_STORAGE_KEY);
      if (!raw) return;
      const saved: SenseiSavedState = JSON.parse(raw);

      setStyle(saved.style ?? style);
      setFavourites(saved.favourites ?? favourites);
      setWeek(saved.week ?? "Week 1");
      setWeightGoal(saved.weightGoal ?? "");
      setScenario(saved.scenario ?? "");
      setSenseiData(saved.lastResponse ?? null);
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const toSave: SenseiSavedState = {
      style,
      favourites,
      week,
      weightGoal,
      scenario,
      lastResponse: senseiData,
    };
    try {
      window.localStorage.setItem(SENSEI_STORAGE_KEY, JSON.stringify(toSave));
    } catch {}
  }, [style, favourites, week, weightGoal, scenario, senseiData]);

  const context = useMemo(() => {
    return [
      `Style: ${style}`,
      `Closest fighters: ${favourites}`,
      `Week label: ${week}`,
      `Weight goal: ${weightGoal || "(not provided)"}`,
      `Scenario: ${scenario || "(not provided)"}`,
    ].join("\n");
  }, [style, favourites, week, weightGoal, scenario]);

  const canRun = !!user && !authLoading && !loading;

  async function handleGenerate() {
    if (!user) {
      setError("Sign in to use Sensei.");
      return;
    }
    if (!scenario.trim()) {
      setError("Add a scenario/problem so Sensei can plan properly.");
      return;
    }

    setLoading(true);
    setError(null);
    setNotice(null);

    try {
      const resp = await callSensei({ mode: "plan", week, context });
      setSenseiData(resp);
      setAnswersText("");
      setNotice("Camp generated. Use Questions → answer → refine.");
    } catch (e: any) {
      setError(e?.message ?? "Sensei failed.");
    } finally {
      setLoading(false);
    }
  }

  async function handleRefine() {
    if (!user) {
      setError("Sign in to refine.");
      return;
    }
    if (!senseiData) {
      setError("Generate a camp first.");
      return;
    }

    const lines = answersText.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) {
      setError("Add at least one answer line before refining.");
      return;
    }

    const answers: Record<string, string> = {};
    lines.forEach((line, i) => (answers[String(i + 1)] = line));

    setLoading(true);
    setError(null);
    setNotice(null);

    try {
      const resp = await callSensei({
        mode: "refine",
        week,
        context,
        followups_id: senseiData.followups_id,
        answers,
      });
      setSenseiData(resp);
      setNotice("Refined. Review the updated cards.");
    } catch (e: any) {
      setError(e?.message ?? "Sensei refine failed.");
    } finally {
      setLoading(false);
    }
  }

  function handleReset() {
    setSenseiData(null);
    setAnswersText("");
    setError(null);
    setNotice(null);
    if (typeof window !== "undefined") window.localStorage.removeItem(SENSEI_STORAGE_KEY);
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 px-6 py-12 md:px-16">
      <div className="max-w-6xl mx-auto space-y-10">
        <section className="space-y-3">
          <p className="text-xs font-semibold tracking-[0.25em] text-emerald-400">SENSEI AI</p>
          <h1 className="text-3xl md:text-4xl font-semibold">
            Overview → Training → Nutrition → Recovery → Questions
          </h1>
          <p className="text-sm md:text-base text-slate-300 max-w-2xl">
            Same detail, cleaner structure. Each section is carded and subtopics are highlighted.
          </p>
        </section>

        {!authLoading && !user && (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
            You must be signed in to use Sensei.{" "}
            <a href="/auth/login" className="underline">Go to login</a>
          </div>
        )}

        <section className="grid gap-6 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1.1fr)] items-start">
          {/* LEFT: inputs */}
          <div className="rounded-3xl border border-slate-800 bg-slate-900/40 p-6 md:p-8 space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Your style" value={style} onChange={setStyle} />
              <Field label="Closest fighters" value={favourites} onChange={setFavourites} />
              <Field label="Week label" value={week} onChange={setWeek} placeholder="Week 1 / Week 2 / Fight Week" />
              <Field label="Weight goal" value={weightGoal} onChange={setWeightGoal} placeholder="cut/bulk/maintain" />
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-medium text-slate-300">Scenario / problem</label>
              <textarea
                className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none focus:border-emerald-400 min-h-[140px]"
                value={scenario}
                onChange={(e) => setScenario(e.target.value)}
                placeholder="Injuries, schedule, goals, constraints."
              />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={handleGenerate}
                disabled={!canRun}
                className="rounded-full bg-emerald-400 px-6 py-2 text-sm font-semibold text-slate-950 disabled:opacity-60"
              >
                {loading ? "Generating…" : "Generate camp"}
              </button>

              <button
                type="button"
                onClick={handleRefine}
                disabled={!canRun || !senseiData}
                className="rounded-full border border-slate-600 px-4 py-2 text-xs font-medium text-slate-200 hover:border-slate-400 disabled:opacity-40"
              >
                Refine
              </button>

              <button
                type="button"
                onClick={handleReset}
                className="rounded-full border border-slate-700 px-4 py-2 text-xs font-medium text-slate-300 hover:border-slate-400"
              >
                Reset
              </button>
            </div>

            {error && <p className="text-xs text-red-400">Sensei error: {error}</p>}
            {!error && notice && <p className="text-xs text-emerald-300">{notice}</p>}
          </div>

          {/* RIGHT: carded output + refine answers */}
          <div className="rounded-3xl border border-slate-800 bg-slate-900/40 p-6 md:p-8 space-y-4">
            <h2 className="text-xs font-semibold tracking-[0.18em] text-slate-300">CAMP CARDS</h2>

            {senseiData ? (
              <>
                <SenseiCards data={senseiData} />

                <div className="pt-2">
                  <label className="block text-xs font-medium text-slate-300">
                    Answer Questions (one line per answer), then refine
                  </label>
                  <textarea
                    className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs md:text-sm outline-none focus:border-emerald-400"
                    value={answersText}
                    onChange={(e) => setAnswersText(e.target.value)}
                    rows={3}
                    placeholder="1) I did 2 sessions above 8/10 intensity&#10;2) Sleep averaged 6.5h"
                  />
                </div>
              </>
            ) : (
              <p className="text-sm text-slate-400">
                Generate a camp to see the 5 highlighted sections.
              </p>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="space-y-2">
      <label className="block text-xs font-medium text-slate-300">{label}</label>
      <input
        className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none focus:border-emerald-400"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}
