"use client";

import React, { useEffect, useMemo, useState } from "react";
import Provenance from "@/components/Provenance";
import { provenanceForEvidence } from "@/lib/provenance/contracts";
import { AnimatePresence, motion } from "framer-motion";
import type { VisionAnalysis, VisionFinding } from "@/lib/senseiVisionTypes";
import type { VisionReviewPackage } from "@/lib/visionGovernance";

type VisionBuildStage =
  | "IDLE"
  | "UPLOADING_FRAME"
  | "FRAME_LOCKED"
  | "READING_FRAME"
  | "SKELETON_DETECTED"
  | "CORRECTION_FOUND"
  | "BREAK_POINT_IDENTIFIED"
  | "MISSION_UPDATED"
  | "BUILDING_CORRECTION"
  | "DONE"
  | "ERROR";

type VisionChatMessage = {
  id: string;
  role: "user" | "vision" | "system";
  text: string;
  ts: number;
};

type Props = {
  embedded?: boolean;
  sport: string;
  setSport: (value: string) => void;
  clipLabel: string;
  setClipLabel: (value: string) => void;
  notes: string;
  setNotes: (value: string) => void;
  selectedFileName: string;
  previewUrl: string | null;
  posePreview: any | null;
  onFileChange: (file: File | null) => void;
  onAnalyze: () => void;
  onReset: () => void;
  running: boolean;
  buildStage: VisionBuildStage;
  error: string | null;
  analysis: VisionAnalysis | null;
  reviewPackage: VisionReviewPackage | null;
  chatInput: string;
  setChatInput: (value: string) => void;
  chatSending: boolean;
  chatMessages: VisionChatMessage[];
  onSendChat: () => void;
  onChatKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  quickPrompts: string[];
  onQuickPrompt: (prompt: string) => void;
};

type Tone = "good" | "warn" | "bad" | "neutral";

const spring = {
  type: "tween",
  duration: 0.22,
  ease: [0.22, 1, 0.36, 1],
} as const;

const resultReveal = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.12,
      delayChildren: 0.06,
    },
  },
};

const resultItem = {
  hidden: { opacity: 0, y: 14, scale: 0.992 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: spring,
  },
};

type SkeletonState = {
  status: "Waiting" | "Clear" | "Limited";
  label: string;
  detail: string;
  tone: Tone;
};

type VisionSystemStep = {
  label: string;
  tone: Tone;
};

const VISION_SYSTEM_STEPS = [
  "EVIDENCE READY",
  "VISIBLE DETAILS",
  "OBSERVATION",
  "LIMITS",
  "REVIEW READY",
];

function visionStepIndex({
  previewUrl,
  running,
  buildStage,
  complete,
}: {
  previewUrl: string | null;
  running: boolean;
  buildStage: VisionBuildStage;
  complete: boolean;
}) {
  if (complete) return 4;
  if (!previewUrl) return -1;
  if (!running) return 0;

  const raw = String(buildStage || "IDLE").toUpperCase();

  if (raw.includes("UPLOAD") || raw.includes("FRAME_LOCKED")) return 0;
  if (raw.includes("READ") || raw.includes("SKELETON")) return 1;
  if (raw.includes("CORRECTION") || raw.includes("BUILD")) return 2;
  if (raw.includes("BREAK")) return 3;
  if (raw.includes("MISSION")) return 4;

  return 0;
}

function visionSystemLog({
  activeIndex,
}: {
  activeIndex: number;
}): VisionSystemStep[] {
  if (activeIndex < 0) return [];

  return VISION_SYSTEM_STEPS.slice(0, activeIndex + 1).map((label, index) => {
    return {
      label,
      tone: index === 4 ? "good" : index === activeIndex ? "warn" : "neutral",
    };
  });
}

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function clean(text?: string | null) {
  return String(text || "").replace(/\s+/g, " ").trim();
}

function coachCopy(text?: string | null) {
  return String(text || "")
    .replace(/Head Position Win/gi, "win head position")
    .replace(/No Opening Created/gi, "you went too early")
    .replace(/Opening Created/gi, "you got the reaction")
    .replace(/Opening Missed/gi, "you saw it late")
    .replace(/Opening Lost/gi, "you waited too long")
    .replace(/Finished Despite Flaw/gi, "it worked, but it was wrong")
    .replace(/Opponent Trap/gi, "he baited the shot")
    .replace(/Required Opening/gi, "reaction you need")
    .replace(/Better Opponent/gi, "opponent")
    .replace(/Attack Window/gi, "time to go")
    .replace(/State Change/gi, "reaction")
    .replace(/Exchange/gi, "position")
    .replace(/Generated/gi, "ready")
    .replace(/\bwindow\b/gi, "moment")
    .replace(/\bopportunity\b/gi, "chance")
    .replace(/\b(?:likely|potentially|generally|often|typically)\b/gi, "")
    .replace(/\bmay\b/gi, "will")
    .replace(/\bcould\b/gi, "will")
    .replace(/high[- ]level opponent/gi, "opponent")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function compact(text?: string | null) {
  return clean(coachCopy(text)) || "No clear read from this frame.";
}

function matCommand(
  text: string | null | undefined,
  phase: "rule" | "command" | "force" | "see" | "go" | "read" | "punishment"
) {
  const value = clean(coachCopy(text));
  const lower = value.toLowerCase();

  if (phase === "rule") {
    if (/head position|head outside|ear.*ribs|forehead/.test(lower)) {
      return "Do not go before you win head position.";
    }
    if (/posture|snap/.test(lower)) return "Break his posture before you go.";
    if (/weight|stable|set stance/.test(lower)) return "Move his weight before you shoot.";
  }

  if (phase === "command") {
    if (/head.*outside|outside.*head/.test(lower)) return "Head outside. Reset.";
    if (/head position|ear.*ribs|forehead/.test(lower)) return "Ear to ribs first.";
    if (/shot.*before|before.*react/.test(lower)) return "You shot before he reacted.";
    if (/posture/.test(lower)) return "Move his posture first.";
    if (/weight|stable/.test(lower)) return "Move his weight first.";
  }

  if (phase === "force") {
    if (/guard|shell/.test(lower)) return "Move his guard first.";
    if (/rib|body/.test(lower)) return "Make him defend upstairs.";
    if (/lead leg|weight.*leg/.test(lower)) return "Load his lead leg.";
    if (/square|fence/.test(lower)) return "Make his feet square up.";
    if (/head|ear|forehead|ribs/.test(lower)) return "Ear in ribs first.";
    if (/posture|snap/.test(lower)) return "Snap first.";
    if (/weight/.test(lower)) return "Move his weight first.";
    if (/step/.test(lower)) return "Make him step.";
    if (/hand|wrist|tie/.test(lower)) return "Clear his hands.";
  }

  if (phase === "see") {
    if (/guard|rear hand/.test(lower)) return "Guard moves.";
    if (/elbow|rib/.test(lower)) return "Elbows lift.";
    if (/lead leg|weight.*leg/.test(lower)) return "Lead leg gets heavy.";
    if (/square|feet stop/.test(lower)) return "Feet square up.";
    if (/turn.*head|head turn/.test(lower)) return "Head turns.";
    if (/posture|comes up|rises/.test(lower)) return "Posture comes up.";
    if (/weight/.test(lower)) return "Weight shifts.";
    if (/step/.test(lower)) return "He steps.";
    if (/hand/.test(lower)) return "Hands leave.";
  }

  if (phase === "go") {
    if (/guard|rear hand/.test(lower)) return "Go as his guard moves.";
    if (/elbow|rib|body/.test(lower)) return "Go when his elbows lift.";
    if (/lead leg|weight.*leg/.test(lower)) return "Kick when his lead leg gets heavy.";
    if (/square|feet stop/.test(lower)) return "Go when his feet square up.";
    if (/square|reset/.test(lower)) return "Go before he squares up.";
    if (/posture|comes up|rises/.test(lower)) return "Go when his posture comes up.";
    if (/weight/.test(lower)) return "Go as his weight shifts.";
    if (/step/.test(lower)) return "Go on the step.";
    if (/hand/.test(lower)) return "Go when his hands leave.";
  }

  const first = value.split(/(?:\.|;|,\s+(?:then|and)\b)/i)[0]?.trim() || value;
  const words = first.split(/\s+/).filter(Boolean);
  return words.length > 8 ? `${words.slice(0, 8).join(" ")}.` : first;
}

function filmLine(text?: string | null) {
  const value = clean(coachCopy(text));
  if (!value) return "";
  const sentence = value.split(/(?<=[.!?])\s+/)[0] || value;
  const words = sentence.split(/\s+/).filter(Boolean);
  return words.length > 18 ? `${words.slice(0, 18).join(" ")}.` : sentence;
}

function filmLines(text?: string | null, limit = 4) {
  const value = clean(coachCopy(text));
  if (!value) return [];
  return value
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => filmLine(sentence))
    .filter(Boolean)
    .slice(0, limit);
}

function toneFromSeverity(value?: string | null): Tone {
  const v = clean(value).toUpperCase();
  if (v === "HIGH") return "bad";
  if (v === "MEDIUM") return "warn";
  if (v === "LOW") return "good";
  return "neutral";
}

function getSkeletonState(messages: VisionChatMessage[]): SkeletonState {
  const latest = [...messages]
    .reverse()
    .map((m) => clean(m.text))
    .find(
      (text) =>
        text.toLowerCase().includes("body position is clear") ||
        text.toLowerCase().includes("body position is unclear") ||
        text.toLowerCase().includes("body position could not be read")
    );

  if (!latest) {
    return {
      status: "Waiting",
      label: "Not reviewed",
      detail: "Run Vision to review the visible body position.",
      tone: "neutral",
    };
  }

  if (latest.toLowerCase().includes("body position is clear")) {
    return {
      status: "Clear",
      label: "Position visible",
      detail: "The image is clear enough to support an observation.",
      tone: "good",
    };
  }

  return {
    status: "Limited",
    label: "Limited view",
    detail: "Vision will rely only on what is clearly visible.",
    tone: "warn",
  };
}

function Badge({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: Tone;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]",
        tone === "good" &&
          "border-emerald-400/25 bg-emerald-500/10 text-emerald-200",
        tone === "warn" &&
          "border-amber-400/25 bg-amber-500/10 text-amber-200",
        tone === "bad" &&
          "border-rose-400/25 bg-rose-500/10 text-rose-200",
        tone === "neutral" &&
          "border-white/10 bg-white/[0.04] text-white/45"
      )}
    >
      {label}
    </span>
  );
}

function Surface({
  children,
  className,
  tone = "neutral",
}: {
  children: React.ReactNode;
  className?: string;
  tone?: Tone;
}) {
  return (
    <motion.section
      layout
      initial={{ opacity: 0, y: 8, scale: 0.992 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={spring}
      className={cn(
        "rounded-[22px] bg-[#101a28]/76 shadow-[inset_0_1px_0_rgba(255,255,255,0.055),0_20px_60px_rgba(0,0,0,0.24)] ring-1 backdrop-blur-xl",
        tone === "good" && "ring-emerald-300/14",
        tone === "warn" && "ring-amber-300/16",
        tone === "bad" && "ring-rose-300/16",
        tone === "neutral" && "ring-white/[0.075]",
        className
      )}
    >
      {children}
    </motion.section>
  );
}

function SectionTitle({
  eyebrow,
  title,
  subtitle,
  right,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        {eyebrow && (
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/36">
            {eyebrow}
          </p>
        )}

        <h2 className="mt-2 text-[22px] font-extrabold tracking-tight text-white">
          {title}
        </h2>

        {subtitle && (
          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/44">
            {subtitle}
          </p>
        )}
      </div>

      {right && <div className="shrink-0">{right}</div>}
    </div>
  );
}

function VisionEngineCard({
  running,
  buildStage,
  skeleton,
  landmarkCount = 0,
}: {
  running: boolean;
  buildStage: VisionBuildStage;
  skeleton: SkeletonState;
  landmarkCount?: number;
}) {
  const stage = String(buildStage || "IDLE").toUpperCase();
  const stageState = stage.includes("UPLOAD")
    ? { activeIndex: 0, target: 24, status: "Preparing evidence" }
    : stage.includes("READ") && landmarkCount > 0
      ? { activeIndex: 2, target: 72, status: "Visible position found" }
      : stage.includes("READ")
        ? { activeIndex: 1, target: 52, status: "Reviewing position" }
        : stage.includes("BUILD")
          ? { activeIndex: 3, target: 94, status: "Separating observation" }
          : stage === "DONE"
            ? { activeIndex: 4, target: 100, status: "Review ready" }
            : { activeIndex: 0, target: 8, status: "Ready" };
  const [displayProgress, setDisplayProgress] = useState(0);

  useEffect(() => {
    if (!running && stage === "IDLE") {
      setDisplayProgress(0);
      return;
    }

    const timer = window.setInterval(() => {
      setDisplayProgress((current) =>
        current >= stageState.target
          ? current
          : Math.min(
              stageState.target,
              current + Math.max(1, Math.ceil((stageState.target - current) / 10))
            )
      );
    }, 110);

    return () => window.clearInterval(timer);
  }, [running, stage, stageState.target]);

  const steps = [
    { key: "UPLOAD", label: "Evidence" },
    { key: "READ", label: "Review" },
    { key: "MAP", label: "Position" },
    { key: "BUILD", label: "Limits" },
  ];
  const activeIndex = stageState.activeIndex;

  return (
    <Surface className="p-5">
      <SectionTitle
        eyebrow="Evidence review"
        title="Reviewing the position"
        subtitle="Separating what is visible from what remains uncertain."
        right={<Badge label={running ? "Active" : "Ready"} tone={running ? "warn" : "good"} />}
      />

      <div className="mt-5">
        <div className="flex items-center justify-between gap-4">
          <AnimatePresence mode="wait">
            <motion.p
              key={stageState.status}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="text-xs font-semibold text-emerald-100/72"
            >
              {stageState.status}
            </motion.p>
          </AnimatePresence>
          <p className="text-xs font-bold tabular-nums text-emerald-200">
            {displayProgress}%
          </p>
        </div>

        <div className="relative mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
          <motion.div
            className="absolute inset-y-0 left-0 rounded-full bg-emerald-300 shadow-[0_0_18px_rgba(52,211,153,0.55)]"
            animate={{ width: `${displayProgress}%` }}
            transition={{ type: "tween", duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          />
          {running && (
            <motion.div
              className="absolute inset-y-0 w-12 bg-gradient-to-r from-transparent via-white/70 to-transparent"
              animate={{ x: [-48, 420] }}
              transition={{ duration: 1.35, repeat: Infinity, ease: "linear" }}
            />
          )}
        </div>
      </div>

      <div className="relative mt-5 grid grid-cols-4 gap-2">
        <div className="pointer-events-none absolute left-[12.5%] right-[12.5%] top-7 h-px bg-white/[0.08]" />
        <motion.div
          className="pointer-events-none absolute left-[12.5%] top-7 h-px bg-emerald-300/70 shadow-[0_0_12px_rgba(52,211,153,0.45)]"
          animate={{ width: `${Math.min(75, activeIndex * 25)}%` }}
          transition={spring}
        />

        {steps.map((step, index) => {
          const done = activeIndex > index || stage === "DONE";
          const active = activeIndex === index && running;

          return (
            <motion.div
              key={step.key}
              animate={active ? { y: [0, -2, 0] } : { y: 0 }}
              transition={active ? { duration: 1.4, repeat: Infinity } : spring}
              className={cn(
                "relative z-10 rounded-[1.1rem] p-3 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.045)] ring-1",
                done
                  ? "bg-emerald-500/[0.075] ring-emerald-300/15"
                  : active
                    ? "bg-amber-500/[0.09] ring-amber-300/25 shadow-[0_0_28px_rgba(251,191,36,0.09)]"
                    : "bg-white/[0.035] ring-white/[0.06]"
              )}
            >
              <motion.div
                className="mx-auto flex h-7 w-7 items-center justify-center rounded-full border border-white/10 text-xs text-white/70"
                animate={active ? { scale: [1, 1.16, 1], opacity: [0.72, 1, 0.72] } : { scale: 1, opacity: 1 }}
                transition={active ? { duration: 1.15, repeat: Infinity } : spring}
              >
                {done ? "✓" : index + 1}
              </motion.div>
              <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/38">
                {step.label}
              </p>
            </motion.div>
          );
        })}
      </div>

      <div className="mt-4 rounded-[1.25rem] bg-black/20 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.045)] ring-1 ring-white/[0.06]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/35">
              Visible position
            </p>
            <p className="mt-2 text-sm font-semibold text-white">
              {skeleton.label}
            </p>
            <p className="mt-1 text-xs leading-6 text-white/45">{skeleton.detail}</p>
          </div>
          <Badge label={skeleton.status} tone={skeleton.tone} />
        </div>
      </div>
    </Surface>
  );
}

function FrameScanner({
  previewUrl,
  selectedFileName,
  running,
  systemState,
  locked = false,
  compact = false,
}: {
  previewUrl: string | null;
  selectedFileName: string;
  running: boolean;
  systemState?: string;
  locked?: boolean;
  compact?: boolean;
}) {
  const active = running || Boolean(previewUrl);

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[1.75rem] bg-[#07111f]/84 shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_18px_45px_rgba(0,0,0,0.2)] ring-1 ring-sky-200/[0.09]",
        compact ? "min-h-[188px]" : "min-h-[440px]"
      )}
    >
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(125,211,252,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(125,211,252,0.06)_1px,transparent_1px)] bg-[size:28px_28px]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0,transparent_48%,rgba(2,7,20,0.88)_100%)]" />
      <div className="pointer-events-none absolute left-4 top-4 h-8 w-8 border-l border-t border-sky-200/22" />
      <div className="pointer-events-none absolute right-4 top-4 h-8 w-8 border-r border-t border-sky-200/22" />
      <div className="pointer-events-none absolute bottom-4 left-4 h-8 w-8 border-b border-l border-sky-200/22" />
      <div className="pointer-events-none absolute bottom-4 right-4 h-8 w-8 border-b border-r border-sky-200/22" />

      {active && (
        <motion.div
          className="pointer-events-none absolute inset-8 z-20 rounded-[1.5rem] border border-emerald-300/18 shadow-[inset_0_0_32px_rgba(52,211,153,0.05),0_0_36px_rgba(52,211,153,0.08)]"
          initial={{ opacity: 0, scale: 0.985 }}
          animate={{
            opacity: locked ? 0.76 : [0.24, 0.58, 0.24],
            scale: locked ? 1 : [0.985, 1.01, 0.985],
          }}
          transition={
            locked
              ? spring
              : { duration: 2.2, repeat: Infinity, ease: "easeInOut" }
          }
        />
      )}

      {active && (
        <motion.div
          className="pointer-events-none absolute left-0 right-0 z-20 h-16 bg-gradient-to-b from-transparent via-sky-300/22 to-transparent"
          initial={{ top: "-18%" }}
          animate={{ top: "112%" }}
          transition={{
            duration: running ? 1.7 : 3.6,
            repeat: Infinity,
            ease: "linear",
          }}
        />
      )}

      {active && (
        <motion.div
          className="pointer-events-none absolute left-1/2 top-1/2 z-20 h-28 w-28 -translate-x-1/2 -translate-y-1/2"
          initial={{ opacity: 0, scale: 0.84 }}
          animate={{ opacity: locked ? 0.9 : 0.62, scale: locked ? 1.04 : 1 }}
          transition={spring}
        >
          <motion.div
            className="absolute inset-0 rounded-full border border-sky-200/24"
            animate={{
              scale: running ? [0.9, 1.16, 0.9] : locked ? 1.08 : 1,
              opacity: running ? [0.22, 0.7, 0.22] : locked ? 0.55 : 0.34,
            }}
            transition={
              running
                ? { duration: 1.6, repeat: Infinity, ease: "easeInOut" }
                : spring
            }
          />
          <div className="absolute left-1/2 top-0 h-7 w-px -translate-x-1/2 bg-sky-200/34" />
          <div className="absolute bottom-0 left-1/2 h-7 w-px -translate-x-1/2 bg-sky-200/34" />
          <div className="absolute left-0 top-1/2 h-px w-7 -translate-y-1/2 bg-sky-200/34" />
          <div className="absolute right-0 top-1/2 h-px w-7 -translate-y-1/2 bg-sky-200/34" />
          <motion.div
            className={cn(
              "absolute left-1/2 top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full",
              locked
                ? "bg-emerald-300 shadow-[0_0_22px_rgba(52,211,153,0.85)]"
                : "bg-sky-200 shadow-[0_0_18px_rgba(125,211,252,0.65)]"
            )}
            animate={{ scale: running ? [0.85, 1.25, 0.85] : 1 }}
            transition={{ duration: 1.2, repeat: running ? Infinity : 0 }}
          />
        </motion.div>
      )}

      <div className="absolute left-4 top-4 z-30 flex flex-wrap items-center gap-2">
        {(systemState || running || previewUrl) && (
          <Badge
            label={systemState || (running ? "Reviewing evidence" : "Evidence ready")}
            tone={locked ? "good" : running ? "warn" : "good"}
          />
        )}
        {selectedFileName && <Badge label="Evidence" tone="neutral" />}
      </div>

      {previewUrl && (
        <div className="absolute bottom-4 left-4 right-4 z-30 flex items-end justify-between gap-4 rounded-[1.2rem] bg-[#020714]/72 px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] ring-1 ring-sky-200/[0.07] backdrop-blur-xl">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-sky-100/45">
            Vision evidence
          </p>
          <p className="mt-1 truncate text-sm font-semibold text-white/82">
            {selectedFileName}
          </p>
        </div>

        <p className="shrink-0 text-[10px] font-semibold tracking-[0.12em] text-emerald-200/55">
          {locked ? "REVIEWED" : "READY"}
        </p>
        </div>
      )}

      {previewUrl ? (
        /\.(mp4|mov|m4v|webm|ogg)$/i.test(selectedFileName) ? (
          <motion.video
            key={previewUrl}
            src={previewUrl}
            controls
            playsInline
            initial={{ opacity: 0, scale: 1.015 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            className={cn(
              "relative z-10 h-full w-full object-contain p-3",
              compact ? "max-h-[240px]" : "max-h-[620px]"
            )}
          />
        ) : (
          <motion.img
            key={previewUrl}
            src={previewUrl}
            alt="Evidence preview"
            initial={{ opacity: 0, scale: 1.015 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            className={cn(
              "relative z-10 h-full w-full object-contain p-3",
              compact ? "max-h-[240px]" : "max-h-[620px]"
            )}
          />
        )
      ) : (
        <div className="relative z-10 flex min-h-[inherit] items-center justify-center px-8 pb-24 pt-16 text-center">
          <div className="max-w-sm">
            <div className="mx-auto h-16 w-16 rounded-[1.35rem] bg-white/[0.035] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] ring-1 ring-white/10" />
            <p className="mt-5 text-sm font-semibold uppercase tracking-[0.12em] text-white/72">
              Choose media
            </p>
            <p className="mt-2 text-xs leading-6 text-white/46">
          Add a still image to preview it before review.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
function UploadPanel({
  sport,
  setSport,
  clipLabel,
  setClipLabel,
  notes,
  setNotes,
  selectedFileName,
  previewUrl,
  posePreview,
  onFileChange,
  onAnalyze,
  onReset,
  running,
  error,
  correctionLocked,
}: {
  sport: string;
  setSport: (value: string) => void;
  clipLabel: string;
  setClipLabel: (value: string) => void;
  notes: string;
  setNotes: (value: string) => void;
  selectedFileName: string;
  previewUrl: string | null;
  posePreview: any | null;
  onFileChange: (file: File | null) => void;
  onAnalyze: () => void;
  onReset: () => void;
  running: boolean;
  error: string | null;
  correctionLocked?: boolean;
}) {
  const sports = [
    "Wrestling",
    "MMA",
    "BJJ",
    "Boxing",
    "Kickboxing",
    "Muay Thai",
    "Judo",
    "Sambo",
  ];
async function handleUploadFile(file: File | null) {
  onFileChange(file);
}
  return (
    <Surface
      className="
        relative
        overflow-hidden
        before:pointer-events-none
        before:absolute
        before:inset-0
        before:bg-[radial-gradient(circle_at_top,rgba(52,211,153,0.14),transparent_58%)]
      "
      tone="neutral"
    >
      <div className="p-5 pb-0">
        <SectionTitle
          eyebrow="Vision"
          title={correctionLocked ? "Review ready" : "Review evidence"}
          subtitle={
            correctionLocked
              ? "Observation, interpretation, and limits are separated."
              : "Load media. Vision will show what the evidence supports."
          }
          right={
            running ? <Badge label="Analysing" tone="warn" /> : undefined
          }
        />
      </div>

      <div className="flex flex-col gap-4 p-5">
        <div className="order-2">
          <label className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/35">
            Sport
          </label>

          <div className="mt-2 flex flex-wrap gap-2">
            {sports.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setSport(item)}
                className={cn(
                  "rounded-full px-3 py-2 text-[11px] font-semibold shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] ring-1 transition",
                  sport === item
                    ? "bg-emerald-500/14 text-emerald-100 ring-emerald-300/24 shadow-[0_0_24px_rgba(52,211,153,0.08)]"
                    : "bg-white/[0.045] text-white/46 ring-white/[0.075] hover:bg-white/[0.075] hover:text-white/72"
                )}
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        <details className="group order-3 rounded-[1.2rem] bg-white/[0.035] ring-1 ring-white/[0.07]">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-xs font-semibold text-white/62">
            <span>Your context</span>
            <span className="text-[10px] uppercase tracking-[0.12em] text-white/30 group-open:hidden">
              {notes || clipLabel.trim() ? "Added" : "Optional"}
            </span>
            <span className="hidden text-white/35 group-open:inline">Close</span>
          </summary>

          <div className="space-y-4 border-t border-white/[0.06] p-4">
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/35">
                Session label
              </label>
              <input
                value={clipLabel}
                onChange={(e) => setClipLabel(e.target.value)}
                className="mt-2 w-full rounded-[1rem] bg-black/24 px-4 py-3 text-sm text-white outline-none ring-1 ring-white/[0.08] placeholder:text-white/22 focus:ring-emerald-300/24"
                placeholder="Round 2, 01:14"
              />
            </div>

            <div>
              <label className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/35">
                What were you trying to do?
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="mt-2 w-full resize-none rounded-[1rem] bg-black/24 px-4 py-3 text-sm leading-6 text-white outline-none ring-1 ring-white/[0.08] placeholder:text-white/22 focus:ring-emerald-300/24"
                placeholder="Add the position, setup, or problem."
              />
            </div>
          </div>
        </details>

        <div className="order-1">
          <div className="flex items-center justify-between gap-3">
            <label className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/35">
              Evidence
            </label>
            {posePreview?.landmarkCount ? (
              <Badge label="Position found" tone="good" />
            ) : (
              <Badge label="Image" tone="neutral" />
            )}
          </div>

          <label className="mt-2 block cursor-pointer rounded-[1.1rem] bg-sky-300/[0.045] p-3 ring-1 ring-sky-300/10 transition hover:bg-sky-300/[0.07] hover:ring-sky-200/20">
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              disabled={running}
              onChange={(e) => handleUploadFile(e.target.files?.[0] || null)}
/>
            <div className="grid grid-cols-[40px_1fr_auto] items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-sky-300/[0.07] text-lg text-sky-100/60 ring-1 ring-sky-200/10">
                +
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-white/78">
                  {selectedFileName || "Choose media"}
                </p>
                <p className="mt-0.5 text-[11px] text-white/35">
                  {selectedFileName ? "Tap to replace" : "JPEG, PNG, or WebP · 10 MB max"}
                </p>
              </div>
              <span className="rounded-full bg-emerald-500/12 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-100 ring-1 ring-emerald-300/24">
                {selectedFileName ? "Replace" : "Load"}
              </span>
            </div>
          </label>
        </div>

        {error && (
          <div className="order-5 rounded-2xl border border-rose-400/20 bg-rose-500/10 p-4 text-sm leading-6 text-rose-100">
            {error}
          </div>
        )}

        <div className="order-6 grid grid-cols-[1fr_auto] gap-3 max-lg:sticky max-lg:bottom-3 max-lg:z-40 max-lg:rounded-[1.35rem] max-lg:bg-[#07111f]/92 max-lg:p-2 max-lg:shadow-[0_18px_50px_rgba(0,0,0,0.3)] max-lg:ring-1 max-lg:ring-white/10 max-lg:backdrop-blur-xl">
          <button
            type="button"
            onClick={onAnalyze}
            disabled={running || !previewUrl}
            className="app-button-accent"
          >
            {running ? "Reading..." : correctionLocked ? "Analyze again" : "Analyze frame"}
          </button>

          <button
            type="button"
            onClick={onReset}
            disabled={running}
            className="app-button-secondary"
          >
            Reset
          </button>
        </div>
      </div>
    </Surface>
  );
}

function VisionReviewResult({ reviewPackage, embedded = false }: { reviewPackage: VisionReviewPackage; embedded?: boolean }) {
  const observation = reviewPackage.claims.find((claim) => claim.kind === "OBSERVATION");
  const inference = reviewPackage.claims.find((claim) => claim.kind === "INFERENCE");
  const alternative = reviewPackage.claims.find((claim) => claim.kind === "ALTERNATIVE");
  const uncertainty = reviewPackage.claims.find((claim) => claim.kind === "UNCERTAINTY");
  const timestamp =
    observation?.provenance.timestampStart || observation?.provenance.frameReference;
  const evidenceLabel = reviewPackage.evidenceAssessment.evidenceStrength
    .toLowerCase()
    .replace(/_/g, " ");

  return (
    <Surface className="overflow-hidden" tone="neutral">
      <div className="p-6 sm:p-8 lg:p-10">
        <div className="flex flex-wrap items-center gap-2">
          <Badge label={evidenceLabel} tone="neutral" />
          <Badge
            label={reviewPackage.evidenceAssessment.adequacy
              .toLowerCase()
              .replace(/_/g, " ")}
            tone={reviewPackage.evidenceAssessment.canInfer ? "good" : "warn"}
          />
          {/*
            Vision used to hand-roll these four labels and their tones. They
            now come from the shared provenance vocabulary, so Vision, the
            Dashboard and Profile can never describe the same standing in
            different words.
          */}
          <Provenance
            kind={provenanceForEvidence(reviewPackage.evidenceAuthority)}
          />
          {timestamp && <Badge label={timestamp} tone="neutral" />}
        </div>

        <p className="mt-7 text-[10px] font-semibold uppercase tracking-[0.14em] text-sky-100/48">
          What Vision saw
        </p>
        <h1 className="mt-3 max-w-5xl text-[30px] font-semibold leading-[1.08] tracking-[-.035em] text-white sm:text-[38px] xl:text-[40px]">
          {observation?.statement || "No clear observation from this evidence."}
        </h1>
        <p className="mt-4 text-xs font-semibold uppercase tracking-[0.12em] text-white/35">
          Vision observation · {observation?.confidence || "LOW"} confidence
        </p>

        <div className="mt-8 grid gap-px overflow-hidden rounded-[1.25rem] bg-white/[0.06] lg:grid-cols-3" style={embedded ? { gridTemplateColumns: "minmax(0, 1fr)" } : undefined}>
          <div className="bg-[#091321] p-5 sm:p-6">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-100/45">
              Why it may matter
            </p>
            <p className="mt-3 text-sm font-semibold leading-6 text-white/72">
              {inference?.statement || "This evidence does not show why it happened."}
            </p>
            <p className="mt-4 text-[10px] uppercase tracking-[0.12em] text-white/28">
              Vision interpretation
            </p>
          </div>

          <div className="bg-[#091321] p-5 sm:p-6">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-100/45">
              What Vision cannot know
            </p>
            <p className="mt-3 text-sm font-semibold leading-6 text-amber-50/68">
              {uncertainty?.statement || "Your coach decides the technical priority."}
            </p>
            <p className="mt-4 text-[10px] uppercase tracking-[0.12em] text-white/28">
              Evidence limitation
            </p>
          </div>

          <div className="bg-[#091321] p-5 sm:p-6">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/35">
              What only the coach decides
            </p>
            <p className="mt-3 text-sm font-semibold leading-6 text-white/72">
              Whether this observation changes the active correction, reaction, or next decision.
            </p>
            <p className="mt-4 text-[10px] uppercase tracking-[0.12em] text-white/28">
              Coach decision · Not reviewed
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-px border-t border-white/[0.06] bg-white/[0.06] lg:grid-cols-2" style={embedded ? { gridTemplateColumns: "minmax(0, 1fr)" } : undefined}>
        <div className="bg-[#07111f] p-6 sm:p-7">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/35">
            Alternative explanation
          </p>
          <p className="mt-3 text-sm leading-6 text-white/58">
            {alternative?.statement || "No clear alternative is visible."}
          </p>
        </div>

        <div className="bg-[#07111f] p-6 sm:p-7">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/35">
            Next step
          </p>
          <p className="mt-3 text-base font-extrabold leading-6 text-emerald-100/82">
            Show this evidence to your coach.
          </p>
          {reviewPackage.evidenceAssessment.request && (
            <p className="mt-3 text-sm leading-6 text-amber-100/65">
              {reviewPackage.evidenceAssessment.request}
            </p>
          )}
        </div>
      </div>
    </Surface>
  );
}

function PrimaryCorrection({ finding }: { finding: VisionFinding }) {
  const severity = toneFromSeverity(finding.severity);
  const liveTransfer = Array.isArray(finding.live_rounds)
    ? finding.live_rounds.filter(Boolean).join(" ")
    : "";
  const openingFinding = finding as any;
  const openingStatus = clean(
    openingFinding.opening_status || openingFinding.opening_creation
  );
  const coachStatus: Record<string, string> = {
    "Opening Created": "Reaction appeared",
    "Opening Missed": "Reaction missed",
    "Opening Lost": "Reaction disappeared",
    "No Opening Created": "Reaction never forced",
    "Finished Despite Flaw": "Finished without position",
    "Opponent Trap": "He baited the shot",
  };
  const openingNeeded = clean(
    openingFinding.required_opening ||
      openingFinding.best_opening ||
      openingFinding.opening_needed ||
      openingFinding.reaction_required
  );
  const opponentPunishment = clean(
    openingFinding.opponent_punishment ||
      openingFinding.better_opponent_counter
  );
  const openingHow = clean(
    openingFinding.create_it ||
      openingFinding.opening_how ||
      openingFinding.how_to_create_it ||
      openingFinding.create_opening_with ||
      openingFinding.next_setup_to_create_opening
  );
  const reactionToForce = clean(
    openingFinding.reaction_to_force ||
      openingFinding.reaction_to_see ||
      openingFinding.required_reaction ||
      openingFinding.missing_reaction
  );
  const attackAfterReaction = clean(
    openingFinding.attack_after ||
      openingFinding.attack_after_reaction ||
      openingFinding.attack_after_opening ||
      openingFinding.attack_timing
  );
  const exchangeDecision = clean(
    openingFinding.decision ||
      openingFinding.exchange_decision ||
      finding.fix_next_rep
  );
  const urgencyLine = clean(openingFinding.urgency_line);
  const memoryRead = clean(
    openingFinding.vision_memory_signal ||
      openingFinding.history_signal ||
      openingFinding.correction_journey_message
  );
  const timestamp = clean(openingFinding.timestamp || openingFinding.timecode);
  const timestampChain = [
    ["Observation", openingFinding.observation],
    ["Consequence", openingFinding.consequence],
    ["Reason", openingFinding.reason],
    ["Correction", openingFinding.correction || exchangeDecision || finding.fix_next_rep],
  ]
    .map(([label, text]) => [label, filmLine(text as string)] as const)
    .filter(([, text]) => text);
  const rule = matCommand(
    exchangeDecision || finding.fix_next_rep || finding.title,
    "rule"
  );
  const coachCommands = [
    matCommand(finding.title, "command"),
    matCommand(openingHow || finding.fix_next_rep, "force"),
  ].filter((item, index, items) => item && items.indexOf(item) === index).slice(0, 2);
  const punishmentLines = opponentPunishment
    .split(/(?:\.|,)\s+/)
    .map((item) => filmLine(item))
    .filter(Boolean)
    .slice(0, 3);
  const frameRead = [
    ...filmLines(openingFinding.exchange_break || openingFinding.where_exchange_broke, 4),
    ...filmLines(openingFinding.process || openingFinding.exchange_entry || finding.title, 2),
    ...filmLines(memoryRead, 2),
    filmLine(openingFinding.missing_reaction),
    filmLine(openingFinding.opening_why || openingFinding.why_it_matters),
    ...punishmentLines,
  ].filter((item, index, items) => item && items.indexOf(item) === index).slice(0, 7);
  return (
    <Surface className="relative overflow-hidden" tone={severity}>
      <div className="relative p-6 sm:p-8 lg:p-10">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-100/65">
              Main correction
            </p>

            <motion.h1
              layout="position"
              className="mt-3 max-w-5xl text-[30px] font-semibold uppercase leading-[1.06] tracking-[-.03em] text-white sm:text-[38px] xl:text-[40px]"
            >
              {rule}
            </motion.h1>

            <div className="mt-6 grid max-w-5xl gap-6 border-t border-white/[0.07] pt-5 xl:grid-cols-[0.72fr_1.28fr]">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-100/45">
                  Coach command
                </p>
                <div className="mt-3 space-y-2">
                  {coachCommands.map((command) => (
                    <p key={command} className="text-lg font-black leading-6 text-white/90">
                      {command}
                    </p>
                  ))}
                </div>

                {openingNeeded && (
                  <div className="mt-5 border-t border-emerald-300/12 pt-4">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/30">
                      Position needed
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <p className="text-sm font-extrabold text-emerald-100/82">
                        {coachCopy(openingNeeded)}
                      </p>
                      {openingStatus && (
                        <Badge
                          label={coachStatus[openingStatus] || openingStatus}
                          tone={openingStatus === "Opening Created" ? "good" : "warn"}
                        />
                      )}
                    </div>
                  </div>
                )}
              </div>

              {(timestampChain.length > 0 || frameRead.length > 0) && (
                <div>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-sky-100/42">
                      Where it broke
                    </p>
                    {timestamp && <Badge label={timestamp} tone="neutral" />}
                  </div>

                  {timestampChain.length > 0 ? (
                    <div className="mt-4 space-y-3">
                      {timestampChain.map(([label, text]) => (
                        <div key={label}>
                          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/30">
                            {label}
                          </p>
                          <p
                            className={cn(
                              "mt-1 text-sm font-semibold leading-6",
                              label === "Consequence"
                                ? "text-rose-100/78"
                                : label === "Correction"
                                  ? "text-emerald-100/82"
                                  : "text-white/64"
                            )}
                          >
                            {text}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-3 space-y-1.5">
                      {frameRead.map((item, index) => (
                        <p
                          key={`${item}-${index}`}
                          className={cn(
                            "text-sm font-semibold leading-6",
                            punishmentLines.includes(item)
                              ? "text-rose-100/78"
                              : "text-white/64"
                          )}
                        >
                          {item}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {openingStatus && !openingNeeded && (
            <Badge label={coachStatus[openingStatus] || openingStatus} tone="warn" />
          )}
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...spring, delay: 0.12 }}
        className="relative border-t border-white/[0.06] px-6 py-6 sm:px-8 lg:px-10"
      >
        <div className="grid gap-3 md:grid-cols-[1fr_32px_1fr_32px_1fr] md:items-center">
          {[
            ["1", "Force", openingHow || finding.fix_next_rep],
            ["2", "See", reactionToForce || finding.interrupt],
            ["3", "Go", attackAfterReaction || liveTransfer],
          ].map(([step, label, text], index) => (
            <React.Fragment key={label}>
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ ...spring, delay: 0.18 + index * 0.08 }}
                className="min-h-[118px] border-l-2 border-emerald-300/35 bg-white/[0.025] px-5 py-4"
              >
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-bold text-emerald-200/50">0{step}</span>
                  <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-emerald-100/80">
                    {label}
                  </p>
                </div>
                <p className="mt-4 text-base font-extrabold leading-6 text-white/90">
                  {matCommand(
                    text,
                    label === "Force" ? "force" : label === "See" ? "see" : "go"
                  )}
                </p>
              </motion.div>

              {index < 2 && (
                <motion.div
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ ...spring, delay: 0.25 + index * 0.08 }}
                  className="flex h-8 items-center justify-center text-xl font-black text-emerald-300/55 rotate-90 md:rotate-0"
                  aria-hidden="true"
                >
                  →
                </motion.div>
              )}
            </React.Fragment>
          ))}
        </div>

        {urgencyLine && (
          <motion.p
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...spring, delay: 0.42 }}
            className="mt-6 border-t border-amber-300/12 pt-5 text-sm font-bold leading-6 text-amber-100/78"
          >
            {urgencyLine}
          </motion.p>
        )}
      </motion.div>
    </Surface>
  );
}

function TrainingBlock({ finding }: { finding: VisionFinding }) {
  const train = Array.isArray(finding.train)
    ? finding.train.filter(Boolean)
    : [];
  const drillType = (item: string) => {
    const value = item.toLowerCase();
    if (/wall|fence/.test(value)) return "Wall drill";
    if (/finish|shot|entry|penetration|double|single/.test(value)) return "Finish drill";
    if (/tie|snap|hand|wrist|collar/.test(value)) return "Hand fight";
    return "Position drill";
  };
  const correctionText = clean(
    [
      finding.title,
      finding.fix_next_rep,
      (finding as any).create_it,
      (finding as any).reaction_to_force,
    ].filter(Boolean).join(" ")
  ).toLowerCase();
  const constraintActive = Boolean((finding as any).constraint_active);
  const drillPurpose = (item: string) => {
    const value = `${item} ${correctionText}`.toLowerCase();
    if (/head|ear|forehead|ribs|whizzer/.test(value)) {
      return { cue: "Ear in ribs.", goal: "Whizzer never starts." };
    }
    if (/posture|snap|collar/.test(value)) {
      return { cue: "Turn his head.", goal: "His stance breaks." };
    }
    if (/feet|hips|penetration|finish|shot/.test(value)) {
      return { cue: "Feet under hips.", goal: "Shot keeps moving." };
    }
    return { cue: "Own the position.", goal: "No broken reps." };
  };

  return (
    <Surface className="p-6 sm:p-7">
      <SectionTitle
        eyebrow="Today"
        title="Train this"
        subtitle={
          constraintActive
            ? "Training adapted to the current body limits."
            : "Drill the setup, reaction, and shot together."
        }
        right={<Badge label="Next session" tone="good" />}
      />

      <div className="mt-5 divide-y divide-white/[0.06] border-y border-white/[0.06]">
        {(train.length
          ? train
          : ["Run 5 clean proof reps", "Add light resistance", "Reset every failed rep"]
        ).map((item, index) => {
          const purpose = drillPurpose(String(item));
          return (
          <div key={index} className="grid grid-cols-[36px_1fr] gap-3 py-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-full border border-emerald-400/20 bg-emerald-500/10 text-xs font-semibold text-emerald-200">
              {String(index + 1).padStart(2, "0")}
            </div>

            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-200/48">
                {drillType(String(item))}
              </p>
              <p className="mt-1 text-sm font-semibold leading-7 text-white break-words whitespace-normal">
                {coachCopy(String(item))}
              </p>
              <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs font-semibold">
                <span className="text-sky-100/55">Cue: {purpose.cue}</span>
                <span className="text-emerald-100/55">Goal: {purpose.goal}</span>
              </div>
            </div>
          </div>
          );
        })}
      </div>
    </Surface>
  );
}

function ProofGate({ finding }: { finding: VisionFinding }) {
  const severity = clean(finding.severity).toUpperCase();
  const locked = severity === "HIGH" || severity === "MEDIUM";
  const retention = clean((finding as any).retention_status).toUpperCase();
  const headPositionRule = /head|ear|forehead|ribs/i.test(
    `${finding.title || ""} ${finding.fix_next_rep || ""}`
  );
  const constraintActive = Boolean((finding as any).constraint_active);
  const correctionStays = clean((finding as any).correction_stays);
  const proofChanges = clean((finding as any).proof_changes);
  const todaysProof = clean((finding as any).todays_proof);
  const proofFail = clean((finding as any).proof_fail);
  const memoryTrend = clean((finding as any).memory_trend).toLowerCase();
  const memoryOccurrences = Number((finding as any).memory_total_occurrences || 0);
  const memoryProof = clean((finding as any).memory_drilling_signal);
  const proofTitle =
    locked && memoryTrend === "worsening"
      ? "SLIPPING."
      : locked && memoryOccurrences >= 3
        ? "NOT RETAINED."
        : locked && retention.includes("NOT RETAINED")
          ? "NOT RETAINED."
          : locked
            ? "PROVE IT."
            : "OWN IT UNDER PRESSURE.";
  const proofSubtitle =
    memoryProof && memoryProof !== "No drilling proof yet."
      ? memoryProof
      : locked
        ? "Do not add speed or harder rounds until this holds."
        : "Keep building until the correction survives pressure.";

  return (
    <Surface className="p-6 sm:p-7" tone={locked ? "warn" : "good"}>
      <SectionTitle
        eyebrow="Proof Required"
        title={proofTitle}
        subtitle={proofSubtitle}
        right={
            <Badge label={locked ? "Locked" : "Holding"} tone={locked ? "warn" : "good"} />
        }
      />

      {constraintActive && (
        <div className="mt-5 grid gap-4 border-y border-amber-300/12 py-5 sm:grid-cols-2">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-200/55">
              Correction stays
            </p>
            <p className="mt-2 text-sm font-bold leading-6 text-white/82">
              {correctionStays}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-200/55">
              Proof changes
            </p>
            <p className="mt-2 text-sm font-bold leading-6 text-white/82">
              {proofChanges}
            </p>
          </div>
        </div>
      )}

      <div className="mt-5 border-t border-white/[0.07] pt-5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/35">
          Pass this test
        </p>

        <p className="mt-3 text-base font-bold leading-7 text-white/82">
          {constraintActive && todaysProof
            ? todaysProof
            : headPositionRule
              ? "No head position = rep does not count."
              : "Correction breaks = rep does not count."}
          <span className="mt-1 block text-rose-100/72">
            {constraintActive && proofFail
              ? `Fail: ${proofFail}`
              : "Result does not matter. Correction matters."}
          </span>
        </p>
      </div>
    </Surface>
  );
}

function ChatPanel({
  chatMessages,
  chatInput,
  setChatInput,
  chatSending,
  onSendChat,
  onChatKeyDown,
  quickPrompts,
  onQuickPrompt,
  systemLog = [],
}: {
  chatMessages: VisionChatMessage[];
  chatInput: string;
  setChatInput: (value: string) => void;
  chatSending: boolean;
  onSendChat: () => void;
  onChatKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  quickPrompts: string[];
  onQuickPrompt: (prompt: string) => void;
  systemLog?: VisionSystemStep[];
}) {
  const [selectedPrompt, setSelectedPrompt] = useState<string | null>(null);
  const prompts = quickPrompts.length
    ? quickPrompts
    : [
        "How do I make him react?",
        "What reaction am I waiting for?",
        "When do I attack?",
        "What do I drill today?",
      ];

  return (
    <Surface className="overflow-hidden">
      <details className="group">
        <summary className="cursor-pointer list-none p-5">
          <SectionTitle
            eyebrow="Follow-up"
            title="Ask one question"
            subtitle="Open only when the correction needs clarification."
            right={
              <Badge
                label={chatSending ? "Answering" : "Open coach"}
                tone={chatSending ? "warn" : "neutral"}
              />
            }
          />
        </summary>

      <div className="space-y-4 border-t border-white/[0.06] p-5">
        <div className="grid gap-2 sm:grid-cols-2">
          {prompts.slice(0, 4).map((prompt) => (
            <motion.button
              key={prompt}
              type="button"
              layout
              whileHover={{ y: -1, scale: 1.015 }}
              whileTap={{ scale: 0.965 }}
              transition={spring}
              onClick={() => {
                setSelectedPrompt(prompt);
                onQuickPrompt(prompt);
              }}
              className={cn(
                "rounded-full px-3 py-2 text-left text-[11px] font-semibold uppercase leading-5 tracking-[0.08em] ring-1 transition",
                selectedPrompt === prompt
                  ? "bg-emerald-500/[0.12] text-emerald-50 ring-emerald-300/25 shadow-[0_0_26px_rgba(52,211,153,0.1)]"
                  : "bg-white/[0.05] text-white/52 ring-white/[0.07] hover:bg-white/[0.08] hover:text-white/82"
              )}
            >
              {prompt}
            </motion.button>
          ))}
        </div>

        <div className="max-h-[260px] space-y-3 overflow-y-auto pr-1">
          <AnimatePresence initial={false}>
            {systemLog.map((entry, index) => (
              <motion.div
                key={`${entry.label}-${index}`}
                layout
                initial={{ opacity: 0, x: -8, scale: 0.985 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 6, scale: 0.985 }}
                transition={{ ...spring, delay: index * 0.035 }}
                className={cn(
                  "flex items-center gap-3 rounded-[1.05rem] bg-black/22 px-3 py-2.5 text-[10px] font-semibold uppercase tracking-[0.12em] ring-1",
                  entry.tone === "good" &&
                    "text-emerald-100/72 ring-emerald-300/16",
                  entry.tone === "warn" &&
                    "text-amber-100/72 ring-amber-300/16",
                  entry.tone === "bad" &&
                    "text-rose-100/72 ring-rose-300/16",
                  entry.tone === "neutral" &&
                    "text-sky-100/50 ring-sky-200/[0.08]"
                )}
              >
                <motion.span
                  className={cn(
                    "h-1.5 w-1.5 shrink-0 rounded-full",
                    entry.tone === "good" &&
                      "bg-emerald-300 shadow-[0_0_14px_rgba(52,211,153,0.75)]",
                    entry.tone === "warn" &&
                      "bg-amber-300 shadow-[0_0_14px_rgba(251,191,36,0.6)]",
                    entry.tone === "neutral" && "bg-sky-200/55",
                    entry.tone === "bad" && "bg-rose-300"
                  )}
                  animate={
                    index === systemLog.length - 1
                      ? { scale: [1, 1.55, 1], opacity: [0.65, 1, 0.65] }
                      : { scale: 1, opacity: 0.72 }
                  }
                  transition={{
                    duration: 1.2,
                    repeat: index === systemLog.length - 1 ? Infinity : 0,
                  }}
                />
                <span>{entry.label}</span>
              </motion.div>
            ))}
          </AnimatePresence>

          {chatMessages.map((msg) => (
            <motion.div
              key={msg.id}
              layout
              initial={{ opacity: 0, y: 10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={spring}
              className={cn(
                "rounded-[1.25rem] p-3 text-sm leading-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] ring-1",
                msg.role === "user" &&
                  "ml-8 bg-emerald-500/[0.07] text-emerald-50/84 ring-emerald-300/14",
                msg.role === "vision" &&
                  "mr-8 bg-white/[0.04] text-white/78 ring-white/[0.07]",
                msg.role === "system" &&
                  "bg-amber-500/[0.07] text-amber-50/74 ring-amber-300/14"
              )}
            >
              {msg.text}
            </motion.div>
          ))}
        </div>

        <div className="grid grid-cols-[1fr_auto] gap-3">
          <textarea
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={onChatKeyDown}
            rows={3}
            placeholder="Ask about the active evidence..."
            className="resize-none rounded-[1.35rem] bg-black/24 px-4 py-3 text-sm leading-6 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.045)] outline-none ring-1 ring-white/[0.08] placeholder:text-white/24 focus:ring-emerald-300/24"
          />

          <button
            type="button"
            onClick={onSendChat}
            disabled={chatSending || !clean(chatInput)}
            className="rounded-full bg-emerald-400 px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-[#03130d] shadow-[0_14px_34px_rgba(16,185,129,0.16)] disabled:opacity-40"
          >
            Send
          </button>
        </div>
      </div>
      </details>
    </Surface>
  );
}

function EmptyState({ embedded = false }: { embedded?: boolean }) {
  return (
    <Surface className={cn(embedded ? "min-h-[360px]" : "min-h-[520px]", "overflow-hidden p-4 sm:p-6")}>
      <div className={cn("grid gap-5 lg:grid-cols-[minmax(0,1.08fr)_360px]", embedded ? "min-h-[320px]" : "min-h-[480px]")} style={embedded ? { gridTemplateColumns: "minmax(0, 1fr)" } : undefined}>
        <FrameScanner
          previewUrl={null}
          selectedFileName=""
          running={false}
        />

        <div className="flex flex-col justify-between rounded-[1.75rem] bg-white/[0.035] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.055),0_16px_40px_rgba(0,0,0,0.16)] ring-1 ring-white/[0.07]">
          <div>
            <h1 className="text-3xl font-semibold tracking-[-.03em] text-white/84 sm:text-4xl">
              Choose a moment to review.
            </h1>

            <p className="mt-4 text-sm leading-7 text-white/48">
              Vision separates what is visible from what must remain uncertain.
            </p>
          </div>
        </div>
      </div>
    </Surface>
  );
}

function ArmedFrameState({
  previewUrl,
  selectedFileName,
  running,
  systemState,
}: {
  previewUrl: string | null;
  selectedFileName: string;
  running: boolean;
  systemState?: string;
}) {
  return (
    <Surface className="overflow-hidden p-0">
      <div className="border-b border-sky-200/[0.08] bg-black/20 px-5 py-4">
        <SectionTitle
          eyebrow="Evidence ready"
          title="Ready to review"
          subtitle="Run Vision to separate what is visible from what remains uncertain."
          right={<Badge label="Ready" tone="warn" />}
        />
      </div>

      <div className="p-4">
        <FrameScanner
          previewUrl={previewUrl}
          selectedFileName={selectedFileName}
          running={running}
          systemState={systemState}
        />
      </div>
    </Surface>
  );
}

function LoadingState({
  buildStage,
  activeIndex,
}: {
  buildStage: VisionBuildStage;
  activeIndex: number;
}) {
  const raw = String(buildStage || "IDLE").toUpperCase();

  const stage = raw.includes("UPLOAD")
    ? {
        eyebrow: "Evidence",
        title: "Preparing your image.",
        detail: "Keeping this moment clear for review.",
        pct: 10,
      }
    : raw.includes("FRAME_LOCKED")
    ? {
        eyebrow: "Evidence",
        title: "Image ready.",
        detail: "Reviewing what is visible.",
        pct: 22,
      }
    : raw.includes("READ")
    ? {
        eyebrow: "Observation",
        title: "Reviewing the position.",
        detail: "Looking at stance, posture, and visible movement.",
        pct: 38,
      }
    : raw.includes("SKELETON")
    ? {
        eyebrow: "Observation",
        title: "Reviewing the position.",
        detail: "Looking only at details visible in the image.",
        pct: 52,
      }
    : raw.includes("CORRECTION") || raw.includes("BUILD")
    ? {
        eyebrow: "Observation",
        title: "Separating evidence from interpretation.",
        detail: "Keeping conclusions within what the image supports.",
        pct: 68,
      }
    : raw.includes("BREAK")
    ? {
        eyebrow: "Limits",
        title: "Marking what remains uncertain.",
        detail: "The evidence cannot establish intent or your coach’s priority.",
        pct: 84,
      }
    : raw.includes("MISSION")
    ? {
        eyebrow: "Review ready",
        title: "Evidence review ready.",
        detail: "No correction or training decision has been changed.",
        pct: 100,
      }
    : {
        eyebrow: "Vision",
        title: "Reviewing evidence.",
        detail: "Checking what the media supports and where it stops.",
        pct: 65,
      };

  return (
    <Surface
      className="
        relative
        min-h-[520px]
        overflow-hidden
        p-7
        before:pointer-events-none
        before:absolute
        before:inset-0
        before:bg-[radial-gradient(circle_at_top,rgba(52,211,153,0.16),transparent_58%)]
      "
      tone="good"
    >
      <div className="pointer-events-none absolute left-8 right-8 top-8 h-px bg-gradient-to-r from-transparent via-emerald-300/35 to-transparent" />
      <motion.div
        className="pointer-events-none absolute inset-x-6 top-1/2 h-px bg-gradient-to-r from-transparent via-sky-200/70 to-transparent shadow-[0_0_30px_rgba(125,211,252,0.45)]"
        initial={{ y: -190, opacity: 0.2 }}
        animate={{ y: 190, opacity: [0.2, 0.9, 0.2] }}
        transition={{ duration: 1.8, repeat: Infinity, ease: "linear" }}
      />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(125,211,252,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(125,211,252,0.04)_1px,transparent_1px)] bg-[size:34px_34px]" />

      <div className="relative z-10 flex h-full min-h-[460px] flex-col justify-center">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-300 shadow-[0_0_18px_rgba(52,211,153,0.75)]" />

          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-300/75">
            {stage.eyebrow}
          </p>
        </div>

        <h1 className="mt-4 max-w-3xl text-3xl font-semibold tracking-[-.035em] text-white sm:text-[40px]">
          {stage.title}
        </h1>

        <p className="mt-4 max-w-xl text-sm leading-7 text-white/50">
          {stage.detail}
        </p>

        <div className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {VISION_SYSTEM_STEPS.map((check, index) => {
            const done = index < activeIndex;
            const active = index === activeIndex;

            return (
              <motion.div
                key={check}
                layout
                initial={{ opacity: 0, y: 8, scale: 0.985 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ ...spring, delay: index * 0.04 }}
                className={cn(
                  "rounded-2xl border p-4 transition",
                  active || done
                    ? "border-emerald-400/25 bg-emerald-500/[0.07] shadow-[0_0_30px_rgba(52,211,153,0.08)]"
                    : "border-white/[0.07] bg-white/[0.025]"
                )}
              >
                <motion.div
                  className={cn(
                    "mb-3 h-2 w-2 rounded-full",
                    active
                      ? "animate-pulse bg-emerald-300 shadow-[0_0_14px_rgba(52,211,153,0.75)]"
                      : done
                      ? "bg-sky-200/70 shadow-[0_0_14px_rgba(125,211,252,0.35)]"
                      : "bg-white/18"
                  )}
                  animate={
                    active
                      ? { scale: [1, 1.45, 1], opacity: [0.7, 1, 0.7] }
                      : { scale: 1, opacity: done ? 0.9 : 0.45 }
                  }
                  transition={{
                    duration: 1.15,
                    repeat: active ? Infinity : 0,
                    ease: "easeInOut",
                  }}
                />

                <p className="text-[10px] font-semibold uppercase leading-5 tracking-[0.12em] text-white/50">
                  {check}
                </p>
              </motion.div>
            );
          })}
        </div>

        <div className="mt-8 h-1.5 overflow-hidden rounded-full bg-white/10">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-emerald-500/40 via-emerald-300 to-emerald-500/40 shadow-[0_0_24px_rgba(52,211,153,0.28)] transition-all duration-700"
            style={{ width: `${stage.pct}%` }}
            initial={{ opacity: 0.55 }}
            animate={{ opacity: [0.55, 1, 0.55] }}
            transition={{ duration: 1.2, repeat: Infinity }}
          />
        </div>

        <div className="mt-3 flex items-center justify-between">
          <p className="text-xs text-white/35">
            Observation is not a coach decision.
          </p>

          <p className="text-[10px] font-semibold tracking-[0.12em] text-emerald-200/60">
            {stage.pct}% READY
          </p>
        </div>
      </div>
    </Surface>
  );
}

export default function SenseiVisionScreen({
  embedded = false,
  sport,
  setSport,
  clipLabel,
  setClipLabel,
  notes,
  setNotes,
  selectedFileName,
  onFileChange,
  previewUrl,
  posePreview,
  onAnalyze,
  onReset,
  running,
  buildStage,
  error,
  reviewPackage,
  chatInput,
  setChatInput,
  chatSending,
  chatMessages,
  onSendChat,
  onChatKeyDown,
  quickPrompts,
  onQuickPrompt,
}: Props) {
  const skeleton = useMemo(
    () => getSkeletonState(chatMessages),
    [chatMessages]
  );
  const systemStepIndex = useMemo(
    () =>
      visionStepIndex({
        previewUrl,
        running,
        buildStage,
        complete: Boolean(reviewPackage),
      }),
    [previewUrl, running, buildStage, reviewPackage]
  );
  const systemLog = useMemo(
    () => visionSystemLog({ activeIndex: systemStepIndex }),
    [systemStepIndex]
  );
  const currentSystemState = systemLog[systemLog.length - 1]?.label;

  return (
    <div
      className={cn(
        embedded ? "min-h-0 overflow-hidden bg-transparent font-medium text-white" : "min-h-screen overflow-hidden bg-[#020714] font-medium text-white"
      )}
    >
      <div className={cn("pointer-events-none inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(52,211,153,0.12),transparent_34%),radial-gradient(circle_at_78%_12%,rgba(168,85,247,0.10),transparent_32%),radial-gradient(circle_at_55%_95%,rgba(244,63,94,0.08),transparent_34%)]", embedded ? "absolute" : "fixed")} />
      <div className={cn("relative mx-auto grid w-full max-w-[1180px] gap-5 px-4 pt-5 sm:px-5", embedded ? "grid-cols-1 pb-5" : "app-chrome-pad lg:grid-cols-[360px_minmax(0,1fr)] xl:gap-6")}>
        <aside className={cn(embedded ? "space-y-5" : "contents lg:sticky lg:top-20 lg:block lg:self-start lg:space-y-5")}>
          <div className="order-1 lg:order-none">
            <UploadPanel
              sport={sport}
              setSport={setSport}
              clipLabel={clipLabel}
              setClipLabel={setClipLabel}
              notes={notes}
              setNotes={setNotes}
              selectedFileName={selectedFileName}
              previewUrl={previewUrl}
              posePreview={posePreview}
              onFileChange={onFileChange}
              onAnalyze={onAnalyze}
              onReset={onReset}
              running={running}
              error={error}
              correctionLocked={Boolean(reviewPackage)}
            />
          </div>

          <AnimatePresence initial={false}>
            {running && (
              <motion.div
                className="order-3 lg:order-none"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
              >
                <VisionEngineCard
                  running={running}
                  buildStage={buildStage}
                  skeleton={skeleton}
                  landmarkCount={Number(posePreview?.landmarkCount || 0)}
                />
              </motion.div>
            )}
          </AnimatePresence>

        </aside>

        <main className="order-2 space-y-5 lg:order-none">
          <AnimatePresence mode="wait">
            {running ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.22 }}
              >
                <LoadingState buildStage={buildStage} activeIndex={systemStepIndex} />
              </motion.div>
            ) : reviewPackage ? (
              <motion.div
                key="evidence-review"
                variants={resultReveal}
                initial="hidden"
                animate="visible"
                exit={{ opacity: 0, y: -8 }}
                className="space-y-5"
              >
                <div className="grid items-start gap-5 xl:grid-cols-[minmax(320px,0.72fr)_minmax(0,1.28fr)]" style={embedded ? { gridTemplateColumns: "minmax(0, 1fr)" } : undefined}>
                  {previewUrl && (
                    <motion.div variants={resultItem} className="xl:sticky xl:top-20">
                      <Surface className="overflow-hidden p-0">
                        <div className="border-b border-white/[0.07] px-5 py-4">
                          <SectionTitle
                            eyebrow="Evidence"
                            title="Media preserved"
                            subtitle="Review the source beside Vision's claims."
                            right={<Badge label="Source media" tone="good" />}
                          />
                        </div>
                        <div className="p-4">
                          <FrameScanner
                            previewUrl={previewUrl}
                            selectedFileName={selectedFileName}
                            running={false}
                            systemState="Review ready"
                            locked
                          />
                        </div>
                      </Surface>
                    </motion.div>
                  )}
                  <motion.div variants={resultItem}>
                      <VisionReviewResult reviewPackage={reviewPackage} embedded={embedded} />
                  </motion.div>
                </div>

                <motion.div variants={resultItem}>
                  <ChatPanel
                    chatMessages={chatMessages}
                    chatInput={chatInput}
                    setChatInput={setChatInput}
                    chatSending={chatSending}
                    onSendChat={onSendChat}
                    onChatKeyDown={onChatKeyDown}
                    quickPrompts={quickPrompts}
                    onQuickPrompt={onQuickPrompt}
                  />
                </motion.div>
              </motion.div>
            ) : previewUrl ? (
              <motion.div
                key="armed"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.22 }}
              >
                <ArmedFrameState
                  previewUrl={previewUrl}
                  selectedFileName={selectedFileName}
                  running={running}
                  systemState={currentSystemState}
                />
              </motion.div>
            ) : (
              <motion.div
                key="empty"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.22 }}
              >
                <EmptyState embedded={embedded} />
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
