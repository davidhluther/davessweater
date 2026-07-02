import { rayCount } from "@/lib/sweater";
export default function RayFaces({ score }: { score: number }) {
  const n = rayCount(score);
  return (
    <span className="inline-flex" role="img" aria-label={`${n} of 5 rays`}>
      {Array.from({ length: n }, (_, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={i} src="/assets/ray_face.svg" alt="" className="inline h-6 w-6 align-middle" />
      ))}
    </span>
  );
}
