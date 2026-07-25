import Link from "next/link";
import { ChevronDown } from "lucide-react";
import type { PublicTown } from "@/lib/towns";
import { cn } from "@/lib/utils";

// A compact location switcher for the town-scoped pages. It reads like a
// dropdown but every option is a real <a> that navigates — crawlable per-town
// URLs, not a client-state swap (spec §2a). Built on native <details>, so it
// toggles with zero JS; the whole roster is in the DOM for crawlers regardless
// of open state.
//
// base = which surface the options point at:
//   "weather"        → the forecast pages (Boone routes to /)
//   "right-wrong-ray" → the per-town scoreboards (Boone routes to /right-wrong-ray)

export default function TownSwitcher({
  towns,
  current,
  base,
}: {
  towns: PublicTown[];
  /** Slug of the town being viewed ("boone" on the flagship surfaces). */
  current: string;
  base: "weather" | "right-wrong-ray";
}) {
  const href = (slug: string): string => {
    if (slug === "boone") return base === "weather" ? "/" : "/right-wrong-ray";
    return `/${base}/${slug}`;
  };
  const currentTown = towns.find((t) => t.slug === current);
  const label = currentTown?.name ?? "Boone";

  return (
    <details className="group relative inline-block text-left">
      <summary className="inline-flex min-h-10 cursor-pointer list-none items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-semibold text-foreground [&::-webkit-details-marker]:hidden">
        <span className="text-xs font-normal uppercase tracking-wide text-muted">Town</span>
        <span>{label}</span>
        <ChevronDown className="size-4 text-muted transition-transform group-open:rotate-180" aria-hidden="true" />
      </summary>
      <div className="absolute left-0 z-40 mt-1 max-h-80 w-56 overflow-y-auto rounded-lg border border-border bg-background py-1 shadow-lg">
        {towns.map((t) => {
          const active = t.slug === current;
          return (
            <Link
              key={t.slug}
              href={href(t.slug)}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center justify-between gap-3 px-3 py-2 text-sm",
                active ? "bg-teal-700 text-white" : "text-foreground hover:bg-surface",
              )}
            >
              <span className="font-medium">{t.name}</span>
              <span className={cn("text-xs", active ? "text-white/70" : "text-muted")}>
                {t.elevation_ft.toLocaleString()} ft
              </span>
            </Link>
          );
        })}
      </div>
    </details>
  );
}
