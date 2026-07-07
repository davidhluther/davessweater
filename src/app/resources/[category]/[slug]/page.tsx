import { notFound } from "next/navigation";
import Link from "next/link";
import parse from "html-react-parser";
import { getBlogPosts, getBlogPost, postSlug, postCategoryOf } from "@/lib/data";
import { sanitizePostHtml } from "@/lib/html";
import { CATEGORIES } from "@/content/resources";
import { SITE_BASE, breadcrumbs, faqPage } from "@/lib/schema";
import SectionBand from "@/components/SectionBand";
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
  const title = post.metaTitle ?? post.title;
  const description = post.metaDescription ?? post.summary;
  return {
    title,
    description,
    alternates: { canonical: `/resources/${category}/${slug}` },
    openGraph: { title, description, type: "article" },
  };
}

export default async function Page({ params }: { params: Promise<{ category: string; slug: string }> }) {
  const { category, slug } = await params;
  const post = await getBlogPost(slug);
  if (!post) notFound();
  // A slug only lives at its own category's URL — the other category 404s.
  if (postCategoryOf(post) !== category) notFound();
  const def = CATEGORIES.find((c) => c.key === category);
  const html = sanitizePostHtml(post.content ?? post.summary ?? "");
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
        <h1 className="mt-3 font-display text-3xl font-extrabold text-foreground">{post.title}</h1>
        {post.date && <p className="mt-1 text-sm text-muted">{post.date}</p>}
        <div
          className={[
            "mt-6 max-w-none leading-relaxed text-foreground",
            "[&_h2]:font-display [&_h2]:mt-8 [&_h2]:mb-3 [&_h2]:text-xl [&_h2]:font-bold",
            "[&_h3]:font-display [&_h3]:mt-6 [&_h3]:mb-2 [&_h3]:text-lg [&_h3]:font-bold",
            "[&_h4]:mt-4 [&_h4]:mb-1 [&_h4]:font-bold",
            "[&_p]:my-3",
            "[&_a]:text-orange-600 [&_a]:hover:underline [&_a]:underline-offset-2",
            "[&_ul]:my-3 [&_ul]:space-y-1",
            "[&_ol]:my-3 [&_ol]:space-y-1",
            "[&_li]:ml-5 [&_li]:list-disc",
            "[&_ol_li]:list-decimal",
            "[&_blockquote]:my-4 [&_blockquote]:border-l-4 [&_blockquote]:border-border [&_blockquote]:pl-4 [&_blockquote]:text-muted",
            "[&_table]:my-5 [&_table]:block [&_table]:w-full [&_table]:overflow-x-auto [&_table]:border-collapse [&_table]:text-sm",
            "[&_th]:border [&_th]:border-border [&_th]:bg-foreground/5 [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:font-semibold [&_th]:align-top",
            "[&_td]:border [&_td]:border-border [&_td]:px-3 [&_td]:py-2 [&_td]:align-top",
            "[&_hr]:my-8 [&_hr]:border-border",
          ].join(" ")}
        >
          {parse(html)}
        </div>
      </article>
    </SectionBand>
  );
}
