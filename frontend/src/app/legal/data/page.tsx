import Link from "next/link";

export default function DataPage() {
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
            <span className="text-sm font-medium text-white/70">Data</span>
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
        <section className="rounded-[34px] border border-emerald-300/20 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.18),transparent_34%),linear-gradient(135deg,rgba(255,255,255,0.08),rgba(255,255,255,0.025))] p-6 sm:p-8">
          <p className="text-[11px] font-bold uppercase tracking-[0.34em] text-emerald-200/80">
            Disciplin Data
          </p>

          <h1 className="mt-4 text-4xl font-black tracking-[-0.05em] text-white sm:text-5xl">
            Data Controls
          </h1>

          <p className="mt-5 max-w-2xl text-sm font-semibold leading-7 text-white/70">
            Control the information connected to your account, fighter file,
            corrections, proof, Vision reads, and Fuel logs.
          </p>
        </section>

        <section className="overflow-hidden rounded-[30px] border border-white/10 bg-white/[0.055]">
          <div className="border-b border-white/10 p-5">
            <h2 className="text-xl font-bold">Account data</h2>
          </div>
          <div className="space-y-3 p-5 text-sm leading-7 text-white/68">
            <p>Name, email, sign-in identity, and account status.</p>
            <p>This data keeps the same athlete connected across Disciplin modules.</p>
          </div>
        </section>

        <section className="overflow-hidden rounded-[30px] border border-white/10 bg-white/[0.055]">
          <div className="border-b border-white/10 p-5">
            <h2 className="text-xl font-bold">Training data</h2>
          </div>
          <div className="space-y-3 p-5 text-sm leading-7 text-white/68">
            <p>Sensei decisions, correction locks, proof progress, and command history.</p>
            <p>Vision uploads, technical reads, and mistake summaries.</p>
            <p>Fuel logs, weight context, nutrition notes, and readiness signals.</p>
          </div>
        </section>

        <section className="overflow-hidden rounded-[30px] border border-white/10 bg-white/[0.055]">
          <div className="border-b border-white/10 p-5">
            <h2 className="text-xl font-bold">Export and deletion</h2>
          </div>
          <div className="space-y-3 p-5 text-sm leading-7 text-white/68">
            <p>Users should be able to request access to their data where required by law.</p>
            <p>Users should be able to request deletion where required by law.</p>
            <p>Some records may be retained where necessary for legal, safety, or security reasons.</p>
          </div>
        </section>

        <section className="overflow-hidden rounded-[30px] border border-rose-300/15 bg-rose-300/[0.045]">
          <div className="border-b border-white/10 p-5">
            <h2 className="text-xl font-bold">Safety note</h2>
          </div>
          <p className="p-5 text-sm leading-7 text-white/72">
            Deleting data may remove training context used by Sensei, Vision,
            Fuel, and Dashboard. It may reduce correction history, readiness
            context, and proof continuity.
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