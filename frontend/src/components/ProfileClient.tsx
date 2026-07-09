"use client";

import React from "react";
import Link from "next/link";
import AppShell from "./AppShell";
import ProfileForm from "./ProfileForm";

function LegalRow({
  href,
  title,
  description,
  tone = "neutral",
  status,
}: {
  href: string;
  title: string;
  description: string;
  tone?: "neutral" | "emerald" | "cyan" | "rose" | "amber";
  status?: string;
}) {
  const toneClass =
    tone === "emerald"
      ? "border-emerald-400/15 bg-emerald-500/[0.04]"
      : tone === "cyan"
        ? "border-cyan-400/15 bg-cyan-500/[0.04]"
        : tone === "rose"
          ? "border-rose-400/15 bg-rose-500/[0.04]"
          : tone === "amber"
            ? "border-amber-400/15 bg-amber-500/[0.04]"
            : "border-white/10 bg-white/[0.03]";

  const pillClass =
    tone === "rose"
      ? "border-rose-400/20 bg-rose-500/10 text-rose-200"
      : tone === "amber"
        ? "border-amber-400/20 bg-amber-500/10 text-amber-200"
        : tone === "cyan"
          ? "border-cyan-400/20 bg-cyan-500/10 text-cyan-200"
          : "border-emerald-400/20 bg-emerald-500/10 text-emerald-200";

  return (
    <Link
      href={href}
      className={`group flex items-center justify-between gap-4 rounded-2xl border px-4 py-3.5 transition active:scale-[0.99] ${toneClass}`}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-semibold text-white">{title}</p>

          {status && (
            <span
              className={`hidden shrink-0 rounded-full border px-2 py-0.5 text-[8px] font-bold uppercase tracking-[0.14em] sm:inline-flex ${pillClass}`}
            >
              {status}
            </span>
          )}
        </div>

        <p className="mt-1 line-clamp-2 text-[12px] leading-5 text-white/45">
          {description}
        </p>
      </div>

      <div className="shrink-0 text-white/25 transition group-hover:text-white/55">
        →
      </div>
    </Link>
  );
}

function LegalControlsSection() {
  return (
    <section className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.055),rgba(255,255,255,0.025))] p-5 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
      <div className="mb-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-emerald-300/70">
            Safety / Data
          </p>

          <span className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-2 py-1 text-[8px] font-bold uppercase tracking-[0.16em] text-emerald-200">
            Active
          </span>
        </div>

        <h2 className="mt-2 text-xl font-semibold tracking-[-0.02em] text-white">
          Controls that protect the file
        </h2>

        <p className="mt-2 text-sm leading-6 text-white/45">
          Consent, privacy, export, deletion, and combat safety rules stay attached
          to the fighter profile.
        </p>
      </div>

      <div className="space-y-2.5">
        <LegalRow
          href="/legal/data"
          title="Data & Consent Controls"
          description="AI processing consent, sensitive training data consent, export, and deletion request."
          tone="emerald"
          status="Required"
        />

        <LegalRow
          href="/legal/safety"
          title="Training Safety"
          description="Combat sport risk, concussion warning, youth athlete supervision, and emergency guidance."
          tone="rose"
          status="Critical"
        />

        <LegalRow
          href="/legal/privacy"
          title="Privacy Policy"
          description="How Disciplin collects, uses, stores, and protects user data."
          tone="cyan"
          status="Live"
        />

        <LegalRow
          href="/legal/terms"
          title="Terms & Conditions"
          description="Platform rules, training risk, AI limitations, and user responsibility."
          tone="neutral"
          status="Live"
        />

        <LegalRow
          href="/legal/cookies"
          title="Cookie & Tracking Policy"
          description="Essential storage, analytics, marketing cookies, and opt-out position."
          tone="amber"
          status="Policy"
        />
      </div>

      <div className="mt-4 rounded-2xl border border-white/10 bg-black/25 px-4 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/35">
          Training Notice
        </p>

        <p className="mt-1 text-xs leading-5 text-white/45">
          Disciplin gives informational coaching support only. It is not medical
          advice, injury diagnosis, emergency guidance, physiotherapy, or guaranteed
          performance outcome.
        </p>
      </div>
    </section>
  );
}

export default function ProfileClient() {
  return (
    <AppShell
      badge="FIGHTER FILE"
      title="Operating profile"
      subtitle="The identity layer Sensei, Vision, Fuel, and Dashboard use to understand the fighter."
      className="pb-24"
    >
      <ProfileForm />
      <LegalControlsSection />
    </AppShell>
  );
}