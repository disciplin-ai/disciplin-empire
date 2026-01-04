// frontend/src/app/gyms/page.tsx
"use client";

import React, { useEffect, useState } from "react";
import GymCard, { Gym } from "../../components/GymCard";

const DISCIPLINE_FILTERS = [
  "All disciplines",
  "MMA",
  "Wrestling",
  "Boxing",
  "Sambo",
  "BJJ",
];

export default function GymsPage() {
  const [gyms, setGyms] = useState<Gym[]>([]);
  const [query, setQuery] = useState("");
  const [discipline, setDiscipline] = useState<string>("All disciplines");
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadGyms() {
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams();

        if (query.trim()) params.set("q", query.trim());
        if (discipline !== "All disciplines") params.set("discipline", discipline);
        if (verifiedOnly) params.set("verified", "true");

        const res = await fetch(`/api/gyms?${params.toString()}`, {
          cache: "no-store",
        });
        const json = await res.json();

        if (cancelled) return;

        setGyms(Array.isArray(json.gyms) ? json.gyms : []);
        if (json.error) setError(json.error);
      } catch (err: any) {
        if (cancelled) return;
        setError(err?.message ?? "Failed to load gyms");
        setGyms([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadGyms();

    return () => {
      cancelled = true;
    };
  }, [query, discipline, verifiedOnly]);

  return (
    <main className="min-h-screen bg-[#020810] text-white px-8 py-10">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Header */}
        <div>
          <p className="text-[11px] font-semibold tracking-[0.3em] text-emerald-400">
            GYMS
          </p>
          <h1 className="mt-1 text-3xl font-semibold">Your training hubs.</h1>
          <p className="mt-2 text-sm text-white/60 max-w-2xl">
            Find real rooms that match your discipline and intensity — no fake
            placeholders, just the grind spots from your database.
          </p>
        </div>

        {/* Search + filters box */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 space-y-3">
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by city, gym, or country..."
              className="flex-1 rounded-xl border border-white/10 bg-black/30 px-4 py-2 text-sm text-white outline-none focus:border-emerald-400"
            />

            <label className="flex items-center gap-2 text-xs text-white/60">
              <input
                type="checkbox"
                checked={verifiedOnly}
                onChange={(e) => setVerifiedOnly(e.target.checked)}
                className="h-4 w-4 rounded border-white/20 bg-black/40"
              />
              Only verified grind rooms
            </label>
          </div>

          <div className="flex flex-wrap gap-2">
            {DISCIPLINE_FILTERS.map((d) => {
              const active = discipline === d;
              return (
                <button
                  key={d}
                  onClick={() => setDiscipline(d)}
                  className={[
                    "rounded-full px-3 py-1 text-xs border transition",
                    active
                      ? "border-emerald-500 bg-emerald-500/15 text-emerald-100"
                      : "border-white/10 bg-white/[0.02] text-white/60 hover:border-emerald-400 hover:text-emerald-200",
                  ].join(" ")}
                >
                  {d}
                </button>
              );
            })}
          </div>
        </div>

        {/* States */}
        {loading && (
          <div className="text-sm text-white/60">Loading gyms…</div>
        )}

        {!loading && error && (
          <div className="text-sm text-red-400">
            Something went wrong loading gyms: {error}
          </div>
        )}

        {!loading && !error && gyms.length === 0 && (
          <div className="text-sm text-white/60">
            No gyms matched your filters. Try clearing the search or widening
            the radius.
          </div>
        )}

        {/* Gyms grid */}
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {gyms.map((gym) => (
            <GymCard key={gym.id} gym={gym} />
          ))}
        </div>
      </div>
    </main>
  );
}
