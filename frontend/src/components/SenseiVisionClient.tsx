"use client";

import React, { useMemo, useRef, useState } from "react";
import SenseiVisionScreen, { VisionResult } from "./SenseiVisionScreen";

type Status = "IDLE" | "SENDING" | "WAITING" | "PARSING" | "DONE" | "ERROR";
type StorageMode = "SESSION" | "HISTORY";

type ChatMsg = { id: string; role: "user" | "sensei"; text: string; ts: number };
type HistoryItem = { id: string; ts: number; score: number; errorCode?: string };

type Trend = { latest: number; delta: number | null; avg7: number };

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function safeJsonParse(text: string) {
  try {
    return { ok: true as const, value: JSON.parse(text) };
  } catch (e: any) {
    return { ok: false as const, error: e?.message || "JSON parse error", raw: text };
  }
}

export default function SenseiVisionClient() {
  const [status, setStatus] = useState<Status>("IDLE");
  const [loading, setLoading] = useState(false);

  const [context, setContext] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const [result, setResult] = useState<VisionResult | null>(null);

  const [chat, setChat] = useState<ChatMsg[]>([]);
  const [reply, setReply] = useState("");
  const [storageMode, setStorageMode] = useState<StorageMode>("SESSION");

  const [history, setHistory] = useState<HistoryItem[]>([]);
  const lastErrorCodeRef = useRef<string | null>(null);

  const trend: Trend = useMemo(() => {
    if (!history.length) return { latest: 0, delta: null, avg7: 0 };
    const latest = history[0]?.score ?? 0;
    const prev = history[1]?.score;
    const delta = typeof prev === "number" ? latest - prev : null;
    const last7 = history.slice(0, 7);
    const avg7 = last7.length ? Math.round(last7.reduce((a, b) => a + (b.score || 0), 0) / last7.length) : 0;
    return { latest, delta, avg7 };
  }, [history]);

  const canAnalyze = !!file && context.trim().length >= 6 && !loading;

  function pushHistory(score: number, errorCode?: string) {
    const item: HistoryItem = { id: uid(), ts: Date.now(), score, errorCode };
    setHistory((h) => [item, ...h].slice(0, 60));
  }

  const onReset = () => {
    setStatus("IDLE");
    setLoading(false);
    setContext("");
    setFile(null);
    setPreviewUrl(null);
    setResult(null);
    setChat([]);
    setReply("");
  };

  const onClearChat = () => setChat([]);
  const onClearHistory = () => setHistory([]);
  const onDeleteHistoryItem = (id: string) => setHistory((h) => h.filter((x) => x.id !== id));

  async function getAccessToken(): Promise<string | null> {
    return null;
  }

  const onAnalyze = async () => {
    if (!canAnalyze || !file) return;

    setLoading(true);
    setStatus("SENDING");

    try {
      const fd = new FormData();
      fd.append("context", context.trim());
      fd.append("image", file);

      setStatus("WAITING");

      const token = await getAccessToken();

      const res = await fetch("/api/sensei-vision", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: fd,
      });

      const text = await res.text();
      const parsed = safeJsonParse(text);

      if (!res.ok) {
        const msg = parsed.ok ? parsed.value?.error || `Analyze failed (${res.status})` : `Analyze failed (${res.status})`;
        throw new Error(msg);
      }
      if (!parsed.ok) throw new Error(`Bad JSON from server: ${parsed.error}`);

      setStatus("PARSING");
      const normalized = parsed.value as VisionResult;

      setResult(normalized);

      pushHistory(normalized.gradePercent, normalized.errorCode);
      lastErrorCodeRef.current = normalized.errorCode;

      setChat([]);
      setReply("");

      setStatus("DONE");
    } catch (e: any) {
      setStatus("ERROR");
      alert(e?.message || "Analyze failed");
    } finally {
      setLoading(false);
    }
  };

  const onSend = async (messageOverride?: string) => {
    const q = (messageOverride ?? reply).trim();
    if (!q || !result || loading) return;

    const userMsg: ChatMsg = { id: uid(), role: "user", text: q, ts: Date.now() };

    const nextChat = [...chat, userMsg];
    const chatTail = nextChat.slice(-6);

    setChat(nextChat);
    setReply("");
    setLoading(true);
    setStatus("SENDING");

    try {
      const token = await getAccessToken();

      const res = await fetch("/api/sensei-vision", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          mode: "tighten",
          question: q,
          lastResult: result,
          storageMode,
          chatTail,
        }),
      });

      const text = await res.text();
      const parsed = safeJsonParse(text);

      if (!res.ok) {
        const msg = parsed.ok ? parsed.value?.error || `Tighten failed (${res.status})` : `Tighten failed (${res.status})`;
        throw new Error(msg);
      }
      if (!parsed.ok) throw new Error(`Bad JSON from server: ${parsed.error}`);

      const replyText =
        typeof parsed.value?.reply === "string" && parsed.value.reply.trim()
          ? parsed.value.reply
          : "Pick ONE variable. Ask again.";

      const senseiMsg: ChatMsg = { id: uid(), role: "sensei", text: replyText, ts: Date.now() };
      setChat((c) => [...c, senseiMsg]);

      setStatus("DONE");
    } catch (e: any) {
      setStatus("ERROR");
      alert(e?.message || "Tighten failed");
    } finally {
      setLoading(false);
    }
  };

  const onFileSet = (f: File | null) => {
    setFile(f);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(f ? URL.createObjectURL(f) : null);
  };

  return (
    <SenseiVisionScreen
      status={status}
      context={context}
      setContext={setContext}
      file={file}
      setFile={onFileSet}
      previewUrl={previewUrl}
      loading={loading}
      canAnalyze={canAnalyze}
      onAnalyze={onAnalyze}
      onReset={onReset}
      result={result}
      chat={chat}
      reply={reply}
      setReply={setReply}
      onSend={onSend}
      onClearChat={onClearChat}
      storageMode={storageMode}
      setStorageMode={setStorageMode}
      history={history}
      trend={trend}
      onClearHistory={onClearHistory}
      onDeleteHistoryItem={onDeleteHistoryItem}
    />
  );
}