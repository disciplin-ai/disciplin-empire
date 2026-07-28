import Link from "next/link";
import AuthenticatedHomeRedirect from "@/components/AuthenticatedHomeRedirect";

export default function Home() {
  return (
    <main className="app-canvas px-5 pb-[max(28px,env(safe-area-inset-bottom))] pt-[max(20px,env(safe-area-inset-top))] sm:px-8">
      <AuthenticatedHomeRedirect />
      <header className="app-enter relative mx-auto flex max-w-6xl items-center justify-between py-3">
        <span className="app-brand">DISCIPLIN</span>
        <Link href="/plans" className="app-button-quiet min-h-9 text-xs">View plans</Link>
      </header>
      <section className="app-enter app-enter-delay relative mx-auto grid min-h-[calc(100dvh-88px)] max-w-6xl items-center gap-12 py-10 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div>
          <p className="app-label text-emerald-300/72">Your athlete operating system</p>
          <h1 className="app-title-display mt-4 max-w-3xl">Return to every coaching session better prepared.</h1>
          <p className="app-body mt-6 max-w-2xl">Disciplin connects what your coach teaches, what your footage shows, and how your body is prepared for the next session.</p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link href="/auth/login?mode=signup&next=/onboarding" className="app-button-primary min-h-12 px-6">Create account</Link>
            <Link href="/auth/login?mode=signin&next=/" className="app-button-secondary min-h-12 px-6">Sign in</Link>
          </div>
        </div>
        <aside className="app-card p-5 sm:p-6">
          <p className="app-label">One continuous workflow</p>
          <ol className="mt-4 divide-y divide-white/[0.07] text-sm font-semibold text-white/68">
            <li className="flex gap-4 py-3 first:pt-1"><span className="text-emerald-200/60">01</span><span>Capture what the evidence supports.</span></li>
            <li className="flex gap-4 py-3"><span className="text-emerald-200/60">02</span><span>Preserve the coach’s authority.</span></li>
            <li className="flex gap-4 py-3"><span className="text-emerald-200/60">03</span><span>Prepare within today’s limits.</span></li>
            <li className="flex gap-4 py-3 last:pb-1"><span className="text-emerald-200/60">04</span><span>Return with useful evidence.</span></li>
          </ol>
        </aside>
      </section>
    </main>
  );
}
