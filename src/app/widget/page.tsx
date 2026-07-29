// GET /widget?town=&days=1|3|5&detail=summary|full
// A compact, self-contained forecast card meant to be embedded via <iframe> on
// third-party sites (see public/widget.js). Server-rendered from the same data
// as the site, honoring the same MIN_SCORED_DAYS gate. It deliberately loads NO
// analytics (GA4/Clarity/Meta pixel/ClickTracker are suppressed for /widget in
// AnalyticsScripts + ChromeGate) — it runs on other people's pages, so it stays
// light and private. The footer attribution doubles as the required backlink.
//
// Rebuilt 2026-07-28 (owner): the sweater verdict is GONE from the embed — "we
// shouldn't have 'no sweater' and '0 sweaters', let's drop the sweaters from
// this altogether and have all of the other forecast data" — and the card now
// carries real forecast density: today's consensus high/low with its conditions
// line and precip chance, named days ahead with per-day conditions text, and an
// almanac strip (sunrise, sunset, moon phase, river flow where a gauge honestly
// belongs to the town). Every number comes from data we already commit; nothing
// is fetched at view time, so an embed costs the host page one iframe and no
// third-party calls.
export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import HeightReporter from "./HeightReporter";
import {
  parseDays, parseDetail, precipChanceLabel, moonSummary, SITE_BASE,
} from "@/lib/publicFeed";
import { getTown, isTownPublic, getTownForecast5 } from "@/lib/towns";
import { getRiverForTown, formatFlow } from "@/lib/rivers";
import { stripDays, type StripDay } from "@/lib/forecast5";
import { solarPacket, fmtTime, localDateString, NY_TZ } from "@/lib/solar";
import { townHrefOn } from "@/lib/townPicker";

// Keep embeds out of the index — the canonical experience is the site itself.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
  title: "Forecast widget",
};

// Full weekday ("Tuesday") the way a forecast band names its periods; the
// leading day is labeled "Today" instead.
const weekdayLong = (date: string) =>
  new Date(date + "T12:00:00").toLocaleDateString("en-US", { weekday: "long" });

const FEET_PER_METER = 0.3048;

function Shell({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <>
      {/* The widget lives in an iframe on third-party pages: the embedding page's
          background must show through around the card, whatever theme it uses. */}
      <style>{`html, body { background: transparent }`}</style>
      <div
        id="ds-widget-root"
        className="mx-auto max-w-md overflow-hidden rounded-2xl bg-teal-900 text-white"
        style={{ fontFamily: "var(--font-inter), system-ui, sans-serif" }}
      >
        {children}
      </div>
      <HeightReporter id={id} />
    </>
  );
}

// CC BY requires credit with a link back; this IS that credit, and the brand
// backlink the license text hands reusers (lib/publicFeed ATTRIBUTION_HTML).
function Footer() {
  return (
    <div className="border-t border-white/10 px-3 py-2 text-[11px] text-white/70">
      Data by{" "}
      <a href={SITE_BASE} target="_blank" rel="noopener" className="text-white/90 underline underline-offset-2">
        Dave&apos;s Sweater
      </a>
      , licensed{" "}
      <a
        href="https://creativecommons.org/licenses/by/4.0/"
        target="_blank"
        rel="noopener"
        className="text-white/90 underline underline-offset-2"
      >
        CC BY 4.0
      </a>
    </div>
  );
}

// One upcoming day: the period name and date on the left, the temps hard right,
// the conditions sentence on its own line beneath. Two lines rather than one
// wrapping row, because a 300px embed column has no room for a third column and
// "Scattered storms, warm, breezy" must never be truncated into nonsense.
function DayRow({ day, showWind }: { day: StripDay; showWind: boolean }) {
  return (
    <li className="px-3 py-2">
      <div className="flex items-baseline gap-2">
        <span className="min-w-0 truncate text-[0.8rem] font-semibold">{weekdayLong(day.date)}</span>
        <span className="shrink-0 text-[10px] uppercase tracking-wide text-white/45">{day.dayLabel}</span>
        <span className="ml-auto shrink-0 text-[0.8rem] font-semibold tabular-nums">
          {day.high}&deg;
          <span className="font-normal text-white/55"> / {day.low}&deg;</span>
        </span>
      </div>
      <div className="mt-0.5 text-[0.72rem] leading-snug text-white/75">
        {day.summary}
        {showWind && day.wind ? <span className="text-white/50"> | wind {day.wind}</span> : null}
      </div>
    </li>
  );
}

export default async function WidgetPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? null;
  const id = first(sp.id) ?? "ds-widget";
  const slug = first(sp.town) || "boone";
  const days = parseDays(first(sp.days));
  const detail = parseDetail(first(sp.detail));
  const nDays = days.ok ? days.value : 3;
  const wantFull = detail.ok && detail.value === "full";

  if (!(await isTownPublic(slug))) {
    return (
      <Shell id={id}>
        <div className="px-3 py-4 text-sm text-white/85">
          No tracked forecast for that town yet. See{" "}
          <a href={SITE_BASE} target="_blank" rel="noopener" className="underline underline-offset-2">
            davessweater.com
          </a>
          .
        </div>
        <Footer />
      </Shell>
    );
  }

  const town = await getTown(slug);
  const f5 = await getTownForecast5(slug);
  const strip = stripDays(f5, { max: nDays });
  const [today, ...ahead] = strip;

  // Sunrise/sunset/moon are computed, not captured — the same solarPacket the
  // fireworks report runs on, at this town's own coordinates and elevation.
  // Elevation is passed through as suncalc's horizon-dip observer height; it
  // shifts the times by seconds at High Country elevations, and the sea-level
  // horizon convention is the standard almanac one (see lib/solar's header).
  const sun = town
    ? solarPacket({
        lat: town.lat,
        lon: town.lon,
        elevationM: town.elevation_ft * FEET_PER_METER,
        date: localDateString(NY_TZ),
        tz: NY_TZ,
      })
    : null;
  const sunriseAt = fmtTime(sun?.sunrise ?? null, NY_TZ);
  const sunsetAt = fmtTime(sun?.sunset ?? null, NY_TZ);
  // Null for every town without a gauge USGS names for it — including Boone.
  // See lib/rivers: no nearest-gauge borrowing.
  const river = await getRiverForTown(slug);

  const almanac: string[] = [];
  if (sunriseAt) almanac.push(`Sunrise ${sunriseAt}`);
  if (sunsetAt) almanac.push(`Sunset ${sunsetAt}`);
  if (sun) almanac.push(moonSummary(sun.moon.name, sun.moon.fraction));

  const todayPrecip = today ? precipChanceLabel(today) : null;
  const forecastHref = SITE_BASE + townHrefOn(slug, "weather");
  const scoreboardHref = SITE_BASE + townHrefOn(slug, "right-wrong-ray");

  return (
    <Shell id={id}>
      <div className="flex items-baseline justify-between gap-2 bg-teal-800 px-3 py-2">
        <span className="truncate font-semibold" style={{ fontFamily: "var(--font-space-grotesk), sans-serif" }}>
          {town?.name ?? slug}
        </span>
        {/* The embed runs its own compact scale, not the site's ds-* ladder:
            this markup renders inside someone else's page at an iframe height
            we advertise, so its type is sized to that box rather than to our
            pages. Keep it self-contained.
            Brand name, not "Index": the card now carries almanac and river
            lines alongside the consensus, so it is more than the index. */}
        <span className="shrink-0 text-[11px] uppercase tracking-wide text-orange-300">Dave&apos;s Sweater</span>
      </div>

      {!today ? (
        <div className="px-3 py-4 text-sm text-white/85">No current forecast available.</div>
      ) : (
        <>
          {/* Today, at the density the band deserves. The two numbers are
              LABELED "high" and "low" rather than presented as a current
              reading: this is the day's committed multi-source consensus, not a
              live observation, and the card must not imply otherwise. */}
          <div className="border-b border-white/10 px-3 pb-2.5 pt-2.5">
            <div className="text-[10px] uppercase tracking-wide text-white/45">
              Today <span className="text-white/25">|</span> {today.dayLabel}
            </div>
            <div className="mt-1 flex items-end gap-4">
              <div>
                <div className="text-[10px] uppercase tracking-wide text-white/45">High</div>
                <div
                  className="text-[2rem] font-bold leading-none tabular-nums"
                  style={{ fontFamily: "var(--font-space-grotesk), sans-serif" }}
                >
                  {today.high}&deg;
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wide text-white/45">Low</div>
                <div
                  className="text-[1.35rem] font-bold leading-none tabular-nums text-white/80"
                  style={{ fontFamily: "var(--font-space-grotesk), sans-serif" }}
                >
                  {today.low}&deg;
                </div>
              </div>
            </div>
            <div className="mt-2 text-[0.82rem] font-medium leading-snug">{today.summary}</div>
            {todayPrecip ? (
              <div className="text-[0.72rem] leading-snug text-white/70">{todayPrecip}</div>
            ) : null}
            {wantFull ? (
              <div className="mt-1 text-[0.68rem] text-white/50">
                {today.count}-source consensus
                {today.wind ? ` | wind ${today.wind}` : ""}
                {` | ${today.confidence} agreement`}
              </div>
            ) : null}
          </div>

          {ahead.length ? (
            <ul className="divide-y divide-white/10">
              {ahead.map((d) => (
                <DayRow key={d.date} day={d} showWind={wantFull} />
              ))}
            </ul>
          ) : null}
        </>
      )}

      {/* Almanac. Sun and moon are computed for this town; the river line
          appears only where a gauge genuinely belongs to it. */}
      {almanac.length || river ? (
        <div className="border-t border-white/10 bg-teal-800/60 px-3 py-2 text-[0.68rem] leading-relaxed text-white/70">
          {almanac.length ? <div>{almanac.join(" | ")}</div> : null}
          {river ? (
            <div>
              {river.river} {formatFlow(river.cfs)}
              {river.gageFt != null ? `, ${river.gageFt} ft` : ""}
              <span className="text-white/45"> (USGS)</span>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-white/10 px-3 py-2 text-[0.72rem] font-semibold">
        <a href={forecastHref} target="_blank" rel="noopener" className="text-orange-300 underline underline-offset-2">
          Full forecast
        </a>
        <a href={scoreboardHref} target="_blank" rel="noopener" className="text-orange-300 underline underline-offset-2">
          Forecast scoreboard
        </a>
      </div>

      <Footer />
    </Shell>
  );
}
