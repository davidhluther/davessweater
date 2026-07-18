import { brandOgCard, OG_SIZE } from "@/lib/ogCard";

export const alt = "How Dave's Sweater scores weather forecast accuracy — the 100-point model.";
export const size = OG_SIZE;
export const contentType = "image/png";

export default function OgImage() {
  return brandOgCard({
    kicker: "METHODOLOGY",
    title: "One rubric. Every forecaster. Every day.",
    subtitle: "The 100-point model, how blank fields are handled, and where the actual weather comes from.",
    path: "/methodology",
  });
}
