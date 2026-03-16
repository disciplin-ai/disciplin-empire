"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useProfile, type DietType, type FighterProfile } from "./ProfileProvider";

type StepKey = "identity" | "experience" | "body" | "camp" | "nutrition";

const STEP_ORDER: StepKey[] = [
  "identity",
  "experience",
  "body",
  "camp",
  "nutrition",
];

const STEP_LABELS: Record<StepKey, string> = {
  identity: "1. Identity",
  experience: "2. Experience",
  body: "3. Body & Style",
  camp: "4. Camp & Boundaries",
  nutrition: "5. Nutrition",
};

const BASE_ART_OPTIONS = [
  "MMA",
  "Boxing",
  "Muay Thai",
  "Kickboxing",
  "Wrestling",
  "BJJ",
  "Judo",
  "Sambo",
];

const STANCE_OPTIONS = ["Orthodox", "Southpaw", "Switch", "Open stance"];

const SECONDARY_ART_OPTIONS = [
  "Boxing",
  "Muay Thai",
  "Kickboxing",
  "Wrestling",
  "BJJ",
  "Judo",
  "Sambo",
];

const COMPETITION_LEVEL_OPTIONS = [
  "Beginner",
  "Novice",
  "Amateur",
  "Semi-Pro",
  "Pro",
];

const DIET_OPTIONS: Array<{ value: DietType; label: string }> = [
  { value: "none", label: "No specific diet" },
  { value: "halal", label: "Halal" },
  { value: "kosher", label: "Kosher" },
  { value: "vegan", label: "Vegan" },
  { value: "vegetarian", label: "Vegetarian" },
  { value: "pescatarian", label: "Pescatarian" },
  { value: "keto", label: "Keto" },
];

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function parseLines(value: string): string[] {
  return value
    .split("\n")
    .map((v) => v.trim())
    .filter(Boolean);
}

function linesFromArray(value?: string[]) {
  return Array.isArray(value) ? value.join("\n") : "";
}

function textValue(value: string | number | undefined | null) {
  if (typeof value === "number") return String(value);
  return value ?? "";
}

function ChoicePills({
  options,
  value,
  onChange,
  multi = false,
}: {
  options: string[];
  value: string | string[];
  onChange: (next: string | string[]) => void;
  multi?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const active = multi
          ? Array.isArray(value) && value.includes(option)
          : value === option;

        return (
          <button
            key={option}
            type="button"
            onClick={() => {
              if (!multi) {
                onChange(option);
                return;
              }

              const arr = Array.isArray(value) ? value : [];
              if (arr.includes(option)) {
                onChange(arr.filter((v) => v !== option));
              } else {
                onChange([...arr, option]);
              }
            }}
            className={cn(
              "rounded-full border px-4 py-2 text-sm transition",
              active
                ? "border-emerald-400/60 bg-emerald-500/15 text-emerald-100"
                : "border-slate-700/80 bg-slate-950/40 text-slate-200 hover:bg-slate-900/50"
            )}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="mb-2 text-sm text-slate-300">{label}</div>
      {children}
    </label>
  );
}

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        "w-full rounded-2xl border border-slate-800/70 bg-slate-950/30 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-400/20",
        props.className
      )}
    />
  );
}

function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={cn(
        "w-full rounded-2xl border border-slate-800/70 bg-slate-950/30 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-400/20",
        props.className
      )}
    />
  );
}

const EMPTY_PROFILE: FighterProfile = {
  name: "",
  age: "",
  height: "",
  walkAroundWeight: "",
  baseArt: "",
  stance: "",
  secondaryArts: [],
  yearsTraining: "",
  competitionLevel: "",
  recentCamp: "",
  campGoal: "",
  bodyType: "",
  paceStyle: "",
  pressurePreference: "",
  strengths: "",
  weaknesses: "",
  availability: "",
  injuryHistory: "",
  hardBoundaries: "",
  lifeLoad: "",
  scheduleNotes: "",
  boundariesNotes: "",
  fightDate: "",
  weightClass: "",
  currentWeight: undefined,
  targetWeight: undefined,
  dietType: "none",
  allergies: [],
  intolerances: [],
  foodDislikes: [],
  favoriteFoods: [],
  avoidFoods: [],
  religiousDietNotes: "",
};

export default function ProfileForm() {
  const { profile, saveProfile, loading } = useProfile();

  const [step, setStep] = useState<StepKey>("identity");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState<FighterProfile>(EMPTY_PROFILE);

  const [allergiesText, setAllergiesText] = useState("");
  const [intolerancesText, setIntolerancesText] = useState("");
  const [foodDislikesText, setFoodDislikesText] = useState("");
  const [favoriteFoodsText, setFavoriteFoodsText] = useState("");
  const [avoidFoodsText, setAvoidFoodsText] = useState("");

  useEffect(() => {
    const p = profile ?? EMPTY_PROFILE;

    setForm({
      ...EMPTY_PROFILE,
      ...p,
      secondaryArts: p.secondaryArts ?? [],
      allergies: p.allergies ?? [],
      intolerances: p.intolerances ?? [],
      foodDislikes: p.foodDislikes ?? [],
      favoriteFoods: p.favoriteFoods ?? [],
      avoidFoods: p.avoidFoods ?? [],
      dietType: p.dietType ?? "none",
    });

    setAllergiesText(linesFromArray(p.allergies));
    setIntolerancesText(linesFromArray(p.intolerances));
    setFoodDislikesText(linesFromArray(p.foodDislikes));
    setFavoriteFoodsText(linesFromArray(p.favoriteFoods));
    setAvoidFoodsText(linesFromArray(p.avoidFoods));
  }, [profile]);

  const currentIndex = useMemo(() => STEP_ORDER.indexOf(step), [step]);

  function patch<K extends keyof FighterProfile>(key: K, value: FighterProfile[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function goNext() {
    if (currentIndex < STEP_ORDER.length - 1) {
      setStep(STEP_ORDER[currentIndex + 1]);
    }
  }

  function goBack() {
    if (currentIndex > 0) {
      setStep(STEP_ORDER[currentIndex - 1]);
    }
  }

  async function handleSave() {
    setSaving(true);
    setNotice(null);
    setError(null);

    const nextProfile: FighterProfile = {
      ...form,
      allergies: parseLines(allergiesText),
      intolerances: parseLines(intolerancesText),
      foodDislikes: parseLines(foodDislikesText),
      favoriteFoods: parseLines(favoriteFoodsText),
      avoidFoods: parseLines(avoidFoodsText),
      currentWeight:
        form.currentWeight === undefined || form.currentWeight === null || form.currentWeight === ("" as never)
          ? undefined
          : Number(form.currentWeight),
      targetWeight:
        form.targetWeight === undefined || form.targetWeight === null || form.targetWeight === ("" as never)
          ? undefined
          : Number(form.targetWeight),
    };

    const result = await saveProfile(nextProfile);

    setSaving(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setNotice("Profile saved.");
  }

  if (loading) {
    return (
      <div className="rounded-3xl border border-slate-800/60 bg-slate-950/25 p-6 text-sm text-slate-300">
        Loading profile...
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-slate-800/60 bg-slate-950/25 shadow-[0_0_0_1px_rgba(255,255,255,0.02)]">
      <div className="border-b border-slate-800/40 px-6 py-6">
        <div className="text-[11px] font-semibold tracking-[0.32em] text-emerald-300">
          PROFILE
        </div>
        <h1 className="mt-2 text-2xl font-semibold text-white">Camp identity</h1>
        <p className="mt-2 text-sm text-slate-300/70">
          Fill this once. Sensei + Fuel + Vision should pull this automatically.
        </p>

        <div className="mt-5 flex flex-wrap gap-2">
          {STEP_ORDER.map((key) => {
            const active = key === step;

            return (
              <button
                key={key}
                type="button"
                onClick={() => setStep(key)}
                className={cn(
                  "rounded-full border px-4 py-2 text-sm transition",
                  active
                    ? "border-emerald-400/70 bg-emerald-500/15 text-emerald-100"
                    : "border-slate-700/80 bg-slate-950/40 text-slate-200 hover:bg-slate-900/50"
                )}
              >
                {STEP_LABELS[key]}
              </button>
            );
          })}
        </div>
      </div>

      <div className="px-6 py-6">
        {step === "identity" && (
          <div className="grid gap-6 md:grid-cols-2">
            <Field label="Name / Nickname">
              <TextInput
                value={textValue(form.name)}
                onChange={(e) => patch("name", e.target.value)}
                placeholder="Dylan"
              />
            </Field>

            <Field label="Age">
              <TextInput
                value={textValue(form.age)}
                onChange={(e) => patch("age", e.target.value)}
                placeholder="16"
              />
            </Field>

            <Field label="Height">
              <TextInput
                value={textValue(form.height)}
                onChange={(e) => patch("height", e.target.value)}
                placeholder="175 cm"
              />
            </Field>

            <Field label="Walk-around weight">
              <TextInput
                value={textValue(form.walkAroundWeight)}
                onChange={(e) => patch("walkAroundWeight", e.target.value)}
                placeholder="70 kg"
              />
            </Field>

            <Field label="Current weight">
              <TextInput
                type="number"
                step="0.1"
                value={textValue(form.currentWeight)}
                onChange={(e) =>
                  patch(
                    "currentWeight",
                    e.target.value === "" ? undefined : Number(e.target.value)
                  )
                }
                placeholder="68.2"
              />
            </Field>

            <Field label="Target weight">
              <TextInput
                type="number"
                step="0.1"
                value={textValue(form.targetWeight)}
                onChange={(e) =>
                  patch(
                    "targetWeight",
                    e.target.value === "" ? undefined : Number(e.target.value)
                  )
                }
                placeholder="66"
              />
            </Field>

            <Field label="Fight date">
              <TextInput
                type="date"
                value={textValue(form.fightDate)}
                onChange={(e) => patch("fightDate", e.target.value)}
              />
            </Field>

            <Field label="Weight class">
              <TextInput
                value={textValue(form.weightClass)}
                onChange={(e) => patch("weightClass", e.target.value)}
                placeholder="66 kg"
              />
            </Field>

            <div className="md:col-span-2">
              <Field label="Base art">
                <ChoicePills
                  options={BASE_ART_OPTIONS}
                  value={textValue(form.baseArt)}
                  onChange={(next) => patch("baseArt", String(next))}
                />
              </Field>
            </div>

            <div className="md:col-span-2">
              <Field label="Stance">
                <ChoicePills
                  options={STANCE_OPTIONS}
                  value={textValue(form.stance)}
                  onChange={(next) => patch("stance", String(next))}
                />
              </Field>
            </div>

            <div className="md:col-span-2">
              <Field label="Secondary arts">
                <ChoicePills
                  options={SECONDARY_ART_OPTIONS}
                  value={form.secondaryArts ?? []}
                  onChange={(next) => patch("secondaryArts", next as string[])}
                  multi
                />
              </Field>
            </div>
          </div>
        )}

        {step === "experience" && (
          <div className="grid gap-6 md:grid-cols-2">
            <Field label="Years training">
              <TextInput
                value={textValue(form.yearsTraining)}
                onChange={(e) => patch("yearsTraining", e.target.value)}
                placeholder="3"
              />
            </Field>

            <Field label="Competition level">
              <ChoicePills
                options={COMPETITION_LEVEL_OPTIONS}
                value={textValue(form.competitionLevel)}
                onChange={(next) => patch("competitionLevel", String(next))}
              />
            </Field>

            <div className="md:col-span-2">
              <Field label="Recent camp">
                <TextArea
                  rows={4}
                  value={textValue(form.recentCamp)}
                  onChange={(e) => patch("recentCamp", e.target.value)}
                  placeholder="What happened in your last camp?"
                />
              </Field>
            </div>

            <div className="md:col-span-2">
              <Field label="Current camp goal">
                <TextArea
                  rows={4}
                  value={textValue(form.campGoal)}
                  onChange={(e) => patch("campGoal", e.target.value)}
                  placeholder="Fight prep, technical correction, weight cut, cardio focus..."
                />
              </Field>
            </div>
          </div>
        )}

        {step === "body" && (
          <div className="grid gap-6 md:grid-cols-2">
            <Field label="Body type">
              <TextInput
                value={textValue(form.bodyType)}
                onChange={(e) => patch("bodyType", e.target.value)}
                placeholder="Compact, long, explosive, stocky..."
              />
            </Field>

            <Field label="Pace style">
              <TextInput
                value={textValue(form.paceStyle)}
                onChange={(e) => patch("paceStyle", e.target.value)}
                placeholder="High pace, measured pace, burst pace..."
              />
            </Field>

            <Field label="Pressure preference">
              <TextInput
                value={textValue(form.pressurePreference)}
                onChange={(e) => patch("pressurePreference", e.target.value)}
                placeholder="Forward pressure, counter pressure..."
              />
            </Field>

            <div className="md:col-span-2">
              <Field label="Strengths">
                <TextArea
                  rows={4}
                  value={textValue(form.strengths)}
                  onChange={(e) => patch("strengths", e.target.value)}
                  placeholder="Top pressure, chain wrestling, jab, timing..."
                />
              </Field>
            </div>

            <div className="md:col-span-2">
              <Field label="Weaknesses">
                <TextArea
                  rows={4}
                  value={textValue(form.weaknesses)}
                  onChange={(e) => patch("weaknesses", e.target.value)}
                  placeholder="Fatigue, defence, overcommitting, bad exits..."
                />
              </Field>
            </div>
          </div>
        )}

        {step === "camp" && (
          <div className="grid gap-6">
            <Field label="Weekly availability">
              <TextArea
                rows={3}
                value={textValue(form.availability)}
                onChange={(e) => patch("availability", e.target.value)}
                placeholder="Every day / Mon Wed Fri evenings / school schedule..."
              />
            </Field>

            <Field label="Injury history">
              <TextArea
                rows={3}
                value={textValue(form.injuryHistory)}
                onChange={(e) => patch("injuryHistory", e.target.value)}
                placeholder="Knee, shoulder, ankle, back..."
              />
            </Field>

            <Field label="Hard boundaries">
              <TextArea
                rows={3}
                value={textValue(form.hardBoundaries)}
                onChange={(e) => patch("hardBoundaries", e.target.value)}
                placeholder="No heavy cuts below 68kg, no hard wrestling after sprint days..."
              />
            </Field>

            <Field label="Schedule notes">
              <TextArea
                rows={3}
                value={textValue(form.scheduleNotes)}
                onChange={(e) => patch("scheduleNotes", e.target.value)}
                placeholder="School 8–3, MMA Mon/Wed/Fri 5pm..."
              />
            </Field>

            <Field label="Boundaries notes">
              <TextArea
                rows={3}
                value={textValue(form.boundariesNotes)}
                onChange={(e) => patch("boundariesNotes", e.target.value)}
                placeholder="Protect knee, avoid stacking max wrestling + max sprints..."
              />
            </Field>

            <Field label="Life load">
              <TextArea
                rows={3}
                value={textValue(form.lifeLoad)}
                onChange={(e) => patch("lifeLoad", e.target.value)}
                placeholder="Exam season, family load, poor sleep, travel..."
              />
            </Field>
          </div>
        )}

        {step === "nutrition" && (
          <div className="grid gap-6">
            <Field label="Diet type">
              <div className="flex flex-wrap gap-2">
                {DIET_OPTIONS.map((option) => {
                  const active = (form.dietType ?? "none") === option.value;

                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => patch("dietType", option.value)}
                      className={cn(
                        "rounded-full border px-4 py-2 text-sm transition",
                        active
                          ? "border-emerald-400/70 bg-emerald-500/15 text-emerald-100"
                          : "border-slate-700/80 bg-slate-950/40 text-slate-200 hover:bg-slate-900/50"
                      )}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </Field>

            <Field label="Allergies (one per line)">
              <TextArea
                rows={4}
                value={allergiesText}
                onChange={(e) => setAllergiesText(e.target.value)}
                placeholder={"Peanuts\nShellfish\nEggs"}
              />
            </Field>

            <Field label="Intolerances (one per line)">
              <TextArea
                rows={4}
                value={intolerancesText}
                onChange={(e) => setIntolerancesText(e.target.value)}
                placeholder={"Lactose\nGluten"}
              />
            </Field>

            <Field label="Foods you dislike (one per line)">
              <TextArea
                rows={4}
                value={foodDislikesText}
                onChange={(e) => setFoodDislikesText(e.target.value)}
                placeholder={"Liver\nMushrooms"}
              />
            </Field>

            <Field label="Favorite foods (one per line)">
              <TextArea
                rows={4}
                value={favoriteFoodsText}
                onChange={(e) => setFavoriteFoodsText(e.target.value)}
                placeholder={"Rice\nChicken\nGreek yogurt"}
              />
            </Field>

            <Field label="Foods to avoid completely (one per line)">
              <TextArea
                rows={4}
                value={avoidFoodsText}
                onChange={(e) => setAvoidFoodsText(e.target.value)}
                placeholder={"Pork\nAlcohol\nDeep fried food"}
              />
            </Field>

            <Field label="Religious / diet notes">
              <TextArea
                rows={4}
                value={textValue(form.religiousDietNotes)}
                onChange={(e) => patch("religiousDietNotes", e.target.value)}
                placeholder="Halal only, no pork, no non-halal gelatin, fasting windows, kosher rules..."
              />
            </Field>
          </div>
        )}

        {(notice || error) && (
          <div className="mt-6">
            {notice ? (
              <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
                {notice}
              </div>
            ) : null}

            {error ? (
              <div className="rounded-2xl border border-rose-500/25 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
                {error}
              </div>
            ) : null}
          </div>
        )}

        <div className="mt-8 flex items-center justify-between gap-3 border-t border-slate-800/40 pt-6">
          <button
            type="button"
            onClick={goBack}
            disabled={currentIndex === 0}
            className="rounded-2xl border border-slate-700/80 bg-slate-950/30 px-4 py-3 text-sm text-slate-200 transition hover:bg-slate-900/40 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Back
          </button>

          <div className="flex items-center gap-3">
            {currentIndex < STEP_ORDER.length - 1 ? (
              <button
                type="button"
                onClick={goNext}
                className="rounded-2xl bg-emerald-400/95 px-5 py-3 text-sm font-medium text-slate-950 hover:bg-emerald-300"
              >
                Next step
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="rounded-2xl bg-emerald-400/95 px-5 py-3 text-sm font-medium text-slate-950 hover:bg-emerald-300 disabled:opacity-60"
              >
                {saving ? "Saving..." : "Save profile"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}