import type { CSSProperties } from "react";
import { getLatestForecasts } from "@/lib/data";
import { compositeForecast } from "@/lib/composite";
import { wxVariant } from "@/lib/heroBackdrop";

// Ambient weather layer behind the hero: today's composite forecast rendered
// as light. The variant and the consensus-glow brightness (--n = number of
// contributing forecasters) are fixed at build time from the same data the
// Dave's Sweater Index prints — pure CSS animation, no client JS (the `.wx`
// system lives in globals.css). Self-fetches like CompositeForecast so it can
// be dropped into the hero without threading data through the page.
export default async function WeatherBackdrop() {
  const c = compositeForecast(await getLatestForecasts());
  const style = c ? ({ "--n": c.count } as CSSProperties) : undefined;
  return (
    <div
      aria-hidden="true"
      className={`wx ${wxVariant(c)} pointer-events-none absolute inset-0 -z-10 overflow-hidden`}
      style={style}
    >
      <i className="wx-a" />
      <i className="wx-b" />
      <i className="wx-c" />
    </div>
  );
}
