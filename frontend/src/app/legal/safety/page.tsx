import Link from "next/link";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function StatusPill({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "danger" | "amber" | "cyan" | "emerald";
}) {
  const cls =
    tone === "danger"
      ? "border-rose-400/24 bg-rose-500/10 text-rose-100"
      : tone === "amber"
        ? "border-amber-300/24 bg-amber-400/10 text-amber-100"
        : tone === "cyan"
          ? "border-cyan-300/24 bg-cyan-400/10 text-cyan-100"
          : tone === "emerald"
            ? "border-emerald-300/24 bg-emerald-400/10 text-emerald-100"
            : "border-white/10 bg-white/[0.045] text-white/58";

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em]",
        cls
      )}
    >
      {children}
    </span>
  );
}

function Dot({ tone }: { tone: "danger" | "amber" | "cyan" | "emerald" }) {
  const cls =
    tone === "danger"
      ? "bg-rose-300"
      : tone === "amber"
        ? "bg-amber-300"
        : tone === "cyan"
          ? "bg-cyan-200"
          : "bg-emerald-300";

  return <span className={cn("h-2 w-2 rounded-full", cls)} />;
}

function Group({
  title,
  caption,
  tone = "emerald",
  children,
}: {
  title: string;
  caption?: string;
  tone?: "danger" | "amber" | "cyan" | "emerald";
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-3 px-1">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Dot tone={tone} />
            <h2 className="text-[13px] font-bold uppercase tracking-[0.18em] text-white/58">
              {title}
            </h2>
          </div>
          {caption ? (
            <p className="mt-1 text-xs leading-5 text-white/38">{caption}</p>
          ) : null}
        </div>
      </div>
      <div className="overflow-hidden rounded-[24px] border border-white/[0.08] bg-white/[0.055] shadow-[0_16px_50px_rgba(0,0,0,0.26)] backdrop-blur-xl">
        {children}
      </div>
    </section>
  );
}

function Row({
  title,
  body,
  tone = "neutral",
  strong = false,
}: {
  title: string;
  body?: string;
  tone?: "neutral" | "danger" | "amber" | "cyan" | "emerald";
  strong?: boolean;
}) {
  const titleTone =
    tone === "danger"
      ? "text-rose-50"
      : tone === "amber"
        ? "text-amber-50"
        : tone === "cyan"
          ? "text-cyan-50"
          : tone === "emerald"
            ? "text-emerald-50"
            : "text-white";

  return (
    <div className="border-b border-white/[0.06] px-4 py-3.5 last:border-b-0">
      <div className="flex items-start gap-3">
        {tone !== "neutral" ? (
          <span className="mt-1.5">
            <Dot tone={tone} />
          </span>
        ) : null}
        <div className="min-w-0 flex-1">
          <div
            className={cn(
              "text-sm leading-6",
              strong ? "font-bold" : "font-semibold",
              titleTone
            )}
          >
            {title}
          </div>
          {body ? (
            <p className="mt-1 text-[13px] leading-6 text-white/52">{body}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ActionLink({
  href,
  label,
  tone = "neutral",
}: {
  href: string;
  label: string;
  tone?: "neutral" | "danger" | "cyan" | "emerald";
}) {
  const cls =
    tone === "danger"
      ? "text-rose-100"
      : tone === "cyan"
        ? "text-cyan-100"
        : tone === "emerald"
          ? "text-emerald-100"
          : "text-white/76";

  return (
    <Link
      href={href}
      className="flex items-center justify-between gap-3 border-b border-white/[0.06] px-4 py-3.5 last:border-b-0 active:bg-white/[0.04]"
    >
      <span className={cn("text-sm font-semibold", cls)}>{label}</span>
      <span className="text-lg leading-none text-white/28">›</span>
    </Link>
  );
}

export default function SafetyPage() {
  return (
    <main className="min-h-screen bg-[#020810] px-4 pb-28 pt-5 text-white sm:px-6">
      <div className="pointer-events-none fixed inset-x-0 top-0 h-56 bg-[radial-gradient(circle_at_top,rgba(244,63,94,0.14),transparent_54%)]" />

      <div className="relative mx-auto max-w-3xl space-y-5">
        <header className="rounded-[30px] border border-white/[0.08] bg-white/[0.055] p-5 shadow-[0_18px_70px_rgba(0,0,0,0.32)] backdrop-blur-xl">
          <div className="flex items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              <StatusPill tone="danger">Safety</StatusPill>
              <StatusPill tone="amber">No medical advice</StatusPill>
            </div>
            <StatusPill tone="cyan">Supervision</StatusPill>
          </div>

          <div className="mt-6">
            <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-rose-200/65">
              Disciplin Safety
            </p>
            <h1 className="mt-2 text-[38px] font-bold leading-none tracking-[-0.035em] text-white sm:text-5xl">
              Training Safety
            </h1>
            <p className="mt-4 max-w-2xl text-[14px] leading-7 text-white/56">
              Combat sports involve risk. Train responsibly and under qualified
              supervision.
            </p>
          </div>
        </header>

        <Group
          title="Stop Immediately"
          caption="Do not continue training through serious symptoms."
          tone="danger"
        >
          <Row title="Dizziness or confusion" tone="danger" strong />
          <Row title="Concussion symptoms" tone="danger" strong />
          <Row title="Chest pain" tone="danger" strong />
          <Row title="Difficulty breathing" tone="danger" strong />
          <Row title="Sudden sharp pain" tone="danger" strong />
          <Row title="Numbness or instability" tone="danger" strong />
        </Group>

        <Group
          title="Weight Cutting Warning"
          caption="Rapid dehydration and extreme cutting can be dangerous."
          tone="amber"
        >
          <Row
            title="Extreme cuts can be life-threatening."
            body="Rapid dehydration and extreme weight cutting can be dangerous and life-threatening."
            tone="amber"
            strong
          />
          <Row
            title="Use qualified professionals."
            body="Consult qualified professionals before attempting weight cuts."
            tone="amber"
          />
        </Group>

        <Group
          title="Youth Athletes"
          caption="AI guidance does not replace adult supervision."
          tone="cyan"
        >
          <Row
            title="Minors require qualified adult supervision."
            body="Teenagers and younger athletes should train under qualified adult supervision and should not rely solely on AI-generated recommendations."
            tone="cyan"
            strong
          />
        </Group>

        <Group
          title="Emergency Situations"
          caption="Disciplin is not an emergency service."
          tone="danger"
        >
          <Row
            title="Seek immediate medical assistance."
            body="Seek immediate medical assistance during emergencies or serious injuries."
            tone="danger"
            strong
          />
          <Row
            title="No diagnosis or clearance."
            body="Disciplin does not provide emergency response, injury diagnosis, concussion clearance, rehabilitation protocols, or medical advice."
            tone="danger"
          />
        </Group>

        <Group
          title="Data / Privacy Controls"
          caption="Consent and safety controls attached to the operating system."
          tone="emerald"
        >
          <ActionLink href="/legal/data" label="Data controls" tone="emerald" />
          <ActionLink href="/legal/privacy" label="Privacy policy" tone="cyan" />
          <ActionLink href="/legal/terms" label="Terms" />
        </Group>
      </div>
    </main>
  );
}