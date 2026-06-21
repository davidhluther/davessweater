import Link from "next/link";
import { getBlogPosts, slugFromLink } from "@/lib/data";

export const metadata = { title: "Blog" };

export default async function Page() {
  const posts = await getBlogPosts();
  return (
    <section className="rounded-[var(--radius)] bg-card p-6">
      <h2 className="mb-4 text-2xl font-bold">Blog</h2>
      {posts.length === 0 ? (
        <p className="text-muted">No posts yet — check back soon.</p>
      ) : (
        <ul className="space-y-5">
          {posts.map((p) => {
            const slug = slugFromLink(p.link, p.title);
            return (
              <li key={slug} className="border-b border-border pb-5 last:border-0">
                <Link href={`/blog/${slug}`} className="text-xl font-semibold hover:text-orange">{p.title}</Link>
                {p.date && <p className="text-xs text-muted">{p.date}</p>}
                {p.summary && <p className="mt-1 text-sm text-muted">{p.summary}</p>}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
