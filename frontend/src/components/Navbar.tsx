"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import UserChip from "./UserChip";

function pageLabel(pathname: string | null) {
  if (!pathname) return "Dashboard";
  if (pathname.startsWith("/sensei-vision")) return "Vision";
  if (pathname.startsWith("/sensei")) return "Sensei";
  if (pathname.startsWith("/fuel")) return "Fuel";
  if (pathname.startsWith("/profile")) return "Profile";
  if (pathname.startsWith("/gyms")) return "Gyms";
  if (pathname.startsWith("/membership")) return "Membership";
  if (pathname.startsWith("/legal")) return "Legal";
  return "Dashboard";
}

export default function Navbar() {
  const pathname = usePathname();
  const label = pageLabel(pathname);

  return (
    <header className="app-nav-surface fixed inset-x-0 top-0 z-50 border-x-0 border-t-0 pt-[env(safe-area-inset-top)]">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href="/dashboard"
            className="app-brand shrink-0"
          >
            DISCIPLIN
          </Link>

          <div className="hidden h-5 w-px bg-white/10 sm:block" />

          <div className="hidden truncate text-sm font-medium text-white/58 sm:block">{label}</div>
        </div>

        <div className="hidden items-center gap-4 md:flex">
          <Link
            href="/legal/data"
            className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/35 transition hover:text-emerald-200"
          >
            Data
          </Link>

          <Link
            href="/legal/safety"
            className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/35 transition hover:text-rose-200"
          >
            Safety
          </Link>

          <UserChip />
        </div>

        <div className="flex items-center md:hidden">
          <UserChip compact />
        </div>
      </div>
    </header>
  );
}
