import { allTowns, getTown } from "@/lib/towns";
import { brandOgCard, OG_SIZE } from "@/lib/ogCard";

export const alt = "A real multi-source weather forecast, graded against the town's own actuals.";
export const size = OG_SIZE;
export const contentType = "image/png";

// Prerender one card per town at build time. Without this the route stays
// dynamic and costs a serverless function, and this repo runs on Vercel Hobby
// with a hard 12-function ceiling (see CHECKLIST.md). Mirrors page.tsx: Boone
// keeps `/`, so it has no /weather/boone twin.
export async function generateStaticParams() {
  const towns = await allTowns();
  return towns.filter((t) => t.slug !== "boone").map((t) => ({ slug: t.slug }));
}

export default async function OgImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const town = await getTown(slug);
  const name = town?.name ?? "High Country";
  return brandOgCard({
    kicker: "WEATHER",
    title: `${name}, NC weather`,
    subtitle: `Every source, one consensus, graded against ${name}'s own actuals.`,
    path: `/weather/${slug}`,
  });
}
