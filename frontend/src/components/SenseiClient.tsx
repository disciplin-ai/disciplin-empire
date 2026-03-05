"use client";

import React, { useMemo, useRef, useState } from "react";
import SenseiScreen, {
  AskSectionId,
  BaseArt,
  CampControl,
  CampDirective,
  ChatMessage,
  FocusKey,
  GymCandidate,
  TrainingFocus,
} from "@/components/SenseiScreen";
import type { VisionAnalysis } from "@/components/SenseiVisionScreen";

function uid() {
  return Math.random().toString(36).slice(2);
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

function deriveWeaknessTags(v: VisionAnalysis | null): string[] {
  if (!v) return [];
  const t = v.findings.map((f) => f.title.toLowerCase());
  const tags: string[] = [];
  if (t.some((x) => x.includes("telegraph") || x.includes("level change") || x.includes("entry"))) tags.push("entry_timing");
  if (t.some((x) => x.includes("hands drop") || x.includes("guard"))) tags.push("guard_exit");
  if (t.some((x) => x.includes("stance") || x.includes("base"))) tags.push("base_integrity");
  return tags;
}

/**
 * Super simple scoring now:
 * - Later: replace with DB fields (gym strengths, coaching focus, sparring intensity, etc.)
 */
function scoreGyms(args: {
  focus: FocusKey;
  baseArt: BaseArt;
  styleTags: string;
  weaknessTags: string[];
}): GymCandidate[] {
  const style = args.styleTags.toLowerCase();

  // Your “listed gyms” can be a real DB later.
  const gyms: GymCandidate[] = [
    {
      id: "kuma",
      name: "Kuma Team",
      location: "Dubai",
      compatibility: 84,
      reason: ["Hard rounds culture.", "Strong grappling rooms for pressure styles.", "Good place to test cardio + grit."],
      bestFor: ["Pressure wrestling", "Scrambles", "Cage control (if available)"],
      watchOut: ["If you’re injury-prone, manage intensity.", "If you only need technical polish, don’t drown in wars."],
      href: "/gyms/kuma",
    },
    {
      id: "striking_room",
      name: "High-Discipline Striking Room",
      location: "Dubai",
      compatibility: 78,
      reason: ["Sharp pad work and timing focus.", "Cleaner reps; less ego sparring if coached right."],
      bestFor: ["Speed focus", "Exit discipline", "Range control"],
      watchOut: ["If the room is too light, your pressure may regress.", "Confirm sparring quality before committing."],
      href: "/gyms/striking-room",
    },
    {
      id: "wrestling_room",
      name: "Chain Wrestling Room",
      location: "Dubai",
      compatibility: 80,
      reason: ["Entries + hand-fight emphasis.", "Higher reps, less chaos, better for fixing timing."],
      bestFor: ["Entry timing", "Level change mechanics", "Re-shots"],
      watchOut: ["If no live resistance, you must add situational rounds elsewhere."],
      href: "/gyms/chain-wrestling-room",
    },
  ];

  // Adjust by focus
  for (const g of gyms) {
    if (args.focus === "Pressure" && (g.id === "kuma" || g.id === "wrestling_room")) g.compatibility += 10;
    if (args.focus === "Speed" && g.id === "striking_room") g.compatibility += 12;
    if (args.focus === "Power" && g.id === "striking_room") g.compatibility += 6;
    if (args.focus === "Recovery") g.compatibility -= 8;
  }

  // Adjust by style tags
  if (style.includes("pressure")) {
    gyms.find((g) => g.id === "kuma")!.compatibility += 6;
    gyms.find((g) => g.id === "wrestling_room")!.compatibility += 4;
  }
  if (style.includes("southpaw") || style.includes("counter")) {
    gyms.find((g) => g.id === "striking_room")!.compatibility += 5;
  }

  // Adjust by weaknesses from Vision
  if (args.weaknessTags.includes("entry_timing")) gyms.find((g) => g.id === "wrestling_room")!.compatibility += 10;
  if (args.weaknessTags.includes("guard_exit")) gyms.find((g) => g.id === "striking_room")!.compatibility += 9;
  if (args.weaknessTags.includes("base_integrity")) gyms.find((g) => g.id === "wrestling_room")!.compatibility += 5;

  // clamp
  for (const g of gyms) g.compatibility = Math.max(0, Math.min(99, Math.round(g.compatibility)));

  return gyms.sort((a, b) => b.compatibility - a.compatibility);
}

function buildDirective(v: VisionAnalysis | null, focus: FocusKey): CampDirective {
  if (!v) {
    return {
      title: `Set a real directive (run Sensei Vision)`,
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
  if (!primary.length) primary.push("Pick 1 technical theme from Vision and train it for reps.");

  if (focus === "Pressure") secondary.push("Wall pace: re-attack rule (no disengage).");
  if (focus === "Speed") secondary.push("Fast hands: 6x2 min—touch, exit, reset.");
  if (focus === "Power") secondary.push("Explosive actions: low volume, full reset, perfect form.");
  if (focus === "Recovery") secondary.push("Flow + mobility: leave fresher than you arrived.");
  if (focus === "Mixed") secondary.push("Balanced rounds: 3x striking + 3x grappling focus blocks.");

  if (noPartner) avoid.push("Hard sparring as a substitute for real reps.");
  if (knee) avoid.push("Hard pivots / reckless shots until warmed + stable.");
  avoid.push("High volume chaos sessions that don’t target the directive.");

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
  if (!v) warnings.push("No Vision loaded → you’re guessing. Run Sensei Vision.");
  if (fightWeek) warnings.push("Fight-week mode: reduce GI risk, reduce injury risk, keep intensity controlled.");
  if (injury) warnings.push("Injury constraint present: cut intensity before form breaks.");
  warnings.push("If the directive fails under fatigue, reduce rounds and increase technical reps.");

  const nextStep: string[] = [];
  nextStep.push("Run a 20–40 minute technical block on the directive (reps > wars).");
  nextStep.push("Pick the best gym match for your style and weakness.");
  nextStep.push("After session: log 1 clip and re-run Vision (proof of improvement).");

  return { trainingLoad, warnings, nextStep };
}

/* ========================= COMPONENT ========================= */

export default function SenseiClient() {
  const [focus, setFocus] = useState<FocusKey>("Pressure");
  const [baseArt, setBaseArt] = useState<BaseArt>("MMA");
  const [styleTags, setStyleTags] = useState<string>("pressure wrestler, forward pressure");
  const [constraints, setConstraints] = useState<string>("60 min, no partner today");

  const [busy, setBusy] = useState(false);
  const [statusLabel, setStatusLabel] = useState<"Idle" | "Building" | "Ready" | "Error">("Idle");

  const [directive, setDirective] = useState<CampDirective | null>(null);
  const [trainingFocus, setTrainingFocus] = useState<TrainingFocus | null>(null);
  const [gyms, setGyms] = useState<GymCandidate[]>([]);
  const [control, setControl] = useState<CampControl | null>(null);

  // Chat (optional) — you can wire to /api/sensei later
  const [followupsId, setFollowupsId] = useState<string | null>("camp_local");
  const [activeChatSection, setActiveChatSection] = useState<AskSectionId>("all");
  const [chatInput, setChatInput] = useState("");
  const [chatSending, setChatSending] = useState(false);

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { id: uid(), role: "system", section: "all", text: "Sensei = camp control. Vision = analysis. Build camp, then ask about decisions.", ts: Date.now() },
  ]);

  const lastVisionRef = useRef<VisionAnalysis | null>(null);

  const statusTone = statusLabel === "Ready" ? "good" : statusLabel === "Building" ? "warn" : statusLabel === "Error" ? "bad" : "neutral";

  function onOpenVision() {
    window.location.href = "/sensei-vision";
  }

  function onReset() {
    setDirective(null);
    setTrainingFocus(null);
    setGyms([]);
    setControl(null);

    setStatusLabel("Idle");
    setBusy(false);

    setChatMessages([
      { id: uid(), role: "system", section: "all", text: "Reset complete. Run Vision then build camp.", ts: Date.now() },
    ]);
  }

  async function onBuildCamp() {
    setBusy(true);
    setStatusLabel("Building");

    try {
      // Pull latest Vision analysis (if any)
      const vision = safeParseVision();
      lastVisionRef.current = vision;

      const weaknessTags = deriveWeaknessTags(vision);

      const d = buildDirective(vision, focus);
      const t = buildTraining(vision, focus, constraints);
      const g = scoreGyms({ focus, baseArt, styleTags, weaknessTags });
      const c = buildControl(vision, constraints);

      // Small delay makes the UI feel intentional (remove later)
      await new Promise((r) => setTimeout(r, 180));

      setDirective(d);
      setTrainingFocus(t);
      setGyms(g);
      setControl(c);

      setChatMessages((prev) => [
        ...prev,
        {
          id: uid(),
          role: "system",
          section: "all",
          text: vision
            ? `Camp built from Vision: "${vision.clipLabel}". Focus=${focus}. Weakness tags=${weaknessTags.join(", ") || "none"}.`
            : `Camp built WITHOUT Vision. Run Sensei Vision to stop guessing.`,
          ts: Date.now(),
        },
      ]);

      setStatusLabel("Ready");
    } catch (e: any) {
      setStatusLabel("Error");
      setChatMessages((prev) => [
        ...prev,
        { id: uid(), role: "system", section: "all", text: `Camp build failed: ${e?.message ?? "unknown error"}`, ts: Date.now() },
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

    setChatMessages((prev) => [...prev, { id: uid(), role: "user", section, text, ts: Date.now() }]);
    setChatInput("");
    setChatSending(true);

    // For now: local “coach-like” reply (wire to /api/sensei later)
    try {
      const vision = lastVisionRef.current;
      const topFinding = vision?.findings?.find((f) => f.severity === "HIGH") ?? vision?.findings?.[0];

      const replyLines: string[] = [];
      replyLines.push("Decision:");
      if (!directive || !trainingFocus) replyLines.push("- Build camp first.");
      else replyLines.push(`- Directive: ${directive.title}`);

      replyLines.push("Next steps:");
      if (topFinding) replyLines.push(`- Fix first: ${topFinding.title}`);
      replyLines.push("- Keep it executable: reps → short rounds → re-test with Vision.");
      if (gyms[0]) replyLines.push(`- Best gym match today: ${gyms[0].name} (${gyms[0].compatibility}% match).`);

      setChatMessages((prev) => [
        ...prev,
        { id: uid(), role: "sensei", section, text: replyLines.join("\n"), ts: Date.now() },
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
      onBuildCamp={onBuildCamp}
      onReset={onReset}
      onOpenVision={onOpenVision}
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
      statusLabel={statusLabel}
      statusTone={statusTone}
    />
  );
}