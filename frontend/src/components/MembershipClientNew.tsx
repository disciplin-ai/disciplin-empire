"use client";

import Link from "next/link";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function TierCard({
  eyebrow,
  title,
  price,
  priceSub,
  outcome,
  gets,
  misses,
  cta,
  featured = false,
  secondary = false,
}: {
  eyebrow: string;
  title: string;
  price: string;
  priceSub: string;
  outcome: string;
  gets: string[];
  misses: string[];
  cta: string;
  featured?: boolean;
  secondary?: boolean;
}) {
  return (
    <div
      className={cn(
        "relative rounded-3xl p-6",
        featured
          ? "border border-emerald-400/70 bg-emerald-500/[0.04] shadow-[0_0_30px_rgba(52,211,153,0.12)]"
          : "border border-slate-800 bg-slate-900/25"
      )}
    >
      {featured ? (
        <div className="absolute -top-3 right-5 rounded-full border border-emerald-400 bg-emerald-400 px-4 py-1 text-[11px] font-semibold tracking-wide text-slate-950">
          MOST FIGHTERS
        </div>
      ) : null}

      <p className={cn("text-xs tracking-[0.22em]", featured ? "text-emerald-300" : "text-slate-400")}>
        {eyebrow}
      </p>

      <h3 className="mt-3 text-3xl font-semibold text-white">{title}</h3>

      <div className="mt-4">
        <div className="text-5xl font-semibold tracking-tight text-white">{price}</div>
        <div className="mt-1 text-sm text-slate-400">{priceSub}</div>
      </div>

      <div className="mt-8 rounded-2xl border border-slate-800 bg-slate-950/30 p-4">
        <div className="text-[11px] tracking-[0.22em] text-slate-400">WHAT CHANGES</div>
        <p className="mt-3 text-base leading-7 text-slate-100">{outcome}</p>
      </div>

      <div className="mt-6 grid gap-4">
        <div className="rounded-2xl border border-slate-800 bg-slate-950/20 p-4">
          <div className="text-[11px] tracking-[0.22em] text-slate-400">YOU GET</div>
          <ul className="mt-3 space-y-2 text-sm text-slate-200">
            {gets.map((item) => (
              <li key={item} className="flex gap-2">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-300/80" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-950/20 p-4">
          <div className="text-[11px] tracking-[0.22em] text-slate-500">YOU DON’T GET</div>
          <ul className="mt-3 space-y-2 text-sm text-slate-400">
            {misses.map((item) => (
              <li key={item} className="flex gap-2">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-500/70" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <button
        className={cn(
          "mt-8 w-full rounded-2xl py-3 text-sm font-semibold transition",
          featured
            ? "bg-emerald-400 text-slate-950 hover:bg-emerald-300"
            : secondary
            ? "border border-slate-700 bg-transparent text-white hover:border-emerald-400"
            : "bg-emerald-400 text-slate-950 hover:bg-emerald-300"
        )}
      >
        {cta}
      </button>
    </div>
  );
}

export default function MembershipClient() {
  return (
    <div className="mx-auto max-w-7xl px-6 py-16">
      <div className="mx-auto max-w-3xl text-center">
        <p className="text-xs tracking-[0.25em] text-emerald-400">MEMBERSHIP</p>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight text-white md:text-5xl">
          Pick how much control you want over your training
        </h1>
        <p className="mt-4 text-base leading-7 text-slate-300">
          Start free. Move to Standard or Pro when you want Disciplin to stop being a tool
          you check sometimes and start becoming part of how you train.
        </p>
      </div>

      <div className="mt-12 grid gap-8 lg:grid-cols-3">
        <TierCard
          eyebrow="START HERE"
          title="Free trial camp"
          price="$0"
          priceSub="No card required."
          outcome="You see your mistakes, but nothing forces you to fix them. Good for testing the system, not for relying on it."
          gets={[
            "One full trial camp inside Disciplin",
            "Dashboard, Sensei AI, and Fuel AI unlocked",
            "Log training sessions and meals",
            "Export your fight file at the end",
          ]}
          misses={[
            "No ongoing correction tracking",
            "No pattern detection across sessions",
            "No long-term camp control",
          ]}
          cta="Start free camp"
        />

        <TierCard
          eyebrow="CORE PLAN"
          title="Disciplin Standard"
          price="$19.99"
          priceSub="per month"
          outcome="You stop guessing what is breaking and start fixing what actually loses you exchanges. This is the real fighter tier."
          gets={[
            "Unlimited Vision correction",
            "‘Fix next rep’ instructions after analysis",
            "Full training dashboard and session structure",
            "Sensei guidance for day-to-day camp decisions",
            "Fuel support tied to your training",
          ]}
          misses={[
            "No long-term pattern detection",
            "No camp-level accountability layer",
            "No advanced control over the full camp arc",
          ]}
          cta="Continue as fighter"
          featured
        />

        <TierCard
          eyebrow="SERIOUS ONLY"
          title="Disciplin Pro"
          price="$39.99"
          priceSub="per month"
          outcome="Your training is tracked, corrected, and controlled. Pro is for fighters who want their mistakes exposed, repeated patterns found, and camp decisions tightened."
          gets={[
            "Everything in Standard",
            "Pattern detection across sessions and camps",
            "Camp-level training control",
            "Fight-week adjustments and tighter review layers",
            "Higher accountability around what you keep failing",
          ]}
          misses={[
            "No hiding behind random sessions",
            "No excuse to ignore repeated mistakes",
          ]}
          cta="Upgrade to Pro"
          secondary
        />
      </div>

      <div className="mt-20 rounded-3xl border border-slate-800 bg-slate-900/30 p-8 md:p-10">
        <div className="grid gap-10 lg:grid-cols-[1.15fr_0.85fr]">
          <div>
            <p className="text-sm font-medium text-emerald-400">Disciplin Enterprise</p>
            <h2 className="mt-4 text-4xl font-semibold tracking-tight text-white">
              For gyms, teams and federations that need a full operating system.
            </h2>
            <p className="mt-5 max-w-2xl text-base leading-7 text-slate-300">
              When one account is not enough, Enterprise gives you multi-fighter dashboards,
              role-based views for coaches and analysts, and organization-level control over
              camps.
            </p>

            <ul className="mt-6 space-y-3 text-base text-slate-200">
              <li>• Multi-fighter views for volume, weight and attendance</li>
              <li>• Coach, analyst, manager and medical staff roles</li>
              <li>• Data exports and API access for performance teams</li>
              <li>• White-label options for larger organizations</li>
            </ul>

            <p className="mt-6 text-sm text-slate-400">
              Pricing typically starts around $249–$499/month depending on team size and
              feature depth.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <button className="rounded-2xl bg-emerald-400 px-5 py-3 text-sm font-semibold text-slate-950 hover:bg-emerald-300">
                Talk to us
              </button>

              <Link
                href="/enterprise-overview"
                className="rounded-2xl border border-slate-700 px-5 py-3 text-sm font-semibold text-white hover:border-emerald-400"
              >
                Download overview
              </Link>
            </div>
          </div>

          <div className="grid gap-4 self-start text-sm text-slate-300 md:grid-cols-2 lg:grid-cols-1">
            <div className="grid grid-cols-[120px_1fr] gap-4">
              <div className="text-slate-400">Designed for</div>
              <div>Gyms · fight teams · federations</div>
            </div>

            <div className="grid grid-cols-[120px_1fr] gap-4">
              <div className="text-slate-400">Typical size</div>
              <div>5 – 200+ fighters</div>
            </div>

            <div className="grid grid-cols-[120px_1fr] gap-4">
              <div className="text-slate-400">Staff roles</div>
              <div>Coaches · analysts · managers · med staff</div>
            </div>

            <div className="mt-4">
              <div className="text-slate-400">Example use cases</div>
              <ul className="mt-3 space-y-2 text-slate-300">
                <li>• National team tracking all camps in one place</li>
                <li>• Large gym running separate views for pros and amateurs</li>
                <li>• Promotion watching how fighters train between bouts</li>
              </ul>
            </div>

            <p className="mt-3 text-xs leading-6 text-slate-500">
              Enterprise never appears inside the normal dashboard. Fighters live in their own
              OS. Teams only see this when they come looking for it.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}