"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useProfile } from "./ProfileProvider";

type Focus = "Pressure" | "Speed" | "Power" | "Recovery" | "Mixed";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function formatDaysAgo(days: number) {
  if (days <= 0) return "Today";
  if (days === 1) return "1d ago";
  return `${days}d ago`;
}

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

export default function DashboardClient() {
  const { profile } = useProfile();

  const name = profile?.name || "Fighter";
  const base = profile?.baseArt || "MMA";
  const level = profile?.competitionLevel || "Amateur";

  const [focus, setFocus] = useState<Focus>("Speed");

  // TODO: Replace these with real DB values once logs exist.
  const mock = useMemo(() => {
    const lastSenseiDaysAgo = 30;
    const lastFuelDaysAgo = 30;
    const sessionsThisWeek = 0;
    const streakDays = 0;

    // Technical tracker (SenseiVision)
    const vision = {
      lastGrade: 0, // 0 when no data
      bestGrade: 0,
      lastErrorCode: "—",
      delta: null as number | null,
      lastVisionDaysAgo: 0,
    };

    // A preview of last entries (once you have logs)
    const recentLog: Array<{ title: string; meta: string; href: string }> = [
      { title: "No sessions logged yet", meta: "Start one today", href: "/sensei" },
      { title: "No SenseiVision analyses yet", meta: "Analyze a frame", href: "/sensei-vision" },
    ];

    return {
      lastSenseiDaysAgo,
      lastFuelDaysAgo,
      sessionsThisWeek,
      streakDays,
      vision,
      recentLog,
    };
  }, []);

  const focusCards: Array<{ id: Focus; desc: string; sub: string }> = useMemo(
    () => [
      { id: "Pressure", desc: "pace + re-attacks", sub: "Wrestling pressure, cage work, cardio warfare." },
      { id: "Speed", desc: "entries + resets", sub: "Sharp striking, crisp reactions, fast hands." },
      { id: "Power", desc: "quality singles", sub: "Explosive shots, low volume, perfect form." },
      { id: "Recovery", desc: "repair + skill", sub: "Low impact, tissue quality, safe output." },
      { id: "Mixed", desc: "balanced output", sub: "Striking + grappling priorities, no drift." },
    ],
    []
  );

  const todayPlan = useMemo(() => {
    switch (focus) {
      case "Pressure":
        return {
          headline: "Pressure session. No pauses.",
          nextAction: "Open Sensei → generate Pressure session",
          blocks: [
            { title: "Warmup", bullets: ["8–10 min easy + mobility", "Handfight shadow: forehead pressure + elbows in (3 min)"] },
            { title: "Rounds", bullets: ["5×3 min: chain entry → re-attack (no reset)", "1 rule: if you miss, you re-shoot immediately"] },
            { title: "Finisher", bullets: ["8–10 min tempo intervals", "Nasal breathing until last 90s"] },
            { title: "Safety", bullets: ["If form collapses, cut volume by 20% and keep quality"] },
          ],
        };
      case "Speed":
        return {
          headline: "Speed session. Crisp reps only.",
          nextAction: "Open Sensei → generate Speed session",
          blocks: [
            { title: "Warmup", bullets: ["Footwork + snap shots (8 min)", "2×2 min: jab-only with resets"] },
            { title: "Rounds", bullets: ["6×2 min: fast hands, hard reset discipline", "Between rounds: 30s light bounce"] },
            { title: "Finisher", bullets: ["6–10 short hill sprints", "Full walk-back recovery"] },
            { title: "Safety", bullets: ["Stop if mechanics degrade; speed without form = waste"] },
          ],
        };
      case "Power":
        return {
          headline: "Power session. Stop before form breaks.",
          nextAction: "Open Sensei → generate Power session",
          blocks: [
            { title: "Warmup", bullets: ["Nervous system primes (8–10 min)", "3×3 clean explosive reps (easy)"] },
            { title: "Main", bullets: ["Singles: 8–12 total perfect reps", "Full reset between reps (60–90s)"] },
            { title: "Finisher", bullets: ["6 min explosive circuit (short bursts)", "End early if speed drops"] },
            { title: "Safety", bullets: ["No grinding reps; quality only"] },
          ],
        };
      case "Recovery":
        return {
          headline: "Recovery session. Leave fresher than you came.",
          nextAction: "Open Sensei → generate Recovery session",
          blocks: [
            { title: "Warmup", bullets: ["Breathing + joint prep (8 min)", "Long exhale work (2–3 min)"] },
            { title: "Technique", bullets: ["Flow drilling 30–45 min", "Zero fatigue reps; perfect positions"] },
            { title: "Finish", bullets: ["Long walk + mobility (20–30 min)", "Soft tissue (5–8 min)"] },
            { title: "Safety", bullets: ["No impact. No pivots. No ego."] },
          ],
        };
      case "Mixed":
      default:
        return {
          headline: "Mixed session. Balanced output, no drift.",
          nextAction: "Open Sensei → generate Mixed session",
          blocks: [
            { title: "Warmup", bullets: ["Mixed movement (8–10 min)", "Shadow: 2 min strike → 2 min shot entries"] },
            { title: "Rounds", bullets: ["3×3 striking + 3×3 grappling", "1 rule: keep tempo steady"] },
            { title: "Finisher", bullets: ["8 min light intervals", "Cooldown breathing 3 min"] },
            { title: "Safety", bullets: ["Keep intensity moderate; win consistency"] },
          ],
        };
    }
  }, [focus]);

  const momentumTone =
    mock.sessionsThisWeek >= 4 ? "good" : mock.sessionsThisWeek >= 2 ? "warn" : "bad";

  const visionTone =
    mock.vision.lastGrade >= 75 ? "good" : mock.vision.lastGrade >= 50 ? "warn" : mock.vision.lastGrade > 0 ? "bad" : "neutral";

  const visionDeltaText =
    mock.vision.delta == null ? "—" : mock.vision.delta >= 0 ? `+${mock.vision.delta}` : `${mock.vision.delta}`;

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 px-6 py-10">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Top bar */}
        <div className="rounded-3xl border border-slate-800 bg-slate-900/40 p-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold tracking-[0.25em] text-emerald-400">DISCIPLIN</p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-300">
              <span className="truncate">
                {name} · {base} · {level}
              </span>
              <span className="text-slate-500">•</span>
              <span>
                Focus <span className="text-emerald-200 font-semibold">{focus}</span>
              </span>
              <span className="text-slate-500">•</span>
              <span>Sensei {formatDaysAgo(mock.lastSenseiDaysAgo)}</span>
              <span className="text-slate-500">•</span>
              <span>Fuel {formatDaysAgo(mock.lastFuelDaysAgo)}</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              className="rounded-full border border-slate-700 bg-slate-950/40 px-4 py-2 text-sm hover:border-emerald-400/50"
              href="/sensei"
            >
              Open Sensei →
            </Link>
            <Link
              className="rounded-full border border-slate-700 bg-slate-950/40 px-4 py-2 text-sm hover:border-emerald-400/50"
              href="/sensei-vision"
            >
              SenseiVision →
            </Link>
            <Link
              className="rounded-full border border-slate-700 bg-slate-950/40 px-4 py-2 text-sm hover:border-emerald-400/50"
              href="/profile"
            >
              Profile →
            </Link>
          </div>
        </div>

        {/* Momentum row */}
        <div className="grid gap-4 md:grid-cols-4">
          <div className="rounded-3xl border border-slate-800 bg-slate-900/40 p-5">
            <p className="text-[11px] tracking-[0.25em] text-slate-400">SESSIONS THIS WEEK</p>
            <p className="mt-2 text-3xl font-semibold">{mock.sessionsThisWeek}</p>
            <p className="mt-1 text-xs text-slate-400">Target: 3–5.</p>
          </div>

          <div className="rounded-3xl border border-slate-800 bg-slate-900/40 p-5">
            <p className="text-[11px] tracking-[0.25em] text-slate-400">STREAK</p>
            <p className="mt-2 text-3xl font-semibold">{mock.streakDays}</p>
            <p className="mt-1 text-xs text-slate-400">Days in a row.</p>
          </div>

          <div className="rounded-3xl border border-slate-800 bg-slate-900/40 p-5">
            <p className="text-[11px] tracking-[0.25em] text-slate-400">MOMENTUM</p>
            <p
              className={cn(
                "mt-2 inline-flex items-center rounded-full border px-3 py-1 text-sm font-semibold",
                momentumTone === "good"
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                  : momentumTone === "warn"
                  ? "border-amber-500/30 bg-amber-500/10 text-amber-200"
                  : "border-rose-500/30 bg-rose-500/10 text-rose-200"
              )}
            >
              {momentumTone === "good" ? "ON TRACK" : momentumTone === "warn" ? "BEHIND" : "OFF TRACK"}
            </p>
            <p className="mt-2 text-xs text-slate-400">
              If it’s off track, your “plan” doesn’t matter.
            </p>
          </div>

          <div className="rounded-3xl border border-slate-800 bg-slate-900/40 p-5">
            <p className="text-[11px] tracking-[0.25em] text-slate-400">TECHNICAL GRADE</p>
            <p className="mt-2 text-3xl font-semibold">{mock.vision.lastGrade ? `${mock.vision.lastGrade}%` : "—"}</p>
            <p className="mt-1 text-xs text-slate-400">
              SenseiVision {mock.vision.lastVisionDaysAgo ? formatDaysAgo(mock.vision.lastVisionDaysAgo) : "—"}
            </p>
          </div>
        </div>

        {/* Main grid */}
        <div className="grid gap-6 lg:grid-cols-12">
          {/* LEFT: Focus + Quick Launch */}
          <div className="lg:col-span-5 space-y-6">
            {/* Focus selector */}
            <div className="rounded-3xl border border-slate-800 bg-slate-900/40 p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold tracking-[0.25em] text-slate-300">FOCUS</p>
                  <h2 className="mt-2 text-xl font-semibold">Choose one focus.</h2>
                  <p className="mt-1 text-sm text-slate-400">Everything else becomes secondary.</p>
                </div>
                <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-200">
                  {focus}
                </span>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {focusCards.map((c) => {
                  const on = c.id === focus;
                  return (
                    <button
                      key={c.id}
                      onClick={() => setFocus(c.id)}
                      className={cn(
                        "rounded-2xl border p-4 text-left transition",
                        on
                          ? "border-emerald-400/50 bg-emerald-500/10"
                          : "border-slate-800 bg-slate-950/40 hover:border-emerald-400/30"
                      )}
                    >
                      <p className={cn("text-sm font-semibold", on && "text-emerald-200")}>{c.id}</p>
                      <p className="mt-1 text-xs text-slate-400">{c.desc}</p>
                      <p className="mt-2 text-xs text-slate-500">{c.sub}</p>
                    </button>
                  );
                })}
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Link className="rounded-full border border-slate-700 bg-slate-950/40 px-4 py-2 text-xs hover:border-emerald-400/50" href="/sensei">
                  Generate in Sensei →
                </Link>
                <Link className="rounded-full border border-slate-700 bg-slate-950/40 px-4 py-2 text-xs hover:border-emerald-400/50" href="/sensei-vision">
                  Analyze in Vision →
                </Link>
                <Link className="rounded-full border border-slate-700 bg-slate-950/40 px-4 py-2 text-xs hover:border-emerald-400/50" href="/fuel">
                  Open Fuel →
                </Link>
              </div>
            </div>

            {/* Quick Launch */}
            <div className="rounded-3xl border border-slate-800 bg-slate-900/40 p-6">
              <p className="text-xs font-semibold tracking-[0.25em] text-slate-300">QUICK LAUNCH</p>
              <p className="mt-2 text-sm text-slate-400">Dashboard is a command center, not a homepage.</p>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <Link
                  href="/sensei"
                  className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4 hover:border-emerald-400/30 transition"
                >
                  <div className="text-sm font-semibold">Sensei</div>
                  <div className="mt-1 text-xs text-slate-400">Generate session blocks</div>
                </Link>

                <Link
                  href="/sensei-vision"
                  className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4 hover:border-emerald-400/30 transition"
                >
                  <div className="text-sm font-semibold">SenseiVision</div>
                  <div className="mt-1 text-xs text-slate-400">Freeze. Grade. Fix.</div>
                </Link>

                <Link
                  href="/fuel"
                  className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4 hover:border-emerald-400/30 transition"
                >
                  <div className="text-sm font-semibold">Fuel</div>
                  <div className="mt-1 text-xs text-slate-400">Nutrition + recovery checks</div>
                </Link>

                <Link
                  href="/gyms"
                  className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4 hover:border-emerald-400/30 transition"
                >
                  <div className="text-sm font-semibold">Gyms</div>
                  <div className="mt-1 text-xs text-slate-400">Find training partners</div>
                </Link>

                <Link
                  href="/profile"
                  className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4 hover:border-emerald-400/30 transition"
                >
                  <div className="text-sm font-semibold">Profile</div>
                  <div className="mt-1 text-xs text-slate-400">Base art, level, goals</div>
                </Link>

                <Link
                  href="/membership"
                  className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4 hover:border-emerald-400/30 transition"
                >
                  <div className="text-sm font-semibold">Membership</div>
                  <div className="mt-1 text-xs text-slate-400">Manage access</div>
                </Link>
              </div>
            </div>
          </div>

          {/* RIGHT: Today Command + Technical + Log */}
          <div className="lg:col-span-7 space-y-6">
            {/* Today Command */}
            <div className="rounded-3xl border border-slate-800 bg-slate-900/40 p-7">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0">
                  <p className="text-xs font-semibold tracking-[0.25em] text-emerald-300">TODAY</p>
                  <h2 className="mt-2 text-2xl font-semibold">{todayPlan.headline}</h2>
                  <p className="mt-1 text-sm text-slate-400">
                    {base} focus: <span className="text-emerald-200 font-semibold">{focus}</span>
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Link
                    href="/sensei"
                    className="rounded-full bg-emerald-400/95 px-5 py-2.5 text-sm font-semibold text-slate-950 hover:bg-emerald-300 transition"
                  >
                    Start in Sensei →
                  </Link>
                  <Link
                    href="/sensei-vision"
                    className="rounded-full border border-slate-700 bg-slate-950/40 px-5 py-2.5 text-sm hover:border-emerald-400/50 transition"
                  >
                    Analyze frame →
                  </Link>
                </div>
              </div>

              <div className="mt-6 grid gap-3 md:grid-cols-2">
                {todayPlan.blocks.map((b) => (
                  <div key={b.title} className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
                    <div className="text-sm font-semibold">{b.title}</div>
                    <ul className="mt-2 space-y-2 text-sm text-slate-200">
                      {b.bullets.map((x, i) => (
                        <li key={i} className="flex gap-2">
                          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-300/80" />
                          <span>{x}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>

              <div className="mt-5 rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
                <div className="text-xs font-semibold tracking-[0.25em] text-slate-400">NEXT ACTION</div>
                <div className="mt-2 text-sm text-slate-200">{todayPlan.nextAction}</div>
              </div>
            </div>

            {/* Technical tracker */}
            <div className="rounded-3xl border border-slate-800 bg-slate-900/40 p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold tracking-[0.25em] text-slate-300">TECHNICAL TRACKER</p>
                  <h3 className="mt-2 text-lg font-semibold">SenseiVision progress</h3>
                  <p className="mt-1 text-sm text-slate-400">
                    This is what makes it feel like a real training system.
                  </p>
                </div>

                <span
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs",
                    visionTone === "good"
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                      : visionTone === "warn"
                      ? "border-amber-500/30 bg-amber-500/10 text-amber-200"
                      : visionTone === "bad"
                      ? "border-rose-500/30 bg-rose-500/10 text-rose-200"
                      : "border-slate-700 bg-slate-950/40 text-slate-300"
                  )}
                >
                  {mock.vision.lastGrade ? `${mock.vision.lastGrade}%` : "No data"}
                </span>
              </div>

              <div className="mt-5 grid gap-4 sm:grid-cols-3">
                <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
                  <div className="text-[11px] tracking-[0.25em] text-slate-400">LAST</div>
                  <div className="mt-2 text-2xl font-semibold">{mock.vision.lastGrade ? `${mock.vision.lastGrade}%` : "—"}</div>
                  <div className="mt-1 text-xs text-slate-400">Δ {visionDeltaText}</div>
                </div>

                <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
                  <div className="text-[11px] tracking-[0.25em] text-slate-400">BEST</div>
                  <div className="mt-2 text-2xl font-semibold">{mock.vision.bestGrade ? `${mock.vision.bestGrade}%` : "—"}</div>
                  <div className="mt-1 text-xs text-slate-400">Peak execution</div>
                </div>

                <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
                  <div className="text-[11px] tracking-[0.25em] text-slate-400">ERROR CODE</div>
                  <div className="mt-2 text-sm font-semibold text-slate-200">{mock.vision.lastErrorCode}</div>
                  <div className="mt-1 text-xs text-slate-400">Most recent issue</div>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  href="/sensei-vision"
                  className="rounded-full bg-emerald-400/95 px-5 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-300 transition"
                >
                  Analyze now →
                </Link>
                <Link
                  href="/sensei-vision"
                  className="rounded-full border border-slate-700 bg-slate-950/40 px-5 py-2 text-sm hover:border-emerald-400/50 transition"
                >
                  View history →
                </Link>
              </div>
            </div>

            {/* Log preview */}
            <div className="rounded-3xl border border-slate-800 bg-slate-900/40 p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold tracking-[0.25em] text-slate-300">RECENT</p>
                  <h3 className="mt-2 text-lg font-semibold">Training trail</h3>
                  <p className="mt-1 text-sm text-slate-400">This is where “serious” lives: traceable work.</p>
                </div>
                <Link
                  href="/profile"
                  className="rounded-full border border-slate-700 bg-slate-950/40 px-4 py-2 text-xs hover:border-emerald-400/50 transition"
                >
                  Manage →
                </Link>
              </div>

              <div className="mt-5 space-y-3">
                {mock.recentLog.map((x, i) => (
                  <Link
                    key={`${x.title}-${i}`}
                    href={x.href}
                    className="block rounded-2xl border border-slate-800 bg-slate-950/40 p-4 hover:border-emerald-400/30 transition"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-slate-100 truncate">{x.title}</div>
                        <div className="mt-1 text-xs text-slate-400">{x.meta}</div>
                      </div>
                      <div className="text-xs text-slate-400">Open →</div>
                    </div>
                  </Link>
                ))}
              </div>

              <div className="mt-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4">
                <p className="text-sm font-semibold text-emerald-100">Micro-win</p>
                <p className="mt-1 text-xs text-emerald-200/80">
                  Dashboard now behaves like a training command board. Next: wire sessions + Vision results into real logs.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer links */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-slate-800 bg-slate-900/40 p-5">
          <div className="text-xs text-slate-400">
            Everything should be traceable: plan → execution → review → correction.
          </div>
          <div className="flex flex-wrap gap-2">
            <Link className="text-xs text-slate-300 underline hover:text-emerald-200" href="/sensei">
              Sensei
            </Link>
            <Link className="text-xs text-slate-300 underline hover:text-emerald-200" href="/sensei-vision">
              SenseiVision
            </Link>
            <Link className="text-xs text-slate-300 underline hover:text-emerald-200" href="/fuel">
              Fuel
            </Link>
            <Link className="text-xs text-slate-300 underline hover:text-emerald-200" href="/gyms">
              Gyms
            </Link>
            <Link className="text-xs text-slate-300 underline hover:text-emerald-200" href="/membership">
              Membership
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}