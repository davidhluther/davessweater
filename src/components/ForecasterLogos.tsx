import { FORECASTERS } from "@/lib/forecasters";
import { cn } from "@/lib/utils";

// The small logo strip of the independent forecasters averaged into the Dave's
// Sweater Index, each linking out to its homepage (nofollow). Rendered in
// FORECASTERS order and filtered to whoever contributed today, so the strip
// always matches the sources behind the index. `align` lets the hero left-align
// it under the dek while the Today module keeps it centered.
export default function ForecasterLogos({ sources, align = "center" }: { sources: string[]; align?: "center" | "start" }) {
  const present = new Set(sources);
  const items = Object.entries(FORECASTERS).filter(([key]) => present.has(key));
  if (!items.length) return null;

  return (
    <ul className={cn("mt-4 flex flex-wrap items-center gap-2", align === "start" ? "justify-start" : "justify-center")}>
      {items.map(([key, f]) => (
        <li key={key}>
          <a
            href={f.homepage}
            target="_blank"
            rel="nofollow noopener noreferrer"
            title={f.label}
            aria-label={`${f.label} (opens in a new tab)`}
            className="flex h-9 items-center justify-center rounded-md bg-white px-2.5 ring-1 ring-black/5 transition hover:-translate-y-0.5 hover:ring-black/20"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={f.logo} alt="" className="h-6 w-auto object-contain" />
          </a>
        </li>
      ))}
    </ul>
  );
}
