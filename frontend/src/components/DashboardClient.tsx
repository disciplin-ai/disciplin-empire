"use client";

import React, { useEffect, useMemo, useReducer, useState } from "react";
import Provenance from "@/components/Provenance";
import Link from "next/link";
import {
  AnimatePresence,
  motion,
  useReducedMotion,
  type Variants,
} from "framer-motion";
import {
  ArrowRight,
  CalendarClock,
  ClipboardPenLine,
  LockKeyhole,
  ShieldCheck,
} from "lucide-react";
import { useFighterContext } from "@/hooks/useFighterContext";
import DashboardWorkflowDrawer from "./DashboardWorkflowDrawer";
import WorkflowJourney from "./WorkflowJourney";
import {
  normalizeDirectiveProgress,
  type DirectiveProgress,
} from "@/lib/disciplin/types";
import { readUserJson, writeUserJson } from "@/lib/userScopedStorage";
import { useShellInteraction } from "./ShellInteractionProvider";
import { useWorkflow } from "./WorkflowProvider";
import type { VisionReviewPackage } from "@/lib/visionGovernance";
import { useCoach } from "@/components/CoachProvider";

type VisionFinding = {
  id?: string;
  title: string;
  severity: "LOW" | "MEDIUM" | "HIGH";
  dashboard_detail?: string;
  short_detail?: string;
  detail?: string;
  unstable?: string;
  break_point?: string;
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
  directive: CampDirective | null;
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

type EvidenceMemory = {
  dataUrl: string;
  mimeType: string;
  fileName: string;
  uploadedAt: string;
};

type VisionReviewPacket = {
  observationKey: string;
  observation: string;
  athleteContext: string;
  preparedAt: string;
  status: "prepared_for_coach";
};

type AuthorityState =
  | "Coach approved"
  | "Coach review pending"
  | "Athlete directed"
  | "Disciplin suggestion"
  | "No approved mission";

type ConditionState = {
  state: "missing" | "clear" | "limited" | "coach_review";
  title: string;
  why: string;
  limit: string;
  authority: string;
};

type PrimaryAction = {
  label: string;
  href?: string;
  drawer?: WorkflowPanel;
  actor: "Athlete";
  nextState: string;
  coachApprovalRequiredBeforeSensei: boolean;
};

type WorkflowPanel = "coach_submission" | "vision_review" | "fuel" | "evidence";
type WorkflowPhase =
  | "idle"
  | "editing"
  | "submitting"
  | "processing"
  | "success"
  | "error";

type WorkflowUiState = {
  panel: WorkflowPanel | null;
  phase: WorkflowPhase;
  visionContext: string;
  correction: string;
  practiceTask: string;
  athleteContext: string;
  evidenceFile: File | null;
  error: string | null;
};

type WorkflowUiEvent =
  | { type: "OPEN"; panel: WorkflowPanel }
  | { type: "CLOSE" }
  | { type: "CLOSE_PANEL"; panel: WorkflowPanel }
  | { type: "SET_VISION_CONTEXT"; value: string }
  | { type: "SET_CORRECTION"; value: string }
  | { type: "SET_PRACTICE_TASK"; value: string }
  | { type: "SET_ATHLETE_CONTEXT"; value: string }
  | { type: "SELECT_EVIDENCE"; file: File | null }
  | { type: "BEGIN"; phase: "submitting" | "processing" }
  | { type: "SUCCESS" }
  | { type: "ERROR"; message: string }
  | { type: "RETRY" };

const DIRECTIVE_PROGRESS_KEY = "disciplin_directive_progress";
const LAST_EVIDENCE_KEY = "disciplin_last_proof";
const VISION_REVIEW_PACKET_KEY = "disciplin_vision_review_packet";

const initialWorkflowUiState: WorkflowUiState = {
  panel: null,
  phase: "idle",
  visionContext: "",
  correction: "",
  practiceTask: "",
  athleteContext: "",
  evidenceFile: null,
  error: null,
};

function workflowUiReducer(
  state: WorkflowUiState,
  event: WorkflowUiEvent
): WorkflowUiState {
  switch (event.type) {
    case "OPEN":
      return {
        ...state,
        panel: event.panel,
        phase: "editing",
        evidenceFile: null,
        error: null,
      };
    case "CLOSE":
      return {
        ...state,
        panel: null,
        phase: "idle",
        evidenceFile: null,
        error: null,
      };
    case "CLOSE_PANEL":
      return state.panel === event.panel
        ? {
            ...state,
            panel: null,
            phase: "idle",
            evidenceFile: null,
            error: null,
          }
        : state;
    case "SET_VISION_CONTEXT":
      return { ...state, visionContext: event.value, error: null };
    case "SET_CORRECTION":
      return { ...state, correction: event.value, error: null };
    case "SET_PRACTICE_TASK":
      return { ...state, practiceTask: event.value, error: null };
    case "SET_ATHLETE_CONTEXT":
      return { ...state, athleteContext: event.value, error: null };
    case "SELECT_EVIDENCE":
      return {
        ...state,
        evidenceFile: event.file,
        phase: "editing",
        error: null,
      };
    case "BEGIN":
      return { ...state, phase: event.phase, error: null };
    case "SUCCESS":
      return { ...state, phase: "success", error: null };
    case "ERROR":
      return { ...state, phase: "error", error: event.message };
    case "RETRY":
      return { ...state, phase: "editing", error: null };
    default:
      return state;
  }
}

const pageMotion: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.22,
      ease: [0.22, 1, 0.36, 1],
      staggerChildren: 0.045,
    },
  },
};

const sectionMotion: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.22, ease: [0.22, 1, 0.36, 1] },
  },
};

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function clean(text?: string | null) {
  return String(text || "")
    .replace(/\.{3,}|…/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function short(text?: string | null, max = 150) {
  const value = clean(text);
  if (!value || value.length <= max) return value;

  const clipped = value.slice(0, max).trim();
  const lastSpace = clipped.lastIndexOf(" ");
  return lastSpace > 30 ? clipped.slice(0, lastSpace).trim() : clipped;
}

function daysUntil(dateStr?: string | null) {
  if (!dateStr) return null;
  const target = new Date(dateStr);
  if (Number.isNaN(target.getTime())) return null;
  return Math.max(0, Math.ceil((target.getTime() - Date.now()) / 86400000));
}

function latestWeight(logs: WeightLog[], fallback?: number | null) {
  if (logs.length) return logs[logs.length - 1].value;
  if (typeof fallback === "number" && Number.isFinite(fallback)) return fallback;
  return null;
}

function conditionFromFuel(score?: number): ConditionState {
  if (typeof score !== "number") {
    return {
      state: "missing",
      title: "Preparation not recorded",
      why: "Fuel has no current preparation input.",
      limit: "Record preparation before increasing load.",
      authority: "Athlete input missing",
    };
  }

  if (score >= 75) {
    return {
      state: "clear",
      title: "No additional preparation limit recorded",
      why: "Fuel recorded no additional limit around the current work.",
      limit: "Follow the current coach-approved work.",
      authority: "Fuel assessment",
    };
  }

  if (score >= 50) {
    return {
      state: "limited",
      title: "Preparation limit recorded",
      why: "Current preparation conditions support less load.",
      limit: "Keep the approved work. Reduce the load.",
      authority: "Fuel suggestion",
    };
  }

  return {
    state: "coach_review",
    title: "Coach review required",
    why: "Preparation conditions may change the limits around the approved work.",
    limit: "Do not increase load until reviewed.",
    authority: "Fuel suggestion",
  };
}

function evidenceLabel(
  evidence: EvidenceMemory | null,
  progress: DirectiveProgress
) {
  if (evidence?.mimeType.startsWith("video")) return "Video attached";
  if (evidence?.mimeType.startsWith("image")) return "Image attached";
  if (progress.proofType === "self_report") return "Athlete reported";
  return "No evidence attached";
}

function authorityTone(authority: AuthorityState) {
  if (authority === "Coach approved") {
    return "border-emerald-300/20 bg-emerald-300/[0.08] text-emerald-100";
  }
  if (authority === "Coach review pending") {
    return "border-cyan-200/20 bg-cyan-200/[0.07] text-cyan-100";
  }
  if (authority === "Athlete directed") {
    return "border-violet-300/20 bg-violet-300/[0.07] text-violet-100";
  }
  return "border-white/[0.10] bg-white/[0.04] text-white/62";
}

function StatusBadge({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-3 py-1.5 text-[11px] font-semibold tracking-[0.04em] shadow-[inset_0_1px_0_rgba(255,255,255,.04),0_6px_18px_rgba(0,0,0,.12)]",
        className
      )}
    >
      {children}
    </span>
  );
}

function DetailDisclosure({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const reduceMotion = useReducedMotion();

  return (
    <div className="border-t border-white/[0.065]">
      <motion.button
        type="button"
        whileTap={{ scale: 0.99 }}
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        className="flex w-full items-center justify-between px-5 py-4 text-left text-sm font-semibold text-white/52 transition hover:text-white sm:px-6"
      >
        <span>Why this step</span>
        <motion.span
          aria-hidden="true"
          animate={{ rotate: open ? 45 : 0 }}
          transition={{ duration: 0.18 }}
          className="text-lg font-light"
        >
          +
        </motion.span>
      </motion.button>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{
              duration: reduceMotion ? 0 : 0.24,
              ease: [0.22, 1, 0.36, 1],
            }}
            className="overflow-hidden"
          >
            <div className="border-t border-white/[0.055] px-5 py-5 sm:px-6">
              {children}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function PrimaryAction({
  action,
  onOpenDrawer,
  onOpenPanel,
}: {
  action: PrimaryAction;
  onOpenDrawer: (panel: WorkflowPanel) => void;
  onOpenPanel: (panel: "vision" | "sensei", opener: HTMLButtonElement) => void;
}) {
  const reduceMotion = useReducedMotion();
  const support =
    action.label === "Record coach correction"
      ? "Capture the exact correction or practice task your coach gave you today."
      : action.label === "Connect coach"
        ? "Invite the coach who reviews your work."
      : action.label === "Open Vision" ||
            action.label === "Add observation-only evidence"
          ? "Record only what the evidence shows."
      : action.label === "Prepare for coach review"
        ? "Add your context so your coach can review what Vision observed."
        : action.label === "View review"
          ? "See the correction awaiting your coach."
            : action.label === "Open Sensei"
              ? "Continue only from the correction and practice task your coach approved."
              : action.label.toLowerCase().includes("preparation")
                ? "Set today’s training limits without changing the approved correction."
            : action.label.toLowerCase().includes("evidence")
              ? "Record what happened without representing it as coach approved."
              : "Continue today’s work.";

  const content = (
    <>
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[16px] border border-emerald-200/20 bg-emerald-300/[0.10] text-emerald-100 shadow-[inset_0_1px_0_rgba(255,255,255,.06),0_8px_24px_rgba(0,0,0,.16)] transition duration-200 ease-app group-hover:border-emerald-200/28 group-hover:bg-emerald-300/[0.13]">
        <ClipboardPenLine aria-hidden="true" className="h-5 w-5" strokeWidth={1.8} />
      </span>
      <span className="min-w-0 flex-1 text-left">
        <span className="block text-[11px] font-semibold tracking-[0.04em] text-emerald-200/70">
          {action.actor} action
        </span>
        <span className="mt-1 block text-base font-semibold leading-5 text-white sm:text-lg">
          {action.label}
        </span>
        <span className="mt-1.5 block text-[13px] font-normal leading-5 text-white/52">
          {support}
        </span>
      </span>
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/20 bg-emerald-300 text-[#04110c] shadow-[inset_0_1px_0_rgba(255,255,255,.38),0_8px_22px_rgba(52,211,153,0.14)] transition duration-200 ease-app group-hover:bg-emerald-200 group-hover:shadow-[inset_0_1px_0_rgba(255,255,255,.42),0_11px_28px_rgba(52,211,153,0.18)]">
        <ArrowRight aria-hidden="true" className="h-5 w-5 transition-transform duration-200 ease-app group-hover:translate-x-0.5 group-active:translate-x-1" strokeWidth={2} />
      </span>
    </>
  );

  const actionClass =
    "group flex min-h-[96px] w-full items-center gap-4 rounded-[20px] border border-white/[0.085] bg-[linear-gradient(135deg,rgba(255,255,255,.052),rgba(255,255,255,.022))] px-4 py-4 text-left shadow-[inset_0_1px_0_rgba(255,255,255,.035),0_14px_38px_rgba(0,0,0,.22)] transition-[border-color,background-color,box-shadow] duration-200 ease-app hover:border-emerald-200/18 hover:bg-emerald-300/[0.045] hover:shadow-[inset_0_1px_0_rgba(255,255,255,.05),0_20px_48px_rgba(0,0,0,.28)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#071019] sm:px-5";

  if (action.drawer) {
    return (
      <motion.button
        type="button"
        whileHover={reduceMotion ? undefined : { y: -2 }}
        whileTap={reduceMotion ? undefined : { y: 0, scale: 0.994 }}
        transition={{ duration: reduceMotion ? 0 : 0.18, ease: [0.22, 1, 0.36, 1] }}
        onClick={() => onOpenDrawer(action.drawer as WorkflowPanel)}
        className={actionClass}
      >
        {content}
      </motion.button>
    );
  }

  if (!action.href) {
    return (
      <div className={actionClass}>
        {content}
      </div>
    );
  }

  const shellPanel = action.href.includes("panel=vision")
    ? "vision"
    : action.href.includes("panel=sensei")
      ? "sensei"
      : null;

  if (shellPanel) {
    return (
      <motion.button
        type="button"
        whileHover={reduceMotion ? undefined : { y: -2 }}
        whileTap={reduceMotion ? undefined : { y: 0, scale: 0.994 }}
        transition={{ duration: reduceMotion ? 0 : 0.18, ease: [0.22, 1, 0.36, 1] }}
        onClick={(event) => onOpenPanel(shellPanel, event.currentTarget)}
        className={actionClass}
      >
        {content}
      </motion.button>
    );
  }

  return (
    <motion.div
      whileHover={reduceMotion ? undefined : { y: -2 }}
      whileTap={reduceMotion ? undefined : { y: 0, scale: 0.994 }}
      transition={{ duration: reduceMotion ? 0 : 0.18, ease: [0.22, 1, 0.36, 1] }}
    >
      <Link
        href={action.href}
        className={actionClass}
      >
        {content}
      </Link>
    </motion.div>
  );
}

export default function DashboardClient() {
  const { user, loading, fighterContext, profile, saveProfile } = useFighterContext();
  const { openPanel } = useShellInteraction();
  const { authority: authorityView, update: updateWorkflow } = useWorkflow();
  const { state: coachState, announceMutation: announceCoachMutation } = useCoach();
  const storageOwnerId = user?.id ?? (
    process.env.NODE_ENV !== "production" &&
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("dev") === "1"
      ? "development-preview"
      : null
  );
  const reduceMotion = useReducedMotion();
  const [workflowUi, dispatchWorkflow] = useReducer(
    workflowUiReducer,
    initialWorkflowUiState
  );
  const [mounted, setMounted] = useState(false);
  const [camp, setCamp] = useState<SavedCamp | null>(null);
  const [vision, setVision] = useState<VisionAnalysis | null>(null);
  const [fuel, setFuel] = useState<FuelMemory | null>(null);
  const [evidence, setEvidence] = useState<EvidenceMemory | null>(null);
  const [reviewPacket, setReviewPacket] = useState<VisionReviewPacket | null>(
    null
  );
  const [weightLogs, setWeightLogs] = useState<WeightLog[]>([]);
  const [weightInput, setWeightInput] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [progress, setProgress] = useState<DirectiveProgress>(
    normalizeDirectiveProgress(undefined)
  );

  useEffect(() => {
    queueMicrotask(() => {
      dispatchWorkflow({ type: "CLOSE" });
      setFeedback(null);
      setWeightInput("");
    });
  }, [user?.id]);

  useEffect(() => {
    function syncDashboardState() {
      setCamp(readUserJson<SavedCamp>(storageOwnerId, "disciplin_latest_camp"));
      setVision(readUserJson<VisionAnalysis>(storageOwnerId, "disciplin_latest_vision"));
      setFuel(readUserJson<FuelMemory>(storageOwnerId, "disciplin_latest_fuel"));
      setEvidence(readUserJson<EvidenceMemory>(storageOwnerId, LAST_EVIDENCE_KEY));
      setReviewPacket(
        readUserJson<VisionReviewPacket>(storageOwnerId, VISION_REVIEW_PACKET_KEY)
      );
      setWeightLogs(readUserJson<WeightLog[]>(storageOwnerId, "disciplin_weight_logs") ?? []);
      setProgress(
        normalizeDirectiveProgress(
          readUserJson<DirectiveProgress>(storageOwnerId, DIRECTIVE_PROGRESS_KEY) ?? undefined
        )
      );
    }

    function syncWhenVisible() {
      if (document.visibilityState === "visible") syncDashboardState();
    }

    syncDashboardState();
    queueMicrotask(() => setMounted(true));
    window.addEventListener("focus", syncDashboardState);
    window.addEventListener("storage", syncDashboardState);
    document.addEventListener("visibilitychange", syncWhenVisible);

    return () => {
      window.removeEventListener("focus", syncDashboardState);
      window.removeEventListener("storage", syncDashboardState);
      document.removeEventListener("visibilitychange", syncWhenVisible);
    };
  }, [storageOwnerId]);

  useEffect(() => {
    if (!mounted) return;
    writeUserJson(storageOwnerId, DIRECTIVE_PROGRESS_KEY, progress);
  }, [mounted, progress, storageOwnerId]);

  useEffect(() => {
    if (!feedback) return;
    const timeout = window.setTimeout(() => setFeedback(null), 2600);
    return () => window.clearTimeout(timeout);
  }, [feedback]);

  const findings = useMemo(
    () => (Array.isArray(vision?.findings) ? vision.findings : []),
    [vision]
  );

  const observation = findings[0] ?? null;
  const observationKey = observation
    ? clean(vision?.analysis_id || observation.id || observation.title)
    : "";
  const reviewPrepared = Boolean(
    observation &&
      reviewPacket &&
      reviewPacket.observationKey === observationKey &&
      reviewPacket.status === "prepared_for_coach"
  );
  const directive = camp?.directive ?? null;
  const athleteDirected = authorityView.authorityState === "ATHLETE_DIRECTED";
  const coachBackendUnavailable =
    authorityView.authorityState === "COACH_BACKEND_UNAVAILABLE";
  const authority: AuthorityState =
    authorityView.authorityState === "COACH_APPROVED_MISSION"
      ? "Coach approved"
      : authorityView.authorityState === "HAS_COACH_PENDING_REVIEW"
        ? "Coach review pending"
        : athleteDirected
          ? "Athlete directed"
          : "No approved mission";
  const conditions = conditionFromFuel(fuel?.score);
  const currentEvidence = evidenceLabel(evidence, progress);
  const missionCoachApproved = authorityView.senseiAvailable;
  const pendingCoachSubmission = coachState.submissions.find(
    (submission) =>
      submission.athlete_user_id === user?.id && submission.status === "pending",
  );
  const latestRejectedSubmission = coachState.submissions.find(
    (submission) =>
      submission.athlete_user_id === user?.id && submission.status === "rejected",
  );
  // The current persisted model has no explicit evidence-review record.
  const evidenceReviewRecorded = false;

  useEffect(() => {
    if (
      missionCoachApproved &&
      workflowUi.panel === "vision_review" &&
      workflowUi.phase !== "submitting"
    ) {
      dispatchWorkflow({ type: "CLOSE" });
      queueMicrotask(() => setFeedback("Approved by your coach. Today’s mission is ready."));
    }
  }, [missionCoachApproved, workflowUi.panel, workflowUi.phase]);

  const missionTitle =
    latestRejectedSubmission && !pendingCoachSubmission && !coachState.currentMission
      ? "Coach requested a revision"
      : authorityView.dashboard.title;

  const missionReason =
    coachState.currentMission?.practice_task ||
    (latestRejectedSubmission && !pendingCoachSubmission
      ? latestRejectedSubmission.rejection_reason || "Review the correction and submit it again."
      : authorityView.dashboard.body);

  const missionCue = missionCoachApproved
    ? short(coachState.currentMission?.correction_text || "Continue the coach-approved work.")
    : authority === "Athlete directed" && directive
      ? short(directive.bullets?.[0] || "Continue only as athlete-directed work.")
      : directive
        ? "Sensei stays locked until your coach reviews this correction."
    : athleteDirected
      ? "This work is not coach approved and cannot enter Sensei."
    : observation
      ? reviewPrepared
        ? "Show the saved observation to your coach."
        : "Add your context before showing this observation to your coach."
      : "Nothing here is coach approved yet.";

  const primaryAction: PrimaryAction =
    coachBackendUnavailable
    ? {
        label: authorityView.primaryCta.label,
        href: "/dashboard?panel=vision",
        actor: "Athlete",
        nextState: "Observation-only evidence recorded",
        coachApprovalRequiredBeforeSensei: true,
      }
    :
    authorityView.authorityState === "NO_COACH_CONNECTED" ||
    authorityView.authorityState === "COACH_INVITATION_PENDING"
    ? {
        label: authorityView.primaryCta.label,
        href: "/profile#coach-connection",
        actor: "Athlete",
        nextState: "Coach connection",
        coachApprovalRequiredBeforeSensei: true,
      }
    : authorityView.authorityState === "ATHLETE_DIRECTED"
    ? {
        label: authorityView.primaryCta.label,
        href: "/dashboard?panel=vision",
        actor: "Athlete",
        nextState: "Athlete-directed evidence recorded",
        coachApprovalRequiredBeforeSensei: true,
      }
    : authorityView.authorityState === "HAS_COACH_PENDING_REVIEW"
      ? {
          label: authorityView.primaryCta.label,
          drawer: "coach_submission",
          actor: "Athlete",
          nextState: "Coach review pending",
          coachApprovalRequiredBeforeSensei: true,
        }
    : !directive && observation && !reviewPrepared
    ? {
        label: "Prepare for coach review",
        drawer: "vision_review",
        actor: "Athlete",
        nextState: "Observation saved",
        coachApprovalRequiredBeforeSensei: true,
      }
    : !missionCoachApproved
      ? {
          label: authorityView.primaryCta.label,
          drawer: "coach_submission",
          actor: "Athlete",
          nextState: "No approved mission",
          coachApprovalRequiredBeforeSensei: true,
        }
      : conditions.state === "coach_review"
            ? {
                label: "Show preparation limits to your coach",
                drawer: "fuel",
                actor: "Athlete",
                nextState: "Preparation limit under coach review",
                coachApprovalRequiredBeforeSensei: false,
              }
            : conditions.state === "missing"
              ? {
                  label: "Record today's preparation",
                  drawer: "fuel",
                  actor: "Athlete",
                  nextState: "Preparation limits recorded",
                  coachApprovalRequiredBeforeSensei: false,
                }
              : evidence && !evidenceReviewRecorded
                ? {
                    label: "Show the attached evidence to your coach",
                    actor: "Athlete",
                    nextState: "Evidence awaiting coach review",
                    coachApprovalRequiredBeforeSensei: false,
                  }
                : {
                    label: "Continue the coach-approved mission",
                    href: "/sensei",
                    actor: "Athlete",
                    nextState: "Coach-approved mission continues",
                    coachApprovalRequiredBeforeSensei: false,
                  };

  const authoritySupport =
    coachBackendUnavailable
      ? { value: "Unavailable", detail: "Coach connection not confirmed" }
      : authorityView.authorityState === "NO_COACH_CONNECTED"
      ? { value: "No coach connected", detail: "Approval unavailable" }
      : authorityView.authorityState === "COACH_INVITATION_PENDING"
        ? { value: "Invitation pending", detail: "Waiting for acceptance" }
    : authorityView.authorityState === "ATHLETE_DIRECTED"
      ? {
          value: "Athlete directed",
          detail: "Not coach approved",
        }
      : authorityView.authorityState === "HAS_COACH_PENDING_REVIEW"
        ? {
            value: "Coach review pending",
            detail: "Not approved yet",
          }
        : authorityView.authorityState === "COACH_APPROVED_MISSION"
          ? {
              value: "Coach approved",
              detail: "Exact correction active",
            }
          : {
              value: "Coach sets the mission",
              detail: "Nothing approved yet",
            };

  const senseiSupport = missionCoachApproved
    ? {
        value: "Available",
        detail: "Approved mission only",
      }
    : authorityView.authorityState === "ATHLETE_DIRECTED"
      ? {
          value: "Unavailable",
          detail: "No approved correction",
        }
    : {
        value: "Unavailable",
        detail: "Requires coach approval",
      };

  const nextCheckpoint =
    pendingCoachSubmission && missionCoachApproved
      ? { value: "Update under review", detail: "Current mission remains active" }
    : coachBackendUnavailable
      ? { value: "Record evidence", detail: "Observation only" }
      : authorityView.authorityState === "NO_COACH_CONNECTED"
      ? { value: "Record evidence", detail: "Vision remains available" }
      : authorityView.authorityState === "COACH_INVITATION_PENDING"
        ? { value: "Coach acceptance", detail: "Waiting for your coach" }
    : authorityView.authorityState === "HAS_COACH_PENDING_REVIEW"
      ? {
          value: "Coach confirmation",
          detail: "Waiting for a decision",
        }
      : authorityView.authorityState === "COACH_APPROVED_MISSION"
        ? {
            value: "Your next session",
            detail: "Stay within today’s limits",
          }
        : authorityView.authorityState === "ATHLETE_DIRECTED"
          ? {
              value: "Record evidence",
              detail: "Keep work clearly separated",
            }
          : {
              value: "Coach confirmation",
              detail: "After you record the correction",
            };

  const currentWeight = latestWeight(
    weightLogs,
    fighterContext.identity.currentWeight
  );
  const targetWeight = fighterContext.identity.targetWeight ?? null;
  const fightDate = fighterContext.camp.fightDate ?? null;
  const daysRemaining = daysUntil(fightDate);
  const showCompetitionContext = Boolean(fightDate || targetWeight !== null);

  const visionInference = short(
    observation?.unstable ||
      observation?.break_point ||
      observation?.dashboard_detail ||
      observation?.detail ||
      vision?.summary,
    170
  );

  const currentBlocker = !missionCoachApproved
    ? authorityView.dashboard.body
    : conditions.state === "coach_review"
      ? conditions.limit
      : conditions.state === "missing"
        ? "Today's Fuel check-in is incomplete."
        : evidence && !evidenceReviewRecorded
          ? "Attached evidence is waiting for coach review."
          : null;

  const sessionState =
    !missionCoachApproved
      ? authorityView.dashboard.status
        : currentBlocker
          ? "Blocked today"
          : "Ready to continue";

  const sessionSummary =
    !missionCoachApproved
      ? authorityView.dashboard.body
        : currentBlocker
          ? "Clear the step above before continuing."
          : "Follow today's mission within the current limit.";

  const sessionTone =
    sessionState === "Ready to continue"
      ? "bg-emerald-300"
      : sessionState === "Athlete-directed only"
        ? "bg-violet-300"
        : "bg-rose-300";

  function openWorkflow(panel: WorkflowPanel) {
    if (panel === "coach_submission") {
      const source = coachState.currentMission || latestRejectedSubmission;
      if (source) {
        dispatchWorkflow({
          type: "SET_CORRECTION",
          value:
            "correction_text" in source
              ? source.correction_text
              : "",
        });
        dispatchWorkflow({
          type: "SET_PRACTICE_TASK",
          value:
            "practice_task" in source
              ? source.practice_task
              : "",
        });
        dispatchWorkflow({
          type: "SET_ATHLETE_CONTEXT",
          value:
            "athlete_context" in source
              ? source.athlete_context || ""
              : "",
        });
      }
    }
    if (panel === "vision_review") {
      dispatchWorkflow({
        type: "SET_VISION_CONTEXT",
        value:
          reviewPrepared && reviewPacket ? reviewPacket.athleteContext : "",
      });
    }
    dispatchWorkflow({ type: "OPEN", panel });
  }

  useEffect(() => {
    const handleShellAction = (event: Event) => {
      const requested = (event as CustomEvent<WorkflowPanel>).detail;
      if (requested !== "vision_review" && requested !== "fuel" && requested !== "evidence") return;
      if (requested === "vision_review") {
        dispatchWorkflow({
          type: "SET_VISION_CONTEXT",
          value: reviewPrepared && reviewPacket ? reviewPacket.athleteContext : "",
        });
      }
      dispatchWorkflow({ type: "OPEN", panel: requested });
    };
    window.addEventListener("disciplin:dashboard-workflow-open", handleShellAction);
    return () => window.removeEventListener("disciplin:dashboard-workflow-open", handleShellAction);
  }, [reviewPrepared, reviewPacket]);

  async function handleMissionSubmission() {
    const relationship = coachState.athleteRelationship;
    if (!relationship || relationship.status !== "connected") {
      dispatchWorkflow({ type: "ERROR", message: "Connect a coach before submitting work." });
      return;
    }
    if (!workflowUi.correction.trim() || !workflowUi.practiceTask.trim()) {
      dispatchWorkflow({ type: "ERROR", message: "Add the exact correction and practice task." });
      return;
    }
    dispatchWorkflow({ type: "BEGIN", phase: "submitting" });
    const response = await fetch("/api/coach/missions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        relationshipId: relationship.id,
        correction: workflowUi.correction,
        practiceTask: workflowUi.practiceTask,
        athleteContext: workflowUi.athleteContext,
        proposedChangeToVersionId: coachState.currentMission?.id,
      }),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.ok) {
      dispatchWorkflow({ type: "ERROR", message: payload?.error || "The correction could not be submitted." });
      return;
    }
    dispatchWorkflow({ type: "SUCCESS" });
    announceCoachMutation();
    setFeedback("Sent to your coach. Sensei stays locked until approval.");
  }

  function closeWorkflow() {
    if (
      workflowUi.phase === "submitting" ||
      workflowUi.phase === "processing"
    ) {
      return;
    }
    dispatchWorkflow({ type: "CLOSE" });
  }

  async function handlePrepareObservation() {
    if (!observation || !observationKey) {
      dispatchWorkflow({
        type: "ERROR",
        message: "The observation is no longer available. Close and try again.",
      });
      return;
    }

    const athleteContext = workflowUi.visionContext.trim();
    if (athleteContext.length < 3) {
      dispatchWorkflow({
        type: "ERROR",
        message: "Add what you felt or what happened in the exchange.",
      });
      return;
    }

    dispatchWorkflow({ type: "BEGIN", phase: "submitting" });
    await new Promise<void>((resolve) => window.setTimeout(resolve, 180));

    const packet: VisionReviewPacket = {
      observationKey,
      observation: observation.title,
      athleteContext,
      preparedAt: new Date().toISOString(),
      status: "prepared_for_coach",
    };

    try {
      if (!writeUserJson(storageOwnerId, VISION_REVIEW_PACKET_KEY, packet)) {
        throw new Error("No authenticated storage owner.");
      }
      setReviewPacket(packet);
      const storedReview = readUserJson<VisionReviewPackage>(
        storageOwnerId,
        "disciplin_latest_vision_review",
      );
      if (storedReview) {
        writeUserJson(storageOwnerId, "disciplin_latest_vision_review", {
          ...storedReview,
          authorityState: "HAS_COACH_NO_MISSION",
          evidenceAuthority: "OBSERVATION_ONLY",
          reviewState: "NOT_SUBMITTED",
        });
      }
      updateWorkflow({
        status: "needs_context",
        observation: packet.observation,
        athleteContext: packet.athleteContext,
        correction: null,
        correctionId: null,
        coach: null,
      });
      dispatchWorkflow({ type: "SUCCESS" });
      setFeedback("Observation saved. It has not been sent to your coach.");
      window.setTimeout(
        () =>
          dispatchWorkflow({ type: "CLOSE_PANEL", panel: "vision_review" }),
        650
      );
    } catch {
      dispatchWorkflow({
        type: "ERROR",
        message: "The review could not be saved. Try again.",
      });
    }
  }

  function handleEvidenceSelection(file: File | null) {
    if (!file) {
      dispatchWorkflow({ type: "SELECT_EVIDENCE", file: null });
      return;
    }

    const isVideo = file.type.startsWith("video");
    const isImage = file.type.startsWith("image");
    if (!isVideo && !isImage) {
      dispatchWorkflow({
        type: "ERROR",
        message: "Choose an image or video file.",
      });
      return;
    }

    dispatchWorkflow({ type: "SELECT_EVIDENCE", file });
  }

  function handleEvidenceUpload() {
    const file = workflowUi.evidenceFile;
    if (!file) {
      dispatchWorkflow({
        type: "ERROR",
        message: "Choose an image or video first.",
      });
      return;
    }

    const isVideo = file.type.startsWith("video");
    dispatchWorkflow({ type: "BEGIN", phase: "processing" });

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || "");
      if (!dataUrl) {
        dispatchWorkflow({
          type: "ERROR",
          message: "The file could not be read. Try another file.",
        });
        return;
      }

      const nextEvidence: EvidenceMemory = {
        dataUrl,
        mimeType: file.type,
        fileName: file.name,
        uploadedAt: new Date().toISOString(),
      };

      try {
        if (!writeUserJson(storageOwnerId, LAST_EVIDENCE_KEY, nextEvidence)) {
          throw new Error("No authenticated storage owner.");
        }
        setEvidence(nextEvidence);
        setProgress((previous) =>
          normalizeDirectiveProgress({
            ...previous,
            proofType: isVideo ? "video" : "image",
            updatedAt: new Date().toISOString(),
          })
        );
        dispatchWorkflow({ type: "SUCCESS" });
        setFeedback("Evidence added to today’s session.");
        window.setTimeout(
          () => dispatchWorkflow({ type: "CLOSE_PANEL", panel: "evidence" }),
          650
        );
      } catch {
        dispatchWorkflow({
          type: "ERROR",
          message: "The file could not be saved. Choose a smaller file and retry.",
        });
      }
    };
    reader.onerror = () => {
      dispatchWorkflow({
        type: "ERROR",
        message: "The file could not be read. Try another file.",
      });
    };
    reader.readAsDataURL(file);
  }

  function handleLogWeight() {
    const value = Number(weightInput);
    if (!Number.isFinite(value) || value <= 0) return;

    const nextLogs = [
      ...weightLogs,
      { value, loggedAt: new Date().toISOString() },
    ];

    setWeightLogs(nextLogs);
    writeUserJson(storageOwnerId, "disciplin_weight_logs", nextLogs);
    setWeightInput("");
    setFeedback("Weight logged.");
  }

  async function dismissFirstRunReveal() {
    if (!profile?.dashboardRevealPending) return;
    await saveProfile({ ...profile, dashboardRevealPending: false });
  }

  if (!mounted || loading) {
    return (
      <main
        aria-busy="true"
        aria-label="Loading today's mission"
        className="app-chrome-pad min-h-[calc(100vh-72px)] bg-[#05080d] px-3 pt-3 text-white sm:px-5 sm:pt-5"
      >
        <div className="mx-auto max-w-5xl space-y-3">
          <div className="min-h-[430px] rounded-[24px] border border-white/[0.07] bg-[#0b1119] p-5 sm:p-6">
            <div className="animate-pulse space-y-5 motion-reduce:animate-none">
              <div className="h-3 w-28 rounded-full bg-white/[0.08]" />
              <div className="h-14 w-3/4 rounded-[16px] bg-white/[0.08]" />
              <div className="h-4 w-1/2 rounded-full bg-white/[0.06]" />
              <div className="h-24 rounded-[22px] bg-white/[0.055]" />
              <div className="h-14 rounded-full bg-white/[0.08]" />
            </div>
          </div>
          <div className="h-36 rounded-[22px] bg-[#0a1018] ring-1 ring-white/[0.06]" />
        </div>
      </main>
    );
  }

  return (
    <motion.main
      variants={pageMotion}
      initial={reduceMotion ? false : "hidden"}
      animate="show"
      className="app-chrome-pad min-h-[calc(100vh-72px)] bg-[radial-gradient(ellipse_68%_36%_at_50%_-12%,rgba(52,211,153,.045),transparent_72%),#05080d] px-3 pt-3 text-white sm:px-5 sm:pt-5"
    >
      <div className="mx-auto max-w-5xl space-y-3">
        <AnimatePresence initial={false}>
          {profile?.dashboardRevealPending ? (
            <motion.section
              initial={reduceMotion ? false : { opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, height: 0, marginBottom: 0 }}
              transition={{ duration: reduceMotion ? 0 : 0.24, ease: [0.22, 1, 0.36, 1] }}
              className="overflow-hidden rounded-[22px] border border-emerald-300/16 bg-[radial-gradient(circle_at_12%_0%,rgba(52,211,153,.1),transparent_38%),#09131c] px-4 py-4 shadow-[0_18px_55px_rgba(0,0,0,.22)] sm:px-6 sm:py-5"
            >
              <p className="app-label text-emerald-200/70">Workspace ready</p>
              <div className="mt-2.5 flex flex-col gap-3 sm:mt-3 sm:flex-row sm:items-end sm:justify-between sm:gap-5">
                <div className="min-w-0">
                  <h2 className="text-[clamp(1.5rem,4vw,1.875rem)] font-semibold leading-[1.08] tracking-[-0.03em] text-white">
                    Welcome, {profile.name || "athlete"}.
                  </h2>
                  <p className="mt-3 hidden max-w-2xl text-sm font-medium leading-6 text-white/52 sm:block">
                    Your training context is ready.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void dismissFirstRunReveal()}
                  className="app-button-secondary w-full shrink-0 sm:w-auto"
                >
                  <span className="sm:hidden">Show Dashboard</span>
                  <span className="hidden sm:inline">Show today’s Dashboard</span>
                </button>
              </div>
            </motion.section>
          ) : null}
        </AnimatePresence>
        <WorkflowJourney />
        <motion.section
          variants={sectionMotion}
          className="relative flex min-h-0 flex-col overflow-hidden rounded-[26px] border border-white/[0.09] bg-[radial-gradient(ellipse_54%_42%_at_96%_-8%,rgba(52,211,153,.065),transparent_72%),linear-gradient(145deg,#0d151f_0%,#09101a_62%,#080e16_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,.045),0_26px_84px_rgba(0,0,0,0.38),0_1px_0_rgba(255,255,255,.018)] sm:min-h-[410px]"
        >
          <div
            className={cn(
              "absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-current to-transparent",
              missionCoachApproved
                ? "text-emerald-200/62"
                : authority === "Athlete directed"
                  ? "text-violet-200/56"
                  : "text-cyan-100/52"
            )}
          />

          <div className="relative z-10 flex flex-wrap items-center justify-between gap-3 px-5 pb-4 pt-5 sm:px-8 sm:pt-7">
            <p className="text-[11px] font-semibold tracking-[0.08em] text-emerald-200/64">
              {missionCoachApproved
                ? "Today's mission"
                : authority === "Athlete directed"
                  ? "Athlete-directed work"
                  : "Mission status"}
            </p>
            <StatusBadge className={authorityTone(authority)}>
              {authorityView.dashboard.status}
            </StatusBadge>
          </div>

          <div className="relative z-10 flex flex-1 flex-col px-5 pb-5 sm:px-8 sm:pb-8">
            <AnimatePresence mode="wait" initial={false}>
              <motion.h1
                key={missionTitle}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                transition={{
                  duration: reduceMotion ? 0 : 0.24,
                  ease: [0.22, 1, 0.36, 1],
                }}
                className="max-w-4xl text-[clamp(2.25rem,4.6vw,3.25rem)] font-semibold leading-[1.02] tracking-[-.04em] text-white"
              >
                {missionTitle}
              </motion.h1>
            </AnimatePresence>
            {authority === "Athlete directed" ? (
              <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.14em] text-violet-200/72">
                Not coach approved. Sensei will not receive this work.
              </p>
            ) : null}
            <p className="mt-4 max-w-2xl text-[15px] font-normal leading-6 text-white/66 sm:text-base sm:leading-7">
              {missionReason}
            </p>

            {missionCoachApproved ? (
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  layout
                  key={currentBlocker || missionCue}
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{
                    duration: reduceMotion ? 0 : 0.22,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                  className={cn(
                    "mt-auto rounded-[22px] border px-4 py-4 sm:px-5",
                    currentBlocker
                      ? "border-rose-300/18 bg-rose-300/[0.055]"
                      : "border-emerald-300/18 bg-emerald-300/[0.055]"
                  )}
                >
                  <p
                    className={cn(
                      "text-[9px] font-bold uppercase tracking-[0.18em]",
                      currentBlocker ? "text-rose-200/62" : "text-emerald-100/58"
                    )}
                  >
                    {currentBlocker ? "Current blocker" : "Carry this"}
                  </p>
                  <p className="mt-2 text-base font-semibold leading-6 text-white sm:text-lg">
                    {currentBlocker || missionCue}
                  </p>
                  {/*
                    The cue is the most consequential sentence in the product —
                    the one thing the athlete carries into the session. It now
                    says whose standard it is, so its authority is legible
                    rather than assumed.
                  */}
                  <Provenance kind="coach_approved" className="mt-3" />
                </motion.div>
              </AnimatePresence>
            ) : null}

            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                layout
                key={primaryAction.label}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{
                  duration: reduceMotion ? 0 : 0.22,
                  ease: [0.22, 1, 0.36, 1],
                }}
                className="mt-6"
              >
                <PrimaryAction
                  action={primaryAction}
                  onOpenDrawer={openWorkflow}
                  onOpenPanel={(panel, opener) => openPanel(panel, opener)}
                />
              </motion.div>
            </AnimatePresence>

            <motion.div
              layout
              className="mt-4 grid gap-1 overflow-hidden rounded-[20px] border border-white/[0.07] bg-white/[0.025] p-1 shadow-[inset_0_1px_0_rgba(255,255,255,.025),0_12px_34px_rgba(0,0,0,.16)] sm:grid-cols-3"
            >
              <div className="flex min-w-0 items-start gap-3 rounded-[16px] bg-[#0a121c]/90 px-4 py-4 sm:px-5">
                <ShieldCheck aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-emerald-200/82" strokeWidth={1.8} />
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold tracking-[0.05em] text-emerald-200/55">Authority</p>
                  <p className="mt-1 text-sm font-semibold leading-5 text-white/88">{authoritySupport.value}</p>
                  <p className="mt-0.5 text-xs leading-5 text-white/42">{authoritySupport.detail}</p>
                </div>
              </div>
              <div className="flex min-w-0 items-start gap-3 rounded-[16px] bg-[#0a121c]/90 px-4 py-4 sm:px-5">
                <LockKeyhole aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-emerald-200/82" strokeWidth={1.8} />
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold tracking-[0.05em] text-emerald-200/55">Sensei access</p>
                  <p className="mt-1 text-sm font-semibold leading-5 text-white/88">{senseiSupport.value}</p>
                  <p className="mt-0.5 text-xs leading-5 text-white/42">{senseiSupport.detail}</p>
                </div>
              </div>
              <div className="flex min-w-0 items-start gap-3 rounded-[16px] bg-[#0a121c]/90 px-4 py-4 sm:px-5">
                <CalendarClock aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-emerald-200/82" strokeWidth={1.8} />
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold tracking-[0.05em] text-emerald-200/55">Next checkpoint</p>
                  <p className="mt-1 text-sm font-semibold leading-5 text-white/88">{nextCheckpoint.value}</p>
                  <p className="mt-0.5 text-xs leading-5 text-white/42">{nextCheckpoint.detail}</p>
                </div>
              </div>
            </motion.div>
          </div>
        </motion.section>

        {missionCoachApproved || observation ? (
          <motion.section
            variants={sectionMotion}
            className="overflow-hidden rounded-[26px] bg-[#0a1018] shadow-[0_20px_70px_rgba(0,0,0,0.28)] ring-1 ring-white/[0.07]"
          >
          <div className="flex items-center gap-5 px-5 py-6 sm:px-7 sm:py-7">
            <span
              aria-hidden="true"
              className={cn("h-14 w-1.5 shrink-0 rounded-full", sessionTone)}
            />
            <div className="min-w-0 flex-1">
              <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-white/34">
                Can I continue?
              </p>
              <AnimatePresence mode="wait" initial={false}>
                <motion.h2
                  key={sessionState}
                  initial={{ opacity: 0, y: 7 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  transition={{ duration: reduceMotion ? 0 : 0.2 }}
                  className="mt-1 text-2xl font-bold text-white"
                >
                  {sessionState}
                </motion.h2>
              </AnimatePresence>
              <p className="mt-1 text-sm font-medium leading-6 text-white/46">
                {sessionSummary}
              </p>
            </div>
          </div>

          {observation && !missionCoachApproved ? (
            <motion.div
              layout
              className={cn(
                "border-t border-white/[0.06] px-5 sm:px-7",
                reviewPrepared ? "py-3" : "py-5"
              )}
            >
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-cyan-100/40">
                    {reviewPrepared ? "Prepared for coach" : "What happened"}
                  </p>
                  <p
                    className={cn(
                      "truncate font-semibold text-white/84",
                      reviewPrepared ? "mt-1 text-sm" : "mt-2 text-base"
                    )}
                  >
                    {observation.title}
                  </p>
                </div>
                {reviewPrepared ? (
                  <span className="shrink-0 text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-200/58">
                    Done
                  </span>
                ) : null}
              </div>
            </motion.div>
          ) : null}

          <DetailDisclosure
            key={`${authority}|${conditions.state}|${currentEvidence}|${primaryAction.label}`}
          >
            <div className="space-y-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="max-w-xl">
                  <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-amber-200/44">
                    Training limit
                  </p>
                  <p className="mt-2 text-sm font-semibold leading-6 text-white/78">
                    {conditions.limit}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-white/36">
                    This can change the load. It cannot change today&apos;s correction.
                  </p>
                </div>
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.97 }}
                  onClick={() => openWorkflow("fuel")}
                  className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-full border border-white/[0.09] bg-white/[0.045] px-4 text-xs font-bold text-white transition hover:bg-white/[0.09] active:scale-[0.97]"
                >
                  View limit
                </motion.button>
              </div>

              <div className="flex flex-col gap-3 border-t border-white/[0.06] pt-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="max-w-xl">
                  <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-emerald-200/44">
                    Today&apos;s evidence
                  </p>
                  <p className="mt-2 text-sm font-semibold leading-6 text-white/78">
                    {currentEvidence}. {evidenceReviewRecorded ? "Reviewed by your coach." : authorityView.visionEvidenceLabel}.
                  </p>
                </div>
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.97 }}
                  onClick={() => openWorkflow("evidence")}
                  className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-full border border-white/[0.09] bg-white/[0.045] px-4 text-xs font-bold text-white transition hover:bg-white/[0.09]"
                >
                  {evidence ? "Replace" : "Upload"}
                </motion.button>
              </div>

              {observation ? (
                <div className="flex flex-col gap-3 border-t border-white/[0.06] pt-5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="max-w-xl">
                    <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-cyan-100/44">
                      What we saw
                    </p>
                    <p className="mt-2 text-sm font-semibold leading-6 text-white/78">
                      {visionInference || observation.title}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-white/36">
                      Intent, pain, fatigue, and coach context remain unconfirmed.
                    </p>
                  </div>
                  <Link
                    href="/sensei-vision"
                    className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-full border border-white/[0.09] bg-white/[0.045] px-4 text-xs font-bold text-white transition hover:bg-white/[0.09] active:scale-[0.97]"
                  >
                    Open clip
                  </Link>
                </div>
              ) : null}

              {showCompetitionContext ? (
                <div className="border-t border-white/[0.06] pt-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-white/34">
                        Fight
                      </p>
                      <p className="mt-2 text-sm font-semibold text-white/76">
                        {currentWeight === null ? "Weight not recorded" : `${currentWeight} kg`}
                        {targetWeight === null ? "" : ` / ${targetWeight} kg target`}
                        {daysRemaining === null ? "" : ` / ${daysRemaining} days`}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <input
                        value={weightInput}
                        onChange={(event) => setWeightInput(event.target.value)}
                        inputMode="decimal"
                        aria-label="Current weight"
                        placeholder="kg"
                        className="w-24 rounded-full border border-white/[0.10] bg-black/30 px-4 py-2.5 text-sm text-white outline-none placeholder:text-white/28 focus:border-emerald-300/34"
                      />
                      <motion.button
                        type="button"
                        whileTap={{ scale: 0.96 }}
                        onClick={handleLogWeight}
                        className="rounded-full bg-white px-4 py-2.5 text-xs font-bold text-black transition hover:bg-white/90"
                      >
                        Log
                      </motion.button>
                    </div>
                  </div>
                </div>
              ) : null}

              {coachState.currentMission &&
              coachState.athleteRelationship?.status === "connected" ? (
                <div className="flex flex-col gap-3 border-t border-white/[0.06] pt-5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="max-w-xl">
                    <p className="app-label">Mission authority</p>
                    <p className="mt-2 text-sm font-semibold leading-6 text-white/78">
                      {pendingCoachSubmission
                        ? "Your coach is reviewing an update. Today’s approved mission remains active."
                        : "This is your current coach-approved mission."}
                    </p>
                  </div>
                  {!pendingCoachSubmission ? (
                    <button
                      type="button"
                      onClick={() => openWorkflow("coach_submission")}
                      className="app-button-secondary shrink-0"
                    >
                      Record an updated correction
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          </DetailDisclosure>
          </motion.section>
        ) : null}
      </div>

      <DashboardWorkflowDrawer
        open={workflowUi.panel === "coach_submission"}
        eyebrow="Connected coach"
        title={
          authorityView.authorityState === "HAS_COACH_PENDING_REVIEW"
            ? "Awaiting coach review"
            : coachState.currentMission
              ? "Update coach correction"
              : "Record coach correction"
        }
        onClose={closeWorkflow}
        dismissible={workflowUi.phase !== "submitting"}
      >
        {authorityView.authorityState === "HAS_COACH_PENDING_REVIEW" ? (
          <div className="space-y-4">
            <div className="rounded-[20px] border border-amber-300/16 bg-amber-300/[0.05] p-4">
              <p className="app-label text-amber-100/65">Pending</p>
              <p className="mt-2 text-sm font-semibold leading-6 text-white">
                Your coach is reviewing this correction.
              </p>
              <p className="mt-2 text-sm leading-6 text-white/48">
                Your approved mission stays active until your coach approves a change. Sensei uses only approved work.
              </p>
            </div>
            {coachState.submissions.find(
              (submission) =>
                submission.athlete_user_id === user?.id &&
                submission.status === "pending",
            ) ? (
              <dl className="space-y-4 rounded-[20px] border border-white/[0.08] bg-black/20 p-4">
                <div><dt className="app-label">Correction</dt><dd className="mt-2 leading-6 text-white">{coachState.submissions.find((item) => item.athlete_user_id === user?.id && item.status === "pending")?.correction_text}</dd></div>
                <div><dt className="app-label">Practice task</dt><dd className="mt-2 leading-6 text-white">{coachState.submissions.find((item) => item.athlete_user_id === user?.id && item.status === "pending")?.practice_task}</dd></div>
              </dl>
            ) : null}
          </div>
        ) : (
          <div className="space-y-5">
            {coachState.currentMission ? (
              <div className="rounded-[18px] border border-emerald-300/15 bg-emerald-300/[0.045] p-4 text-sm leading-6 text-white/60">
                Your approved mission stays active while your coach reviews this change.
              </div>
            ) : null}
            <label className="block">
              <span className="text-xs font-semibold text-white/58">Exact correction from your coach</span>
              <textarea
                rows={4}
                maxLength={2000}
                value={workflowUi.correction}
                onChange={(event) => dispatchWorkflow({ type: "SET_CORRECTION", value: event.target.value })}
                disabled={workflowUi.phase === "submitting" || workflowUi.phase === "success"}
                className="app-input mt-2 min-h-24 py-3"
                placeholder="Record the coach’s exact words."
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-white/58">Practice task</span>
              <textarea
                rows={4}
                maxLength={2000}
                value={workflowUi.practiceTask}
                onChange={(event) => dispatchWorkflow({ type: "SET_PRACTICE_TASK", value: event.target.value })}
                disabled={workflowUi.phase === "submitting" || workflowUi.phase === "success"}
                className="app-input mt-2 min-h-24 py-3"
                placeholder="What did your coach ask you to practise?"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-white/58">Athlete context <span className="text-white/30">(optional)</span></span>
              <textarea
                rows={3}
                maxLength={2000}
                value={workflowUi.athleteContext}
                onChange={(event) => dispatchWorkflow({ type: "SET_ATHLETE_CONTEXT", value: event.target.value })}
                disabled={workflowUi.phase === "submitting" || workflowUi.phase === "success"}
                className="app-input mt-2 min-h-20 py-3"
                placeholder="What happened or what did you feel?"
              />
            </label>
            {workflowUi.phase === "error" ? <p className="text-sm text-rose-100" role="alert">{workflowUi.error}</p> : null}
            {workflowUi.phase === "success" ? <p className="text-sm text-emerald-100" role="status">Sent to your coach. Sensei stays locked until approval.</p> : null}
            <button type="button" disabled={workflowUi.phase === "submitting" || workflowUi.phase === "success"} onClick={() => void handleMissionSubmission()} className="app-button-accent w-full">
              {workflowUi.phase === "submitting" ? "Submitting…" : workflowUi.phase === "success" ? "Submitted" : "Submit to coach"}
            </button>
          </div>
        )}
      </DashboardWorkflowDrawer>

      <DashboardWorkflowDrawer
        open={workflowUi.panel === "vision_review"}
        eyebrow="Coach review"
        title={reviewPrepared ? "Observation saved" : "Add your context"}
        onClose={closeWorkflow}
        dismissible={workflowUi.phase !== "submitting"}
      >
        <div className="space-y-5">
          <div className="rounded-[20px] border border-cyan-200/14 bg-cyan-200/[0.045] px-4 py-4">
            <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-cyan-100/48">
              What happened
            </p>
            <p className="mt-2 text-base font-semibold leading-6 text-white">
              {observation?.title || "Observation unavailable"}
            </p>
          </div>

          {reviewPrepared && workflowUi.phase !== "submitting" ? (
            <div className="rounded-[20px] border border-emerald-300/16 bg-emerald-300/[0.05] px-4 py-4">
              <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-emerald-100/48">
                Not sent
              </p>
              <p className="mt-2 text-sm font-semibold leading-6 text-white/82">
                This observation is saved, but it has not been sent to your coach. Sensei remains locked.
              </p>
            </div>
          ) : null}

          <label className="block">
            <span className="text-xs font-semibold text-white/58">
              What did you feel in the exchange?
            </span>
            <textarea
              value={workflowUi.visionContext}
              onChange={(event) =>
                dispatchWorkflow({
                  type: "SET_VISION_CONTEXT",
                  value: event.target.value,
                })
              }
              disabled={workflowUi.phase === "submitting"}
              rows={5}
              placeholder="What happened before the position broke?"
              className="mt-2 w-full resize-none rounded-[18px] border border-white/[0.10] bg-black/25 px-4 py-3 text-sm leading-6 text-white outline-none placeholder:text-white/26 focus:border-cyan-200/30 disabled:opacity-50"
            />
          </label>

          <div aria-live="polite">
            {workflowUi.phase === "error" ? (
              <div className="rounded-[16px] border border-rose-300/18 bg-rose-300/[0.055] px-4 py-3 text-sm font-semibold text-rose-100">
                {workflowUi.error}
              </div>
            ) : null}
            {workflowUi.phase === "success" ? (
              <div className="rounded-[16px] border border-emerald-300/18 bg-emerald-300/[0.055] px-4 py-3 text-sm font-semibold text-emerald-100">
                Saved. It has not been sent to your coach.
              </div>
            ) : null}
          </div>

          <motion.button
            type="button"
            whileTap={{ scale: 0.985 }}
            onClick={handlePrepareObservation}
            disabled={
              workflowUi.phase === "submitting" ||
              workflowUi.phase === "success"
            }
            className="flex min-h-12 w-full items-center justify-center rounded-full bg-emerald-300 px-5 text-sm font-bold text-[#03120d] transition hover:bg-emerald-200 disabled:cursor-wait disabled:opacity-55"
          >
            {workflowUi.phase === "submitting"
              ? "Saving…"
              : workflowUi.phase === "success"
                ? "Saved"
                : reviewPrepared
                  ? "Update observation"
                  : "Save observation"}
          </motion.button>
        </div>
      </DashboardWorkflowDrawer>

      <DashboardWorkflowDrawer
        open={workflowUi.panel === "fuel"}
        eyebrow="Before training"
        title="Today's training limit"
        onClose={closeWorkflow}
      >
        <div className="space-y-5">
          <div>
            <p className="text-2xl font-bold leading-tight text-white">
              {conditions.limit}
            </p>
            <p className="mt-3 text-sm leading-6 text-white/48">
              {conditions.why}
            </p>
          </div>

          <div className="rounded-[18px] border border-amber-300/15 bg-amber-300/[0.045] px-4 py-4 text-sm font-semibold leading-6 text-amber-50/78">
            This can change training load. It cannot change today&apos;s correction.
          </div>

          {conditions.state === "missing" ? (
            <Link
              href="/fuel"
              className="flex min-h-12 w-full items-center justify-center rounded-full bg-emerald-300 px-5 text-sm font-bold text-[#03120d] transition hover:bg-emerald-200 active:scale-[0.985]"
            >
              Complete body check
            </Link>
          ) : (
            <motion.button
              type="button"
              whileTap={{ scale: 0.985 }}
              onClick={closeWorkflow}
              className="flex min-h-12 w-full items-center justify-center rounded-full border border-white/[0.10] bg-white/[0.05] px-5 text-sm font-bold text-white transition hover:bg-white/[0.09]"
            >
              Back to Dashboard
            </motion.button>
          )}
        </div>
      </DashboardWorkflowDrawer>

      <DashboardWorkflowDrawer
        open={workflowUi.panel === "evidence"}
        eyebrow="Today's session"
        title={evidence ? "Replace evidence" : "Add evidence"}
        onClose={closeWorkflow}
        dismissible={workflowUi.phase !== "processing"}
      >
        <div className="space-y-5">
          <label className="block cursor-pointer rounded-[22px] border border-dashed border-white/[0.14] bg-black/20 px-5 py-8 text-center transition hover:border-emerald-200/25 hover:bg-emerald-300/[0.025]">
            <span className="text-sm font-bold text-white">
              {workflowUi.evidenceFile
                ? workflowUi.evidenceFile.name
                : "Choose an image or video"}
            </span>
            <span className="mt-2 block text-xs text-white/36">
              Keep the exchange clear and visible.
            </span>
            <input
              key={`${workflowUi.panel}-${workflowUi.phase}`}
              type="file"
              accept="image/*,video/*"
              disabled={workflowUi.phase === "processing"}
              onChange={(event) =>
                handleEvidenceSelection(event.target.files?.[0] || null)
              }
              className="sr-only"
            />
          </label>

          <div aria-live="polite">
            {workflowUi.phase === "processing" ? (
              <div className="space-y-2">
                <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
                  <motion.div
                    initial={{ width: "12%" }}
                    animate={{ width: "78%" }}
                    transition={{ duration: reduceMotion ? 0 : 0.55 }}
                    className="h-full rounded-full bg-emerald-300"
                  />
                </div>
                <p className="text-xs font-semibold text-white/42">Adding evidence…</p>
              </div>
            ) : null}
            {workflowUi.phase === "success" ? (
              <div className="rounded-[16px] border border-emerald-300/18 bg-emerald-300/[0.055] px-4 py-3 text-sm font-semibold text-emerald-100">
                Evidence added to today’s session.
              </div>
            ) : null}
            {workflowUi.phase === "error" ? (
              <div className="space-y-3 rounded-[16px] border border-rose-300/18 bg-rose-300/[0.055] px-4 py-3">
                <p className="text-sm font-semibold text-rose-100">{workflowUi.error}</p>
                <button
                  type="button"
                  onClick={() => dispatchWorkflow({ type: "RETRY" })}
                  className="text-xs font-bold text-white underline decoration-white/30 underline-offset-4"
                >
                  Try again
                </button>
              </div>
            ) : null}
          </div>

          <motion.button
            type="button"
            whileTap={{ scale: 0.985 }}
            onClick={handleEvidenceUpload}
            disabled={
              !workflowUi.evidenceFile ||
              workflowUi.phase === "processing" ||
              workflowUi.phase === "success"
            }
            className="flex min-h-12 w-full items-center justify-center rounded-full bg-emerald-300 px-5 text-sm font-bold text-[#03120d] transition hover:bg-emerald-200 disabled:cursor-not-allowed disabled:opacity-35"
          >
            {workflowUi.phase === "processing"
              ? "Adding…"
              : workflowUi.phase === "success"
                ? "Added"
                : "Add evidence"}
          </motion.button>
        </div>
      </DashboardWorkflowDrawer>

      <AnimatePresence>
        {feedback ? (
          <motion.div
            role="status"
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{
              duration: reduceMotion ? 0 : 0.2,
              ease: [0.22, 1, 0.36, 1],
            }}
            className="fixed bottom-24 left-1/2 z-40 w-[min(92vw,420px)] -translate-x-1/2 rounded-full border border-emerald-200/18 bg-[#101923]/96 px-5 py-3 text-center text-sm font-semibold text-white shadow-[0_18px_60px_rgba(0,0,0,0.42)] backdrop-blur-xl"
          >
            {feedback}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.main>
  );
}
