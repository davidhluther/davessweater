"use client";
// Reports-page teaser for the Highland Games planner: pick a day or the
// highlights and it hands off to the planner (?day=… / ?start=highlights),
// which reads those params on mount and sets itself up. No planning logic here.
import { useRouter } from "next/navigation";

const SLUG = "/reports/grandfather-mountain-highland-games-2026";
const DAYS: [string, string][] = [
  ["thu", "Thursday"],
  ["fri", "Friday"],
  ["sat", "Saturday"],
  ["sun", "Sunday"],
];

export default function GmhgPlannerTeaser() {
  const router = useRouter();
  const go = (qs: string) => router.push(`${SLUG}${qs}#planner`);
  return (
    <div className="rounded-lg border border-border bg-background p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold text-muted">Which day are you going?</span>
        {DAYS.map(([k, label]) => (
          <button key={k} type="button" onClick={() => go(`?day=${k}`)}
            className="rounded-full border border-teal-700 px-3 py-1.5 text-sm font-semibold text-teal transition-colors hover:bg-surface">
            {label}
          </button>
        ))}
        <button type="button" onClick={() => go("?start=highlights")}
          className="rounded-md bg-orange-600 px-3.5 py-2 text-sm font-bold text-white transition-colors hover:bg-[#9a3412]">
          Just the highlights &rarr;
        </button>
      </div>
    </div>
  );
}
