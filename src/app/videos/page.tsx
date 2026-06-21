import { getVideos } from "@/lib/feeds";

export const metadata = { title: "Videos" };

export default async function Page() {
  const videos = await getVideos();
  return (
    <section className="rounded-[var(--radius)] bg-card p-6">
      <h2 className="mb-4 text-2xl font-bold">Videos</h2>
      {videos.length === 0 ? (
        <p className="text-muted">No videos yet — check back soon.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {videos.map((v) => (
            <a key={v.link} href={v.link} target="_blank" rel="noopener"
              className="overflow-hidden rounded-lg border border-border transition-shadow hover:shadow-md">
              {v.thumb && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={v.thumb} alt="" className="aspect-video w-full object-cover" />
              )}
              <div className="p-3">
                <p className="font-semibold">{v.title}</p>
                <p className="text-xs text-muted">{v.date}</p>
              </div>
            </a>
          ))}
        </div>
      )}
    </section>
  );
}
