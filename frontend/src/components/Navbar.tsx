"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import UserChip from "./UserChip";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

const NAV_ITEMS = [
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
    <header className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-[#020817]/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 md:px-6">
        <div className="flex items-center gap-8">
          <Link
            href="/dashboard"
            className="text-[15px] font-semibold tracking-[0.28em] text-emerald-300"
          >
            DISCIPLIN
          </Link>

          <nav className="hidden items-center gap-2 md:flex">
            {NAV_ITEMS.map((item) => {
              const active =
                pathname === item.href ||
                (item.href !== "/dashboard" && pathname?.startsWith(item.href));

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "rounded-full px-4 py-2 text-sm transition",
                    active
                      ? "bg-emerald-500/15 text-white ring-1 ring-emerald-400/30"
                      : "text-white/75 hover:bg-white/5 hover:text-white"
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <UserChip />
        </div>
      </div>
    </header>
  );
}