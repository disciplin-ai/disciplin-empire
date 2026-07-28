"use client";

import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import {
  BrainCircuit,
  LayoutDashboard,
  ScanLine,
  UserRound,
  Zap,
} from "lucide-react";
import { useShellInteraction, type ShellPanel } from "./ShellInteractionProvider";
import { useRef } from "react";
import { isDestinationActive } from "@/lib/navigationState";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

const items = [
  {
    href: "/sensei-vision",
    label: "Vision",
    icon: ScanLine,
    panel: "vision" as ShellPanel,
  },
  {
    href: "/sensei",
    label: "Sensei",
    icon: BrainCircuit,
    panel: "sensei" as ShellPanel,
  },
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
  },
  {
    href: "/fuel",
    label: "Fuel",
    icon: Zap,
    panel: "fuel" as ShellPanel,
  },
  {
    href: "/profile",
    label: "Profile",
    icon: UserRound,
    panel: "profile" as ShellPanel,
  },
];

export default function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { panel, openPanel, closePanel } = useShellInteraction();
  const scrollBeforeAction = useRef({ x: 0, y: 0 });
  const reduceMotion = useReducedMotion();

  return (
    <nav
      aria-label="Primary navigation"
      className="fixed inset-x-0 bottom-0 z-[90] px-2 pb-[max(env(safe-area-inset-bottom),8px)] sm:px-3 sm:pb-[max(env(safe-area-inset-bottom),10px)]"
    >
      <div className="app-nav-surface mx-auto max-w-xl rounded-[22px] p-1">
        <div className="grid grid-cols-5 gap-0.5 sm:gap-1">
          {items.map((item) => {
            // A panel is temporary UI layered over the current destination.
            // Selection belongs to the route only so Dashboard remains the
            // single active destination while a module drawer is open.
            const active = isDestinationActive(pathname, item.href);
            const expanded = item.panel ? panel === item.panel : undefined;
            const Icon = item.icon;

            return (
              <button
                type="button"
                key={item.href}
                aria-label={`Open ${item.label}`}
                aria-pressed={active}
                aria-expanded={expanded}
                onPointerDown={(event) => {
                  event.currentTarget.dataset.focusOrigin = "pointer";
                  scrollBeforeAction.current = { x: window.scrollX, y: window.scrollY };
                }}
                onMouseDown={(event) => event.preventDefault()}
                onClick={(event) => {
                  if (event.detail === 0) delete event.currentTarget.dataset.focusOrigin;
                  window.scrollTo(scrollBeforeAction.current.x, scrollBeforeAction.current.y);
                  if (item.panel) openPanel(item.panel, event.currentTarget, scrollBeforeAction.current);
                  else if (pathname !== "/dashboard") router.push("/dashboard");
                  else closePanel();
                }}
                onBlur={(event) => {
                  if (!expanded) delete event.currentTarget.dataset.focusOrigin;
                }}
                className="group relative flex min-h-14 min-w-0 items-center justify-center rounded-[17px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#071019]"
              >
                {active && (
                  <motion.div
                    layoutId="bottom-nav-active"
                    className="absolute inset-0 rounded-[17px] bg-[linear-gradient(180deg,rgba(110,231,183,.13),rgba(110,231,183,.08))] shadow-[inset_0_1px_0_rgba(255,255,255,.055),inset_0_0_0_1px_rgba(110,231,183,.18),0_8px_22px_rgba(0,0,0,.18)]"
                    transition={{
                      duration: reduceMotion ? 0 : 0.18,
                      ease: [0.22, 1, 0.36, 1],
                    }}
                  />
                )}

                <motion.div
                  whileHover={reduceMotion ? undefined : { y: -1 }}
                  whileTap={reduceMotion ? undefined : { y: 0, scale: 0.98 }}
                  className={cn(
                    "relative z-10 flex h-14 w-full flex-col items-center justify-center gap-1.5 rounded-[17px] text-center transition duration-150 ease-app",
                    active ? "text-emerald-100" : "text-white/54 hover:bg-white/[0.035] hover:text-white"
                  )}
                >
                  <motion.span
                    animate={{
                      scale: active ? 1.05 : 1,
                      y: active ? -1 : 0,
                    }}
                    transition={{
                      duration: reduceMotion ? 0 : 0.16,
                      ease: [0.22, 1, 0.36, 1],
                    }}
                  >
                    <Icon aria-hidden="true" className="h-[18px] w-[18px]" strokeWidth={active ? 2.2 : 1.8} />
                  </motion.span>

                  <div className="whitespace-nowrap text-[10px] font-semibold leading-3 tracking-[-0.01em]">
                    {item.label}
                  </div>
                </motion.div>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
