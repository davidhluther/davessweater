import { getScores, getLatestComparison, getComparisonWindow } from "@/lib/data";
import { heroStats, trendSeries, headToHead } from "@/lib/homeStats";
import { buildTooltipMap } from "@/lib/trendTooltip";
import Hero from "@/components/Hero";
import SectionBand from "@/components/SectionBand";
import TrendChartInteractive from "@/components/TrendChartInteractive";
import HeadToHeadCard from "@/components/HeadToHeadCard";
import LiveConditions from "@/components/LiveConditions";

export default async function HomePage() {
  const [scores, comp] = await Promise.all([getScores(), getLatestComparison()]);
  const stats = heroStats(scores);
  const trend = trendSeries(scores);
  const tooltip = buildTooltipMap(await getComparisonWindow(trend.map((p) => p.date)));
  const h2h = headToHead(comp);
  const sw = comp?.sweater_weather ?? {};
  const temp = comp?.actuals?.high_f != null ? `${comp.actuals.high_f}°F` : "—";

  return (
    <>
      <Hero stats={stats} />

      <SectionBand tone="dark">
        <div className="mb-1 text-xs font-bold uppercase tracking-wider text-orange">It&apos;s not a fluke</div>
        <h2 className="mb-4 font-display text-xl font-bold sm:text-2xl">The gap holds, day after day.</h2>
        <TrendChartInteractive points={trend} tooltip={tooltip} />
        {stats.trackingRays && stats.trackingBestFree && (
          <p className="mt-4 text-sm text-white/80">
            Over {stats.trackingDays} days of Dave&apos;s Sweater, the free forecast averaged {stats.trackingBestFree.avg.toFixed(1)} —
            beating Ray&apos;s by {stats.trackingPointGap.toFixed(1)} points.{" "}
            {stats.trackingFreeNeverWrong && <>The free services were never once graded &ldquo;Wrong.&rdquo; </>}
            Ray&apos;s earned that grade {stats.trackingRaysWrong} times.
          </p>
        )}
        {stats.openmeteoFull && (
          <p className="mt-3 text-sm text-white/70">
            Dave&apos;s Sweater&apos;s forecast is <strong className="text-white">Open-Meteo</strong> — a free, open-source weather
            API anyone can pull. Across {stats.openmeteoFull.days} days of its archived forecasts it has averaged {stats.openmeteoFull.avg.toFixed(1)},
            graded &ldquo;Wrong&rdquo; {stats.openmeteoFull.wrong === 0 ? "not once" : stats.openmeteoFull.wrong === 1 ? "exactly once" : `${stats.openmeteoFull.wrong} times`}.
          </p>
        )}
        <p className="mt-4 border-l-2 border-orange pl-3 text-sm italic text-white/70">
          He makes big promises and hopes nobody ever checks the numbers. Now somebody is.
        </p>
      </SectionBand>

      {h2h && (
        <SectionBand tone="surface">
          <h2 className="mb-3 font-display text-lg font-bold sm:text-xl">Yesterday in Boone · {h2h.date}</h2>
          <HeadToHeadCard h={h2h} />
        </SectionBand>
      )}

      <SectionBand>
        <div className="mb-3 text-xs font-bold uppercase tracking-wide text-muted">Oh — and we do actual weather too</div>
        <LiveConditions
          initialScore={sw.sweater_count ?? 0}
          initialVerdict={sw.detail ?? sw.answer ?? ""}
          initialLayers={sw.layers ?? ""}
          initialTemp={temp}
        />
      </SectionBand>
    </>
  );
}
