"use client";

import React, { useEffect, useRef, useState } from "react";
import SenseiScreen, {
  AskSectionId,
  BaseArt,
  BuildStage,
  CampControl,
  CampDirective,
  ChatMessage,
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
    if (parsed?.analysis_id) return parsed as VisionAnalysis;
    return null;
  } catch {
    return null;
  }
}

function safeParseFuel(): { score?: number; report?: string; followups_id?: string } | null {
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
  if (!v || !Array.isArray(v.findings)) return [];

  const titles = v.findings.map((f) => String(f.title || "").toLowerCase());
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

function buildDirective(v: VisionAnalysis | null, focus: FocusKey): CampDirective {
  if (!v || !Array.isArray(v.findings) || v.findings.length === 0) {
    return {
      title: "Set a real directive (run Sensei Vision)",
      source: "No analysis loaded",
      bullets: [
        "Run Sensei Vision on a real clip before making camp decisions.",
        "Without Vision context, the camp becomes generic.",
      ],
    };
  }

  const top = v.findings.find((f) => f.severity === "HIGH") ?? v.findings[0];

  return {
    title: `Fix: ${top?.title || "Top issue"} (${focus} camp)`,
    source: `Source: Sensei Vision · ${v.clipLabel || "Latest frame"}`,
    bullets: [
      "Everything this week supports the directive.",
      "No random sessions. No ego rounds.",
      "If you can’t execute the fix under fatigue, you don’t own it.",
    ],
  };
}

function buildTraining(v: VisionAnalysis | null, focus: FocusKey, constraints: string): TrainingFocus {
  const c = constraints.toLowerCase();
  const knee = c.includes("knee");
  const noPartner = c.includes("no partner");
  const weaknesses = deriveWeaknessTags(v);

  const primary: string[] = [];
  const secondary: string[] = [];
  const avoid: string[] = [];

  if (weaknesses.includes("entry_timing")) primary.push("Entry timing: outside step → level change early (no pause).");
  if (weaknesses.includes("guard_exit")) primary.push("Exit discipline: guard stays high through reset + angle out.");
  if (weaknesses.includes("base_integrity")) primary.push("Base integrity: do not let stance collapse during transitions.");
  if (!primary.length) primary.push("Pick 1 technical theme from Vision and train it for reps.");

  if (focus === "Pressure") secondary.push("Wall pace: re-attack rule (no disengage).");
  if (focus === "Speed") secondary.push("Fast hands / entries: short bursts, sharp resets.");
  if (focus === "Power") secondary.push("Explosive actions: low volume, perfect form, full reset.");
  if (focus === "Recovery") secondary.push("Flow + mobility: leave fresher than you arrived.");
  if (focus === "Mixed") secondary.push("Balanced rounds: one sharp technical theme, one conditioning theme.");

  if (noPartner) avoid.push("Hard sparring as a substitute for real reps.");
  if (knee) avoid.push("Hard pivots / reckless shots until warmed and stable.");
  avoid.push("High-volume chaos sessions that do not target the directive.");

  return { primary, secondary, avoid };
}

function buildControl(v: VisionAnalysis | null, constraints: string): CampControl {
  const c = constraints.toLowerCase();
  const fightWeek = c.includes("fight week") || c.includes("weigh-in");
  const injury = c.includes("knee") || c.includes("shoulder") || c.includes("back");
  const highFindings = (v?.findings ?? []).filter((f) => f.severity === "HIGH").length;

  let trainingLoad: CampControl["trainingLoad"] = "MODERATE";
  if (fightWeek) trainingLoad = "LOW";
  if (injury) trainingLoad = "LOW";
  if (highFindings >= 2 && !fightWeek && !injury) trainingLoad = "HIGH";

  const warnings: string[] = [];
  if (!v) warnings.push("No Vision loaded → you are guessing. Run Sensei Vision.");
  if (fightWeek) warnings.push("Fight-week mode: reduce injury risk, keep sharpness, control fatigue.");
  if (injury) warnings.push("Injury constraint present: cut intensity before form breaks.");
  warnings.push("If the directive fails under fatigue, reduce chaos and increase clean reps.");

  const nextStep: string[] = [];
  nextStep.push("Run a 20–40 minute technical block on the directive.");
  nextStep.push("Use the gym tab only as support after the camp directive is set.");
  nextStep.push("After the session, log another clip and re-run Vision.");

  return { trainingLoad, warnings, nextStep };
}

function buildSystemStatus(
  vision: VisionAnalysis | null,
  fuel: { score?: number; report?: string } | null,
  camp: SavedCamp | null
): SenseiSystemStatus {
  return {
    visionConnected: !!vision,
    visionLabel: vision
      ? `Last analysis: ${vision.clipLabel || vision.technique_detected || "Vision loaded"}`
      : "No recent Vision analysis.",
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
    if (!watchOut.length) {
      watchOut.push("Confirm schedule and room fit before committing.");
    }

    return {
      id: gym.id,
      name: gym.name,
      location: location || gym.address || "Location not set",
      compatibility: score,
      reason: reason.slice(0, 3),
      bestFor: bestFor.length ? bestFor.slice(0, 3) : ["General training support"],
      watchOut: watchOut.slice(0, 3),
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

export default function SenseiClient() {
  const { profile } = useProfile();

  const savedCampRef = useRef<SavedCamp | null>(null);
  const realGymsRef = useRef<GymRow[]>([]);
  const lastVisionRef = useRef<VisionAnalysis | null>(null);
  const lastFuelRef = useRef<{ score?: number; report?: string; followups_id?: string } | null>(null);

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
  const [systemStatus, setSystemStatus] = useState<SenseiSystemStatus>({
    visionConnected: false,
    visionLabel: "No recent Vision analysis.",
    fuelConnected: false,
    fuelLabel: "No recent Fuel report.",
    campSaved: false,
    campLabel: "No saved camp yet.",
  });

  const [followupsId] = useState<string | null>("camp_local");
  const [activeChatSection, setActiveChatSection] = useState<AskSectionId>("all");
  const [chatInput, setChatInput] = useState("");
  const [chatSending, setChatSending] = useState(false);

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: uid(),
      role: "system",
      section: "all",
      text: "Sensei = camp control. Vision = analysis. Build camp, then ask about decisions.",
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
      setStatusLabel("Ready");
      setBuildStage("DONE");
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
      savedAt: Date.now(),
    };

    saveCamp(payload);
    savedCampRef.current = payload;
    setSystemStatus(buildSystemStatus(lastVisionRef.current, lastFuelRef.current, payload));
  }, [focus, baseArt, styleTags, constraints, directive, trainingFocus, gyms, control]);

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
        text: "Reset complete. Run Vision then build camp.",
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

      const weaknessTags = deriveWeaknessTags(vision);

      setBuildStage("SETTING_DIRECTIVE");
      await delay(450);
      const d = buildDirective(vision, focus);

      setBuildStage("BUILDING_TRAINING");
      await delay(500);
      const t = buildTraining(vision, focus, constraints);

      setBuildStage("SETTING_CONTROL");
      await delay(420);
      const c = buildControl(vision, constraints);

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

      setChatMessages((prev) => [
        ...prev,
        {
          id: uid(),
          role: "system",
          section: "all",
          text: vision
            ? `Camp built from Vision: "${vision.clipLabel}". Focus=${focus}. Weakness tags=${weaknessTags.join(", ") || "none"}.`
            : "Camp built without Vision. Run Sensei Vision to stop guessing.",
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

  function onChatKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!chatSending) onSendChat();
    }
  }

  async function onSendChat() {
    const text = chatInput.trim();
    if (!text) return;

    const section = activeChatSection;

    setChatMessages((prev) => [
      ...prev,
      {
        id: uid(),
        role: "user",
        section,
        text,
        ts: Date.now(),
      },
    ]);
    setChatInput("");
    setChatSending(true);

    try {
      const vision = lastVisionRef.current;
      const topFinding = vision?.findings?.find((f) => f.severity === "HIGH") ?? vision?.findings?.[0];
      const best = gyms[0];

      const replyLines: string[] = [];
      replyLines.push("Decision:");
      if (!directive || !trainingFocus) replyLines.push("- Build camp first.");
      else replyLines.push(`- Directive: ${directive.title}`);

      replyLines.push("Next steps:");
      if (topFinding) replyLines.push(`- Fix first: ${topFinding.title}`);
      replyLines.push("- Keep it executable: reps → short rounds → re-test with Vision.");
      if (best) replyLines.push(`- Gym support option: ${best.name} (${best.compatibility}% match).`);

      setChatMessages((prev) => [
        ...prev,
        {
          id: uid(),
          role: "sensei",
          section,
          text: replyLines.join("\n"),
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