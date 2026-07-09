"use client";

import React, { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Inter_Tight } from "next/font/google";

const interTight = Inter_Tight({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800", "900"],
  display: "swap",
  variable: "--font-inter-tight",
});

type MessageSection =
  | "all"
  | "overview"
  | "training"
  | "nutrition"
  | "recovery"
  | "decisions";

type DecisionMode = "STRICT" | "FALLBACK";

type ChatMessage = {
  id: string;
  role: "user" | "sensei" | "system";
  text: string;
  pending?: boolean;
  section?: MessageSection;
  deliveryMode?: "analysis" | "coaching";
  responseMode?: string;
  stateUpdate?: {
    psychologicalTrigger?: string;
    gameplanFocus?: string;
    activeCorrection?: string;
    nextDecision?: string;
    proofStatus?: string;
  };
};

type Props = {
  chatMessages: ChatMessage[];
  chatInput: string;
  setChatInput: (v: string) => void;
  onSendChat: () => void;
  busy: boolean;
  pendingQuestion: string;
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
  onChatKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  connected: any;
  decisionMode: DecisionMode;
  directiveProgress: any;
  pressureCard: any;
  lockState: any;
};

type ModuleKey = "training" | "nutrition" | "recovery" | "psychology";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function clean(value?: string | null) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function progressPercent(progress: any) {
  const required =
    typeof progress?.repsRequired === "number" && progress.repsRequired > 0
      ? progress.repsRequired
      : 5;
  const completed =
    typeof progress?.repsCompleted === "number" ? progress.repsCompleted : 0;

  return Math.max(0, Math.min(100, Math.round((completed / required) * 100)));
}

function correctionMission(
  connected: any,
  directiveProgress?: any,
  pressureCard?: any
) {
  const correction = clean(connected?.vision?.correction);
  const command = clean(connected?.vision?.fix_next_rep);
  const normalized = correction.toLowerCase();
  const repsRequired =
    typeof directiveProgress?.repsRequired === "number" &&
    directiveProgress.repsRequired > 0
      ? directiveProgress.repsRequired
      : 5;

  let focus = command || "Hold the correction through every rep.";
  let drill =
    clean(connected?.vision?.drill) ||
    "Constraint reps on the active correction.";
  let pressureTest =
    clean(
      connected?.vision?.pressure_test || connected?.vision?.pressureTest
    ) ||
    clean(pressureCard?.resetCue) ||
    "Partner adds controlled resistance without changing the cue.";
  let failCondition = `The ${correction || "correction"} returns once.`;

  if (normalized.includes("head") && normalized.includes("outside")) {
    focus = "Ear inside ribs on every entry.";
    drill =
      clean(connected?.vision?.drill) ||
      "Wall doubles with head position fixed.";
    pressureTest =
      clean(
        connected?.vision?.pressure_test || connected?.vision?.pressureTest
      ) || "Partner gives whizzer resistance after contact.";
    failCondition = "Head leaves the ribs even once.";
  } else if (
    normalized.includes("hands low") ||
    normalized.includes("hand low")
  ) {
    focus = "Rear hand glued to cheek through the entry.";
    drill =
      clean(connected?.vision?.drill) ||
      "Entry-and-exit reps behind a live rear hand.";
    pressureTest =
      clean(
        connected?.vision?.pressure_test || connected?.vision?.pressureTest
      ) || "Partner counters immediately when the rear hand drops.";
    failCondition = "Rear hand leaves the cheek during entry or exit.";
  } else if (normalized.includes("counter")) {
    focus = command || "Create the reaction before committing the entry.";
    drill =
      clean(connected?.vision?.drill) ||
      "Setup-to-entry reps with a full guard recovery.";
    pressureTest =
      clean(
        connected?.vision?.pressure_test || connected?.vision?.pressureTest
      ) || "Partner counters every naked entry.";
    failCondition = "Entry starts before the reaction is created.";
  }

  return {
    correction: correction || "No correction loaded",
    focus,
    drill,
    pressureTest,
    passCondition: `${repsRequired} clean reps with the correction intact.`,
    failCondition,
    proofNeeded: `${repsRequired} clean reps under resistance.`,
  };
}

function readinessDecision(connected: any) {
  const score =
    typeof connected?.fuel?.score === "number" ? connected.fuel.score : null;
  const rating = clean(connected?.fuel?.rating).toUpperCase();

  if (
    (score !== null && score < 45) ||
    rating === "TRASH" ||
    rating === "RED"
  ) {
    return {
      status: "RED",
      decision:
        "Do not pressure test the correction today. Run controlled technical reps only.",
    };
  }

  if (
    (score !== null && score < 65) ||
    rating === "LOW" ||
    rating === "AMBER"
  ) {
    return {
      status: "AMBER",
      decision:
        "You can drill the correction today. Keep resistance controlled and stop on cue break.",
    };
  }

  if (
    (score !== null && score >= 65) ||
    ["CLEAN", "GREEN", "GOOD", "READY"].includes(rating)
  ) {
    return {
      status: "GREEN",
      decision:
        "You can perform corrective drilling and pressure test the lock today.",
    };
  }

  return {
    status: "UNKNOWN",
    decision:
      "Fuel readiness is not loaded. Keep the session technical until readiness is known.",
  };
}

function stripBlockLabel(value: string) {
  return String(value || "")
    .replace(
      /^(Decision|Why|What this fixes|Fix|If ignored|Instruction|Directive):\s*/i,
      ""
    )
    .trim();
}

function parseSenseiBlocks(text: string) {
  const parts = String(text || "")
    .split(/\n\s*\n/)
    .map((x) => x.trim())
    .filter(Boolean);

  return {
    decision: stripBlockLabel(parts[0] || ""),
    why: stripBlockLabel(parts[1] || ""),
    fixes: stripBlockLabel(parts[2] || ""),
    ignored: stripBlockLabel(parts[3] || ""),
    instruction: stripBlockLabel(parts[4] || ""),
  };
}

function inferSection(msg: ChatMessage): MessageSection {
  if (msg.section && msg.section !== "all") return msg.section;

  const t = (msg.text || "").toLowerCase();

  if (/fuel|nutrition|meal|protein|carb|food/.test(t)) return "nutrition";
  if (/recovery|sleep|fatigue|injury|sore/.test(t)) return "recovery";
  if (/rep|shot|stance|training|fix|drill|wrestling|boxing|spar/.test(t)) {
    return "training";
  }
  if (/overview|summary|plan/.test(t)) return "overview";

  return "decisions";
}

const spring = {
  type: "spring",
  stiffness: 420,
  damping: 34,
  mass: 0.8,
} as const;

const sectionIn = {
  hidden: { opacity: 0, y: 14, scale: 0.985 },
  show: { opacity: 1, y: 0, scale: 1 },
};

function Chevron({ open }: { open?: boolean }) {
  return (
    <motion.svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      animate={{ rotate: open ? 180 : 0 }}
      transition={spring}
      aria-hidden="true"
    >
      <path
        d="m6 9 6 6 6-6"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </motion.svg>
  );
}

function SendIcon() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M12 19V5M6.5 10.5 12 5l5.5 5.5"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="m5 12.5 4.2 4.2L19 7"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function LockChip({ lockState }: { lockState: any }) {
  const verified = lockState?.verified;
  const hasDirective = lockState?.hasDirective;

  if (verified) {
    return (
      <motion.span
        layout
        className="sensei-label inline-flex items-center gap-1.5 rounded-full bg-emerald-400/14 px-3 py-1 text-[11px] font-semibold text-emerald-100 shadow-[0_0_22px_rgba(52,211,153,0.12)] ring-1 ring-emerald-300/25"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-300 shadow-[0_0_12px_rgba(110,231,183,0.9)]" />
        Verified
      </motion.span>
    );
  }

  if (!hasDirective) {
    return (
      <motion.span
        layout
        animate={{
          boxShadow: [
            "0 0 0 rgba(248,113,113,0)",
            "0 0 24px rgba(248,113,113,0.16)",
            "0 0 0 rgba(248,113,113,0)",
          ],
        }}
        transition={{
          duration: 2.4,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className="sensei-label inline-flex items-center gap-1.5 rounded-full bg-red-500/16 px-3 py-1 text-[11px] font-semibold text-red-100 ring-1 ring-red-300/30"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-red-300 sensei-pulse" />
        No directive
      </motion.span>
    );
  }

  return (
    <motion.span
      layout
      animate={{
        boxShadow: [
          "0 0 0 rgba(251,191,36,0)",
          "0 0 26px rgba(251,191,36,0.14)",
          "0 0 0 rgba(251,191,36,0)",
        ],
      }}
      transition={{
        duration: 2.8,
        repeat: Infinity,
        ease: "easeInOut",
      }}
      className="sensei-label inline-flex items-center gap-1.5 rounded-full bg-amber-400/18 px-3 py-1 text-[11px] font-semibold text-amber-100 ring-1 ring-amber-300/35"
    >
      <span className="h-1.5 w-1.5 rounded-full bg-amber-300 shadow-[0_0_14px_rgba(252,211,77,0.78)]" />
      Locked
    </motion.span>
  );
}

function SeverityChip({ severity }: { severity?: string }) {
  if (!severity) return null;

  const tone =
    severity === "HIGH"
      ? "bg-red-500/20 text-red-50 ring-red-300/35 shadow-red-950/40"
      : severity === "MEDIUM"
        ? "bg-amber-400/18 text-amber-100 ring-amber-300/25 shadow-amber-950/25"
        : "bg-emerald-400/15 text-emerald-100 ring-emerald-300/25 shadow-emerald-950/25";

  return (
    <motion.span
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn(
        "sensei-label shrink-0 rounded-full px-3 py-1 text-[11px] font-semibold ring-1 shadow-lg",
        tone
      )}
    >
      {severity}
    </motion.span>
  );
}

function ProofRing({
  progress,
  lockState,
}: {
  progress: any;
  lockState: any;
}) {
  const size = 108;
  const stroke = 8;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const pct = progressPercent(progress);
  const verified = progress?.verified === true || lockState?.verified === true;
  const locked = lockState?.locked === true;
  const repsCompleted =
    typeof progress?.repsCompleted === "number" ? progress.repsCompleted : 0;
  const repsRequired =
    typeof progress?.repsRequired === "number" && progress.repsRequired > 0
      ? progress.repsRequired
      : 5;
  const offset = circ - (circ * pct) / 100;

  return (
    <motion.div
      layout
      className={cn(
        "relative grid place-items-center rounded-[2rem] bg-white/[0.06] shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_14px_36px_rgba(0,0,0,0.22)] ring-1",
        verified
          ? "ring-emerald-300/25"
          : locked
            ? "ring-amber-300/22"
            : "ring-red-300/18"
      )}
      style={{ width: size + 18, height: size + 18 }}
      animate={{
        boxShadow: verified
          ? "inset 0 1px 0 rgba(255,255,255,0.1), 0 0 34px rgba(52,211,153,0.16)"
          : locked
            ? "inset 0 1px 0 rgba(255,255,255,0.1), 0 0 32px rgba(251,191,36,0.11), 0 14px 36px rgba(0,0,0,0.24)"
            : "inset 0 1px 0 rgba(255,255,255,0.1), 0 14px 36px rgba(0,0,0,0.22)",
      }}
      transition={spring}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="absolute"
        style={{ transform: "rotate(-90deg)" }}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={stroke}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={verified ? "#34d399" : locked ? "#fbbf24" : "#ef4444"}
          strokeWidth={stroke}
          strokeLinecap="round"
                    strokeDasharray={circ}
          initial={false}
          animate={{ strokeDashoffset: offset }}
          transition={{
            duration: 0.85,
            ease: [0.2, 0.8, 0.2, 1],
          }}
        />
      </svg>

      <AnimatePresence mode="wait">
        {verified ? (
          <motion.div
            key="verified"
            initial={{ opacity: 0, scale: 0.72 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={spring}
            className="relative text-emerald-100 drop-shadow-[0_0_16px_rgba(52,211,153,0.35)]"
          >
            <CheckIcon />
          </motion.div>
        ) : (
          <motion.div
            key="progress"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={spring}
            className="relative flex flex-col items-center text-center"
          >
            <motion.span
              key={repsCompleted}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-[23px] font-extrabold leading-none text-white"
            >
              {repsCompleted}
            </motion.span>
            <span className="sensei-label mt-1 text-[10px] font-semibold text-white/45">
              of {repsRequired}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function TopBar({
  busy,
  decisionMode,
  lockState,
}: {
  busy: boolean;
  decisionMode: DecisionMode;
  lockState: any;
}) {
  return (
    <motion.header
      initial={{ y: -16, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={spring}
      className="sticky top-0 z-30 border-b border-white/[0.07] bg-[#07111f]/82 px-4 pt-3 backdrop-blur-2xl"
      style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}
    >
      <div className="mx-auto flex max-w-[1680px] items-center justify-between gap-3 pb-3">
        <div className="min-w-0">
          <div className="sensei-label text-[11px] font-semibold text-white/42">
            Disciplin OS
          </div>
          <div className="truncate text-[22px] font-extrabold tracking-normal text-white">
            Sensei
          </div>
        </div>

        <div className="flex items-center gap-2">
          <AnimatePresence>
            {busy && (
              <motion.span
                initial={{ opacity: 0, scale: 0.9, x: 8 }}
                animate={{ opacity: 1, scale: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.9, x: 8 }}
                className="sensei-label hidden items-center gap-1.5 rounded-full bg-cyan-300/10 px-3 py-1 text-[11px] font-semibold text-cyan-100 ring-1 ring-cyan-200/15 sm:inline-flex"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-cyan-200 sensei-pulse" />
                Thinking
              </motion.span>
            )}
          </AnimatePresence>

          <span
            className={cn(
              "sensei-label rounded-full px-3 py-1 text-[11px] font-semibold ring-1",
              decisionMode === "STRICT"
                ? "bg-emerald-400/12 text-emerald-100 ring-emerald-300/15"
                : "bg-amber-400/12 text-amber-100 ring-amber-300/15"
            )}
          >
            {decisionMode}
          </span>
          <LockChip lockState={lockState} />
        </div>
      </div>
    </motion.header>
  );
}

function CorrectionHero({
  connected,
  directiveProgress,
  lockState,
  pressureCard,
}: {
  connected: any;
  directiveProgress: any;
  lockState: any;
  pressureCard: any;
}) {
  const correction = clean(connected?.vision?.correction);
  const hasCorrection = Boolean(correction);
  const verified =
    directiveProgress?.verified === true || lockState?.verified === true;
  const locked = lockState?.locked === true;
  const proofType = clean(directiveProgress?.proofType) || "none";
  const pct = progressPercent(directiveProgress);
  const mission = correctionMission(
    connected,
    directiveProgress,
    pressureCard
  );
  const proofCopy = verified
    ? "Unlocked. The next correction can open."
    : pct >= 80
      ? "Almost verified. Do not rush the last reps."
      : pct > 0
        ? "Proof is moving. Keep stacking clean reps."
        : "No proof logged yet. Start with clean reps.";

  return (
    <motion.section
      layout
      initial={{ opacity: 0, y: 14, scale: 0.985 }}
      transition={spring}
      animate={{
        opacity: 1,
        y: 0,
        scale: 1,
        boxShadow: locked
          ? "inset 0 1px 0 rgba(255,255,255,0.08), 0 0 0 1px rgba(251,191,36,0.08), 0 26px 80px rgba(0,0,0,0.30), 0 0 40px rgba(127,29,29,0.10)"
          : "inset 0 1px 0 rgba(255,255,255,0.08), 0 24px 70px rgba(0,0,0,0.24)",
      }}
      className="overflow-hidden rounded-[2rem] bg-[#141f2d]/72 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_24px_70px_rgba(0,0,0,0.24)] ring-1 ring-white/[0.08] backdrop-blur-2xl"
    >
      <div className="relative p-5 sm:p-6 xl:p-7">
        <motion.div
          className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-red-400/55 to-transparent"
          animate={{ opacity: [0.35, 1, 0.35] }}
          transition={{
            duration: 3.6,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />

        <div className="mb-6 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="sensei-label text-[12px] font-semibold text-white/42">
              TODAY&apos;S MISSION
            </div>
            <motion.h1
              layout="position"
              className={cn(
                "mt-1 max-w-4xl text-[32px] font-black leading-[1.04] tracking-normal sm:text-[42px] xl:text-[56px]",
                hasCorrection
                  ? "text-white drop-shadow-[0_0_24px_rgba(248,113,113,0.10)]"
                  : "text-white/34"
              )}
            >
              {hasCorrection
                ? correction
                : "Load a correction to begin."}
            </motion.h1>
          </div>

          <SeverityChip severity={connected?.vision?.severity} />
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-stretch">
          <motion.div
            layout
            className="rounded-[1.35rem] bg-black/22 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_12px_28px_rgba(0,0,0,0.18)] ring-1 ring-red-300/10"
            whileHover={{ y: -1 }}
            transition={spring}
          >
            <div className="sensei-label mb-3 flex items-center gap-2 text-[12px] font-semibold text-red-100/82">
              <span className="h-1.5 w-1.5 rounded-full bg-red-300 shadow-[0_0_14px_rgba(248,113,113,0.65)]" />
              Next session
            </div>

            <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
              <div>
                <div className="sensei-label text-[11px] font-semibold text-white/35">
                  Correction
                </div>
                <p className="mt-1 text-[14px] font-bold leading-6 text-white/82">
                  {mission.correction}
                </p>
              </div>

              <div>
                <div className="sensei-label text-[11px] font-semibold text-white/35">
                  Focus
                </div>
                <p className="mt-1 text-[14px] font-bold leading-6 text-white/82">
                  {mission.focus}
                </p>
              </div>

              <div>
                <div className="sensei-label text-[11px] font-semibold text-white/35">
                  Drill
                </div>
                <p className="mt-1 text-[13px] leading-6 text-white/68">
                  {mission.drill}
                </p>
              </div>

              <div>
                <div className="sensei-label text-[11px] font-semibold text-white/35">
                  Pressure test
                </div>
                <p className="mt-1 text-[13px] leading-6 text-white/68">
                  {mission.pressureTest}
                </p>
              </div>

              <div>
                <div className="sensei-label text-[11px] font-semibold text-emerald-100/62">
                  Pass condition
                </div>
                <p className="mt-1 text-[13px] leading-6 text-white/68">
                  {mission.passCondition}
                </p>
              </div>

              <div>
                <div className="sensei-label text-[11px] font-semibold text-red-100/62">
                  Fail condition
                </div>
                <p className="mt-1 text-[13px] leading-6 text-white/68">
                  {mission.failCondition}
                </p>
              </div>
            </div>
          </motion.div>

          <motion.div
            layout
            className={cn(
              "flex items-center gap-4 rounded-[1.35rem] bg-black/22 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_12px_28px_rgba(0,0,0,0.18)] ring-1",
              verified
                ? "ring-emerald-300/13"
                : "ring-amber-300/13"
            )}
            whileHover={{ y: -1 }}
            transition={spring}
          >
            <ProofRing
              progress={directiveProgress}
              lockState={lockState}
            />

            <div className="min-w-[150px]">
              <div className="sensei-label text-[12px] font-semibold text-white/42">
                Proof needed
              </div>

              <div className="mt-1 flex items-end gap-2">
                <motion.div
                  key={verified ? "unlocked" : pct}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={spring}
                  className="text-[28px] font-extrabold leading-none text-white"
                >
                  {verified ? "Unlocked" : `${pct}%`}
                </motion.div>
              </div>

              <p className="mt-2 text-[12px] leading-5 text-white/48">
                {verified ? proofCopy : mission.proofNeeded}
              </p>

              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.08]">
                <motion.div
                  className={cn(
                    "h-full rounded-full",
                    verified
                      ? "bg-emerald-300"
                      : "bg-amber-300"
                  )}
                  initial={false}
                  animate={{
                    width: verified ? "100%" : `${pct}%`,
                  }}
                  transition={{
                    duration: 0.7,
                    ease: [0.2, 0.8, 0.2, 1],
                  }}
                />
              </div>

              <div className="sensei-label mt-2 text-[11px] font-semibold text-white/35">
                Proof type: {proofType}
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </motion.section>
  );
}

const MODULE_META: Record<
  ModuleKey,
  {
    label: string;
    short: string;
    tint: string;
    ring: string;
    bg: string;
    dot: string;
  }
> = {
  training: {
    label: "Training",
    short: "TR",
    tint: "text-emerald-100",
    ring: "ring-emerald-300/20",
    bg: "bg-emerald-400/12",
    dot: "bg-emerald-300",
  },
  nutrition: {
    label: "Fuel",
    short: "FU",
    tint: "text-amber-100",
    ring: "ring-amber-300/20",
    bg: "bg-amber-400/12",
    dot: "bg-amber-300",
  },
  recovery: {
    label: "Recovery",
    short: "RC",
    tint: "text-cyan-100",
    ring: "ring-cyan-200/20",
    bg: "bg-cyan-300/10",
    dot: "bg-cyan-200",
  },
  psychology: {
    label: "Psychology",
    short: "PS",
    tint: "text-violet-100",
    ring: "ring-violet-300/20",
    bg: "bg-violet-400/12",
    dot: "bg-violet-300",
  },
};

function ModuleCard({
  moduleKey,
  connected,
  directiveProgress,
  pressureCard,
}: {
  moduleKey: ModuleKey;
  connected: any;
  directiveProgress: any;
  pressureCard: any;
}) {
  const [expanded, setExpanded] = useState(false);
  const meta = MODULE_META[moduleKey];
  const mission = correctionMission(
    connected,
    directiveProgress,
    pressureCard
  );
  const readiness = readinessDecision(connected);

  function getStatus() {
    if (moduleKey === "training") {
      return connected?.vision?.present
        ? `Fix: ${mission.focus}`
        : "Waiting for Vision";
    }

    if (moduleKey === "nutrition") {
      return `Recovery status: ${readiness.status}`;
    }

    if (moduleKey === "recovery") {
      return readiness.status === "GREEN"
        ? "Corrective load: READY"
        : readiness.status === "RED"
          ? "Corrective load: LIMITED"
          : `Corrective load: ${readiness.status}`;
    }

    if (moduleKey === "psychology") {
      return clean(pressureCard?.signal)
        ? `Pressure leak: ${clean(pressureCard.signal).replace(/_/g, " ")}`
        : "Pressure leak: not observed";
    }

    return "";
  }

  function getDetail() {
    if (moduleKey === "training") {
      return [
        `Session goal: ${mission.focus}`,
        `Drill: ${mission.drill}`,
        `Pass: ${mission.passCondition}`,
        `Fail: ${mission.failCondition}`,
      ].join("\n");
    }

    if (moduleKey === "nutrition") {
      return [
        `Recovery status: ${readiness.status}`,
        readiness.decision,
        `Technical target stays: ${mission.focus}`,
      ].join("\n");
    }

    if (moduleKey === "recovery") {
      return [
        readiness.decision,
        readiness.status === "RED"
          ? `Run ${mission.drill} without the pressure test.`
          : `Pressure test: ${mission.pressureTest}`,
      ].join("\n");
    }

    if (moduleKey === "psychology") {
      const effect =
        clean(
          pressureCard?.risk ||
            pressureCard?.liveRoundConsequence
        ) ||
        clean(connected?.psychology?.summary) ||
        `Pressure has not been mapped against ${mission.correction}.`;

      const command =
        clean(
          pressureCard?.stopCommand ||
            pressureCard?.resetCue
        ) ||
        `Return to setup. No revenge action. Re-establish ${mission.focus}`;

      return [
        `Performance effect: ${effect}`,
        `Command: ${command}`,
      ].join("\n");
    }

    return "";
      }

  return (
    <motion.button
      layout
      type="button"
      onClick={() => setExpanded((v) => !v)}
      whileTap={{ scale: 0.985 }}
      whileHover={{ y: -2 }}
      transition={spring}
      className={cn(
        "group w-full rounded-[1.35rem] bg-[#111b28]/70 p-4 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_12px_30px_rgba(0,0,0,0.16)] ring-1 ring-white/[0.07] backdrop-blur-xl transition-colors hover:bg-[#162233]/78 hover:ring-white/[0.11]",
        expanded &&
          "bg-[#182638]/82 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_18px_38px_rgba(0,0,0,0.24)]"
      )}
    >
      <div className="flex items-center gap-3">
        <motion.div
          layout
          className={cn(
            "sensei-label relative grid h-10 w-10 shrink-0 place-items-center rounded-2xl text-[11px] font-semibold ring-1",
            meta.bg,
            meta.tint,
            meta.ring
          )}
        >
          <span
            className={cn(
              "absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full",
              meta.dot,
              ((connected?.vision?.present &&
                moduleKey === "training") ||
                expanded) &&
                "sensei-pulse"
            )}
          />
          {meta.short}
        </motion.div>

        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-bold text-white">
            {meta.label}
          </div>
          <div className="truncate text-[12px] font-medium text-white/44">
            {getStatus()}
          </div>
        </div>

        <span
          className={cn(
            "text-white/32",
            expanded && "text-white/60"
          )}
        >
          <Chevron open={expanded} />
        </span>
      </div>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="detail"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{
              duration: 0.25,
              ease: [0.2, 0.8, 0.2, 1],
            }}
            className="overflow-hidden"
          >
            <div className="mt-4 border-t border-white/[0.06] pt-3">
              <p className="whitespace-pre-line text-[13px] leading-6 text-white/64">
                {getDetail()}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.button>
  );
}

function ModuleRail({
  connected,
  directiveProgress,
  pressureCard,
}: {
  connected: any;
  directiveProgress: any;
  pressureCard: any;
}) {
  return (
    <motion.section
      variants={sectionIn}
      initial="hidden"
      animate="show"
      transition={{ ...spring, delay: 0.06 }}
    >
      <div className="mb-3 flex items-center justify-between px-1">
        <h2 className="text-[17px] font-extrabold text-white">
          Correction support
        </h2>
        <span className="sensei-label text-[12px] font-semibold text-white/36">
          4 connected layers
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {(
          [
            "training",
            "nutrition",
            "recovery",
            "psychology",
          ] as ModuleKey[]
        ).map((key) => (
          <ModuleCard
            key={key}
            moduleKey={key}
            connected={connected}
            directiveProgress={directiveProgress}
            pressureCard={pressureCard}
          />
        ))}
      </div>
    </motion.section>
  );
}

function PressureZone({
  label,
  tone,
  text,
}: {
  label: string;
  tone: "emerald" | "amber" | "rose";
  text: string;
}) {
  const styles = {
    emerald:
      "bg-emerald-400/10 text-emerald-100/85 ring-emerald-300/18",
    amber:
      "bg-amber-400/10 text-amber-100/85 ring-amber-300/18",
    rose:
      "bg-red-500/10 text-red-100/85 ring-red-300/18",
  };

  return (
    <motion.div
      layout
      className={cn(
        "rounded-[1.2rem] p-3 ring-1",
        styles[tone]
      )}
    >
      <div className="sensei-label mb-1 text-[12px] font-semibold">
        {label}
      </div>
      <p className="text-[13px] leading-6 text-white/64">
        {text}
      </p>
    </motion.div>
  );
}

function PressureCard({
  pressureCard,
  connected,
  directiveProgress,
}: {
  pressureCard: any;
  connected: any;
  directiveProgress: any;
}) {
  const [open, setOpen] = useState(false);
  const state = pressureCard?.state || "FALLBACK";
  const mission = correctionMission(
    connected,
    directiveProgress,
    pressureCard
  );

  const currentBreak =
    clean(pressureCard?.trigger || pressureCard?.risk) ||
    `The correction breaks before ${mission.focus}`;

  const performanceEffect =
    clean(
      pressureCard?.liveRoundConsequence ||
        pressureCard?.ifIgnored ||
        pressureCard?.risk
    ) ||
    `You lose ${mission.correction} when resistance rises.`;

  const pressureFix =
    clean(
      pressureCard?.resetCue ||
        pressureCard?.stopCommand
    ) ||
    `Pause. Rebuild the setup. Return to ${mission.focus}`;

  const tone =
    state === "LIVE"
      ? "bg-emerald-400/12 text-emerald-100 ring-emerald-300/15"
      : state === "LOCK"
        ? "bg-amber-400/16 text-amber-100 ring-amber-300/25"
        : "bg-amber-400/12 text-amber-100 ring-amber-300/15";

  return (
    <motion.section
      layout
      variants={sectionIn}
      initial="hidden"
      animate="show"
      transition={{ ...spring, delay: 0.12 }}
      className="overflow-hidden rounded-[1.6rem] bg-[#111b28]/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_14px_34px_rgba(0,0,0,0.16)] ring-1 ring-white/[0.07] backdrop-blur-xl"
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-4 p-4 text-left transition active:bg-white/[0.035]"
      >
        <div className="min-w-0">
          <div className="text-[15px] font-bold text-white">
            What breaks under pressure?
          </div>
          <div className="mt-1 truncate text-[12px] text-white/44">
            Current break: {currentBreak}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={cn(
              "sensei-label rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1",
              tone
            )}
          >
            {state}
          </span>
          <span className="text-white/32">
            <Chevron open={open} />
          </span>
        </div>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="pressure"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{
              duration: 0.28,
              ease: [0.2, 0.8, 0.2, 1],
            }}
            className="overflow-hidden"
          >
            <div className="grid gap-3 px-4 pb-4 sm:grid-cols-3">
              <PressureZone
                label="Current break"
                tone="amber"
                text={currentBreak}
              />
              <PressureZone
                label="Performance effect"
                tone="rose"
                text={performanceEffect}
              />
              <PressureZone
                label="Fix"
                tone="emerald"
                text={pressureFix}
              />

              {pressureCard?.liveRoundConsequence && (
                <div className="rounded-[1.2rem] bg-red-500/10 p-3 ring-1 ring-red-300/18 sm:col-span-3">
                  <div className="sensei-label mb-1 text-[12px] font-semibold text-red-100/85">
                    Live-round consequence
                  </div>
                  <p className="text-[13px] leading-6 text-white/64">
                    {pressureCard.liveRoundConsequence}
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.section>
  );
}

function MessageBlock({
  label,
  text,
  primary,
}: {
  label: string;
  text: string;
  primary?: boolean;
}) {
  return (
    <div>
      <div className="sensei-label mb-1 text-[12px] font-semibold text-white/40">
        {label}
      </div>
      <p
        className={cn(
          "leading-7",
          primary
            ? "text-[16px] font-bold text-white"
            : "text-[14px] text-white/66"
        )}
      >
        {text}
      </p>
    </div>
  );
}

function Callout({
  tone,
  label,
  text,
}: {
  tone: "rose" | "emerald";
  label: string;
  text: string;
}) {
  return (
    <div
      className={cn(
        "rounded-[1.15rem] p-3 ring-1",
        tone === "rose"
          ? "bg-red-500/10 ring-red-300/18"
          : "bg-emerald-400/10 ring-emerald-300/15"
      )}
    >
      <div
        className={cn(
          "sensei-label mb-1 text-[12px] font-semibold",
          tone === "rose"
            ? "text-red-100/82"
            : "text-emerald-100/82"
        )}
      >
        {label}
      </div>
      <p className="text-[14px] leading-6 text-white/68">
        {text}
      </p>
    </div>
  );
}

function SenseiMessage({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === "user";
  const isSensei = msg.role === "sensei";
  const isSystem = msg.role === "system";
  const section = inferSection(msg);

  const sectionTone: Record<MessageSection, string> = {
    training: "text-emerald-100/72",
    nutrition: "text-amber-100/72",
    recovery: "text-cyan-100/72",
    overview: "text-violet-100/72",
    decisions: "text-white/42",
    all: "text-white/42",
  };

  if (isUser) {
    return (
      <motion.div
        layout
        initial={{ opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -8, scale: 0.98 }}
        transition={spring}
        className="flex justify-end"
      >
        <div className="max-w-[84%] rounded-[1.35rem] rounded-br-md bg-[#243244] px-4 py-3 shadow-lg shadow-black/20 ring-1 ring-white/10">
          <p className="whitespace-pre-wrap text-[14px] leading-6 text-white">
            {msg.text}
          </p>
        </div>
      </motion.div>
    );
  }

  if (isSystem) {
    return (
      <motion.div
        layout
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        className="flex justify-center"
      >
        <div className="rounded-full bg-white/[0.06] px-3 py-1.5 ring-1 ring-white/[0.07]">
          <p className="text-[12px] text-white/50">
            {msg.text}
          </p>
        </div>
      </motion.div>
    );
  }

  if (isSensei && msg.pending) {
    return (
      <motion.div
        layout
        initial={{ opacity: 0, y: 12, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -8, scale: 0.985 }}
        transition={spring}
        className="rounded-[1.45rem] bg-[#111b28]/72 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_12px_30px_rgba(0,0,0,0.16)] ring-1 ring-white/[0.07] backdrop-blur-xl"
      >
        <div className="mb-3 flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-cyan-200 sensei-pulse" />
          <span className="sensei-label text-[12px] font-semibold text-cyan-100/72">
            Building directive
          </span>
        </div>

        <div className="space-y-2">
          <div className="h-3 w-[72%] rounded-full bg-white/[0.08] sensei-shimmer" />
          <div className="h-3 w-[52%] rounded-full bg-white/[0.06] sensei-shimmer" />
          <div className="h-3 w-[61%] rounded-full bg-white/[0.07] sensei-shimmer" />
        </div>
      </motion.div>
    );
  }

  const parsed = parseSenseiBlocks(msg.text);
  const coachingBlocks = liveCoachingBlocks(msg);
  const showCoachingBlocks =
    coachingBlocks &&
    !/^(Decision|Why|What this fixes|Fix|If ignored|Instruction|Directive):/im.test(
      msg.text
    );

  return (
    <motion.div
          layout
      initial={{ opacity: 0, y: 12, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.985 }}
      transition={spring}
      className="overflow-hidden rounded-[1.45rem] bg-[#111b28]/72 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_12px_30px_rgba(0,0,0,0.16)] ring-1 ring-white/[0.07] backdrop-blur-xl"
    >
      <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
        <span className="sensei-label text-[12px] font-semibold text-white/44">
          Sensei
        </span>
        <span
          className={cn(
            "sensei-label text-[11px] font-semibold capitalize",
            sectionTone[section]
          )}
        >
          {section}
        </span>
      </div>

      <div className="space-y-4 p-4">
        {showCoachingBlocks ? (
          <motion.div
            initial="hidden"
            animate="show"
            variants={{
              hidden: {},
              show: { transition: { staggerChildren: 0.075 } },
            }}
            className="space-y-4"
          >
            {[
              ["What pulled you out", coachingBlocks.pulledOut],
              ["What changed", coachingBlocks.changed],
              ["Next decision", coachingBlocks.nextDecision],
            ].map(([label, text], index) => (
              <motion.div
                key={label}
                variants={{
                  hidden: { opacity: 0, y: 8 },
                  show: { opacity: 1, y: 0 },
                }}
                transition={spring}
                className={cn(
                  "border-l-2 pl-3",
                  index === 2
                    ? "border-emerald-300/55"
                    : "border-white/10"
                )}
              >
                <div
                  className={cn(
                    "sensei-label mb-1 text-[11px] font-semibold",
                    index === 2
                      ? "text-emerald-100/72"
                      : "text-white/38"
                  )}
                >
                  {label}
                </div>
                <p
                  className={cn(
                    "text-[14px] leading-6",
                    index === 2
                      ? "font-bold text-white"
                      : "text-white/68"
                  )}
                >
                  {text}
                </p>
              </motion.div>
            ))}
          </motion.div>
        ) : parsed.decision && (
          <MessageBlock
            label="Decision"
            primary
            text={parsed.decision}
          />
        )}

        {!showCoachingBlocks && parsed.why && (
          <MessageBlock label="Why" text={parsed.why} />
        )}

        {!showCoachingBlocks && parsed.fixes && (
          <MessageBlock label="Fix" text={parsed.fixes} />
        )}

        {!showCoachingBlocks && parsed.ignored && (
          <Callout
            tone="rose"
            label="If ignored"
            text={parsed.ignored}
          />
        )}

        {!showCoachingBlocks && parsed.instruction && (
          <Callout
            tone="emerald"
            label="Directive"
            text={parsed.instruction}
          />
        )}

        {!showCoachingBlocks &&
          !parsed.decision &&
          !parsed.why &&
          !parsed.fixes && (
            <p className="whitespace-pre-wrap text-[14px] leading-6 text-white/68">
              {msg.text}
            </p>
          )}
      </div>
    </motion.div>
  );
}

function EmptyFeed({
  setChatInput,
}: {
  setChatInput: (v: string) => void;
}) {
  const prompts = [
    "What breaks first under pressure?",
    "What should I fix next rep?",
    "Can I unlock the next correction?",
  ];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={spring}
      className="overflow-hidden rounded-[1.6rem] bg-[#111b28]/72 p-5 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_14px_34px_rgba(0,0,0,0.18)] ring-1 ring-white/[0.07] backdrop-blur-xl"
    >
      <motion.div
        className="sensei-label mx-auto mb-4 grid h-16 w-16 place-items-center rounded-[1.35rem] bg-red-500/10 text-[13px] font-semibold text-red-100 ring-1 ring-red-300/18"
        animate={{
          y: [0, -3, 0],
          boxShadow: [
            "0 0 0 rgba(248,113,113,0)",
            "0 0 28px rgba(248,113,113,0.12)",
            "0 0 0 rgba(248,113,113,0)",
          ],
        }}
        transition={{
          duration: 3.2,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      >
        SN
      </motion.div>

      <p className="text-[16px] font-bold text-white">
        Start the round with one decision.
      </p>

      <p className="mx-auto mt-2 max-w-[300px] text-[13px] leading-6 text-white/48">
        Pick a pressure prompt or type your own command.
        Sensei will keep the active correction locked until
        proof is earned.
      </p>

      <div className="mt-4 grid gap-2">
        {prompts.map((prompt) => (
          <button
            key={prompt}
            type="button"
            onClick={() => setChatInput(prompt)}
            className="sensei-label rounded-full bg-white/[0.055] px-3 py-2 text-[12px] font-semibold text-white/70 ring-1 ring-white/[0.07] transition hover:bg-white/[0.08] active:scale-[0.985]"
          >
            {prompt}
          </button>
        ))}
      </div>
    </motion.div>
  );
}

function SenseiThread({
  messages,
  busy,
  setChatInput,
}: {
  messages: ChatMessage[];
  busy: boolean;
  setChatInput: (v: string) => void;
}) {
  const ordered = useMemo(
    () => [...(messages || [])],
    [messages]
  );

  return (
    <section className="min-h-0">
      <div className="mb-3 flex items-center justify-between px-1">
        <h2 className="text-[17px] font-extrabold text-white">
          Feed
        </h2>

        <AnimatePresence>
          {busy && (
            <motion.span
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 8 }}
              className="sensei-label flex items-center gap-1.5 text-[12px] font-semibold text-cyan-100/70"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-200 sensei-pulse" />
              Building
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      <motion.div layout className="space-y-3">
        <AnimatePresence
          initial={false}
          mode="popLayout"
        >
          {busy &&
            !messages.some((m) => m.pending) && (
              <SenseiMessage
                key="busy"
                msg={{
                  id: "busy",
                  role: "sensei",
                  text: "Sensei is thinking.",
                  pending: true,
                }}
              />
            )}

          {ordered.map((msg) => (
            <SenseiMessage
              key={msg.id}
              msg={msg}
            />
          ))}
        </AnimatePresence>

        {ordered.length === 0 && !busy && (
          <EmptyFeed setChatInput={setChatInput} />
        )}
      </motion.div>
    </section>
  );
}

function CommandDock({
  chatInput,
  setChatInput,
  onSendChat,
  onChatKeyDown,
  busy,
  pendingQuestion,
  inputRef,
}: {
  chatInput: string;
  setChatInput: (v: string) => void;
  onSendChat: () => void;
  onChatKeyDown: (
    e: React.KeyboardEvent<HTMLTextAreaElement>
  ) => void;
  busy: boolean;
  pendingQuestion: string;
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
}) {
  const [focused, setFocused] = useState(false);
  const canSend = Boolean(chatInput.trim()) && !busy;
  const quickCommands = [
    "Proof update",
    "Next rep fix",
    "Pressure check",
  ];

  return (
    <motion.div
      layout
      className="sticky bottom-0 z-20 -mx-4 px-4 pb-4 pt-3"
      style={{
        paddingBottom:
          "max(1rem, env(safe-area-inset-bottom))",
        background:
          "linear-gradient(to top, rgba(7,17,31,0.98), rgba(7,17,31,0.86) 72%, transparent)",
      }}
    >
      <AnimatePresence>
        {pendingQuestion && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="mb-2 rounded-full bg-white/[0.055] px-3 py-1.5 ring-1 ring-white/[0.07]"
          >
            <p className="truncate text-[12px] text-white/44">
              Pending: {pendingQuestion}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        layout
        className={cn(
          "overflow-hidden rounded-[1.55rem] bg-white/[0.078] shadow-[0_18px_50px_rgba(0,0,0,0.28),inset_0_1px_0_rgba(255,255,255,0.08)] ring-1 backdrop-blur-2xl transition-colors",
          focused
            ? "ring-amber-300/35"
            : "ring-white/[0.09]"
        )}
        animate={{ y: focused ? -2 : 0 }}
        transition={spring}
      >
        <AnimatePresence initial={false}>
          {focused && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{
                height: "auto",
                opacity: 1,
              }}
              exit={{
                height: 0,
                opacity: 0,
              }}
              className="overflow-hidden"
            >
              <div className="flex gap-2 overflow-x-auto px-3 pt-3">
                {quickCommands.map((command) => (
                  <button
                    key={command}
                    type="button"
                    onMouseDown={(event) =>
                      event.preventDefault()
                    }
                    onClick={() =>
                      setChatInput(command)
                    }
                    className="sensei-label shrink-0 rounded-full bg-white/[0.07] px-3 py-1.5 text-[11px] font-semibold text-white/62 ring-1 ring-white/[0.08] active:scale-[0.98]"
                  >
                    {command}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <textarea
          ref={inputRef}
          value={chatInput}
          onChange={(event) =>
            setChatInput(event.target.value)
          }
          onKeyDown={onChatKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="Command Sensei..."
          rows={focused ? 3 : 1}
          disabled={busy}
          className="w-full resize-none bg-transparent px-4 pt-4 text-[15px] font-medium leading-6 text-white outline-none placeholder:text-white/30 disabled:opacity-45"
          style={{
            minHeight: focused ? 92 : 54,
            transition: "min-height 220ms ease",
          }}
        />

        <div className="flex items-center justify-between gap-3 px-3 pb-3">
          <span className="sensei-label text-[11px] font-semibold text-white/30">
            {busy
              ? "Sensei is building"
              : "Return to send"}
          </span>

          <motion.button
            type="button"
            onClick={onSendChat}
            disabled={!canSend}
            whileTap={
              canSend
                ? { scale: 0.92 }
                : undefined
            }
            className={cn(
              "grid h-10 w-10 place-items-center rounded-full transition-colors",
              canSend
                ? "bg-amber-400 text-black shadow-lg shadow-amber-950/30"
                : "bg-white/10 text-white/30"
            )}
            aria-label="Send message"
          >
            <SendIcon />
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function SenseiScreen({
  chatMessages,
  chatInput,
  setChatInput,
  onSendChat,
  busy,
  pendingQuestion,
  inputRef,
  onChatKeyDown,
  connected,
  decisionMode,
  directiveProgress,
  pressureCard,
  lockState,
}: Props) {
  return (
    <main
      className={cn(
        interTight.className,
        "sensei-type min-h-[100svh] bg-[#070d14] text-white"
      )}
    >
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_-10%,rgba(248,113,113,0.10),transparent_38%),linear-gradient(180deg,#101824_0%,#07111f_46%,#040914_100%)]" />
        <div className="absolute inset-x-0 top-0 h-px bg-white/10" />
      </div>

      <TopBar
        busy={busy}
        decisionMode={decisionMode}
        lockState={lockState}
      />

      <div className="relative mx-auto max-w-[1680px] px-4 py-4 xl:px-6 xl:py-6">
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(390px,480px)] xl:items-start">
          <div className="space-y-5">
            <CorrectionHero
              connected={connected}
              directiveProgress={directiveProgress}
              lockState={lockState}
              pressureCard={pressureCard}
            />

            <ModuleRail
              connected={connected}
              directiveProgress={directiveProgress}
              pressureCard={pressureCard}
            />

            <PressureCard
              pressureCard={pressureCard}
              connected={connected}
              directiveProgress={directiveProgress}
            />
          </div>

          <aside className="space-y-4 xl:sticky xl:top-[92px] xl:max-h-[calc(100svh-104px)] xl:overflow-y-auto xl:pr-1">
            <SenseiThread
              messages={chatMessages}
              busy={busy}
              setChatInput={setChatInput}
            />

            <CommandDock
              chatInput={chatInput}
              setChatInput={setChatInput}
              onSendChat={onSendChat}
              onChatKeyDown={onChatKeyDown}
              busy={busy}
              pendingQuestion={pendingQuestion}
              inputRef={inputRef}
            />
          </aside>
        </div>
      </div>

      <style>{`
        .sensei-type {
          font-family: var(--font-inter-tight), Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          font-weight: 500;
          letter-spacing: 0;
          font-feature-settings: "cv02", "cv03", "cv04", "ss01";
          text-rendering: geometricPrecision;
        }

        .sensei-type h1 {
          font-weight: 900;
        }

        .sensei-type h2 {
          font-weight: 800;
        }

        .sensei-label {
          font-weight: 600;
          letter-spacing: 0.015em;
        }

        @keyframes senseiPulse {
          0%,
          100% {
            opacity: 1;
            transform: scale(1);
          }

          50% {
            opacity: 0.42;
            transform: scale(0.86);
          }
        }

        @keyframes senseiShimmer {
          0% {
            opacity: 0.45;
            transform: translateX(-2%);
          }

          50% {
            opacity: 1;
            transform: translateX(2%);
          }

          100% {
            opacity: 0.45;
            transform: translateX(-2%);
          }
        }

        .sensei-pulse {
          animation: senseiPulse 1.6s ease-in-out infinite;
        }

        .sensei-shimmer {
          animation: senseiShimmer 1.8s ease-in-out infinite;
        }

        .combat-glass {
          backdrop-filter: blur(22px);
        }

        @media (max-width: 767px) {
          textarea {
            font-size: 16px;
          }
        }
      `}</style>
    </main>
  );
}

function coachStatements(text: string) {
  return String(text || "")
    .replace(/\n+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((line) => stripBlockLabel(line))
    .filter(Boolean);
}

function liveCoachingBlocks(msg: ChatMessage) {
  const statements = coachStatements(msg.text);
  if (statements.length < 2) return null;

  const finalIndex = statements.length - 1;
  const nextDecision =
    msg.stateUpdate?.nextDecision || statements[finalIndex];
  const middle = statements.slice(1, finalIndex).join(" ");

  return {
    pulledOut: statements[0],
    changed: middle || statements[Math.min(1, finalIndex)],
    nextDecision,
  };
}
