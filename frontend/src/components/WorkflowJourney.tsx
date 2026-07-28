"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useWorkflow } from "./WorkflowProvider";
import type { WorkflowStatus } from "@/lib/workflow/contracts";

const steps: Array<{ status: WorkflowStatus; label: string }> = [
  { status: "needs_evidence", label: "Observe" },
  { status: "needs_context", label: "Context" },
  { status: "awaiting_coach", label: "Coach" },
  { status: "mission_ready", label: "Mission" },
  { status: "in_session", label: "Practice" },
  { status: "evidence_submitted", label: "Evidence" },
  { status: "complete", label: "Complete" },
];

export default function WorkflowJourney() {
  const { workflow, authority, ready } = useWorkflow();
  const reduceMotion = useReducedMotion();
  if (!ready) return <div className="app-surface h-16 p-4"><div className="app-skeleton h-full w-full" /></div>;
  const effectiveStatus: WorkflowStatus =
    authority.authorityState === "HAS_COACH_PENDING_REVIEW"
      ? "awaiting_coach"
      : authority.authorityState === "COACH_APPROVED_MISSION"
        ? workflow.status
        : workflow.status === "needs_context"
          ? "needs_context"
          : "needs_evidence";
  const current = steps.findIndex(step => step.status === effectiveStatus);
  const currentIndex = Math.max(0, current);
  const currentStep = steps[currentIndex];

  return (
    <section
      aria-label="Today’s progress"
      className="app-surface px-4 py-3.5 sm:px-5 sm:py-4"
    >
      <div className="sm:hidden">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold tracking-[0.05em] text-emerald-200/58">
              Current stage
            </p>
            <p className="mt-0.5 text-base font-semibold text-white">
              {currentStep.label}
            </p>
          </div>
          <span className="shrink-0 rounded-full border border-white/[0.08] bg-white/[0.035] px-3 py-1.5 text-xs font-medium text-white/52">
            {currentIndex + 1} of {steps.length}
          </span>
        </div>
        <div
          aria-hidden="true"
          className="mt-3 grid grid-cols-7 gap-1.5"
        >
          {steps.map((step, index) => (
            <motion.span
              key={step.status}
              layout
              initial={reduceMotion ? false : { opacity: 0.5, scaleX: 0.8 }}
              animate={{ opacity: 1, scaleX: 1 }}
              transition={{ duration: reduceMotion ? 0 : 0.2, ease: [0.22, 1, 0.36, 1] }}
              className={`h-1.5 rounded-full ${
                index === currentIndex
                  ? "bg-emerald-300 shadow-[0_0_0_1px_rgba(110,231,183,.12)]"
                  : index < currentIndex
                    ? "bg-emerald-200/22"
                    : "bg-white/[0.065]"
              }`}
            />
          ))}
        </div>
      </div>

      <div className="hidden items-center justify-between gap-2 sm:flex">
        {steps.map((step, index) => {
          const complete = index < current;
          const active = index === current;
          return (
            <div key={step.status} className={`flex min-w-0 flex-1 items-center ${index === steps.length - 1 ? "" : complete ? "after:mx-2 after:h-px after:min-w-3 after:flex-1 after:bg-emerald-200/[0.14]" : "after:mx-2 after:h-px after:min-w-3 after:flex-1 after:bg-white/[0.065]"}`}>
              <div className="min-w-fit text-center">
                <motion.span
                  layout
                  initial={reduceMotion ? false : { scale: 0.82, opacity: 0.5 }}
                  animate={{ scale: active ? 1 : 0.9, opacity: 1 }}
                  transition={{ duration: reduceMotion ? 0 : 0.2, ease: [0.22, 1, 0.36, 1] }}
                  className={`mx-auto block h-2.5 w-2.5 rounded-full ${active ? "bg-emerald-300 shadow-[0_0_0_4px_rgba(110,231,183,.08)]" : complete ? "bg-emerald-200/26" : "border border-white/12 bg-transparent"}`}
                />
                <motion.span
                  animate={{ opacity: active ? 1 : complete ? 0.42 : 0.3 }}
                  transition={{ duration: reduceMotion ? 0 : 0.18 }}
                  className="mt-1.5 block text-[10px] font-semibold tracking-[.03em] text-white"
                >
                  {step.label}
                </motion.span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
