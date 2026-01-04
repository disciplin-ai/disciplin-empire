"use client";

import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  LineElement,
  CategoryScale,
  LinearScale,
  PointElement,
  Tooltip,
  Legend,
} from "chart.js";

ChartJS.register(LineElement, CategoryScale, LinearScale, PointElement, Tooltip, Legend);

export type FuelScorePoint = {
  day: string; // e.g. "Mon" or "2025-12-31"
  fuel_score: number | null;
};

interface FuelScoreChartProps {
  data: FuelScorePoint[];
}

export default function FuelScoreChart({ data }: FuelScoreChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="text-gray-400 text-sm italic">
        No history yet — Fuel Score chart will appear after your first analysis.
      </div>
    );
  }

  // Keep labels + values aligned; use nulls so ChartJS can “gap” instead of lying with zeros
  const labels = data.map((d) => d.day);
  const scores = data.map((d) => (typeof d.fuel_score === "number" ? d.fuel_score : null));

  const chartData = {
    labels,
    datasets: [
      {
        label: "Fuel Score",
        data: scores,
        spanGaps: true, // connect across nulls if you want; set false if you want breaks
        borderColor: "#34d399", // emerald-ish
        backgroundColor: "rgba(52, 211, 153, 0.15)",
        borderWidth: 2,
        pointRadius: 3,
        pointHoverRadius: 5,
        tension: 0.35,
      },
    ],
  };

  const options: any = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: {
        min: 0,
        max: 100,
        ticks: { color: "#a3a3a3", font: { size: 12 } },
        grid: { color: "rgba(255,255,255,0.08)" },
      },
      x: {
        ticks: { color: "#a3a3a3", font: { size: 12 } },
        grid: { display: false },
      },
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: "#111",
        borderColor: "#34d399",
        borderWidth: 1,
        titleColor: "#fff",
        bodyColor: "#fff",
        callbacks: {
          label: (ctx: any) => `Fuel Score: ${ctx.raw ?? "—"}`,
        },
      },
    },
  };

  return (
    <div className="w-full h-64 bg-[#0e1013] rounded-xl p-4 border border-white/10 shadow-xl">
      <h3 className="text-white text-lg font-semibold mb-3">Fuel Score Trend</h3>
      <Line data={chartData} options={options} />
    </div>
  );
}
