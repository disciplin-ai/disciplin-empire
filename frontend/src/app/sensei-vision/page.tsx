// src/app/sensei-vision/page.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

type Grade = "green" | "yellow" | "red";

type VisionApiResponse = {
  ok: boolean;
  error?: string;
  reply?: string;
  grade?: Grade;
  keyFix?: string;
  drills?: string[];
  questions?: string[];
};

type ChatMsg = {
  id: string;
  from: "user" | "sensei";
  text: string;
  meta?: {
    grade?: Grade;
    keyFix?: string;
    drills?: string[];
    questions?: string[];
  };
};

const STORAGE_KEY = "disciplin_sensei_vision_chat_v1";

function uid(prefix = "m") {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function Dots() {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-300/80 animate-bounce [animation-delay:-0.2s]" />
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-300/80 animate-bounce [animation-delay:-0.1s]" />
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-300/80 animate-bounce" />
    </span>
  );
}

function gradePill(grade?: Grade) {
  if (!grade) return null;
  const base =
    "text-[11px] px-2 py-1 rounded-full border inline-flex items-center gap-2";
  if (grade === "green")
    return (
      <span className={`${base} border-emerald-500/40 bg-emerald-500/10 text-emerald-200`}>
        <span className="w-2 h-2 rounded-full bg-emerald-400" />
        Green
      </span>
    );
  if (grade === "yellow")
    return (
      <span className={`${base} border-yellow-500/40 bg-yellow-500/10 text-yellow-200`}>
        <span className="w-2 h-2 rounded-full bg-yellow-400" />
        Yellow
      </span>
    );
  return (
    <span className={`${base} border-red-500/40 bg-red-500/10 text-red-200`}>
      <span className="w-2 h-2 rounded-full bg-red-400" />
      Red
    </span>
  );
}

async function fileToBase64(file: File) {
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

export default function SenseiVisionPage() {
  const [userText, setUserText] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);

  const [chat, setChat] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState("");

  const [loading, setLoading] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // keep last sensei reply text as context
  const lastSenseiReply = useMemo(() => {
    const last = [...chat].reverse().find((m) => m.from === "sensei");
    return last?.text ?? "";
  }, [chat]);

  const chatEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat, thinking]);

  // Load from localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      setUserText(saved.userText ?? "");
      setChat(saved.chat ?? []);
      // image not persisted (privacy)
    } catch {}
  }, []);

  // Save to localStorage (no image)
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ userText, chat })
      );
    } catch {}
  }, [userText, chat]);

  // Handle image selection + preview + base64
  async function handlePickFile(file: File | null) {
    if (!file) return;

    setImageFile(file);
    setError(null);

    // preview
    const previewUrl = URL.createObjectURL(file);
    setImagePreview(previewUrl);

    // base64 for API
    const b64 = await fileToBase64(file);
    setImageBase64(b64);
  }

  function removeImage() {
    setImageFile(null);
    setImagePreview(null);
    setImageBase64(null);
  }

  const canAnalyze = useMemo(() => {
    return (userText.trim().length > 0 || !!imageBase64) && !loading;
  }, [userText, imageBase64, loading]);

  async function callVision(payload: any): Promise<VisionApiResponse> {
    const res = await fetch("/api/sensei-vision", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    return data;
  }

  // -------- ANALYZE (first response) --------
  async function handleAnalyze() {
    setError(null);
    if (!canAnalyze) {
      setError("Give Sensei Vision a situation and/or an image.");
      return;
    }

    try {
      setLoading(true);

      // Put user message into chat
      const userMsg: ChatMsg = {
        id: uid("u"),
        from: "user",
        text: userText.trim() || "(image only)",
      };
      setChat((prev) => [...prev, userMsg]);

      setThinking(true);

      const data = await callVision({
        mode: "analyze",
        userText,
        imageBase64,
        localeHint: navigator?.language ?? "en",
      });

      if (!data?.ok) {
        setError(data?.error ?? "Sensei Vision failed.");
        return;
      }

      // Build a compact “coach-like” message (no giant wall)
      const parts: string[] = [];
      if (data.grade) parts.push(`GRADE: ${data.grade.toUpperCase()}`);
      if (data.reply) parts.push(data.reply.trim());
      if (data.keyFix) parts.push(`KEY FIX: ${data.keyFix}`);
      if (data.drills?.length) {
        parts.push("DRILLS:");
        for (const d of data.drills) parts.push(`- ${d}`);
      }
      if (data.questions?.length) {
        parts.push("QUESTIONS:");
        for (const q of data.questions) parts.push(`- ${q}`);
      }

      const senseiMsg: ChatMsg = {
        id: uid("s"),
        from: "sensei",
        text: parts.join("\n"),
        meta: {
          grade: data.grade,
          keyFix: data.keyFix,
          drills: data.drills,
          questions: data.questions,
        },
      };

      setChat((prev) => [...prev, senseiMsg]);

      // Optional: clear top inputs after analyze
      // setUserText("");
      // removeImage();
    } catch (e: any) {
      console.error(e);
      setError(e?.message ?? "Network error.");
    } finally {
      setThinking(false);
      setLoading(false);
    }
  }

  // -------- CHAT (follow-ups) --------
  async function handleChatSend() {
    setError(null);
    const msg = chatInput.trim();
    if (!msg) return;

    // must have some context
    if (!lastSenseiReply) {
      setError("Analyze a frame first so Sensei has context.");
      return;
    }

    const userMsg: ChatMsg = { id: uid("u2"), from: "user", text: msg };
    setChat((prev) => [...prev, userMsg]);
    setChatInput("");

    try {
      setThinking(true);
      const data = await callVision({
        mode: "chat",
        userText,           // original context stays
        prior: lastSenseiReply,
        message: msg,
        localeHint: navigator?.language ?? "en",
      });

      if (!data?.ok) {
        setError(data?.error ?? "Sensei Vision failed to reply.");
        return;
      }

      const parts: string[] = [];
      if (data.grade) parts.push(`GRADE: ${data.grade.toUpperCase()}`);
      if (data.reply) parts.push(data.reply.trim());
      if (data.keyFix) parts.push(`KEY FIX: ${data.keyFix}`);
      if (data.drills?.length) {
        parts.push("DRILLS:");
        for (const d of data.drills) parts.push(`- ${d}`);
      }
      if (data.questions?.length) {
        parts.push("QUESTIONS:");
        for (const q of data.questions) parts.push(`- ${q}`);
      }

      setChat((prev) => [
        ...prev,
        {
          id: uid("s2"),
          from: "sensei",
          text: parts.join("\n"),
          meta: {
            grade: data.grade,
            keyFix: data.keyFix,
            drills: data.drills,
            questions: data.questions,
          },
        },
      ]);
    } catch (e: any) {
      console.error(e);
      setError(e?.message ?? "Network error.");
    } finally {
      setThinking(false);
    }
  }

  // Edit/delete last user message (like you requested)
  const lastUserIndex = useMemo(() => {
    for (let i = chat.length - 1; i >= 0; i--) {
      if (chat[i].from === "user") return i;
    }
    return -1;
  }, [chat]);

  function editLastUser() {
    if (lastUserIndex === -1) return;
    const msg = chat[lastUserIndex];
    setChatInput(msg.text);
  }

  function deleteLastUser() {
    if (lastUserIndex === -1) return;
    setChat((prev) => prev.filter((_, idx) => idx !== lastUserIndex));
  }

  function resetAll() {
    setUserText("");
    removeImage();
    setChat([]);
    setChatInput("");
    setError(null);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 px-6 py-10 md:px-16">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <section className="space-y-3">
          <p className="text-xs font-semibold tracking-[0.25em] text-emerald-400">
            SENSEI VISION
          </p>
          <h1 className="text-3xl md:text-4xl font-semibold">
            Upload one frame. Get a strict technical breakdown.
          </h1>
          <p className="text-sm md:text-base text-slate-300 max-w-3xl">
            Frame-first coaching. Safe. Precise. No fluff. Sensei Vision grades habits
            (Green / Yellow / Red) and asks questions to lock accuracy.
          </p>
        </section>

        <section className="grid gap-6 md:grid-cols-[minmax(0,1.05fr)_minmax(0,1.15fr)] items-start">
          {/* LEFT: input card */}
          <div className="rounded-3xl border border-slate-800 bg-slate-900/40 p-6 md:p-8 space-y-5">
            <div className="space-y-2">
              <label className="block text-xs font-medium text-slate-300">
                Describe the situation (age / level / ruleset / goal)
              </label>
              <textarea
                className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-3 py-3 text-sm outline-none focus:border-emerald-400 min-h-[140px]"
                value={userText}
                onChange={(e) => setUserText(e.target.value)}
                placeholder='Example: "I’m 16, pressure wrestler. In this frame I’m ankle picking but getting stuffed. What’s the main error and the smallest fix cue?"'
              />
              <p className="text-[11px] text-slate-500">
                Tip: If you mention pain, dizziness, or heart/knee issues, Sensei scales intensity down.
              </p>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-medium text-slate-300">
                Upload a photo (video later)
              </label>

              <div className="flex items-center gap-3">
                <input
                  type="file"
                  accept="image/*"
                  className="text-xs text-slate-300"
                  onChange={(e) => handlePickFile(e.target.files?.[0] ?? null)}
                />
                {(imageFile || imagePreview) && (
                  <button
                    type="button"
                    onClick={removeImage}
                    className="text-xs px-3 py-1 rounded-full border border-slate-700 hover:border-slate-500 text-slate-200"
                  >
                    Remove
                  </button>
                )}
              </div>

              {imagePreview && (
                <div className="mt-3 rounded-2xl border border-slate-800 bg-slate-950/30 p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-slate-300">Preview</p>
                    <button
                      type="button"
                      onClick={removeImage}
                      className="text-[11px] text-slate-400 hover:text-slate-200"
                    >
                      Remove if wrong file
                    </button>
                  </div>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imagePreview}
                    alt="preview"
                    className="mt-2 max-h-64 w-full rounded-xl object-contain border border-slate-800"
                  />
                </div>
              )}
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleAnalyze}
                disabled={!canAnalyze}
                className="w-full rounded-full bg-emerald-400 px-6 py-3 text-sm font-semibold text-slate-950 disabled:opacity-50"
              >
                {loading ? "Analyzing…" : "Analyze frame"}
              </button>

              <button
                type="button"
                onClick={resetAll}
                className="shrink-0 rounded-full border border-slate-700 px-4 py-3 text-xs font-medium text-slate-300 hover:border-slate-500"
              >
                Reset
              </button>
            </div>

            {error && <p className="text-xs text-red-400">Sensei Vision error: {error}</p>}
          </div>

          {/* RIGHT: chat card */}
          <div className="rounded-3xl border border-slate-800 bg-slate-900/40 p-6 md:p-8 flex flex-col gap-4">
            {/* Header row */}
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">Chat with Sensei Vision</h2>
                <p className="mt-1 text-sm text-slate-300">
                  Sensei will ask questions. You answer. That’s how it becomes accurate.
                </p>
              </div>

              <div className="flex items-center gap-2">
                {gradePill([...chat].reverse().find(m => m.from === "sensei")?.meta?.grade)}
                <span className="text-[11px] px-3 py-1 rounded-full border border-slate-700 text-slate-300">
                  {thinking ? "Reading…" : "Ready"}
                </span>
              </div>
            </div>

            {/* Chat window */}
            <div className="rounded-2xl border border-slate-800 bg-slate-950/35 px-3 py-3 h-[520px] overflow-auto space-y-2">
              {chat.length === 0 && (
                <p className="text-xs text-slate-500">
                  Upload a frame + describe what’s happening. Sensei Vision will grade it and ask 1–3 questions.
                </p>
              )}

              {chat.map((m) => (
                <div
                  key={m.id}
                  className={`rounded-2xl px-3 py-2 text-xs md:text-sm ${
                    m.from === "user"
                      ? "bg-slate-100 text-slate-900 ml-auto max-w-[92%]"
                      : "bg-emerald-500/10 text-emerald-200 border border-emerald-500/30 mr-auto max-w-[92%]"
                  }`}
                >
                  <div className="text-[10px] uppercase tracking-wide opacity-70 mb-1">
                    {m.from === "user" ? "You" : "Sensei Vision"}
                  </div>

                  {m.from === "sensei" && m.meta?.grade && (
                    <div className="mb-2">{gradePill(m.meta.grade)}</div>
                  )}

                  <div className="whitespace-pre-wrap leading-relaxed">{m.text}</div>
                </div>
              ))}

              {thinking && (
                <div className="rounded-2xl px-3 py-2 text-xs md:text-sm bg-emerald-500/10 text-emerald-200 border border-emerald-500/30 mr-auto max-w-[92%]">
                  <div className="text-[10px] uppercase tracking-wide opacity-70 mb-1">Sensei Vision</div>
                  <Dots />
                </div>
              )}

              <div ref={chatEndRef} />
            </div>

            {/* Edit/delete last user message */}
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Tip: you can edit or delete your last question.</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={editLastUser}
                  disabled={lastUserIndex === -1}
                  className="px-3 py-1 rounded-full border border-slate-700 hover:border-slate-500 disabled:opacity-40"
                >
                  Edit last
                </button>
                <button
                  type="button"
                  onClick={deleteLastUser}
                  disabled={lastUserIndex === -1}
                  className="px-3 py-1 rounded-full border border-slate-700 hover:border-slate-500 disabled:opacity-40"
                >
                  Delete last
                </button>
              </div>
            </div>

            {/* Chat input */}
            <div className="space-y-2">
              <textarea
                className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs md:text-sm outline-none focus:border-emerald-400"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder={
                  lastSenseiReply
                    ? "Answer Sensei’s question (ruleset, grip, timing, intent), or ask a follow-up."
                    : "Analyze a frame first, then answer Sensei here."
                }
                rows={3}
              />

              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setChat([])}
                  className="text-xs px-4 py-2 rounded-full border border-slate-800 hover:border-slate-600 text-slate-300"
                >
                  Clear chat
                </button>

                <button
                  type="button"
                  onClick={handleChatSend}
                  disabled={!lastSenseiReply || thinking || !chatInput.trim()}
                  className="rounded-full bg-slate-100 text-slate-900 px-5 py-2 text-xs font-semibold disabled:opacity-40"
                >
                  {thinking ? "Sensei…" : "Send"}
                </button>
              </div>

              {!lastSenseiReply && (
                <p className="text-[11px] text-slate-500">
                  Sensei chat activates after the first analysis.
                </p>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
