"use client";

import React, { useMemo, useState } from "react";

type Disc = "MMA" | "Wrestling" | "Boxing" | "Sambo" | "BJJ" | "Fitness";
type Gym = {
  name: string;
  city: string;
  country: string;
  verified?: boolean;
  disc: Disc;
  address?: string;
  level?: string;
  price?: string;
  intensity?: string;
  tags?: string[];
  maps?: string;
  website?: string;
};

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

const SAMPLE: Gym[] = [
  { name: "UFC Gym JBR", city: "Dubai", country: "UAE", verified: true, disc: "MMA", address: "Jumeirah Beach Residence, Dubai", level: "All levels", price: "$$", intensity: "Moderate", tags: ["franchise", "fitness", "classes"], maps: "https://maps.google.com" },
  { name: "Renzo Gracie Dubai", city: "Dubai", country: "UAE", verified: true, disc: "BJJ", address: "Dubai", level: "Mixed", price: "$$$", intensity: "Moderate", tags: ["bjj", "grappling"], maps: "https://maps.google.com" },
  { name: "Kuma Team", city: "Dubai", country: "UAE", verified: true, disc: "Wrestling", address: "Al Quoz, Dubai", level: "All levels", price: "$$", intensity: "Hard", tags: ["wrestling-heavy", "sambo", "competition"] },
];

export default function GymsClient() {
  const [q, setQ] = useState("");
  const [onlyVerified, setOnlyVerified] = useState(false);
  const [disc, setDisc] = useState<"All" | Disc>("All");

  const filtered = useMemo(() => {
    return SAMPLE.filter((g) => {
      if (onlyVerified && !g.verified) return false;
      if (disc !== "All" && g.disc !== disc) return false;
      const hay = `${g.name} ${g.city} ${g.country} ${g.address ?? ""}`.toLowerCase();
      return hay.includes(q.toLowerCase());
    });
  }, [q, onlyVerified, disc]);

  const discs: Array<"All" | Disc> = ["All", "MMA", "Wrestling", "Boxing", "Sambo", "BJJ", "Fitness"];

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 px-6 py-10">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Search bar */}
        <div className="rounded-3xl border border-slate-800 bg-slate-900/40 p-4">
          <div className="flex items-center gap-3">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by city, gym, or country..."
              className="flex-1 rounded-2xl border border-slate-800 bg-slate-950/50 px-4 py-3 text-sm outline-none focus:border-emerald-400/50"
            />
            <label className="flex items-center gap-2 text-xs text-slate-300">
              <input type="checkbox" checked={onlyVerified} onChange={(e) => setOnlyVerified(e.target.checked)} />
              Only verified
            </label>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {discs.map((d) => {
              const on = d === disc;
              return (
                <button
                  key={d}
                  onClick={() => setDisc(d)}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs border",
                    on ? "border-emerald-400 bg-emerald-500/10 text-emerald-200" : "border-slate-800 bg-slate-950/40 text-slate-300"
                  )}
                >
                  {d === "All" ? "All disciplines" : d}
                </button>
              );
            })}
          </div>
        </div>

        {/* Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((g) => (
            <div key={g.name} className="rounded-3xl border border-slate-800 bg-slate-900/40 p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold">{g.name}</h3>
                  <p className="text-sm text-slate-400">
                    {g.city}, {g.country}
                  </p>
                  {g.address && <p className="mt-2 text-xs text-slate-500">{g.address}</p>}
                </div>
                <div className="space-y-2 text-right">
                  {g.verified && (
                    <span className="inline-block rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-200">
                      Verified
                    </span>
                  )}
                  <span className="inline-block rounded-full border border-slate-700 bg-slate-950/30 px-3 py-1 text-xs text-slate-200">
                    {g.disc}
                  </span>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {g.level && <span className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-200">Level: {g.level}</span>}
                {g.price && <span className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-200">Price: {g.price}</span>}
                {g.intensity && <span className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-200">Intensity: {g.intensity}</span>}
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {(g.tags ?? []).map((t) => (
                  <span key={t} className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-100">
                    {t}
                  </span>
                ))}
              </div>

              <div className="mt-5 flex items-center gap-3">
                <a
                  href={g.maps ?? "#"}
                  target="_blank"
                  className={cn(
                    "flex-1 text-center rounded-full px-4 py-2 text-sm font-semibold",
                    g.maps ? "bg-emerald-500 text-slate-950 hover:bg-emerald-400" : "bg-white/10 text-white/40 cursor-not-allowed"
                  )}
                  rel="noreferrer"
                >
                  Open in Google Maps
                </a>
                <a className="text-sm text-slate-300 underline" href={g.website ?? "#"} target="_blank" rel="noreferrer">
                  Website
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}