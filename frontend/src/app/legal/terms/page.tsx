import Link from "next/link";

function Term({
  number,
  title,
  children,
}: {
  number: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.055]">
      <div className="border-b border-white/10 p-5">
        <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-emerald-200/60">
          {number}
        </p>
        <h2 className="mt-2 text-xl font-bold tracking-[-0.02em] text-white">
          {title}
        </h2>
      </div>
      <div className="space-y-4 p-5 text-sm leading-7 text-white/68">
        {children}
      </div>
    </section>
  );
}

export default function TermsPage() {
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
            <span className="text-sm font-medium text-white/70">Terms</span>
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
        <section className="rounded-[34px] border border-emerald-300/20 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.2),transparent_34%),linear-gradient(135deg,rgba(255,255,255,0.08),rgba(255,255,255,0.025))] p-6 sm:p-8">
          <p className="text-[11px] font-bold uppercase tracking-[0.34em] text-emerald-200/80">
            Disciplin Legal
          </p>

          <h1 className="mt-4 text-4xl font-black tracking-[-0.05em] text-white sm:text-5xl">
            Terms & Conditions
          </h1>

          <p className="mt-5 max-w-2xl text-sm font-semibold leading-7 text-white/70">
            These Terms govern access to and use of Disciplin, including
            Sensei, Vision, Fuel, and related training systems.
          </p>
        </section>

        <Term number="01" title="Informational Training Platform">
          <p>
            Disciplin provides informational coaching support, correction
            systems, training structure guidance, and performance analysis tools
            for combat sports and athletic development.
          </p>
          <p>
            Disciplin is not a medical provider, physiotherapy service,
            rehabilitation provider, emergency response system, or licensed
            healthcare platform.
          </p>
        </Term>

        <Term number="02" title="Combat Sports Risk">
          <p>
            Combat sports and athletic training involve inherent physical risks,
            including serious injury, permanent disability, and death.
          </p>
          <p>
            You accept full responsibility for your training decisions, sparring
            intensity, coaching environment, and physical safety.
          </p>
        </Term>

        <Term number="03" title="Age Requirements">
          <p>You must be at least 13 years old to use Disciplin.</p>
          <p>
            If you are under 18, you confirm that a parent or legal guardian has
            reviewed and agreed to these Terms on your behalf.
          </p>
          <p>Minors should train only under qualified adult supervision.</p>
        </Term>

        <Term number="04" title="No Medical Advice">
          <p>
            Disciplin does not provide medical advice, concussion diagnosis,
            injury diagnosis, return-to-play clearance, rehabilitation
            protocols, emergency guidance, or treatment recommendations.
          </p>
          <p>
            Always consult qualified medical professionals regarding injuries,
            pain, dizziness, concussions, weight cutting, dehydration, or
            physical symptoms.
          </p>
        </Term>

        <Term number="05" title="Limitation of Liability">
          <p>
            To the maximum extent permitted by law, Disciplin and its operators
            are not liable for injuries, losses, damages, training outcomes, or
            decisions resulting from platform use.
          </p>
        </Term>

        <Term number="06" title="Platform Changes">
          <p>
            Disciplin may modify, suspend, or remove platform features at any
            time without notice.
          </p>
        </Term>
      </div>
    </main>
  );
}