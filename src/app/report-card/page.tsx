import Link from "next/link";
import { getReportCards } from "@/lib/data";
import { fmtLongMonth } from "@/lib/dates";
import { breadcrumbs, collectionPage } from "@/lib/schema";
import SectionBand from "@/components/SectionBand";
import JsonLd from "@/components/JsonLd";

// The report-card franchise hub: every month we have graded, newest first.
const DESCRIPTION =
  "The monthly Ray's Weather Report Card: how every Boone forecaster scored against verified actuals, month by month.";

export const metadata = {
  title: "Ray's Weather Report Card",
  description: DESCRIPTION,
  alternates: { canonical: "/report-card" },
  openGraph: { title: "Ray's Weather Report Card — Dave's Sweater", description: DESCRIPTION, url: "https://davessweater.com/report-card" },
};

export default async function Page() {
  const cards = await getReportCards();
  const jsonLd = [
    breadcrumbs([
      { name: "Home", path: "/" },
      { name: "Report Card", path: "/report-card" },
    ]),
    collectionPage({
      name: "Ray's Weather Report Card",
      path: "/report-card",
      description: DESCRIPTION,
      parts: cards.map((c) => ({ name: c.title, path: `/report-card/${c.reportMonth}` })),
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
      <h1 className="mt-3 mb-1 ds-h1 text-foreground">Ray&apos;s Weather Report Card</h1>
      <p className="mb-6 ds-body text-muted">
        Every month, scored: how each Boone forecaster did against what the weather actually did. Free, with receipts.
      </p>
      {cards.length === 0 ? (
        <p className="text-muted">No report cards yet — check back after the month closes.</p>
      ) : (
        <ul className="space-y-5">
          {cards.map((c) => (
            <li key={c.reportMonth} className="border-b border-border pb-5 last:border-0">
              <p className="ds-kicker text-orange-600">{fmtLongMonth(c.reportMonth)}</p>
              <h2 className="mt-0.5 ds-h3">
                <Link href={`/report-card/${c.reportMonth}`} className="text-orange-600 hover:underline underline-offset-2">
                  {c.title}
                </Link>
              </h2>
              {c.summary && <p className="mt-1 ds-body text-muted">{c.summary}</p>}
            </li>
          ))}
        </ul>
      )}
    </SectionBand>
  );
}
