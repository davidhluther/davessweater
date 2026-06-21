import { notFound } from "next/navigation";
import Link from "next/link";
import parse from "html-react-parser";
import { getBlogPosts, getBlogPost, slugFromLink } from "@/lib/data";
import { sanitizePostHtml } from "@/lib/html";

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
    <article className="rounded-[var(--radius)] bg-card p-6">
      <Link href="/blog" className="text-sm text-muted hover:text-orange">← All posts</Link>
      <h1 className="mt-2 text-3xl font-extrabold">{post.title}</h1>
      {post.date && <p className="mt-1 text-sm text-muted">{post.date}</p>}
      <div className="mt-4 max-w-none [&_a]:text-orange [&_h4]:mt-4 [&_h4]:font-bold [&_li]:ml-5 [&_li]:list-disc [&_p]:mt-3">
        {parse(html)}
      </div>
    </article>
  );
}
