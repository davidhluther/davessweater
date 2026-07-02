import Link from "next/link";
import { CATEGORIES, REPORTS } from "@/content/resources";
import { fmtLongDate } from "@/lib/dates";
import { breadcrumbs, collectionPage } from "@/lib/schema";
import SectionBand from "@/components/SectionBand";
import SightlineTeaser from "@/components/SightlineTeaser";
import JsonLd from "@/components/JsonLd";

const DEF = CATEGORIES.find((c) => c.key === "reports")!;

export const metadata = {
  title: "Reports",
  description: DEF.description,
  alternates: { canonical: DEF.href },
  openGraph: { title: "Reports — Dave's Sweater", description: DEF.description },
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
      parts: REPORTS.map((r) => ({ name: r.title, path: r.href })),
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
      <h1 className="mt-3 mb-1 font-display text-2xl font-bold text-foreground">Reports</h1>
      <p className="mb-6 text-sm text-muted">Data deep-dives with charts and receipts.</p>
      {REPORTS.length === 0 ? (
        <p className="text-muted">No reports yet — check back soon.</p>
      ) : (
        <ul className="space-y-5">
          {REPORTS.map((r) => (
            <li key={r.href} className="border-b border-border pb-5 last:border-0">
              <h2 className="text-xl font-semibold">
                <Link href={r.href} className="text-orange-600 hover:underline underline-offset-2">
                  {r.title}
                </Link>
              </h2>
              {r.date && <p className="mt-0.5 text-xs text-muted">{fmtLongDate(r.date)}</p>}
              {r.summary && <p className="mt-1 text-sm text-muted">{r.summary}</p>}
            </li>
          ))}
        </ul>
      )}
      {/* Live teaser from the fireworks report: same input module as the
          on-page checker; Check hands off to /fireworks, which auto-runs it.
          Retire (or generalize) when the season's report rotates out. */}
      <div className="mt-8 rounded-2xl border border-border bg-surface p-5">
        <p className="text-xs font-bold uppercase tracking-wider text-orange-600">
          Try the fireworks report
        </p>
        <h2 className="mt-1 font-display text-lg font-bold text-foreground">Where should you watch from?</h2>
        <p className="mt-1 mb-3 max-w-2xl text-sm text-muted">
          Type an address (or share your location) and the report computes the terrain between you
          and every show &mdash; which fireworks you can actually see from there, paired with that
          night&apos;s sky forecast.
        </p>
        <SightlineTeaser />
      </div>
    </SectionBand>
  );
}
