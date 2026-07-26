import { getTown } from "@/lib/towns";
import { brandOgCard, OG_SIZE } from "@/lib/ogCard";

export const alt = "Right Ray / Wrong Ray: daily forecast accuracy scores, graded against the town's own actuals.";
export const size = OG_SIZE;
export const contentType = "image/png";

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
