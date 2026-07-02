import { getScores, getLatestComparison, getComparisonWindow } from "@/lib/data";
import { heroStats, trendSeries, headToHead, whyStats } from "@/lib/homeStats";
import { buildTooltipMap } from "@/lib/trendTooltip";
import Hero from "@/components/Hero";
import SectionBand from "@/components/SectionBand";
import CompositeForecast from "@/components/CompositeForecast";
import WhyTimeline from "@/components/WhyTimeline";
import HeadToHeadCard from "@/components/HeadToHeadCard";
import LiveConditions from "@/components/LiveConditions";

export default async function HomePage() {
  const [scores, comp] = await Promise.all([getScores(), getLatestComparison()]);
  const stats = heroStats(scores);
  const trend = trendSeries(scores);
  const tooltip = buildTooltipMap(await getComparisonWindow(trend.map((p) => p.date)));
  const why = whyStats(scores);
  const h2h = headToHead(comp);
  const sw = comp?.sweater_weather ?? {};
  const temp = comp?.actuals?.high_f != null ? `${comp.actuals.high_f}°F` : "—";

  return (
    <>
      <Hero stats={stats} />

      {/* Today module: the Dave's Sweater Index consensus + the sweater verdict, one card */}
      <SectionBand>
        <div className="mx-auto max-w-2xl rounded-2xl border border-border bg-surface px-4 py-6 sm:px-8 sm:py-8">
          <CompositeForecast />
          <div className="my-6 border-t border-border" />
          <h2 className="mb-3 text-center font-display text-lg font-bold sm:text-xl">Sweater Weather Index</h2>
          <LiveConditions
            initialScore={sw.sweater_count ?? 0}
            initialVerdict={sw.detail ?? sw.answer ?? ""}
            initialLayers={sw.layers ?? ""}
            initialTemp={temp}
          />
        </div>
      </SectionBand>

      <WhyTimeline stats={why} points={trend} tooltip={tooltip} />

      {h2h && (
        <SectionBand tone="surface">
          <h2 className="mb-3 font-display text-lg font-bold sm:text-xl">Yesterday in Boone · {h2h.date}</h2>
          <HeadToHeadCard h={h2h} />
        </SectionBand>
      )}
    </>
  );
}
