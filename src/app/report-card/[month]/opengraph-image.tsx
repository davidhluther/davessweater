import { getReportCard } from "@/lib/data";
import { fmtLongDate } from "@/lib/dates";
import { brandOgCard, OG_SIZE } from "@/lib/ogCard";

export const alt = "A Dave's Sweater monthly report card — Boone forecast accuracy, scored and published free.";
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function OgImage({ params }: { params: Promise<{ month: string }> }) {
  const { month } = await params;
  const card = await getReportCard(month);
  return brandOgCard({
    kicker: "RAY'S WEATHER REPORT CARD",
    title: card?.title ?? "Ray's Weather Report Card",
    subtitle: card?.summary,
    path: `/report-card/${month}`,
    footer: card?.date ? `Published ${fmtLongDate(card.date)} | Boone, NC` : "Boone, NC",
  });
}
