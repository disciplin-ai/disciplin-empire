"use client";

import React, { useEffect, useId, useRef } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

type DashboardWorkflowDrawerProps = {
  open: boolean;
  eyebrow: string;
  title: string;
  onClose: () => void;
  dismissible?: boolean;
  children: React.ReactNode;
};

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function DashboardWorkflowDrawer({
  open,
  eyebrow,
  title,
  onClose,
  dismissible = true,
  children,
}: DashboardWorkflowDrawerProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;

    restoreFocusRef.current = document.activeElement as HTMLElement | null;
    const frame = window.requestAnimationFrame(() => closeRef.current?.focus());
    const previousOverflow = document.body.style.overflow;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }

      if (event.key !== "Tab" || !panelRef.current) return;
      const focusable = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)
      );
      if (!focusable.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      restoreFocusRef.current?.focus();
    };
  }, [open]);

  const duration = reduceMotion ? 0 : 0.24;

  return (
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-[70]">
          <motion.button
            type="button"
            aria-label="Close workflow"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration }}
            onClick={() => onCloseRef.current()}
            disabled={!dismissible}
            className="absolute inset-0 h-full w-full bg-black/60 backdrop-blur-[3px]"
          />

          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            initial={reduceMotion ? false : { opacity: 0, x: 24, scale: .995 }}
            animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: 18, scale: .997 }}
            transition={{ duration, ease: [0.22, 1, 0.36, 1] }}
            className="app-drawer-surface absolute inset-x-2 bottom-2 max-h-[88vh] overflow-y-auto rounded-[22px] sm:inset-y-3 sm:left-auto sm:right-3 sm:max-h-none sm:w-[min(92vw,460px)]"
          >
            <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-white/[0.065] bg-[#080f18]/94 px-4 py-3.5 backdrop-blur-xl sm:px-5">
              <div>
                <p className="app-label">
                  {eyebrow}
                </p>
                <h2 id={titleId} className="mt-1 text-xl font-semibold tracking-[-.02em] text-white">
                  {title}
                </h2>
              </div>
              <button
                ref={closeRef}
                type="button"
                onClick={() => onCloseRef.current()}
                disabled={!dismissible}
                aria-label="Close"
                className="app-button-secondary h-10 min-h-10 w-10 shrink-0 px-0 text-xl font-light disabled:cursor-wait disabled:opacity-30"
              >
                &times;
              </button>
            </div>

            <div className="px-4 py-5 sm:px-5">{children}</div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
