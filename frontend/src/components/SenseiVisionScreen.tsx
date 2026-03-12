"use client";

import React from "react";
import type { VisionAnalysis } from "@/lib/senseiVisionTypes";
import type { VisionBuildStage, VisionChatMessage } from "@/components/SenseiVisionClient";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function Badge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "good" | "warn" | "bad";
}) {
  const cls =
    tone === "good"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
      : tone === "warn"
      ? "border-amber-500/30 bg-amber-500/10 text-amber-200"
      : tone === "bad"
      ? "border-rose-500/30 bg-rose-500/10 text-rose-200"
      : "border-slate-700/60 bg-slate-900/30 text-slate-200/90";

  return (
    <span className={cn("inline-flex items-center rounded-full border px-2.5 py-1 text-xs", cls)}>
      {children}
    </span>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2 text-sm text-slate-100/90">
      {items.map((item: string, i: number) => (
        <li key={i} className="flex gap-2">
          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-300/80" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function stageLabel(stage: VisionBuildStage) {
  switch (stage) {
    case "READING_FRAME":
      return "Reading frame";
    case "DETECTING_DISCIPLINE":
      return "Detecting discipline";
    case "DETECTING_TECHNIQUE":
      return "Detecting technique";
    case "RESTRICTING_FIXES":
      return "Restricting fix family";
    case "BUILDING_CORRECTION":
      return "Building correction";
    case "DONE":
      return "Ready";
    case "ERROR":
      return "Error";
    case "IDLE":
    default:
      return "Idle";
  }
}

function stageProgress(stage: VisionBuildStage) {
  switch (stage) {
    case "READING_FRAME":
      return 18;
    case "DETECTING_DISCIPLINE":
      return 38;
    case "DETECTING_TECHNIQUE":
      return 58;
    case "RESTRICTING_FIXES":
      return 78;
    case "BUILDING_CORRECTION":
      return 94;
    case "DONE":
      return 100;
    case "ERROR":
      return 100;
    case "IDLE":
    default:
      return 0;
  }
}

function BuildRitual({ stage }: { stage: VisionBuildStage }) {
  const steps: Array<{ key: VisionBuildStage; label: string }> = [
    { key: "READING_FRAME", label: "Reading uploaded frame" },
    { key: "DETECTING_DISCIPLINE", label: "Detecting discipline" },
    { key: "DETECTING_TECHNIQUE", label: "Detecting technique" },
    { key: "RESTRICTING_FIXES", label: "Locking allowed fix family" },
    { key: "BUILDING_CORRECTION", label: "Building correction + drills" },
  ];

  const currentIndex = steps.findIndex((s) => s.key === stage);

  return (
    <div className="rounded-2xl border border-slate-800/60 bg-slate-950/25 p-5">
      <div className="text-[11px] tracking-[0.28em] uppercase text-emerald-300/80">
        Sensei Vision
      </div>
      <div className="mt-2 text-sm font-semibold text-slate-50">{stageLabel(stage)}…</div>

      <div className="mt-4 h-2 w-full overflow-hidden rounded-full border border-slate-800/60 bg-slate-950/60">
        <div
          className="h-full rounded-full bg-emerald-400/80 transition-all duration-500"
          style={{ width: `${stageProgress(stage)}%` }}
        />
      </div>

      <div className="mt-4 space-y-2">
        {steps.map((step, idx) => {
          const done = idx < currentIndex;
          const active = idx === currentIndex;

          return (
            <div
              key={step.key}
              className={cn(
                "flex items-center gap-3 rounded-xl border px-3 py-2 text-sm transition",
                done
                  ? "border-emerald-500/20 bg-emerald-500/5 text-emerald-100"
                  : active
                  ? "border-amber-500/20 bg-amber-500/5 text-amber-100"
                  : "border-slate-800/60 bg-slate-950/30 text-slate-400"
              )}
            >
              <span
                className={cn(
                  "inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold",
                  done
                    ? "bg-emerald-400/20 text-emerald-200"
                    : active
                    ? "bg-amber-400/20 text-amber-200 animate-pulse"
                    : "bg-slate-800 text-slate-400"
                )}
              >
                {done ? "✓" : idx + 1}
              </span>
              <span>{step.label}</span>
            </div>
          );
        })}
      </div>

      <div className="mt-3 text-xs text-slate-300/60">
        Vision should classify the frame before giving any correction.
      </div>
    </div>
  );
}

export default function SenseiVisionScreen(props: {
  sport: string;
  setSport: (v: string) => void;
  clipLabel: string;
  setClipLabel: (v: string) => void;
  notes: string;
  setNotes: (v: string) => void;
  selectedFileName: string;
  onFileChange: (file: File | null) => void;
  onAnalyze: () => void;
  onReset: () => void;
  running: boolean;
  buildStage: VisionBuildStage;
  error: string | null;
  analysis: VisionAnalysis | null;
  chatInput: string;
  setChatInput: (v: string) => void;
  chatSending: boolean;
  chatMessages: VisionChatMessage[];
  onSendChat: () => void;
  onChatKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  quickPrompts: string[];
  onQuickPrompt: (prompt: string) => void;
}) {
  const analysis = props.analysis;

  const confidenceTone =
    analysis?.confidence === "high"
      ? "good"
      : analysis?.confidence === "med"
      ? "warn"
      : analysis?.confidence === "low"
      ? "bad"
      : "neutral";

  const allowedFixFamily = Array.isArray(analysis?.allowed_fix_family)
    ? analysis.allowed_fix_family
    : [];

  const whatYouDidRight = Array.isArray(analysis?.what_you_did_right)
    ? analysis.what_you_did_right
    : [];

  const drills = Array.isArray(analysis?.drills) ? analysis.drills : [];
  const safety = Array.isArray(analysis?.safety) ? analysis.safety : [];
  const findings = Array.isArray(analysis?.findings) ? analysis.findings : [];

  return (
    <main className="min-h-[calc(100vh-72px)] pt-24 pb-10">
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Badge tone="good">SENSEI VISION</Badge>
            <span className="text-sm text-slate-200/80">
              Frame-grounded analysis. Detect → restrict → fix.
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Badge tone={props.running ? "warn" : analysis ? "good" : "neutral"}>
              {props.running ? stageLabel(props.buildStage) : analysis ? "Ready" : "Idle"}
            </Badge>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <section className="lg:col-span-5 rounded-3xl border border-slate-800/60 bg-slate-950/25">
            <div className="border-b border-slate-800/40 px-5 py-4">
              <div className="text-sm font-semibold text-slate-50">Input</div>
              <div className="mt-1 text-xs text-slate-300/70">
                Upload a frame. Vision must classify the technique before giving a fix.
              </div>
            </div>

            <div className="space-y-4 px-5 py-5">
              <div>
                <label className="text-xs text-slate-300/70">Sport</label>
                <select
                  value={props.sport}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => props.setSport(e.target.value)}
                  className="mt-2 w-full rounded-2xl border border-slate-800/70 bg-slate-950/30 px-4 py-3 text-sm text-slate-100"
                >
                  <option>MMA</option>
                  <option>Striking</option>
                  <option>Wrestling</option>
                  <option>Grappling</option>
                  <option>Kickboxing</option>
                  <option>Muay Thai</option>
                  <option>Boxing</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-slate-300/70">Clip label</label>
                <input
                  value={props.clipLabel}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => props.setClipLabel(e.target.value)}
                  placeholder='e.g. "High kick form check"'
                  className="mt-2 w-full rounded-2xl border border-slate-800/70 bg-slate-950/30 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500"
                />
              </div>

              <div>
                <label className="text-xs text-slate-300/70">Notes</label>
                <textarea
                  value={props.notes}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => props.setNotes(e.target.value)}
                  rows={4}
                  placeholder='e.g. "Check my high kick form. I want balance, hip turn, and guard feedback."'
                  className="mt-2 w-full resize-none rounded-2xl border border-slate-800/70 bg-slate-950/30 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500"
                />
              </div>

              <div>
                <label className="text-xs text-slate-300/70">Frame upload</label>
                <div className="mt-2 rounded-2xl border border-slate-800/70 bg-slate-950/30 p-4">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      props.onFileChange(e.target.files?.[0] ?? null)
                    }
                    className="text-sm text-slate-200"
                  />
                  <div className="mt-2 text-xs text-slate-400">
                    {props.selectedFileName || "No file selected"}
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-1">
                <button
                  onClick={props.onAnalyze}
                  disabled={props.running}
                  className={cn(
                    "rounded-full px-5 py-3 text-sm font-medium transition",
                    !props.running
                      ? "bg-emerald-400/95 text-slate-950 hover:bg-emerald-300"
                      : "bg-slate-800/60 text-slate-400 cursor-not-allowed"
                  )}
                >
                  {props.running ? stageLabel(props.buildStage) : "Analyze"}
                </button>

                <button
                  onClick={props.onReset}
                  disabled={props.running}
                  className="rounded-full border border-slate-700/70 bg-slate-950/30 px-5 py-3 text-sm font-medium text-slate-100 hover:bg-slate-900/40"
                >
                  Reset
                </button>
              </div>

              {props.error ? (
                <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-100 whitespace-pre-wrap">
                  {props.error}
                </div>
              ) : null}
            </div>
          </section>

          <section className="lg:col-span-7 space-y-6">
            <div className="rounded-3xl border border-slate-800/60 bg-slate-950/25">
              <div className="border-b border-slate-800/40 px-5 py-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-50">Analysis</div>
                    <div className="mt-1 text-xs text-slate-300/70">
                      Vision must detect the technique before giving any fix.
                    </div>
                  </div>

                  {analysis ? (
                    <div className="flex items-center gap-2">
                      <Badge tone="good">{analysis.discipline_detected || "unknown"}</Badge>
                      <Badge tone={confidenceTone}>{analysis.confidence || "low"}</Badge>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="px-5 py-5">
                {props.running ? (
                  <BuildRitual stage={props.buildStage} />
                ) : !analysis ? (
                  <div className="rounded-2xl border border-dashed border-slate-800/70 bg-slate-950/20 p-6 text-sm text-slate-300/70">
                    Upload a frame and run analysis.
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-3">
                      <div className="rounded-2xl border border-slate-800/60 bg-slate-950/25 p-4">
                        <div className="text-[11px] tracking-[0.22em] uppercase text-slate-400/70">
                          Discipline detected
                        </div>
                        <div className="mt-2 text-sm font-semibold text-slate-50">
                          {analysis.discipline_detected || "unknown"}
                        </div>
                      </div>

                      <div className="rounded-2xl border border-slate-800/60 bg-slate-950/25 p-4">
                        <div className="text-[11px] tracking-[0.22em] uppercase text-slate-400/70">
                          Technique detected
                        </div>
                        <div className="mt-2 text-sm font-semibold text-slate-50">
                          {analysis.technique_detected || "unknown"}
                        </div>
                      </div>

                      <div className="rounded-2xl border border-slate-800/60 bg-slate-950/25 p-4">
                        <div className="text-[11px] tracking-[0.22em] uppercase text-slate-400/70">
                          Confidence
                        </div>
                        <div className="mt-2">
                          <Badge tone={confidenceTone}>{analysis.confidence || "low"}</Badge>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                      <div className="text-[11px] tracking-[0.22em] uppercase text-emerald-200/80">
                        Allowed fix family
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {allowedFixFamily.length ? (
                          allowedFixFamily.map((x: string, i: number) => (
                            <Badge key={i} tone="good">
                              {x}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-sm text-slate-400">No allowed fix family returned.</span>
                        )}
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="rounded-2xl border border-slate-800/60 bg-slate-950/25 p-4">
                        <div className="text-[11px] tracking-[0.22em] uppercase text-slate-400/70">
                          What you did right
                        </div>
                        <div className="mt-2">
                          {whatYouDidRight.length ? (
                            <BulletList items={whatYouDidRight} />
                          ) : (
                            <span className="text-sm text-slate-400">No positives returned.</span>
                          )}
                        </div>
                      </div>

                      <div className="rounded-2xl border border-slate-800/60 bg-slate-950/25 p-4">
                        <div className="text-[11px] tracking-[0.22em] uppercase text-slate-400/70">
                          Primary error
                        </div>
                        <div className="mt-2 text-sm font-semibold text-slate-50">
                          {analysis.primary_error || "No primary error returned."}
                        </div>
                        <div className="mt-3 text-sm text-slate-300/80">
                          {analysis.why_it_matters || "No explanation returned."}
                        </div>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4">
                      <div className="text-[11px] tracking-[0.22em] uppercase text-amber-200/80">
                        One fix
                      </div>
                      <div className="mt-2 text-sm font-semibold text-slate-50">
                        {analysis.one_fix || "No fix returned."}
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="rounded-2xl border border-slate-800/60 bg-slate-950/25 p-4">
                        <div className="text-[11px] tracking-[0.22em] uppercase text-slate-400/70">
                          Drills
                        </div>
                        <div className="mt-2">
                          {drills.length ? (
                            <BulletList items={drills} />
                          ) : (
                            <span className="text-sm text-slate-400">No drills returned.</span>
                          )}
                        </div>
                      </div>

                      <div className="rounded-2xl border border-slate-800/60 bg-slate-950/25 p-4">
                        <div className="text-[11px] tracking-[0.22em] uppercase text-slate-400/70">
                          Safety
                        </div>
                        <div className="mt-2">
                          {safety.length ? (
                            <BulletList items={safety} />
                          ) : (
                            <span className="text-sm text-slate-400">No safety notes returned.</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-slate-800/60 bg-slate-950/25 p-4">
                      <div className="text-[11px] tracking-[0.22em] uppercase text-slate-400/70">
                        Findings
                      </div>
                      <div className="mt-3 space-y-3">
                        {findings.length ? (
                          findings.map((f, i: number) => (
                            <div
                              key={f.id || i}
                              className="rounded-xl border border-slate-800/60 bg-slate-950/30 p-3"
                            >
                              <div className="flex items-center justify-between gap-3">
                                <div className="text-sm font-semibold text-slate-50">{f.title}</div>
                                <Badge
                                  tone={
                                    f.severity === "HIGH"
                                      ? "bad"
                                      : f.severity === "MEDIUM"
                                      ? "warn"
                                      : "good"
                                  }
                                >
                                  {f.severity}
                                </Badge>
                              </div>
                              <div className="mt-2 text-sm text-slate-300/80">{f.detail}</div>
                            </div>
                          ))
                        ) : (
                          <span className="text-sm text-slate-400">No findings returned.</span>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-3xl border border-slate-800/60 bg-slate-950/25">
              <div className="border-b border-slate-800/40 px-5 py-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-50">Ask about this frame</div>
                    <div className="mt-1 text-xs text-slate-300/70">
                      Short evaluator chat only. This is not the full Sensei camp chat.
                    </div>
                  </div>
                  <Badge tone={analysis ? "good" : "warn"}>
                    {analysis ? "Frame unlocked" : "Run analysis first"}
                  </Badge>
                </div>
              </div>

              <div className="px-5 py-5">
                <div className="flex flex-wrap gap-2">
                  {props.quickPrompts.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      disabled={!analysis || props.chatSending}
                      onClick={() => props.onQuickPrompt(prompt)}
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-xs transition",
                        analysis && !props.chatSending
                          ? "border-slate-700/70 bg-slate-950/30 text-slate-200 hover:bg-slate-900/40"
                          : "border-slate-800/70 bg-slate-950/20 text-slate-500 cursor-not-allowed"
                      )}
                    >
                      {prompt}
                    </button>
                  ))}
                </div>

                <div className="mt-4 max-h-[260px] overflow-y-auto rounded-2xl border border-slate-800/60 bg-slate-950/25 p-4 space-y-3">
                  {props.chatMessages.map((m) => (
                    <div
                      key={m.id}
                      className={cn(
                        "rounded-2xl border p-3",
                        m.role === "user"
                          ? "border-emerald-500/20 bg-emerald-500/10"
                          : m.role === "vision"
                          ? "border-slate-800/70 bg-slate-950/35"
                          : "border-amber-500/20 bg-amber-500/10"
                      )}
                    >
                      <div className="mb-1 text-[11px] tracking-[0.22em] uppercase text-slate-400/70">
                        {m.role === "user" ? "You" : m.role === "vision" ? "Vision" : "System"}
                      </div>
                      <div className="whitespace-pre-wrap text-sm text-slate-100/90">{m.text}</div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 flex gap-2">
                  <textarea
                    value={props.chatInput}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => props.setChatInput(e.target.value)}
                    onKeyDown={props.onChatKeyDown}
                    disabled={!analysis}
                    rows={2}
                    placeholder={analysis ? "Ask about this frame…" : "Run analysis first…"}
                    className="w-full resize-none rounded-2xl border border-slate-800/70 bg-slate-950/30 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-400/20 disabled:opacity-60"
                  />
                  <button
                    onClick={props.onSendChat}
                    disabled={!analysis || !props.chatInput.trim() || props.chatSending}
                    className={cn(
                      "rounded-2xl px-5 text-sm font-medium transition",
                      analysis && props.chatInput.trim() && !props.chatSending
                        ? "bg-emerald-400/95 text-slate-950 hover:bg-emerald-300"
                        : "bg-slate-800/60 text-slate-400 cursor-not-allowed"
                    )}
                  >
                    {props.chatSending ? "…" : "Send"}
                  </button>
                </div>

                <div className="mt-2 text-xs text-slate-300/60">
                  Keep it frame-specific: ask why, what first, which drill, or what to focus on next rep.
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}