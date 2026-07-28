import { getLatestForecasts } from "@/lib/data";
import { compositeForecast } from "@/lib/composite";
import CompositeHeadline from "@/components/CompositeHeadline";

// The "Dave's Sweater Index" half of the homepage Today module: a composite of
// all the independent automated forecasters' upcoming-day predictions.
// Self-fetches so it can be dropped in without threading data through the page.
// The headline itself is shared with every town page (CompositeHeadline).
export default async function CompositeForecast() {
  const c = compositeForecast(await getLatestForecasts());
  if (!c) return null;
  return <CompositeHeadline composite={c} />;
}
