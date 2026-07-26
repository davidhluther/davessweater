import Link from "next/link";
import { cn } from "@/lib/utils";
import { allTowns } from "@/lib/towns";

// The location switcher: feels like a toggle, behaves like navigation. Every
// option is a real crawlable link to a statically-prerendered per-town URL —
// no client state, because town-query SEO is half the point of multiplying.
// Boone keeps its legacy URLs (there is deliberately no /weather/boone twin), so
// in every switcher "Boone" routes to `/` or `/right-wrong-ray`.
//
// `base` selects which surface we're switching within:
//   "weather"         → hub is /weather, town pages /weather/{slug}, Boone → /
//   "right-wrong-ray" → tracker /right-wrong-ray, town pages /right-wrong-ray/{slug}
export default async function TownSwitcher(
  { current, base }: { current: string; base: "weather" | "right-wrong-ray" },
) {
  const towns = await allTowns();
  const boone = towns.find((t) => t.slug === "boone")!;
  const others = towns
    .filter((t) => t.slug !== "boone")
    .sort((a, b) => a.name.localeCompare(b.name));
  const ordered = [boone, ...others];

  const href = (slug: string): string => {
    if (slug === "boone") return base === "weather" ? "/" : "/right-wrong-ray";
    return `/${base}/${slug}`;
  };

  return (
    <nav aria-label="Switch location" className="flex flex-wrap gap-1.5">
      {ordered.map((t) => {
        const active = t.slug === current;
        return (
          <Link
            key={t.slug}
            href={href(t.slug)}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex min-h-8 items-center rounded-full px-3 text-xs font-semibold transition-colors",
              active
                ? "bg-orange-600 text-white"
                : "border border-white/25 text-white/80 hover:bg-white/10 hover:text-white"
            )}
          >
            {t.name}
          </Link>
        );
      })}
    </nav>
  );
}
