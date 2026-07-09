"use client";

import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  LineElement,
  CategoryScale,
  LinearScale,
  PointElement,
  Tooltip,
  Filler,
} from "chart.js";

ChartJS.register(
  LineElement,
  CategoryScale,
  LinearScale,
  PointElement,
  Tooltip,
  Filler
);

export type FuelHistoryPoint = {
  day: string;
  fuel_score: number | null;
  created_at: string;
};

function cleanScore(value: number | null) {
  if (typeof value !== "number" || Number.isNaN(value)) return null;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function scoreTone(score: number | null) {
  if (score === null) return "neutral";
  if (score >= 75) return "good";
  if (score >= 45) return "warn";
  return "bad";
}

function formatDay(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function TrendStat({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "good" | "warn" | "bad" | "neutral";
}) {
  const color =
    tone === "good"
      ? "text-emerald-300"
      : tone === "warn"
        ? "text-amber-300"
        : tone === "bad"
          ? "text-rose-300"
          : "text-white/70";

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] px-3 py-3">
      <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-white/30">
        {label}
      </p>

      <p className={`mt-1 font-mono text-lg font-bold ${color}`}>{value}</p>
    </div>
  );
}

export default function FuelScoreChart({
  data,
}: {
  data: FuelHistoryPoint[];
}) {
   const sortedData = [...data].sort(
  (a, b) =>
    new Date(a.created_at || a.day).getTime() -
    new Date(b.created_at || b.day).getTime()
);

  const validScores = sortedData
    .map((d) => cleanScore(d.fuel_score))
    .filter((v): v is number => typeof v === "number");

  if (!sortedData.length || !validScores.length) {
    return (
      <div className="relative flex h-56 items-center justify-center overflow-hidden rounded-3xl border border-white/[0.06] bg-gradient-to-br from-[#071120] via-[#050b16] to-[#020611]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(16,185,129,0.08),transparent_58%)]" />

        <div className="relative text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04]">
            <svg
              className="h-6 w-6 text-white/30"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 13.125A1.125 1.125 0 0 1 4.125 12h2.25A1.125 1.125 0 0 1 7.5 13.125v6.75A1.125 1.125 0 0 1 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75Zm6.75-4.5A1.125 1.125 0 0 1 10.875 7.5h2.25a1.125 1.125 0 0 1 1.125 1.125v11.25A1.125 1.125 0 0 1 13.125 21h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625Zm6.75-4.5A1.125 1.125 0 0 1 17.625 3h2.25A1.125 1.125 0 0 1 21 4.125v15.75A1.125 1.125 0 0 1 19.875 21h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z"
              />
            </svg>
          </div>

          <p className="mt-4 text-sm font-semibold text-white/65">
            No fuel trend yet
          </p>

          <p className="mt-1 text-xs text-white/35">
            Analyze meals to build score history.
          </p>
        </div>
      </div>
    );
  }

  const latest = validScores[validScores.length - 1] ?? null;
  const previous =
    validScores.length > 1 ? validScores[validScores.length - 2] : null;

  const delta =
    latest !== null && previous !== null ? latest - previous : null;

  const average =
    validScores.length > 0
      ? Math.round(
          validScores.reduce((sum, value) => sum + value, 0) /
            validScores.length
        )
      : null;

  const latestTone = scoreTone(latest);
  const averageTone = scoreTone(average);

  const lineColor =
    latestTone === "good"
      ? "#34d399"
      : latestTone === "warn"
        ? "#fbbf24"
        : latestTone === "bad"
          ? "#f43f5e"
          : "#ffffff";

  const labels = sortedData.map((d) => formatDay(d.day));
  const scores = sortedData.map((d) => cleanScore(d.fuel_score));

  const chartData = {
    labels,
    datasets: [
      {
        label: "Fuel Score",
        data: scores,
        borderWidth: 2,
        pointRadius: 3,
        pointHoverRadius: 6,
        tension: 0.42,
        spanGaps: true,
        borderColor: lineColor,
        backgroundColor:
          latestTone === "good"
            ? "rgba(52,211,153,0.09)"
            : latestTone === "warn"
              ? "rgba(251,191,36,0.09)"
              : "rgba(244,63,94,0.09)",
        pointBackgroundColor: lineColor,
        pointBorderColor: "#020611",
        pointBorderWidth: 2,
        fill: true,
      },
    ],
  };

  const options: any = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      intersect: false,
      mode: "index",
    },
    scales: {
      y: {
        min: 0,
        max: 100,
        ticks: {
          color: "rgba(255,255,255,0.32)",
          font: {
            size: 10,
            weight: "600",
          },
          stepSize: 25,
          padding: 8,
        },
        grid: {
          color: "rgba(255,255,255,0.045)",
          drawBorder: false,
        },
        border: {
          display: false,
        },
      },
      x: {
        ticks: {
          color: "rgba(255,255,255,0.32)",
          font: {
            size: 10,
            weight: "600",
          },
          padding: 8,
          maxRotation: 0,
        },
        grid: {
          display: false,
        },
        border: {
          display: false,
        },
      },
    },
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        intersect: false,
        backgroundColor: "rgba(2,6,17,0.96)",
        borderColor:
          latestTone === "good"
            ? "rgba(52,211,153,0.30)"
            : latestTone === "warn"
              ? "rgba(251,191,36,0.30)"
              : "rgba(244,63,94,0.30)",
        borderWidth: 1,
        titleColor: "rgba(255,255,255,0.90)",
        bodyColor: "rgba(255,255,255,0.82)",
        displayColors: false,
        padding: 12,
        cornerRadius: 12,
        titleFont: {
          size: 11,
          weight: "700",
        },
        bodyFont: {
          size: 13,
          weight: "600",
        },
        callbacks: {
          label: (ctx: any) => `Score: ${ctx.raw ?? "—"}`,
        },
      },
    },
  };

  const deltaText =
    delta === null
      ? "—"
      : delta > 0
        ? `+${delta}`
        : `${delta}`;

  const deltaTone =
    delta === null
      ? "neutral"
      : delta > 0
        ? "good"
        : delta < 0
          ? "bad"
          : "neutral";

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <TrendStat
          label="Latest"
          value={latest === null ? "—" : String(latest)}
          tone={latestTone}
        />

        <TrendStat
          label="Delta"
          value={deltaText}
          tone={deltaTone}
        />

        <TrendStat
          label="Average"
          value={average === null ? "—" : String(average)}
          tone={averageTone}
        />
      </div>

      <div className="relative h-56 overflow-hidden rounded-3xl border border-white/[0.06] bg-gradient-to-br from-[#071120] via-[#050b16] to-[#020611] p-3">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.055),transparent_55%)]" />

        <div className="relative h-full w-full">
          <Line data={chartData} options={options} />
        </div>
      </div>
    </div>
  );
}