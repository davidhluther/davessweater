import { brandOgCard, OG_SIZE } from "@/lib/ogCard";
import { listPublicTowns, getTown } from "@/lib/towns";

export const alt = "A High Country town's forecast-accuracy scoreboard from Dave's Sweater.";
export const size = OG_SIZE;
export const contentType = "image/png";
export const dynamicParams = false;

export async function generateStaticParams() {
  const towns = await listPublicTowns();
  return towns.filter((t) => t.slug !== "boone").map((t) => ({ slug: t.slug }));
}

export default async function OgImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const town = await getTown(slug);
  const name = town?.name ?? "This town";
  return brandOgCard({
    kicker: `${name.toUpperCase()} SCOREBOARD`,
    title: `Who actually gets ${name}'s weather right?`,
    subtitle: town?.has_rays
      ? "Every forecast graded daily against what happened — Ray's Weather included."
      : "Every forecast graded daily against what actually happened.",
    path: `/right-wrong-ray/${slug}`,
  });
}
