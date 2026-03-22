"use client";

import React from "react";
import Link from "next/link";

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

export type BuildStage =
  | "IDLE"
  | "READING_CONTEXT"
  | "SETTING_DIRECTIVE"
  | "BUILDING_TRAINING"
  | "SETTING_CONTROL"
  | "RANKING_GYMS"
  | "DONE"
  | "ERROR";

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
  location: string;
  compatibility: number;
  reason: string[];
  bestFor: string[];
  watchOut: string[];
  href?: string;
  verified: boolean;
};

export type CampControl = {
  trainingLoad: "LOW" | "MODERATE" | "HIGH";
  warnings: string[];
  nextStep: string[];
};

export type DailySession = {
  title: string;
  durationMin: number;
  timingLabel: string;
  goal: string;
  blocks: string[];
};

export type ChecklistItem = {
  id: string;
  label: string;
  done: boolean;
};

export type SenseiSystemStatus = {
  visionConnected: boolean;
  visionLabel: string;
  fuelConnected: boolean;
  fuelLabel: string;
  campSaved: boolean;
  campLabel: string;
};

export type AskSectionId =
  | "all"
  | "overview"
  | "training"
  | "nutrition"
  | "recovery"
  | "questions";

export type ChatMessage = {
  id: string;
  role: "system" | "user" | "sensei";
  section: AskSectionId;
  text: string;
  ts: number;
};

type SenseiScreenProps = {
  focus: FocusKey;
  setFocus: (value: FocusKey) => void;
  baseArt: BaseArt;
  setBaseArt: (value: BaseArt) => void;
  styleTags: string;
  setStyleTags: (value: string) => void;
  constraints: string;
  setConstraints: (value: string) => void;

  directive: CampDirective | null;
  trainingFocus: TrainingFocus | null;
  gyms: GymCandidate[];
  control: CampControl | null;
  systemStatus: SenseiSystemStatus;
  dailySession: DailySession | null;
  checklist: ChecklistItem[];

  onToggleChecklistItem: (id: string) => void;
  onBuildCamp: () => void;
  onReset: () => void;
  onOpenVision: () => void;
  onOpenFuel: () => void;

  followupsId: string | null;
  activeChatSection: AskSectionId;
  setActiveChatSection: (value: AskSectionId) => void;
  chatInput: string;
  setChatInput: (value: string) => void;
  chatSending: boolean;
  chatMessages: ChatMessage[];
  onSendChat: () => void;
  onChatKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;

  busy: boolean;
  buildStage: BuildStage;
  statusLabel: "Idle" | "Building" | "Ready" | "Error";
  statusTone: "neutral" | "good" | "warn" | "bad";
};

const FOCUS_OPTIONS: FocusKey[] = [
  "Pressure",
  "Speed",
  "Power",
  "Recovery",
  "Mixed",
];

const BASE_ART_OPTIONS: BaseArt[] = [
  "MMA",
  "Wrestling",
  "Boxing",
  "Kickboxing",
  "Muay Thai",
  "BJJ",
  "Judo",
  "Sambo",
];

const CHAT_SECTIONS: AskSectionId[] = [
  "all",
  "overview",
  "training",
  "nutrition",
  "recovery",
  "questions",
];

const CHAT_SECTION_LABELS: Record<AskSectionId, string> = {
  all: "All",
  overview: "Overview",
  training: "Training",
  nutrition: "Nutrition",
  recovery: "Recovery",
  questions: "Decisions",
};

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function SectionCard({
  title,
  subtitle,
  right,
  children,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-slate-800/60 bg-slate-950/25 shadow-[0_0_0_1px_rgba(255,255,255,0.02)] backdrop-blur">
      <div className="flex items-start justify-between gap-4 border-b border-slate-800/50 px-4 py-4 sm:px-5">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-slate-50">{title}</div>
          {subtitle ? (
            <div className="mt-1 text-xs text-slate-300/70">{subtitle}</div>
          ) : null}
        </div>
        {right ? <div className="shrink-0">{right}</div> : null}
      </div>
      <div className="px-4 py-4 sm:px-5 sm:py-5">{children}</div>
    </section>
  );
}

function Badge({
  label,
  tone = "neutral",
}: {
  label: string;
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

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-xs",
        cls
      )}
    >
      {label}
    </span>
  );
}

function PillButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-2 text-xs sm:text-sm transition",
        active
          ? "border-emerald-400/60 bg-emerald-500/15 text-emerald-100"
          : "border-slate-700/80 bg-slate-950/40 text-slate-200 hover:bg-slate-900/50"
      )}
    >
      {label}
    </button>
  );
}

function MiniStat({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-800/60 bg-slate-950/25 p-3">
      <div className="text-[11px] uppercase tracking-[0.22em] text-slate-400/70">
        {label}
      </div>
      <div className="mt-2 text-sm font-semibold text-slate-50">{value}</div>
    </div>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2 text-sm text-slate-100/90">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2">
          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-300/80" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function StatusRow({
  label,
  value,
  active,
}: {
  label: string;
  value: string;
  active: boolean;
}) {
  return (
    <div className="rounded-2xl border border-slate-800/60 bg-slate-950/25 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-medium text-slate-50">{label}</div>
        <Badge label={active ? "Connected" : "Missing"} tone={active ? "good" : "warn"} />
      </div>
      <div className="mt-2 text-xs text-slate-300/75">{value}</div>
    </div>
  );
}

function ChatBubble({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === "user";
  const isSensei = msg.role === "sensei";

  return (
    <div
      className={cn(
        "w-[96%] rounded-2xl border px-3 py-3 text-[13px] leading-6 whitespace-pre-wrap sm:w-[94%] sm:px-4 sm:text-sm sm:leading-6",
        isUser
          ? "ml-auto border-emerald-500/25 bg-emerald-500/10 text-emerald-50"
          : isSensei
          ? "border-slate-700/70 bg-slate-900/50 text-slate-100"
          : "border-slate-800/70 bg-slate-950/30 text-slate-300"
      )}
    >
      <div className="mb-1.5 text-[10px] uppercase tracking-[0.2em] text-slate-400/70">
        {msg.role === "user" ? "You" : msg.role === "sensei" ? "Sensei" : "System"}
      </div>
      <div className="break-words">{msg.text}</div>
    </div>
  );
}

function sortMessagesByTime(messages: ChatMessage[]) {
  return [...messages].sort((a, b) => a.ts - b.ts);
}

export default function SenseiScreen({
  focus,
  setFocus,
  baseArt,
  setBaseArt,
  styleTags,
  setStyleTags,
  constraints,
  setConstraints,
  directive,
  trainingFocus,
  gyms,
  control,
  systemStatus,
  dailySession,
  checklist,
  onToggleChecklistItem,
  onBuildCamp,
  onReset,
  onOpenVision,
  onOpenFuel,
  followupsId,
  activeChatSection,
  setActiveChatSection,
  chatInput,
  setChatInput,
  chatSending,
  chatMessages,
  onSendChat,
  onChatKeyDown,
  busy,
  buildStage,
  statusLabel,
  statusTone,
}: SenseiScreenProps) {
  const visibleMessages =
    activeChatSection === "all"
      ? sortMessagesByTime(chatMessages)
      : sortMessagesByTime(
          chatMessages.filter(
            (msg) => msg.role === "system" || msg.section === activeChatSection
          )
        );

  return (
    <main className="min-h-[calc(100vh-72px)] pt-20 pb-8 sm:pt-24 sm:pb-10">
      <div className="mx-auto max-w-7xl px-3 sm:px-4 md:px-6">
        <div className="mb-5 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="text-[11px] font-semibold tracking-[0.32em] text-emerald-300">
              SENSEI
            </div>
            <h1 className="mt-2 text-xl font-semibold text-white sm:text-2xl">
              Camp control
            </h1>
            <p className="mt-1 text-xs text-slate-300/70 sm:text-sm">
              Build a directive, stress-test the week, then ask Sensei for decisions.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge label={statusLabel} tone={statusTone} />
            <Badge label={buildStage} tone={busy ? "warn" : "neutral"} />
            {followupsId ? <Badge label={`ID: ${followupsId}`} tone="neutral" /> : null}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
          <div className="space-y-5 xl:col-span-4">
            <SectionCard
              title="Camp inputs"
              subtitle="Set the camp lens before asking for decisions."
              right={
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={onBuildCamp}
                    disabled={busy}
                    className="rounded-2xl bg-emerald-400/95 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-emerald-300 disabled:opacity-60"
                  >
                    {busy ? "Building..." : "Build camp"}
                  </button>
                  <button
                    type="button"
                    onClick={onReset}
                    className="rounded-2xl border border-slate-700/70 bg-slate-950/30 px-4 py-2 text-sm text-slate-200 hover:bg-slate-900/40"
                  >
                    Reset
                  </button>
                </div>
              }
            >
              <div className="space-y-5">
                <div>
                  <div className="mb-2 text-xs font-medium text-slate-300">Focus</div>
                  <div className="flex flex-wrap gap-2">
                    {FOCUS_OPTIONS.map((item) => (
                      <PillButton
                        key={item}
                        active={focus === item}
                        label={item}
                        onClick={() => setFocus(item)}
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <div className="mb-2 text-xs font-medium text-slate-300">Base art</div>
                  <div className="flex flex-wrap gap-2">
                    {BASE_ART_OPTIONS.map((item) => (
                      <PillButton
                        key={item}
                        active={baseArt === item}
                        label={item}
                        onClick={() => setBaseArt(item)}
                      />
                    ))}
                  </div>
                </div>

                <label className="block">
                  <div className="mb-2 text-xs font-medium text-slate-300">
                    Style tags
                  </div>
                  <textarea
                    value={styleTags}
                    onChange={(e) => setStyleTags(e.target.value)}
                    rows={3}
                    className="w-full rounded-2xl border border-slate-800/70 bg-slate-950/30 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-400/20"
                    placeholder="pressure wrestler, forward pressure"
                  />
                </label>

                <label className="block">
                  <div className="mb-2 text-xs font-medium text-slate-300">
                    Constraints
                  </div>
                  <textarea
                    value={constraints}
                    onChange={(e) => setConstraints(e.target.value)}
                    rows={3}
                    className="w-full rounded-2xl border border-slate-800/70 bg-slate-950/30 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-400/20"
                    placeholder="60 min, no partner today"
                  />
                </label>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 xl:grid-cols-1">
                  <button
                    type="button"
                    onClick={onOpenVision}
                    className="rounded-2xl border border-slate-800/60 bg-slate-950/25 px-4 py-3 text-left text-sm text-slate-100 hover:bg-slate-900/35"
                  >
                    Open Sensei Vision
                  </button>
                  <button
                    type="button"
                    onClick={onOpenFuel}
                    className="rounded-2xl border border-slate-800/60 bg-slate-950/25 px-4 py-3 text-left text-sm text-slate-100 hover:bg-slate-900/35"
                  >
                    Open Fuel AI
                  </button>
                  <Link
                    href="/gyms"
                    className="rounded-2xl border border-slate-800/60 bg-slate-950/25 px-4 py-3 text-left text-sm text-slate-100 hover:bg-slate-900/35"
                  >
                    Open gyms
                  </Link>
                </div>
              </div>
            </SectionCard>

            <SectionCard
              title="System status"
              subtitle="Sensei should know what it is working from."
            >
              <div className="space-y-3">
                <StatusRow
                  label="Sensei Vision"
                  value={systemStatus.visionLabel}
                  active={systemStatus.visionConnected}
                />
                <StatusRow
                  label="Fuel AI"
                  value={systemStatus.fuelLabel}
                  active={systemStatus.fuelConnected}
                />
                <StatusRow
                  label="Camp save"
                  value={systemStatus.campLabel}
                  active={systemStatus.campSaved}
                />
              </div>
            </SectionCard>
          </div>

          <div className="space-y-5 xl:col-span-5">
            <SectionCard
              title="Directive"
              subtitle="The camp should revolve around one real problem."
              right={
                directive ? (
                  <Badge label="Active directive" tone="good" />
                ) : (
                  <Badge label="No directive yet" tone="warn" />
                )
              }
            >
              {directive ? (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                    <div className="text-sm font-semibold text-slate-50">
                      {directive.title}
                    </div>
                    <div className="mt-1 text-xs text-slate-300/70">
                      {directive.source}
                    </div>
                  </div>
                  <BulletList items={directive.bullets} />
                </div>
              ) : (
                <div className="text-sm text-slate-300/70">
                  Build camp after loading Vision so Sensei has a real directive.
                </div>
              )}
            </SectionCard>

            <SectionCard
              title="Training focus"
              subtitle="Primary, secondary, and what to avoid."
            >
              {trainingFocus ? (
                <div className="space-y-5">
                  <div>
                    <div className="mb-2 text-xs uppercase tracking-[0.22em] text-slate-400/70">
                      Primary
                    </div>
                    <BulletList items={trainingFocus.primary} />
                  </div>
                  <div>
                    <div className="mb-2 text-xs uppercase tracking-[0.22em] text-slate-400/70">
                      Secondary
                    </div>
                    <BulletList items={trainingFocus.secondary} />
                  </div>
                  <div>
                    <div className="mb-2 text-xs uppercase tracking-[0.22em] text-slate-400/70">
                      Avoid
                    </div>
                    <BulletList items={trainingFocus.avoid} />
                  </div>
                </div>
              ) : (
                <div className="text-sm text-slate-300/70">
                  No training focus yet. Build camp first.
                </div>
              )}
            </SectionCard>

            <SectionCard
              title="Camp control"
              subtitle="Load, warnings, and next actions."
              right={
                control ? (
                  <Badge label={control.trainingLoad} tone="warn" />
                ) : (
                  <Badge label="No control state" tone="neutral" />
                )
              }
            >
              {control ? (
                <div className="space-y-5">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <MiniStat label="Training load" value={control.trainingLoad} />
                    <MiniStat label="Warnings" value={String(control.warnings.length)} />
                    <MiniStat label="Next steps" value={String(control.nextStep.length)} />
                  </div>

                  <div>
                    <div className="mb-2 text-xs uppercase tracking-[0.22em] text-slate-400/70">
                      Warnings
                    </div>
                    <BulletList items={control.warnings} />
                  </div>

                  <div>
                    <div className="mb-2 text-xs uppercase tracking-[0.22em] text-slate-400/70">
                      Next steps
                    </div>
                    <BulletList items={control.nextStep} />
                  </div>
                </div>
              ) : (
                <div className="text-sm text-slate-300/70">
                  No control state yet.
                </div>
              )}
            </SectionCard>

            <SectionCard
              title="Today’s session"
              subtitle="The daily executable block."
              right={
                dailySession ? (
                  <Badge label={`${dailySession.durationMin} min`} tone="good" />
                ) : (
                  <Badge label="No session yet" tone="warn" />
                )
              }
            >
              {dailySession ? (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-slate-800/60 bg-slate-950/25 p-4">
                    <div className="text-sm font-semibold text-slate-50">
                      {dailySession.title}
                    </div>
                    <div className="mt-1 text-xs text-slate-300/70">
                      {dailySession.timingLabel} · Goal: {dailySession.goal}
                    </div>
                  </div>
                  <BulletList items={dailySession.blocks} />
                </div>
              ) : (
                <div className="text-sm text-slate-300/70">
                  Build camp to generate a daily session.
                </div>
              )}
            </SectionCard>

            <SectionCard
              title="Checklist"
              subtitle="Track execution, not intention."
            >
              {checklist.length ? (
                <div className="space-y-3">
                  {checklist.map((item) => (
                    <label
                      key={item.id}
                      className="flex items-center gap-3 rounded-2xl border border-slate-800/60 bg-slate-950/25 px-4 py-3"
                    >
                      <input
                        type="checkbox"
                        checked={item.done}
                        onChange={() => onToggleChecklistItem(item.id)}
                        className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-emerald-400 focus:ring-emerald-400/30"
                      />
                      <span
                        className={cn(
                          "text-sm",
                          item.done
                            ? "text-slate-400 line-through"
                            : "text-slate-100"
                        )}
                      >
                        {item.label}
                      </span>
                    </label>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-slate-300/70">
                  No checklist yet.
                </div>
              )}
            </SectionCard>
          </div>

          <div className="space-y-5 xl:col-span-3">
            <SectionCard
              title="Gym support"
              subtitle="The room should support the directive, not sabotage it."
              right={
                gyms.length ? (
                  <Badge label={`${gyms.length} gyms`} tone="good" />
                ) : (
                  <Badge label="No ranked gyms" tone="warn" />
                )
              }
            >
              {gyms.length ? (
                <div className="space-y-4">
                  {gyms.slice(0, 3).map((gym) => (
                    <div
                      key={gym.id}
                      className="rounded-2xl border border-slate-800/60 bg-slate-950/25 p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-slate-50">
                            {gym.name}
                          </div>
                          <div className="mt-1 text-xs text-slate-300/70">
                            {gym.location}
                          </div>
                        </div>
                        <Badge
                          label={`${gym.compatibility}%`}
                          tone={gym.compatibility >= 75 ? "good" : gym.compatibility >= 55 ? "warn" : "bad"}
                        />
                      </div>

                      <div className="mt-3 space-y-3">
                        <div>
                          <div className="mb-1 text-[11px] uppercase tracking-[0.22em] text-slate-400/70">
                            Reason
                          </div>
                          <BulletList items={gym.reason} />
                        </div>
                        <div>
                          <div className="mb-1 text-[11px] uppercase tracking-[0.22em] text-slate-400/70">
                            Best for
                          </div>
                          <BulletList items={gym.bestFor} />
                        </div>
                        <div>
                          <div className="mb-1 text-[11px] uppercase tracking-[0.22em] text-slate-400/70">
                            Watch out
                          </div>
                          <BulletList items={gym.watchOut} />
                        </div>
                      </div>

                      {gym.href ? (
                        <Link
                          href={gym.href}
                          className="mt-4 inline-flex text-xs text-emerald-300 hover:text-emerald-200"
                        >
                          Open gym →
                        </Link>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-slate-300/70">
                  No ranked gyms yet. Build camp first.
                </div>
              )}
            </SectionCard>

            <SectionCard
              title="Sensei chat"
              subtitle="Ask for decisions, not motivation."
              right={<Badge label={CHAT_SECTION_LABELS[activeChatSection]} tone="neutral" />}
            >
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  {CHAT_SECTIONS.map((section) => (
                    <PillButton
                      key={section}
                      active={activeChatSection === section}
                      label={CHAT_SECTION_LABELS[section]}
                      onClick={() => setActiveChatSection(section)}
                    />
                  ))}
                </div>

                <div className="flex h-[420px] min-h-[420px] flex-col gap-2 overflow-y-auto rounded-2xl border border-slate-800/60 bg-slate-950/25 p-2.5 sm:h-[380px] sm:min-h-[380px] sm:gap-3 sm:p-3">
                  {visibleMessages.length ? (
                    visibleMessages.map((msg) => (
                      <ChatBubble key={msg.id} msg={msg} />
                    ))
                  ) : (
                    <div className="text-sm text-slate-400/70">
                      No messages in {CHAT_SECTION_LABELS[activeChatSection]} yet.
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <textarea
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={onChatKeyDown}
                    rows={3}
                    placeholder="Ask Sensei something direct. Example: Why should I pick Kuma Team?"
                    className="w-full rounded-2xl border border-slate-800/70 bg-slate-950/30 px-4 py-3 text-sm leading-6 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-400/20"
                  />

                  <div className="flex items-center justify-between gap-3">
                    <div className="text-xs text-slate-400/70">
                      Build camp first for stronger answers.
                    </div>
                    <button
                      type="button"
                      onClick={onSendChat}
                      disabled={chatSending}
                      className="rounded-2xl bg-emerald-400/95 px-4 py-2.5 text-sm font-medium text-slate-950 hover:bg-emerald-300 disabled:opacity-60"
                    >
                      {chatSending ? "Sending..." : "Ask Sensei"}
                    </button>
                  </div>
                </div>
              </div>
            </SectionCard>
          </div>
        </div>
      </div>
    </main>
  );
}