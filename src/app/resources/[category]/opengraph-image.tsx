import { CATEGORIES } from "@/content/resources";
import { brandOgCard, OG_SIZE } from "@/lib/ogCard";

export const alt = "Dave's Sweater resources — articles, news, videos, and reports.";
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function OgImage({ params }: { params: Promise<{ category: string }> }) {
  const { category } = await params;
  const def = CATEGORIES.find((c) => c.key === category);
  return brandOgCard({
    kicker: "RESOURCES",
    title: def?.label ?? "Resources",
    subtitle: def?.description,
    path: def?.href ?? "/resources",
  });
}
