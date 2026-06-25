"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";
import type { TrendPoint, WhyStats } from "@/lib/homeStats";
import type { TooltipEntry } from "@/lib/trendTooltip";
import TrendChartInteractive from "@/components/TrendChartInteractive";
import { NumberTicker } from "@/components/ui/number-ticker";
import { PointerHighlight } from "@/components/ui/pointer-highlight";

const EASE = [0.16, 1, 0.3, 1] as const;
const REVEAL = { hidden: { opacity: 0, y: 24 }, visible: { opacity: 1, y: 0 } };

type Tooltip = Record<string, TooltipEntry>;

function Beat({ children, reduce }: { children: ReactNode; reduce: boolean }) {
  return (
    <motion.div
      className="relative pl-8"
      initial={reduce ? false : "hidden"}
      whileInView="visible"
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.7, ease: EASE }}
      variants={REVEAL}
    >
      <span
        aria-hidden
        className="absolute left-[7px] top-1.5 size-2.5 rounded-full bg-orange ring-2 ring-orange/40"
      />
      {children}
    </motion.div>
  );
}

function Stat({
  label,
  value,
  dec = 1,
  tone,
  suffix = "",
}: {
  label: string;
  value: number;
  dec?: number;
  tone: "free" | "rays" | "gap";
  suffix?: string;
}) {
  const box = tone === "gap" ? "border border-orange/50 bg-orange/15" : "bg-teal-700";
  const glow =
    tone === "free"
      ? "shadow-[0_0_0_1px_rgba(29,158,117,0.5),0_0_22px_rgba(29,158,117,0.25)]"
      : "";
  const numColor =
    tone === "free" ? "text-emerald-300" : tone === "rays" ? "text-orange" : "text-white";
  return (
    <div className={`flex flex-col items-center rounded-xl p-3 text-center ${box} ${glow}`}>
      <div className={`font-display text-2xl font-bold sm:text-3xl ${numColor}`}>
        <NumberTicker value={value} decimalPlaces={dec} />
        {suffix && <span className="text-sm text-white/60">{suffix}</span>}
      </div>
      <div className="mt-1 text-[0.65rem] leading-tight text-white/65">{label}</div>
    </div>
  );
}

export default function WhyTimeline({
  stats,
  points,
  tooltip,
}: {
  stats: WhyStats;
  points: TrendPoint[];
  tooltip: Tooltip;
}) {
  const reduce = useReducedMotion() ?? false;
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 0.8", "end 0.6"] });
  const beamHeight = useTransform(scrollYProgress, [0, 1], ["0%", "100%"]);

  return (
    <section className="w-full bg-teal-900 text-white [background-image:radial-gradient(rgba(255,255,255,0.06)_1px,transparent_1px)] [background-size:22px_22px]">
      <div ref={ref} className="relative mx-auto w-full max-w-3xl px-4 py-10 sm:py-14">
        <div className="mb-1 text-xs font-bold uppercase tracking-wider text-orange">Why this exists</div>
        <p className="mb-8 text-sm text-white/60">Boone&apos;s outlook, fact-checked daily.</p>

        <div aria-hidden className="absolute left-[11px] top-[5.5rem] bottom-10 w-0.5 bg-white/15">
          <motion.div
            className="w-full bg-gradient-to-b from-emerald-300 to-orange"
            style={{ height: reduce ? "100%" : beamHeight }}
          />
        </div>

        <div className="relative space-y-8">
          <Beat reduce={reduce}>
            <h3 className="font-display text-lg font-bold sm:text-xl">One forecast. One bill.</h3>
            <p className="mt-1 text-sm text-white/70">You paid for the only outlook in town.</p>
          </Beat>

          <Beat reduce={reduce}>
            <h3 className="font-display text-lg font-bold sm:text-xl">So somebody started checking.</h3>
            <p className="mt-1 text-sm text-white/70">
              Every prediction, scored against what actually happened —{" "}
              <NumberTicker value={stats.trackedDays} className="font-display font-bold text-white" /> days
              and counting.
            </p>
          </Beat>

          <Beat reduce={reduce}>
            <h3 className="mb-3 font-display text-lg font-bold sm:text-xl">The gap isn&apos;t close.</h3>
            <TrendChartInteractive points={points} tooltip={tooltip} />
            <div className="mt-3 grid grid-cols-3 gap-2">
              <Stat label={`${stats.freeLabel} · free`} value={stats.freeAvg} tone="free" />
              <Stat label="Ray's · paid" value={stats.raysAvg} tone="rays" />
              <Stat label="The gap" value={stats.gap} tone="gap" suffix=" pts" />
            </div>
          </Beat>

          <Beat reduce={reduce}>
            <h3 className="font-display text-lg font-bold sm:text-xl">It was never better weather.</h3>
            <p className="mt-1 text-sm text-white/70">
              It&apos;s open data anyone can pull. The bill bought the habit — he won&apos;t even commit to a
              rain total: <strong className="text-white">0</strong> of{" "}
              <NumberTicker value={stats.raysPrecipDays} className="font-display font-bold text-white" /> days.
            </p>
          </Beat>

          <Beat reduce={reduce}>
            <h3 className="font-display text-lg font-bold sm:text-xl">
              <PointerHighlight>The old way is out.</PointerHighlight>
            </h3>
            <p className="mt-1 text-sm text-white/70">Better data is free. Good design is cheap. This site is the proof.</p>
          </Beat>
        </div>
      </div>
    </section>
  );
}
