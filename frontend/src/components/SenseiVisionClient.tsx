"use client";

import React, { useEffect, useMemo, useState } from "react";
import SenseiVisionScreen from "@/components/SenseiVisionScreen";
import type { VisionAnalysis } from "@/lib/senseiVisionTypes";

export type VisionBuildStage =
  | "IDLE"
  | "UPLOADING_FRAME"
  | "READING_FRAME"
  | "BUILDING_CORRECTION"
  | "DONE"
  | "ERROR";

export type VisionChatMessage = {
  id: string;
  role: "system" | "user" | "vision";
  text: string;
  ts: number;
};

type VisionApiSuccess = {
  ok: true;
  analysis: VisionAnalysis;
};

type VisionApiError = {
  ok: false;
  error: string;
};

type VisionApiResponse = VisionApiSuccess | VisionApiError;

function uid() {
  return Math.random().toString(36).slice(2);
}

function cleanText(text?: string | null) {
  return String(text || "").replace(/\s+/g, " ").trim();
}

function compact(text?: string | null, max = 220) {
  const value = cleanText(text);
  if (!value) return "";
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1).trim()}…`;
}

function firstSentence(text?: string | null) {
  const value = cleanText(text);
  if (!value) return "";
  const match = value.match(/^.*?[.!?](\s|$)/);
  return match ? match[0].trim() : value;
}

function normalizeVisionAnalysis(analysis: VisionAnalysis): VisionAnalysis {
  const findings = Array.isArray((analysis as any)?.findings)
    ? (analysis as any).findings.map((f: any) => ({
        ...f,
        title: cleanText(f?.title),
        severity: cleanText(f?.severity || "MEDIUM").toUpperCase(),
        interrupt: cleanText(f?.interrupt),
        fix_next_rep: cleanText(f?.fix_next_rep),
        good: cleanText(f?.good),
        unstable: cleanText(f?.unstable),
        break_point: cleanText(f?.break_point),
        dashboard_detail: cleanText(f?.dashboard_detail),
        if_ignored: cleanText(f?.if_ignored),
        short_detail: cleanText(f?.short_detail),
        detail: cleanText(f?.detail),
        train: Array.isArray(f?.train)
          ? f.train.map((item: unknown) => cleanText(String(item))).filter(Boolean)
          : [],
      }))
    : [];

  return {
    ...(analysis as any),
    clipLabel: cleanText((analysis as any)?.clipLabel || "Frame upload"),
    summary: cleanText((analysis as any)?.summary),
    findings,
  } as VisionAnalysis;
}

function buildVisionContext(analysis: VisionAnalysis | null) {
  if (!analysis) return "No current frame analysis loaded.";

  const findings = Array.isArray((analysis as any)?.findings)
    ? ((analysis as any).findings as any[])
    : [];

  const top = findings[0];

  const parts: string[] = [
    `Clip label: ${cleanText((analysis as any)?.clipLabel || "Unknown")}`,
    `Summary: ${cleanText((analysis as any)?.summary || "None")}`,
  ];

  if (top) {
    parts.push(`Primary correction: ${cleanText(top.title || "Unknown")}`);
    parts.push(`Severity: ${cleanText(top.severity || "Unknown")}`);
    parts.push(`Interrupt: ${cleanText(top.interrupt || "None")}`);
    parts.push(`Fix next rep: ${cleanText(top.fix_next_rep || "None")}`);
    parts.push(`Good: ${cleanText(top.good || "None")}`);
    parts.push(`Unstable: ${cleanText(top.unstable || "None")}`);
    parts.push(`Break point: ${cleanText(top.break_point || "None")}`);
    parts.push(`If ignored: ${cleanText(top.if_ignored || "None")}`);
    parts.push(`Detail: ${cleanText(top.detail || top.dashboard_detail || "None")}`);
  }

  return parts.join("\n");
}

function formatVisionChatReply(raw: string) {
  const clean = cleanText(raw);
  if (!clean) return "Vision returned no usable answer.";
  return compact(clean, 320);
}

export default function SenseiVisionClient() {
  const [sport, setSport] = useState("Wrestling");
  const [clipLabel, setClipLabel] = useState("Frame upload");
  const [notes, setNotes] = useState(
    "Whenever I try to do a Russian tie snap, I always get sprawled on"
  );

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedFileName, setSelectedFileName] = useState("");

  const [running, setRunning] = useState(false);
  const [buildStage, setBuildStage] = useState<VisionBuildStage>("IDLE");
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<VisionAnalysis | null>(null);

  const [chatInput, setChatInput] = useState("");
  const [chatSending, setChatSending] = useState(false);
  const [chatMessages, setChatMessages] = useState<VisionChatMessage[]>([
    {
      id: uid(),
      role: "system",
      text: "Vision only answers questions tied to the active frame and correction.",
      ts: Date.now(),
    },
  ]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("disciplin_latest_vision");
      if (!raw) return;
      const parsed = JSON.parse(raw) as VisionAnalysis;
      setAnalysis(normalizeVisionAnalysis(parsed));
    } catch {
      // ignore bad local storage
    }
  }, []);

  const quickPrompts = useMemo(
    () => [
      "What exactly is breaking first?",
      "What should I keep doing?",
      "What is the smallest fix next rep?",
      "What happens if I ignore this?",
      "What should I train today from this frame?",
    ],
    []
  );

  function pushSystemMessage(text: string) {
    setChatMessages((prev) => [
      ...prev,
      {
        id: uid(),
        role: "system",
        text,
        ts: Date.now(),
      },
    ]);
  }

  function onFileChange(file: File | null) {
    setSelectedFile(file);
    setSelectedFileName(file?.name || "");
    setError(null);
  }

  function onReset() {
    setSelectedFile(null);
    setSelectedFileName("");
    setRunning(false);
    setBuildStage("IDLE");
    setError(null);
    setAnalysis(null);
    setChatInput("");
    setChatSending(false);
    setChatMessages([
      {
        id: uid(),
        role: "system",
        text: "Vision reset. Upload a new frame to build a correction.",
        ts: Date.now(),
      },
    ]);
    localStorage.removeItem("disciplin_latest_vision");
  }

  async function onAnalyze() {
    if (!selectedFile) {
      setError("Choose one frame image first.");
      return;
    }

    setRunning(true);
    setBuildStage("UPLOADING_FRAME");
    setError(null);

    try {
      const fileToBase64 = (file: File) =>
        new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const result = String(reader.result || "");
            const base64 = result.includes(",") ? result.split(",")[1] : result;
            resolve(base64);
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

      const imageBase64 = await fileToBase64(selectedFile);

      setBuildStage("READING_FRAME");

      const res = await fetch("/api/sensei-vision", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          imageBase64,
          mimeType: selectedFile.type || "image/png",
          clipLabel,
          context: notes,
          sport,
        }),
      });

      setBuildStage("BUILDING_CORRECTION");

      const data = (await res.json()) as VisionApiResponse;

      if (!res.ok || !data || data.ok === false) {
        throw new Error(
          data && "error" in data && data.error
            ? data.error
            : "Sensei Vision failed to analyze the frame."
        );
      }

      const normalized = normalizeVisionAnalysis(data.analysis);

      setAnalysis(normalized);
      localStorage.setItem("disciplin_latest_vision", JSON.stringify(normalized));

      setBuildStage("DONE");
      pushSystemMessage(`Correction ready: ${cleanText((normalized as any)?.findings?.[0]?.title || "Vision analysis complete")}`);
    } catch (err: any) {
      setBuildStage("ERROR");
      setError(err?.message || "Sensei Vision failed.");
      pushSystemMessage(`Vision failed: ${err?.message || "unknown error"}`);
    } finally {
      setRunning(false);
    }
  }

  function onQuickPrompt(prompt: string) {
    setChatInput(prompt);
  }

  function onChatKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!chatSending) {
        void onSendChat();
      }
    }
  }

  async function onSendChat() {
    const question = cleanText(chatInput);
    if (!question) return;

    if (!analysis) {
      pushSystemMessage("Run Vision on a frame first. Chat only works from an active analysis.");
      setChatInput("");
      return;
    }

    setChatMessages((prev) => [
      ...prev,
      {
        id: uid(),
        role: "user",
        text: question,
        ts: Date.now(),
      },
    ]);

    setChatInput("");
    setChatSending(true);

    try {
      const context = buildVisionContext(analysis);

      const res = await fetch("/api/sensei-vision/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          question,
          context,
          analysis_id: (analysis as any)?.analysis_id || null,
          clipLabel: (analysis as any)?.clipLabel || clipLabel,
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.error || "Vision chat failed.");
      }

      const reply =
        formatVisionChatReply(
          data?.answer ||
            data?.response ||
            data?.message ||
            "Vision returned no usable answer."
        );

      setChatMessages((prev) => [
        ...prev,
        {
          id: uid(),
          role: "vision",
          text: reply,
          ts: Date.now(),
        },
      ]);
    } catch (err: any) {
      setChatMessages((prev) => [
        ...prev,
        {
          id: uid(),
          role: "system",
          text: `Vision chat failed: ${err?.message || "unknown error"}`,
          ts: Date.now(),
        },
      ]);
    } finally {
      setChatSending(false);
    }
  }

  return (
    <SenseiVisionScreen
      sport={sport}
      setSport={setSport}
      clipLabel={clipLabel}
      setClipLabel={setClipLabel}
      notes={notes}
      setNotes={setNotes}
      selectedFileName={selectedFileName}
      onFileChange={onFileChange}
      onAnalyze={onAnalyze}
      onReset={onReset}
      running={running}
      buildStage={buildStage}
      error={error}
      analysis={analysis}
      chatInput={chatInput}
      setChatInput={setChatInput}
      chatSending={chatSending}
      chatMessages={chatMessages}
      onSendChat={onSendChat}
      onChatKeyDown={onChatKeyDown}
      quickPrompts={quickPrompts}
      onQuickPrompt={onQuickPrompt}
    />
  );
}