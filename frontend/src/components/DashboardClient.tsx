"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion, type Variants } from "framer-motion";
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

type Tone =
  | "neutral"
  | "training"
  | "fuel"
  | "vision"
  | "pressure"
  | "danger";

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

const pageMotion: Variants = {
  hidden: {
    opacity: 0,
    y: 10,
  },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.3,
      ease: "easeOut",
      staggerChildren: 0.055,
    },
  },
};

const sectionMotion: Variants = {
  hidden: {
    opacity: 0,
    y: 14,
    scale: 0.99,
  },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.28,
      ease: "easeOut",
    },
  },
};

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function readJson<T>(key: string): T | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeJson<T>(key: string, value: T) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

function clean(text?: string | null) {
  return String(text || "")
    .replace(/\.{3,}|…/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function short(text?: string | null, max = 120) {
  const value = clean(text);

  if (!value || value.length <= max) return value;

  const clipped = value.slice(0, max).trim();
  const lastSpace = clipped.lastIndexOf(" ");

  return lastSpace > 30
    ? clipped.slice(0, lastSpace).trim()
    : clipped;
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

function latestWeight(
  logs: WeightLog[],
  fallback?: number | null
): number | null {
  if (logs.length) return logs[logs.length - 1].value;

  if (
    typeof fallback === "number" &&
    Number.isFinite(fallback)
  ) {
    return fallback;
  }

  return null;
}

function buildWeightStatus(args: {
  currentWeight: number | null;
  targetWeight: number | null;
  daysRemaining: number | null;
}): WeightStatus {
  const { currentWeight, targetWeight, daysRemaining } = args;

  if (
    daysRemaining === null ||
    currentWeight === null ||
    targetWeight === null
  ) {
    return "No Fight Scheduled";
  }

  const difference = currentWeight - targetWeight;

  if (difference <= 0.5) return "On Track";

  const requiredPerDay =
    difference / Math.max(daysRemaining, 1);

  if (requiredPerDay <= 0.35) return "On Track";
  if (requiredPerDay <= 0.6) return "Slightly Behind";

  return "Off Track";
}

function toneForWeight(status: WeightStatus): Tone {
  if (status === "On Track") return "training";
  if (status === "Slightly Behind") return "fuel";
  if (status === "Off Track") return "danger";

  return "neutral";
}

function toneForFuel(score?: number): Tone {
  if (typeof score !== "number") return "neutral";
  if (score >= 75) return "training";
  if (score >= 50) return "fuel";

  return "danger";
}

function toneForSeverity(
  severity?: VisionFinding["severity"]
): Tone {
  if (severity === "HIGH") return "danger";
  if (severity === "MEDIUM") return "fuel";
  if (severity === "LOW") return "training";

  return "neutral";
}

function fallbackStop(title?: string, detail?: string) {
  const text = `${title || ""} ${detail || ""}`.toLowerCase();

  if (text.includes("hips")) return "Hips under you.";
  if (text.includes("head")) return "Get your head inside.";

  if (text.includes("hand") || text.includes("reach")) {
    return "Feet first. Stop reaching.";
  }

  if (
    text.includes("trail leg") ||
    text.includes("back foot")
  ) {
    return "Bring the back foot up.";
  }

  return "Fix position before continuing.";
}

function fallbackNext(title?: string, detail?: string) {
  const text = `${title || ""} ${detail || ""}`.toLowerCase();

  if (text.includes("hips")) {
    return "Step deep. Put the hips under.";
  }

  if (text.includes("head")) {
    return "Head on the ribs. Finish the shot.";
  }

  if (text.includes("hand") || text.includes("reach")) {
    return "Move the feet before the hands.";
  }

  if (
    text.includes("trail leg") ||
    text.includes("back foot")
  ) {
    return "Step the back foot underneath.";
  }

  return "Restore position. Continue.";
}

function fuelDecision(score?: number) {
  if (typeof score !== "number") {
    return "Log Fuel before hard training.";
  }

  if (score >= 75) {
    return "Push the planned session.";
  }

  if (score >= 50) {
    return "Train. Keep the load controlled.";
  }

  return "Technique only. Do not push volume.";
}

function pressureDecision(progress: DirectiveProgress) {
  if (progress.repeatedFailureCount <= 0) {
    return "No repeat break.";
  }

  if (progress.repeatedFailureCount === 1) {
    return "Same break repeated.";
  }

  if (progress.repeatedFailureCount === 2) {
    return "Habit forming.";
  }

  return "Pattern protected.";
}

function proofDecision(progress: DirectiveProgress) {
  if (progress.proofType === "none") {
    return "Proof missing.";
  }

  if (progress.proofType === "self_report") {
    return "Self-report does not unlock.";
  }

  return `Proof loaded: ${progress.proofType}.`;
}

function toneStyles(tone: Tone) {
  if (tone === "training") {
    return {
      border: "border-emerald-300/20",
      background: "bg-emerald-300/[0.08]",
      text: "text-emerald-100",
      dot: "bg-emerald-300",
      stroke: "#6ee7b7",
    };
  }

  if (tone === "fuel") {
    return {
      border: "border-amber-300/18",
      background: "bg-amber-300/[0.06]",
      text: "text-amber-100",
      dot: "bg-amber-300",
      stroke: "#fbbf24",
    };
  }

  if (tone === "vision") {
    return {
      border: "border-cyan-200/18",
      background: "bg-cyan-200/[0.06]",
      text: "text-cyan-100",
      dot: "bg-cyan-200",
      stroke: "#a5f3fc",
    };
  }

  if (tone === "pressure") {
    return {
      border: "border-violet-300/18",
      background: "bg-violet-300/[0.06]",
      text: "text-violet-100",
      dot: "bg-violet-300",
      stroke: "#c4b5fd",
    };
  }

  if (tone === "danger") {
    return {
      border: "border-rose-300/20",
      background: "bg-rose-300/[0.07]",
      text: "text-rose-100",
      dot: "bg-rose-300",
      stroke: "#fda4af",
    };
  }

  return {
    border: "border-white/[0.08]",
    background: "bg-white/[0.035]",
    text: "text-white/62",
    dot: "bg-white/35",
    stroke: "#ffffff",
  };
}
function StatusBadge({
  children,
  tone = "neutral",
  pulse = false,
}: {
  children: React.ReactNode;
  tone?: Tone;
  pulse?: boolean;
}) {
  const styles = toneStyles(tone);

  return (
    <motion.span
      suppressHydrationWarning
      animate={
        pulse
          ? {
              opacity: [0.72, 1, 0.72],
            }
          : undefined
      }
      transition={
        pulse
          ? {
              duration: 2.2,
              repeat: Infinity,
              ease: "easeInOut",
            }
          : undefined
      }
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em]",
        styles.border,
        styles.background,
        styles.text
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          styles.dot
        )}
      />

      {children}
    </motion.span>
  );
}

function ProgressRing({
  value,
  max,
  label,
  caption,
  tone = "training",
  size = 116,
}: {
  value: number;
  max: number;
  label: string;
  caption: string;
  tone?: Tone;
  size?: number;
}) {
  const styles = toneStyles(tone);
  const radius = 45;
  const circumference = 2 * Math.PI * radius;
  const percentage = Math.min(
    1,
    Math.max(0, value / Math.max(max, 1))
  );
  const offset = circumference * (1 - percentage);

  return (
    <div
      className="relative shrink-0"
      style={{
        width: size,
        height: size,
      }}
    >
      <svg
        viewBox="0 0 110 110"
        className="-rotate-90"
        aria-hidden="true"
      >
        <circle
          cx="55"
          cy="55"
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.07)"
          strokeWidth="7"
        />

        <motion.circle
          cx="55"
          cy="55"
          r={radius}
          fill="none"
          stroke={styles.stroke}
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{
            duration: 0.8,
            ease: "easeOut",
          }}
        />
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <div className="text-xl font-bold tracking-[-0.03em] text-white">
          {label}
        </div>

        <div className="mt-0.5 max-w-[72px] text-[9px] font-semibold uppercase tracking-[0.12em] text-white/38">
          {caption}
        </div>
      </div>
    </div>
  );
}

function Panel({
  title,
  label,
  right,
  children,
  tone = "neutral",
  className,
}: {
  title: string;
  label?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  tone?: Tone;
  className?: string;
}) {
  const styles = toneStyles(tone);

  return (
    <motion.section
      variants={sectionMotion}
      whileHover={{
        y: -2,
      }}
      transition={{
        type: "spring",
        stiffness: 380,
        damping: 30,
      }}
      className={cn(
        "overflow-hidden rounded-[24px] border bg-[#0b111a]/92 shadow-[0_18px_60px_rgba(0,0,0,0.28)]",
        styles.border,
        className
      )}
    >
      <div className="flex items-start justify-between gap-4 px-5 pb-3 pt-4">
        <div className="min-w-0">
          {label ? (
            <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/34">
              {label}
            </p>
          ) : null}

          <h2 className="mt-1 text-base font-semibold text-white">
            {title}
          </h2>
        </div>

        {right}
      </div>

      <div className="px-5 pb-5">{children}</div>
    </motion.section>
  );
}

function SignalRow({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: React.ReactNode;
  tone?: Tone;
}) {
  const styles = toneStyles(tone);

  return (
    <div className="flex min-h-[58px] items-center justify-between gap-4 border-t border-white/[0.06] py-3 first:border-t-0">
      <div className="flex min-w-0 items-center gap-2">
        <span
          className={cn(
            "h-2 w-2 shrink-0 rounded-full",
            styles.dot
          )}
        />

        <span className="truncate text-xs font-semibold text-white/46">
          {label}
        </span>
      </div>

      <div
        suppressHydrationWarning
        className="min-w-0 text-right text-sm font-semibold text-white"
      >
        {value}
      </div>
    </div>
  );
}

function ActionLink({
  href,
  children,
  strong = false,
}: {
  href: string;
  children: React.ReactNode;
  strong?: boolean;
}) {
  return (
    <motion.div whileTap={{ scale: 0.98 }}>
      <Link
        href={href}
        className={cn(
          "flex min-h-12 w-full items-center justify-center rounded-full border px-5 py-3 text-sm font-bold transition",
          strong
            ? "border-emerald-200/30 bg-emerald-300 text-[#03120d] shadow-[0_12px_32px_rgba(52,211,153,0.14)] hover:bg-emerald-200"
            : "border-white/[0.10] bg-white/[0.045] text-white hover:bg-white/[0.08]"
        )}
      >
        {children}
      </Link>
    </motion.div>
  );
}

function ModuleTile({
  href,
  label,
  value,
  command,
  tone,
}: {
  href: string;
  label: string;
  value: string;
  command: string;
  tone: Tone;
}) {
  const styles = toneStyles(tone);

  return (
    <motion.div
      variants={sectionMotion}
      whileTap={{ scale: 0.985 }}
      className="min-w-[230px] flex-1 snap-start"
    >
      <Link
        href={href}
        className={cn(
          "block h-full rounded-[24px] border bg-[#0b111a]/94 p-4 transition hover:bg-[#101823]",
          styles.border
        )}
      >
        <div className="flex items-center justify-between gap-3">
          <StatusBadge tone={tone}>{label}</StatusBadge>

          <span className="text-lg text-white/30">›</span>
        </div>

        <p className="mt-5 text-2xl font-bold tracking-[-0.03em] text-white">
          {value}
        </p>

        <p className="mt-2 text-sm leading-6 text-white/48">
          {command}
        </p>
      </Link>
    </motion.div>
  );
}

function CommandList({
  items,
  tone = "training",
}: {
  items: string[];
  tone?: Tone;
}) {
  const styles = toneStyles(tone);

  return (
    <div className="divide-y divide-white/[0.06]">
      {items.map((item, index) => (
        <motion.div
          key={`${item}-${index}`}
          variants={sectionMotion}
          className="flex gap-3 py-3 first:pt-0 last:pb-0"
        >
          <span
            className={cn(
              "mt-2 h-1.5 w-1.5 shrink-0 rounded-full",
              styles.dot
            )}
          />

          <p className="text-sm leading-6 text-white/76">
            {clean(item)}
          </p>
        </motion.div>
      ))}
    </div>
  );
}

export default function DashboardClient() {
  const { fighterContext } = useFighterContext();

  const [mounted, setMounted] = useState(false);
  const [camp, setCamp] = useState<SavedCamp | null>(null);
  const [vision, setVision] = useState<VisionAnalysis | null>(null);
  const [fuel, setFuel] = useState<FuelMemory | null>(null);
  const [weightLogs, setWeightLogs] = useState<WeightLog[]>([]);
  const [weightInput, setWeightInput] = useState("");
  const [latestProof, setLatestProof] =
    useState<ProofMemory | null>(null);

  const [directiveProgress, setDirectiveProgress] =
    useState<DirectiveProgress>(
      normalizeDirectiveProgress(undefined)
    );

  useEffect(() => {
    setMounted(true);
    setCamp(readJson<SavedCamp>("disciplin_latest_camp"));
    setVision(
      readJson<VisionAnalysis>("disciplin_latest_vision")
    );
    setFuel(readJson<FuelMemory>("disciplin_latest_fuel"));
    setWeightLogs(
      readJson<WeightLog[]>("disciplin_weight_logs") ?? []
    );
    setLatestProof(
      readJson<ProofMemory>(LAST_PROOF_KEY)
    );

    setDirectiveProgress(
      normalizeDirectiveProgress(
        readJson<DirectiveProgress>(
          DIRECTIVE_PROGRESS_KEY
        ) ?? undefined
      )
    );
  }, []);

  useEffect(() => {
    if (!mounted) return;

    writeJson(
      DIRECTIVE_PROGRESS_KEY,
      directiveProgress
    );
  }, [directiveProgress, mounted]);

  const findings = useMemo(
    () =>
      Array.isArray(vision?.findings)
        ? vision.findings
        : [],
    [vision]
  );

  const primaryCorrection = findings[0] ?? null;
  const secondaryCorrections = findings.slice(1, 3);

  const lockState = getLockState({
    directive: {
      present: Boolean(primaryCorrection?.title),
      correction: primaryCorrection?.title || null,
    },
    progress: directiveProgress,
  });

  const currentWeight = latestWeight(
    weightLogs,
    fighterContext.identity.currentWeight
  );

  const targetWeight =
    fighterContext.identity.targetWeight ?? null;

  const daysRemaining = daysUntil(
    fighterContext.camp.fightDate
  );

  const weightStatus = buildWeightStatus({
    currentWeight,
    targetWeight,
    daysRemaining,
  });

  const repsRemaining = Math.max(
    0,
    directiveProgress.repsRequired -
      directiveProgress.repsCompleted
  );

  const proofPercent = Math.round(
    (directiveProgress.repsCompleted /
      Math.max(directiveProgress.repsRequired, 1)) *
      100
  );

  const stopCommand =
    primaryCorrection?.interrupt ||
    fallbackStop(
      primaryCorrection?.title,
      primaryCorrection?.detail
    );

  const nextRep =
    primaryCorrection?.fix_next_rep ||
    fallbackNext(
      primaryCorrection?.title,
      primaryCorrection?.detail
    );

  const nextAction = !primaryCorrection
    ? "Run Vision before training."
    : lockState.locked && repsRemaining > 0
      ? `Prove ${repsRemaining} clean ${
          repsRemaining === 1 ? "rep" : "reps"
        }.`
      : lockState.locked
        ? "Submit proof to clear the lock."
        : "Open the next correction.";

  const sessionTitle =
    camp?.dailySession?.title || "Correction session";

  const sessionBlocks =
    primaryCorrection?.train?.slice(0, 3) ||
    camp?.dailySession?.blocks?.slice(0, 3) ||
    [
      "One correction.",
      "One session.",
      "No variety chasing.",
    ];

  const commandFeed = [
    primaryCorrection
      ? `Sensei: ${short(nextRep, 100)}`
      : "Sensei: run Vision before training.",
    lockState.locked
      ? `Lock: ${directiveProgress.repsCompleted}/${directiveProgress.repsRequired} clean reps.`
      : "Lock: clear.",
    `Fuel: ${fuelDecision(fuel?.score)}`,
    `Pressure: ${pressureDecision(
      directiveProgress
    )}`,
  ];

  function updateProgress(
    patch:
      | Partial<DirectiveProgress>
      | ((
          previous: DirectiveProgress
        ) => DirectiveProgress)
  ) {
    setDirectiveProgress((previous) => {
      const next =
        typeof patch === "function"
          ? patch(previous)
          : { ...previous, ...patch };

      return normalizeDirectiveProgress({
        ...previous,
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

      updateProgress((previous) => ({
        ...previous,
        repsCompleted: Math.min(
          previous.repsCompleted + 1,
          previous.repsRequired
        ),
        proofType: isVideo ? "video" : "image",
      }));
    };

    reader.readAsDataURL(file);
  }

  function handleLogWeight() {
    const value = Number(weightInput);

    if (!Number.isFinite(value) || value <= 0) return;

    const nextLogs = [
      ...weightLogs,
      {
        value,
        loggedAt: new Date().toISOString(),
      },
    ];

    setWeightLogs(nextLogs);
    writeJson("disciplin_weight_logs", nextLogs);
    setWeightInput("");
  }
    return (
    <motion.main
      variants={pageMotion}
      initial="hidden"
      animate="show"
      className="min-h-[calc(100vh-72px)] bg-[#05080d] px-4 pb-32 pt-4 text-white"
    >
      <div className="mx-auto max-w-5xl space-y-4">
        <motion.section
          variants={sectionMotion}
          className="overflow-hidden rounded-[28px] border border-white/[0.08] bg-[#0a1019] shadow-[0_24px_80px_rgba(0,0,0,0.36)]"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] px-5 py-4 sm:px-6">
            <div className="flex flex-wrap gap-2">
              <StatusBadge
                tone={toneForSeverity(primaryCorrection?.severity)}
                pulse
              >
                Active correction
              </StatusBadge>

              <StatusBadge
                tone={lockState.locked ? "danger" : "training"}
                pulse={lockState.locked}
              >
                {lockState.locked ? "Locked" : "Clear"}
              </StatusBadge>
            </div>

            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/34">
              Before training
            </p>
          </div>

          <div className="grid gap-6 px-5 py-6 sm:px-6 lg:grid-cols-[minmax(0,1fr)_260px] lg:items-center">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/38">
                Fix this
              </p>

              <motion.h1
                layout
                className="mt-3 max-w-3xl text-3xl font-bold leading-[1.05] text-white sm:text-4xl"
              >
                {primaryCorrection?.title || "No correction locked"}
              </motion.h1>

              <p className="mt-4 max-w-2xl text-base font-semibold leading-7 text-white/64">
                {primaryCorrection
                  ? nextRep
                  : "Run Vision before training."}
              </p>
            </div>

            <div className="flex items-center justify-center gap-4 lg:justify-end">
              <ProgressRing
                value={directiveProgress.repsCompleted}
                max={directiveProgress.repsRequired}
                label={`${directiveProgress.repsCompleted}/${directiveProgress.repsRequired}`}
                caption="Clean reps"
                tone="training"
                size={112}
              />

              <ProgressRing
                value={
                  typeof fuel?.score === "number"
                    ? fuel.score
                    : 0
                }
                max={100}
                label={
                  typeof fuel?.score === "number"
                    ? `${Math.round(fuel.score)}`
                    : "--"
                }
                caption="Readiness"
                tone={toneForFuel(fuel?.score)}
                size={112}
              />
            </div>
          </div>

          <div className="grid border-t border-white/[0.06] sm:grid-cols-2">
            <div className="border-b border-white/[0.06] px-5 py-4 sm:border-b-0 sm:border-r sm:px-6">
              <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-rose-200/52">
                Stop
              </p>

              <p className="mt-2 text-sm font-semibold leading-6 text-white">
                {primaryCorrection
                  ? stopCommand
                  : "Do not train blind."}
              </p>
            </div>

            <div className="px-5 py-4 sm:px-6">
              <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-emerald-200/52">
                Next
              </p>

              <p className="mt-2 text-sm font-semibold leading-6 text-white">
                {nextAction}
              </p>
            </div>
          </div>

          <div className="border-t border-white/[0.06] p-3">
            <ActionLink
              href={
                !primaryCorrection
                  ? "/sensei-vision"
                  : lockState.locked
                    ? "/sensei"
                    : "/dashboard"
              }
              strong
            >
              {!primaryCorrection
                ? "Run Vision"
                : lockState.locked
                  ? "Continue correction"
                  : "Start session"}
            </ActionLink>
          </div>
        </motion.section>

        <motion.div
          variants={sectionMotion}
          className="-mx-4 overflow-x-auto px-4 pb-1"
        >
          <div className="flex snap-x snap-mandatory gap-3">
            <ModuleTile
              href="/fuel"
              label="Fuel"
              value={
                typeof fuel?.score === "number"
                  ? `${Math.round(fuel.score)} readiness`
                  : "Not logged"
              }
              command={fuelDecision(fuel?.score)}
              tone="fuel"
            />

            <ModuleTile
              href="/sensei-vision"
              label="Vision"
              value={
                primaryCorrection?.severity || "Clip needed"
              }
              command={
                primaryCorrection
                  ? short(nextRep, 80)
                  : "Upload a frame."
              }
              tone="vision"
            />

            <ModuleTile
              href="/sensei"
              label="Sensei"
              value={
                lockState.locked ? "Correction locked" : "Clear"
              }
              command={
                lockState.locked
                  ? nextAction
                  : "Open the next correction."
              }
              tone={
                lockState.locked ? "danger" : "training"
              }
            />

            <ModuleTile
              href="/dashboard"
              label="Proof"
              value={`${proofPercent}% complete`}
              command={proofDecision(directiveProgress)}
              tone="training"
            />
          </div>
        </motion.div>

        <Panel
          title="Today"
          label="One correction. One session."
          tone="training"
          right={
            camp?.dailySession ? (
              <StatusBadge tone="training">
                {camp.dailySession.durationMin} min
              </StatusBadge>
            ) : (
              <StatusBadge tone="neutral">
                Build camp
              </StatusBadge>
            )
          }
        >
          <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_220px] md:items-end">
            <div>
              <p className="text-2xl font-bold text-white">
                {sessionTitle}
              </p>

              {camp?.dailySession?.goal ? (
                <p className="mt-2 text-sm leading-6 text-white/48">
                  {short(camp.dailySession.goal, 140)}
                </p>
              ) : null}

              <div className="mt-5">
                <CommandList
                  items={sessionBlocks}
                  tone="training"
                />
              </div>
            </div>

            <div className="space-y-3">
              <ActionLink href="/sensei" strong>
                Start with Sensei
              </ActionLink>

              <ActionLink href="/sensei-vision">
                Retest with Vision
              </ActionLink>
            </div>
          </div>

          {camp?.control?.warnings?.length ? (
            <div className="mt-5 border-t border-white/[0.06] pt-4">
              <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-amber-200/52">
                Watch
              </p>

              <p className="mt-2 text-sm font-semibold leading-6 text-white/72">
                {short(camp.control.warnings[0], 150)}
              </p>
            </div>
          ) : null}
        </Panel>
                <div className="grid gap-4 md:grid-cols-2">
          <Panel
            title="Proof"
            label="What counts"
            tone="training"
            right={
              <StatusBadge
                tone={latestProof ? "training" : "neutral"}
                pulse={!latestProof}
              >
                {latestProof ? "Loaded" : "Needed"}
              </StatusBadge>
            }
          >
            <div className="space-y-4">
              <div className="flex items-center gap-5">
                <ProgressRing
                  value={directiveProgress.repsCompleted}
                  max={directiveProgress.repsRequired}
                  label={`${proofPercent}%`}
                  caption="Complete"
                  tone="training"
                  size={108}
                />

                <div className="min-w-0 flex-1">
                  <p className="text-xl font-bold text-white">
                    {directiveProgress.repsCompleted}/
                    {directiveProgress.repsRequired} clean reps
                  </p>

                  <p className="mt-2 text-sm leading-6 text-white/48">
                    {mounted
                      ? proofDecision(directiveProgress)
                      : "Proof missing."}
                  </p>

                  <p className="mt-1 text-sm leading-6 text-white/48">
                    Resistance:{" "}
                    {directiveProgress.underResistance
                      ? "On"
                      : "Off"}
                  </p>
                </div>
              </div>

              {latestProof ? (
                <div className="overflow-hidden rounded-[20px] border border-white/[0.07] bg-black/30">
                  <div className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-white/34">
                        Latest proof
                      </p>

                      <p className="mt-1 truncate text-sm font-semibold text-white">
                        {latestProof.fileName}
                      </p>
                    </div>

                    <StatusBadge tone="training">
                      {latestProof.mimeType.startsWith("video")
                        ? "Video"
                        : "Image"}
                    </StatusBadge>
                  </div>

                  {latestProof.mimeType.startsWith("video") ? (
                    <video
                      src={latestProof.dataUrl}
                      controls
                      className="max-h-64 w-full object-contain"
                    />
                  ) : (
                    <img
                      src={latestProof.dataUrl}
                      alt="Latest proof"
                      className="max-h-64 w-full object-contain"
                    />
                  )}
                </div>
              ) : null}

              <div className="grid gap-3 sm:grid-cols-2">
                <motion.label
                  whileTap={{ scale: 0.98 }}
                  className="flex min-h-12 cursor-pointer items-center justify-center rounded-full bg-emerald-300 px-5 py-3 text-sm font-bold text-[#03120d] transition hover:bg-emerald-200"
                >
                  Submit proof

                  <input
                    type="file"
                    accept="image/*,video/*"
                    onChange={(event) =>
                      handleProofUpload(
                        event.target.files?.[0] || null
                      )
                    }
                    className="hidden"
                  />
                </motion.label>

                <motion.button
                  type="button"
                  whileTap={{ scale: 0.98 }}
                  onClick={() =>
                    updateProgress((previous) => ({
                      ...previous,
                      underResistance:
                        !previous.underResistance,
                    }))
                  }
                  className={cn(
                    "min-h-12 rounded-full border px-5 py-3 text-sm font-bold transition",
                    directiveProgress.underResistance
                      ? "border-emerald-300/24 bg-emerald-300/[0.08] text-emerald-100"
                      : "border-white/[0.10] bg-white/[0.045] text-white"
                  )}
                >
                  Resistance:{" "}
                  {directiveProgress.underResistance
                    ? "On"
                    : "Off"}
                </motion.button>
              </div>
            </div>
          </Panel>

          <Panel
            title="Readiness"
            label="How hard you can train"
            tone="fuel"
            right={
              <StatusBadge tone={toneForFuel(fuel?.score)}>
                {typeof fuel?.score === "number"
                  ? Math.round(fuel.score)
                  : "Needed"}
              </StatusBadge>
            }
          >
            <div className="space-y-4">
              <div className="flex items-center gap-5">
                <ProgressRing
                  value={
                    typeof fuel?.score === "number"
                      ? fuel.score
                      : 0
                  }
                  max={100}
                  label={
                    typeof fuel?.score === "number"
                      ? `${Math.round(fuel.score)}`
                      : "--"
                  }
                  caption="Readiness"
                  tone={toneForFuel(fuel?.score)}
                  size={108}
                />

                <div className="min-w-0">
                  <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-white/34">
                    Decision
                  </p>

                  <p className="mt-2 text-xl font-bold leading-7 text-white">
                    {fuelDecision(fuel?.score)}
                  </p>
                </div>
              </div>

              <ActionLink href="/fuel">
                Open Fuel
              </ActionLink>
            </div>
          </Panel>

          <Panel
            title="Vision"
            label="Latest technical test"
            tone="vision"
            right={
              <StatusBadge
                tone={toneForSeverity(
                  primaryCorrection?.severity
                )}
              >
                {primaryCorrection?.severity || "Needed"}
              </StatusBadge>
            }
          >
            <div className="divide-y divide-white/[0.06]">
              <SignalRow
                label="What failed"
                value={
                  primaryCorrection?.title || "No clip loaded"
                }
                tone="danger"
              />

              <SignalRow
                label="Next rep"
                value={
                  primaryCorrection
                    ? short(nextRep, 85)
                    : "Upload a clip."
                }
                tone="vision"
              />

              <SignalRow
                label="Better opponent"
                value={
                  primaryCorrection?.if_ignored
                    ? short(
                        primaryCorrection.if_ignored,
                        85
                      )
                    : "Not tested."
                }
                tone="neutral"
              />
            </div>

            <div className="mt-4">
              <ActionLink href="/sensei-vision">
                Open Vision
              </ActionLink>
            </div>
          </Panel>

          <Panel
            title="Weight"
            label="Fight context"
            tone="neutral"
            right={
              <StatusBadge tone={toneForWeight(weightStatus)}>
                {weightStatus}
              </StatusBadge>
            }
          >
            <div className="divide-y divide-white/[0.06]">
              <SignalRow
                label="Current"
                value={
                  currentWeight === null
                    ? "Not logged"
                    : `${currentWeight} kg`
                }
                tone="neutral"
              />

              <SignalRow
                label="Target"
                value={
                  targetWeight === null
                    ? "Not set"
                    : `${targetWeight} kg`
                }
                tone="training"
              />

              <SignalRow
                label="Fight"
                value={
                  daysRemaining === null
                    ? "No date"
                    : `${daysRemaining} days`
                }
                tone="neutral"
              />
            </div>

            <div className="mt-4 flex gap-2">
              <input
                value={weightInput}
                onChange={(event) =>
                  setWeightInput(event.target.value)
                }
                inputMode="decimal"
                placeholder="e.g. 68.2"
                className="min-w-0 flex-1 rounded-full border border-white/[0.10] bg-black/30 px-4 py-3 text-sm text-white outline-none placeholder:text-white/28 focus:border-emerald-300/34"
              />

              <motion.button
                type="button"
                whileTap={{ scale: 0.96 }}
                onClick={handleLogWeight}
                className="rounded-full bg-white px-5 py-3 text-sm font-bold text-black transition hover:bg-white/88"
              >
                Log
              </motion.button>
            </div>
          </Panel>
        </div>

        <Panel
          title="Pressure"
          label="Keep emotion out of the action"
          tone="pressure"
          right={
            <StatusBadge tone="pressure">
              Separate
            </StatusBadge>
          }
        >
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px] md:items-end">
            <div className="divide-y divide-white/[0.06]">
              <SignalRow
                label="Current state"
                value={pressureDecision(directiveProgress)}
                tone="pressure"
              />

              <SignalRow
                label="Technical proof"
                value={
                  mounted
                    ? proofDecision(directiveProgress)
                    : "Proof missing."
                }
                tone="training"
              />

              <SignalRow
                label="Rule"
                value="Emotion does not change the action."
                tone="pressure"
              />
            </div>

            <ActionLink href="/sensei">
              Ask Sensei
            </ActionLink>
          </div>
        </Panel>

        <Panel
          title="What matters now"
          label="Recent decisions"
          tone="neutral"
        >
          <CommandList
            items={commandFeed}
            tone="training"
          />
        </Panel>

        {secondaryCorrections.length ? (
          <Panel
            title="Other mistakes"
            label="Do not chase these first"
            tone="neutral"
            right={
              <StatusBadge tone="neutral">
                {secondaryCorrections.length}
              </StatusBadge>
            }
          >
            <CommandList
              items={secondaryCorrections.map(
                (item) => item.title
              )}
              tone="vision"
            />
          </Panel>
        ) : null}
      </div>
    </motion.main>
  );
}