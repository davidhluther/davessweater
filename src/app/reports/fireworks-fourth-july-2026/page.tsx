// /reports/fireworks-fourth-july-2026 — "fireworks begin at dusk" is the most repeated non-answer in
// local event listings. Dusk is a computable fact; this page computes it per
// launch site, annually, forever (the build date drives everything). Three
// states ship together: preview (default), "tonight" on July 3–4, archive
// after July 5. Set FIREWORKS_TODAY=YYYY-MM-DD at build time to preview a
// state locally. The dusk math lives in lib/solar (the future /sunset spine);
// the forecast verdicts in lib/fireworks; venue facts in lib/fireworksVenues.
import Link from "next/link";
import JsonLd from "@/components/JsonLd";
import OpenTargetDetails from "@/components/OpenTargetDetails";
import SectionBand from "@/components/SectionBand";
import SightlineChecker from "@/components/SightlineChecker";
import { getFireworksForecast, getTerrain } from "@/lib/data";
import {
  BURST_FINALE_M, BURST_TYPICAL_M, CLUTTER_PENALTY_M, MARGIN_NOISE_M, ftFromM, ftFromM50,
  spotMarginM, spotVerdict,
  type SightVerdict, type SpotEnvironment, type ViewpointResult,
} from "@/lib/sightline";
import {
  RUBRIC, SEASON, isStale, nightVerdict, pageMode,
  windowStats, type FireworksForecastFile, type NightOutlook, type PageMode, type Verdict,
} from "@/lib/fireworks";
import { NO_SHOW_TOWNS, UNVERIFIED_REPORTS, VENUES, type FireworksVenue } from "@/lib/fireworksVenues";
import { breadcrumbs } from "@/lib/schema";
import {
  NY_TZ, fmtTime, lastDirectSun, localDateString, solarPacket, zonedTimeToUtcMs, type SolarPacket,
} from "@/lib/solar";

const PAGE_URL = "https://davessweater.com/reports/fireworks-fourth-july-2026";
const BOONE = { lat: 36.2168, lon: -81.6746 };

function today(): string {
  return process.env.FIREWORKS_TODAY ?? localDateString(NY_TZ);
}

function fmtNight(date: string): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: NY_TZ, month: "long", day: "numeric" })
    .format(new Date(zonedTimeToUtcMs(date, 12, 0, NY_TZ)));
}

function fmtStamp(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "unknown";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: NY_TZ, month: "long", day: "numeric", hour: "numeric", minute: "2-digit",
  }).format(new Date(t));
}

/** "9:22 PM" from a 24h "HH:MM" wall-clock string (already local). */
function fmtClock(hhmm: string): string {
  const h = Number(hhmm.slice(0, 2));
  return `${((h + 11) % 12) + 1}:${hhmm.slice(3, 5)} ${h < 12 ? "AM" : "PM"}`;
}

/** "9:30 PM" from a venue's stated clock time, or null. */
function statedTimeLabel(v: FireworksVenue): string | null {
  if (!v.clockTimeStated) return null;
  const utc = zonedTimeToUtcMs(v.date, Number(v.clockTimeStated.slice(0, 2)), Number(v.clockTimeStated.slice(3, 5)), NY_TZ);
  return fmtTime(new Date(utc), NY_TZ);
}

/** Our computed start window: civil-dusk end floored to :05, plus 15 minutes. */
function readWindow(civilEnd: Date | null): string | null {
  if (!civilEnd) return null;
  const start = new Date(Math.floor(civilEnd.getTime() / 300_000) * 300_000);
  const end = new Date(start.getTime() + 15 * 60_000);
  return `${fmtTime(start, NY_TZ)}–${fmtTime(end, NY_TZ)}`;
}

export async function generateMetadata() {
  const p = solarPacket({ ...BOONE, date: `${SEASON.year}-07-04`, tz: NY_TZ });
  const description =
    `"At dusk" is not a time. July 4, ${SEASON.year} in Boone: sunset ${fmtTime(p.sunset, NY_TZ)}, dark enough by ` +
    `${fmtTime(p.civilDuskEnd, NY_TZ)}, fully dark ${fmtTime(p.nauticalDuskEnd, NY_TZ)}. Every Watauga County ` +
    `and High Country show computed per launch site, plus a fireworks-specific forecast.`;
  return {
    title: `${SEASON.year} Fourth of July Fireworks in Boone & the High Country: Exact Times, Computed`,
    description,
    alternates: { canonical: "/reports/fireworks-fourth-july-2026" },
    openGraph: {
      title: `${SEASON.year} Fourth of July fireworks in Boone and the High Country: what time, exactly`,
      description, url: PAGE_URL, type: "website",
    },
  };
}

const SIGHT_UI: Record<SightVerdict, { label: string; cls: string }> = {
  clear: { label: "Clear View", cls: "bg-green-700 text-white" },
  "finale-only": { label: "Limited View", cls: "bg-orange-600 text-white" },
  marginal: { label: "Limited View", cls: "bg-orange-600 text-white" },
  blocked: { label: "Blocked View", cls: "border border-border bg-surface text-muted" },
};

function SightChip({ r, env }: { r?: ViewpointResult; env?: SpotEnvironment }) {
  if (!r) return <span className="text-muted">—</span>;
  const v = spotVerdict(r, env ?? "open");
  const margin = spotMarginM(r, env ?? "open");
  const ui = SIGHT_UI[v];
  return (
    <span className="whitespace-nowrap">
      <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${ui.cls}`}>{ui.label}</span>
      <span className="ml-1.5 text-xs text-muted">{margin > 0 ? "+" : ""}{ftFromM(margin)} ft</span>
    </span>
  );
}

const VERDICT_STYLE: Record<Verdict, { label: string; cls: string }> = {
  clear: { label: "Clear Skies", cls: "bg-green-700 text-white" },
  iffy: { label: "Iffy Skies", cls: "bg-orange-600 text-white" },
  obstructed: { label: "Bad Skies", cls: "bg-red-700 text-white" },
  unavailable: { label: "No Forecast", cls: "border border-border bg-surface text-muted" },
};

function VerdictChip({ verdict }: { verdict: Verdict }) {
  const v = VERDICT_STYLE[verdict];
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${v.cls}`}>
      {v.label}
    </span>
  );
}

interface VenueView {
  venue: FireworksVenue;
  packet: SolarPacket;
  outlook: NightOutlook;
}

function buildViews(forecast: FireworksForecastFile | null, stale: boolean): VenueView[] {
  return VENUES.map((venue) => {
    const packet = solarPacket({ lat: venue.lat, lon: venue.lon, date: venue.date, tz: NY_TZ });
    const hours = !forecast || stale ? null : forecast.venues[venue.id]?.nights[venue.date] ?? null;
    const outlook = nightVerdict(hours ? windowStats(hours) : null);
    return { venue, packet, outlook };
  });
}

interface Faq { id: string; q: string; a: string }

function buildFaqs(views: VenueView[]): Faq[] {
  const boone = views.find((v) => v.venue.id === "boone");
  const tweetsie = views.find((v) => v.venue.id === "tweetsie");
  const bp = boone?.packet;
  const sunset = bp ? fmtTime(bp.sunset, NY_TZ) : null;
  const civil = bp ? fmtTime(bp.civilDuskEnd, NY_TZ) : null;
  const nautical = bp ? fmtTime(bp.nauticalDuskEnd, NY_TZ) : null;
  const booneWindow = bp ? readWindow(bp.civilDuskEnd) : null;
  const tweetsieTime = tweetsie?.venue.clockTimeStated ? "9:30 PM" : "about the same time";
  return [
    {
      id: "faq-boone-time",
      q: `What time do the Boone fireworks actually start?`,
      a: `Realistically ${booneWindow ?? "9:15–9:30 PM"} at Clawson-Burnley Park. The town says "${boone?.venue.officialWording ?? "around dusk"}"; the county TDA's listing shows 9:00 PM; the sun says dark enough at ${civil ?? "9:17 PM"} (sunset ${sunset ?? "8:47 PM"}). Those agree better than they sound; mountain shows reliably launch in the quarter hour after civil dusk ends.${(() => {
        const obs = boone?.venue.observed?.find((o) => o.firstShell);
        return obs
          ? ` Observed record: in ${obs.year} the first shell went up at ${fmtClock(obs.firstShell!)}.`
          : " Nobody has ever published an actual first-shell time for this show; the best night-of evidence only bounds it. We intend to fix that.";
      })()}`,
    },
    {
      id: "faq-both-shows",
      q: "Can I see both the Boone and Tweetsie shows in one night?",
      a: `Attend both? No: Boone launches around ${booneWindow ?? "9:15–9:30 PM"} and Tweetsie fires at ${tweetsieTime}, effectively simultaneous, ten minutes apart on a road that will not be doing ten minutes that night. See more than one at once? Genuinely yes: these shows sit close as the crow flies, and from a high, open spot in Boone we have personally watched three bloom on the horizon at the same time. Distant, small, and mostly silent, but real. Pick one to attend; find elevation if you want the panorama.`,
    },
    {
      id: "faq-blowing-rock",
      q: "Does Blowing Rock have fireworks?",
      a: "No. The town of Blowing Rock runs a daytime July 4 parade, not a fireworks show. The fireworks people mean when they say Blowing Rock are Tweetsie Railroad's, just north of town on US-321. That is the show.",
    },
    {
      id: "faq-fully-dark",
      q: "When is it actually, fully dark?",
      a: `Two different answers. Dark enough for fireworks is the end of civil twilight, ${civil ?? "about 9:17 PM"} on the Fourth. Fully dark to the eye is the end of nautical twilight, ${nautical ?? "about 9:55 PM"}. Finales look their best after the second number, which is one reason shows that start at 9:30 feel brighter than shows that start at 9:10.`,
    },
    {
      id: "faq-banner-elk",
      q: `Does Banner Elk have fireworks in ${SEASON.year}?`,
      a: "Not that anyone official will say. Banner Elk's 2026 schedule is a daytime celebration (parade at 11 AM, Party in the Park, duck races) with a stated end at 3 PM. The \"9:30 PM fireworks\" still floating around aggregator listings traces to 2024 coverage. The nearest verified evening show is Beech Mountain's, ten minutes up the hill, at dusk.",
    },
    {
      id: "faq-elk-park",
      q: "Is there an Elk Park fireworks show this year?",
      a: "Nobody official will say, and we tried. Aggregator roundups list a July 4 festival with fireworks at 9:30 PM, but there is no town source, and the listing's fireworks sentence appears word-for-word in 2024 coverage of a different town's show. It may well happen; if it matters to your night, call (828) 387-3003 before driving on it.",
    },
    {
      id: "faq-canceled",
      q: "Will the fireworks be canceled?",
      a: "Two things cancel mountain fireworks: weather on the night, and fire risk in the weeks before. This year has real drought context — Boone enacted Stage 2 water restrictions effective July 1, 2026, citing extreme drought. As of our last check, though, the town has posted no burn ban and no fireworks restriction, so that is context, not a cancellation. Tweetsie shoots in light rain and pushes to the next evening only for severe weather. This page rebuilds each morning and cannot see a same-day afternoon call; before you drive, check the official source linked on each show above.",
    },
    {
      id: "faq-dusk-meaning",
      q: `What does "at dusk" actually mean?`,
      a: `Dusk is not a vibe; it is a solar elevation. Civil dusk ends when the sun reaches 6 degrees below the horizon, the standard "dark enough" line, ${civil ?? "9:17 PM"} here on the Fourth. Event listings say "dusk" because it is legally safe and requires no math. We did the math.`,
    },
  ];
}

function buildJsonLd(views: VenueView[], faqs: Faq[], todayStr: string) {
  const confirmed = views.filter((v) => v.venue.status === "confirmed");
  const events = confirmed.map(({ venue }) => ({
    "@context": "https://schema.org",
    "@type": "Event",
    name: venue.showName,
    // Date-only when the official source says "dusk"; a clock time enters
    // schema ONLY when the venue states one. Computed times are ours, not theirs.
    startDate: venue.clockTimeStated ? `${venue.date}T${venue.clockTimeStated}:00-04:00` : venue.date,
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    location: {
      "@type": "Place",
      name: venue.locationName,
      address: { "@type": "PostalAddress", addressLocality: venue.town, addressRegion: "NC", addressCountry: "US" },
      geo: { "@type": "GeoCoordinates", latitude: venue.lat, longitude: venue.lon },
    },
    description: `Official listing: "${venue.officialWording}". Details and dusk math at ${PAGE_URL}`,
    image: "https://davessweater.com/assets/fireworks-photo.webp",
    ...(venue.sources.length
      ? { organizer: { "@type": "Organization", name: venue.sources[0].name, url: venue.sources[0].url } }
      : {}),
  }));
  return [
    // This page lives in the Resources → Reports hub; say so to crawlers.
    breadcrumbs([
      { name: "Home", path: "/" },
      { name: "Resources", path: "/resources" },
      { name: "Reports", path: "/resources/reports" },
      { name: `${SEASON.year} Fourth of July fireworks in Boone and the High Country`, path: "/reports/fireworks-fourth-july-2026" },
    ]),
    {
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: `${SEASON.year} Fourth of July fireworks in Boone and the High Country: exact times, computed`,
      url: PAGE_URL,
      dateModified: todayStr,
      description: "Per-venue dusk math, verified show details, terrain sightlines, and a fireworks-specific forecast for Boone, Watauga County, and the North Carolina High Country.",
      isPartOf: { "@type": "WebSite", name: "Dave's Sweater", url: "https://davessweater.com" },
    },
    ...events,
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faqs.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    },
  ];
}

export default async function Page() {
  const todayStr = today();
  const mode: PageMode = pageMode(todayStr);
  const forecast = await getFireworksForecast();
  const terrain = await getTerrain();
  const stale = !forecast || isStale(forecast.fetched_at);
  const views = buildViews(forecast, stale);
  const lastSun = new Map(
    views.map(({ venue }) => [
      venue.id,
      terrain?.horizons[venue.id]
        ? lastDirectSun(terrain.horizons[venue.id], venue.date, NY_TZ, venue.lat, venue.lon)
        : null,
    ]),
  );
  const faqs = buildFaqs(views);
  const forecastSeason = mode !== "archive" && todayStr >= `${SEASON.year}-07-01`;
  const tonight = views.filter((v) => v.venue.date === todayStr);
  const boonePacket = views.find((v) => v.venue.id === "boone")?.packet;
  const nextYearPacket = mode === "archive"
    ? solarPacket({ ...BOONE, date: `${SEASON.year + 1}-07-04`, tz: NY_TZ })
    : null;
  // One shared wind/smoke line for the outlook grid, instead of four clones.
  const windBits = views
    .map(({ venue, outlook }) =>
      outlook.stats?.windAvgMph != null && outlook.stats.windCompass
        ? `${venue.name} ${Math.round(outlook.stats.windAvgMph)} mph ${outlook.stats.windCompass}`
        : null,
    )
    .filter((b): b is string => b !== null);

  return (
    <>
      <JsonLd data={buildJsonLd(views, faqs, todayStr)} />
      <OpenTargetDetails />

      {/* Branded page header: the Right/Wrong Ray band language, plus a red,
          white, and blue volley in the homepage backdrop's dialect (.fw in
          globals.css) — masked quiet over the text column, still frame under
          reduced motion. */}
      <section className="relative isolate w-full overflow-hidden bg-teal-700 text-white">
        <div aria-hidden="true" className="fw pointer-events-none absolute inset-0 -z-10 overflow-hidden">
          <i className="fw-1 fw-red" />
          <i className="fw-2 fw-white" />
          <i className="fw-3 fw-blue" />
          <i className="fw-4 fw-white" />
          <i className="fw-5 fw-red" />
          <i className="fw-6 fw-blue" />
        </div>
        <div className="mx-auto w-full max-w-4xl px-4 py-10 sm:py-12">
          <p className="text-xs font-bold uppercase tracking-wider text-orange-300">
            The High Country fireworks page | Updated every morning
          </p>
          <h1 className="mt-1 font-display text-3xl font-bold tracking-tight sm:text-4xl">
            {`${SEASON.year} Fourth of July fireworks in Boone & the High Country`}
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-white/70">
            Every listing in Watauga County says &quot;at dusk.&quot; Dusk is math: exact computed times, a
            fireworks-specific forecast, and terrain sightlines for every show in Boone and the High Country.
          </p>
          {mode === "tonight" && tonight.length > 0 && (
            <div className="mt-4 rounded-md border-l-4 border-orange bg-white/10 px-4 py-3 text-sm">
              <strong className="font-semibold">Tonight:</strong>{" "}
              {tonight.map((v, i) => (
                <span key={v.venue.id}>
                  {i > 0 && " | "}
                  <a href={`#${v.venue.id}`} className="text-orange-300 underline underline-offset-2">{v.venue.name}</a>{" "}
                  {v.venue.clockTimeStated ? `at ${statedTimeLabel(v.venue)}` : `~${readWindow(v.packet.civilDuskEnd)}`}
                </span>
              ))}
              {"; "}fully dark at {fmtTime(tonight[0].packet.nauticalDuskEnd, NY_TZ)}.
            </div>
          )}
          {mode === "archive" && (
            <div className="mt-4 rounded-md border-l-4 border-white/30 bg-white/10 px-4 py-3 text-sm text-white/80">
              The {SEASON.year} shows are in the books. The dusk math below is timeless; show details get
              re-verified next June.{" "}
              {nextYearPacket && (
                <>Planning ahead: July 4, {SEASON.year + 1} sunset in Boone computes to{" "}
                {fmtTime(nextYearPacket.sunset, NY_TZ)}. The listings will still say &quot;dusk.&quot;</>
              )}
            </div>
          )}

          <p className="mt-5 flex flex-wrap gap-3">
            <a
              href="#checker"
              className="inline-flex min-h-10 items-center rounded-lg bg-orange-600 px-4 text-sm font-bold text-white transition-colors hover:bg-[#9a3412]"
            >
              Check my view &darr;
            </a>
            <a
              href="#forecast"
              className="inline-flex min-h-10 items-center rounded-lg border border-white/30 px-4 text-sm font-bold text-white transition-colors hover:bg-white/10"
            >
              Fireworks forecast &darr;
            </a>
            <a
              href="#shows"
              className="inline-flex min-h-10 items-center rounded-lg border border-white/30 px-4 text-sm font-bold text-white transition-colors hover:bg-white/10"
            >
              Event details &darr;
            </a>
          </p>
          <p className="mt-3 text-xs text-white/70">
            <a href="#times" className="underline underline-offset-2 hover:text-white">Start times</a>
            {" | "}
            <a href="#spots" className="underline underline-offset-2 hover:text-white">Where to watch</a>
            {" | "}
            <a href="#method" className="underline underline-offset-2 hover:text-white">Our methodology</a>
            {" | "}
            <a href="#faq" className="underline underline-offset-2 hover:text-white">Fireworks FAQs</a>
          </p>
        </div>
      </section>

      {/* Cross-link to the current events-desk report; not date-gated (the linked planner
          carries its own year and the annual re-verify sweep covers both pages). */}
      <SectionBand tone="surface" className="max-w-4xl">
        <p className="text-sm">
          <span className="font-bold">Also from the events desk:</span> the{" "}
          <Link
            href="/reports/grandfather-mountain-highland-games-planner-2026"
            className="text-teal underline underline-offset-2"
          >
            Grandfather Mountain Highland Games 2026 planner
          </Link>{" "}
          (July 9–12, MacRae Meadows). Filter the schedule, then get parking by day, the shuttle fare,
          between-event walk times, and a printable per-day itinerary.
        </p>
      </SectionBand>

      <SectionBand tone="light" id="checker" className="max-w-4xl">
        <h2 className="font-display text-2xl font-bold">Where Should You Watch From?</h2>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          Share your location or type an address to see what the view would be like: your browser computes
          the terrain between you and every show, pairs it with the night&apos;s sky forecast, and makes
          the call.
        </p>
        <p className="mb-3 mt-2 max-w-2xl text-sm text-muted">
          Prefer a known spot? The{" "}
          <a href="#spots" className="text-teal underline underline-offset-2">tested public spots</a> are
          right below.
        </p>
        <SightlineChecker
          sky={views.map(({ venue, outlook }) => ({ id: venue.id, name: venue.name, verdict: outlook.verdict }))}
          spots={(terrain?.viewpoints ?? []).map((vp) => ({
            name: vp.name,
            verdicts: Object.fromEntries(
              Object.entries(vp.results).map(([k, r]) => [k, spotVerdict(r, vp.environment)]),
            ) as Record<string, SightVerdict>,
          }))}
        />
      </SectionBand>

      <SectionBand tone="surface" id="forecast" className="max-w-4xl">
        <h2 className="font-display text-2xl font-bold">
          {mode === "archive" ? `The ${SEASON.year} Shows` : `Boone Fireworks Forecast: Fourth of July | ${SEASON.year}`}
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          Regular forecasts answer &quot;will it rain.&quot; Mountain fireworks die by other means (a low
          deck at burst height, valley fog, smoke over the crowd), so we call each show&apos;s sky from the
          hourly signals at its launch site.
        </p>
        {forecastSeason && stale && (
          <div className="mt-4 rounded-md border border-border bg-background px-4 py-3 text-sm text-muted">
            The forecast feed is {forecast ? "stale" : "missing"} this morning, so we are showing nothing
            rather than yesterday&apos;s sky. The times below are unaffected; the sun does not have feed
            outages.{forecast && <> Last fetch: {fmtStamp(forecast.fetched_at)}.</>}
          </div>
        )}
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {views.map(({ venue, packet, outlook }) => (
            <div key={venue.id} className="rounded-lg border border-border bg-background p-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-display text-sm font-bold">{venue.name}</h3>
                {forecastSeason && !stale && <VerdictChip verdict={outlook.verdict} />}
              </div>
              <p className="mt-1 text-sm text-muted">
                {fmtNight(venue.date)} |{" "}
                <strong className="font-semibold text-foreground">
                  {venue.clockTimeStated ? statedTimeLabel(venue) : `~${readWindow(packet.civilDuskEnd)}`}
                </strong>
                {venue.status === "unconfirmed" && (
                  <span className="text-xs font-semibold uppercase text-orange-600"> | unconfirmed</span>
                )}
              </p>
              {forecastSeason && !stale && outlook.verdict !== "unavailable" && outlook.stats && (
                <p className="mt-1.5 text-sm text-muted">
                  {outlook.reasons.length > 0
                    ? outlook.reasons.join(" ")
                    : `Low cloud ${Math.round(outlook.stats.cloudLowAvg ?? 0)}%${
                        outlook.stats.precipProbAvg !== null
                          ? `, rain ${Math.round(outlook.stats.precipProbAvg)}%`
                          : ""
                      }; no flags.`}
                </p>
              )}
              {forecastSeason && !stale && outlook.verdict === "unavailable" && (
                <p className="mt-1.5 text-sm text-muted">No usable sky data for this site; we do not guess.</p>
              )}
              <p className="mt-1.5 text-xs">
                <a href={`#${venue.id}`} className="text-teal underline underline-offset-2">details →</a>
              </p>
            </div>
          ))}
        </div>
        {forecastSeason && !stale && windBits.length > 0 && (
          <p className="mt-3 max-w-2xl text-sm text-muted">
            <strong className="text-foreground">Smoke Check:</strong> Wind over the show window runs{" "}
            {windBits.join(" | ")}.
            <br />
            Smoke drifts downwind; stand on the upwind side of whichever show you pick.
          </p>
        )}
        {forecastSeason && !stale && forecast && (
          <p className="mt-2 text-xs text-muted">
            Sky verdicts fetched {fmtStamp(forecast.fetched_at)}; refreshed every morning by the same
            pipeline that grades Ray. Exact thresholds live in{" "}
            <a href="#method" className="underline underline-offset-2">how we compute</a>.
          </p>
        )}
      </SectionBand>

      <SectionBand tone="dark" id="times" className="max-w-4xl">
        <h2 className="font-display text-2xl font-bold">When Will the Fireworks Start Around Boone?</h2>
        <p className="mb-3 mt-1 max-w-2xl text-sm text-white/70">
          Computed for each launch site&apos;s coordinates. <strong className="text-white">Dark Enough</strong>{" "}
          = end of civil twilight, the earliest a show plausibly starts.{" "}
          <strong className="text-white">Fully Dark</strong> = end of nautical twilight, when a finale looks
          its best. <strong className="text-orange-300">Our Read</strong> is the answer: when we expect the
          first shell.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] text-sm">
            <thead>
              <tr className="border-b border-white/20 text-left text-white/70">
                <th className="py-2 pr-3">Show</th>
                <th className="py-2 pr-3 font-bold text-orange-300">Our Read</th>
                <th className="py-2 pr-3">Night</th>
                <th className="py-2 pr-3">Last Sun*</th>
                <th className="py-2 pr-3">Sunset</th>
                <th className="py-2 pr-3">Dark Enough</th>
                <th className="py-2">Fully Dark</th>
              </tr>
            </thead>
            <tbody>
              {views.map(({ venue, packet }) => (
                <tr key={venue.id} className="border-b border-white/10">
                  <td className="py-2 pr-3 font-medium">
                    <a href={`#${venue.id}`} className="underline decoration-white/40 underline-offset-2 hover:decoration-white">
                      {venue.name}
                    </a>
                    {venue.status === "unconfirmed" && (
                      <span className="ml-1.5 align-middle text-[0.65rem] font-semibold uppercase tracking-wide text-orange-300">unconfirmed</span>
                    )}
                  </td>
                  <td className="py-2 pr-3 tabular-nums whitespace-nowrap font-semibold text-orange-300">
                    {venue.clockTimeStated ? statedTimeLabel(venue) : readWindow(packet.civilDuskEnd)}
                  </td>
                  <td className="py-2 pr-3 whitespace-nowrap">{fmtNight(venue.date)}</td>
                  <td className="py-2 pr-3 tabular-nums whitespace-nowrap">
                    {fmtTime(lastSun.get(venue.id) ?? null, NY_TZ) ?? "—"}
                  </td>
                  <td className="py-2 pr-3 tabular-nums whitespace-nowrap">{fmtTime(packet.sunset, NY_TZ)}</td>
                  <td className="py-2 pr-3 tabular-nums whitespace-nowrap">{fmtTime(packet.civilDuskEnd, NY_TZ)}</td>
                  <td className="py-2 tabular-nums whitespace-nowrap">{fmtTime(packet.nauticalDuskEnd, NY_TZ)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-sm text-white/70">
          *<strong className="text-white">Last Sun</strong>: when the sun drops behind the actual terrain
          west of each launch site (computed from a 33 ft-resolution elevation model; the flat-horizon
          tables cannot tell you this). The field goes to shade well before the sky dims; it does not move &quot;dark
          enough,&quot; which is sky-glow, not sunbeams.
        </p>
        {boonePacket && (
          <p className="mt-3 text-sm text-white/70">
            <strong className="text-white">The moon, since you asked:</strong>{" "}
            {boonePacket.moonrise ? (
              <>
                a {Math.round(boonePacket.moon.fraction * 100)}%-lit {boonePacket.moon.name} rises at{" "}
                {fmtTime(boonePacket.moonrise, NY_TZ)} on the Fourth, after the finales. Dark skies for the
                whole show; photographers, no moonwash.
              </>
            ) : (
              <>no moonrise during the evening on the Fourth. Dark skies for the whole show.</>
            )}
          </p>
        )}
      </SectionBand>

      <SectionBand tone="light" id="spots" className="max-w-4xl">
        <h2 className="font-display text-2xl font-bold">Where to Watch Fireworks in Boone</h2>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          We ran the same terrain line-of-sight from real public spots to every launch site: bare-earth
          elevation at about 33 ft resolution, earth curvature, typical (~{ftFromM50(BURST_TYPICAL_M)} ft)
          and finale (~{ftFromM50(BURST_FINALE_M)} ft) burst heights. The elevation model cannot see trees
          or buildings, so downtown and wooded spots carry an extra ~{ftFromM50(CLUTTER_PENALTY_M)} ft
          clutter allowance before we call their view anything but blocked. The margin shown is feet of
          clearance for a typical shell, allowance included.
        </p>
        {terrain && (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[34rem] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted">
                  <th className="py-2 pr-3">Spot</th>
                  <th className="py-2 pr-3">Boone Fireworks</th>
                  <th className="py-2 pr-3">Tweetsie Fireworks</th>
                  <th className="py-2">Notes</th>
                </tr>
              </thead>
              <tbody className="align-top">
                {terrain.viewpoints.map((vp) => (
                  <tr key={vp.id} className="border-b border-border/60">
                    <td className="py-2 pr-3 font-medium">{vp.name}</td>
                    <td className="py-2 pr-3"><SightChip r={vp.results["boone"]} env={vp.environment} /></td>
                    <td className="py-2 pr-3"><SightChip r={vp.results["tweetsie"]} env={vp.environment} /></td>
                    <td className="py-2 text-muted">
                      {vp.note}
                      {(vp.sensitive?.length ?? 0) > 0 && (
                        <span className="text-xs"> Verdict varies within ~300 ft of this pin; treat it as a maybe.</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-2 max-w-2xl text-sm text-muted">
          None of these spots, or realistically anywhere in the Boone bowl, has line of sight to the Beech
          Mountain or West Jefferson shows. Those you attend in person.
        </p>
        <ul className="mt-4 max-w-2xl space-y-2 text-sm text-muted">
          <li>
            <strong className="text-foreground">Arrive by sunset ({boonePacket ? fmtTime(boonePacket.sunset, NY_TZ) : "about 8:47 PM"}).</strong>{" "}
            The close lots fill in the half hour before the first shell, and the launch fields are in
            mountain shade from {fmtTime(lastSun.get("boone") ?? null, NY_TZ) ?? "well before that"}, so it
            feels later out there than the clock says.
          </li>
        </ul>
        <p className="mt-3 max-w-2xl text-sm text-muted">
          Somewhere else in mind? The{" "}
          <a href="#checker" className="text-teal underline underline-offset-2">checker above</a> runs the
          same math on any address.
        </p>
      </SectionBand>

      <SectionBand tone="surface" id="shows" className="max-w-4xl">
        <h2 className="font-display text-2xl font-bold">High Country Fourth of July Firework Show Details</h2>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {([
            ["#boone", "Boone"],
            ["#tweetsie", "Blowing Rock (Tweetsie)"],
            ["#beech-mountain", "Beech Mountain"],
            ["#west-jefferson", "West Jefferson"],
            ["#banner-elk", "Banner Elk"],
            ["#elk-park", "Elk Park"],
          ] as [string, string][]).map(([href, label]) => (
            <a
              key={href}
              href={href}
              className="rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium text-muted hover:border-teal hover:text-foreground"
            >
              {label}
            </a>
          ))}
        </div>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          Details below come from each show&apos;s official source, checked this season, with the source
          linked. Anything we could only trace to an aggregator says <em>unconfirmed</em>; we do not launder
          other people&apos;s guesses into facts.
        </p>
        <div className="mt-4 space-y-4">
          {views.map(({ venue, packet }) => (
            <details key={venue.id} id={venue.id} className="group scroll-mt-20 rounded-lg border border-border bg-background">
              <summary className="cursor-pointer list-none p-4 [&::-webkit-details-marker]:hidden">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="font-display text-base font-bold">
                    {venue.showName} <span className="font-normal text-muted">| {fmtNight(venue.date)}</span>
                  </h3>
                  <span className="flex items-baseline gap-3">
                    {venue.status === "confirmed" ? (
                      <span className="text-xs font-semibold text-green-700">
                        verified {venue.verifiedOn ? fmtNight(venue.verifiedOn) : "this season"}
                      </span>
                    ) : (
                      <span className="text-xs font-semibold uppercase tracking-wide text-orange-600">unconfirmed</span>
                    )}
                    <span className="text-xs font-medium text-teal">
                      <span className="group-open:hidden">More ▾</span>
                      <span className="hidden group-open:inline">Less ▴</span>
                    </span>
                  </span>
                </div>
                <p className="mt-1.5 text-sm text-muted">
                  <strong className="text-foreground">{venue.locationName}, {venue.town}.</strong>{" "}
                  {venue.officialWording === "—" ? (
                    <>No official start time published</>
                  ) : (
                    <>Official start: &quot;{venue.officialWording}&quot;</>
                  )}
                  {venue.clockTimeStated === null && packet.civilDuskEnd && (
                    <>, which computes to {readWindow(packet.civilDuskEnd)} here</>
                  )}
                  . Sunset {fmtTime(packet.sunset, NY_TZ)}, dark enough {fmtTime(packet.civilDuskEnd, NY_TZ)},
                  fully dark {fmtTime(packet.nauticalDuskEnd, NY_TZ)}.
                </p>
              </summary>
              <div className="px-4 pb-4">
              {venue.logistics.length > 0 && (
                <ul className="mt-2 space-y-1 text-sm text-muted">
                  {venue.logistics.map((l) => <li key={l}>· {l}</li>)}
                </ul>
              )}
              {venue.weatherPolicy && (
                <p className="mt-2 text-sm text-muted">
                  <strong className="text-foreground">Weather policy:</strong> {venue.weatherPolicy}
                </p>
              )}
              {venue.observed && venue.observed.length > 0 && (
                <div className="mt-2 text-sm text-muted">
                  <strong className="text-foreground">The observed record</strong> (what actually happened,
                  not what the listing said):
                  <ul className="mt-1 space-y-1">
                    {venue.observed.map((o) => (
                      <li key={o.year}>
                        · <strong className="text-foreground">{o.year}:</strong>{" "}
                        {o.firstShell ? (
                          <>first shell at <strong className="text-foreground">{fmtClock(o.firstShell)}</strong>. {o.note}</>
                        ) : (
                          o.note
                        )}
                        {o.source && (
                          <>
                            {" "}
                            <a href={o.source.url} target="_blank" rel="nofollow noopener noreferrer" className="text-xs text-teal underline underline-offset-2">
                              ({o.source.name})
                            </a>
                          </>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {venue.caveats.map((c) => (
                <p key={c} className="mt-2 text-sm text-orange-600">{c}</p>
              ))}
              {venue.sources.length > 0 && (
                <p className="mt-2 text-xs text-muted">
                  Source{venue.sources.length > 1 ? "s" : ""}:{" "}
                  {venue.sources.map((s, i) => (
                    <span key={s.url}>
                      {i > 0 && " | "}
                      <a href={s.url} target="_blank" rel="nofollow noopener noreferrer" className="text-teal underline underline-offset-2">{s.name}</a>
                    </span>
                  ))}
                </p>
              )}
              </div>
            </details>
          ))}
          {NO_SHOW_TOWNS.map((t) => (
            <div key={t.id} id={t.id} className="scroll-mt-20 rounded-lg border border-dashed border-border bg-background p-4">
              <h3 className="font-display text-base font-bold">{t.town} <span className="font-normal text-muted">| {t.headline}</span></h3>
              <p className="mt-1.5 text-sm text-muted">{t.note}</p>
              {t.sources.length > 0 && (
                <p className="mt-2 text-xs text-muted">
                  Source{t.sources.length > 1 ? "s" : ""}:{" "}
                  {t.sources.map((s, i) => (
                    <span key={s.url}>
                      {i > 0 && " | "}
                      <a href={s.url} target="_blank" rel="nofollow noopener noreferrer" className="text-teal underline underline-offset-2">{s.name}</a>
                    </span>
                  ))}
                </p>
              )}
            </div>
          ))}
        </div>
        <div className="mt-6 rounded-md border border-border bg-surface px-4 py-3">
          <h3 className="font-display text-sm font-bold">Reported Further Out, Could Not Verify</h3>
          <p className="mt-1 text-sm text-muted">
            These circulate on aggregator roundups; we found no primary source for any of them. Listed so you
            know what is out there and exactly how thin the sourcing is.
          </p>
          <ul className="mt-2 space-y-1.5 text-sm text-muted">
            {UNVERIFIED_REPORTS.map((r) => (
              <li key={r.town}>
                <strong className="text-foreground">{r.town}, {fmtNight(r.date)}:</strong> {r.claim}{" "}
                <span className="text-xs">({r.sourcing})</span>
              </li>
            ))}
          </ul>
        </div>
      </SectionBand>

      <SectionBand tone="light" id="faq">
        <h2 className="font-display text-2xl font-bold">Questions People Actually Search</h2>
        <div className="mt-3 max-w-2xl space-y-5">
          {faqs.map((f) => (
            <div key={f.id} id={f.id}>
              <h3 className="font-display text-base font-bold">{f.q}</h3>
              <p className="mt-1 text-sm text-muted">{f.a}</p>
            </div>
          ))}
        </div>
      </SectionBand>

      <SectionBand tone="surface" id="method">
        <h2 className="font-display text-2xl font-bold">How the Math Works</h2>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          Times are computed for each launch site&apos;s coordinates with standard almanac solar geometry
          (sunset = sun&apos;s upper limb at the refracted horizon; civil twilight ends at 6° below; nautical
          at 12°), the same convention NOAA and every printed table use. One honest caveat: those tables
          assume a flat horizon, and Boone does not have one; a western ridge steals some minutes of direct
          sun. Astronomical dusk, which is what fireworks care about, is unaffected. The terrain-adjusted
          version, when the sun actually drops behind Howard&apos;s Knob, is a bigger computation we are
          building next.
        </p>
        <div className="mt-4 max-w-2xl rounded-md border border-border bg-background px-4 py-3">
          <h3 className="font-display text-sm font-bold">How We Call the Sky (the Actual Thresholds)</h3>
          <ul className="mt-2 space-y-1 text-sm text-muted">
            <li>
              <strong className="text-foreground">Likely obstructed</strong> when, averaged over the 8–11 PM
              show window: low cloud exceeds {RUBRIC.obstructed.cloudLowAvgPct}%, or visibility drops under{" "}
              {RUBRIC.obstructed.visibilityMinMi} miles (fog), or rain is both likely
              (≥{RUBRIC.obstructed.precipProbAvgPct}%) and material (≥{RUBRIC.obstructed.precipTotalIn}″).
            </li>
            <li>
              <strong className="text-foreground">Iffy</strong> when low cloud exceeds{" "}
              {RUBRIC.iffy.cloudLowAvgPct}%, mid-level cloud exceeds {RUBRIC.iffy.cloudMidAvgPct}%, rain
              chance is ≥{RUBRIC.iffy.precipProbAvgPct}%, the temp–dew point spread pinches under{" "}
              {RUBRIC.iffy.spreadMinF}°F (the valley-fog setup), or visibility dips under{" "}
              {RUBRIC.iffy.visibilityMinMi} miles.
            </li>
            <li><strong className="text-foreground">Clear enough</strong> otherwise.</li>
            <li>
              No data, or data older than {RUBRIC.staleAfterHours} hours: we say so and show nothing. A
              stale forecast is not a forecast.
            </li>
          </ul>
        </div>
        <p className="mt-3 max-w-2xl text-sm text-muted">
          The sky verdicts pull Open-Meteo&apos;s hourly model per launch site each morning; the thresholds
          sit right here, in full, because{" "}
          <Link href="/methodology" className="text-teal underline underline-offset-2">receipts are a habit here</Link>.
          Show details were checked against primary sources this season; while doing it, we found town
          calendar pages in three different towns still displaying 2024 or 2025 dates. Not malice, just
          copy-paste. It is also why this page checks years. Dusk math recomputes automatically every year,
          forever. The listings will still say &quot;dusk.&quot;
        </p>
        <p className="mt-3 max-w-2xl text-sm text-muted">
          The sightline work runs on the same honesty: USGS bare-earth elevation (~33 ft resolution) via
          the open AWS terrain tiles, earth curvature with a standard refraction allowance, eye height
          ~6 ft above the local high ground, and a published ±{ftFromM50(MARGIN_NOISE_M)} ft noise band;
          anything inside it says &quot;marginal,&quot; never a false yes. Known spots also carry an
          environment tag: downtown and wooded locations pay a ~{ftFromM50(CLUTTER_PENALTY_M)} ft clutter
          allowance, because a bare-earth model that clears King Street by 40 ft has not met King
          Street&apos;s buildings. Typical municipal shells burst around {ftFromM50(BURST_TYPICAL_M)} ft
          up, finales near {ftFromM50(BURST_FINALE_M)} ft.
          &quot;Last sun&quot; in the times table is the same terrain model pointed west: the minute the
          ridgeline actually takes the sun off each launch field.
        </p>
      </SectionBand>
    </>
  );
}
