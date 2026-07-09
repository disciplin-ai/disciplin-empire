"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useFighterContext } from "@/hooks/useFighterContext";
import {
  getLockState,
  normalizeDirectiveProgress,
  type DirectiveProgress,
} from "@/lib/disciplin/types";

type WeightStatus =
  | "On Track"
  | "Slightly Behind"
  | "Off Track"
  | "No Fight Scheduled";

type VisionFinding = {
  id?: string;
  title: string;
  severity: "LOW" | "MEDIUM" | "HIGH";
  interrupt?: string;
  fix_next_rep?: string;
  dashboard_detail?: string;
  if_ignored?: string;
  short_detail?: string;
  detail?: string;
  good?: string;
  unstable?: string;
  break_point?: string;
  train?: string[];
};

type VisionAnalysis = {
  analysis_id?: string;
  clipLabel?: string;
  summary?: string;
  findings?: VisionFinding[];
};

type CampDirective = {
  title: string;
  source: string;
  bullets: string[];
};

type TrainingFocus = {
  primary: string[];
  secondary: string[];
  avoid: string[];
};

type CampControl = {
  trainingLoad: "LOW" | "MODERATE" | "HIGH";
  warnings: string[];
  nextStep: string[];
};

type DailySession = {
  title: string;
  durationMin: number;
  timingLabel: string;
  goal: string;
  blocks: string[];
};

type SavedCamp = {
  focus: string;
  baseArt: string;
  styleTags: string;
  constraints: string;
  directive: CampDirective | null;
  trainingFocus: TrainingFocus | null;
  control: CampControl | null;
  dailySession: DailySession | null;
  savedAt: number;
};

type FuelMemory = {
  score?: number;
  report?: string;
};

type WeightLog = {
  value: number;
  loggedAt: string;
};

type ProofMemory = {
  dataUrl: string;
  mimeType: string;
  fileName: string;
  uploadedAt: string;
};

const DIRECTIVE_PROGRESS_KEY = "disciplin_directive_progress";
const LAST_PROOF_KEY = "disciplin_last_proof";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeJson<T>(key: string, value: T) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

function cleanSentence(text?: string | null) {
  return String(text || "")
    .replace(/\.{3,}|…/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function compactSentence(text?: string | null, max = 160) {
  const clean = cleanSentence(text);
  if (!clean) return "";
  if (clean.length <= max) return clean;

  const sliced = clean.slice(0, max).trim();
  const lastSpace = sliced.lastIndexOf(" ");

  if (lastSpace > 30) return sliced.slice(0, lastSpace).trim();
  return sliced;
}

function firstGoodText(...values: Array<string | null | undefined>) {
  for (const value of values) {
    const cleaned = cleanSentence(value);
    if (cleaned) return cleaned;
  }
  return "";
}

function daysUntil(dateStr?: string | null): number | null {
  if (!dateStr) return null;
  const now = new Date();
  const target = new Date(dateStr);
  if (Number.isNaN(target.getTime())) return null;

  const ms = target.getTime() - now.getTime();
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

function getLatestWeight(
  logs: WeightLog[],
  fallback?: number | null
): number | null {
  if (logs.length > 0) return logs[logs.length - 1].value;
  if (typeof fallback === "number" && Number.isFinite(fallback)) return fallback;
  return null;
}

function buildWeightStatus(args: {
  currentWeight: number | null;
  targetWeight: number | null;
  daysRemaining: number | null;
}): WeightStatus {
  const { currentWeight, targetWeight, daysRemaining } = args;

  if (daysRemaining === null) return "No Fight Scheduled";
  if (currentWeight === null || targetWeight === null)
    return "No Fight Scheduled";

  const diff = currentWeight - targetWeight;
  if (diff <= 0.5) return "On Track";

  const requiredPerDay = diff / Math.max(daysRemaining, 1);
  if (requiredPerDay <= 0.35) return "On Track";
  if (requiredPerDay <= 0.6) return "Slightly Behind";
  return "Off Track";
}

function statusTone(status: WeightStatus): "good" | "warn" | "bad" | "neutral" {
  if (status === "On Track") return "good";
  if (status === "Slightly Behind") return "warn";
  if (status === "Off Track") return "bad";
  return "neutral";
}

function getFuelTone(score?: number): "good" | "warn" | "bad" | "neutral" {
  if (typeof score !== "number") return "neutral";
  if (score >= 75) return "good";
  if (score >= 50) return "warn";
  return "bad";
}

function fuelStatusLine(score?: number) {
  if (typeof score !== "number") return "No recent Fuel analysis.";
  if (score >= 80) return "Fuel support is strong for current camp load.";
  if (score >= 60) return "Fuel support is acceptable, but can be tighter.";
  if (score >= 40)
    return "Fuel support is under target for reliable camp output.";
  return "Fuel support is weak and likely hurting recovery or performance.";
}

function fuelSnippet(report?: string) {
  const text = cleanSentence(report);
  if (!text)
    return "Run Fuel AI to generate a nutrition report tied to your training.";
  return compactSentence(text, 120);
}

function severityTone(
  severity?: VisionFinding["severity"]
): "good" | "warn" | "bad" | "neutral" {
  if (severity === "HIGH") return "bad";
  if (severity === "MEDIUM") return "warn";
  if (severity === "LOW") return "good";
  return "neutral";
}

function badgeToneForLoad(
  load?: CampControl["trainingLoad"]
): "neutral" | "good" | "warn" | "bad" {
  if (load === "LOW") return "good";
  if (load === "MODERATE") return "warn";
  if (load === "HIGH") return "bad";
  return "neutral";
}

function fallbackInterrupt(title?: string, detail?: string) {
  const t = String(title || "").toLowerCase();
  const d = String(detail || "").toLowerCase();

  if (t.includes("hips") || d.includes("hips"))
    return "Stop. Hips under you now.";
  if (t.includes("head") || d.includes("head"))
    return "Stop. Head up before contact.";
  if (t.includes("hand") || t.includes("reach") || d.includes("reach"))
    return "Stop reaching. Feet first.";
  if (t.includes("trail leg") || d.includes("trail leg"))
    return "Stop. Bring the trail leg under.";
  if (t.includes("foot") || d.includes("foot"))
    return "Stop. Bring the back foot up.";

  return "Stop. Fix position before continuing.";
}

function fallbackFixNextRep(title?: string, detail?: string) {
  const t = String(title || "").toLowerCase();
  const d = String(detail || "").toLowerCase();

  if (t.includes("hips") || d.includes("hips")) {
    return "Step deep. Drop the knee. Bring hips under before reaching.";
  }
  if (t.includes("head") || d.includes("head")) {
    return "Head up, connected, then drive through the finish.";
  }
  if (t.includes("hand") || t.includes("reach") || d.includes("reach")) {
    return "Move feet first. Do not let the hands chase the shot.";
  }
  if (
    t.includes("trail leg") ||
    d.includes("trail leg") ||
    t.includes("back foot")
  ) {
    return "After penetration, immediately step your trail foot up under your hips before adjusting the finish.";
  }

  return "Restore structure first. Then continue the rep.";
}

function buildWhyItMatters(primary: VisionFinding | null, summary?: string) {
  if (!primary)
    return "Run Vision again to generate a tighter correction summary.";

  const text = firstGoodText(
    primary.dashboard_detail,
    primary.unstable,
    primary.break_point,
    primary.detail,
    primary.short_detail,
    summary
  );

  if (text) return compactSentence(text, 150);

  return "This correction is costing structure and making the exchange easier to stop.";
}

function buildIfIgnored(primary: VisionFinding | null) {
  if (!primary) return "You lose the exchange before the finish is established.";

  const text = firstGoodText(
    primary.if_ignored,
    primary.break_point,
    primary.short_detail
  );

  if (text) return compactSentence(text, 140);

  return "Opponent gets the defensive answer before the finish is established.";
}

function buildTrainToday(
  topCorrection: VisionFinding | null,
  session: DailySession | null,
  camp: SavedCamp | null
) {
  if (topCorrection?.train?.length) {
    return topCorrection.train
      .slice(0, 2)
      .map((item) => cleanSentence(item))
      .filter(Boolean);
  }
  if (session?.blocks?.length) {
    return session.blocks.slice(0, 4).map((item) => cleanSentence(item));
  }

  const title = String(topCorrection?.title || "").toLowerCase();

  if (title.includes("hips")) {
    return [
      "Paused penetration steps with hips under shoulders.",
      "Freeze-and-continue entries focused on posture.",
      "Wall shots focused only on hip line and drive.",
      "Light shadow reps on the same correction.",
    ];
  }

  if (title.includes("hand") || title.includes("reach")) {
    return [
      "Feet-first entry reps.",
      "Re-attack shots without reaching.",
      "Hand discipline against light reaction defense.",
      "Shadow reps with strict hand timing.",
    ];
  }

  if (title.includes("trail leg") || title.includes("back foot")) {
    return [
      "Penetration-to-trail-foot recovery reps.",
      "Freeze after the knee, then step the back foot up.",
      "Finish chains focused only on base recovery.",
      "Shadow reps on stepping the trail foot under the hips.",
    ];
  }

  const primary = camp?.trainingFocus?.primary ?? [];
  if (primary.length) return primary.slice(0, 4).map((item) => cleanSentence(item));

  return [
    "Build camp in Sensei.",
    "Run one technical block instead of random rounds.",
    "Carry one correction through the full session.",
    "Retest the same issue after the session.",
  ];
}

function buildCoachNotes(camp: SavedCamp | null, fuelLoaded: boolean) {
  const notes: string[] = [];

  if (camp?.directive?.bullets?.length) {
    notes.push(...camp.directive.bullets.slice(0, 2));
  }
  if (camp?.control?.warnings?.length) {
    notes.push(...camp.control.warnings.slice(0, 1));
  }
  if (!fuelLoaded) {
    notes.push(
      "No Fuel data loaded: training decisions are being made without nutrition or recovery context."
    );
  }

  return notes.slice(0, 3).map((item) => cleanSentence(item));
}

function escalationLine(progress: DirectiveProgress) {
  if (progress.repeatedFailureCount <= 0) return "Initial detection.";
  if (progress.repeatedFailureCount === 1) return "Same break repeated.";
  if (progress.repeatedFailureCount === 2) return "Habit forming.";
  return "Pattern is being protected.";
}

function proofLine(progress: DirectiveProgress) {
  if (progress.proofType === "self_report")
    return "Self-report does not unlock.";
  if (progress.proofType === "none") return "Proof missing.";
    return `Proof loaded: ${progress.proofType}.`;
}

function buildSuccessToday(progress: DirectiveProgress) {
  return [
    `Hit ${progress.repsRequired} clean reps under resistance.`,
    "Keep the correction intact under real reaction.",
    "Submit proof through image, video, or metrics.",
  ];
}

function buildBannedToday(primaryCorrection: VisionFinding | null) {
  const correctionTitle = cleanSentence(primaryCorrection?.title).toLowerCase();

  if (correctionTitle.includes("hips")) {
    return [
      "No random live wars before position is stable.",
      "No reaching while hips are behind.",
      "No secondary flaws before this holds.",
    ];
  }

  if (correctionTitle.includes("hand") || correctionTitle.includes("reach")) {
    return [
      "No hands before feet.",
      "No volume reps that reinforce the entry.",
      "No pretending clean drilling equals live transfer.",
    ];
  }

  return [
    "No variety chasing.",
    "No new themes before verification.",
    "No calling repetition progress.",
  ];
}

function Badge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "good" | "warn" | "bad" | "locked" | "recovery" | "psych";
}) {
  const cls =
    tone === "good"
      ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-100"
      : tone === "warn"
      ? "border-amber-400/25 bg-amber-400/10 text-amber-100"
      : tone === "bad"
      ? "border-rose-400/25 bg-rose-400/10 text-rose-100"
      : tone === "locked"
      ? "border-yellow-300/30 bg-yellow-300/10 text-yellow-100"
      : tone === "recovery"
      ? "border-cyan-300/25 bg-cyan-300/10 text-cyan-100"
      : tone === "psych"
      ? "border-violet-300/25 bg-violet-300/10 text-violet-100"
      : "border-white/[0.08] bg-white/[0.04] text-white/65";

  return (
        <span
      suppressHydrationWarning
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-semibold tracking-wide",
        cls
      )}
    >
      {children}
    </span>
  );
}

function StatusDot({ tone }: { tone: "good" | "warn" | "bad" | "neutral" }) {
  const cls =
    tone === "good"
      ? "bg-emerald-300"
      : tone === "warn"
      ? "bg-amber-300"
      : tone === "bad"
      ? "bg-rose-300"
      : "bg-white/30";

  return <span className={cn("h-1.5 w-1.5 rounded-full", cls)} />;
}

function AppCard({
  title,
  sub,
  right,
  children,
  strong = false,
  compact = false,
  tone = "neutral",
}: {
  title: string;
  sub?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  strong?: boolean;
  compact?: boolean;
  tone?: "neutral" | "training" | "fuel" | "recovery" | "psych" | "danger" | "locked";
}) {
  const toneRing =
    tone === "training"
      ? "border-emerald-400/18"
      : tone === "fuel"
      ? "border-amber-300/20"
      : tone === "recovery"
      ? "border-cyan-300/18"
      : tone === "psych"
      ? "border-violet-300/18"
      : tone === "danger"
      ? "border-rose-400/22"
      : tone === "locked"
      ? "border-yellow-300/22"
      : "border-white/[0.08]";

  return (
    <section
      className={cn(
        "group rounded-[28px] border shadow-[0_18px_70px_rgba(0,0,0,0.34)] backdrop-blur-xl transition duration-300 hover:-translate-y-0.5 hover:border-white/16",
        compact ? "p-4" : "p-5",
        strong
          ? "bg-[radial-gradient(circle_at_top_left,rgba(52,211,153,0.16),transparent_34%),linear-gradient(145deg,rgba(15,31,55,0.94),rgba(3,11,24,0.96)_58%,rgba(2,8,16,0.98))]"
          : "bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.025))]",
        toneRing
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-white">{title}</div>
          {sub ? <div className="mt-1 text-xs leading-5 text-white/45">{sub}</div> : null}
        </div>
        {right}
      </div>
      <div className={compact ? "mt-3" : "mt-5"}>{children}</div>
    </section>
  );
}

function BulletList({
  items,
  tone = "emerald",
  compact = false,
}: {
  items: string[];
  tone?: "emerald" | "amber" | "rose" | "cyan" | "violet";
  compact?: boolean;
}) {
  const dotClass =
    tone === "amber"
      ? "bg-amber-300/80"
      : tone === "rose"
      ? "bg-rose-300/80"
      : tone === "cyan"
      ? "bg-cyan-300/80"
      : tone === "violet"
      ? "bg-violet-300/80"
      : "bg-emerald-300/80";

  return (
    <ul
      className={cn(
        "text-sm text-white/86",
        compact ? "space-y-1.5" : "space-y-2.5"
      )}
    >
      {items.map((item, i) => (
        <li key={i} className="flex min-w-0 items-start gap-2">
          <span
            className={cn("mt-2 h-1.5 w-1.5 shrink-0 rounded-full", dotClass)}
          />
          <span className="min-w-0 whitespace-normal break-words leading-7">
            {cleanSentence(item)}
          </span>
        </li>
      ))}
    </ul>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[20px] border border-white/[0.07] bg-black/24 p-3">
      <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/38">
        {label}
      </div>
      <div suppressHydrationWarning className="mt-2 text-sm font-semibold text-white">
        {value}
      </div>
    </div>
  );
}

function ActionButton({
  href,
  label,
  strong = false,
  disabled = false,
}: {
  href: string;
  label: string;
  strong?: boolean;
  disabled?: boolean;
}) {
  if (disabled) {
    return (
      <div
        className={cn(
          "rounded-[20px] border px-4 py-3 text-center text-sm opacity-50",
          strong
            ? "border-emerald-400/10 bg-emerald-500/8 text-emerald-50"
            : "border-white/[0.07] bg-black/25 text-white"
        )}
      >
        {label}
      </div>
    );
  }

  return (
    <Link
      href={href}
      className={cn(
        "rounded-[20px] border px-4 py-3 text-center text-sm transition duration-200 active:scale-[0.98]",
        strong
          ? "border-emerald-300/25 bg-emerald-300 font-semibold text-[#03120d] shadow-[0_16px_40px_rgba(52,211,153,0.18)] hover:bg-emerald-200"
          : "border-white/[0.08] bg-white/[0.045] text-white hover:border-white/18 hover:bg-white/[0.07]"
      )}
    >
      {label}
    </Link>
  );
}

function RepDots({
  completed,
  required,
}: {
  completed: number;
  required: number;
}) {
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: required }).map((_, i) => {
        const filled = i < completed;
        return (
          <span
            key={i}
            className={cn(
              "h-4 w-4 rounded-full border transition duration-300",
              filled
                ? "border-emerald-300 bg-emerald-300 shadow-[0_0_20px_rgba(52,211,153,0.35)]"
                : "border-white/14 bg-white/[0.035]"
            )}
          />
        );
      })}
    </div>
  );
}

function ModuleLink({
  href,
  label,
  symbol,
  tone,
  state,
}: {
  href: string;
  label: string;
  symbol: string;
  tone: "training" | "fuel" | "recovery" | "psych" | "locked";
  state: string;
}) {
  const dotClass =
    tone === "training"
      ? "bg-emerald-300"
      : tone === "fuel"
      ? "bg-amber-300"
      : tone === "recovery"
      ? "bg-cyan-200"
      : tone === "psych"
      ? "bg-violet-300"
      : "bg-yellow-300";

  return (
    <Link
      href={href}
      className="group flex min-h-[68px] items-center gap-3 rounded-[18px] px-3 py-3 transition duration-200 hover:bg-white/[0.07] active:scale-[0.98]"
    >
      <div className="relative grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-white/10 bg-white/[0.055] text-[17px] font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
        <span className="leading-none">{symbol}</span>
        <span
          className={cn(
            "absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-[#050b14]",
            dotClass
          )}
        />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-semibold text-white">
          {label}
        </div>
        <div className="mt-0.5 truncate text-[11px] font-medium text-white/50">
          {state}
        </div>
      </div>
      <div className="text-[18px] text-white/25 transition group-hover:translate-x-0.5 group-hover:text-white/55">
        ›
      </div>
    </Link>
  );
}

export default function DashboardClient() {
  const { fighterContext } = useFighterContext();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const [camp, setCamp] = useState<SavedCamp | null>(null);
  const [vision, setVision] = useState<VisionAnalysis | null>(null);
  const [fuel, setFuel] = useState<FuelMemory | null>(null);
  const [weightLogs, setWeightLogs] = useState<WeightLog[]>([]);
  const [weightInput, setWeightInput] = useState("");
  const [showSupporting, setShowSupporting] = useState(false);
  const [showSystems, setShowSystems] = useState(false);
  const [latestProof, setLatestProof] = useState<ProofMemory | null>(null);

  const [directiveProgress, setDirectiveProgress] = useState<DirectiveProgress>(
    normalizeDirectiveProgress(
      readJson<DirectiveProgress>(DIRECTIVE_PROGRESS_KEY) ?? undefined
    )
  );

  useEffect(() => {
    setCamp(readJson<SavedCamp>("disciplin_latest_camp"));
    setVision(readJson<VisionAnalysis>("disciplin_latest_vision"));
    setFuel(readJson<FuelMemory>("disciplin_latest_fuel"));
    setWeightLogs(readJson<WeightLog[]>("disciplin_weight_logs") ?? []);
    setLatestProof(readJson<ProofMemory>(LAST_PROOF_KEY));
  }, []);

  useEffect(() => {
    writeJson(DIRECTIVE_PROGRESS_KEY, directiveProgress);
  }, [directiveProgress]);

  const fightDate = fighterContext.camp.fightDate;
  const weightClass = fighterContext.identity.weightClass ?? "Not set";
  const profileCurrentWeight = fighterContext.identity.currentWeight;
  const targetWeight = fighterContext.identity.targetWeight;

  const currentWeight = getLatestWeight(weightLogs, profileCurrentWeight);
  const daysRemaining = daysUntil(fightDate);

  const weightStatus = buildWeightStatus({
    currentWeight,
    targetWeight,
    daysRemaining,
  });

  const weightDifference =
    currentWeight !== null && typeof targetWeight === "number"
      ? Number((currentWeight - targetWeight).toFixed(1))
      : null;

  const progressPct =
    currentWeight !== null && typeof targetWeight === "number"
      ? Math.max(
          0,
          Math.min(100, 100 - Math.max(0, currentWeight - targetWeight) * 8)
        )
      : 0;

  const findings = useMemo(
    () => (Array.isArray(vision?.findings) ? vision.findings : []),
    [vision]
  );

  const primaryCorrection = findings[0] ?? null;
  const secondaryCorrections = findings.slice(1, 3);

  const lockState = getLockState({
    directive: {
      present: !!primaryCorrection?.title,
      correction: primaryCorrection?.title || null,
    },
    progress: directiveProgress,
      });

  const correctionInterrupt =
    primaryCorrection?.interrupt ||
    fallbackInterrupt(primaryCorrection?.title, primaryCorrection?.detail);

  const fixNextRep =
    primaryCorrection?.fix_next_rep ||
    fallbackFixNextRep(primaryCorrection?.title, primaryCorrection?.detail);

  const whyItMatters = buildWhyItMatters(primaryCorrection, vision?.summary);
  const costIfIgnored = buildIfIgnored(primaryCorrection);

  const executionBlocks = buildTrainToday(
    primaryCorrection,
    camp?.dailySession ?? null,
    camp
  );

  const coachNotes = useMemo(
    () => buildCoachNotes(camp, !!fuel?.score || !!fuel?.report),
    [camp, fuel]
  );

  const successToday = buildSuccessToday(directiveProgress);
  const bannedToday = buildBannedToday(primaryCorrection);

  function handleLogWeight() {
    const value = Number(weightInput);
    if (!Number.isFinite(value) || value <= 0) return;

    const next: WeightLog[] = [
      ...weightLogs,
      {
        value,
        loggedAt: new Date().toISOString(),
      },
    ];

    setWeightLogs(next);
    localStorage.setItem("disciplin_weight_logs", JSON.stringify(next));
    setWeightInput("");
  }

  function updateDirectiveProgress(
    patch:
      | Partial<DirectiveProgress>
      | ((prev: DirectiveProgress) => DirectiveProgress)
  ) {
    setDirectiveProgress((prev: DirectiveProgress) => {
      const next =
        typeof patch === "function"
          ? patch(prev)
          : {
              ...prev,
              ...patch,
            };

      return normalizeDirectiveProgress({
        ...prev,
        ...next,
        updatedAt: new Date().toISOString(),
      });
    });
  }

  function handleProofUpload(file: File | null) {
    if (!file) return;

    const isVideo = file.type.startsWith("video");
    const isImage = file.type.startsWith("image");

    if (!isVideo && !isImage) return;

    const reader = new FileReader();

    reader.onload = () => {
      const dataUrl = String(reader.result || "");
      if (!dataUrl) return;

      const proof: ProofMemory = {
        dataUrl,
        mimeType: file.type,
        fileName: file.name,
        uploadedAt: new Date().toISOString(),
      };

      writeJson(LAST_PROOF_KEY, proof);
      setLatestProof(proof);

      updateDirectiveProgress((prev: DirectiveProgress) => ({
        ...prev,
        repsCompleted: Math.min(prev.repsCompleted + 1, prev.repsRequired),
        proofType: isVideo ? "video" : "image",
        updatedAt: new Date().toISOString(),
      }));
    };

    reader.readAsDataURL(file);
  }

  const sessionTitle = camp?.dailySession?.title || "Correction session";

  const sessionMeta = camp?.dailySession
    ? `${camp.dailySession.timingLabel} · Goal: ${camp.dailySession.goal}`
    : "One correction. One session. No variety chasing.";

  const repsRemaining = Math.max(
    0,
    directiveProgress.repsRequired - directiveProgress.repsCompleted
  );

  const proofPercent = Math.round(
    (directiveProgress.repsCompleted /
      Math.max(directiveProgress.repsRequired, 1)) *
      100
  );

  const pressureTone =
    directiveProgress.repeatedFailureCount >= 2
      ? "bad"
      : directiveProgress.repeatedFailureCount === 1
      ? "warn"
      : "neutral";

  const recoveryLabel =
    fuel?.score === undefined
      ? "No recovery profile"
      : fuel.score >= 75
      ? "Ready"
      : fuel.score >= 50
      ? "Watch load"
      : "Protect recovery";

  const nextAction = lockState.locked
    ? repsRemaining > 0
      ? `Prove ${repsRemaining} clean rep${repsRemaining === 1 ? "" : "s"} under resistance.`
      : "Submit proof to clear the lock."
    : "Open the next correction layer.";

  const commandFeed = [
    primaryCorrection
      ? `Sensei: ${compactSentence(fixNextRep, 100)}`
      : "Sensei: upload a Vision clip to create the active correction.",
    `Lock: ${
      lockState.locked
        ? `${directiveProgress.repsCompleted}/${directiveProgress.repsRequired} verified`
        : "correction verified"
    }.`,
    `Fuel: ${fuelStatusLine(fuel?.score)}`,
    `Pressure: ${mounted ? escalationLine(directiveProgress) : ""} ${mounted ? proofLine(directiveProgress) : ""}`.trim(),
  ];

  return (
    <main className="min-h-[calc(100vh-72px)] overflow-hidden bg-[#020810] px-4 pb-8 pt-4 text-white">
      <div className="pointer-events-none fixed inset-x-0 top-0 h-72 bg-[radial-gradient(circle_at_top,rgba(52,211,153,0.16),transparent_50%)]" />
      <div className="relative mx-auto max-w-6xl space-y-4">
        <section className="rounded-[32px] border border-white/[0.08] bg-[radial-gradient(circle_at_20%_0%,rgba(244,63,94,0.24),transparent_30%),radial-gradient(circle_at_88%_12%,rgba(250,204,21,0.12),transparent_28%),linear-gradient(145deg,rgba(21,35,58,0.94),rgba(3,11,24,0.98)_55%,rgba(2,8,16,1))] p-5 shadow-[0_24px_90px_rgba(0,0,0,0.42)] backdrop-blur-xl md:p-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Badge tone="bad">
                <StatusDot tone={primaryCorrection ? severityTone(primaryCorrection.severity) : "warn"} />
                Now
              </Badge>
              <Badge tone={lockState.locked ? "locked" : "good"}>
                {lockState.locked ? "Locked" : "Unlocked"}
              </Badge>
            </div>
            <div className="text-xs font-semibold uppercase tracking-[0.22em] text-white/42">
              Dashboard
            </div>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
            <div className="min-w-0">
              <div className="text-xs font-semibold uppercase tracking-[0.28em] text-white/45">
                Active correction
              </div>
              <h1 className="mt-3 max-w-4xl text-5xl font-bold leading-[0.98] tracking-tight text-white md:text-7xl">
                {primaryCorrection?.title || "No correction locked"}
              </h1>

              <div className="mt-5 rounded-[26px] border border-rose-300/18 bg-rose-500/[0.07] p-4">
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-rose-100/75">
                  <StatusDot tone="bad" />
                  Stop command
                </div>
                <div className="mt-2 text-lg font-semibold leading-7 text-rose-50">
                  {primaryCorrection
                    ? correctionInterrupt
                    : "Run Vision to create the correction Sensei can hold you to."}
                </div>
              </div>

              <div className="mt-4 rounded-[26px] border border-emerald-300/18 bg-emerald-400/[0.07] p-4">
                <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-100/75">
                  Next action
                </div>
                <div className="mt-2 text-2xl font-bold leading-9 text-emerald-50">
                  {primaryCorrection ? fixNextRep : nextAction}
                </div>
              </div>
            </div>

            <div className="grid content-start gap-3">
              <MiniStat label="Proof progress" value={`${proofPercent}%`} />
              <div className="rounded-[20px] border border-white/[0.07] bg-black/24 p-3">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/38">
                    Unlock
                  </div>
                  <div className="text-xs font-semibold text-white">
                    {directiveProgress.repsCompleted}/{directiveProgress.repsRequired}
                  </div>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-white/[0.07]">
                  <div
                    className="h-full rounded-full bg-yellow-300 transition-all duration-500"
                    style={{ width: `${proofPercent}%` }}
                  />
                </div>
                <div className="mt-3">
                  <RepDots
                    completed={directiveProgress.repsCompleted}
                    required={directiveProgress.repsRequired}
                  />
                </div>
              </div>
              <MiniStat
                label="Fuel readiness"
                value={
                  fuel?.score !== undefined
                    ? `${Math.round(fuel.score)} / 100`
                    : "Missing"
                }
              />
              <MiniStat label="Recovery state" value={recoveryLabel} />
              <MiniStat
                label="Pressure"
                value={mounted ? escalationLine(directiveProgress) : ""}
              />
            </div>
          </div>
        </section>

        <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <AppCard
                title="Locked progression"
                sub="No proof, no unlock."
                right={
                  <Badge tone={lockState.locked ? "locked" : "good"}>
                    {lockState.locked ? "Locked" : "Clear"}
                  </Badge>
                }
                tone="locked"
              >
                <div className="space-y-4">
                  <div className="text-2xl font-bold text-white">{nextAction}</div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <MiniStat
                      label="Resistance"
                      value={directiveProgress.underResistance ? "On" : "Off"}
                    />
                    <MiniStat
                      label="Proof"
                      value={
                        directiveProgress.proofType === "none"
                          ? "Missing"
                          : directiveProgress.proofType
                      }
                    />
                  </div>
                  <div className="text-sm leading-7 text-white/55">
                    {mounted
                      ? `${escalationLine(directiveProgress)} ${proofLine(directiveProgress)}`
                      : ""}
                  </div>
                </div>
              </AppCard>

              <AppCard
                title="Vision correction"
                sub={vision?.clipLabel || "Latest technical read."}
                right={
                  primaryCorrection ? (
                    <Badge tone={severityTone(primaryCorrection.severity)}>
                      {primaryCorrection.severity}
                    </Badge>
                  ) : (
                    <Badge tone="warn">Needed</Badge>
                  )
                }
                tone="danger"
              >
                <div className="space-y-4">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/38">
                      Why it matters
                    </div>
                    <div className="mt-2 text-sm leading-7 text-white/75">
                      {whyItMatters}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/38">
                      If ignored
                    </div>
                    <div className="mt-2 text-sm leading-7 text-white/75">
                      {costIfIgnored}
                    </div>
                  </div>
                  <ActionButton href="/sensei-vision" label="Open Vision" />
                </div>
              </AppCard>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <AppCard
                title="Fuel readiness"
                sub="Nutrition support for the current load."
                right={
                  fuel?.score !== undefined ? (
                    <Badge tone={getFuelTone(fuel.score)}>
                      {Math.round(fuel.score)}
                    </Badge>
                  ) : (
                    <Badge tone="warn">Missing</Badge>
                  )
                }
                tone="fuel"
              >
                <div className="space-y-4">
                  <div className="text-lg font-semibold leading-7 text-white">
                    {fuelStatusLine(fuel?.score)}
                  </div>
                  <div className="rounded-[20px] border border-white/[0.07] bg-black/24 p-4 text-sm leading-6 text-white/62">
                    {fuelSnippet(fuel?.report)}
                  </div>
                  <ActionButton href="/fuel" label="Open Fuel" />
                </div>
              </AppCard>

              <AppCard
                title="Proof progress"
                sub="The only progress that counts."
                right={
                  <Badge tone={latestProof ? "good" : "locked"}>
                    {latestProof ? "Loaded" : "Needed"}
                  </Badge>
                }
                tone="training"
              >
                <div className="space-y-4">
                  <label className="flex w-full cursor-pointer items-center justify-center rounded-[22px] bg-emerald-300 px-5 py-4 text-center text-sm font-bold text-[#03120d] shadow-[0_14px_40px_rgba(52,211,153,0.16)] transition hover:bg-emerald-200 active:scale-[0.99]">
                    Upload proof
                    <input
                      type="file"
                      accept="image/*,video/*"
                      onChange={(e) =>
                        handleProofUpload(e.target.files?.[0] || null)
                      }
                      className="hidden"
                    />
                  </label>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() =>
                        updateDirectiveProgress((prev: DirectiveProgress) => ({
                          ...prev,
                          underResistance: !prev.underResistance,
                        }))
                      }
                      className="rounded-[20px] border border-white/[0.07] bg-white/[0.045] px-4 py-3 text-sm text-white transition hover:border-white/18 active:scale-[0.99]"
                    >
                                            <span suppressHydrationWarning>
                        Resistance: {directiveProgress.underResistance ? "On" : "Off"}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        updateDirectiveProgress((prev: DirectiveProgress) => ({
                          ...prev,
                          repeatedFailureCount: prev.repeatedFailureCount + 1,
                        }))
                      }
                      className="rounded-[20px] border border-rose-400/14 bg-rose-500/[0.065] px-4 py-3 text-sm text-rose-100 transition hover:bg-rose-500/[0.10] active:scale-[0.99]"
                                          >
                      Mark failure
                    </button>
                  </div>

                  {latestProof ? (
                    <div className="rounded-[22px] border border-white/[0.07] bg-black/25 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/38">
                            Latest proof
                          </div>
                          <div className="mt-1 truncate text-xs text-white/50">
                            {latestProof.fileName} ·{" "}
                            {new Date(latestProof.uploadedAt).toLocaleTimeString()}
                          </div>
                        </div>
                        <Badge
                          tone={
                            latestProof.mimeType.startsWith("video")
                              ? "good"
                              : "warn"
                          }
                        >
                          {latestProof.mimeType.startsWith("video")
                            ? "Video"
                            : "Image"}
                        </Badge>
                      </div>

                      <div className="mt-3 overflow-hidden rounded-[18px] border border-white/[0.07] bg-black/35">
                        {latestProof.mimeType.startsWith("video") ? (
                          <video
                            src={latestProof.dataUrl}
                            controls
                            className="max-h-72 w-full object-contain"
                          />
                        ) : (
                          <img
                            src={latestProof.dataUrl}
                            alt="Latest proof"
                            className="max-h-72 w-full object-contain"
                          />
                        )}
                      </div>
                    </div>
                  ) : null}
                </div>
              </AppCard>
            </div>

            <AppCard
              title="Command feed"
              sub="What the system is asking from you now."
              right={<Badge tone={pressureTone}>Pressure</Badge>}
              tone="psych"
            >
              <div className="space-y-3">
                {commandFeed.map((item, index) => (
                  <div
                    key={index}
                    className="rounded-[22px] border border-white/[0.07] bg-black/24 p-4 text-sm leading-7 text-white/76"
                  >
                    {item}
                  </div>
                ))}
              </div>
            </AppCard>

            <AppCard
              title="Today"
              sub={sessionMeta}
              right={
                camp?.dailySession ? (
                  <Badge tone="good">{camp.dailySession.durationMin} min</Badge>
                ) : (
                  <Badge tone="warn">Build camp</Badge>
                )
              }
              compact
              tone="training"
            >
              <div className="space-y-4">
                <div className="rounded-[22px] border border-emerald-400/14 bg-emerald-500/[0.055] p-4">
                  <div className="text-base font-semibold text-white">
                    {sessionTitle}
                  </div>
                </div>
                <BulletList items={executionBlocks} compact />
              </div>
            </AppCard>
          </div>

          <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
            <AppCard
              title="Weight"
              sub="Fight readiness context."
              right={<Badge tone={statusTone(weightStatus)}>{weightStatus}</Badge>}
              compact
              tone="fuel"
            >
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <MiniStat
                    label="Class"
                    value={weightClass}
                  />
                  <MiniStat
                    label="Days"
                    value={daysRemaining !== null ? `${daysRemaining}` : "-"}
                  />
                  <MiniStat
                    label="Current"
                    value={
                      currentWeight !== null ? `${currentWeight} kg` : "Not logged"
                    }
                  />
                  <MiniStat
                    label="Target"
                    value={
                      typeof targetWeight === "number"
                        ? `${targetWeight} kg`
                        : "Not set"
                    }
                  />
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.22em] text-white/38">
                    <span>Trajectory</span>
                    <span>
                      {weightDifference !== null
                        ? `${weightDifference.toFixed(1)} kg`
                        : "-"}
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full border border-white/[0.07] bg-black/40">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-500",
                        weightStatus === "On Track"
                          ? "bg-emerald-400/80"
                          : weightStatus === "Slightly Behind"
                          ? "bg-amber-400/80"
                          : weightStatus === "Off Track"
                          ? "bg-rose-400/80"
                          : "bg-white/20"
                      )}
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                </div>

                <div className="flex gap-2">
                  <input
                    value={weightInput}
                    onChange={(e) => setWeightInput(e.target.value)}
                    placeholder="e.g. 68.2"
                    className="w-full rounded-[18px] border border-white/[0.07] bg-black/30 px-4 py-3 text-sm text-white placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-emerald-400/20"
                  />
                  <button
                    onClick={handleLogWeight}
                    className="rounded-[18px] bg-emerald-300 px-4 py-3 text-sm font-semibold text-[#041026] transition hover:bg-emerald-200 active:scale-[0.98]"
                  >
                    Log
                  </button>
                </div>
              </div>
            </AppCard>

            <AppCard title="Success / banned" sub="Accountability rules." compact>
              <div className="space-y-4">
                <div>
                  <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-100/65">
                    Counts
                  </div>
                  <BulletList items={successToday} compact />
                </div>
                <div>
                  <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-rose-100/65">
                    Does not count
                  </div>
                  <BulletList items={bannedToday} tone="rose" compact />
                </div>
              </div>
            </AppCard>
          </aside>
        </div>

        <AppCard
          title="System layer"
          sub="Secondary issues, coach notes, and camp control."
          right={
            <button
              type="button"
              onClick={() => setShowSystems((v) => !v)}
              className="rounded-full border border-white/[0.07] bg-white/[0.04] px-3 py-1 text-[11px] text-white/70 transition hover:border-white/18 hover:text-white active:scale-[0.98]"
            >
              {showSystems ? "Hide" : "Show"}
            </button>
          }
          compact
        >
          {showSystems ? (
            <div className="grid gap-4 md:grid-cols-2">
              <AppCard title="Coach notes" sub="Carryover for today." compact>
                {coachNotes.length ? (
                  <BulletList items={coachNotes} compact />
                ) : (
                  <div className="text-sm text-white/55">
                    No coach notes yet. Build a camp in Sensei first.
                  </div>
                )}
              </AppCard>

              <AppCard
                title="Supporting issues"
                sub="Real, but not primary."
                right={
                  secondaryCorrections.length ? (
                    <button
                      type="button"
                      onClick={() => setShowSupporting((v) => !v)}
                      className="rounded-full border border-white/[0.07] bg-white/[0.04] px-3 py-1 text-[11px] text-white/70 transition hover:border-white/18 hover:text-white"
                    >
                      {showSupporting
                        ? "Hide"
                        : `Show ${secondaryCorrections.length}`}
                    </button>
                  ) : (
                    <Badge tone="neutral">None</Badge>
                  )
                }
                compact
              >
                {secondaryCorrections.length ? (
                  <div className="space-y-3">
                    {showSupporting ? (
                      <>
                        {secondaryCorrections.map((item, i) => {
                          const shortText =
                            item.short_detail ||
                            item.unstable ||
                            item.break_point ||
                            item.good ||
                            "Secondary issue detected.";

                          return (
                            <div
                              key={item.id ?? i}
                              className="rounded-[20px] border border-white/[0.07] bg-black/25 p-4"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="text-sm font-semibold text-white">
                                    {item.title}
                                  </div>
                                  <div className="mt-2 text-sm text-white/65">
                                    {compactSentence(shortText, 120)}
                                  </div>
                                </div>
                                <Badge tone={severityTone(item.severity)}>
                                  {item.severity}
                                </Badge>
                              </div>
                            </div>
                          );
                        })}

                        <Link
                          href="/sensei-vision"
                          className="inline-flex text-xs text-emerald-300 hover:text-emerald-200"
                        >
                          Open full Vision report
                        </Link>
                      </>
                    ) : (
                      <div className="text-sm text-white/55">
                        Secondary problems stay hidden until the main correction is
                        understood.
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-sm text-white/55">
                    No secondary issues loaded.
                  </div>
                )}
              </AppCard>

              {camp?.control ? (
                <AppCard
                  title="Camp control"
                  sub="Load, warnings, and next step."
                  right={
                    <Badge tone={badgeToneForLoad(camp.control.trainingLoad)}>
                      {camp.control.trainingLoad}
                    </Badge>
                  }
                  compact
                >
                  <div className="grid gap-4">
                    <div className="grid grid-cols-3 gap-3">
                      <MiniStat label="Load" value={camp.control.trainingLoad} />
                      <MiniStat
                        label="Warnings"
                        value={String(camp.control.warnings.length)}
                      />
                      <MiniStat
                        label="Next"
                        value={String(camp.control.nextStep.length)}
                      />
                    </div>

                    {camp.control.warnings.length ? (
                      <div className="rounded-[20px] border border-white/[0.07] bg-black/25 p-4">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/38">
                          Warnings
                        </div>
                        <div className="mt-3">
                          <BulletList
                            items={camp.control.warnings.slice(0, 2)}
                            tone="amber"
                            compact
                          />
                        </div>
                      </div>
                    ) : null}

                    {camp.control.nextStep.length ? (
                      <div className="rounded-[20px] border border-white/[0.07] bg-black/25 p-4">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/38">
                          Next step
                        </div>
                        <div className="mt-2 text-sm text-white/80">
                          {lockState.locked
                            ? lockState.userMessage
                            : compactSentence(camp.control.nextStep[0], 120)}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </AppCard>
              ) : null}

              <AppCard
                title="Mission state"
                sub="Fight and directive context."
                right={<Badge tone={statusTone(weightStatus)}>{weightStatus}</Badge>}
                compact
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <MiniStat
                    label="Directive"
                    value={compactSentence(
                      primaryCorrection?.title ||
                        camp?.directive?.title ||
                        "No primary correction yet",
                      40
                    )}
                  />
                  <MiniStat
                    label="Days"
                    value={daysRemaining !== null ? `${daysRemaining}` : "-"}
                  />
                  <MiniStat
                    label="Fight"
                    value={fightDate ?? "No fight scheduled"}
                  />
                  <MiniStat
                    label="Weight"
                    value={
                      currentWeight !== null ? `${currentWeight} kg` : "Not logged"
                    }
                  />
                </div>
              </AppCard>
            </div>
          ) : (
            <div className="text-sm text-white/55">
              System layer is quiet until needed. The current job is still the active correction.
            </div>
          )}
        </AppCard>

      </div>
    </main>
  );
}