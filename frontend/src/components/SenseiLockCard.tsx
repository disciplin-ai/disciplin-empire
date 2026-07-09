"use client";

import type { DirectiveState } from "@/lib/disciplinLock";

type SenseiLockDirectiveState = DirectiveState & {
  severity?: string | null;
  title?: string | null;
};

type Props = {
  directiveState: SenseiLockDirectiveState | null;
  activeDirective?: string | null;
  fixNextRep?: string | null;
  onTrack?: boolean;
};

function severityTone(severity?: string | null) {
  if (severity === "LOW") {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-200";
  }

  if (severity === "MEDIUM") {
    return "border-amber-500/30 bg-amber-500/10 text-amber-200";
  }

  return "border-red-500/30 bg-red-500/10 text-red-200";
}

function statusTone(verified: boolean) {
  return verified
    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
    : "border-red-500/30 bg-red-500/10 text-red-200";
}

export default function SenseiLockCard({
  directiveState,
  activeDirective,
  fixNextRep,
}: Props) {
  if (!directiveState) {
    return (
      <div className="rounded-[24px] border border-white/10 bg-[#0B0D10] p-5 text-white">
        <div className="text-[11px] uppercase tracking-[0.22em] text-white/40">
          Directive Lock
        </div>
        <div className="mt-3 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-red-200">
          No active directive loaded.
        </div>
        <div className="mt-3 text-sm text-white/60">
          Vision must load one real correction before Sensei can become a locked system.
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-[24px] border border-white/10 bg-[#0B0D10] p-5 text-white">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-[0.22em] text-white/40">
            Directive Lock
          </div>
          <div className="mt-2 text-xl font-semibold text-white">
            {directiveState.title || activeDirective || "Unnamed directive"}
          </div>
        </div>

        <div
          className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${severityTone(
            directiveState.severity
          )}`}
        >
          {directiveState.severity}
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <div className="text-[11px] uppercase tracking-[0.16em] text-white/40">
            Progress
          </div>
          <div className="mt-2 text-2xl font-semibold text-white">
            {directiveState.repsCompleted}/{directiveState.repsRequired}
          </div>
          <div className="mt-1 text-sm text-white/55">Verified reps</div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <div className="text-[11px] uppercase tracking-[0.16em] text-white/40">
            Resistance
          </div>
          <div className="mt-2 text-2xl font-semibold text-white">
            {directiveState.underResistance ? "Yes" : "No"}
          </div>
          <div className="mt-1 text-sm text-white/55">Must hold under pressure</div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <div className="text-[11px] uppercase tracking-[0.16em] text-white/40">
            Proof
          </div>
          <div className="mt-2 text-2xl font-semibold text-white">
            {directiveState.proofType}
          </div>
          <div className="mt-1 text-sm text-white/55">
            image / video / metrics only
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <div className="text-[11px] uppercase tracking-[0.16em] text-white/40">
            Repeated Failures
          </div>
          <div className="mt-2 text-2xl font-semibold text-white">
            {directiveState.repeatedFailureCount}
          </div>
          <div className="mt-1 text-sm text-white/55">Pressure escalation</div>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <div className="text-[11px] uppercase tracking-[0.16em] text-white/40">
            Fix Next Rep
          </div>
          <div className="mt-2 text-sm leading-6 text-white/80">
            {fixNextRep?.trim() || "No fix-next-rep loaded."}
          </div>
        </div>

        <div
          className={`rounded-2xl border p-4 ${statusTone(
            directiveState.verified
          )}`}
        >
          <div className="text-[11px] uppercase tracking-[0.16em] opacity-70">
            Lock Status
          </div>
          <div className="mt-2 text-lg font-semibold">
            {directiveState.verified ? "Unlocked" : "Locked"}
          </div>
          <div className="mt-2 text-sm leading-6 opacity-85">
            {directiveState.verified
              ? "Progression is open because the directive was verified under resistance with accepted proof."
              : "Progression stays locked until the directive holds for 5 reps under resistance with accepted proof."}
          </div>
        </div>
      </div>
    </div>
  );
}