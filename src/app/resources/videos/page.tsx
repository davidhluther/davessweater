import Link from "next/link";
import { getVideos } from "@/lib/feeds";
import SectionBand from "@/components/SectionBand";

export const metadata = { title: "Videos" };

export default async function Page() {
  const videos = await getVideos();
  return (
    <SectionBand>
      <p className="text-sm">
        <Link href="/resources" className="text-orange-600 hover:underline underline-offset-2">
          &larr; All resources
        </Link>
      </p>
      <h1 className="mt-3 mb-1 font-display text-2xl font-bold text-foreground">Videos</h1>
      <p className="mb-6 text-sm text-muted">The forecast, but with moving pictures.</p>
      {videos.length === 0 ? (
        <p className="text-muted">No videos yet — check back soon.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {videos.map((v) => (
            <a
              key={v.link}
              href={v.link}
              target="_blank"
              rel="noopener"
              className="overflow-hidden rounded-xl border border-border bg-background transition-shadow hover:shadow-md"
            >
              {v.thumb && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={v.thumb} alt="" className="aspect-video w-full object-cover" />
              )}
              <div className="p-4">
                <p className="font-semibold text-foreground">{v.title}</p>
                <p className="mt-0.5 text-xs text-muted">{v.date}</p>
              </div>
            </a>
          ))}
        </div>
      )}
    </SectionBand>
  );
}
