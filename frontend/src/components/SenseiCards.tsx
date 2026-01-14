"use client";

import React, { useMemo, useState } from "react";
import type { SenseiResponse, SenseiSection } from "../lib/senseiTypes";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

const ORDER: Array<SenseiSection["id"]> = ["overview", "training", "nutrition", "recovery", "questions"];

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
                "rounded-full px-3 py-1 text-xs border transition",
                isActive
                  ? "border-emerald-500 bg-emerald-500/15 text-emerald-100"
                  : "border-white/10 bg-white/[0.02] text-white/60 hover:border-emerald-400 hover:text-emerald-200"
              )}
            >
              {LABELS[id]}
            </button>
          );
        })}
      </div>

      {section ? <SectionCard section={section} /> : <div className="text-sm text-white/60">Missing section.</div>}
    </div>
  );
}

function SectionCard({ section }: { section: SenseiSection }) {
  const confClass =
    section.confidence === "high"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
      : section.confidence === "med"
      ? "border-amber-500/30 bg-amber-500/10 text-amber-200"
      : "border-red-500/30 bg-red-500/10 text-red-200";

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] tracking-[0.25em] text-emerald-400">{section.week}</div>
          <div className="mt-1 text-xl font-semibold text-white">{section.title}</div>
        </div>

        <div className={cn("rounded-full border px-3 py-1 text-xs", confClass)}>
          {section.confidence.toUpperCase()}
        </div>
      </div>

      {/* Highlighted subtopics */}
      <div className="mt-4 grid gap-3">
        {section.blocks.slice(0, 6).map((b, idx) => (
          <div key={`${b.label}-${idx}`} className="rounded-xl border border-white/10 bg-black/30 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="text-xs tracking-widest text-white/70">{b.label}</div>

              {b.metrics && Object.keys(b.metrics).length > 0 ? (
                <div className="flex flex-wrap justify-end gap-2 text-[11px] text-white/60">
                  {Object.entries(b.metrics).slice(0, 4).map(([k, v]) => (
                    <span key={k} className="rounded-full border border-white/10 bg-white/[0.02] px-2 py-1">
                      {k}: <span className="text-white/80">{v}</span>
                    </span>
                  ))}
                </div>
              ) : null}
            </div>

            <ul className="mt-2 space-y-1 text-sm text-white/80">
              {b.bullets.slice(0, 3).map((x, i) => (
                <li key={i} className="leading-snug">• {x}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
