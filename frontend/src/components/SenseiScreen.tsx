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

  chatScrollRef?: React.RefObject<HTMLDivElement | null>;
  inputRef?: React.RefObject<HTMLTextAreaElement | null>;
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

function compactSentence(text?: string, max = 180) {
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  if (!clean) return "";
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1).trim()}…`;
}

function stageMeta(stage: BuildStage) {
  switch (stage) {
    case "READING_CONTEXT":
      return { label: "Reading context", pct: 20 };
    case "SETTING_DIRECTIVE":
      return { label: "Setting directive", pct: 42 };
    case "BUILDING_TRAINING":
      return { label: "Building training", pct: 68 };
    case "SETTING_CONTROL":
      return { label: "Setting control", pct: 84 };
    case "RANKING_GYMS":
      return { label: "Ranking gyms", pct: 94 };
    case "DONE":
      return { label: "Camp ready", pct: 100 };
    case "ERROR":
      return { label: "Build error", pct: 100 };
    default:
      return { label: "Idle", pct: 0 };
  }
}

function badgeToneForLoad(
  load?: CampControl["trainingLoad"]
): "neutral" | "good" | "warn" | "bad" {
  if (load === "LOW") return "good";
  if (load === "MODERATE") return "warn";
  if (load === "HIGH") return "bad";
  return "neutral";
}

function compatibilityTone(
  score: number
): "neutral" | "good" | "warn" | "bad" {
  if (score >= 80) return "good";
  if (score >= 60) return "warn";
  return "bad";
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
      ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-100"
      : tone === "warn"
      ? "border-amber-400/30 bg-amber-400/10 text-amber-100"
      : tone === "bad"
      ? "border-rose-400/30 bg-rose-400/10 text-rose-100"
      : "border-white/10 bg-white/[0.03] text-white/70";

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-3 py-1 text-[11px] tracking-wide",
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
        "rounded-full border px-3 py-2 text-xs transition sm:text-sm",
        active
          ? "border-emerald-400/45 bg-emerald-500/10 text-emerald-100"
          : "border-white/10 bg-white/[0.03] text-white/80 hover:border-emerald-400/20 hover:bg-white/[0.05]"
      )}
    >
      {label}
    </button>
  );
}

function BulletList({
  items,
  tone = "emerald",
  compact = false,
}: {
  items: string[];
  tone?: "emerald" | "amber" | "rose";
  compact?: boolean;
}) {
  const dotClass =
    tone === "amber"
      ? "bg-amber-300/80"
      : tone === "rose"
      ? "bg-rose-300/80"
      : "bg-emerald-300/80";

  return (
    <ul className={cn("text-sm text-white/90", compact ? "space-y-1.5" : "space-y-2")}>
      {items.map((item, i) => (
        <li key={i} className="flex gap-2">
          <span
            className={cn(
              "mt-2 h-1.5 w-1.5 shrink-0 rounded-full",
              dotClass
            )}
          />
          <span>{item}</span>
        </li>
      ))}
    </ul>
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
    <div className="rounded-2xl border border-white/10 bg-black/25 p-3">
      <div className="text-[10px] tracking-[0.22em] text-white/45 uppercase">
        {label}
      </div>
      <div className="mt-2 text-sm font-semibold text-white">{value}</div>
    </div>
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
    <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-medium text-white">{label}</div>
        <Badge label={active ? "Connected" : "Missing"} tone={active ? "good" : "warn"} />
      </div>
      <div className="mt-2 text-xs text-white/55">{value}</div>
    </div>
  );
}

function ChatBubble({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === "user";
  const isSensei = msg.role === "sensei";

  return (
    <div
      className={cn(
        "w-[96%] rounded-2xl border px-3 py-3 text-[13px] leading-6 whitespace-pre-wrap sm:w-[94%] sm:px-4 sm:text-sm",
        isUser
          ? "ml-auto border-emerald-400/25 bg-emerald-400/10 text-emerald-50"
          : isSensei
          ? "border-white/10 bg-white/[0.03] text-white"
          : "border-amber-400/25 bg-amber-400/10 text-amber-50"
      )}
    >
      <div className="mb-1.5 text-[10px] uppercase tracking-[0.2em] text-white/45">
        {msg.role === "user" ? "You" : msg.role === "sensei" ? "Sensei" : "System"}
      </div>
      <div className="break-words">{msg.text}</div>
    </div>
  );
}

function ShellCard({
  title,
  subtitle,
  right,
  children,
  strong = false,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  strong?: boolean;
}) {
  return (
    <section
      className={cn(
        "rounded-3xl border p-6 shadow-[0_20px_70px_rgba(0,0,0,0.35)]",
        strong
          ? "border-emerald-400/15 bg-gradient-to-br from-[#071a3b] via-[#030b18] to-[#020810]"
          : "border-white/10 bg-white/[0.03]"
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-white">{title}</div>
          {subtitle ? (
            <div className="mt-1 text-xs text-white/55">{subtitle}</div>
          ) : null}
        </div>
        {right ? <div className="shrink-0">{right}</div> : null}
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function BuildStrip({
  busy,
  buildStage,
}: {
  busy: boolean;
  buildStage: BuildStage;
}) {
  const meta = stageMeta(buildStage);

  return (
    <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[11px] tracking-[0.24em] text-white/45 uppercase">
            Camp build
          </div>
          <div className="mt-1 text-sm text-white/85">
            {busy ? meta.label : "Idle"}
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <span
            className={cn(
              "h-2.5 w-2.5 rounded-full",
              busy ? "animate-pulse bg-emerald-300" : "bg-white/15"
            )}
          />
          <span
            className={cn(
              "h-2.5 w-2.5 rounded-full",
              busy
                ? "animate-pulse bg-emerald-300 [animation-delay:120ms]"
                : "bg-white/15"
            )}
          />
          <span
            className={cn(
              "h-2.5 w-2.5 rounded-full",
              busy
                ? "animate-pulse bg-emerald-300 [animation-delay:240ms]"
                : "bg-white/15"
            )}
          />
        </div>
      </div>

      <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className={cn(
            "h-full rounded-full bg-[linear-gradient(90deg,rgba(52,211,153,0.55),rgba(110,231,183,0.95),rgba(52,211,153,0.55))] transition-all duration-700",
            busy && "animate-pulse"
          )}
          style={{ width: `${meta.pct}%` }}
        />
      </div>
    </div>
  );
}

function GymCompactCard({ gym }: { gym: GymCandidate }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-white">{gym.name}</div>
          <div className="mt-1 text-xs text-white/55">{gym.location}</div>
        </div>
        <Badge
          label={`${gym.compatibility}%`}
          tone={compatibilityTone(gym.compatibility)}
        />
      </div>

      <div className="mt-3">
        <div className="mb-1 text-[10px] tracking-[0.22em] text-white/45 uppercase">
          Best fit
        </div>
        <BulletList
          items={(gym.bestFor.length ? gym.bestFor : gym.reason).slice(0, 2)}
          compact
        />
      </div>

      {gym.watchOut.length ? (
        <div className="mt-3 text-xs text-white/55">
          Watch out: {compactSentence(gym.watchOut[0], 90)}
        </div>
      ) : null}

      {gym.href ? (
        <Link
          href={gym.href}
          className="mt-4 inline-flex text-xs text-emerald-300 hover:text-emerald-200"
        >
          Open gym →
        </Link>
      ) : null}
    </div>
  );
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
  chatScrollRef,
  inputRef,
}: SenseiScreenProps) {
  const featuredGyms = gyms.slice(0, 3);

  return (
    <main className="min-h-screen bg-[#020810] px-4 py-6 text-white sm:px-6 sm:py-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-[#05112a] via-[#030b18] to-[#020810] p-6 shadow-[0_30px_80px_rgba(0,0,0,0.45)]">
          <div className="flex items-start justify-between gap-6">
            <div>
              <p className="text-[11px] font-semibold tracking-[0.32em] text-emerald-300">
                SENSEI
              </p>
              <h1 className="mt-1 text-3xl font-semibold text-white">Camp control</h1>
              <p className="mt-2 text-xs text-white/60">
                Build a directive, stress-test the week, then ask Sensei for decisions.
              </p>

              <div className="mt-3 flex flex-wrap gap-2">
                <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[11px] text-white/70">
                  Focus: <span className="text-white">{focus}</span>
                </span>
                <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[11px] text-white/70">
                  Base art: <span className="text-white">{baseArt}</span>
                </span>
                {dailySession ? (
                  <span className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1 text-[11px] text-emerald-100">
                    Today: {dailySession.durationMin} min
                  </span>
                ) : null}
              </div>
            </div>

            <div className="flex flex-col items-end gap-2">
              <Badge label={statusLabel} tone={statusTone} />
              <Badge label={followupsId || "camp_local"} tone="neutral" />
            </div>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/[0.07] p-4">
              <div className="text-[11px] tracking-[0.25em] text-emerald-200/80 uppercase">
                Camp directive
              </div>
              <div className="mt-3 text-xl font-semibold leading-8 text-white">
                {directive?.title || "No directive yet"}
              </div>
            </div>

            <BuildStrip busy={busy} buildStage={buildStage} />
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <ShellCard
            title="Camp setup"
            subtitle="Set the camp lens before asking for decisions."
            right={<Badge label="Command input" tone="good" />}
          >
            <div className="space-y-5">
              <div>
                <div className="mb-3 text-[11px] uppercase tracking-[0.22em] text-white/45">
                  Focus
                </div>
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
                <div className="mb-3 text-[11px] uppercase tracking-[0.22em] text-white/45">
                  Base art
                </div>
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

              <div>
                <div className="mb-3 text-[11px] uppercase tracking-[0.22em] text-white/45">
                  Style tags
                </div>
                <textarea
                  value={styleTags}
                  onChange={(e) => setStyleTags(e.target.value)}
                  rows={3}
                  className="w-full resize-none rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-emerald-400/25"
                  placeholder="pressure wrestler, forward pressure, high pace..."
                />
              </div>

              <div>
                <div className="mb-3 text-[11px] uppercase tracking-[0.22em] text-white/45">
                  Constraints
                </div>
                <textarea
                  value={constraints}
                  onChange={(e) => setConstraints(e.target.value)}
                  rows={4}
                  className="w-full resize-none rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-emerald-400/25"
                  placeholder="60 min, no partner today..."
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                <button
                  type="button"
                  onClick={onBuildCamp}
                  disabled={busy}
                  className="rounded-2xl bg-emerald-400 px-4 py-3 text-sm font-semibold text-[#041026] transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {busy ? "Building..." : "Build camp"}
                </button>

                <button
                  type="button"
                  onClick={onReset}
                  className="rounded-2xl border border-white/10 bg-black/25 px-5 py-3 text-sm text-white transition hover:border-white/20"
                >
                  Reset
                </button>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <button
                  type="button"
                  onClick={onOpenVision}
                  className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white transition hover:border-emerald-400/25"
                >
                  Open Vision
                </button>

                <button
                  type="button"
                  onClick={onOpenFuel}
                  className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white transition hover:border-emerald-400/25"
                >
                  Open Fuel
                </button>

                <Link
                  href="/gyms"
                  className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-center text-sm text-white transition hover:border-emerald-400/25"
                >
                  Open gyms
                </Link>
              </div>
            </div>
          </ShellCard>

          <div className="space-y-6">
            <ShellCard
              title="Directive"
              subtitle="The camp should revolve around one real problem."
              right={
                <Badge
                  label={directive ? "Active directive" : "Missing"}
                  tone={directive ? "good" : "warn"}
                />
              }
              strong
            >
              {directive ? (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/[0.06] p-4">
                    <div className="text-2xl font-semibold leading-10 text-white">
                      {directive.title}
                    </div>
                    <div className="mt-2 text-sm text-white/65">
                      {directive.source}
                    </div>
                  </div>
                  <BulletList items={directive.bullets} />
                </div>
              ) : (
                <div className="text-sm text-white/60">
                  No directive yet. Build camp first.
                </div>
              )}
            </ShellCard>

            <ShellCard
              title="Today's session"
              subtitle="The daily executable block."
              right={
                dailySession ? (
                  <Badge label={`${dailySession.durationMin} min`} tone="good" />
                ) : (
                  <Badge label="No session" tone="warn" />
                )
              }
            >
              {dailySession ? (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/[0.05] p-4">
                    <div className="text-xl font-semibold text-white">
                      {dailySession.title}
                    </div>
                    <div className="mt-1 text-sm text-white/60">
                      {dailySession.timingLabel} · Goal: {dailySession.goal}
                    </div>
                  </div>
                  <BulletList items={dailySession.blocks} />
                </div>
              ) : (
                <div className="text-sm text-white/60">No session yet.</div>
              )}
            </ShellCard>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <div className="space-y-6">
            <ShellCard
              title="Training focus"
              subtitle="Primary, secondary, and what to avoid."
              right={
                trainingFocus ? (
                  <Badge label="Focus locked" tone="good" />
                ) : (
                  <Badge label="No focus yet" tone="warn" />
                )
              }
            >
              {trainingFocus ? (
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                    <div className="text-[11px] uppercase tracking-[0.22em] text-white/45">
                      Primary
                    </div>
                    <div className="mt-3">
                      <BulletList items={trainingFocus.primary} compact />
                    </div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                    <div className="text-[11px] uppercase tracking-[0.22em] text-white/45">
                      Secondary
                    </div>
                    <div className="mt-3">
                      <BulletList items={trainingFocus.secondary} tone="amber" compact />
                    </div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                    <div className="text-[11px] uppercase tracking-[0.22em] text-white/45">
                      Avoid
                    </div>
                    <div className="mt-3">
                      <BulletList items={trainingFocus.avoid} tone="rose" compact />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-white/60">No training focus yet.</div>
              )}
            </ShellCard>

            <ShellCard
              title="Camp control"
              subtitle="Load, warnings, and next actions."
              right={
                control ? (
                  <Badge
                    label={control.trainingLoad}
                    tone={badgeToneForLoad(control.trainingLoad)}
                  />
                ) : (
                  <Badge label="No control yet" tone="warn" />
                )
              }
            >
              {control ? (
                <div className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <MiniStat label="Load" value={control.trainingLoad} />
                    <MiniStat label="Warnings" value={String(control.warnings.length)} />
                    <MiniStat label="Next steps" value={String(control.nextStep.length)} />
                  </div>

                  {control.warnings.length ? (
                    <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                      <div className="text-[11px] uppercase tracking-[0.22em] text-white/45">
                        Warnings
                      </div>
                      <div className="mt-3">
                        <BulletList items={control.warnings.slice(0, 3)} tone="amber" compact />
                      </div>
                    </div>
                  ) : null}

                  {control.nextStep.length ? (
                    <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                      <div className="text-[11px] uppercase tracking-[0.22em] text-white/45">
                        Next step
                      </div>
                      <div className="mt-3">
                        <BulletList items={control.nextStep.slice(0, 3)} compact />
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="text-sm text-white/60">No camp control yet.</div>
              )}
            </ShellCard>

            <ShellCard
              title="System status"
              subtitle="Sensei should know what it is working from."
              right={<Badge label="Linked systems" tone="good" />}
            >
              <div className="space-y-3">
                <StatusRow
                  label="Sensei Vision"
                  value={systemStatus.visionLabel}
                  active={systemStatus.visionConnected}
                />
                <StatusRow
                  label="Fuel"
                  value={systemStatus.fuelLabel}
                  active={systemStatus.fuelConnected}
                />
                <StatusRow
                  label="Saved camp"
                  value={systemStatus.campLabel}
                  active={systemStatus.campSaved}
                />
              </div>
            </ShellCard>

            <ShellCard
              title="Execution checklist"
              subtitle="What must get done."
              right={
                <Badge
                  label={`${checklist.length} items`}
                  tone={checklist.length ? "good" : "warn"}
                />
              }
            >
              {checklist.length ? (
                <div className="space-y-3">
                  {checklist.map((item) => (
                    <label
                      key={item.id}
                      className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/25 px-4 py-3"
                    >
                      <input
                        type="checkbox"
                        checked={item.done}
                        onChange={() => onToggleChecklistItem(item.id)}
                        className="h-4 w-4 rounded border-white/20 bg-black/40 text-emerald-400 focus:ring-emerald-400/30"
                      />
                      <span
                        className={cn(
                          "text-sm",
                          item.done ? "text-white/40 line-through" : "text-white"
                        )}
                      >
                        {item.label}
                      </span>
                    </label>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-white/60">No checklist yet.</div>
              )}
            </ShellCard>
          </div>

          <div className="space-y-6">
            <ShellCard
              title="Gym support"
              subtitle="Use the room to support the directive, not replace it."
              right={
                featuredGyms.length ? (
                  <Badge label={`${gyms.length} gyms`} tone="good" />
                ) : (
                  <Badge label="No ranked gyms" tone="warn" />
                )
              }
            >
              {featuredGyms.length ? (
                <div className="space-y-3">
                  {featuredGyms.map((gym) => (
                    <GymCompactCard key={gym.id} gym={gym} />
                  ))}
                </div>
              ) : (
                <div className="text-sm text-white/60">
                  No ranked gyms yet. Build camp first.
                </div>
              )}
            </ShellCard>

            <ShellCard
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

                <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/25">
                  <div
                    ref={chatScrollRef}
                    className="flex h-[360px] min-h-[360px] flex-col gap-2 overflow-y-auto px-3 py-3 sm:h-[420px] sm:min-h-[420px] sm:px-4"
                  >
                    {chatMessages.length ? (
                      chatMessages.map((msg) => (
                        <ChatBubble key={msg.id} msg={msg} />
                      ))
                    ) : (
                      <div className="text-sm text-white/50">
                        No messages yet.
                      </div>
                    )}

                    {chatSending ? (
                      <div className="w-[96%] rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white/70">
                        Sensei is answering…
                      </div>
                    ) : null}
                  </div>

                  <div className="border-t border-white/10 bg-[linear-gradient(180deg,rgba(2,8,16,0.72),rgba(2,8,16,0.96))] p-3 backdrop-blur">
                    <div className="space-y-3">
                      <textarea
                        ref={inputRef}
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        onKeyDown={onChatKeyDown}
                        rows={3}
                        placeholder="Ask Sensei something direct."
                        className="w-full resize-none rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-emerald-400/25"
                      />

                      <div className="flex items-center justify-between gap-3">
                        <div className="text-xs text-white/45">
                          Press Enter to send. Shift+Enter for a new line.
                        </div>

                        <button
                          type="button"
                          onClick={onSendChat}
                          disabled={chatSending}
                          className={cn(
                            "rounded-2xl px-5 py-3 text-sm font-medium transition",
                            chatSending
                              ? "cursor-not-allowed bg-white/10 text-white/40"
                              : "bg-emerald-400 text-[#041026] hover:bg-emerald-300"
                          )}
                        >
                          {chatSending ? "Sending..." : "Send"}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </ShellCard>
          </div>
        </div>
      </div>
    </main>
  );
}