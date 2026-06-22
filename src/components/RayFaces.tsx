import { rayCount } from "@/lib/sweater";
export default function RayFaces({ score }: { score: number }) {
  return (
    <span className="inline-flex">
      {Array.from({ length: rayCount(score) }, (_, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={i} src="/assets/ray_face.svg" alt="Ray" className="inline h-6 w-6 align-middle" />
      ))}
    </span>
  );
}
