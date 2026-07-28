import { getLatestForecasts } from "@/lib/data";
import { compositeForecast } from "@/lib/composite";
import { copy } from "@/content/copy";

// The "Dave's Sweater Index" half of the homepage Today module: a composite of
// all the independent automated forecasters' upcoming-day predictions.
// Self-fetches so it can be dropped in without threading data through the page.
export default async function CompositeForecast() {
  const c = compositeForecast(await getLatestForecasts());
  if (!c) return null;
  return (
    <div className="text-center">
      <div className="ds-kicker text-muted">
        {copy.index.title} | {c.dateLabel}
      </div>
      <div className="mt-1 ds-stat text-foreground">
        High {c.high}° <span className="text-muted/60">|</span> Low {c.low}° <span className="text-muted/60">|</span> {c.precipLabel}
      </div>
      <div className="mt-1 ds-caption">{copy.index.footnote(c.count)}</div>
      <div className="mt-1 ds-caption italic">{copy.index.tagline}</div>
    </div>
  );
}
