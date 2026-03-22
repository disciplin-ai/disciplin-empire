"use client";

import React, { useEffect, useRef, useState } from "react";
import SenseiScreen, {
  AskSectionId,
  BaseArt,
  BuildStage,
  CampControl,
  CampDirective,
  ChatMessage,
  ChecklistItem,
  DailySession,
  FocusKey,
  GymCandidate,
  SenseiSystemStatus,
  TrainingFocus,
} from "@/components/SenseiScreen";
import { useProfile } from "@/components/ProfileProvider";
import { getSupabaseBrowser } from "@/lib/supabase/browser";
import type { VisionAnalysis } from "@/lib/senseiVisionTypes";

type SavedCamp = {
  focus: FocusKey;
  baseArt: BaseArt;
  styleTags: string;
  constraints: string;
  directive: CampDirective | null;
  trainingFocus: TrainingFocus | null;
  gyms: GymCandidate[];
  control: CampControl | null;
  dailySession: DailySession | null;
  checklist: ChecklistItem[];
  savedAt: number;
};

type GymRow = {
  id: string;
  name: string;
  city: string | null;
  country: string | null;
  address: string | null;
  disciplines: string[] | null;
  style_tags: string[] | null;
  intensity_label: string | null;
  level_label: string | null;
  price_label: string | null;
  is_verified: boolean | null;
  style_fit: Record<string, number> | null;
  coach_notes: string | null;
  google_maps_url: string | null;
  website: string | null;
  slug: string | null;
};

type SenseiDecisionResponse = {
  ok: true;
  assessment: string;
  impact: string;
  decision: string;
  next_steps: string[];
};

type SenseiErrorResponse = {
  ok: false;
  error: string;
};

type SenseiApiResponse = SenseiDecisionResponse | SenseiErrorResponse;

type FuelMemory = {
  score?: number;
  report?: string;
  followups_id?: string;
};

function uid() {
  return Math.random().toString(36).slice(2);
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function safeParseVision(): VisionAnalysis | null {
  try {
    const raw = localStorage.getItem("disciplin_latest_vision");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.analysis_id && parsed?.findings) return parsed as VisionAnalysis;
    return null;
  } catch {
    return null;
  }
}

function safeParseFuel(): FuelMemory | null {
  try {
    const raw = localStorage.getItem("disciplin_latest_fuel");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.score || parsed?.report || parsed?.followups_id) return parsed;
    return null;
  } catch {
    return null;
  }
}

function safeParseCamp(): SavedCamp | null {
  try {
    const raw = localStorage.getItem("disciplin_latest_camp");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.savedAt) return parsed as SavedCamp;
    return null;
  } catch {
    return null;
  }
}

function saveCamp(payload: SavedCamp) {
  localStorage.setItem("disciplin_latest_camp", JSON.stringify(payload));
}

function deriveWeaknessTags(v: VisionAnalysis | null): string[] {
  if (!v) return [];

  const titles = v.findings.map((f) => f.title.toLowerCase());
  const tags: string[] = [];

  if (titles.some((x) => x.includes("telegraph") || x.includes("level change") || x.includes("entry"))) {
    tags.push("entry_timing");
  }
  if (titles.some((x) => x.includes("hands drop") || x.includes("guard") || x.includes("exit"))) {
    tags.push("guard_exit");
  }
  if (titles.some((x) => x.includes("stance") || x.includes("base") || x.includes("balance"))) {
    tags.push("base_integrity");
  }

  return tags;
}

function normalizeTextArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((x) => String(x)).filter(Boolean);
}

function inferProfilePriority(profile: any): {
  primaryStyle: "striking" | "wrestling" | "grappling" | "mixed";
  paceStyle: string;
} {
  const base = String(profile?.baseArt || "").toLowerCase();
  const pace = String(profile?.paceStyle || "").toLowerCase();

  if (["boxing", "kickboxing", "muay thai"].includes(base)) {
    return { primaryStyle: "striking", paceStyle: pace };
  }
  if (base === "wrestling") {
    return { primaryStyle: "wrestling", paceStyle: pace };
  }
  if (["bjj", "judo", "sambo"].includes(base)) {
    return { primaryStyle: "grappling", paceStyle: pace };
  }

  return { primaryStyle: "mixed", paceStyle: pace };
}

function deriveFuelState(fuel: FuelMemory | null): "good" | "mid" | "bad" | "unknown" {
  if (!fuel || typeof fuel.score !== "number") return "unknown";
  if (fuel.score >= 75) return "good";
  if (fuel.score >= 50) return "mid";
  return "bad";
}

function buildDirective(v: VisionAnalysis | null, focus: FocusKey): CampDirective {
  if (!v) {
    return {
      title: "Set a real directive (run Sensei Vision)",
      source: "No analysis loaded",
      bullets: [
        "Run Sensei Vision on a clip before making camp decisions.",
        "Without analysis, training becomes generic and wastes time.",
      ],
    };
  }

  const top = v.findings.find((f) => f.severity === "HIGH") ?? v.findings[0];

  return {
    title: `Fix: ${top?.title || "Top issue"} (${focus} camp)`,
    source: `Source: Sensei Vision · ${v.clipLabel}`,
    bullets: [
      "Everything this week supports the directive.",
      "No random sessions. No ego rounds.",
      "If you can’t execute the fix under fatigue, you don’t own it.",
    ],
  };
}

function buildTraining(
  v: VisionAnalysis | null,
  focus: FocusKey,
  constraints: string,
  fuel: FuelMemory | null
): TrainingFocus {
  const c = constraints.toLowerCase();
  const knee = c.includes("knee");
  const noPartner = c.includes("no partner");
  const fuelState = deriveFuelState(fuel);

  const weaknesses = deriveWeaknessTags(v);

  const primary: string[] = [];
  const secondary: string[] = [];
  const avoid: string[] = [];

  if (weaknesses.includes("entry_timing")) primary.push("Entry timing: outside step → level change early (no pause).");
  if (weaknesses.includes("guard_exit")) primary.push("Exit discipline: guard stays high through reset + angle out.");
  if (!primary.length) primary.push("Pick 1 technical theme from Vision and train it for reps.");

  if (focus === "Pressure") secondary.push("Wall pace: re-attack rule (no disengage).");
  if (focus === "Speed") secondary.push("Fast hands: 6x2 min—touch, exit, reset.");
  if (focus === "Power") secondary.push("Explosive actions: low volume, full reset, perfect form.");
  if (focus === "Recovery") secondary.push("Flow + mobility: leave fresher than you arrived.");
  if (focus === "Mixed") secondary.push("Balanced rounds: 3x striking + 3x grappling focus blocks.");

  if (fuelState === "bad") {
    primary.unshift("Technical reps only: do not rely on conditioning to carry the session.");
    avoid.push("High volume sparring under poor fuel conditions.");
    avoid.push("Hard conditioning blocks while energy support is compromised.");
  }

  if (fuelState === "mid") {
    avoid.push("Long output-heavy sessions without nutrition support.");
  }

  if (noPartner) avoid.push("Hard sparring as a substitute for real reps.");
  if (knee) avoid.push("Hard pivots / reckless shots until warmed + stable.");
  avoid.push("High volume chaos sessions that don’t target the directive.");

  return { primary, secondary, avoid };
}

function buildControl(
  v: VisionAnalysis | null,
  constraints: string,
  fuel: FuelMemory | null
): CampControl {
  const c = constraints.toLowerCase();
  const fightWeek = c.includes("fight week") || c.includes("weigh-in");
  const injury = c.includes("knee") || c.includes("shoulder") || c.includes("back");
  const fuelState = deriveFuelState(fuel);

  const highFindings = (v?.findings ?? []).filter((f) => f.severity === "HIGH").length;

  let trainingLoad: CampControl["trainingLoad"] = "MODERATE";

  if (fuelState === "bad") trainingLoad = "LOW";
  if (fightWeek) trainingLoad = "LOW";
  if (injury) trainingLoad = "LOW";
  if (highFindings >= 2 && !fightWeek && !injury && fuelState !== "bad") trainingLoad = "HIGH";

  const warnings: string[] = [];

  if (!v) warnings.push("No Vision loaded → you’re guessing. Run Sensei Vision.");

  if (fuelState === "bad") {
    warnings.push(
      "Fuel score is low: energy support and recovery are compromised. High output work will flatten pace and increase fatigue."
    );
  }

  if (fuelState === "mid") {
    warnings.push(
      "Fuel score is moderate: nutrition support is inconsistent. Output may drop later in rounds if intensity climbs."
    );
  }

  if (fuelState === "unknown") {
    warnings.push(
      "No Fuel data loaded: training decisions are being made without nutrition or recovery context."
    );
  }

  if (fightWeek) {
    warnings.push("Fight-week mode: reduce GI risk, reduce injury risk, keep intensity controlled.");
  }

  if (injury) {
    warnings.push("Injury constraint present: cut intensity before form breaks.");
  }

  warnings.push("If the directive fails under fatigue, reduce rounds and increase technical reps.");

  const nextStep: string[] = [];

  if (fuelState === "bad") {
    nextStep.push("Stabilise nutrition before increasing training intensity.");
    nextStep.push("Avoid high-output sessions until Fuel improves.");
  }

  if (fuelState === "mid") {
    nextStep.push("Keep load controlled until Fuel support is cleaner.");
  }

  nextStep.push("Run a 20–40 minute technical block on the directive (reps > wars).");
  nextStep.push("Use the gym tab only as support after the camp directive is set.");
  nextStep.push("After session: log 1 clip and re-run Vision (proof of improvement).");

  return { trainingLoad, warnings, nextStep };
}

function chooseSessionTiming(constraints: string): { label: string; durationMin: number } {
  const c = constraints.toLowerCase();

  if (c.includes("15 min")) return { label: "Morning session", durationMin: 15 };
  if (c.includes("20 min")) return { label: "Short session", durationMin: 20 };
  if (c.includes("30 min")) return { label: "Short session", durationMin: 30 };
  if (c.includes("1 hour") || c.includes("60 min")) return { label: "Evening session", durationMin: 60 };
  if (c.includes("evening")) return { label: "Evening session", durationMin: 45 };
  if (c.includes("morning")) return { label: "Morning session", durationMin: 15 };

  return { label: "Daily session", durationMin: 15 };
}

function buildDailySession(args: {
  focus: FocusKey;
  directive: CampDirective;
  trainingFocus: TrainingFocus;
  control: CampControl;
  constraints: string;
}): DailySession {
  const c = args.constraints.toLowerCase();
  const noPartner = c.includes("no partner");
  const knee = c.includes("knee");
  const directiveTitle = args.directive.title.toLowerCase();
  const timing = chooseSessionTiming(args.constraints);

  if (args.control.trainingLoad === "LOW" || args.focus === "Recovery") {
    return {
      title: `${timing.label} (${timing.durationMin} min)`,
      durationMin: timing.durationMin,
      timingLabel: timing.label,
      goal: "Mobility + reset",
      blocks:
        timing.durationMin <= 20
          ? [
              "3 min hip openers",
              "3 min ankle mobility",
              "3 min thoracic rotation",
              "3 min stance movement",
              "3 min breathing reset",
            ]
          : [
              "10 min hip + ankle mobility",
              "10 min thoracic rotation + spine prep",
              "10 min stance movement flow",
              "10 min breathing + cooldown",
            ],
    };
  }

  if (directiveTitle.includes("entry") || args.focus === "Speed") {
    return {
      title: `${timing.label} (${timing.durationMin} min)`,
      durationMin: timing.durationMin,
      timingLabel: timing.label,
      goal: "Entry speed + balance",
      blocks:
        timing.durationMin <= 20
          ? [
              "5 min stance movement",
              "5 min entry drills",
              "5 min shadow rounds with fast reset",
            ]
          : [
              "10 min stance movement + footwork",
              "10 min entry drills",
              "10 min shadow rounds with reset discipline",
              "10 min review pace rounds",
            ],
    };
  }

  if (args.focus === "Pressure") {
    return {
      title: `${timing.label} (${timing.durationMin} min)`,
      durationMin: timing.durationMin,
      timingLabel: timing.label,
      goal: "Pressure rhythm",
      blocks:
        timing.durationMin <= 20
          ? [
              "5 min forward-step shadow pressure",
              "5 min re-attack rhythm drills",
              "5 min wall-pressure footwork or stance march",
            ]
          : [
              "10 min pressure footwork",
              "10 min re-attack rhythm drills",
              "10 min wall / cage style movement",
              "10 min short pressure shadow rounds",
            ],
    };
  }

  if (args.focus === "Power") {
    return {
      title: `${timing.label} (${timing.durationMin} min)`,
      durationMin: timing.durationMin,
      timingLabel: timing.label,
      goal: "Explosive sharpness",
      blocks:
        timing.durationMin <= 20
          ? [
              "4 min dynamic warmup",
              "5 min explosive shadow reps",
              "3 min fast stance resets",
              "3 min cooldown breathing",
            ]
          : [
              "10 min dynamic warmup",
              "15 min explosive shadow reps",
              "10 min stance resets + entries",
              "10 min cooldown + breathing",
            ],
    };
  }

  if (noPartner) {
    return {
      title: `${timing.label} (${timing.durationMin} min)`,
      durationMin: timing.durationMin,
      timingLabel: timing.label,
      goal: "Solo technical reps",
      blocks:
        timing.durationMin <= 20
          ? [
              "5 min technical shadow",
              "5 min focused correction reps",
              "5 min free-flow shadow review",
            ]
          : [
              "10 min technical shadow",
              "10 min focused correction reps",
              "10 min free-flow shadow review",
              "10 min controlled pace rounds",
            ],
    };
  }

  if (knee) {
    return {
      title: `${timing.label} (${timing.durationMin} min)`,
      durationMin: timing.durationMin,
      timingLabel: timing.label,
      goal: "Safe movement prep",
      blocks:
        timing.durationMin <= 20
          ? [
              "4 min gentle mobility",
              "4 min stance control",
              "4 min upper-body shadow mechanics",
              "3 min cooldown",
            ]
          : [
              "10 min gentle mobility",
              "10 min stance control",
              "10 min upper-body shadow mechanics",
              "10 min cooldown",
            ],
    };
  }

  return {
    title: `${timing.label} (${timing.durationMin} min)`,
    durationMin: timing.durationMin,
    timingLabel: timing.label,
    goal: args.trainingFocus.primary[0] || "Technical sharpness",
    blocks:
      timing.durationMin <= 20
        ? [
            "5 min movement prep",
            "5 min technical reps on the primary focus",
            "5 min short shadow review",
          ]
        : [
            "10 min movement prep",
            "15 min technical reps on the primary focus",
            "15 min shadow review + controlled rounds",
            "10 min cooldown",
          ],
  };
}

function buildChecklist(args: {
  dailySession: DailySession;
  control: CampControl;
}): ChecklistItem[] {
  const items: ChecklistItem[] = [
    {
      id: "daily-session",
      label: `${args.dailySession.title} — ${args.dailySession.goal}`,
      done: false,
    },
    {
      id: "technical-block",
      label: "Technical drill block",
      done: false,
    },
    {
      id: "vision-retest",
      label: "Vision re-test",
      done: false,
    },
  ];

  if (args.control.trainingLoad !== "LOW") {
    items.push({
      id: "conditioning",
      label: "Conditioning block",
      done: false,
    });
  }

  items.push({
    id: "mobility-recovery",
    label: "Mobility / recovery",
    done: false,
  });

  return items;
}

function buildSystemStatus(
  vision: VisionAnalysis | null,
  fuel: FuelMemory | null,
  camp: SavedCamp | null
): SenseiSystemStatus {
  return {
    visionConnected: !!vision,
    visionLabel: vision
      ? `Last analysis: ${vision.clipLabel}`
      : "No recent Vision analysis. Run Vision for a real directive.",
    fuelConnected: !!fuel,
    fuelLabel: fuel
      ? `Last Fuel report available${typeof fuel.score === "number" ? ` · Score ${Math.round(fuel.score)}` : ""}`
      : "No recent Fuel report. Nutrition guidance is separate for now.",
    campSaved: !!camp,
    campLabel: camp
      ? `Last camp saved ${new Date(camp.savedAt).toLocaleString()}`
      : "No saved camp yet.",
  };
}

function scoreRealGyms(args: {
  gyms: GymRow[];
  focus: FocusKey;
  baseArt: BaseArt;
  styleTags: string;
  weaknessTags: string[];
  profile: any;
}): GymCandidate[] {
  const styleLower = args.styleTags.toLowerCase();
  const profileInfo = inferProfilePriority(args.profile);
  const baseLower = args.baseArt.toLowerCase();

  const strikingArts = ["boxing", "kickboxing", "muay thai"];
  const grapplingArts = ["wrestling", "bjj", "judo", "sambo"];

  const isStrikingUser =
    strikingArts.includes(baseLower) ||
    profileInfo.primaryStyle === "striking" ||
    styleLower.includes("striking") ||
    styleLower.includes("boxing");

  const isWrestlingUser =
    baseLower === "wrestling" ||
    profileInfo.primaryStyle === "wrestling" ||
    styleLower.includes("wrestling");

  const isGrapplingUser =
    grapplingArts.includes(baseLower) ||
    profileInfo.primaryStyle === "grappling" ||
    styleLower.includes("grappling") ||
    styleLower.includes("bjj");

  const out: GymCandidate[] = args.gyms.map((gym) => {
    const disciplines = normalizeTextArray(gym.disciplines).map((x) => x.toLowerCase());
    const styleTags = normalizeTextArray(gym.style_tags).map((x) => x.toLowerCase());
    const styleFit = gym.style_fit ?? {};

    let score = 45;

    if (gym.is_verified) score += 6;
    if ((gym.intensity_label || "").toLowerCase() === "hard" && args.focus === "Pressure") score += 7;
    if ((gym.intensity_label || "").toLowerCase() === "light" && args.focus === "Recovery") score += 5;

    if (args.focus === "Pressure") {
      if (styleTags.some((t) => t.includes("pressure") || t.includes("wrestling") || t.includes("scramble"))) score += 10;
      if (disciplines.includes("wrestling") || disciplines.includes("mma")) score += 8;
    }

    if (args.focus === "Speed") {
      if (styleTags.some((t) => t.includes("striking") || t.includes("timing") || t.includes("speed"))) score += 10;
      if (disciplines.some((d) => strikingArts.includes(d))) score += 8;
    }

    if (args.focus === "Power") {
      if (styleTags.some((t) => t.includes("power") || t.includes("explosive") || t.includes("striking"))) score += 8;
      if (disciplines.includes("mma") || disciplines.some((d) => strikingArts.includes(d))) score += 6;
    }

    if (args.focus === "Recovery") {
      if ((gym.level_label || "").toLowerCase().includes("beginner")) score += 4;
      if ((gym.intensity_label || "").toLowerCase() === "hard") score -= 6;
    }

    if (isStrikingUser) {
      if (disciplines.some((d) => strikingArts.includes(d))) score += 14;
      if (disciplines.length && disciplines.every((d) => d === "wrestling")) score -= 18;
      if (styleTags.some((t) => t.includes("striking") || t.includes("boxing") || t.includes("kick"))) score += 8;
    }

    if (isWrestlingUser) {
      if (disciplines.includes("wrestling") || disciplines.includes("mma")) score += 14;
      if (styleTags.some((t) => t.includes("wrestling") || t.includes("pressure") || t.includes("scramble"))) score += 8;
    }

    if (isGrapplingUser) {
      if (disciplines.some((d) => ["bjj", "judo", "sambo", "wrestling", "mma"].includes(d))) score += 12;
    }

    if (args.weaknessTags.includes("entry_timing")) {
      if (disciplines.includes("wrestling") || disciplines.includes("mma")) score += 8;
      if (styleTags.some((t) => t.includes("wrestling") || t.includes("entries") || t.includes("pressure"))) score += 6;
    }

    if (args.weaknessTags.includes("guard_exit")) {
      if (disciplines.some((d) => strikingArts.includes(d))) score += 8;
      if (styleTags.some((t) => t.includes("striking") || t.includes("timing") || t.includes("boxing"))) score += 6;
    }

    if (args.weaknessTags.includes("base_integrity")) {
      if (disciplines.includes("wrestling") || disciplines.includes("mma")) score += 6;
      if (styleTags.some((t) => t.includes("balance") || t.includes("base") || t.includes("scramble"))) score += 4;
    }

    if (typeof styleFit.pressure_wrestler === "number" && args.focus === "Pressure") {
      score += Math.round(styleFit.pressure_wrestler * 10);
    }
    if (typeof styleFit.striker === "number" && isStrikingUser) {
      score += Math.round(styleFit.striker * 10);
    }
    if (typeof styleFit.grappler === "number" && isGrapplingUser) {
      score += Math.round(styleFit.grappler * 10);
    }

    score = Math.max(0, Math.min(99, Math.round(score)));

    const location = [gym.city, gym.country].filter(Boolean).join(", ");
    const href = gym.slug ? `/gyms/${gym.slug}` : undefined;

    const reason: string[] = [];
    const bestFor: string[] = [];
    const watchOut: string[] = [];

    if (gym.is_verified) reason.push("Verified gym record from Supabase.");
    if (gym.intensity_label) reason.push(`Intensity: ${gym.intensity_label}.`);
    if (disciplines.length) reason.push(`Disciplines: ${disciplines.join(", ")}.`);
    if (gym.coach_notes) reason.push(gym.coach_notes);

    if (isStrikingUser && disciplines.some((d) => strikingArts.includes(d))) bestFor.push("Striking-focused users");
    if (isWrestlingUser && (disciplines.includes("wrestling") || disciplines.includes("mma"))) bestFor.push("Wrestling / MMA pressure");
    if (isGrapplingUser && disciplines.some((d) => ["bjj", "judo", "sambo", "wrestling"].includes(d))) bestFor.push("Grappling development");
    if (args.focus === "Pressure") bestFor.push("Pressure camp support");
    if (args.focus === "Speed") bestFor.push("Speed / timing support");

    if (isStrikingUser && disciplines.length && disciplines.every((d) => d === "wrestling")) {
      watchOut.push("Pure wrestling emphasis may confuse striking-first users.");
    }
    if ((gym.intensity_label || "").toLowerCase() === "hard" && args.focus === "Recovery") {
      watchOut.push("Hard room during recovery focus.");
    }
    if (!gym.is_verified) {
      watchOut.push("Unverified gym record.");
    }

    return {
      id: gym.id,
      name: gym.name,
      location: location || gym.address || "Location not set",
      compatibility: score,
      reason: reason.slice(0, 3),
      bestFor: bestFor.length ? bestFor.slice(0, 3) : ["General training support"],
      watchOut: watchOut.length ? watchOut.slice(0, 3) : ["Confirm schedule and room fit before committing."],
      href,
      verified: !!gym.is_verified,
    };
  });

  return out.sort((a, b) => b.compatibility - a.compatibility);
}

async function loadRealDubaiGyms(): Promise<GymRow[]> {
  const supabase = getSupabaseBrowser();

  const { data, error } = await supabase
    .from("gyms")
    .select(
      "id,name,city,country,address,disciplines,style_tags,intensity_label,level_label,price_label,is_verified,style_fit,coach_notes,google_maps_url,website,slug"
    )
    .ilike("city", "Dubai");

  if (error) {
    console.error("[Sensei] Failed to load gyms:", error.message);
    return [];
  }

  return (data ?? []) as GymRow[];
}

function mapSectionToApi(section: AskSectionId): "overview" | "training" | "nutrition" | "recovery" | "questions" {
  if (section === "all") return "questions";
  return section;
}

function buildSenseiContextString(args: {
  profile: any;
  focus: FocusKey;
  baseArt: BaseArt;
  styleTags: string;
  constraints: string;
  directive: CampDirective | null;
  trainingFocus: TrainingFocus | null;
  control: CampControl | null;
  dailySession: DailySession | null;
  gyms: GymCandidate[];
  vision: VisionAnalysis | null;
  fuel: FuelMemory | null;
}) {
  const {
    profile,
    focus,
    baseArt,
    styleTags,
    constraints,
    directive,
    trainingFocus,
    control,
    dailySession,
    gyms,
    vision,
    fuel,
  } = args;

  const topFinding =
    vision?.findings?.find((f) => f.severity === "HIGH") ?? vision?.findings?.[0] ?? null;

  const bestGym = gyms[0] ?? null;
  const fuelState = deriveFuelState(fuel);

  const parts: string[] = [
    `Focus: ${focus}`,
    `Base art: ${baseArt}`,
    `Style tags: ${styleTags || "Not set"}`,
    `Constraints: ${constraints || "None"}`,
  ];

  if (profile) {
    parts.push(`Profile name: ${String((profile as any)?.name || "Unknown")}`);
    parts.push(`Profile pace style: ${String((profile as any)?.paceStyle || "Unknown")}`);
    parts.push(`Profile pressure preference: ${String((profile as any)?.pressurePreference || "Unknown")}`);
    parts.push(`Profile strengths: ${String((profile as any)?.strengths || "None listed")}`);
    parts.push(`Profile weaknesses: ${String((profile as any)?.weaknesses || "None listed")}`);
    parts.push(`Fight date: ${String((profile as any)?.fightDate || "Not set")}`);
    parts.push(`Current weight: ${String((profile as any)?.currentWeight ?? "Not set")}`);
    parts.push(`Target weight: ${String((profile as any)?.targetWeight ?? "Not set")}`);
  }

  if (directive) {
    parts.push(`Directive title: ${directive.title}`);
    parts.push(`Directive source: ${directive.source}`);
    parts.push(`Directive bullets: ${directive.bullets.join(" | ")}`);
  }

  if (trainingFocus) {
    parts.push(`Primary training focus: ${trainingFocus.primary.join(" | ") || "None"}`);
    parts.push(`Secondary training focus: ${trainingFocus.secondary.join(" | ") || "None"}`);
    parts.push(`Avoid: ${trainingFocus.avoid.join(" | ") || "None"}`);
  }

  if (control) {
    parts.push(`Training load: ${control.trainingLoad}`);
    parts.push(`Warnings: ${control.warnings.join(" | ")}`);
    parts.push(`Next steps: ${control.nextStep.join(" | ")}`);
  }

  if (dailySession) {
    parts.push(`Daily session: ${dailySession.title}`);
    parts.push(`Daily session goal: ${dailySession.goal}`);
    parts.push(`Daily session blocks: ${dailySession.blocks.join(" | ")}`);
  }

  if (vision) {
    parts.push(`Vision clip label: ${vision.clipLabel}`);
    if (topFinding) {
      parts.push(`Top Vision issue: ${topFinding.title}`);
      parts.push(`Top Vision detail: ${topFinding.detail}`);
      parts.push(`Top Vision severity: ${topFinding.severity}`);
      parts.push(`Vision summary: ${topFinding.title} — ${topFinding.detail}`);
    } else {
      parts.push("Vision summary: Analysis loaded, but no findings were returned.");
    }
  } else {
    parts.push("No recent Sensei Vision analysis.");
  }

  if (fuel) {
    parts.push(`Fuel score: ${typeof fuel.score === "number" ? Math.round(fuel.score) : "Unknown"}`);
    parts.push(`Fuel state: ${fuelState}`);
    parts.push(`Fuel report: ${fuel.report || "No report"}`);
  } else {
    parts.push("No recent Fuel report.");
  }

  if (bestGym) {
    parts.push(`Best gym match: ${bestGym.name} (${bestGym.compatibility}% match)`);
    parts.push(`Best gym reason: ${bestGym.reason.join(" | ")}`);
    parts.push(`Best gym best-for: ${bestGym.bestFor.join(" | ")}`);
    parts.push(`Best gym watch-out: ${bestGym.watchOut.join(" | ")}`);
  } else {
    parts.push("No ranked gyms available.");
  }

  return parts.join("\n");
}

function formatSenseiDecision(data: SenseiDecisionResponse) {
  return [
    `Assessment: ${data.assessment}`,
    `Impact: ${data.impact}`,
    `Decision: ${data.decision}`,
    `Next:`,
    ...(data.next_steps || []).map((s) => `• ${s}`),
  ].join("\n");
}

export default function SenseiClient() {
  const { profile } = useProfile();

  const savedCampRef = useRef<SavedCamp | null>(null);
  const realGymsRef = useRef<GymRow[]>([]);
  const lastVisionRef = useRef<VisionAnalysis | null>(null);
  const lastFuelRef = useRef<FuelMemory | null>(null);

  const [focus, setFocus] = useState<FocusKey>("Pressure");
  const [baseArt, setBaseArt] = useState<BaseArt>("MMA");
  const [styleTags, setStyleTags] = useState<string>("pressure wrestler, forward pressure");
  const [constraints, setConstraints] = useState<string>("60 min, no partner today");

  const [busy, setBusy] = useState(false);
  const [buildStage, setBuildStage] = useState<BuildStage>("IDLE");
  const [statusLabel, setStatusLabel] = useState<"Idle" | "Building" | "Ready" | "Error">("Idle");

  const [directive, setDirective] = useState<CampDirective | null>(null);
  const [trainingFocus, setTrainingFocus] = useState<TrainingFocus | null>(null);
  const [gyms, setGyms] = useState<GymCandidate[]>([]);
  const [control, setControl] = useState<CampControl | null>(null);
  const [dailySession, setDailySession] = useState<DailySession | null>(null);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [systemStatus, setSystemStatus] = useState<SenseiSystemStatus>({
    visionConnected: false,
    visionLabel: "No recent Vision analysis.",
    fuelConnected: false,
    fuelLabel: "No recent Fuel report.",
    campSaved: false,
    campLabel: "No saved camp yet.",
  });

  const [followupsId, setFollowupsId] = useState<string | null>("camp_local");
  const [activeChatSection, setActiveChatSection] = useState<AskSectionId>("all");
  const [chatInput, setChatInput] = useState("");
  const [chatSending, setChatSending] = useState(false);

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: uid(),
      role: "system",
      section: "all",
      text: "Sensei = camp control. Vision = analysis. Fuel = recovery context. Build camp, then ask about decisions.",
      ts: Date.now(),
    },
  ]);

  useEffect(() => {
    const saved = safeParseCamp();
    const vision = safeParseVision();
    const fuel = safeParseFuel();

    savedCampRef.current = saved;
    lastVisionRef.current = vision;
    lastFuelRef.current = fuel;

    if (saved) {
      setFocus(saved.focus);
      setBaseArt(saved.baseArt);
      setStyleTags(saved.styleTags);
      setConstraints(saved.constraints);
      setDirective(saved.directive);
      setTrainingFocus(saved.trainingFocus);
      setGyms(saved.gyms);
      setControl(saved.control);
      setDailySession(saved.dailySession);
      setChecklist(saved.checklist ?? []);
      setStatusLabel("Ready");
      setBuildStage("DONE");
    }

    if (fuel?.followups_id) {
      setFollowupsId(fuel.followups_id);
    }

    setSystemStatus(buildSystemStatus(vision, fuel, saved));

    loadRealDubaiGyms().then((rows) => {
      realGymsRef.current = rows;
    });
  }, []);

  useEffect(() => {
    if (!profile) return;

    const profileBase = String((profile as any)?.baseArt || "").trim();
    const profilePace = String((profile as any)?.paceStyle || "").trim();

    if (profileBase) {
      const allowed: BaseArt[] = ["MMA", "Wrestling", "Boxing", "Kickboxing", "Muay Thai", "BJJ", "Judo", "Sambo"];
      if (allowed.includes(profileBase as BaseArt)) {
        setBaseArt(profileBase as BaseArt);
      }
    }

    if (profilePace) {
      setStyleTags((prev) => {
        if (prev.toLowerCase().includes(profilePace.toLowerCase())) return prev;
        return prev.trim() ? `${prev}, ${profilePace}` : profilePace;
      });
    }
  }, [profile]);

  useEffect(() => {
    if (!directive || !trainingFocus || !control) return;

    const payload: SavedCamp = {
      focus,
      baseArt,
      styleTags,
      constraints,
      directive,
      trainingFocus,
      gyms,
      control,
      dailySession,
      checklist,
      savedAt: Date.now(),
    };

    saveCamp(payload);
    savedCampRef.current = payload;
    setSystemStatus(buildSystemStatus(lastVisionRef.current, lastFuelRef.current, payload));
  }, [focus, baseArt, styleTags, constraints, directive, trainingFocus, gyms, control, dailySession, checklist]);

  const statusTone =
    statusLabel === "Ready"
      ? "good"
      : statusLabel === "Building"
      ? "warn"
      : statusLabel === "Error"
      ? "bad"
      : "neutral";

  function onOpenVision() {
    window.location.href = "/sensei-vision";
  }

  function onOpenFuel() {
    window.location.href = "/fuel";
  }

  function onReset() {
    setDirective(null);
    setTrainingFocus(null);
    setGyms([]);
    setControl(null);
    setDailySession(null);
    setChecklist([]);
    setStatusLabel("Idle");
    setBuildStage("IDLE");
    setBusy(false);

    localStorage.removeItem("disciplin_latest_camp");
    savedCampRef.current = null;

    const vision = safeParseVision();
    const fuel = safeParseFuel();
    lastVisionRef.current = vision;
    lastFuelRef.current = fuel;
    setSystemStatus(buildSystemStatus(vision, fuel, null));

    setChatMessages([
      {
        id: uid(),
        role: "system",
        section: "all",
        text: "Reset complete. Run Vision, load Fuel, then build camp.",
        ts: Date.now(),
      },
    ]);
  }

  async function onBuildCamp() {
    setBusy(true);
    setStatusLabel("Building");

    try {
      setBuildStage("READING_CONTEXT");
      await delay(450);

      const vision = safeParseVision();
      const fuel = safeParseFuel();
      lastVisionRef.current = vision;
      lastFuelRef.current = fuel;
      setSystemStatus(buildSystemStatus(vision, fuel, savedCampRef.current));

      if (fuel?.followups_id) {
        setFollowupsId(fuel.followups_id);
      }

      const weaknessTags = deriveWeaknessTags(vision);

      setBuildStage("SETTING_DIRECTIVE");
      await delay(450);
      const d = buildDirective(vision, focus);

      setBuildStage("BUILDING_TRAINING");
      await delay(500);
      const t = buildTraining(vision, focus, constraints, fuel);

      setBuildStage("SETTING_CONTROL");
      await delay(420);
      const c = buildControl(vision, constraints, fuel);

      const session = buildDailySession({
        focus,
        directive: d,
        trainingFocus: t,
        control: c,
        constraints,
      });

      const tasks = buildChecklist({
        dailySession: session,
        control: c,
      });

      setBuildStage("RANKING_GYMS");
      await delay(420);
      const rankedGyms = scoreRealGyms({
        gyms: realGymsRef.current,
        focus,
        baseArt,
        styleTags,
        weaknessTags,
        profile,
      });

      setDirective(d);
      setTrainingFocus(t);
      setGyms(rankedGyms);
      setControl(c);
      setDailySession(session);
      setChecklist(tasks);

      const fuelState = deriveFuelState(fuel);

      setChatMessages((prev) => [
        ...prev,
        {
          id: uid(),
          role: "system",
          section: "all",
          text: vision
            ? `Camp built from Vision: "${vision.clipLabel}". Focus=${focus}. Fuel=${fuelState}. Weakness tags=${weaknessTags.join(", ") || "none"}.`
            : `Camp built WITHOUT Vision. Run Sensei Vision to stop guessing.`,
          ts: Date.now(),
        },
      ]);

      setBuildStage("DONE");
      await delay(180);
      setStatusLabel("Ready");
    } catch (e: any) {
      setBuildStage("ERROR");
      setStatusLabel("Error");
      setChatMessages((prev) => [
        ...prev,
        {
          id: uid(),
          role: "system",
          section: "all",
          text: `Camp build failed: ${e?.message ?? "unknown error"}`,
          ts: Date.now(),
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  function onToggleChecklistItem(id: string) {
    setChecklist((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, done: !item.done } : item
      )
    );
  }

  function onChatKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!chatSending) void onSendChat();
    }
  }

  async function onSendChat() {
    const text = chatInput.trim();
    if (!text) return;

    const section = activeChatSection;

    setChatMessages((prev) => [
      ...prev,
      { id: uid(), role: "user", section, text, ts: Date.now() },
    ]);
    setChatInput("");
    setChatSending(true);

    try {
      const vision = lastVisionRef.current;
      const fuel = lastFuelRef.current;
      const mappedSection = mapSectionToApi(section);

      const context = buildSenseiContextString({
        profile,
        focus,
        baseArt,
        styleTags,
        constraints,
        directive,
        trainingFocus,
        control,
        dailySession,
        gyms,
        vision,
        fuel,
      });

      const res = await fetch("/api/sensei", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          followups_id: followupsId || "camp_local",
          section_id: mappedSection,
          question: text,
          context,
        }),
      });

      const data = (await res.json()) as SenseiApiResponse;

      if (!res.ok || !data || data.ok === false) {
        const errorText =
          data && "error" in data && typeof data.error === "string"
            ? data.error
            : "Sensei failed to answer.";
        throw new Error(errorText);
      }

      if (!data.assessment) {
        throw new Error("Sensei returned no usable response.");
      }

      const formatted = formatSenseiDecision(data);

      setChatMessages((prev) => [
        ...prev,
        {
          id: uid(),
          role: "sensei",
          section,
          text: formatted,
          ts: Date.now(),
        },
      ]);
    } catch (e: any) {
      setChatMessages((prev) => [
        ...prev,
        {
          id: uid(),
          role: "system",
          section: "all",
          text: `Sensei failed: ${e?.message ?? "unknown error"}`,
          ts: Date.now(),
        },
      ]);
    } finally {
      setChatSending(false);
    }
  }

  return (
    <SenseiScreen
      focus={focus}
      setFocus={setFocus}
      baseArt={baseArt}
      setBaseArt={setBaseArt}
      styleTags={styleTags}
      setStyleTags={setStyleTags}
      constraints={constraints}
      setConstraints={setConstraints}
      directive={directive}
      trainingFocus={trainingFocus}
      gyms={gyms}
      control={control}
      systemStatus={systemStatus}
      dailySession={dailySession}
      checklist={checklist}
      onToggleChecklistItem={onToggleChecklistItem}
      onBuildCamp={onBuildCamp}
      onReset={onReset}
      onOpenVision={onOpenVision}
      onOpenFuel={onOpenFuel}
      followupsId={followupsId}
      activeChatSection={activeChatSection}
      setActiveChatSection={setActiveChatSection}
      chatInput={chatInput}
      setChatInput={setChatInput}
      chatSending={chatSending}
      chatMessages={chatMessages}
      onSendChat={onSendChat}
      onChatKeyDown={onChatKeyDown}
      busy={busy}
      buildStage={buildStage}
      statusLabel={statusLabel}
      statusTone={statusTone}
    />
  );
}