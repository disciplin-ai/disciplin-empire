"use client";

import React, { useMemo, useRef, useState } from "react";
import SenseiScreen, {
  AskSectionId,
  BaseArt,
  CampModel,
  CampSectionKey,
  ChatMessage,
  FocusKey,
  IntegrationMode,
  LoadingStage,
  SectionBlock,
} from "@/components/SenseiScreen";

const SENSEI_ENDPOINT = "/api/sensei";

function uid() {
  return Math.random().toString(36).slice(2);
}

function cleanLine(x: string) {
  return String(x ?? "").replace(/^\s*[-•]\s*/, "").trim();
}

function formatSenseiReply(raw: string): string {
  const t = String(raw ?? "").trim();
  if (!t) return t;
  if (t.includes("\n- ") || t.startsWith("- ") || t.includes("• ")) return t;
  try {
    const obj = JSON.parse(t);
    if (typeof obj?.reply === "string") return String(obj.reply).trim();
  } catch {}
  return t;
}

function chatSectionToBackend(section: AskSectionId): Exclude<AskSectionId, "all"> {
  if (section === "all") return "training";
  return section;
}

function buildScenario(input: {
  focus: FocusKey;
  primaryArt: BaseArt;
  secondaryArt: BaseArt | "None";
  integrationMode: IntegrationMode;
  goal: string;
  injuries: string;
  timeAvailable: string;
  constraints: string;
}) {
  const sec = input.secondaryArt === "None" ? "None" : input.secondaryArt;
  const integrateLine =
    input.integrationMode === "INTEGRATE"
      ? "INTEGRATION: INTEGRATE NOW (blend primary + secondary/MMA context where relevant)."
      : "INTEGRATION: SEPARATE (train the chosen base cleanly; no blending unless asked).";

  return [
    `FOCUS: ${input.focus}`,
    `PRIMARY BASE: ${input.primaryArt}`,
    `SECONDARY BASE: ${sec}`,
    integrateLine,
    `GOAL: ${input.goal || "N/A"}`,
    `TIME AVAILABLE: ${input.timeAvailable || "N/A"}`,
    `INJURIES / LIMITATIONS: ${input.injuries || "None stated"}`,
    `CONSTRAINTS / EQUIPMENT: ${input.constraints || "N/A"}`,
    "",
    "OUTPUT RULES:",
    "- Give an executable session plan, not motivation.",
    "- Use short blocks + bullets. No essays.",
    "- Include 1 bullet starting with 'Cost:' (what this flaw costs in a fight).",
    "- Include safety limits based on injuries and constraints.",
    "- Make it usable for both: serious beginners and advanced competitors.",
  ].join("\n");
}

type ApiBlock = { title?: string; label?: string; bullets?: string[] };

type PlanResponse =
  | {
      ok: true;
      followups_id?: string;
      weekLabel?: string;
      intensityTag?: "LOW" | "MODERATE" | "HIGH" | "MAX";
      overview?: ApiBlock[];
      training?: ApiBlock[];
      recovery?: ApiBlock[];
      nutrition?: ApiBlock[];
      questions?: ApiBlock[];
    }
  | { ok: false; error: string };

type AskResponse = { ok: true; reply: string } | { ok: false; error: string };

function toCampModel(resp: Extract<PlanResponse, { ok: true }>): CampModel {
  const sectionsMap: Record<CampSectionKey, SectionBlock[]> = {
    Overview: [],
    Training: [],
    Nutrition: [],
    Recovery: [],
    Questions: [],
  };

  const direct = {
    Overview: resp.overview ?? [],
    Training: resp.training ?? [],
    Nutrition: resp.nutrition ?? [],
    Recovery: resp.recovery ?? [],
    Questions: resp.questions ?? [],
  };

  (Object.keys(direct) as CampSectionKey[]).forEach((k) => {
    const blocks = direct[k] ?? [];
    for (const b of blocks) {
      const bullets = (b?.bullets ?? []).map((x) => cleanLine(String(x))).filter(Boolean);
      if (!bullets.length) continue;
      sectionsMap[k].push({
        title: String(b?.title ?? b?.label ?? k),
        bullets,
      });
    }
  });

  return {
    campName: "Sensei Plan",
    weekLabel: (resp.weekLabel || "Today").trim(),
    intensityTag: resp.intensityTag || "MODERATE",
    days: [],
    sections: sectionsMap,
  };
}

export default function SenseiClient() {
  const [focus, setFocus] = useState<FocusKey>("Speed");
  const [primaryArt, setPrimaryArt] = useState<BaseArt>("MMA");
  const [secondaryArt, setSecondaryArt] = useState<BaseArt | "None">("None");
  const [integrationMode, setIntegrationMode] = useState<IntegrationMode>("SEPARATE");

  const [goal, setGoal] = useState("");
  const [injuries, setInjuries] = useState("");
  const [timeAvailable, setTimeAvailable] = useState("");
  const [constraints, setConstraints] = useState("");

  const [loading, setLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState<LoadingStage>("IDLE");

  const [model, setModel] = useState<CampModel | null>(null);
  const [followupsId, setFollowupsId] = useState<string | null>(null);

  const [activeChatSection, setActiveChatSection] = useState<AskSectionId>("all");
  const [chatInput, setChatInput] = useState<string>("");
  const [chatSending, setChatSending] = useState(false);

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: uid(),
      role: "system",
      section: "all",
      text: "Build a session once to create context. Then ask anything. Short answers. Concrete steps.",
      ts: Date.now(),
    },
  ]);

  const abortRef = useRef<AbortController | null>(null);
  const lastContextRef = useRef<string>("");

  const canGenerate = useMemo(() => goal.trim().length >= 8 && !loading, [goal, loading]);

  function onReset() {
    abortRef.current?.abort();
    abortRef.current = null;

    setGoal("");
    setInjuries("");
    setTimeAvailable("");
    setConstraints("");
    setModel(null);
    setFollowupsId(null);

    setActiveChatSection("all");
    setChatInput("");
    setChatSending(false);
    setChatMessages([
      {
        id: uid(),
        role: "system",
        section: "all",
        text: "Build a session once to create context. Then ask anything. Short answers. Concrete steps.",
        ts: Date.now(),
      },
    ]);

    setLoading(false);
    setLoadingStage("IDLE");
    lastContextRef.current = "";
  }

  async function onGenerate() {
    if (!canGenerate) return;

    abortRef.current?.abort();
    abortRef.current = new AbortController();

    setLoading(true);

    try {
      setLoadingStage("BUILDING_SCENARIO");
      await new Promise((r) => setTimeout(r, 220));

      const scenario = buildScenario({
        focus,
        primaryArt,
        secondaryArt,
        integrationMode,
        goal,
        injuries,
        timeAvailable,
        constraints,
      });

      lastContextRef.current = scenario;

      setLoadingStage("SENDING_REQUEST");
      await new Promise((r) => setTimeout(r, 180));

      const res = await fetch(SENSEI_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: abortRef.current.signal,
        body: JSON.stringify({
          mode: "plan",
          week: "Today",
          context: scenario,
          followups_id: followupsId ?? undefined,
        }),
      });

      setLoadingStage("WAITING_OPENAI");

      const data: PlanResponse = await res.json().catch(() => ({
        ok: false,
        error: "Bad JSON from backend",
      }));

      setLoadingStage("PARSING_RESPONSE");
      await new Promise((r) => setTimeout(r, 180));

      if (!data.ok) {
        setLoadingStage("ERROR");
        setChatMessages((prev) => [
          ...prev,
          { id: uid(), role: "system", section: "all", text: `Plan error: ${data.error}`, ts: Date.now() },
        ]);
        return;
      }

      const newFollowups = (data as any).followups_id || followupsId || null;
      if (newFollowups) setFollowupsId(newFollowups);

      setModel(toCampModel(data));

      setChatMessages((prev) => [
        ...prev,
        {
          id: uid(),
          role: "system",
          section: "all",
          text: `Context updated. Primary: ${primaryArt}${secondaryArt !== "None" ? ` + Secondary: ${secondaryArt}` : ""}. Integration: ${integrationMode}.`,
          ts: Date.now(),
        },
      ]);

      setLoadingStage("DONE");
    } catch (e: any) {
      if (e?.name === "AbortError") setLoadingStage("IDLE");
      else {
        setLoadingStage("ERROR");
        setChatMessages((prev) => [
          ...prev,
          { id: uid(), role: "system", section: "all", text: "Plan request failed.", ts: Date.now() },
        ]);
      }
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  }

  async function onSendChat() {
    const text = (chatInput ?? "").trim();
    if (!text) return;

    const section = activeChatSection;

    setChatMessages((prev) => [...prev, { id: uid(), role: "user", section, text, ts: Date.now() }]);
    setChatInput("");
    setChatSending(true);

    if (!followupsId) {
      setChatMessages((prev) => [
        ...prev,
        { id: uid(), role: "system", section, text: "Build a session first to unlock chat context.", ts: Date.now() },
      ]);
      setChatSending(false);
      return;
    }

    try {
      const backendSection = chatSectionToBackend(section);
      const q = section === "all" ? `ALL: ${text}` : text;

      const res = await fetch(SENSEI_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "ask",
          followups_id: followupsId,
          section_id: backendSection,
          question: q,
          week: "Today",
          context: lastContextRef.current || undefined,
        }),
      });

      const data: AskResponse = await res.json().catch(() => ({
        ok: false,
        error: "Bad JSON from backend",
      }));

      if (!data.ok) {
        setChatMessages((prev) => [
          ...prev,
          { id: uid(), role: "system", section, text: `Ask error: ${data.error}`, ts: Date.now() },
        ]);
        return;
      }

      setChatMessages((prev) => [
        ...prev,
        { id: uid(), role: "sensei", section, text: formatSenseiReply(data.reply), ts: Date.now() },
      ]);
    } catch {
      setChatMessages((prev) => [
        ...prev,
        { id: uid(), role: "system", section, text: "Ask request failed.", ts: Date.now() },
      ]);
    } finally {
      setChatSending(false);
    }
  }

  function onChatKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!chatSending) onSendChat();
    }
  }

  return (
    <SenseiScreen
      focus={focus}
      setFocus={setFocus}
      primaryArt={primaryArt}
      setPrimaryArt={setPrimaryArt}
      secondaryArt={secondaryArt}
      setSecondaryArt={setSecondaryArt}
      integrationMode={integrationMode}
      setIntegrationMode={setIntegrationMode}
      goal={goal}
      setGoal={setGoal}
      constraints={constraints}
      setConstraints={setConstraints}
      injuries={injuries}
      setInjuries={setInjuries}
      timeAvailable={timeAvailable}
      setTimeAvailable={setTimeAvailable}
      loading={loading}
      loadingStage={loadingStage}
      canGenerate={canGenerate}
      onGenerate={onGenerate}
      onReset={onReset}
      model={model}
      followupsId={followupsId}
      activeChatSection={activeChatSection}
      setActiveChatSection={setActiveChatSection}
      chatInput={chatInput}
      setChatInput={setChatInput}
      chatSending={chatSending}
      chatMessages={chatMessages}
      onSendChat={onSendChat}
      onChatKeyDown={onChatKeyDown}
    />
  );
}