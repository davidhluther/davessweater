import { getTown } from "@/lib/towns";
import { brandOgCard, OG_SIZE } from "@/lib/ogCard";

export const alt = "A real multi-source weather forecast, graded against the town's own actuals.";
export const size = OG_SIZE;
export const contentType = "image/png";

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
