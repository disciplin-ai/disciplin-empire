"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useProfile } from "@/components/ProfileProvider";
import { readUserJson, writeUserJson } from "@/lib/userScopedStorage";

type Gym = {
  id: string;
  slug: string;
  name: string;
  city: string;
  country: string;
  address?: string | null;
  is_verified?: boolean;
  primary_discipline?: string | null;
  disciplines?: string[];
  style_tags?: string[];
  level_label?: string | null;
  price_label?: string | null;
  intensity_label?: string | null;
  google_maps_url?: string | null;
  website?: string | null;
  coach_notes?: string | null;
};

type GymCoach = {
  id: string;
  name: string;
  role?: string | null;
  specialties?: string[];
  credentials?: string | null;
  profile_url?: string | null;
};

type GymProgram = {
  id: string;
  program_type: string;
  level_label?: string | null;
  frequency_per_week?: number | null;
  notes?: string | null;
};

type GymRating = {
  rating_avg: number | null;
  rating_count: number | null;
  source: string | null;
};

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function Stars({ value }: { value: number }) {
  const v = clamp(value, 0, 5);
  const full = Math.floor(v);
  const half = v - full >= 0.5;
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: 5 }).map((_, i) => {
        const on = i < full || (i === full && half);
        return (
          <span
            key={i}
            className={cn(
              "text-sm",
              on ? "text-emerald-300" : "text-slate-700"
            )}
          >
            ★
          </span>
        );
      })}
    </div>
  );
}

type Tab = "overview" | "classes" | "coaches" | "reviews";

export default function GymsSlugClient({ slug }: { slug: string }) {
  const { user } = useProfile();

  const [gym, setGym] = useState<Gym | null>(null);
  const [coaches, setCoaches] = useState<GymCoach[]>([]);
  const [programs, setPrograms] = useState<GymProgram[]>([]);
  const [rating, setRating] = useState<GymRating | null>(null);
  const [related, setRelated] = useState<Gym[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [tab, setTab] = useState<Tab>("overview");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setNotFound(false);
      try {
        const res = await fetch(`/api/gyms/${encodeURIComponent(slug)}`);
        if (res.status === 404) {
          if (!cancelled) setNotFound(true);
          return;
        }
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || "Failed to load gym.");
        if (cancelled) return;

        setGym(json.gym);
        setCoaches(json.coaches || []);
        setPrograms(json.programs || []);
        setRating(json.rating || null);

        if (json.gym?.city) {
          const relatedRes = await fetch(
            `/api/gyms?q=${encodeURIComponent(json.gym.city)}`
          );
          const relatedJson = await relatedRes.json();
          if (!cancelled && relatedRes.ok) {
            setRelated(
              (relatedJson.gyms || [])
                .filter((g: Gym) => g.slug !== json.gym.slug)
                .slice(0, 3)
            );
          }
        }
      } catch {
        if (!cancelled) setNotFound(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  useEffect(() => {
    const gymSlug = gym?.slug;
    if (!gymSlug) return;
    const ids = readUserJson<string[]>(user?.id, "disciplin_saved_gyms_v1") ?? [];
    queueMicrotask(() => setSaved(ids.includes(gymSlug)));
  }, [gym?.slug, user?.id]);

  function toggleSaved() {
    if (!gym) return;
    const ids = readUserJson<string[]>(user?.id, "disciplin_saved_gyms_v1") ?? [];
    const next = saved
      ? ids.filter((x) => x !== gym.slug)
      : Array.from(new Set([gym.slug, ...ids]));
    writeUserJson(user?.id, "disciplin_saved_gyms_v1", next);
    setSaved(!saved);
  }

  const disciplines = useMemo(
    () => gym?.disciplines?.length ? gym.disciplines : (gym?.primary_discipline ? [gym.primary_discipline] : []),
    [gym]
  );

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-50 px-6 py-10">
        <div className="max-w-6xl mx-auto rounded-3xl border border-slate-800 bg-slate-900/40 p-8">
          <p className="text-sm text-slate-400">Loading gym…</p>
        </div>
      </main>
    );
  }

  if (notFound || !gym) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-50 px-6 py-10">
        <div className="max-w-6xl mx-auto rounded-3xl border border-slate-800 bg-slate-900/40 p-8">
          <p className="text-sm font-semibold">Gym not found.</p>
          <p className="mt-2 text-xs text-slate-400">Check the slug or go back to the gyms list.</p>
          <Link className="mt-4 inline-block text-emerald-200 underline" href="/gyms">
            ← Back to Gyms
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 px-6 py-10">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Breadcrumb / header */}
        <div className="rounded-3xl border border-slate-800 bg-slate-900/40 p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <Link className="text-xs text-slate-400 underline" href="/gyms">
                ← Gyms
              </Link>

              <div className="mt-3 flex items-center gap-2">
                <p className="text-xs font-semibold tracking-[0.25em] text-emerald-400">GYM</p>
                {gym.is_verified && (
                  <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-200">
                    Verified
                  </span>
                )}
              </div>

              <h1 className="mt-2 text-3xl font-semibold">{gym.name}</h1>
              <p className="mt-1 text-sm text-slate-400">
                {gym.city}, {gym.country}{gym.address ? ` · ${gym.address}` : ""}
              </p>

              <div className="mt-3 flex items-center gap-3 flex-wrap">
                {disciplines.map((d) => (
                  <span
                    key={d}
                    className="rounded-full border border-slate-700 bg-slate-950/30 px-3 py-1 text-xs text-slate-200"
                  >
                    {d}
                  </span>
                ))}
                {gym.level_label && (
                  <span className="rounded-full border border-slate-700 bg-slate-950/30 px-3 py-1 text-xs text-slate-200">
                    Level: {gym.level_label}
                  </span>
                )}
                {gym.price_label && (
                  <span className="rounded-full border border-slate-700 bg-slate-950/30 px-3 py-1 text-xs text-slate-200">
                    Price: {gym.price_label}
                  </span>
                )}
                {gym.intensity_label && (
                  <span className="rounded-full border border-slate-700 bg-slate-950/30 px-3 py-1 text-xs text-slate-200">
                    Intensity: {gym.intensity_label}
                  </span>
                )}
              </div>

              {rating?.rating_avg != null && (
                <div className="mt-3 flex items-center gap-3">
                  <Stars value={rating.rating_avg} />
                  <p className="text-xs text-slate-400">
                    {rating.rating_avg} · {rating.rating_count ?? 0} ratings
                    {rating.source ? ` · source: ${rating.source}` : ""}
                  </p>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-3 min-w-[220px]">
              <button
                onClick={toggleSaved}
                className={cn(
                  "rounded-full px-4 py-2 text-sm font-semibold border transition",
                  saved
                    ? "border-emerald-400/50 bg-emerald-500/10 text-emerald-200"
                    : "border-slate-700 bg-slate-950/30 text-slate-200 hover:border-emerald-400/40"
                )}
              >
                {saved ? "Saved ✓" : "Save gym"}
              </button>

              <a
                href={gym.google_maps_url ?? "#"}
                target="_blank"
                rel="noreferrer"
                className={cn(
                  "rounded-full px-4 py-2 text-sm font-semibold text-center",
                  gym.google_maps_url ? "bg-emerald-500 text-slate-950 hover:bg-emerald-400" : "bg-white/10 text-white/40"
                )}
              >
                Open in Google Maps
              </a>

              <a
                href={gym.website ?? "#"}
                target="_blank"
                rel="noreferrer"
                className={cn(
                  "rounded-full px-4 py-2 text-sm font-semibold text-center border",
                  gym.website
                    ? "border-slate-700 bg-slate-950/30 hover:border-emerald-400/40"
                    : "border-white/10 text-white/40"
                )}
              >
                Website
              </a>
            </div>
          </div>

          {/* tags */}
          {(gym.style_tags ?? []).length > 0 && (
            <div className="mt-5 flex flex-wrap gap-2">
              {(gym.style_tags ?? []).map((t) => (
                <span
                  key={t}
                  className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-100"
                >
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["overview", "Overview"],
              ["classes", "Classes"],
              ["coaches", "Coaches"],
              ["reviews", "Ratings"],
            ] as Array<[Tab, string]>
          ).map(([id, label]) => {
            const on = tab === id;
            return (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={cn(
                  "rounded-full px-4 py-2 text-xs border transition",
                  on
                    ? "border-emerald-400 bg-emerald-500/10 text-emerald-200"
                    : "border-slate-800 bg-slate-950/40 text-slate-300 hover:border-emerald-400/40"
                )}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Tab content */}
        <section className="rounded-3xl border border-slate-800 bg-slate-900/40 p-6">
          {tab === "overview" && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
                <p className="text-xs font-semibold tracking-[0.25em] text-slate-300">ABOUT</p>
                <p className="mt-2 text-sm text-slate-200 leading-relaxed">
                  {gym.coach_notes || "No description yet."}
                </p>
              </div>
            </div>
          )}

          {tab === "classes" && (
            <div className="space-y-3">
              <div className="grid gap-3">
                {programs.length === 0 ? (
                  <p className="text-xs text-slate-500">No class schedule on file yet.</p>
                ) : (
                  programs.map((p) => (
                    <div
                      key={p.id}
                      className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4 flex items-start justify-between gap-3"
                    >
                      <div>
                        <p className="text-sm font-semibold">{p.program_type}</p>
                        {p.notes && <p className="mt-1 text-xs text-slate-400">{p.notes}</p>}
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        {p.level_label && (
                          <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-100">
                            {p.level_label}
                          </span>
                        )}
                        {p.frequency_per_week != null && (
                          <span className="text-[11px] text-slate-400">
                            {p.frequency_per_week}x / week
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {tab === "coaches" && (
            <div className="space-y-3">
              <div className="grid gap-3 md:grid-cols-2">
                {coaches.length === 0 ? (
                  <p className="text-xs text-slate-500">No coaches listed yet.</p>
                ) : (
                  coaches.map((c) => (
                    <div key={c.id} className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
                      <p className="text-sm font-semibold">{c.name}</p>
                      {c.role && <p className="mt-1 text-xs text-emerald-200">{c.role}</p>}
                      {(c.specialties ?? []).length > 0 && (
                        <p className="mt-1 text-xs text-slate-400">
                          {(c.specialties ?? []).join(" · ")}
                        </p>
                      )}
                      {c.credentials && <p className="mt-2 text-xs text-slate-400">{c.credentials}</p>}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {tab === "reviews" && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
                {rating?.rating_avg != null ? (
                  <div className="flex items-center gap-3">
                    <Stars value={rating.rating_avg} />
                    <p className="text-sm text-slate-200">
                      {rating.rating_avg} average from {rating.rating_count ?? 0} ratings
                      {rating.source ? ` (source: ${rating.source})` : ""}
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">
                    No verified ratings yet for this gym.
                  </p>
                )}
              </div>
            </div>
          )}
        </section>

        {/* Related */}
        {related.length > 0 && (
          <section className="space-y-3">
            <p className="text-xs font-semibold tracking-[0.25em] text-slate-300">RELATED IN {gym.city.toUpperCase()}</p>
            <div className="grid gap-4 md:grid-cols-3">
              {related.map((g) => (
                <Link
                  key={g.slug}
                  href={`/gyms/${g.slug}`}
                  className="rounded-3xl border border-slate-800 bg-slate-900/40 p-5 hover:border-emerald-400/30 transition"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold">{g.name}</p>
                      <p className="text-xs text-slate-400">{g.city}, {g.country}</p>
                    </div>
                    {g.is_verified && (
                      <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-[11px] text-emerald-100">
                        Verified
                      </span>
                    )}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(g.disciplines?.length ? g.disciplines : g.primary_discipline ? [g.primary_discipline] : []).map((d) => (
                      <span key={d} className="rounded-full border border-slate-700 bg-slate-950/30 px-3 py-1 text-xs text-slate-200">
                        {d}
                      </span>
                    ))}
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
