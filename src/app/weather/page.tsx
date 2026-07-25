import Link from "next/link";
import type { Metadata } from "next";
import { listTownsWithStatus, getTownStrip, type TownStatus } from "@/lib/towns";
import { MIN_SCORED_DAYS } from "@/lib/gating";
import { sweaterShort } from "@/lib/publicFeed";
import { breadcrumbs, SITE_BASE } from "@/lib/schema";
import SectionBand from "@/components/SectionBand";
import JsonLd from "@/components/JsonLd";
import type { StripDay } from "@/lib/forecast5";

export const metadata: Metadata = {
  title: "Weather by town — the High Country, graded",
  description:
    "Every High Country town Dave's Sweater tracks, each with its own multi-source forecast at its own coordinates and its own accuracy scoreboard. Same rubric, town by town.",
  alternates: { canonical: "/weather" },
  openGraph: {
    title: "Weather by town — the High Country, graded",
    description:
      "Each town, its own forecast at its own coordinates, graded against its own actuals. No regional copy stamped across the map.",
    url: "https://davessweater.com/weather",
    type: "website",
  },
  twitter: { card: "summary_large_image" },
};

function sweaterIcons(score: number) {
  return Array.from({ length: 5 }, (_, i) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img key={i} src="/assets/sweateremoji.webp" alt=""
      className={i < score ? "inline h-4 w-4" : "inline h-4 w-4 opacity-25 grayscale"} />
  ));
}

// The whole card is one link. Boone routes to the homepage (no /weather/boone
// twin — spec §2c); every other public town to its own forecast page.
function TownCard({ town, today }: { town: TownStatus; today: StripDay | null }) {
  const href = town.slug === "boone" ? "/" : `/weather/${town.slug}`;
  return (
    <Link
      href={href}
      className="group flex flex-col rounded-2xl border border-border bg-background p-5 transition hover:-translate-y-0.5 hover:shadow-lg"
    >
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="font-display text-lg font-bold text-foreground">{town.name}</h3>
        {town.slug === "boone" && (
          <span className="rounded-full border border-teal/30 bg-teal/10 px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-teal">
            flagship
          </span>
        )}
      </div>
      <div className="mt-0.5 text-xs text-muted">
        {town.elevation_ft.toLocaleString()} ft{town.county ? ` | ${town.county} County` : ""}
      </div>
      {today ? (
        <div className="mt-4 flex items-end justify-between gap-3">
          <div>
            <div className="font-display text-2xl font-bold text-foreground">
              {today.high}° <span className="text-base font-normal text-muted">/ {today.low}°</span>
            </div>
            <div className="mt-0.5 text-xs text-muted">{sweaterShort(today.sweaters)}</div>
          </div>
          <div className="flex shrink-0 gap-0.5" role="img" aria-label={`${today.sweaters} of 5 sweaters`}>
            {sweaterIcons(today.sweaters)}
          </div>
        </div>
      ) : (
        <div className="mt-4 text-sm text-muted">Forecast loading with the next data run.</div>
      )}
      <div className="mt-4 text-sm font-semibold text-teal group-hover:underline">
        {town.slug === "boone" ? "Boone home" : `See ${town.name}`}
      </div>
    </Link>
  );
}

export default async function WeatherHub() {
  const towns = await listTownsWithStatus();
  const publicTowns = towns.filter((t) => t.is_public);
  const training = towns
    .filter((t) => !t.is_public)
    .sort((a, b) => b.scored_days - a.scored_days || a.name.localeCompare(b.name));

  // Today's consensus for each public card, gathered in parallel at build time.
  const todays = await Promise.all(
    publicTowns.map(async (t) => (await getTownStrip(t.slug, 1))[0] ?? null),
  );

  const nPublic = publicTowns.length;
  const jsonLd = breadcrumbs([
    { name: "Home", path: "/" },
    { name: "Weather by town", path: "/weather" },
  ]);

  return (
    <>
      <JsonLd data={jsonLd} />

      <section className="w-full bg-teal-700 text-white">
        <div className="mx-auto w-full max-w-4xl px-4 py-10 sm:py-12">
          <div className="text-xs font-bold uppercase tracking-wider text-orange-300">
            The High Country, town by town
          </div>
          <h1 className="mt-1 font-display text-3xl font-bold tracking-tight sm:text-4xl">Weather by town</h1>
          <p className="mt-2 max-w-2xl text-sm text-white/70">
            Every town here gets its own forecast, pulled from eight independent sources at that town&apos;s
            real coordinates &mdash; no regional write-up stamped across the map. Each one is graded daily
            against its own recorded conditions, on the exact rubric we use for Boone. A town&apos;s pages
            appear once it clears {`${MIN_SCORED_DAYS} scored days`}; until then it&apos;s below,
            counting up in the open.
          </p>
        </div>
      </section>

      <SectionBand tone="surface" className="max-w-4xl">
        <h2 className="font-display text-2xl font-bold">
          {nPublic === 1 ? "Live now" : `Live now | ${nPublic} towns`}
        </h2>
        <p className="mt-1 text-sm text-muted">
          Graded, public, and updated every morning. Tap a town for its forecast and scoreboard.
        </p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {publicTowns.map((t, i) => (
            <TownCard key={t.slug} town={t} today={todays[i]} />
          ))}
        </div>
      </SectionBand>

      {training.length > 0 && (
        <SectionBand className="max-w-4xl">
          <h2 className="font-display text-2xl font-bold">In training</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            These towns are being captured and scored every day. We don&apos;t rank a forecaster on a thin
            sample, and we don&apos;t rank a town on one either &mdash; each needs{" "}
            {`${MIN_SCORED_DAYS} scored days`} before its pages go live. Here&apos;s where they stand.
          </p>
          <ul className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {training.map((t) => {
              const remaining = Math.max(0, MIN_SCORED_DAYS - t.scored_days);
              const pct = Math.min(100, Math.round((t.scored_days / MIN_SCORED_DAYS) * 100));
              return (
                <li key={t.slug} className="rounded-xl border border-border bg-background p-4">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-display font-bold text-foreground">{t.name}</span>
                    <span className="text-xs text-muted">{t.elevation_ft.toLocaleString()} ft</span>
                  </div>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-border" aria-hidden="true">
                    <div className="h-full rounded-full bg-teal" style={{ width: `${Math.max(4, pct)}%` }} />
                  </div>
                  <div className="mt-1.5 text-xs text-muted">
                    {`${t.scored_days} of ${MIN_SCORED_DAYS} scored days`}
                    {remaining > 0 ? ` | ${remaining} to go` : " | ready next build"}
                  </div>
                </li>
              );
            })}
          </ul>
        </SectionBand>
      )}

      <SectionBand tone="surface" className="max-w-4xl">
        <p className="text-sm text-muted">
          How every town is graded is spelled out in the{" "}
          <Link href="/methodology" className="text-teal underline underline-offset-2">methodology</Link>: same
          100-point rubric everywhere, each town scored against Open-Meteo archive actuals at its own
          coordinates. Machine-readable data is at{" "}
          <Link href="/api" className="text-teal underline underline-offset-2">the free data hub</Link>.
        </p>
      </SectionBand>

      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: "Weather by town — Dave's Sweater",
          description:
            "High Country towns tracked by Dave's Sweater, each with its own multi-source forecast and accuracy scoreboard.",
          url: `${SITE_BASE}/weather`,
          isPartOf: { "@type": "WebSite", name: "Dave's Sweater", url: SITE_BASE },
        }}
      />
    </>
  );
}
