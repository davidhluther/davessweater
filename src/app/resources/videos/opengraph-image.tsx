import { CATEGORIES } from "@/content/resources";
import { brandOgCard, OG_SIZE } from "@/lib/ogCard";

export const alt = "Dave's Sweater videos — Boone weather, on camera.";
export const size = OG_SIZE;
export const contentType = "image/png";

export default function OgImage() {
  const def = CATEGORIES.find((c) => c.key === "videos");
  return brandOgCard({
    kicker: "RESOURCES",
    title: def?.label ?? "Videos",
    subtitle: def?.description,
    path: "/resources/videos",
  });
}
