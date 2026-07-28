// The human-facing docs for the free data surface: JSON API, RSS feeds, and the
// embeddable widget, plus the CC BY 4.0 terms. Resources-style layout. Static —
// the feed list is read from the town registry at build.
import type { Metadata } from "next";
import Link from "next/link";
import SectionBand from "@/components/SectionBand";
import JsonLd from "@/components/JsonLd";
import { breadcrumbs } from "@/lib/schema";
import { listPublicTowns } from "@/lib/towns";
import { LICENSE_URL, ATTRIBUTION, SITE_BASE } from "@/lib/publicFeed";

const DESCRIPTION =
  "Every Dave's Sweater dataset, free and openly licensed: a JSON API, RSS feeds, and an embeddable forecast widget. CC BY 4.0.";

export const metadata: Metadata = {
  title: "Free Data and API",
  description: DESCRIPTION,
  alternates: { canonical: "/api" },
  openGraph: { title: "Free Data and API — Dave's Sweater", description: DESCRIPTION, url: `${SITE_BASE}/api` },
};

interface Endpoint {
  method: string;
  path: string;
  params: string;
  desc: string;
  example: string;
}

const ENDPOINTS: Endpoint[] = [
  {
    method: "GET",
    path: "/api/v1/forecast",
    params: "town, days (1|3|5), detail (summary|full)",
    desc: "The Dave's Sweater Index consensus forecast, N days out.",
    example: "/api/v1/forecast?town=boone&days=3&detail=summary",
  },
  {
    method: "GET",
    path: "/api/v1/today",
    params: "town, detail",
    desc: "Today's consensus forecast and sweater verdict.",
    example: "/api/v1/today?town=boone",
  },
  {
    method: "GET",
    path: "/api/v1/scores",
    params: "town",
    desc: "The season scoreboard: per-source average score and Right-Meh-Wrong record.",
    example: "/api/v1/scores?town=boone",
  },
  {
    method: "GET",
    path: "/api/v1/verdict",
    params: "town, date (YYYY-MM-DD)",
    desc: "The daily Right/Wrong Ray result for a scored day (defaults to the latest).",
    example: "/api/v1/verdict?town=boone",
  },
  {
    method: "GET",
    path: "/api/v1/towns",
    params: "—",
    desc: "The town registry: slugs, names, coordinates, elevation, scored-day counts.",
    example: "/api/v1/towns",
  },
];

const WIDGET_SNIPPET = `<script src="${SITE_BASE}/widget.js"
        data-town="boone"
        data-days="3"
        data-detail="summary" async></script>`;

const codeBox = "overflow-x-auto rounded-lg bg-teal-900 px-3 py-2 text-xs text-white";

export default async function ApiDocsPage() {
  const towns = await listPublicTowns();

  return (
    <SectionBand>
      <JsonLd data={[breadcrumbs([{ name: "Home", path: "/" }, { name: "Free Data and API", path: "/api" }])]} />

      <h1 className="font-display text-2xl font-bold text-foreground">Free Data and API</h1>
      <p className="mt-2 text-sm text-muted">
        Every forecast is a claim about tomorrow, and the data behind it is public. We find it, vet it, grade it, and
        hand it back free. Here is the whole tracker as a JSON API, a set of RSS feeds, and a forecast widget you can
        drop on your own site.
      </p>

      {/* License */}
      <div className="mt-6 rounded-2xl border border-border bg-surface p-5">
        <h2 className="font-display text-lg font-bold text-foreground">License and attribution</h2>
        <p className="mt-2 text-sm text-muted">
          The data is licensed{" "}
          <a href={LICENSE_URL} target="_blank" rel="noopener" className="text-orange-600 underline underline-offset-2">
            Creative Commons Attribution 4.0
          </a>{" "}
          (CC BY 4.0). Use it anywhere, including commercially. The one condition is credit. Attribute it like this:
        </p>
        <p className="mt-2 text-sm font-medium text-foreground">{ATTRIBUTION}</p>
        <p className="mt-2 text-xs text-muted">
          Every JSON response also carries <code>license</code> and <code>attribution</code> fields, and the widget
          credits us in its footer.
        </p>
      </div>

      {/* JSON API */}
      <h2 className="mt-8 font-display text-xl font-bold text-foreground">JSON API</h2>
      <p className="mt-1 text-sm text-muted">
        Base URL <code className="text-foreground">{SITE_BASE}/api/v1</code>. CORS is open, responses are edge-cached to
        the daily data cadence, and unknown towns return a 404 that lists the valid slugs. A town appears only once it
        has crossed the same track-record gate the site uses, so a thin sample is never dressed up as a dataset.
      </p>

      <div className="mt-4 space-y-3">
        {ENDPOINTS.map((e) => (
          <div key={e.path} className="rounded-2xl border border-border bg-background p-4">
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="rounded bg-green-700 px-1.5 py-0.5 text-[11px] font-semibold text-white">{e.method}</span>
              <code className="text-sm font-semibold text-foreground">{e.path}</code>
            </div>
            <p className="mt-1.5 text-sm text-muted">{e.desc}</p>
            <p className="mt-1 text-xs text-muted">
              Params: <span className="text-foreground">{e.params}</span>
            </p>
            <a href={e.example} target="_blank" rel="noopener" className="mt-2 block">
              <code className={codeBox + " block hover:opacity-90"}>{SITE_BASE}{e.example}</code>
            </a>
          </div>
        ))}
      </div>

      {/* RSS feeds */}
      <h2 className="mt-8 font-display text-xl font-bold text-foreground">RSS feeds</h2>
      <p className="mt-1 text-sm text-muted">
        Prerendered feeds for readers that do not speak JSON. Each town past the gate gets 1, 3, and 5-day forecast
        feeds plus a daily Right/Wrong Ray verdict feed.
      </p>
      <div className="mt-4 space-y-4">
        {towns.map((t) => (
          <div key={t.slug} className="rounded-2xl border border-border bg-background p-4">
            <h3 className="font-display text-base font-bold text-foreground">{t.name}</h3>
            <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
              {[1, 3, 5].map((n) => (
                <li key={n}>
                  <a
                    href={`/feed/${t.slug}/forecast-${n}day.xml`}
                    target="_blank"
                    rel="noopener"
                    className="text-orange-600 underline underline-offset-2"
                  >
                    {n}-day forecast
                  </a>
                </li>
              ))}
              <li>
                <a
                  href={`/feed/${t.slug}/verdict.xml`}
                  target="_blank"
                  rel="noopener"
                  className="text-orange-600 underline underline-offset-2"
                >
                  Right/Wrong Ray verdict
                </a>
              </li>
            </ul>
          </div>
        ))}
      </div>

      {/* Widget */}
      <h2 className="mt-8 font-display text-xl font-bold text-foreground">Embeddable widget</h2>
      <p className="mt-1 text-sm text-muted">
        Drop today&apos;s consensus forecast on your own site. Paste this where you want it. Set{" "}
        <code>data-town</code>, <code>data-days</code> (1, 3, or 5), and <code>data-detail</code> (summary or full). It
        loads no trackers and sizes itself to fit.
      </p>
      <pre className={codeBox + " mt-3 whitespace-pre"}>{WIDGET_SNIPPET}</pre>
      <p className="mt-2 text-xs text-muted">
        Preview:{" "}
        <a href="/widget?town=boone&days=3" target="_blank" rel="noopener" className="text-orange-600 underline underline-offset-2">
          the Boone 3-day card
        </a>
        .
      </p>

      <p className="mt-8 text-xs text-muted">
        Questions, or a town you want tracked? <Link href="/about" className="underline underline-offset-2">Start here</Link>.
      </p>
    </SectionBand>
  );
}
