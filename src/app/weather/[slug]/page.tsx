import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  listPublicTowns, getTown, getTownForecast5, isTownPublic,
} from "@/lib/towns";
import { stripDays } from "@/lib/forecast5";
import { sourceLabel, precipLabel } from "@/lib/townDisplay";
import { sweaterShort } from "@/lib/publicFeed";
import { breadcrumbs, SITE_BASE } from "@/lib/schema";
import SectionBand from "@/components/SectionBand";
import TownFiveDay from "@/components/TownFiveDay";
import TownSwitcher from "@/components/TownSwitcher";
import JsonLd from "@/components/JsonLd";
import type { ForecastDisplay } from "@/lib/types";

// Only towns past the gate get a page; an ungated (or unknown) slug 404s. When
// a town's data crosses MIN_SCORED_DAYS, the next build adds it here with no
// code change (bottom-up: this child emits its own complete param set).
export const dynamicParams = false;

export async function generateStaticParams() {
  const towns = await listPublicTowns();
  return towns.filter((t) => t.slug !== "boone").map((t) => ({ slug: t.slug }));
}

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> },
): Promise<Metadata> {
  const { slug } = await params;
  const town = await getTown(slug);
  if (!town) return { title: "Weather by town" };
  const title = `${town.name}, NC weather forecast`;
  const description =
    `The ${town.name} forecast from eight independent sources, computed at ${town.lat.toFixed(4)}, ` +
    `${town.lon.toFixed(4)} (${town.elevation_ft.toLocaleString()} ft) and graded daily against ` +
    `verified actuals. Free, no paywall.`;
  return {
    title,
    description,
    alternates: {
      canonical: `/weather/${slug}`,
      types: {
        "application/rss+xml": [
          { url: `/feed/${slug}/forecast-3day.xml`, title: `Dave's Sweater | ${town.name} 3-day forecast` },
          { url: `/feed/${slug}/verdict.xml`, title: `Dave's Sweater | ${town.name} Right/Wrong Ray` },
        ],
      },
    },
    openGraph: {
      title, description, type: "website",
      url: `https://davessweater.com/weather/${slug}`,
    },
    twitter: { card: "summary_large_image" },
  };
}

const deg = (v: number | null) => (v != null ? `${Math.round(v)}°` : "—");

// Display order for the per-source row list: our consensus is the headline
// (shown above), so here it's the free forecasters, then the graded incumbent.
const SOURCE_ORDER = [
  "openmeteo", "nws", "metno", "openweathermap", "weatherapi",
  "visualcrossing", "tomorrowio", "googleweather", "raysweather",
];

export default async function TownPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const town = await getTown(slug);
  if (!town || slug === "boone" || !(await isTownPublic(slug))) notFound();

  const [f5, publicTowns] = await Promise.all([getTownForecast5(slug), listPublicTowns()]);
  const strip = stripDays(f5);
  const today = strip[0] ?? null;

  // Per-source rows for the leading day (the town's own captures at its own pin).
  const todayDay = f5?.days.find((d) => d.date === today?.date) ?? f5?.days[0];
  const sources: Record<string, ForecastDisplay & { precip_prob?: number }> = todayDay?.sources ?? {};
  const rowKeys = [
    ...SOURCE_ORDER.filter((k) => sources[k]),
    ...Object.keys(sources).filter((k) => !SOURCE_ORDER.includes(k)),
  ];

  const jsonLd = [
    breadcrumbs([
      { name: "Home", path: "/" },
      { name: "Weather by town", path: "/weather" },
      { name: town.name, path: `/weather/${slug}` },
    ]),
    {
      "@context": "https://schema.org",
      "@type": "Dataset",
      name: `${town.name}, NC multi-source forecast and accuracy scores`,
      description:
        `Daily multi-source weather forecast for ${town.name}, NC, computed at its own coordinates ` +
        `and graded against verified actual conditions on a 100-point scale.`,
      creator: { "@type": "Organization", name: "Dave's Sweater", url: SITE_BASE },
      isAccessibleForFree: true,
      license: "https://creativecommons.org/licenses/by/4.0/",
      url: `${SITE_BASE}/weather/${slug}`,
      spatialCoverage: {
        "@type": "Place",
        name: `${town.name}, NC`,
        geo: { "@type": "GeoCoordinates", latitude: town.lat, longitude: town.lon, elevation: `${town.elevation_ft} ft` },
      },
      keywords: [`${town.name} NC weather`, `${town.name} forecast`, "forecast accuracy"],
    },
  ];

  return (
    <>
      <JsonLd data={jsonLd} />

      <section className="w-full bg-teal-700 text-white">
        <div className="mx-auto w-full max-w-3xl px-4 py-9 sm:py-11">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-orange-300">
                <Link href="/weather" className="hover:underline">Weather by town</Link>
                {town.county ? ` | ${town.county} County` : ""}
              </div>
              <h1 className="mt-1 font-display text-3xl font-bold tracking-tight sm:text-4xl">
                {town.name}, NC weather
              </h1>
            </div>
            <TownSwitcher towns={publicTowns} current={slug} base="weather" />
          </div>
          <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-white/70">
            <span>{town.elevation_ft.toLocaleString()} ft</span>
            <span>{town.lat.toFixed(4)}, {town.lon.toFixed(4)}</span>
            <span>{town.has_rays ? "Ray's Weather station: yes (graded)" : "Ray's Weather station: none here"}</span>
          </p>
        </div>
      </section>

      {/* Today — the Dave's Sweater Index consensus for this town. */}
      <SectionBand tone="surface">
        {today ? (
          <div className="rounded-2xl border border-border bg-background px-5 py-6 sm:px-8 sm:py-8">
            <div className="text-center">
              <div className="text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-muted">
                Dave&apos;s Sweater Index | {town.name} | {today.dayLabel}
              </div>
              <div className="mt-1 font-display text-2xl font-bold text-foreground sm:text-3xl">
                High {today.high}° <span className="text-muted/60">|</span> Low {today.low}°{" "}
                <span className="text-muted/60">|</span> {today.precipLabel}
              </div>
              <div className="mt-1 text-xs text-muted">
                {today.summary} &middot; consensus of {today.count} independent forecasts
              </div>
              <div className="mt-1 text-sm font-semibold text-teal">{sweaterShort(today.sweaters)}</div>
            </div>
            <div className="my-6 border-t border-border" />
            <h2 className="mb-1 text-center font-display text-lg font-bold sm:text-xl">The 5-day</h2>
            <TownFiveDay days={strip} />
          </div>
        ) : (
          <p className="text-muted">No forecast captured for {town.name} yet — check back after the next data run.</p>
        )}
      </SectionBand>

      {/* Per-source rows: what each forecast says for this town today, at this
          town's own coordinates. Ray's is graded where he has a station; where
          he doesn't, his row is honestly absent (the registry's no-borrow rule). */}
      {rowKeys.length > 0 && (
        <SectionBand>
          <h2 className="font-display text-2xl font-bold">What each forecast says for {town.name}</h2>
          <p className="mt-1 text-sm text-muted">
            Every source, pulled today at {town.name}&apos;s own coordinates. These are the numbers that
            feed the consensus above &mdash; and the ones we grade tomorrow once the day is in.
          </p>

          <table className="mt-4 hidden w-full text-sm sm:table">
            <thead>
              <tr className="text-left text-muted">
                <th className="py-2">Source</th><th>High</th><th>Low</th><th>Wind</th><th>Precip</th>
              </tr>
            </thead>
            <tbody>
              {rowKeys.map((k) => {
                const f = sources[k];
                return (
                  <tr key={k} className="border-t border-border">
                    <td className="py-2 font-medium">{sourceLabel(k)}</td>
                    <td>{deg(f.high_f)}</td>
                    <td>{deg(f.low_f)}</td>
                    <td>{f.wind ?? "—"}</td>
                    <td>{precipLabel(f.precip_type)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="mt-4 grid grid-cols-2 gap-2 sm:hidden">
            {rowKeys.map((k) => {
              const f = sources[k];
              return (
                <div key={k} className="rounded-xl border border-border bg-background p-3">
                  <div className="font-display text-sm font-bold">{sourceLabel(k)}</div>
                  <div className="mt-1 text-xs text-muted">Hi {deg(f.high_f)} &middot; Lo {deg(f.low_f)}</div>
                  <div className="text-xs text-muted">Wind {f.wind ?? "—"}</div>
                  <div className="text-xs text-muted">Precip {precipLabel(f.precip_type)}</div>
                </div>
              );
            })}
          </div>

          {!town.has_rays && (
            <p className="mt-4 rounded-xl border border-border bg-surface px-4 py-3 text-sm text-muted">
              Ray&apos;s Weather runs no station in {town.name}, so his row is blank here. We won&apos;t
              borrow the next town over and call it {town.name}&apos;s forecast &mdash; the blank is the
              honest answer.
            </p>
          )}
        </SectionBand>
      )}

      <SectionBand tone="surface">
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href={`/right-wrong-ray/${slug}`}
            className="inline-flex min-h-10 items-center rounded-lg bg-orange-600 px-4 text-sm font-bold text-white transition-colors hover:bg-[#9a3412]"
          >
            {town.name}&apos;s scoreboard &rarr;
          </Link>
          <Link
            href="/methodology"
            className="inline-flex min-h-10 items-center rounded-lg border border-border px-4 text-sm font-bold text-foreground transition-colors hover:bg-background"
          >
            How we score it
          </Link>
        </div>
        <p className="mt-4 text-xs text-muted">
          Subscribe:{" "}
          <a href={`/feed/${slug}/forecast-3day.xml`} className="text-teal underline underline-offset-2">
            {town.name} 3-day forecast (RSS)
          </a>
          {" | "}
          <a href={`/feed/${slug}/verdict.xml`} className="text-teal underline underline-offset-2">
            daily verdict (RSS)
          </a>
          {" | "}
          <Link href="/api" className="text-teal underline underline-offset-2">JSON API</Link>
        </p>
      </SectionBand>
    </>
  );
}
