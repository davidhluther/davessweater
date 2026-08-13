import { allTowns, getTown } from "@/lib/towns";
import { brandOgCard, OG_SIZE } from "@/lib/ogCard";

export const alt = "Right Ray / Wrong Ray: daily forecast accuracy scores, graded against the town's own actuals.";
export const size = OG_SIZE;
export const contentType = "image/png";

// Prerender one card per town at build time. Without this the route stays
// dynamic and costs a serverless function, and this repo runs on Vercel Hobby
// with a hard 12-function ceiling (see CHECKLIST.md). Mirrors page.tsx: Boone
// keeps the root board, so it has no sibling here.
export async function generateStaticParams() {
  const towns = await allTowns();
  return towns.filter((t) => t.slug !== "boone").map((t) => ({ slug: t.slug }));
}

export default async function OgImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const town = await getTown(slug);
  const name = town?.name ?? "High Country";
  return brandOgCard({
    kicker: "RIGHT RAY / WRONG RAY",
    title: `Who gets ${name}'s weather right?`,
    subtitle: `Every ${name} forecast, graded daily against what actually happened.`,
    path: `/right-wrong-ray/${slug}`,
  });
}
