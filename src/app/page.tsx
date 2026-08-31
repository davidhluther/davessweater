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
import FiveDayStrip from "@/components/FiveDayStrip";
import WhyTimeline from "@/components/WhyTimeline";
import HeadToHeadCard from "@/components/HeadToHeadCard";
import LiveConditions from "@/components/LiveConditions";
import IphoneShot from "@/components/IphoneShot";
import AlsoTracking from "@/components/AlsoTracking";
import LeafSeasonPrompt from "@/components/LeafSeasonPrompt";
import { copy } from "@/content/copy";

export const metadata = {
  alternates: {
    canonical: "/",
    // RSS autodiscovery — Boone's 3-day forecast is the site default feed.
    types: {
      "application/rss+xml": [
        { url: "/feed/boone/forecast-3day.xml", title: "Dave's Sweater | Boone 3-day forecast" },
      ],
    },
  },
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
      {/* The town band that used to sit here moved INTO the header 2026-07-28
          (owner): the picker is now in the nav bar, so it reaches every page
          instead of the homepage only, and the control exists exactly once. */}
      <Hero stats={stats} forecasters={composite?.sources ?? []} />
      <GmhgBanner />
      <FireworksBanner />

      {/* Today + the week ahead in one band so they read as a set and stay
          tight: the Dave's Sweater Index (today's consensus + sweater verdict)
          leads, the 5-day strip follows. FiveDayStrip renders null on a
          data-less day, leaving an empty card only in that rare case. */}
      <SectionBand>
        <div className="mx-auto flex max-w-2xl flex-col gap-4 sm:gap-5">
          <div className="rounded-2xl border border-border bg-surface px-4 py-6 sm:px-8 sm:py-8">
            <CompositeForecast />
            <div className="my-6 border-t border-border" />
            <h2 className="mb-3 text-center ds-h3">Sweater Weather Index</h2>
            <LiveConditions
              initialScore={sw.sweater_count ?? 0}
              initialVerdict={sw.detail ?? sw.answer ?? ""}
              initialLayers={sw.layers ?? ""}
              initialTemp={temp}
              consensusHigh={composite?.high ?? null}
            />
          </div>
          <div className="rounded-2xl border border-border bg-surface px-4 py-6 sm:px-8 sm:py-8">
            <FiveDayStrip />
          </div>
          <AlsoTracking />
          {/* Seasonal, self-retiring: renders only while a predicted peak-color
              window is still current. See LeafSeasonPrompt. */}
          <LeafSeasonPrompt />
        </div>
      </SectionBand>

      <WhyTimeline stats={why} points={trend} tooltip={tooltip} />

      {h2h && (
        <SectionBand tone="surface">
          <h2 className="mb-3 ds-h3">Yesterday in Boone | {fmtLongDate(h2h.date)}</h2>
          <div className="grid gap-6 md:grid-cols-[1fr_auto] md:items-start">
            <div>
              <HeadToHeadCard h={h2h} />
              {/* The two long-form reads moved to /right-wrong-ray's header as
                  cards (owner, 2026-07-27) — one home, not a plain link list
                  repeated on two pages. */}
            </div>
            <figure className="mx-auto shrink-0 md:mx-0">
              <IphoneShot />
              <figcaption className="mt-2 max-w-[13rem] ds-caption">{copy.hero.iphoneAside}</figcaption>
            </figure>
          </div>
        </SectionBand>
      )}
    </>
  );
}
