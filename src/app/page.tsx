import Link from "next/link";
import { getScores, getLatestComparison, getComparisonWindow, getLatestForecasts } from "@/lib/data";
import { heroStats, trendSeries, headToHead, whyStats } from "@/lib/homeStats";
import { compositeForecast } from "@/lib/composite";
import { buildTooltipMap } from "@/lib/trendTooltip";
import { fmtLongDate } from "@/lib/dates";
import Hero from "@/components/Hero";
import GmhgBanner from "@/components/GmhgBanner";
import FireworksBanner from "@/components/FireworksBanner";
import SectionBand from "@/components/SectionBand";
import CompositeForecast from "@/components/CompositeForecast";
import WhyTimeline from "@/components/WhyTimeline";
import HeadToHeadCard from "@/components/HeadToHeadCard";
import LiveConditions from "@/components/LiveConditions";

export const metadata = {
  alternates: { canonical: "/" },
};

export default async function HomePage() {
  const [scores, comp, forecasts] = await Promise.all([getScores(), getLatestComparison(), getLatestForecasts()]);
  const composite = compositeForecast(forecasts);
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
      <GmhgBanner />
      <FireworksBanner />

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
            consensusHigh={composite?.high ?? null}
          />
        </div>
      </SectionBand>

      <WhyTimeline stats={why} points={trend} tooltip={tooltip} />

      {h2h && (
        <SectionBand tone="surface">
          <h2 className="mb-3 font-display text-lg font-bold sm:text-xl">Yesterday in Boone | {fmtLongDate(h2h.date)}</h2>
          <HeadToHeadCard h={h2h} />
          <p className="mt-3 text-xs text-muted">
            The longer story:{" "}
            <Link href="/resources/articles/is-rays-weather-accurate" className="text-teal underline underline-offset-2">
              Is Ray&apos;s Weather accurate? 118 days scored
            </Link>
            {" | "}
            <Link href="/resources/articles/rays-weather-report-card-june-2026" className="text-teal underline underline-offset-2">
              Ray&apos;s Weather report card: June 2026
            </Link>
          </p>
        </SectionBand>
      )}
    </>
  );
}
