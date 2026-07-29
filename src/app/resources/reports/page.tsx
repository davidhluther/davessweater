import Link from "next/link";
import { CATEGORIES, REPORTS, TOOLS } from "@/content/resources";
import { fmtLongDate } from "@/lib/dates";
import { breadcrumbs, collectionPage } from "@/lib/schema";
import SectionBand from "@/components/SectionBand";
import SightlineTeaser from "@/components/SightlineTeaser";
import GmhgPlannerTeaser from "@/components/gmhg/GmhgPlannerTeaser";
import JsonLd from "@/components/JsonLd";

const DEF = CATEGORIES.find((c) => c.key === "reports")!;

// Titled for what the page actually holds, which is also what the nav calls it:
// the dated reports plus the standing tools (TOOLS). It read "Reports" while the
// nav read "Reports and Tools", and the tools were not on it at all.
export const metadata = {
  title: "Reports and Tools",
  description: DEF.description,
  alternates: { canonical: DEF.href },
  openGraph: { title: "Reports and Tools | Dave's Sweater", description: DEF.description },
};

export default function Page() {
  const jsonLd = [
    breadcrumbs([
      { name: "Home", path: "/" },
      { name: "Resources", path: "/resources" },
      { name: DEF.schemaName, path: DEF.href },
    ]),
    collectionPage({
      name: DEF.schemaName, path: DEF.href, description: DEF.description,
      parts: [...REPORTS, ...TOOLS].map((r) => ({ name: r.title, path: r.href })),
    }),
  ];
  return (
    <SectionBand>
      <JsonLd data={jsonLd} />
      <p className="text-sm">
        <Link href="/resources" className="text-orange-600 hover:underline underline-offset-2">
          &larr; All resources
        </Link>
      </p>
      <h1 className="mt-3 mb-1 ds-h1 text-foreground">Reports and Tools</h1>
      <p className="mb-6 ds-body text-muted">Data deep-dives with charts and receipts, and the free tools built on them.</p>
      {REPORTS.length === 0 ? (
        <p className="text-muted">No reports yet. Check back soon.</p>
      ) : (
        <ul className="space-y-5">
          {REPORTS.map((r) => (
            <li key={r.href} className="border-b border-border pb-5 last:border-0">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                {r.image && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={r.image}
                    alt={r.imageAlt ?? ""}
                    loading="lazy"
                    className="aspect-video w-full rounded-xl border border-border object-cover sm:w-56 sm:shrink-0"
                  />
                )}
                <div>
                  <h2 className="ds-h3">
                    <Link href={r.href} className="text-orange-600 hover:underline underline-offset-2">
                      {r.title}
                    </Link>
                  </h2>
                  {r.date && <p className="mt-0.5 ds-caption">{fmtLongDate(r.date)}</p>}
                  {r.summary && <p className="mt-1 ds-body text-muted">{r.summary}</p>}
                </div>
              </div>
              {r.href === "/reports/grandfather-mountain-highland-games-planner-2026" && (
                <div className="mt-4 rounded-xl border border-border bg-surface p-4">
                  <p className="ds-kicker text-orange-600">Jump straight into the planner</p>
                  <p className="mt-1 mb-3 ds-body text-muted">Pick a day, or start with the marquee events.</p>
                  <GmhgPlannerTeaser />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {/* The standing tools and trackers. Same card treatment as the reports
          above, one level down, because they belong to the same shelf: this is
          where the nav's "Reports and Tools" sends a reader looking for /roads
          or /report-card. Add to TOOLS in src/content/resources.ts, never to
          the header nav, which the owner keeps deliberately lean. */}
      {TOOLS.length > 0 && (
        <section className="mt-10 border-t border-border pt-6">
          <h2 className="ds-h2 text-foreground">Tools and trackers</h2>
          <p className="mt-1 ds-body text-muted">
            Pages that keep updating, rather than a report published once.
          </p>
          <ul className="mt-5 space-y-5">
            {TOOLS.map((t) => (
              <li key={t.href} className="border-b border-border pb-5 last:border-0">
                <h3 className="ds-h3">
                  <Link href={t.href} className="text-orange-600 hover:underline underline-offset-2">
                    {t.title}
                  </Link>
                </h3>
                {t.summary && <p className="mt-1 ds-body text-muted">{t.summary}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}
      {/* Live teaser from the fireworks report: same input module as the
          on-page checker; Check hands off to /fireworks, which auto-runs it.
          Retire (or generalize) when the season's report rotates out. */}
      <div className="mt-6 rounded-2xl border border-border bg-surface p-5">
        <p className="ds-kicker text-orange-600">
          Try the fireworks report
        </p>
        <h2 className="mt-1 ds-h3 text-foreground">Where should you watch from?</h2>
        <p className="mt-1 mb-3 max-w-2xl ds-body text-muted">
          Type an address (or share your location) and the report computes the terrain between you
          and every show, showing which fireworks you can actually see from there, paired with that
          night&apos;s sky forecast.
        </p>
        <SightlineTeaser />
      </div>
    </SectionBand>
  );
}
