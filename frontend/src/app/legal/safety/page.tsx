import Link from "next/link";

const navItems = [
  { href: "/sensei-vision", label: "Vision", symbol: "⌖" },
  { href: "/sensei", label: "Sensei", symbol: "⌘" },
  { href: "/dashboard", label: "Dashboard", symbol: "◎" },
  { href: "/fuel", label: "Fuel", symbol: "ϟ" },
  { href: "/legal/safety", label: "Safety/Data", symbol: "◇" },
];

function TopBar() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-[#020817]/90 backdrop-blur-2xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href="/dashboard"
            className="text-[13px] font-bold tracking-[0.38em] text-emerald-300"
          >
            DISCIPLIN
          </Link>
          <div className="h-5 w-px bg-white/12" />
          <span className="truncate text-sm font-medium text-white/70">
            Safety/Data
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/dashboard"
            className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-bold text-white/82 transition hover:bg-white/[0.08]"
          >
            Dashboard
          </Link>
          <Link
            href="/profile"
            className="hidden rounded-full border border-emerald-300/25 bg-emerald-300/10 px-4 py-2 text-xs font-bold text-white sm:block"
          >
            Fighter file
          </Link>
        </div>
      </div>
    </header>
  );
}

function BottomNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-[#020817]/92 px-3 pb-[max(env(safe-area-inset-bottom),10px)] pt-3 backdrop-blur-2xl">
      <div className="mx-auto grid max-w-3xl grid-cols-5 rounded-[28px] border border-white/10 bg-white/[0.06] p-1 shadow-[0_20px_70px_rgba(0,0,0,0.45)]">
        {navItems.map((item) => {
          const active = item.href === "/legal/safety";

          return (
            <Link
              key={item.href}
              href={item.href}
              className={[
                "flex min-w-0 flex-col items-center justify-center gap-1 rounded-[22px] px-2 py-2 text-center transition active:scale-[0.96]",
                active ? "bg-white text-[#06101f]" : "text-white/55 hover:text-white",
              ].join(" ")}
            >
              <span className="text-[17px] font-bold leading-none">
                {item.symbol}
              </span>
              <span className="truncate text-[10px] font-bold leading-none">
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function Section({
  dot,
  label,
  title,
  children,
}: {
  dot: string;
  label: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${dot}`} />
        <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-white/70">
          {label}
        </p>
      </div>

      <div className="overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.055] shadow-[0_24px_80px_rgba(0,0,0,0.25)]">
        <div className="border-b border-white/10 p-5">
          <h2 className="text-xl font-bold tracking-[-0.02em] text-white">
            {title}
          </h2>
        </div>
        <div className="divide-y divide-white/10">{children}</div>
      </div>
    </section>
  );
}

function Row({
  title,
  body,
}: {
  title: string;
  body?: string;
}) {
  return (
    <div className="p-5">
      <p className="text-sm font-bold text-white">{title}</p>
      {body && <p className="mt-2 text-sm leading-6 text-white/65">{body}</p>}
    </div>
  );
}

export default function SafetyPage() {
  return (
    <main className="min-h-screen bg-[#020810] pb-32 pt-24 text-white">
      <TopBar />

      <div className="mx-auto max-w-3xl space-y-6 px-5">
        <section className="rounded-[34px] border border-rose-300/20 bg-[radial-gradient(circle_at_top_left,rgba(244,63,94,0.22),transparent_34%),linear-gradient(135deg,rgba(255,255,255,0.08),rgba(255,255,255,0.025))] p-6 shadow-[0_30px_90px_rgba(0,0,0,0.35)] sm:p-8">
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full border border-rose-300/25 bg-rose-300/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-rose-100">
              Safety layer
            </span>
            <span className="rounded-full border border-amber-300/25 bg-amber-300/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-amber-100">
              No medical advice
            </span>
          </div>

          <p className="mt-8 text-[11px] font-bold uppercase tracking-[0.34em] text-rose-200/80">
            Disciplin Safety
          </p>

          <h1 className="mt-4 text-5xl font-black tracking-[-0.06em] text-white sm:text-6xl">
            Training Safety
          </h1>

          <p className="mt-5 max-w-2xl text-sm font-semibold leading-7 text-white/78">
            Combat sports involve risk. Stop when serious symptoms appear. Use
            qualified coaches, medical professionals, and adult supervision
            where required.
          </p>
        </section>

        <Section
          dot="bg-rose-300"
          label="Stop immediately"
          title="Stop training immediately if you experience:"
        >
          <Row title="Dizziness or confusion" />
          <Row title="Concussion symptoms" />
          <Row title="Chest pain" />
          <Row title="Difficulty breathing" />
          <Row title="Sudden sharp pain" />
          <Row title="Numbness or instability" />
        </Section>

        <Section
          dot="bg-amber-300"
          label="Weight cutting warning"
          title="Rapid dehydration can be life-threatening."
        >
          <Row
            title="Extreme cuts can be dangerous."
            body="Rapid dehydration and extreme weight cutting can be dangerous and life-threatening."
          />
          <Row
            title="Use qualified professionals."
            body="Consult qualified professionals before attempting weight cuts."
          />
        </Section>

        <Section
          dot="bg-cyan-200"
          label="Youth athletes"
          title="Minors require qualified adult supervision."
        >
          <Row
            title="AI guidance does not replace adult supervision."
            body="Teenagers and younger athletes should train under qualified adult supervision and should not rely solely on AI-generated recommendations."
          />
        </Section>

        <Section
          dot="bg-rose-300"
          label="Emergency situations"
          title="Disciplin is not an emergency service."
        >
          <Row
            title="Seek immediate medical assistance."
            body="Seek immediate medical assistance during emergencies or serious injuries."
          />
          <Row
            title="No diagnosis or clearance."
            body="Disciplin does not provide emergency response, injury diagnosis, concussion clearance, rehabilitation protocols, or medical advice."
          />
        </Section>

        <Section
          dot="bg-emerald-300"
          label="Data / privacy controls"
          title="Safety and data controls"
        >
          <Link href="/legal/data" className="block p-5 text-sm font-bold text-emerald-100">
            Data controls
          </Link>
          <Link href="/legal/privacy" className="block p-5 text-sm font-bold text-emerald-100">
            Privacy policy
          </Link>
          <Link href="/legal/terms" className="block p-5 text-sm font-bold text-emerald-100">
            Terms
          </Link>
        </Section>
      </div>

      <BottomNav />
    </main>
  );
}