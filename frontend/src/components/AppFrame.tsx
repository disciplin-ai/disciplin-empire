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
    <div className="app-canvas min-h-screen overflow-visible">
      {showNavbar && <Navbar />}

      <main className={`relative px-6 pb-10 ${showNavbar ? "pt-28 md:pt-20" : "pt-10"}`}>
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
