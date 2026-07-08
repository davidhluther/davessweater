// /about — the consolidation page for what this site is: a free daily
// accountability service built on public data, not a business. Carries the
// data-democracy thesis, the name explanation (the sweater earns its place),
// and the held-to-our-own-standard commitment. Linked from the hero dek and
// the footer; the satire stays pointed at gated expertise, never bitter.
import Link from "next/link";
import SectionBand from "@/components/SectionBand";
import JsonLd from "@/components/JsonLd";

export const metadata = {
  title: "About — a service, not a business",
  description:
    "Dave's Sweater is a free daily accountability project for Boone weather forecasts, built on public data. Nobody owns the weather; we just grade the people forecasting it.",
  alternates: { canonical: "/about" },
  openGraph: {
    title: "About Dave's Sweater — a service, not a business",
    description:
      "Every Boone forecast graded daily on one open rubric, published free. Nobody owns the weather; we just grade the people forecasting it.",
    url: "https://davessweater.com/about",
    type: "website",
  },
};

const jsonLd = [
  {
    "@context": "https://schema.org",
    "@type": "AboutPage",
    "name": "About Dave's Sweater",
    "url": "https://davessweater.com/about",
    "description":
      "What Dave's Sweater is: a free, daily forecast-accuracy service for Boone, NC, built on public data.",
    "isAccessibleForFree": true,
    "mainEntityOfPage": "https://davessweater.com/about",
  },
  {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://davessweater.com" },
      { "@type": "ListItem", "position": 2, "name": "About", "item": "https://davessweater.com/about" },
    ],
  },
];

export default function Page() {
  return (
    <>
      <JsonLd data={jsonLd} />

      <section className="w-full bg-teal-700 text-white">
        <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:py-12">
          <div className="text-xs font-bold uppercase tracking-wider text-orange-300">About</div>
          <h1 className="mt-1 font-display text-3xl font-bold tracking-tight sm:text-4xl">
            A service, not a business
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-white/70">
            Dave&apos;s Sweater is a free, daily accountability project for Boone weather forecasts, and a
            small case study in what happens when public data gets handed back to the public.
          </p>
        </div>
      </section>

      <SectionBand tone="light">
        <h2 className="font-display text-xl font-bold">The short version</h2>
        <p className="mt-2 max-w-2xl text-sm">
          Every day around midday we capture what each forecaster predicts for Boone. The next day, the sky
          settles the question, and everyone gets graded on the same open 100-point rubric. The scores, the
          raw files, and the math are public. Nothing here is gated, subscribed, or sponsored, and{" "}
          <Link href="/methodology" className="text-teal underline underline-offset-2">the scoring is documented</Link>{" "}
          down to the tolerances.
        </p>
      </SectionBand>

      <SectionBand tone="surface">
        <h2 className="font-display text-xl font-bold">The name</h2>
        <p className="mt-2 max-w-2xl text-sm">
          Ray&apos;s Weather. Dave&apos;s Sweater. Say them fast, and that&apos;s the entry fee of the joke.
          But the sweater earns its place. Nobody owns the weather — not us, and not anyone selling it back
          with a r&eacute;sum&eacute; attached. What you can own is the sweater. Whether the morning calls
          for one is the single part of any forecast that&apos;s actually about you, which is why our index
          answers that question first and leaves the meteorology jargon out of it.
        </p>
        <p className="mt-3 max-w-2xl text-sm text-muted">
          (<Link href="/shop" className="text-teal underline underline-offset-2">The Realest Dave&apos;s Sweater Quarter-Zip</Link>{" "}
          exists, and it is, fittingly, the only thing around here with a price on it.)
        </p>
      </SectionBand>

      <SectionBand tone="light">
        <h2 className="font-display text-xl font-bold">Why it&apos;s free</h2>
        <p className="mt-2 max-w-2xl text-sm">
          This site costs about $12 a year to run, which is the price of the domain. The data behind every
          forecast we track is public — satellites, models, and stations your taxes already paid for.
          Charging for access to it would be the very thing this site exists to needle. So there&apos;s no
          subscription, no ad slot, no premium tier, and no plan for any. If the scoreboard saves you one
          soggy hike or one unnecessary layer, it has paid for itself.
        </p>
      </SectionBand>

      <SectionBand tone="surface">
        <h2 className="font-display text-xl font-bold">Held to the same standard</h2>
        <p className="mt-2 max-w-2xl text-sm">
          The rubric that grades Ray&apos;s Weather grades every source we track, including the ones we
          like. When our own weather station goes up in Boone, its readings join the same page, under the
          same math. Every claim on this site traces back to a file you can download and re-run. If
          we&apos;re wrong about something, the scoreboard will say so in public, which is how we&apos;d
          want it said about anybody else.
        </p>
      </SectionBand>

      <SectionBand tone="light">
        <h2 className="font-display text-xl font-bold">Beyond the weather</h2>
        <p className="mt-2 max-w-2xl text-sm">
          The same habit — find the public data, vet it, hand it over — built the{" "}
          <Link href="/reports/fireworks-fourth-july-2026" className="text-teal underline underline-offset-2">
            Fourth of July fireworks report
          </Link>{" "}
          and the{" "}
          <Link href="/reports/grandfather-mountain-highland-games-planner-2026" className="text-teal underline underline-offset-2">
            Highland Games planner
          </Link>
          . More of that is coming. If there&apos;s a High Country question that public data could answer
          and nobody has bothered to, Dave wants to hear about it.
        </p>
        <p className="mt-4 max-w-2xl text-xs text-muted">
          Not affiliated with or endorsed by Ray&apos;s Weather. Satire, with receipts.
        </p>
      </SectionBand>
    </>
  );
}
