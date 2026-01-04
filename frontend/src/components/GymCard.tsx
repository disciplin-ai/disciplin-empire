"use client";

import React from "react";

export type Gym = {
  id: string;
  name: string;
  city: string;
  country: string;

  // optional fields (API may or may not return them)
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;

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

export default function GymCard({ gym }: { gym: Gym }) {
  const tags = (gym.style_tags ?? []).slice(0, 4);

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 shadow-[0_10px_30px_rgba(0,0,0,0.25)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-white">{gym.name}</h3>
          <div className="mt-1 text-sm text-white/65">
            {gym.city}, {gym.country}
          </div>
          {gym.address ? (
            <div className="mt-2 text-xs text-white/45">{gym.address}</div>
          ) : null}
        </div>

        <div className="flex flex-col items-end gap-2">
          {gym.is_verified ? (
            <span className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-200">
              Verified
            </span>
          ) : (
            <span className="rounded-full border border-white/10 bg-white/[0.02] px-3 py-1 text-xs text-white/55">
              Unverified
            </span>
          )}

          <span className="rounded-full border border-white/10 bg-white/[0.02] px-3 py-1 text-xs text-white/70">
            {(gym.primary_discipline || "Mixed").toString()}
          </span>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {gym.level_label ? (
          <span className="rounded-full border border-white/10 bg-white/[0.02] px-3 py-1 text-xs text-white/70">
            Level: {gym.level_label}
          </span>
        ) : null}

        {gym.price_label ? (
          <span className="rounded-full border border-white/10 bg-white/[0.02] px-3 py-1 text-xs text-white/70">
            Price: {gym.price_label}
          </span>
        ) : null}

        {gym.intensity_label ? (
          <span className="rounded-full border border-white/10 bg-white/[0.02] px-3 py-1 text-xs text-white/70">
            Intensity: {gym.intensity_label}
          </span>
        ) : null}
      </div>

      {tags.length ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {tags.map((t) => (
            <span
              key={t}
              className="rounded-full border border-emerald-500/15 bg-emerald-500/5 px-3 py-1 text-xs text-emerald-200/90"
            >
              {t}
            </span>
          ))}
        </div>
      ) : null}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        {gym.google_maps_url ? (
          <a
            href={gym.google_maps_url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-black hover:bg-emerald-400"
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
            className={cn(
              "text-sm text-white/70 underline decoration-white/20 underline-offset-4",
              "hover:text-white"
            )}
          >
            Website
          </a>
        ) : null}
      </div>
    </div>
  );
}
