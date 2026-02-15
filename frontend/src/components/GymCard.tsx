// frontend/src/components/GymCard.tsx
"use client";

import React from "react";

export type Gym = {
  id: string;
  name: string;

  city?: string | null;
  country?: string | null;
  area?: string | null;
  slug?: string | null;

  address?: string | null;

  primary_discipline?: string | null;
  disciplines?: string[] | null;
  style_tags?: string[] | null;

  intensity_label?: string | null;
  level_label?: string | null;
  price_label?: string | null;

  is_verified?: boolean | null;

  google_maps_url?: string | null;
  website?: string | null;
};

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function buildLocation(gym: Gym) {
  const parts = [gym.area, gym.city, gym.country].filter(
    (x): x is string => typeof x === "string" && x.trim().length > 0
  );
  return parts.length ? parts.join(", ") : "Location unknown";
}

export default function GymCard({ gym }: { gym: Gym }) {
  const tags = (gym.style_tags ?? []).filter(Boolean).slice(0, 5);
  const location = buildLocation(gym);
  const discipline = (gym.primary_discipline ?? "Mixed").toString();

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-2xl border border-white/10",
        "bg-white/[0.03] backdrop-blur-xl p-5",
        "shadow-[0_18px_60px_rgba(0,0,0,0.35)]"
      )}
    >
      {/* subtle emerald glow on hover */}
      <div
        className={cn(
          "pointer-events-none absolute -inset-24 opacity-0 blur-3xl transition duration-500",
          "group-hover:opacity-100",
          "bg-[radial-gradient(circle,rgba(16,185,129,0.18),transparent_55%)]"
        )}
      />

      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-lg font-semibold text-white truncate">{gym.name}</h3>
          <div className="mt-1 text-sm text-white/65">{location}</div>

          {gym.address ? (
            <div className="mt-2 text-xs text-white/45 line-clamp-2">{gym.address}</div>
          ) : null}
        </div>

        <div className="flex flex-col items-end gap-2 shrink-0">
          {gym.is_verified ? (
            <span className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-200">
              Verified
            </span>
          ) : (
            <span className="rounded-full border border-white/10 bg-white/[0.02] px-3 py-1 text-xs text-white/55">
              Unverified
            </span>
          )}

          <span className="rounded-full border border-white/10 bg-white/[0.02] px-3 py-1 text-xs text-white/70">
            {discipline}
          </span>
        </div>
      </div>

      <div className="relative mt-4 flex flex-wrap gap-2">
        {gym.level_label ? (
          <span className="rounded-full border border-white/10 bg-white/[0.02] px-3 py-1 text-xs text-white/70">
            Level: <span className="text-white/85">{gym.level_label}</span>
          </span>
        ) : null}

        {gym.price_label ? (
          <span className="rounded-full border border-white/10 bg-white/[0.02] px-3 py-1 text-xs text-white/70">
            Price: <span className="text-white/85">{gym.price_label}</span>
          </span>
        ) : null}

        {gym.intensity_label ? (
          <span className="rounded-full border border-white/10 bg-white/[0.02] px-3 py-1 text-xs text-white/70">
            Intensity: <span className="text-white/85">{gym.intensity_label}</span>
          </span>
        ) : null}
      </div>

      {tags.length ? (
        <div className="relative mt-3 flex flex-wrap gap-2">
          {tags.map((t) => (
            <span
              key={t}
              className="rounded-full border border-emerald-400/15 bg-emerald-500/5 px-3 py-1 text-xs text-emerald-200/90"
            >
              {t}
            </span>
          ))}
        </div>
      ) : null}

      <div className="relative mt-5 flex flex-wrap items-center gap-3">
        {gym.google_maps_url ? (
          <a
            href={gym.google_maps_url}
            target="_blank"
            rel="noreferrer"
            className={cn(
              "inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold",
              "bg-emerald-400 text-slate-950 hover:bg-emerald-300 transition",
              "shadow-[0_12px_30px_rgba(16,185,129,0.18)]"
            )}
          >
            Open in Google Maps
          </a>
        ) : (
          <span className="text-xs text-white/40">No map link yet</span>
        )}

        {gym.website ? (
          <a
            href={gym.website}
            target="_blank"
            rel="noreferrer"
            className="text-sm text-white/70 underline decoration-white/20 underline-offset-4 hover:text-emerald-100 hover:decoration-emerald-400/40 transition"
          >
            Website
          </a>
        ) : null}
      </div>
    </div>
  );
}