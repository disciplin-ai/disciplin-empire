// frontend/src/app/membership/page.tsx

export default function MembershipPage() {
  return (
    <div className="space-y-20 pb-24">
      {/* HERO */}
      <section className="text-center space-y-4">
        <h1 className="text-3xl font-semibold text-white">
          Choose how Disciplin runs your camp.
        </h1>
        <p className="text-sm text-slate-400 max-w-xl mx-auto">
          Start free. Move to Standard or Pro when you&apos;re ready.
          Disciplin OS keeps the same data whether you stay solo or grow into a
          full team.
        </p>
      </section>

      {/* PRICING TIERS */}
      <section className="max-w-6xl mx-auto grid gap-8 lg:grid-cols-3">
        {/* FREE */}
        <article className="os-card flex flex-col p-6 space-y-5">
          <div>
            <p className="text-xs tracking-wide text-emerald-400 uppercase">
              Start here
            </p>
            <h2 className="text-lg font-semibold text-white mt-1">
              Free trial camp
            </h2>
            <p className="mt-3 text-3xl font-bold text-white">$0</p>
            <p className="mt-1 text-xs text-slate-400">No card required.</p>
          </div>

          <p className="text-sm text-slate-300">
            Run one full camp inside Disciplin OS and see how it feels to have
            your training, food and notes in one place.
          </p>

          <ul className="space-y-2 text-sm text-slate-400">
            <li>• Dashboard, Sensei AI &amp; Fuel AI unlocked</li>
            <li>• Log training sessions and meals</li>
            <li>• Export your fight file at the end</li>
          </ul>

          <button className="btn-primary w-full mt-auto text-sm">
            Start free camp
          </button>
        </article>

        {/* STANDARD – MIDDLE TIER */}
        <article className="os-card flex flex-col p-6 space-y-5 border border-emerald-500 shadow-lg shadow-emerald-500/20 relative">
          <div className="absolute -top-3 right-4 rounded-full bg-emerald-500 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-black">
            Most fighters
          </div>

          <div>
            <p className="text-xs tracking-wide text-slate-400 uppercase">
              Core plan
            </p>
            <h2 className="text-lg font-semibold text-white mt-1">
              Disciplin Standard
            </h2>
            <p className="mt-3 text-3xl font-bold text-white">$19.99</p>
            <p className="mt-1 text-xs text-slate-400">per month</p>
          </div>

          <p className="text-sm text-slate-300">
            For fighters who live in camp mode all year. Structured blocks,
            long-term trends and a permanent fight file.
          </p>

          <ul className="space-y-2 text-sm text-slate-300">
            <li>• Unlimited camps and training history</li>
            <li>• Weight, conditioning &amp; volume trends over time</li>
            <li>• Deeper Sensei &amp; Fuel insights across camps</li>
            <li>• Priority access to new OS features</li>
          </ul>

          <button className="btn-primary w-full mt-auto text-sm">
            Continue as fighter
          </button>
        </article>

        {/* PRO – POPCORN TIER */}
        <article className="os-card flex flex-col p-6 space-y-5">
          <div>
            <p className="text-xs tracking-wide text-slate-400 uppercase">
              Serious only
            </p>
            <h2 className="text-lg font-semibold text-white mt-1">
              Disciplin Pro
            </h2>
            <p className="mt-3 text-3xl font-bold text-white">$39.99</p>
            <p className="mt-1 text-xs text-slate-400">per month</p>
          </div>

          <p className="text-sm text-slate-300">
            For fighters who treat every camp like a career move. More guidance,
            more feedback, more accountability.
          </p>

          <ul className="space-y-2 text-sm text-slate-300">
            <li>• Everything in Standard</li>
            <li>• Weekly Sensei pacing review prompts</li>
            <li>• Fuel AI focus on cut vs. bulk phases</li>
            <li>• Extra notes &amp; tags for coaches / corners</li>
          </ul>

          <button className="btn-secondary w-full mt-auto text-sm">
            Upgrade to Pro
          </button>
        </article>
      </section>

      {/* DIVIDER */}
      <div className="accent-line max-w-5xl mx-auto" />

      {/* ENTERPRISE BLOCK */}
      <section className="max-w-5xl mx-auto grid gap-10 lg:grid-cols-2 items-start pt-4">
        {/* Copy */}
        <div className="space-y-4">
          <p className="title-label text-emerald-300">Disciplin Enterprise</p>
          <h2 className="text-2xl font-semibold text-white">
            For gyms, teams and federations that need a full operating system.
          </h2>
          <p className="text-sm text-slate-300">
            When one account isn&apos;t enough, Enterprise gives you
            multi-fighter dashboards, roles for coaches and analysts, and
            organization-level control over camps.
          </p>

          <ul className="space-y-2 text-sm text-slate-300">
            <li>• Multi-fighter views for volume, weight and attendance</li>
            <li>• Coach, analyst, manager and medical staff roles</li>
            <li>• Data exports and API access for performance teams</li>
            <li>• White-label options for large organizations</li>
          </ul>

          <p className="text-xs text-slate-500">
            Pricing typically starts around $249–$499/month depending on team
            size and features.
          </p>

          <div className="flex flex-wrap gap-3 pt-2">
            <button className="btn-primary text-sm">Talk to us</button>
            <button className="btn-secondary text-sm">Download overview</button>
          </div>
        </div>

        {/* Specs card */}
        <div className="os-card p-6 space-y-4 text-sm text-slate-300">
          <div className="flex justify-between">
            <span>Designed for</span>
            <span>Gyms · fight teams · federations</span>
          </div>
          <div className="flex justify-between">
            <span>Typical size</span>
            <span>5 – 200+ fighters</span>
          </div>
          <div className="flex justify-between">
            <span>Staff roles</span>
            <span>Coaches · analysts · managers · med staff</span>
          </div>

          <div className="accent-line my-3" />

          <p className="font-semibold">Example use cases</p>
          <ul className="space-y-1 text-slate-400 text-xs">
            <li>• National team tracking all camps in one place</li>
            <li>• Large gym running separate views for pros and amateurs</li>
            <li>• Promotion watching how fighters train between bouts</li>
          </ul>

          <div className="accent-line my-3" />

          <p className="text-[11px] text-slate-500">
            Enterprise never appears inside the normal dashboard. Fighters live
            in their own OS. Teams only see this when they come looking for it.
          </p>
        </div>
      </section>
    </div>
  );
}
