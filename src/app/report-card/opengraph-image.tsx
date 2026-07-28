import { getReportCards } from "@/lib/data";
import { fmtLongMonth } from "@/lib/dates";
import { brandOgCard, OG_SIZE } from "@/lib/ogCard";

export const alt = "Ray's Weather Report Card: Boone forecast accuracy, scored month by month by Dave's Sweater.";
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function OgImage() {
  const cards = await getReportCards();
  const latest = cards[0];
  return brandOgCard({
    kicker: "RAY'S WEATHER REPORT CARD",
    title: "The forecast, graded every month",
    subtitle: latest
      ? `Latest: ${fmtLongMonth(latest.reportMonth)}. Every Boone forecaster scored against verified actuals.`
      : "Every Boone forecaster scored against verified actuals.",
    path: "/report-card",
    footer: "Scored monthly | Boone, NC",
  });
}
