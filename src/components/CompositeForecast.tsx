import { getLatestForecasts } from "@/lib/data";
import { compositeForecast } from "@/lib/composite";

// The "consensus" strip at the bottom of the hero: a composite of all the
// independent automated forecasters' upcoming-day predictions. Self-fetches so
// it can be dropped into the hero without threading data through the page.
export default async function CompositeForecast() {
  const c = compositeForecast(await getLatestForecasts());
  if (!c) return null;
  return (
    <div className="mt-6 border-t border-white/10 pt-5 text-center">
      <div className="text-[0.7rem] uppercase tracking-[0.12em] text-white/55">
        Consensus forecast · {c.dateLabel}
      </div>
      <div className="mt-1 font-display text-xl font-bold sm:text-2xl">
        High {c.high}° <span className="text-white/40">·</span> Low {c.low}° <span className="text-white/40">·</span> {c.precipLabel}
      </div>
      <div className="mt-1 text-xs text-white/55">the average of {c.count} independent forecasters</div>
    </div>
  );
}
