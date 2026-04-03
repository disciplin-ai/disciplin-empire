"use client";

import React, { useMemo } from "react";
import type { VisionAnalysis } from "@/lib/senseiVisionTypes";
import type {
  VisionBuildStage,
  VisionChatMessage,
} from "@/components/SenseiVisionClient";

type Props = {
  sport: string;
  setSport: (value: string) => void;
  clipLabel: string;
  setClipLabel: (value: string) => void;
  notes: string;
  setNotes: (value: string) => void;
  selectedFileName: string;
  onFileChange: (file: File | null) => void;
  onAnalyze: () => void;
  onReset: () => void;
  running: boolean;
  buildStage: VisionBuildStage;
  error: string | null;
  analysis: VisionAnalysis | null;
  chatInput: string;
  setChatInput: (value: string) => void;
  chatSending: boolean;
  chatMessages: VisionChatMessage[];
  onSendChat: () => void;
  onChatKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  quickPrompts: string[];
  onQuickPrompt: (prompt: string) => void;
};

type Finding = {
  title: string;
  severity?: "LOW" | "MEDIUM" | "HIGH" | string;
  interrupt?: string;
  fix_next_rep?: string;
  good?: string;
  unstable?: string;
  break_point?: string;
  dashboard_detail?: string;
  if_ignored?: string;
  short_detail?: string;
  train?: string[];
};

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function cleanSentence(text?: string) {
  return String(text || "").replace(/\s+/g, " ").trim();
}

function compact(text?: string, max = 220) {
  const value = cleanSentence(text);
  if (!value) return "Not generated yet.";
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1).trim()}…`;
}

function severityTone(sev?: string): "good" | "warn" | "bad" | "neutral" {
  if (sev === "HIGH") return "bad";
  if (sev === "MEDIUM") return "warn";
  if (sev === "LOW") return "good";
  return "neutral";
}

function toneClasses(tone: "good" | "warn" | "bad" | "neutral") {
  if (tone === "good") {
    return "border-emerald-400/30 bg-emerald-400/10 text-emerald-100";
  }
  if (tone === "warn") {
    return "border-amber-400/30 bg-amber-400/10 text-amber-100";
  }
  if (tone === "bad") {
    return "border-rose-400/30 bg-rose-400/10 text-rose-100";
  }
  return "border-white/10 bg-white/[0.03] text-white/70";
}

function Badge({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: "good" | "warn" | "bad" | "neutral";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-3 py-1 text-[11px] tracking-wide",
        toneClasses(tone)
      )}
    >
      {label}
    </span>
  );
}

function normalizeStage(stage: VisionBuildStage | string) {
  const raw = String(stage || "IDLE").toUpperCase();

  if (raw === "DONE") {
    return { key: "DONE", label: "Correction ready", pct: 100, step: 4 };
  }

  if (raw.includes("UPLOAD")) {
    return { key: "UPLOAD", label: "Uploading frame", pct: 18, step: 1 };
  }

  if (raw.includes("READ") || raw.includes("FRAME")) {
    return { key: "READ", label: "Reading frame", pct: 38, step: 2 };
  }

  if (raw.includes("CHAIN") || raw.includes("FAILURE")) {
    return { key: "CHAIN", label: "Building correction path", pct: 62, step: 3 };
  }

  if (raw.includes("BUILD") || raw.includes("CORRECTION")) {
    return { key: "BUILD", label: "Finalizing action path", pct: 82, step: 4 };
  }

  return { key: "IDLE", label: "Idle", pct: 0, step: 0 };
}

function ChatBubble({ msg }: { msg: VisionChatMessage }) {
  const isUser = msg.role === "user";
  const isVision = msg.role === "vision";

  return (
    <div
      className={cn(
        "w-[96%] rounded-2xl border px-3 py-3 text-[13px] leading-6 whitespace-pre-wrap sm:w-[94%] sm:px-4 sm:text-sm",
        isUser
          ? "ml-auto border-emerald-400/25 bg-emerald-400/10 text-emerald-50"
          : isVision
            ? "border-white/10 bg-white/[0.03] text-white"
            : "border-amber-400/25 bg-amber-400/10 text-amber-50"
      )}
    >
      <div className="mb-1.5 text-[10px] uppercase tracking-[0.2em] text-white/45">
        {msg.role === "user" ? "You" : msg.role === "vision" ? "Vision" : "System"}
      </div>
      <div className="break-words">{msg.text}</div>
    </div>
  );
}

function StageEngine({
  running,
  buildStage,
}: {
  running: boolean;
  buildStage: VisionBuildStage;
}) {
  const meta = normalizeStage(buildStage);

  return (
    <div className="rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(5,17,42,0.65),rgba(2,8,16,0.9))] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] tracking-[0.25em] text-white/55">VISION ENGINE</p>
          <p className="mt-2 text-sm text-white/85">
            {running
              ? "Frame is being processed into one correction path."
              : "Upload one frame. Vision returns one main correction, one action path, and one direct handoff into Sensei."}
          </p>
        </div>
        <Badge label={running ? "ACTIVE" : "IDLE"} tone={running ? "warn" : "neutral"} />
      </div>

      <div className="mt-4 rounded-2xl border border-white/10 bg-black/25 p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm font-medium text-white">{meta.label}</div>
          <div className="flex items-center gap-1.5">
            <span className={cn("h-2.5 w-2.5 rounded-full", running ? "animate-pulse bg-emerald-300" : "bg-white/20")} />
            <span className={cn("h-2.5 w-2.5 rounded-full", running ? "animate-pulse bg-emerald-300 [animation-delay:120ms]" : "bg-white/20")} />
            <span className={cn("h-2.5 w-2.5 rounded-full", running ? "animate-pulse bg-emerald-300 [animation-delay:240ms]" : "bg-white/20")} />
          </div>
        </div>

        <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className={cn(
              "h-full rounded-full bg-[linear-gradient(90deg,rgba(52,211,153,0.55),rgba(110,231,183,0.95),rgba(52,211,153,0.55))] transition-all duration-700",
              running && "animate-pulse"
            )}
            style={{ width: `${meta.pct}%` }}
          />
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-4">
          {[
            { label: "Upload", step: 1 },
            { label: "Read", step: 2 },
            { label: "Map", step: 3 },
            { label: "Build", step: 4 },
          ].map((item) => {
            const active = running && meta.step >= item.step;
            const done = meta.key === "DONE";

            return (
              <div
                key={item.label}
                className={cn(
                  "rounded-xl border px-3 py-2 text-xs transition",
                  active || done
                    ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-100"
                    : "border-white/10 bg-white/[0.03] text-white/45"
                )}
              >
                {item.label}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function RYGRow({ finding }: { finding: Finding }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/25 p-4 md:p-5">
      <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <p className="text-[11px] tracking-[0.22em] text-white/55">CORRECTION PATH</p>
        <span className="text-[11px] text-white/45">Keep → Unstable → Break</span>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl bg-[linear-gradient(180deg,rgba(16,185,129,0.10),rgba(6,26,24,0.96))] px-4 py-4 ring-1 ring-inset ring-emerald-400/18 shadow-[0_12px_32px_rgba(16,185,129,0.06)]">
          <div className="text-[10px] tracking-[0.22em] text-emerald-200/85">WHAT'S WORKING</div>
          <div className="mt-3 break-words text-sm leading-7 text-white/90">
            {compact(finding.good, 180)}
          </div>
        </div>

        <div className="rounded-2xl bg-amber-500/[0.05] px-4 py-4 ring-1 ring-inset ring-amber-400/15">
          <div className="text-[10px] tracking-[0.22em] text-amber-200/85">GETTING UNSTABLE</div>
          <div className="mt-3 break-words text-sm leading-7 text-white/90">
            {compact(finding.unstable, 180)}
          </div>
        </div>

        <div className="rounded-2xl bg-rose-500/[0.05] px-4 py-4 ring-1 ring-inset ring-rose-400/15">
          <div className="text-[10px] tracking-[0.22em] text-rose-200/85">BREAKS HERE</div>
          <div className="mt-3 break-words text-sm leading-7 text-white/90">
            {compact(finding.break_point, 180)}
          </div>
        </div>
      </div>
    </div>
  );
}

function LoadingCorrectionShell({
  buildStage,
}: {
  buildStage: VisionBuildStage;
}) {
  const meta = normalizeStage(buildStage);

  return (
    <div className="space-y-4">
      <div className="rounded-3xl border border-emerald-400/15 bg-[linear-gradient(180deg,rgba(16,185,129,0.10),rgba(3,11,24,0.78)_24%,rgba(2,8,16,0.96)_100%)] p-6 shadow-[0_30px_90px_rgba(16,185,129,0.10),0_30px_80px_rgba(0,0,0,0.42)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] tracking-[0.24em] text-emerald-200/70">BUILDING CORRECTION</p>
            <h2 className="mt-3 text-3xl font-semibold leading-tight text-white md:text-4xl">
              {meta.label}
            </h2>
          </div>
          <Badge label="LIVE" tone="warn" />
        </div>

        <div className="mt-5 rounded-2xl border border-emerald-400/15 bg-emerald-500/[0.08] px-4 py-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[10px] tracking-[0.22em] text-emerald-200/80">SYSTEM BUILD</p>
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-emerald-300" />
              <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-emerald-300 [animation-delay:120ms]" />
              <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-emerald-300 [animation-delay:240ms]" />
            </div>
          </div>

          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-[linear-gradient(90deg,rgba(52,211,153,0.55),rgba(110,231,183,0.95),rgba(52,211,153,0.55))] transition-all duration-700"
              style={{ width: `${meta.pct}%` }}
            />
          </div>
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-[1.08fr_0.92fr]">
          <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
            <p className="text-[11px] tracking-[0.22em] text-white/55">SUMMARY</p>
            <div className="mt-3 space-y-2">
              <div className="h-4 w-full animate-pulse rounded bg-white/10" />
              <div className="h-4 w-[92%] animate-pulse rounded bg-white/10" />
              <div className="h-4 w-[84%] animate-pulse rounded bg-white/10" />
              <div className="h-4 w-[78%] animate-pulse rounded bg-white/10" />
            </div>
          </div>

          <div className="rounded-2xl border border-emerald-400/24 bg-[linear-gradient(180deg,rgba(16,185,129,0.14),rgba(6,36,33,0.92))] p-4 shadow-[0_0_0_1px_rgba(52,211,153,0.06),0_18px_40px_rgba(16,185,129,0.08)]">
            <p className="text-[11px] tracking-[0.22em] text-emerald-200/85">FIX NEXT REP</p>
            <div className="mt-3 space-y-2">
              <div className="h-4 w-full animate-pulse rounded bg-emerald-300/10" />
              <div className="h-4 w-[82%] animate-pulse rounded bg-emerald-300/10" />
              <div className="h-4 w-[66%] animate-pulse rounded bg-emerald-300/10" />
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-black/25 p-4 md:p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <p className="text-[11px] tracking-[0.22em] text-white/55">CORRECTION PATH</p>
          <span className="text-[11px] text-white/45">Keep → Unstable → Break</span>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          {["WHAT'S WORKING", "GETTING UNSTABLE", "BREAKS HERE"].map((label, i) => (
            <div
              key={label}
              className={cn(
                "rounded-2xl border px-4 py-4",
                i === 0
                  ? "border-emerald-400/15 bg-[linear-gradient(180deg,rgba(16,185,129,0.08),rgba(6,26,24,0.96))]"
                  : "border-white/10 bg-white/[0.03]"
              )}
            >
              <div className="text-[10px] tracking-[0.22em] text-white/45">{label}</div>
              <div className="mt-3 space-y-2">
                <div className="h-4 w-full animate-pulse rounded bg-white/10" />
                <div className="h-4 w-[88%] animate-pulse rounded bg-white/10" />
                <div className="h-4 w-[74%] animate-pulse rounded bg-white/10" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function PrimaryCorrection({
  finding,
  summary,
}: {
  finding: Finding;
  summary?: string;
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-3xl border border-emerald-400/18 bg-[linear-gradient(180deg,rgba(16,185,129,0.13),rgba(7,28,32,0.88)_20%,rgba(2,8,16,0.98)_100%)] p-6 shadow-[0_30px_90px_rgba(16,185,129,0.10),0_30px_80px_rgba(0,0,0,0.42)]">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] tracking-[0.24em] text-emerald-200/70">PRIMARY CORRECTION</p>
            <h2 className="mt-3 text-3xl font-semibold leading-tight text-white md:text-5xl">
              {finding.title}
            </h2>
          </div>
          <Badge label={finding.severity || "UNKNOWN"} tone={severityTone(finding.severity)} />
        </div>

        <div className="mt-5 rounded-2xl border border-rose-400/20 bg-rose-500/[0.06] px-4 py-4">
          <p className="text-[10px] tracking-[0.22em] text-rose-200/85">STOP COMMAND</p>
          <p className="mt-3 text-xl font-semibold leading-9 text-white">
            {compact(finding.interrupt, 120)}
          </p>
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-[1.08fr_0.92fr]">
          <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
            <p className="text-[11px] tracking-[0.22em] text-white/55">WHY THIS MATTERS</p>
            <p className="mt-3 text-base leading-8 text-white/85">
              {compact(finding.dashboard_detail || summary, 220)}
            </p>
          </div>

          <div className="rounded-2xl border border-emerald-400/24 bg-[linear-gradient(180deg,rgba(16,185,129,0.14),rgba(6,36,33,0.92))] p-4 shadow-[0_0_0_1px_rgba(52,211,153,0.06),0_18px_40px_rgba(16,185,129,0.08)]">
            <p className="text-[11px] tracking-[0.22em] text-emerald-200/85">FIX NEXT REP</p>
            <p className="mt-3 text-2xl font-semibold leading-10 text-white">
              {compact(finding.fix_next_rep, 180)}
            </p>
          </div>
        </div>
      </div>

      <RYGRow finding={finding} />

      <div className="grid gap-4 xl:grid-cols-[1.08fr_0.92fr]">
        <div className="rounded-2xl border border-emerald-400/16 bg-[linear-gradient(180deg,rgba(16,185,129,0.08),rgba(4,18,20,0.96))] p-4 shadow-[0_12px_30px_rgba(16,185,129,0.05)]">
          <p className="text-[11px] tracking-[0.22em] text-white/55">TRAIN THIS TODAY</p>
          <ul className="mt-3 space-y-2 text-sm leading-7 text-white/90">
            {(Array.isArray(finding.train) ? finding.train : []).map((item, i) => (
              <li key={i} className="flex gap-2">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-300/80" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-2xl border border-rose-400/20 bg-rose-500/[0.05] p-4">
          <p className="text-[11px] tracking-[0.22em] text-rose-200/85">IF IGNORED</p>
          <p className="mt-3 text-base leading-8 text-white/90">
            {compact(finding.if_ignored, 180)}
          </p>

          <div className="mt-5 rounded-2xl border border-emerald-400/15 bg-emerald-500/[0.07] p-4">
            <p className="text-[10px] tracking-[0.22em] text-emerald-200/80">DIRECTIVE FOR SENSEI</p>
            <p className="mt-2 text-sm leading-7 text-white/90">
              Build the next session around <span className="font-semibold">{finding.title}</span>. Reinforce{" "}
              <span className="font-semibold">{compact(finding.fix_next_rep, 100)}</span>. Do not introduce unrelated focus.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function SupportingIssueCard({
  finding,
}: {
  finding: Finding;
}) {
  const tone = severityTone(finding.severity);

  return (
    <div className="rounded-2xl border border-slate-800/65 bg-slate-950/30 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="text-[10px] uppercase tracking-[0.22em] text-slate-500">Supporting issue</div>
        <Badge label={finding.severity || "UNKNOWN"} tone={tone} />
      </div>

      <h3 className="text-lg font-semibold leading-snug text-slate-50">{finding.title}</h3>

      <div className="mt-4 grid gap-3">
        <div className="rounded-xl border border-emerald-400/15 bg-emerald-500/[0.05] p-3">
          <div className="text-[10px] uppercase tracking-[0.2em] text-emerald-200/80">Keep</div>
          <div className="mt-1 text-sm leading-7 text-slate-300">{compact(finding.good, 140)}</div>
        </div>

        <div className="rounded-xl border border-amber-400/15 bg-amber-500/[0.04] p-3">
          <div className="text-[10px] uppercase tracking-[0.2em] text-amber-200/80">Unstable</div>
          <div className="mt-1 text-sm leading-7 text-slate-300">{compact(finding.unstable, 160)}</div>
        </div>

        <div className="rounded-xl border border-rose-400/15 bg-rose-500/[0.04] p-3">
          <div className="text-[10px] uppercase tracking-[0.2em] text-rose-200/80">Break</div>
          <div className="mt-1 text-sm leading-7 text-slate-300">{compact(finding.break_point, 160)}</div>
        </div>
      </div>
    </div>
  );
}

export default function SenseiVisionScreen({
  sport,
  setSport,
  clipLabel,
  setClipLabel,
  notes,
  setNotes,
  selectedFileName,
  onFileChange,
  onAnalyze,
  onReset,
  running,
  buildStage,
  error,
  analysis,
  chatInput,
  setChatInput,
  chatSending,
  chatMessages,
  onSendChat,
  onChatKeyDown,
  quickPrompts,
  onQuickPrompt,
}: Props) {
  const findings = useMemo(
    () => (Array.isArray((analysis as any)?.findings) ? ((analysis as any).findings as Finding[]) : []),
    [analysis]
  );

  const primary = findings[0] ?? null;
  const supporting = findings.slice(1);

  return (
    <div className="space-y-5">
      <StageEngine running={running} buildStage={buildStage} />

      <div className="grid gap-5 xl:grid-cols-[0.92fr_1.08fr]">
        <div className="rounded-3xl border border-white/10 bg-black/25 p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] tracking-[0.22em] text-white/55">VISION INPUT</p>
              <h2 className="mt-2 text-2xl font-semibold text-white">Frame control</h2>
              <p className="mt-2 text-sm text-white/60">
                Upload one frame. Get one correction path.
              </p>
            </div>
            <Badge label={running ? "RUNNING" : "READY"} tone={running ? "warn" : "good"} />
          </div>

          <div className="mt-5 space-y-4">
            <div>
              <label className="mb-2 block text-[11px] tracking-[0.22em] text-white/45">SPORT</label>
              <div className="flex flex-wrap gap-2">
                {["MMA", "Wrestling", "BJJ", "Boxing", "Kickboxing", "Muay Thai", "Judo", "Sambo"].map((item) => {
                  const active = sport === item;
                  return (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setSport(item)}
                      className={cn(
                        "rounded-full border px-4 py-2 text-sm transition",
                        active
                          ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-100"
                          : "border-white/10 bg-white/[0.03] text-white/75 hover:text-white"
                      )}
                    >
                      {item}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="mb-2 block text-[11px] tracking-[0.22em] text-white/45">CLIP LABEL</label>
              <input
                value={clipLabel}
                onChange={(e) => setClipLabel(e.target.value)}
                placeholder="e.g. Russian tie snap"
                className="w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white placeholder:text-white/30 outline-none focus:border-emerald-400/25"
              />
            </div>

            <div>
              <label className="mb-2 block text-[11px] tracking-[0.22em] text-white/45">CONTEXT</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
                placeholder="Optional context: pace, stance, injury, drill phase..."
                className="w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white placeholder:text-white/30 outline-none focus:border-emerald-400/25"
              />
            </div>

            <div>
              <label className="mb-2 block text-[11px] tracking-[0.22em] text-white/45">FRAME</label>
              <label className="flex cursor-pointer items-center justify-between rounded-2xl border border-dashed border-white/15 bg-white/[0.03] px-4 py-4 text-sm text-white/80 hover:border-emerald-400/25">
                <span>{selectedFileName || "Choose frame image"}</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => onFileChange(e.target.files?.[0] || null)}
                />
                <span className="rounded-full border border-white/10 bg-black/25 px-3 py-1 text-[11px]">Browse</span>
              </label>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={onAnalyze}
                disabled={running}
                className="rounded-2xl bg-emerald-400 px-4 py-3 text-sm font-semibold text-[#041026] transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {running ? "Building correction..." : "Analyze frame"}
              </button>

              <button
                type="button"
                onClick={onReset}
                className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white transition hover:border-white/20"
              >
                Reset
              </button>
            </div>

            {error ? (
              <div className="rounded-2xl border border-rose-400/20 bg-rose-500/[0.07] px-4 py-3 text-sm text-rose-100">
                {error}
              </div>
            ) : null}
          </div>
        </div>

        <div className="space-y-5">
          {running && !primary ? (
            <LoadingCorrectionShell buildStage={buildStage} />
          ) : primary ? (
            <PrimaryCorrection finding={primary} summary={(analysis as any)?.summary} />
          ) : (
            <div className="rounded-3xl border border-white/10 bg-black/25 p-6">
              <p className="text-[11px] tracking-[0.22em] text-white/55">NO CORRECTION YET</p>
              <h2 className="mt-3 text-2xl font-semibold text-white">Upload one frame</h2>
              <p className="mt-3 max-w-xl text-sm leading-7 text-white/70">
                Vision will return one main correction, what is worth keeping, what gets unstable, what breaks the exchange,
                and what to train next.
              </p>
            </div>
          )}

          {supporting.length ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] tracking-[0.22em] text-white/55">SUPPORTING ISSUES</p>
                  <p className="mt-1 text-sm text-white/60">
                    Real issues, but they do not outrank the main correction.
                  </p>
                </div>
                <Badge label={`${supporting.length} issues`} tone="warn" />
              </div>

              <div className="grid gap-4 xl:grid-cols-2">
                {supporting.map((finding, i) => (
                  <SupportingIssueCard key={`${finding.title}-${i}`} finding={finding} />
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div className="rounded-3xl border border-white/10 bg-black/25 p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] tracking-[0.22em] text-white/55">VISION CHAT</p>
            <h3 className="mt-2 text-xl font-semibold text-white">Ask about the current frame</h3>
            <p className="mt-2 text-sm text-white/60">
              Vision only answers questions tied to the active frame and correction.
            </p>
          </div>
          <Badge label={chatSending ? "SENDING" : "READY"} tone={chatSending ? "warn" : "neutral"} />
        </div>

        {quickPrompts.length ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {quickPrompts.map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => onQuickPrompt(prompt)}
                className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-white/75 transition hover:border-emerald-400/20 hover:text-white"
              >
                {prompt}
              </button>
            ))}
          </div>
        ) : null}

        <div className="mt-4 space-y-3">
          {chatMessages.length ? (
            chatMessages.map((msg) => <ChatBubble key={msg.id} msg={msg} />)
          ) : (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4 text-sm text-white/60">
              No messages yet. Ask about the current frame after analysis.
            </div>
          )}
        </div>

        <div className="mt-4">
          <textarea
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={onChatKeyDown}
            rows={3}
            placeholder="Ask about the current frame..."
            className="w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white placeholder:text-white/30 outline-none focus:border-emerald-400/25"
          />
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={onSendChat}
              disabled={chatSending}
              className="rounded-2xl bg-emerald-400 px-4 py-3 text-sm font-semibold text-[#041026] transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {chatSending ? "Sending..." : "Send"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}