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
  return "Dashboard";
}

export default function Navbar() {
  const pathname = usePathname();
  const label = pageLabel(pathname);

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-[#020817]/85 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href="/dashboard"
            className="shrink-0 text-[14px] font-semibold tracking-[0.32em] text-emerald-300"
          >
            DISCIPLIN
          </Link>

          <div className="h-5 w-px bg-white/10" />

          <div className="truncate text-sm text-white/65">{label}</div>
        </div>

        <div className="flex items-center gap-3">
          <UserChip />
        </div>
      </div>
    </header>
  );
}