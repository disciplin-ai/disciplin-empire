"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import UserChip from "./UserChip";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

const nav = [
  { href: "/dashboard", label: "Dashboard", short: "Dash" },
  { href: "/fuel", label: "Fuel AI", short: "Fuel" },
  { href: "/sensei", label: "Sensei AI", short: "Sensei" },
  { href: "/sensei-vision", label: "Sensei Vision", short: "Vision" },
  { href: "/gyms", label: "Gyms", short: "Gyms" },
  { href: "/profile", label: "Profile", short: "Profile" },
  { href: "/membership", label: "Membership", short: "Pro" },
];

function isActive(pathname: string | null, href: string) {
  if (!pathname) return false;
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/") || pathname.startsWith(href);
}

export default function Navbar() {
  const pathname = usePathname();

  return (
    <header className="fixed top-0 z-50 w-full border-b border-slate-800/70 bg-slate-950/70 backdrop-blur-xl">
      {/* Top row */}
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 sm:gap-6">
          <Link
            href="/"
            className="text-emerald-300 font-semibold tracking-[0.28em] text-xs sm:text-sm select-none"
          >
            DISCIPLIN
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1">
            {nav.map((item) => {
              const active = isActive(pathname, item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "relative px-3 py-2 rounded-full text-sm transition",
                    "border border-transparent",
                    active
                      ? "text-emerald-200 bg-emerald-500/10 border-emerald-500/25"
                      : "text-slate-200/85 hover:text-emerald-200 hover:bg-slate-900/40 hover:border-slate-700/50"
                  )}
                >
                  {item.label}
                  {/* Active underline glow (cleaner than dot) */}
                  {active && (
                    <span className="pointer-events-none absolute inset-x-3 -bottom-[6px] h-[2px] rounded-full bg-emerald-400/80 shadow-[0_0_10px_rgba(52,211,153,0.35)]" />
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <UserChip loginHref="/auth" />
        </div>
      </div>

      {/* Mobile module bar (compact + premium) */}
      <div className="md:hidden border-t border-slate-800/60 bg-slate-950/40">
        <div className="mx-auto max-w-6xl px-4 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2">
          <div className="flex gap-2 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {nav.map((item) => {
              const active = isActive(pathname, item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "shrink-0 rounded-full px-3 py-1.5 text-xs border transition",
                    "flex items-center gap-2",
                    active
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                      : "border-slate-800 bg-slate-950/40 text-slate-300 hover:border-slate-700/70"
                  )}
                >
                  <span className="font-medium">{item.short ?? item.label}</span>
                </Link>
              );
            })}
          </div>

          {/* Tiny hint line (optional but makes it feel “OS”) */}
          <div className="mt-2 text-[10px] tracking-wide text-slate-500">
            Modules • Swipe to navigate
          </div>
        </div>
      </div>
    </header>
  );
}