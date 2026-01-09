"use client";

import { useProfile } from "../../components/ProfileProvider";
import { useSenseiPlan } from "../../hooks/useSenseiPlan";

export default function DashboardPage() {
  const { profile, loading: profileLoading } = useProfile();
  const {
    plan,
    loading: senseiLoading,
    error: senseiError,
    askSensei,
    resetPlan,
  } = useSenseiPlan();

  const handleAskSensei = (goal: "pressure" | "speed" | "power" | "recovery" | "mixed") => {
    // We only give the session context.
    // Sensei hook automatically injects the full fighter profile.
    resetPlan();
    askSensei({
      goal,
      // You can add more context later:
      // daysToNextFight: profile?.campDays ?? 42,
      // lastSessionFocus: "wrestling pressure",
      // lastSessionRPE: 8,
    });
  };

  const nickname =
    (profile as any)?.nickname ||
    (profile as any)?.fightName ||
    (profile as any)?.username ||
    "Unknown fighter";

  const baseArt = (profile as any)?.baseArt || "Set your base art";
  const competitionLevel =
    (profile as any)?.competitionLevel || "Not set yet";
  const weeklySessions = (profile as any)?.weeklySessions || "0";

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-950">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6 md:py-10">
        {/* Top row: fighter + quick stats */}
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
                  Disciplin 
                </span>
                <span className="text-[10px] text-slate-500">
                  Profile-powered Sensei
                </span>
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
                  Logged in profile. Sensei uses this for volume.
                </p>
              </div>

              <div className="rounded-xl border border-slate-800/80 bg-slate-900/70 p-3">
                <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
                  Sensei status
                </p>
                <p className="mt-1 text-sm font-semibold text-emerald-300">
                  {senseiLoading
                    ? "Calculating session…"
                    : plan
                    ? "Session ready"
                    : "Idle"}
                </p>
                <p className="mt-1 text-[11px] text-slate-400">
                  Profile + goal → structured round plan.
                </p>
              </div>

              <div className="rounded-xl border border-slate-800/80 bg-slate-900/70 p-3">
                <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
                  Profile link
                </p>
                <p className="mt-1 text-sm text-slate-200">
                  {profileLoading
                    ? "Loading…"
                    : profile
                    ? "Profile complete"
                    : "Go to Profile and fill everything."}
                </p>
                <p className="mt-1 text-[11px] text-slate-400">
                  Sensei will refuse if your profile is missing.
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
                  Choose the focus. Sensei uses your profile automatically.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[11px] md:grid-cols-3">
              <button
                onClick={() => handleAskSensei("pressure")}
                disabled={senseiLoading || !profile}
                className="rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-2 text-left font-medium text-slate-100 transition hover:border-emerald-500/70 hover:bg-slate-900/90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Pressure
                <span className="mt-1 block text-[10px] font-normal text-slate-400">
                  Wrestling pace, cage work, cardio warfare.
                </span>
              </button>

              <button
                onClick={() => handleAskSensei("speed")}
                disabled={senseiLoading || !profile}
                className="rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-2 text-left font-medium text-slate-100 transition hover:border-emerald-500/70 hover:bg-slate-900/90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Speed
                <span className="mt-1 block text-[10px] font-normal text-slate-400">
                  Sharp striking, crisp reactions.
                </span>
              </button>

              <button
                onClick={() => handleAskSensei("power")}
                disabled={senseiLoading || !profile}
                className="rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-2 text-left font-medium text-slate-100 transition hover:border-emerald-500/70 hover:bg-slate-900/90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Power
                <span className="mt-1 block text-[10px] font-normal text-slate-400">
                  Explosive shots, low volume, form.
                </span>
              </button>

              <button
                onClick={() => handleAskSensei("recovery")}
                disabled={senseiLoading || !profile}
                className="rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-2 text-left font-medium text-slate-100 transition hover:border-emerald-500/70 hover:bg-slate-900/90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Recovery
                <span className="mt-1 block text-[10px] font-normal text-slate-400">
                  Low impact, technical drills, reset.
                </span>
              </button>

              <button
                onClick={() => handleAskSensei("mixed")}
                disabled={senseiLoading || !profile}
                className="rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-2 text-left font-medium text-slate-100 transition hover:border-emerald-500/70 hover:bg-slate-900/90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Mixed
                <span className="mt-1 block text-[10px] font-normal text-slate-400">
                  Balanced striking + grappling focus.
                </span>
              </button>
            </div>

            {senseiError && (
              <p className="mt-1 text-[11px] text-rose-400">Sensei: {senseiError}</p>
            )}

            {!profile && !profileLoading && (
              <p className="mt-1 text-[11px] text-amber-400">
                Complete your Profile first. Sensei needs your style, stance,
                weight, and level.
              </p>
            )}
          </div>
        </section>

        {/* Sensei output + log area */}
        <section className="grid gap-4 md:grid-cols-[1.6fr,1.1fr]">
          {/* Sensei plan viewer */}
          <div className="rounded-2xl border border-slate-800 bg-slate-950/90 p-4 md:p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                  Session blueprint
                </p>
                <p className="mt-1 text-sm text-slate-200">
                  Warmup, rounds, finisher, safety — all built from your profile.
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
                Choose a focus in the Sensei panel on the right. Your saved
                fighter profile will be used to build a full technical session,
                not a random workout.
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
                        <div className="flex items-center justify-between">
                          <p className="text-[11px] font-semibold text-slate-100">
                            Round {round.round} • {round.durationSeconds}s •{" "}
                            <span className="uppercase tracking-wide text-emerald-300">
                              {round.intensity}
                            </span>
                          </p>
                        </div>
                        <p className="mt-1 text-[11px] text-slate-300">
                          Focus: {round.focus}
                        </p>
                        <p className="mt-1 text-[11px] text-slate-300">
                          Drill: {round.drill}
                        </p>
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
                  <p className="mt-2 text-[11px] text-slate-300">
                    {plan.finisher}
                  </p>
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

          {/* Right column placeholder for future: logs, Discipline score, Fuel link */}
          <div className="flex flex-col gap-4">
            <div className="rounded-2xl border border-slate-800 bg-slate-950/90 p-4 md:p-5">
              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                Training log (coming soon)
              </p>
              <p className="mt-2 text-xs text-slate-300">
                Here you&apos;ll see sessions you actually completed, linked to
                Fuel AI and your Discipline score. For now, use the Sensei
                plan, execute it, and log details manually.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-950/90 p-4 md:p-5">
              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                Fuel & Discipline (coming soon)
              </p>
              <p className="mt-2 text-xs text-slate-300">
                Fuel AI and Discipline Engine will sync your meals, sessions,
                and rounds into one score. This panel becomes your central
                pressure gauge.
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
