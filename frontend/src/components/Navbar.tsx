"use client";

import Link from "next/link";
import UserChip from "./UserChip";

export default function Navbar() {
  return (
    <header className="w-full border-b border-slate-800 bg-slate-950/70 backdrop-blur">
      <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link
            href="/"
            className="text-emerald-300 font-semibold tracking-[0.2em] text-xs"
          >
            DISCIPLIN
          </Link>

          <nav className="flex items-center gap-5 text-sm text-slate-200">
            <Link href="/dashboard" className="hover:text-emerald-200">
              Dashboard
            </Link>
            <Link href="/fuel" className="hover:text-emerald-200">
              Fuel AI
            </Link>
            <Link href="/sensei" className="hover:text-emerald-200">
              Sensei AI
            </Link>
            <Link href="/sensei-vision" className="hover:text-emerald-200">
              Sensei Vision
            </Link>
            <Link href="/gyms" className="hover:text-emerald-200">
              Gyms
            </Link>
            <Link href="/profile" className="hover:text-emerald-200">
              Profile
            </Link>
            <Link href="/membership" className="hover:text-emerald-200">
              Membership
            </Link>
          </nav>
        </div>

        {/* Right side chip */}
        <UserChip loginHref="/auth" />
      </div>
    </header>
  );
}
