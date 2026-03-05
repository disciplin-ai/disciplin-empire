// src/components/SenseiScreen.tsx
"use client";

import React from "react";
import Link from "next/link";

/* ========================= TYPES ========================= */

export type FocusKey = "Pressure" | "Speed" | "Power" | "Recovery" | "Mixed";
export type BaseArt = "MMA" | "Wrestling" | "Boxing" | "Kickboxing" | "Muay Thai" | "BJJ" | "Judo" | "Sambo";

export type CampDirective = {
  title: string;
  source: string;
  bullets: string[];
};

export type TrainingFocus = {
  primary: string[];
  secondary: string[];
  avoid: string[];
};

export type GymCandidate = {
  id: string;
  name: string;
  location?: string;
  compatibility: number; // 0-100
  reason: string[];
  bestFor: string[];
  watchOut: string[];
  href?: string;
};

export type CampControl = {
  trainingLoad: "LOW" | "MODERATE" | "HIGH";
  warnings: string[];
  nextStep: string[];
};

export type AskSectionId = "all" | "directive" | "training" | "gyms" | "control";

export type ChatMessage = {
  id: string;
  role: "user" | "sensei" | "system";
  section: AskSectionId;
  text: string;
  ts: number;
};

/* ========================= UI HELPERS ========================= */

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function Badge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "good" | "warn" | "bad";
}) {
  const cls =
    tone === "good"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
      : tone === "warn"
      ? "border-amber-500/30 bg-amber-500/10 text-amber-200"
      : tone === "bad"
      ? "border-rose-500/30 bg-rose-500/10 text-rose-200"
      : "border-slate-700/60 bg-slate-900/30 text-slate-200/90";

  return <span className={cn("inline-flex items-center rounded-full border px-2.5 py-1 text-xs", cls)}>{children}</span>;
}

function Card({
  title,
  sub,
  right,
  children,
}: {
  title: string;
  sub?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-slate-800/60 bg-slate-950/25 shadow-[0_0_0_1px_rgba(255,255,255,0.02)] backdrop-blur">
      <div className="flex items-start justify-between gap-3 border-b border-slate-800/40 px-5 py-4">
        <div>
          <div className="text-sm font-semibold text-slate-50">{title}</div>
          {sub ? <div className="mt-1 text-xs text-slate-300/70">{sub}</div> : null}
        </div>
        {right}
      </div>
      <div className="px-5 py-5">{children}</div>
    </section>
  );
}

function Bullets({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2 text-sm text-slate-100/90">
      {items.map((b, i) => (
        <li key={i} className="flex gap-2">
          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-300/80" />
          <span>{b}</span>
        </li>
      ))}
    </ul>
  );
}

function loadTone(t: CampControl["trainingLoad"]): "good" | "warn" | "bad" {
  if (t === "LOW") return "good";
  if (t === "MODERATE") return "warn";
  return "bad";
}

/* ========================= COMPONENT ========================= */

export default function SenseiScreen(props: {
  focus: FocusKey;
  setFocus: (v: FocusKey) => void;

  baseArt: BaseArt;
  setBaseArt: (v: BaseArt) => void;

  styleTags: string;
  setStyleTags: (v: string) => void;
  constraints: string;
  setConstraints: (v: string) => void;

  directive: CampDirective | null;
  trainingFocus: TrainingFocus | null;
  gyms: GymCandidate[];
  control: CampControl | null;

  onBuildCamp: () => void;
  onReset: () => void;

  onOpenVision: () => void;

  followupsId?: string | null;
  activeChatSection: AskSectionId;
  setActiveChatSection: (v: AskSectionId) => void;
  chatInput: string;
  setChatInput: (v: string) => void;
  chatSending: boolean;
  chatMessages: ChatMessage[];
  onSendChat: () => void;
  onChatKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;

  busy: boolean;
  statusLabel: string;
  statusTone: "neutral" | "good" | "warn" | "bad";
}) {
  const focusOptions: Array<{ k: FocusKey; desc: string }> = [
    { k: "Pressure", desc: "pace, wall, chain attacks, grind" },
    { k: "Speed", desc: "sharp entries, fast hands, reset discipline" },
    { k: "Power", desc: "explosive actions, low volume, perfect form" },
    { k: "Recovery", desc: "low impact, tissue quality, safe output" },
    { k: "Mixed", desc: "balanced priorities, adapt session-by-session" },
  ];

  const arts: Array<BaseArt> = ["MMA", "Wrestling", "Boxing", "Kickboxing", "Muay Thai", "BJJ", "Judo", "Sambo"];

  const hasCamp = !!props.directive && !!props.trainingFocus && !!props.control;

  const chatTabs: Array<{ id: AskSectionId; label: string }> = [
    { id: "all", label: "All" },
    { id: "directive", label: "Directive" },
    { id: "training", label: "Training" },
    { id: "gyms", label: "Gyms" },
    { id: "control", label: "Control" },
  ];

  const filteredMessages =
    props.activeChatSection === "all"
      ? props.chatMessages
      : props.chatMessages.filter((m) => m.section === props.activeChatSection);

  return (
    <main className="min-h-[calc(100vh-72px)] pt-24 pb-10">
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Badge tone="good">SENSEI</Badge>
            <span className="text-sm text-slate-200/80">Camp control. No analysis. Decisions only.</span>
          </div>

          <div className="flex items-center gap-2">
            <Badge tone={props.statusTone}>{props.statusLabel}</Badge>
            {hasCamp ? <Badge tone="neutral">Camp built</Badge> : <Badge tone="neutral">No camp</Badge>}
            <Link
              href="/dashboard"
              className="rounded-full border border-slate-700/70 bg-slate-950/30 px-3 py-1.5 text-xs text-slate-200/80 hover:bg-slate-900/40"
            >
              Dashboard
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* LEFT */}
          <div className="lg:col-span-5 space-y-6">
            <Card
              title="Inputs"
              sub="Describe your style. Sensei maps Vision findings → training focus → gym decision."
              right={<Badge tone="neutral">Camp builder</Badge>}
            >
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  {focusOptions.map((f) => {
                    const active = props.focus === f.k;
                    return (
                      <button
                        key={f.k}
                        type="button"
                        onClick={() => props.setFocus(f.k)}
                        className={cn(
                          "text-left rounded-2xl border px-4 py-3 transition will-change-transform",
                          "hover:-translate-y-[1px] hover:shadow-[0_10px_30px_-18px_rgba(16,185,129,0.45)]",
                          active
                            ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-100"
                            : "border-slate-800/70 bg-slate-950/30 text-slate-100 hover:bg-slate-900/30"
                        )}
                      >
                        <div className="text-sm font-semibold">{f.k}</div>
                        <div className="mt-1 text-xs text-slate-300/70">{f.desc}</div>
                      </button>
                    );
                  })}
                </div>

                <div>
                  <label className="text-xs text-slate-300/70">Base art</label>
                  <select
                    value={props.baseArt}
                    onChange={(e) => props.setBaseArt(e.target.value as BaseArt)}
                    className="mt-2 w-full rounded-2xl border border-slate-800/70 bg-slate-950/30 px-4 py-3 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-400/20"
                  >
                    {arts.map((a) => (
                      <option key={a} value={a}>
                        {a}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs text-slate-300/70">Style tags (comma separated)</label>
                  <input
                    value={props.styleTags}
                    onChange={(e) => props.setStyleTags(e.target.value)}
                    placeholder='e.g. "pressure wrestler, southpaw, counter"'
                    className="mt-2 w-full rounded-2xl border border-slate-800/70 bg-slate-950/30 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-400/20"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-300/70">Constraints (equipment / injuries / time)</label>
                  <textarea
                    value={props.constraints}
                    onChange={(e) => props.setConstraints(e.target.value)}
                    rows={3}
                    placeholder='e.g. "knee sensitive; no hard pivots; 60 min; no partner today"'
                    className="mt-2 w-full resize-none rounded-2xl border border-slate-800/70 bg-slate-950/30 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-400/20"
                  />
                </div>

                <div className="flex gap-3 pt-1">
                  <button
                    onClick={props.onBuildCamp}
                    disabled={props.busy}
                    className={cn(
                      "rounded-full px-5 py-3 text-sm font-medium transition",
                      !props.busy
                        ? "bg-emerald-400/95 text-slate-950 hover:bg-emerald-300 shadow-[0_0_45px_rgba(52,211,153,0.22)]"
                        : "bg-slate-800/60 text-slate-400 cursor-not-allowed"
                    )}
                  >
                    {props.busy ? "Building…" : "Build camp"}
                  </button>

                  <button
                    onClick={props.onReset}
                    disabled={props.busy}
                    className="rounded-full border border-slate-700/70 bg-slate-950/30 px-5 py-3 text-sm font-medium text-slate-100 hover:bg-slate-900/40 disabled:opacity-60"
                  >
                    Reset
                  </button>

                  <button
                    onClick={props.onOpenVision}
                    className="ml-auto rounded-full border border-slate-700/70 bg-slate-950/30 px-5 py-3 text-sm font-medium text-slate-100 hover:bg-slate-900/40"
                  >
                    Open Vision →
                  </button>
                </div>

                <div className="text-xs text-slate-300/60">
                  Rule: Sensei doesn’t analyze. If Vision is empty, decisions are generic.
                </div>
              </div>
            </Card>

            <Card
              title="Gym decision"
              sub="One pick. One reason. Commit."
              right={
                <Badge tone={props.gyms.length ? "good" : "neutral"}>
                  {props.gyms.length ? "Decided" : "Waiting"}
                </Badge>
              }
            >
              {props.gyms.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-800/70 bg-slate-950/20 p-6 text-sm text-slate-300/70">
                  Build camp to generate a decision. (Later: read from your real gyms DB.)
                </div>
              ) : (
                <div className="space-y-3">
                  {/* ✅ IMPORTANT: render ONLY the top 1 */}
                  {props.gyms.slice(0, 1).map((g) => (
                    <div key={g.id} className="rounded-2xl border border-slate-800/60 bg-slate-950/25 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-slate-50">{g.name}</div>
                          <div className="mt-1 text-xs text-slate-300/70">{g.location ?? "Location not set"}</div>
                        </div>
                        <Badge tone={g.compatibility >= 90 ? "good" : g.compatibility >= 80 ? "warn" : "neutral"}>
                          {g.compatibility}% match
                        </Badge>
                      </div>

                      <div className="mt-3 grid gap-4 md:grid-cols-2">
                        <div>
                          <div className="text-[11px] tracking-[0.22em] uppercase text-slate-400/70">Reason</div>
                          <div className="mt-2">
                            <Bullets items={g.reason} />
                          </div>
                        </div>
                        <div>
                          <div className="text-[11px] tracking-[0.22em] uppercase text-slate-400/70">Best for</div>
                          <div className="mt-2">
                            <Bullets items={g.bestFor} />
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 rounded-xl border border-slate-800/60 bg-slate-950/30 p-3">
                        <div className="text-[11px] tracking-[0.22em] uppercase text-slate-400/70">Watch out</div>
                        <div className="mt-2">
                          <Bullets items={g.watchOut} />
                        </div>
                      </div>

                      {g.href ? (
                        <div className="mt-3">
                          <Link className="text-xs text-emerald-200 underline" href={g.href}>
                            Open gym profile →
                          </Link>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          {/* RIGHT */}
          <div className="lg:col-span-7 space-y-6">
            <Card
              title="Camp directive"
              sub="Top command for the next 7 days."
              right={props.directive ? <Badge tone="good">Set</Badge> : <Badge tone="neutral">Unset</Badge>}
            >
              {!props.directive ? (
                <div className="rounded-2xl border border-dashed border-slate-800/70 bg-slate-950/20 p-6 text-sm text-slate-300/70">
                  No directive yet. Run Sensei Vision then Build camp.
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="rounded-2xl border border-slate-800/60 bg-slate-950/25 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-slate-50">{props.directive.title}</div>
                        <div className="mt-1 text-xs text-slate-300/70">{props.directive.source}</div>
                      </div>
                      <Badge tone="neutral">Directive</Badge>
                    </div>
                    <div className="mt-3">
                      <Bullets items={props.directive.bullets} />
                    </div>
                  </div>
                </div>
              )}
            </Card>

            <Card
              title="Training focus"
              sub="Built from Vision findings + your focus."
              right={props.trainingFocus ? <Badge tone="good">Ready</Badge> : <Badge tone="neutral">Waiting</Badge>}
            >
              {!props.trainingFocus ? (
                <div className="rounded-2xl border border-dashed border-slate-800/70 bg-slate-950/20 p-6 text-sm text-slate-300/70">
                  Build camp to generate a concrete training focus.
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="rounded-2xl border border-slate-800/60 bg-slate-950/25 p-4">
                    <div className="text-[11px] tracking-[0.22em] uppercase text-slate-400/70">Primary</div>
                    <div className="mt-2">
                      <Bullets items={props.trainingFocus.primary} />
                    </div>
                  </div>
                  <div className="rounded-2xl border border-slate-800/60 bg-slate-950/25 p-4">
                    <div className="text-[11px] tracking-[0.22em] uppercase text-slate-400/70">Secondary</div>
                    <div className="mt-2">
                      <Bullets items={props.trainingFocus.secondary} />
                    </div>
                  </div>
                  <div className="rounded-2xl border border-slate-800/60 bg-slate-950/25 p-4">
                    <div className="text-[11px] tracking-[0.22em] uppercase text-slate-400/70">Avoid</div>
                    <div className="mt-2">
                      <Bullets items={props.trainingFocus.avoid} />
                    </div>
                  </div>
                </div>
              )}
            </Card>

            <Card
              title="Camp control"
              sub="Load, warnings, next step."
              right={
                props.control ? (
                  <Badge tone={loadTone(props.control.trainingLoad)}>{props.control.trainingLoad}</Badge>
                ) : (
                  <Badge tone="neutral">Unset</Badge>
                )
              }
            >
              {!props.control ? (
                <div className="rounded-2xl border border-dashed border-slate-800/70 bg-slate-950/20 p-6 text-sm text-slate-300/70">
                  Build camp to set training load and next step.
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-slate-800/60 bg-slate-950/25 p-4">
                    <div className="text-[11px] tracking-[0.22em] uppercase text-slate-400/70">Warnings</div>
                    <div className="mt-2">
                      <Bullets items={props.control.warnings} />
                    </div>
                  </div>

                  <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                    <div className="text-[11px] tracking-[0.22em] uppercase text-emerald-200/80">Next step</div>
                    <div className="mt-2">
                      <Bullets items={props.control.nextStep} />
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <Link className="text-xs text-emerald-200 underline" href="/sensei-vision">
                      Run Vision again →
                    </Link>
                    <Link className="text-xs text-slate-200/80 underline" href="/fuel">
                      Open Fuel →
                    </Link>
                  </div>
                </div>
              )}
            </Card>

            {/* CHAT */}
            <Card
              title="Sensei Chat"
              sub={props.followupsId ? "Ask about camp decisions. Short, concrete." : "Build camp to unlock context."}
              right={<Badge tone={props.followupsId ? "good" : "warn"}>{props.followupsId ? "Unlocked" : "Locked"}</Badge>}
            >
              <div className="flex flex-wrap gap-2">
                {chatTabs.map((t) => {
                  const active = t.id === props.activeChatSection;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => props.setActiveChatSection(t.id)}
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-xs transition",
                        active
                          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
                          : "border-slate-800/70 bg-slate-950/30 text-slate-200/80 hover:bg-slate-900/30"
                      )}
                    >
                      {t.label}
                    </button>
                  );
                })}
              </div>

              <div className="mt-4 max-h-[320px] overflow-y-auto rounded-2xl border border-slate-800/60 bg-slate-950/25 p-4 space-y-3">
                {filteredMessages.length === 0 ? <div className="text-sm text-slate-300/70">No messages yet.</div> : null}

                {filteredMessages.map((m) => (
                  <div
                    key={m.id}
                    className={cn(
                      "rounded-2xl border p-3",
                      m.role === "user"
                        ? "border-emerald-500/20 bg-emerald-500/10"
                        : m.role === "sensei"
                        ? "border-slate-800/70 bg-slate-950/35"
                        : "border-amber-500/20 bg-amber-500/10"
                    )}
                  >
                    <div className="mb-1 flex items-center justify-between">
                      <div className="text-[11px] tracking-[0.22em] uppercase text-slate-400/70">
                        {m.role === "user" ? "User" : m.role === "sensei" ? "Sensei" : "System"}
                      </div>
                      <div className="text-[11px] text-slate-400/60">{m.section.toUpperCase()}</div>
                    </div>
                    <div className="whitespace-pre-wrap text-sm text-slate-100/90">{m.text}</div>
                  </div>
                ))}
              </div>

              <div className="mt-4 flex gap-2">
                <textarea
                  value={props.chatInput}
                  onChange={(e) => props.setChatInput(e.target.value)}
                  onKeyDown={props.onChatKeyDown}
                  placeholder={props.followupsId ? "Ask about camp decisions…" : "Build camp first…"}
                  disabled={!props.followupsId}
                  rows={2}
                  className="w-full resize-none rounded-2xl border border-slate-800/70 bg-slate-950/30 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-400/20 disabled:opacity-60"
                />
                <button
                  onClick={props.onSendChat}
                  disabled={!props.followupsId || !(props.chatInput.trim().length > 0) || props.chatSending}
                  className={cn(
                    "rounded-2xl px-5 text-sm font-medium transition",
                    props.followupsId && props.chatInput.trim().length > 0 && !props.chatSending
                      ? "bg-emerald-400/95 text-slate-950 hover:bg-emerald-300"
                      : "bg-slate-800/60 text-slate-400 cursor-not-allowed"
                  )}
                >
                  {props.chatSending ? "…" : "Send"}
                </button>
              </div>

              <div className="mt-2 text-xs text-slate-300/60">
                Ask like a coach: “Given Vision finding #1, what do we cut from sparring this week?”
              </div>
            </Card>
          </div>
        </div>
      </div>
    </main>
  );
}