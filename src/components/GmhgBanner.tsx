import Link from "next/link";
import { NY_TZ, localDateString } from "@/lib/solar";

// Homepage promo strip for the Highland Games planner. Renders through the event
// and retires itself the day after (the site rebuilds on every daily data
// commit, so the date check stays current). The torch-lighting photo (Skip
// Sickler, courtesy Grandfather Mountain Stewardship Foundation) is dark at the
// edges, so it fades into the teal-900 band behind the masked left edge.
const SLUG = "/reports/grandfather-mountain-highland-games-planner-2026";
const FIRST_DAY = "2026-07-09";
const LAST_DAY = "2026-07-12";

export default function GmhgBanner() {
  const today = localDateString(NY_TZ);
  if (today > LAST_DAY) return null; // retire after the games
  const live = today >= FIRST_DAY;
  return (
    <Link
      href={SLUG}
      className="group relative block w-full overflow-hidden bg-teal-900 text-white [background-image:radial-gradient(rgba(255,255,255,0.06)_1px,transparent_1px)] [background-size:22px_22px]"
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 right-0 w-3/5 overflow-hidden sm:w-1/2 [mask-image:linear-gradient(90deg,transparent,rgb(0,0,0)_45%)]"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/assets/gmhg-torch-lighting-photo-by-skip-sickler-courtesy-grandfather-mountain-stewardship-foundation-sm.webp"
          alt=""
          loading="lazy"
          className="h-full w-full object-cover object-center opacity-80"
        />
        <i
          className="absolute inset-0"
          style={{ background: "linear-gradient(90deg, transparent 45%, rgba(15, 34, 43, 0.6) 88%)" }}
        />
      </span>
      <span className="relative mx-auto flex w-full max-w-5xl flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3">
        <span className="text-xs font-bold uppercase tracking-wider text-orange-300">
          {live ? "Highland Games happening now" : "Highland Games · July 9–12"}
        </span>
        <span className="text-sm font-semibold">
          Plan your days: Filter the schedule, print a per-day itinerary, and get a field map with your stops pinned.
        </span>
        <span className="ml-auto text-sm font-bold text-orange-300 group-hover:underline">
          Open the free planner
        </span>
      </span>
    </Link>
  );
}
