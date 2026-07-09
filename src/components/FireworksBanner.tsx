import Link from "next/link";
import { SEASON, pageMode } from "@/lib/fireworks";
import { NY_TZ, fmtTime, localDateString, solarPacket } from "@/lib/solar";

// Homepage promo strip for the fireworks report. Renders only through the
// season (pageMode preview/tonight) and retires itself in archive mode — the
// site rebuilds on every daily data commit, so the date check stays current.
// The photo is owner-supplied CC0 1.0 ("Feuerwerk_1"), generic fireworks on a
// black sky — atmosphere only, no local-show claim; its black ground fades
// into the teal-900 band behind the masked left edge.
const BOONE = { lat: 36.2168, lon: -81.6746 };

export default function FireworksBanner() {
  const mode = pageMode(localDateString(NY_TZ));
  if (mode === "archive") return null;
  const p = solarPacket({ ...BOONE, date: `${SEASON.year}-07-04`, tz: NY_TZ });
  const dark = fmtTime(p.civilDuskEnd, NY_TZ);
  return (
    <Link
      href="/reports/fireworks-fourth-july-2026"
      className="group relative block w-full overflow-hidden bg-teal-900 text-white [background-image:radial-gradient(rgba(255,255,255,0.06)_1px,transparent_1px)] [background-size:22px_22px]"
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 right-0 w-3/5 overflow-hidden sm:w-1/2 [mask-image:linear-gradient(90deg,transparent,rgb(0,0,0)_45%)]"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/assets/fireworks-photo-sm.webp"
          alt=""
          loading="lazy"
          className="h-full w-full object-cover opacity-80"
        />
        {/* right-edge scrim: the CTA sits over the photo's brightest bursts */}
        <i
          className="absolute inset-0"
          style={{ background: "linear-gradient(90deg, transparent 45%, rgba(15, 34, 43, 0.6) 88%)" }}
        />
      </span>
      <span className="relative mx-auto flex w-full max-w-5xl flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3">
        <span className="text-xs font-bold uppercase tracking-wider text-orange-300">
          {mode === "tonight" ? "Fireworks tonight" : "Fourth of July"}
        </span>
        <span className="text-sm font-semibold">
          Every High Country show: start times, computed. Dark enough in Boone at {dark}.
        </span>
        <span className="ml-auto text-sm font-bold text-orange-300 group-hover:underline">
          See the fireworks report
        </span>
      </span>
    </Link>
  );
}
