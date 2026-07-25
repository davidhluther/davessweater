// GET /widget?town=&days=1|3|5&detail=summary|full
// A compact, self-contained forecast card meant to be embedded via <iframe> on
// third-party sites (see public/widget.js). Server-rendered from the same data
// as the site, honoring the same MIN_SCORED_DAYS gate. It deliberately loads NO
// analytics (GA4/Clarity/Meta pixel/ClickTracker are suppressed for /widget in
// AnalyticsScripts + ChromeGate) — it runs on other people's pages, so it stays
// light and private. The footer attribution doubles as the required backlink.
export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import HeightReporter from "./HeightReporter";
import { parseDays, parseDetail, sweaterShort, SITE_BASE } from "@/lib/publicFeed";
import { getTown, isTownPublic, getTownForecast5 } from "@/lib/towns";
import { stripDays } from "@/lib/forecast5";
import { fmtLongDate } from "@/lib/dates";

// Keep embeds out of the index — the canonical experience is the site itself.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
  title: "Forecast widget",
};

const weekdayShort = (date: string) =>
  new Date(date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short" });

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

function Footer() {
  return (
    <div className="border-t border-white/10 px-3 py-2 text-[11px] text-white/70">
      <a href={SITE_BASE} target="_blank" rel="noopener" className="text-white/90 underline underline-offset-2">
        Dave&apos;s Sweater
      </a>
      <span className="mx-1.5">|</span>
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
  const byDate = new Map((f5?.days ?? []).map((d) => [d.date, d.sources]));

  return (
    <Shell id={id}>
      <div className="flex items-baseline justify-between gap-2 bg-teal-800 px-3 py-2">
        <span className="truncate font-semibold" style={{ fontFamily: "var(--font-space-grotesk), sans-serif" }}>
          {town?.name ?? slug}
        </span>
        <span className="shrink-0 text-[11px] uppercase tracking-wide text-orange-300">Dave&apos;s Sweater Index</span>
      </div>

      {strip.length === 0 ? (
        <div className="px-3 py-4 text-sm text-white/85">No current forecast available.</div>
      ) : (
        <ul className="divide-y divide-white/10">
          {strip.map((d) => {
            const src = byDate.get(d.date) ?? {};
            return (
              <li key={d.date} className="px-3 py-2">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-semibold">{weekdayShort(d.date)}</span>
                  <span className="text-[11px] text-white/60">{fmtLongDate(d.date)}</span>
                </div>
                <div className="mt-0.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-sm">
                  <span>
                    <span className="font-semibold">{d.high}&deg;</span>
                    <span className="text-white/60"> / {d.low}&deg;</span>
                  </span>
                  <span className="text-white/80">
                    {d.precip === "none" ? "No precip" : d.precipProb != null ? `${d.precipProb}% ${d.precip === "snow" ? "snow" : d.precip === "mixed" ? "mix" : "rain"}` : d.precipLabel}
                  </span>
                  <span className="rounded-full bg-teal-700 px-2 py-0.5 text-[11px] text-orange-300">
                    {d.sweaters} {d.sweaters === 1 ? "sweater" : "sweaters"}
                  </span>
                </div>
                <div className="mt-0.5 text-[11px] text-white/55">{sweaterShort(d.sweaters)}</div>
                {wantFull && (
                  <div className="mt-1 text-[11px] text-white/55">
                    {d.count}-source consensus
                    {d.wind ? ` | wind ${d.wind}` : ""}
                    {Object.keys(src).length ? ` | ${Object.keys(src).length} forecasts` : ""}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <Footer />
    </Shell>
  );
}
