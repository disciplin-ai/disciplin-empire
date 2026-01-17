"use client";

import { useEffect, useState } from "react";
import FuelScoreChart, {
  FuelHistoryPoint,
} from "./FuelScoreChart";

export default function FuelClient() {
  const [history, setHistory] = useState<FuelHistoryPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Example: fetch history from your API / Supabase later
  useEffect(() => {
    async function loadHistory() {
      try {
        setLoading(true);

        // TEMP mock (replace with real fetch later)
        const mock: FuelHistoryPoint[] = [
          { day: "Mon", fuel_score: 72 },
          { day: "Tue", fuel_score: 78 },
          { day: "Wed", fuel_score: null },
          { day: "Thu", fuel_score: 81 },
        ];

        setHistory(mock);
      } catch (e) {
        setError("Failed to load Fuel history");
      } finally {
        setLoading(false);
      }
    }

    loadHistory();
  }, []);

  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
        <h2 className="text-sm font-semibold text-slate-200">
          Fuel Report
        </h2>
        <p className="text-xs text-slate-400">
          Fuel produces score + macro ranges + 1–3 questions.
        </p>
      </div>

      {error && (
        <p className="text-xs text-red-400">{error}</p>
      )}

      {loading ? (
        <p className="text-xs text-slate-400">Loading…</p>
      ) : (
        <FuelScoreChart data={history} />
      )}
    </section>
  );
}
