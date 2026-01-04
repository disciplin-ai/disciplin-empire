import { notFound } from "next/navigation";
import type { Gym } from "../../../lib/gymData";
import { gyms } from "../../../lib/gymData";

type GymDetailPageProps = {
  params: { slug: string };
};

export default function GymDetailPage({ params }: GymDetailPageProps) {
  const gym = gyms.find((g) => g.slug === params.slug);

  if (!gym) {
    notFound();
  }

  return (
    <main className="max-w-5xl mx-auto px-6 py-10 space-y-8">
      {/* Breadcrumb */}
      <div className="text-xs text-slate-400 flex items-center gap-2">
        <a href="/gyms" className="hover:text-emerald-400 transition">
          Gyms
        </a>
        <span>/</span>
        <span className="text-slate-300">{gym.name}</span>
      </div>

      {/* Header */}
      <section className="flex flex-col gap-6 md:flex-row md:items-start">
        {/* Photo */}
        <div className="relative w-full md:w-2/5 overflow-hidden rounded-2xl border border-slate-700 bg-slate-900/60">
          {gym.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={gym.photoUrl}
              alt={gym.name}
              className="h-64 w-full object-cover md:h-full"
            />
          ) : (
            <div className="flex h-64 items-center justify-center text-sm text-slate-500">
              No photo yet – this will be your grind room screenshot.
            </div>
          )}
        </div>

        {/* Main info */}
        <div className="flex-1 space-y-4">
          <div className="space-y-1">
            <p className="text-xs tracking-widest text-emerald-400">
              GYM PROFILE
            </p>
            <h1 className="text-3xl md:text-4xl font-semibold text-slate-50">
              {gym.name}
            </h1>
            <p className="text-sm text-slate-400">
              {gym.city}, {gym.country} • {gym.disciplines.join(" • ")}
            </p>
          </div>

          {/* Rating + verified */}
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <div className="flex items-center gap-1">
              <span className="text-amber-300">★</span>
              <span className="font-semibold text-slate-50">
                {gym.rating.toFixed(1)}
              </span>
              <span className="text-xs text-slate-400">
                ({gym.reviewCount} reviews)
              </span>
            </div>

            {gym.verified && (
              <span className="rounded-full border border-emerald-500/60 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300">
                Verified grind room
              </span>
            )}

            <span className="ml-auto inline-flex items-center rounded-full bg-slate-900/60 px-3 py-1 text-xs text-slate-300 border border-slate-700">
              Intensity:{" "}
              <span
                className={`ml-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] ${
                  gym.intensityColor === "green"
                    ? "bg-emerald-500/10 text-emerald-300"
                    : gym.intensityColor === "amber"
                    ? "bg-amber-500/10 text-amber-300"
                    : "bg-red-500/10 text-red-300"
                }`}
              >
                {gym.intensityLabel}
              </span>
            </span>
          </div>

          {/* Description */}
          <p className="text-sm leading-relaxed text-slate-300">
            {gym.description}
          </p>

          {/* Tags */}
          {gym.tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {gym.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-slate-900/70 px-3 py-1 text-xs text-slate-300 border border-slate-700/70"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Links */}
          <div className="flex flex-wrap gap-3 pt-2">
            {gym.website && (
              <a
                href={gym.website}
                target="_blank"
                rel="noreferrer"
                className="rounded-full bg-slate-50 px-4 py-2 text-xs font-medium text-slate-900 hover:bg-slate-200 transition"
              >
                Visit website
              </a>
            )}
            {gym.googleMapsUrl && (
              <a
                href={gym.googleMapsUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-full border border-slate-600 px-4 py-2 text-xs text-slate-200 hover:border-emerald-400 hover:text-emerald-200 transition"
              >
                View on Google Maps
              </a>
            )}
          </div>
        </div>
      </section>

      {/* Review scores */}
      {gym.reviewScores && (
        <section className="grid gap-4 rounded-2xl border border-slate-700 bg-slate-900/60 p-5 md:grid-cols-4">
          <ReviewPill label="Overall pace" value={gym.reviewScores.pace} />
          <ReviewPill
            label="Wrestling room"
            value={gym.reviewScores.wrestlingRoom}
          />
          <ReviewPill
            label="Striking pace"
            value={gym.reviewScores.strikingPace}
          />
          <ReviewPill
            label="Coach presence"
            value={gym.reviewScores.coachQuality}
          />
          <ReviewPill
            label="Recovery culture"
            value={gym.reviewScores.recoveryCulture}
          />
        </section>
      )}

      {/* Notes / summary */}
      {gym.reviewSummary && (
        <section className="rounded-2xl border border-slate-700 bg-slate-900/60 p-6 space-y-2">
          <h2 className="text-sm font-semibold text-slate-100">
            Camp notes / summary
          </h2>
          <p className="text-sm text-slate-300">{gym.reviewSummary}</p>
        </section>
      )}
    </main>
  );
}

type ReviewPillProps = {
  label: string;
  value: number; // 1–5
};

function ReviewPill({ label, value }: ReviewPillProps) {
  const percent = (value / 5) * 100;

  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-400">{label}</p>
      <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
        <div
          className="h-full rounded-full bg-emerald-400"
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className="text-xs text-slate-300">{value.toFixed(1)} / 5</p>
    </div>
  );
}
