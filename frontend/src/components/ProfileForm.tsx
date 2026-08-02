"use client";

import React, { useEffect, useMemo, useState } from "react";
import Provenance from "@/components/Provenance";
import {
  useProfile,
  type CoachingStyle,
  type DietType,
  type FighterProfile,
} from "./ProfileProvider";

type SectionKey =
  | "identity"
  | "limits"
  | "style"
  | "history"
  | "coach"
  | "camp"
  | "readiness";

const SECTIONS: Array<{
  key: SectionKey;
  label: string;
  symbol: string;
}> = [
  { key: "identity", label: "Athlete", symbol: "ID" },
  { key: "limits", label: "Preparation & safety", symbol: "!" },
  { key: "style", label: "Style", symbol: "AR" },
  { key: "history", label: "History", symbol: "HX" },
  { key: "coach", label: "Coach connection", symbol: "VO" },
  { key: "camp", label: "Training environment", symbol: "GY" },
  { key: "readiness", label: "Competition context", symbol: "RD" },
];

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

const PHASE_OPTIONS = [
  "Base build",
  "Fight camp",
  "Weight cut",
  "Recovery",
  "Technical rebuild",
  "Return to training",
];

const ARCHETYPE_OPTIONS = [
  "Pressure fighter",
  "Counter striker",
  "Chain wrestler",
  "Control grappler",
  "Scrambler",
  "Volume striker",
  "Clinch fighter",
];

const COACHING_STYLE_OPTIONS: CoachingStyle[] = [
  "Direct",
  "Tactical",
  "Encouraging",
  "Brutal",
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
  competitionStatus: "",
  currentPhase: "",
  recentCamp: "",
  campGoal: "",
  bodyType: "",
  paceStyle: "",
  pressurePreference: "",
  fighterArchetype: "",
  strengths: "",
  weaknesses: "",
  currentFocus: "",
  activeConstraints: [],
  coachingStyle: "Direct",
  currentCorrection: "",
  currentLock: "",
  completedCorrections: [],
  progressionHistory: [],
  availability: "",
  injuryHistory: "",
  hardBoundaries: "",
  lifeLoad: "",
  gym: "",
  trainingFrequency: "",
  mainPartners: [],
  competitionGoals: "",
  scheduleNotes: "",
  boundariesNotes: "",
  fightDate: "",
  weightClass: "",
  currentWeight: undefined,
  targetWeight: undefined,
  sleep: "",
  readiness: "",
  currentStatus: "",
  dietType: "none",
  allergies: [],
  intolerances: [],
  foodDislikes: [],
  favoriteFoods: [],
  avoidFoods: [],
  religiousDietNotes: "",
};

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function textValue(value: string | number | undefined | null) {
  if (typeof value === "number") return String(value);
  return value ?? "";
}

function parseLines(value: string): string[] {
  return value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

function linesFromArray(value?: string[]) {
  return Array.isArray(value) ? value.join("\n") : "";
}

const NOT_SET = "Not set";
const NOT_LOGGED = "Not logged";

function compact(
  value?: string | number | null,
  fallback = NOT_SET
) {
  const text = textValue(value).trim();
  return text.length ? text : fallback;
}

function kg(value?: number) {
  return typeof value === "number" && Number.isFinite(value)
    ? `${value} kg`
    : NOT_LOGGED;
}

function daysUntil(dateStr?: string | null) {
  if (!dateStr) return null;

  const target = new Date(dateStr);

  if (Number.isNaN(target.getTime())) return null;

  return Math.max(
    0,
    Math.ceil((target.getTime() - Date.now()) / 86400000)
  );
}

function ToneDot({
  tone = "emerald",
}: {
  tone?: "emerald" | "amber" | "rose" | "cyan" | "violet" | "gold";
}) {
  const cls =
    tone === "amber"
      ? "bg-amber-300"
      : tone === "rose"
        ? "bg-rose-300"
        : tone === "cyan"
          ? "bg-cyan-200"
          : tone === "violet"
            ? "bg-violet-300"
            : tone === "gold"
              ? "bg-yellow-300"
              : "bg-emerald-300";

  return <span className={cn("h-2 w-2 rounded-full", cls)} />;
}

function Chip({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?:
    | "neutral"
    | "emerald"
    | "amber"
    | "rose"
    | "cyan"
    | "violet"
    | "gold";
}) {
  const cls =
    tone === "emerald"
      ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-100"
      : tone === "amber"
        ? "border-amber-400/20 bg-amber-400/10 text-amber-100"
        : tone === "rose"
          ? "border-rose-400/22 bg-rose-400/10 text-rose-100"
          : tone === "cyan"
            ? "border-cyan-300/20 bg-cyan-300/10 text-cyan-100"
            : tone === "violet"
              ? "border-violet-300/20 bg-violet-300/10 text-violet-100"
              : tone === "gold"
                ? "border-yellow-300/25 bg-yellow-300/10 text-yellow-100"
                : "border-white/10 bg-white/[0.045] text-white/62";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-semibold",
        cls
      )}
    >
      {children}
    </span>
  );
}

function IOSPanel({
  title,
  label,
  children,
  right,
}: {
  title: string;
  label?: string;
  children: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-[28px] border border-white/[0.08] bg-[linear-gradient(180deg,rgba(255,255,255,0.065),rgba(255,255,255,0.026))] shadow-[0_18px_70px_rgba(0,0,0,0.32)]">
      <div className="flex items-start justify-between gap-4 border-b border-white/[0.06] px-5 py-4">
        <div className="min-w-0">
          {label ? (
            <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-white/35">
              {label}
            </div>
          ) : null}

          <h2 className="mt-1 text-lg font-semibold tracking-[-0.02em] text-white">
            {title}
          </h2>
        </div>

        {right}
      </div>

      <div className="p-3 sm:p-4">{children}</div>
    </section>
  );
}

function Cell({
  label,
  value,
  children,
  tone,
}: {
  label: string;
  value?: string;
  children?: React.ReactNode;
  tone?: "emerald" | "amber" | "rose" | "cyan" | "violet" | "gold";
}) {
  /*
    An empty field is not news. Rendering "Not set" in the same bold white as
    a real answer made a new profile read as a wall of confident statements
    about nothing. Absence now recedes, and where the athlete can actually
    act — a cell with its own input below it — it offers "Add" instead of
    reporting the gap back at them.
  */
  const isUnset = value === NOT_SET || value === NOT_LOGGED;
  const actionable = isUnset && Boolean(children);

  return (
    <div className="rounded-[20px] border border-white/[0.07] bg-black/24 px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          {tone && !isUnset ? <ToneDot tone={tone} /> : null}

          <div className="truncate text-[12px] font-semibold text-white/52">
            {label}
          </div>
        </div>

        {/*
          When the cell carries its own input, that input already shows the
          value — printing it in the header too stated the same answer twice,
          a few pixels apart, and only the lower copy could be changed. The
          header now speaks only for read-only cells, or to invite a first
          entry where the field is still empty.
        */}
        {value && (!children || isUnset) ? (
          <div
            className={cn(
              "truncate text-right text-sm",
              isUnset
                ? cn("font-medium", actionable ? "text-emerald-200/60" : "text-white/30")
                : "font-semibold text-white"
            )}
          >
            {actionable ? "Add" : value}
          </div>
        ) : null}
      </div>

      {children ? <div className="mt-3">{children}</div> : null}
    </div>
  );
}

function TextInput(
  props: React.InputHTMLAttributes<HTMLInputElement>
) {
  return (
    <input
      {...props}
      className={cn(
        "h-11 w-full rounded-[16px] border border-white/[0.08] bg-white/[0.04] px-3 text-sm text-white outline-none placeholder:text-white/28 focus:border-emerald-300/30 focus:ring-2 focus:ring-emerald-300/10",
        props.className
      )}
    />
  );
}

function TextArea(
  props: React.TextareaHTMLAttributes<HTMLTextAreaElement>
) {
  return (
    <textarea
      {...props}
      className={cn(
        "w-full resize-none rounded-[16px] border border-white/[0.08] bg-white/[0.04] px-3 py-3 text-sm leading-6 text-white outline-none placeholder:text-white/28 focus:border-emerald-300/30 focus:ring-2 focus:ring-emerald-300/10",
        props.className
      )}
    />
  );
}

function OptionGrid({
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

              onChange(
                arr.includes(option)
                  ? arr.filter((item) => item !== option)
                  : [...arr, option]
              );
            }}
            className={cn(
              "rounded-full border px-3.5 py-2 text-xs font-semibold transition active:scale-[0.98]",
              active
                ? "border-emerald-300/55 bg-emerald-300/14 text-emerald-100 shadow-[0_0_24px_rgba(52,211,153,0.10)]"
                : "border-white/10 bg-white/[0.035] text-white/55 hover:bg-white/[0.06] hover:text-white"
            )}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}

function SectionNav({
  active,
  onChange,
}: {
  active: SectionKey;
  onChange: (next: SectionKey) => void;
}) {
  return (
    <div className="sticky top-[73px] z-20 -mx-1 overflow-x-auto border-y border-white/[0.06] bg-[#020810]/88 px-1 py-2 backdrop-blur-xl">
      <div className="flex min-w-max gap-2">
        {SECTIONS.map((item) => {
          const selected = item.key === active;

          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onChange(item.key)}
              className={cn(
                "flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold transition active:scale-[0.98]",
                selected
                  ? "border-white/18 bg-white text-[#041026]"
                  : "border-white/10 bg-white/[0.035] text-white/56 hover:text-white"
              )}
            >
              <span
                className={cn(
                  "text-[10px]",
                  selected
                    ? "text-[#041026]/70"
                    : "text-white/35"
                )}
              >
                {item.symbol}
              </span>

              {item.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
export default function ProfileForm() {
  const { profile, saveProfile, loading } = useProfile();

  const [section, setSection] = useState<SectionKey>("identity");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<FighterProfile>(EMPTY_PROFILE);
  /*
    Edits live in local state until Save. Switching sections keeps them, since
    the sections only filter what is rendered from one form object — but
    leaving the route discarded them silently. This tracks whether anything
    is unsaved so the athlete is asked before their work is thrown away.
  */
  const [dirty, setDirty] = useState(false);

  const [activeConstraintsText, setActiveConstraintsText] = useState("");
  const [completedCorrectionsText, setCompletedCorrectionsText] = useState("");
  const [progressionHistoryText, setProgressionHistoryText] = useState("");
  const [mainPartnersText, setMainPartnersText] = useState("");
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
      activeConstraints: p.activeConstraints ?? [],
      completedCorrections: p.completedCorrections ?? [],
      progressionHistory: p.progressionHistory ?? [],
      mainPartners: p.mainPartners ?? [],
      allergies: p.allergies ?? [],
      intolerances: p.intolerances ?? [],
      foodDislikes: p.foodDislikes ?? [],
      favoriteFoods: p.favoriteFoods ?? [],
      avoidFoods: p.avoidFoods ?? [],
      dietType: p.dietType ?? "none",
      coachingStyle: p.coachingStyle ?? "Direct",
    });

    setActiveConstraintsText(linesFromArray(p.activeConstraints));
    setCompletedCorrectionsText(linesFromArray(p.completedCorrections));
    setProgressionHistoryText(linesFromArray(p.progressionHistory));
    setMainPartnersText(linesFromArray(p.mainPartners));
    setAllergiesText(linesFromArray(p.allergies));
    setIntolerancesText(linesFromArray(p.intolerances));
    setFoodDislikesText(linesFromArray(p.foodDislikes));
    setFavoriteFoodsText(linesFromArray(p.favoriteFoods));
    setAvoidFoodsText(linesFromArray(p.avoidFoods));
    // Rehydrating from the store is not an athlete edit.
    setDirty(false);
  }, [profile]);

  function patch<K extends keyof FighterProfile>(
    key: K,
    value: FighterProfile[K]
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  }

  /*
    Guard unsaved edits on the way out.

    beforeunload covers reload, tab close and external links. In-app links are
    client-side navigations that fire no such event, so anchor clicks are
    intercepted during the capture phase — before the router sees them — and
    the athlete is asked to confirm. Section switching is deliberately not
    guarded: it preserves edits, so prompting there would be noise.
  */
  useEffect(() => {
    if (!dirty) return;

    function onBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }

    function onCapturedClick(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const anchor = (event.target as HTMLElement | null)?.closest?.("a[href]");
      if (!anchor) return;

      const href = anchor.getAttribute("href") || "";
      if (!href.startsWith("/") || anchor.getAttribute("target") === "_blank") return;
      if (href.startsWith(window.location.pathname)) return;

      const leave = window.confirm(
        "You have unsaved profile changes. Leave without saving?"
      );
      if (!leave) {
        event.preventDefault();
        event.stopPropagation();
      }
    }

    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onCapturedClick, true);

    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onCapturedClick, true);
    };
  }, [dirty]);

  async function handleSave() {
    setSaving(true);
    setNotice(null);
    setError(null);

    const nextProfile: FighterProfile = {
      ...form,
      activeConstraints: parseLines(activeConstraintsText),
      completedCorrections: parseLines(completedCorrectionsText),
      progressionHistory: parseLines(progressionHistoryText),
      mainPartners: parseLines(mainPartnersText),
      allergies: parseLines(allergiesText),
      intolerances: parseLines(intolerancesText),
      foodDislikes: parseLines(foodDislikesText),
      favoriteFoods: parseLines(favoriteFoodsText),
      avoidFoods: parseLines(avoidFoodsText),
      currentWeight:
        form.currentWeight === undefined ||
        form.currentWeight === null ||
        form.currentWeight === ("" as never)
          ? undefined
          : Number(form.currentWeight),
      targetWeight:
        form.targetWeight === undefined ||
        form.targetWeight === null ||
        form.targetWeight === ("" as never)
          ? undefined
          : Number(form.targetWeight),
    };

    const result = await saveProfile(nextProfile);

    setSaving(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setDirty(false);
    setNotice("Profile saved.");
  }

  const daysRemaining = useMemo(
    () => daysUntil(form.fightDate),
    [form.fightDate]
  );

  if (loading) {
    return (
      <div className="app-card flex items-center gap-3 p-6 text-sm text-white/55" aria-busy="true">
        <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-300" /> Loading your profile…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <section className="overflow-hidden rounded-[24px] border border-white/[0.08] bg-[radial-gradient(circle_at_18%_0%,rgba(52,211,153,0.12),transparent_34%),radial-gradient(circle_at_84%_8%,rgba(250,204,21,0.08),transparent_32%),linear-gradient(145deg,rgba(16,30,52,0.96),rgba(3,10,22,0.98)_58%,rgba(2,8,16,1))] shadow-[0_20px_70px_rgba(0,0,0,0.32)]">
        <div className="p-5 md:p-7">
          {/*
            The hero states who the athlete is. It used to also carry a
            four-cell panel repeating Current focus, Phase, Readiness and
            Fight — all of which the sections below own and edit — so the most
            prominent block on the page was four read-only restatements that
            read "Not set / Not set / No date" on a new profile. Chips now
            appear only when they carry a real value, so absence is quiet
            rather than announced.
          */}
          <div className="min-w-0">
            <h2 className="text-[clamp(2rem,5vw,2.75rem)] font-semibold leading-none tracking-[-0.04em] text-white">
              {compact(form.name, "Unnamed athlete")}
            </h2>

            {/*
              Everything on this screen is self-reported. Saying so once, at
              the top, is what lets a coach read the rest without having to
              guess which parts they can rely on — and it keeps Profile from
              implying an authority it does not have.
            */}
            <Provenance kind="athlete_entered" className="mt-3" />

            <div className="mt-5 flex flex-wrap gap-2">
              {form.baseArt ? <Chip tone="emerald">{form.baseArt}</Chip> : null}

              {form.fighterArchetype ? (
                <Chip tone="cyan">{form.fighterArchetype}</Chip>
              ) : null}

              {form.coachingStyle ? (
                <Chip tone="violet">{form.coachingStyle}</Chip>
              ) : null}

              {activeConstraintsText.trim() ? (
                <Chip tone="rose">Restrictions set</Chip>
              ) : null}

              {daysRemaining !== null ? (
                <Chip tone="amber">{daysRemaining} days to fight</Chip>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <SectionNav active={section} onChange={setSection} />

      {section === "identity" && (
        <IOSPanel
          title="Athlete identity"
          label="Profile"
          right={<Chip tone="emerald">Core</Chip>}
        >
          <div className="grid gap-3 md:grid-cols-2">
            <Cell
              label="Name / nickname"
              value={compact(form.name)}
            >
              <TextInput
                value={textValue(form.name)}
                onChange={(event) =>
                  patch("name", event.target.value)
                }
                placeholder="Preferred name"
              />
            </Cell>

            <Cell label="Age" value={compact(form.age)}>
              <TextInput
                value={textValue(form.age)}
                onChange={(event) =>
                  patch("age", event.target.value)
                }
                placeholder="16"
              />
            </Cell>

            <Cell
              label="Primary art"
              value={compact(form.baseArt)}
              tone="emerald"
            >
              <OptionGrid
                options={BASE_ART_OPTIONS}
                value={textValue(form.baseArt)}
                onChange={(next) =>
                  patch("baseArt", String(next))
                }
              />
            </Cell>

            <Cell
              label="Secondary arts"
              value={
                form.secondaryArts?.length
                  ? `${form.secondaryArts.length} selected`
                  : "None selected"
              }
              tone="cyan"
            >
              <OptionGrid
                options={SECONDARY_ART_OPTIONS}
                value={form.secondaryArts ?? []}
                onChange={(next) =>
                  patch("secondaryArts", next as string[])
                }
                multi
              />
            </Cell>

            <Cell
              label="Experience"
              value={compact(form.competitionLevel)}
            >
              <OptionGrid
                options={COMPETITION_LEVEL_OPTIONS}
                value={textValue(form.competitionLevel)}
                onChange={(next) =>
                  patch("competitionLevel", String(next))
                }
              />
            </Cell>

            <Cell
              label="Current phase"
              value={compact(form.currentPhase)}
              tone="gold"
            >
              <OptionGrid
                options={PHASE_OPTIONS}
                value={textValue(form.currentPhase)}
                onChange={(next) =>
                  patch("currentPhase", String(next))
                }
              />
            </Cell>

            <Cell
              label="Competition status"
              value={compact(form.competitionStatus)}
            >
              <TextInput
                value={textValue(form.competitionStatus)}
                onChange={(event) =>
                  patch("competitionStatus", event.target.value)
                }
                placeholder="Amateur bout booked / off-season"
              />
            </Cell>

            <Cell
              label="Years training"
              value={compact(form.yearsTraining)}
            >
              <TextInput
                value={textValue(form.yearsTraining)}
                onChange={(event) =>
                  patch("yearsTraining", event.target.value)
                }
                placeholder="3"
              />
            </Cell>
          </div>
        </IOSPanel>
      )}

      {section === "limits" && (
        <IOSPanel
          title="Active constraints"
          label="Limits"
          right={<Chip tone="rose">Affects coaching</Chip>}
        >
          <div className="grid gap-3">
            <Cell
              label="Active constraints"
              value={`${parseLines(activeConstraintsText).length} active`}
              tone="rose"
            >
              <TextArea
                rows={5}
                value={activeConstraintsText}
                onChange={(event) =>
                  setActiveConstraintsText(event.target.value)
                }
                placeholder={
                  "Knee limitation: no hard sprawls today\nShoulder restriction: no max clinch pummeling\nRecovery limit: keep volume controlled"
                }
              />
            </Cell>

            <Cell
              label="Injury history"
              value={form.injuryHistory ? "Added" : "Not set"}
            >
              <TextArea
                rows={4}
                value={textValue(form.injuryHistory)}
                onChange={(event) =>
                  patch("injuryHistory", event.target.value)
                }
                placeholder="Knee, shoulder, ankle, back..."
              />
            </Cell>

            <Cell
              label="Hard boundaries"
              value={form.hardBoundaries ? "Added" : "Not set"}
            >
              <TextArea
                rows={4}
                value={textValue(form.hardBoundaries)}
                onChange={(event) =>
                  patch("hardBoundaries", event.target.value)
                }
                placeholder="No heavy cuts below 68kg. No hard wrestling after sprint days."
              />
            </Cell>

            <Cell
              label="Life load"
              value={form.lifeLoad ? "Added" : "Not set"}
            >
              <TextArea
                rows={3}
                value={textValue(form.lifeLoad)}
                onChange={(event) =>
                  patch("lifeLoad", event.target.value)
                }
                placeholder="Exam season, poor sleep, travel, family load..."
              />
            </Cell>
          </div>
        </IOSPanel>
      )}

      {section === "style" && (
        <IOSPanel
          title="Fighting style"
          label="Style"
          right={<Chip tone="cyan">Athlete</Chip>}
        >
          <div className="grid gap-3">
            <Cell
              label="Archetype"
              value={compact(form.fighterArchetype)}
              tone="cyan"
            >
              <OptionGrid
                options={ARCHETYPE_OPTIONS}
                value={textValue(form.fighterArchetype)}
                onChange={(next) =>
                  patch("fighterArchetype", String(next))
                }
              />
            </Cell>

            <Cell
              label="Pace style"
              value={compact(form.paceStyle)}
            >
              <TextInput
                value={textValue(form.paceStyle)}
                onChange={(event) =>
                  patch("paceStyle", event.target.value)
                }
                placeholder="High pace, measured pace, burst pace..."
              />
            </Cell>

            <Cell
              label="Pressure preference"
              value={compact(form.pressurePreference)}
            >
              <TextInput
                value={textValue(form.pressurePreference)}
                onChange={(event) =>
                  patch("pressurePreference", event.target.value)
                }
                placeholder="Forward pressure, counter pressure..."
              />
            </Cell>

            <div className="grid gap-3 md:grid-cols-2">
              <Cell
                label="Strengths"
                value={form.strengths ? "Added" : "Not set"}
              >
                <TextArea
                  rows={4}
                  value={textValue(form.strengths)}
                  onChange={(event) =>
                    patch("strengths", event.target.value)
                  }
                  placeholder="Top pressure, chain wrestling, jab, timing..."
                />
              </Cell>

              <Cell
                label="Weaknesses"
                value={form.weaknesses ? "Added" : "Not set"}
              >
                <TextArea
                  rows={4}
                  value={textValue(form.weaknesses)}
                  onChange={(event) =>
                    patch("weaknesses", event.target.value)
                  }
                  placeholder="Fatigue, defense, overcommitting, bad exits..."
                />
              </Cell>
            </div>
          </div>
        </IOSPanel>
      )}

      {/* Merged into Camp: an eighth tab did not earn its place. */}
      {section === "camp" && (
        <IOSPanel
          title="Current focus"
          label="One active target"
          right={<Chip tone="gold">Active</Chip>}
        >
          <div className="grid gap-3">
            <Cell
              label="Current focus"
              value={compact(form.currentFocus)}
              tone="gold"
            >
              <TextInput
                value={textValue(form.currentFocus)}
                onChange={(event) =>
                  patch("currentFocus", event.target.value)
                }
                placeholder="Takedown entries / jab recovery / rear hand discipline"
              />
            </Cell>

            <Cell
              label="Current camp goal"
              value={form.campGoal ? "Added" : "Not set"}
            >
              <TextArea
                rows={4}
                value={textValue(form.campGoal)}
                onChange={(event) =>
                  patch("campGoal", event.target.value)
                }
                placeholder="What should this camp produce?"
              />
            </Cell>

            <Cell
              label="Recent camp"
              value={form.recentCamp ? "Added" : "Not set"}
            >
              <TextArea
                rows={4}
                value={textValue(form.recentCamp)}
                onChange={(event) =>
                  patch("recentCamp", event.target.value)
                }
                placeholder="What happened in the last camp?"
              />
            </Cell>
          </div>
        </IOSPanel>
      )}

      {section === "history" && (
        <IOSPanel
          title="Correction history"
          label="Training history"
          right={<Chip tone="emerald">Progress</Chip>}
        >
          <div className="grid gap-3">
            <Cell
              label="Current correction"
              value={compact(form.currentCorrection)}
              tone="emerald"
            >
              <TextInput
                value={textValue(form.currentCorrection)}
                onChange={(event) =>
                  patch("currentCorrection", event.target.value)
                }
                placeholder="Rear hand discipline on entry"
              />
            </Cell>

            <Cell
              label="Completion target"
              value={compact(form.currentLock)}
              tone="gold"
            >
              <TextInput
                value={textValue(form.currentLock)}
                onChange={(event) =>
                  patch("currentLock", event.target.value)
                }
                placeholder="Keep this correction until five clean reps"
              />
            </Cell>

            <Cell
              label="Completed corrections"
              value={`${parseLines(completedCorrectionsText).length} complete`}
            >
              <TextArea
                rows={5}
                value={completedCorrectionsText}
                onChange={(event) =>
                  setCompletedCorrectionsText(event.target.value)
                }
                placeholder={
                  "Stopped reaching before feet\nCleaned jab return\nKept head off center after exit"
                }
              />
            </Cell>

            <Cell
              label="Progression history"
              value={`${parseLines(progressionHistoryText).length} notes`}
            >
              <TextArea
                rows={5}
                value={progressionHistoryText}
                onChange={(event) =>
                  setProgressionHistoryText(event.target.value)
                }
                placeholder={
                  "Week 1: entry posture\nWeek 2: rear hand reset\nWeek 3: proof under resistance"
                }
              />
            </Cell>
          </div>
        </IOSPanel>
      )}

      {section === "coach" && (
        <IOSPanel
          title="Guidance style"
          label="How Sensei should speak"
          right={
            <Chip tone="violet">
              {compact(form.coachingStyle, "Direct")}
            </Chip>
          }
        >
          <div className="grid gap-3">
            <Cell
              label="Guidance style"
              value={compact(form.coachingStyle)}
              tone="violet"
            >
              <OptionGrid
                options={COACHING_STYLE_OPTIONS}
                value={textValue(form.coachingStyle)}
                onChange={(next) =>
                  patch("coachingStyle", next as CoachingStyle)
                }
              />
            </Cell>

            <Cell
              label="Boundaries notes"
              value={form.boundariesNotes ? "Added" : "Not set"}
            >
              <TextArea
                rows={4}
                value={textValue(form.boundariesNotes)}
                onChange={(event) =>
                  patch("boundariesNotes", event.target.value)
                }
                placeholder="What should guidance avoid or reinforce?"
              />
            </Cell>

            <Cell
              label="Body type"
              value={compact(form.bodyType)}
            >
              <TextInput
                value={textValue(form.bodyType)}
                onChange={(event) =>
                  patch("bodyType", event.target.value)
                }
                placeholder="Compact, long, explosive, stocky..."
              />
            </Cell>
          </div>
        </IOSPanel>
      )}

      {section === "camp" && (
        <IOSPanel
          title="Training environment"
          label="Camp conditions"
          right={<Chip tone="cyan">Context</Chip>}
        >
          <div className="grid gap-3">
            <Cell
              label="Gym"
              value={compact(form.gym)}
              tone="cyan"
            >
              <TextInput
                value={textValue(form.gym)}
                onChange={(event) =>
                  patch("gym", event.target.value)
                }
                placeholder="Gym name"
              />
            </Cell>

            <Cell
              label="Training frequency"
              value={compact(form.trainingFrequency)}
            >
              <TextInput
                value={textValue(form.trainingFrequency)}
                onChange={(event) =>
                  patch("trainingFrequency", event.target.value)
                }
                placeholder="5x/week. Wrestling Mon Wed Fri. Striking Tue Thu."
              />
            </Cell>

            <Cell
              label="Main partners"
              value={`${parseLines(mainPartnersText).length} partners`}
            >
              <TextArea
                rows={4}
                value={mainPartnersText}
                onChange={(event) =>
                  setMainPartnersText(event.target.value)
                }
                placeholder={
                  "Southpaw boxer\nHeavy wrestler\nFast counter striker"
                }
              />
            </Cell>

            <Cell
              label="Competition goals"
              value={form.competitionGoals ? "Added" : "Not set"}
            >
              <TextArea
                rows={4}
                value={textValue(form.competitionGoals)}
                onChange={(event) =>
                  patch("competitionGoals", event.target.value)
                }
                placeholder="Win amateur bout, make 66kg, clean wrestling entries..."
              />
            </Cell>

            <Cell
              label="Schedule notes"
              value={form.scheduleNotes ? "Added" : "Not set"}
            >
              <TextArea
                rows={3}
                value={textValue(form.scheduleNotes)}
                onChange={(event) =>
                  patch("scheduleNotes", event.target.value)
                }
                placeholder="School 8-3. MMA evenings. Recovery on Sunday."
              />
            </Cell>
          </div>
        </IOSPanel>
      )}

      {section === "readiness" && (
        <IOSPanel
          title="Current readiness"
          label="Body state"
          right={
            <Chip tone="amber">
              {compact(form.readiness)}
            </Chip>
          }
        >
          <div className="grid gap-3">
            <div className="grid gap-3 sm:grid-cols-4">
              <Cell
                label="Current"
                value={kg(form.currentWeight)}
                tone="amber"
              />

              <Cell
                label="Target"
                value={kg(form.targetWeight)}
                tone="gold"
              />

              <Cell
                label="Sleep"
                value={compact(form.sleep)}
                tone="cyan"
              />

              <Cell
                label="Status"
                value={compact(form.currentStatus)}
                tone="emerald"
              />
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <Cell
                label="Current weight"
                value={kg(form.currentWeight)}
              >
                <TextInput
                  type="number"
                  step="0.1"
                  value={textValue(form.currentWeight)}
                  onChange={(event) =>
                    patch(
                      "currentWeight",
                      event.target.value === ""
                        ? undefined
                        : Number(event.target.value)
                    )
                  }
                  placeholder="68.2"
                />
              </Cell>

              <Cell
                label="Target weight"
                value={kg(form.targetWeight)}
              >
                <TextInput
                  type="number"
                  step="0.1"
                  value={textValue(form.targetWeight)}
                  onChange={(event) =>
                    patch(
                      "targetWeight",
                      event.target.value === ""
                        ? undefined
                        : Number(event.target.value)
                    )
                  }
                  placeholder="66"
                />
              </Cell>

              <Cell
                label="Walk-around weight"
                value={compact(form.walkAroundWeight)}
              >
                <TextInput
                  value={textValue(form.walkAroundWeight)}
                  onChange={(event) =>
                    patch("walkAroundWeight", event.target.value)
                  }
                  placeholder="69kg"
                />
              </Cell>

              <Cell
                label="Weight class"
                value={compact(form.weightClass)}
              >
                <TextInput
                  value={textValue(form.weightClass)}
                  onChange={(event) =>
                    patch("weightClass", event.target.value)
                  }
                  placeholder="66 kg"
                />
              </Cell>

              <Cell
                label="Fight date"
                value={compact(form.fightDate)}
              >
                <TextInput
                  type="date"
                  value={textValue(form.fightDate)}
                  onChange={(event) =>
                    patch("fightDate", event.target.value)
                  }
                />
              </Cell>

              <Cell
                label="Sleep"
                value={compact(form.sleep)}
              >
                <TextInput
                  value={textValue(form.sleep)}
                  onChange={(event) =>
                    patch("sleep", event.target.value)
                  }
                  placeholder="7h average / poor / strong"
                />
              </Cell>

              <Cell
                label="Readiness"
                value={compact(form.readiness)}
              >
                <TextInput
                  value={textValue(form.readiness)}
                  onChange={(event) =>
                    patch("readiness", event.target.value)
                  }
                  placeholder="Ready / limited / watch load"
                />
              </Cell>

              <Cell
                label="Current status"
                value={compact(form.currentStatus)}
              >
                <TextInput
                  value={textValue(form.currentStatus)}
                  onChange={(event) =>
                    patch("currentStatus", event.target.value)
                  }
                  placeholder="Healthy, cutting, sore knee, exam week..."
                />
              </Cell>
            </div>

            <Cell
              label="Diet type"
              value={compact(form.dietType)}
            >
              <div className="flex flex-wrap gap-2">
                {DIET_OPTIONS.map((option) => {
                  const active =
                    (form.dietType ?? "none") === option.value;

                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() =>
                        patch("dietType", option.value)
                      }
                      className={cn(
                        "rounded-full border px-3.5 py-2 text-xs font-semibold transition",
                        active
                          ? "border-amber-300/55 bg-amber-300/14 text-amber-100"
                          : "border-white/10 bg-white/[0.035] text-white/55 hover:text-white"
                      )}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </Cell>

            <div className="grid gap-3 md:grid-cols-2">
              <Cell
                label="Allergies"
                value={`${parseLines(allergiesText).length} listed`}
              >
                <TextArea
                  rows={3}
                  value={allergiesText}
                  onChange={(event) =>
                    setAllergiesText(event.target.value)
                  }
                  placeholder={"Peanuts\nShellfish"}
                />
              </Cell>

              <Cell
                label="Intolerances"
                value={`${parseLines(intolerancesText).length} listed`}
              >
                <TextArea
                  rows={3}
                  value={intolerancesText}
                  onChange={(event) =>
                    setIntolerancesText(event.target.value)
                  }
                  placeholder={"Lactose\nGluten"}
                />
              </Cell>

              <Cell
                label="Foods disliked"
                value={`${parseLines(foodDislikesText).length} listed`}
              >
                <TextArea
                  rows={3}
                  value={foodDislikesText}
                  onChange={(event) =>
                    setFoodDislikesText(event.target.value)
                  }
                  placeholder={"Liver\nMushrooms"}
                />
              </Cell>

              <Cell
                label="Favorite foods"
                value={`${parseLines(favoriteFoodsText).length} listed`}
              >
                <TextArea
                  rows={3}
                  value={favoriteFoodsText}
                  onChange={(event) =>
                    setFavoriteFoodsText(event.target.value)
                  }
                  placeholder={"Rice\nChicken\nGreek yogurt"}
                />
              </Cell>

              <Cell
                label="Foods to avoid"
                value={`${parseLines(avoidFoodsText).length} listed`}
              >
                <TextArea
                  rows={3}
                  value={avoidFoodsText}
                  onChange={(event) =>
                    setAvoidFoodsText(event.target.value)
                  }
                  placeholder={"Pork\nAlcohol\nDeep fried food"}
                />
              </Cell>

              <Cell
                label="Diet notes"
                value={
                  form.religiousDietNotes ? "Added" : "Not set"
                }
              >
                <TextArea
                  rows={3}
                  value={textValue(form.religiousDietNotes)}
                  onChange={(event) =>
                    patch(
                      "religiousDietNotes",
                      event.target.value
                    )
                  }
                  placeholder="Halal only, fasting windows, kosher rules..."
                />
              </Cell>
            </div>
          </div>
        </IOSPanel>
      )}

      {(notice || error) && (
        <div>
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

      <div className="flex justify-end pt-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="rounded-[18px] bg-emerald-300 px-6 py-3 text-sm font-semibold text-[#03120d] transition hover:bg-emerald-200 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? "Saving..." : "Save profile"}
        </button>
      </div>
    </div>
  );
}
