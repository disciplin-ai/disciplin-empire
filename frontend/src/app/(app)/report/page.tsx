"use client";

import React, { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import FighterReportCard from "@/components/FighterReportCard";
import { useFighterContext } from "@/hooks/useFighterContext";
import {
  buildFighterReport,
  type FighterReport,
  type ReportFinding,
} from "@/lib/report/buildFighterReport";

type VisionFinding = {
  id?: string;
  title: string;
  detail: string;
  severity: "LOW" | "MEDIUM" | "HIGH";
};

type VisionAnalysis = {
  analysis_id?: string;
  clipLabel?: string;
  findings?: VisionFinding[];
};

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function buildShareText(report: FighterReport) {
  return [
    "DISCIPLIN FIGHTER REPORT",
    "",
    `${report.athleteName}`,
    `${report.styleLabel} · ${report.baseArtLabel}`,
    "",
    `Striking IQ: ${report.scores.strikingIQ}`,
    `Defensive Awareness: ${report.scores.defensiveAwareness}`,
    `Wrestling Chains: ${report.scores.wrestlingChains}`,
    `Cardio Pace: ${report.scores.cardioPace}`,
    "",
    `Main Mistake: ${report.mainMistake}`,
    `Key Correction: ${report.keyCorrection}`,
    `Next Directive: ${report.nextDirective}`,
  ].join("\n");
}

export default function ReportPage() {
  const { fighterContext } = useFighterContext();
  const [vision, setVision] = useState<VisionAnalysis | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const latestVision = readJson<VisionAnalysis>("disciplin_latest_vision");
    setVision(latestVision);
  }, []);

  const report = useMemo(() => {
    const findings: ReportFinding[] = Array.isArray(vision?.findings)
      ? vision.findings.map((item) => ({
          id: item.id,
          title: item.title,
          detail: item.detail,
          severity: item.severity,
        }))
      : [];

    return buildFighterReport({
      fighterName: fighterContext.identity.name,
      baseArt: fighterContext.style.baseArt,
      stance: fighterContext.style.stance,
      secondaryArts: fighterContext.style.secondaryArts,
      paceStyle: fighterContext.style.paceStyle,
      pressurePreference: fighterContext.style.pressurePreference,
      strengths: fighterContext.style.strengths,
      weaknesses: fighterContext.style.weaknesses,
      currentWeight: fighterContext.identity.currentWeight,
      targetWeight: fighterContext.identity.targetWeight,
      fightDate: fighterContext.camp.fightDate,
      findings,
    });
  }, [fighterContext, vision]);

  async function handleShare() {
    const text = buildShareText(report);

    if (navigator.share) {
      try {
        await navigator.share({
          title: "Disciplin Fighter Report",
          text,
        });
        return;
      } catch {
        // fall through to clipboard
      }
    }

    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <AppShell
      badge="REPORT"
      title="Fighter report card"
      subtitle="Shareable breakdown generated from your profile and latest Vision analysis."
      right={
        <button
          type="button"
          onClick={handleShare}
          className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-100 hover:bg-emerald-500/15"
        >
          {copied ? "Copied" : "Share report"}
        </button>
      }
    >
      <FighterReportCard report={report} />

      <div className="rounded-2xl border border-slate-800/60 bg-slate-950/25 p-5 text-sm text-slate-300/80">
        <div className="text-sm font-semibold text-slate-50">
          How this is calculated
        </div>

        <div className="mt-3 space-y-2">
          <p>
            The report uses your fighter profile plus the latest saved Sensei
            Vision findings.
          </p>
          <p>
            Higher-severity technical mistakes lower the relevant scores, while
            your base art, style, and strengths shape the final profile.
          </p>
          <p>
            This is the first MVP version. Later it should compare weekly
            reports and show trend movement over time.
          </p>
        </div>
      </div>
    </AppShell>
  );
}