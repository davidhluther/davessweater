import Link from "next/link";
import { SEASON, pageMode } from "@/lib/fireworks";
import { NY_TZ, fmtTime, localDateString, solarPacket } from "@/lib/solar";

// Homepage promo strip for the fireworks report. Renders only through the
// season (pageMode preview/tonight) and retires itself in archive mode — the
// site rebuilds on every daily data commit, so the date check stays current.
// The blooms are the hero volley's colors as static gradients: owned art,
// no stock photo, no license exposure.
const BOONE = { lat: 36.2168, lon: -81.6746 };

export default function FireworksBanner() {
  const mode = pageMode(localDateString(NY_TZ));
  if (mode === "archive") return null;
  const p = solarPacket({ ...BOONE, date: `${SEASON.year}-07-04`, tz: NY_TZ });
  const dark = fmtTime(p.civilDuskEnd, NY_TZ);
  return (
    <Link
      href="/fireworks"
      className="group relative block w-full overflow-hidden bg-teal-900 text-white [background-image:radial-gradient(rgba(255,255,255,0.06)_1px,transparent_1px)] [background-size:22px_22px]"
    >
      <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 w-1/2 overflow-hidden">
        <i
          className="absolute -top-10 right-6 h-28 w-28"
          style={{ background: "radial-gradient(circle closest-side, rgba(248, 113, 113, 0.7), transparent 70%)" }}
        />
        <i
          className="absolute -bottom-9 right-28 h-24 w-24"
          style={{ background: "radial-gradient(circle closest-side, rgba(255, 255, 255, 0.5), transparent 70%)" }}
        />
        <i
          className="absolute top-1 right-48 h-20 w-20"
          style={{ background: "radial-gradient(circle closest-side, rgba(96, 165, 250, 0.6), transparent 70%)" }}
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
          See the fireworks report &rarr;
        </span>
      </span>
    </Link>
  );
}
