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

ChartJS.register(
  LineElement,
  CategoryScale,
  LinearScale,
  PointElement,
  Tooltip,
  Legend
);

export type FuelHistoryPoint = {
  day: string;
  fuel_score: number | null;
};

export default function FuelScoreChart({
  data,
}: {
  data: FuelHistoryPoint[];
}) {
  if (!data || data.length === 0) {
    return (
      <div className="text-slate-400 text-sm italic">
        No history yet — Fuel Score chart appears after your first analysis.
      </div>
    );
  }

  // ✅ FIX: ensure chart is always left → right chronological
  const sortedData = [...data].sort(
    (a, b) => new Date(a.day).getTime() - new Date(b.day).getTime()
  );

  const labels = sortedData.map((d) => d.day);
  const scores = sortedData.map((d) => d.fuel_score);

  const chartData = {
    labels,
    datasets: [
      {
        label: "Fuel Score",
        data: scores,
        borderWidth: 2,
        pointRadius: 3,
        tension: 0.35,
        spanGaps: true,
        borderColor: "#34d399",
        backgroundColor: "rgba(52,211,153,0.15)",
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: { min: 0, max: 100 },
      x: { grid: { display: false } },
    },
    plugins: {
      legend: { display: false },
      tooltip: { intersect: false },
    },
  };

  return (
    <div className="w-full h-56 rounded-xl border border-white/10 bg-slate-950/40 p-4">
      <div className="mb-2 text-sm font-semibold text-slate-200">
        Fuel Score Trend
      </div>
      <Line data={chartData} options={options} />
    </div>
  );
}
