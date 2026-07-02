import Link from "next/link";
import { REPORTS } from "@/content/resources";
import { fmtLongDate } from "@/lib/dates";
import SectionBand from "@/components/SectionBand";

export const metadata = { title: "Reports" };

export default function Page() {
  return (
    <SectionBand>
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
              <Link href={r.href} className="text-xl font-semibold text-orange-600 hover:underline underline-offset-2">
                {r.title}
              </Link>
              {r.date && <p className="mt-0.5 text-xs text-muted">{fmtLongDate(r.date)}</p>}
              {r.summary && <p className="mt-1 text-sm text-muted">{r.summary}</p>}
            </li>
          ))}
        </ul>
      )}
    </SectionBand>
  );
}
