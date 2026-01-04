"use client";

import { useEffect, useState } from "react";

const SENSEI_STORAGE_KEY = "disciplin_sensei_last_camp_v3";

type SenseiSavedState = {
  style: string;
  favourites: string;
  campStage: string;
  weightGoal: string;
  scenario: string;
  plan: string;
};

type ChatMessage = {
  id: string;
  from: "user" | "sensei";
  text: string;
};

type PendingAction = null | "camp" | "chat";

export default function SenseiPage() {
  const [style, setStyle] = useState("pressure wrestler, southpaw striker");
  const [favourites, setFavourites] = useState("Merab, Ilia, Khabib, Leon");
  const [campStage, setCampStage] = useState("");
  const [weightGoal, setWeightGoal] = useState("");
  const [scenario, setScenario] = useState("");
  const [campPlan, setCampPlan] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [videoNotes, setVideoNotes] = useState("");

  // new: track which user message is being edited
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);

  // ---------- Load / save camp to localStorage ----------

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const raw = window.localStorage.getItem(SENSEI_STORAGE_KEY);
      if (!raw) return;

      const saved: SenseiSavedState = JSON.parse(raw);

      setStyle(saved.style ?? "");
      setFavourites(saved.favourites ?? "");
      setCampStage(saved.campStage ?? "");
      setWeightGoal(saved.weightGoal ?? "");
      setScenario(saved.scenario ?? "");
      setCampPlan(saved.plan ?? null);

      console.log("[Sensei] Loaded saved camp from localStorage");
    } catch (e) {
      console.warn("[Sensei] Failed to load saved camp:", e);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!campPlan) return;

    const toSave: SenseiSavedState = {
      style,
      favourites,
      campStage,
      weightGoal,
      scenario,
      plan: campPlan,
    };

    try {
      window.localStorage.setItem(
        SENSEI_STORAGE_KEY,
        JSON.stringify(toSave)
      );
      console.log("[Sensei] Saved camp to localStorage");
    } catch (e) {
      console.warn("[Sensei] Failed to save camp:", e);
    }
  }, [style, favourites, campStage, weightGoal, scenario, campPlan]);

  // ---------- API helper ----------

  async function callSensei(payload: any) {
    const res = await fetch("/api/sensei", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    console.log("[Sensei] API response:", data);
    return data;
  }

  // ---------- Actions: generate / refine / chat ----------

  async function handleGenerateNew() {
    try {
      setLoading(true);
      setPendingAction("camp");
      setError(null);
      setNotice(null);

      const data = await callSensei({
        mode: "new",
        style,
        favourites,
        campStage,
        weightGoal,
        scenario,
        benchmarkMode: false,
        previousPlan: null,
      });

      if (!data.ok || !data.plan) {
        setCampPlan(null);
        setError(
          data.error ??
            "Sensei failed to generate a camp. Try again."
        );
        return;
      }

      setCampPlan(data.plan as string);
      setChatMessages([]);
      setVideoNotes("");
      setEditingMessageId(null);

      if (data.truncated) {
        setNotice(
          "Sensei hit the token limit and stopped early. You can refine the current plan to add more detail."
        );
      } else {
        setNotice(null);
      }
    } catch (e: any) {
      console.error("[Sensei] generate error:", e);
      setError(e?.message ?? "Unexpected error while contacting Sensei.");
    } finally {
      setLoading(false);
      setPendingAction(null);
    }
  }

  async function handleRefine() {
    if (!campPlan) {
      setError("No existing camp to refine.");
      return;
    }

    try {
      setLoading(true);
      setPendingAction("camp");
      setError(null);
      setNotice(null);

      const data = await callSensei({
        mode: "refine",
        style,
        favourites,
        campStage,
        weightGoal,
        scenario,
        previousPlan: campPlan,
        benchmarkMode: false,
      });

      if (!data.ok || !data.plan) {
        setError(
          data.error ??
            "Sensei failed to refine the current camp. Try again."
        );
        return;
      }

      setCampPlan(data.plan as string);

      if (data.truncated) {
        setNotice(
          "Sensei refined the plan but hit the token limit. You can refine again with a tighter instruction."
        );
      } else {
        setNotice("Camp refined. Structure preserved, details improved.");
      }
    } catch (e: any) {
      console.error("[Sensei] refine error:", e);
      setError(e?.message ?? "Unexpected error while refining camp.");
    } finally {
      setLoading(false);
      setPendingAction(null);
    }
  }

  async function handleChatSend() {
    const messageText = chatInput.trim();
    if (!messageText) return;

    setError(null);
    setNotice(null);

    // Build nextMessages with edit/overwrite logic
    let nextMessages: ChatMessage[] = [...chatMessages];
    let userMessage: ChatMessage;

    if (editingMessageId) {
      const idx = nextMessages.findIndex(
        (m) => m.id === editingMessageId && m.from === "user"
      );

      if (idx !== -1) {
        // overwrite text
        nextMessages[idx] = {
          ...nextMessages[idx],
          text: messageText,
        };
        // remove everything after edited message (old answers)
        nextMessages = nextMessages.slice(0, idx + 1);
        userMessage = nextMessages[idx];
      } else {
        // fallback – treat as new message
        userMessage = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          from: "user",
          text: messageText,
        };
        nextMessages.push(userMessage);
      }
      setEditingMessageId(null);
    } else {
      userMessage = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        from: "user",
        text: messageText,
      };
      nextMessages.push(userMessage);
    }

    setChatMessages(nextMessages);
    setChatInput("");

    try {
      setLoading(true);
      setPendingAction("chat");

      const data = await callSensei({
        mode: "chat",
        style,
        favourites,
        campStage,
        weightGoal,
        scenario,
        previousPlan: campPlan,
        message: messageText,
        videoNotes,
      });

      if (!data.ok || !data.reply) {
        setError(
          data.error ??
            "Sensei failed to answer your question. Try again or simplify it."
        );
        return;
      }

      const replyId = `${Date.now()}-sensei`;
      const senseiReply: ChatMessage = {
        id: replyId,
        from: "sensei",
        text: data.reply as string,
      };

      setChatMessages((msgs) => [...msgs, senseiReply]);

      if (data.truncated) {
        setNotice(
          "Sensei had to cut the answer. Ask a follow-up question for more detail."
        );
      }
    } catch (e: any) {
      console.error("[Sensei] chat error:", e);
      setError(e?.message ?? "Error while talking to Sensei.");
    } finally {
      setLoading(false);
      setPendingAction(null);
    }
  }

  function handleReset() {
    setCampPlan(null);
    setNotice(null);
    setError(null);
    setChatMessages([]);
    setVideoNotes("");
    setEditingMessageId(null);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(SENSEI_STORAGE_KEY);
    }
  }

  // ---------- Edit / delete helpers ----------

  function handleEditMessage(id: string) {
    const msg = chatMessages.find(
      (m) => m.id === id && m.from === "user"
    );
    if (!msg) return;
    setChatInput(msg.text);
    setEditingMessageId(id);
  }

  function handleDeleteMessage(id: string) {
    setChatMessages((msgs) => {
      const idx = msgs.findIndex((m) => m.id === id);
      if (idx === -1) return msgs;
      // delete this message and everything after it
      return msgs.slice(0, idx);
    });
    if (editingMessageId === id) {
      setEditingMessageId(null);
    }
  }

  // ---------- UI helpers ----------

  const isCampLoading = loading && pendingAction === "camp";
  const isChatLoading = loading && pendingAction === "chat";

  // index of last user message (for showing Edit/Delete)
  const lastUserMessageIndex = (() => {
    for (let i = chatMessages.length - 1; i >= 0; i--) {
      if (chatMessages[i].from === "user") return i;
    }
    return -1;
  })();

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 px-6 py-12 md:px-16">
      <div className="max-w-6xl mx-auto space-y-10">
        {/* Header */}
        <section className="space-y-3">
          <p className="text-xs font-semibold tracking-[0.25em] text-emerald-400">
            SENSEI AI
          </p>
          <h1 className="text-3xl md:text-4xl font-semibold">
            Build strict fight camps, not influencer workouts.
          </h1>
          <p className="text-sm md:text-base text-slate-300 max-w-2xl">
            Sensei reads your stance, age, injuries and pace before it decides
            how hard to push you. Fill this once for each phase.
          </p>
        </section>

        {/* Main grid */}
        <section className="grid gap-6 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1.1fr)] items-start">
          {/* LEFT – inputs */}
          <div className="rounded-3xl border border-slate-800 bg-slate-900/40 p-6 md:p-8 space-y-6">
            <div>
              <h2 className="text-lg font-semibold">
                Describe what you want from this phase
              </h2>
              <p className="mt-1 text-sm text-slate-300">
                Add age, injuries, work schedule and whether you are hobby,
                amateur, or pro. Sensei will decide how hard to push you.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="block text-xs font-medium text-slate-300">
                  Your style
                </label>
                <input
                  className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none focus:border-emerald-400"
                  value={style}
                  onChange={(e) => setStyle(e.target.value)}
                  placeholder="pressure wrestler, southpaw striker…"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-medium text-slate-300">
                  Favourite / closest fighter
                </label>
                <input
                  className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none focus:border-emerald-400"
                  value={favourites}
                  onChange={(e) => setFavourites(e.target.value)}
                  placeholder="Merab, Ilia, Khabib, Leon…"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-medium text-slate-300">
                  Camp stage / timeframe
                </label>
                <input
                  className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none focus:border-emerald-400"
                  value={campStage}
                  onChange={(e) => setCampStage(e.target.value)}
                  placeholder="6-week build, 3-week short notice…"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-medium text-slate-300">
                  Weight goal
                </label>
                <input
                  className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none focus:border-emerald-400"
                  value={weightGoal}
                  onChange={(e) => setWeightGoal(e.target.value)}
                  placeholder="cut to 71 kg, hold 74 kg…"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-medium text-slate-300">
                Scenario / problem
              </label>
              <textarea
                className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none focus:border-emerald-400 min-h-[120px]"
                value={scenario}
                onChange={(e) => setScenario(e.target.value)}
                placeholder={
                  campPlan
                    ? "For refine: tell Sensei what must change. Example: more wrestling, protect knee, keep 4 sessions/week."
                    : "For new camp: age, job, injuries, sessions/week, upcoming fight or goal."
                }
              />
            </div>

            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <p className="text-xs text-slate-400 max-w-md">
                Tip: mention if you want full Abdulmanap pace or a safer camp.
                Sensei will still protect older or injured fighters.
              </p>

              <div className="flex items-center gap-3">
                <button
                  onClick={handleGenerateNew}
                  disabled={loading}
                  className="rounded-full bg-emerald-400 px-6 py-2 text-sm font-semibold text-slate-950 disabled:opacity-60"
                >
                  {isCampLoading ? "Building camp…" : "Generate new camp"}
                </button>

                <button
                  type="button"
                  onClick={handleRefine}
                  disabled={loading || !campPlan}
                  className="rounded-full border border-slate-600 px-4 py-2 text-xs font-medium text-slate-200 hover:border-slate-400 disabled:opacity-40"
                >
                  Refine current camp
                </button>

                <button
                  type="button"
                  onClick={handleReset}
                  className="rounded-full border border-slate-700 px-4 py-2 text-xs font-medium text-slate-300 hover:border-slate-400"
                >
                  Reset conversation
                </button>
              </div>
            </div>

            {error && (
              <p className="text-xs text-red-400 mt-1">
                Sensei error: {error}
              </p>
            )}
            {!error && notice && (
              <p className="text-xs text-emerald-300 mt-1">{notice}</p>
            )}
          </div>

          {/* RIGHT – camp + chat */}
          <div className="rounded-3xl border border-slate-800 bg-slate-900/40 p-6 md:p-8 flex flex-col gap-6">
            {/* CAMP PLAN */}
            <div className="flex-1 flex flex-col">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="text-xs font-semibold tracking-[0.18em] text-slate-300">
                  CAMP PLAN
                </h2>
                {isCampLoading && (
                  <div className="flex items-center gap-2 text-[11px] text-emerald-300">
                    <span>Sensei is building your camp</span>
                    <div className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse" />
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse [animation-delay:150ms]" />
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse [animation-delay:300ms]" />
                    </div>
                  </div>
                )}
              </div>

              <div className="flex-1 rounded-2xl bg-slate-950/40 border border-slate-800 px-4 py-4 overflow-auto">
                {campPlan ? (
                  <div className="space-y-3 text-xs md:text-sm text-slate-100 leading-relaxed">
                    {campPlan
                      .split(/\n{2,}/)
                      .filter((block) => block.trim().length > 0)
                      .map((block, idx) => {
                        const trimmed = block.trim();
                        const isHeader =
                          /^CAMP PLAN$/i.test(trimmed) ||
                          /^[1-9]\.\s/.test(trimmed);

                        return (
                          <div
                            key={idx}
                            className={
                              isHeader
                                ? "text-sm md:text-base font-semibold text-emerald-300 pt-1"
                                : "bg-slate-900/70 border border-slate-800/70 rounded-xl px-3 py-2 whitespace-pre-wrap"
                            }
                          >
                            {trimmed}
                          </div>
                        );
                      })}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">
                    Once Sensei generates your camp, it will appear here and
                    stay saved even if you refresh or leave the page.
                  </p>
                )}
              </div>
            </div>

            {/* CHAT WITH SENSEI */}
            <div className="mt-2 border-t border-slate-800 pt-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-semibold tracking-[0.18em] text-slate-400">
                  CHAT WITH SENSEI
                </h3>
                <p className="text-[10px] text-slate-500">
                  You can edit or delete your last question.
                </p>
              </div>

              <div className="max-h-72 md:max-h-[26rem] overflow-auto mb-3 flex flex-col gap-2">
                {chatMessages.length === 0 && !isChatLoading && (
                  <p className="text-xs text-slate-500">
                    Ask about a specific week, drill, or tactic. You can also
                    talk about your favourite fighter or a particular fight.
                  </p>
                )}

                {chatMessages.map((m, idx) => {
                  const isUser = m.from === "user";
                  const isLastUser = idx === lastUserMessageIndex;

                  return (
                    <div
                      key={m.id}
                      className={`max-w-full ${
                        isUser ? "self-end text-right" : "self-start"
                      }`}
                    >
                      <div
                        className={
                          isUser
                            ? "inline-block rounded-2xl bg-slate-800 text-slate-50 px-4 py-2 text-xs md:text-sm border border-slate-600"
                            : "inline-block rounded-2xl bg-emerald-500/10 border border-emerald-500/40 text-emerald-100 px-4 py-2 text-xs md:text-sm"
                        }
                      >
                        <span className="block text-[10px] uppercase tracking-wide mb-1 opacity-70">
                          {isUser ? "You" : "Sensei"}
                        </span>
                        <span className="whitespace-pre-wrap">
                          {m.text}
                        </span>
                      </div>

                      {isUser && isLastUser && (
                        <div className="mt-1 flex items-center gap-2 justify-end text-[10px]">
                          <button
                            type="button"
                            onClick={() => handleEditMessage(m.id)}
                            className="px-2 py-0.5 rounded-full border border-slate-600 text-slate-300 hover:border-emerald-400 hover:text-emerald-300"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteMessage(m.id)}
                            className="px-2 py-0.5 rounded-full border border-red-500/60 text-red-300 hover:bg-red-500/10"
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Typing indicator bubble */}
                {isChatLoading && (
                  <div className="self-start">
                    <div className="inline-flex flex-col rounded-2xl bg-emerald-500/10 border border-emerald-500/40 text-emerald-100 px-3 py-2 text-xs">
                      <span className="text-[10px] uppercase tracking-wide mb-1 opacity-70">
                        Sensei
                      </span>
                      <div className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse" />
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse [animation-delay:150ms]" />
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse [animation-delay:300ms]" />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Chat inputs */}
              <div className="space-y-2">
                {editingMessageId && (
                  <p className="text-[11px] text-amber-300">
                    Editing your last question. When you send, Sensei will
                    answer the updated version and drop the old reply.
                  </p>
                )}

                <textarea
                  className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs md:text-sm outline-none focus:border-emerald-400"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Ask Sensei about a detail in the camp, a tactic, your favourite fighter, or a specific fight."
                  rows={2}
                />

                <input
                  className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs outline-none focus:border-emerald-400"
                  value={videoNotes}
                  onChange={(e) => setVideoNotes(e.target.value)}
                  placeholder="Optional: fight video link or short description (e.g. “UFC 299, Round 2 at 3:10 – explain what both fighters did right/wrong”)."
                />

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleChatSend}
                    disabled={loading || !chatInput.trim()}
                    className="rounded-full bg-slate-100 text-slate-900 px-5 py-1.5 text-xs font-semibold disabled:opacity-40"
                  >
                    {isChatLoading
                      ? "Sensei is answering…"
                      : editingMessageId
                      ? "Update question"
                      : "Ask Sensei"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
