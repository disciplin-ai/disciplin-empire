import React from "react";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export default function AppShell({
  title,
  subtitle,
  badge,
  right,
  children,
  className,
}: {
  title?: string;
  subtitle?: string;
  badge?: React.ReactNode;
  right?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-4 px-4 sm:px-6">
      {(title || subtitle || right) && (
        <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#041026] via-[#030b18] to-[#020810] p-5 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              {badge && (
                <div className="text-[10px] font-semibold uppercase tracking-[0.3em] text-emerald-300">
                  {badge}
                </div>
              )}

              {title && (
                <h1 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-white">
                  {title}
                </h1>
              )}

              {subtitle && (
                <p className="mt-2 max-w-2xl text-sm leading-6 text-white/50">
                  {subtitle}
                </p>
              )}
            </div>

            {right && <div className="shrink-0">{right}</div>}
          </div>
        </div>
      )}

      <div className={cn("space-y-4", className)}>{children}</div>
    </div>
  );
}