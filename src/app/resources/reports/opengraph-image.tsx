import { CATEGORIES } from "@/content/resources";
import { brandOgCard, OG_SIZE } from "@/lib/ogCard";

export const alt = "Dave's Sweater reports — deep, data-backed local guides.";
export const size = OG_SIZE;
export const contentType = "image/png";

export default function OgImage() {
  const def = CATEGORIES.find((c) => c.key === "reports");
  return brandOgCard({
    kicker: "RESOURCES",
    title: def?.label ?? "Reports",
    subtitle: def?.description,
    path: "/resources/reports",
  });
}
