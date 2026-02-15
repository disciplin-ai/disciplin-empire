// src/components/FuelScoreChart.tsx
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

export type FuelHistoryPoint = {
  day: string;
  fuel_score: number | null;
};

export default function FuelScoreChart({ data }: { data: FuelHistoryPoint[] }) {
  if (!data || data.length === 0) {
    return <div className="text-white/50 text-xs italic">No history yet.</div>;
  }

  // Always left → right chronological
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
        backgroundColor: "rgba(52,211,153,0.12)",
        pointBackgroundColor: "#34d399",
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
        ticks: { color: "rgba(255,255,255,0.55)", font: { size: 11 } },
        grid: { color: "rgba(255,255,255,0.06)" },
      },
      x: {
        ticks: { color: "rgba(255,255,255,0.55)", font: { size: 11 } },
        grid: { display: false },
      },
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        intersect: false,
        backgroundColor: "rgba(2,8,16,0.95)",
        borderColor: "rgba(52,211,153,0.25)",
        borderWidth: 1,
        titleColor: "rgba(255,255,255,0.9)",
        bodyColor: "rgba(255,255,255,0.85)",
        displayColors: false,
      },
    },
  };

  return (
    <div className="w-full h-56 rounded-2xl border border-white/10 bg-gradient-to-br from-[#061535] via-[#030b18] to-[#020810] p-4">
      <div className="mb-2 text-sm font-semibold text-white">Fuel Score Trend</div>
      <Line data={chartData} options={options} />
    </div>
  );
}