"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useProfile } from "@/components/ProfileProvider";
import {
  EMPTY_COACH_WORKSPACE,
  type CoachRequestError,
  type CoachWorkspaceState,
} from "@/lib/coach/contracts";

type CoachContextValue = {
  state: CoachWorkspaceState;
  loading: boolean;
  error: CoachRequestError | null;
  refresh: () => Promise<void>;
  announceMutation: () => void;
};

const CoachContext = createContext<CoachContextValue | null>(null);
const COACH_CHANNEL = "disciplin:coach-workspace";

function normalizeState(input: unknown): CoachWorkspaceState {
  const state = (input ?? {}) as Partial<CoachWorkspaceState>;
  return {
    userId: typeof state.userId === "string" ? state.userId : "",
    athleteRelationship: state.athleteRelationship ?? null,
    coachedRelationships: Array.isArray(state.coachedRelationships)
      ? state.coachedRelationships
      : [],
    submissions: Array.isArray(state.submissions) ? state.submissions : [],
    versions: Array.isArray(state.versions) ? state.versions : [],
    currentMission: state.currentMission ?? null,
    auditEvents: Array.isArray(state.auditEvents) ? state.auditEvents : [],
  };
}

export function CoachProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: profileLoading } = useProfile();
  const [state, setState] = useState<CoachWorkspaceState>(EMPTY_COACH_WORKSPACE);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<CoachRequestError | null>(null);
  const activeRequest = useRef(0);
  const resolvedUserId = useRef<string | null>(null);

  const refresh = useCallback(async () => {
    if (!user) {
      resolvedUserId.current = null;
      setState(EMPTY_COACH_WORKSPACE);
      setLoading(false);
      setError(null);
      return;
    }
    const requestId = ++activeRequest.current;
    if (resolvedUserId.current !== user.id) setLoading(true);
    try {
      const response = await fetch("/api/coach/state", {
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      const payload = await response.json().catch(() => null);
      if (requestId !== activeRequest.current) return;
      if (!response.ok || !payload?.ok) {
        setError({
          code:
            payload?.code === "AUTHENTICATION_REQUIRED" ||
            payload?.code === "COACH_SCHEMA_UNAVAILABLE" ||
            payload?.code === "NETWORK_ERROR"
              ? payload.code
              : "COACH_REQUEST_FAILED",
          message: payload?.error || "Coach connection state could not be loaded.",
          retryable: payload?.retryable !== false,
          diagnosticRef:
            typeof payload?.diagnosticRef === "string"
              ? payload.diagnosticRef
              : undefined,
        });
        setLoading(false);
        return;
      }
      setState(normalizeState(payload.state));
      resolvedUserId.current = user.id;
      setError(null);
      setLoading(false);
    } catch {
      if (requestId !== activeRequest.current) return;
      setError({
        code: "NETWORK_ERROR",
        message: "Coach connection state could not be loaded. Check your connection and retry.",
        retryable: true,
      });
      setLoading(false);
    }
  }, [user]);

  const announceMutation = useCallback(() => {
    void refresh();
    if (typeof BroadcastChannel !== "undefined") {
      const channel = new BroadcastChannel(COACH_CHANNEL);
      channel.postMessage({ type: "refresh" });
      channel.close();
    }
  }, [refresh]);

  useEffect(() => {
    if (profileLoading) return;
    queueMicrotask(() => void refresh());
  }, [profileLoading, refresh]);

  useEffect(() => {
    if (
      !user ||
      error?.retryable === false ||
      typeof BroadcastChannel === "undefined"
    ) return;
    const channel = new BroadcastChannel(COACH_CHANNEL);
    channel.onmessage = () => void refresh();
    const onFocus = () => void refresh();
    const onVisibility = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      channel.close();
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [error?.retryable, refresh, user]);

  useEffect(() => {
    if (!user || error?.retryable === false) return;
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 5_000);
    return () => window.clearInterval(interval);
  }, [error?.retryable, refresh, user]);

  const visibleState =
    user && state.userId === user.id ? state : EMPTY_COACH_WORKSPACE;
  const value = useMemo(
    () => ({ state: visibleState, loading, error, refresh, announceMutation }),
    [announceMutation, error, loading, refresh, visibleState],
  );

  return <CoachContext.Provider value={value}>{children}</CoachContext.Provider>;
}

export function useCoach() {
  const context = useContext(CoachContext);
  if (!context) throw new Error("useCoach must be used inside CoachProvider");
  return context;
}
