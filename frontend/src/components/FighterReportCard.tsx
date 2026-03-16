"use client";

import React from "react";
import type { FighterReport } from "@/lib/report/buildFighterReport";

function ScorePill({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-2xl border border-slate-800/60 bg-slate-950/25 p-4">
      <div className="text-[11px] uppercase tracking-[0.22em] text-slate-400/70">
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold text-slate-50">{value}</div>
    </div>
  );
}

export default function FighterReportCard({
  report,
}: {
  report: FighterReport;
}) {
  return (
    <div className="rounded-3xl border border-slate-800/60 bg-[#041026] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-800/40 pb-5">
        <div>
          <div className="text-[11px] font-semibold tracking-[0.32em] text-emerald-300">
            DISCIPLIN FIGHTER REPORT
          </div>
          <h2 className="mt-2 text-2xl font-semibold text-white">
            {report.athleteName}
          </h2>
          <p className="mt-2 text-sm text-slate-300/80">
            {report.styleLabel} · {report.baseArtLabel}
          </p>
        </div>

        <div className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-200">
          Generated now
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <ScorePill label="Striking IQ" value={report.scores.strikingIQ} />
        <ScorePill
          label="Defensive Awareness"
          value={report.scores.defensiveAwareness}
        />
        <ScorePill
          label="Wrestling Chains"
          value={report.scores.wrestlingChains}
        />
        <ScorePill label="Cardio Pace" value={report.scores.cardioPace} />
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-3">
        <div className="rounded-2xl border border-slate-800/60 bg-slate-950/25 p-4">
          <div className="text-[11px] uppercase tracking-[0.22em] text-slate-400/70">
            Main Mistake
          </div>
          <div className="mt-3 text-sm font-medium text-slate-50">
            {report.mainMistake}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800/60 bg-slate-950/25 p-4">
          <div className="text-[11px] uppercase tracking-[0.22em] text-slate-400/70">
            Key Correction
          </div>
          <div className="mt-3 text-sm text-slate-100/90">
            {report.keyCorrection}
          </div>
        </div>

        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">
          <div className="text-[11px] uppercase tracking-[0.22em] text-emerald-200/80">
            Next Directive
          </div>
          <div className="mt-3 text-sm text-emerald-50">
            {report.nextDirective}
          </div>
        </div>
      </div>
    </div>
  );
}