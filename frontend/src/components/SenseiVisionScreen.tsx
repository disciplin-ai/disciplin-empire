"use client";

import React, { useEffect, useMemo, useRef } from "react";

type Status = "IDLE" | "SENDING" | "WAITING" | "PARSING" | "DONE" | "ERROR";

type Overlay = {
  lines?: Array<{ a: [number, number]; b: [number, number]; label?: string; tone?: "good" | "bad" | "neutral" }>;
  points?: Array<{ p: [number, number]; label?: string; tone?: "good" | "bad" | "neutral" }>;
};

export type VisionResult = {
  ok: true;

  errorCode: string;
  biomechCategory: string;
  severity: number;

  primaryError: string;
  smallestCue: string;

  right: string[];
  wrong: string[];

  hindrance: string;

  drills: string[];
  safety: string[];
  questions: string[];
  tags: string[];

  gradePercent: number;

  overlay: Overlay;

  repetitionCount: number;
  scoreDelta: number | null;
};

type ChatMsg = { id: string; role: "user" | "sensei"; text: string; ts: number };
type Trend = { latest: number; delta: number | null; avg7: number };

type Props = {
  status: Status;
  context: string;
  setContext: (v: string) => void;

  file: File | null;
  setFile: (f: File | null) => void;
  previewUrl: string | null;

  loading: boolean;
  canAnalyze: boolean;
  onAnalyze: () => void;
  onReset: () => void;

  result: VisionResult | null;

  chat: ChatMsg[];
  reply: string;
  setReply: (v: string) => void;
  onSend: (messageOverride?: string) => void;
  onClearChat: () => void;

  storageMode: "SESSION" | "HISTORY";
  setStorageMode: (v: "SESSION" | "HISTORY") => void;

  history: Array<{ id: string; ts: number; score: number; errorCode?: string }>;
  trend?: Trend;

  onClearHistory: () => void;
  onDeleteHistoryItem: (id: string) => void;
};

function Pill({ children, tone }: { children: React.ReactNode; tone: "ok" | "warn" | "bad" | "idle" }) {
  const cls =
    tone === "ok"
      ? "border-emerald-400/30 text-emerald-200 bg-emerald-500/10"
      : tone === "warn"
      ? "border-amber-400/30 text-amber-200 bg-amber-500/10"
      : tone === "bad"
      ? "border-rose-400/30 text-rose-200 bg-rose-500/10"
      : "border-slate-400/20 text-slate-200 bg-slate-500/5";

  return <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs ${cls}`}>{children}</span>;
}

function ShimmerLine() {
  return <div className="h-3 w-full animate-pulse rounded bg-slate-200/5" />;
}

function ShimmerBullets({ n = 4 }: { n?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-slate-200/10 animate-pulse" />
          <div className="flex-1">
            <ShimmerLine />
          </div>
        </div>
      ))}
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.02),0_18px_80px_rgba(0,0,0,0.35)]">
      <div className="mb-2 text-xs uppercase tracking-wider text-slate-300/70">{title}</div>
      {children}
    </div>
  );
}

function bulletList(items: string[]) {
  const safe = Array.isArray(items) ? items : [];
  return (
    <ul className="space-y-2 text-sm text-slate-50/90">
      {safe.map((x, i) => (
        <li key={i} className="flex gap-2">
          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400/80" />
          <span>{x}</span>
        </li>
      ))}
    </ul>
  );
}

function drawOverlay(canvas: HTMLCanvasElement, overlay: Overlay) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const w = canvas.width;
  const h = canvas.height;

  ctx.clearRect(0, 0, w, h);

  const toneColor = (t?: string) => {
    if (t === "bad") return "rgba(244,63,94,0.85)";
    if (t === "good") return "rgba(52,211,153,0.85)";
    return "rgba(148,163,184,0.7)";
  };

  for (const l of overlay?.lines ?? []) {
    const [ax, ay] = l.a;
    const [bx, by] = l.b;
    ctx.strokeStyle = toneColor(l.tone);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(ax * w, ay * h);
    ctx.lineTo(bx * w, by * h);
    ctx.stroke();

    if (l.label) {
      ctx.font = "12px ui-sans-serif, system-ui";
      ctx.fillStyle = "rgba(226,232,240,0.92)";
      ctx.fillText(l.label, ax * w + 6, ay * h - 6);
    }
  }

  for (const p of overlay?.points ?? []) {
    const [x, y] = p.p;
    ctx.fillStyle = toneColor(p.tone);
    ctx.beginPath();
    ctx.arc(x * w, y * h, 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "rgba(15,23,42,0.75)";
    ctx.lineWidth = 2;
    ctx.stroke();

    if (p.label) {
      ctx.font = "12px ui-sans-serif, system-ui";
      ctx.fillStyle = "rgba(226,232,240,0.92)";
      ctx.fillText(p.label, x * w + 10, y * h + 4);
    }
  }
}

function formatTime(ts: number) {
  try {
    const d = new Date(ts);
    return d.toLocaleString(undefined, { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

export default function SenseiVisionScreen(props: Props) {
  const {
    status,
    context,
    setContext,
    file,
    setFile,
    previewUrl,
    loading,
    canAnalyze,
    onAnalyze,
    onReset,
    result,
    chat,
    reply,
    setReply,
    onSend,
    onClearChat,
    storageMode,
    setStorageMode,
    history,
    trend,
    onClearHistory,
    onDeleteHistoryItem,
  } = props;

  const safeTrend: Trend = trend ?? { latest: 0, delta: null, avg7: 0 };
  const safeChat = Array.isArray(chat) ? chat : [];
  const safeHistory = Array.isArray(history) ? history : [];

  const score = result?.gradePercent ?? 0;
  const tone: "ok" | "warn" | "bad" | "idle" =
    loading ? "idle" : score >= 70 ? "ok" : score >= 40 ? "warn" : score > 0 ? "bad" : "idle";

  const statusLabel =
    status === "IDLE"
      ? "Idle"
      : status === "SENDING"
      ? "Sending"
      : status === "WAITING"
      ? "Analyzing"
      : status === "PARSING"
      ? "Parsing"
      : status === "DONE"
      ? "Done"
      : "Error";

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const overlay = result?.overlay;

  useEffect(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;

    const sync = () => {
      const rect = img.getBoundingClientRect();
      const dpr = Math.max(1, Math.floor(window.devicePixelRatio || 1));
      canvas.width = Math.floor(rect.width * dpr);
      canvas.height = Math.floor(rect.height * dpr);
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;

      const ctx = canvas.getContext("2d");
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      if (overlay) drawOverlay(canvas, overlay);
      else {
        const ctx2 = canvas.getContext("2d");
        if (ctx2) ctx2.clearRect(0, 0, canvas.width, canvas.height);
      }
    };

    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(img);
    window.addEventListener("resize", sync);

    return () => {
      ro.disconnect();
      window.removeEventListener("resize", sync);
    };
  }, [overlay, previewUrl]);

  const badgeLine = useMemo(() => {
    if (!result) return null;
    const rep = result.repetitionCount ?? 0;
    const delta = result.scoreDelta;
    const deltaText = delta == null ? "—" : delta >= 0 ? `+${delta}` : `${delta}`;
    return `${result.errorCode} · rep:${rep} · Δ:${deltaText} · sev:${result.severity}`;
  }, [result]);

  const analyzeReady = !loading && canAnalyze;

  return (
    <div className="relative">
      {/* Background */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-slate-950" />
        <div className="absolute inset-0 opacity-[0.16] [background-image:linear-gradient(to_right,rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.06)_1px,transparent_1px)] [background-size:42px_42px]" />
        <div className="absolute -top-40 left-10 h-[420px] w-[420px] rounded-full bg-emerald-500/20 blur-[120px]" />
        <div className="absolute top-24 right-10 h-[420px] w-[420px] rounded-full bg-cyan-500/10 blur-[120px]" />
        <div className="absolute bottom-0 left-1/3 h-[520px] w-[520px] rounded-full bg-emerald-400/10 blur-[140px]" />
      </div>

      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-6 flex items-start justify-between">
          <div>
            <div className="text-xs tracking-widest text-emerald-300/70">SENSEI VISION</div>
            <h1 className="mt-2 text-3xl font-semibold text-slate-50">Freeze. Grade. Fix.</h1>
            <p className="mt-1 text-sm text-slate-300/70">Upload a frame. Get R/A/G + %. One fix. Drills. What it costs if ignored.</p>
            {badgeLine ? <div className="mt-2 text-xs text-slate-300/60">{badgeLine}</div> : null}
          </div>

          <div className="flex items-center gap-2">
            <Pill tone={tone}>
              <span className="h-2 w-2 rounded-full bg-current opacity-60" />
              {statusLabel}
            </Pill>
            <Pill tone={tone}>
              {tone === "idle" ? "—" : tone === "ok" ? "GREEN" : tone === "warn" ? "AMBER" : "RED"} ·{" "}
              {tone === "idle" ? "—" : `${score}%`}
            </Pill>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[380px_1fr]">
          {/* Left */}
          <div className="rounded-3xl border border-white/10 bg-white/[0.045] p-5 shadow-[0_18px_80px_rgba(0,0,0,0.35)]">
            <div className="mb-3 text-sm font-semibold text-slate-50">Input</div>
            <div className="text-xs text-slate-300/70">Age / level / ruleset / injuries / goal — then upload the frame.</div>

            <div className="mt-4 text-xs text-slate-300/70">Describe the moment</div>
            <textarea
              value={context}
              onChange={(e) => setContext(e.target.value)}
              placeholder="Example: When I try to do a Russian tie snap, I always get sprawled..."
              className="mt-2 h-28 w-full resize-none rounded-2xl border border-white/10 bg-black/25 p-3 text-sm text-slate-50 outline-none placeholder:text-slate-400/60"
            />

            <div className="mt-4 text-xs text-slate-300/70">Frame upload</div>
            <div className="mt-2 flex items-center gap-2 rounded-2xl border border-white/10 bg-black/15 p-3">
              <label className="cursor-pointer rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-100 hover:bg-white/10">
                Choose file
                <input type="file" accept="image/*" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              </label>
              <div className="truncate text-xs text-slate-300/80">{file?.name ?? "No file selected"}</div>
            </div>

            <div className="mt-3 text-xs text-slate-400/60">Photos now. Videos later. Mention injuries — intensity scales down.</div>

            <div className="mt-4 flex gap-3">
              <button
                onClick={onAnalyze}
                disabled={!canAnalyze}
                className={[
                  "relative flex-1 rounded-2xl px-4 py-3 text-sm font-semibold text-slate-950 transition-all",
                  "bg-emerald-400/90 disabled:opacity-40",
                  analyzeReady
                    ? "shadow-[0_0_0_1px_rgba(52,211,153,0.55),0_18px_70px_rgba(16,185,129,0.28)]"
                    : "shadow-none",
                ].join(" ")}
              >
                {loading ? "Analyzing..." : "Analyze"}
                {analyzeReady ? (
                  <>
                    <span className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-emerald-300/25" />
                    <span className="pointer-events-none absolute -inset-6 -z-10 rounded-[28px] bg-emerald-400/20 blur-2xl" />
                  </>
                ) : null}
              </button>

              <button
                onClick={onReset}
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-100 hover:bg-white/10"
              >
                Reset
              </button>
            </div>

            <div className="mt-4 rounded-2xl border border-white/10 bg-black/15 p-3 text-xs text-slate-300/80">
              Rule: one correction at a time. Apply it. Then upload again.
            </div>

            <div className="mt-4 grid grid-cols-3 gap-3">
              <div className="rounded-2xl border border-white/10 bg-black/15 p-3">
                <div className="text-[11px] text-slate-400/70">Latest</div>
                <div className="mt-1 text-lg font-semibold text-slate-50">{safeTrend.latest}%</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/15 p-3">
                <div className="text-[11px] text-slate-400/70">Δ vs prev</div>
                <div className="mt-1 text-lg font-semibold text-slate-50">{safeTrend.delta ?? "—"}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/15 p-3">
                <div className="text-[11px] text-slate-400/70">Avg (7)</div>
                <div className="mt-1 text-lg font-semibold text-slate-50">{safeTrend.avg7}</div>
              </div>
            </div>

            {/* HISTORY UI */}
            <div className="mt-5 rounded-2xl border border-white/10 bg-black/15 p-3">
              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold text-slate-100">History</div>
                <button
                  onClick={onClearHistory}
                  className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-slate-100 hover:bg-white/10"
                >
                  Clear
                </button>
              </div>

              <div className="mt-3 max-h-48 space-y-2 overflow-auto pr-1">
                {safeHistory.length ? (
                  safeHistory.map((h) => (
                    <div key={h.id} className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 px-3 py-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <div className="text-sm font-semibold text-slate-50">{h.score}%</div>
                          <div className="truncate text-[11px] text-slate-300/70">{h.errorCode || "—"}</div>
                        </div>
                        <div className="text-[11px] text-slate-400/60">{formatTime(h.ts)}</div>
                      </div>

                      <button
                        onClick={() => onDeleteHistoryItem(h.id)}
                        className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-slate-100 hover:bg-white/10"
                        title="Delete"
                      >
                        ✕
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="text-xs text-slate-400/60">No sessions yet.</div>
                )}
              </div>

              <div className="mt-2 text-[11px] text-slate-400/60">
              Streaks, trend, and repeat penalties get real over time.
              </div>
            </div>
          </div>

          {/* Right */}
          <div className="space-y-6">
            <div className="rounded-3xl border border-white/10 bg-white/[0.045] p-4 shadow-[0_18px_80px_rgba(0,0,0,0.35)]">
              <div className="mb-2 text-xs uppercase tracking-wider text-slate-300/70">Frame + overlay</div>
              {previewUrl ? (
                <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/20">
                  <img ref={imgRef} src={previewUrl} alt="Frame" className="block w-full select-none" />
                  <canvas ref={canvasRef} className="pointer-events-none absolute inset-0" />
                </div>
              ) : (
                <div className="rounded-2xl border border-white/10 bg-black/15 p-4 text-sm text-slate-400/70">Upload a frame to see overlays.</div>
              )}
              <div className="mt-2 text-xs text-slate-400/60">Overlays are generated per frame to show what matters (angle / posture / balance).</div>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Card title="Primary error">
                {loading ? <ShimmerBullets n={2} /> : result ? <div className="text-sm text-slate-50/90">{result.primaryError}</div> : <div className="text-sm text-slate-400/70">—</div>}
              </Card>
              <Card title="Fix cue">
                {loading ? <ShimmerBullets n={2} /> : result ? <div className="text-sm text-slate-50/90">{result.smallestCue}</div> : <div className="text-sm text-slate-400/70">—</div>}
              </Card>
              <Card title="What you did right">
                {loading ? <ShimmerBullets n={4} /> : result ? bulletList(result.right) : <div className="text-sm text-slate-400/70">—</div>}
              </Card>
              <Card title="What you did wrong (details)">
                {loading ? <ShimmerBullets n={5} /> : result ? bulletList(result.wrong) : <div className="text-sm text-slate-400/70">—</div>}
              </Card>
            </div>

            <Card title="What it costs if you ignore it">
              {loading ? <ShimmerLine /> : result ? <div className="text-sm text-slate-50/90">{result.hindrance}</div> : <div className="text-sm text-slate-400/70">—</div>}
            </Card>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Card title="Drills">
                {loading ? <ShimmerBullets n={4} /> : result ? bulletList(result.drills) : <div className="text-sm text-slate-400/70">—</div>}
              </Card>
              <Card title="Safety">
                {loading ? (
                  <ShimmerBullets n={3} />
                ) : result ? (
                  result.safety?.length ? bulletList(result.safety) : <div className="text-sm text-slate-400/70">—</div>
                ) : (
                  <div className="text-sm text-slate-400/70">—</div>
                )}
              </Card>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/[0.045] p-5 shadow-[0_18px_80px_rgba(0,0,0,0.35)]">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-slate-50">Tighten</div>
                  <div className="text-xs text-slate-300/70">One question. One answer. One variable.</div>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={storageMode}
                    onChange={(e) => setStorageMode(e.target.value as any)}
                    className="rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-xs text-slate-100 outline-none"
                  >
                    <option value="SESSION">Session</option>
                    <option value="HISTORY">History</option>
                  </select>
                  <button onClick={onClearChat} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-100 hover:bg-white/10">
                    Clear
                  </button>
                </div>
              </div>

              <div className="mt-4 max-h-64 space-y-3 overflow-auto rounded-2xl border border-white/10 bg-black/15 p-3">
                {safeChat.map((m) => (
                  <div key={m.id} className="rounded-2xl border border-white/10 bg-black/20 p-3">
                    <div className="text-[10px] uppercase tracking-wider text-slate-300/60">{m.role === "user" ? "YOU" : "SENSEI"}</div>
                    <div className="mt-1 whitespace-pre-wrap text-sm text-slate-50/90">{m.text}</div>
                  </div>
                ))}
                {!safeChat.length ? <div className="text-xs text-slate-400/60">—</div> : null}
              </div>

              <div className="mt-4 flex gap-3">
                <input
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  placeholder="Ask a specific question..."
                  className="flex-1 rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-slate-50 outline-none placeholder:text-slate-400/60"
                />
                <button
                  onClick={() => onSend()}
                  disabled={loading || !reply.trim() || !result}
                  className="rounded-2xl bg-emerald-400/90 px-5 py-3 text-sm font-semibold text-slate-900 disabled:opacity-40"
                >
                  Send
                </button>
              </div>

              <div className="mt-3 text-[11px] text-slate-400/60">If your question has two variables, Sensei will force you to pick one.</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}