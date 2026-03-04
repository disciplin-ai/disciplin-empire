"use client";

import React, { useMemo, useState } from "react";

type LoadTier = "REST" | "LIGHT" | "MODERATE" | "HARD" | "MAX";

export type SenseiDay = {
  key: "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun";
  title: string; // e.g., "Hard MMA spar + cage wrestling"
  tier: LoadTier;
  load: number; // 0-10
  tags?: string[]; // e.g., ["MMA", "Wrestling"]
  cue?: string; // 1 critical cue
  restriction?: string; // 1 restriction
  details?: string[]; // bullet lines
};

function cn(...xs: (string | false | null | undefined)[]) {
  return xs.filter(Boolean).join(" ");
}

function tierToLoad(tier: LoadTier): number {
  switch (tier) {
    case "REST":
      return 0;
    case "LIGHT":
      return 3;
    case "MODERATE":
      return 5;
    case "HARD":
      return 7;
    case "MAX":
      return 9;
  }
}

function loadToTier(load: number): LoadTier {
  if (load <= 0) return "REST";
  if (load <= 3) return "LIGHT";
  if (load <= 5) return "MODERATE";
  if (load <= 7) return "HARD";
  return "MAX";
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-slate-700/60 bg-slate-900/40 px-2.5 py-1 text-xs text-slate-200">
      {children}
    </span>
  );
}

function LoadBadge({ load, tier }: { load: number; tier: LoadTier }) {
  const tone =
    tier === "MAX"
      ? "border-rose-500/30 bg-rose-500/10 text-rose-200"
      : tier === "HARD"
      ? "border-amber-500/30 bg-amber-500/10 text-amber-200"
      : tier === "MODERATE"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
      : tier === "LIGHT"
      ? "border-sky-500/30 bg-sky-500/10 text-sky-200"
      : "border-slate-700/60 bg-slate-900/40 text-slate-200";

  return (
    <span className={cn("inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs", tone)}>
      <span className="font-semibold">{load}/10</span>
      <span className="opacity-90">{tier}</span>
    </span>
  );
}

function LoadBar({ load }: { load: number }) {
  const pct = Math.max(0, Math.min(10, load)) * 10;
  return (
    <div className="h-2 w-full rounded-full bg-slate-900/60 border border-slate-800/60 overflow-hidden">
      <div
        className="h-full bg-emerald-500/70"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function Card({
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
    <div className="rounded-2xl border border-slate-800/70 bg-slate-950/40 shadow-sm">
      <div className="flex items-start justify-between gap-4 border-b border-slate-800/60 px-5 py-4">
        <div>
          <div className="text-sm font-semibold tracking-wide text-slate-100">{title}</div>
          {subtitle && <div className="mt-1 text-xs text-slate-400">{subtitle}</div>}
        </div>
        {right}
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  );
}

function DayChip({
  day,
  active,
  onClick,
}: {
  day: SenseiDay;
  active: boolean;
  onClick: () => void;
}) {
  const tier = day.tier ?? loadToTier(day.load);
  return (
    <button
      onClick={onClick}
      className={cn(
        "group w-full rounded-2xl border px-4 py-3 text-left transition-all duration-200",
        active
          ? "border-emerald-500/30 bg-emerald-500/10"
          : "border-slate-800/70 bg-slate-950/30 hover:border-slate-700/80 hover:bg-slate-950/45"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs tracking-[0.18em] text-slate-400">{day.key}</div>
          <div className="mt-1 text-sm font-semibold text-slate-100 line-clamp-2">{day.title}</div>
        </div>
        <LoadBadge load={day.load} tier={tier} />
      </div>

      <div className="mt-3">
        <LoadBar load={day.load} />
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {(day.tags ?? []).slice(0, 3).map((t) => (
          <Pill key={t}>{t}</Pill>
        ))}
      </div>
    </button>
  );
}

export default function SenseiCommandBlock({
  days,
  defaultSelected = "Mon",
}: {
  days: SenseiDay[];
  defaultSelected?: SenseiDay["key"];
}) {
  const [selected, setSelected] = useState<SenseiDay["key"]>(defaultSelected);

  const selectedDay = useMemo(
    () => days.find((d) => d.key === selected) ?? days[0],
    [days, selected]
  );

  // "Today" can later be real calendar-aware; UI-only for now.
  // For now we treat selected day as "Today" panel.
  const today = selectedDay;

  const recoverySignal = useMemo(() => {
    // Simple UI heuristic (no backend change): higher load -> higher recovery risk
    const avg = days.reduce((a, d) => a + d.load, 0) / Math.max(1, days.length);
    const risk =
      avg >= 6 ? "Elevated" : avg >= 4 ? "Moderate" : "Low";
    return { avg: Math.round(avg * 10) / 10, risk };
  }, [days]);

  return (
    <div className="space-y-6">
      {/* COMMAND BLOCK */}
      <Card
        title="Command Block"
        subtitle="Operate the week. Don’t read essays."
        right={<Pill>Camp OS</Pill>}
      >
        {/* Today */}
        <div className="rounded-2xl border border-slate-800/70 bg-slate-950/50 p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="text-xs tracking-[0.24em] text-emerald-300/80">TODAY</div>
              <div className="mt-2 text-2xl font-semibold text-slate-50">{today.title}</div>

              <div className="mt-3 flex flex-wrap gap-2">
                <LoadBadge load={today.load} tier={today.tier} />
                {(today.tags ?? []).slice(0, 4).map((t) => (
                  <Pill key={t}>{t}</Pill>
                ))}
              </div>

              <div className="mt-4 space-y-3">
                {today.cue && (
                  <div className="rounded-xl border border-slate-800/60 bg-slate-950/30 px-4 py-3">
                    <div className="text-xs tracking-wide text-slate-500">CRITICAL CUE</div>
                    <div className="mt-1 text-sm font-semibold text-slate-100">{today.cue}</div>
                  </div>
                )}
                {today.restriction && (
                  <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3">
                    <div className="text-xs tracking-wide text-amber-200/80">RESTRICTION</div>
                    <div className="mt-1 text-sm text-amber-100">{today.restriction}</div>
                  </div>
                )}
              </div>
            </div>

            <div className="w-full max-w-sm">
              <div className="text-xs tracking-wide text-slate-500">LOAD</div>
              <div className="mt-2">
                <LoadBar load={today.load} />
              </div>
              <div className="mt-3 text-xs text-slate-400">
                Recovery risk: <span className="text-slate-200">{recoverySignal.risk}</span> ·
                Avg load: <span className="text-slate-200">{recoverySignal.avg}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Weekly heatmap */}
        <div className="mt-5">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-slate-100">Weekly Heatmap</div>
              <div className="mt-1 text-xs text-slate-400">Tap a day. It becomes Today.</div>
            </div>
            <Pill>Mon–Sun</Pill>
          </div>

          {/* Mobile: stacked */}
          <div className="grid gap-3 md:hidden">
            {days.map((d) => (
              <DayChip key={d.key} day={d} active={d.key === selected} onClick={() => setSelected(d.key)} />
            ))}
          </div>

          {/* Desktop: row grid */}
          <div className="hidden md:grid md:grid-cols-7 md:gap-3">
            {days.map((d) => (
              <DayChip key={d.key} day={d} active={d.key === selected} onClick={() => setSelected(d.key)} />
            ))}
          </div>

          {/* Day detail */}
          <div className="mt-5 rounded-2xl border border-slate-800/70 bg-slate-950/35 p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs tracking-[0.18em] text-slate-400">{selectedDay.key} DETAIL</div>
                <div className="mt-1 text-lg font-semibold text-slate-100">{selectedDay.title}</div>
              </div>
              <LoadBadge load={selectedDay.load} tier={selectedDay.tier} />
            </div>

            {!!selectedDay.details?.length ? (
              <ul className="mt-3 space-y-2 text-sm text-slate-300">
                {selectedDay.details.slice(0, 8).map((x, i) => (
                  <li key={i} className="rounded-xl border border-slate-800/60 bg-slate-950/30 px-4 py-2">
                    {x}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="mt-3 text-sm text-slate-400">
                No details yet. Generate or refine to populate this day.
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}