import { brandOgCard, OG_SIZE } from "@/lib/ogCard";

export const alt = "About Dave's Sweater — a free daily accountability project for Boone weather forecasts.";
export const size = OG_SIZE;
export const contentType = "image/png";

export default function OgImage() {
  return brandOgCard({
    kicker: "ABOUT",
    title: "A service, not a business.",
    subtitle: "Every Boone forecast graded daily on one open rubric, published free. Nobody owns the weather.",
    path: "/about",
  });
}
