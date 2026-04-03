"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

const NAV_ITEMS = [
  { href: "/dashboard", label: "Home" },
  { href: "/sensei-vision", label: "Vision" },
  { href: "/sensei", label: "Sensei" },
  { href: "/fuel", label: "Fuel" },
  { href: "/profile", label: "Profile" },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="app-bottom-nav">
      <div className="mx-auto grid h-full max-w-xl grid-cols-5 items-center px-2">
        {NAV_ITEMS.map((item) => {
          const active =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname?.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex h-full flex-col items-center justify-center rounded-2xl px-2 text-[11px] font-medium transition",
                active
                  ? "text-emerald-200"
                  : "text-white/50 hover:text-white/80"
              )}
            >
              <span
                className={cn(
                  "mb-1 h-1.5 w-1.5 rounded-full transition",
                  active ? "bg-emerald-300" : "bg-white/15"
                )}
              />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}