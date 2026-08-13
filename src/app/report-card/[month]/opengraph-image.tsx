import { getReportCard, getReportCards } from "@/lib/data";
import { fmtLongDate } from "@/lib/dates";
import { brandOgCard, OG_SIZE } from "@/lib/ogCard";

export const alt = "A Dave's Sweater monthly report card: Boone forecast accuracy, scored and published free.";
export const size = OG_SIZE;
export const contentType = "image/png";
export const dynamicParams = false;

// Prerender one card per published report month, off the same loader page.tsx
// uses. Without this the route stays dynamic and costs a serverless function,
// and this repo runs on Vercel Hobby with a hard 12-function ceiling (see
// CHECKLIST.md).
export async function generateStaticParams() {
  const cards = await getReportCards();
  return cards.map((c) => ({ month: c.reportMonth }));
}

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
