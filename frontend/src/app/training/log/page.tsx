// frontend/src/app/training/log/page.tsx

import Link from "next/link";

export default function TrainingLogPage() {
  return (
    <div className="space-y-6 max-w-3xl">
      <div className="space-y-1">
        <p className="title-label">Training</p>
        <h1 className="text-2xl font-semibold text-white">Log today&apos;s session</h1>
        <p className="text-sm text-slate-400">
          Keep it simple: focus, rounds, intensity and anything Sensei should
          know about this day.
        </p>
      </div>

      <form className="os-card space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="block text-xs font-semibold text-slate-300">
              Focus
            </label>
            <input
              className="input"
              placeholder="Wrestling chains, boxing sparring, conditioning..."
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-300">
              Rounds / duration
            </label>
            <input className="input" placeholder="10 x 3min, 5km run, etc." />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="block text-xs font-semibold text-slate-300">
              Intensity (RPE 1–10)
            </label>
            <input className="input" placeholder="7 / 10" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-300">
              Camp week / block
            </label>
            <input className="input" placeholder="Week 3 – pressure blocks" />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300">
            Notes for future you / Sensei
          </label>
          <textarea
            className="input h-28"
            placeholder="Felt heavy in rounds 3–4, pace dipped, need more roadwork..."
          />
        </div>

        <div className="flex items-center justify-between pt-2">
          <Link href="/dashboard" className="text-xs text-slate-400 hover:text-slate-200">
            ← Back to dashboard
          </Link>
          <button type="button" className="btn-primary text-sm">
            Save session (stub)
          </button>
        </div>
      </form>
    </div>
  );
}
