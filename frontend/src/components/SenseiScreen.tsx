"use client";

export default function SenseiScreen() {
  const loading = false;

  if (loading) {
    return (
      <div className="animate-pulse space-y-4 p-6 rounded-xl bg-slate-900/50 border border-slate-800">
        <div className="h-5 bg-slate-700 rounded w-1/3"></div>
        <div className="h-10 bg-slate-800 rounded"></div>
        <div className="h-32 bg-slate-800 rounded"></div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-slate-900/50 rounded-xl border border-slate-800">
      Sensei AI will run here.
    </div>
  );
}
