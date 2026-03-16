"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useFighterContext } from "@/hooks/useFighterContext";

type WeightStatus =
  | "On Track"
  | "Slightly Behind"
  | "Off Track"
  | "No Fight Scheduled";

type VisionFinding = {
  id?: string;
  title: string;
  detail: string;
  severity: "LOW" | "MEDIUM" | "HIGH";
};

type VisionAnalysis = {
  analysis_id?: string;
  clipLabel?: string;
  findings?: VisionFinding[];
};

type CampDirective = {
  title: string;
  source: string;
  bullets: string[];
};

type TrainingFocus = {
  primary: string[];
  secondary: string[];
  avoid: string[];
};

type CampControl = {
  trainingLoad: "LOW" | "MODERATE" | "HIGH";
  warnings: string[];
  nextStep: string[];
};

type DailySession = {
  title: string;
  durationMin: number;
  timingLabel: string;
  goal: string;
  blocks: string[];
};

type SavedCamp = {
  focus: string;
  baseArt: string;
  styleTags: string;
  constraints: string;
  directive: CampDirective | null;
  trainingFocus: TrainingFocus | null;
  control: CampControl | null;
  dailySession: DailySession | null;
  savedAt: number;
};

type FuelMemory = {
  score?: number;
  report?: string;
};

type WeightLog = {
  value: number;
  loggedAt: string;
};

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

function Bullets({ items }: { items: string[] }) {
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

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function daysUntil(dateStr?: string | null): number | null {
  if (!dateStr) return null;
  const now = new Date();
  const target = new Date(dateStr);
  if (Number.isNaN(target.getTime())) return null;

  const ms = target.getTime() - now.getTime();
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

function getLatestWeight(logs: WeightLog[], fallback?: number | null): number | null {
  if (logs.length > 0) return logs[logs.length - 1].value;
  if (typeof fallback === "number" && Number.isFinite(fallback)) return fallback;
  return null;
}

function buildWeightStatus(args: {
  currentWeight: number | null;
  targetWeight: number | null;
  daysRemaining: number | null;
}): WeightStatus {
  const { currentWeight, targetWeight, daysRemaining } = args;

  if (daysRemaining === null) return "No Fight Scheduled";
  if (currentWeight === null || targetWeight === null) return "No Fight Scheduled";

  const diff = currentWeight - targetWeight;

  if (diff <= 0.5) return "On Track";

  const requiredPerDay = diff / Math.max(daysRemaining, 1);

  if (requiredPerDay <= 0.35) return "On Track";
  if (requiredPerDay <= 0.6) return "Slightly Behind";
  return "Off Track";
}

function statusTone(status: WeightStatus): "good" | "warn" | "bad" | "neutral" {
  if (status === "On Track") return "good";
  if (status === "Slightly Behind") return "warn";
  if (status === "Off Track") return "bad";
  return "neutral";
}

function getMissionBlocks(camp: SavedCamp | null) {
  const primary = camp?.trainingFocus?.primary ?? [];
  const secondary = camp?.trainingFocus?.secondary ?? [];
  const control = camp?.control;
  const session = camp?.dailySession;

  return {
    striking: primary[0] ?? "No striking mission set",
    grappling: primary[1] ?? secondary[0] ?? "No grappling mission set",
    conditioning:
      control?.trainingLoad === "LOW"
        ? "Low-output conditioning or active recovery"
        : control?.trainingLoad === "HIGH"
        ? "Hard conditioning focus"
        : "Moderate conditioning focus",
    recovery:
      session?.goal?.toLowerCase().includes("mobility") || control?.trainingLoad === "LOW"
        ? "Mobility + walk + breathing reset"
        : "Recovery after main training block",
  };
}

export default function DashboardClient() {
  const { fighterContext } = useFighterContext();

  const [camp, setCamp] = useState<SavedCamp | null>(null);
  const [vision, setVision] = useState<VisionAnalysis | null>(null);
  const [fuel, setFuel] = useState<FuelMemory | null>(null);
  const [weightLogs, setWeightLogs] = useState<WeightLog[]>([]);
  const [weightInput, setWeightInput] = useState("");

  useEffect(() => {
    const campData = readJson<SavedCamp>("disciplin_latest_camp");
    const visionData = readJson<VisionAnalysis>("disciplin_latest_vision");
    const fuelData = readJson<FuelMemory>("disciplin_latest_fuel");
    const logsData = readJson<WeightLog[]>("disciplin_weight_logs") ?? [];

    setCamp(campData);
    setVision(visionData);
    setFuel(fuelData);
    setWeightLogs(logsData);
  }, []);

  const fightDate = fighterContext.camp.fightDate;
  const weightClass = fighterContext.identity.weightClass ?? "Not set";
  const profileCurrentWeight = fighterContext.identity.currentWeight;
  const targetWeight = fighterContext.identity.targetWeight;

  const currentWeight = getLatestWeight(weightLogs, profileCurrentWeight);
  const daysRemaining = daysUntil(fightDate);
  const weightStatus = buildWeightStatus({
    currentWeight,
    targetWeight,
    daysRemaining,
  });

  const mission = useMemo(() => getMissionBlocks(camp), [camp]);

  const corrections = useMemo(() => {
    const findings = Array.isArray(vision?.findings) ? vision.findings : [];
    return findings.slice(0, 3);
  }, [vision]);

  const coachNotes = useMemo(() => {
    const notes: string[] = [];

    if (camp?.directive?.bullets?.length) {
      notes.push(...camp.directive.bullets.slice(0, 2));
    }
    if (camp?.control?.warnings?.length) {
      notes.push(...camp.control.warnings.slice(0, 1));
    }
    if (camp?.control?.nextStep?.length) {
      notes.push(...camp.control.nextStep.slice(0, 1));
    }

    return notes.slice(0, 4);
  }, [camp]);

  const weightDifference =
    currentWeight !== null && typeof targetWeight === "number"
      ? Number((currentWeight - targetWeight).toFixed(1))
      : null;

  const progressPct =
    currentWeight !== null && typeof targetWeight === "number"
      ? Math.max(0, Math.min(100, 100 - Math.max(0, currentWeight - targetWeight) * 8))
      : 0;

  function handleLogWeight() {
    const value = Number(weightInput);
    if (!Number.isFinite(value) || value <= 0) return;

    const next: WeightLog[] = [
      ...weightLogs,
      {
        value,
        loggedAt: new Date().toISOString(),
      },
    ];

    setWeightLogs(next);
    localStorage.setItem("disciplin_weight_logs", JSON.stringify(next));
    setWeightInput("");
  }

  return (
    <main className="min-h-[calc(100vh-72px)] pt-24 pb-10">
      <div className="mx-auto max-w-7xl px-4 md:px-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Badge tone="good">FIGHT CAMP COMMAND CENTER</Badge>
            <span className="text-sm text-slate-200/80">
              Daily operating screen for training, weight, correction, and action.
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Badge tone={statusTone(weightStatus)}>{weightStatus}</Badge>
            <Link
              href="/sensei"
              className="rounded-full border border-slate-700/70 bg-slate-950/30 px-3 py-1.5 text-xs text-slate-200/80 hover:bg-slate-900/40"
            >
              Open Sensei →
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
          <div className="space-y-6 xl:col-span-8">
            <Card
              title="Camp status"
              sub="What matters immediately."
              right={<Badge tone={statusTone(weightStatus)}>{weightStatus}</Badge>}
            >
              <div className="grid gap-4 md:grid-cols-4">
                <div className="rounded-2xl border border-slate-800/60 bg-slate-950/25 p-4">
                  <div className="text-[11px] uppercase tracking-[0.22em] text-slate-400/70">Fight date</div>
                  <div className="mt-2 text-sm font-semibold text-slate-50">
                    {fightDate ?? "No fight scheduled"}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-800/60 bg-slate-950/25 p-4">
                  <div className="text-[11px] uppercase tracking-[0.22em] text-slate-400/70">Days remaining</div>
                  <div className="mt-2 text-sm font-semibold text-slate-50">
                    {daysRemaining !== null ? `${daysRemaining} days` : "—"}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-800/60 bg-slate-950/25 p-4">
                  <div className="text-[11px] uppercase tracking-[0.22em] text-slate-400/70">Weight class</div>
                  <div className="mt-2 text-sm font-semibold text-slate-50">{weightClass}</div>
                </div>

                <div className="rounded-2xl border border-slate-800/60 bg-slate-950/25 p-4">
                  <div className="text-[11px] uppercase tracking-[0.22em] text-slate-400/70">Current weight</div>
                  <div className="mt-2 text-sm font-semibold text-slate-50">
                    {currentWeight !== null ? `${currentWeight} kg` : "Not logged"}
                  </div>
                </div>
              </div>
            </Card>

            <Card
              title="Today’s mission"
              sub="Here is your mission for today."
              right={
                camp?.dailySession ? (
                  <Badge tone="good">{camp.dailySession.durationMin} min</Badge>
                ) : (
                  <Badge tone="warn">Build camp</Badge>
                )
              }
            >
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                  <div className="text-[11px] uppercase tracking-[0.22em] text-emerald-200/80">Striking</div>
                  <div className="mt-2 text-sm text-slate-100">{mission.striking}</div>
                </div>

                <div className="rounded-2xl border border-slate-800/60 bg-slate-950/25 p-4">
                  <div className="text-[11px] uppercase tracking-[0.22em] text-slate-400/70">Grappling</div>
                  <div className="mt-2 text-sm text-slate-100">{mission.grappling}</div>
                </div>

                <div className="rounded-2xl border border-slate-800/60 bg-slate-950/25 p-4">
                  <div className="text-[11px] uppercase tracking-[0.22em] text-slate-400/70">Conditioning</div>
                  <div className="mt-2 text-sm text-slate-100">{mission.conditioning}</div>
                </div>

                <div className="rounded-2xl border border-slate-800/60 bg-slate-950/25 p-4">
                  <div className="text-[11px] uppercase tracking-[0.22em] text-slate-400/70">Recovery</div>
                  <div className="mt-2 text-sm text-slate-100">{mission.recovery}</div>
                </div>
              </div>

              {camp?.dailySession ? (
                <div className="mt-4 rounded-2xl border border-slate-800/60 bg-slate-950/25 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-[11px] uppercase tracking-[0.22em] text-slate-400/70">
                        Today’s session
                      </div>
                      <div className="mt-2 text-sm font-semibold text-slate-50">
                        {camp.dailySession.title}
                      </div>
                      <div className="mt-1 text-xs text-slate-300/70">
                        {camp.dailySession.timingLabel} · Goal: {camp.dailySession.goal}
                      </div>
                    </div>
                    <Badge tone="good">{camp.dailySession.durationMin} min</Badge>
                  </div>

                  <div className="mt-3">
                    <Bullets items={camp.dailySession.blocks} />
                  </div>
                </div>
              ) : null}
            </Card>

            <Card
              title="Yesterday’s corrections"
              sub="Strict reminders from recent analysis."
              right={
                vision?.clipLabel ? (
                  <Badge tone="good">{vision.clipLabel}</Badge>
                ) : (
                  <Badge tone="warn">No recent clip</Badge>
                )
              }
            >
              {corrections.length ? (
                <div className="space-y-3">
                  {corrections.map((item, i) => (
                    <div
                      key={item.id ?? i}
                      className="rounded-2xl border border-slate-800/60 bg-slate-950/25 p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-slate-50">{item.title}</div>
                          <div className="mt-2 text-sm text-slate-300/80">{item.detail}</div>
                        </div>
                        <Badge
                          tone={
                            item.severity === "HIGH"
                              ? "bad"
                              : item.severity === "MEDIUM"
                              ? "warn"
                              : "good"
                          }
                        >
                          {item.severity}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-800/70 bg-slate-950/20 p-6 text-sm text-slate-300/70">
                  No recent corrections. Upload a clip in Sensei Vision to generate strict correction reminders.
                </div>
              )}
            </Card>
          </div>

          <div className="space-y-6 xl:col-span-4">
            <Card
              title="Weight tracking"
              sub="Trajectory toward fight weight."
              right={<Badge tone={statusTone(weightStatus)}>{weightStatus}</Badge>}
            >
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                  <div className="rounded-2xl border border-slate-800/60 bg-slate-950/25 p-4">
                    <div className="text-[11px] uppercase tracking-[0.22em] text-slate-400/70">Current weight</div>
                    <div className="mt-2 text-sm font-semibold text-slate-50">
                      {currentWeight !== null ? `${currentWeight} kg` : "Not logged"}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-800/60 bg-slate-950/25 p-4">
                    <div className="text-[11px] uppercase tracking-[0.22em] text-slate-400/70">Target weight</div>
                    <div className="mt-2 text-sm font-semibold text-slate-50">
                      {typeof targetWeight === "number" ? `${targetWeight} kg` : "Not set"}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-800/60 bg-slate-950/25 p-4">
                    <div className="text-[11px] uppercase tracking-[0.22em] text-slate-400/70">Difference</div>
                    <div className="mt-2 text-sm font-semibold text-slate-50">
                      {weightDifference !== null ? `${weightDifference.toFixed(1)} kg` : "—"}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-800/60 bg-slate-950/25 p-4">
                    <div className="text-[11px] uppercase tracking-[0.22em] text-slate-400/70">Days remaining</div>
                    <div className="mt-2 text-sm font-semibold text-slate-50">
                      {daysRemaining !== null ? `${daysRemaining}` : "—"}
                    </div>
                  </div>
                </div>

                <div>
                  <div className="mb-2 text-[11px] uppercase tracking-[0.22em] text-slate-400/70">Trajectory</div>
                  <div className="h-2 w-full overflow-hidden rounded-full border border-slate-800/60 bg-slate-950/60">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all",
                        weightStatus === "On Track"
                          ? "bg-emerald-400/80"
                          : weightStatus === "Slightly Behind"
                          ? "bg-amber-400/80"
                          : weightStatus === "Off Track"
                          ? "bg-rose-400/80"
                          : "bg-slate-700"
                      )}
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-800/60 bg-slate-950/25 p-4">
                  <div className="text-[11px] uppercase tracking-[0.22em] text-slate-400/70">Log weight</div>
                  <div className="mt-3 flex gap-2">
                    <input
                      value={weightInput}
                      onChange={(e) => setWeightInput(e.target.value)}
                      placeholder="e.g. 68.2"
                      className="w-full rounded-2xl border border-slate-800/70 bg-slate-950/30 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-400/20"
                    />
                    <button
                      onClick={handleLogWeight}
                      className="rounded-2xl bg-emerald-400/95 px-4 py-3 text-sm font-medium text-slate-950 hover:bg-emerald-300"
                    >
                      Log
                    </button>
                  </div>
                </div>
              </div>
            </Card>

            <Card
              title="Coach / Sensei notes"
              sub="Short notes for today."
              right={<Badge tone="neutral">Daily notes</Badge>}
            >
              {coachNotes.length ? (
                <Bullets items={coachNotes} />
              ) : (
                <div className="text-sm text-slate-300/70">
                  No coach notes yet. Build a camp in Sensei first.
                </div>
              )}
            </Card>

            <Card
              title="Quick actions"
              sub="Use the most important tools fast."
              right={<Badge tone="good">Actions</Badge>}
            >
              <div className="grid gap-3">
                <Link
                  href="/sensei-vision"
                  className="rounded-2xl border border-slate-800/60 bg-slate-950/25 px-4 py-3 text-sm text-slate-100 hover:bg-slate-900/35"
                >
                  Upload Sparring Clip
                </Link>

                <Link
                  href="/report"
                  className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 text-sm text-emerald-100 hover:bg-emerald-500/10"
                >
                  View Fighter Report Card
                </Link>

                <button
                  onClick={() => {
                    const el = document.querySelector<HTMLInputElement>(
                      'input[placeholder="e.g. 68.2"]'
                    );
                    el?.focus();
                  }}
                  className="rounded-2xl border border-slate-800/60 bg-slate-950/25 px-4 py-3 text-left text-sm text-slate-100 hover:bg-slate-900/35"
                >
                  Log Weight
                </button>

                <Link
                  href="/sensei"
                  className="rounded-2xl border border-slate-800/60 bg-slate-950/25 px-4 py-3 text-sm text-slate-100 hover:bg-slate-900/35"
                >
                  Start Today’s Session
                </Link>

                <Link
                  href="/sensei"
                  className="rounded-2xl border border-slate-800/60 bg-slate-950/25 px-4 py-3 text-sm text-slate-100 hover:bg-slate-900/35"
                >
                  Ask Sensei
                </Link>

                <Link
                  href="/sensei"
                  className="rounded-2xl border border-slate-800/60 bg-slate-950/25 px-4 py-3 text-sm text-slate-100 hover:bg-slate-900/35"
                >
                  View Camp Plan
                </Link>
              </div>

              {fuel?.score !== undefined ? (
                <div className="mt-4 rounded-2xl border border-slate-800/60 bg-slate-950/25 p-4">
                  <div className="text-[11px] uppercase tracking-[0.22em] text-slate-400/70">Fuel status</div>
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <div className="text-sm text-slate-100">Latest Fuel AI score</div>
                    <Badge tone={fuel.score >= 75 ? "good" : fuel.score >= 50 ? "warn" : "bad"}>
                      {Math.round(fuel.score)}
                    </Badge>
                  </div>
                </div>
              ) : null}
            </Card>
          </div>
        </div>
      </div>
    </main>
  );
}