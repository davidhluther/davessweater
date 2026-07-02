import { rayCount } from "@/lib/sweater";

// The 1-5 verdict scale, rendered as Dave faces — Dave is the grader, so the
// rating is his (owner call, 2026-07-02; replaced the per-brand icons, which
// read as the services rating themselves). Icons are decorative; one label
// carries the meaning.
export default function VerdictScale({ score, iconSrc = "/assets/dave_face.png", alt = "" }:
  { score: number; iconSrc?: string; alt?: string }) {
  const n = rayCount(score);
  return (
    <span className="inline-flex items-center gap-0.5" role="img" aria-label={`${n} of 5${alt ? ` ${alt}` : ""}`}>
      {Array.from({ length: n }, (_, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={i} src={iconSrc} alt="" className="inline h-5 w-5 rounded-full object-contain align-middle" />
      ))}
    </span>
  );
}
