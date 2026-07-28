"use client";

import React, { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  authorityLabel,
  constrainResistance,
  type ActiveCorrection,
  type EvidenceState,
  type ResistanceLevel,
  type SenseiConstitutionState,
} from "@/lib/disciplin/sensei/contracts";
import type { AuthorityView } from "@/lib/authority/state";
import { senseiCtaDestination } from "@/lib/senseiNavigation";

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
    correctionSource?: string;
    coachApproved?: boolean;
  };
};

type Props = {
  embedded?: boolean;
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
  constitution: SenseiConstitutionState;
  authority: AuthorityView;
  onOpenVision?: (opener: HTMLButtonElement) => void;
  onOpenProfile?: (opener: HTMLButtonElement) => void;
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
    correction: correction || "No approved correction",
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
      "Readiness has not been checked. Keep the session technical until it is.",
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
  type: "tween",
  duration: 0.2,
  ease: [0.22, 1, 0.36, 1],
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
        Coach approved
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
        No approved correction
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
      In progress
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
  authority,
}: {
  busy: boolean;
  decisionMode: DecisionMode;
  lockState: any;
  authority: AuthorityView;
}) {
  return (
    <motion.header
      data-decision-mode={decisionMode}
      initial={{ y: -16, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={spring}
      className="sticky top-0 z-30 border-b border-white/[0.07] bg-[#07111f]/82 px-4 pt-3 backdrop-blur-2xl"
      style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}
    >
      <div className="mx-auto flex max-w-[1680px] items-center justify-between gap-3 pb-3">
        <div className="min-w-0">
          <div className="sensei-label text-[11px] font-semibold text-white/42">
            DISCIPLIN
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

          {authority.senseiAvailable ? (
            <LockChip lockState={lockState} />
          ) : (
            <span className="sensei-label inline-flex items-center gap-1.5 rounded-full bg-white/[0.06] px-3 py-1 text-[11px] font-semibold text-white/58 ring-1 ring-white/[0.10]">
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  authority.authorityState === "HAS_COACH_PENDING_REVIEW"
                    ? "bg-amber-300/70"
                    : "bg-white/35"
                )}
              />
              {authority.dashboard.status}
            </span>
          )}
        </div>
      </div>
    </motion.header>
  );
}

const evidenceLabels: Record<EvidenceState, string> = {
  planned: "Not yet practised",
  practised: "Practised — evidence not added",
  evidence_submitted: "Evidence added",
  awaiting_coach_review: "Review pending",
  continue_current_correction: "Continue current correction",
  progression_approved: "Progression approved",
  correction_reopened: "Correction reopened",
};

const resistanceLabels: Record<ResistanceLevel, string> = {
  cooperative: "Cooperative",
  prescribed_reaction: "Prescribed reactions",
  variable_reaction: "Variable reactions",
  live_resistance: "Live resistance",
};

function authorityCopy(correction: ActiveCorrection) {
  const label = authorityLabel(correction.provenance);
  if (label === "coach_entered") return "Coach entered";
  if (label === "coach_approved") return "Coach approved";
  if (label === "athlete_entered") return "Athlete recorded — not coach approved";
  if (label === "sensei_inference") return "Unapproved suggestion";
  return "Not coach approved";
}

function correctionSourceCopy(correction: ActiveCorrection) {
  const sourceType = (
    correction.provenance as typeof correction.provenance & {
      sourceType?: string;
    }
  ).sourceType;
  const sourceLabels: Record<string, string> = {
    vision_observation: "Vision observation",
    coach_observation: "Coach observation",
    coach_conversation: "Coach conversation",
    competition_review: "Competition review",
    athlete_reflection: "Athlete reflection",
    live_coaching: "Live coaching",
    training_note: "Training note",
  };
  if (sourceType && sourceLabels[sourceType]) return sourceLabels[sourceType];

  const context = correction.provenance.applicableContext
    .join(" ")
    .toLowerCase();
  const origin = correction.provenance.origin;

  if (origin === "disciplin") return "Vision observation";
  if (origin === "athlete") return "Athlete reflection";
  if (origin === "sensei") return "Unapproved suggestion";
  if (context.includes("competition")) return "Competition review";
  if (context.includes("conversation")) return "Coach conversation";
  if (context.includes("live") || context.includes("corner")) return "Live coaching";
  if (context.includes("note")) return "Training note";
  if (context.includes("sparring")) return "Coach observation after sparring";
  return "Coach observation";
}

function CorrectionHero({
  constitution,
  connected,
  onRecordCorrection,
  onPrepareCoachReview,
  preparationReady,
  preparedContext,
  onStartPractice,
  onSubmitEvidence,
  onPrepareEvidenceReview,
  authority,
  onOpenVision,
  onOpenProfile,
}: {
  constitution: SenseiConstitutionState;
  connected: any;
  onRecordCorrection: () => void;
  onPrepareCoachReview: () => void;
  preparationReady: boolean;
  preparedContext: string;
  onStartPractice: () => void;
  onSubmitEvidence: () => void;
  onPrepareEvidenceReview: () => void;
  authority: AuthorityView;
  onOpenVision?: (opener: HTMLButtonElement) => void;
  onOpenProfile?: (opener: HTMLButtonElement) => void;
}) {
  const correction = constitution.activeCorrection;
  const suggestion = constitution.suggestedCorrection;

  if (!authority.senseiAvailable) {
    return (
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={spring}
        className="app-card overflow-hidden p-5 sm:p-6"
      >
        <p className="app-label text-emerald-200/65">Coach-approved practice</p>
        <h1 className="app-title-section mt-3 max-w-2xl">{authority.sensei.title}</h1>
        <p className="app-body mt-3 max-w-2xl">{authority.sensei.body}</p>
        <div className="mt-5 border-l border-white/15 pl-4">
          <p className="text-sm font-semibold text-white">{authority.label}</p>
          <p className="mt-1 text-sm leading-6 text-white/[.5]">{authority.visionEvidenceDetail}</p>
        </div>
        <button
          type="button"
          onClick={(event) => {
            const destination = senseiCtaDestination(authority.sensei.primaryCta.action);
            if (destination === "profile") onOpenProfile?.(event.currentTarget);
            if (destination === "vision") onOpenVision?.(event.currentTarget);
            if (destination === "coach_review") onPrepareCoachReview();
            if (destination === "correction_capture") onRecordCorrection();
          }}
          className="app-button-primary mt-6"
        >
          {authority.sensei.primaryCta.label}
        </button>
      </motion.section>
    );
  }

  if (!correction && suggestion) {
    const source = correctionSourceCopy(suggestion);
    const sourceIsAthlete = suggestion.provenance.origin === "athlete";
    const observationLabel =
      source === "Vision observation" ? "WHAT VISION NOTICED" : "WHAT WAS NOTICED";

    return (
      <motion.section
        layout
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={spring}
        className="overflow-hidden rounded-[1.6rem] bg-[#141f2d]/72 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_24px_70px_rgba(0,0,0,0.24)] ring-1 ring-amber-200/[0.12] backdrop-blur-2xl"
      >
        <div className="p-5 sm:p-7 xl:p-9">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="sensei-label rounded-full bg-amber-400/10 px-3 py-1 text-[10px] font-semibold text-amber-100 ring-1 ring-amber-300/20">
              {source} · not coach approved
            </div>
          </div>

          <div className="mt-7 max-w-4xl">
            <div className="sensei-label text-[11px] font-semibold text-white/38">
              NEXT STEP
            </div>
            <h1 className="mt-2 text-[30px] font-semibold leading-[1.08] tracking-[-.035em] text-white sm:text-[38px]">
              Show this to your coach.
            </h1>
            <p className="mt-3 text-[14px] leading-6 text-white/55">
              {preparationReady
                ? "Your observation and note are ready. Your coach decides whether this becomes the correction."
                : "Show this observation to your coach. Only they can decide whether it becomes the correction."}
            </p>
          </div>

          <div className="mt-7 overflow-hidden rounded-2xl bg-[#0c1623] ring-1 ring-white/[0.09] md:grid md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <div className="border-b border-white/[0.08] p-5 sm:p-6 md:border-b-0 md:border-r">
              <div className="sensei-label text-[10px] font-semibold text-white/34">
                {observationLabel}
              </div>
              <p className="mt-3 text-[22px] font-extrabold leading-7 text-white/90">
                {suggestion.performanceProblem}
              </p>
              <div className="mt-5 border-t border-white/[0.07] pt-4">
                <div className="sensei-label text-[10px] font-semibold text-white/28">SOURCE</div>
                <p className="mt-1 text-[12px] font-bold text-white/52">{source}</p>
                {sourceIsAthlete && (
                  <p className="mt-2 text-[11px] leading-5 text-amber-100/54">
                    Your reflection starts the conversation. Your coach decides whether it becomes a correction.
                  </p>
                )}
              </div>
              {preparationReady && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={spring}
                  className="mt-5 border-t border-white/[0.08] pt-5"
                >
                  <div className="sensei-label text-[10px] font-semibold text-emerald-100/68">
                    WHAT THE ATHLETE EXPERIENCED
                  </div>
                  <p className="mt-2 text-[15px] font-bold leading-6 text-white/78">
                    &ldquo;{preparedContext}&rdquo;
                  </p>
                  <p className="mt-2 text-[10px] font-semibold leading-5 text-white/30">
                    Athlete context · not coach approved
                  </p>
                </motion.div>
              )}
            </div>
            <div className="p-5 sm:p-6">
              <div className="sensei-label text-[10px] font-semibold text-amber-100/68">
                YOUR COACH DECIDES
              </div>
              <div className="mt-4 space-y-4">
                {(preparationReady
                  ? [
                      ["1", "Is the main issue technical, tactical, or both?"],
                      ["2", "What reaction should the athlete recognise?"],
                      ["3", "What decision should they make next time?"],
                    ]
                  : [
                      ["1", "Is this the real problem?"],
                      ["2", "What reaction should you recognise?"],
                      ["3", "What decision should you make when it appears?"],
                    ]
                ).map(([number, text]) => (
                  <div key={number} className="flex gap-3 border-b border-white/[0.06] pb-4 last:border-0 last:pb-0">
                    <span className="sensei-label pt-0.5 text-[10px] font-semibold text-white/24">{number}</span>
                    <p className="text-[14px] font-bold leading-6 text-white/72">{text}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-4 border-t border-white/[0.08] pt-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 flex-1">
              <AnimatePresence mode="wait" initial={false}>
                <motion.p
                  key={preparationReady ? "context-compared" : "context-empty"}
                  role={preparationReady ? "status" : undefined}
                  aria-live={preparationReady ? "polite" : undefined}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="max-w-xl text-[12px] font-semibold leading-5 text-white/36"
                >
                  {preparationReady
                    ? "Your note is ready. Your coach still decides what matters."
                    : "Add one sentence of context only if it would help your coach."}
                </motion.p>
              </AnimatePresence>
            </div>
            <button
              type="button"
              onClick={onPrepareCoachReview}
              className="min-h-12 shrink-0 rounded-full bg-white px-6 text-[13px] font-bold text-black shadow-[0_12px_30px_rgba(0,0,0,0.22)] transition hover:bg-white/92 active:scale-[0.98]"
            >
              {preparationReady ? "Edit note" : "Add context (optional)"}
            </button>
          </div>

          <div className="mt-4 flex flex-wrap gap-4 px-1">
            <button type="button" onClick={onRecordCorrection} className="text-[12px] font-bold text-white/48 transition hover:text-white/76">
              Coach approved it? Record the correction
            </button>
          </div>
        </div>
      </motion.section>
    );
  }

  if (!correction) {
    return (
      <motion.section
        layout
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={spring}
        className="overflow-hidden rounded-[1.6rem] bg-[#141f2d]/72 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_24px_70px_rgba(0,0,0,0.24)] ring-1 ring-white/[0.08] backdrop-blur-2xl"
      >
        <div className="p-5 sm:p-7 xl:p-9">
          <div className="sensei-label text-[11px] font-semibold text-white/38">
            BETWEEN SESSIONS
          </div>

          <h1 className="mt-3 max-w-3xl text-[30px] font-semibold leading-[1.08] tracking-[-.035em] text-white sm:text-[38px] xl:text-[40px]">
            Carry one approved correction into the next session.
          </h1>

          <p className="mt-4 max-w-2xl text-[15px] font-semibold leading-6 text-white/68">
            Record your coach&apos;s exact cue and practice task. Sensei helps you remember and practise them.
          </p>

          <div className="mt-5 flex items-center gap-2 text-[12px] font-semibold text-white/48">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-300" />
            No approved correction yet.
          </div>

          <div className="mt-7">
            <button
              type="button"
              onClick={onRecordCorrection}
              className="min-h-12 rounded-full bg-white px-5 text-[13px] font-bold text-black shadow-[0_12px_30px_rgba(0,0,0,0.24)] transition hover:bg-white/92 active:scale-[0.98]"
            >
              Record coach correction
            </button>
          </div>

          {suggestion && (
            <p className="mt-6 border-t border-white/[0.07] pt-4 text-[12px] leading-5 text-white/36">
              Vision has an observation. It cannot enter Sensei until your coach approves it.
            </p>
          )}
        </div>
      </motion.section>
    );
  }

  const requestedResistance = correction.practiceTask.permittedResistance;
  const permittedResistance = constrainResistance(
    requestedResistance,
    constitution.fuelConstraint
  );
  const rule = correction.decisionRules[0] || null;
  const recognition = correction.informationToRecognise[0] || "Not yet established.";
  const isCoachAuthority = ["coach_entered", "coach_approved"].includes(
    authorityLabel(correction.provenance)
  );
  const evidenceSubmitted = [
    "evidence_submitted",
    "awaiting_coach_review",
    "continue_current_correction",
    "progression_approved",
    "correction_reopened",
  ].includes(constitution.evidenceState);
  const practiceRecorded = constitution.evidenceState === "practised";
  const primaryLabel = evidenceSubmitted
    ? "Prepare for coach review"
    : practiceRecorded
      ? "Submit evidence"
      : "Start practice";
  const primaryAction = evidenceSubmitted
    ? onPrepareEvidenceReview
    : practiceRecorded
      ? onSubmitEvidence
      : onStartPractice;

  return (
    <motion.section
      layout
      initial={{ opacity: 0, y: 14, scale: 0.99 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={spring}
      className="overflow-hidden rounded-[1.6rem] bg-[#141f2d]/72 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_24px_70px_rgba(0,0,0,0.24)] ring-1 ring-white/[0.08] backdrop-blur-2xl"
    >
      <div className="p-5 sm:p-6 xl:p-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="sensei-label text-[11px] font-semibold text-white/42">
            TODAY&apos;S MISSION
          </div>
          <SeverityChip severity={connected?.vision?.severity} />
        </div>

        <div className="mt-5">
          <div className="sensei-label text-[11px] font-semibold text-white/38">
            YOUR JOB NOW
          </div>
          <h1 className="mt-1 max-w-4xl text-[29px] font-semibold leading-[1.08] tracking-[-.035em] text-white sm:text-[36px] xl:text-[40px]">
            {correction.coachExactCue}
          </h1>
          <p className="mt-3 text-[13px] leading-6 text-white/50">
            What we are fixing: {correction.performanceProblem}
          </p>
          {correction.whyItMatters && (
            <p className="mt-1 max-w-3xl text-[13px] leading-6 text-white/42">
              Why it matters: {correction.whyItMatters}
            </p>
          )}
        </div>

        <div className="mt-6 grid border-y border-white/[0.08] md:grid-cols-3 md:divide-x md:divide-white/[0.08]">
          <div className="py-4 md:pr-5">
            <div className="sensei-label text-[10px] font-semibold text-white/36">
              RECOGNISE
            </div>
            <p className="mt-2 text-[14px] font-semibold leading-6 text-white/78">
              {recognition}
            </p>
          </div>
          <div className="border-t border-white/[0.08] py-4 md:border-0 md:px-5">
            <div className="sensei-label text-[10px] font-semibold text-white/36">
              DECIDE
            </div>
            <p className="mt-2 text-[14px] font-semibold leading-6 text-white/78">
              {rule
                ? `If ${rule.ifObserved}, ${rule.thenDecision}${rule.otherwise ? `. Otherwise, ${rule.otherwise}` : ""}`
                : "No decision rule recorded."}
            </p>
          </div>
          <div className="border-t border-white/[0.08] py-4 md:border-0 md:pl-5">
            <div className="sensei-label text-[10px] font-semibold text-white/36">
              PRACTISE
            </div>
            <p className="mt-2 text-[14px] font-semibold leading-6 text-white/78">
              {correction.practiceTask.athleteTask}
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div>
            <div className="sensei-label text-[10px] font-semibold text-white/36">
              TODAY&apos;S PRACTICE CONDITION
            </div>
            <p className="mt-2 text-[15px] font-bold text-white/84">
              {resistanceLabels[permittedResistance]}
            </p>
            <p className="mt-2 text-[13px] leading-6 text-white/52">
              {constitution.fuelConstraint.assessment === "not_assessed"
                ? "Readiness not assessed. The correction is unchanged."
                : constitution.fuelConstraint.reason}
            </p>
            {constitution.fuelConstraint.restrictions.length > 0 && (
              <p className="mt-2 text-[12px] font-semibold leading-5 text-amber-100/72">
                {constitution.fuelConstraint.restrictions.join(" · ")}
              </p>
            )}
          </div>

          <div className="border-t border-white/[0.08] pt-4 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
            <div className="sensei-label text-[10px] font-semibold text-white/36">
              EVIDENCE TO RECORD
            </div>
            <p className="mt-2 text-[15px] font-bold text-white/84">
              {evidenceLabels[constitution.evidenceState]}
            </p>
            <p className="mt-2 text-[12px] leading-5 text-white/48">
              {correction.evidenceRequested.practiceTaskRequired}
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-4 border-t border-white/[0.08] pt-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="sensei-label text-[10px] font-semibold text-white/30">
              SOURCE
            </div>
            <p className="mt-1 text-[12px] font-semibold text-white/46">
              {correctionSourceCopy(correction)} · {isCoachAuthority ? authorityCopy(correction) : "Not approved"}
            </p>
          </div>
          <button
            type="button"
            onClick={primaryAction}
            className="min-h-12 rounded-full bg-white px-6 text-[13px] font-bold text-black shadow-[0_12px_30px_rgba(0,0,0,0.24)] transition hover:bg-white/92 active:scale-[0.98]"
          >
            {primaryLabel}
          </button>
        </div>
      </div>
    </motion.section>
  );
}

function ActivePracticePanel({
  correction,
  constitution,
  onFinish,
  onExit,
}: {
  correction: ActiveCorrection;
  constitution: SenseiConstitutionState;
  onFinish: () => void;
  onExit: () => void;
}) {
  const rule = correction.decisionRules[0] || null;
  const reaction = correction.informationToRecognise[0] || "Use the reaction your coach specified.";
  const resistance = constrainResistance(
    correction.practiceTask.permittedResistance,
    constitution.fuelConstraint
  );

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={spring}
      className="overflow-hidden rounded-[1.6rem] bg-[#101a27]/92 ring-1 ring-emerald-200/[0.12]"
    >
      <div className="p-5 sm:p-7 xl:p-9">
        <div className="flex items-center justify-between gap-3">
          <div className="sensei-label text-[11px] font-semibold text-emerald-100/58">
            PRACTICE ACTIVE
          </div>
          <button type="button" onClick={onExit} className="text-[12px] font-semibold text-white/38 hover:text-white/68">
            Exit
          </button>
        </div>

        <div className="mt-8 sensei-label text-[10px] font-semibold text-white/32">
          COACH&apos;S CUE
        </div>
        <h1 className="mt-2 max-w-4xl text-[30px] font-semibold leading-[1.08] tracking-[-.035em] text-white sm:text-[40px]">
          {correction.coachExactCue}
        </h1>

        <div className="mt-8 grid gap-px overflow-hidden rounded-2xl bg-white/[0.08] md:grid-cols-2">
          <div className="bg-[#0b1521] p-5">
            <div className="sensei-label text-[10px] font-semibold text-white/34">REACTION</div>
            <p className="mt-2 text-[16px] font-bold leading-6 text-white/82">{reaction}</p>
          </div>
          <div className="bg-[#0b1521] p-5">
            <div className="sensei-label text-[10px] font-semibold text-white/34">DECISION</div>
            <p className="mt-2 text-[16px] font-bold leading-6 text-white/82">
              {rule ? `If ${rule.ifObserved}, ${rule.thenDecision}` : correction.practiceTask.athleteTask}
            </p>
          </div>
          <div className="bg-[#0b1521] p-5">
            <div className="sensei-label text-[10px] font-semibold text-white/34">PERMITTED RESISTANCE</div>
            <p className="mt-2 text-[15px] font-bold text-white/76">{resistanceLabels[resistance]}</p>
          </div>
          <div className="bg-[#0b1521] p-5">
            <div className="sensei-label text-[10px] font-semibold text-white/34">STOP CONDITION</div>
            <p className="mt-2 text-[15px] font-bold leading-6 text-rose-100/78">{correction.failureCondition}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={onFinish}
          className="mt-7 min-h-12 w-full rounded-full bg-white text-[13px] font-bold text-black transition hover:bg-white/92 active:scale-[0.99] sm:w-auto sm:px-7"
        >
          Finish practice
        </button>
      </div>
    </motion.section>
  );
}

function PracticeReflectionPanel({
  correction,
  value,
  setValue,
  onSubmit,
  onBack,
  inputRef,
  busy,
  onKeyDown,
}: {
  correction: ActiveCorrection;
  value: string;
  setValue: (value: string) => void;
  onSubmit: () => void;
  onBack: () => void;
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
  busy: boolean;
  onKeyDown: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void;
}) {
  const questions = [
    "What reaction did you see?",
    "What decision did you make?",
    "Where did it break?",
    "What should your coach review?",
  ];

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={spring}
      className="overflow-hidden rounded-[1.6rem] bg-[#101a27]/88 ring-1 ring-white/[0.09]"
    >
      <div className="p-5 sm:p-7">
        <button type="button" onClick={onBack} className="text-[12px] font-semibold text-white/38 hover:text-white/68">
          Back to mission
        </button>
        <div className="mt-6 sensei-label text-[11px] font-semibold text-white/38">REFLECT</div>
        <h1 className="mt-2 text-[28px] font-semibold leading-tight tracking-[-.03em] text-white sm:text-[34px]">
          Bring your coach the decision, not just the result.
        </h1>
        <p className="mt-3 text-[13px] leading-6 text-white/46">Cue carried: {correction.coachExactCue}</p>

        <div className="mt-6 grid gap-2 sm:grid-cols-2">
          {questions.map((question) => (
            <div key={question} className="rounded-xl bg-white/[0.045] px-4 py-3 text-[13px] font-semibold text-white/66 ring-1 ring-white/[0.06]">
              {question}
            </div>
          ))}
        </div>

        <textarea
          ref={inputRef}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={onKeyDown}
          disabled={busy}
          rows={6}
          placeholder="Tell Sensei what happened in the exchange..."
          className="mt-5 min-h-[150px] w-full resize-none rounded-2xl bg-white/[0.055] px-4 py-4 text-[15px] font-medium leading-6 text-white outline-none ring-1 ring-white/[0.08] placeholder:text-white/25 focus:ring-white/[0.18]"
        />
        <button
          type="button"
          onClick={onSubmit}
          disabled={!value.trim() || busy}
          className="mt-4 min-h-12 rounded-full bg-white px-6 text-[13px] font-bold text-black transition disabled:cursor-not-allowed disabled:opacity-30"
        >
          Submit evidence
        </button>
      </div>
    </motion.section>
  );
}

function AthleteCoachPreparation({
  source,
  observation,
  value,
  setValue,
  onFinish,
  onSkip,
  onBack,
  inputRef,
}: {
  source: string;
  observation: string;
  value: string;
  setValue: (value: string) => void;
  onFinish: () => void;
  onSkip: () => void;
  onBack: () => void;
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={spring}
      className="overflow-hidden rounded-[1.6rem] bg-[#101a27]/90 ring-1 ring-white/[0.09]"
    >
      <div className="mx-auto max-w-4xl p-5 sm:p-7 xl:p-9">
        <button type="button" onClick={onBack} className="text-[12px] font-semibold text-white/38 transition hover:text-white/68">
          Back
        </button>

        <div className="mt-7 sensei-label text-[11px] font-semibold text-white/38">
          BEFORE YOU SPEAK TO YOUR COACH
        </div>
        <h1 className="mt-2 text-[28px] font-semibold leading-[1.1] tracking-[-.03em] text-white sm:text-[34px]">
          Anything your coach should know?
        </h1>
        <p className="mt-3 text-[14px] leading-6 text-white/52">
          Optional. Add one sentence only if it would help.
        </p>

        <div className="mt-6 rounded-2xl bg-white/[0.035] p-4 ring-1 ring-white/[0.07] sm:flex sm:items-center sm:justify-between sm:gap-4">
          <div>
            <div className="sensei-label text-[10px] font-semibold text-white/28">WHAT WAS NOTICED</div>
            <p className="mt-1 text-[15px] font-bold text-white/76">{observation}</p>
          </div>
          <p className="mt-2 text-[11px] font-semibold text-white/32 sm:mt-0">Source: {source}</p>
        </div>

        <textarea
          ref={inputRef}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          rows={2}
          placeholder="My first entry got stopped. I wasn't sure whether to reset or keep chaining."
          className="mt-5 min-h-[80px] w-full resize-none rounded-2xl bg-white/[0.045] px-4 py-3.5 text-[15px] font-medium leading-6 text-white outline-none ring-1 ring-white/[0.07] placeholder:text-white/22 focus:bg-white/[0.055] focus:ring-white/[0.18]"
        />

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[11px] font-semibold leading-5 text-amber-100/48">
            Your experience. Your coach decides.
          </p>
          <div className="flex items-center gap-3">
            <button type="button" onClick={onSkip} className="min-h-11 px-3 text-[12px] font-bold text-white/42 transition hover:text-white/70">
              Skip
            </button>
            <button
              type="button"
              onClick={onFinish}
              disabled={!value.trim()}
              className="min-h-11 shrink-0 rounded-full bg-white px-5 text-[12px] font-bold text-black transition disabled:cursor-not-allowed disabled:opacity-30"
            >
              Save note
            </button>
          </div>
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
  const stateLabel = state === "LIVE" ? "READY" : "HOLD";

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
            What changed under pressure?
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
            {stateLabel}
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
            <motion.div
              variants={{
                hidden: { opacity: 0, y: 8 },
                show: { opacity: 1, y: 0 },
              }}
              transition={spring}
              className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.06] pb-3"
            >
              <div>
                <div className="sensei-label text-[10px] font-semibold text-white/30">SOURCE</div>
                <div className="mt-1 text-[12px] font-bold text-white/62">
                  {coachingBlocks.source}
                </div>
              </div>
              <div className={cn(
                "sensei-label rounded-full px-2.5 py-1 text-[9px] font-semibold ring-1",
                coachingBlocks.coachApproved
                  ? "bg-emerald-300/10 text-emerald-100/72 ring-emerald-200/15"
                  : "bg-amber-300/10 text-amber-100/68 ring-amber-200/15"
              )}>
                {coachingBlocks.coachApproved ? "Coach confirmed" : "Awaiting coach confirmation"}
              </div>
            </motion.div>
            {[
              ["What pulled you out", coachingBlocks.pulledOut],
              ["What changed", coachingBlocks.changed],
              [coachingBlocks.finalLabel, coachingBlocks.nextDecision],
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
                    ? coachingBlocks.coachApproved
                      ? "border-emerald-300/55"
                      : "border-amber-300/45"
                    : "border-white/10"
                )}
              >
                <div
                  className={cn(
                    "sensei-label mb-1 text-[11px] font-semibold",
                    index === 2
                      ? coachingBlocks.coachApproved
                        ? "text-emerald-100/72"
                        : "text-amber-100/68"
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

function EmptyValuePanel({
  onRecordCorrection,
}: {
  onRecordCorrection: () => void;
}) {
  const outcomes = [
    {
      number: "01",
      title: "Carry the exact cue",
      text: "Sensei keeps your coach's words stable between sessions.",
    },
    {
      number: "02",
      title: "Know what to look for",
      text: "Recognise the opponent reaction and practise one defined task.",
    },
    {
      number: "03",
      title: "Return with evidence",
      text: "Record what happened and prepare the useful part for your coach.",
    },
  ];

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...spring, delay: 0.04 }}
      className="overflow-hidden rounded-[1.6rem] bg-[#111b28]/72 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_14px_34px_rgba(0,0,0,0.18)] ring-1 ring-white/[0.07] backdrop-blur-xl"
    >
      <div className="p-5 sm:p-6">
        <div className="sensei-label text-[11px] font-semibold text-white/38">
          ONCE IT IS RECORDED
        </div>
        <h2 className="mt-2 text-[21px] font-extrabold leading-7 text-white">
          Sensei carries the lesson between sessions.
        </h2>
      </div>

      <div className="border-t border-white/[0.07]">
        {outcomes.map((outcome, index) => (
          <div
            key={outcome.number}
            className={cn(
              "flex gap-4 px-5 py-4 sm:px-6",
              index > 0 && "border-t border-white/[0.06]"
            )}
          >
            <span className="sensei-label pt-0.5 text-[10px] font-semibold text-white/24">
              {outcome.number}
            </span>
            <div>
              <p className="text-[14px] font-bold text-white/82">
                {outcome.title}
              </p>
              <p className="mt-1 text-[12px] leading-5 text-white/44">
                {outcome.text}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-white/[0.07] p-5 sm:px-6">
        <button
          type="button"
          onClick={onRecordCorrection}
          className="w-full rounded-full bg-white/[0.07] px-4 py-3 text-[12px] font-bold text-white/76 ring-1 ring-white/[0.09] transition hover:bg-white/[0.1] active:scale-[0.99]"
        >
          Record coach correction
        </button>
        <p className="mt-3 text-center text-[11px] leading-5 text-white/30">
          Until then, Sensei will not give technical instructions.
        </p>
      </div>
    </motion.section>
  );
}

function CorrectionCapturePanel({
  chatInput,
  setChatInput,
  onSendChat,
  onChatKeyDown,
  busy,
  inputRef,
  onCancel,
}: {
  chatInput: string;
  setChatInput: (value: string) => void;
  onSendChat: () => void;
  onChatKeyDown: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  busy: boolean;
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
  onCancel: () => void;
}) {
  const canContinue = Boolean(chatInput.trim()) && !busy;

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={spring}
      className="overflow-hidden rounded-[1.6rem] bg-[#111b28]/78 shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_18px_44px_rgba(0,0,0,0.22)] ring-1 ring-white/[0.08] backdrop-blur-xl"
    >
      <div className="p-5 sm:p-6">
        <button
          type="button"
          onClick={onCancel}
          className="sensei-label text-[11px] font-semibold text-white/38 transition hover:text-white/62"
        >
          Back
        </button>

        <div className="sensei-label mt-5 text-[11px] font-semibold text-white/38">
          RECORD THE CORRECTION
        </div>
        <h2 className="mt-2 text-[22px] font-extrabold leading-7 text-white">
          Use your coach&apos;s exact words.
        </h2>
        <p className="mt-2 text-[13px] leading-5 text-white/46">
          Enter the cue first. Add the practice task if your coach gave you one.
        </p>

        <div className="mt-5 overflow-hidden rounded-[1.15rem] bg-white/[0.055] ring-1 ring-white/[0.08] focus-within:ring-white/[0.18]">
          <textarea
            ref={inputRef}
            value={chatInput}
            onChange={(event) => setChatInput(event.target.value)}
            onKeyDown={onChatKeyDown}
            placeholder={"Exact cue from my coach...\nPractice task..."}
            rows={5}
            disabled={busy}
            className="min-h-[142px] w-full resize-none bg-transparent px-4 py-4 text-[16px] font-medium leading-6 text-white outline-none placeholder:text-white/26 disabled:opacity-45"
          />

          <div className="flex items-center justify-between gap-3 border-t border-white/[0.06] px-3 py-3">
            <span className="text-[11px] font-semibold leading-4 text-white/38">
              Athlete recorded. <span className="block">Not yet coach approved.</span>
            </span>
            <motion.button
              type="button"
              onClick={onSendChat}
              disabled={!canContinue}
              whileTap={canContinue ? { scale: 0.94 } : undefined}
              className={cn(
                "grid h-10 w-10 shrink-0 place-items-center rounded-full transition-colors",
                canContinue
                  ? "bg-white text-black"
                  : "bg-white/10 text-white/28"
              )}
              aria-label="Continue"
            >
              <SendIcon />
            </motion.button>
          </div>
        </div>
      </div>
    </motion.section>
  );
}

function EmptyFeed({
  setChatInput,
}: {
  setChatInput: (v: string) => void;
}) {
  const prompts = [
    "Test whether I remember the cue.",
    "Explain why this correction matters.",
    "What does my coach need to review?",
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
        Work from the correction.
      </p>

      <p className="mx-auto mt-2 max-w-[300px] text-[13px] leading-6 text-white/48">
        Recall the cue, clarify the decision, or prepare evidence for your coach.
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
    <section className="min-h-0 pb-40 xl:pb-0">
      <div className="mb-3 flex items-center justify-between px-1">
        <h2 className="text-[17px] font-extrabold text-white">
          Sensei
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
    "Recall cue",
    "Explain why",
    "Coach handoff",
  ];

  return (
    <motion.div
      layout
      className="sticky bottom-[82px] z-20 -mx-4 px-4 pb-4 pt-3 xl:bottom-0"
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
          placeholder="Ask about the current correction..."
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
  embedded = false,
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
  constitution,
  authority,
  onOpenVision,
  onOpenProfile,
}: Props) {
  const [recordingCorrection, setRecordingCorrection] = useState(false);
  const [reviewingSuggestion, setReviewingSuggestion] = useState(false);
  const [preparedContext, setPreparedContext] = useState("");
  const [practicePhase, setPracticePhase] = useState<"mission" | "active" | "reflect">("mission");
  const hasActiveCorrection = authority.senseiAvailable && Boolean(constitution.activeCorrection);
  const hasUnapprovedSuggestion = Boolean(
    authority.senseiAvailable && !constitution.activeCorrection && constitution.suggestedCorrection
  );

  function beginCorrectionCapture() {
    if (!authority.allowedNextActions.includes("RECORD_COACH_CORRECTION")) return;
    setChatInput("");
    setReviewingSuggestion(false);
    setRecordingCorrection(true);
    window.setTimeout(() => inputRef.current?.focus(), 80);
  }

  function beginSuggestionReview() {
    setRecordingCorrection(false);
    setReviewingSuggestion(true);
    setChatInput(preparedContext);
    window.setTimeout(() => inputRef.current?.focus(), 80);
  }

  function cancelCorrectionCapture() {
    setChatInput("");
    setRecordingCorrection(false);
    setReviewingSuggestion(false);
  }

  function prepareEvidenceReview() {
    setChatInput("Prepare this practice evidence for my coach to review.");
    window.setTimeout(() => inputRef.current?.focus(), 80);
  }

  function submitReflection() {
    onSendChat();
    setPracticePhase("mission");
  }

  return (
    <main
      className={cn(
        embedded ? "sensei-type min-h-0 bg-transparent text-white" : "sensei-type min-h-[100svh] bg-[#070d14] text-white"
      )}
    >
      <div className={cn("pointer-events-none inset-0", embedded ? "absolute" : "fixed")}>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_-10%,rgba(248,113,113,0.10),transparent_38%),linear-gradient(180deg,#101824_0%,#07111f_46%,#040914_100%)]" />
        <div className="absolute inset-x-0 top-0 h-px bg-white/10" />
      </div>

      {!embedded && (
        <TopBar
          busy={busy}
          decisionMode={decisionMode}
          lockState={lockState}
          authority={authority}
        />
      )}

      <div className={cn("relative mx-auto max-w-[1680px] px-4 pt-4", embedded ? "pb-5" : "pb-32 xl:px-6 xl:py-6")}>
        <div className={cn(
          "grid gap-5 xl:items-start",
          embedded || (hasActiveCorrection && practicePhase !== "mission") ||
            (hasUnapprovedSuggestion && !recordingCorrection)
            ? "xl:grid-cols-1"
            : "xl:grid-cols-[minmax(0,1fr)_minmax(390px,480px)]"
        )}>
          <div className="order-1 space-y-5 xl:col-start-1 xl:row-start-1">
            {hasUnapprovedSuggestion && reviewingSuggestion ? (
              <AthleteCoachPreparation
                source={correctionSourceCopy(constitution.suggestedCorrection!)}
                observation={constitution.suggestedCorrection!.performanceProblem}
                value={chatInput}
                setValue={setChatInput}
                onFinish={() => {
                  setPreparedContext(chatInput.trim());
                  setReviewingSuggestion(false);
                }}
                onSkip={() => {
                  setChatInput(preparedContext);
                  setReviewingSuggestion(false);
                }}
                onBack={() => setReviewingSuggestion(false)}
                inputRef={inputRef}
              />
            ) : hasActiveCorrection && practicePhase === "active" ? (
              <ActivePracticePanel
                correction={constitution.activeCorrection!}
                constitution={constitution}
                onFinish={() => {
                  setChatInput("");
                  setPracticePhase("reflect");
                  window.setTimeout(() => inputRef.current?.focus(), 80);
                }}
                onExit={() => setPracticePhase("mission")}
              />
            ) : hasActiveCorrection && practicePhase === "reflect" ? (
              <PracticeReflectionPanel
                correction={constitution.activeCorrection!}
                value={chatInput}
                setValue={setChatInput}
                onSubmit={submitReflection}
                onBack={() => setPracticePhase("mission")}
                inputRef={inputRef}
                busy={busy}
                onKeyDown={onChatKeyDown}
              />
            ) : (
              <CorrectionHero
                constitution={constitution}
                connected={connected}
                onRecordCorrection={beginCorrectionCapture}
                onPrepareCoachReview={beginSuggestionReview}
                preparationReady={Boolean(preparedContext)}
                preparedContext={preparedContext}
                onStartPractice={() => setPracticePhase("active")}
                onSubmitEvidence={() => {
                  setChatInput("");
                  setPracticePhase("reflect");
                  window.setTimeout(() => inputRef.current?.focus(), 80);
                }}
                onPrepareEvidenceReview={prepareEvidenceReview}
                authority={authority}
                onOpenVision={onOpenVision}
                onOpenProfile={onOpenProfile}
              />
            )}

            {hasActiveCorrection &&
              practicePhase === "mission" &&
              pressureCard?.state &&
              pressureCard.state !== "FALLBACK" && (
                <PressureCard
                  pressureCard={pressureCard}
                  connected={connected}
                  directiveProgress={directiveProgress}
                />
              )}
          </div>

          {(!hasActiveCorrection || practicePhase === "mission") &&
          (!hasUnapprovedSuggestion || recordingCorrection) && (
          <aside className={cn("order-2 space-y-4", embedded ? "" : "xl:sticky xl:top-[92px] xl:col-start-2 xl:row-start-1 xl:max-h-[calc(100svh-104px)] xl:overflow-y-auto xl:pr-1")}>
            {authority.senseiAvailable && !hasActiveCorrection && !hasUnapprovedSuggestion && !recordingCorrection && (
              <EmptyValuePanel onRecordCorrection={beginCorrectionCapture} />
            )}

            {!hasActiveCorrection &&
              recordingCorrection &&
              authority.allowedNextActions.includes("RECORD_COACH_CORRECTION") && (
              <>
                <CorrectionCapturePanel
                  chatInput={chatInput}
                  setChatInput={setChatInput}
                  onSendChat={onSendChat}
                  onChatKeyDown={onChatKeyDown}
                  busy={busy}
                  inputRef={inputRef}
                  onCancel={cancelCorrectionCapture}
                />
                {(chatMessages.length > 0 || busy) && (
                  <SenseiThread
                    messages={chatMessages}
                    busy={busy}
                    setChatInput={setChatInput}
                  />
                )}
              </>
            )}

            {hasActiveCorrection && (
              <>
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
              </>
            )}
          </aside>
          )}
        </div>
      </div>

      <style>{`
        .sensei-type {
          font-family: inherit;
          font-weight: 400;
          letter-spacing: -0.008em;
          font-feature-settings: "cv02", "cv03", "cv04", "ss01";
          text-rendering: geometricPrecision;
        }

        .sensei-type h1 {
          font-weight: 600;
        }

        .sensei-type h2 {
          font-weight: 600;
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
  const coachApproved = msg.stateUpdate?.coachApproved === true;
  const nextDecision = coachApproved
    ? msg.stateUpdate?.nextDecision || statements[finalIndex]
    : "Confirm the correction with your coach before carrying it into practice.";
  const middle = statements.slice(1, finalIndex).join(" ");
  const source = msg.stateUpdate?.correctionSource || "Session conversation";
  const sourceIsVision = source.toLowerCase().includes("vision");
  const answerAssumesVideo = statements.some((statement) =>
    /\b(?:vision|frame|clip|video|upload)\b/i.test(statement)
  );
  const pulledOut =
    !sourceIsVision && msg.stateUpdate?.psychologicalTrigger
      ? msg.stateUpdate.psychologicalTrigger
      : !sourceIsVision && answerAssumesVideo
        ? `${source} identified the point where the plan changed.`
      : statements[0];
  const changed =
    !sourceIsVision && msg.stateUpdate?.gameplanFocus
      ? `You moved away from ${msg.stateUpdate.gameplanFocus}.`
      : !sourceIsVision && answerAssumesVideo
        ? "Confirm what changed with your coach before assigning the next decision."
      : middle || statements[Math.min(1, finalIndex)];

  return {
    source,
    coachApproved,
    pulledOut,
    changed,
    nextDecision,
    finalLabel: coachApproved ? "Next decision" : "Coach review",
  };
}
