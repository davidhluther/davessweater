import { getBlogPost, getBlogPosts, postSlug, postCategoryOf } from "@/lib/data";
import { CATEGORIES } from "@/content/resources";
import { fmtLongDate } from "@/lib/dates";
import { brandOgCard, OG_SIZE } from "@/lib/ogCard";

export const alt = "A Dave's Sweater post: Boone weather, scored and published free.";
export const size = OG_SIZE;
export const contentType = "image/png";
export const dynamicParams = false;

// Bottom-up, exactly as page.tsx does it: emit complete { category, slug } pairs.
// A child of a dynamic segment receives empty parent params here, so deriving
// the slug from an inherited `category` would prerender zero paths — the route
// would silently stay a serverless function against the Vercel Hobby 12-function
// ceiling (see CHECKLIST.md).
export async function generateStaticParams() {
  const posts = await getBlogPosts();
  return posts.map((p) => ({ category: postCategoryOf(p), slug: postSlug(p) }));
}

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
