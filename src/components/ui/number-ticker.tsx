"use client";

import { useEffect, useRef } from "react";
import { useInView, useMotionValue, useReducedMotion, useSpring } from "framer-motion";
import { cn } from "@/lib/utils";

export function NumberTicker({
  value,
  delay = 0,
  className,
  decimalPlaces = 0,
}: {
  value: number;
  className?: string;
  delay?: number; // seconds
  decimalPlaces?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduce = useReducedMotion();
  const motionValue = useMotionValue(reduce ? value : 0);
  const springValue = useSpring(motionValue, { damping: 60, stiffness: 100 });
  const isInView = useInView(ref, { once: true, margin: "0px" });

  useEffect(() => {
    if (!isInView) return;
    if (reduce) {
      motionValue.set(value);
      return;
    }
    const t = setTimeout(() => motionValue.set(value), delay * 1000);
    return () => clearTimeout(t);
  }, [motionValue, isInView, delay, value, reduce]);

  useEffect(
    () =>
      springValue.on("change", (latest) => {
        if (ref.current) {
          ref.current.textContent = Intl.NumberFormat("en-US", {
            minimumFractionDigits: decimalPlaces,
            maximumFractionDigits: decimalPlaces,
          }).format(Number(latest.toFixed(decimalPlaces)));
        }
      }),
    [springValue, decimalPlaces],
  );

  return (
    <span ref={ref} className={cn("inline-block tabular-nums", className)}>
      {Intl.NumberFormat("en-US", {
        minimumFractionDigits: decimalPlaces,
        maximumFractionDigits: decimalPlaces,
      }).format(value)}
    </span>
  );
}
