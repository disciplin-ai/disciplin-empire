"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type StepId =
  | "rules"
  | "ai"
  | "risk"
  | "minor"
  | "privacy"
  | "activate";

type Step = {
  id: StepId;
  number: string;
  label: string;
  title: string;
  subtitle: string;
  bullets: string[];
  consentType: string;
  required: boolean;
};

const STEPS: Step[] = [
  {
    id: "rules",
    number: "01",
    label: "Platform Rules",
    title: "Disciplin is coaching support, not final authority.",
    subtitle:
      "You are entering a fight-camp operating system. It gives structure, correction, and guidance, but you remain responsible for training decisions.",
    bullets: [
      "Disciplin provides informational coaching support only.",
      "It does not guarantee results, wins, performance improvement, or safety.",
      "Use qualified coaches and common sense when applying any recommendation.",
    ],
    consentType: "platform_rules",
    required: true,
  },
  {
    id: "ai",
    number: "02",
    label: "AI Processing",
    title: "AI may process your training inputs.",
    subtitle:
      "Sensei, Vision, and Fuel may use your notes, uploads, and training context to generate coaching guidance.",
    bullets: [
      "Uploaded frames and training notes may be processed by AI systems.",
      "AI outputs may be incomplete, inaccurate, or unsuitable for your situation.",
      "Do not rely on AI as your only coach, judge, or safety authority.",
    ],
    consentType: "ai_processing_disclosure",
    required: true,
  },
  {
    id: "risk",
    number: "03",
    label: "Combat Risk",
    title: "Combat sports involve real injury risk.",
    subtitle:
      "Wrestling, MMA, boxing, grappling, sparring, conditioning, and weight management can cause serious harm if done irresponsibly.",
    bullets: [
      "Stop immediately if you feel pain, dizziness, numbness, concussion symptoms, or injury signs.",
      "Disciplin is not medical advice, diagnosis, physiotherapy, rehab, or emergency guidance.",
      "Consult qualified medical professionals for injuries, pain, concussion concerns, and return-to-training decisions.",
    ],
    consentType: "combat_risk_disclosure",
    required: true,
  },
  {
    id: "minor",
    number: "04",
    label: "Minor Supervision",
    title: "Youth athletes need adult supervision.",
    subtitle:
      "Many fighters are teenagers. That does not remove the need for parent or guardian awareness and qualified adult supervision.",
    bullets: [
      "You must be at least 13 years old to use Disciplin.",
      "If under 18, a parent or guardian should be aware of your use of Disciplin.",
      "Minors should not rely on Disciplin alone for training intensity, injury, weight cutting, or return-to-training decisions.",
    ],
    consentType: "minor_supervision_acknowledgement",
    required: true,
  },
  {
    id: "privacy",
    number: "05",
    label: "Privacy Rights",
    title: "Your data has controls.",
    subtitle:
      "Disciplin gives users access to privacy pages, consent controls, data export, and deletion request mechanisms.",
    bullets: [
      "You can review the Privacy Policy, Terms, Safety page, and Cookie Policy.",
      "You can export compliance-layer account data.",
      "You can submit a deletion request through Data & Consent Controls.",
    ],
    consentType: "privacy_rights_acknowledgement",
    required: true,
  },
  {
    id: "activate",
    number: "06",
    label: "Activate",
    title: "System ready.",
    subtitle:
      "Confirm the required acknowledgements to enter Disciplin. This creates a compliance record for your account.",
    bullets: [
      "Platform rules acknowledged.",
      "AI processing disclosed.",
      "Combat risk and safety limits acknowledged.",
      "Privacy and data rights made available.",
    ],
    consentType: "compliance_gate_completed",
    required: true,
  },
];

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export default function CompliancePage() {
  const router = useRouter();

  const [index, setIndex] = useState(0);
  const [accepted, setAccepted] = useState<Record<string, boolean>>({});
  const [status, setStatus] = useState<
    "idle" | "saving" | "complete" | "error"
  >("idle");

  const step = STEPS[index];
  const isLast = index === STEPS.length - 1;
  const currentAccepted = accepted[step.id] === true;

  const progress = useMemo(() => {
    return Math.round(((index + 1) / STEPS.length) * 100);
  }, [index]);

  const allRequiredAccepted = useMemo(() => {
    return STEPS.every((s) => !s.required || accepted[s.id] === true);
  }, [accepted]);

  function toggleCurrent() {
    setAccepted((prev) => ({
      ...prev,
      [step.id]: !prev[step.id],
    }));
  }

  function goBack() {
    if (index <= 0 || status === "saving") return;
    setIndex((v) => v - 1);
  }

  async function saveConsent(consentType: string, granted: boolean) {
    const res = await fetch("/api/privacy/consent", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        consentType,
        granted,
      }),
    });

    if (!res.ok) {
      throw new Error("Could not save consent.");
    }
  }

  async function goNext() {
    if (!currentAccepted || status === "saving") return;

    try {
      setStatus("saving");

      await saveConsent(step.consentType, true);

      if (!isLast) {
        setIndex((v) => v + 1);
        setStatus("idle");
        return;
      }

      for (const s of STEPS) {
        if (accepted[s.id] || s.id === step.id) {
          await saveConsent(s.consentType, true);
        }
      }

      if (!allRequiredAccepted && !currentAccepted) {
        setStatus("error");
        return;
      }

      setStatus("complete");

      router.push("/dashboard");
      router.refresh();
    } catch {
      setStatus("error");
    }
  }

  return (
    <main className="min-h-screen overflow-hidden bg-[#020617] text-white">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.08),transparent_42%)]" />
        <div className="absolute bottom-0 right-0 h-[420px] w-[420px] bg-[radial-gradient(circle,rgba(244,63,94,0.06),transparent_60%)]" />
      </div>

      <div className="relative mx-auto flex min-h-screen max-w-4xl flex-col px-4 py-6 sm:px-6">
        <header className="mb-5 flex items-center justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.34em] text-emerald-300">
              DISCIPLIN
            </p>

            <p className="mt-1 text-xs text-white/35">
              Compliance gate · system initialization
            </p>
          </div>

          <div className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.18em] text-emerald-200">
            {progress}% Ready
          </div>
        </header>

        <section className="rounded-[28px] border border-white/10 bg-gradient-to-br from-[#071120] via-[#050b16] to-[#020611] p-5 shadow-[0_30px_100px_rgba(0,0,0,0.55)] sm:p-6">
          <div className="mb-5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-emerald-300/70">
                  {step.number} · {step.label}
                </p>

                <h1 className="mt-3 text-[28px] font-semibold leading-[1.05] tracking-[-0.05em] text-white sm:text-[36px]">
                  {step.title}
                </h1>
              </div>

              <span
                className={cn(
                  "hidden rounded-full border px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.16em] sm:inline-flex",
                  currentAccepted
                    ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-200"
                    : "border-amber-400/20 bg-amber-500/10 text-amber-200"
                )}
              >
                {currentAccepted ? "Accepted" : "Required"}
              </span>
            </div>

            <p className="max-w-2xl text-sm leading-6 text-white/50">
              {step.subtitle}
            </p>
          </div>

          <div className="mb-5 h-1 overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-emerald-300 to-emerald-500 transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="space-y-3">
            {step.bullets.map((bullet, i) => (
              <div
                key={bullet}
                className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3"
              >
                <div className="flex gap-3">
                  <span className="mt-0.5 text-[10px] font-bold text-emerald-300/70">
                    {String(i + 1).padStart(2, "0")}
                  </span>

                  <p className="text-sm leading-6 text-white/65">{bullet}</p>
                </div>
              </div>
            ))}
          </div>

          <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4 transition hover:border-emerald-400/20">
            <input
              type="checkbox"
              checked={currentAccepted}
              onChange={toggleCurrent}
              className="mt-1 h-4 w-4 accent-emerald-400"
            />

            <span className="text-sm leading-6 text-white/70">
              I understand and accept this requirement.
            </span>
          </label>

          {status === "error" && (
            <div className="mt-4 rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
              Could not save acknowledgement. Make sure you are logged in, then
              try again.
            </div>
          )}

          <div className="mt-6 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={goBack}
              disabled={index === 0 || status === "saving"}
              className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-[11px] font-bold uppercase tracking-[0.18em] text-white/45 transition hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
            >
              Back
            </button>

            <button
              type="button"
              onClick={goNext}
              disabled={!currentAccepted || status === "saving"}
              className="rounded-2xl border border-emerald-400/20 bg-emerald-500/15 px-5 py-3 text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-100 transition hover:border-emerald-300/35 hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-30"
            >
              {status === "saving"
                ? "Saving..."
                : isLast
                  ? "Enter Disciplin"
                  : "Continue"}
            </button>
          </div>
        </section>

        <div className="mt-5 grid grid-cols-6 gap-2">
          {STEPS.map((s, i) => (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                if (i <= index) setIndex(i);
              }}
              className={cn(
                "h-1.5 rounded-full transition",
                i <= index ? "bg-emerald-300/80" : "bg-white/10"
              )}
              aria-label={s.label}
            />
          ))}
        </div>

        <p className="mt-5 text-center text-[11px] leading-5 text-white/30">
          Disciplin provides informational coaching support only. It is not
          medical advice, injury diagnosis, emergency guidance, or a substitute
          for qualified supervision.
        </p>
      </div>
    </main>
  );
}