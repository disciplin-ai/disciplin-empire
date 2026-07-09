"use client";

import React, { useEffect, useMemo, useState } from "react";

type Disc = "MMA" | "Wrestling" | "Boxing" | "Sambo" | "BJJ" | "Fitness";

type ApiGym = {
  id?: string;
  name?: string;
  city?: string;
  country?: string;
  address?: string;
  is_verified?: boolean;
  verified?: boolean;
  disciplines?: string[];
  disc?: Disc;
  level?: string;
  price?: string;
  intensity?: string;
  tags?: string[];
  maps?: string;
  website?: string;
};

type SenseiGym = {
  id: string;
  name: string;
  location: string;
  compatibility: number;
  disciplineMatch: string[];
  styleMatch: string[];
  watchOut: string[];
  href?: string;
  verified: boolean;
};

const SENSEI_GYMS_KEY = "disciplin_connected_gyms";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function clean(input: unknown): string {
  return String(input ?? "").replace(/\s+/g, " ").trim();
}

function getDisciplines(gym: ApiGym): string[] {
  if (Array.isArray(gym.disciplines)) return gym.disciplines.filter(Boolean);
  if (gym.disc) return [gym.disc];
  return [];
}

function compatibilityScore(gym: ApiGym): number {
  const disciplines = getDisciplines(gym).map((d) => d.toLowerCase());
  const tags = Array.isArray(gym.tags) ? gym.tags.map((t) => t.toLowerCase()) : [];

  let score = 45;

  if (gym.is_verified || gym.verified) score += 10;
  if (disciplines.includes("wrestling")) score += 30;
  if (disciplines.includes("mma")) score += 15;
  if (disciplines.includes("sambo")) score += 15;
  if (clean(gym.intensity).toLowerCase() === "hard") score += 15;
  if (tags.some((t) => t.includes("competition"))) score += 10;
  if (tags.some((t) => t.includes("wrestling"))) score += 10;

  return Math.min(score, 100);
}

function toSenseiGym(gym: ApiGym): SenseiGym {
  const disciplines = getDisciplines(gym);
  const tags = Array.isArray(gym.tags) ? gym.tags : [];

  return {
    id:
      clean(gym.id) ||
      clean(gym.name).toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    name: clean(gym.name) || "Unnamed gym",
    location: [clean(gym.city), clean(gym.country)].filter(Boolean).join(", "),
    compatibility: compatibilityScore(gym),
    disciplineMatch: disciplines,
    styleMatch: [
      gym.intensity ? `Intensity: ${gym.intensity}` : "",
      gym.level ? `Level: ${gym.level}` : "",
      ...tags,
    ].filter(Boolean),
    watchOut: [
      gym.price ? `Price: ${gym.price}` : "",
      gym.address ? `Address: ${gym.address}` : "",
    ].filter(Boolean),
    href: clean(gym.maps) || clean(gym.website) || "",
    verified: !!(gym.is_verified || gym.verified),
  };
}

function saveGymsForSensei(gyms: ApiGym[]) {
  const senseiGyms = gyms.map(toSenseiGym);

  try {
    window.localStorage.setItem(SENSEI_GYMS_KEY, JSON.stringify(senseiGyms));
    window.dispatchEvent(new Event("disciplin:gyms-updated"));
  } catch {
    // ignore localStorage failures
  }
}

export default function GymsClient() {
  const [q, setQ] = useState("");
  const [onlyVerified, setOnlyVerified] = useState(false);
  const [disc, setDisc] = useState<"All" | Disc>("All");
  const [gyms, setGyms] = useState<ApiGym[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadGyms() {
      try {
        setLoading(true);
        setError("");

        const params = new URLSearchParams();
        if (q.trim()) params.set("q", q.trim());
        if (disc !== "All") params.set("discipline", disc);
        if (onlyVerified) params.set("verified", "true");

        const res = await fetch(`/api/gyms?${params.toString()}`, {
          cache: "no-store",
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data?.error || "Failed to load gyms");
        }

        const loaded = Array.isArray(data?.gyms) ? data.gyms : [];

        if (!cancelled) {
          setGyms(loaded);
          saveGymsForSensei(loaded);
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message || "Failed to load gyms");
          setGyms([]);
          saveGymsForSensei([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadGyms();

    return () => {
      cancelled = true;
    };
  }, [q, onlyVerified, disc]);

  const discs: Array<"All" | Disc> = [
    "All",
    "MMA",
    "Wrestling",
    "Boxing",
    "Sambo",
    "BJJ",
    "Fitness",
  ];

  const visibleGyms = useMemo(() => gyms, [gyms]);

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-slate-50">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="rounded-3xl border border-slate-800 bg-slate-900/40 p-4">
          <div className="flex items-center gap-3">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by city, gym, or country..."
              className="flex-1 rounded-2xl border border-slate-800 bg-slate-950/50 px-4 py-3 text-sm outline-none focus:border-emerald-400/50"
            />

            <label className="flex items-center gap-2 text-xs text-slate-300">
              <input
                type="checkbox"
                checked={onlyVerified}
                onChange={(e) => setOnlyVerified(e.target.checked)}
              />
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
                    "rounded-full border px-3 py-1 text-xs",
                    on
                      ? "border-emerald-400 bg-emerald-500/10 text-emerald-200"
                      : "border-slate-800 bg-slate-950/40 text-slate-300"
                  )}
                >
                  {d === "All" ? "All disciplines" : d}
                </button>
              );
            })}
          </div>
        </div>

        {loading ? (
          <div className="rounded-3xl border border-slate-800 bg-slate-900/40 p-6 text-sm text-slate-300">
            Loading gyms...
          </div>
        ) : null}

        {error ? (
          <div className="rounded-3xl border border-rose-500/30 bg-rose-500/10 p-6 text-sm text-rose-200">
            {error}
          </div>
        ) : null}

        {!loading && !error && visibleGyms.length === 0 ? (
          <div className="rounded-3xl border border-slate-800 bg-slate-900/40 p-6 text-sm text-slate-300">
            No gyms found.
          </div>
        ) : null}

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {visibleGyms.map((g) => {
            const disciplines = getDisciplines(g);
            const verified = !!(g.is_verified || g.verified);

            return (
              <div
                key={clean(g.id) || clean(g.name)}
                className="rounded-3xl border border-slate-800 bg-slate-900/40 p-6"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold">
                      {clean(g.name) || "Unnamed gym"}
                    </h3>
                    <p className="text-sm text-slate-400">
                      {[clean(g.city), clean(g.country)].filter(Boolean).join(", ")}
                    </p>

                    {g.address ? (
                      <p className="mt-2 text-xs text-slate-500">{g.address}</p>
                    ) : null}
                  </div>

                  <div className="space-y-2 text-right">
                    {verified ? (
                      <span className="inline-block rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-200">
                        Verified
                      </span>
                    ) : null}

                    {disciplines[0] ? (
                      <span className="inline-block rounded-full border border-slate-700 bg-slate-950/30 px-3 py-1 text-xs text-slate-200">
                        {disciplines[0]}
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {g.level ? (
                    <span className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-200">
                      Level: {g.level}
                    </span>
                  ) : null}

                  {g.price ? (
                    <span className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-200">
                      Price: {g.price}
                    </span>
                  ) : null}

                  {g.intensity ? (
                    <span className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-200">
                      Intensity: {g.intensity}
                    </span>
                  ) : null}
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {(g.tags ?? []).map((t) => (
                    <span
                      key={t}
                      className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-100"
                    >
                      {t}
                    </span>
                  ))}
                </div>

                <div className="mt-5 flex items-center gap-3">
                  <a
                    href={g.maps ?? "#"}
                    target="_blank"
                    className={cn(
                      "flex-1 rounded-full px-4 py-2 text-center text-sm font-semibold",
                      g.maps
                        ? "bg-emerald-500 text-slate-950 hover:bg-emerald-400"
                        : "cursor-not-allowed bg-white/10 text-white/40"
                    )}
                    rel="noreferrer"
                  >
                    Open in Google Maps
                  </a>

                  <a
                    className="text-sm text-slate-300 underline"
                    href={g.website ?? "#"}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Website
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}