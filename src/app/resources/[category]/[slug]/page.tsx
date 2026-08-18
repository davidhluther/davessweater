import { notFound } from "next/navigation";
import Link from "next/link";
import { getBlogPosts, getBlogPost, postSlug, postCategoryOf } from "@/lib/data";
import { fmtLongDate } from "@/lib/dates";
import { CATEGORIES } from "@/content/resources";
import { ogAlt, ogImage, ogPath } from "@/lib/ogStatic";
import { SITE_BASE, breadcrumbs, faqPage } from "@/lib/schema";
import SectionBand from "@/components/SectionBand";
import PostBody from "@/components/PostBody";
import JsonLd from "@/components/JsonLd";

export const dynamicParams = false;

// Bottom-up: emit complete { category, slug } pairs so generation never
// depends on how the parent segment's params are threaded through.
export async function generateStaticParams() {
  const posts = await getBlogPosts();
  return posts.map((p) => ({ category: postCategoryOf(p), slug: postSlug(p) }));
}

export async function generateMetadata({ params }: { params: Promise<{ category: string; slug: string }> }) {
  const { category, slug } = await params;
  const post = await getBlogPost(slug);
  if (!post) return { title: "Post" };
  // Prerendered share card (public/og/...), not an opengraph-image route: a
  // dynamic-segment image route costs a Serverless Function against the Vercel
  // Hobby cap of 12. See src/lib/ogStatic.ts.
  const card = ogImage(ogPath.post(category, slug), ogAlt.post);
  const title = post.metaTitle ?? post.title;
  const description = post.metaDescription ?? post.summary;
  return {
    title,
    description,
    alternates: { canonical: `/resources/${category}/${slug}` },
    openGraph: { title, description, type: "article", url: `https://davessweater.com/resources/${category}/${slug}`, images: [card] },
  };
}

export default async function Page({ params }: { params: Promise<{ category: string; slug: string }> }) {
  const { category, slug } = await params;
  const post = await getBlogPost(slug);
  if (!post) notFound();
  // A slug only lives at its own category's URL — the other category 404s.
  if (postCategoryOf(post) !== category) notFound();
  const def = CATEGORIES.find((c) => c.key === category);
  const url = `/resources/${category}/${slug}`;
  const jsonLd = [
    breadcrumbs([
      { name: "Home", path: "/" },
      { name: "Resources", path: "/resources" },
      { name: def?.schemaName ?? "Resources", path: def?.href ?? "/resources" },
      { name: post.title, path: url },
    ]),
    {
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      headline: post.title,
      url: `${SITE_BASE}${url}`,
      mainEntityOfPage: `${SITE_BASE}${url}`,
      image: `${SITE_BASE}${ogPath.post(category, slug)}`,
      ...(post.date ? { datePublished: post.date } : {}),
      ...(post.summary ? { description: post.summary } : {}),
      author: { "@type": "Organization", name: "Dave's Sweater" },
      publisher: { "@type": "Organization", name: "Dave's Sweater", url: SITE_BASE },
    },
    // FAQPage for the post's "Frequently asked questions" section — the AEO
    // answer-engine signal (checklist #6). Only native posts carry parsed FAQs.
    ...(post.faqs && post.faqs.length ? [faqPage(post.faqs)] : []),
  ];
  return (
    <SectionBand>
      <JsonLd data={jsonLd} />
      <article>
        <Link href={def?.href ?? "/resources"} className="text-sm text-orange-600 hover:underline underline-offset-2">
          &larr; All {def?.label.toLowerCase() ?? "resources"}
        </Link>
        <h1 className="mt-3 ds-h1 text-foreground">{post.title}</h1>
        {post.date && <p className="mt-1 ds-body text-muted">{fmtLongDate(post.date)}</p>}
        <PostBody post={post} />
      </article>
    </SectionBand>
  );
}
