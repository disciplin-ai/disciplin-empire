// frontend/src/app/gyms/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import GymCard from "../../components/GymCard";

type Gym = {
  id: string;
  slug?: string;
  name: string;
  city?: string | null;
  area?: string | null;
  country?: string | null;
  address?: string | null;
  phone?: string | null;
  website?: string | null;

  // flexible tags + pricing
  tags?: string[] | null;
  price?: string | null;
  notes?: string | null;

  // geo
  lat?: number | null;
  lng?: number | null;

  // verification + disciplines
  verified?: boolean | null;
  disciplines?: string[] | null;

  // optional extras if your API returns them
  primary_discipline?: string | null;
  style_tags?: string[] | null;
  intensity_label?: string | null;
  level_label?: string | null;
  price_label?: string | null;
  is_verified?: boolean | null;
  google_maps_url?: string | null;
};

const DISCIPLINE_FILTERS = [
  "All disciplines",
  "MMA",
  "Wrestling",
  "Boxing",
  "Sambo",
  "BJJ",
];

function normalizeGym(raw: any): Gym {
  // Accept multiple shapes from different versions of your API
  const city = raw.city ?? raw.location?.city ?? null;
  const country = raw.country ?? raw.location?.country ?? null;

  return {
    id: String(raw.id ?? raw.slug ?? raw.name ?? crypto.randomUUID()),
    slug: raw.slug ?? null,
    name: String(raw.name ?? "Unknown gym"),

    city,
    area: raw.area ?? raw.location?.area ?? null,
    country,

    address: raw.address ?? raw.location?.address ?? null,
    phone: raw.phone ?? null,
    website: raw.website ?? null,

    tags: Array.isArray(raw.tags) ? raw.tags : null,
    price: raw.price ?? null,
    notes: raw.notes ?? null,

    lat: raw.lat ?? raw.latitude ?? null,
    lng: raw.lng ?? raw.longitude ?? null,

    verified:
      (typeof raw.verified === "boolean" ? raw.verified : null) ??
      (typeof raw.is_verified === "boolean" ? raw.is_verified : null),

    disciplines: Array.isArray(raw.disciplines) ? raw.disciplines : null,

    // extras (safe)
    primary_discipline: raw.primary_discipline ?? null,
    style_tags: Array.isArray(raw.style_tags) ? raw.style_tags : null,
    intensity_label: raw.intensity_label ?? null,
    level_label: raw.level_label ?? null,
    price_label: raw.price_label ?? null,
    is_verified: typeof raw.is_verified === "boolean" ? raw.is_verified : null,
    google_maps_url: raw.google_maps_url ?? null,
  };
}

export default function GymsPage() {
  const [items, setItems] = useState<Gym[]>([]);
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

        const rawList = Array.isArray(json?.gyms)
          ? json.gyms
          : Array.isArray(json)
          ? json
          : [];

        setItems(rawList.map(normalizeGym));
        if (json?.error) setError(String(json.error));
      } catch (e: any) {
        if (cancelled) return;
        setError(e?.message ?? "Failed to load gyms");
        setItems([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadGyms();
    return () => {
      cancelled = true;
    };
  }, [query, discipline, verifiedOnly]);

  const heading = useMemo(() => {
    if (discipline === "All disciplines") return "Your training hubs.";
    return `${discipline} gyms.`;
  }, [discipline]);

  return (
    <main className="min-h-screen bg-[#020810] text-white px-8 py-10">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Header */}
        <div>
          <p className="text-[11px] font-semibold tracking-[0.3em] text-emerald-400">
            GYMS
          </p>
          <h1 className="mt-1 text-3xl font-semibold">{heading}</h1>
          <p className="mt-2 text-sm text-white/60 max-w-2xl">
            Search real rooms by discipline and location. Verified labels are optional
            and depend on your data.
          </p>
        </div>

        {/* Search + filters */}
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
              Only verified
            </label>
          </div>

          <div className="flex flex-wrap gap-2">
            {DISCIPLINE_FILTERS.map((d) => {
              const active = discipline === d;
              return (
                <button
                  key={d}
                  type="button"
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
        {loading && <div className="text-sm text-white/60">Loading gyms…</div>}

        {!loading && error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
            Something went wrong loading gyms:{" "}
            <span className="font-semibold">{error}</span>
          </div>
        )}

        {!loading && !error && items.length === 0 && (
          <div className="text-sm text-white/60">
            No gyms matched your filters. Try clearing the search or changing
            discipline.
          </div>
        )}

        {/* Grid */}
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {items.map((gym) => (
            <GymCard key={gym.id} gym={gym as any} />
          ))}
        </div>
      </div>
    </main>
  );
}
