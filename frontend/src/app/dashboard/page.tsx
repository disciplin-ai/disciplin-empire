"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useProfile } from "../../components/ProfileProvider";
import { useSenseiPlan } from "../../hooks/useSenseiPlan";
import Link from "next/link";

type Goal = "pressure" | "speed" | "power" | "recovery" | "mixed";

const DASH_KEY = "disciplin_dash_v2";

type DashMem = {
  lastGoal?: Goal;
  lastSenseiAt?: string; // ISO
  lastFuelAt?: string; // ISO (we don’t have real Fuel hook here yet, so manual)
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

export default function DashboardPage() {
  const { profile, loading: profileLoading, user } = useProfile();
  const {
    plan,
    loading: senseiLoading,
    error: senseiError,
    askSensei,
    resetPlan,
  } = useSenseiPlan();

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

  const handleAskSensei = (goal: Goal) => {
    // Interactive dashboard effect first (so it doesn’t feel dead)
    resetPlan();

    setDash((d) => ({
      ...d,
      lastGoal: goal,
      lastSenseiAt: new Date().toISOString(),
    }));

    ping(`Focus set: ${goalLabel(goal)}`);

    // The hook injects the full fighter profile
    askSensei({ goal });
  };

  const markFuelLogged = () => {
    setDash((d) => ({ ...d, lastFuelAt: new Date().toISOString() }));
    ping("Fuel marked as logged");
  };

  const goalButtons: Array<{
    goal: Goal;
    title: string;
    desc: string;
  }> = useMemo(
    () => [
      { goal: "pressure", title: "Pressure", desc: "Wrestling pace, cage work, cardio warfare." },
      { goal: "speed", title: "Speed", desc: "Sharp striking, crisp reactions." },
      { goal: "power", title: "Power", desc: "Explosive shots, low volume, perfect form." },
      { goal: "recovery", title: "Recovery", desc: "Low impact, technical drills, reset." },
      { goal: "mixed", title: "Mixed", desc: "Balanced striking + grappling focus." },
    ],
    []
  );

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-950">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6 md:py-10">
        {/* TODAY STRIP (makes it feel alive) */}
        <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Today</p>
            <p className="mt-1 text-sm text-slate-200">
              Focus:{" "}
              <span className="text-emerald-300 font-semibold">{goalLabel(todayGoal)}</span>
              {"  "}• Sensei: <span className="text-slate-300">{todaySensei}</span>
              {"  "}• Fuel: <span className="text-slate-300">{todayFuel}</span>
            </p>
          </div>

          {toast && (
            <span className="text-[11px] px-3 py-1 rounded-full border border-slate-700 bg-slate-900/40 text-slate-200">
              {toast}
            </span>
          )}
        </div>

        {/* Top row: fighter + quick Sensei selector */}
        <section className="grid gap-4 md:grid-cols-[1.6fr,1.1fr]">
          {/* Fighter identity card */}
          <div className="rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900/90 via-slate-950 to-slate-950 p-4 md:p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                  Fighter profile
                </p>
                <h1 className="mt-1 text-xl font-semibold text-slate-50 md:text-2xl">
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
                <span className="text-[10px] text-slate-500">Profile-powered Sensei</span>
              </div>
            </div>

            <div className="mt-4 grid gap-3 text-xs text-slate-300 md:grid-cols-3">
              <div className="rounded-xl border border-slate-800/80 bg-slate-900/70 p-3">
                <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
                  Weekly sessions
                </p>
                <p className="mt-1 text-lg font-semibold text-slate-50">
                  {weeklySessions}
                </p>
                <p className="mt-1 text-[11px] text-slate-400">
                  (Upgrade later) This drives volume.
                </p>
              </div>

              <div className="rounded-xl border border-slate-800/80 bg-slate-900/70 p-3">
                <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
                  Sensei status
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
                  {profileLoading ? "Loading…" : profile ? "Profile set" : "Not set"}
                </p>
                <p className="mt-1 text-[11px] text-slate-400">
                  <Link href="/profile" className="underline hover:text-emerald-200">
                    Edit profile
                  </Link>
                </p>
              </div>
            </div>
          </div>

          {/* Goal selection / quick Sensei panel */}
          <div className="flex flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-950/80 p-4 md:p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                  Sensei session
                </p>
                <p className="mt-1 text-sm text-slate-200">
                  Choose the focus. Dashboard reacts instantly.
                </p>
              </div>
              <span className="text-[11px] text-slate-400">
                Focus: <span className="text-emerald-300 font-semibold">{goalLabel(todayGoal)}</span>
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
                    className={[
                      "rounded-xl border px-3 py-2 text-left font-medium transition disabled:cursor-not-allowed disabled:opacity-40",
                      active
                        ? "border-emerald-500/70 bg-emerald-500/10 text-emerald-100"
                        : "border-slate-800 bg-slate-900/80 text-slate-100 hover:border-emerald-500/70 hover:bg-slate-900/90",
                    ].join(" ")}
                  >
                    {b.title}
                    <span className="mt-1 block text-[10px] font-normal text-slate-400">
                      {b.desc}
                    </span>
                  </button>
                );
              })}
            </div>

            {senseiError && (
              <p className="mt-1 text-[11px] text-rose-400">Sensei: {senseiError}</p>
            )}

            {!profileReady && !profileLoading && (
              <p className="mt-1 text-[11px] text-amber-400">
                Complete your Profile first. Sensei needs style, stance, weight, and level.
              </p>
            )}
          </div>
        </section>

        {/* Sensei output + Unlock gates */}
        <section className="grid gap-4 md:grid-cols-[1.6fr,1.1fr]">
          {/* Sensei plan viewer */}
          <div className="rounded-2xl border border-slate-800 bg-slate-950/90 p-4 md:p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                  Session blueprint
                </p>
                <p className="mt-1 text-sm text-slate-200">
                  Warmup, rounds, finisher, safety — built from your profile.
                </p>
              </div>
              {plan && (
                <button
                  onClick={resetPlan}
                  className="rounded-full border border-slate-700 px-3 py-1 text-[11px] text-slate-300 hover:border-rose-400 hover:text-rose-200"
                >
                  Clear plan
                </button>
              )}
            </div>

            {!plan && (
              <div className="mt-6 rounded-xl border border-dashed border-slate-800 bg-slate-950/60 p-4 text-sm text-slate-400">
                Choose a focus on the right. The dashboard will remember it.
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

          {/* Right: unlock gates instead of "coming soon" */}
          <div className="flex flex-col gap-4">
            <div className="rounded-2xl border border-slate-800 bg-slate-950/90 p-4 md:p-5">
              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                Training log
              </p>
              <p className="mt-2 text-xs text-slate-300">
                Unlock after your first Sensei session.
              </p>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-[11px] text-slate-400">
                  Progress: {dash.lastSenseiAt ? "1/1" : "0/1"}
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

            <div className="rounded-2xl border border-slate-800 bg-slate-950/90 p-4 md:p-5">
              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                Fuel score
              </p>
              <p className="mt-2 text-xs text-slate-300">
                Unlock after logging 1 meal in Fuel.
              </p>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-[11px] text-slate-400">
                  Progress: {dash.lastFuelAt ? "1/1" : "0/1"}
                </span>
                <Link
                  href="/fuel"
                  onClick={markFuelLogged}
                  className="rounded-full border border-slate-700 px-3 py-1 text-[11px] text-slate-300 hover:border-emerald-400 hover:text-emerald-200"
                >
                  Open Fuel →
                </Link>
              </div>
            </div>

            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
              <p className="text-xs font-semibold text-emerald-100">Micro-win</p>
              <p className="mt-1 text-xs text-emerald-100/90">
                The dashboard now remembers focus and updates instantly. Next: wire this into a real training log.
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
