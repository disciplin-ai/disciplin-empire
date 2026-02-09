"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useProfile } from "../../components/ProfileProvider";
import { useSenseiPlan } from "../../hooks/useSenseiPlan";

type Goal = "pressure" | "speed" | "power" | "recovery" | "mixed";

const DASH_KEY = "disciplin_dash_v2";

type DashMem = {
  lastGoal?: Goal;
  lastSenseiAt?: string; // ISO
  lastFuelAt?: string; // ISO
};

function relTime(iso?: string) {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "—";
  const mins = Math.floor((Date.now() - t) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function goalLabel(g: Goal) {
  if (g === "pressure") return "Pressure";
  if (g === "speed") return "Speed";
  if (g === "power") return "Power";
  if (g === "recovery") return "Recovery";
  return "Mixed";
}

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export default function DashboardPage() {
  const { profile, loading: profileLoading } = useProfile();
  const { plan, loading: senseiLoading, error: senseiError, askSensei, resetPlan } =
    useSenseiPlan();

  const [dash, setDash] = useState<DashMem>({});
  const [toast, setToast] = useState<string | null>(null);

  // load/save dashboard memory
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DASH_KEY);
      if (raw) setDash(JSON.parse(raw));
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(DASH_KEY, JSON.stringify(dash));
    } catch {}
  }, [dash]);

  const ping = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 1600);
  };

  const nickname =
    (profile as any)?.nickname ||
    (profile as any)?.fightName ||
    (profile as any)?.username ||
    profile?.name ||
    "Unknown fighter";

  const baseArt = (profile as any)?.baseArt || "Set your base art";
  const competitionLevel = (profile as any)?.competitionLevel || "Not set";
  const weeklySessions = (profile as any)?.weeklySessions || "0";

  const profileReady = !!profile;
  const todayGoal = dash.lastGoal ?? "mixed";
  const todaySensei = dash.lastSenseiAt ? relTime(dash.lastSenseiAt) : "Not started";
  const todayFuel = dash.lastFuelAt ? relTime(dash.lastFuelAt) : "Not logged";

  const goalButtons: Array<{ goal: Goal; title: string; desc: string }> = useMemo(
    () => [
      { goal: "pressure", title: "Pressure", desc: "Wrestling pace, cage work, cardio warfare." },
      { goal: "speed", title: "Speed", desc: "Sharp striking, crisp reactions." },
      { goal: "power", title: "Power", desc: "Explosive shots, low volume, perfect form." },
      { goal: "recovery", title: "Recovery", desc: "Low impact, technical drills, reset." },
      { goal: "mixed", title: "Mixed", desc: "Balanced striking + grappling focus." },
    ],
    []
  );

  const handleAskSensei = (goal: Goal) => {
    // Keep your existing behavior
    resetPlan();
    setDash((d) => ({
      ...d,
      lastGoal: goal,
      lastSenseiAt: new Date().toISOString(),
    }));
    ping(`Focus set: ${goalLabel(goal)}`);

    // Hook injects profile context
    askSensei({ goal });
  };

  const markFuelLogged = () => {
    setDash((d) => ({ ...d, lastFuelAt: new Date().toISOString() }));
    ping("Fuel marked as logged");
  };

  // --------- "Real app" state model ----------
  const nextStep = useMemo(() => {
    if (profileLoading) return { key: "loading", title: "Loading your identity…", body: "One moment." };

    if (!profileReady) {
      return {
        key: "profile",
        title: "Complete your Profile",
        body: "Sensei needs your style, stance, level, and weight to generate safe sessions.",
        ctaLabel: "Finish Profile",
        ctaHref: "/profile",
      };
    }

    if (!dash.lastSenseiAt && !plan) {
      return {
        key: "sensei-first",
        title: "Start your first Sensei session",
        body: "Pick a focus. The dashboard will remember it and generate your blueprint.",
      };
    }

    if (plan) {
      return {
        key: "plan-ready",
        title: "Session blueprint ready",
        body: "Review the rounds below. If anything is wrong, clear and generate again.",
      };
    }

    return {
      key: "steady",
      title: "Keep consistency",
      body: "Small daily wins beat random big days.",
    };
  }, [profileLoading, profileReady, dash.lastSenseiAt, plan]);

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-950">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6 md:py-10">
        {/* Top header strip (calm + "alive") */}
        <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="space-y-1">
            <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
              Dashboard
            </p>
            <p className="text-sm text-slate-200">
              Focus{" "}
              <span className="text-emerald-300 font-semibold">{goalLabel(todayGoal)}</span>
              {"  "}• Sensei{" "}
              <span className="text-slate-300">{todaySensei}</span>
              {"  "}• Fuel{" "}
              <span className="text-slate-300">{todayFuel}</span>
            </p>
          </div>

          <div className="flex items-center gap-2">
            {toast && (
              <span className="text-[11px] px-3 py-1 rounded-full border border-slate-700 bg-slate-900/40 text-slate-200">
                {toast}
              </span>
            )}
            <Link
              href="/profile"
              className="text-[11px] px-3 py-1 rounded-full border border-slate-800 hover:border-emerald-400/60 text-slate-300 hover:text-emerald-200"
            >
              Profile →
            </Link>
          </div>
        </div>

        {/* PRIMARY: Next Step card (this is what makes it feel like an app) */}
        <section className="rounded-2xl border border-slate-800 bg-slate-950/90 p-4 md:p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                Next action
              </p>
              <h2 className="mt-1 text-lg md:text-xl font-semibold text-slate-50">
                {nextStep.title}
              </h2>
              <p className="mt-1 text-xs md:text-sm text-slate-300">
                {nextStep.body}
              </p>
            </div>

            {nextStep.key === "profile" && (
              <Link
                href="/profile"
                className="shrink-0 rounded-full bg-emerald-400 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-300"
              >
                Finish Profile
              </Link>
            )}

            {nextStep.key === "plan-ready" && (
              <button
                onClick={resetPlan}
                className="shrink-0 rounded-full border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-200 hover:border-rose-400/70 hover:text-rose-200"
              >
                Clear plan
              </button>
            )}
          </div>

          {senseiError && (
            <p className="mt-3 text-[11px] text-rose-400">Sensei: {senseiError}</p>
          )}

          {!profileReady && !profileLoading && (
            <p className="mt-3 text-[11px] text-amber-300">
              Profile is required for Sensei sessions (prevents generic advice).
            </p>
          )}
        </section>

        {/* Row 1: Identity + Goal picker */}
        <section className="grid gap-4 md:grid-cols-[1.55fr,1.15fr]">
          {/* Identity */}
          <div className="rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900/90 via-slate-950 to-slate-950 p-4 md:p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                  Fighter
                </p>
                <h1 className="mt-1 text-xl font-semibold text-slate-50 md:text-2xl truncate">
                  {nickname}
                </h1>
                <p className="mt-1 text-xs text-slate-400">
                  {baseArt} • {competitionLevel}
                </p>
              </div>

              <div className="flex flex-col items-end gap-1">
                <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.15em] text-emerald-300">
                  DISCIPLIN
                </span>
                <span className="text-[10px] text-slate-500">Profile-powered</span>
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-xl border border-slate-800/80 bg-slate-900/70 p-3">
                <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
                  Weekly sessions
                </p>
                <p className="mt-1 text-lg font-semibold text-slate-50">
                  {weeklySessions}
                </p>
                <p className="mt-1 text-[11px] text-slate-400">
                  Drives volume + recovery balance.
                </p>
              </div>

              <div className="rounded-xl border border-slate-800/80 bg-slate-900/70 p-3">
                <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
                  Sensei
                </p>
                <p className="mt-1 text-sm font-semibold text-emerald-300">
                  {senseiLoading ? "Calculating…" : plan ? "Session ready" : "Idle"}
                </p>
                <p className="mt-1 text-[11px] text-slate-400">
                  Last: {dash.lastSenseiAt ? relTime(dash.lastSenseiAt) : "—"}
                </p>
              </div>

              <div className="rounded-xl border border-slate-800/80 bg-slate-900/70 p-3">
                <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
                  Profile
                </p>
                <p className="mt-1 text-sm text-slate-200">
                  {profileLoading ? "Loading…" : profile ? "Set" : "Not set"}
                </p>
                <p className="mt-1 text-[11px] text-slate-400">
                  <Link href="/profile" className="underline hover:text-emerald-200">
                    Edit profile
                  </Link>
                </p>
              </div>
            </div>
          </div>

          {/* Goal picker (primary action when profile exists) */}
          <div className="flex flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-950/80 p-4 md:p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                  Create today’s session
                </p>
                <p className="mt-1 text-sm text-slate-200">
                  Choose one focus. Everything else becomes secondary.
                </p>
              </div>

              <span className="text-[11px] text-slate-400">
                Focus:{" "}
                <span className="text-emerald-300 font-semibold">
                  {goalLabel(todayGoal)}
                </span>
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[11px] md:grid-cols-3">
              {goalButtons.map((b) => {
                const active = todayGoal === b.goal;
                return (
                  <button
                    key={b.goal}
                    onClick={() => handleAskSensei(b.goal)}
                    disabled={senseiLoading || !profileReady}
                    className={cn(
                      "rounded-xl border px-3 py-2 text-left font-medium transition disabled:cursor-not-allowed disabled:opacity-40",
                      active
                        ? "border-emerald-500/70 bg-emerald-500/10 text-emerald-100"
                        : "border-slate-800 bg-slate-900/80 text-slate-100 hover:border-emerald-500/70 hover:bg-slate-900/90"
                    )}
                  >
                    {b.title}
                    <span className="mt-1 block text-[10px] font-normal text-slate-400">
                      {b.desc}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="pt-1 flex items-center justify-between">
              <Link
                href="/sensei"
                className="text-[11px] text-slate-400 underline hover:text-emerald-200"
              >
                Open Sensei →
              </Link>

              <Link
                href="/fuel"
                onClick={markFuelLogged}
                className="text-[11px] text-slate-400 underline hover:text-emerald-200"
              >
                Open Fuel →
              </Link>
            </div>
          </div>
        </section>

        {/* Row 2: Sensei output + simple progression */}
        <section className="grid gap-4 md:grid-cols-[1.55fr,1.15fr]">
          {/* Plan viewer */}
          <div className="rounded-2xl border border-slate-800 bg-slate-950/90 p-4 md:p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                  Session blueprint
                </p>
                <p className="mt-1 text-sm text-slate-200">
                  Warmup → rounds → finisher → safety.
                </p>
              </div>
              {plan && (
                <button
                  onClick={resetPlan}
                  className="rounded-full border border-slate-700 px-3 py-1 text-[11px] text-slate-300 hover:border-rose-400 hover:text-rose-200"
                >
                  Clear
                </button>
              )}
            </div>

            {!plan && (
              <div className="mt-6 rounded-xl border border-dashed border-slate-800 bg-slate-950/60 p-4 text-sm text-slate-400">
                Choose a focus. The blueprint appears here.
              </div>
            )}

            {plan && (
              <div className="mt-4 space-y-5 text-xs text-slate-200">
                <div>
                  <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Warmup
                  </h3>
                  <ul className="mt-2 space-y-1 text-slate-300">
                    {plan.warmup.map((item: string, idx: number) => (
                      <li key={idx}>• {item}</li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Main rounds
                  </h3>
                  <div className="mt-2 space-y-2">
                    {plan.mainRounds.map((round: any) => (
                      <div
                        key={round.round}
                        className="rounded-xl border border-slate-800 bg-slate-900/70 p-3"
                      >
                        <p className="text-[11px] font-semibold text-slate-100">
                          Round {round.round} • {round.durationSeconds}s •{" "}
                          <span className="uppercase tracking-wide text-emerald-300">
                            {round.intensity}
                          </span>
                        </p>
                        <p className="mt-1 text-[11px] text-slate-300">Focus: {round.focus}</p>
                        <p className="mt-1 text-[11px] text-slate-300">Drill: {round.drill}</p>
                        <p className="mt-1 text-[11px] text-slate-400">
                          Cues: {round.coachingCues.join(" • ")}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Finisher
                  </h3>
                  <p className="mt-2 text-[11px] text-slate-300">{plan.finisher}</p>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                      Notes
                    </h3>
                    <ul className="mt-2 space-y-1 text-[11px] text-slate-300">
                      {plan.notes.map((note: string, idx: number) => (
                        <li key={idx}>• {note}</li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-rose-300">
                      Safety
                    </h3>
                    <ul className="mt-2 space-y-1 text-[11px] text-rose-200">
                      {plan.safety.map((s: string, idx: number) => (
                        <li key={idx}>• {s}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right: Progress (simple, honest) */}
          <div className="flex flex-col gap-4">
            <div className="rounded-2xl border border-slate-800 bg-slate-950/90 p-4 md:p-5">
              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                Progress
              </p>

              <div className="mt-3 space-y-3">
                <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-3">
                  <p className="text-xs font-semibold text-slate-200">Sensei session</p>
                  <p className="mt-1 text-[11px] text-slate-400">
                    {dash.lastSenseiAt ? `Last: ${relTime(dash.lastSenseiAt)}` : "Not started"}
                  </p>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-[11px] text-slate-500">
                      {dash.lastSenseiAt ? "Completed" : "Pending"}
                    </span>
                    <button
                      onClick={() => handleAskSensei(dash.lastGoal ?? "mixed")}
                      disabled={senseiLoading || !profileReady}
                      className="rounded-full border border-slate-700 px-3 py-1 text-[11px] text-slate-300 hover:border-emerald-400 hover:text-emerald-200 disabled:opacity-40"
                    >
                      Start →
                    </button>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-3">
                  <p className="text-xs font-semibold text-slate-200">Fuel</p>
                  <p className="mt-1 text-[11px] text-slate-400">
                    {dash.lastFuelAt ? `Last: ${relTime(dash.lastFuelAt)}` : "Not logged"}
                  </p>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-[11px] text-slate-500">
                      {dash.lastFuelAt ? "Logged" : "Pending"}
                    </span>
                    <Link
                      href="/fuel"
                      onClick={markFuelLogged}
                      className="rounded-full border border-slate-700 px-3 py-1 text-[11px] text-slate-300 hover:border-emerald-400 hover:text-emerald-200"
                    >
                      Open →
                    </Link>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
              <p className="text-xs font-semibold text-emerald-100">Micro-win</p>
              <p className="mt-1 text-xs text-emerald-100/90">
                Focus + session generation now feels “directed.” Next: connect this to a real log.
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}