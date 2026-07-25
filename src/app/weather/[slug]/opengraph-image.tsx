import { brandOgCard, OG_SIZE } from "@/lib/ogCard";
import { listPublicTowns, getTown } from "@/lib/towns";

export const alt = "A High Country town's multi-source forecast, graded by Dave's Sweater.";
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
    kicker: `${name.toUpperCase()}, NC`,
    title: `${name}'s forecast, at ${name}'s coordinates.`,
    subtitle: town
      ? `${town.elevation_ft.toLocaleString()} ft. Eight sources, graded daily against its own actuals.`
      : "Eight sources, graded daily against its own actuals.",
    path: `/weather/${slug}`,
  });
}
