"use client";

import React, { useEffect, useId, useRef } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { ShellPanel } from "./ShellInteractionProvider";
import SenseiVisionClient from "./SenseiVisionClient";
import SenseiClient from "./SenseiClient";
import FuelClient from "./FuelClient";
import ProfileClient from "./ProfileClient";
import { useWorkflow } from "./WorkflowProvider";
import { fuelAuthorityContract } from "@/lib/fuelAuthority";

const meta: Record<ShellPanel, { eyebrow: string; title: string; detail: string }> = {
  vision: { eyebrow: "Observe", title: "Vision evidence", detail: "Add evidence and context without leaving today’s workflow." },
  sensei: { eyebrow: "Practice", title: "Sensei", detail: "Sensei stays inside the coach-approved correction." },
  fuel: { eyebrow: "Prepare", title: "Preparation limits", detail: "Fuel can narrow conditions; it cannot change the mission." },
  profile: {
    eyebrow: "Athlete context",
    title: "Your profile",
    detail: "Your sport, limits, and coaching context.",
  },
};

function PanelContent({ panel }: { panel: ShellPanel }) {
  if (panel === "vision") return <SenseiVisionClient embedded />;
  if (panel === "sensei") return <SenseiClient embedded />;
  if (panel === "fuel") return <FuelClient embedded />;
  return <ProfileClient embedded />;
}

export default function ShellModuleDrawer({ panel, onClose, onRestoreFocus, getScrollPosition }: { panel: ShellPanel | null; onClose: () => void; onRestoreFocus: () => void; getScrollPosition: () => { x: number; y: number } }) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const reduceMotion = useReducedMotion();
  const { authority } = useWorkflow();
  const fuelAuthority = fuelAuthorityContract(authority.authorityState);
  const status = panel === "sensei"
    ? authority.dashboard.status
    : panel === "vision"
      ? authority.visionEvidenceLabel
      : panel === "fuel"
        ? fuelAuthority.headerStatus
        : authority.label;
  const statusDotClass =
    authority.authorityState === "HAS_COACH_PENDING_REVIEW" ||
    authority.authorityState === "COACH_INVITATION_PENDING"
      ? "bg-amber-300/70"
      : authority.authorityState === "COACH_APPROVED_MISSION" ||
          authority.authorityState === "HAS_COACH_NO_MISSION"
        ? "bg-emerald-300/70"
        : "bg-white/35";
  const open = panel !== null;

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    const previousOverflowAnchor = document.documentElement.style.overflowAnchor;
    const previousScrollBehavior = document.documentElement.style.scrollBehavior;
    const { x: scrollX, y: scrollY } = getScrollPosition();
    const restoreScroll = () => {
      document.documentElement.scrollTop = scrollY;
      document.body.scrollTop = scrollY;
      window.scrollTo(scrollX, scrollY);
    };
    window.history.scrollRestoration = "manual";
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    document.documentElement.style.scrollBehavior = "auto";
    document.documentElement.style.overflowAnchor = "none";
    const frame = requestAnimationFrame(() => closeRef.current?.focus());
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;
      const focusable = Array.from(panelRef.current.querySelectorAll<HTMLElement>('button:not([disabled]),a[href],input:not([disabled]),textarea:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])'));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      cancelAnimationFrame(frame);
      document.body.style.overflow = previousOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.documentElement.style.scrollBehavior = previousScrollBehavior;
      document.removeEventListener("keydown", onKeyDown);
      window.requestAnimationFrame(() => {
        onRestoreFocus();
        restoreScroll();
        window.requestAnimationFrame(() => {
          restoreScroll();
        });
        window.setTimeout(() => {
          restoreScroll();
          window.requestAnimationFrame(() => {
            document.documentElement.style.overflowAnchor = previousOverflowAnchor;
          });
        }, reduceMotion ? 0 : 1000);
      });
    };
  }, [open, onClose, onRestoreFocus, getScrollPosition, reduceMotion]);

  return (
    <AnimatePresence>
      {panel ? (
        <div className="fixed inset-0 z-[80] overflow-x-hidden">
          <motion.button type="button" aria-label={`Close ${meta[panel].title} drawer`} onClick={onClose} className="absolute inset-0 h-full w-full bg-black/60 backdrop-blur-[3px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduceMotion ? 0 : 0.2, ease: [0.22, 1, 0.36, 1] }} />
          <motion.section
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            initial={reduceMotion ? false : { opacity: 0, x: 24, scale: 0.995 }}
            animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: 18, scale: 0.997 }}
            transition={{ duration: reduceMotion ? 0 : 0.26, ease: [0.22, 1, 0.36, 1] }}
            className="app-drawer-surface shell-module-drawer absolute bottom-[78px] flex max-h-[calc(100dvh-90px)] flex-col overflow-hidden rounded-[22px] md:inset-y-3 md:bottom-3 md:max-h-none"
          >
            <header className="sticky top-0 z-20 grid shrink-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-white/[0.07] bg-[#080f18]/94 px-4 py-3.5 backdrop-blur-xl md:px-5">
              <div className="min-w-0">
                <p className="app-label text-emerald-200/65">{meta[panel].eyebrow}</p>
                <h2 id={titleId} className="mt-0.5 text-xl font-semibold tracking-[-.02em] text-white">{meta[panel].title}</h2>
                <p className="mt-1 flex items-center gap-2 truncate text-xs font-medium text-white/48">
                  <span className={`h-1.5 w-1.5 rounded-full ${statusDotClass}`} />
                  {status}
                </p>
              </div>
              <button ref={closeRef} type="button" onClick={onClose} aria-label={`Close ${meta[panel].title} and return to Dashboard`} className="app-button-secondary min-h-10 shrink-0 rounded-xl px-3.5"><span aria-hidden="true" className="text-lg font-light leading-none">×</span><span>Close</span></button>
            </header>
            <div data-shell-module={panel} className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-1 py-5 md:px-3">
              <PanelContent panel={panel} />
            </div>
          </motion.section>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
