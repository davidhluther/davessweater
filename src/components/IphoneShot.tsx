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
          <div className="flex aspect-[9/19] items-center justify-center rounded-[1.1rem] bg-surface px-3 text-center ds-caption">
            Today&apos;s forecast isn&apos;t in yet — check back tomorrow.
          </div>
        )}
      </div>
      {/* ds-caption, not a bespoke white: this figure renders on the light
          surface band, so the old `text-white/65` computed to 1.04:1 —
          invisible, and axe's one serious violation. Left over from a dark
          band it no longer sits on. */}
      {info.available && (
        <figcaption className="mt-2 text-center ds-caption">
          <span className="text-green" aria-hidden="true">●</span> {label}
          {info.date ? ` | Updated ${fmt(info.date)}` : ""}
        </figcaption>
      )}
    </figure>
  );
}
