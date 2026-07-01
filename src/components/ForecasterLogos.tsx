import { FORECASTERS } from "@/lib/forecasters";

// The small logo strip under the Dave's Sweater Index: the independent
// forecasters averaged into it, each linking out to its homepage (nofollow).
// Rendered in FORECASTERS order and filtered to whoever contributed today, so
// the strip always matches the sources behind the number above it.
export default function ForecasterLogos({ sources }: { sources: string[] }) {
  const present = new Set(sources);
  const items = Object.entries(FORECASTERS).filter(([key]) => present.has(key));
  if (!items.length) return null;

  return (
    <ul className="mt-4 flex flex-wrap items-center justify-center gap-2">
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
