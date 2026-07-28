"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

export type ShellPanel = "vision" | "sensei" | "fuel" | "profile";

type ShellInteractionValue = {
  panel: ShellPanel | null;
  openPanel: (panel: ShellPanel, opener?: HTMLElement | null, scrollPosition?: { x: number; y: number }) => void;
  closePanel: () => void;
  restorePanelFocus: () => void;
  getPanelScrollPosition: () => { x: number; y: number };
};

const ShellInteractionContext = createContext<ShellInteractionValue | null>(null);
const PANEL_PARAM = "panel";
const PANEL_HISTORY_KEY = "__disciplinShellPanel";

function validPanel(value: string | null): ShellPanel | null {
  return value === "vision" || value === "sensei" || value === "fuel" || value === "profile"
    ? value
    : null;
}

export function panelForHref(href: string): ShellPanel | null {
  if (href.startsWith("/sensei-vision")) return "vision";
  if (href.startsWith("/sensei")) return "sensei";
  if (href.startsWith("/fuel")) return "fuel";
  if (href.startsWith("/profile")) return "profile";
  return null;
}

function panelFromLocation() {
  if (typeof window === "undefined") return null;
  return validPanel(new URL(window.location.href).searchParams.get(PANEL_PARAM));
}

export function ShellInteractionProvider({ children }: { children: React.ReactNode }) {
  const searchParams = useSearchParams();
  const [panel, setPanel] = useState<ShellPanel | null>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const panelScrollRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const sync = () => setPanel(panelFromLocation());
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);

  useEffect(() => {
    setPanel(validPanel(searchParams.get(PANEL_PARAM)));
  }, [searchParams]);

  const writePanel = useCallback((next: ShellPanel | null, replace = false) => {
    const url = new URL(window.location.href);
    if (next) url.searchParams.set(PANEL_PARAM, next);
    else url.searchParams.delete(PANEL_PARAM);
    const state = next
      ? { ...(window.history.state || {}), [PANEL_HISTORY_KEY]: true, panel: next }
      : { ...(window.history.state || {}), [PANEL_HISTORY_KEY]: false, panel: null };
    window.history[replace ? "replaceState" : "pushState"](state, "", `${url.pathname}${url.search}${url.hash}`);
    setPanel(next);
  }, []);

  const openPanel = useCallback((next: ShellPanel, opener?: HTMLElement | null, scrollPosition?: { x: number; y: number }) => {
    if (panel === next) return;
    if (!panel) {
      openerRef.current = opener || (document.activeElement as HTMLElement | null);
      panelScrollRef.current = scrollPosition || { x: window.scrollX, y: window.scrollY };
    }
    // Switching modules replaces temporary UI state so Back closes the drawer
    // instead of walking through previously opened panels.
    writePanel(next, panel !== null);
  }, [panel, writePanel]);

  const closePanel = useCallback(() => {
    if (!panelFromLocation()) return;

    if (window.history.state?.[PANEL_HISTORY_KEY] === true) {
      window.history.back();
      return;
    }

    // A refreshed/deep-linked panel has no in-app opener in history. Remove the
    // temporary query state in place and keep the mounted Dashboard untouched.
    writePanel(null, true);
  }, [writePanel]);
  const restorePanelFocus = useCallback(() => {
    const opener = openerRef.current;
    openerRef.current = null;
    if (opener?.isConnected) opener.focus({ preventScroll: true });
  }, []);
  const getPanelScrollPosition = useCallback(() => panelScrollRef.current, []);
  const value = useMemo(() => ({ panel, openPanel, closePanel, restorePanelFocus, getPanelScrollPosition }), [panel, openPanel, closePanel, restorePanelFocus, getPanelScrollPosition]);

  return <ShellInteractionContext.Provider value={value}>{children}</ShellInteractionContext.Provider>;
}

export function useShellInteraction() {
  const value = useContext(ShellInteractionContext);
  if (!value) throw new Error("useShellInteraction must be used inside ShellInteractionProvider");
  return value;
}
