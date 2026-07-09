"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import SenseiScreen from "./SenseiScreen";

import {
  getLockState,
  isAdvancedPrompt,
  normalizeDirectiveProgress,
  resetProgressForDirective,
  type DirectiveProgress,
} from "@/lib/disciplin/types";

import {
  buildPressureDisciplineCard,
  defaultPressureDisciplineCard,
  type PressureDisciplineCard,
} from "@/lib/disciplin/pressureDiscipline";

export type MessageSection =
  | "all"
  | "overview"
  | "training"
  | "nutrition"
  | "recovery"
  | "decisions";

export type ChatMessage = {
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

export type SenseiGym = {
  id: string;
  name: string;
  location: string;
  compatibility: number;
  disciplineMatch: string[];
  styleMatch: string[];
  watchOut: string[];
  href?: string;
  verified: boolean;
};

export type SenseiConnected = {
  vision?: {
    present?: boolean;
    correction?: string;
    severity?: string;
    fix_next_rep?: string;
  };
  fuel?: {
    present?: boolean;
    score?: number;
    rating?: string;
    decision?: string;
  };
  psychology?: {
    present?: boolean;
    summary?: string;
    commandStyle?: string;
  };
  profile?: {
    present?: boolean;
    baseArt?: string;
    paceStyle?: string;
    weaknesses?: string;
    primaryStyle?: string;
    aGame?: string;
    winCondition?: string;
    preferredPositions?: string;
    bestAttacks?: string;
    currentGameplan?: string;
    commonEmotionalTriggers?: string;
  };
  gyms?: SenseiGym[];
};

type SenseiSessionState = {
  lastDecision?: string;
  lastCommand?: string;
  lastWhy?: string;
  lastUpdated?: string;
  awaitingPsychologyAnswer?: boolean;
  psychologyTopic?: string;
  previousQuestion?: string;
};

const SENSEI_STATE_KEY = "disciplin_sensei_state_v2";
const DIRECTIVE_PROGRESS_KEY = "disciplin_directive_progress";
const VISION_DIRECTIVE_KEY = "disciplin_vision_directive";
const LATEST_VISION_KEY = "disciplin_latest_vision";
const SENSEI_GYMS_KEY = "disciplin_connected_gyms";
const LATEST_FUEL_KEY = "disciplin_latest_fuel";
const PRESSURE_CARD_KEY = "disciplin_pressure_card_v1";

const MIN_SENSEI_DELAY_MS = 1750;
const LOCK_DELAY_MS = 900;

function safeReadJson<T>(key: string): T | null {
  try {
    if (typeof window === "undefined") return null;
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeJson<T>(key: string, value: T) {
  try {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function holdPremiumDelay(startedAt: number, minMs = MIN_SENSEI_DELAY_MS) {
  const elapsed = Date.now() - startedAt;
  if (elapsed < minMs) await sleep(minMs - elapsed);
}

function makeId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function cleanInput(input: unknown) {
  return String(input ?? "").replace(/\s+/g, " ").trim();
}

function cleanMultiline(input: unknown) {
  return String(input ?? "")
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function hasWord(text: string, word: string) {
  return new RegExp(`\\b${word}\\b`, "i").test(text);
}

function wantsGymDecision(q: string) {
  return (
    hasWord(q, "gym") ||
    hasWord(q, "gyms") ||
    q.includes("which gym") ||
    q.includes("pick a gym") ||
    q.includes("choose a gym") ||
    q.includes("where should i train") ||
    q.includes("where do i train")
  );
}

function wantsUnlockDecision(q: string) {
  return (
    q.includes("move to the next correction") ||
    q.includes("move on to the next correction") ||
    q.includes("next correction") ||
    q.includes("can i move on") ||
    q.includes("can i advance") ||
    q.includes("unlock") ||
    q.includes("progress to")
  );
}

function inferSectionFromText(text: string): MessageSection {
  const q = text.toLowerCase().trim();
  const has = (...terms: string[]) => terms.some((term) => q.includes(term));

  if (
    has(
      "taunt",
      "taunts",
      "taunted",
      "trash talk",
      "trash talked",
      "ego",
      "panic",
      "panicked",
      "rush",
      "rushing",
      "rushed",
      "angry",
      "emotion",
      "emotional",
      "desperate",
      "revenge",
      "embarrassed",
      "mocked",
      "pressure",
      "tilt",
      "frustrated",
      "nervous",
      "fear",
      "prove myself",
      "wanted to prove",
      "makes me rush",
      "so i rush",
      "got desperate",
      "abandoned my",
      "abandon my",
      "lost composure",
      "lost discipline"
    )
  ) {
    return "decisions";
  }

  if (
    has(
      "nutrition",
      "fuel",
      "meal",
      "food",
      "protein",
      "carb",
      "carbs",
      "calories",
      "hydration",
      "diet",
      "bulk",
      "shawarma",
      "burger",
      "fries",
      "junk food"
    )
  ) {
    return "nutrition";
  }

  if (
    has(
      "recovery",
      "sleep",
      "rest",
      "fatigue",
      "sore",
      "injury",
      "pain",
      "drained",
      "exhausted",
      "burnout",
      "overtrained",
      "tired",
      "mobility",
      "stiff"
    )
  ) {
    return "recovery";
  }

  if (wantsGymDecision(q) || wantsUnlockDecision(q)) {
    return "decisions";
  }

  if (
    has(
      "training",
      "train",
      "drill",
      "rep",
      "stance",
      "shot",
      "double leg",
      "single leg",
      "takedown",
      "takedowns",
      "wrestling",
      "boxing",
      "grappling",
      "spar",
      "jab",
      "kick",
      "guard",
      "scramble",
      "underhook",
      "hips",
      "entry",
      "technique",
      "mechanics",
      "footwork",
    "overtraining",
"training load",
"lower body",
"wrestling",
"same day",
"too much volume",
    )
  ) {
    return "training";
  }

  if (has("overview", "summary", "big picture", "roadmap", "system")) {
    return "overview";
  }

  return "decisions";
}

function defaultConnected(): SenseiConnected {
  return {
    vision: {
      present: false,
      correction: "",
      severity: "",
      fix_next_rep: "",
    },
    fuel: {
      present: false,
      score: 0,
      rating: "",
      decision: "",
    },
    psychology: {
      present: false,
      summary: "",
      commandStyle: "",
    },
    profile: {
      present: false,
      baseArt: "",
      paceStyle: "",
      weaknesses: "",
    },
    gyms: [],
  };
}

function defaultSessionState(): SenseiSessionState {
  return {
    lastDecision: "",
    lastCommand: "",
    lastWhy: "",
    lastUpdated: "",
  };
}

function extractConnectedGyms(): SenseiGym[] {
  const gyms = safeReadJson<SenseiGym[]>(SENSEI_GYMS_KEY);
  return Array.isArray(gyms) ? gyms : [];
}

function extractFuelMemory(): SenseiConnected["fuel"] {
  const fuel = safeReadJson<{
    present?: boolean;
    score?: number;
    rating?: string;
    decision?: string;
  }>(LATEST_FUEL_KEY);

  if (!fuel) return defaultConnected().fuel;

  return {
    present: true,
    score: typeof fuel.score === "number" ? fuel.score : 0,
    rating: cleanInput(fuel.rating),
    decision: cleanInput(fuel.decision),
  };
}

function extractVisionDirective(): SenseiConnected["vision"] {
  const direct = safeReadJson<{
    correction?: string;
    severity?: string;
    fix_next_rep?: string;
  }>(VISION_DIRECTIVE_KEY);

  const correction = cleanInput(direct?.correction);

  if (correction) {
    return {
      present: true,
      correction,
      severity: cleanInput(direct?.severity) || "HIGH",
      fix_next_rep: cleanMultiline(direct?.fix_next_rep),
    };
  }

  const latest = safeReadJson<any>(LATEST_VISION_KEY);
  const finding = Array.isArray(latest?.findings) ? latest.findings[0] : null;
  const title = cleanInput(finding?.title);

  if (!title) return defaultConnected().vision;

  return {
    present: true,
    correction: title,
    severity: cleanInput(finding?.severity) || "HIGH",
    fix_next_rep: cleanMultiline(finding?.fix_next_rep),
  };
}

function frontendFallbackAnswer() {
  return [
    "Decision: The answer did not come through clean.",
    "",
    "Why: The route returned no usable response.",
    "",
    "What this fixes: It prevents silent failure.",
    "",
    "If ignored: Broken responses destroy trust.",
    "",
    "Instruction: Ask again directly.",
  ].join("\n");
}

function timeoutAnswer() {
  return [
    "Decision: The answer took too long.",
    "",
    "Why: Sensei timed out before returning a clean call.",
    "",
    "What this fixes: It prevents the screen from hanging.",
    "",
    "If ignored: The user loses trust.",
    "",
    "Instruction: Retry the same question.",
  ].join("\n");
}

export default function SenseiClient() {
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [pendingQuestion, setPendingQuestion] = useState("");
  const [busy, setBusy] = useState(false);

  const [connected, setConnected] =
    useState<SenseiConnected>(defaultConnected());

  const [decisionMode, setDecisionMode] = useState<"STRICT" | "FALLBACK">(
    "FALLBACK"
  );

  const [activeDirective, setActiveDirective] = useState("");
  const [sessionState, setSessionState] =
    useState<SenseiSessionState>(defaultSessionState());

  const [pressureCard, setPressureCard] =
    useState<PressureDisciplineCard>(defaultPressureDisciplineCard());

  const [directiveProgress, setDirectiveProgress] =
    useState<DirectiveProgress>(() =>
      normalizeDirectiveProgress(
        safeReadJson<Partial<DirectiveProgress>>(DIRECTIVE_PROGRESS_KEY) || {}
      )
    );

  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const saved = safeReadJson<{
      chatMessages?: ChatMessage[];
      connected?: SenseiConnected;
      decisionMode?: "STRICT" | "FALLBACK";
      activeDirective?: string;
      sessionState?: SenseiSessionState;
    }>(SENSEI_STATE_KEY);

    if (saved?.chatMessages) setChatMessages(saved.chatMessages);
    if (saved?.connected) setConnected(saved.connected);
    if (saved?.decisionMode) setDecisionMode(saved.decisionMode);
    if (saved?.activeDirective) setActiveDirective(saved.activeDirective);
    if (saved?.sessionState) setSessionState(saved.sessionState);

    const vision = extractVisionDirective();
    const fuel = extractFuelMemory();
    const gyms = extractConnectedGyms();

    setConnected((prev) => ({
      ...prev,
      vision,
      fuel,
      gyms,
    }));

    if (!saved?.activeDirective && vision?.correction) {
      setActiveDirective(vision.correction);
    }

    const savedPressure = safeReadJson<PressureDisciplineCard>(PRESSURE_CARD_KEY);
    if (savedPressure) setPressureCard(savedPressure);
  }, []);

  useEffect(() => {
    writeJson(SENSEI_STATE_KEY, {
      chatMessages: chatMessages.filter((m) => !m.pending),
      connected,
      decisionMode,
      activeDirective,
      sessionState,
    });
  }, [chatMessages, connected, decisionMode, activeDirective, sessionState]);

  useEffect(() => {
    writeJson(DIRECTIVE_PROGRESS_KEY, directiveProgress);
  }, [directiveProgress]);

  useEffect(() => {
    writeJson(PRESSURE_CARD_KEY, pressureCard);
  }, [pressureCard]);

  const rawLockState = useMemo(() => {
    return getLockState({
      directive: {
        present: !!activeDirective,
        correction: activeDirective,
      },
      progress: directiveProgress,
      fuel: connected.fuel,
    });
  }, [activeDirective, directiveProgress, connected.fuel]);

  const screenLockState = {
    hasDirective: !!activeDirective,
    verified: rawLockState?.verified === true,
    locked: rawLockState?.locked === true,
    reason:
      rawLockState?.verified === true
        ? ("unlocked" as const)
        : activeDirective
          ? ("directive_unverified" as const)
          : ("no_directive" as const),
    userMessage:
      typeof rawLockState?.userMessage === "string"
        ? rawLockState.userMessage
        : "One correction controls the session.",
  };

  async function sendQuestion(rawQuestion: string) {
    const question = cleanMultiline(rawQuestion);
    if (!question || busy) return;

    const startedAt = Date.now();
    const section = inferSectionFromText(question);

    const userMessage: ChatMessage = {
      id: makeId("user"),
      role: "user",
      text: question,
      section,
    };

    const pendingId = makeId("sensei_pending");

    const pendingMessage: ChatMessage = {
      id: pendingId,
      role: "sensei",
      text: "Sensei is thinking.",
      pending: true,
      section,
    };

    setBusy(true);
    setPendingQuestion(question);
    setChatMessages((prev) => [...prev, userMessage, pendingMessage]);

    const pressure = buildPressureDisciplineCard({
      userMessage: question,
      activeDirective,
      latestVisionCorrection: connected.vision?.correction || "",
      underResistance: directiveProgress.underResistance === true,
      proofVerified: rawLockState?.verified === true,
      repeatedFailureCount: Number(directiveProgress.repsCompleted || 0),
    });

    setPressureCard(pressure);

    if (isAdvancedPrompt(question) && screenLockState.locked) {
      await holdPremiumDelay(startedAt, LOCK_DELAY_MS);

      setChatMessages((prev) =>
        prev.map((msg) =>
          msg.id === pendingId
            ? {
                ...msg,
                pending: false,
                text: screenLockState.userMessage,
              }
            : msg
        )
      );

      setBusy(false);
      setPendingQuestion("");
      return;
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20000);

      const res = await fetch("/api/sensei", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        signal: controller.signal,
        body: JSON.stringify({
          message: question,
          question,
          section,
          activeDirective,
          connected,
          pressureCard: pressure,
          session: sessionState,
          directiveProgress,
          deliveryMode: inferDeliveryMode(question),
        }),
      });

      clearTimeout(timeout);

      const data = await res.json().catch(() => null);

      await holdPremiumDelay(startedAt);

      const answer = cleanMultiline(data?.answer) || frontendFallbackAnswer();
      const nextDirective =
        cleanInput(data?.connected?.vision?.correction) || activeDirective;
      const nextDecision =
        cleanInput(data?.operatingDecision?.sessionGoal) ||
        cleanInput(data?.session?.lastCommand) ||
        answer.split("\n")[0]?.replace(/^Decision:\s*/i, "") ||
        "";
      const psychologyTrigger =
        cleanInput(data?.session?.psychologyTopic) ||
        cleanInput(data?.pressureLeak);
      const gameplanFocus =
        cleanInput(data?.connected?.profile?.currentGameplan) ||
        cleanInput(data?.connected?.profile?.aGame) ||
        cleanInput(data?.connected?.profile?.winCondition);

      setChatMessages((prev) =>
        prev.map((msg) =>
          msg.id === pendingId
            ? {
                id: makeId("sensei"),
                role: "sensei",
                text: answer,
                section,
                deliveryMode: inferDeliveryMode(question),
                responseMode: cleanInput(data?.responseMode),
                stateUpdate: {
                  psychologicalTrigger,
                  gameplanFocus,
                  activeCorrection: nextDirective,
                  nextDecision,
                  proofStatus: proofStatusFromResponse(data),
                },
              }
            : msg
        )
      );

      if (data?.connected) {
        setConnected((prev) => ({
          ...prev,
          ...data.connected,
          psychology: {
            ...prev.psychology,
            ...data.connected.psychology,
            ...(psychologyTrigger
              ? {
                  present: true,
                  summary: psychologyTrigger,
                }
              : {}),
          },
        }));
      }

      if (data?.mode === "STRICT" || data?.mode === "ENFORCEMENT") {
        setDecisionMode("STRICT");
      }

      if (data?.mode === "FALLBACK") {
        setDecisionMode("FALLBACK");
      }

      if (data?.directiveState) {
        setDirectiveProgress(normalizeDirectiveProgress(data.directiveState));
      }

      if (data?.pressureCard) {
        setPressureCard(data.pressureCard);
      }

      if (nextDirective && nextDirective !== activeDirective) {
        setActiveDirective(nextDirective);
        setDirectiveProgress(resetProgressForDirective(nextDirective));
      }

      setSessionState((prev) => ({
        ...prev,
        ...(data?.session || {}),
        lastDecision: nextDecision,
        lastCommand: cleanInput(data?.session?.lastCommand),
        lastWhy: cleanInput(data?.session?.lastWhy),
        lastUpdated: new Date().toISOString(),
      }));
    } catch (err: any) {
      await holdPremiumDelay(startedAt, LOCK_DELAY_MS);

      setChatMessages((prev) =>
        prev.map((msg) =>
          msg.id === pendingId
            ? {
                id: makeId("sensei_error"),
                role: "sensei",
                text:
                  err?.name === "AbortError"
                    ? timeoutAnswer()
                    : frontendFallbackAnswer(),
                section,
              }
            : msg
        )
      );
    } finally {
      setBusy(false);
      setPendingQuestion("");
      inputRef.current?.focus();
    }
  }

  function onSendChat() {
    const next = cleanMultiline(chatInput);
    if (!next || busy) return;

    setChatInput("");
    void sendQuestion(next);
  }

  function onChatKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSendChat();
    }
  }

  return (
    <SenseiScreen
      chatMessages={chatMessages}
      chatInput={chatInput}
      setChatInput={setChatInput}
      onSendChat={onSendChat}
      busy={busy}
      pendingQuestion={pendingQuestion}
      inputRef={inputRef}
      onChatKeyDown={onChatKeyDown}
      connected={connected}
      decisionMode={decisionMode}
      directiveProgress={directiveProgress}
      lockState={screenLockState}
      pressureCard={pressureCard}
    />
  );
}

function inferDeliveryMode(question: string): "analysis" | "coaching" {
  const q = question.toLowerCase();
  return /\b(why|how did|what caused|what happened|review|film|analyse|analyze|understand)\b/.test(
    q
  )
    ? "analysis"
    : "coaching";
}

function proofStatusFromResponse(data: {
  directiveState?: {
    repsCompleted?: number;
    repsRequired?: number;
    underResistance?: boolean;
  };
}) {
  const state = data.directiveState;
  if (!state) return "";

  const completed = Number(state.repsCompleted || 0);
  const required = Number(state.repsRequired || 0);
  if (required <= 0) return "";
  if (completed >= required && state.underResistance === true) return "Earned";
  return `${completed} of ${required} clean reps`;
}
