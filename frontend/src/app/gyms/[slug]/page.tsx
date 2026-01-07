import Link from "next/link";
import { notFound } from "next/navigation";
import { gyms } from "../../../lib/gymData";

// FAIL-PROOF: we define our own "Gym" shape here.
// It will work even if gymData.ts exports ZERO types.
type Gym = {
  slug: string;
  name: string;

  city?: string | null;
  country?: string | null;

  // Optional fields your UI might reference
  photoUrl?: string | null;
  website?: string | null;
  googleMapsUrl?: string | null;

  disciplines?: string[] | null;
  tags?: string[] | null;

  verified?: boolean | null;

  rating?: number | null;
  reviewCount?: number | null;

  intensityColor?: "green" | "amber" | "red" | string | null;
  intensityLabel?: string | null;

  description?: string | null;

  reviewScores?: {
    pace: number;
    wrestlingRoom: number;
    strikingPace: number;
    coachQuality: number;
    recoveryCulture: number;
  } | null;

  reviewSummary?: string | null;
};

type GymDetailPageProps = {
  params: { slug: string };
};

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

function safeNumber(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

export default function GymDetailPage({ params }: GymDetailPageProps) {
  // gyms can be any shape in gymData.ts — we cast safely here
  const gym = (gyms as unknown as Gym[]).find((g) => g.slug === params.slug);

  if (!gym) return notFound();

  const location = [gym.city ?? "", gym.country ?? ""].filter(isNonEmptyString).join(", ");

  const disciplinesText = Array.isArray(gym.disciplines) && gym.disciplines.length
    ? gym.disciplines.filter(isNonEmptyString).join(" • ")
    : null;

  const tags = Array.isArray(gym.tags) ? gym.tags.filter(isNonEmptyString) : [];

  const rating = safeNumber(gym.rating);
  const reviewCount = safeNumber(gym.reviewCount);

  const intensityColor = (gym.intensityColor ?? "green") as string;
  const intensityLabel = gym.intensityLabel ?? "Standard";

  const intensityClass =
    intensityColor === "green"
      ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/30"
      : intensityColor === "amber"
      ? "bg-amber-500/10 text-amber-300 border-amber-500/30"
      : "bg-red-500/10 text-red-300 border-red-500/30";

  return (
    <main className="mx-auto max-w-5xl px-6 py-10 space-y-8">
      {/* Breadcrumb */}
      <div className="text-xs text-slate-400 flex items-center gap-2">
        <Link href="/gyms" className="hover:text-emerald-400 transition">
          Gyms
        </Link>
        <span>/</span>
        <span className="text-slate-200">{gym.name}</span>
      </div>

      {/* Header */}
      <section className="flex flex-col gap-6 md:flex-row md:items-start">
        {/* Photo */}
        <div className="relative w-full md:w-2/5 overflow-hidden rounded-2xl border border-slate-700 bg-slate-900/60">
          {isNonEmptyString(gym.photoUrl) ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={gym.photoUrl}
              alt={gym.name}
              className="h-64 w-full object-cover md:h-full"
            />
          ) : (
            <div className="flex h-64 items-center justify-center text-sm text-slate-500">
              No photo yet
            </div>
          )}
        </div>

        {/* Main info */}
        <div className="flex-1 space-y-4">
          <div className="space-y-1">
            <p className="text-xs tracking-widest text-emerald-400">GYM PROFILE</p>

            <h1 className="text-3xl md:text-4xl font-semibold text-slate-50">
              {gym.name}
            </h1>

            <p className="text-sm text-slate-400">
              {location || "Location unknown"}
              {disciplinesText ? ` • ${disciplinesText}` : ""}
            </p>
          </div>

          {/* Rating + verified */}
          <div className="flex flex-wrap items-center gap-3 text-sm">
            {rating !== null ? (
              <div className="flex items-center gap-1">
                <span className="text-amber-300">★</span>
                <span className="font-semibold text-slate-50">
                  {rating.toFixed(1)}
                </span>
                {reviewCount !== null ? (
                  <span className="text-xs text-slate-400">({reviewCount} reviews)</span>
                ) : null}
              </div>
            ) : (
              <span className="text-xs text-slate-500">No rating yet</span>
            )}

            {gym.verified ? (
              <span className="rounded-full border border-emerald-500/60 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300">
                Verified
              </span>
            ) : (
              <span className="rounded-full border border-slate-700 bg-slate-900/60 px-3 py-1 text-xs text-slate-300">
                Unverified
              </span>
            )}

            <span className="ml-auto inline-flex items-center rounded-full border border-slate-700 bg-slate-900/60 px-3 py-1 text-xs text-slate-300">
              Intensity:
              <span className={`ml-2 inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] ${intensityClass}`}>
                {intensityLabel}
              </span>
            </span>
          </div>

          {/* Description */}
          {isNonEmptyString(gym.description) ? (
            <p className="text-sm leading-relaxed text-slate-300">{gym.description}</p>
          ) : (
            <p className="text-sm leading-relaxed text-slate-500">
              No description yet.
            </p>
          )}

          {/* Tags */}
          {tags.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-slate-900/70 px-3 py-1 text-xs text-slate-300 border border-slate-700/70"
                >
                  {tag}
                </span>
              ))}
            </div>
          ) : null}

          {/* Links */}
          <div className="flex flex-wrap gap-3 pt-2">
            {isNonEmptyString(gym.website) ? (
              <a
                href={gym.website}
                target="_blank"
                rel="noreferrer"
                className="rounded-full bg-slate-50 px-4 py-2 text-xs font-medium text-slate-900 hover:bg-slate-200 transition"
              >
                Visit website
              </a>
            ) : null}

            {isNonEmptyString(gym.googleMapsUrl) ? (
              <a
                href={gym.googleMapsUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-full border border-slate-600 px-4 py-2 text-xs text-slate-200 hover:border-emerald-400 hover:text-emerald-200 transition"
              >
                View on Google Maps
              </a>
            ) : null}
          </div>
        </div>
      </section>

      {/* Review scores */}
      {gym.reviewScores ? (
        <section className="grid gap-4 rounded-2xl border border-slate-700 bg-slate-900/60 p-5 md:grid-cols-3">
          <ReviewPill label="Overall pace" value={gym.reviewScores.pace} />
          <ReviewPill label="Wrestling room" value={gym.reviewScores.wrestlingRoom} />
          <ReviewPill label="Striking pace" value={gym.reviewScores.strikingPace} />
          <ReviewPill label="Coach presence" value={gym.reviewScores.coachQuality} />
          <ReviewPill label="Recovery culture" value={gym.reviewScores.recoveryCulture} />
        </section>
      ) : null}

      {/* Summary */}
      {isNonEmptyString(gym.reviewSummary) ? (
        <section className="rounded-2xl border border-slate-700 bg-slate-900/60 p-6 space-y-2">
          <h2 className="text-sm font-semibold text-slate-100">Camp notes / summary</h2>
          <p className="text-sm text-slate-300">{gym.reviewSummary}</p>
        </section>
      ) : null}
    </main>
  );
}

function ReviewPill({ label, value }: { label: string; value: number }) {
  const safe = typeof value === "number" && Number.isFinite(value) ? value : 0;
  const clamped = Math.max(0, Math.min(5, safe));
  const percent = (clamped / 5) * 100;

  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-400">{label}</p>
      <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
        <div className="h-full rounded-full bg-emerald-400" style={{ width: `${percent}%` }} />
      </div>
      <p className="text-xs text-slate-300">{clamped.toFixed(1)} / 5</p>
    </div>
  );
}
