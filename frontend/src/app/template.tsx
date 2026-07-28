"use client";

import { motion, useReducedMotion } from "framer-motion";

export default function Template({ children }: { children: React.ReactNode }) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.div
      // Transform and filter create containing blocks for fixed descendants.
      // Keep route motion opacity-only so shell navigation and drawers remain
      // fixed to the viewport rather than the animated page wrapper.
      initial={reduceMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{
        duration: reduceMotion ? 0 : 0.24,
        ease: [0.22, 1, 0.36, 1],
      }}
    >
      {children}
    </motion.div>
  );
}
