import Link from "next/link";
import type { Metadata } from "next";
import {
  allTowns, getTownScores, getTownForecast5, townTodayForecasts,
  scoredDays, firstScoredDate, type Town,
} from "@/lib/towns";
import { compositeForecast } from "@/lib/composite";
import { MIN_SCORED_DAYS } from "@/lib/gating";
import { breadcrumbs, collectionPage } from "@/lib/schema";
import SectionBand from "@/components/SectionBand";
import JsonLd from "@/components/JsonLd";

const BASE = "https://davessweater.com";

export const metadata: Metadata = {
  title: "High Country weather — a real forecast for every town we track",
  description:
    "Dave's Sweater tracks a forecast for each northwest North Carolina town at its own coordinates, blended from every source and graded daily against that town's own actuals. Fewer towns, honestly covered.",
  alternates: { canonical: "/weather" },
  openGraph: {
    title: "High Country weather — a real forecast for every town",
    description:
      "Each town its own forecast, each graded against its own actuals. Fewer towns, honestly covered.",
    url: `${BASE}/weather`,
    type: "website",
  },
  twitter: { card: "summary_large_image" },
};

interface TownCard extends Town {
  href: string;
  days: number;
  since: string | null;
  isPublic: boolean;
  high: number | null;
  low: number | null;
}

async function buildCard(t: Town): Promise<TownCard> {
  const [scores, f5] = await Promise.all([getTownScores(t.slug), getTownForecast5(t.slug)]);
  const days = scoredDays(scores);
  const composite = compositeForecast(townTodayForecasts(f5));
  return {
    ...t,
    href: t.slug === "boone" ? "/" : `/weather/${t.slug}`,
    days,
    since: firstScoredDate(scores),
    // Boone is always established; others cross the shared gate.
    isPublic: t.slug === "boone" || days >= MIN_SCORED_DAYS,
    high: composite?.high ?? null,
    low: composite?.low ?? null,
  };
}

function StatusLine({ c }: { c: TownCard }) {
  if (c.slug === "boone") {
    return <span className="text-xs font-semibold text-green-700">Flagship | on the record</span>;
  }
  if (c.isPublic) {
    return <span className="text-xs font-semibold text-green-700">On the record | {c.days} days scored</span>;
  }
  return (
    <span className="text-xs font-semibold text-muted">
      Tracking | {c.days} of {MIN_SCORED_DAYS} days
    </span>
  );
}

export default async function WeatherHubPage() {
  const towns = await allTowns();
  const cards = await Promise.all(towns.map(buildCard));
  const boone = cards.find((c) => c.slug === "boone")!;
  const others = cards
    .filter((c) => c.slug !== "boone")
    .sort((a, b) => a.name.localeCompare(b.name));

  const jsonLd = [
    breadcrumbs([{ name: "Home", path: "/" }, { name: "Weather", path: "/weather" }]),
    collectionPage({
      name: "High Country weather by town",
      path: "/weather",
      description:
        "A real forecast for each northwest North Carolina town Dave's Sweater tracks, graded daily against that town's own actuals.",
      parts: towns.map((t) => ({
        name: t.name,
        path: t.slug === "boone" ? "/" : `/weather/${t.slug}`,
      })),
    }),
  ];

  return (
    <>
      <JsonLd data={jsonLd} />

      <section className="w-full bg-teal-700 text-white">
        <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:py-12">
          <div className="text-xs font-bold uppercase tracking-wider text-orange-300">
            {towns.length}{" "}towns | each its own forecast
          </div>
          <h1 className="mt-1 font-display text-3xl font-bold tracking-tight sm:text-4xl">
            A real forecast for every town we track
          </h1>
          <p className="mt-3 max-w-2xl text-sm text-white/80">
            Dave&apos;s Sweater tracks {towns.length}{" "}towns across northwest North Carolina &mdash; each its own
            multi-source forecast at its own coordinates, each graded daily against its own actuals. Not one
            regional narrative stamped across the map: fewer towns, honestly covered. That is the whole point.
          </p>
        </div>
      </section>

      <SectionBand>
        {/* Boone leads — the flagship, on its own homepage */}
        <Link
          href={boone.href}
          className="block rounded-2xl border border-emerald-300/70 bg-surface p-5 transition hover:-translate-y-0.5 hover:shadow-lg sm:p-6"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <span className="font-display text-xl font-bold sm:text-2xl">{boone.name}</span>
            <StatusLine c={boone} />
          </div>
          <div className="mt-1 text-sm text-muted">
            {boone.county} County | {boone.elevation_ft.toLocaleString()} ft
            {boone.high != null ? <> | today High {boone.high}° / Low {boone.low}°</> : null}
          </div>
        </Link>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {others.map((c) => (
            <Link
              key={c.slug}
              href={c.href}
              className="block rounded-2xl border border-border bg-surface p-5 transition hover:-translate-y-0.5 hover:shadow-lg"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <span className="font-display text-lg font-bold">{c.name}</span>
                <StatusLine c={c} />
              </div>
              <div className="mt-1 text-sm text-muted">
                {c.county ? `${c.county} County` : "High Country"} | {c.elevation_ft.toLocaleString()} ft
              </div>
              <div className="mt-1 text-sm">
                {c.high != null
                  ? <span className="font-medium text-foreground">Today High {c.high}° / Low {c.low}°</span>
                  : <span className="text-muted">Forecast warming up</span>}
              </div>
            </Link>
          ))}
        </div>

        <p className="mt-6 text-xs text-muted">
          Towns show a provisional count until they cross {MIN_SCORED_DAYS} scored days &mdash; the same gate
          every forecast source on the site clears before its record is called established. New towns appear
          here automatically as their data qualifies. Boone keeps its own{" "}
          <Link href="/" className="text-teal underline underline-offset-2">homepage</Link> and{" "}
          <Link href="/right-wrong-ray" className="text-teal underline underline-offset-2">scoreboard</Link>.
        </p>
      </SectionBand>
    </>
  );
}
