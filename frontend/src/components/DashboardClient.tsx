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
  severity: "LOW" | "MEDIUM" | "HIGH";
  interrupt?: string;
  fix_next_rep?: string;

  dashboard_detail?: string;
  if_ignored?: string;
  short_detail?: string;
  detail?: string;

  good?: string;
  unstable?: string;
  break_point?: string;
  train?: string[];
};

type VisionAnalysis = {
  analysis_id?: string;
  clipLabel?: string;
  summary?: string;
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

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function cleanSentence(text?: string | null) {
  return String(text || "").replace(/\s+/g, " ").trim();
}

function compactSentence(text?: string | null, max = 160) {
  const clean = cleanSentence(text);
  if (!clean) return "";
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1).trim()}…`;
}

function firstGoodText(...values: Array<string | null | undefined>) {
  for (const value of values) {
    const cleaned = cleanSentence(value);
    if (cleaned) return cleaned;
  }
  return "";
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

function getFuelTone(score?: number): "good" | "warn" | "bad" | "neutral" {
  if (typeof score !== "number") return "neutral";
  if (score >= 75) return "good";
  if (score >= 50) return "warn";
  return "bad";
}

function fuelStatusLine(score?: number) {
  if (typeof score !== "number") return "No recent Fuel analysis.";
  if (score >= 80) return "Fuel support is strong for current camp load.";
  if (score >= 60) return "Fuel support is acceptable, but can be tighter.";
  if (score >= 40) return "Fuel support is under target for reliable camp output.";
  return "Fuel support is weak and likely hurting recovery or performance.";
}

function fuelSnippet(report?: string) {
  const text = cleanSentence(report);
  if (!text) return "Run Fuel AI to generate a nutrition report tied to your training.";
  if (text.length <= 120) return text;
  return `${text.slice(0, 119).trim()}…`;
}

function severityTone(
  severity?: VisionFinding["severity"]
): "good" | "warn" | "bad" | "neutral" {
  if (severity === "HIGH") return "bad";
  if (severity === "MEDIUM") return "warn";
  if (severity === "LOW") return "good";
  return "neutral";
}

function badgeToneForLoad(
  load?: CampControl["trainingLoad"]
): "neutral" | "good" | "warn" | "bad" {
  if (load === "LOW") return "good";
  if (load === "MODERATE") return "warn";
  if (load === "HIGH") return "bad";
  return "neutral";
}

function fallbackInterrupt(title?: string, detail?: string) {
  const t = String(title || "").toLowerCase();
  const d = String(detail || "").toLowerCase();

  if (t.includes("hips") || d.includes("hips")) return "Stop. Hips under you now.";
  if (t.includes("head") || d.includes("head")) return "Stop. Head up before contact.";
  if (t.includes("hand") || t.includes("reach") || d.includes("reach")) return "Stop reaching. Feet first.";
  if (t.includes("trail leg") || d.includes("trail leg")) return "Stop. Bring the trail leg under.";
  if (t.includes("foot") || d.includes("foot")) return "Stop. Bring the back foot up.";

  return "Stop. Fix position before continuing.";
}

function fallbackFixNextRep(title?: string, detail?: string) {
  const t = String(title || "").toLowerCase();
  const d = String(detail || "").toLowerCase();

  if (t.includes("hips") || d.includes("hips")) {
    return "Step deep. Drop the knee. Bring hips under before reaching.";
  }
  if (t.includes("head") || d.includes("head")) {
    return "Head up, connected, then drive through the finish.";
  }
  if (t.includes("hand") || t.includes("reach") || d.includes("reach")) {
    return "Move feet first. Do not let the hands chase the shot.";
  }
  if (t.includes("trail leg") || d.includes("trail leg") || t.includes("back foot")) {
    return "After penetration, immediately step your trail foot up under your hips before adjusting the finish.";
  }

  return "Restore structure first. Then continue the rep.";
}

function buildWhyItMatters(primary: VisionFinding | null, summary?: string) {
  if (!primary) return "Run Vision again to generate a tighter correction summary.";

  const text = firstGoodText(
    primary.dashboard_detail,
    primary.unstable,
    primary.break_point,
    primary.detail,
    primary.short_detail,
    summary
  );

  if (text) return compactSentence(text, 180);

  return "This correction is costing structure and making the exchange easier to stop.";
}

function buildIfIgnored(primary: VisionFinding | null) {
  if (!primary) return "You lose the exchange before the finish is established.";

  const text = firstGoodText(
    primary.if_ignored,
    primary.break_point,
    primary.short_detail
  );

  if (text) return compactSentence(text, 160);

  return "Opponent gets the defensive answer before the finish is established.";
}

function buildTrainToday(
  topCorrection: VisionFinding | null,
  session: DailySession | null,
  camp: SavedCamp | null
) {
  if (topCorrection?.train?.length) return topCorrection.train.slice(0, 4);
  if (session?.blocks?.length) return session.blocks.slice(0, 4);

  const title = String(topCorrection?.title || "").toLowerCase();

  if (title.includes("hips")) {
    return [
      "10 min paused penetration steps with hips under shoulders.",
      "10 min freeze-and-continue entries focused on posture.",
      "10 min wall shots focused only on hip line and drive.",
      "10 min light shadow reps on the same correction.",
    ];
  }

  if (title.includes("hand") || title.includes("reach")) {
    return [
      "10 min feet-first entry reps.",
      "10 min re-attack shots without reaching.",
      "10 min hand discipline against light reaction defense.",
      "10 min shadow reps with strict hand timing.",
    ];
  }

  if (title.includes("trail leg") || title.includes("back foot")) {
    return [
      "10 min penetration-to-trail-foot recovery reps.",
      "10 min freeze after the knee, then step the back foot up.",
      "10 min finish chains focused only on base recovery.",
      "10 min shadow reps on stepping the trail foot under the hips.",
    ];
  }

  const primary = camp?.trainingFocus?.primary ?? [];
  if (primary.length) return primary.slice(0, 4);

  return [
    "Build camp in Sensei.",
    "Run one technical block instead of random rounds.",
    "Carry one correction through the full session.",
    "Retest the same issue after the session.",
  ];
}

function buildCoachNotes(camp: SavedCamp | null, fuelLoaded: boolean) {
  const notes: string[] = [];

  if (camp?.directive?.bullets?.length) {
    notes.push(...camp.directive.bullets.slice(0, 2));
  }
  if (camp?.control?.warnings?.length) {
    notes.push(...camp.control.warnings.slice(0, 1));
  }
  if (!fuelLoaded) {
    notes.push(
      "No Fuel data loaded: training decisions are being made without nutrition or recovery context."
    );
  }

  return notes.slice(0, 3);
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
      {children}
    </span>
  );
}

function IOSCard({
  title,
  sub,
  right,
  children,
  strong = false,
}: {
  title: string;
  sub?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  strong?: boolean;
}) {
  return (
    <section
      className={cn(
        "rounded-[28px] border p-4 shadow-[0_16px_50px_rgba(0,0,0,0.26)] md:p-5",
        strong
          ? "border-emerald-400/12 bg-gradient-to-br from-[#071a3b] via-[#030b18] to-[#020810]"
          : "border-white/8 bg-white/[0.03]"
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm font-semibold text-white">{title}</div>
          {sub ? <div className="mt-1 text-xs text-white/55">{sub}</div> : null}
        </div>
        {right}
      </div>
      <div className="mt-4">{children}</div>
    </section>
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
    <ul className={cn("text-sm text-white/90", compact ? "space-y-1.5" : "space-y-2.5")}>
      {items.map((item, i) => (
        <li key={i} className="flex gap-2">
          <span className={cn("mt-2 h-1.5 w-1.5 shrink-0 rounded-full", dotClass)} />
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
      <div className="rounded-[22px] border border-white/10 bg-black/25 p-3">
        <div className="text-[10px] uppercase tracking-[0.22em] text-white/45">{label}</div>
        <div className="mt-2 text-sm font-semibold text-white">{value}</div>
      </div>
    );
}

function ActionButton({
  href,
  label,
  strong = false,
}: {
  href: string;
  label: string;
  strong?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "rounded-[20px] border px-4 py-3 text-center text-sm transition",
        strong
          ? "border-emerald-400/20 bg-emerald-500/12 text-emerald-50 hover:bg-emerald-500/18"
          : "border-white/10 bg-black/25 text-white hover:border-white/20"
      )}
    >
      {label}
    </Link>
  );
}

export default function DashboardClient() {
  const { fighterContext } = useFighterContext();

  const [camp, setCamp] = useState<SavedCamp | null>(null);
  const [vision, setVision] = useState<VisionAnalysis | null>(null);
  const [fuel, setFuel] = useState<FuelMemory | null>(null);
  const [weightLogs, setWeightLogs] = useState<WeightLog[]>([]);
  const [weightInput, setWeightInput] = useState("");
  const [showSupporting, setShowSupporting] = useState(false);
  const [showSystems, setShowSystems] = useState(false);

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

  const weightDifference =
    currentWeight !== null && typeof targetWeight === "number"
      ? Number((currentWeight - targetWeight).toFixed(1))
      : null;

  const progressPct =
    currentWeight !== null && typeof targetWeight === "number"
      ? Math.max(0, Math.min(100, 100 - Math.max(0, currentWeight - targetWeight) * 8))
      : 0;

  const findings = useMemo(
    () => (Array.isArray(vision?.findings) ? vision.findings : []),
    [vision]
  );

  const primaryCorrection = findings[0] ?? null;
  const secondaryCorrections = findings.slice(1, 3);

  const correctionInterrupt =
    primaryCorrection?.interrupt ||
    fallbackInterrupt(primaryCorrection?.title, primaryCorrection?.detail);

  const fixNextRep =
    primaryCorrection?.fix_next_rep ||
    fallbackFixNextRep(primaryCorrection?.title, primaryCorrection?.detail);

  const whyItMatters = buildWhyItMatters(primaryCorrection, vision?.summary);
  const costIfIgnored = buildIfIgnored(primaryCorrection);

  const executionBlocks = buildTrainToday(primaryCorrection, camp?.dailySession ?? null, camp);

  const coachNotes = useMemo(
    () => buildCoachNotes(camp, !!fuel?.score || !!fuel?.report),
    [camp, fuel]
  );

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

  const sessionTitle = camp?.dailySession?.title || "Correction session";

  const sessionMeta = camp?.dailySession
    ? `${camp.dailySession.timingLabel} · Goal: ${camp.dailySession.goal}`
    : "This session should revolve around one real correction, not variety.";

  return (
    <main className="min-h-[calc(100vh-72px)] bg-[#020810] px-0 pb-8 pt-2 text-white">
      <div className="mx-auto max-w-2xl space-y-4">
        <IOSCard
          title="Dashboard"
          sub="Fix one thing. Train one thing. Ignore everything else."
          right={<Badge tone={statusTone(weightStatus)}>{weightStatus}</Badge>}
          strong
        >
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[11px] text-white/70">
              Weight class: <span className="text-white">{weightClass}</span>
            </span>
            {camp?.dailySession ? (
              <span className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1 text-[11px] text-emerald-100">
                Today: {camp.dailySession.durationMin} min
              </span>
            ) : null}
          </div>
        </IOSCard>

        <IOSCard
          title="Fix this now"
          sub="This is the session. Everything else is secondary."
          right={
            primaryCorrection ? (
              <Badge tone={severityTone(primaryCorrection.severity)}>
                {primaryCorrection.severity}
              </Badge>
            ) : (
              <Badge tone="warn">No clip loaded</Badge>
            )
          }
          strong
        >
          {primaryCorrection ? (
            <div className="space-y-4">
              <div className="rounded-[24px] border border-rose-500/20 bg-[#060912] p-4">
                <div className="text-[11px] uppercase tracking-[0.28em] text-rose-200/70">
                  Primary command
                </div>

                <div className="mt-3 text-5xl font-bold tracking-tight leading-[1.02] text-white md:text-6xl">
                  {primaryCorrection.title}
                </div>

                <div className="mt-4 rounded-[22px] border border-rose-500/20 bg-black/20 p-4">
                  <div className="text-[11px] uppercase tracking-[0.22em] text-rose-200/80">
                    Stop command
                  </div>
                  <div className="mt-2 text-xl font-semibold text-rose-50">
                    {correctionInterrupt}
                  </div>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-[22px] border border-white/10 bg-black/25 p-4">
                  <div className="text-[11px] uppercase tracking-[0.22em] text-white/45">
                    Why it matters
                  </div>
                  <div className="mt-3 text-lg leading-8 text-white/90">
                    {whyItMatters}
                  </div>
                </div>

                <div className="rounded-[22px] border border-emerald-400/20 bg-emerald-500/[0.07] p-4">
                  <div className="text-[11px] uppercase tracking-[0.22em] text-emerald-200/80">
                    Fix next rep
                  </div>
                  <div className="mt-3 text-2xl font-semibold leading-10 text-emerald-50">
                    {fixNextRep}
                  </div>
                </div>
              </div>

              <div className="rounded-[22px] border border-white/10 bg-black/25 p-4">
                <div className="text-[11px] uppercase tracking-[0.22em] text-white/45">
                  If ignored
                </div>
                <div className="mt-3 text-lg leading-8 text-white/80">
                  {costIfIgnored}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <ActionButton href="/sensei" label="Begin session" strong />
                <ActionButton href="/sensei-vision" label="Verify fix" />
              </div>
            </div>
          ) : (
            <div className="rounded-[22px] border border-dashed border-white/10 bg-black/20 p-5 text-sm text-white/60">
              No recent Vision analysis. Upload a clip in Sensei Vision so the system can lock onto one real correction.
            </div>
          )}
        </IOSCard>

        <IOSCard
          title="Today’s work"
          sub="Do this. Do not chase variety."
          right={
            camp?.dailySession ? (
              <Badge tone="good">{camp.dailySession.durationMin} min</Badge>
            ) : (
              <Badge tone="warn">Build camp</Badge>
            )
          }
        >
          <div className="space-y-4">
            <div className="rounded-[22px] border border-emerald-400/18 bg-emerald-500/[0.05] p-4">
              <div className="text-base font-semibold text-white">{sessionTitle}</div>
              <div className="mt-1 text-xs text-white/60">{sessionMeta}</div>
            </div>

            <BulletList items={executionBlocks} />
          </div>
        </IOSCard>

        <IOSCard
          title="System layer"
          sub="Fuel, weight, notes, and camp control."
          right={
            <button
              type="button"
              onClick={() => setShowSystems((v) => !v)}
              className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[11px] text-white/75 transition hover:border-white/20 hover:text-white"
            >
              {showSystems ? "Hide" : "Show"}
            </button>
          }
        >
          {showSystems ? (
            <div className="space-y-4">
              <IOSCard
                title="Fuel status"
                sub="Nutrition support for current camp load."
                right={
                  fuel?.score !== undefined ? (
                    <Badge tone={getFuelTone(fuel.score)}>Score {Math.round(fuel.score)}</Badge>
                  ) : (
                    <Badge tone="warn">Missing</Badge>
                  )
                }
              >
                <div className="space-y-3">
                  <div className="rounded-[20px] border border-white/10 bg-black/25 p-4">
                    <div className="text-sm text-white/90">{fuelStatusLine(fuel?.score)}</div>
                  </div>

                  <div className="rounded-[20px] border border-white/10 bg-black/25 p-4">
                    <div className="text-[11px] uppercase tracking-[0.22em] text-white/45">
                      Latest Fuel note
                    </div>
                    <div className="mt-2 text-sm leading-6 text-white/75">
                      {fuelSnippet(fuel?.report)}
                    </div>
                  </div>

                  <ActionButton href="/fuel" label="Open Fuel AI" strong />
                </div>
              </IOSCard>

              <IOSCard
                title="Weight status"
                sub="Trajectory toward fight weight."
                right={<Badge tone={statusTone(weightStatus)}>{weightStatus}</Badge>}
              >
                <div className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <MiniStat
                      label="Current"
                      value={currentWeight !== null ? `${currentWeight} kg` : "Not logged"}
                    />
                    <MiniStat
                      label="Target"
                      value={typeof targetWeight === "number" ? `${targetWeight} kg` : "Not set"}
                    />
                    <MiniStat
                      label="Difference"
                      value={weightDifference !== null ? `${weightDifference.toFixed(1)} kg` : "—"}
                    />
                  </div>

                  <div>
                    <div className="mb-2 text-[11px] uppercase tracking-[0.22em] text-white/45">
                      Trajectory
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full border border-white/10 bg-black/40">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all",
                          weightStatus === "On Track"
                            ? "bg-emerald-400/80"
                            : weightStatus === "Slightly Behind"
                            ? "bg-amber-400/80"
                            : weightStatus === "Off Track"
                            ? "bg-rose-400/80"
                            : "bg-white/20"
                        )}
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                  </div>

                  <div className="rounded-[20px] border border-white/10 bg-black/25 p-4">
                    <div className="text-[11px] uppercase tracking-[0.22em] text-white/45">
                      Log weight
                    </div>
                    <div className="mt-3 flex gap-2">
                      <input
                        value={weightInput}
                        onChange={(e) => setWeightInput(e.target.value)}
                        placeholder="e.g. 68.2"
                        className="w-full rounded-[18px] border border-white/10 bg-black/30 px-4 py-3 text-sm text-white placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-emerald-400/20"
                      />
                      <button
                        onClick={handleLogWeight}
                        className="rounded-[18px] bg-emerald-400 px-4 py-3 text-sm font-medium text-[#041026] hover:bg-emerald-300"
                      >
                        Log
                      </button>
                    </div>
                  </div>
                </div>
              </IOSCard>

              <IOSCard
                title="Coach notes"
                sub="Short carryover notes for today."
                right={<Badge tone="neutral">Daily</Badge>}
              >
                {coachNotes.length ? (
                  <BulletList items={coachNotes} compact />
                ) : (
                  <div className="text-sm text-white/60">
                    No coach notes yet. Build a camp in Sensei first.
                  </div>
                )}
              </IOSCard>

              <IOSCard
                title="Mission state"
                sub="Today’s command state."
                right={<Badge tone={statusTone(weightStatus)}>{weightStatus}</Badge>}
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <MiniStat
                    label="Directive"
                    value={compactSentence(
                      primaryCorrection?.title || camp?.directive?.title || "No primary correction yet",
                      40
                    )}
                  />
                  <MiniStat
                    label="Days remaining"
                    value={daysRemaining !== null ? `${daysRemaining} days` : "—"}
                  />
                  <MiniStat label="Fight date" value={fightDate ?? "No fight scheduled"} />
                  <MiniStat
                    label="Current weight"
                    value={currentWeight !== null ? `${currentWeight} kg` : "Not logged"}
                  />
                </div>
              </IOSCard>

              <IOSCard
                title="Supporting issues"
                sub="These are real, but they do not override the main correction."
                right={
                  secondaryCorrections.length ? (
                    <button
                      type="button"
                      onClick={() => setShowSupporting((v) => !v)}
                      className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[11px] text-white/75 transition hover:border-white/20 hover:text-white"
                    >
                      {showSupporting ? "Hide" : `Show ${secondaryCorrections.length}`}
                    </button>
                  ) : (
                    <Badge tone="neutral">None</Badge>
                  )
                }
              >
                {secondaryCorrections.length ? (
                  <div className="space-y-3">
                    {showSupporting ? (
                      <>
                        {secondaryCorrections.map((item, i) => {
                          const shortText =
                            item.short_detail ||
                            item.unstable ||
                            item.break_point ||
                            item.good ||
                            "Secondary issue detected.";

                          return (
                            <div
                              key={item.id ?? i}
                              className="rounded-[20px] border border-white/10 bg-black/25 p-4"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="text-sm font-semibold text-white">{item.title}</div>
                                  <div className="mt-2 text-sm text-white/70">
                                    {compactSentence(shortText, 140)}
                                  </div>
                                </div>
                                <Badge tone={severityTone(item.severity)}>{item.severity}</Badge>
                              </div>
                            </div>
                          );
                        })}

                        <Link
                          href="/sensei-vision"
                          className="inline-flex text-xs text-emerald-300 hover:text-emerald-200"
                        >
                          Open full Vision report →
                        </Link>
                      </>
                    ) : (
                      <div className="text-sm text-white/60">
                        Secondary problems are hidden until the main correction is understood.
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-sm text-white/60">
                    No secondary issues loaded.
                  </div>
                )}
              </IOSCard>

              <IOSCard
                title="Quick actions"
                sub="Use the important tools fast."
                right={<Badge tone="good">Actions</Badge>}
              >
                <div className="grid gap-3 sm:grid-cols-3">
                  <ActionButton href="/sensei" label="Begin session" strong />
                  <ActionButton href="/sensei-vision" label="Upload sparring clip" />
                  <ActionButton href="/fuel" label="Check Fuel" />
                </div>
              </IOSCard>

              {camp?.control ? (
                <IOSCard
                  title="Camp control"
                  sub="Load, warnings, and next step."
                  right={
                    <Badge tone={badgeToneForLoad(camp.control.trainingLoad)}>
                      {camp.control.trainingLoad}
                    </Badge>
                  }
                >
                  <div className="grid gap-4">
                    <div className="grid grid-cols-3 gap-3">
                      <MiniStat label="Load" value={camp.control.trainingLoad} />
                      <MiniStat label="Warnings" value={String(camp.control.warnings.length)} />
                      <MiniStat label="Next steps" value={String(camp.control.nextStep.length)} />
                    </div>

                    {camp.control.warnings.length ? (
                      <div className="rounded-[20px] border border-white/10 bg-black/25 p-4">
                        <div className="text-[11px] uppercase tracking-[0.22em] text-white/45">
                          Warnings
                        </div>
                        <div className="mt-3">
                          <BulletList items={camp.control.warnings.slice(0, 2)} tone="amber" compact />
                        </div>
                      </div>
                    ) : null}

                    {camp.control.nextStep.length ? (
                      <div className="rounded-[20px] border border-white/10 bg-black/25 p-4">
                        <div className="text-[11px] uppercase tracking-[0.22em] text-white/45">
                          Next step
                        </div>
                        <div className="mt-2 text-sm text-white/85">
                          {compactSentence(camp.control.nextStep[0], 140)}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </IOSCard>
              ) : null}
            </div>
          ) : (
            <div className="text-sm text-white/60">
              System layer is hidden until you need it.
            </div>
          )}
        </IOSCard>
      </div>
    </main>
  );
}