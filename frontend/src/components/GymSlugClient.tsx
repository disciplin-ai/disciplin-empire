"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type Disc = "MMA" | "Wrestling" | "Boxing" | "Sambo" | "BJJ" | "Fitness";
type Gym = {
  slug: string;
  name: string;
  city: string;
  country: string;
  address?: string;
  verified?: boolean;
  discipline: Disc;
  level?: string;
  price?: "$" | "$$" | "$$$" | "premium";
  intensity?: "Easy" | "Moderate" | "Hard";
  tags?: string[];
  maps?: string;
  website?: string;

  // detail
  about?: string;
  highlights?: string[];
  classes?: Array<{ name: string; days: string; time: string; intensity: string }>;
  coaches?: Array<{ name: string; specialty: string; note?: string }>;
  reviews?: Array<{ user: string; rating: number; text: string; date: string }>;
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

/**
 * Replace this with a real fetch later.
 * For now it's a local dataset so your UI works immediately.
 */
const SAMPLE_GYMS: Gym[] = [
  {
    slug: "ufc-gym-jbr",
    name: "UFC Gym JBR",
    city: "Dubai",
    country: "UAE",
    address: "Jumeirah Beach Residence, Dubai",
    verified: true,
    discipline: "MMA",
    level: "All levels",
    price: "$$",
    intensity: "Moderate",
    tags: ["franchise", "fitness", "classes"],
    maps: "https://maps.google.com",
    website: "https://www.ufcgym.com",
    about:
      "Large facility with structured classes and consistent programming. Good for fighters who want predictable schedules and conditioning options.",
    highlights: [
      "Daily class schedule (multiple disciplines)",
      "Strength & conditioning area",
      "Beginner-friendly onboarding",
      "Consistent coaching structure",
    ],
    classes: [
      { name: "MMA Fundamentals", days: "Mon/Wed/Fri", time: "6:00pm", intensity: "Standard" },
      { name: "Wrestling", days: "Tue/Thu", time: "7:00pm", intensity: "High pace" },
      { name: "S&C Circuit", days: "Sat", time: "11:00am", intensity: "Hard" },
    ],
    coaches: [
      { name: "Coach A", specialty: "Striking + MMA", note: "Clean fundamentals, high output." },
      { name: "Coach B", specialty: "Wrestling", note: "Pressure chains, wall work focus." },
    ],
    reviews: [
      { user: "Nmm", rating: 4.5, text: "Good structure + clean facility. Busy at peak time.", date: "2026-01-12" },
      { user: "Dylan", rating: 4.0, text: "Solid for consistency. Great conditioning options.", date: "2026-01-18" },
    ],
  },
  {
    slug: "kuma-team",
    name: "Kuma Team",
    city: "Dubai",
    country: "UAE",
    address: "Al Quoz Industrial Area 3, Dubai",
    verified: true,
    discipline: "Wrestling",
    level: "All levels",
    price: "$$",
    intensity: "Hard",
    tags: ["wrestling-heavy", "sambo", "competition"],
    maps: "https://maps.google.com",
    about:
      "Competition-leaning room. Pace is high. Expect grind. Great if you want pressure and real rounds.",
    highlights: [
      "Hard rounds, real room culture",
      "Wrestling-heavy sessions",
      "Competition mindset",
    ],
    classes: [
      { name: "Wrestling Room", days: "Mon/Wed/Fri", time: "5:00pm", intensity: "Hard" },
      { name: "Sambo Skills", days: "Tue/Thu", time: "6:30pm", intensity: "Technical" },
    ],
    coaches: [{ name: "Coach K", specialty: "Wrestling + Sambo", note: "Relentless chain style." }],
    reviews: [{ user: "User 27", rating: 5.0, text: "Best grind room. Not for casuals.", date: "2026-01-04" }],
  },
  {
    slug: "renzo-gracie-dubai",
    name: "Renzo Gracie Dubai",
    city: "Dubai",
    country: "UAE",
    verified: true,
    discipline: "BJJ",
    level: "Mixed",
    price: "$$$",
    intensity: "Moderate",
    tags: ["bjj", "grappling"],
    maps: "https://maps.google.com",
    about:
      "Technical environment. Strong base for grappling control and submission defense.",
    highlights: ["Good fundamentals", "Structured curriculum", "Solid training partners"],
    classes: [
      { name: "BJJ Fundamentals", days: "Daily", time: "7:00pm", intensity: "Technical" },
      { name: "No-Gi", days: "Tue/Thu", time: "8:00pm", intensity: "Moderate" },
    ],
    coaches: [{ name: "Coach R", specialty: "BJJ", note: "Details + positional control." }],
    reviews: [{ user: "User 11", rating: 4.5, text: "Great structure. Good mat culture.", date: "2026-01-10" }],
  },
];

type Tab = "overview" | "classes" | "coaches" | "reviews";

export default function GymsSlugClient({ slug }: { slug: string }) {
  const gym = useMemo(() => SAMPLE_GYMS.find((g) => g.slug === slug) ?? null, [slug]);

  const [tab, setTab] = useState<Tab>("overview");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!gym) return;
    try {
      const raw = localStorage.getItem("disciplin_saved_gyms_v1");
      const ids = raw ? (JSON.parse(raw) as string[]) : [];
      setSaved(ids.includes(gym.slug));
    } catch {}
  }, [gym?.slug]);

  function toggleSaved() {
    if (!gym) return;
    try {
      const raw = localStorage.getItem("disciplin_saved_gyms_v1");
      const ids = raw ? (JSON.parse(raw) as string[]) : [];
      const next = saved ? ids.filter((x) => x !== gym.slug) : Array.from(new Set([gym.slug, ...ids]));
      localStorage.setItem("disciplin_saved_gyms_v1", JSON.stringify(next));
      setSaved(!saved);
    } catch {}
  }

  const avgRating = useMemo(() => {
    if (!gym?.reviews?.length) return null;
    const sum = gym.reviews.reduce((a, r) => a + r.rating, 0);
    return Math.round((sum / gym.reviews.length) * 10) / 10;
  }, [gym?.reviews]);

  const related = useMemo(() => {
    if (!gym) return [];
    return SAMPLE_GYMS.filter((g) => g.slug !== gym.slug && g.city === gym.city).slice(0, 3);
  }, [gym]);

  if (!gym) {
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
                {gym.verified && (
                  <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-200">
                    Verified
                  </span>
                )}
              </div>

              <h1 className="mt-2 text-3xl font-semibold">{gym.name}</h1>
              <p className="mt-1 text-sm text-slate-400">
                {gym.city}, {gym.country}{gym.address ? ` · ${gym.address}` : ""}
              </p>

              <div className="mt-3 flex items-center gap-3">
                <span className="rounded-full border border-slate-700 bg-slate-950/30 px-3 py-1 text-xs text-slate-200">
                  {gym.discipline}
                </span>
                {gym.level && (
                  <span className="rounded-full border border-slate-700 bg-slate-950/30 px-3 py-1 text-xs text-slate-200">
                    Level: {gym.level}
                  </span>
                )}
                {gym.price && (
                  <span className="rounded-full border border-slate-700 bg-slate-950/30 px-3 py-1 text-xs text-slate-200">
                    Price: {gym.price}
                  </span>
                )}
                {gym.intensity && (
                  <span className="rounded-full border border-slate-700 bg-slate-950/30 px-3 py-1 text-xs text-slate-200">
                    Intensity: {gym.intensity}
                  </span>
                )}
              </div>

              {avgRating !== null && (
                <div className="mt-3 flex items-center gap-3">
                  <Stars value={avgRating} />
                  <p className="text-xs text-slate-400">
                    {avgRating} · {gym.reviews?.length ?? 0} reviews
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
                href={gym.maps ?? "#"}
                target="_blank"
                rel="noreferrer"
                className={cn(
                  "rounded-full px-4 py-2 text-sm font-semibold text-center",
                  gym.maps ? "bg-emerald-500 text-slate-950 hover:bg-emerald-400" : "bg-white/10 text-white/40"
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
          <div className="mt-5 flex flex-wrap gap-2">
            {(gym.tags ?? []).map((t) => (
              <span
                key={t}
                className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-100"
              >
                {t}
              </span>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["overview", "Overview"],
              ["classes", "Classes"],
              ["coaches", "Coaches"],
              ["reviews", "Reviews"],
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
                  {gym.about ?? "No description yet."}
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
                  <p className="text-xs font-semibold tracking-[0.25em] text-slate-300">HIGHLIGHTS</p>
                  <ul className="mt-2 space-y-2 text-sm text-slate-200">
                    {(gym.highlights ?? ["Add highlights later."]).map((h) => (
                      <li key={h} className="flex items-start gap-2">
                        <span className="text-emerald-300 mt-[2px]">•</span>
                        <span>{h}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
                  <p className="text-xs font-semibold tracking-[0.25em] text-slate-300">DISCIPLIN FIT</p>
                  <p className="mt-2 text-sm text-slate-200">
                    If you want{" "}
                    <span className="text-emerald-200 font-semibold">consistency</span>, pick structured classes.
                    If you want{" "}
                    <span className="text-emerald-200 font-semibold">pressure</span>, pick a hard room.
                  </p>
                  <p className="mt-3 text-xs text-slate-400">
                    Later: Sensei will match this gym to your profile + camp goal.
                  </p>
                </div>
              </div>
            </div>
          )}

          {tab === "classes" && (
            <div className="space-y-3">
              <p className="text-sm text-slate-300">
                Weekly structure preview (dummy data until you connect DB).
              </p>

              <div className="grid gap-3">
                {(gym.classes ?? []).length === 0 ? (
                  <p className="text-xs text-slate-500">No class schedule yet.</p>
                ) : (
                  gym.classes!.map((c, i) => (
                    <div
                      key={i}
                      className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4 flex items-start justify-between gap-3"
                    >
                      <div>
                        <p className="text-sm font-semibold">{c.name}</p>
                        <p className="mt-1 text-xs text-slate-400">
                          {c.days} · {c.time}
                        </p>
                      </div>
                      <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-100">
                        {c.intensity}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {tab === "coaches" && (
            <div className="space-y-3">
              <p className="text-sm text-slate-300">Coaches (dummy data for now).</p>
              <div className="grid gap-3 md:grid-cols-2">
                {(gym.coaches ?? []).length === 0 ? (
                  <p className="text-xs text-slate-500">No coaches listed yet.</p>
                ) : (
                  gym.coaches!.map((c, i) => (
                    <div key={i} className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
                      <p className="text-sm font-semibold">{c.name}</p>
                      <p className="mt-1 text-xs text-emerald-200">{c.specialty}</p>
                      {c.note && <p className="mt-2 text-xs text-slate-400">{c.note}</p>}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {tab === "reviews" && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
                <p className="text-xs font-semibold tracking-[0.25em] text-slate-300">REVIEWS</p>
                <p className="mt-2 text-xs text-slate-400">
                  Later: verified reviews + anti-fake checks.
                </p>
              </div>

              <div className="grid gap-3">
                {(gym.reviews ?? []).length === 0 ? (
                  <p className="text-xs text-slate-500">No reviews yet.</p>
                ) : (
                  gym.reviews!.map((r, i) => (
                    <div key={i} className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold">{r.user}</p>
                        <div className="flex items-center gap-2">
                          <Stars value={r.rating} />
                          <span className="text-xs text-slate-400">{r.date}</span>
                        </div>
                      </div>
                      <p className="mt-2 text-sm text-slate-200 leading-relaxed">{r.text}</p>
                    </div>
                  ))
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
                    {g.verified && (
                      <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-[11px] text-emerald-100">
                        Verified
                      </span>
                    )}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="rounded-full border border-slate-700 bg-slate-950/30 px-3 py-1 text-xs text-slate-200">
                      {g.discipline}
                    </span>
                    {g.intensity && (
                      <span className="rounded-full border border-slate-700 bg-slate-950/30 px-3 py-1 text-xs text-slate-200">
                        {g.intensity}
                      </span>
                    )}
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