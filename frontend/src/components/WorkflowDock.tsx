"use client";

import { useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { WorkflowStatus } from "@/lib/workflow/contracts";
import type { AuthorityAction } from "@/lib/authority/state";
import { useWorkflow } from "./WorkflowProvider";
import { panelForHref, useShellInteraction } from "./ShellInteractionProvider";

const labels: Record<WorkflowStatus, string> = {
  needs_evidence: "Vision needs evidence", needs_context: "Add your context",
  awaiting_coach: "Waiting for coach", mission_ready: "Mission approved",
  in_session: "Session active", evidence_submitted: "Evidence recorded", complete: "Session complete",
};

export default function WorkflowDock() {
  const pathname = usePathname();
  const router = useRouter();
  const { workflow, authority, ready, simulate, reset } = useWorkflow();
  const { openPanel, closePanel } = useShellInteraction();
  const [expanded, setExpanded] = useState(false);
  const scrollBeforeAction = useRef({ x: 0, y: 0 });
  const reduceMotion = useReducedMotion();
  if (!ready || pathname === "/dashboard") return null;
  const hrefForAction: Record<AuthorityAction, string> = {
    RECORD_COACH_CORRECTION: "/sensei",
    PREPARE_COACH_REVIEW: "/sensei-vision",
    VIEW_COACH_REVIEW: "/sensei-vision",
    OPEN_SENSEI: "/sensei",
    OPEN_VISION: "/sensei-vision",
    ADD_ATHLETE_EVIDENCE: "/sensei-vision",
    SET_PREPARATION_LIMITS: "/fuel",
    RECORD_SESSION_EVIDENCE: "/sensei-vision",
    OPEN_COACH_CONNECTION: "/profile#coach-connection",
  };
  const action = authority.primaryCta;
  const actionPanel = panelForHref(hrefForAction[action.action]);
  const runAction = (opener: HTMLButtonElement) => {
    if (actionPanel) openPanel(actionPanel, opener, scrollBeforeAction.current);
    else if (action.action === "OPEN_COACH_CONNECTION" || action.action === "RECORD_COACH_CORRECTION") {
      closePanel();
      router.push(action.action === "OPEN_COACH_CONNECTION" ? "/profile#coach-connection" : "/dashboard");
    } else {
      closePanel();
      window.dispatchEvent(new CustomEvent("disciplin:dashboard-workflow-open", {
        detail: action.action === "VIEW_COACH_REVIEW" ? "vision_review" : "evidence",
      }));
    }
  };
  return (
    <aside aria-label="Athlete workflow" className="app-nav-surface fixed bottom-[78px] right-3 z-40 w-[min(330px,calc(100vw-24px))] rounded-[18px] p-3 md:bottom-[82px] md:right-4">
      <div className="flex items-center gap-3">
        <button type="button" aria-expanded={expanded} onClick={() => setExpanded(v => !v)} className="min-w-0 flex-1 text-left">
          <span className="app-label block text-emerald-200/65">Today’s workflow</span>
          <span className="mt-1 block truncate text-sm font-medium text-white">{authority.dashboard.status}</span>
        </button>
        <button type="button" onPointerDown={() => { scrollBeforeAction.current = { x: window.scrollX, y: window.scrollY }; }} onMouseDown={(event) => event.preventDefault()} onClick={(event) => { window.scrollTo(scrollBeforeAction.current.x, scrollBeforeAction.current.y); runAction(event.currentTarget); }} className="app-button-primary min-h-9 shrink-0 px-3 text-xs">{action.label}</button>
      </div>
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={reduceMotion ? false : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="mt-3 border-t border-white/10 pt-3 text-xs leading-5 text-white/60">
              <p>{authority.dashboard.body}</p>
              {authority.authorityState === "COACH_APPROVED_MISSION" && workflow.coach && (
                <p className="mt-1 text-emerald-300">Approved by {workflow.coach.name}</p>
              )}
              {process.env.NODE_ENV !== "production" && (
                <details className="mt-3 rounded-xl border border-amber-300/20 bg-amber-300/5 p-2">
                  <summary className="cursor-pointer font-bold text-amber-200">Development state simulator</summary>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {(Object.keys(labels) as WorkflowStatus[]).map(status => <button type="button" key={status} onClick={() => simulate(status)} className="rounded-lg border border-white/10 px-2 py-1 transition duration-150 hover:bg-white/10">{labels[status]}</button>)}
                    <button type="button" onClick={reset} className="rounded-lg border border-white/10 px-2 py-1 transition duration-150 hover:bg-white/10">Reset</button>
                  </div>
                </details>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </aside>
  );
}
