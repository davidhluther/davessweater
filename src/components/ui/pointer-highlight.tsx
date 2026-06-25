"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";

export function PointerHighlight({ children }: { children: ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <span className="relative inline-block">
      <motion.span
        aria-hidden
        className="absolute inset-x-[-0.12em] bottom-[0.04em] -z-10 h-[0.55em] origin-left rounded-sm border-b-2 border-orange bg-orange/25"
        initial={reduce ? false : { scaleX: 0 }}
        whileInView={{ scaleX: 1 }}
        viewport={{ once: true, margin: "-40px" }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
      />
      {children}
    </span>
  );
}
