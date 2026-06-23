import { notFound } from "next/navigation";
import Link from "next/link";
import parse from "html-react-parser";
import { getBlogPosts, getBlogPost, slugFromLink } from "@/lib/data";
import { sanitizePostHtml } from "@/lib/html";
import SectionBand from "@/components/SectionBand";

export async function generateStaticParams() {
  const posts = await getBlogPosts();
  return posts.map((p) => ({ slug: slugFromLink(p.link, p.title) }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getBlogPost(slug);
  return { title: post?.title ?? "Post" };
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getBlogPost(slug);
  if (!post) notFound();
  const html = sanitizePostHtml(post.content ?? post.summary ?? "");
  return (
    <SectionBand>
      <article>
        <Link href="/blog" className="text-sm text-orange-600 hover:underline underline-offset-2">
          ← All posts
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
          ].join(" ")}
        >
          {parse(html)}
        </div>
      </article>
    </SectionBand>
  );
}
