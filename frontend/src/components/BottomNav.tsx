"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

const items = [
  {
    href: "/sensei-vision",
    label: "Vision",
    symbol: "⌖",
  },
  {
    href: "/sensei",
    label: "Sensei",
    symbol: "⌘",
  },
  {
    href: "/fuel",
    label: "Fuel",
    symbol: "ϟ",
  },
  {
    href: "/dashboard",
    label: "Dashboard",
    symbol: "◎",
  },
  {
    href: "/legal/safety",
    label: "Safety/Data",
    symbol: "◇",
  },
];

function isActive(pathname: string | null, href: string) {
  if (!pathname) return href === "/dashboard";

  if (href === "/dashboard") {
    return pathname === "/" || pathname.startsWith("/dashboard");
  }

  if (href === "/legal/safety") {
    return pathname.startsWith("/legal");
  }

  return pathname.startsWith(href);
}

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-[#020810]/92 px-2 pb-[max(env(safe-area-inset-bottom),8px)] pt-2 backdrop-blur-xl">
      <div className="mx-auto grid max-w-4xl grid-cols-5">
        {items.map((item) => {
          const active = isActive(pathname, item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className="group flex min-w-0 flex-col items-center justify-center gap-1 py-1.5 text-center transition active:scale-[0.96]"
            >
              <div
                className={cn(
                  "text-[17px] font-semibold leading-none transition",
                  active ? "text-white" : "text-white/38 group-hover:text-white/70"
                )}
              >
                {item.symbol}
              </div>

              <div
                className={cn(
                  "max-w-full truncate text-[10px] font-semibold leading-none transition",
                  active ? "text-white" : "text-white/42 group-hover:text-white/70"
                )}
              >
                {item.label}
              </div>

              <div
                className={cn(
                  "mt-0.5 h-1 w-1 rounded-full transition",
                  active ? "bg-white" : "bg-transparent"
                )}
              />
            </Link>
          );
        })}
      </div>
    </nav>
  );
}