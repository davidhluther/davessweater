import { rayCount } from "@/lib/sweater";

// The 1-5 verdict scale, rendered in each service's own mark: Ray's gets his
// face, everyone else gets their brand icon (emoji fallback where we hold no
// logo asset). Icons are decorative; one label carries the meaning.
export default function VerdictScale({ score, iconSrc, iconChar, alt = "" }:
  { score: number; iconSrc?: string; iconChar?: string; alt?: string }) {
  const n = rayCount(score);
  return (
    <span className="inline-flex items-center gap-0.5" role="img" aria-label={`${n} of 5${alt ? ` ${alt}` : ""}`}>
      {Array.from({ length: n }, (_, i) =>
        iconSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={i} src={iconSrc} alt="" className="inline h-5 w-5 rounded-sm object-contain align-middle" />
        ) : (
          <span key={i} aria-hidden="true" className="text-base leading-none">{iconChar ?? "●"}</span>
        )
      )}
    </span>
  );
}
