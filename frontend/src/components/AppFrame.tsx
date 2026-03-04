"use client";

import React from "react";
import Navbar from "./Navbar";

export default function AppFrame({
  children,
  showNavbar = true,
}: {
  children: React.ReactNode;
  showNavbar?: boolean;
}) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      {/* Optional glow layer */}
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute -top-24 left-1/2 h-[520px] w-[920px] -translate-x-1/2 rounded-full bg-emerald-500/10 blur-[120px]" />
        <div className="absolute top-40 left-24 h-[360px] w-[360px] rounded-full bg-white/5 blur-[90px]" />
      </div>

      {showNavbar && <Navbar />}

      {/* If navbar is on, offset content. If off, no offset. */}
      <main className={`relative px-6 pb-10 ${showNavbar ? "pt-28 md:pt-20" : "pt-10"}`}>
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}