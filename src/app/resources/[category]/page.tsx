import Link from "next/link";
import { notFound } from "next/navigation";
import { getBlogPosts, slugFromLink } from "@/lib/data";
import { CATEGORIES, postCategory, type PostCategory } from "@/content/resources";
import { breadcrumbs, collectionPage } from "@/lib/schema";
import SectionBand from "@/components/SectionBand";
import JsonLd from "@/components/JsonLd";

// Post-backed categories only — videos and reports have their own static routes.
const POST_CATEGORIES: PostCategory[] = ["articles", "news"];

export const dynamicParams = false;

export function generateStaticParams() {
  return POST_CATEGORIES.map((category) => ({ category }));
}

export async function generateMetadata({ params }: { params: Promise<{ category: string }> }) {
  const { category } = await params;
  const def = CATEGORIES.find((c) => c.key === category);
  if (!def) return { title: "Resources" };
  return {
    title: def.label,
    description: def.description,
    alternates: { canonical: def.href },
    openGraph: { title: `${def.label} — Dave's Sweater`, description: def.description },
  };
}

export default async function Page({ params }: { params: Promise<{ category: string }> }) {
  const { category } = await params;
  const def = CATEGORIES.find((c) => c.key === category);
  if (!def || !POST_CATEGORIES.includes(category as PostCategory)) notFound();

  const posts = (await getBlogPosts()).filter(
    (p) => postCategory(slugFromLink(p.link, p.title)) === category
  );
  const noun = category === "articles" ? "articles" : "posts";
  const jsonLd = [
    breadcrumbs([
      { name: "Home", path: "/" },
      { name: "Resources", path: "/resources" },
      { name: def.schemaName, path: def.href },
    ]),
    collectionPage({
      name: def.schemaName, path: def.href, description: def.description,
      parts: posts.map((p) => {
        const slug = slugFromLink(p.link, p.title);
        return { name: p.title, path: `/resources/${category}/${slug}` };
      }),
    }),
  ];

  return (
    <SectionBand>
      <JsonLd data={jsonLd} />
      <p className="text-sm">
        <Link href="/resources" className="text-orange-600 hover:underline underline-offset-2">
          &larr; All resources
        </Link>
      </p>
      <h1 className="mt-3 mb-1 font-display text-2xl font-bold text-foreground">{def.label}</h1>
      <p className="mb-6 text-sm text-muted">{def.blurb}</p>
      {posts.length === 0 ? (
        <p className="text-muted">No {noun} yet — check back soon.</p>
      ) : (
        <ul className="space-y-5">
          {posts.map((p) => {
            const slug = slugFromLink(p.link, p.title);
            return (
              <li key={slug} className="border-b border-border pb-5 last:border-0">
                <h2 className="text-xl font-semibold">
                  <Link
                    href={`/resources/${category}/${slug}`}
                    className="text-orange-600 hover:underline underline-offset-2"
                  >
                    {p.title}
                  </Link>
                </h2>
                {p.date && <p className="mt-0.5 text-xs text-muted">{p.date}</p>}
                {p.summary && <p className="mt-1 text-sm text-muted">{p.summary}</p>}
              </li>
            );
          })}
        </ul>
      )}
    </SectionBand>
  );
}
