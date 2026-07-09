"use client";

import { useState } from "react";

type Props = {
  consentType: string;
  title: string;
  description: string;
  badge?: string;
  tone?: "emerald" | "cyan" | "rose" | "amber";
};

export default function ConsentBox({
  consentType,
  title,
  description,
  badge = "Required",
  tone = "emerald",
}: Props) {
  const [checked, setChecked] = useState(false);
  const [status, setStatus] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");

  const toneStyles =
    tone === "rose"
      ? {
          border: "border-rose-400/15",
          glow: "hover:shadow-[0_0_28px_rgba(244,63,94,0.08)]",
          text: "text-rose-200",
          bg: "bg-rose-500/[0.07]",
        }
      : tone === "amber"
        ? {
            border: "border-amber-400/15",
            glow: "hover:shadow-[0_0_28px_rgba(251,191,36,0.08)]",
            text: "text-amber-200",
            bg: "bg-amber-500/[0.07]",
          }
        : tone === "cyan"
          ? {
              border: "border-cyan-400/15",
              glow: "hover:shadow-[0_0_28px_rgba(34,211,238,0.08)]",
              text: "text-cyan-200",
              bg: "bg-cyan-500/[0.07]",
            }
          : {
              border: "border-emerald-400/15",
              glow: "hover:shadow-[0_0_28px_rgba(16,185,129,0.08)]",
              text: "text-emerald-200",
              bg: "bg-emerald-500/[0.07]",
            };

  async function saveConsent() {
    try {
      setStatus("saving");

      const res = await fetch("/api/privacy/consent", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          consentType,
          granted: checked,
        }),
      });

      if (!res.ok) throw new Error("Failed");

      setStatus("saved");
    } catch {
      setStatus("error");
    }
  }

  return (
    <section
      className={`rounded-2xl border ${toneStyles.border} bg-gradient-to-br from-[#071120] via-[#050b16] to-[#020611] p-4 transition-all duration-300 hover:border-white/15 ${toneStyles.glow}`}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-[9px] font-bold uppercase tracking-[0.26em] text-white/35">
          Consent Protocol
        </p>

        <span
          className={`rounded-full border ${toneStyles.border} ${toneStyles.bg} px-2 py-1 text-[8px] font-bold uppercase tracking-[0.16em] ${toneStyles.text}`}
        >
          {status === "saved" ? "Saved" : badge}
        </span>
      </div>

      <h3 className="text-[15px] font-semibold tracking-[-0.02em] text-white">
        {title}
      </h3>

      <p className="mt-1 text-[13px] leading-6 text-white/48">
        {description}
      </p>

      <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-[13px] leading-5 text-white/70 transition hover:border-white/15">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => setChecked(e.target.checked)}
          className="mt-0.5 h-4 w-4 accent-emerald-400"
        />

        <span>
          I understand this notice and consent to this processing where required.
        </span>
      </label>

      <button
        type="button"
        onClick={saveConsent}
        disabled={!checked || status === "saving"}
        className="mt-4 inline-flex items-center justify-center rounded-xl border border-emerald-400/15 bg-emerald-500/[0.08] px-4 py-2 text-[10px] font-bold uppercase tracking-[0.22em] text-emerald-200 transition-all duration-300 hover:border-emerald-300/30 hover:bg-emerald-500/[0.12] hover:shadow-[0_0_20px_rgba(16,185,129,0.15)] disabled:cursor-not-allowed disabled:opacity-30"
      >
        {status === "saving"
          ? "Saving..."
          : status === "saved"
            ? "Consent Saved"
            : "Save Consent"}
      </button>

      {status === "error" && (
        <p className="mt-3 text-xs text-rose-300/70">
          Could not save consent. Try again.
        </p>
      )}
    </section>
  );
}