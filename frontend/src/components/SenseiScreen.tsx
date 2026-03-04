"use client";

import React, { useMemo, useState } from "react";

/* ========================= TYPES ========================= */

export type FocusKey = "Pressure" | "Speed" | "Power" | "Recovery" | "Mixed";

export type BaseArt =
  | "MMA"
  | "Wrestling"
  | "Boxing"
  | "Kickboxing"
  | "Muay Thai"
  | "BJJ"
  | "Judo"
  | "Sambo";

export type IntegrationMode = "SEPARATE" | "INTEGRATE";

export type CampSectionKey = "Overview" | "Training" | "Nutrition" | "Recovery" | "Questions";

export type SectionBlock = { title: string; bullets: string[] };

export type CampModel = {
  campName: string;
  weekLabel: string;
  intensityTag: "LOW" | "MODERATE" | "HIGH" | "MAX";
  days: any[];
  sections: Record<CampSectionKey, SectionBlock[]>;
};

export type LoadingStage =
  | "IDLE"
  | "BUILDING_SCENARIO"
  | "SENDING_REQUEST"
  | "WAITING_OPENAI"
  | "PARSING_RESPONSE"
  | "DONE"
  | "ERROR";

export type AskSectionId = "all" | "overview" | "training" | "recovery" | "nutrition" | "questions";

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

function stageLabel(stage?: LoadingStage) {
  switch (stage) {
    case "BUILDING_SCENARIO":
      return "Building scenario…";
    case "SENDING_REQUEST":
      return "Packaging blocks…";
    case "WAITING_OPENAI":
      return "Thinking…";
    case "PARSING_RESPONSE":
      return "Parsing output…";
    case "DONE":
      return "Ready";
    case "ERROR":
      return "Error";
    case "IDLE":
    default:
      return "Idle";
  }
}

function stageProgress(stage?: LoadingStage) {
  switch (stage) {
    case "BUILDING_SCENARIO":
      return 22;
    case "SENDING_REQUEST":
      return 42;
    case "WAITING_OPENAI":
      return 68;
    case "PARSING_RESPONSE":
      return 86;
    case "DONE":
      return 100;
    case "ERROR":
      return 100;
    default:
      return 0;
  }
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
      ? "border-red-500/30 bg-red-500/10 text-red-200"
      : "border-slate-700/60 bg-slate-900/30 text-slate-200/90";

  return (
    <span className={cn("inline-flex items-center rounded-full border px-2.5 py-1 text-xs", cls)}>
      {children}
    </span>
  );
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

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-px flex-1 bg-slate-800/50" />
      <div className="text-[11px] tracking-[0.22em] uppercase text-slate-400/70">{children}</div>
      <div className="h-px flex-1 bg-slate-800/50" />
    </div>
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

const OUTPUT_TABS: Array<{ key: CampSectionKey; label: string }> = [
  { key: "Overview", label: "Overview" },
  { key: "Training", label: "Training" },
  { key: "Recovery", label: "Recovery / safety" },
  { key: "Nutrition", label: "Nutrition" },
  { key: "Questions", label: "Questions" },
];

const FOCUS_ICONS: Record<FocusKey, string> = {
  Pressure: "⛓️",
  Speed: "⚡",
  Power: "💥",
  Recovery: "🛡️",
  Mixed: "🧩",
};

/* ========================= COMPONENT ========================= */

export default function SenseiScreen(props: {
  focus: FocusKey;
  setFocus: (v: FocusKey) => void;

  primaryArt: BaseArt;
  setPrimaryArt: (v: BaseArt) => void;

  secondaryArt: BaseArt | "None";
  setSecondaryArt: (v: BaseArt | "None") => void;

  integrationMode: IntegrationMode;
  setIntegrationMode: (v: IntegrationMode) => void;

  goal: string;
  setGoal: (v: string) => void;

  constraints: string;
  setConstraints: (v: string) => void;

  injuries: string;
  setInjuries: (v: string) => void;

  timeAvailable: string;
  setTimeAvailable: (v: string) => void;

  loading: boolean;
  loadingStage?: LoadingStage;
  canGenerate: boolean;
  onGenerate: () => void;
  onReset: () => void;

  model: CampModel | null;

  followupsId?: string | null;
  activeChatSection: AskSectionId;
  setActiveChatSection: (v: AskSectionId) => void;

  chatInput?: string;
  setChatInput: (v: string) => void;

  chatSending: boolean;
  chatMessages?: ChatMessage[];

  onSendChat: () => void;
  onChatKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
}) {
  const [activeOutput, setActiveOutput] = useState<CampSectionKey>("Overview");

  const focusOptions: Array<{ k: FocusKey; desc: string }> = [
    { k: "Pressure", desc: "wrestling pace, cage work, cardio warfare" },
    { k: "Speed", desc: "sharp entries, fast hands, reset discipline" },
    { k: "Power", desc: "explosive shots, low volume, perfect form" },
    { k: "Recovery", desc: "low impact, tissue quality, safe output" },
    { k: "Mixed", desc: "balanced striking + grappling priorities" },
  ];

  const arts: Array<BaseArt> = ["MMA", "Wrestling", "Boxing", "Kickboxing", "Muay Thai", "BJJ", "Judo", "Sambo"];

  const chatInput = props.chatInput ?? "";
  const chatMessages = props.chatMessages ?? [];

  const stage = props.loading ? stageLabel(props.loadingStage) : props.model ? "Ready" : "Idle";
  const tone =
    props.loadingStage === "ERROR"
      ? "bad"
      : props.loading
      ? "warn"
      : props.model
      ? "good"
      : "neutral";

  const progress = props.loading ? stageProgress(props.loadingStage) : 0;

  const chatTabs: Array<{ id: AskSectionId; label: string }> = [
    { id: "all", label: "All" },
    { id: "overview", label: "Overview" },
    { id: "training", label: "Training" },
    { id: "recovery", label: "Recovery" },
    { id: "nutrition", label: "Nutrition" },
    { id: "questions", label: "Questions" },
  ];

  const filteredMessages =
    props.activeChatSection === "all" ? chatMessages : chatMessages.filter((m) => m.section === props.activeChatSection);

  const outputGlow =
    props.loading && (props.loadingStage === "WAITING_OPENAI" || props.loadingStage === "PARSING_RESPONSE");

  const activeBlocks = useMemo(() => {
    const m = props.model;
    if (!m) return [];
    return m.sections?.[activeOutput] ?? [];
  }, [props.model, activeOutput]);

  const outputPlaceholders = useMemo(() => {
    // Always show *something* so it doesn’t look empty.
    const map: Record<CampSectionKey, Array<{ title: string; bullets: string[] }>> = {
      Overview: [
        { title: "Session aim", bullets: ["One focus. One constraint. One output.", "No essays. Only execution."] },
        { title: "Cost", bullets: ["Cost: the specific failure you’re paying for if you ignore this."] },
      ],
      Training: [
        { title: "Block 1 — Primer", bullets: ["3–5 min: specific movement + entry reps.", "Keep it clean."] },
        { title: "Block 2 — Main", bullets: ["2–4 rounds: timers + reps + constraint.", "No drifting."] },
        { title: "Block 3 — Finish", bullets: ["Short conditioning / skill under fatigue.", "Stop before form breaks."] },
      ],
      Recovery: [
        { title: "Safety limits", bullets: ["Injury-aware constraints.", "Hard stop conditions."] },
        { title: "Cooldown", bullets: ["Breathing + joint reset + light tissue work."] },
      ],
      Nutrition: [
        { title: "Fuel", bullets: ["Pre: simple carbs + water.", "Post: protein + salt + fluids."] },
      ],
      Questions: [
        { title: "Tighten", bullets: ["Ask one variable.", "Get one answer.", "Execute."] },
      ],
    };
    return map[activeOutput];
  }, [activeOutput]);

  const showPreview = !props.model && !props.loading;

  const sessionIntel = useMemo(() => {
    const sec = props.secondaryArt === "None" ? "" : ` + ${props.secondaryArt}`;
    const integ = props.integrationMode === "INTEGRATE" ? "Integrate" : "Separate";
    const t = props.timeAvailable?.trim() ? props.timeAvailable.trim() : "—";
    const c = props.constraints?.trim() ? "Yes" : "No";
    const i = props.injuries?.trim() ? "Yes" : "No";
    return { sec, integ, t, c, i };
  }, [props.secondaryArt, props.integrationMode, props.timeAvailable, props.constraints, props.injuries]);

  return (
    <main className="min-h-[calc(100vh-72px)] pt-24 pb-10">
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Badge tone="good">SENSEI</Badge>
            <span className="text-sm text-slate-200/80">Short. Specific. Built for serious training.</span>
          </div>

          <div className="flex items-center gap-2">
            <Badge tone={tone}>{stage}</Badge>
            {props.model ? <Badge tone="neutral">{props.model.weekLabel}</Badge> : null}
            {props.model ? <Badge tone="warn">{props.model.intensityTag}</Badge> : null}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* LEFT */}
          <div className="lg:col-span-5 space-y-6">
            <Card title="Inputs" sub="Build in 10 seconds. One focus. One session." right={<Badge tone="neutral">Session build</Badge>}>
              <div className="space-y-5">
                <SectionLabel>FOCUS</SectionLabel>

                <div className="grid grid-cols-2 gap-3">
                  {focusOptions.map((f) => {
                    const active = props.focus === f.k;

                    return (
                      <button
                        key={f.k}
                        type="button"
                        onClick={() => props.setFocus(f.k)}
                        className={cn(
                          "group text-left rounded-2xl border px-4 py-3 transition will-change-transform",
                          "hover:-translate-y-[1px]",
                          active
                            ? cn(
                                "border-emerald-400/50 bg-emerald-500/10 text-emerald-50",
                                "shadow-[0_0_0_1px_rgba(52,211,153,0.25),0_18px_50px_rgba(16,185,129,0.18)]"
                              )
                            : "border-slate-800/70 bg-slate-950/30 text-slate-100 hover:bg-slate-900/30"
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <div className="text-sm font-semibold">
                            <span className="mr-2">{FOCUS_ICONS[f.k]}</span>
                            {f.k}
                          </div>
                          {active ? (
                            <span className="text-[11px] rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2 py-1 text-emerald-200">
                              ACTIVE
                            </span>
                          ) : (
                            <span className="text-[11px] text-slate-400/70 group-hover:text-slate-300/80">Select</span>
                          )}
                        </div>
                        <div className="mt-1 text-xs text-slate-300/70">{f.desc}</div>
                      </button>
                    );
                  })}
                </div>

                <SectionLabel>SESSION CONTEXT</SectionLabel>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-300/70">Primary base</label>
                    <select
                      value={props.primaryArt}
                      onChange={(e) => props.setPrimaryArt(e.target.value as BaseArt)}
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
                    <label className="text-xs text-slate-300/70">Secondary (optional)</label>
                    <select
                      value={props.secondaryArt}
                      onChange={(e) => props.setSecondaryArt(e.target.value as any)}
                      className="mt-2 w-full rounded-2xl border border-slate-800/70 bg-slate-950/30 px-4 py-3 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-400/20"
                    >
                      <option value="None">None</option>
                      {arts
                        .filter((a) => a !== props.primaryArt)
                        .map((a) => (
                          <option key={a} value={a}>
                            {a}
                          </option>
                        ))}
                    </select>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-800/60 bg-slate-950/25 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-50">Integration</div>
                      <div className="mt-1 text-xs text-slate-300/70">
                        Separate = keep base pure. Integrate = blend when relevant.
                      </div>
                    </div>
                    <div className="flex rounded-full border border-slate-800/70 bg-slate-950/30 p-1">
                      <button
                        type="button"
                        onClick={() => props.setIntegrationMode("SEPARATE")}
                        className={cn(
                          "rounded-full px-3 py-2 text-xs transition",
                          props.integrationMode === "SEPARATE"
                            ? "bg-emerald-500/15 text-emerald-200 border border-emerald-500/30"
                            : "text-slate-300/80"
                        )}
                      >
                        Separate
                      </button>
                      <button
                        type="button"
                        onClick={() => props.setIntegrationMode("INTEGRATE")}
                        className={cn(
                          "rounded-full px-3 py-2 text-xs transition",
                          props.integrationMode === "INTEGRATE"
                            ? "bg-emerald-500/15 text-emerald-200 border border-emerald-500/30"
                            : "text-slate-300/80"
                        )}
                      >
                        Integrate
                      </button>
                    </div>
                  </div>
                </div>

                <SectionLabel>CONDITIONS</SectionLabel>

                <div>
                  <label className="text-xs text-slate-300/70">Goal (1 sentence)</label>
                  <input
                    value={props.goal}
                    onChange={(e) => props.setGoal(e.target.value)}
                    placeholder='e.g. "Chain wrestle under fatigue without form collapse."'
                    className="mt-2 w-full rounded-2xl border border-slate-800/70 bg-slate-950/30 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-400/20"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-300/70">Injuries / limitations</label>
                  <textarea
                    value={props.injuries}
                    onChange={(e) => props.setInjuries(e.target.value)}
                    placeholder='e.g. "Knee sensitive; no hard pivots."'
                    rows={3}
                    className="mt-2 w-full resize-none rounded-2xl border border-slate-800/70 bg-slate-950/30 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-400/20"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-300/70">Time available</label>
                    <input
                      value={props.timeAvailable}
                      onChange={(e) => props.setTimeAvailable(e.target.value)}
                      placeholder='e.g. "60 min"'
                      className="mt-2 w-full rounded-2xl border border-slate-800/70 bg-slate-950/30 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-400/20"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-300/70">Constraints</label>
                    <input
                      value={props.constraints}
                      onChange={(e) => props.setConstraints(e.target.value)}
                      placeholder='e.g. "No partner. Bag only."'
                      className="mt-2 w-full rounded-2xl border border-slate-800/70 bg-slate-950/30 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-400/20"
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-1">
                  <button
                    onClick={props.onGenerate}
                    disabled={!props.canGenerate}
                    className={cn(
                      "relative rounded-full px-5 py-3 text-sm font-semibold transition",
                      props.canGenerate
                        ? cn(
                            "bg-emerald-400/95 text-slate-950 hover:bg-emerald-300",
                            "shadow-[0_0_0_1px_rgba(52,211,153,0.25),0_22px_60px_rgba(16,185,129,0.18)]"
                          )
                        : "bg-slate-800/60 text-slate-400 cursor-not-allowed"
                    )}
                  >
                    {props.loading ? "Generating…" : "Generate Session"}
                    {props.canGenerate && !props.loading ? (
                      <span className="pointer-events-none absolute inset-0 rounded-full ring-1 ring-emerald-300/25" />
                    ) : null}
                  </button>

                  <button
                    onClick={props.onReset}
                    disabled={props.loading}
                    className="rounded-full border border-slate-700/70 bg-slate-950/30 px-5 py-3 text-sm font-medium text-slate-100 hover:bg-slate-900/40 disabled:opacity-50"
                  >
                    Reset
                  </button>
                </div>

                <div className="text-xs text-slate-300/60">Rule: one focus. One session. One non-negotiable.</div>
              </div>
            </Card>
          </div>

          {/* RIGHT */}
          <div className="lg:col-span-7 space-y-6">
            <Card
              title="Output"
              sub={
                props.loading
                  ? "Generating action blocks…"
                  : props.model
                  ? "Action blocks. No fluff."
                  : "Preview is visible. Generate to lock it to your inputs."
              }
              right={props.model ? <Badge tone="good">Ready</Badge> : <Badge tone="neutral">Waiting</Badge>}
            >
              {/* Session Intelligence */}
              <div className="mb-4 rounded-2xl border border-slate-800/60 bg-slate-950/25 p-4">
                <div className="text-[11px] tracking-[0.22em] uppercase text-slate-400/70">Session intelligence</div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-200/80">
                  <div className="rounded-xl border border-slate-800/60 bg-slate-950/30 px-3 py-2">
                    Focus: <span className="text-slate-50">{props.focus}</span>
                  </div>
                  <div className="rounded-xl border border-slate-800/60 bg-slate-950/30 px-3 py-2">
                    Base: <span className="text-slate-50">{props.primaryArt}{sessionIntel.sec}</span>
                  </div>
                  <div className="rounded-xl border border-slate-800/60 bg-slate-950/30 px-3 py-2">
                    Mode: <span className="text-slate-50">{sessionIntel.integ}</span>
                  </div>
                  <div className="rounded-xl border border-slate-800/60 bg-slate-950/30 px-3 py-2">
                    Time: <span className="text-slate-50">{sessionIntel.t}</span>
                  </div>
                  <div className="rounded-xl border border-slate-800/60 bg-slate-950/30 px-3 py-2">
                    Constraints: <span className="text-slate-50">{sessionIntel.c}</span>
                  </div>
                  <div className="rounded-xl border border-slate-800/60 bg-slate-950/30 px-3 py-2">
                    Injuries: <span className="text-slate-50">{sessionIntel.i}</span>
                  </div>
                </div>
              </div>

              {/* Output section tabs */}
              <div className="flex flex-wrap gap-2 mb-4">
                {OUTPUT_TABS.map((t) => {
                  const active = t.key === activeOutput;
                  return (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => setActiveOutput(t.key)}
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

              {/* Loading ritual */}
              {props.loading ? (
                <div
                  className={cn(
                    "rounded-2xl border border-slate-800/60 bg-slate-950/25 p-5",
                    outputGlow && "shadow-[0_0_80px_rgba(52,211,153,0.12)]"
                  )}
                >
                  <div className="text-xs tracking-[0.22em] uppercase text-slate-400/70">SENSEI</div>
                  <div className="mt-2 text-sm font-semibold text-slate-50">{stageLabel(props.loadingStage)}</div>
                  <div className="mt-3 h-2 w-full overflow-hidden rounded-full border border-slate-800/60 bg-slate-950/50">
                    <div
                      className={cn(
                        "h-full rounded-full bg-emerald-400/80 transition-all duration-300",
                        props.loadingStage === "WAITING_OPENAI" && "animate-pulse"
                      )}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <div className="mt-3 text-xs text-slate-300/60">Tabs stay. Output snaps into the selected section.</div>
                </div>
              ) : null}

              {/* Preview state (NOT empty) */}
              {showPreview ? (
                <div className="rounded-2xl border border-slate-800/60 bg-slate-950/25 p-4">
                  <div className="text-xs tracking-[0.22em] uppercase text-slate-400/70">
                    {OUTPUT_TABS.find((t) => t.key === activeOutput)?.label}
                  </div>

                  <div className="mt-3 max-h-[560px] overflow-auto pr-1 space-y-4 opacity-[0.88]">
                    {outputPlaceholders.map((b, i) => (
                      <div key={i} className="rounded-xl border border-slate-800/60 bg-slate-950/30 p-3">
                        <div className="text-sm font-semibold text-slate-50/90">{b.title}</div>
                        <div className="mt-2">
                          <Bullets items={(b.bullets ?? []).slice(0, 12)} />
                        </div>
                      </div>
                    ))}
                    <div className="text-xs text-slate-300/60">
                      Tip: enter a goal (8+ chars) → Generate Session. Output becomes specific.
                    </div>
                  </div>
                </div>
              ) : null}

              {/* Model state */}
              {props.model ? (
                <div className="rounded-2xl border border-slate-800/60 bg-slate-950/25 p-4">
                  <div className="text-xs tracking-[0.22em] uppercase text-slate-400/70">
                    {OUTPUT_TABS.find((t) => t.key === activeOutput)?.label}
                  </div>

                  <div className="mt-3 max-h-[560px] overflow-auto pr-1 space-y-4">
                    {activeBlocks.length === 0 ? (
                      <div className="rounded-xl border border-slate-800/60 bg-slate-950/30 p-4 text-sm text-slate-300/70">
                        No blocks returned for {activeOutput}. (If this persists, it’s an API content issue.)
                      </div>
                    ) : (
                      activeBlocks.map((b, i) => (
                        <div key={i} className="rounded-xl border border-slate-800/60 bg-slate-950/30 p-3">
                          <div className="text-sm font-semibold text-slate-50">{b.title}</div>
                          <div className="mt-2">
                            <Bullets items={(b.bullets ?? []).slice(0, 12)} />
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ) : null}
            </Card>

            {/* CHAT */}
            <Card
              title="Sensei Chat"
              sub={props.followupsId ? "Ask anything about this session. Short answers. Concrete steps." : "Build a session first. Then ask Sensei anything about it."}
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
                {filteredMessages.length === 0 && !props.followupsId ? (
                  <div className="text-sm text-slate-300/70">Build a session first, then ask.</div>
                ) : null}

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
                  value={chatInput}
                  onChange={(e) => props.setChatInput(e.target.value)}
                  onKeyDown={props.onChatKeyDown}
                  placeholder={props.followupsId ? "Ask one specific variable…" : "Build a session first…"}
                  disabled={!props.followupsId}
                  rows={2}
                  className="w-full resize-none rounded-2xl border border-slate-800/70 bg-slate-950/30 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-400/20 disabled:opacity-60"
                />
                <button
                  onClick={props.onSendChat}
                  disabled={!props.followupsId || !(chatInput.trim().length > 0) || props.chatSending}
                  className={cn(
                    "rounded-2xl px-5 text-sm font-medium transition",
                    props.followupsId && chatInput.trim().length > 0 && !props.chatSending
                      ? "bg-emerald-400/95 text-slate-950 hover:bg-emerald-300"
                      : "bg-slate-800/60 text-slate-400 cursor-not-allowed"
                  )}
                >
                  {props.chatSending ? "…" : "Send"}
                </button>
              </div>

              <div className="mt-2 text-xs text-slate-300/60">
                Tip: ask like a coach. “My shots die after first contact — fix entry chain in 20 minutes.”
              </div>
            </Card>
          </div>
        </div>
      </div>
    </main>
  );
}