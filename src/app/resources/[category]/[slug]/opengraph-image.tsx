import { getBlogPost } from "@/lib/data";
import { CATEGORIES } from "@/content/resources";
import { fmtLongDate } from "@/lib/dates";
import { brandOgCard, OG_SIZE } from "@/lib/ogCard";

export const alt = "A Dave's Sweater post — Boone weather, scored and published free.";
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function OgImage({ params }: { params: Promise<{ category: string; slug: string }> }) {
  const { category, slug } = await params;
  const post = await getBlogPost(slug);
  const def = CATEGORIES.find((c) => c.key === category);
  return brandOgCard({
    kicker: (def?.label ?? "Resources").toUpperCase(),
    title: post?.title ?? "Dave's Sweater",
    subtitle: post?.summary,
    path: `/resources/${category}/${slug}`,
    footer: post?.date ? `Published ${fmtLongDate(post.date)} | Boone, NC` : "Boone, NC",
  });
}
