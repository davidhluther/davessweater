import Link from "next/link";
import { allTowns } from "@/lib/towns";

// The quiet strip under the homepage Today module (spec §2c): Boone is the
// flagship, but every other tracked town has its own real forecast one click
// away. Server-rendered links, so every town gets an internal link from the
// homepage — crawlable, no client state. Boone is omitted (this is its page).
export default async function AlsoTracking() {
  const towns = (await allTowns())
    .filter((t) => t.slug !== "boone")
    .sort((a, b) => a.name.localeCompare(b.name));
  if (!towns.length) return null;
  return (
    <div className="mx-auto max-w-2xl text-center ds-body text-muted">
      <p>
        Dave&apos;s Sweater also tracks a real forecast for{" "}
        <Link href="/weather" className="font-medium text-teal underline underline-offset-2">
          {towns.length} more High Country towns
        </Link>
        , each graded against its own actuals.
      </p>
      <p className="mt-2 flex flex-wrap justify-center gap-x-2 gap-y-1 text-xs">
        {towns.map((t, i) => (
          <span key={t.slug}>
            <Link href={`/weather/${t.slug}`} className="text-teal hover:underline underline-offset-2">
              {t.name}
            </Link>
            {i < towns.length - 1 ? <span className="text-muted/50"> | </span> : null}
          </span>
        ))}
      </p>
    </div>
  );
}
