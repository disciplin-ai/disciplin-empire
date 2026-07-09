"use client";

import { useState } from "react";
import Link from "next/link";
import ConsentBox from "@/components/legal/ConsentBox";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function Pill({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "emerald" | "amber" | "rose" | "cyan";
}) {
  const cls =
    tone === "emerald"
      ? "border-emerald-400/25 bg-emerald-500/10 text-emerald-100"
      : tone === "amber"
        ? "border-amber-400/25 bg-amber-500/10 text-amber-100"
        : tone === "rose"
          ? "border-rose-400/25 bg-rose-500/10 text-rose-100"
          : tone === "cyan"
            ? "border-cyan-400/25 bg-cyan-500/10 text-cyan-100"
            : "border-white/10 bg-white/[0.045] text-white/60";

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em]",
        cls
      )}
    >
      {children}
    </span>
  );
}

function ControlCard({
  eyebrow,
  title,
  body,
  tone,
  children,
}: {
  eyebrow: string;
  title: string;
  body: string;
  tone: "emerald" | "cyan" | "rose" | "amber";
  children: React.ReactNode;
}) {
  const cls =
    tone === "emerald"
      ? "border-emerald-400/18 bg-emerald-500/[0.045]"
      : tone === "cyan"
        ? "border-cyan-400/18 bg-cyan-500/[0.045]"
        : tone === "rose"
          ? "border-rose-400/18 bg-rose-500/[0.045]"
          : "border-amber-400/18 bg-amber-500/[0.045]";

  return (
    <section
      className={cn(
        "rounded-[26px] border p-5 shadow-[0_18px_70px_rgba(0,0,0,0.30)]",
        cls
      )}
    >
      <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-white/36">
        {eyebrow}
      </div>
      <h2 className="mt-2 text-xl font-semibold tracking-[-0.02em] text-white">
        {title}
      </h2>
      <p className="mt-2 text-sm leading-7 text-white/58">{body}</p>
      <div className="mt-5">{children}</div>
    </section>
  );
}

export default function DataControlsPage() {
  const [deleteStatus, setDeleteStatus] = useState<
    "idle" | "sending" | "sent" | "error"
  >("idle");

  async function requestDeletion() {
    setDeleteStatus("sending");

    const res = await fetch("/api/privacy/delete", {
      method: "POST",
    });

    setDeleteStatus(res.ok ? "sent" : "error");
  }

  return (
    <main className="min-h-screen bg-[#020810] px-4 pb-28 pt-8 text-white sm:px-6">
      <div className="pointer-events-none fixed inset-x-0 top-0 h-72 bg-[radial-gradient(circle_at_top,rgba(52,211,153,0.14),transparent_52%)]" />

      <div className="relative mx-auto max-w-5xl space-y-5">
        <section className="rounded-[34px] border border-emerald-400/16 bg-[radial-gradient(circle_at_18%_0%,rgba(52,211,153,0.18),transparent_32%),radial-gradient(circle_at_88%_12%,rgba(103,232,249,0.11),transparent_30%),linear-gradient(145deg,rgba(16,30,52,0.96),rgba(3,10,22,0.98)_58%,rgba(2,8,16,1))] p-6 shadow-[0_24px_90px_rgba(0,0,0,0.45)] md:p-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              <Pill tone="emerald">Data layer</Pill>
              <Pill tone="amber">Sensitive training data</Pill>
              <Pill tone="cyan">Consent controls</Pill>
            </div>
            <Pill tone="emerald">Active</Pill>
          </div>

          <div className="mt-8 max-w-3xl">
            <p className="text-[11px] font-bold uppercase tracking-[0.32em] text-emerald-200/70">
              Disciplin Privacy
            </p>
            <h1 className="mt-3 text-5xl font-bold tracking-[-0.045em] text-white md:text-7xl">
              Data & Consent Controls
            </h1>
            <p className="mt-5 max-w-2xl text-sm leading-7 text-white/58">
              Manage how Disciplin processes AI training analysis, sensitive
              combat-sport data, youth supervision acknowledgement, export, and
              deletion requests.
            </p>
          </div>
        </section>

        <div className="rounded-[26px] border border-amber-400/18 bg-amber-500/[0.055] p-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-amber-200/75">
            Important
          </p>
          <p className="mt-2 text-sm leading-7 text-white/62">
            Disciplin provides informational coaching support only. It is not
            medical advice, injury diagnosis, emergency guidance, or a substitute
            for qualified supervision.
          </p>
        </div>

        <div className="grid gap-4">
          <ConsentBox
            consentType="ai_training_analysis"
            title="AI Training Analysis"
            description="Uploaded frames, training notes, Sensei messages, and correction history may be processed by AI systems to generate informational coaching guidance."
            badge="Required"
            tone="emerald"
          />

          <ConsentBox
            consentType="sensitive_training_data"
            title="Sensitive Training Data"
            description="You may choose to provide injury notes, recovery details, weight, sleep, nutrition, or combat-sport information. Disciplin uses this only to support training guidance."
            badge="Explicit"
            tone="amber"
          />

          <ConsentBox
            consentType="minor_supervision"
            title="Minor Athlete Supervision"
            description="If you are under 18, a parent or guardian should be aware of your use of Disciplin. Minors should train only under qualified adult supervision."
            badge="Youth"
            tone="rose"
          />
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          <ControlCard
            eyebrow="Data portability"
            title="Export your data"
            body="Download a copy of your Disciplin compliance and account data."
            tone="cyan"
          >
            <a
              href="/api/privacy/export"
              className="inline-flex rounded-2xl border border-cyan-400/20 bg-cyan-500/10 px-4 py-3 text-[11px] font-bold uppercase tracking-[0.2em] text-cyan-100 transition hover:bg-cyan-500/[0.14]"
            >
              Export data
            </a>
          </ControlCard>

          <ControlCard
            eyebrow="Account erasure"
            title="Delete account request"
            body="Submit a deletion request. An admin should review and complete deletion manually to avoid accidental data loss."
            tone="rose"
          >
            <button
              type="button"
              onClick={requestDeletion}
              disabled={deleteStatus === "sending"}
              className="rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-[11px] font-bold uppercase tracking-[0.2em] text-rose-100 transition hover:bg-rose-500/[0.14] disabled:opacity-40"
            >
              {deleteStatus === "sending"
                ? "Sending..."
                : deleteStatus === "sent"
                  ? "Request sent"
                  : "Request deletion"}
            </button>

            {deleteStatus === "sent" && (
              <p className="mt-3 text-xs text-emerald-300/75">
                Deletion request received.
              </p>
            )}

            {deleteStatus === "error" && (
              <p className="mt-3 text-xs text-rose-300/75">
                Could not submit deletion request.
              </p>
            )}
          </ControlCard>
        </div>

        <section className="rounded-[26px] border border-white/[0.08] bg-white/[0.035] p-5">
          <div className="grid gap-3 sm:grid-cols-3">
            <Link
              href="/legal/privacy"
              className="rounded-2xl border border-cyan-400/18 bg-cyan-500/[0.06] px-4 py-3 text-center text-[11px] font-bold uppercase tracking-[0.18em] text-cyan-100 transition hover:bg-cyan-500/[0.10]"
            >
              Privacy
            </Link>

            <Link
              href="/legal/terms"
              className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-center text-[11px] font-bold uppercase tracking-[0.18em] text-white/60 transition hover:text-white"
            >
              Terms
            </Link>

            <Link
              href="/legal/safety"
              className="rounded-2xl border border-rose-400/18 bg-rose-500/[0.06] px-4 py-3 text-center text-[11px] font-bold uppercase tracking-[0.18em] text-rose-100 transition hover:bg-rose-500/[0.10]"
            >
              Safety
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}