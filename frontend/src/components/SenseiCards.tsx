"use client";

import Link from "next/link";
import React from "react";

function cn(...xs: (string | false | null | undefined)[]) {
  return xs.filter(Boolean).join(" ");
}

function ModuleCard({
  title,
  desc,
  href,
  tag,
}: {
  title: string;
  desc: string;
  href: string;
  tag: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group block rounded-2xl border border-slate-800/70 bg-slate-950/40 p-5 shadow-sm transition-all duration-200",
        "hover:border-slate-700/80 hover:bg-slate-950/55"
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="text-xs tracking-[0.22em] text-emerald-300/80">{tag}</div>
        <div className="rounded-full border border-slate-700/60 bg-slate-900/40 px-2.5 py-1 text-xs text-slate-200">
          Open
        </div>
      </div>
      <div className="mt-3 text-lg font-semibold text-slate-50">{title}</div>
      <div className="mt-2 text-sm text-slate-400">{desc}</div>

      <div className="mt-4 h-px w-full bg-slate-800/60" />

      <div className="mt-3 text-xs text-slate-500 group-hover:text-slate-400">
        Father rule: one correction you will apply today.
      </div>
    </Link>
  );
}

export default function SenseiCards() {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <ModuleCard
        tag="SENSEI"
        title="Correction Session"
        desc="Describe the issue. Get a surgical correction + drill. Then answer questions to tighten it."
        href="/sensei"
      />
      <ModuleCard
        tag="SENSEI VISION"
        title="Frame Analysis"
        desc="Upload a frame. Sensei exposes the habit, gives the smallest fix cue, then interrogates for accuracy."
        href="/sensei-vision"
      />
    </div>
  );
}