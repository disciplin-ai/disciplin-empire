"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import UserChip from "./UserChip";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

const nav = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/fuel", label: "Fuel AI" },
  { href: "/sensei", label: "Sensei AI" },
  { href: "/sensei-vision", label: "Sensei Vision" },
  { href: "/gyms", label: "Gyms" },
  { href: "/profile", label: "Profile" },
  { href: "/membership", label: "Membership" },
];

export default function Navbar() {
  const pathname = usePathname();

  return (
    <header className="fixed top-0 z-50 w-full border-b border-slate-800/70 bg-slate-950/70 backdrop-blur-xl">
      <div className="mx-auto max-w-6xl px-4 md:px-6 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 md:gap-6">
          <Link
            href="/"
            className="text-emerald-300 font-semibold tracking-[0.28em] text-xs md:text-sm"
          >
            DISCIPLIN
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {nav.map((item) => {
              const active =
                pathname === item.href ||
                (item.href !== "/" && pathname?.startsWith(item.href));

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "relative px-3 py-2 rounded-full text-sm transition",
                    active
                      ? "text-emerald-200 bg-emerald-500/10 border border-emerald-500/25"
                      : "text-slate-200/85 hover:text-emerald-200 hover:bg-slate-900/40"
                  )}
                >
                  {item.label}
                  {active && (
                    <span className="absolute -bottom-0.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-emerald-400" />
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        <UserChip loginHref="/auth" />
      </div>

      {/* Mobile nav (simple, still polished) */}
      <div className="md:hidden border-t border-slate-800/60 bg-slate-950/40">
        <div className="mx-auto max-w-6xl px-4 py-2 flex gap-2 overflow-x-auto">
          {nav.map((item) => {
            const active =
              pathname === item.href ||
              (item.href !== "/" && pathname?.startsWith(item.href));

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "shrink-0 px-3 py-1.5 rounded-full text-xs border transition",
                  active
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                    : "border-slate-800 bg-slate-950/40 text-slate-300 hover:border-emerald-400/30"
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>
    </header>
  );
}