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
        {post.toc && post.toc.length > 1 && (
          <nav aria-label="On this page" className="mt-6 rounded-xl border border-border bg-foreground/[0.02] p-4">
            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted">On this page</p>
            <ul className="space-y-1.5">
              {post.toc.map((h2) => (
                <li key={h2.id}>
                  {h2.children.length > 0 ? (
                    <details className="group">
                      <summary className="flex cursor-pointer list-none items-center gap-1.5 [&::-webkit-details-marker]:hidden">
                        <span aria-hidden className="text-xs text-muted transition-transform group-open:rotate-90">&#9656;</span>
                        <a href={`#${h2.id}`} className="text-sm font-semibold text-foreground hover:text-orange-600 hover:underline underline-offset-2">{h2.text}</a>
                      </summary>
                      <ul className="ml-4 mt-1.5 space-y-1 border-l border-border pl-4">
                        {h2.children.map((h3) => (
                          <li key={h3.id}>
                            <a href={`#${h3.id}`} className="text-sm text-muted hover:text-orange-600 hover:underline underline-offset-2">{h3.text}</a>
                          </li>
                        ))}
                      </ul>
                    </details>
                  ) : (
                    <a href={`#${h2.id}`} className="ml-[1.375rem] block text-sm font-semibold text-foreground hover:text-orange-600 hover:underline underline-offset-2">{h2.text}</a>
                  )}
                </li>
              ))}
            </ul>
          </nav>
        )}
        <div
          className={[
            "mt-6 max-w-none leading-relaxed text-foreground",
            "[&_h2]:font-display [&_h2]:mt-10 [&_h2]:mb-3 [&_h2]:text-2xl [&_h2]:font-extrabold [&_h2]:scroll-mt-24 [&_h2]:border-b [&_h2]:border-border [&_h2]:pb-1.5",
            "[&_h3]:font-display [&_h3]:mt-6 [&_h3]:mb-2 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-foreground/90 [&_h3]:scroll-mt-24",
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
