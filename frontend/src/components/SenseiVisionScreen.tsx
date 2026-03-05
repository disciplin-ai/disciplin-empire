"use client";

import React, { useMemo, useState } from "react";

/* ========================= TYPES ========================= */

export type VisionSport = "MMA" | "Boxing" | "Wrestling" | "Kickboxing" | "Muay Thai" | "BJJ" | "Sambo";

export type VisionFinding = {
  id: string;
  title: string; // e.g. "Hands drop on exit"
  severity: "LOW" | "MED" | "HIGH";
  evidence: string[]; // short bullets referencing what was seen
  fix: string[]; // short bullets
  drills: string[]; // short bullets
};

export type VisionAnalysis = {
  analysis_id: string;
  created_at: number;
  sport: VisionSport;
  clipLabel: string;
  summary: string; // 1-2 lines
  findings: VisionFinding[];
};

export type VisionStage =
  | "IDLE"
  | "UPLOADING"
  | "SENDING_REQUEST"
  | "WAITING_OPENAI"
  | "PARSING_RESPONSE"
  | "DONE"
  | "ERROR";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function stageLabel(stage: VisionStage) {
  switch (stage) {
    case "UPLOADING":
      return "Uploading…";
    case "SENDING_REQUEST":
      return "Sending…";
    case "WAITING_OPENAI":
      return "Analyzing…";
    case "PARSING_RESPONSE":
      return "Parsing…";
    case "DONE":
      return "Ready";
    case "ERROR":
      return "Error";
    default:
      return "Idle";
  }
}

function stageProgress(stage: VisionStage) {
  switch (stage) {
    case "UPLOADING":
      return 20;
    case "SENDING_REQUEST":
      return 45;
    case "WAITING_OPENAI":
      return 75;
    case "PARSING_RESPONSE":
      return 92;
    case "DONE":
      return 100;
    case "ERROR":
      return 100;
    default:
      return 0;
  }
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
    <span className={cn("inline-flex items-center rounded-full border px-2.5 py-1 text-xs", cls)}>{children}</span>
  );
}

function severityTone(s: VisionFinding["severity"]): "good" | "warn" | "bad" {
  if (s === "LOW") return "good";
  if (s === "MED") return "warn";
  return "bad";
}

function Card({
  title,
  sub,
  right,
  children,
}: {
  title: string;
  sub?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-slate-800/60 bg-slate-950/25 shadow-[0_0_0_1px_rgba(255,255,255,0.02)] backdrop-blur">
      <div className="flex items-start justify-between gap-3 border-b border-slate-800/40 px-5 py-4">
        <div>
          <div className="text-sm font-semibold text-slate-50">{title}</div>
          {sub ? <div className="mt-1 text-xs text-slate-300/70">{sub}</div> : null}
        </div>
        {right}
      </div>
      <div className="px-5 py-5">{children}</div>
    </section>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2 text-sm text-slate-100/90">
      {items.map((b, i) => (
        <li key={i} className="flex gap-2">
          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-300/80" />
          <span>{b}</span>
        </li>
      ))}
    </ul>
  );
}

/* ========================= COMPONENT ========================= */

export default function SenseiVisionScreen(props: {
  sport: VisionSport;
  setSport: (v: VisionSport) => void;

  clipLabel: string;
  setClipLabel: (v: string) => void;

  notes: string;
  setNotes: (v: string) => void;

  file: File | null;
  setFile: (f: File | null) => void;

  stage: VisionStage;
  error: string | null;

  analysis: VisionAnalysis | null;

  onAnalyze: () => void;
  onReset: () => void;

  onSendToSensei: () => void;
  canSendToSensei: boolean;
}) {
  const sports: VisionSport[] = ["MMA", "Boxing", "Wrestling", "Kickboxing", "Muay Thai", "BJJ", "Sambo"];

  const tone =
    props.stage === "ERROR" ? "bad" : props.stage === "DONE" ? "good" : props.stage === "IDLE" ? "neutral" : "warn";

  const rightHeader = (
    <div className="flex items-center gap-2">
      <Badge tone={tone}>{stageLabel(props.stage)}</Badge>
      {props.analysis ? <Badge tone="neutral">{props.analysis.sport}</Badge> : null}
    </div>
  );

  const findings = props.analysis?.findings ?? [];

  const grouped = useMemo(() => {
    const high = findings.filter((f) => f.severity === "HIGH");
    const med = findings.filter((f) => f.severity === "MED");
    const low = findings.filter((f) => f.severity === "LOW");
    return { high, med, low };
  }, [findings]);

  return (
    <main className="min-h-[calc(100vh-72px)] pt-24 pb-10">
      <div className="mx-auto max-w-6xl px-4 md:px-6 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Badge tone="good">SENSEI VISION</Badge>
            <span className="text-sm text-slate-200/80">Analysis only. Evidence → fixes → drills.</span>
          </div>
          <div className="flex items-center gap-2">
            <Badge tone="neutral">No fluff</Badge>
            <Badge tone="neutral">Frame-grounded</Badge>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* LEFT */}
          <div className="lg:col-span-5 space-y-6">
            <Card title="Clip" sub="Upload a short clip or a screenshot sequence. Add context." right={rightHeader}>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-300/70">Sport</label>
                    <select
                      value={props.sport}
                      onChange={(e) => props.setSport(e.target.value as VisionSport)}
                      className="mt-2 w-full rounded-2xl border border-slate-800/70 bg-slate-950/30 px-4 py-3 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-400/20"
                    >
                      {sports.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs text-slate-300/70">Clip label</label>
                    <input
                      value={props.clipLabel}
                      onChange={(e) => props.setClipLabel(e.target.value)}
                      placeholder='e.g. "Round 2 sparring – jab entries"'
                      className="mt-2 w-full rounded-2xl border border-slate-800/70 bg-slate-950/30 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-400/20"
                    />
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-800/60 bg-slate-950/25 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-50">Upload</div>
                      <div className="mt-1 text-xs text-slate-300/70">
                        Best: 10–25s clip. Also works with screenshots if your backend supports it.
                      </div>
                    </div>
                    <Badge tone={props.file ? "good" : "neutral"}>{props.file ? "Ready" : "None"}</Badge>
                  </div>

                  <div className="mt-3">
                    <input
                      type="file"
                      accept="image/*,video/*"
                      onChange={(e) => props.setFile(e.target.files?.[0] ?? null)}
                      className="text-xs text-slate-300"
                    />
                    {props.file ? <div className="mt-2 text-xs text-slate-300/70">Selected: {props.file.name}</div> : null}
                  </div>
                </div>

                <div>
                  <label className="text-xs text-slate-300/70">Notes (optional)</label>
                  <textarea
                    value={props.notes}
                    onChange={(e) => props.setNotes(e.target.value)}
                    rows={4}
                    placeholder='e.g. "I’m trying to enter on a taller opponent. I feel slow on level change."'
                    className="mt-2 w-full resize-none rounded-2xl border border-slate-800/70 bg-slate-950/30 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-400/20"
                  />
                </div>

                <div className="flex gap-3 pt-1">
                  <button
                    onClick={props.onAnalyze}
                    disabled={props.stage !== "IDLE" && props.stage !== "DONE" && props.stage !== "ERROR"}
                    className={cn(
                      "rounded-full px-5 py-3 text-sm font-medium transition",
                      (props.stage === "IDLE" || props.stage === "DONE" || props.stage === "ERROR") && props.file
                        ? "bg-emerald-400/95 text-slate-950 hover:bg-emerald-300 shadow-[0_0_45px_rgba(52,211,153,0.22)]"
                        : "bg-slate-800/60 text-slate-400 cursor-not-allowed"
                    )}
                  >
                    Analyze
                  </button>

                  <button
                    onClick={props.onReset}
                    className="rounded-full border border-slate-700/70 bg-slate-950/30 px-5 py-3 text-sm font-medium text-slate-100 hover:bg-slate-900/40"
                  >
                    Reset
                  </button>

                  <button
                    onClick={props.onSendToSensei}
                    disabled={!props.canSendToSensei}
                    className={cn(
                      "ml-auto rounded-full px-5 py-3 text-sm font-medium transition",
                      props.canSendToSensei
                        ? "bg-white text-slate-950 hover:bg-white/90"
                        : "bg-slate-800/60 text-slate-400 cursor-not-allowed"
                    )}
                    title={props.canSendToSensei ? "Send analysis to Sensei camp control" : "Run analysis first"}
                  >
                    Send to Sensei
                  </button>
                </div>

                {props.error ? (
                  <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-100">
                    Vision error: <span className="font-semibold">{props.error}</span>
                  </div>
                ) : null}

                {props.stage !== "IDLE" ? (
                  <div className="rounded-2xl border border-slate-800/60 bg-slate-950/25 p-5">
                    <div className="text-xs tracking-[0.22em] uppercase text-slate-400/70">ANALYSIS PIPELINE</div>
                    <div className="mt-2 text-sm font-semibold text-slate-50">{stageLabel(props.stage)}</div>
                    <div className="mt-3 h-2 w-full overflow-hidden rounded-full border border-slate-800/60 bg-slate-950/50">
                      <div
                        className={cn("h-full rounded-full bg-emerald-400/80 transition-all duration-300", props.stage === "WAITING_OPENAI" && "animate-pulse")}
                        style={{ width: `${stageProgress(props.stage)}%` }}
                      />
                    </div>
                    <div className="mt-3 text-xs text-slate-300/60">
                      Output should be consistent with what’s in-frame. If it contradicts: tighten prompt + schema + guardrails.
                    </div>
                  </div>
                ) : null}
              </div>
            </Card>
          </div>

          {/* RIGHT */}
          <div className="lg:col-span-7 space-y-6">
            <Card
              title="Findings"
              sub={props.analysis ? "Prioritized technical errors with evidence → fixes → drills." : "Run analysis to populate findings."}
              right={props.analysis ? <Badge tone="good">Complete</Badge> : <Badge tone="neutral">Waiting</Badge>}
            >
              {!props.analysis ? (
                <div className="rounded-2xl border border-dashed border-slate-800/70 bg-slate-950/20 p-6 text-sm text-slate-300/70">
                  Upload → Analyze → Findings appear. Then send to Sensei for camp decisions.
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-slate-800/60 bg-slate-950/25 p-4">
                    <div className="text-xs tracking-[0.22em] uppercase text-slate-400/70">SUMMARY</div>
                    <div className="mt-2 text-sm text-slate-100/90">{props.analysis.summary}</div>
                    <div className="mt-2 text-xs text-slate-300/60">
                      Clip: {props.analysis.clipLabel} · {new Date(props.analysis.created_at).toLocaleString()}
                    </div>
                  </div>

                  {grouped.high.length ? (
                    <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-4">
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-semibold text-slate-50">High severity</div>
                        <Badge tone="bad">{grouped.high.length}</Badge>
                      </div>
                      <div className="mt-3 space-y-3">
                        {grouped.high.map((f) => (
                          <div key={f.id} className="rounded-xl border border-slate-800/60 bg-slate-950/30 p-4">
                            <div className="flex items-center justify-between gap-3">
                              <div className="text-sm font-semibold text-slate-50">{f.title}</div>
                              <Badge tone={severityTone(f.severity)}>{f.severity}</Badge>
                            </div>
                            <div className="mt-3 grid gap-4 md:grid-cols-3">
                              <div>
                                <div className="text-[11px] tracking-[0.22em] uppercase text-slate-400/70">Evidence</div>
                                <div className="mt-2">
                                  <BulletList items={f.evidence} />
                                </div>
                              </div>
                              <div>
                                <div className="text-[11px] tracking-[0.22em] uppercase text-slate-400/70">Fix</div>
                                <div className="mt-2">
                                  <BulletList items={f.fix} />
                                </div>
                              </div>
                              <div>
                                <div className="text-[11px] tracking-[0.22em] uppercase text-slate-400/70">Drills</div>
                                <div className="mt-2">
                                  <BulletList items={f.drills} />
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {/* All findings list (MED/LOW included) */}
                  <div className="rounded-2xl border border-slate-800/60 bg-slate-950/25 p-4">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-semibold text-slate-50">All findings</div>
                      <Badge tone="neutral">{findings.length}</Badge>
                    </div>
                    <div className="mt-3 space-y-3">
                      {findings.map((f) => (
                        <div key={f.id} className="rounded-xl border border-slate-800/60 bg-slate-950/30 p-4">
                          <div className="flex items-center justify-between gap-3">
                            <div className="text-sm font-semibold text-slate-50">{f.title}</div>
                            <Badge tone={severityTone(f.severity)}>{f.severity}</Badge>
                          </div>
                          <div className="mt-3 grid gap-4 md:grid-cols-3">
                            <div>
                              <div className="text-[11px] tracking-[0.22em] uppercase text-slate-400/70">Evidence</div>
                              <div className="mt-2">
                                <BulletList items={f.evidence} />
                              </div>
                            </div>
                            <div>
                              <div className="text-[11px] tracking-[0.22em] uppercase text-slate-400/70">Fix</div>
                              <div className="mt-2">
                                <BulletList items={f.fix} />
                              </div>
                            </div>
                            <div>
                              <div className="text-[11px] tracking-[0.22em] uppercase text-slate-400/70">Drills</div>
                              <div className="mt-2">
                                <BulletList items={f.drills} />
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>
    </main>
  );
}