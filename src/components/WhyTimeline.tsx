"use client";

import Link from "next/link";
import { useRef } from "react";
import { motion, useScroll, useTransform, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";
import type { TrendPoint, WhyStats } from "@/lib/homeStats";
import type { TooltipEntry } from "@/lib/trendTooltip";
import TrendChartInteractive from "@/components/TrendChartInteractive";
import { NumberTicker } from "@/components/ui/number-ticker";
import { PointerHighlight } from "@/components/ui/pointer-highlight";
import { copy } from "@/content/copy";

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
    tone === "free" ? "text-emerald-300" : tone === "rays" ? "text-slate-300" : "text-white";
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
        <div className="mb-1 text-sm font-bold uppercase tracking-wider text-orange">{copy.why.kicker}</div>
        <p className="mb-8 text-base text-white/70">{copy.why.subline}</p>

        <div aria-hidden className="absolute left-[11px] top-[5.5rem] bottom-10 w-0.5 bg-white/15">
          <motion.div
            className="w-full bg-gradient-to-b from-emerald-300 to-orange"
            style={{ height: reduce ? "100%" : beamHeight }}
          />
        </div>

        <div className="relative space-y-8">
          <Beat reduce={reduce}>
            <h3 className="font-display text-lg font-bold sm:text-xl">{copy.why.beat1Head}</h3>
            <p className="mt-1 text-sm text-white/70">{copy.why.beat1Body}</p>
          </Beat>

          <Beat reduce={reduce}>
            <h3 className="font-display text-lg font-bold sm:text-xl">{copy.why.beat2Head}</h3>
            <p className="mt-1 text-sm text-white/70">
              Every prediction, scored against what actually happened —{" "}
              <NumberTicker value={stats.trackedDays} className="font-display font-bold text-white" /> days
              and counting.
            </p>
          </Beat>

          <Beat reduce={reduce}>
            <h3 className="font-display text-lg font-bold sm:text-xl">{copy.why.beat3Head}</h3>
            <p className="mb-3 mt-1 text-sm text-white/70">{copy.why.beat3Body}</p>
            <TrendChartInteractive points={points} tooltip={tooltip} />
            <div className="mt-3 grid grid-cols-3 gap-2">
              <Stat label={stats.freeLabel} value={stats.freeAvg} tone="free" />
              <Stat label="Ray's" value={stats.raysAvg} tone="rays" />
              <Stat label="The gap" value={stats.gap} tone="gap" suffix=" pts" />
            </div>
          </Beat>

          <Beat reduce={reduce}>
            <h3 className="font-display text-lg font-bold sm:text-xl">{copy.why.beat4Head}</h3>
            <p className="mt-1 text-sm text-white/70">
              {copy.why.beat4Body}
              (missing <strong className="text-white">{stats.raysPrecipDays - stats.raysPrecipProvided}</strong> of{" "}
              <NumberTicker value={stats.raysPrecipDays} className="font-display font-bold text-white" /> days).
            </p>
          </Beat>

          <Beat reduce={reduce}>
            <h3 className="font-display text-lg font-bold sm:text-xl">
              <PointerHighlight>{copy.why.beat5Head}</PointerHighlight>
            </h3>
            <p className="mt-1 text-sm text-white/70">{copy.why.beat5Body}</p>
          </Beat>

          <Beat reduce={reduce}>
            <h3 className="font-display text-lg font-bold sm:text-xl">{copy.why.beat6Head}</h3>
            <p className="mt-1 text-sm text-white/70">{copy.why.beat6Body}</p>
          </Beat>
        </div>

        <p className="mt-10 border-t border-white/10 pt-4 text-center text-xs text-white/60">
          Every score here comes from one transparent rubric, applied to all forecasters alike.{" "}
          <Link href="/methodology" className="font-medium text-white/85 underline underline-offset-2">
            See exactly how we score each forecast
          </Link>
        </p>
      </div>
    </section>
  );
}
