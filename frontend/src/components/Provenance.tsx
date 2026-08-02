import React from "react";
import { PROVENANCE, type ProvenanceKind } from "@/lib/provenance/contracts";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

/*
  Three signals carry the meaning, never colour alone:

    1. the written label, always present
    2. a marker shape — filled for coach authority, ringed for awaiting a
       coach, hollow for athlete or system statements
    3. tone, as reinforcement only

  A coach reading this under gym lighting, an athlete who cannot distinguish
  the greens, and a screen reader all get the same answer.
*/
const MARKER: Record<ProvenanceKind, string> = {
  coach_approved: "bg-emerald-300",
  coach_entered: "bg-emerald-300/70",
  pending_coach_review: "border border-amber-200/80 bg-transparent",
  athlete_entered: "border border-white/45 bg-transparent",
  disciplin_suggested: "border border-dashed border-white/40 bg-transparent",
  observation_only: "border border-dashed border-white/40 bg-transparent",
};

const TEXT: Record<ProvenanceKind, string> = {
  coach_approved: "text-emerald-100/85",
  coach_entered: "text-emerald-100/70",
  pending_coach_review: "text-amber-100/80",
  athlete_entered: "text-white/55",
  disciplin_suggested: "text-white/50",
  observation_only: "text-white/50",
};

export default function Provenance({
  kind,
  className,
}: {
  kind: ProvenanceKind;
  className?: string;
}) {
  const meta = PROVENANCE[kind];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-[11px] font-medium leading-none",
        TEXT[kind],
        className
      )}
      title={meta.meaning}
    >
      <span
        aria-hidden="true"
        className={cn("h-1.5 w-1.5 shrink-0 rounded-full", MARKER[kind])}
      />
      {meta.label}
      <span className="sr-only"> — {meta.meaning}</span>
    </span>
  );
}
