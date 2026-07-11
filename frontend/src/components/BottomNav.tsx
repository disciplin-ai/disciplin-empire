"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";

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
    href: "/dashboard",
    label: "Dashboard",
    symbol: "◎",
  },
  {
    href: "/fuel",
    label: "Fuel",
    symbol: "ϟ",
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
    <nav className="fixed inset-x-0 bottom-0 z-50 px-3 pb-[max(env(safe-area-inset-bottom),10px)]">
      <div className="mx-auto max-w-3xl rounded-[30px] border border-white/10 bg-[#0b111a]/88 p-1.5 shadow-[0_24px_80px_rgba(0,0,0,0.55)] backdrop-blur-2xl">
        <div className="grid grid-cols-5 gap-1">
          {items.map((item) => {
            const active = isActive(pathname, item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className="relative flex min-w-0 items-center justify-center"
              >
                {active && (
                  <motion.div
                    layoutId="bottom-nav-active"
                    className="absolute inset-0 rounded-[24px] bg-white shadow-[0_10px_35px_rgba(255,255,255,0.16)]"
                    transition={{
                      type: "spring",
                      stiffness: 420,
                      damping: 34,
                      mass: 0.8,
                    }}
                  />
                )}

                <motion.div
                  whileTap={{ scale: 0.94 }}
                  className={cn(
                    "relative z-10 flex h-[58px] w-full flex-col items-center justify-center gap-1 rounded-[24px] text-center transition",
                    active ? "text-[#06101f]" : "text-white/52 hover:text-white"
                  )}
                >
                  <motion.div
                    animate={{
                      scale: active ? 1.12 : 1,
                      y: active ? -1 : 0,
                    }}
                    transition={{
                      type: "spring",
                      stiffness: 520,
                      damping: 28,
                    }}
                    className="text-[18px] font-black leading-none"
                  >
                    {item.symbol}
                  </motion.div>

                  <div className="max-w-full truncate text-[10px] font-bold leading-none">
                    {item.label}
                  </div>
                </motion.div>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}