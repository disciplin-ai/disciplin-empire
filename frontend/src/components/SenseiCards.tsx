"use client";

import React, { useMemo, useState } from "react";
import type { SenseiResponse, SenseiSection } from "../lib/senseiTypes";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

const ORDER: Array<SenseiSection["id"]> = [
  "overview",
  "training",
  "nutrition",
  "recovery",
  "questions",
];

const LABELS: Record<SenseiSection["id"], string> = {
  overview: "Overview",
  training: "Training",
  nutrition: "Nutrition",
  recovery: "Recovery",
  questions: "Questions",
};

export default function SenseiCards({ data }: { data: SenseiResponse }) {
  const sectionsById = useMemo(() => {
    const map = new Map<SenseiSection["id"], SenseiSection>();
    for (const s of data.sections) map.set(s.id, s);
    return map;
  }, [data.sections]);

  const [active, setActive] = useState<SenseiSection["id"]>("overview");
  const section = sectionsById.get(active);

  return (
    <div className="space-y-4">
      {/* Selector chips */}
      <div className="flex flex-wrap gap-2">
        {ORDER.map((id) => {
          const isActive = id === active;

          return (
            <button
              key={id}
              type="button"
              onClick={() => setActive(id)}
              className={cn(
                "relative rounded-full px-3 py-1.5 text-xs border transition",
                "backdrop-blur",
                isActive
                  ? "border-emerald-400/50 bg-emerald-500/10 text-emerald-100 shadow-[0_0_0_1px_rgba(16,185,129,0.15)]"
                  : "border-slate-700/60 bg-slate-950/40 text-slate-300 hover:border-emerald-400/40 hover:text-emerald-200"
              )}
            >
              {LABELS[id]}
              {isActive && (
                <span className="absolute -bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-emerald-400/80" />
              )}
            </button>
          );
        })}
      </div>

      {section ? (
        <SectionCard section={section} />
      ) : (
        <div className="text-sm text-slate-400">Missing section.</div>
      )}
    </div>
  );
}

function SectionCard({ section }: { section: SenseiSection }) {
  const conf = section.confidence;

  const confBadge =
    conf === "high"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
      : conf === "med"
      ? "border-amber-500/30 bg-amber-500/10 text-amber-200"
      : "border-rose-500/30 bg-rose-500/10 text-rose-200";

  return (
    <div className="rounded-2xl border border-slate-800/80 bg-slate-950/60 p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.02)]">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-[0.25em] text-emerald-300/80">
            {section.week}
          </div>
          <div className="mt-1 text-xl font-semibold text-slate-50">
            {section.title}
          </div>
          <div className="mt-1 text-xs text-slate-400">
            Built for clarity — compact, actionable blocks.
          </div>
        </div>

        <div className={cn("rounded-full border px-3 py-1 text-xs", confBadge)}>
          {section.confidence.toUpperCase()}
        </div>
      </div>

      {/* Blocks */}
      <div className="mt-4 grid gap-3">
        {section.blocks.slice(0, 6).map((b, idx) => (
          <div
            key={`${b.label}-${idx}`}
            className={cn(
              "rounded-xl border border-slate-800/70 bg-slate-900/40 p-4",
              "hover:border-emerald-500/30 hover:bg-slate-900/55 transition"
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="text-[11px] uppercase tracking-widest text-slate-300/80">
                {b.label}
              </div>

              {b.metrics && Object.keys(b.metrics).length > 0 ? (
                <div className="flex flex-wrap justify-end gap-2 text-[11px] text-slate-400">
                  {Object.entries(b.metrics)
                    .slice(0, 4)
                    .map(([k, v]) => (
                      <span
                        key={k}
                        className="rounded-full border border-slate-800 bg-slate-950/40 px-2 py-1"
                      >
                        {k}: <span className="text-slate-200">{v}</span>
                      </span>
                    ))}
                </div>
              ) : null}
            </div>

            <ul className="mt-2 space-y-1 text-sm text-slate-200/90">
              {b.bullets.slice(0, 4).map((x, i) => (
                <li key={i} className="leading-snug">
                  • {x}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}