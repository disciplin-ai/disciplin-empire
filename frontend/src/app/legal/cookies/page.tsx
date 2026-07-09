export default function CookiesPage() {
  return (
    <main className="min-h-screen bg-[#020617] text-white">
      <div className="mx-auto max-w-4xl px-6 py-16">
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.32em] text-amber-300/70">
          Disciplin Legal
        </p>

        <h1 className="text-4xl font-semibold tracking-tight">
          Cookie & Tracking Policy
        </h1>

        <p className="mt-4 max-w-2xl text-sm leading-7 text-white/45">
          This page explains how Disciplin may use cookies, local storage,
          analytics, and similar technologies.
        </p>

        <div className="mt-10 space-y-10 rounded-[28px] border border-white/10 bg-white/[0.02] p-8">
          <section className="space-y-4">
            <h2 className="text-xl font-semibold">1. Essential Storage</h2>

            <p className="text-sm leading-7 text-white/65">
              Disciplin may use essential cookies or local storage to keep users
              signed in, remember app state, store draft training data, and
              support core functionality.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">2. Analytics</h2>

            <p className="text-sm leading-7 text-white/65">
              Disciplin may use analytics to understand platform performance,
              errors, feature usage, and reliability. Analytics should not be
              used to sell personal information.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">3. Marketing Cookies</h2>

            <p className="text-sm leading-7 text-white/65">
              Marketing cookies should only be enabled after separate user
              consent. Users should be able to withdraw consent later.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">4. Do Not Sell or Share</h2>

            <p className="text-sm leading-7 text-white/65">
              Disciplin does not currently sell personal information. If this
              changes, the platform must provide a clear opt-out mechanism before
              enabling such processing.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}