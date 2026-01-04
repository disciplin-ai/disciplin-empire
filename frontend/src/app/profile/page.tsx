"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useProfile, FighterProfile } from "../../components/ProfileProvider";

type ChoicePillProps = {
  label: string;
  value: string;
  current: string;
  onChange: (value: string) => void;
};

function ChoicePill({ label, value, current, onChange }: ChoicePillProps) {
  const active = current === value;
  return (
    <button
      type="button"
      onClick={() => onChange(value)}
      className={[
        "px-3 py-1 rounded-full text-xs md:text-sm border transition",
        active
          ? "bg-emerald-500/10 border-emerald-400 text-emerald-200"
          : "bg-slate-950 border-slate-700 text-slate-300 hover:border-emerald-400/60 hover:text-emerald-100",
      ].join(" ")}
    >
      {label}
    </button>
  );
}

type TogglePillProps = {
  label: string;
  active: boolean;
  onToggle: () => void;
};

function TogglePill({ label, active, onToggle }: TogglePillProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={[
        "px-3 py-1 rounded-full text-xs md:text-sm border transition",
        active
          ? "bg-emerald-500/10 border-emerald-400 text-emerald-200"
          : "bg-slate-950 border-slate-700 text-slate-300 hover:border-emerald-400/60 hover:text-emerald-100",
      ].join(" ")}
    >
      {label}
    </button>
  );
}

const SECONDARY_ARTS_OPTIONS = [
  "Boxing",
  "Muay Thai",
  "Kickboxing",
  "Wrestling",
  "BJJ",
  "Judo",
  "Sambo",
];
const BASE_ART_OPTIONS = ["Wrestling", "Boxing", "Muay Thai", "Kickboxing", "BJJ", "Judo", "Sambo"];
const STANCE_OPTIONS = ["Orthodox", "Southpaw", "Switch", "Open stance"];
const BODY_TYPE_OPTIONS = ["Lean / wiry", "Athletic / balanced", "Stocky / powerful", "Tall / rangy"];
const PACE_STYLE_OPTIONS = ["Slow & calculated", "Measured / mid pace", "High pace", "Chaotic / unpredictable"];
const PRESSURE_OPTIONS = ["Back-foot / counter", "Balanced", "Forward pressure", "Smothering / non-stop"];
const STEPS = ["Identity", "Experience", "Body & Style", "Camp & Boundaries"] as const;

export default function ProfilePage() {
  const { profile, loading, saveProfile, user } = useProfile();

  const [form, setForm] = useState<FighterProfile>({});
  const [step, setStep] = useState<number>(0);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  useEffect(() => {
    if (profile) setForm(profile);
  }, [profile]);

  const handleChange = <K extends keyof FighterProfile>(field: K, value: FighterProfile[K]) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setSavedMsg(null);
    setErrMsg(null);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setSavedMsg(null);
      setErrMsg(null);

      const res = await saveProfile(form);

      if (!res.ok) {
        setErrMsg(res.error ?? "Failed to save profile.");
        return;
      }

      setSavedMsg("Saved ✓");
      setTimeout(() => setSavedMsg(null), 2500);
    } finally {
      setSaving(false);
    }
  };

  const canGoBack = step > 0;
  const isLastStep = step === STEPS.length - 1;

  const completionPct = useMemo(() => {
    // simple rough completion metric
    const keys: (keyof FighterProfile)[] = [
      "name",
      "age",
      "height",
      "walkAroundWeight",
      "baseArt",
      "stance",
      "secondaryArts",
      "yearsTraining",
      "competitionLevel",
      "bodyType",
      "paceStyle",
      "pressurePreference",
      "availability",
    ];
    let filled = 0;
    for (const k of keys) {
      const v = form[k];
      if (Array.isArray(v)) {
        if (v.length) filled++;
      } else if (typeof v === "string") {
        if (v.trim().length) filled++;
      } else if (v) {
        filled++;
      }
    }
    return Math.round((filled / keys.length) * 100);
  }, [form]);

  if (!loading && !user) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-50 px-6 py-12 md:px-16">
        <div className="max-w-3xl mx-auto rounded-3xl border border-slate-800 bg-slate-900/40 p-8">
          <p className="text-sm text-slate-200 font-semibold">You’re not logged in.</p>
          <p className="mt-2 text-xs text-slate-400">Go to the Auth page and sign in, then come back.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 px-6 py-12 md:px-16">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <p className="text-xs font-semibold tracking-[0.25em] text-emerald-400">PROFILE</p>
            <h1 className="text-3xl font-semibold text-slate-50">Camp identity</h1>
            <p className="text-sm text-slate-400 max-w-xl">
              Fill this once. Sensei + Fuel + Vision pull this automatically.
            </p>

            <div className="flex items-center gap-3 pt-2">
              <div className="h-2 w-48 rounded-full bg-slate-900 overflow-hidden border border-slate-800">
                <div
                  className="h-full bg-emerald-500/70"
                  style={{ width: `${completionPct}%` }}
                />
              </div>
              <span className="text-[11px] text-slate-400">{completionPct}% complete</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {savedMsg && (
              <span className="text-[11px] px-3 py-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 text-emerald-200">
                {savedMsg}
              </span>
            )}
            {errMsg && (
              <span className="text-[11px] px-3 py-1 rounded-full border border-red-500/40 bg-red-500/10 text-red-200">
                {errMsg}
              </span>
            )}
          </div>
        </div>

        {/* Stepper */}
        <div className="flex flex-wrap gap-3">
          {STEPS.map((label, idx) => {
            const active = idx === step;
            const complete = idx < step;
            return (
              <button
                key={label}
                type="button"
                onClick={() => setStep(idx)}
                className={[
                  "px-4 py-2 rounded-full text-sm border transition",
                  active
                    ? "bg-emerald-500 text-black border-emerald-500"
                    : complete
                    ? "bg-emerald-900/40 text-emerald-300 border-emerald-600/60"
                    : "bg-slate-950 text-slate-200 border-slate-700 hover:bg-slate-900",
                ].join(" ")}
              >
                {idx + 1}. {label}
              </button>
            );
          })}
        </div>

        {/* Body */}
        <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-6 md:p-8 space-y-8">
          {/* STEP 1 */}
          {step === 0 && (
            <div className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Name / Nickname</label>
                  <input
                    className="w-full rounded-lg bg-slate-950/60 border border-slate-700 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-500"
                    placeholder="e.g. Greg / Hybrid SBC"
                    value={form.name ?? ""}
                    onChange={(e) => handleChange("name", e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Age</label>
                  <input
                    className="w-full rounded-lg bg-slate-950/60 border border-slate-700 px-3 py-2 text-sm text-slate-50"
                    placeholder="e.g. 16"
                    value={form.age ?? ""}
                    onChange={(e) => handleChange("age", e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Height</label>
                  <input
                    className="w-full rounded-lg bg-slate-950/60 border border-slate-700 px-3 py-2 text-sm text-slate-50"
                    placeholder="e.g. 175 cm"
                    value={form.height ?? ""}
                    onChange={(e) => handleChange("height", e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Walk-around weight</label>
                  <input
                    className="w-full rounded-lg bg-slate-950/60 border border-slate-700 px-3 py-2 text-sm text-slate-50"
                    placeholder="e.g. 74 kg"
                    value={form.walkAroundWeight ?? ""}
                    onChange={(e) => handleChange("walkAroundWeight", e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-2">Base art</label>
                <div className="flex flex-wrap gap-2">
                  {BASE_ART_OPTIONS.map((art) => (
                    <ChoicePill
                      key={art}
                      label={art}
                      value={art}
                      current={form.baseArt ?? ""}
                      onChange={() => handleChange("baseArt", art)}
                    />
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-2">Stance</label>
                <div className="flex flex-wrap gap-2">
                  {STANCE_OPTIONS.map((stance) => (
                    <ChoicePill
                      key={stance}
                      label={stance}
                      value={stance}
                      current={form.stance ?? ""}
                      onChange={() => handleChange("stance", stance)}
                    />
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-2">Secondary arts</label>
                <div className="flex flex-wrap gap-2">
                  {SECONDARY_ARTS_OPTIONS.map((art) => {
                    const list = form.secondaryArts ?? [];
                    const active = list.includes(art);
                    return (
                      <TogglePill
                        key={art}
                        label={art}
                        active={active}
                        onToggle={() => {
                          const curr = form.secondaryArts ?? [];
                          const next = curr.includes(art)
                            ? curr.filter((x) => x !== art)
                            : [...curr, art];
                          handleChange("secondaryArts", next);
                        }}
                      />
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* STEP 2 */}
          {step === 1 && (
            <div className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Years training</label>
                  <input
                    className="w-full rounded-lg bg-slate-950/60 border border-slate-700 px-3 py-2 text-sm text-slate-50"
                    placeholder="e.g. 3"
                    value={form.yearsTraining ?? ""}
                    onChange={(e) => handleChange("yearsTraining", e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Competition level</label>
                  <input
                    className="w-full rounded-lg bg-slate-950/60 border border-slate-700 px-3 py-2 text-sm text-slate-50"
                    placeholder="Smokers / amateur / pro…"
                    value={form.competitionLevel ?? ""}
                    onChange={(e) => handleChange("competitionLevel", e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Recent camp / training block</label>
                <textarea
                  className="w-full min-h-[90px] rounded-lg bg-slate-950/60 border border-slate-700 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-500"
                  placeholder="Example: 3x/week MMA, 2x/week boxing, focusing cardio and chain takedowns…"
                  value={form.recentCamp ?? ""}
                  onChange={(e) => handleChange("recentCamp", e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">12-month goal</label>
                <textarea
                  className="w-full min-h-[90px] rounded-lg bg-slate-950/60 border border-slate-700 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-500"
                  placeholder="Example: win 2 smokers, build base, peak at 74–75kg, improve anti-wrestling…"
                  value={form.campGoal ?? ""}
                  onChange={(e) => handleChange("campGoal", e.target.value)}
                />
              </div>
            </div>
          )}

          {/* STEP 3 */}
          {step === 2 && (
            <div className="space-y-8">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-2">Body type</label>
                <div className="flex flex-wrap gap-2">
                  {BODY_TYPE_OPTIONS.map((bt) => (
                    <ChoicePill
                      key={bt}
                      label={bt}
                      value={bt}
                      current={form.bodyType ?? ""}
                      onChange={() => handleChange("bodyType", bt)}
                    />
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-2">Pace style</label>
                <div className="flex flex-wrap gap-2">
                  {PACE_STYLE_OPTIONS.map((ps) => (
                    <ChoicePill
                      key={ps}
                      label={ps}
                      value={ps}
                      current={form.paceStyle ?? ""}
                      onChange={() => handleChange("paceStyle", ps)}
                    />
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-2">Pressure preference</label>
                <div className="flex flex-wrap gap-2">
                  {PRESSURE_OPTIONS.map((pr) => (
                    <ChoicePill
                      key={pr}
                      label={pr}
                      value={pr}
                      current={form.pressurePreference ?? ""}
                      onChange={() => handleChange("pressurePreference", pr)}
                    />
                  ))}
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Strengths</label>
                  <textarea
                    className="w-full min-h-[90px] rounded-lg bg-slate-950/60 border border-slate-700 px-3 py-2 text-sm text-slate-50"
                    placeholder="Cardio, chain wrestling, pressure, clinch…"
                    value={form.strengths ?? ""}
                    onChange={(e) => handleChange("strengths", e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Weaknesses</label>
                  <textarea
                    className="w-full min-h-[90px] rounded-lg bg-slate-950/60 border border-slate-700 px-3 py-2 text-sm text-slate-50"
                    placeholder="Gets snapped down, posture breaks, gas management…"
                    value={form.weaknesses ?? ""}
                    onChange={(e) => handleChange("weaknesses", e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 4 */}
          {step === 3 && (
            <div className="space-y-8">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Weekly availability</label>
                <textarea
                  className="w-full min-h-[70px] rounded-lg bg-slate-950/60 border border-slate-700 px-3 py-2 text-sm text-slate-50"
                  placeholder="Days, sessions, constraints…"
                  value={form.availability ?? ""}
                  onChange={(e) => handleChange("availability", e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Injury history</label>
                <textarea
                  className="w-full min-h-[70px] rounded-lg bg-slate-950/60 border border-slate-700 px-3 py-2 text-sm text-slate-50"
                  placeholder="Knee, back, shoulder…"
                  value={form.injuryHistory ?? ""}
                  onChange={(e) => handleChange("injuryHistory", e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Hard boundaries</label>
                <textarea
                  className="w-full min-h-[70px] rounded-lg bg-slate-950/60 border border-slate-700 px-3 py-2 text-sm text-slate-50"
                  placeholder="No pivoting, no max squats, avoid heavy sparring…"
                  value={form.hardBoundaries ?? ""}
                  onChange={(e) => handleChange("hardBoundaries", e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Life load</label>
                <textarea
                  className="w-full min-h-[70px] rounded-lg bg-slate-950/60 border border-slate-700 px-3 py-2 text-sm text-slate-50"
                  placeholder="School schedule, sleep constraints, stress…"
                  value={form.lifeLoad ?? ""}
                  onChange={(e) => handleChange("lifeLoad", e.target.value)}
                />
              </div>
            </div>
          )}

          {/* Nav */}
          <div className="flex items-center justify-between pt-6 border-t border-slate-800">
            <button
              type="button"
              disabled={!canGoBack}
              onClick={() => setStep((s) => (s > 0 ? s - 1 : s))}
              className="px-4 py-2 rounded-lg border border-slate-700 text-sm text-slate-200 hover:bg-slate-900 disabled:opacity-40"
            >
              Back
            </button>

            {!isLastStep ? (
              <button
                type="button"
                onClick={() => setStep((s) => (s < STEPS.length - 1 ? s + 1 : s))}
                className="px-4 py-2 rounded-lg bg-emerald-500 text-black text-sm font-semibold hover:bg-emerald-400"
              >
                Next step
              </button>
            ) : (
              <button
                type="button"
                disabled={saving || loading}
                onClick={handleSave}
                className="px-4 py-2 rounded-lg bg-emerald-500 text-black text-sm font-semibold hover:bg-emerald-400 disabled:opacity-60"
              >
                {saving ? "Saving…" : "Save profile"}
              </button>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
