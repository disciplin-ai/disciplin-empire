import Link from "next/link";

export default function CookiesPage() {
  return (
    <main className="min-h-screen bg-[#020810] pb-28 pt-24 text-white">
      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-[#020817]/90 backdrop-blur-2xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="text-[13px] font-bold tracking-[0.38em] text-emerald-300"
            >
              DISCIPLIN
            </Link>
            <div className="h-5 w-px bg-white/12" />
            <span className="text-sm font-medium text-white/70">Cookies</span>
          </div>

          <Link
            href="/dashboard"
            className="rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-xs font-bold text-white/82"
          >
            Dashboard
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-3xl space-y-6 px-5">
        <section className="rounded-[34px] border border-amber-300/20 bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.2),transparent_34%),linear-gradient(135deg,rgba(255,255,255,0.08),rgba(255,255,255,0.025))] p-6 sm:p-8">
          <p className="text-[11px] font-bold uppercase tracking-[0.34em] text-amber-200/80">
            Disciplin Legal
          </p>

          <h1 className="mt-4 text-4xl font-black tracking-[-0.05em] text-white sm:text-5xl">
            Cookie & Tracking Policy
          </h1>

          <p className="mt-5 max-w-2xl text-sm font-semibold leading-7 text-white/70">
            This page explains how Disciplin may use cookies, local storage,
            analytics, and similar technologies.
          </p>
        </section>

        <section className="overflow-hidden rounded-[30px] border border-white/10 bg-white/[0.055]">
          <div className="border-b border-white/10 p-5">
            <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-white/50">
              Storage
            </p>
            <h2 className="mt-2 text-xl font-bold">Essential Storage</h2>
          </div>
          <p className="p-5 text-sm leading-7 text-white/68">
            Disciplin may use essential cookies or local storage to keep users
            signed in, remember app state, store draft training data, and
            support core functionality.
          </p>
        </section>

        <section className="overflow-hidden rounded-[30px] border border-white/10 bg-white/[0.055]">
          <div className="border-b border-white/10 p-5">
            <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-white/50">
              Analytics
            </p>
            <h2 className="mt-2 text-xl font-bold">Platform reliability</h2>
          </div>
          <p className="p-5 text-sm leading-7 text-white/68">
            Disciplin may use analytics to understand platform performance,
            errors, feature usage, and reliability. Analytics should not be used
            to sell personal information.
          </p>
        </section>

        <section className="overflow-hidden rounded-[30px] border border-white/10 bg-white/[0.055]">
          <div className="border-b border-white/10 p-5">
            <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-white/50">
              Consent
            </p>
            <h2 className="mt-2 text-xl font-bold">Marketing Cookies</h2>
          </div>
          <p className="p-5 text-sm leading-7 text-white/68">
            Marketing cookies should only be enabled after separate user
            consent. Users should be able to withdraw consent later.
          </p>
        </section>

        <section className="overflow-hidden rounded-[30px] border border-emerald-300/15 bg-emerald-300/[0.04]">
          <div className="border-b border-white/10 p-5">
            <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-emerald-200/70">
              Data sale
            </p>
            <h2 className="mt-2 text-xl font-bold">Do Not Sell or Share</h2>
          </div>
          <p className="p-5 text-sm leading-7 text-white/68">
            Disciplin does not currently sell personal information. If this
            changes, the platform must provide a clear opt-out mechanism before
            enabling such processing.
          </p>
        </section>

        <div className="grid grid-cols-2 gap-3">
          <Link
            href="/legal/privacy"
            className="rounded-[22px] border border-white/10 bg-white/[0.05] p-4 text-sm font-bold text-white"
          >
            Privacy
          </Link>
          <Link
            href="/legal/safety"
            className="rounded-[22px] border border-white/10 bg-white/[0.05] p-4 text-sm font-bold text-white"
          >
            Safety
          </Link>
        </div>
      </div>
    </main>
  );
}