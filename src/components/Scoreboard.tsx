import type { SourceStat } from "@/lib/homeStats";
import { cn } from "@/lib/utils";

// Color semantics: green/emerald = the free data (emphasis on the winner),
// desaturated slate = Ray's. Orange is reserved for brand/editorial use.
export default function Scoreboard({ sources }: { sources: SourceStat[] }) {
  const topFree = Math.max(...sources.filter((s) => s.isFree).map((s) => s.avg));
  return (
    <div className="grid grid-cols-3 gap-2 sm:gap-3">
      {sources.map((s) => {
        const winner = s.isFree && s.avg === topFree;
        return (
          <div key={s.key}
            className={cn("flex flex-col rounded-xl border bg-teal-800 p-3",
              winner ? "border-emerald-300/60" : s.isFree ? "border-transparent" : "border-slate-400/30")}>
            <div className={cn("min-h-[2.5em] text-[0.65rem] leading-tight sm:text-xs", s.isFree ? "text-white/65" : "text-slate-300/80")}>
              {s.label}
            </div>
            <div className={cn("font-display text-2xl font-bold sm:text-3xl",
              winner ? "text-emerald-300" : s.isFree ? "text-white" : "text-slate-300")}>
              {s.avg.toFixed(1)}
            </div>
            <div className={cn("mt-auto pt-1 text-[0.6rem] leading-tight sm:text-[0.7rem]", s.isFree ? "text-emerald-300" : "text-slate-300/80")}>
              {s.record}{s.isFree && s.wrong === 0 ? " · never wrong" : ""}
            </div>
          </div>
        );
      })}
    </div>
  );
}
