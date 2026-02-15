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

  tags?: string[] | null;
  price?: string | null;
  notes?: string | null;

  lat?: number | null;
  lng?: number | null;

  verified?: boolean | null;
  disciplines?: string[] | null;

  primary_discipline?: string | null;
  style_tags?: string[] | null;
  intensity_label?: string | null;
  level_label?: string | null;
  price_label?: string | null;
  is_verified?: boolean | null;
  google_maps_url?: string | null;
};

const DISCIPLINE_FILTERS = ["All disciplines", "MMA", "Wrestling", "Boxing", "Sambo", "BJJ"];

function normalizeGym(raw: any): Gym {
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

    primary_discipline: raw.primary_discipline ?? null,
    style_tags: Array.isArray(raw.style_tags) ? raw.style_tags : null,
    intensity_label: raw.intensity_label ?? null,
    level_label: raw.level_label ?? null,
    price_label: raw.price_label ?? null,
    is_verified: typeof raw.is_verified === "boolean" ? raw.is_verified : null,
    google_maps_url: raw.google_maps_url ?? null,
  };
}

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function SkeletonCard() {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <div className="h-4 w-44 rounded bg-white/10" />
          <div className="h-3 w-56 rounded bg-white/5" />
          <div className="h-3 w-40 rounded bg-white/5" />
        </div>
        <div className="space-y-2">
          <div className="h-6 w-20 rounded-full bg-white/5" />
          <div className="h-6 w-24 rounded-full bg-white/5" />
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        <div className="h-6 w-24 rounded-full bg-white/5" />
        <div className="h-6 w-24 rounded-full bg-white/5" />
      </div>
      <div className="mt-5 h-10 w-44 rounded-xl bg-emerald-500/10 border border-emerald-500/20" />
    </div>
  );
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

        const res = await fetch(`/api/gyms?${params.toString()}`, { cache: "no-store" });
        const json = await res.json();

        if (cancelled) return;

        const rawList = Array.isArray(json?.gyms) ? json.gyms : Array.isArray(json) ? json : [];
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

  const subtitle = useMemo(() => {
    if (verifiedOnly) return "Showing verified rooms only. Quality > quantity.";
    return "Search real rooms by discipline and location. Verified labels depend on your data.";
  }, [verifiedOnly]);

  return (
    <main className="min-h-screen text-white">
      {/* Deep-blue app backdrop */}
      <div
        className={cn(
          "min-h-screen px-6 py-10",
          "bg-[radial-gradient(1200px_800px_at_20%_10%,rgba(16,185,129,0.10),transparent_60%),radial-gradient(900px_700px_at_80%_0%,rgba(56,189,248,0.07),transparent_55%),radial-gradient(1000px_900px_at_50%_120%,rgba(99,102,241,0.06),transparent_55%),linear-gradient(180deg,#050812,#0a0f1c)]"
        )}
      >
        <div className="mx-auto max-w-6xl space-y-6">
          {/* Header */}
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-[11px] font-semibold tracking-[0.3em] text-emerald-300/90">
                GYMS
              </p>
              <h1 className="mt-1 text-3xl font-semibold text-white">{heading}</h1>
              <p className="mt-2 text-sm text-white/60 max-w-2xl">{subtitle}</p>
            </div>

            <div className="flex items-center gap-2">
              <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-[11px] text-emerald-200">
                {items.length} result{items.length === 1 ? "" : "s"}
              </span>
              <span className="rounded-full border border-white/10 bg-white/[0.02] px-3 py-1 text-[11px] text-white/60">
                Filter: {discipline}
              </span>
            </div>
          </div>

          {/* Search + filters */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-4 space-y-3 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
            <div className="flex flex-col gap-3 md:flex-row md:items-center">
              <div className="relative flex-1">
                <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-white/35">
                  ⌕
                </div>
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search by city, gym, or country..."
                  className={cn(
                    "w-full rounded-xl border border-white/10 bg-black/25 px-10 py-2 text-sm text-white outline-none",
                    "focus:border-emerald-400/70 focus:ring-2 focus:ring-emerald-500/10"
                  )}
                />
                {query.trim() ? (
                  <button
                    onClick={() => setQuery("")}
                    className="absolute inset-y-0 right-2 my-auto rounded-lg px-3 text-xs text-white/60 hover:text-white"
                    type="button"
                  >
                    Clear
                  </button>
                ) : null}
              </div>

              <label className="flex items-center gap-2 text-xs text-white/70 select-none">
                <input
                  type="checkbox"
                  checked={verifiedOnly}
                  onChange={(e) => setVerifiedOnly(e.target.checked)}
                  className="h-4 w-4 rounded border-white/20 bg-black/40 accent-emerald-400"
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
                    className={cn(
                      "rounded-full px-3 py-1 text-xs border transition",
                      active
                        ? "border-emerald-400/70 bg-emerald-500/15 text-emerald-100 shadow-[0_0_0_4px_rgba(16,185,129,0.06)]"
                        : "border-white/10 bg-white/[0.02] text-white/60 hover:border-emerald-400/60 hover:text-emerald-100"
                    )}
                  >
                    {d}
                  </button>
                );
              })}
            </div>
          </div>

          {/* States */}
          {loading && (
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          )}

          {!loading && error && (
            <div className="rounded-2xl border border-rose-500/25 bg-rose-500/10 p-4 text-sm text-rose-100">
              <div className="font-semibold">Couldn’t load gyms.</div>
              <div className="mt-1 text-rose-100/80">{error}</div>
            </div>
          )}

          {!loading && !error && items.length === 0 && (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-white/65">
              No gyms matched your filters. Try clearing search or changing discipline.
            </div>
          )}

          {/* Grid */}
          {!loading && !error && items.length > 0 && (
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {items.map((gym) => (
                <GymCard key={gym.id} gym={gym as any} />
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}