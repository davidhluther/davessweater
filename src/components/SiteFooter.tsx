import Link from "next/link";

export default function SiteFooter() {
  return (
    <footer className="mt-auto bg-teal-900 text-white/70">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-1.5 px-4 py-6 text-xs">
        <div>
          Dave&apos;s Sweater |{" "}
          <span className="italic">Boone&apos;s most mostly reliable weather tracker and resource</span>
        </div>
        <div>
          <Link href="/about" className="text-white/85 underline underline-offset-2">What this is</Link>
          <span className="mx-2">|</span>
          <Link href="/methodology" className="text-white/85 underline underline-offset-2">How we score it</Link>
          <span className="mx-2">|</span>
          {/* /roads had exactly two inbound internal links (the reports listing and
              a line in /methodology) and GSC reported it "Discovered - currently
              not indexed" with no crawl on record as of 2026-08-30. The footer
              renders on every page, so this gives it a site-wide inbound link from
              pages Googlebot is crawling daily. Same slot is where /leaf and
              /tourism go when they ship. */}
          <Link href="/roads" className="text-white/85 underline underline-offset-2">Road conditions</Link>
          <span className="mx-2">|</span>
          <Link href="/api" className="text-white/85 underline underline-offset-2">Free Data and API</Link>
          <span className="mx-2">|</span>Not affiliated with or endorsed by Ray&apos;s Weather. We just check the math.
        </div>
      </div>
    </footer>
  );
}
