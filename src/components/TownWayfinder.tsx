import Link from "next/link";
import { allTowns } from "@/lib/towns";

// The homepage town picker, directly under the hero. The homepage IS Boone's
// forecast, so a visitor from anywhere else needs a way to reach their own town
// before scrolling a full Boone page.
//
// A native <details>/<summary> disclosure, not a pill wall (owner, 2026-07-27:
// "a toggle, like a dropdown but more aesthetically pleasing" — 18 pills read
// as clutter) and not a client-state dropdown: <details> keeps every town link
// in the prerendered HTML, so it stays crawlable and needs no JavaScript. Each
// option is a real, bookmarkable /weather/{slug} URL rendering that town's own
// homepage-style forecast. Renders nothing if Boone is the only tracked town.
export default async function TownWayfinder() {
  const towns = await allTowns();
  const others = towns
    .filter((t) => t.slug !== "boone")
    .sort((a, b) => a.name.localeCompare(b.name));
  if (!others.length) return null;

  return (
    <div className="border-b border-border bg-surface/70">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-x-3 gap-y-1.5 px-4 py-3">
        <span className="text-xs text-muted sm:text-sm">Showing Boone. Pick another town</span>
        <details className="group relative">
          <summary
            className="flex cursor-pointer list-none items-center gap-1.5 rounded-full border border-border bg-background px-3.5 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-foreground/5 [&::-webkit-details-marker]:hidden"
          >
            All 18 towns
            <span aria-hidden className="text-[0.6rem] text-muted transition-transform group-open:rotate-180">
              &#9660;
            </span>
          </summary>
          <div className="absolute left-1/2 z-40 mt-2 w-[19rem] -translate-x-1/2 rounded-xl border border-border bg-background p-2 shadow-lg sm:w-[22rem]">
            <Link
              href="/"
              className="block rounded-md bg-orange-600 px-3 py-2 text-xs font-semibold text-white"
              aria-current="page"
            >
              Boone
            </Link>
            <div className="mt-1 grid grid-cols-2 gap-x-1">
              {others.map((t) => (
                <Link
                  key={t.slug}
                  href={`/weather/${t.slug}`}
                  className="block rounded-md px-3 py-2 text-xs font-medium text-foreground/80 transition-colors hover:bg-foreground/5 hover:text-foreground"
                >
                  {t.name}
                </Link>
              ))}
            </div>
            <Link
              href="/weather"
              className="mt-1 block rounded-md px-3 py-2 text-xs font-semibold text-teal underline underline-offset-2"
            >
              Compare every town
            </Link>
          </div>
        </details>
      </div>
    </div>
  );
}
