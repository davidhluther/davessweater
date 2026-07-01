import { latestScreenshotInfo } from "@/lib/screenshot";

function fmt(date: string | null): string {
  if (!date) return "";
  const d = new Date(date + "T12:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function IphoneShot({ className = "" }: { className?: string }) {
  const info = latestScreenshotInfo();
  const label = info.source === "apple" ? "Apple Weather" : "Open-Meteo forecast";
  return (
    <figure className={className}>
      <div className="mx-auto w-[150px] rounded-[1.4rem] bg-black p-1.5">
        {info.available ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src="/screenshots/iphone_screenshot.webp" alt={`${label} for Boone, NC`}
            fetchPriority="high" className="w-full rounded-[1.1rem]" />
        ) : (
          <div className="flex aspect-[9/19] items-center justify-center rounded-[1.1rem] bg-surface px-3 text-center text-xs text-muted">
            Today&apos;s forecast isn&apos;t in yet — check back tomorrow.
          </div>
        )}
      </div>
      {info.available && (
        <figcaption className="mt-2 text-center text-[0.7rem] text-white/65">
          <span className="text-green">●</span> {label}
          {info.date ? ` · updated ${fmt(info.date)}` : ""}
        </figcaption>
      )}
    </figure>
  );
}
