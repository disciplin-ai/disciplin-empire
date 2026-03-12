"use client";

import React, { useMemo, useState } from "react";
import SenseiVisionScreen from "@/components/SenseiVisionScreen";
import type { VisionAnalysis, VisionAnalyzeResponse } from "@/lib/senseiVisionTypes";

type VisionErrorPayload = {
  ok?: boolean;
  error?: string;
  raw?: string;
};

export type VisionBuildStage =
  | "IDLE"
  | "READING_FRAME"
  | "DETECTING_DISCIPLINE"
  | "DETECTING_TECHNIQUE"
  | "RESTRICTING_FIXES"
  | "BUILDING_CORRECTION"
  | "DONE"
  | "ERROR";

export type VisionChatMessage = {
  id: string;
  role: "user" | "vision" | "system";
  text: string;
  ts: number;
};

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      resolve(String(reader.result || ""));
    };

    reader.onerror = () => reject(new Error("Failed to read file."));
    reader.readAsDataURL(file);
  });
}

function isVisionSuccess(data: unknown): data is { ok: true; analysis: VisionAnalysis } {
  if (!data || typeof data !== "object") return false;
  if (!("ok" in data) || (data as { ok?: unknown }).ok !== true) return false;
  return "analysis" in data;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function uid() {
  return Math.random().toString(36).slice(2);
}

function buildVisionReply(question: string, analysis: VisionAnalysis | null): string {
  if (!analysis) {
    return "Run an analysis first. Vision only answers questions about the current frame.";
  }

  const q = question.toLowerCase().trim();
  const technique = analysis.technique_detected || "the current technique";
  const primaryError = analysis.primary_error || "the main mechanical issue";
  const why = analysis.why_it_matters || "it affects efficiency and control";
  const oneFix = analysis.one_fix || "clean up the main error first";
  const drills = Array.isArray(analysis.drills) ? analysis.drills : [];
  const positives = Array.isArray(analysis.what_you_did_right) ? analysis.what_you_did_right : [];
  const safety = Array.isArray(analysis.safety) ? analysis.safety : [];
  const allowed = Array.isArray(analysis.allowed_fix_family) ? analysis.allowed_fix_family : [];

  if (q.includes("why") || q.includes("matter")) {
    return [
      `Main issue on this ${technique}: ${primaryError}.`,
      `Why it matters: ${why}.`,
      `Do not chase five fixes at once. Clean this first, then re-test the frame.`,
    ].join("\n");
  }

  if (q.includes("first") || q.includes("focus") || q.includes("next rep")) {
    return [
      `First focus: ${oneFix}.`,
      `On the next rep, keep your attention on one thing only.`,
      `Do not add extra changes until this one starts looking cleaner.`,
    ].join("\n");
  }

  if (q.includes("drill") || q.includes("train")) {
    return drills.length
      ? [
          `Best drill focus for this frame:`,
          ...drills.map((d, i) => `${i + 1}. ${d}`),
          `Start with the slowest, cleanest version first.`,
        ].join("\n")
      : `No drills were returned for this frame. Stay with the main fix: ${oneFix}.`;
  }

  if (q.includes("good") || q.includes("right")) {
    return positives.length
      ? [
          `What was good in this frame:`,
          ...positives.map((p, i) => `${i + 1}. ${p}`),
          `Keep these while cleaning the main error.`,
        ].join("\n")
      : `Vision did not return strong positives here. Treat this frame mainly as a correction rep.`;
  }

  if (q.includes("safe") || q.includes("injury") || q.includes("hurt")) {
    return safety.length
      ? [
          `Safety notes for this frame:`,
          ...safety.map((s, i) => `${i + 1}. ${s}`),
        ].join("\n")
      : `No extra safety notes were returned. Stay controlled and do not force range before mechanics are clean.`;
  }

  if (q.includes("detected") || q.includes("what is this") || q.includes("technique")) {
    return [
      `Detected discipline: ${analysis.discipline_detected}.`,
      `Detected technique: ${technique}.`,
      allowed.length ? `Allowed fix family: ${allowed.join(", ")}.` : `Allowed fix family was not returned.`,
    ].join("\n");
  }

  if (q.includes("simple") || q.includes("simpler") || q.includes("explain")) {
    return [
      `Simple version:`,
      `${primaryError}.`,
      `${oneFix}.`,
      `That is the only thing to clean first on this frame.`,
    ].join("\n");
  }

  return [
    `For this frame, stay tied to the main issue: ${primaryError}.`,
    `Main fix: ${oneFix}.`,
    `If you want a better answer, ask something specific like: "why does this matter?", "which drill first?", or "what do I focus on next rep?"`,
  ].join("\n");
}

export default function SenseiVisionClient() {
  const [sport, setSport] = useState("MMA");
  const [clipLabel, setClipLabel] = useState("Frame upload");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);

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
      text: "Ask about this frame after analysis. Keep questions technical and specific.",
      ts: Date.now(),
    },
  ]);

  const quickPrompts = useMemo(
    () => [
      "Why is this the main error?",
      "What do I focus on next rep?",
      "Which drill should I do first?",
      "Explain this in simpler terms.",
    ],
    []
  );

  async function onAnalyze() {
    if (!file) {
      setError("Upload a frame first.");
      return;
    }

    setRunning(true);
    setBuildStage("READING_FRAME");
    setError(null);

    try {
      await delay(180);
      const imageBase64 = await fileToBase64(file);

      setBuildStage("DETECTING_DISCIPLINE");
      await delay(220);

      setBuildStage("DETECTING_TECHNIQUE");
      await delay(220);

      setBuildStage("RESTRICTING_FIXES");
      await delay(220);

      const res = await fetch("/api/sensei-vision", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sport,
          clipLabel,
          notes,
          imageBase64,
        }),
      });

      setBuildStage("BUILDING_CORRECTION");

      const rawText = await res.text();

      let data: VisionAnalyzeResponse | VisionErrorPayload | null = null;
      try {
        data = rawText ? (JSON.parse(rawText) as VisionAnalyzeResponse | VisionErrorPayload) : null;
      } catch {
        data = null;
      }

      if (!res.ok) {
        const backendError =
          data && typeof data === "object" && "error" in data && typeof data.error === "string"
            ? data.error
            : `Vision request failed (${res.status})`;

        const backendRaw =
          data && typeof data === "object" && "raw" in data && typeof data.raw === "string"
            ? `\n\nRaw: ${data.raw}`
            : "";

        setBuildStage("ERROR");
        setError(`${backendError}${backendRaw}`);
        return;
      }

      if (!isVisionSuccess(data)) {
        const fallbackError =
          data && typeof data === "object" && "error" in data && typeof data.error === "string"
            ? data.error
            : "Vision returned an unexpected response.";

        setBuildStage("ERROR");
        setError(fallbackError);
        return;
      }

      await delay(180);

      setAnalysis(data.analysis);
      localStorage.setItem("disciplin_latest_vision", JSON.stringify(data.analysis));
      setBuildStage("DONE");
      setChatMessages([
        {
          id: uid(),
          role: "system",
          text: `Frame ready. Ask about ${data.analysis.technique_detected || "this frame"}.`,
          ts: Date.now(),
        },
      ]);
      setChatInput("");
    } catch (err: unknown) {
      setBuildStage("ERROR");
      setError(err instanceof Error ? err.message : "Vision failed.");
    } finally {
      setRunning(false);
    }
  }

  function onReset() {
    setSport("MMA");
    setClipLabel("Frame upload");
    setNotes("");
    setFile(null);
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
        text: "Ask about this frame after analysis. Keep questions technical and specific.",
        ts: Date.now(),
      },
    ]);
  }

  async function onSendChat() {
    const text = chatInput.trim();
    if (!text) return;

    setChatMessages((prev) => [
      ...prev,
      { id: uid(), role: "user", text, ts: Date.now() },
    ]);
    setChatInput("");
    setChatSending(true);

    try {
      await delay(180);
      const reply = buildVisionReply(text, analysis);

      setChatMessages((prev) => [
        ...prev,
        { id: uid(), role: "vision", text: reply, ts: Date.now() },
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

  function onQuickPrompt(prompt: string) {
    setChatInput(prompt);
  }

  return (
    <SenseiVisionScreen
      sport={sport}
      setSport={setSport}
      clipLabel={clipLabel}
      setClipLabel={setClipLabel}
      notes={notes}
      setNotes={setNotes}
      selectedFileName={file?.name ?? ""}
      onFileChange={setFile}
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