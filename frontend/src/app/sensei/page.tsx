"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useProfile } from "../../components/ProfileProvider";
import type { SenseiResponse, SenseiSection } from "../../lib/senseiTypes";
import SenseiCards from "../../components/SenseiCards";

type CampId = string;
type SectionId = "overview" | "training" | "nutrition" | "recovery" | "questions";

type Msg = { id: string; from: "user" | "sensei"; text: string; ts: number };

type CampThread = {
  id: CampId;
  title: string;
  createdAt: number;

  // inputs
  week: string;
  scenario: string;

  // plan
  followups_id?: string;
  plan?: SenseiResponse;

  // per-section chat
  chats: Record<SectionId, Msg[]>;
};

const STORAGE_KEY = "disciplin_sensei_threads_v1";

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

async function postJson<T>(url: string, body: any): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.ok) throw new Error(json?.error || `Request failed (${res.status})`);
  return json as T;
}

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

const SECTION_LABELS: Record<SectionId, string> = {
  overview: "Overview",
  training: "Training",
  nutrition: "Nutrition",
  recovery: "Recovery",
  questions: "Questions",
};

export default function SenseiPage() {
  const { user, loading: authLoading, profile } = useProfile();

  const [threads, setThreads] = useState<CampThread[]>([]);
  const [activeId, setActiveId] = useState<CampId | null>(null);

  const [activeSection, setActiveSection] = useState<SectionId>("overview");
  const [askText, setAskText] = useState("");
  const [answersText, setAnswersText] = useState(""); // refine answers (one per line)

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // load threads
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as CampThread[];
      setThreads(parsed);
      if (parsed.length) setActiveId(parsed[0].id);
    } catch {}
  }, []);

  // save threads
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(threads));
    } catch {}
  }, [threads]);

  const active = useMemo(() => threads.find((t) => t.id === activeId) ?? null, [threads, activeId]);

  function ping(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 1500);
  }

  function createThread() {
    const t: CampThread = {
      id: uid(),
      title: "New camp",
      createdAt: Date.now(),
      week: "Week 1",
      scenario: "",
      chats: { overview: [], training: [], nutrition: [], recovery: [], questions: [] },
    };
    setThreads((x) => [t, ...x]);
    setActiveId(t.id);
    setActiveSection("overview");
    setAskText("");
    setAnswersText("");
    ping("New camp created");
  }

  function renameThread(id: string) {
    const title = prompt("Rename camp:", active?.title ?? "Camp");
    if (!title) return;
    setThreads((x) => x.map((t) => (t.id === id ? { ...t, title } : t)));
  }

  function deleteThread(id: string) {
    if (!confirm("Delete this camp thread?")) return;
    setThreads((x) => x.filter((t) => t.id !== id));
    if (activeId === id) setActiveId(null);
  }

  function updateActive(patch: Partial<CampThread>) {
    if (!active) return;
    setThreads((x) => x.map((t) => (t.id === active.id ? { ...t, ...patch } : t)));
  }

  const context = useMemo(() => {
    // profile constants
    const cw = (profile as any)?.currentWeight || profile?.walkAroundWeight || "";
    const tw = (profile as any)?.targetWeight || "";
    const base = profile?.baseArt || "";
    const lvl = profile?.competitionLevel || "";
    const pace = profile?.paceStyle || "";
    const campGoal = profile?.campGoal || "";

    return [
      "PROFILE:",
      JSON.stringify(
        {
          name: profile?.name || "",
          baseArt: base,
          stance: profile?.stance || "",
          competitionLevel: lvl,
          paceStyle: pace,
          currentWeight: cw,
          targetWeight: tw,
          campGoal,
          injuryHistory: profile?.injuryHistory || "",
          hardBoundaries: profile?.hardBoundaries || "",
          scheduleNotes: (profile as any)?.scheduleNotes || "",
          boundariesNotes: (profile as any)?.boundariesNotes || "",
        },
        null,
        2
      ),
      "",
      "SCENARIO:",
      active?.scenario?.trim() || "",
    ].join("\n");
  }, [profile, active?.scenario]);

  async function generateCamp() {
    if (!user) {
      setError("Sign in to use Sensei.");
      return;
    }
    if (!active) return;
    if (!active.scenario.trim()) {
      setError("Add a scenario/problem first.");
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const resp = await postJson<{ ok: true } & SenseiResponse>("/api/sensei", {
        mode: "plan",
        week: active.week || "Week 1",
        context,
      });

      updateActive({ plan: resp, followups_id: resp.followups_id });
      setActiveSection("overview");
      setAnswersText("");
      ping("Camp generated");
    } catch (e: any) {
      setError(e?.message ?? "Sensei failed.");
    } finally {
      setBusy(false);
    }
  }

  async function refineCamp() {
    if (!user) {
      setError("Sign in to refine.");
      return;
    }
    if (!active?.plan?.followups_id && !active?.followups_id) {
      setError("Generate a camp first.");
      return;
    }

    const lines = answersText.split("\n").map((l) => l.trim()).filter(Boolean);
    if (!lines.length) {
      setError("Add at least one answer line before refining.");
      return;
    }

    const answers: Record<string, string> = {};
    lines.forEach((line, i) => (answers[String(i + 1)] = line));

    setBusy(true);
    setError(null);

    try {
      const resp = await postJson<{ ok: true } & SenseiResponse>("/api/sensei", {
        mode: "refine",
        week: active.week || "Week 1",
        context,
        followups_id: active.followups_id || active.plan!.followups_id,
        answers,
      });

      updateActive({ plan: resp, followups_id: resp.followups_id });
      ping("Refined");
    } catch (e: any) {
      setError(e?.message ?? "Refine failed.");
    } finally {
      setBusy(false);
    }
  }

  async function askInSection() {
    if (!user) {
      setError("Sign in to chat.");
      return;
    }
    if (!active?.followups_id) {
      setError("Generate a camp first.");
      return;
    }
    const q = askText.trim();
    if (!q) return;

    const msgUser: Msg = { id: uid(), from: "user", text: q, ts: Date.now() };
    updateActive({
      chats: { ...active.chats, [activeSection]: [...active.chats[activeSection], msgUser] },
    });
    setAskText("");
    setBusy(true);
    setError(null);

    try {
      const resp = await postJson<{ ok: true; reply: string }>("/api/sensei", {
        mode: "ask",
        followups_id: active.followups_id,
        section_id: activeSection,
        question: q,
        week: active.week,
        context,
      });

      const msgSensei: Msg = { id: uid(), from: "sensei", text: resp.reply, ts: Date.now() };
      const next = [...active.chats[activeSection], msgUser, msgSensei];

      updateActive({
        chats: { ...active.chats, [activeSection]: next },
      });
    } catch (e: any) {
      setError(e?.message ?? "Chat failed.");
    } finally {
      setBusy(false);
    }
  }

  if (!authLoading && !user) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-50 px-6 py-10">
        <div className="max-w-6xl mx-auto rounded-3xl border border-slate-800 bg-slate-900/40 p-8">
          <p className="text-sm font-semibold">You’re not logged in.</p>
          <p className="mt-2 text-xs text-slate-400">
            Sign in first, then you can create and save multiple camps.
          </p>
          <a className="underline text-emerald-300" href="/auth/login">Go to login</a>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 px-6 py-10">
      <div className="max-w-6xl mx-auto grid gap-6 md:grid-cols-[320px_1fr]">
        {/* LEFT: thread list */}
        <aside className="rounded-3xl border border-slate-800 bg-slate-900/40 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold tracking-[0.25em] text-emerald-400">CAMPS</p>
            <button
              onClick={createThread}
              className="rounded-full bg-emerald-400 px-3 py-1.5 text-xs font-semibold text-slate-950"
            >
              New
            </button>
          </div>

          {threads.length === 0 ? (
            <p className="text-xs text-slate-400">No camps yet. Create one.</p>
          ) : (
            <div className="space-y-2">
              {threads.map((t) => {
                const activeRow = t.id === activeId;
                return (
                  <button
                    key={t.id}
                    onClick={() => setActiveId(t.id)}
                    className={cn(
                      "w-full text-left rounded-2xl border p-3 transition",
                      activeRow
                        ? "border-emerald-500/40 bg-emerald-500/10"
                        : "border-slate-800 bg-slate-950/40 hover:border-emerald-400/40"
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">{t.title}</p>
                        <p className="text-[11px] text-slate-400">
                          {t.plan ? "Generated" : "Draft"} · {new Date(t.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            renameThread(t.id);
                          }}
                          className="text-[11px] text-slate-300 underline"
                        >
                          Rename
                        </span>
                        <span
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            deleteThread(t.id);
                          }}
                          className="text-[11px] text-red-300 underline"
                        >
                          Delete
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </aside>

        {/* RIGHT: active camp */}
        <section className="rounded-3xl border border-slate-800 bg-slate-900/40 p-6 space-y-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold tracking-[0.25em] text-emerald-400">SENSEI</p>
              <h1 className="mt-2 text-2xl font-semibold">{active?.title ?? "Select a camp"}</h1>
              <p className="mt-1 text-xs text-slate-400">
                Multiple saved camps · per-section questions · refine when needed
              </p>
            </div>
            {toast && (
              <span className="text-[11px] px-3 py-1 rounded-full border border-slate-700 bg-slate-950/50 text-slate-200">
                {toast}
              </span>
            )}
          </div>

          {error && <p className="text-xs text-red-300">Sensei error: {error}</p>}

          {!active ? (
            <p className="text-sm text-slate-400">Create or select a camp on the left.</p>
          ) : (
            <>
              {/* Inputs */}
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Week label</label>
                  <input
                    value={active.week}
                    onChange={(e) => updateActive({ week: e.target.value })}
                    className="w-full rounded-xl border border-slate-800 bg-slate-950/50 px-3 py-2 text-sm outline-none focus:border-emerald-400/50"
                    placeholder="Week 1 / Week 2 / Fight Week"
                  />
                </div>
                <div />
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Scenario / problem</label>
                <textarea
                  value={active.scenario}
                  onChange={(e) => updateActive({ scenario: e.target.value })}
                  rows={4}
                  className="w-full rounded-2xl border border-slate-800 bg-slate-950/50 px-3 py-2 text-sm outline-none focus:border-emerald-400/50"
                  placeholder="What do you want from this phase? Injuries, schedule, constraints, goals."
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  disabled={busy}
                  onClick={generateCamp}
                  className={cn(
                    "rounded-full px-5 py-2 text-sm font-semibold",
                    busy ? "bg-white/10 text-white/40" : "bg-emerald-400 text-slate-950 hover:bg-emerald-300"
                  )}
                >
                  {busy ? "Working…" : "Generate camp"}
                </button>

                <button
                  disabled={busy || !active.plan}
                  onClick={refineCamp}
                  className={cn(
                    "rounded-full px-5 py-2 text-sm font-semibold border",
                    busy || !active.plan
                      ? "border-white/10 text-white/40"
                      : "border-emerald-400/40 text-emerald-200 hover:border-emerald-300"
                  )}
                >
                  Refine
                </button>
              </div>

              {/* Plan cards */}
              {active.plan ? (
                <>
                  <SenseiCards data={active.plan} />

                  {/* Section chat tabs */}
                  <div className="flex flex-wrap gap-2 pt-2">
                    {(Object.keys(SECTION_LABELS) as SectionId[]).map((sid) => {
                      const on = sid === activeSection;
                      return (
                        <button
                          key={sid}
                          onClick={() => setActiveSection(sid)}
                          className={cn(
                            "rounded-full px-3 py-1 text-xs border transition",
                            on
                              ? "border-emerald-400 bg-emerald-500/10 text-emerald-200"
                              : "border-slate-800 bg-slate-950/40 text-slate-300 hover:border-emerald-400/50"
                          )}
                        >
                          {SECTION_LABELS[sid]}
                        </button>
                      );
                    })}
                  </div>

                  {/* Per-section chat */}
                  <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4 space-y-3">
                    <p className="text-xs text-slate-400">
                      Ask a question about: <span className="text-emerald-200 font-semibold">{SECTION_LABELS[activeSection]}</span>
                    </p>

                    <div className="max-h-56 overflow-auto space-y-2">
                      {(active.chats[activeSection] ?? []).length === 0 ? (
                        <p className="text-xs text-slate-500">No messages yet.</p>
                      ) : (
                        active.chats[activeSection].map((m) => (
                          <div
                            key={m.id}
                            className={cn(
                              "rounded-2xl px-4 py-2 text-xs border whitespace-pre-wrap",
                              m.from === "user"
                                ? "border-slate-700 bg-slate-900/60 text-slate-100"
                                : "border-emerald-500/30 bg-emerald-500/10 text-emerald-100"
                            )}
                          >
                            <span className="block text-[10px] uppercase tracking-wide opacity-70 mb-1">
                              {m.from === "user" ? "You" : "Sensei"}
                            </span>
                            {m.text}
                          </div>
                        ))
                      )}
                    </div>

                    <textarea
                      value={askText}
                      onChange={(e) => setAskText(e.target.value)}
                      rows={2}
                      className="w-full rounded-2xl border border-slate-800 bg-slate-950/50 px-3 py-2 text-sm outline-none focus:border-emerald-400/50"
                      placeholder="Ask a precise question…"
                    />

                    <div className="flex justify-end">
                      <button
                        disabled={busy || !askText.trim()}
                        onClick={askInSection}
                        className={cn(
                          "rounded-full px-5 py-2 text-sm font-semibold",
                          busy || !askText.trim()
                            ? "bg-white/10 text-white/40"
                            : "bg-white text-black hover:bg-white/90"
                        )}
                      >
                        Ask
                      </button>
                    </div>
                  </div>

                  {/* Refine answers (separate) */}
                  <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
                    <p className="text-xs text-slate-400 mb-2">
                      Refine answers (one line per answer), then press Refine
                    </p>
                    <textarea
                      value={answersText}
                      onChange={(e) => setAnswersText(e.target.value)}
                      rows={3}
                      className="w-full rounded-2xl border border-slate-800 bg-slate-950/50 px-3 py-2 text-sm outline-none focus:border-emerald-400/50"
                      placeholder="1) I can train 4x/week\n2) Knee is fully recovered"
                    />
                  </div>
                </>
              ) : (
                <p className="text-sm text-slate-400">Generate a camp to unlock the 5-section map + section chat.</p>
              )}
            </>
          )}
        </section>
      </div>
    </main>
  );
}
