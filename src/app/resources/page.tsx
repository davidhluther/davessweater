import Link from "next/link";
import { getBlogPosts, slugFromLink } from "@/lib/data";
import { getVideos } from "@/lib/feeds";
import { CATEGORIES, REPORTS, postCategory } from "@/content/resources";
import { breadcrumbs, collectionPage } from "@/lib/schema";
import SectionBand from "@/components/SectionBand";
import JsonLd from "@/components/JsonLd";

const DESCRIPTION =
  "Articles, news, videos, and data reports from Dave's Sweater, Boone's forecast-accuracy tracker.";

export const metadata = {
  title: "Resources",
  description: DESCRIPTION,
  alternates: { canonical: "/resources" },
  openGraph: { title: "Resources — Dave's Sweater", description: DESCRIPTION },
};

function countLine(count: number, noun: string): string {
  return count === 0 ? `No ${noun}s yet` : count === 1 ? `1 ${noun}` : `${count} ${noun}s`;
}

export default async function Page() {
  const [posts, videos] = await Promise.all([getBlogPosts(), getVideos()]);
  const byCategory = (cat: string) =>
    posts.filter((p) => postCategory(slugFromLink(p.link, p.title)) === cat);

  const stats: Record<string, { count: string; latest?: string }> = {
    articles: (() => {
      const a = byCategory("articles");
      return { count: countLine(a.length, "article"), latest: a[0]?.title };
    })(),
    news: (() => {
      const n = byCategory("news");
      return { count: countLine(n.length, "post"), latest: n[0]?.title };
    })(),
    videos: { count: countLine(videos.length, "video"), latest: videos[0]?.title },
    reports: { count: countLine(REPORTS.length, "report"), latest: REPORTS[0]?.title },
  };

  return (
    <SectionBand>
      <JsonLd data={[
        breadcrumbs([{ name: "Home", path: "/" }, { name: "Resources", path: "/resources" }]),
        collectionPage({
          name: "Resources", path: "/resources", description: DESCRIPTION,
          parts: CATEGORIES.map((c) => ({ name: c.schemaName, path: c.href })),
        }),
      ]} />
      <h1 className="font-display text-2xl font-bold text-foreground">Resources</h1>
      <p className="mt-1 text-sm text-muted">
        Everything we publish that isn&apos;t the live forecast, collected in one place.
      </p>
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {CATEGORIES.map((c) => {
          const s = stats[c.key];
          return (
            <Link key={c.key} href={c.href}
              className="rounded-2xl border border-border bg-background p-5 transition hover:-translate-y-0.5 hover:shadow-lg">
              <h2 className="font-display text-lg font-bold text-foreground">{c.label}</h2>
              <p className="mt-1 text-sm text-muted">{c.blurb}</p>
              <p className="mt-3 text-xs text-muted">
                {s.count}
                {s.latest && <> | Latest: <span className="text-foreground">{s.latest}</span></>}
              </p>
            </Link>
          );
        })}
      </div>
    </SectionBand>
  );
}
