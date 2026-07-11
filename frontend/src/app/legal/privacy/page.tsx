import Link from "next/link";

export default function PrivacyPage() {
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
            <span className="text-sm font-medium text-white/70">Privacy</span>
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
        <section className="rounded-[34px] border border-cyan-200/20 bg-[radial-gradient(circle_at_top_left,rgba(125,211,252,0.18),transparent_34%),linear-gradient(135deg,rgba(255,255,255,0.08),rgba(255,255,255,0.025))] p-6 sm:p-8">
          <p className="text-[11px] font-bold uppercase tracking-[0.34em] text-cyan-100/80">
            Disciplin Legal
          </p>

          <h1 className="mt-4 text-4xl font-black tracking-[-0.05em] text-white sm:text-5xl">
            Privacy Policy
          </h1>

          <p className="mt-5 max-w-2xl text-sm font-semibold leading-7 text-white/70">
            This page explains how Disciplin may collect, use, store, and
            protect personal information connected to training, nutrition,
            safety, and account use.
          </p>
        </section>

        <section className="overflow-hidden rounded-[30px] border border-white/10 bg-white/[0.055]">
          <div className="border-b border-white/10 p-5">
            <h2 className="text-xl font-bold">Information Disciplin may collect</h2>
          </div>
          <div className="space-y-3 p-5 text-sm leading-7 text-white/68">
            <p>Account information such as name, email, and sign-in details.</p>
            <p>Training information such as corrections, notes, proof, and progress.</p>
            <p>Fuel information such as nutrition inputs, weight logs, and readiness context.</p>
            <p>Profile information used to understand the fighter and coaching context.</p>
          </div>
        </section>

        <section className="overflow-hidden rounded-[30px] border border-white/10 bg-white/[0.055]">
          <div className="border-b border-white/10 p-5">
            <h2 className="text-xl font-bold">How information is used</h2>
          </div>
          <div className="space-y-3 p-5 text-sm leading-7 text-white/68">
            <p>To provide core app functionality.</p>
            <p>To improve Sensei decisions, Vision analysis, and Fuel recommendations.</p>
            <p>To maintain safety, reliability, debugging, and account access.</p>
          </div>
        </section>

        <section className="overflow-hidden rounded-[30px] border border-white/10 bg-white/[0.055]">
          <div className="border-b border-white/10 p-5">
            <h2 className="text-xl font-bold">Sensitive training data</h2>
          </div>
          <p className="p-5 text-sm leading-7 text-white/68">
            Combat sports, nutrition, injury, and readiness information can be
            sensitive. Disciplin should treat this information carefully and use
            it only for the platform features the athlete chooses to use.
          </p>
        </section>

        <section className="overflow-hidden rounded-[30px] border border-white/10 bg-white/[0.055]">
          <div className="border-b border-white/10 p-5">
            <h2 className="text-xl font-bold">User control</h2>
          </div>
          <div className="space-y-3 p-5 text-sm leading-7 text-white/68">
            <p>Users should be able to access, correct, or delete account data where required by law.</p>
            <p>Users should be able to withdraw optional consent where applicable.</p>
            <p>Disciplin does not currently sell personal information.</p>
          </div>
        </section>

        <div className="grid grid-cols-2 gap-3">
          <Link
            href="/legal/data"
            className="rounded-[22px] border border-white/10 bg-white/[0.05] p-4 text-sm font-bold text-white"
          >
            Data controls
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