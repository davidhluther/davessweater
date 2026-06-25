import type { SourceStat } from "@/lib/homeStats";
import { cn } from "@/lib/utils";

export default function Scoreboard({ sources }: { sources: SourceStat[] }) {
  return (
    <div className="grid grid-cols-3 gap-2 sm:gap-3">
      {sources.map((s) => (
        <div key={s.key}
          className={cn("flex flex-col rounded-xl border p-3", s.isFree ? "border-transparent bg-teal-800" : "border-orange bg-orange/15")}>
          <div className={cn("min-h-[2.5em] text-[0.65rem] leading-tight sm:text-xs", s.isFree ? "text-white/65" : "text-orange")}>
            {s.label} · {s.isFree ? "free" : "paid"}
          </div>
          <div className={cn("font-display text-2xl font-bold sm:text-3xl", s.isFree ? "text-white" : "text-orange")}>
            {s.avg.toFixed(1)}
          </div>
          <div className={cn("mt-auto pt-1 text-[0.6rem] leading-tight sm:text-[0.7rem]", s.isFree ? "text-emerald-300" : "text-orange")}>
            {s.record}{s.isFree && s.wrong === 0 ? " · never wrong" : ""}
          </div>
        </div>
      ))}
    </div>
  );
}
